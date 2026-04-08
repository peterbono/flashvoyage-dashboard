"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Globe } from "lucide-react";

interface Props {
  data: {
    byCountry: { country: string; sessions: number; percentage: number }[];
  } | null;
  loading: boolean;
}

const COLORS = ["#eab308", "#3b82f6", "#10b981", "#f97316", "#8b5cf6", "#71717a"];

export function AudienceGeoChart({ data, loading }: Props) {
  const chartData = useMemo(() => {
    if (!data?.byCountry) return [];
    const top5 = data.byCountry.slice(0, 5);
    const othersTotal = data.byCountry
      .slice(5)
      .reduce((sum, c) => sum + c.sessions, 0);
    if (othersTotal > 0) {
      top5.push({ country: "Autres", sessions: othersTotal, percentage: 0 });
    }
    return top5;
  }, [data]);

  if (loading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800/80">
        <CardContent className="py-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-36 bg-zinc-700 rounded" />
            <div className="h-40 bg-zinc-800 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800/80">
      <CardContent className="py-4">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">
            Audience par pays (7j)
          </span>
        </div>

        <div className="flex items-center gap-6">
          <div className="h-40 w-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="sessions"
                  nameKey="country"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  innerRadius={40}
                  strokeWidth={0}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value) => [String(value), "Sessions"]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex-1 space-y-2">
            {chartData.map((item, i) => (
              <div key={item.country} className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className="text-xs text-zinc-400 flex-1 truncate">
                  {item.country}
                </span>
                <span className="text-xs font-medium text-zinc-300 tabular-nums">
                  {item.sessions}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
