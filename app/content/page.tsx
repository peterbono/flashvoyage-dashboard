"use client";

import { useState, useMemo, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { usePolling } from "@/lib/usePolling";
import {
  Lightbulb,
  BarChart3,
  Bot,
  Wifi,
} from "lucide-react";

// Tab 1 components
import { ArticleInjectorForm } from "@/components/content/ArticleInjectorForm";
import { ROIQueueTable, type ROIQueueItem } from "@/components/content/ROIQueueTable";
import { ContentGapsList, type ContentGap } from "@/components/content/ContentGapsList";
import { SeasonalAlerts, type SeasonalItem } from "@/components/content/SeasonalAlerts";

// Tab 2 components
import { ArticleScoreTable, type ArticleScore } from "@/components/content/ArticleScoreTable";
import { LifecycleDonut } from "@/components/content/LifecycleDonut";
import { CompetitorMoves, type CompetitorArticle } from "@/components/content/CompetitorMoves";

// Tab 3 component
import { AutoExecutorLog, type ExecutorLogEntry } from "@/components/content/AutoExecutorLog";

// --- Data shapes from API responses ---
interface ApiResponse<T> {
  data: T;
  path: string;
  fetchedAt: string;
}

// Polling interval: 2 minutes
const POLL_INTERVAL = 120_000;

export default function ContentPage() {
  const [activeTab, setActiveTab] = useState("quoi-ecrire");
  const [queueRefreshKey, setQueueRefreshKey] = useState(0);

  // -----------------------------------------------------------------------
  // Tab 1: "Quoi ecrire" data
  // -----------------------------------------------------------------------
  const roiQueue = usePolling<ApiResponse<ROIQueueItem[]>>(
    `/api/data/roi-optimized-queue.json?r=${queueRefreshKey}`,
    POLL_INTERVAL
  );
  const contentGaps = usePolling<ApiResponse<ContentGap[]>>(
    "/api/data/content-gaps.json",
    POLL_INTERVAL
  );
  const seasonalForecast = usePolling<ApiResponse<SeasonalItem[]>>(
    "/api/data/seasonal-forecast.json",
    POLL_INTERVAL
  );

  // -----------------------------------------------------------------------
  // Tab 2: "Portfolio" data
  // -----------------------------------------------------------------------
  const articleScores = usePolling<ApiResponse<ArticleScore[]>>(
    "/api/data/article-scores.json",
    POLL_INTERVAL,
    activeTab === "portfolio" || activeTab === "quoi-ecrire"
  );
  const lifecycleStates = usePolling<ApiResponse<Record<string, number>>>(
    "/api/data/lifecycle-states.json",
    POLL_INTERVAL,
    activeTab === "portfolio"
  );
  const competitorReport = usePolling<ApiResponse<CompetitorArticle[]>>(
    "/api/data/competitor-report.json",
    POLL_INTERVAL,
    activeTab === "portfolio"
  );

  // -----------------------------------------------------------------------
  // Tab 3: "Auto-Executor" data
  // -----------------------------------------------------------------------
  const executorLog = usePolling<ApiResponse<ExecutorLogEntry[]>>(
    "/api/data/auto-executor-log.json",
    POLL_INTERVAL,
    activeTab === "auto-executor"
  );

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------
  const handleQueueSubmitted = useCallback(() => {
    setQueueRefreshKey((k) => k + 1);
    roiQueue.refetch();
  }, [roiQueue]);

  const handleApproveAll = useCallback(async () => {
    try {
      await fetch("/api/workflows/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow: "content-refresh.yml",
          inputs: { mode: "apply" },
        }),
      });
      executorLog.refetch();
    } catch {
      // non-blocking
    }
  }, [executorLog]);

  const handleApproveSingle = useCallback(
    async (id: string) => {
      try {
        await fetch("/api/workflows/dispatch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workflow: "content-refresh.yml",
            inputs: { mode: "apply", entryId: id },
          }),
        });
        executorLog.refetch();
      } catch {
        // non-blocking
      }
    },
    [executorLog]
  );

  // ── Extract arrays from wrapped API responses ──
  // API returns {data: {timestamp, queue: [...]}} — we need the inner array
  const unwrap = <T,>(raw: unknown, ...keys: string[]): T[] => {
    if (!raw || typeof raw !== 'object') return [];
    const obj = raw as Record<string, unknown>;
    for (const key of keys) {
      const val = obj[key];
      if (Array.isArray(val)) return val as T[];
    }
    // Maybe it's already an array
    if (Array.isArray(raw)) return raw as T[];
    return [];
  };

  const roiItems = useMemo(() => unwrap<ROIQueueItem>(roiQueue.data?.data, 'queue', 'items'), [roiQueue.data]);
  const gapItems = useMemo(() => unwrap<ContentGap>(contentGaps.data?.data, 'gaps', 'items'), [contentGaps.data]);
  const seasonalItems = useMemo(() => unwrap<SeasonalItem>(seasonalForecast.data?.data, 'forecasts', 'destinations', 'items'), [seasonalForecast.data]);
  const scoreItems = useMemo(() => unwrap<ArticleScore>(articleScores.data?.data, 'scores', 'articles', 'items'), [articleScores.data]);
  const competitorItems = useMemo(() => unwrap<CompetitorArticle>(competitorReport.data?.data, 'newArticles', 'articles', 'items'), [competitorReport.data]);
  const executorItems = useMemo(() => unwrap<ExecutorLogEntry>(executorLog.data?.data, 'entries', 'log', 'items'), [executorLog.data]);

  // Compute lifecycle distribution from article scores as fallback
  const lifecycleData = useMemo(() => {
    const raw = lifecycleStates.data?.data;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const obj = raw as Record<string, unknown>;
      if (obj.stateCounts && typeof obj.stateCounts === 'object') return obj.stateCounts as Record<string, number>;
      // Try to use it directly if it looks like {NEW: 5, GROWING: 3, ...}
      const keys = Object.keys(obj);
      if (keys.some(k => ['NEW', 'GROWING', 'PEAK', 'DECLINING', 'EVERGREEN', 'DEAD'].includes(k))) return obj as Record<string, number>;
    }
    if (scoreItems.length === 0) return {};
    const dist: Record<string, number> = {};
    for (const a of scoreItems) {
      const lc = (a as unknown as Record<string, unknown>).lifecycle as string || 'UNKNOWN';
      dist[lc] = (dist[lc] || 0) + 1;
    }
    return dist;
  }, [lifecycleStates.data, scoreItems]);

  // Count articles with intelligence data
  const articlesCount = scoreItems.length;
  const hasIntelligenceData =
    !roiQueue.error || !contentGaps.error || !articleScores.error;

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b border-zinc-800/80 shrink-0 flex-wrap gap-y-2">
        <h1 className="text-sm font-semibold text-white tracking-tight mr-1">
          Content Intelligence
        </h1>
        {articlesCount > 0 && (
          <Badge
            variant="outline"
            className="border-emerald-800/60 bg-emerald-950/30 text-emerald-400 gap-1 text-xs"
          >
            <Wifi className="w-2.5 h-2.5" />
            {articlesCount} articles
          </Badge>
        )}
        {!hasIntelligenceData && (
          <Badge
            variant="outline"
            className="border-zinc-800 text-zinc-600 text-xs"
          >
            En attente des donnees intelligence
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as string)}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <div className="px-3 sm:px-4 pt-3 shrink-0 overflow-x-auto">
          <TabsList variant="line" className="gap-0">
            <TabsTrigger
              value="quoi-ecrire"
              className="text-xs gap-1 sm:gap-1.5 px-2 sm:px-3 data-active:text-amber-400"
            >
              <Lightbulb className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Quoi ecrire</span>
              <span className="sm:hidden">Ecrire</span>
            </TabsTrigger>
            <TabsTrigger
              value="portfolio"
              className="text-xs gap-1 sm:gap-1.5 px-2 sm:px-3 data-active:text-emerald-400"
            >
              <BarChart3 className="w-3.5 h-3.5 shrink-0" />
              Portfolio
            </TabsTrigger>
            <TabsTrigger
              value="auto-executor"
              className="text-xs gap-1 sm:gap-1.5 px-2 sm:px-3 data-active:text-violet-400"
            >
              <Bot className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Auto-Executor</span>
              <span className="sm:hidden">Auto</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ================================================================ */}
        {/* TAB 1: Quoi ecrire                                               */}
        {/* ================================================================ */}
        <TabsContent
          value="quoi-ecrire"
          className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 space-y-4"
        >
          {/* Article injector form */}
          <ArticleInjectorForm onSubmitted={handleQueueSubmitted} />

          {/* ROI Queue */}
          <ROIQueueTable
            items={roiItems}
            loading={roiQueue.loading}
            error={roiQueue.error}
          />

          {/* Content Gaps + Seasonal side by side on large screens */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ContentGapsList
              items={gapItems}
              loading={contentGaps.loading}
              error={contentGaps.error}
            />
            <SeasonalAlerts
              items={seasonalItems}
              loading={seasonalForecast.loading}
              error={seasonalForecast.error}
            />
          </div>
        </TabsContent>

        {/* ================================================================ */}
        {/* TAB 2: Portfolio                                                  */}
        {/* ================================================================ */}
        <TabsContent
          value="portfolio"
          className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 space-y-4"
        >
          {/* Lifecycle donut + Competitor moves side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LifecycleDonut data={lifecycleData} />
            <CompetitorMoves
              items={competitorItems}
              loading={competitorReport.loading}
              error={competitorReport.error}
            />
          </div>

          {/* Article score table (full width) */}
          <ArticleScoreTable
            articles={scoreItems}
            loading={articleScores.loading}
            error={articleScores.error}
          />
        </TabsContent>

        {/* ================================================================ */}
        {/* TAB 3: Auto-Executor                                              */}
        {/* ================================================================ */}
        <TabsContent
          value="auto-executor"
          className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4"
        >
          <AutoExecutorLog
            entries={executorItems}
            loading={executorLog.loading}
            error={executorLog.error}
            onApproveAll={handleApproveAll}
            onApprove={handleApproveSingle}
            onReject={(id) => {
              // Rejection is a local removal; in production this would
              // call an API to mark the entry as rejected.
              console.log("Rejected:", id);
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
