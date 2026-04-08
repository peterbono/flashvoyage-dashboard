"use client";

import { useMemo } from "react";
import { usePolling } from "@/lib/usePolling";
import { Sunrise } from "lucide-react";

// New Plan A components
import { CrossPlatformMetricCard } from "@/components/growth/CrossPlatformMetricCard";
import { TikTokActions, type ReelEntry } from "@/components/morning-brief/TikTokActions";
import { SystemHealthLight } from "@/components/morning-brief/SystemHealthLight";
import { PostingGoalTracker } from "@/components/morning-brief/PostingGoalTracker";
import { BestTimeRecommender } from "@/components/morning-brief/BestTimeRecommender";

// Existing components
import type { WorkflowsPayload } from "@/components/command-center/SystemHealthBanner";
import { AlertsFeed } from "@/components/command-center/AlertsFeed";
import { CostTicker, type CostHistoryEntry } from "@/components/command-center/CostTicker";

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
  ga4: { sessions7d: number };
  tiktok: { followers: number; totalViews: number; totalLikes: number };
  publications: { platform: string; publishedAt: string }[];
  deltas: { impressions: number; interactions: number; publications: number };
  fetchedAt: string;
}

function transformCosts(json: unknown): CostHistoryEntry[] {
  const payload = json as { data?: CostHistoryEntry[] };
  return Array.isArray(payload?.data) ? payload.data : [];
}

interface TokensJson {
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

function transformTokens(json: unknown): Record<string, unknown> | null {
  const payload = json as TokensJson;
  if (payload?.data && typeof payload.data === "object") return payload.data;
  if (typeof payload === "object" && payload !== null)
    return payload as Record<string, unknown>;
  return null;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MorningBrief() {
  const { data: socialStats, loading: socialLoading } =
    usePolling<SocialStats>("/api/social-stats", 120_000);

  const { data: workflowData, loading: wfLoading } =
    usePolling<WorkflowsPayload>("/api/workflows", 30_000);

  const { data: reelData, loading: reelLoading } = usePolling<ReelEntry[]>(
    "/api/data/social-distributor/data/reel-history.jsonl",
    60_000
  );

  const { data: costData, loading: costLoading } =
    usePolling<CostHistoryEntry[]>("/api/data/cost-history.jsonl", 300_000);

  const { data: tokensRaw, loading: tokensLoading } = usePolling<Record<
    string,
    unknown
  > | null>("/api/data/social-distributor/data/tokens.json", 300_000);

  // Transform
  const reelEntries = reelData ? (Array.isArray(reelData) ? reelData : []) : null;
  const costEntries = costData
    ? Array.isArray(costData) ? costData : transformCosts(costData)
    : null;
  const tokensData = tokensRaw
    ? typeof tokensRaw === "object" ? tokensRaw : transformTokens(tokensRaw)
    : null;

  // Cross-platform metrics for unified cards
  const impressions = useMemo(() => {
    if (!socialStats) return null;
    const ig = socialStats.instagram?.totalLikes ?? 0;
    const fb = socialStats.facebook?.totalReach ?? 0;
    const tk = socialStats.tiktok?.totalViews ?? 0;
    return { ig, fb, tk, total: ig + fb + tk };
  }, [socialStats]);

  const interactions = useMemo(() => {
    if (!socialStats) return null;
    const ig = (socialStats.instagram?.totalLikes ?? 0) + (socialStats.instagram?.totalComments ?? 0);
    const fb = socialStats.facebook?.totalReach ?? 0;
    const tk = socialStats.tiktok?.totalLikes ?? 0;
    return { ig, fb, tk, total: ig + fb + tk };
  }, [socialStats]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="p-4 md:p-6 space-y-4 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10">
          <Sunrise className="w-4 h-4 text-amber-500" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">
            Morning Brief
          </h1>
          <p className="text-[12px] text-gray-500 dark:text-zinc-500 capitalize">
            {today}
          </p>
        </div>
      </div>

      {/* 1. Unified Cross-Platform KPIs (Metricool-style) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <CrossPlatformMetricCard
          label="Impressions"
          icon={Sunrise}
          total={impressions?.total ?? 0}
          breakdowns={[
            { platform: "facebook", value: impressions?.fb ?? 0 },
            { platform: "tiktok", value: impressions?.tk ?? 0 },
            { platform: "instagram", value: impressions?.ig ?? 0 },
          ]}
          delta={socialStats?.deltas ? { value: socialStats.deltas.impressions, period: "30d" } : undefined}
          loading={socialLoading}
        />
        <CrossPlatformMetricCard
          label="Interactions"
          icon={Sunrise}
          total={interactions?.total ?? 0}
          breakdowns={[
            { platform: "tiktok", value: interactions?.tk ?? 0 },
            { platform: "facebook", value: interactions?.fb ?? 0 },
            { platform: "instagram", value: interactions?.ig ?? 0 },
          ]}
          delta={socialStats?.deltas ? { value: socialStats.deltas.interactions, period: "30d" } : undefined}
          loading={socialLoading}
        />
      </div>

      {/* 2. Posting Goals + Best Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <PostingGoalTracker
          todayPublications={(socialStats?.publications ?? [])
            .filter((p) => p.publishedAt?.slice(0, 10) === new Date().toISOString().slice(0, 10))
            .map((p) => ({ platform: p.platform }))}
        />
        <BestTimeRecommender variant="compact" />
      </div>

      {/* 3. System Health */}
      <SystemHealthLight data={workflowData} loading={wfLoading} />

      {/* 4. Cost Ticker */}
      <CostTicker data={costEntries} loading={costLoading} />

      {/* 5. Alerts */}
      <AlertsFeed
        tokensData={tokensData}
        workflowData={workflowData}
        loading={wfLoading || tokensLoading}
      />
    </div>
  );
}
