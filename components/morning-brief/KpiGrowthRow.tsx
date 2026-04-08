"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Instagram,
  Video,
  BarChart3,
  DollarSign,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KpiMetric {
  value: number;
  delta7d?: number;
  delta30d?: number;
}

export interface KpiData {
  igFollowers: { value: number; delta7d: number } | null;
  tiktokViews: { value: number; delta7d: number } | null;
  ga4Traffic: { value: number; delta7d: number } | null;
  costMonth: { value: number; delta30d: number } | null;
}

interface Props {
  data: KpiData | null;
  loading: boolean;
}

// ---------------------------------------------------------------------------
// Card config
// ---------------------------------------------------------------------------

interface KpiCardConfig {
  key: keyof KpiData;
  label: string;
  icon: LucideIcon;
  iconColor: string;
  deltaKey: "delta7d" | "delta30d";
  positiveIsUp: boolean;
  format: (v: number) => string;
}

function formatCompact(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString("en-US");
}

function formatUsd(v: number): string {
  return `$${v.toFixed(2)}`;
}

const CARDS: KpiCardConfig[] = [
  {
    key: "igFollowers",
    label: "IG Followers",
    icon: Instagram,
    iconColor: "text-pink-500",
    deltaKey: "delta7d",
    positiveIsUp: true,
    format: formatCompact,
  },
  {
    key: "tiktokViews",
    label: "TikTok Views",
    icon: Video,
    iconColor: "text-cyan-400",
    deltaKey: "delta7d",
    positiveIsUp: true,
    format: formatCompact,
  },
  {
    key: "ga4Traffic",
    label: "Web Sessions 7d",
    icon: BarChart3,
    iconColor: "text-amber-500",
    deltaKey: "delta7d",
    positiveIsUp: true,
    format: formatCompact,
  },
  {
    key: "costMonth",
    label: "LLM Cost /mo",
    icon: DollarSign,
    iconColor: "text-emerald-400",
    deltaKey: "delta30d",
    positiveIsUp: false,
    format: formatUsd,
  },
];

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function KpiSkeleton() {
  return (
    <Card className="bg-zinc-900 border-zinc-800/80">
      <CardContent className="py-4">
        <div className="animate-pulse space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-zinc-700" />
            <div className="h-3 w-20 rounded bg-zinc-700" />
          </div>
          <div className="h-7 w-16 rounded bg-zinc-800" />
          <div className="h-3 w-24 rounded bg-zinc-800" />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Single KPI card
// ---------------------------------------------------------------------------

function KpiGrowthCard({
  config,
  metric,
}: {
  config: KpiCardConfig;
  metric: KpiMetric | null;
}) {
  const Icon = config.icon;

  if (!metric) return <KpiSkeleton />;

  const delta =
    config.deltaKey === "delta7d"
      ? (metric as { delta7d?: number }).delta7d ?? 0
      : (metric as { delta30d?: number }).delta30d ?? 0;

  const isUp = delta > 0;
  const isGood = config.positiveIsUp ? isUp : !isUp;
  const isNeutral = delta === 0;

  return (
    <Card className="bg-zinc-900 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-800/60 transition-all duration-200 group overflow-hidden">
      <CardContent className="py-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-md bg-zinc-800 group-hover:bg-zinc-700/80 transition-colors">
            <Icon className={`w-3.5 h-3.5 ${config.iconColor}`} />
          </div>
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            {config.label}
          </span>
        </div>

        <div className="text-xl md:text-2xl font-bold text-white tracking-tight mb-1">
          {config.format(metric.value)}
        </div>

        {!isNeutral ? (
          <div
            className={`flex items-center gap-1 text-xs font-medium ${
              isGood ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {isUp ? (
              <TrendingUp className="w-3 h-3 shrink-0" />
            ) : (
              <TrendingDown className="w-3 h-3 shrink-0" />
            )}
            <span>
              {isUp ? "+" : "\u2212"}
              {Math.abs(delta).toFixed(1)}% vs 7j
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs font-medium text-zinc-600">
            <span>&mdash; stable</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main row
// ---------------------------------------------------------------------------

export function KpiGrowthRow({ data, loading }: Props) {
  const cards = useMemo(
    () =>
      CARDS.map((config) => ({
        config,
        metric: data ? (data[config.key] as KpiMetric | null) : null,
      })),
    [data]
  );

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(({ config, metric }) => (
        <KpiGrowthCard key={config.key} config={config} metric={metric} />
      ))}
    </div>
  );
}
