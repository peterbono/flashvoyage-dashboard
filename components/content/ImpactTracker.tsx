"use client";

/**
 * Impact Tracker — shows score evolution over 14 days for recently-modified
 * articles so the founder can measure the effect of their content-ops actions.
 *
 * Data source: /api/data/score-timeline which reads daily score-history
 * snapshots from the content repo.
 *
 * Shows:
 * - Per-article row with current score, delta since first snapshot, text sparkline
 * - Annotations for "Mark done" dates from the shared action history (localStorage)
 * - Aggregated summary: how many articles improved, stable, declined
 */

import { useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  BarChart3,
  Loader2,
} from "lucide-react";
import { usePolling } from "@/lib/usePolling";
import { useActionHistory } from "./useActionHistory";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimelineResponse {
  dates: string[];
  timelines: Record<string, (number | null)[]>;
  fetchedAt: string;
}

interface ArticleTimeline {
  slug: string;
  title: string;
  url: string;
  scores: (number | null)[];
  current: number | null;
  first: number | null;
  delta: number | null;
  editDate: string | null;
}

interface Props {
  /** Slugs of articles to track — typically the ones we recently modified. */
  trackedSlugs: Array<{ slug: string; title: string; url: string }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SPARK_CHARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

function buildSparkline(scores: (number | null)[]): string {
  const valid = scores.filter((s): s is number => s !== null);
  if (valid.length === 0) return "—";
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  return scores
    .map((s) => {
      if (s === null) return " ";
      const idx = Math.min(
        Math.round(((s - min) / range) * (SPARK_CHARS.length - 1)),
        SPARK_CHARS.length - 1,
      );
      return SPARK_CHARS[idx];
    })
    .join("");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImpactTracker({ trackedSlugs }: Props) {
  const [expanded, setExpanded] = useState(true);

  // Fetch 14-day timeline for the tracked slugs only
  const slugsCsv = useMemo(
    () => trackedSlugs.map((s) => s.slug).join(","),
    [trackedSlugs],
  );

  const { data, loading, error } = usePolling<TimelineResponse>(
    `/api/data/score-timeline?days=14&slugs=${encodeURIComponent(slugsCsv)}`,
    300_000, // 5 min
    trackedSlugs.length > 0,
  );

  // Action history for edit date annotations
  const history = useActionHistory();

  // Build per-article timeline rows
  const articles = useMemo<ArticleTimeline[]>(() => {
    if (!data?.timelines) return [];
    return trackedSlugs.map(({ slug, title, url }) => {
      const scores = data.timelines[slug] ?? new Array(data.dates.length).fill(null);
      const validScores = scores.filter((s): s is number => s !== null);
      const current = validScores.length > 0 ? validScores[validScores.length - 1] : null;
      const first = validScores.length > 0 ? validScores[0] : null;
      const delta = current !== null && first !== null ? current - first : null;

      // Find earliest "Mark done" date for this slug
      const doneEntries = history.entries.filter((e) => e.slug === slug);
      const editDate =
        doneEntries.length > 0
          ? doneEntries.reduce((earliest, e) =>
              e.markedAt < earliest.markedAt ? e : earliest,
            ).markedAt
          : null;

      return { slug, title, url, scores, current, first, delta, editDate };
    });
  }, [data, trackedSlugs, history.entries]);

  // Aggregated stats
  const stats = useMemo(() => {
    let improved = 0,
      stable = 0,
      declined = 0,
      pending = 0;
    for (const art of articles) {
      if (art.delta === null) {
        pending++;
      } else if (art.delta > 2) {
        improved++;
      } else if (art.delta < -2) {
        declined++;
      } else {
        stable++;
      }
    }
    return { improved, stable, declined, pending, total: articles.length };
  }, [articles]);

  if (trackedSlugs.length === 0) return null;

  return (
    <section
      className="rounded-xl border border-indigo-900/40 bg-indigo-950/10"
      aria-label="Impact tracker"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="impact-tracker-panel"
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-xl"
      >
        <div className="flex items-center gap-2">
          <BarChart3
            className="w-3.5 h-3.5 text-indigo-400"
            aria-hidden="true"
          />
          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            Impact tracker
          </span>
          <span className="text-[10px] font-mono tabular-nums px-1 py-0 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/40">
            {stats.total}
          </span>
          {stats.improved > 0 && (
            <span className="text-[10px] text-emerald-400 tabular-nums">
              {stats.improved} improved
            </span>
          )}
          {stats.declined > 0 && (
            <span className="text-[10px] text-rose-400 tabular-nums">
              {stats.declined} declined
            </span>
          )}
          {stats.pending > 0 && (
            <span className="text-[10px] text-zinc-500 tabular-nums">
              {stats.pending} pending
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
          id="impact-tracker-panel"
          className="px-4 pb-4 space-y-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-150"
        >
          {loading && !data ? (
            <div className="flex items-center gap-2 text-[11px] text-zinc-500 py-4">
              <Loader2
                className="w-3 h-3 animate-spin"
                aria-hidden="true"
              />
              Loading score history…
            </div>
          ) : error ? (
            <div className="text-[11px] text-rose-400 py-2">
              Failed to load timeline: {error}
            </div>
          ) : (
            <>
              {/* Date range */}
              {data && (
                <div className="text-[10px] text-zinc-500 tabular-nums">
                  Tracking {data.dates.length} days: {formatDate(data.dates[0])}{" "}
                  → {formatDate(data.dates[data.dates.length - 1])}
                </div>
              )}

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-zinc-500 border-b border-zinc-800/60">
                      <th className="text-left pb-2 font-medium pr-3">
                        Article
                      </th>
                      <th className="text-right pb-2 font-medium px-2 w-14">
                        Score
                      </th>
                      <th className="text-right pb-2 font-medium px-2 w-16">
                        Delta
                      </th>
                      <th className="text-left pb-2 font-medium px-2 w-28">
                        14d trend
                      </th>
                      <th className="text-left pb-2 font-medium px-2 w-16 hidden sm:table-cell">
                        Edited
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {articles.map((art) => {
                      const isImproved = art.delta !== null && art.delta > 2;
                      const isDeclined = art.delta !== null && art.delta < -2;
                      return (
                        <tr
                          key={art.slug}
                          className="border-b border-zinc-800/30 hover:bg-zinc-800/20"
                        >
                          <td className="py-2 pr-3 max-w-[200px]">
                            <a
                              href={art.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-zinc-200 truncate block hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-sm"
                            >
                              {art.title}
                            </a>
                          </td>
                          <td className="text-right px-2 tabular-nums">
                            <span
                              className={
                                art.current !== null && art.current >= 50
                                  ? "text-emerald-400 font-semibold"
                                  : art.current !== null && art.current >= 30
                                  ? "text-amber-400"
                                  : "text-zinc-400"
                              }
                            >
                              {art.current ?? "—"}
                            </span>
                          </td>
                          <td className="text-right px-2 tabular-nums">
                            {art.delta !== null ? (
                              <span
                                className={`flex items-center justify-end gap-1 ${
                                  isImproved
                                    ? "text-emerald-400"
                                    : isDeclined
                                    ? "text-rose-400"
                                    : "text-zinc-500"
                                }`}
                              >
                                {isImproved ? (
                                  <TrendingUp
                                    className="w-3 h-3"
                                    aria-hidden="true"
                                  />
                                ) : isDeclined ? (
                                  <TrendingDown
                                    className="w-3 h-3"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <Minus
                                    className="w-3 h-3"
                                    aria-hidden="true"
                                  />
                                )}
                                {art.delta > 0 ? "+" : ""}
                                {art.delta}
                              </span>
                            ) : (
                              <span className="text-zinc-600">—</span>
                            )}
                          </td>
                          <td className="px-2">
                            <span
                              className="font-mono text-[11px] tracking-tight text-indigo-400"
                              title={art.scores
                                .map(
                                  (s, i) =>
                                    `${data?.dates[i] ?? "?"}: ${s ?? "—"}`,
                                )
                                .join("\n")}
                            >
                              {buildSparkline(art.scores)}
                            </span>
                          </td>
                          <td className="px-2 text-[10px] text-zinc-500 hidden sm:table-cell">
                            {art.editDate
                              ? formatDate(art.editDate)
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between text-[10px] text-zinc-600">
                <span>
                  Score snapshots from content-intelligence.yml cron (daily
                  03:00 UTC)
                </span>
                {data && (
                  <span className="tabular-nums">
                    Data up to {formatDate(data.dates[data.dates.length - 1])}
                  </span>
                )}
              </div>

              {stats.pending > 0 && (
                <div className="text-[10px] text-zinc-500 italic border-l-2 border-indigo-800/40 pl-2">
                  {stats.pending} article{stats.pending !== 1 ? "s" : ""} still
                  pending — first delta will appear after tomorrow&apos;s 03:00 UTC
                  cron generates a new score snapshot with the edited articles.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
