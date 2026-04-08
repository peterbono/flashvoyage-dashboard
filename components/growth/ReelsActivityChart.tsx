"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Film } from "lucide-react";

interface ReelEntry {
  date: string;
  format: string;
  permalink?: string;
}

interface Props {
  data: ReelEntry[] | null;
  loading: boolean;
}

const FORMAT_DOT_COLORS: Record<string, string> = {
  avantapres: "bg-cyan-400",
  "cost-vs": "bg-blue-400",
  pick: "bg-amber-400",
  budget: "bg-emerald-400",
  humor: "bg-pink-400",
  "humor-tweet": "bg-pink-300",
  leaderboard: "bg-orange-400",
  "best-time": "bg-violet-400",
  month: "bg-indigo-400",
  poll: "bg-zinc-500",
  versus: "bg-zinc-500",
};

export function ReelsActivityChart({ data, loading }: Props) {
  // Group reels by date (last 14 days)
  const dailyData = useMemo(() => {
    if (!data) return [];
    const counts: Record<string, { total: number; formats: Record<string, number> }> = {};

    // Last 14 days
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      counts[key] = { total: 0, formats: {} };
    }

    for (const reel of data) {
      const day = reel.date?.slice(0, 10);
      if (day && counts[day]) {
        counts[day].total++;
        counts[day].formats[reel.format] = (counts[day].formats[reel.format] || 0) + 1;
      }
    }

    return Object.entries(counts).map(([date, info]) => ({
      date,
      label: new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
      ...info,
    }));
  }, [data]);

  const totalReels = data?.length ?? 0;
  const maxDaily = Math.max(...dailyData.map((d) => d.total), 1);

  if (loading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800/80">
        <CardContent className="py-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-40 bg-zinc-700 rounded" />
            <div className="h-32 bg-zinc-800 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800/80">
      <CardContent className="py-4">
        <div className="flex items-center gap-2 mb-4">
          <Film className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-white">
            Reels publies (14j)
          </span>
          <Badge
            variant="outline"
            className="ml-auto text-[10px] bg-zinc-800 border-zinc-700 text-zinc-400"
          >
            {totalReels} total
          </Badge>
        </div>

        {/* Simple bar chart */}
        <div className="flex items-end gap-1 h-28">
          {dailyData.map((day) => (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-violet-500/80 transition-all hover:bg-violet-400"
                style={{
                  height: `${(day.total / maxDaily) * 100}%`,
                  minHeight: day.total > 0 ? 4 : 0,
                }}
                title={`${day.label}: ${day.total} reels`}
              />
            </div>
          ))}
        </div>

        {/* Date labels (show every other) */}
        <div className="flex gap-1 mt-1">
          {dailyData.map((day, i) => (
            <div key={day.date} className="flex-1 text-center">
              {i % 3 === 0 && (
                <span className="text-[9px] text-zinc-600">{day.label}</span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
