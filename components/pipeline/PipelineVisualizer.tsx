"use client";

import React, { useCallback, useEffect, useState } from "react";
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
  ALL_PIPELINE_STAGES,
  PipelineStageData,
  EVERGREEN_PATH_COST,
  EVERGREEN_PATH_DURATION,
  NEWS_PATH_COST,
  NEWS_PATH_DURATION,
} from "./mockData";
import { PipelineNode } from "./PipelineNode";
import { PipelineDetailPanel } from "./PipelineDetailPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, CheckCircle2, Timer, DollarSign, Leaf, Zap } from "lucide-react";

// ── Node positions ─────────────────────────────────────────────────────────────
// Layout: sources (left) → extract → router → two horizontal tracks → publish
const POSITIONS: Record<string, { x: number; y: number }> = {
  // Sources (vertical stack, y = 0 / 150 / 300)
  "reddit-scrape":  { x: 0,    y: 0   },
  "rss-fetch":      { x: 0,    y: 150 },
  "manual-input":   { x: 0,    y: 300 },
  // Shared
  "extract":        { x: 290,  y: 150 },
  "content-router": { x: 530,  y: 150 },
  // Evergreen track (top, y = 0)
  "pattern-detect": { x: 780,  y: 0   },
  "story-compile":  { x: 1020, y: 0   },
  "editorial-ev":   { x: 1260, y: 0   },
  "generate-ev":    { x: 1500, y: 0   },
  "affiliate-inject":{ x: 1740, y: 0  },
  "seo-optimize":   { x: 1980, y: 0   },
  "finalize":       { x: 2220, y: 0   },
  "quality-gate-ev":{ x: 2460, y: 0   },
  // News track (bottom, y = 300)
  "quick-brief":         { x: 780,  y: 300 },
  "generate-news":       { x: 1020, y: 300 },
  "quality-gate-news":   { x: 1260, y: 300 },
  // Publish (center right)
  "publish":        { x: 2700, y: 150 },
};

// ── Edge definitions ─────────────────────────────────────────────────────────
const ZINC  = "#52525b";
const AMBER = "#f59e0b";
const CYAN  = "#22d3ee";

type EdgeDef = {
  id: string; source: string; target: string;
  sourceHandle?: string;
  color: string; dashed?: boolean; label?: string;
  track: "shared" | "evergreen" | "news";
};

const EDGE_DEFS: EdgeDef[] = [
  // Sources → Extract (dashed, not animated)
  { id: "e-reddit-extract", source: "reddit-scrape", target: "extract", color: ZINC, dashed: true, track: "shared" },
  { id: "e-rss-extract",    source: "rss-fetch",     target: "extract", color: ZINC, dashed: true, track: "shared" },
  { id: "e-manual-extract", source: "manual-input",  target: "extract", color: ZINC, dashed: true, track: "shared" },
  // Shared
  { id: "e-extract-router", source: "extract", target: "content-router", color: ZINC, track: "shared" },
  // Router branches
  {
    id: "e-router-ev",
    source: "content-router", sourceHandle: "ev",
    target: "pattern-detect",
    color: AMBER, label: "Evergreen", track: "evergreen",
  },
  {
    id: "e-router-news",
    source: "content-router", sourceHandle: "news",
    target: "quick-brief",
    color: CYAN, label: "News", track: "news",
  },
  // Evergreen track
  { id: "e-pd-sc",   source: "pattern-detect",  target: "story-compile",   color: AMBER, track: "evergreen" },
  { id: "e-sc-er",   source: "story-compile",    target: "editorial-ev",    color: AMBER, track: "evergreen" },
  { id: "e-er-gev",  source: "editorial-ev",     target: "generate-ev",     color: AMBER, track: "evergreen" },
  { id: "e-gev-af",  source: "generate-ev",      target: "affiliate-inject",color: AMBER, track: "evergreen" },
  { id: "e-af-seo",  source: "affiliate-inject", target: "seo-optimize",    color: AMBER, track: "evergreen" },
  { id: "e-seo-fin", source: "seo-optimize",     target: "finalize",        color: AMBER, track: "evergreen" },
  { id: "e-fin-qev", source: "finalize",         target: "quality-gate-ev", color: AMBER, track: "evergreen" },
  { id: "e-qev-pub", source: "quality-gate-ev",  target: "publish",         color: AMBER, track: "evergreen" },
  // News track
  { id: "e-qb-gn",   source: "quick-brief",      target: "generate-news",      color: CYAN, track: "news" },
  { id: "e-gn-qgn",  source: "generate-news",    target: "quality-gate-news",  color: CYAN, track: "news" },
  { id: "e-qgn-pub", source: "quality-gate-news", target: "publish",            color: CYAN, track: "news" },
];

function buildEdge(def: EdgeDef): Edge {
  const animated = !def.dashed;
  return {
    id: def.id,
    source: def.source,
    target: def.target,
    ...(def.sourceHandle ? { sourceHandle: def.sourceHandle } : {}),
    animated,
    label: def.label,
    labelStyle: { fill: def.color, fontSize: 10, fontWeight: 600 },
    labelBgStyle: { fill: "#09090b", fillOpacity: 0.85 },
    labelBgPadding: [4, 6] as [number, number],
    style: {
      stroke: def.color,
      strokeWidth: def.dashed ? 1.5 : 2,
      strokeDasharray: def.dashed ? "5 3" : undefined,
      opacity: 1,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: def.color,
      width: 14,
      height: 14,
    },
    data: { track: def.track },
  };
}

