"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Facebook, Users, Heart, Share2, MessageCircle, Eye } from "lucide-react";

interface FBPost {
  id: string;
  message?: string;
  likes: number;
  comments: number;
  shares: number;
  date: string;
}

interface Props {
  data: {
    pageLikes: number | null;
    pageFollowers: number | null;
    recentPosts: FBPost[];
    totalReach: number;
    totalImpressions: number;
  } | null;
  loading: boolean;
}

export function FacebookCard({ data, loading }: Props) {
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

  return (
    <Card className="bg-zinc-900 border-zinc-800/80">
      <CardContent className="py-4">
        <div className="flex items-center gap-2 mb-4">
          <Facebook className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-white">Facebook</span>
          <Badge variant="outline" className="ml-auto text-[10px] bg-zinc-800 border-zinc-700 text-zinc-400">
            Live
          </Badge>
        </div>

        <div className="space-y-3">
          {data.pageFollowers !== null && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-xs text-zinc-400">Followers</span>
              </div>
              <span className="text-sm font-bold text-white">
                {data.pageFollowers.toLocaleString("en-US")}
              </span>
            </div>
          )}

          {data.pageLikes !== null && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-xs text-zinc-400">Page Likes</span>
              </div>
              <span className="text-sm font-bold text-white">
                {data.pageLikes.toLocaleString("en-US")}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-400">Impressions (30d)</span>
            </div>
            <span className="text-sm font-bold text-emerald-400">
              {data.totalImpressions.toLocaleString("en-US")}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Share2 className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-400">Post Reach (10 posts)</span>
            </div>
            <span className="text-sm font-bold text-white">
              {data.totalReach.toLocaleString("en-US")}
            </span>
          </div>

          {/* Recent posts */}
          {data.recentPosts.length > 0 && (
            <div className="border-t border-zinc-800 pt-2 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Recent Posts</span>
              {data.recentPosts.slice(0, 4).map((post) => (
                <div key={post.id} className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400 truncate max-w-[140px]">
                    {post.message || "Post"}
                  </span>
                  <span className="text-zinc-500 tabular-nums flex items-center gap-1.5">
                    <span>{post.likes}♥</span>
                    <span>{post.shares}↗</span>
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
