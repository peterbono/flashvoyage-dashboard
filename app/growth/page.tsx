"use client";

import { useMemo } from "react";
import { usePolling } from "@/lib/usePolling";
import { TrendingUp } from "lucide-react";
import { FormatPerformanceChart } from "@/components/growth/FormatPerformanceChart";
import { AudienceGeoChart } from "@/components/growth/AudienceGeoChart";
import { ReelsActivityChart } from "@/components/growth/ReelsActivityChart";
import { TikTokGrowthCard } from "@/components/growth/TikTokGrowthCard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PerformanceWeights {
  formatScores: Record<string, number>;
  killedFormats: string[];
  recommendations: string[];
}

interface AudienceSegments {
  byCountry: { country: string; sessions: number; percentage: number }[];
  byDevice: { device: string; sessions: number; percentage: number }[];
  byChannel: { channel: string; sessions: number; percentage: number }[];
}

interface ReelHistoryEntry {
  date: string;
  format: string;
  permalink?: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GrowthPage() {
  const { data: perfData, loading: perfLoading } =
    usePolling<PerformanceWeights>(
      "/api/data/social-distributor/reels/data/performance-weights.json",
      300_000
    );

  const { data: audienceData, loading: audienceLoading } =
    usePolling<AudienceSegments>(
      "/api/data/social-distributor/data/audience-segments.json",
      300_000
    );

  const { data: reelData, loading: reelLoading } = usePolling<
    ReelHistoryEntry[]
  >(
    "/api/data/social-distributor/data/reel-history.jsonl",
    60_000
  );

  // Unwrap API response shape
  const perfWeights = useMemo(() => {
    if (!perfData) return null;
    const d = perfData as unknown as { data?: PerformanceWeights };
    return d?.data ?? (perfData as PerformanceWeights);
  }, [perfData]);

  const audience = useMemo(() => {
    if (!audienceData) return null;
    const d = audienceData as unknown as { data?: AudienceSegments };
    return d?.data ?? (audienceData as AudienceSegments);
  }, [audienceData]);

  const reels = useMemo(() => {
    if (!reelData) return null;
    const d = reelData as unknown as { data?: ReelHistoryEntry[] };
    return Array.isArray(d) ? d : d?.data ?? [];
  }, [reelData]);

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
            Performance par format et audience
          </p>
        </div>
      </div>

      {/* Row 1: Format Performance + TikTok */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <FormatPerformanceChart data={perfWeights} loading={perfLoading} />
        </div>
        <TikTokGrowthCard />
      </div>

      {/* Row 2: Audience Geo + Reels Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AudienceGeoChart data={audience} loading={audienceLoading} />
        <ReelsActivityChart data={reels} loading={reelLoading} />
      </div>
    </div>
  );
}
