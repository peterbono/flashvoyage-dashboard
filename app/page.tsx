"use client";

import { useMemo, useState, useCallback } from "react";
import { usePolling } from "@/lib/usePolling";
import { Sunrise, Eye, Heart, Users, FileText, Instagram, Facebook, Video, Globe } from "lucide-react";

// Components
import { CrossPlatformMetricCard } from "@/components/growth/CrossPlatformMetricCard";
import { DateRangeSelector, type DateRange } from "@/components/ui/date-range-selector";
import { PublicationTable, type Publication } from "@/components/growth/PublicationTable";
import { SystemHealthLight } from "@/components/morning-brief/SystemHealthLight";
import { PostingGoalTracker } from "@/components/morning-brief/PostingGoalTracker";
import { BestTimeRecommender } from "@/components/morning-brief/BestTimeRecommender";
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
  publications: Publication[];
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
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date(),
    preset: "30d",
  });

  type PlatformFilter = "all" | "instagram" | "facebook" | "tiktok";
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");

  const { data: socialStats, loading: socialLoading } =
    usePolling<SocialStats>(`/api/social-stats?period=${dateRange.preset}`, 120_000);

  const { data: workflowData, loading: wfLoading } =
    usePolling<WorkflowsPayload>("/api/workflows", 30_000);

  const { data: costData, loading: costLoading } =
    usePolling<CostHistoryEntry[]>("/api/data/cost-history.jsonl", 300_000);

  const { data: tokensRaw, loading: tokensLoading } = usePolling<Record<
    string,
    unknown
  > | null>("/api/data/social-distributor/data/tokens.json", 300_000);

  // Transform
  const costEntries = costData
    ? Array.isArray(costData) ? costData : transformCosts(costData)
    : null;
  const tokensData = tokensRaw
    ? typeof tokensRaw === "object" ? tokensRaw : transformTokens(tokensRaw)
    : null;

  // Cross-platform aggregations
  const followers = useMemo(() => {
    if (!socialStats) return { total: 0, ig: 0, fb: 0, tk: 0 };
    const ig = socialStats.instagram?.followerCount ?? 0;
    const fb = socialStats.facebook?.pageFollowers ?? 0;
    const tk = socialStats.tiktok?.followers ?? 0;
    return { ig, fb, tk, total: ig + fb + tk };
  }, [socialStats]);

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

  const pubCounts = useMemo(() => {
    const pubs = socialStats?.publications ?? [];
    const ig = pubs.filter((p) => p.platform === "instagram").length;
    const fb = pubs.filter((p) => p.platform === "facebook").length;
    const tk = pubs.filter((p) => p.platform === "tiktok").length;
    return { ig, fb, tk, total: pubs.length };
  }, [socialStats]);

  const allPublications = socialStats?.publications ?? [];
  const publications = platformFilter === "all"
    ? allPublications
    : allPublications.filter((p) => p.platform === platformFilter);
  const deltas = socialStats?.deltas;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="p-4 md:p-6 space-y-4 w-full max-w-7xl mx-auto">
      {/* Header + Date Range */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10">
          <Sunrise className="w-4 h-4 text-amber-500" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">
            Morning Brief
          </h1>
          <p className="text-[12px] text-gray-500 dark:text-zinc-500 capitalize">
            {today}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Platform filter */}
          <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-0.5 border border-zinc-800/80">
            {([
              { key: "all" as PlatformFilter, label: "All", icon: Globe },
              { key: "instagram" as PlatformFilter, label: "IG", icon: Instagram },
              { key: "facebook" as PlatformFilter, label: "FB", icon: Facebook },
              { key: "tiktok" as PlatformFilter, label: "TT", icon: Video },
            ]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setPlatformFilter(key)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                  platformFilter === key
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>
          <DateRangeSelector value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* ── ACCOUNT ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <CrossPlatformMetricCard
          label="Followers"
          icon={Users}
          total={followers.total}
          breakdowns={[
            { platform: "facebook", value: followers.fb },
            { platform: "tiktok", value: followers.tk },
            { platform: "instagram", value: followers.ig },
          ]}
          loading={socialLoading}
        />
        <CrossPlatformMetricCard
          label="Impressions"
          icon={Eye}
          total={impressions.total}
          breakdowns={[
            { platform: "facebook", value: impressions.fb },
            { platform: "tiktok", value: impressions.tk },
            { platform: "instagram", value: impressions.ig },
          ]}
          delta={deltas ? { value: deltas.impressions, period: dateRange.preset } : undefined}
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
          delta={deltas ? { value: deltas.interactions, period: dateRange.preset } : undefined}
          loading={socialLoading}
        />
        <CrossPlatformMetricCard
          label="Publications"
          icon={FileText}
          total={pubCounts.total}
          breakdowns={[
            { platform: "instagram", value: pubCounts.ig },
            { platform: "facebook", value: pubCounts.fb },
            { platform: "tiktok", value: pubCounts.tk },
          ]}
          delta={deltas ? { value: deltas.publications, period: dateRange.preset } : undefined}
          loading={socialLoading}
        />
      </div>

      {/* ── PUBLICATIONS TABLE ──────────────────────────────────── */}
      <PublicationTable publications={publications} loading={socialLoading} />

      {/* ── INTELLIGENCE ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <PostingGoalTracker
          todayPublications={(publications)
            .filter((p) => p.publishedAt?.slice(0, 10) === new Date().toISOString().slice(0, 10))
            .map((p) => ({ platform: p.platform }))}
        />
        <BestTimeRecommender variant="compact" />
      </div>

      {/* ── SYSTEM ──────────────────────────────────────────────── */}
      <SystemHealthLight data={workflowData} loading={wfLoading} />
      <CostTicker data={costEntries} loading={costLoading} />
      <AlertsFeed
        tokensData={tokensData}
        workflowData={workflowData}
        loading={wfLoading || tokensLoading}
      />
    </div>
  );
}
