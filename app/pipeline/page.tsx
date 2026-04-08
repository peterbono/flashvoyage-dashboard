"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { usePolling } from "@/lib/usePolling";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitBranch, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { WorkflowsPayload } from "@/components/command-center/SystemHealthBanner";

const PipelineVisualizer = dynamic(
  () => import("@/components/pipeline/PipelineVisualizer"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-96">
        <div className="text-zinc-500 text-sm">Chargement pipeline...</div>
      </div>
    ),
  }
);

// ---------------------------------------------------------------------------
// Pipeline groups (traffic light)
// ---------------------------------------------------------------------------

interface PipelineGroup {
  label: string;
  description: string;
  workflowIds: string[];
}

const GROUPS: PipelineGroup[] = [
  {
    label: "Articles",
    description: "Generation et publication d'articles",
    workflowIds: ["publish-article", "content-intelligence"],
  },
  {
    label: "Reels & Social",
    description: "Reels IG, posts FB, Threads, TikTok batch",
    workflowIds: ["publish-reels", "publish-social-posts"],
  },
  {
    label: "Analytics & SEO",
    description: "GA4, Search Console, content refresh",
    workflowIds: ["daily-analytics", "refresh-articles", "daily-digest"],
  },
];

type Status = "ok" | "issue" | "running" | "unknown";

function resolveStatus(
  group: PipelineGroup,
  data: WorkflowsPayload | null
): { status: Status; detail: string } {
  if (!data?.workflows) return { status: "unknown", detail: "Pas de donnees" };

  const workflows = group.workflowIds
    .map((id) => data.workflows.find((w) => w.id === id))
    .filter(Boolean);

  if (workflows.length === 0) return { status: "unknown", detail: "Pas de donnees" };

  const failed = workflows.find((w) => w!.latestRun?.conclusion === "failure");
  if (failed) return { status: "issue", detail: `${failed!.label} en echec` };

  const running = workflows.find((w) => w!.latestRun?.status === "in_progress");
  if (running) return { status: "running", detail: `${running!.label} en cours` };

  const lastRun = workflows
    .map((w) => w!.latestRun?.updated_at)
    .filter(Boolean)
    .sort()
    .pop();

  const ago = lastRun
    ? `Dernier run ${timeAgo(lastRun)}`
    : "OK";

  return { status: "ok", detail: ago };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  return `il y a ${Math.floor(hours / 24)}j`;
}

const STATUS_CONFIG: Record<Status, { dot: string; badge: string; label: string }> = {
  ok: { dot: "bg-emerald-400", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", label: "OK" },
  issue: { dot: "bg-rose-400", badge: "bg-rose-500/10 text-rose-400 border-rose-500/30", label: "Erreur" },
  running: { dot: "bg-amber-400 animate-pulse", badge: "bg-amber-500/10 text-amber-400 border-amber-500/30", label: "En cours" },
  unknown: { dot: "bg-zinc-600", badge: "bg-zinc-700/30 text-zinc-500 border-zinc-700", label: "N/A" },
};

const GH_ACTIONS = "https://github.com/peterbono/flashvoyage-ultra-content/actions";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PipelinePage() {
  const [expanded, setExpanded] = useState(false);
  const { data: workflowData, loading } = usePolling<WorkflowsPayload>(
    "/api/workflows",
    30_000
  );

  return (
    <div className="p-4 md:p-6 space-y-4 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/10">
          <GitBranch className="w-4 h-4 text-violet-400" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">
            Pipeline
          </h1>
          <p className="text-[12px] text-gray-500 dark:text-zinc-500">
            Production workflow health
          </p>
        </div>
        <a
          href={GH_ACTIONS}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1 text-xs text-zinc-500 hover:text-amber-400 transition-colors"
        >
          GitHub Actions <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Traffic light cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {GROUPS.map((group) => {
          const { status, detail } = resolveStatus(group, workflowData);
          const cfg = STATUS_CONFIG[status];

          return (
            <Card key={group.label} className="bg-zinc-900 border-zinc-800/80 hover:border-zinc-700 transition-colors">
              <CardContent className="py-4">
                {loading ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 w-24 bg-zinc-700 rounded" />
                    <div className="h-3 w-32 bg-zinc-800 rounded" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-3 h-3 rounded-full ${cfg.dot}`} />
                      <span className="text-sm font-semibold text-white">{group.label}</span>
                      <Badge variant="outline" className={`ml-auto text-[10px] px-1.5 py-0 ${cfg.badge}`}>
                        {cfg.label}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-zinc-500 ml-5">{detail}</p>
                    <p className="text-[10px] text-zinc-600 ml-5 mt-0.5">{group.description}</p>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Expandable DAG */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors w-full justify-center py-2"
      >
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {expanded ? "Masquer le pipeline detaille" : "Voir le pipeline detaille"}
      </button>

      {expanded && (
        <div className="h-[500px] border border-zinc-800 rounded-lg overflow-hidden">
          <PipelineVisualizer />
        </div>
      )}
    </div>
  );
}
