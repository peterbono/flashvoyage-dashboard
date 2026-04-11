"use client";

/**
 * Action History — collapsible panel rendered at the bottom of the Actions tab.
 *
 * Reads from /api/workflows/runs which aggregates recent runs across the
 * user-dispatchable workflows (refresh-articles, content-intelligence,
 * daily-analytics, publish-article) and returns them sorted by date desc.
 *
 * The GitHub Actions run list is the source of truth for "actions I actually
 * executed from this UI" — it survives reloads, device changes, and cache
 * clears, and includes both manual dispatches and scheduled cron runs.
 */

import { useMemo, useState } from "react";
import {
  History,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Check,
  X,
  Loader2,
  Clock,
  Calendar,
  Zap,
} from "lucide-react";
import { usePolling } from "@/lib/usePolling";

// ---------------------------------------------------------------------------
// Types — mirror the shape returned by /api/workflows/runs
// ---------------------------------------------------------------------------

interface WorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  run_number: number;
  head_branch: string;
  event?: string;
  run_started_at?: string;
  workflow_file?: string;
}

interface RunsResponse {
  runs: WorkflowRun[];
  workflows: string[];
  errors?: Array<{ workflow: string; error: string }>;
  fetchedAt: string;
}

type EventFilter = "all" | "workflow_dispatch" | "schedule";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelative(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const deltaMs = now - t;
  const sec = Math.round(deltaMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDuration(startedAt: string | undefined, updatedAt: string): string {
  if (!startedAt) return "—";
  const start = new Date(startedAt).getTime();
  const end = new Date(updatedAt).getTime();
  const sec = Math.round((end - start) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min < 60) return remSec > 0 ? `${min}m ${remSec}s` : `${min}m`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return `${hr}h ${remMin}m`;
}

function shortenWorkflow(file?: string): string {
  if (!file) return "?";
  return file.replace(/\.yml$/, "");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActionHistory() {
  const [expanded, setExpanded] = useState(false);
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");

  // Poll every 60s while the panel is expanded. When collapsed we still
  // fetch once on mount (so the count badge is accurate) but don't keep
  // polling in the background.
  const { data, error, loading } = usePolling<RunsResponse>(
    "/api/workflows/runs?limit=50&perWorkflow=15",
    60_000,
    expanded,
  );

  const filteredRuns = useMemo(() => {
    const runs = data?.runs ?? [];
    if (eventFilter === "all") return runs;
    return runs.filter((r) => r.event === eventFilter);
  }, [data, eventFilter]);

  const counts = useMemo(() => {
    const runs = data?.runs ?? [];
    return {
      total: runs.length,
      manual: runs.filter((r) => r.event === "workflow_dispatch").length,
      schedule: runs.filter((r) => r.event === "schedule").length,
    };
  }, [data]);

  return (
    <section
      className="rounded-xl border border-zinc-800/80 bg-zinc-900/40"
      aria-label="Action history"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="action-history-panel"
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-xl"
      >
        <div className="flex items-center gap-2">
          <History className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            Action history
          </span>
          {counts.total > 0 && (
            <span className="text-[10px] text-zinc-400 normal-case tabular-nums">
              · {counts.total} recent runs
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronDown
            className="w-3.5 h-3.5 text-zinc-500"
            aria-hidden="true"
          />
        ) : (
          <ChevronRight
            className="w-3.5 h-3.5 text-zinc-500"
            aria-hidden="true"
          />
        )}
      </button>

      {expanded && (
        <div
          id="action-history-panel"
          className="px-4 pb-4 space-y-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-150"
        >
          {/* Event filter */}
          <div className="flex items-center gap-0.5 bg-zinc-900 border border-zinc-800/80 rounded-lg p-0.5 w-fit">
            {(
              [
                { key: "all", label: `All (${counts.total})`, icon: History },
                {
                  key: "workflow_dispatch",
                  label: `Manual (${counts.manual})`,
                  icon: Zap,
                },
                {
                  key: "schedule",
                  label: `Cron (${counts.schedule})`,
                  icon: Calendar,
                },
              ] as const
            ).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setEventFilter(key)}
                aria-pressed={eventFilter === key}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
                  eventFilter === key
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon className="w-3 h-3" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          {/* Body */}
          {loading && !data ? (
            <div className="flex items-center gap-2 text-[11px] text-zinc-500 py-4">
              <Loader2
                className="w-3 h-3 animate-spin"
                aria-hidden="true"
              />
              Loading recent runs…
            </div>
          ) : error ? (
            <div className="text-[11px] text-rose-400 py-2">
              Failed to load runs: {error}
            </div>
          ) : filteredRuns.length === 0 ? (
            <div className="text-[11px] text-zinc-500 py-4 text-center">
              No{" "}
              {eventFilter === "workflow_dispatch"
                ? "manual dispatches"
                : eventFilter === "schedule"
                ? "scheduled runs"
                : "runs"}{" "}
              in the recent window.
            </div>
          ) : (
            <ul className="space-y-1">
              {filteredRuns.map((run) => {
                const isSuccess = run.conclusion === "success";
                const isFailure =
                  run.conclusion === "failure" ||
                  run.conclusion === "cancelled" ||
                  run.conclusion === "timed_out";
                const isRunning =
                  run.status === "in_progress" || run.status === "queued";
                const isManual = run.event === "workflow_dispatch";

                return (
                  <li
                    key={run.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-800/40 group"
                  >
                    {/* Status icon */}
                    <span
                      className="shrink-0 w-4"
                      aria-label={
                        isSuccess
                          ? "Success"
                          : isFailure
                          ? "Failed"
                          : isRunning
                          ? "Running"
                          : "Unknown"
                      }
                    >
                      {isSuccess ? (
                        <Check
                          className="w-3.5 h-3.5 text-emerald-400"
                          aria-hidden="true"
                        />
                      ) : isFailure ? (
                        <X
                          className="w-3.5 h-3.5 text-rose-400"
                          aria-hidden="true"
                        />
                      ) : isRunning ? (
                        <Loader2
                          className="w-3.5 h-3.5 text-amber-400 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Clock
                          className="w-3.5 h-3.5 text-zinc-500"
                          aria-hidden="true"
                        />
                      )}
                    </span>

                    {/* Workflow label */}
                    <span
                      className={`text-[11px] font-mono shrink-0 w-36 truncate ${
                        isManual ? "text-zinc-200" : "text-zinc-500"
                      }`}
                      title={run.workflow_file ?? ""}
                    >
                      {shortenWorkflow(run.workflow_file)}
                    </span>

                    {/* Event + run number */}
                    <span
                      className={`text-[9px] px-1.5 py-0 rounded border tabular-nums shrink-0 ${
                        isManual
                          ? "border-amber-800/60 bg-amber-950/30 text-amber-400"
                          : "border-zinc-800 text-zinc-500"
                      }`}
                    >
                      {isManual ? "manual" : "cron"} #{run.run_number}
                    </span>

                    {/* Relative time — truncates on mobile */}
                    <span className="text-[10px] text-zinc-500 tabular-nums flex-1 truncate">
                      {formatRelative(run.created_at)}
                    </span>

                    {/* Duration */}
                    <span className="text-[10px] text-zinc-500 tabular-nums shrink-0 hidden sm:inline">
                      {formatDuration(run.run_started_at, run.updated_at)}
                    </span>

                    {/* External link */}
                    <a
                      href={run.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open run #${run.run_number} on GitHub Actions`}
                      title="Open on GitHub Actions"
                      className="shrink-0 text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 focus-within:opacity-100 focus-visible:opacity-100 transition-opacity p-[14px] -m-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm"
                    >
                      <ExternalLink
                        className="w-3 h-3"
                        aria-hidden="true"
                      />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}

          {data?.errors && data.errors.length > 0 && (
            <div className="text-[10px] text-zinc-500 border-t border-zinc-800/60 pt-2">
              Some workflows failed to load:{" "}
              {data.errors.map((e) => e.workflow).join(", ")}
            </div>
          )}

          {data && (
            <div className="text-[10px] text-zinc-600 text-right tabular-nums">
              Fetched {formatRelative(data.fetchedAt)} · polls every 60s while
              open
            </div>
          )}
        </div>
      )}
    </section>
  );
}
