"use client";

/**
 * FRShareBadge — compact pill surfacing the share of pageviews coming from
 * France for a given article.
 *
 * FR share is METADATA, not a 7th composite-score signal (SEO-Guru flagged
 * signal inflation). It lives alongside weakSignals / strongSignals in the
 * meta row so the founder can spot FR-only wins, FR-light opportunities
 * (candidate for FR-SEO rewrite), and diversified articles at a glance.
 *
 * Thresholds (documented in /docs/fr-share.md, mirrored here for the tooltip):
 *   >= 80% → green  · "High FR concentration — strong FR market fit"
 *   >= 60% → cyan   · "Majority FR"
 *   >= 25% → amber  · "Diversified — multi-market reach"
 *   <  25% → rose   · "Low FR share — candidate for FR-SEO rewrite"
 *
 * Renders nothing (`null`) when `frShare` is null or undefined — backward
 * compat with articles scored before feat/fr-share-scoring ships in the
 * sibling content repo.
 */

interface Props {
  /** 0-1 value, `null` when content repo intentionally skipped (0 pageviews), `undefined` before the feat ships. */
  frShare?: number | null;
  /** Optional — used as tooltip context so the founder knows the base denominator. */
  frPageviews?: number;
}

interface BucketMeta {
  /** Tailwind color classes — mirror SIGNAL_META palette (rose/amber/cyan/emerald). */
  className: string;
  tooltip: string;
}

function getBucket(frShare: number): BucketMeta {
  if (frShare >= 0.8) {
    return {
      className: "text-emerald-400 bg-emerald-950/40 border-emerald-800/40",
      tooltip: "High FR concentration — strong FR market fit",
    };
  }
  if (frShare >= 0.6) {
    return {
      className: "text-cyan-400 bg-cyan-950/40 border-cyan-800/40",
      tooltip: "Majority FR",
    };
  }
  if (frShare >= 0.25) {
    return {
      className: "text-amber-400 bg-amber-950/40 border-amber-800/40",
      tooltip: "Diversified — multi-market reach",
    };
  }
  return {
    className: "text-rose-400 bg-rose-950/40 border-rose-800/40",
    tooltip: "Low FR share — candidate for FR-SEO rewrite",
  };
}

export function FRShareBadge({ frShare, frPageviews }: Props) {
  // Backward compat: render nothing when data is missing. The placeholder in
  // the portfolio table (`—`) lives at the call site, not here, so the meta
  // rows stay clean when fr-share-scoring hasn't shipped yet.
  if (frShare === null || frShare === undefined) return null;

  const pct = Math.round(frShare * 100);
  const { className, tooltip } = getBucket(frShare);

  // Rich tooltip — definition on the first line, denominator on the second.
  // Native `title` gives hover + screen-reader-on-focus with zero deps.
  const tooltipText =
    typeof frPageviews === "number" && frPageviews > 0
      ? `${tooltip}\n${frPageviews.toLocaleString("en-US")} pageviews tracked`
      : tooltip;

  return (
    <span
      tabIndex={0}
      role="note"
      title={tooltipText}
      aria-label={`French traffic share at ${pct} percent. ${tooltip}`}
      className={`text-[9px] px-1.5 py-0 rounded border tabular-nums cursor-help focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${className}`}
    >
      <span aria-hidden="true">🇫🇷</span> {pct}%
    </span>
  );
}

/**
 * Helper exported so the sortable Portfolio column can color the inline pct
 * text using the same palette without re-implementing the thresholds.
 * Returns tailwind text-color classes only (no background).
 */
export function frShareTextColor(frShare: number): string {
  if (frShare >= 0.8) return "text-emerald-400";
  if (frShare >= 0.6) return "text-cyan-400";
  if (frShare >= 0.25) return "text-amber-400";
  return "text-rose-400";
}
