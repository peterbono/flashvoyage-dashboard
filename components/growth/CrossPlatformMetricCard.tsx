"use client";

import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ProportionalBar } from "@/components/ui/proportional-bar";
import { PLATFORM_COLORS } from "@/lib/platform-colors";
import type { Platform } from "@/lib/platform-colors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlatformBreakdown {
  platform: "instagram" | "facebook" | "tiktok";
  value: number;
}

interface CrossPlatformMetricCardProps {
  label: string;
  icon: LucideIcon;
  total: number;
  breakdowns: PlatformBreakdown[];
  loading?: boolean;
  delta?: { value: number; period: string };
}

export type { PlatformBreakdown, CrossPlatformMetricCardProps };

// ---------------------------------------------------------------------------
// Platform pill colors (Metricool-style colored cards)
// ---------------------------------------------------------------------------

const PLATFORM_PILL_BG: Record<string, string> = {
  facebook: "bg-blue-500/15 border-blue-500/30",
  tiktok: "bg-zinc-700/40 border-zinc-600/30",
  instagram: "bg-pink-500/15 border-pink-500/30",
};

const PLATFORM_PILL_TEXT: Record<string, string> = {
  facebook: "text-blue-400",
  tiktok: "text-zinc-300",
  instagram: "text-pink-400",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CrossPlatformMetricCard({
  label,
  icon: Icon,
  total,
  breakdowns,
  loading = false,
  delta,
}: CrossPlatformMetricCardProps) {
  if (loading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800/80">
        <CardContent className="py-4">
          <div className="animate-pulse space-y-3">
            <div className="h-3 w-20 rounded bg-zinc-700" />
            <div className="h-7 w-28 rounded bg-zinc-700" />
            <div className="h-2.5 w-full rounded-full bg-zinc-800" />
            <div className="flex gap-2">
              <div className="h-14 flex-1 rounded bg-zinc-800" />
              <div className="h-14 flex-1 rounded bg-zinc-800" />
              <div className="h-14 flex-1 rounded bg-zinc-800" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const segments = breakdowns
    .filter((b) => b.value > 0)
    .map((b) => ({
      label: b.platform,
      value: b.value,
      color: PLATFORM_COLORS[b.platform as Platform].bg,
    }));

  // Sort breakdowns by value desc for the platform cards
  const sorted = [...breakdowns].sort((a, b) => b.value - a.value);

  return (
    <Card className="bg-zinc-900 border-zinc-800/80">
      <CardContent className="py-4 space-y-3">
        {/* Row 1: Label + proportional bar + total number */}
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className="size-3.5 text-zinc-500" />
              <span className="text-xs uppercase tracking-wider text-zinc-500">
                {label}
              </span>
            </div>
            <ProportionalBar segments={segments} height={8} />
          </div>
          <div className="text-right shrink-0">
            <span className="text-2xl font-bold text-white">
              {total >= 1000
                ? `${(total / 1000).toFixed(2).replace(/\.?0+$/, "")}k`
                : total.toLocaleString("en-US")}
            </span>
            {/* Delta */}
            {delta != null && (
              <div className="flex items-center justify-end gap-0.5 mt-0.5">
                {delta.value > 0 ? (
                  <>
                    <TrendingUp className="size-2.5 text-emerald-400" />
                    <span className="text-[10px] font-medium text-emerald-400">
                      +{delta.value.toFixed(1)}%
                    </span>
                  </>
                ) : delta.value < 0 ? (
                  <>
                    <TrendingDown className="size-2.5 text-rose-400" />
                    <span className="text-[10px] font-medium text-rose-400">
                      {delta.value.toFixed(1)}%
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] text-zinc-600">stable</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Row 2: 3 platform cards (Metricool-style colored pills) */}
        <div className="grid grid-cols-3 gap-2">
          {sorted.map((b) => {
            const pillBg = PLATFORM_PILL_BG[b.platform] || "bg-zinc-800 border-zinc-700";
            const pillText = PLATFORM_PILL_TEXT[b.platform] || "text-zinc-300";

            return (
              <div
                key={b.platform}
                className={`rounded-lg border px-3 py-2 text-center ${pillBg}`}
              >
                <div className={`text-lg font-bold ${pillText}`}>
                  {b.value >= 1000
                    ? `${(b.value / 1000).toFixed(b.value >= 10000 ? 1 : 0).replace(/\.0$/, "")}k`
                    : b.value.toLocaleString("en-US")}
                </div>
                <div className="text-[10px] text-zinc-500 capitalize">
                  {b.platform}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
