"use client";

import { useMemo } from "react";
import { usePolling } from "@/lib/usePolling";
import { Sunrise } from "lucide-react";

// Morning Brief components
import { KpiGrowthRow, type KpiData } from "@/components/morning-brief/KpiGrowthRow";
import { TikTokActions, type ReelEntry } from "@/components/morning-brief/TikTokActions";
import { SystemHealthLight } from "@/components/morning-brief/SystemHealthLight";

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

function buildKpiData(
  social: SocialStats | null,
  costEntries: CostHistoryEntry[] | null
): KpiData {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const thisMonthCost = (costEntries || [])
    .filter((e) => e.date >= monthStart)
    .reduce((sum, e) => sum + (e.totalCostUSD || 0), 0);

  return {
    igFollowers: {
      value: social?.instagram?.followerCount ?? social?.instagram?.reelsPublished ?? 0,
      delta7d: 0,
    },
    tiktokViews: {
      value: social?.tiktok?.totalViews ?? 0,
      delta7d: 0,
    },
    ga4Traffic: {
      value: social?.ga4?.sessions7d ?? 0,
      delta7d: 0,
    },
    costMonth: { value: thisMonthCost, delta30d: 0 },
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MorningBrief() {
  // 1. Social stats (IG + GA4 + TikTok combined) — polls every 2 min
  const { data: socialStats, loading: socialLoading } =
    usePolling<SocialStats>("/api/social-stats", 120_000);

  // 2. Workflow statuses — polls every 30s
  const { data: workflowData, loading: wfLoading } =
    usePolling<WorkflowsPayload>("/api/workflows", 30_000);

  // 3. Reel history — polls every 60s
  const { data: reelData, loading: reelLoading } = usePolling<ReelEntry[]>(
    "/api/data/social-distributor/data/reel-history.jsonl",
    60_000
  );

  // 4. Cost history — polls every 5 min
  const { data: costData, loading: costLoading } =
    usePolling<CostHistoryEntry[]>("/api/data/cost-history.jsonl", 300_000);

  // 5. Token data — polls every 5 min
  const { data: tokensRaw, loading: tokensLoading } = usePolling<Record<
    string,
    unknown
  > | null>("/api/data/social-distributor/data/tokens.json", 300_000);

  // Transform data
  const reelEntries = reelData
    ? Array.isArray(reelData)
      ? reelData
      : []
    : null;

  const costEntries = costData
    ? Array.isArray(costData)
      ? costData
      : transformCosts(costData)
    : null;

  const tokensData = tokensRaw
    ? typeof tokensRaw === "object"
      ? tokensRaw
      : transformTokens(tokensRaw)
    : null;

  const kpiData = useMemo(
    () => buildKpiData(socialStats ?? null, costEntries),
    [socialStats, costEntries]
  );

  const today = new Date().toLocaleDateString("fr-FR", {
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

      {/* 1. KPI Growth Row — live from IG + TikTok + GA4 + Costs */}
      <KpiGrowthRow data={kpiData} loading={socialLoading || costLoading} />

      {/* 2. TikTok Actions */}
      <TikTokActions reels={reelEntries} loading={reelLoading} />

      {/* 3. System Health (traffic lights) */}
      <SystemHealthLight data={workflowData} loading={wfLoading} />

      {/* 4. Cost Ticker (compact) */}
      <CostTicker data={costEntries} loading={costLoading} />

      {/* 5. Alerts Feed */}
      <AlertsFeed
        tokensData={tokensData}
        workflowData={workflowData}
        loading={wfLoading || tokensLoading}
      />
    </div>
  );
}
