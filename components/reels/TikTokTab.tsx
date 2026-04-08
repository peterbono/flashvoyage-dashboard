"use client";

import { useMemo } from "react";
import { usePolling } from "@/lib/usePolling";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Video, TrendingUp, Eye, Heart, Users } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TikTokVideo {
  title: string;
  format: string;
  date: string;
  duration: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  visibility?: string;
}

interface FormatSummary {
  format: string;
  videos: number;
  avgViews: number;
  avgLikes: number;
  likeRate: number;
  verdict: string;
}

interface TikTokStats {
  account: {
    followers: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
  };
  videos: TikTokVideo[];
  formatSummary: FormatSummary[];
  lastUpdated: string;
}

const VERDICT_COLORS: Record<string, string> = {
  STAR: "text-amber-400 bg-amber-500/10",
  "Good reach": "text-emerald-400 bg-emerald-500/10",
  OK: "text-blue-400 bg-blue-500/10",
  Weak: "text-zinc-500 bg-zinc-700/30",
  "Low reach": "text-zinc-500 bg-zinc-700/30",
  DEAD: "text-rose-400 bg-rose-500/10",
  "Too early": "text-zinc-500 bg-zinc-700/30",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TikTokTab() {
  const { data: raw, loading } = usePolling<TikTokStats>(
    "/api/data/tiktok-stats.json",
    300_000
  );

  const stats = useMemo(() => {
    if (!raw) return null;
    const d = raw as unknown as { data?: TikTokStats };
    return d?.data ?? (raw as TikTokStats);
  }, [raw]);

  if (loading || !stats) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-zinc-900 border-zinc-800/80">
              <CardContent className="py-3">
                <div className="animate-pulse space-y-2">
                  <div className="h-3 w-16 bg-zinc-700 rounded" />
                  <div className="h-5 w-10 bg-zinc-800 rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const a = stats.account;
  const publicVideos = stats.videos?.filter((v) => v.visibility !== "private") || [];

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Eye, label: "Total Views", value: a.totalViews.toLocaleString("fr-FR"), color: "text-cyan-400" },
          { icon: Heart, label: "Likes", value: String(a.totalLikes), color: "text-pink-400" },
          { icon: Users, label: "Followers", value: String(a.followers), color: "text-amber-400" },
          { icon: Video, label: "Videos", value: String(publicVideos.length), color: "text-violet-400" },
        ].map((kpi) => (
          <Card key={kpi.label} className="bg-zinc-900 border-zinc-800/80">
            <CardContent className="py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <kpi.icon className={`w-3 h-3 ${kpi.color}`} />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{kpi.label}</span>
              </div>
              <div className="text-lg font-bold text-white">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Format matrix */}
      <Card className="bg-zinc-900 border-zinc-800/80">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-white">Format Performance</span>
            <Badge variant="outline" className="ml-auto text-[10px] bg-zinc-800 border-zinc-700 text-zinc-400">
              Updated {stats.lastUpdated}
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-2 text-zinc-500 font-medium">Format</th>
                  <th className="text-right py-2 text-zinc-500 font-medium">Videos</th>
                  <th className="text-right py-2 text-zinc-500 font-medium">Avg Views</th>
                  <th className="text-right py-2 text-zinc-500 font-medium">Avg Likes</th>
                  <th className="text-right py-2 text-zinc-500 font-medium">Like Rate</th>
                  <th className="text-right py-2 text-zinc-500 font-medium">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {(stats.formatSummary || []).map((row) => (
                  <tr key={row.format} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="py-2 text-zinc-300 font-medium">{row.format}</td>
                    <td className="py-2 text-right text-zinc-400">{row.videos}</td>
                    <td className="py-2 text-right text-zinc-300">{row.avgViews}</td>
                    <td className="py-2 text-right text-zinc-300">{row.avgLikes}</td>
                    <td className="py-2 text-right text-zinc-300">{row.likeRate}%</td>
                    <td className="py-2 text-right">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${VERDICT_COLORS[row.verdict] || "text-zinc-500"}`}>
                        {row.verdict}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[10px] text-zinc-600 mt-3">
            Data from tiktok-stats.json — update manually or via CSV import
          </p>
        </CardContent>
      </Card>

      {/* Individual videos */}
      <Card className="bg-zinc-900 border-zinc-800/80">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-4">
            <Video className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold text-white">All Videos</span>
            <Badge variant="outline" className="ml-auto text-[10px] bg-zinc-800 border-zinc-700 text-zinc-400">
              {publicVideos.length} public
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-2 text-zinc-500 font-medium">Title</th>
                  <th className="text-left py-2 text-zinc-500 font-medium">Format</th>
                  <th className="text-right py-2 text-zinc-500 font-medium">Date</th>
                  <th className="text-right py-2 text-zinc-500 font-medium">Views</th>
                  <th className="text-right py-2 text-zinc-500 font-medium">Likes</th>
                  <th className="text-right py-2 text-zinc-500 font-medium">Rate</th>
                </tr>
              </thead>
              <tbody>
                {publicVideos
                  .sort((a, b) => b.views - a.views)
                  .map((v, i) => (
                    <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="py-2 text-zinc-300 max-w-[200px] truncate">{v.title}</td>
                      <td className="py-2 text-zinc-400">{v.format}</td>
                      <td className="py-2 text-right text-zinc-500">{v.date.slice(5)}</td>
                      <td className="py-2 text-right text-zinc-300">{v.views}</td>
                      <td className="py-2 text-right text-zinc-300">{v.likes}</td>
                      <td className="py-2 text-right text-zinc-300">
                        {v.views > 0 ? ((v.likes / v.views) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
