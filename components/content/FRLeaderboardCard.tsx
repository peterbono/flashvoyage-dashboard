"use client";

/**
 * FRLeaderboardCard — two mini-leaderboards stacked (or side-by-side on lg)
 * that surface the founder's FR-traffic growth hypotheses at a glance:
 *
 *   1. Top 10 FR-heavy      — articles where frShare >= 0.6, sorted by
 *                             frPageviews desc. "What's winning in France?"
 *   2. Top 10 FR-light opp. — articles where frShare < 0.25 AND score >= 50,
 *                             sorted by composite score desc. "What's proven
 *                             globally but untapped in the FR SERP?"
 *
 * Renders a compact empty state if neither leaderboard has entries — the
 * content repo's fr-share-scoring feat ships the underlying data. This card
 * never blocks the Portfolio tab when that data is missing.
 */

import { ExternalLink, Flag, Target } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { frShareTextColor } from "./FRShareBadge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FRLeaderboardItem {
  slug: string;
  title: string;
  url: string;
  score: number;
  frShare?: number | null;
  frPageviews?: number;
}

interface Props {
  items: FRLeaderboardItem[];
  loading: boolean;
}

// ---------------------------------------------------------------------------
// Derivation helpers
// ---------------------------------------------------------------------------

function pickFrHeavy(items: FRLeaderboardItem[]): FRLeaderboardItem[] {
  return items
    .filter(
      (i) =>
        typeof i.frShare === "number" &&
        i.frShare >= 0.6,
    )
    .sort((a, b) => (b.frPageviews ?? 0) - (a.frPageviews ?? 0))
    .slice(0, 10);
}

function pickFrLightOpp(items: FRLeaderboardItem[]): FRLeaderboardItem[] {
  return items
    .filter(
      (i) =>
        typeof i.frShare === "number" &&
        i.frShare < 0.25 &&
        i.score >= 50,
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

interface MiniListProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accentClass: string;
  items: FRLeaderboardItem[];
  /** What metric to show next to the title — pageviews for heavy, score for opp. */
  metric: "frPageviews" | "score";
  emptyLabel: string;
}

function MiniList({
  title,
  subtitle,
  icon,
  accentClass,
  items,
  metric,
  emptyLabel,
}: MiniListProps) {
  return (
    <div className="flex flex-col">
      <div className="px-2 pb-2">
        <div className="flex items-center gap-2">
          <span className={accentClass}>{icon}</span>
          <h3 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
            {title}
          </h3>
          {items.length > 0 ? (
            <span className="text-[10px] font-normal text-zinc-400 normal-case">
              ({items.length})
            </span>
          ) : null}
        </div>
        <p className="text-[10px] text-zinc-500 mt-0.5">{subtitle}</p>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-zinc-600 text-center py-6">
          {emptyLabel}
        </div>
      ) : (
        <ul className="space-y-0.5">
          {items.map((item, idx) => {
            const frPct =
              typeof item.frShare === "number" ? Math.round(item.frShare * 100) : null;
            const frColor =
              typeof item.frShare === "number"
                ? frShareTextColor(item.frShare)
                : "text-zinc-500";
            return (
              <li
                key={item.slug}
                className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-800/40 transition-colors group"
              >
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
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {frPct !== null ? (
                      <span className={`text-[10px] tabular-nums font-mono ${frColor}`}>
                        <span aria-hidden="true">🇫🇷</span> {frPct}%
                      </span>
                    ) : null}
                    <span className="text-[10px] text-zinc-400 tabular-nums">
                      <span className="sr-only">Composite score </span>score {item.score}
                    </span>
                    {metric === "frPageviews" && typeof item.frPageviews === "number" ? (
                      <span className="text-[10px] text-zinc-500 tabular-nums">
                        {item.frPageviews.toLocaleString("en-US")} FR views
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FRLeaderboardCard({ items, loading }: Props) {
  const frHeavy = pickFrHeavy(items);
  const frLightOpp = pickFrLightOpp(items);
  const totalWithData = items.filter((i) => typeof i.frShare === "number").length;

  return (
    <Card className="bg-zinc-900/40 border-zinc-800/60 rounded-xl h-full">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="flex items-center gap-2 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          <span aria-hidden="true">🇫🇷</span>
          FR market
          {totalWithData > 0 ? (
            <span className="text-[10px] font-normal text-zinc-400 normal-case">
              ({totalWithData} articles tracked)
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-3">
        {loading && items.length === 0 ? (
          <div className="text-xs text-zinc-600 text-center py-6">Loading…</div>
        ) : totalWithData === 0 ? (
          <div className="text-xs text-zinc-600 text-center py-6">
            No FR share data yet — the content repo&rsquo;s fr-share-scoring cron hasn&rsquo;t shipped.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-4">
            <MiniList
              title="FR-heavy winners"
              subtitle="frShare ≥ 60%, ranked by FR pageviews"
              icon={<Flag className="w-3.5 h-3.5" aria-hidden="true" />}
              accentClass="text-emerald-400"
              items={frHeavy}
              metric="frPageviews"
              emptyLabel="No FR-heavy articles yet."
            />
            <MiniList
              title="FR-light opportunities"
              subtitle="frShare < 25% AND score ≥ 50 — proven globally, untapped in FR"
              icon={<Target className="w-3.5 h-3.5" aria-hidden="true" />}
              accentClass="text-rose-400"
              items={frLightOpp}
              metric="score"
              emptyLabel="No FR-light opportunities detected."
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
