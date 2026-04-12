"use client";

import { useCallback, useState } from "react";
import { Trophy, ExternalLink, Sparkles, ChevronDown, ChevronRight, TrendingUp } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ActionPanel } from "./ActionPanel";
import { evaluateRules, type ScoreSignals, type ActionRecommendation } from "@/lib/content/actionRules";
import { SignalExplainer, SIGNAL_META as SIGNAL_DOCS, buildSignalTooltip } from "./SignalExplainer";
import { FRShareBadge } from "./FRShareBadge";
import { useActionHistory } from "./useActionHistory";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TopPerformerItem {
  slug: string;
  title: string;
  url: string;
  score: number;
  monetization: number;
  flags: string[];
  /** Top 2 strongest signals (symmetric diagnosis to RefreshQueueCard.weakSignals) */
  strongSignals?: { name: string; value: number }[];
  /** Full 6-signal object for the rule engine */
  signals?: ScoreSignals;
  /** 7-day composite score delta */
  delta7d?: number;
  /** WordPress post id for wp-admin edit URLs */
  wpId?: number;
  /**
   * Phase 1 FR-share metadata (content repo feat/fr-share-scoring).
   * Same semantics as RefreshQueueItem — see FRShareBadge for thresholds.
   */
  frShare?: number | null;
  frPageviews?: number;
}

