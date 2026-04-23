"use client";

import { useMemo, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { usePolling } from "@/lib/usePolling";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Megaphone,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Inbox,
  Check,
  X,
  Pencil,
  Eye,
  Target,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  sortActions,
  type AmplifierAction,
  type AmplifierPriority,
  type AmplifierQueue,
  type AmplifierQueueResponse,
} from "@/lib/amplifier";

const POLL_INTERVAL = 120_000; // 2 min

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatReach(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function priorityBadgeClass(p: AmplifierPriority | undefined): string {
  switch (p) {
    case "high":
      return "border-rose-800/60 bg-rose-950/40 text-rose-300";
    case "medium":
      return "border-amber-800/60 bg-amber-950/40 text-amber-300";
    case "low":
      return "border-zinc-800/80 bg-zinc-900 text-zinc-400";
    default:
      return "border-zinc-800/80 bg-zinc-900 text-zinc-400";
  }
}

function actionTypeLabel(t: string): string {
  switch (t) {
    case "edit_existing_answer":
      return "Edit existing";
    case "answer_new_question":
      return "New answer";
    case "comment_on_thread":
      return "Comment";
    case "post_followup":
      return "Follow-up";
    default:
      return t;
  }
}

function actionText(a: AmplifierAction): string {
  if ("insertionText" in a && typeof a.insertionText === "string")
    return a.insertionText;
  if ("proposedAnswer" in a && typeof a.proposedAnswer === "string")
    return a.proposedAnswer;
  return "";
}

function actionExternalUrl(a: AmplifierAction): string | null {
  if ("answerUrl" in a && typeof a.answerUrl === "string") return a.answerUrl;
  if ("questionUrl" in a && typeof a.questionUrl === "string")
    return a.questionUrl;
  return null;
}

// ---------------------------------------------------------------------------
// Action card
// ---------------------------------------------------------------------------

interface ActionCardProps {
  slug: string;
  action: AmplifierAction;
  onExecuted: (actionId: string) => void;
  onDismissed: (actionId: string) => void;
  isDemo: boolean;
}

function ActionCard({
  slug,
  action,
  onExecuted,
  onDismissed,
  isDemo,
}: ActionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => actionText(action));
  const [busy, setBusy] = useState<"execute" | "dismiss" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const actionId = action.id ?? "";
  const externalUrl = actionExternalUrl(action);
  const text = actionText(action);

  const run = useCallback(
    async (kind: "execute" | "dismiss") => {
      if (isDemo) {
        // Don't fire writes against GitHub in demo mode.
        setError("Demo mode — no write performed");
        setTimeout(() => setError(null), 2500);
        if (kind === "execute") onExecuted(actionId);
        else onDismissed(actionId);
        return;
      }

      setBusy(kind);
      setError(null);
      try {
        const url =
          kind === "execute"
            ? "/api/amplifier/execute"
            : "/api/amplifier/dismiss";
        const payload: Record<string, unknown> = { slug, actionId };
        if (kind === "execute" && editing && draft !== text) {
          // Send whichever field this action type carries.
          if ("insertionText" in action) payload.insertionText = draft;
          if ("proposedAnswer" in action) payload.proposedAnswer = draft;
        }
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        if (kind === "execute") onExecuted(actionId);
        else onDismissed(actionId);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
      }
    },
    [actionId, slug, isDemo, action, editing, draft, text, onExecuted, onDismissed]
  );

  return (
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3 space-y-2">
      {/* Header row */}
      <div className="flex items-start gap-2 flex-wrap">
        <Badge
          variant="outline"
          className={`text-[10px] uppercase tracking-wider ${priorityBadgeClass(
            action.priority
          )}`}
        >
          {action.priority ?? "—"}
        </Badge>
        <Badge
          variant="outline"
          className="text-[10px] border-zinc-800/80 bg-zinc-900 text-zinc-300"
        >
          {actionTypeLabel(action.type)}
        </Badge>
        {action.estimatedReachViews != null && (
          <Badge
            variant="outline"
            className="text-[10px] border-zinc-800/80 bg-zinc-900 text-zinc-400 gap-1"
          >
            <Eye className="w-3 h-3" />
            {formatReach(action.estimatedReachViews)} views
          </Badge>
        )}
        {action.confidenceScore != null && (
          <Badge
            variant="outline"
            className="text-[10px] border-zinc-800/80 bg-zinc-900 text-zinc-400 gap-1"
          >
            <Target className="w-3 h-3" />
            {(action.confidenceScore * 100).toFixed(0)}% conf.
          </Badge>
        )}
        {action.topicRelevanceScore != null && (
          <Badge
            variant="outline"
            className="text-[10px] border-zinc-800/80 bg-zinc-900 text-zinc-400"
          >
            rel {action.topicRelevanceScore}/10
          </Badge>
        )}
      </div>

      {/* Question title */}
      {action.questionTitle && (
        <div className="flex items-start gap-1.5">
          {externalUrl ? (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-100 hover:text-amber-400 transition-colors flex items-start gap-1.5"
            >
              <span>{action.questionTitle}</span>
              <ExternalLink className="w-3 h-3 shrink-0 mt-0.5 opacity-60" />
            </a>
          ) : (
            <span className="text-sm text-zinc-100">{action.questionTitle}</span>
          )}
        </div>
      )}

      {/* Rationale */}
      {action.rationale && (
        <p className="text-xs text-zinc-500 italic">{action.rationale}</p>
      )}

      {/* Expandable text */}
      {text && (
        <div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            {expanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            {expanded ? "Hide" : "View"}{" "}
            {"insertionText" in action ? "insertion text" : "proposed answer"}
          </button>
          {expanded && !editing && (
            <pre className="mt-1.5 whitespace-pre-wrap rounded-md border border-zinc-800/80 bg-zinc-900/80 p-2.5 text-xs text-zinc-200 font-sans leading-relaxed">
              {text}
            </pre>
          )}
          {expanded && editing && (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={6}
              className="mt-1.5 w-full rounded-md border border-amber-700/50 bg-zinc-900/80 p-2.5 text-xs text-zinc-100 font-sans leading-relaxed focus:outline-none focus:border-amber-500"
            />
          )}
        </div>
      )}

      {/* Error line */}
      {error && (
        <p className="text-xs text-rose-400 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-wrap pt-1">
        <Button
          size="xs"
          variant="default"
          onClick={() => run("execute")}
          disabled={busy !== null}
          className="bg-amber-500 text-black hover:bg-amber-400"
        >
          {busy === "execute" ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Check className="w-3 h-3" />
          )}
          Approve & Execute
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => run("dismiss")}
          disabled={busy !== null}
          className="text-zinc-400 hover:text-rose-300"
        >
          {busy === "dismiss" ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <X className="w-3 h-3" />
          )}
          Dismiss
        </Button>
        {text && (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => {
              setEditing((v) => !v);
              setExpanded(true);
            }}
            disabled={busy !== null}
            className="text-zinc-400 hover:text-zinc-100 ml-auto"
          >
            <Pencil className="w-3 h-3" />
            {editing ? "Cancel edit" : "Edit text"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Queue group
// ---------------------------------------------------------------------------

interface QueueGroupProps {
  queue: AmplifierQueue;
  onActionResolved: (slug: string, actionId: string) => void;
  isDemo: boolean;
}

function QueueGroup({ queue, onActionResolved, isDemo }: QueueGroupProps) {
  // Local "resolved" set so an approved/dismissed action disappears instantly
  // without waiting for the next 2-min poll.
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  const handleResolved = useCallback(
    (actionId: string) => {
      setResolved((prev) => {
        const next = new Set(prev);
        next.add(actionId);
        return next;
      });
      onActionResolved(queue.targetSlug, actionId);
    },
    [queue.targetSlug, onActionResolved]
  );

  const visible = useMemo(() => {
    return [...queue.actions]
      .filter(
        (a) =>
          a.status !== "dismissed" &&
          a.status !== "done" &&
          !resolved.has(a.id ?? "")
      )
      .sort(sortActions);
  }, [queue.actions, resolved]);

  if (visible.length === 0) return null;

  return (
    <Card className="bg-zinc-900 border-zinc-800/80">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <a
              href={queue.targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-white hover:text-amber-400 transition-colors inline-flex items-center gap-1.5"
            >
              {queue.targetSlug}
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
            <p className="text-xs text-zinc-500 mt-0.5 truncate">
              {queue.targetUrl.replace(/^https?:\/\//, "")}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge
              variant="outline"
              className="text-[10px] border-zinc-800/80 bg-zinc-900 text-zinc-300 capitalize"
            >
              {queue.platform}
            </Badge>
            {queue.account && (
              <Badge
                variant="outline"
                className="text-[10px] border-zinc-800/80 bg-zinc-900 text-zinc-500"
              >
                @{queue.account}
              </Badge>
            )}
            <Badge
              variant="outline"
              className="text-[10px] border-amber-800/60 bg-amber-950/30 text-amber-400 gap-1"
            >
              <Eye className="w-3 h-3" />
              {formatReach(queue.totalReach)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {visible.map((a) => (
          <ActionCard
            key={a.id}
            slug={queue.targetSlug}
            action={a}
            onExecuted={handleResolved}
            onDismissed={handleResolved}
            isDemo={isDemo}
          />
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function AmplifierPageInner() {
  const searchParams = useSearchParams();
  const demo = searchParams.get("demo") === "1";
  const url = demo ? "/api/amplifier/queue?demo=1" : "/api/amplifier/queue";

  const { data, loading, error, refetch } =
    usePolling<AmplifierQueueResponse>(url, POLL_INTERVAL);

  // Shadow "resolved" tracking at page level too, so the top summary bar
  // decrements as soon as the user clicks Approve/Dismiss — the backing
  // data won't reflect the mutation until GitHub's cache is busted + the
  // next 2-min poll lands.
  const [resolvedCount, setResolvedCount] = useState(0);
  const handleActionResolved = useCallback(() => {
    setResolvedCount((n) => n + 1);
  }, []);

  const isDemo = data?.demo === true;
  const queues = data?.queues ?? [];
  const summary = data?.summary;

  const pending = Math.max((summary?.pendingActions ?? 0) - resolvedCount, 0);
  const totalReach = summary?.totalReach ?? 0;
  const byPlatform = summary?.byPlatform ?? {};

  // Loading state (first load only — usePolling keeps `data` across polls)
  if (loading && !data) {
    return (
      <div className="p-4 md:p-6 space-y-4 w-full max-w-5xl mx-auto">
        <PageHeader />
        <Card className="bg-zinc-900 border-zinc-800/80">
          <CardContent className="py-12 flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
            <p className="text-sm text-zinc-500">Loading amplifier queue…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state — only surface when we truly have nothing to show.
  if (error && !data) {
    return (
      <div className="p-4 md:p-6 space-y-4 w-full max-w-5xl mx-auto">
        <PageHeader />
        <Card className="bg-zinc-900 border-zinc-800/80">
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="w-6 h-6 text-rose-400" />
            <p className="text-sm text-zinc-300">Queue unavailable</p>
            <p className="text-xs text-zinc-600 font-mono max-w-md">{error}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void refetch()}
              className="mt-2"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 w-full max-w-5xl mx-auto">
      <PageHeader />

      {isDemo && (
        <div className="rounded-lg border border-violet-800/60 bg-violet-950/30 px-3 py-2 flex items-center gap-2 text-xs text-violet-300">
          <Sparkles className="w-3.5 h-3.5" />
          <span>
            <strong className="font-semibold">DEMO</strong> — showing mock
            entries because the real queue is empty and <code>?demo=1</code>{" "}
            was set. Approve/Dismiss buttons are no-ops.
          </span>
        </div>
      )}

      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <SummaryTile
          label="Pending actions"
          value={pending.toLocaleString()}
          icon={<Inbox className="w-3.5 h-3.5 text-amber-400" />}
        />
        <SummaryTile
          label="Est. total reach"
          value={formatReach(totalReach)}
          icon={<Eye className="w-3.5 h-3.5 text-emerald-400" />}
        />
        <SummaryTile
          label="By platform"
          value={
            Object.keys(byPlatform).length === 0
              ? "—"
              : Object.entries(byPlatform)
                  .map(([k, v]) => `${k} ${v}`)
                  .join(" · ")
          }
          icon={<Megaphone className="w-3.5 h-3.5 text-cyan-400" />}
        />
      </div>

      {/* Queue list */}
      {queues.length === 0 ? (
        <Card className="bg-zinc-900 border-zinc-800/80">
          <CardContent className="py-12 flex flex-col items-center gap-2 text-center">
            <Inbox className="w-6 h-6 text-zinc-600" />
            <p className="text-sm text-zinc-300">
              No pending amplifications.
            </p>
            <p className="text-xs text-zinc-500">
              Queue fills after each article publish. Append{" "}
              <code className="text-zinc-400">?demo=1</code> to preview the UI.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {queues.map((q) => (
            <QueueGroup
              key={q.targetSlug}
              queue={q}
              onActionResolved={handleActionResolved}
              isDemo={isDemo}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PageHeader() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10">
        <Megaphone className="w-4 h-4 text-amber-500" />
      </div>
      <div className="flex-1">
        <h1 className="text-lg font-semibold text-white tracking-tight">
          Amplifier
        </h1>
        <p className="text-[12px] text-zinc-500">
          Review authority-amplification actions queued for your articles.
        </p>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <Card size="sm" className="bg-zinc-900 border-zinc-800/80">
      <CardHeader className="pb-1">
        <CardTitle className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium flex items-center gap-1.5">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xl font-bold text-white tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

// useSearchParams requires a Suspense boundary in Next 16.
export default function AmplifierPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 md:p-6 space-y-4 w-full max-w-5xl mx-auto">
          <PageHeader />
          <Card className="bg-zinc-900 border-zinc-800/80">
            <CardContent className="py-12 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
            </CardContent>
          </Card>
        </div>
      }
    >
      <AmplifierPageInner />
    </Suspense>
  );
}
