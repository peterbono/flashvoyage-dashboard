"use client";

import { useMemo, useState } from "react";
import { usePolling } from "@/lib/usePolling";
import { TrendingUp, Eye, Heart, FileText } from "lucide-react";

// Plan A components
import { CrossPlatformMetricCard } from "@/components/growth/CrossPlatformMetricCard";
import { DateRangeSelector, type DateRange } from "@/components/ui/date-range-selector";
import { PublicationTable, type Publication } from "@/components/growth/PublicationTable";
import { FormatPerformanceChart } from "@/components/growth/FormatPerformanceChart";
import { AudienceGeoChart } from "@/components/growth/AudienceGeoChart";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SocialStats {
  instagram: {
    reelsPublished: number;
    totalLikes: number;
    totalComments: number;
    followerCount: number | null;
  };
  facebook: {
    pageLikes: number | null;
    pageFollowers: number | null;
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
  publications: Publication[];
  fetchedAt: string;
}

interface PerformanceWeights {
  formatScores: Record<string, number>;
  killedFormats: string[];
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GrowthPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date(),
    preset: "30d",
  });

  const { data: socialStats, loading: socialLoading } =
    usePolling<SocialStats>("/api/social-stats", 120_000);

  const { data: perfData, loading: perfLoading } =
    usePolling<PerformanceWeights>(
      "/api/data/social-distributor/reels/data/performance-weights.json",
      300_000
    );

  // Unwrap API responses
  const perfWeights = useMemo(() => {
    if (!perfData) return null;
    const d = perfData as unknown as { data?: PerformanceWeights };
    return d?.data ?? (perfData as PerformanceWeights);
  }, [perfData]);

  const audienceForGeo = useMemo(() => {
    if (!socialStats?.ga4?.topCountries) return null;
    return { byCountry: socialStats.ga4.topCountries };
  }, [socialStats]);

  const publications = socialStats?.publications ?? [];

  // Cross-platform aggregations
  const impressions = useMemo(() => {
    if (!socialStats) return { total: 0, ig: 0, fb: 0, tk: 0 };
    const ig = socialStats.instagram?.totalLikes ?? 0;
    const fb = socialStats.facebook?.totalReach ?? 0;
    const tk = socialStats.tiktok?.totalViews ?? 0;
    return { ig, fb, tk, total: ig + fb + tk };
  }, [socialStats]);

  const interactions = useMemo(() => {
    if (!socialStats) return { total: 0, ig: 0, fb: 0, tk: 0 };
    const ig = (socialStats.instagram?.totalLikes ?? 0) + (socialStats.instagram?.totalComments ?? 0);
    const fb = socialStats.facebook?.totalReach ?? 0;
    const tk = socialStats.tiktok?.totalLikes ?? 0;
    return { ig, fb, tk, total: ig + fb + tk };
  }, [socialStats]);

  const followers = useMemo(() => {
    if (!socialStats) return { total: 0, ig: 0, fb: 0, tk: 0 };
    const ig = socialStats.instagram?.followerCount ?? 0;
    const fb = socialStats.facebook?.pageFollowers ?? 0;
    const tk = socialStats.tiktok?.followers ?? 0;
    return { ig, fb, tk, total: ig + fb + tk };
  }, [socialStats]);

  return (
    <div className="p-4 md:p-6 space-y-4 w-full max-w-7xl mx-auto">
      {/* Header + Date Range */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10">
          <TrendingUp className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">
            Growth
          </h1>
          <p className="text-[12px] text-gray-500 dark:text-zinc-500">
            Cross-platform performance
          </p>
        </div>
        <DateRangeSelector value={dateRange} onChange={setDateRange} />
      </div>

      {/* Row 1: Unified Cross-Platform KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <CrossPlatformMetricCard
          label="Impressions"
          icon={Eye}
          total={impressions.total}
          breakdowns={[
            { platform: "facebook", value: impressions.fb },
            { platform: "tiktok", value: impressions.tk },
            { platform: "instagram", value: impressions.ig },
          ]}
          loading={socialLoading}
        />
        <CrossPlatformMetricCard
          label="Interactions"
          icon={Heart}
          total={interactions.total}
          breakdowns={[
            { platform: "tiktok", value: interactions.tk },
            { platform: "facebook", value: interactions.fb },
            { platform: "instagram", value: interactions.ig },
          ]}
          loading={socialLoading}
        />
        <CrossPlatformMetricCard
          label="Followers"
          icon={TrendingUp}
          total={followers.total}
          breakdowns={[
            { platform: "facebook", value: followers.fb },
            { platform: "tiktok", value: followers.tk },
            { platform: "instagram", value: followers.ig },
          ]}
          loading={socialLoading}
        />
      </div>

      {/* Row 2: Publication Table (unified cross-platform) */}
      <PublicationTable publications={publications} loading={socialLoading} />

      {/* Row 3: Format Performance + Audience Geo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FormatPerformanceChart data={perfWeights} loading={perfLoading} />
        <AudienceGeoChart data={audienceForGeo} loading={socialLoading} />
      </div>
    </div>
  );
}
