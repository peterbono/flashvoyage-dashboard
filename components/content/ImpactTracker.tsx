"use client";

/**
 * Impact Tracker v2 — Cohort comparison + per-article Before/Now/Δ table.
 *
 * Replaces the v1 "text sparkline per row" design which was unreadable and
 * didn't answer the core question: "did my edits move the needle?"
 *
 * v2 structure:
 * 1. Cohort comparison card (Modified vs Not modified — avg score + delta)
 * 2. Per-article table with Edit date, Score Before (at edit time),
 *    Score Now, Delta since edit
 *
 * Renders in the LEFT zone below the action list (not the right sidebar)
 * so it has room to breathe. Collapsible, defaults to expanded.
 */

import { useMemo, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { usePolling } from "@/lib/usePolling";
import { useActionHistory } from "./useActionHistory";

interface TimelineResponse {
  dates: string[];
  timelines: Record<string, (number | null)[]>;
  fetchedAt: string;
}

interface ArticleImpact {
  slug: string;
  title: string;
  url: string;
  editDate: string | null;
  scoreAtEdit: number | null;
  current: number | null;
  delta: number | null;
}

interface CohortStats {
  modifiedCount: number;
  modifiedAvgAtEdit: number;
  modifiedAvgNow: number;
  modifiedAvgDelta: number;
  unmodifiedCount: number;
  unmodifiedAvgBefore: number;
  unmodifiedAvgNow: number;
  unmodifiedAvgDelta: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function lastValid(scores: (number | null)[]): number | null {
  for (let i = scores.length - 1; i >= 0; i--) {
    const v = scores[i];
    if (v !== null) return v;
  }
  return null;
}

function firstValid(scores: (number | null)[]): number | null {
  for (let i = 0; i < scores.length; i++) {
    const v = scores[i];
    if (v !== null) return v;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImpactTracker() {
  const [expanded, setExpanded] = useState(true);
  const history = useActionHistory();

  // Set of slugs that have at least one "Mark done" entry
  const modifiedSlugs = useMemo(
    () => new Set(history.entries.map((e) => e.slug)),
    [history.entries],
  );

  // Fetch score timelines for modified articles + ALL articles
  const modifiedSlugsCsv = useMemo(
    () => Array.from(modifiedSlugs).join(","),
    [modifiedSlugs],
  );

  const hasModified = modifiedSlugs.size > 0;

  const { data: modifiedData, loading: modLoading } = usePolling<TimelineResponse>(
    hasModified
      ? `/api/data/score-timeline?days=30&slugs=${encodeURIComponent(modifiedSlugsCsv)}`
      : "/api/data/score-timeline?days=1", // noop fallback URL; enabled=false keeps it cold
    300_000,
    hasModified,
  );

  const { data: allData } = usePolling<TimelineResponse>(
    "/api/data/score-timeline?days=14",
    300_000,
    hasModified,
  );

  // Per-article rows: compute score at edit date vs current
  const rows = useMemo<ArticleImpact[]>(() => {
    if (!modifiedData) return [];
    return Array.from(modifiedSlugs).map((slug) => {
      const entries = history.entries.filter((e) => e.slug === slug);
      const earliest =
        entries.length > 0
          ? entries.reduce((e, curr) =>
              curr.markedAt < e.markedAt ? curr : e,
            )
          : null;
      const editDateIso = earliest?.markedAt ?? null;
      const editDateStr = editDateIso?.slice(0, 10) ?? null;

      const scores = modifiedData.timelines[slug] ?? [];
      const current = lastValid(scores);

      // Score at edit date: look up the index in dates[]
      let scoreAtEdit: number | null = null;
      if (editDateStr) {
        const idx = modifiedData.dates.indexOf(editDateStr);
        if (idx >= 0) {
          // If exact date has a null score, walk backwards up to 3 days
          for (let i = idx; i >= Math.max(0, idx - 3); i--) {
            if (scores[i] !== null) {
              scoreAtEdit = scores[i];
              break;
            }
          }
        }
      }

      const delta =
        current !== null && scoreAtEdit !== null
          ? current - scoreAtEdit
          : null;

      const title = earliest?.articleTitle ?? slug;
      const url = earliest?.articleUrl ?? `https://flashvoyage.com/${slug}/`;

      return {
        slug,
        title,
        url,
        editDate: editDateIso,
        scoreAtEdit,
        current,
        delta,
      };
    });
  }, [modifiedData, modifiedSlugs, history.entries]);

  // Cohort statistics
  const cohortStats = useMemo<CohortStats | null>(() => {
    if (!modifiedData || !allData) return null;

    // Modified cohort — use only rows with valid before+now
    const validRows = rows.filter(
      (r) => r.scoreAtEdit !== null && r.current !== null,
    );
    const modifiedCount = validRows.length;
    const modifiedAvgAtEdit =
      validRows.length > 0
        ? validRows.reduce((s, r) => s + (r.scoreAtEdit ?? 0), 0) /
          validRows.length
        : 0;
    const modifiedAvgNow =
      validRows.length > 0
        ? validRows.reduce((s, r) => s + (r.current ?? 0), 0) /
          validRows.length
        : 0;
    const modifiedAvgDelta = modifiedAvgNow - modifiedAvgAtEdit;

    // Unmodified cohort — all articles in allData minus modified ones
    const unmodifiedEntries = Object.entries(allData.timelines).filter(
      ([slug]) => !modifiedSlugs.has(slug),
    );
    const unmodifiedValid = unmodifiedEntries
      .map(([, scores]) => ({
        current: lastValid(scores),
        before: firstValid(scores),
      }))
      .filter(
        (r): r is { current: number; before: number } =>
          r.current !== null && r.before !== null,
      );
    const unmodifiedCount = unmodifiedValid.length;
    const unmodifiedAvgBefore =
      unmodifiedValid.length > 0
        ? unmodifiedValid.reduce((s, r) => s + r.before, 0) /
          unmodifiedValid.length
        : 0;
    const unmodifiedAvgNow =
      unmodifiedValid.length > 0
        ? unmodifiedValid.reduce((s, r) => s + r.current, 0) /
          unmodifiedValid.length
        : 0;
    const unmodifiedAvgDelta = unmodifiedAvgNow - unmodifiedAvgBefore;

    return {
      modifiedCount,
      modifiedAvgAtEdit,
      modifiedAvgNow,
      modifiedAvgDelta,
      unmodifiedCount,
      unmodifiedAvgBefore,
      unmodifiedAvgNow,
      unmodifiedAvgDelta,
    };
  }, [rows, modifiedData, allData, modifiedSlugs]);

  // Detect "most edits are recent (<48h old)" → show GA4 lag disclaimer
  const mostEditsAreRecent = useMemo(() => {
    if (history.entries.length === 0) return false;
    const now = Date.now();
    const recentThreshold = 48 * 3_600_000; // 48h
    const recent = history.entries.filter(
      (e) => now - new Date(e.markedAt).getTime() < recentThreshold,
    );
    return recent.length / history.entries.length > 0.5;
  }, [history.entries]);

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!hasModified) {
    return (
      <section className="rounded-lg border border-white/[0.08] bg-white/[0.02]">
        <div className="px-4 py-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-zinc-500" aria-hidden="true" />
          <span className="text-sm font-medium text-zinc-300">
            Impact of your edits
          </span>
          <span className="text-xs text-zinc-500">
            · No edits marked done yet
          </span>
        </div>
      </section>
    );
  }

  // ── Main view ────────────────────────────────────────────────────────────
  return (
    <section
      className="rounded-lg border border-white/[0.08] bg-white/[0.02]"
      aria-label="Impact tracker"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="impact-tracker-v2-panel"
        className="w-full px-4 py-3 flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          <BarChart3
            className="w-4 h-4 text-indigo-400"
            aria-hidden="true"
          />
          <span className="text-sm font-medium text-zinc-50">
            Impact of your edits
          </span>
          <span className="text-xs text-zinc-500">
            · {modifiedSlugs.size} modified article
            {modifiedSlugs.size !== 1 ? "s" : ""}
          </span>
        </div>
        {expanded ? (
          <ChevronDown
            className="w-4 h-4 text-zinc-500"
            aria-hidden="true"
          />
        ) : (
          <ChevronRight
            className="w-4 h-4 text-zinc-500"
            aria-hidden="true"
          />
        )}
      </button>

      {expanded && (
        <div
          id="impact-tracker-v2-panel"
          className="border-t border-white/[0.06] px-4 py-4 space-y-4"
        >
          {/* ─── Card A: Cohort stats ───────────────────────────────── */}
          {cohortStats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <CohortCard
                label="Modified"
                sublabel={`${cohortStats.modifiedCount} article${
                  cohortStats.modifiedCount !== 1 ? "s" : ""
                }`}
                current={cohortStats.modifiedAvgNow}
                previous={cohortStats.modifiedAvgAtEdit}
                previousLabel="at edit time"
                delta={cohortStats.modifiedAvgDelta}
                accent="indigo"
              />
              <CohortCard
                label="Not modified"
                sublabel={`${cohortStats.unmodifiedCount} article${
                  cohortStats.unmodifiedCount !== 1 ? "s" : ""
                }`}
                current={cohortStats.unmodifiedAvgNow}
                previous={cohortStats.unmodifiedAvgBefore}
                previousLabel="14 days ago"
                delta={cohortStats.unmodifiedAvgDelta}
                accent="zinc"
              />
            </div>
          ) : modLoading ? (
            <div className="flex items-center gap-2 text-xs text-zinc-500 py-4">
              <Loader2
                className="w-3 h-3 animate-spin"
                aria-hidden="true"
              />
              Computing cohort stats…
            </div>
          ) : null}

          {/* GA4 lag disclaimer */}
          {mostEditsAreRecent &&
            cohortStats &&
            Math.abs(cohortStats.modifiedAvgDelta) < 1 && (
              <div className="text-[11px] text-zinc-500 italic border-l-2 border-indigo-800/40 pl-2">
                Most edits are less than 48h old. GA4 signal propagation takes
                24-48h and the score snapshot runs at 03:00 UTC daily — check
                back tomorrow for the first real delta.
              </div>
            )}

          {/* ─── Table C: Per-article Before / Now / Δ ──────────────── */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2 px-0.5">
              Per-article impact
            </div>
            <div className="rounded-md border border-white/[0.08] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white/[0.02] text-zinc-500 border-b border-white/[0.06]">
                    <th className="text-left px-3 py-2 font-medium">
                      Article
                    </th>
                    <th className="text-center px-2 py-2 font-medium w-20">
                      Edit
                    </th>
                    <th className="text-right px-2 py-2 font-medium w-14">
                      Before
                    </th>
                    <th className="text-right px-2 py-2 font-medium w-14">
                      Now
                    </th>
                    <th className="text-right px-3 py-2 font-medium w-20">
                      Δ since edit
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {rows.map((row) => (
                    <tr
                      key={row.slug}
                      className="hover:bg-white/[0.03] group"
                    >
                      <td className="px-3 py-2 max-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-200 truncate hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-sm"
                            title={row.title}
                          >
                            {row.title}
                          </a>
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open ${row.title}`}
                            className="text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 shrink-0"
                          >
                            <ExternalLink
                              className="w-3 h-3"
                              aria-hidden="true"
                            />
                          </a>
                        </div>
                      </td>
                      <td className="text-center px-2 py-2 text-zinc-500 tabular-nums">
                        {row.editDate ? formatShortDate(row.editDate) : "—"}
                      </td>
                      <td className="text-right px-2 py-2 tabular-nums">
                        {row.scoreAtEdit !== null ? (
                          <span className="text-zinc-400">
                            {row.scoreAtEdit}
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="text-right px-2 py-2 tabular-nums">
                        {row.current !== null ? (
                          <span
                            className={
                              row.current >= 50
                                ? "text-emerald-400 font-semibold"
                                : row.current >= 30
                                ? "text-amber-400"
                                : "text-zinc-400"
                            }
                          >
                            {row.current}
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="text-right px-3 py-2 tabular-nums">
                        <DeltaChip value={row.delta} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface CohortCardProps {
  label: string;
  sublabel: string;
  current: number;
  previous: number;
  previousLabel: string;
  delta: number;
  accent: "indigo" | "zinc";
}

function CohortCard({
  label,
  sublabel,
  current,
  previous,
  previousLabel,
  delta,
  accent,
}: CohortCardProps) {
  const accentBorder =
    accent === "indigo"
      ? "border-indigo-500/30"
      : "border-white/[0.08]";

  return (
    <div
      className={`rounded-md border ${accentBorder} bg-white/[0.02] p-3`}
    >
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
          {label}
        </span>
        <span className="text-xs text-zinc-500">{sublabel}</span>
      </div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-2xl font-semibold text-zinc-50 tabular-nums">
          {current.toFixed(1)}
        </span>
        <span className="text-xs text-zinc-500">avg score now</span>
      </div>
      <div className="text-[11px] text-zinc-400 tabular-nums">
        Was {previous.toFixed(1)} {previousLabel}
      </div>
      <div className="mt-2 pt-2 border-t border-white/[0.04]">
        <DeltaIndicator value={delta} />
      </div>
    </div>
  );
}

interface DeltaIndicatorProps {
  value: number;
}

function DeltaIndicator({ value }: DeltaIndicatorProps) {
  const isStable = Math.abs(value) < 0.5;
  const isPositive = value > 0;
  const color = isStable
    ? "text-zinc-500"
    : isPositive
    ? "text-emerald-400"
    : "text-rose-400";
  const Icon = isStable ? Minus : isPositive ? TrendingUp : TrendingDown;
  const sign = isPositive && !isStable ? "+" : "";
  return (
    <div className={`flex items-center gap-1 text-xs ${color}`}>
      <Icon className="w-3 h-3" aria-hidden="true" />
      <span className="tabular-nums font-medium">
        {sign}
        {value.toFixed(1)} pts
      </span>
    </div>
  );
}

interface DeltaChipProps {
  value: number | null;
}

function DeltaChip({ value }: DeltaChipProps) {
  if (value === null) {
    return (
      <span className="text-[10px] text-zinc-600 italic">pending</span>
    );
  }
  if (Math.abs(value) < 0.5) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-zinc-500/10 text-zinc-500 tabular-nums">
        ±0
      </span>
    );
  }
  const isPositive = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] tabular-nums font-medium ${
        isPositive
          ? "bg-emerald-500/10 text-emerald-400"
          : "bg-rose-500/10 text-rose-400"
      }`}
    >
      {isPositive ? "+" : ""}
      {Math.round(value)}
    </span>
  );
}
