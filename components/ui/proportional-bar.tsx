"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BarSegment {
  label: string;
  value: number;
  color: string; // Tailwind bg class
}

interface ProportionalBarProps {
  segments: BarSegment[];
  height?: number; // px, default 10
  className?: string;
}

export function ProportionalBar({
  segments,
  height = 10,
  className,
}: ProportionalBarProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return (
      <div
        className={cn("w-full rounded-full bg-zinc-800", className)}
        style={{ height }}
      />
    );
  }

  return (
    <TooltipProvider>
      <div
        className={cn(
          "flex w-full overflow-hidden rounded-full bg-zinc-800",
          className
        )}
        style={{ height }}
      >
        {segments
          .filter((s) => s.value > 0)
          .map((segment) => {
            const pct = (segment.value / total) * 100;
            return (
              <Tooltip key={segment.label}>
                <TooltipTrigger
                  className={cn(segment.color, "h-full")}
                  style={{
                    width: `${pct}%`,
                    minWidth: 2,
                  }}
                />
                <TooltipContent>
                  {segment.label}: {segment.value.toLocaleString("en-US")} (
                  {pct.toFixed(1)}%)
                </TooltipContent>
              </Tooltip>
            );
          })}
      </div>
    </TooltipProvider>
  );
}
