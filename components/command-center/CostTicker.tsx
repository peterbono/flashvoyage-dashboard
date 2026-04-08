"use client";

import { useMemo } from "react";
import { DollarSign } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CostHistoryEntry {
  date: string;
  totalCostUSD: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const start = new Date(d);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  data: CostHistoryEntry[] | null;
  loading: boolean;
}

export function CostTicker({ data, loading }: Props) {
  const { today, week, month } = useMemo(() => {
    if (!data || data.length === 0) {
      return { today: 0, week: 0, month: 0 };
    }

    const now = new Date();
    const todayStr = toDateStr(now);
    const weekStart = toDateStr(startOfWeek(now));
    const monthStart = toDateStr(startOfMonth(now));

    let todayCost = 0;
    let weekCost = 0;
    let monthCost = 0;

    for (const entry of data) {
      const d = (entry.date ?? "").slice(0, 10);
      const cost = entry.totalCostUSD ?? 0;

      if (d === todayStr) todayCost += cost;
      if (d >= weekStart) weekCost += cost;
      if (d >= monthStart) monthCost += cost;
    }

    return { today: todayCost, week: weekCost, month: monthCost };
  }, [data]);

  const metrics = [
    { label: "Aujourd'hui", value: today },
    { label: "Cette semaine", value: week },
    { label: "Ce mois", value: month },
  ];

  return (
    <div className="rounded-xl border bg-white dark:bg-zinc-900/40 border-gray-200 dark:border-zinc-800/50 px-4 py-3">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 shrink-0">
          <DollarSign className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[12px] font-semibold text-gray-700 dark:text-zinc-300">
            Couts LLM
          </span>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {metrics.map(({ label, value }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="text-[12px] text-gray-400 dark:text-zinc-600">
                {label}
              </span>
              {loading ? (
                <span className="inline-block w-10 h-3.5 rounded bg-gray-200 dark:bg-zinc-700 animate-pulse" />
              ) : (
                <span className="text-[13px] font-semibold text-gray-900 dark:text-white tabular-nums">
                  ${value.toFixed(2)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
