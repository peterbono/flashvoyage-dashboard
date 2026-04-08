"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Video, TrendingUp, Users, Eye, Heart } from "lucide-react";

// Hardcoded TikTok data until API is available
const TIKTOK_STATS = {
  followers: 8,
  totalViews: 4539,
  totalLikes: 127,
  avgLikeRate: 2.8,
  bestFormat: "Trip Pick",
  bestLikeRate: 5.5,
  daysSinceStart: 5,
  videosPosted: 17,
};

export function TikTokGrowthCard() {
  return (
    <Card className="bg-zinc-900 border-zinc-800/80">
      <CardContent className="py-4">
        <div className="flex items-center gap-2 mb-4">
          <Video className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">
            TikTok
          </span>
          <span className="text-[10px] text-zinc-600 ml-auto">
            {TIKTOK_STATS.daysSinceStart}j depuis lancement
          </span>
        </div>

        <div className="space-y-3">
          {/* Followers */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-400">Followers</span>
            </div>
            <span className="text-sm font-bold text-white">
              {TIKTOK_STATS.followers}
            </span>
          </div>

          {/* Views */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-400">Total Views</span>
            </div>
            <span className="text-sm font-bold text-white">
              {TIKTOK_STATS.totalViews.toLocaleString("fr-FR")}
            </span>
          </div>

          {/* Likes */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-400">Total Likes</span>
            </div>
            <span className="text-sm font-bold text-white">
              {TIKTOK_STATS.totalLikes}
            </span>
          </div>

          {/* Avg like rate */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-400">Avg Like Rate</span>
            </div>
            <span className="text-sm font-bold text-emerald-400">
              {TIKTOK_STATS.avgLikeRate}%
            </span>
          </div>

          {/* Separator */}
          <div className="border-t border-zinc-800 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Best Format</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-amber-400">
                  {TIKTOK_STATS.bestFormat}
                </span>
                <span className="text-[10px] text-zinc-500">
                  ({TIKTOK_STATS.bestLikeRate}%)
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-zinc-500">Videos Posted</span>
              <span className="text-xs font-medium text-zinc-300">
                {TIKTOK_STATS.videosPosted}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
