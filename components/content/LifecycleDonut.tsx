"use client";

import { useMemo } from "react";

interface LifecycleCount {
  label: string;
  count: number;
  color: string;
}

interface Props {
  data: Record<string, number>;
}

const LIFECYCLE_COLORS: Record<string, string> = {
  NEW: "#3b82f6",
  GROWING: "#10b981",
  PEAK: "#f59e0b",
  DECLINING: "#f97316",
  EVERGREEN: "#06b6d4",
  DEAD: "#ef4444",
};

/**
 * SVG donut chart showing article lifecycle distribution.
 * Pure client component, no external chart library.
 */
export function LifecycleDonut({ data }: Props) {
  const segments = useMemo(() => {
    const entries: LifecycleCount[] = Object.entries(data)
      .filter(([, count]) => count > 0)
      .map(([label, count]) => ({
        label,
        count,
        color: LIFECYCLE_COLORS[label] || "#71717a",
      }));
    return entries;
  }, [data]);

  const total = segments.reduce((s, e) => s + e.count, 0);
  if (total === 0) {
    return (
      <div className="text-xs text-zinc-600 text-center py-4">
        Aucune donnee de lifecycle.
      </div>
    );
  }

  // Build SVG arc segments
  const size = 120;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 44;
  const strokeWidth = 14;

  const circumference = 2 * Math.PI * radius;
  let cumulativeOffset = 0;

  const arcs = segments.map((seg) => {
    const pct = seg.count / total;
    const dashLength = pct * circumference;
    const dashGap = circumference - dashLength;
    const offset = -cumulativeOffset;
    cumulativeOffset += dashLength;

    return {
      ...seg,
      pct,
      dashArray: `${dashLength} ${dashGap}`,
      dashOffset: offset,
    };
  });

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4">
      <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">
        Distribution lifecycle
      </h3>
      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
        {/* Donut */}
        <div className="relative shrink-0">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="transform -rotate-90"
          >
            {/* Background circle */}
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke="#27272a"
              strokeWidth={strokeWidth}
            />
            {/* Segments */}
            {arcs.map((arc) => (
              <circle
                key={arc.label}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={strokeWidth}
                strokeDasharray={arc.dashArray}
                strokeDashoffset={arc.dashOffset}
                strokeLinecap="butt"
                className="transition-all duration-300"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-white tabular-nums">
              {total}
            </span>
            <span className="text-[10px] text-zinc-500">articles</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-1.5">
          {arcs.map((arc) => (
            <div key={arc.label} className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: arc.color }}
              />
              <span className="text-[11px] text-zinc-400 w-20">
                {arc.label}
              </span>
              <span className="text-[11px] font-mono text-zinc-300 tabular-nums">
                {arc.count}
              </span>
              <span className="text-[10px] text-zinc-600 tabular-nums">
                ({((arc.pct ?? 0) * 100).toFixed(0)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
