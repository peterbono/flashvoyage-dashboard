"use client";

/**
 * In-UI documentation of the 6 composite score signals.
 *
 * Used as:
 *   1. A popover opened via a (?) icon next to the RefreshQueueCard /
 *      TopPerformersCard headers (full docs, shared with the user).
 *   2. A data source for rich tooltips on the weakSignals badges — the
 *      SIGNAL_META export provides a 1-line definition + 1-line fix hint
 *      that the badges can render in their `title` attribute.
 *
 * Content is the same as the chat explanations the founder found useful.
 * Keeping it in code means the UI and the chat docs never drift.
 */

import { useState, useCallback } from "react";
import { HelpCircle, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Signal metadata — exported for reuse in badge tooltips
// ---------------------------------------------------------------------------

export interface SignalMeta {
  /** Display label used on badges — short. */
  label: string;
  /** 0-1 weight in the composite score. */
  weight: number;
  /** Tailwind class for the badge color. */
  color: string;
  /** One-sentence definition of what the signal measures. */
  definition: string;
  /** Data source — where the number comes from. */
  source: string;
  /** What drives this signal UP (1-2 things). */
  movesUp: string;
  /** What drives this signal DOWN (1-2 things). */
  movesDown: string;
  /** Concrete action to improve it. */
  fix: string;
  /** Important gotcha / caveat. */
  caveat?: string;
}

export const SIGNAL_META: Record<string, SignalMeta> = {
  traffic: {
    label: "traffic",
    weight: 0.3,
    color: "text-rose-400 bg-rose-950/40 border-rose-800/40",
    definition: "GA4 pageviews last 30d, normalized vs the best article in your portfolio.",
    source: "GA4 screenPageViews · 30d window",
    movesUp: "More SEO ranking, more clicks, more distribution — or a new top article raising the ceiling.",
    movesDown: "Lost SEO positions, competitor intrusion, backlinks gone, or another article cartonning (normalization effect).",
    fix: "Check GSC for queries that lost positions. Rewrite intro to match current PAA. Add an H2 on a trending long-tail.",
    caveat: "Relative, not absolute — if your top article 2× its pageviews, every other article's traffic signal halves.",
  },
  sessionQuality: {
    label: "session",
    weight: 0.1,
    color: "text-blue-400 bg-blue-950/40 border-blue-800/40",
    definition: "GA4 average session duration last 30d, normalized vs portfolio max.",
    source: "GA4 averageSessionDuration · 30d window",
    movesUp: "Long-form, well-structured, widgets that retain, clear answer above the fold.",
    movesDown: "Fluff intro, aggressive affiliate CTA up top, broken mobile, slow widgets, thin content vs query expectations.",
    fix: "Move the money table above the fold. Add a TL;DR box + jump-links TOC. Rewrite the first 3 sentences to exactly match the query.",
    caveat: "Strongly correlated with traffic — 0 pageviews means 0 duration data, so low session often means the same problem as low traffic.",
  },
  trendAlignment: {
    label: "trend",
    weight: 0.2,
    color: "text-orange-400 bg-orange-950/40 border-orange-800/40",
    definition: "Best fuzzy match between the article title/slug and currently trending Google Trends topics, weighted by the trend's composite score.",
    source: "trends-scanner.js · daily cron",
    movesUp: "Title exactly matches a hot Google Trends query (brand + year + city).",
    movesDown: "Topic went out of season (e.g. Japan snow in March), evergreen classic that rarely trends, keyword drift (brand-led queries while title is generic).",
    fix: "Add trending entities to the H1/title (brand names, current year, specific city). The fuzzy matcher will reward it within 24-48h.",
    caveat: "Often external — 70% of trend drops are seasonal, not a content problem. Don't rewrite an article that just missed its season.",
  },
  reelAmplification: {
    label: "reels",
    weight: 0.15,
    color: "text-purple-400 bg-purple-950/40 border-purple-800/40",
    definition: "Average score of IG reels linked to this article over the last 14 days, normalized with a cap at 50/reel.",
    source: "article-reel-map.json + IG Graph API · 14d window",
    movesUp: "Article has linked reels in article-reel-map.json + those reels perform well on IG.",
    movesDown: "No reel linked, reels older than 14d (out of window), reel flopped (low reach), article-reel-map stale.",
    fix: "Create a reel that points to this article. Quickest win of all signals — you don't even touch the article itself.",
    caveat: "The ONLY signal you can fix without editing the article. If `reels` is your weakest signal, craft a reel and move on.",
  },
  freshness: {
    label: "freshness",
    weight: 0.15,
    color: "text-cyan-400 bg-cyan-950/40 border-cyan-800/40",
    definition: "Age-based decay: 1.0 for articles <30 days old, linearly decays to 0 at 365 days.",
    source: "article publishedAt + current date",
    movesUp: "Publishing a new article, or refreshing an existing one (updates the modified date + live data block).",
    movesDown: "Natural time decay — every day past the 30-day mark lowers the signal slightly.",
    fix: "Run refresh-articles.yml on the article (live data block + modified date update + republish). The one-click Refresh button does this.",
  },
  monetization: {
    label: "monetiz.",
    weight: 0.1,
    color: "text-emerald-400 bg-emerald-950/40 border-emerald-800/40",
    definition: "Binary signal: 1.0 if the article contains Travelpayouts affiliate widgets, 0 otherwise.",
    source: "WordPress post content scan for fv_widget shortcodes",
    movesUp: "Inject one or more Travelpayouts widgets (flights 7879, tours 3947, eSIM 8588).",
    movesDown: "Widget stripped during a rewrite, or the article was published without any.",
    fix: "Open in WP admin and drop the relevant widget shortcode after the 'quand partir' or practical tips section. Highest EPC is eSIM.",
  },
};

/**
 * Build a rich multi-line string for the weakSignals badge `title` attribute.
 * Native HTML tooltip (zero dep) — renders newlines in most browsers on hover
 * AND is announced by screen readers on focus.
 */
export function buildSignalTooltip(
  signalName: string,
  value: number,
): string {
  const meta = SIGNAL_META[signalName];
  if (!meta) return `${signalName}: ${Math.round(value * 100)}%`;
  const pct = Math.round(value * 100);
  return [
    `${meta.label.toUpperCase()} · weight ${Math.round(meta.weight * 100)}% · currently ${pct}%`,
    ``,
    meta.definition,
    ``,
    `Fix: ${meta.fix}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Popover component — click (?) to show full docs
// ---------------------------------------------------------------------------

interface Props {
  /** Optional className override for the trigger button. */
  className?: string;
}

export function SignalExplainer({ className = "" }: Props) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="What do these signals mean?"
        aria-expanded={open}
        title="What do the score signals mean?"
        className={`text-zinc-500 hover:text-zinc-200 transition-colors p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm ${className}`}
      >
        <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
            onClick={close}
            aria-hidden="true"
          />
          {/* Panel */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="signal-explainer-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-150"
          >
            <div className="pointer-events-auto max-w-2xl w-full max-h-[85vh] overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl">
              {/* Header */}
              <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800/80 px-5 py-3 flex items-center justify-between">
                <div>
                  <h2
                    id="signal-explainer-title"
                    className="text-sm font-semibold text-white"
                  >
                    Composite score signals
                  </h2>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    How each signal is computed and what moves it up or down
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="text-zinc-500 hover:text-zinc-200 transition-colors p-[14px] -m-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              {/* Content */}
              <div className="px-5 py-4 space-y-4">
                <p className="text-[11px] text-zinc-400">
                  Each article gets a composite score from 0–100 computed as a
                  weighted sum of 6 signals. The composite drives the Refresh
                  Queue ordering and the Action Recommendations rule engine.
                </p>

                {Object.entries(SIGNAL_META).map(([key, meta]) => (
                  <section
                    key={key}
                    className="rounded-md border border-zinc-800/80 bg-zinc-900/60 p-3 space-y-2"
                  >
                    <header className="flex items-baseline gap-2 flex-wrap">
                      <span
                        className={`text-[10px] px-1.5 py-0 rounded border font-semibold uppercase tracking-wide ${meta.color}`}
                      >
                        {meta.label}
                      </span>
                      <span className="text-[10px] text-zinc-500 tabular-nums">
                        weight {Math.round(meta.weight * 100)}%
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        · {meta.source}
                      </span>
                    </header>
                    <p className="text-xs text-zinc-200 leading-snug">
                      {meta.definition}
                    </p>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <dt className="text-emerald-400 font-medium">
                          Moves up
                        </dt>
                        <dd className="text-zinc-400 mt-0.5">{meta.movesUp}</dd>
                      </div>
                      <div>
                        <dt className="text-rose-400 font-medium">
                          Moves down
                        </dt>
                        <dd className="text-zinc-400 mt-0.5">
                          {meta.movesDown}
                        </dd>
                      </div>
                    </dl>
                    <div className="text-[11px] border-t border-zinc-800/60 pt-2">
                      <span className="text-amber-400 font-medium">Fix: </span>
                      <span className="text-zinc-300">{meta.fix}</span>
                    </div>
                    {meta.caveat && (
                      <div className="text-[11px] text-zinc-500 italic border-l-2 border-zinc-700 pl-2">
                        {meta.caveat}
                      </div>
                    )}
                  </section>
                ))}

                <div className="rounded-md border border-zinc-800/80 bg-zinc-950/60 p-3">
                  <h3 className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Reading the badges
                  </h3>
                  <p className="text-[11px] text-zinc-400 leading-snug">
                    The 2 badges next to each row in the Refresh Queue show the{" "}
                    <span className="text-zinc-200">weakest two signals</span>{" "}
                    for that article. Hover any badge to see its current value
                    and a 1-line fix hint. If you see{" "}
                    <span className="text-rose-400">traffic</span> +{" "}
                    <span className="text-blue-400">session</span> together,
                    the article is probably invisible on Google (both signals
                    share a root cause). If you see{" "}
                    <span className="text-purple-400">reels</span> as a weak
                    signal, that's your fastest fix — just create a reel, no
                    article edit needed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
