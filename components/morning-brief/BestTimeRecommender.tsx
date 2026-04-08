"use client";

import { useMemo } from "react";
import { usePolling } from "@/lib/usePolling";
import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Recommendation {
  utcHour: number;
  label: string;
  platforms: string[];
  avgEngagement: number;
  uplift: number;
  confidence: number;
  sampleCount: number;
}

interface HourlyDatum {
  hour: number;
  avgEngagement: number;
  count: number;
}

interface BestTimesData {
  recommendations: Recommendation[];
  hourlyData: HourlyDatum[];
}

export interface BestTimeRecommenderProps {
  variant: "compact" | "full";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Confidence as a visual indicator (dot opacity). */
function confidenceDot(confidence: number): string {
  if (confidence >= 80) return "opacity-100";
  if (confidence >= 50) return "opacity-70";
  return "opacity-40";
}

/** Format uplift with sign. */
function fmtUplift(uplift: number): string {
  const sign = uplift >= 0 ? "+" : "";
  return `${sign}${uplift.toFixed(0)}%`;
}

/** Short platform label. */
function platformTag(platforms: string[]): string {
  return platforms.map((p) => (p === "instagram" ? "IG" : "TT")).join("+");
}

// ---------------------------------------------------------------------------
// Compact variant (Morning Brief inline pills)
// ---------------------------------------------------------------------------

function CompactView({ data }: { data: BestTimesData }) {
  if (data.recommendations.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Clock className="w-3.5 h-3.5" />
        <span>Not enough data for posting time recommendations</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
      <span className="text-xs text-zinc-500 shrink-0">Best times:</span>
      {data.recommendations.map((rec) => (
        <span
          key={rec.utcHour}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/60 border border-emerald-800/40 px-2.5 py-0.5 text-xs font-medium text-emerald-300"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full bg-emerald-400 ${confidenceDot(rec.confidence)}`}
          />
          <span>{rec.label}</span>
          <span className="text-emerald-500">{fmtUplift(rec.uplift)}</span>
          <span className="text-emerald-700 text-[10px]">
            {platformTag(rec.platforms)}
          </span>
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full variant (Growth page card with chart)
// ---------------------------------------------------------------------------

function FullView({ data }: { data: BestTimesData }) {
  const topHours = useMemo(
    () => new Set(data.recommendations.map((r) => r.utcHour)),
    [data.recommendations]
  );

  // Chart data: label each hour as BKK time
  const chartData = useMemo(
    () =>
      data.hourlyData.map((h) => ({
        hour: h.hour,
        label: `${(h.hour + 7) % 24}h`,
        avgEngagement: h.avgEngagement,
        count: h.count,
        isTop: topHours.has(h.hour),
      })),
    [data.hourlyData, topHours]
  );

  return (
    <Card className="bg-zinc-900 border-zinc-800/80">
      <CardContent className="py-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white">
            Best Times to Post
          </span>
          <span className="text-[10px] text-zinc-600 ml-auto">UTC+7 BKK</span>
        </div>

        {/* Horizontal bar chart: 24 hours */}
        <div className="h-44 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fill: "#71717a", fontSize: 10 }}
                interval={2}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#52525b", fontSize: 10 }}
                width={36}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#e4e4e7" }}
                formatter={(value) => {
                  return [`${value} avg eng.`, ""];
                }}
              />
              <Bar dataKey="avgEngagement" radius={[3, 3, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell
                    key={entry.hour}
                    fill={entry.isTop ? "#34d399" : "#3f3f46"}
                    opacity={entry.count > 0 ? 1 : 0.25}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recommendations list */}
        {data.recommendations.length > 0 ? (
          <div className="space-y-2">
            {data.recommendations.map((rec, i) => (
              <div
                key={rec.utcHour}
                className="flex items-center gap-3 rounded-lg bg-zinc-800/60 px-3 py-2"
              >
                <span className="text-xs font-bold text-emerald-400 w-5">
                  #{i + 1}
                </span>
                <span className="text-sm font-semibold text-white min-w-[64px]">
                  {rec.label}
                </span>
                <span className="text-xs text-emerald-400 font-medium">
                  {fmtUplift(rec.uplift)}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {rec.sampleCount} posts
                </span>

                {/* Confidence bar */}
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="text-[10px] text-zinc-600">
                    {platformTag(rec.platforms)}
                  </span>
                  <div className="w-12 h-1.5 rounded-full bg-zinc-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${rec.confidence}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 w-7 text-right">
                    {rec.confidence}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">
            Not enough data yet. Publish more reels to get recommendations.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loaders
// ---------------------------------------------------------------------------

function CompactSkeleton() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-3.5 h-3.5 rounded bg-zinc-700 animate-pulse" />
      <div className="h-3 w-16 rounded bg-zinc-700 animate-pulse" />
      <div className="h-5 w-24 rounded-full bg-zinc-800 animate-pulse" />
      <div className="h-5 w-24 rounded-full bg-zinc-800 animate-pulse" />
      <div className="h-5 w-24 rounded-full bg-zinc-800 animate-pulse" />
    </div>
  );
}

function FullSkeleton() {
  return (
    <Card className="bg-zinc-900 border-zinc-800/80">
      <CardContent className="py-4">
        <div className="animate-pulse space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-zinc-700" />
            <div className="h-4 w-32 rounded bg-zinc-700" />
          </div>
          <div className="h-44 bg-zinc-800 rounded" />
          <div className="h-10 bg-zinc-800 rounded" />
          <div className="h-10 bg-zinc-800 rounded" />
          <div className="h-10 bg-zinc-800 rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function BestTimeRecommender({ variant }: BestTimeRecommenderProps) {
  const { data, loading, error } = usePolling<BestTimesData>(
    "/api/best-times",
    300_000
  );

  if (error && !data) {
    return variant === "compact" ? (
      <div className="flex items-center gap-2 text-xs text-zinc-600">
        <Clock className="w-3.5 h-3.5" />
        <span>Best times unavailable</span>
      </div>
    ) : null;
  }

  if (loading && !data) {
    return variant === "compact" ? <CompactSkeleton /> : <FullSkeleton />;
  }

  if (!data) return null;

  return variant === "compact" ? (
    <CompactView data={data} />
  ) : (
    <FullView data={data} />
  );
}
