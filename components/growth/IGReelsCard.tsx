"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Instagram, Heart, MessageCircle, Users } from "lucide-react";

interface IGReel {
  id: string;
  likes: number;
  comments: number;
  date: string;
  caption?: string;
}

interface Props {
  data: {
    reelsPublished: number;
    recentReels: IGReel[];
    totalLikes: number;
    totalComments: number;
    followerCount: number | null;
  } | null;
  loading: boolean;
}

export function IGReelsCard({ data, loading }: Props) {
  if (loading || !data) {
    return (
      <Card className="bg-zinc-900 border-zinc-800/80">
        <CardContent className="py-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-24 bg-zinc-700 rounded" />
            <div className="h-20 bg-zinc-800 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const avgLikes = data.reelsPublished > 0
    ? Math.round(data.totalLikes / data.reelsPublished)
    : 0;

  return (
    <Card className="bg-zinc-900 border-zinc-800/80">
      <CardContent className="py-4">
        <div className="flex items-center gap-2 mb-4">
          <Instagram className="w-4 h-4 text-pink-500" />
          <span className="text-sm font-semibold text-white">Instagram</span>
          <Badge variant="outline" className="ml-auto text-[10px] bg-zinc-800 border-zinc-700 text-zinc-400">
            Live
          </Badge>
        </div>

        <div className="space-y-3">
          {data.followerCount !== null && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-xs text-zinc-400">Followers</span>
              </div>
              <span className="text-sm font-bold text-white">
                {data.followerCount.toLocaleString("fr-FR")}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Instagram className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-400">Reels Published</span>
            </div>
            <span className="text-sm font-bold text-white">{data.reelsPublished}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-400">Total Likes</span>
            </div>
            <span className="text-sm font-bold text-white">{data.totalLikes}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-400">Avg Likes/Reel</span>
            </div>
            <span className="text-sm font-bold text-emerald-400">{avgLikes}</span>
          </div>

          {/* Recent reels mini-list */}
          {data.recentReels.length > 0 && (
            <div className="border-t border-zinc-800 pt-2 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Recent</span>
              {data.recentReels.slice(0, 4).map((reel) => (
                <div key={reel.id} className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400 truncate max-w-[140px]">
                    {reel.caption || reel.id.slice(-6)}
                  </span>
                  <span className="text-zinc-500 tabular-nums">
                    {reel.likes}♥ {reel.comments}💬
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
