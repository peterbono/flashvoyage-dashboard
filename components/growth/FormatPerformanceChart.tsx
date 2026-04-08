"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { BarChart3 } from "lucide-react";

interface Props {
  data: {
    formatScores: Record<string, number>;
    killedFormats: string[];
    recommendations: string[];
  } | null;
  loading: boolean;
}

const FORMAT_COLORS: Record<string, string> = {
  avantapres: "#06b6d4",
  "cost-vs": "#3b82f6",
  leaderboard: "#f97316",
  "best-time": "#8b5cf6",
  pick: "#eab308",
  budget: "#10b981",
  humor: "#ec4899",
  "humor-tweet": "#f472b6",
  month: "#6366f1",
  poll: "#71717a",
  versus: "#71717a",
};

export function FormatPerformanceChart({ data, loading }: Props) {
  const chartData = useMemo(() => {
    if (!data?.formatScores) return [];
    return Object.entries(data.formatScores)
      .map(([format, score]) => ({
        format,
        score,
        killed: data.killedFormats?.includes(format),
      }))
      .sort((a, b) => b.score - a.score);
  }, [data]);

  if (loading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800/80">
        <CardContent className="py-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-48 bg-zinc-700 rounded" />
            <div className="h-48 bg-zinc-800 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800/80">
      <CardContent className="py-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-white">
            Format Performance
          </span>
          <Badge
            variant="outline"
            className="ml-auto text-[10px] bg-zinc-800 border-zinc-700 text-zinc-400"
          >
            Score IG
          </Badge>
        </div>

        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="format"
                width={90}
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#e4e4e7" }}
                formatter={(value) => [String(value), "Score"]}
              />
              <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                {chartData.map((entry) => (
                  <Cell
                    key={entry.format}
                    fill={entry.killed ? "#3f3f46" : (FORMAT_COLORS[entry.format] || "#71717a")}
                    opacity={entry.killed ? 0.4 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
