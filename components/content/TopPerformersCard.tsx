"use client";

import { useCallback, useState } from "react";
import { Trophy, ExternalLink, Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ActionPanel } from "./ActionPanel";
import { evaluateRules, type ScoreSignals, type ActionRecommendation } from "@/lib/content/actionRules";
import { SignalExplainer } from "./SignalExplainer";
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
  /** Full 6-signal object for the rule engine */
  signals?: ScoreSignals;
  /** 7-day composite score delta */
  delta7d?: number;
  /** WordPress post id for wp-admin edit URLs */
  wpId?: number;
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
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`text-[10px] tabular-nums font-mono ${scoreColorClass(item.score)}`}
                      >
                        <span className="sr-only">Composite score </span>score {item.score}
                      </span>
                      {item.monetization > 0 ? (
                        <span className="text-[10px] text-blue-400 tabular-nums">
                          <span aria-hidden="true">💰</span>{" "}
                          <span className="sr-only">Monetization </span>
                          {(item.monetization * 100).toFixed(0)}%
                        </span>
                      ) : null}
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
