"use client";

import { usePolling } from "@/lib/usePolling";
import { Card, CardContent } from "@/components/ui/card";
import { Video, TrendingUp, Users, Eye, Heart } from "lucide-react";

interface TikTokStats {
  account: {
    followers: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    daysSinceStart: number;
  };
  formatSummary: { format: string; likeRate: number }[];
  lastUpdated: string;
}

export function TikTokGrowthCard() {
  const { data: raw, loading } = usePolling<TikTokStats>(
    "/api/data/tiktok-stats.json",
    300_000
  );

  const stats = raw
    ? (raw as unknown as { data?: TikTokStats })?.data ?? (raw as TikTokStats)
    : null;

  const bestFormat = stats?.formatSummary?.reduce(
    (best, f) => (f.likeRate > (best?.likeRate ?? 0) ? f : best),
    null as { format: string; likeRate: number } | null
  );

  if (loading || !stats) {
    return (
      <Card className="bg-zinc-900 border-zinc-800/80">
        <CardContent className="py-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-24 bg-zinc-700 rounded" />
            <div className="h-6 w-16 bg-zinc-800 rounded" />
            <div className="h-6 w-16 bg-zinc-800 rounded" />
            <div className="h-6 w-16 bg-zinc-800 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const a = stats.account;

  return (
    <Card className="bg-zinc-900 border-zinc-800/80">
      <CardContent className="py-4">
        <div className="flex items-center gap-2 mb-4">
          <Video className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">TikTok</span>
          <span className="text-[10px] text-zinc-600 ml-auto">
            Updated {stats.lastUpdated}
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-400">Followers</span>
            </div>
            <span className="text-sm font-bold text-white">{a.followers}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-400">Total Views</span>
            </div>
            <span className="text-sm font-bold text-white">
              {a.totalViews.toLocaleString("en-US")}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-400">Total Likes</span>
            </div>
            <span className="text-sm font-bold text-white">{a.totalLikes}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-400">Avg Like Rate</span>
            </div>
            <span className="text-sm font-bold text-emerald-400">
              {a.totalViews > 0
                ? ((a.totalLikes / a.totalViews) * 100).toFixed(1)
                : 0}
              %
            </span>
          </div>

          <div className="border-t border-zinc-800 pt-2">
            {bestFormat && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Best Format</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-amber-400">
                    {bestFormat.format}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    ({bestFormat.likeRate}%)
                  </span>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-zinc-500">Since Launch</span>
              <span className="text-xs font-medium text-zinc-300">
                {a.daysSinceStart} days
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
