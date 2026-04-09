"use client";

import { useState, useCallback, useEffect } from "react";
import { usePolling } from "@/lib/usePolling";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  GitBranch,
  ExternalLink,
  Film,
  BarChart3,
  Brain,
  Newspaper,
  RefreshCw,
  MessageSquare,
  FileText,
  Clock,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Circle,
  AlertCircle,
  Timer,
  Zap,
  Activity,
} from "lucide-react";
import type { WorkflowsPayload, WorkflowStatus } from "@/components/command-center/SystemHealthBanner";
import { AlertsFeed } from "@/components/command-center/AlertsFeed";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GH_ACTIONS = "https://github.com/peterbono/flashvoyage-ultra-content/actions";

// ---------------------------------------------------------------------------
// Pipeline groups (traffic light summary)
// ---------------------------------------------------------------------------

interface PipelineGroup {
  label: string;
  description: string;
  workflowIds: string[];
}

const GROUPS: PipelineGroup[] = [
  {
    label: "Articles",
    description: "Article generation and publishing",
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

// ---------------------------------------------------------------------------
// Workflow metadata (icon, schedule, dispatch config)
// ---------------------------------------------------------------------------

interface WorkflowMeta {
  icon: React.ElementType;
  shortLabel: string;
  schedule: string;
  brief: string;
  dispatchFile?: string;
}

const WORKFLOW_META: Record<string, WorkflowMeta> = {
  "publish-reels": {
    icon: Film,
    shortLabel: "Publish Reels",
    schedule: "17:00, 19:00, 20:30 UTC daily",
    brief: "Generates a video reel from article content (Pexels clips + overlay), publishes to IG + FB + Threads, sends to Telegram for TikTok repost.",
    dispatchFile: "publish-reels.yml",
  },
  "daily-analytics": {
    icon: BarChart3,
    shortLabel: "Daily Analytics",
    schedule: "04:00 UTC daily",
    brief: "Fetches GA4 traffic, Google Trends, IG engagement stats, and Search Console data. Updates audience segments and performance scores.",
  },
  "content-intelligence": {
    icon: Brain,
    shortLabel: "Content Intelligence",
    schedule: "03:00 UTC daily",
    brief: "Scores all articles (traffic + SEO + trends), detects content gaps, identifies refresh candidates, and builds the ROI-optimized publishing queue.",
    dispatchFile: "content-intelligence.yml",
  },
  "daily-digest": {
    icon: Newspaper,
    shortLabel: "Daily Digest",
    schedule: "01:15 UTC daily",
    brief: "Generates an HTML morning brief email with reel stats, GA4 metrics, revenue tracking, LLM costs, and token expiry alerts. Sent via Gmail.",
  },
  "refresh-articles": {
    icon: RefreshCw,
    shortLabel: "Content Refresh",
    schedule: "Manual",
    brief: "Detects articles with declining traffic or outdated info, triggers content refresh pipeline to update titles, sections, and SEO metadata.",
  },
  "publish-social-posts": {
    icon: MessageSquare,
    shortLabel: "Social Posts",
    schedule: "12:00 UTC Tue+Sat",
    brief: "Recycles top-performing articles as carousel posts on IG + FB + Threads. Picks from evergreen content pool based on engagement history.",
  },
  "publish-article": {
    icon: FileText,
    shortLabel: "Publish Article",
    schedule: "03:00, 08:00 UTC daily",
    brief: "Takes the next article from the publishing queue, generates full content via AI (Haiku + GPT-4o-mini), publishes to WordPress with SEO optimization.",
    dispatchFile: "publish-article.yml",
  },
};

const WORKFLOW_ORDER = [
  "publish-article",
  "content-intelligence",
  "publish-reels",
  "publish-social-posts",
  "daily-analytics",
  "daily-digest",
  "refresh-articles",
];

// ---------------------------------------------------------------------------
// Quick actions config
// ---------------------------------------------------------------------------

interface QuickAction {
  label: string;
  icon: React.ElementType;
  workflow: string;
  variant: "default" | "outline" | "secondary";
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Trigger Article", icon: FileText, workflow: "publish-article.yml", variant: "default" },
  { label: "Trigger Reel", icon: Film, workflow: "publish-reels.yml", variant: "outline" },
  { label: "Run Intelligence", icon: Brain, workflow: "content-intelligence.yml", variant: "outline" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type HealthStatus = "ok" | "running" | "failed" | "unknown";

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

function durationStr(createdAt: string, updatedAt: string): string {
  const diff = new Date(updatedAt).getTime() - new Date(createdAt).getTime();
  if (diff < 0) return "--";
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remSecs}s`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

function resolveWorkflowStatus(wf: WorkflowStatus): {
  status: HealthStatus;
  label: string;
} {
  if (!wf.latestRun) return { status: "unknown", label: "No runs" };
  const run = wf.latestRun;
  if (run.status === "in_progress" || run.status === "queued") {
    return { status: "running", label: "Running" };
  }
  if (run.conclusion === "failure" || run.conclusion === "cancelled") {
    return { status: "failed", label: "Failed" };
  }
  if (run.conclusion === "success") {
    return { status: "ok", label: "OK" };
  }
  return { status: "ok", label: "OK" };
}

function resolveGroupStatus(
  group: PipelineGroup,
  data: WorkflowsPayload | null
): { status: HealthStatus; detail: string } {
  if (!data?.workflows) return { status: "unknown", detail: "No data" };

  const workflows = group.workflowIds
    .map((id) => data.workflows.find((w) => w.id === id))
    .filter(Boolean) as WorkflowStatus[];

  if (workflows.length === 0) return { status: "unknown", detail: "No data" };

  const failed = workflows.find((w) => w.latestRun?.conclusion === "failure");
  if (failed) return { status: "failed", detail: `${failed.label} failed` };

  const running = workflows.find((w) => w.latestRun?.status === "in_progress");
  if (running) return { status: "running", detail: `${running.label} in progress` };

  const lastRun = workflows
    .map((w) => w.latestRun?.updated_at)
    .filter(Boolean)
    .sort()
    .pop();

  return {
    status: "ok",
    detail: lastRun ? `Last run ${timeAgo(lastRun)}` : "OK",
  };
}

const STATUS_DOT: Record<HealthStatus, string> = {
  ok: "bg-emerald-400",
  running: "bg-amber-400 animate-pulse",
  failed: "bg-rose-400",
  unknown: "bg-zinc-600",
};

const STATUS_BADGE_STYLE: Record<HealthStatus, string> = {
  ok: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  running: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  failed: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  unknown: "bg-zinc-700/30 text-zinc-500 border-zinc-700",
};

const STATUS_LABEL: Record<HealthStatus, string> = {
  ok: "OK",
  running: "Running",
  failed: "Error",
  unknown: "N/A",
};

const STATUS_ICON: Record<HealthStatus, React.ElementType> = {
  ok: CheckCircle2,
  running: Loader2,
  failed: XCircle,
  unknown: AlertCircle,
};

const STATUS_ICON_COLOR: Record<HealthStatus, string> = {
  ok: "text-emerald-400",
  running: "text-amber-400 animate-spin",
  failed: "text-rose-400",
  unknown: "text-zinc-500",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Skeleton placeholder for loading state */
function CardSkeleton() {
  return (
    <Card className="bg-zinc-900 border-zinc-800/80">
      <CardContent className="py-4">
        <div className="animate-pulse space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-zinc-700 rounded" />
            <div className="h-4 w-24 bg-zinc-700 rounded" />
          </div>
          <div className="h-3 w-32 bg-zinc-800 rounded" />
          <div className="h-3 w-20 bg-zinc-800 rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

/** Traffic light summary card for a pipeline group */
function TrafficLightCard({
  group,
  data,
  loading,
}: {
  group: PipelineGroup;
  data: WorkflowsPayload | null;
  loading: boolean;
}) {
  const { status, detail } = resolveGroupStatus(group, data);
  const dotClass = STATUS_DOT[status];
  const badgeClass = STATUS_BADGE_STYLE[status];
  const label = STATUS_LABEL[status];

  return (
    <Card className="bg-zinc-900 border-zinc-800/80 hover:border-zinc-700 transition-colors">
      <CardContent className="py-4">
        {loading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 w-24 bg-zinc-700 rounded" />
            <div className="h-3 w-32 bg-zinc-800 rounded" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-3 h-3 rounded-full ${dotClass}`} />
              <span className="text-sm font-semibold text-white">
                {group.label}
              </span>
              <Badge
                variant="outline"
                className={`ml-auto text-[10px] px-1.5 py-0 ${badgeClass}`}
              >
                {label}
              </Badge>
            </div>
            <p className="text-[11px] text-zinc-500 ml-5">{detail}</p>
            <p className="text-[10px] text-zinc-600 ml-5 mt-0.5">
              {group.description}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Individual workflow detail card */
function WorkflowCard({
  wf,
  meta,
  onClick,
}: {
  wf: WorkflowStatus;
  meta: WorkflowMeta;
  onClick?: () => void;
}) {
  const { status, label } = resolveWorkflowStatus(wf);
  const Icon = meta.icon;
  const StatusIcon = STATUS_ICON[status];
  const iconColor = STATUS_ICON_COLOR[status];
  const badgeClass = STATUS_BADGE_STYLE[status];

  const run = wf.latestRun;
  const lastRunTime = run ? timeAgo(run.updated_at) : "never";
  const duration =
    run && run.conclusion ? durationStr(run.created_at, run.updated_at) : "--";

  return (
    <Card
      className={`bg-zinc-900 border-zinc-800/80 hover:border-zinc-700/80 transition-all duration-200 group ${
        onClick ? "cursor-pointer" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="py-4 space-y-3">
        {/* Header: icon + name + status badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-800/80 shrink-0">
              <Icon className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-white truncate">
                {meta.shortLabel}
              </p>
              <p className="text-[10px] text-zinc-600 truncate">{wf.file}</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 shrink-0 gap-1 ${badgeClass}`}
          >
            <StatusIcon className={`w-2.5 h-2.5 ${iconColor}`} />
            {label}
          </Badge>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-zinc-600" />
            <span className="text-[11px] text-zinc-400">{lastRunTime}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Timer className="w-3 h-3 text-zinc-600" />
            <span className="text-[11px] text-zinc-400">{duration}</span>
          </div>
        </div>

        {/* Schedule */}
        <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-800/60">
          <Activity className="w-3 h-3 text-zinc-600 shrink-0" />
          <span className="text-[10px] text-zinc-500 truncate">
            {meta.schedule}
          </span>
        </div>

        {/* Brief description */}
        <p className="text-[10px] text-zinc-600 leading-relaxed">
          {meta.brief}
        </p>

        {/* GitHub link */}
        {run?.html_url && (
          <a
            href={run.html_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-amber-400 transition-colors pt-0.5"
          >
            View on GitHub <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}

/** Recent activity feed item */
function ActivityItem({
  wf,
  meta,
}: {
  wf: WorkflowStatus;
  meta: WorkflowMeta;
}) {
  const run = wf.latestRun;
  if (!run) return null;

  const { status } = resolveWorkflowStatus(wf);
  const StatusIcon = STATUS_ICON[status];
  const iconColor = STATUS_ICON_COLOR[status];
  const isFailed = status === "failed";
  const duration =
    run.conclusion ? durationStr(run.created_at, run.updated_at) : "running...";

  return (
    <a
      href={run.html_url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors hover:bg-zinc-800/50 ${
        isFailed ? "bg-rose-500/5" : ""
      }`}
    >
      <StatusIcon className={`w-4 h-4 shrink-0 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-[12px] font-medium truncate ${
              isFailed ? "text-rose-400" : "text-zinc-300"
            }`}
          >
            {meta.shortLabel}
          </span>
          {isFailed && (
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0 bg-rose-500/10 text-rose-400 border-rose-500/30"
            >
              FAILED
            </Badge>
          )}
        </div>
        <p className="text-[10px] text-zinc-600">
          {timeAgo(run.updated_at)} &middot; {duration}
        </p>
      </div>
      <ExternalLink className="w-3 h-3 text-zinc-700 shrink-0" />
    </a>
  );
}

// ---------------------------------------------------------------------------
// Run steps types & drawer
// ---------------------------------------------------------------------------

interface RunStep {
  name: string;
  status: string;
  conclusion: string | null;
  number: number;
  started_at: string | null;
  completed_at: string | null;
}

interface RunJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  steps: RunStep[];
}

function stepDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt || !completedAt) return "--";
  const diff = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (diff < 0) return "--";
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins}m ${remSecs}s`;
}

function StepIcon({ status, conclusion }: { status: string; conclusion: string | null }) {
  if (status === "in_progress") {
    return <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />;
  }
  if (status === "completed") {
    if (conclusion === "success") {
      return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
    }
    if (conclusion === "failure") {
      return <XCircle className="w-4 h-4 text-rose-400 shrink-0" />;
    }
    if (conclusion === "skipped") {
      return <Circle className="w-4 h-4 text-zinc-600 shrink-0" />;
    }
  }
  // queued / pending
  return <Circle className="w-4 h-4 text-zinc-500 shrink-0" />;
}

function StepTimeline({ steps }: { steps: RunStep[] }) {
  return (
    <div className="relative pl-6">
      {/* Vertical connecting line */}
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-zinc-700" />

      <div className="space-y-0">
        {steps.map((step) => (
          <div key={step.number} className="relative flex items-start gap-3 py-2">
            {/* Icon positioned on the vertical line */}
            <div className="absolute -left-6 top-2 flex items-center justify-center w-4 h-4 bg-zinc-900 z-10">
              <StepIcon status={step.status} conclusion={step.conclusion} />
            </div>

            <div className="flex-1 min-w-0">
              <p className={`text-[12px] leading-tight ${
                step.conclusion === "failure"
                  ? "text-rose-400 font-medium"
                  : step.conclusion === "skipped"
                  ? "text-zinc-600"
                  : "text-white"
              }`}>
                {step.name}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {stepDuration(step.started_at, step.completed_at)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepsSkeleton() {
  return (
    <div className="space-y-3 pl-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 animate-pulse">
          <div className="w-4 h-4 rounded-full bg-zinc-700 shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="h-3 w-32 bg-zinc-700 rounded" />
            <div className="h-2 w-16 bg-zinc-800 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function RunStepsDrawer({
  runId,
  workflowName,
  htmlUrl,
  onClose,
}: {
  runId: number | null;
  workflowName: string;
  htmlUrl: string | null;
  onClose: () => void;
}) {
  const [jobs, setJobs] = useState<RunJob[] | null>(null);
  const [stepsLoading, setStepsLoading] = useState(false);
  const [stepsError, setStepsError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) {
      setJobs(null);
      return;
    }

    let cancelled = false;
    setStepsLoading(true);
    setStepsError(null);

    fetch(`/api/workflows/steps?runId=${runId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { jobs: RunJob[] }) => {
        if (!cancelled) {
          setJobs(data.jobs);
          setStepsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setStepsError(String(err));
          setStepsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [runId]);

  return (
    <Sheet open={runId !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="bg-zinc-900 border-zinc-800 sm:max-w-md w-full overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-white text-sm font-semibold">
            {workflowName}
          </SheetTitle>
          <SheetDescription className="text-zinc-500 text-[11px]">
            Run #{runId} &middot; Flow steps
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 px-4 pb-4 overflow-y-auto">
          {stepsLoading ? (
            <StepsSkeleton />
          ) : stepsError ? (
            <div className="flex items-center gap-2 text-rose-400 text-[12px] py-4">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>Failed to load steps: {stepsError}</span>
            </div>
          ) : jobs && jobs.length > 0 ? (
            <div className="space-y-5">
              {jobs.map((job) => (
                <div key={job.id}>
                  {/* Job header (only show if multiple jobs) */}
                  {jobs.length > 1 && (
                    <div className="flex items-center gap-2 mb-2">
                      <StepIcon status={job.status} conclusion={job.conclusion} />
                      <span className="text-[12px] font-medium text-zinc-300">
                        {job.name}
                      </span>
                      <span className="text-[10px] text-zinc-600 ml-auto">
                        {stepDuration(job.started_at, job.completed_at)}
                      </span>
                    </div>
                  )}
                  <StepTimeline steps={job.steps} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-zinc-600 text-center py-8">
              No steps found for this run.
            </p>
          )}
        </div>

        {htmlUrl && (
          <SheetFooter className="border-t border-zinc-800">
            <a
              href={htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-400 hover:text-amber-400 transition-colors py-1"
            >
              View full run on GitHub <ExternalLink className="w-3 h-3" />
            </a>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PipelinePage() {
  const { data: workflowData, loading, refetch } = usePolling<WorkflowsPayload>(
    "/api/workflows",
    30_000
  );
  const { data: tokensRaw, loading: tokensLoading } = usePolling<Record<string, unknown> | null>(
    "/api/data/social-distributor/data/tokens.json",
    300_000
  );
  const tokensData = tokensRaw
    ? typeof tokensRaw === "object" ? tokensRaw : null
    : null;

  const [dispatching, setDispatching] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [selectedWorkflowName, setSelectedWorkflowName] = useState("");
  const [selectedRunUrl, setSelectedRunUrl] = useState<string | null>(null);

  const handleDispatch = useCallback(
    async (workflowFile: string) => {
      setDispatching(workflowFile);
      try {
        const res = await fetch("/api/workflows/dispatch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workflow: workflowFile }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          console.error("Dispatch failed:", err);
        }
        // Refetch workflow statuses after a brief delay
        setTimeout(() => {
          refetch();
        }, 3000);
      } catch (err) {
        console.error("Dispatch error:", err);
      } finally {
        setDispatching(null);
      }
    },
    [refetch]
  );

  // Build workflow map from API data
  const workflowMap = new Map<string, WorkflowStatus>();
  if (workflowData?.workflows) {
    for (const wf of workflowData.workflows) {
      workflowMap.set(wf.id, wf);
    }
  }

  // Recent activity: all workflows with runs, sorted by most recent first
  const recentRuns = workflowData?.workflows
    ?.filter((wf) => wf.latestRun)
    .sort(
      (a, b) =>
        new Date(b.latestRun!.updated_at).getTime() -
        new Date(a.latestRun!.updated_at).getTime()
    )
    .slice(0, 5) ?? [];

  // Overall health counts
  const healthCounts = { ok: 0, running: 0, failed: 0, unknown: 0 };
  if (workflowData?.workflows) {
    for (const wf of workflowData.workflows) {
      const { status } = resolveWorkflowStatus(wf);
      healthCounts[status]++;
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6 w-full max-w-7xl mx-auto">
      {/* ---------------------------------------------------------------- */}
      {/* Header                                                           */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/10">
          <GitBranch className="w-4 h-4 text-violet-400" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-white tracking-tight">
            Pipeline
          </h1>
          <p className="text-[12px] text-zinc-500">
            Production workflow health &middot;{" "}
            {workflowData
              ? `${workflowData.workflows.length} workflows`
              : "loading..."}
          </p>
        </div>

        {/* Health summary pills */}
        {!loading && workflowData && (
          <div className="ml-auto hidden sm:flex items-center gap-1.5">
            {healthCounts.ok > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                <CheckCircle2 className="w-3 h-3" />
                {healthCounts.ok}
              </span>
            )}
            {healthCounts.running > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                {healthCounts.running}
              </span>
            )}
            {healthCounts.failed > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-full px-2 py-0.5">
                <XCircle className="w-3 h-3" />
                {healthCounts.failed}
              </span>
            )}
          </div>
        )}

        <a
          href={GH_ACTIONS}
          target="_blank"
          rel="noopener noreferrer"
          className={`${!loading && workflowData ? "" : "ml-auto"} flex items-center gap-1 text-xs text-zinc-500 hover:text-amber-400 transition-colors`}
        >
          GitHub Actions <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Traffic light summary                                            */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {GROUPS.map((group) => (
          <TrafficLightCard
            key={group.label}
            group={group}
            data={workflowData}
            loading={loading}
          />
        ))}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Workflow detail cards                                             */}
      {/* ---------------------------------------------------------------- */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-zinc-500" />
          <h2 className="text-sm font-medium text-zinc-300">
            Workflow Details
          </h2>
          <span className="text-[10px] text-zinc-600">
            {WORKFLOW_ORDER.length} workflows
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {WORKFLOW_ORDER.map((id) => {
              const wf = workflowMap.get(id);
              const meta = WORKFLOW_META[id];
              if (!wf || !meta) return null;
              return (
                <WorkflowCard
                  key={id}
                  wf={wf}
                  meta={meta}
                  onClick={
                    wf.latestRun
                      ? () => {
                          setSelectedRunId(wf.latestRun!.id);
                          setSelectedWorkflowName(meta.shortLabel);
                          setSelectedRunUrl(wf.latestRun!.html_url);
                        }
                      : undefined
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Recent activity feed                                             */}
      {/* ---------------------------------------------------------------- */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-zinc-500" />
          <h2 className="text-sm font-medium text-zinc-300">
            Recent Activity
          </h2>
        </div>

        <Card className="bg-zinc-900 border-zinc-800/80">
          <CardContent className="py-2 px-1">
            {loading ? (
              <div className="animate-pulse space-y-3 py-3 px-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-zinc-700" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-28 bg-zinc-700 rounded" />
                      <div className="h-2 w-20 bg-zinc-800 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentRuns.length === 0 ? (
              <p className="text-[12px] text-zinc-600 text-center py-6">
                No recent workflow runs
              </p>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {recentRuns.map((wf) => {
                  const meta = WORKFLOW_META[wf.id] ?? {
                    icon: RefreshCw,
                    shortLabel: wf.label,
                    schedule: "--",
                  };
                  return (
                    <ActivityItem key={wf.id} wf={wf} meta={meta} />
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Quick actions                                                    */}
      {/* ---------------------------------------------------------------- */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Play className="w-4 h-4 text-zinc-500" />
          <h2 className="text-sm font-medium text-zinc-300">Quick Actions</h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => {
            const ActionIcon = action.icon;
            const isDispatching = dispatching === action.workflow;

            return (
              <Button
                key={action.workflow}
                variant={action.variant}
                size="sm"
                disabled={dispatching !== null}
                onClick={() => handleDispatch(action.workflow)}
                className={
                  action.variant === "default"
                    ? "bg-violet-600 hover:bg-violet-500 text-white border-violet-500/30"
                    : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                }
              >
                {isDispatching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ActionIcon className="w-3.5 h-3.5" />
                )}
                {isDispatching ? "Triggering..." : action.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Alerts                                                           */}
      {/* ---------------------------------------------------------------- */}
      <AlertsFeed
        tokensData={tokensData}
        workflowData={workflowData}
        loading={loading || tokensLoading}
      />

      {/* ---------------------------------------------------------------- */}
      {/* Footer: last fetched timestamp                                   */}
      {/* ---------------------------------------------------------------- */}
      {workflowData?.fetchedAt && (
        <p className="text-[10px] text-zinc-700 text-center pt-2">
          Data fetched {timeAgo(workflowData.fetchedAt)} &middot; Auto-refreshes
          every 30s
        </p>
      )}

      {/* Run steps drawer */}
      <RunStepsDrawer
        runId={selectedRunId}
        workflowName={selectedWorkflowName}
        htmlUrl={selectedRunUrl}
        onClose={() => setSelectedRunId(null)}
      />
    </div>
  );
}
