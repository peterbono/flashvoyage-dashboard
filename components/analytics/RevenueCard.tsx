"use client";

import { Euro } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { usePolling } from "@/lib/usePolling";

/**
 * Travelpayouts Revenue KPI card.
 *
 * Polls `/api/travelpayouts/earnings` (15-min server cache) and renders:
 *   - Primary: YTD EUR total
 *   - Sub-line: MTD · today
 *
 * States:
 *   - loading (first fetch): neutral skeleton, never red — avoids a
 *     flash of "error" on cold start while the 503/200 resolves.
 *   - error: small "Revenue indisponible" label + tooltip with the raw
 *     message. Card still renders; no red banner.
 *   - zero values: renders as €0.00 — this is the current production
 *     state (no conversions yet) and must not look broken.
 */

interface EarningsRollup {
  today: number;
  mtd: number;
  ytd: number;
  currency: string;
  lastUpdated: string;
}

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 min — server caches 15 min anyway

function formatEuro(value: number): string {
  // Always 2 decimal places so zero state looks deliberate ("€0.00"), not broken.
  return `€${value.toFixed(2)}`;
}

export function RevenueCard() {
  const { data, error, loading } = usePolling<EarningsRollup>(
    "/api/travelpayouts/earnings",
    POLL_INTERVAL_MS
  );

  // First load — show a neutral skeleton (no red flash).
  if (loading && !data && !error) {
    return (
      <Card className="bg-zinc-900 border-zinc-800/80">
        <CardContent className="py-4">
          <div className="animate-pulse space-y-3">
            <div className="flex items-center gap-1.5">
              <div className="size-3.5 rounded bg-zinc-700" />
              <div className="h-3 w-24 rounded bg-zinc-700" />
            </div>
            <div className="h-7 w-28 rounded bg-zinc-700" />
            <div className="h-3 w-40 rounded bg-zinc-800" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error after first fetch — render a calm "unavailable" state so the
  // dashboard grid doesn't visually break. The tooltip carries the detail.
  if (error && !data) {
    return (
      <Card className="bg-zinc-900 border-zinc-800/80">
        <CardContent className="py-4 space-y-2">
          <div className="flex items-center gap-1.5">
            <Euro className="size-3.5 text-zinc-500" />
            <span className="text-xs uppercase tracking-wider text-zinc-500">
              Revenue (Travelpayouts)
            </span>
          </div>
          <div className="text-sm text-zinc-500" title={error}>
            Revenue indisponible
          </div>
          <div className="text-[10px] text-zinc-600">Check Vercel env config</div>
        </CardContent>
      </Card>
    );
  }

  const rollup = data ?? {
    today: 0,
    mtd: 0,
    ytd: 0,
    currency: "EUR",
    lastUpdated: "",
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800/80">
      <CardContent className="py-4 space-y-2">
        <div className="flex items-center gap-1.5">
          <Euro className="size-3.5 text-amber-400" />
          <span className="text-xs uppercase tracking-wider text-zinc-500">
            Revenue (Travelpayouts)
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <div className="text-2xl font-bold text-white tabular-nums">
              {formatEuro(rollup.ytd)}
            </div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">
              YTD
            </div>
          </div>
        </div>
        <div className="text-xs text-zinc-500 tabular-nums">
          {formatEuro(rollup.mtd)} MTD
          <span className="text-zinc-700 mx-1.5">·</span>
          {formatEuro(rollup.today)} today
        </div>
      </CardContent>
    </Card>
  );
}
