"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Video, TrendingUp, Eye, Heart, Users } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormatStat {
  format: string;
  videos: number;
  avgViews: number;
  avgLikes: number;
  likeRate: number;
  verdict: string;
}

// TikTok data — hardcoded until API available
const FORMAT_STATS: FormatStat[] = [
  { format: "Trip Pick", videos: 4, avgViews: 396, avgLikes: 15, likeRate: 3.8, verdict: "STAR" },
  { format: "Budget", videos: 3, avgViews: 548, avgLikes: 11, likeRate: 1.9, verdict: "Bon reach" },
  { format: "Avant/Apres", videos: 1, avgViews: 603, avgLikes: 11, likeRate: 1.8, verdict: "OK" },
  { format: "Best Time", videos: 1, avgViews: 130, avgLikes: 1, likeRate: 0.8, verdict: "Faible" },
  { format: "Leaderboard", videos: 1, avgViews: 114, avgLikes: 2, likeRate: 1.8, verdict: "Faible reach" },
  { format: "Versus", videos: 2, avgViews: 130, avgLikes: 1, likeRate: 0.8, verdict: "MORT" },
  { format: "Humor", videos: 2, avgViews: 85, avgLikes: 1, likeRate: 0.6, verdict: "Trop tot" },
];

const TOTALS = { views: 4539, likes: 127, comments: 2, followers: 8, videos: 17 };

const VERDICT_COLORS: Record<string, string> = {
  STAR: "text-amber-400 bg-amber-500/10",
  "Bon reach": "text-emerald-400 bg-emerald-500/10",
  OK: "text-blue-400 bg-blue-500/10",
  Faible: "text-zinc-500 bg-zinc-700/30",
  "Faible reach": "text-zinc-500 bg-zinc-700/30",
  MORT: "text-rose-400 bg-rose-500/10",
  "Trop tot": "text-zinc-500 bg-zinc-700/30",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TikTokTab() {
  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Eye, label: "Vues totales", value: TOTALS.views.toLocaleString("fr-FR"), color: "text-cyan-400" },
          { icon: Heart, label: "Likes", value: String(TOTALS.likes), color: "text-pink-400" },
          { icon: Users, label: "Abonnes", value: String(TOTALS.followers), color: "text-amber-400" },
          { icon: Video, label: "Videos", value: String(TOTALS.videos), color: "text-violet-400" },
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
            <span className="text-sm font-semibold text-white">Performance par format TikTok</span>
            <Badge variant="outline" className="ml-auto text-[10px] bg-zinc-800 border-zinc-700 text-zinc-400">
              3-8 avril 2026
            </Badge>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-2 text-zinc-500 font-medium">Format</th>
                  <th className="text-right py-2 text-zinc-500 font-medium">Videos</th>
                  <th className="text-right py-2 text-zinc-500 font-medium">Vues moy.</th>
                  <th className="text-right py-2 text-zinc-500 font-medium">Likes moy.</th>
                  <th className="text-right py-2 text-zinc-500 font-medium">Like Rate</th>
                  <th className="text-right py-2 text-zinc-500 font-medium">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {FORMAT_STATS.map((row) => (
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
            Donnees manuelles — API TikTok en attente d&apos;app review
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