function buildGraph(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = ALL_PIPELINE_STAGES.map((stage) => ({
    id: stage.id,
    type: "pipelineNode",
    position: POSITIONS[stage.id] ?? { x: 0, y: 0 },
    data: stage as unknown as Record<string, unknown>,
    draggable: true,
  }));

  const edges = EDGE_DEFS.map(buildEdge);
  return { nodes, edges };
}

const nodeTypes: NodeTypes = { pipelineNode: PipelineNode };

type SelectedTrack = "all" | "evergreen" | "news";

export default function PipelineVisualizer() {
  const { nodes: initialNodes, edges: initialEdges } = buildGraph();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedStage, setSelectedStage] = useState<PipelineStageData | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<SelectedTrack>("all");

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedStage(node.data as unknown as PipelineStageData);
  }, []);

  // Dim nodes/edges not on the selected track
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        const stage = node.data as unknown as PipelineStageData;
        const dimmed =
          selectedTrack !== "all" &&
          stage.track !== "shared" &&
          stage.track !== selectedTrack;
        return { ...node, data: { ...stage, dimmed } as unknown as Record<string, unknown> };
      })
    );
    setEdges((eds) =>
      eds.map((edge) => {
        const edgeTrack = (edge.data as { track?: string } | undefined)?.track;
        const dimmed =
          selectedTrack !== "all" &&
          edgeTrack !== "shared" &&
          edgeTrack !== selectedTrack;
        return { ...edge, style: { ...edge.style, opacity: dimmed ? 0.1 : 1 } };
      })
    );
  }, [selectedTrack, setNodes, setEdges]);

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800 bg-zinc-950 shrink-0 flex-wrap gap-y-2">
        <h1 className="text-sm font-semibold text-white mr-1">Pipeline</h1>

        <Button
          size="sm"
          className="bg-amber-500 hover:bg-amber-400 text-black font-medium h-7 px-3 gap-1.5 text-xs"
        >
          <Play className="w-3 h-3" />
          Run
        </Button>

        <div className="w-px h-4 bg-zinc-800" />

        <Badge
          variant="outline"
          className="border-emerald-800 text-emerald-400 bg-emerald-950/40 gap-1 text-[10px]"
        >
          <CheckCircle2 className="w-2.5 h-2.5" />
          Last run: success
        </Badge>

        <div className="w-px h-4 bg-zinc-800" />

        {/* Track stats */}
        <div className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-950/30 border border-amber-900/40 rounded-full px-2 py-1">
          <Leaf className="w-2.5 h-2.5" />
          <span className="font-medium">Evergreen</span>
          <span className="text-zinc-600 ml-1">
            <Timer className="w-2.5 h-2.5 inline mr-0.5" />{EVERGREEN_PATH_DURATION}s
          </span>
          <span className="text-zinc-600 ml-1">
            <DollarSign className="w-2.5 h-2.5 inline" />{EVERGREEN_PATH_COST.toFixed(3)}
          </span>
        </div>

        <div className="flex items-center gap-1 text-[10px] text-cyan-400 bg-cyan-950/30 border border-cyan-900/40 rounded-full px-2 py-1">
          <Zap className="w-2.5 h-2.5" />
          <span className="font-medium">News</span>
          <span className="text-zinc-600 ml-1">
            <Timer className="w-2.5 h-2.5 inline mr-0.5" />{NEWS_PATH_DURATION}s
          </span>
          <span className="text-zinc-600 ml-1">
            <DollarSign className="w-2.5 h-2.5 inline" />{NEWS_PATH_COST.toFixed(3)}
          </span>
        </div>

        {/* Track filter */}
        <div className="flex items-center gap-0.5 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 ml-auto">
          {(["all", "evergreen", "news"] as SelectedTrack[]).map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTrack(t)}
              className={`h-6 px-2.5 text-[10px] rounded-md font-medium transition-colors capitalize ${
                selectedTrack === t
                  ? t === "evergreen"
                    ? "bg-amber-500/20 text-amber-400"
                    : t === "news"
                    ? "bg-cyan-500/20 text-cyan-400"
                    : "bg-zinc-700 text-white"
                  : "text-zinc-500 hover:text-white"
              }`}
            >
              {t === "all" ? "All" : t === "evergreen" ? "Evergreen" : "News"}
            </button>
          ))}
        </div>

        <span className="text-[10px] text-zinc-600">
          {ALL_PIPELINE_STAGES.length} nodes · click for details
        </span>
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
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#27272a"
          />
          <Controls
            className="[&>button]:bg-zinc-900 [&>button]:border-zinc-700 [&>button]:text-zinc-400 [&>button:hover]:bg-zinc-800"
            showFitView
            showZoom
            showInteractive={false}
          />
          <MiniMap
            className="!bg-zinc-900 !border-zinc-700"
            nodeColor={(n) => {
              const track = (n.data as { track?: string }).track;
              return track === "evergreen" ? "#78350f" : track === "news" ? "#164e63" : "#27272a";
            }}
            maskColor="rgba(0,0,0,0.4)"
          />

          {/* Track labels overlay */}
          <Panel position="top-left" className="mt-10 ml-2 space-y-1 pointer-events-none">
            <div className="flex items-center gap-1.5 text-[10px] text-amber-500/80 bg-amber-950/20 rounded px-2 py-1">
              <div className="w-6 h-0.5 bg-amber-500/60 rounded" />
              Evergreen — full SEO pipeline
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-cyan-500/80 bg-cyan-950/20 rounded px-2 py-1">
              <div className="w-6 h-0.5 bg-cyan-500/60 rounded" />
              News / Trending — fast path
            </div>
          </Panel>
        </ReactFlow>

        {/* Detail panel */}
        {selectedStage && (
          <PipelineDetailPanel
            stage={selectedStage}
            onClose={() => setSelectedStage(null)}
          />
        )}
      </div>
    </div>
  );
}
