"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Node,
  Edge,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeTypes,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  REAL_PIPELINE_NODES,
  REAL_POSITIONS,
  VIZ_BRIDGE_STAGE_IDS,
  REEL_STAGE_IDS,
  NODE_TO_WORKFLOW,
  VizRun,
  deriveNodeStatuses,
  RealPipelineStageData,
} from "./realPipelineData";
import { CronTimeline } from "./CronTimeline";
import {
  PipelineStageData,
} from "./mockData";
import { PipelineNode } from "./PipelineNode";
import { PipelineDetailPanel } from "./PipelineDetailPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Play, Square, CheckCircle2,
  ExternalLink, RotateCcw, History, X,
  AlertTriangle, Github,
} from "lucide-react";
import { useAppStore, PipelineRun } from "@/lib/store";
import { VizEvent } from "@/app/api/github/viz-events/route";

const ZINC  = "#52525b";
const AMBER = "#f59e0b";

// ── Build the real pipeline graph ─────────────────────────────────────────────
function buildRealGraph(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = REAL_PIPELINE_NODES.map((stage) => ({
    id: stage.id,
    type: "pipelineNode",
    position: REAL_POSITIONS[stage.id] ?? { x: 0, y: 0 },
    data: stage as unknown as Record<string, unknown>,
    draggable: true,
  }));

  // Edges: 3 inputs → scout, then linear scout→extractor→...→publisher
  const FUCHSIA = "#d946ef";

  const edges: Edge[] = [
    // Inputs to scout
    {
      id: "e-reddit-scout",
      source: "reddit-input",
      target: "scout",
      animated: false,
      style: { stroke: ZINC, strokeWidth: 1.5, strokeDasharray: "5 3" },
      markerEnd: { type: MarkerType.ArrowClosed, color: ZINC, width: 12, height: 12 },
    },
    {
      id: "e-rss-scout",
      source: "rss-input",
      target: "scout",
      animated: false,
      style: { stroke: ZINC, strokeWidth: 1.5, strokeDasharray: "5 3" },
      markerEnd: { type: MarkerType.ArrowClosed, color: ZINC, width: 12, height: 12 },
    },
    {
      id: "e-manual-scout",
      source: "manual-input",
      target: "scout",
      animated: false,
      style: { stroke: ZINC, strokeWidth: 1.5, strokeDasharray: "5 3" },
      markerEnd: { type: MarkerType.ArrowClosed, color: ZINC, width: 12, height: 12 },
    },
    // Article pipeline (linear)
    ...VIZ_BRIDGE_STAGE_IDS.slice(0, -1).map((id, i) => {
      const nextId = VIZ_BRIDGE_STAGE_IDS[i + 1];
      return {
        id: `e-${id}-${nextId}`,
        source: id,
        target: nextId,
        animated: true,
        style: { stroke: AMBER, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: AMBER, width: 14, height: 14 },
      };
    }),
    // Reel pipeline (linear)
    ...REEL_STAGE_IDS.slice(0, -1).map((id, i) => {
      const nextId = REEL_STAGE_IDS[i + 1];
      return {
        id: `e-${id}-${nextId}`,
        source: id,
        target: nextId,
        animated: true,
        style: { stroke: FUCHSIA, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: FUCHSIA, width: 14, height: 14 },
      };
    }),
  ];

  return { nodes, edges };
}

