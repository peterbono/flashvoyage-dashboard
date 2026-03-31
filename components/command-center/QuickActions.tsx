"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Film,
  FileText,
  Brain,
  OctagonX,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { WorkflowsPayload } from "./SystemHealthBanner";

// ---------------------------------------------------------------------------
// Reel format options
// ---------------------------------------------------------------------------

const REEL_FORMATS = [
  { id: "poll", label: "Poll", emoji: "🗳️", color: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/60" },
  { id: "pick", label: "Pick", emoji: "🎯", color: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800/60" },
  { id: "humor", label: "Humor", emoji: "😂", color: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60" },
  { id: "versus", label: "Versus", emoji: "⚔️", color: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60" },
  { id: "budget", label: "Budget", emoji: "💰", color: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60" },
  { id: "avantapres", label: "Avant/Apres", emoji: "🔄", color: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-800/60" },
  { id: "month", label: "Month", emoji: "📅", color: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800/60" },
] as const;

// ---------------------------------------------------------------------------
// Dispatch helper
// ---------------------------------------------------------------------------

async function dispatchWorkflow(
  workflow: string,
  inputs?: Record<string, string>
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch("/api/workflows/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow, inputs }),
    });
    const json = await res.json();
    if (!res.ok) {
      return { success: false, message: json.error ?? `HTTP ${res.status}` };
    }
    return { success: true, message: json.url ?? "Workflow triggered" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

async function cancelAllRunning(
  workflows: WorkflowsPayload | null
): Promise<{ cancelled: number; errors: string[] }> {
  if (!workflows?.workflows) return { cancelled: 0, errors: [] };

  const running = workflows.workflows.filter(
    (wf) =>
      wf.latestRun &&
      (wf.latestRun.status === "in_progress" || wf.latestRun.status === "queued")
  );

  if (running.length === 0) return { cancelled: 0, errors: [] };

  const results = await Promise.allSettled(
    running.map(async (wf) => {
      const res = await fetch("/api/workflows/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: wf.latestRun!.id }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
    })
  );

  let cancelled = 0;
  const errors: string[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") cancelled++;
    else errors.push(r.reason?.message ?? "Unknown error");
  }

  return { cancelled, errors };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  workflowData: WorkflowsPayload | null;
  onRefreshWorkflows: () => void;
}

export function QuickActions({ workflowData, onRefreshWorkflows }: Props) {
  const [reelDialogOpen, setReelDialogOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [actionState, setActionState] = useState<
    Record<string, "idle" | "loading" | "success" | "error">
  >({});
  const [killConfirmOpen, setKillConfirmOpen] = useState(false);

  const runningCount = workflowData?.workflows
    ? workflowData.workflows.filter(
        (wf) =>
          wf.latestRun &&
          (wf.latestRun.status === "in_progress" ||
            wf.latestRun.status === "queued")
      ).length
    : 0;

  const handleDispatch = useCallback(
    async (key: string, workflow: string, inputs?: Record<string, string>) => {
      setActionState((s) => ({ ...s, [key]: "loading" }));
      const result = await dispatchWorkflow(workflow, inputs);
      setActionState((s) => ({
        ...s,
        [key]: result.success ? "success" : "error",
      }));
      // Reset after 3s
      setTimeout(() => {
        setActionState((s) => ({ ...s, [key]: "idle" }));
      }, 3000);
      if (result.success) {
        // Refresh workflow statuses
        setTimeout(onRefreshWorkflows, 3000);
      }
    },
    [onRefreshWorkflows]
  );

  const handleReelPublish = useCallback(async () => {
    if (!selectedFormat) return;
    setReelDialogOpen(false);
    await handleDispatch("reel", "publish-reels.yml", {
      format: selectedFormat,
    });
    setSelectedFormat(null);
  }, [selectedFormat, handleDispatch]);

  const handleKillSwitch = useCallback(async () => {
    setKillConfirmOpen(false);
    setActionState((s) => ({ ...s, kill: "loading" }));
    const result = await cancelAllRunning(workflowData);
    setActionState((s) => ({
      ...s,
      kill: result.errors.length === 0 ? "success" : "error",
    }));
    setTimeout(() => {
      setActionState((s) => ({ ...s, kill: "idle" }));
    }, 3000);
    setTimeout(onRefreshWorkflows, 2000);
  }, [workflowData, onRefreshWorkflows]);

  const btnIcon = (key: string, DefaultIcon: React.ElementType) => {
    const state = actionState[key] ?? "idle";
    if (state === "loading")
      return <Loader2 className="w-4 h-4 animate-spin" />;
    if (state === "success")
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (state === "error") return <XCircle className="w-4 h-4 text-rose-500" />;
    return <DefaultIcon className="w-4 h-4" />;
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Publier Reel */}
        <Button
          variant="outline"
          className="h-auto py-3 px-3 flex flex-col items-start gap-1.5 text-left"
          onClick={() => setReelDialogOpen(true)}
          disabled={actionState.reel === "loading"}
        >
          <div className="flex items-center gap-2 w-full">
            {btnIcon("reel", Film)}
            <span className="text-[13px] font-medium">Publier Reel</span>
          </div>
          <span className="text-[11px] text-gray-400 dark:text-zinc-600">
            Choose format & publish
          </span>
        </Button>

        {/* Generer Article */}
        <Button
          variant="outline"
          className="h-auto py-3 px-3 flex flex-col items-start gap-1.5 text-left"
          onClick={() => handleDispatch("article", "publish-article.yml")}
          disabled={actionState.article === "loading"}
        >
          <div className="flex items-center gap-2 w-full">
            {btnIcon("article", FileText)}
            <span className="text-[13px] font-medium">Generer Article</span>
          </div>
          <span className="text-[11px] text-gray-400 dark:text-zinc-600">
            Auto-publish pipeline
          </span>
        </Button>

        {/* Run Intelligence */}
        <Button
          variant="outline"
          className="h-auto py-3 px-3 flex flex-col items-start gap-1.5 text-left"
          onClick={() =>
            handleDispatch("intelligence", "content-intelligence.yml")
          }
          disabled={actionState.intelligence === "loading"}
        >
          <div className="flex items-center gap-2 w-full">
            {btnIcon("intelligence", Brain)}
            <span className="text-[13px] font-medium">Run Intelligence</span>
          </div>
          <span className="text-[11px] text-gray-400 dark:text-zinc-600">
            Gaps, SEO, competitors
          </span>
        </Button>

        {/* Kill Switch */}
        <Button
          variant="destructive"
          className="h-auto py-3 px-3 flex flex-col items-start gap-1.5 text-left"
          onClick={() => setKillConfirmOpen(true)}
          disabled={actionState.kill === "loading" || runningCount === 0}
        >
          <div className="flex items-center gap-2 w-full">
            {btnIcon("kill", OctagonX)}
            <span className="text-[13px] font-medium">Kill Switch</span>
          </div>
          <span className="text-[11px] opacity-70">
            {runningCount > 0
              ? `${runningCount} running`
              : "No active workflows"}
          </span>
        </Button>
      </div>

      {/* Reel format picker dialog */}
      <Dialog open={reelDialogOpen} onOpenChange={setReelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Publier un Reel</DialogTitle>
            <DialogDescription>
              Choisis le format du reel a publier
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 py-2">
            {REEL_FORMATS.map((fmt) => (
              <button
                key={fmt.id}
                onClick={() => setSelectedFormat(fmt.id)}
                className={`flex items-center gap-2.5 rounded-lg border p-3 text-left transition-all ${
                  selectedFormat === fmt.id
                    ? "ring-2 ring-amber-500 border-amber-300 dark:border-amber-600"
                    : "border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700"
                }`}
              >
                <span className="text-lg">{fmt.emoji}</span>
                <div>
                  <p className="text-[13px] font-medium text-gray-900 dark:text-zinc-200">
                    {fmt.label}
                  </p>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1 py-0 h-3.5 mt-0.5 ${fmt.color}`}
                  >
                    {fmt.id}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button
              onClick={handleReelPublish}
              disabled={!selectedFormat}
              className="w-full sm:w-auto"
            >
              <Film className="w-4 h-4 mr-1.5" />
              Publier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kill switch confirmation dialog */}
      <Dialog open={killConfirmOpen} onOpenChange={setKillConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Kill Switch</DialogTitle>
            <DialogDescription>
              This will cancel {runningCount} running workflow
              {runningCount !== 1 ? "s" : ""}. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setKillConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleKillSwitch}>
              <OctagonX className="w-4 h-4 mr-1.5" />
              Kill All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