interface Props {
  items: TopPerformerItem[];
  loading: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColorClass(score: number): string {
  if (score >= 70) return "text-emerald-400";
  if (score >= 50) return "text-cyan-400";
  if (score >= 30) return "text-amber-400";
  return "text-zinc-500";
}

/** Positive-delta formatter — mirror of RefreshQueueCard.formatDelta but
 *  optimized for growth framing (shows a + sign even for small deltas). */
function formatGrowthDelta(delta: number): string {
  if (delta > 0) return `+${delta.toFixed(0)}`;
  if (delta < 0) return delta.toFixed(0);
  return "0";
}

function growthDeltaColorClass(delta: number): string {
  if (delta >= 20) return "text-emerald-400";
  if (delta >= 10) return "text-emerald-500";
  if (delta > 0) return "text-cyan-400";
  return "text-zinc-500";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TopPerformersCard({ items, loading }: Props) {
  // Disclosure: which row has its Action Recommendations panel expanded.
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  // Shared action history — same source of truth as RefreshQueueCard, so
  // marking done in one card immediately filters the same rule in the
  // other (e.g. if both surfaces happened to surface the same advice).
  const history = useActionHistory();

  const toggleExpand = useCallback((slug: string) => {
    setExpandedSlug((prev) => (prev === slug ? null : slug));
  }, []);

  const handleMarkDone = useCallback(
    (item: TopPerformerItem) => (rec: ActionRecommendation) => {
      history.markDone(
        { slug: item.slug, title: item.title, url: item.url },
        rec,
      );
    },
    [history],
  );

  return (
    <Card className="bg-zinc-900/40 border-zinc-800/60 rounded-xl h-full">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="flex items-center gap-2 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          Top performers
          {items.length > 0 ? (
            <span className="text-[10px] font-normal text-zinc-400 normal-case">
              ({items.length})
            </span>
          ) : null}
          <SignalExplainer />
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-3">
        {loading && items.length === 0 ? (
          <div className="text-xs text-zinc-600 text-center py-6">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-xs text-zinc-600 text-center py-6">
            No scored articles yet.
          </div>
        ) : (
          <ul className="space-y-0.5">
            {items.map((item, idx) => {
              const isTopPerformer = item.flags.includes("top_performer");
              const isExpanded = expandedSlug === item.slug;
              const panelId = `top-panel-${item.slug}`;
              const recommendations = isExpanded && item.signals
                ? evaluateRules(
                    {
                      signals: item.signals,
                      score: item.score,
                      delta7d: item.delta7d ?? 0,
                      flags: item.flags,
                      slug: item.slug,
                      title: item.title,
                      url: item.url,
                      wpId: item.wpId,
                      surface: "top",
                      // R9 is refresh-only today — pass-through is still safe
                      // in case a future top rule wants FR metadata.
                      frShare: item.frShare,
                      frPageviews: item.frPageviews,
                    },
                    3,
                  ).filter((rec) => !history.isDismissed(item.slug, rec.id))
                : [];
              return (
                <li
                  key={item.slug}
                  className="flex flex-col rounded-md hover:bg-zinc-800/40 transition-colors group"
                >
                  <div className="flex items-start gap-2 px-2 py-1.5">
                  <span
                    className="text-[10px] font-mono text-zinc-400 tabular-nums mt-0.5 w-4 shrink-0"
                    aria-hidden="true"
                  >
                    {idx + 1}
                  </span>
                  {/* Growth icon — symmetric to RefreshQueueCard's TrendingDown.
                      Only shown for positive delta to keep the "winning" framing
                      visually consistent across the row. */}
                  <TrendingUp
                    className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${growthDeltaColorClass(item.delta7d ?? 0)}`}
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-zinc-200 truncate flex-1 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm"
                        >
                          {item.title}
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-200 truncate flex-1">
                          {item.title}
                        </span>
                      )}
                      {isTopPerformer ? (
                        <Sparkles
                          className="w-3 h-3 text-amber-400 shrink-0"
                          aria-label="Top performer"
                        />
                      ) : null}
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open "${item.title}" in a new tab`}
                          className="text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100 focus-within:opacity-100 focus-visible:opacity-100 transition-opacity shrink-0 p-[14px] -m-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : null}
                      {item.signals && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(item.slug);
                          }}
                          aria-expanded={isExpanded}
                          aria-controls={panelId}
                          aria-label={`${
                            isExpanded ? "Hide" : "Show"
                          } action recommendations for ${item.title}`}
                          title={
                            isExpanded
                              ? "Hide recommendations"
                              : "Show action recommendations"
                          }
                          className="shrink-0 text-zinc-500 hover:text-amber-400 transition-colors p-[14px] -m-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3 h-3" aria-hidden="true" />
                          ) : (
                            <ChevronRight className="w-3 h-3" aria-hidden="true" />
                          )}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span
                        className={`text-[10px] tabular-nums font-mono ${scoreColorClass(item.score)}`}
                      >
                        <span className="sr-only">Composite score </span>score {item.score}
                      </span>
                      {/* 7d delta — symmetric to RefreshQueueCard. Shown for any
                          non-zero delta (positive or negative) so the viewer sees
                          a top performer that's losing ground as a warning signal. */}
                      {typeof item.delta7d === "number" && item.delta7d !== 0 ? (
                        <span
                          className={`text-[10px] tabular-nums font-mono ${growthDeltaColorClass(item.delta7d)}`}
                        >
                          <span className="sr-only">7-day delta </span>
                          {formatGrowthDelta(item.delta7d)} pts/7d
                        </span>
                      ) : null}
                      {/* Phase 2: top strong signals (diagnosis for growth) —
                          mirror of RefreshQueueCard.weakSignals. Shares the same
                          SIGNAL_DOCS source of truth for tooltips. Answers
                          "what pattern is working here?" so it can be replicated. */}
                      {item.strongSignals?.slice(0, 2).map((sig) => {
                        const meta = SIGNAL_DOCS[sig.name];
                        if (!meta) return null;
                        return (
                          <span
                            key={sig.name}
                            tabIndex={0}
                            role="note"
                            className={`text-[9px] px-1.5 py-0 rounded border tabular-nums cursor-help focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${meta.color}`}
                            title={buildSignalTooltip(sig.name, sig.value)}
                            aria-label={`${meta.label} signal at ${Math.round(
                              sig.value * 100,
                            )} percent`}
                          >
                            {meta.label}
                          </span>
                        );
                      })}
                      {item.monetization > 0 ? (
                        <span className="text-[10px] text-blue-400 tabular-nums">
                          <span aria-hidden="true">💰</span>{" "}
                          <span className="sr-only">Monetization </span>
                          {(item.monetization * 100).toFixed(0)}%
                        </span>
                      ) : null}
                      {/* FR-share metadata pill — placed after monetization so
                          the revenue signal stays closest to the score. Null-safe
                          (renders nothing when content repo hasn't shipped fr data). */}
                      <FRShareBadge
                        frShare={item.frShare}
                        frPageviews={item.frPageviews}
                      />
                    </div>
                  </div>
                  </div>
                  {isExpanded && (
                    <ActionPanel
                      recommendations={recommendations}
                      panelId={panelId}
                      articleTitle={item.title}
                      onMarkDone={handleMarkDone(item)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
