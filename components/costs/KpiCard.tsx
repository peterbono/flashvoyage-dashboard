"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, TrendingUp, LucideIcon } from "lucide-react";
import { Sparkline } from "@/components/ui/sparkline";

interface Props {
  label: string;
  value: string;
  /** Trend percentage string e.g. "8.2%" */
  trend?: string;
  /** true = value went UP vs prior period */
  trendUp?: boolean;
  /** true = going UP is good (articles, quality). false = going up is bad (cost) */
  positiveIsUp?: boolean;
  icon: LucideIcon;
  iconColor: string;
  sparkData?: number[];
  sparkColor?: string;
}

export function KpiCard({
  label,
  value,
  trend,
  trendUp,
  positiveIsUp = false,
  icon: Icon,
  iconColor,
  sparkData,
  sparkColor,
}: Props) {
  // isGood: green if direction matches positiveIsUp expectation
  const isGood = trendUp === positiveIsUp;

  return (
    <Card className="bg-zinc-900 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-800/60 transition-all duration-200 group overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
          {label}
        </CardTitle>
        <div className={`p-1.5 rounded-md bg-zinc-800 group-hover:bg-zinc-700/80 transition-colors ${iconColor}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </CardHeader>
      <CardContent className="pb-0">
        <div className="text-3xl font-bold text-white tracking-tight">{value}</div>
        {trend && (
          <div
            className={`flex items-center gap-1 text-xs mt-1 font-medium ${
              isGood ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {trendUp ? (
              <TrendingUp className="w-3 h-3 shrink-0" />
            ) : (
              <TrendingDown className="w-3 h-3 shrink-0" />
            )}
            <span>
              {trendUp ? "+" : "−"}
              {trend} vs prev period
            </span>
          </div>
        )}
        {sparkData && sparkData.length > 1 && (
          <div className="mt-3 -mx-6 -mb-6">
            <Sparkline
              data={sparkData}
              color={sparkColor ?? "#f59e0b"}
              height={36}
              fill
            />
          </div>
        )}
        {!sparkData && <div className="pb-4" />}
      </CardContent>
    </Card>
  );
}
