"use client";

import { useMemo } from "react";
import { usePolling } from "@/lib/usePolling";
import { TrendingUp } from "lucide-react";
import { FormatPerformanceChart } from "@/components/growth/FormatPerformanceChart";
import { AudienceGeoChart } from "@/components/growth/AudienceGeoChart";
import { ReelsActivityChart } from "@/components/growth/ReelsActivityChart";
import { TikTokGrowthCard } from "@/components/growth/TikTokGrowthCard";
import { IGReelsCard } from "@/components/growth/IGReelsCard";
import { FacebookCard } from "@/components/growth/FacebookCard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PerformanceWeights {
  formatScores: Record<string, number>;
  killedFormats: string[];
  recommendations: string[];
}

interface ReelHistoryEntry {
  date: string;
  format: string;
  permalink?: string;
}

interface SocialStats {
  instagram: {
    reelsPublished: number;
    recentReels: { id: string; likes: number; comments: number; date: string; caption?: string }[];
    totalLikes: number;
    totalComments: number;
    followerCount: number | null;
  };
  facebook: {
    pageLikes: number | null;
    pageFollowers: number | null;
    recentPosts: { id: string; message?: string; likes: number; comments: number; shares: number; date: string }[];
    totalReach: number;
  };
  ga4: {
    sessions7d: number;
    topCountries: { country: string; sessions: number }[];
  };
  tiktok: {
    followers: number;
    totalViews: number;
    totalLikes: number;
    videosPosted: number;
  };
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GrowthPage() {
  // Live social stats (IG + GA4 + TikTok)
  const { data: socialStats, loading: socialLoading } =
    usePolling<SocialStats>("/api/social-stats", 120_000);

  // Format performance weights
  const { data: perfData, loading: perfLoading } =
    usePolling<PerformanceWeights>(
      "/api/data/social-distributor/reels/data/performance-weights.json",
      300_000
    );

  // Reel history for activity chart
  const { data: reelData, loading: reelLoading } = usePolling<
    ReelHistoryEntry[]
  >(
    "/api/data/social-distributor/data/reel-history.jsonl",
    60_000
  );

  // Unwrap API responses
  const perfWeights = useMemo(() => {
    if (!perfData) return null;
    const d = perfData as unknown as { data?: PerformanceWeights };
    return d?.data ?? (perfData as PerformanceWeights);
  }, [perfData]);

  const reels = useMemo(() => {
    if (!reelData) return null;
    const d = reelData as unknown as { data?: ReelHistoryEntry[] };
    return Array.isArray(d) ? d : d?.data ?? [];
  }, [reelData]);

  const audienceForGeo = useMemo(() => {
    if (!socialStats?.ga4?.topCountries) return null;
    return { byCountry: socialStats.ga4.topCountries };
  }, [socialStats]);

  return (
    <div className="p-4 md:p-6 space-y-4 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10">
          <TrendingUp className="w-4 h-4 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">
            Growth
          </h1>
          <p className="text-[12px] text-gray-500 dark:text-zinc-500">
            Cross-platform performance — IG, TikTok, Web
          </p>
        </div>
      </div>

      {/* Row 1: Platform cards — IG + FB + TikTok */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <IGReelsCard data={socialStats?.instagram ?? null} loading={socialLoading} />
        <FacebookCard data={socialStats?.facebook ?? null} loading={socialLoading} />
        <TikTokGrowthCard />
      </div>

      {/* Row 2: Format Performance (full width) */}
      <FormatPerformanceChart data={perfWeights} loading={perfLoading} />

      {/* Row 2: Audience Geo + Reels Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AudienceGeoChart data={audienceForGeo} loading={socialLoading} />
        <ReelsActivityChart data={reels} loading={reelLoading} />
      </div>
    </div>
  );
}
