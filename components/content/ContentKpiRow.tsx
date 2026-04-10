"use client";

import { Activity, Ghost, TrendingDown, DollarSign } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContentKpis {
  avgScore: number;
  zeroTrafficCount: number;
  decliningCount: number;
  totalInvestedUSD: number;
  articleCount: number;
  avgScoreDelta7d: number | null;
}

interface Props {
  kpis: ContentKpis | null;
  loading: boolean;
}

interface KpiCardConfig {
  key: keyof ContentKpis;
  label: string;
  icon: LucideIcon;
  iconColor: string;
  format: (v: number | null, kpis: ContentKpis) => string;
  subtitle: (kpis: ContentKpis) => string;
  // Lower is better for some metrics (zombies, declining)
  positiveIsUp: boolean;
}

// ---------------------------------------------------------------------------
// Formatters (hoisted out of component to avoid re-creating per render)
// ---------------------------------------------------------------------------

function formatScore(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return `${Math.round(v)}/100`;
}

function formatCount(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("en-US");
}

function formatUsd(v: number | null): string {
  if (v === null || v === undefined) return "—";
  if (v >= 100) return `$${Math.round(v)}`;
  return `$${v.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// KPI config (module-level, no re-allocations)
// ---------------------------------------------------------------------------

const KPI_CARDS: KpiCardConfig[] = [
  {
    key: "avgScore",
    label: "Portfolio Health",
    icon: Activity,
    iconColor: "text-emerald-400",
    format: (v) => formatScore(v as number),
    subtitle: (k) =>
      k.avgScoreDelta7d !== null
        ? `${k.avgScoreDelta7d > 0 ? "+" : ""}${k.avgScoreDelta7d.toFixed(1)} vs 7d`
        : "no baseline",
    positiveIsUp: true,
  },
  {
    key: "zeroTrafficCount",
    label: "Zombies",
    icon: Ghost,
    iconColor: "text-zinc-400",
    format: (v) => formatCount(v as number),
    subtitle: (k) =>
      k.articleCount > 0
        ? `${Math.round((k.zeroTrafficCount / k.articleCount) * 100)}% of portfolio`
        : "",
    positiveIsUp: false,
  },
  {
    key: "decliningCount",
    label: "In decline",
    icon: TrendingDown,
    iconColor: "text-orange-400",
    format: (v) => formatCount(v as number),
    subtitle: () => "lost 10+ pts in 7d",
    positiveIsUp: false,
  },
  {
    key: "totalInvestedUSD",
    label: "Content invested",
    icon: DollarSign,
    iconColor: "text-blue-400",
    format: (v) => formatUsd(v as number),
    subtitle: (k) =>
      k.articleCount > 0
        ? `$${(k.totalInvestedUSD / k.articleCount).toFixed(2)}/article`
        : "",
    positiveIsUp: true,
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContentKpiRow({ kpis, loading }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {KPI_CARDS.map((cfg) => {
        const Icon = cfg.icon;
        const rawValue = kpis ? (kpis[cfg.key] as number | null) : null;
        const display = kpis ? cfg.format(rawValue, kpis) : loading ? "…" : "—";
        const subtitle = kpis ? cfg.subtitle(kpis) : "";

        return (
          <Card
            key={cfg.key}
            className="bg-zinc-900/40 border-zinc-800/60 rounded-xl"
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className={`w-3.5 h-3.5 ${cfg.iconColor}`} />
                <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                  {cfg.label}
                </span>
              </div>
              <div className="text-xl font-semibold text-white tabular-nums leading-none mb-1">
                {display}
              </div>
              {subtitle ? (
                <div className="text-[10px] text-zinc-500 tabular-nums">
                  {subtitle}
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