const nodeTypes: NodeTypes = { pipelineNode: PipelineNode };

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function msToDisplay(ms: number): string {
  if (ms === 0) return "0s";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PipelineVisualizer() {
  // Always GitHub/Production mode — local pipeline removed
  const { nodes: initialNodes, edges: initialEdges } = buildRealGraph();

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const [selectedStage, setSelectedStage] = useState<PipelineStageData | RealPipelineStageData | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Run panel state
  const [topic, setTopic] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // GitHub Actions state
  const [ghError, setGhError] = useState<string | null>(null);
  const [ghLaunchMsg, setGhLaunchMsg] = useState<string | null>(null);
  const [ghActionsUrl, setGhActionsUrl] = useState<string | null>(null);
  const [ghPolling, setGhPolling] = useState(false);
  const [currentVizRunId, setCurrentVizRunId] = useState<string | null>(null);

  // Viz-events history
  const [vizEvents, setVizEvents] = useState<VizEvent[]>([]);

  const ghPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vizPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Store
  const pipelineRun = useAppStore((s) => s.pipelineRun);
  const setPipelineRun = useAppStore((s) => s.setPipelineRun);
  const storeCards = useAppStore((s) => s.kanbanCards);

  const candidateCards = React.useMemo(
    () => storeCards.filter((c) => c.column === "queued" || c.column === "sourced"),
    [storeCards]
  );
  const filteredSuggestions = React.useMemo(() => {
    if (!topic.trim()) return candidateCards.slice(0, 8);
    const q = topic.toLowerCase();
    return candidateCards.filter((c) => c.title.toLowerCase().includes(q)).slice(0, 8);
  }, [topic, candidateCards]);

  // ── Poll /api/workflows for real run statuses ────────────────────────────
  // Colors nodes green/amber/red/grey based on latest GitHub Actions run.
  useEffect(() => {
    let cancelled = false;

    async function fetchWorkflowStatuses() {
      try {
        const res = await fetch("/api/workflows");
        if (!res.ok) return;
        const data = (await res.json()) as {
          workflows: Array<{
            id: string;
            latestRun: { status: string; conclusion: string | null } | null;
          }>;
        };

        if (cancelled) return;

        // Build a map: workflow id -> derived status
        const wfStatusMap: Record<string, "success" | "running" | "failed" | "idle"> = {};
        for (const wf of data.workflows) {
          if (!wf.latestRun) {
            wfStatusMap[wf.id] = "idle";
          } else if (wf.latestRun.status === "completed") {
            wfStatusMap[wf.id] = wf.latestRun.conclusion === "success" ? "success" : "failed";
          } else if (wf.latestRun.status === "in_progress" || wf.latestRun.status === "queued") {
            wfStatusMap[wf.id] = "running";
          } else {
            wfStatusMap[wf.id] = "idle";
          }
        }

        // Apply to nodes via NODE_TO_WORKFLOW mapping
        setNodes((nds) =>
          nds.map((node) => {
            const wfId = NODE_TO_WORKFLOW[node.id];
            if (!wfId) return node; // source nodes etc. — leave unchanged
            const wfStatus = wfStatusMap[wfId];
            if (!wfStatus) return node;

            const stage = node.data as unknown as RealPipelineStageData;
            // Only apply workflow status when node is still idle (don't override
            // more granular viz-event status from article pipeline)
            if (stage.status !== "idle") return node;

            return {
              ...node,
              data: { ...stage, status: wfStatus } as unknown as Record<string, unknown>,
            };
          })
        );
      } catch {
        // silent
      }
    }

    fetchWorkflowStatuses();
    const interval = setInterval(fetchWorkflowStatuses, 60_000); // every 60s

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedStage(node.data as unknown as PipelineStageData);
    setShowHistory(false);
  }, []);

  // ── Reconcile stale "running" state on mount ──────────────────────────────
  // pipelineRun persists in Zustand localStorage. If the tab was closed while a
  // run was active the status stays "running" forever, even though GH Actions
  // already completed. On mount we check the real run-status and reconcile.
  useEffect(() => {
    if (!pipelineRun || pipelineRun.status !== "running") return;
    fetch("/api/github/run-status")
      .then((r) => r.json())
      .then((data: { run: { status: string; conclusion: string | null; html_url: string } | null }) => {
        const run = data.run;
        if (!run) return;
        if (run.status === "completed") {
          const finalStatus = run.conclusion === "success" ? "done" : "failed";
          setPipelineRun((prev) =>
            prev
              ? {
                  ...prev,
                  status: finalStatus,
                  ghWorkflowStatus: "completed",
                  ghWorkflowConclusion: run.conclusion,
                  ghActionsUrl: run.html_url || prev.ghActionsUrl,
                }
              : prev,
          );
        }
        // If still in-progress, resume polling so the UI stays live
        if (run.status !== "completed") {
          startGhPolling();
        }
      })
      .catch(() => {
        // Silently ignore — keep current state if the API is unreachable
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch viz-events on mount and for history panel ────────────────────────
  async function fetchVizEvents() {
    try {
      const res = await fetch("/api/github/viz-events");
      const data = (await res.json()) as { events: VizEvent[]; total: number };
      if (Array.isArray(data.events) && data.events.length > 0) {
        setVizEvents(data.events);
      }
    } catch {
      // silent fail
    }
  }

  useEffect(() => {
    fetchVizEvents();
  }, []);

  // Load latest viz-run into nodes on mount if events are available
  useEffect(() => {
    if (vizEvents.length > 0) {
      loadLatestVizRun();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Apply viz-events to real nodes ─────────────────────────────────────────
  function applyVizRunToNodes(run: VizRun) {
    const statusMap = deriveNodeStatuses(run);
    setCurrentVizRunId(run.id);
    setNodes((nds) =>
      nds.map((node) => {
        const info = statusMap[node.id];
        if (!info) return node;
        const stage = node.data as unknown as RealPipelineStageData;
        return {
          ...node,
          data: {
            ...stage,
            status: info.status,
            durationMs: info.durationMs,
            detail: info.detail,
            qualityScore: info.score,
            // Map to PipelineStageData-compatible fields for the detail panel
            duration: info.durationMs / 1000,
            logs: [`[viz-bridge] ${info.detail}`, ...(info.score ? [`Score: ${info.score}/100`] : [])],
          } as unknown as Record<string, unknown>,
        };
      })
    );
  }

  // ── GitHub Actions polling ─────────────────────────────────────────────────
  function startGhPolling() {
    setGhPolling(true);

    // Poll run-status every 15s
    ghPollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/github/run-status");
        const data = (await res.json()) as {
          run: {
            id: number;
            status: string;
            conclusion: string | null;
            html_url: string;
          } | null;
        };

        if (data.run) {
          const ghStatus = data.run.status;
          const ghConclusion = data.run.conclusion;

          setPipelineRun((prev) =>
            prev
              ? {
                  ...prev,
                  ghWorkflowStatus: ghStatus,
                  ghWorkflowConclusion: ghConclusion,
                }
              : prev
          );

          // Done?
          if (ghStatus === "completed") {
            const finalStatus = ghConclusion === "success" ? "done" : "failed";
            setPipelineRun((prev) =>
              prev ? { ...prev, status: finalStatus, durationMs: Date.now() - (prev.startedAt ?? Date.now()) } : prev
            );
            stopGhPolling();

            // Final viz-events fetch
            await fetchVizEvents();
          }
        }
      } catch {
        // ignore transient errors
      }
    }, 15000);

    // Poll viz-events every 30s to update node statuses live
    vizPollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/github/viz-events");
        const data = (await res.json()) as { events: VizEvent[] };
        if (!Array.isArray(data.events) || data.events.length === 0) return;

        setVizEvents(data.events);

        // Find the latest run
        const sorted = [...data.events].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        const latest = sorted[0];
        if (latest) {
          applyVizRunToNodes(latest as unknown as VizRun);
        }
      } catch {
        // ignore
      }
    }, 30000);
  }

  function stopGhPolling() {
    setGhPolling(false);
    if (ghPollIntervalRef.current) {
      clearInterval(ghPollIntervalRef.current);
      ghPollIntervalRef.current = null;
    }
    if (vizPollIntervalRef.current) {
      clearInterval(vizPollIntervalRef.current);
      vizPollIntervalRef.current = null;
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopGhPolling();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── GitHub Actions run ─────────────────────────────────────────────────────
  async function executeGitHubRun() {
    setGhError(null);
    setGhLaunchMsg(null);
    setGhActionsUrl(null);

    // Reset node statuses
    const { nodes: freshNodes, edges: freshEdges } = buildRealGraph();
    setNodes(freshNodes);
    setEdges(freshEdges);

    const initialRun: PipelineRun = {
      status: "running",
      track: "evergreen",
      topic: topic.trim() || "auto",
      currentStage: "scout",
      stages: {},
      totalCost: 0,
      startedAt: Date.now(),
      durationMs: null,
      mode: "github",
    };
    setPipelineRun(initialRun);

    try {
      const res = await fetch("/api/github/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() || undefined }),
      });
      const data = (await res.json()) as {
        error?: string;
        configured?: boolean;
        triggered?: boolean;
        message?: string;
        actionsUrl?: string;
        runId?: number | null;
        topic?: string | null;
      };

      if (!res.ok || data.error) {
        const errMsg = data.error ?? `HTTP ${res.status}`;
        setGhError(errMsg);
        setPipelineRun((prev) => prev ? { ...prev, status: "failed", failedLog: errMsg } : prev);
        return;
      }

      setGhLaunchMsg(data.message ?? "Pipeline launched on GitHub Actions");
      if (data.actionsUrl) setGhActionsUrl(data.actionsUrl);

      setPipelineRun((prev) =>
        prev
          ? {
              ...prev,
              ghRunId: data.runId ?? null,
              ghActionsUrl: data.actionsUrl,
            }
          : prev
      );

      startGhPolling();
    } catch (err) {
      const errMsg = `Failed to trigger: ${String(err)}`;
      setGhError(errMsg);
      setPipelineRun((prev) => prev ? { ...prev, status: "failed", failedLog: errMsg } : prev);
    }
  }

  function handleStop() {
    stopGhPolling();
    setPipelineRun((prev) => prev ? { ...prev, status: "stopping" } : prev);
  }

  function handleReset() {
    stopGhPolling();
    setGhError(null);
    setGhLaunchMsg(null);
    setGhActionsUrl(null);
    setCurrentVizRunId(null);
    setPipelineRun(null);
    const { nodes: freshNodes, edges: freshEdges } = buildRealGraph();
    setNodes(freshNodes);
    setEdges(freshEdges);
  }

  // ── Load latest viz-run into the real graph on demand ─────────────────────
  function loadLatestVizRun() {
    if (vizEvents.length === 0) return;
    const sorted = [...vizEvents].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    applyVizRunToNodes(sorted[0] as unknown as VizRun);
  }

  const runStatus = pipelineRun?.status ?? "idle";
  const isRunning = runStatus === "running" || runStatus === "stopping";
  const isDone = runStatus === "done" || runStatus === "failed";

  const enrichedSelectedStage = selectedStage as PipelineStageData | null;

  // Viz-events sorted newest first (for history)
  const vizHistory = React.useMemo(
    () =>
      [...vizEvents].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    [vizEvents]
  );

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800 bg-zinc-950 shrink-0 flex-wrap gap-y-2">
        <h1 className="text-sm font-semibold text-white mr-1">Pipeline</h1>

        <div className="w-px h-4 bg-zinc-800" />

        {/* Run panel — shown when idle */}
        {!isRunning && !isDone && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                value={topic}
                onChange={(e) => { setTopic(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Topic hint (optional)…"
                title="The real pipeline selects its own topic via editorial-router — this is just a hint"
                className="h-7 w-64 px-2 text-xs bg-zinc-900 border border-zinc-700 rounded-md text-zinc-400 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 cursor-default"
                onKeyDown={(e) => {
                  if (e.key === "Enter") { setShowSuggestions(false); executeGitHubRun(); }
                  if (e.key === "Escape") setShowSuggestions(false);
                }}
              />
              {showSuggestions && (
                <div className="absolute top-full left-0 mt-1 w-80 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
                  <div className="px-2 py-1 border-b border-zinc-800">
                    <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">Queued &amp; sourced articles</span>
                  </div>
                  {filteredSuggestions.length > 0 ? filteredSuggestions.map((card) => (
                    <button key={card.id} type="button" onMouseDown={(e) => { e.preventDefault(); setTopic(card.title); setShowSuggestions(false); }} className="w-full text-left px-3 py-2 hover:bg-zinc-800 transition-colors">
                      <p className="text-xs text-white truncate leading-tight">{card.title}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{card.column === "queued" ? "queued" : "sourced"}{card.destination ? ` · ${card.destination}` : ""}</p>
                    </button>
                  )) : (
                    <div className="px-3 py-3 text-xs text-zinc-600">No queued articles{topic.trim() ? " — will use typed topic as hint" : ""}</div>
                  )}
                </div>
              )}
            </div>
            <Button
              size="sm"
              onClick={executeGitHubRun}
              className="bg-violet-600 hover:bg-violet-500 text-white font-medium h-7 px-3 gap-1.5 text-xs"
            >
              <Play className="w-3 h-3" />
              Run production pipeline
            </Button>
          </div>
        )}

        {/* Running state */}
        {isRunning && (
          <div className="flex items-center gap-2">
            {ghLaunchMsg && (
              <span className="text-xs text-violet-300 flex items-center gap-1">
                <Github className="w-3 h-3" />
                {ghLaunchMsg}
                {ghActionsUrl && (
                  <a href={ghActionsUrl} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 ml-1">
                    <ExternalLink className="w-3 h-3 inline" />
                  </a>
                )}
              </span>
            )}
            {runStatus === "stopping" && (
              <span className="text-xs text-zinc-400">Stopping…</span>
            )}
            {ghPolling && (
              <Badge variant="outline" className="border-violet-800 text-violet-400 bg-violet-950/40 gap-1 text-xs animate-pulse">
                polling
              </Badge>
            )}
            <Button size="sm" onClick={handleStop} className="bg-red-600 hover:bg-red-500 text-white font-medium h-7 px-3 gap-1.5 text-xs">
              <Square className="w-3 h-3" />
              Stop
            </Button>
          </div>
        )}

        {/* Done state */}
        {isDone && (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={runStatus === "done" ? "border-emerald-800 text-emerald-400 bg-emerald-950/40 gap-1 text-xs" : "border-red-800 text-red-400 bg-red-950/40 gap-1 text-xs"}
            >
              {runStatus === "done" ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
              {runStatus === "done" ? "Done" : `Failed${pipelineRun?.failedStage ? ` at ${pipelineRun.failedStage}` : ""}`}
            </Badge>
            {runStatus === "failed" && (pipelineRun?.failedLog || ghError) && (
              <span className="text-xs text-red-400/80 max-w-xs truncate" title={pipelineRun?.failedLog ?? ghError ?? ""}>
                {(pipelineRun?.failedLog ?? ghError ?? "").replace(/^\[\d{4}-\d{2}-\d{2}[^\]]*\]\s*/, "")}
              </span>
            )}
            {pipelineRun?.durationMs && (
              <span className="text-xs text-zinc-600">· {(pipelineRun.durationMs / 1000).toFixed(0)}s</span>
            )}
            {pipelineRun?.ghActionsUrl && (
              <a href={pipelineRun.ghActionsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300">
                <Github className="w-3 h-3" />
                Actions
              </a>
            )}
            {pipelineRun?.publishedUrl && (
              <a href={pipelineRun.publishedUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-emerald-950/40 border border-emerald-800/50 text-emerald-400 hover:text-emerald-300">
                <ExternalLink className="w-3 h-3" />
                View live
              </a>
            )}
            <Button size="sm" variant="outline" onClick={handleReset} className="h-7 px-2.5 text-xs border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 gap-1">
              <RotateCcw className="w-3 h-3" />
              Reset
            </Button>
          </div>
        )}

        {/* Error badge (pre-run) */}
        {ghError && !pipelineRun && (
          <Badge variant="outline" className="border-red-800 text-red-400 bg-red-950/40 gap-1 text-xs max-w-sm truncate">
            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
            {ghError}
          </Badge>
        )}

        <div className="w-px h-4 bg-zinc-800" />

        {/* Current viz run id + load latest button */}
        <div className="flex items-center gap-2">
          {currentVizRunId && (
            <span className="text-[10px] text-zinc-600 font-mono truncate max-w-[160px]" title={currentVizRunId}>
              {currentVizRunId}
            </span>
          )}
          {vizEvents.length > 0 && !isRunning && (
            <button
              onClick={loadLatestVizRun}
              className="text-xs text-zinc-500 hover:text-white flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Load latest run
            </button>
          )}
        </div>

        {/* History button */}
        <button
          onClick={() => { setShowHistory(!showHistory); setSelectedStage(null); }}
          className={`flex items-center gap-1.5 h-6 px-2.5 text-xs rounded-md font-medium transition-colors border ml-auto ${
            showHistory ? "bg-zinc-700 text-white border-zinc-600" : "text-zinc-500 hover:text-white border-zinc-800 hover:border-zinc-700"
          }`}
        >
          <History className="w-3 h-3" />
          History
          {vizHistory.length > 0 && (
            <span className={`rounded-full text-[10px] font-semibold px-1 ${showHistory ? "bg-zinc-600 text-white" : "bg-zinc-800 text-zinc-400"}`}>
              {vizHistory.length}
            </span>
          )}
        </button>
      </div>

      {/* Flow canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.2}
          maxZoom={2}
          colorMode="dark"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#27272a" />
          <Controls
            className="[&>button]:bg-zinc-900 [&>button]:border-zinc-700 [&>button]:text-zinc-400 [&>button:hover]:bg-zinc-800"
            showFitView
            showZoom
            showInteractive={false}
          />
          <MiniMap
            className="!bg-zinc-900 !border-zinc-700"
            nodeColor={(n) => {
              const variant = (n.data as { variant?: string }).variant;
              if (variant === "source") return "#3f3f46";
              if (variant === "publish") return "#064e3b";
              return "#1e1b4b";
            }}
            maskColor="rgba(0,0,0,0.4)"
          />

          {/* Mode label overlay */}
          <Panel position="top-left" className="mt-10 ml-2 pointer-events-none">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-xs text-violet-400/80 bg-violet-950/20 rounded px-2 py-1">
                <Github className="w-3 h-3" />
                Article pipeline — viz-bridge agents
              </div>
              <div className="flex items-center gap-1.5 text-xs text-fuchsia-400/80 bg-fuchsia-950/20 rounded px-2 py-1">
                <Github className="w-3 h-3" />
                Reel pipeline — 3x/day cron
              </div>
            </div>
          </Panel>
        </ReactFlow>

        {/* History panel — left side */}
        {showHistory && (
          <div className="absolute top-0 left-0 h-full w-80 bg-zinc-950 border-r border-zinc-800 flex flex-col z-10 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <span className="text-sm font-semibold text-white">Production Runs</span>
              <button onClick={() => setShowHistory(false)} className="text-zinc-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {vizHistory.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-zinc-600">No production runs yet — hit Run production pipeline or Load latest run</div>
              ) : (
                <div className="divide-y divide-zinc-900">
                  {vizHistory.map((run) => {
                    const mariescore = run.stages.find((s) => s.agent === "marie")?.score;
                    const publisherStage = run.stages.find((s) => s.agent === "publisher");
                    const totalMs = run.stages.reduce((acc, s) => acc + s.duration_ms, 0);
                    const allPassed = run.stages.every((s) => s.status === "pass" || s.status === "success");
                    return (
                      <div
                        key={run.id}
                        className="px-4 py-3 hover:bg-zinc-900/50 transition-colors cursor-pointer"
                        onClick={() => { applyVizRunToNodes(run as unknown as VizRun); setShowHistory(false); }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="text-xs text-white font-medium leading-tight line-clamp-2 flex-1">{run.article}</p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${allPassed ? "bg-emerald-950 text-emerald-400" : "bg-red-950 text-red-400"}`}>
                            {allPassed ? "done" : "partial"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {run.destination && (
                            <span className="text-[10px] text-zinc-500">{run.destination}</span>
                          )}
                          {mariescore !== undefined && (
                            <span className="text-[10px] font-medium text-rose-400">MARIE {mariescore}/100</span>
                          )}
                          {totalMs > 0 && (
                            <span className="text-[10px] text-zinc-600">{msToDisplay(totalMs)}</span>
                          )}
                          <span className="text-[10px] text-zinc-700 ml-auto">
                            {timeAgo(new Date(run.timestamp).getTime())}
                          </span>
                        </div>
                        {publisherStage && (
                          <div className="mt-1 text-[10px] text-zinc-600 truncate">{publisherStage.detail}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Detail panel — right side */}
        {enrichedSelectedStage && (
          <PipelineDetailPanel
            stage={enrichedSelectedStage}
            onClose={() => setSelectedStage(null)}
            onRetry={undefined}
          />
        )}
      </div>

      {/* Cron schedule timeline */}
      <CronTimeline />
    </div>
  );
}
