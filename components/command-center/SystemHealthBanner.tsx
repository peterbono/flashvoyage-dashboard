"use client";

import { Badge } from "@/components/ui/badge";
import {
  Film,
  BarChart3,
  Brain,
  Newspaper,
  RefreshCw,
  MessageSquare,
  Loader2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkflowRunSummary {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export interface WorkflowStatus {
  id: string;
  label: string;
  file: string;
  latestRun: WorkflowRunSummary | null;
  error?: string;
}

export interface WorkflowsPayload {
  workflows: WorkflowStatus[];
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Map workflow IDs to display config
// ---------------------------------------------------------------------------

const WORKFLOW_META: Record<
  string,
  { icon: React.ElementType; shortLabel: string }
> = {
  "publish-reels": { icon: Film, shortLabel: "Reels" },
  "daily-analytics": { icon: BarChart3, shortLabel: "Analytics" },
  "content-intelligence": { icon: Brain, shortLabel: "Intelligence" },
  "daily-digest": { icon: Newspaper, shortLabel: "Digest" },
  "refresh-articles": { icon: RefreshCw, shortLabel: "Flywheel" },
  "publish-social-posts": { icon: MessageSquare, shortLabel: "Social Posts" },
};

// IDs to display in the banner (in order)
const DISPLAY_IDS = [
  "publish-reels",
  "daily-analytics",
  "content-intelligence",
  "daily-digest",
  "refresh-articles",
  "publish-social-posts",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type HealthStatus = "ok" | "running" | "failed" | "unknown";

function resolveStatus(wf: WorkflowStatus): {
  status: HealthStatus;
  label: string;
  lastRun: string;
} {
  if (!wf.latestRun) {
    return { status: "unknown", label: "No runs", lastRun: "never" };
  }

  const run = wf.latestRun;

  if (run.status === "in_progress" || run.status === "queued") {
    return { status: "running", label: "Running", lastRun: "running..." };
  }

  if (run.conclusion === "success") {
    return { status: "ok", label: "OK", lastRun: timeAgo(run.updated_at) };
  }

  if (run.conclusion === "failure" || run.conclusion === "cancelled") {
    return {
      status: "failed",
      label: "Failed",
      lastRun: `failed ${timeAgo(run.updated_at)}`,
    };
  }

  return { status: "ok", label: "OK", lastRun: timeAgo(run.updated_at) };
}

const STATUS_BADGE: Record<
  HealthStatus,
  { className: string; dotClass: string }
> = {
  ok: {
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  running: {
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-400",
    dotClass: "bg-amber-500 animate-pulse",
  },
  failed: {
    className:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/30 dark:text-rose-400",
    dotClass: "bg-rose-500",
  },
  unknown: {
    className:
      "border-gray-200 bg-gray-50 text-gray-500 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-500",
    dotClass: "bg-gray-400 dark:bg-zinc-600",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  data: WorkflowsPayload | null;
  loading: boolean;
}

export function SystemHealthBanner({ data, loading }: Props) {
  // Build lookup from API data
  const workflowMap = new Map<string, WorkflowStatus>();
  if (data?.workflows) {
    for (const wf of data.workflows) {
      workflowMap.set(wf.id, wf);
    }
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
      {DISPLAY_IDS.map((id) => {
        const meta = WORKFLOW_META[id] ?? {
          icon: RefreshCw,
          shortLabel: id,
        };
        const Icon = meta.icon;

        if (loading || !data) {
          return (
            <div
              key={id}
              className="rounded-xl border bg-white dark:bg-zinc-900/40 border-gray-200 dark:border-zinc-800/50 p-3 animate-pulse"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 rounded bg-gray-200 dark:bg-zinc-700" />
                <div className="h-3 w-16 rounded bg-gray-200 dark:bg-zinc-700" />
              </div>
              <div className="h-2.5 w-12 rounded bg-gray-100 dark:bg-zinc-800" />
            </div>
          );
        }

        const wf = workflowMap.get(id);
        const { status, label, lastRun } = wf
          ? resolveStatus(wf)
          : { status: "unknown" as HealthStatus, label: "N/A", lastRun: "—" };

        const badgeStyle = STATUS_BADGE[status];

        return (
          <a
            key={id}
            href={wf?.latestRun?.html_url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border bg-white dark:bg-zinc-900/40 border-gray-200 dark:border-zinc-800/50 p-3 hover:border-gray-300 dark:hover:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-900/70 transition-all duration-200 block"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Icon className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500 shrink-0" />
                <span className="text-[12px] font-medium text-gray-700 dark:text-zinc-300 truncate">
                  {meta.shortLabel}
                </span>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 h-4 gap-1 shrink-0 ${badgeStyle.className}`}
              >
                {status === "running" && (
                  <Loader2 className="w-2 h-2 animate-spin" />
                )}
                {label}
              </Badge>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-zinc-600 truncate">
              {lastRun}
            </p>
          </a>
        );
      })}
    </div>
  );
}
