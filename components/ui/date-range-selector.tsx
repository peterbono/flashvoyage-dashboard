"use client";

import { cn } from "@/lib/utils";

export type DatePreset = "7d" | "30d" | "90d" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
  preset: DatePreset;
}

export interface DateRangeSelectorProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

const PRESETS: { key: Exclude<DatePreset, "custom">; label: string; days: number }[] = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
];

function computeRange(days: number): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from, to };
}

export function DateRangeSelector({
  value,
  onChange,
  className,
}: DateRangeSelectorProps) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {PRESETS.map(({ key, label, days }) => {
        const isActive = value.preset === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => {
              const { from, to } = computeRange(days);
              onChange({ from, to, preset: key });
            }}
            className={cn(
              "px-3 py-1.5 text-xs rounded-md transition-colors",
              isActive
                ? "bg-zinc-800 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
