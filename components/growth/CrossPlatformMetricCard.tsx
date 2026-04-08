"use client";

import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ProportionalBar } from "@/components/ui/proportional-bar";
import { PLATFORM_COLORS } from "@/lib/platform-colors";
import type { Platform } from "@/lib/platform-colors";

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
            <div className="flex gap-3">
              <div className="h-3 w-16 rounded bg-zinc-800" />
              <div className="h-3 w-16 rounded bg-zinc-800" />
              <div className="h-3 w-16 rounded bg-zinc-800" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const breakdownTotal = breakdowns.reduce((sum, b) => sum + b.value, 0);

  const segments = breakdowns
    .filter((b) => b.value > 0)
    .map((b) => ({
      label: b.platform,
      value: b.value,
      color: PLATFORM_COLORS[b.platform as Platform].bg,
    }));

  return (
    <Card className="bg-zinc-900 border-zinc-800/80">
      <CardContent className="py-4 space-y-3">
        {/* Top: icon + label + total */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Icon className="size-3.5 text-zinc-500" />
            <span className="text-xs uppercase tracking-wider text-zinc-500">
              {label}
            </span>
          </div>
          <span className="text-2xl font-bold text-white">
            {total.toLocaleString("en-US")}
          </span>
        </div>

        {/* Delta badge */}
        {delta != null && (
          <div className="flex items-center gap-1">
            {delta.value > 0 ? (
              <>
                <TrendingUp className="size-3 text-emerald-400" />
                <span className="text-xs font-medium text-emerald-400">
                  +{delta.value}% vs {delta.period}
                </span>
              </>
            ) : delta.value < 0 ? (
              <>
                <TrendingDown className="size-3 text-rose-400" />
                <span className="text-xs font-medium text-rose-400">
                  {"\u2212"}{Math.abs(delta.value)}% vs {delta.period}
                </span>
              </>
            ) : (
              <span className="text-xs font-medium text-zinc-600">
                — stable
              </span>
            )}
          </div>
        )}

        {/* Middle: proportional bar */}
        <ProportionalBar segments={segments} height={10} />

        {/* Bottom: platform chips */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {breakdowns.map((b) => {
            const colors = PLATFORM_COLORS[b.platform as Platform];
            const pct =
              breakdownTotal > 0
                ? ((b.value / breakdownTotal) * 100).toFixed(1)
                : "0.0";

            return (
              <div key={b.platform} className="flex items-center gap-1.5">
                <span
                  className={`size-2 rounded-full ${colors.bg}`}
                  aria-hidden="true"
                />
                <span className="text-xs text-zinc-400 capitalize">
                  {b.platform}
                </span>
                <span className="text-xs font-medium text-white">
                  {b.value.toLocaleString("en-US")}
                </span>
                <span className="text-[10px] text-zinc-500">{pct}%</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
