"use client";

import { useCallback } from "react";
import { usePolling } from "@/lib/usePolling";
import {
  SystemHealthBanner,
  type WorkflowsPayload,
} from "@/components/command-center/SystemHealthBanner";
import {
  ReelsTimeline,
  type ReelHistoryEntry,
} from "@/components/command-center/ReelsTimeline";
import { QuickActions } from "@/components/command-center/QuickActions";
import {
  CostTicker,
  type CostHistoryEntry,
} from "@/components/command-center/CostTicker";
import { AlertsFeed } from "@/components/command-center/AlertsFeed";
import { Zap } from "lucide-react";

// ---------------------------------------------------------------------------
// Data-fetch transform helpers (stable references via module scope)
// ---------------------------------------------------------------------------

function transformReels(json: unknown): ReelHistoryEntry[] {
  const payload = json as { data?: ReelHistoryEntry[] };
  return Array.isArray(payload?.data) ? payload.data : [];
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
  if (typeof payload === "object" && payload !== null) return payload as Record<string, unknown>;
  return null;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CommandCenter() {
  // 1. Workflow statuses — polls every 30 s
  const {
    data: workflowData,
    loading: wfLoading,
    refetch: refetchWorkflows,
  } = usePolling<WorkflowsPayload>("/api/workflows", 30_000);

  // 2. Today's reels — polls every 60 s
  const { data: reelData, loading: reelLoading } =
    usePolling<ReelHistoryEntry[]>(
      "/api/data/social-distributor/data/reel-history.jsonl",
      60_000
    );

  // 3. Cost history — polls every 5 min
  const { data: costData, loading: costLoading } =
    usePolling<CostHistoryEntry[]>(
      "/api/data/cost-history.jsonl",
      300_000
    );

  // 4. Token data — polls every 5 min (for alerts)
  const { data: tokensRaw, loading: tokensLoading } =
    usePolling<Record<string, unknown> | null>(
      "/api/data/social-distributor/data/tokens.json",
      300_000
    );

  const handleRefreshWorkflows = useCallback(() => {
    refetchWorkflows();
  }, [refetchWorkflows]);

  // Transform polled data safely
  const reelEntries = reelData
    ? Array.isArray(reelData)
      ? reelData
      : transformReels(reelData)
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

  return (
    <div className="p-6 space-y-4 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10 dark:bg-amber-500/10">
          <Zap className="w-4 h-4 text-amber-500" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">
            Command Center
          </h1>
          <p className="text-[12px] text-gray-500 dark:text-zinc-500">
            FlashVoyage operations at a glance
          </p>
        </div>
      </div>

      {/* 1. System Health Banner */}
      <SystemHealthBanner data={workflowData} loading={wfLoading} />

      {/* 2. Today's Reels Timeline */}
      <ReelsTimeline data={reelEntries} loading={reelLoading} />

      {/* 3. Quick Actions Bar */}
      <QuickActions
        workflowData={workflowData}
        onRefreshWorkflows={handleRefreshWorkflows}
      />

      {/* 4. Cost Ticker */}
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
