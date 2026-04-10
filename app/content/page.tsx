"use client";

import { useState, useMemo, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { usePolling } from "@/lib/usePolling";
import { DateRangeSelector, type DateRange } from "@/components/ui/date-range-selector";
import { CsvExportButton } from "@/components/ui/csv-export-button";
import {
  Lightbulb,
  BarChart3,
  Wifi,
  RefreshCw,
  Zap,
} from "lucide-react";

// Tab 1 components
import { ArticleInjectorForm } from "@/components/content/ArticleInjectorForm";
import { ROIQueueTable, type ROIQueueItem } from "@/components/content/ROIQueueTable";
import { ContentGapsList, type ContentGap } from "@/components/content/ContentGapsList";
import { SeasonalAlerts, type SeasonalItem } from "@/components/content/SeasonalAlerts";

// Tab 2 components
import { ArticleScoreTable, type ArticleScore } from "@/components/content/ArticleScoreTable";
import { ContentKpiRow, type ContentKpis } from "@/components/content/ContentKpiRow";
import {
  RefreshQueueCard,
  type RefreshQueueItem,
} from "@/components/content/RefreshQueueCard";
import {
  TopPerformersCard,
  type TopPerformerItem,
} from "@/components/content/TopPerformersCard";

// Tab 3 components
import { ActionsTab } from "@/components/content/ActionsTab";
import { evaluateRules } from "@/lib/content/actionRules";

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
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { from, to, preset: "30d" };
  });

  // -----------------------------------------------------------------------
  // Tab 1: "What to Write" data
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
    activeTab === "portfolio" || activeTab === "quoi-ecrire"
  );

  // Content Intelligence: unified endpoint aggregating scores + history + cost
  // Returns { kpis, refreshQueue, topPerformers }
  const contentIntel = usePolling<{
    kpis: ContentKpis;
    refreshQueue: RefreshQueueItem[];
    topPerformers: TopPerformerItem[];
  }>(
    "/api/content-intelligence",
    POLL_INTERVAL,
    activeTab === "portfolio" || activeTab === "actions"
  );

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------
  const handleQueueSubmitted = useCallback(() => {
    setQueueRefreshKey((k) => k + 1);
    roiQueue.refetch();
  }, [roiQueue]);

  // Manual "Refresh now" — bypasses the 5min in-memory cache on every
  // content-related source AND dispatches the content-intelligence workflow
  // for fresh GA4-backed scores / queues (~3 min background).
  const [refreshState, setRefreshState] = useState<"idle" | "refreshing" | "done" | "error">("idle");
  const handleRefresh = useCallback(async () => {
    setRefreshState("refreshing");
    try {
      // 1. Force-refresh all underlying data sources by hitting bypass URLs.
      //    This repopulates the server-side in-memory cache with fresh GitHub
      //    raw data so the subsequent polling-hook refetches are instant.
      await Promise.all([
        fetch("/api/data/roi-optimized-queue.json?bypass-cache=1", { cache: "no-store" }),
        fetch("/api/data/content-gaps.json?bypass-cache=1", { cache: "no-store" }),
        fetch("/api/data/seasonal-forecast.json?bypass-cache=1", { cache: "no-store" }),
        fetch("/api/data/article-scores.json?bypass-cache=1", { cache: "no-store" }),
        fetch("/api/data/lifecycle-states.json?bypass-cache=1", { cache: "no-store" }),
        fetch("/api/content-intelligence?bypass-cache=1", { cache: "no-store" }),
      ]);

      // 2. Dispatch content-intelligence workflow in background (refreshes
      //    the underlying JSON files in the content repo, ~3 min).
      const dispatch = fetch("/api/workflows/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow: "content-intelligence.yml" }),
      });

      // 3. Pull the just-refreshed server caches into the polling hook state.
      await Promise.all([
        roiQueue.refetch(),
        contentGaps.refetch(),
        seasonalForecast.refetch(),
        articleScores.refetch(),
        lifecycleStates.refetch(),
        contentIntel.refetch(),
      ]);

      // 4. Best-effort wait on the workflow dispatch (non-blocking for UI).
      await dispatch;

      setRefreshState("done");
      setTimeout(() => setRefreshState("idle"), 4000);
    } catch (err) {
      console.error("[content/refresh]", err);
      setRefreshState("error");
      setTimeout(() => setRefreshState("idle"), 4000);
    }
  }, [roiQueue, contentGaps, seasonalForecast, articleScores, lifecycleStates, contentIntel]);

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

  // Map real API shapes to component interfaces
  const priorityMap: Record<string, string> = { P1: 'urgent', P2: 'high', P3: 'medium', P4: 'low', P5: 'low' };

  const roiItems = useMemo(() => {
    const raw = unwrap<Record<string, unknown>>(roiQueue.data?.data, 'queue', 'items');
    return raw
      .filter((r) => {
        // Filter out calendar rotation placeholders — they're not real articles
        const title = String(r.topic ?? r.title ?? '');
        return !title.startsWith('[Calendar rotation');
      })
      .map((r, i) => ({
        id: String(r.rank ?? i),
        title: String(r.topic ?? r.title ?? 'Article'),
        topic: String(r.topic ?? ''),
        type: String(r.action ?? r.type ?? 'standard'),
        priority: priorityMap[String(r.priority ?? '')] ?? String(r.priority ?? 'medium'),
        expectedROI: (r.roi as Record<string, unknown>)?.expectedRoi as number ?? r.expectedROI as number ?? 0,
        destination: r.destination as string ?? undefined,
      })) as ROIQueueItem[];
  }, [roiQueue.data]);

  const gapItems = useMemo(() => unwrap<ContentGap>(contentGaps.data?.data, 'gaps', 'items'), [contentGaps.data]);

  const seasonalItems = useMemo(() => {
    const raw = unwrap<Record<string, unknown>>(seasonalForecast.data?.data, 'forecasts', 'destinations', 'items');
    return raw.map(r => ({
      destination: String(r.destination ?? ''),
      publishBy: String(r.publishBy ?? ''),
      peakMonth: String(r.peakMonth ?? r.peakMonthName ?? ''),
      urgency: String(r.urgency ?? (r.daysUntilPublish != null && (r.daysUntilPublish as number) <= 30 ? 'URGENT' : 'normal')),
      confidence: r.confidence as number ?? 0,
      daysUntilPublish: r.daysUntilPublish as number ?? 999,
    })) as SeasonalItem[];
  }, [seasonalForecast.data]);

  // Build a slug->state lookup from lifecycle-states data
  const lifecycleBySlug = useMemo(() => {
    const map: Record<string, string> = {};
    const raw = lifecycleStates.data?.data;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const obj = raw as Record<string, unknown>;
      const articles = obj.articles;
      if (Array.isArray(articles)) {
        for (const a of articles as Record<string, unknown>[]) {
          if (a.slug && a.state) map[String(a.slug)] = String(a.state);
        }
      }
    }
    return map;
  }, [lifecycleStates.data]);

  const scoreItems = useMemo(() => {
    const raw = unwrap<Record<string, unknown>>(articleScores.data?.data, 'scores', 'articles', 'items');
    return raw.map(r => {
      const slug = String(r.slug ?? '');
      return {
        id: String(r.wpId ?? r.id ?? ''),
        title: String(r.title ?? ''),
        slug,
        score: (r.compositeScore as number) ?? (r.score as number) ?? 0,
        lifecycle: String(r.lifecycle ?? lifecycleBySlug[slug] ?? 'NEW'),
        traffic7d: (r.signals as Record<string, unknown>)?.traffic as number ?? r.traffic7d as number ?? 0,
        publishedAt: r.date as string ?? r.publishedAt as string ?? undefined,
        actions: (r.actions as string[]) ?? [],
        breakdown: r.signals as Record<string, number> ?? {},
      };
    }) as unknown as ArticleScore[];
  }, [articleScores.data, lifecycleBySlug]);

  // Content intelligence payload (server-aggregated)
  const intelKpis = contentIntel.data?.kpis ?? null;
  const intelRefresh = contentIntel.data?.refreshQueue ?? [];
  const intelTop = contentIntel.data?.topPerformers ?? [];

  // Total pending action count (for the Actions tab badge) — computed once
  // so both the tab trigger and the ActionsTab content render consistently.
  const actionsCount = useMemo(() => {
    let count = 0;
    for (const item of intelRefresh) {
      if (!item.signals) continue;
      count += evaluateRules(
        {
          signals: item.signals,
          score: item.score,
          delta7d: item.delta7d,
          flags: item.flags,
          slug: item.slug,
          title: item.title,
          url: item.url,
          wpId: item.wpId,
          surface: "refresh",
        },
        3,
      ).length;
    }
    for (const item of intelTop) {
      if (!item.signals) continue;
      count += evaluateRules(
        {
          signals: item.signals,
          score: item.score,
          delta7d: item.delta7d ?? 0,
          flags: item.flags,
          slug: item.slug,
          title: item.title,
          url: item.url,
          wpId: item.wpId,
          surface: "top",
        },
        3,
      ).length;
    }
    return count;
  }, [intelRefresh, intelTop]);

  // Count articles with intelligence data
  const articlesCount = scoreItems.length;
  const hasIntelligenceData =
    !roiQueue.error || !contentGaps.error || !articleScores.error;

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-zinc-800/80 shrink-0 flex-wrap gap-y-2 gap-x-3">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap gap-y-2">
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
              Waiting for intelligence data
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DateRangeSelector value={dateRange} onChange={setDateRange} />
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshState === "refreshing"}
            title={
              refreshState === "done"
                ? "Caches refreshed • GA4/scores updating in background (~3 min)"
                : refreshState === "error"
                ? "Refresh failed — check console"
                : "Refresh all content data and trigger content-intelligence workflow"
            }
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border transition-colors ${
              refreshState === "done"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                : refreshState === "error"
                ? "border-red-500/40 bg-red-500/10 text-red-400"
                : "border-zinc-800/80 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-50"
            }`}
          >
            <RefreshCw
              className={`w-3 h-3 ${refreshState === "refreshing" ? "animate-spin" : ""}`}
            />
            {refreshState === "refreshing"
              ? "Refreshing…"
              : refreshState === "done"
              ? "Refreshed"
              : refreshState === "error"
              ? "Failed"
              : "Refresh"}
          </button>
        </div>
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
              <span className="hidden sm:inline">What to Write</span>
              <span className="sm:hidden">Ideas</span>
            </TabsTrigger>
            <TabsTrigger
              value="portfolio"
              className="text-xs gap-1 sm:gap-1.5 px-2 sm:px-3 data-active:text-emerald-400"
            >
              <BarChart3 className="w-3.5 h-3.5 shrink-0" />
              Portfolio
            </TabsTrigger>
            <TabsTrigger
              value="actions"
              className="text-xs gap-1 sm:gap-1.5 px-2 sm:px-3 data-active:text-amber-400"
            >
              <Zap className="w-3.5 h-3.5 shrink-0" />
              Actions
              {actionsCount > 0 && (
                <span
                  className="ml-0.5 text-[10px] font-mono tabular-nums px-1 py-0 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40"
                  aria-label={`${actionsCount} pending action${actionsCount > 1 ? "s" : ""}`}
                >
                  {actionsCount}
                </span>
              )}
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
          <div className="space-y-2">
            <div className="flex items-center justify-end">
              <CsvExportButton
                data={roiItems as unknown as Record<string, unknown>[]}
                columns={[
                  { key: "title" as keyof Record<string, unknown>, header: "Title" },
                  { key: "topic" as keyof Record<string, unknown>, header: "Topic" },
                  { key: "type" as keyof Record<string, unknown>, header: "Type" },
                  { key: "priority" as keyof Record<string, unknown>, header: "Priority" },
                  { key: "expectedROI" as keyof Record<string, unknown>, header: "Expected ROI" },
                  { key: "destination" as keyof Record<string, unknown>, header: "Destination" },
                ]}
                filename={`roi-queue-${new Date().toISOString().slice(0, 10)}.csv`}
              />
            </div>
            <ROIQueueTable
              items={roiItems}
              loading={roiQueue.loading}
              error={roiQueue.error}
            />
          </div>

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
          {/* CEO KPI row: portfolio health, zombies, declining, invested */}
          <ContentKpiRow kpis={intelKpis} loading={contentIntel.loading} />

          {/* Refresh queue + Top performers (actionable) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RefreshQueueCard items={intelRefresh} loading={contentIntel.loading} />
            <TopPerformersCard items={intelTop} loading={contentIntel.loading} />
          </div>

          {/* Article score table (full width) */}
          <div className="space-y-2">
            <div className="flex items-center justify-end">
              <CsvExportButton
                data={scoreItems as unknown as Record<string, unknown>[]}
                columns={[
                  { key: "title" as keyof Record<string, unknown>, header: "Title" },
                  { key: "slug" as keyof Record<string, unknown>, header: "Slug" },
                  { key: "publishedAt" as keyof Record<string, unknown>, header: "Published" },
                  { key: "score" as keyof Record<string, unknown>, header: "Score" },
                  { key: "lifecycle" as keyof Record<string, unknown>, header: "Lifecycle" },
                  { key: "traffic7d" as keyof Record<string, unknown>, header: "Traffic (7d)" },
                ]}
                filename={`article-scores-${new Date().toISOString().slice(0, 10)}.csv`}
              />
            </div>
            <ArticleScoreTable
              articles={scoreItems}
              loading={articleScores.loading}
              error={articleScores.error}
            />
          </div>
        </TabsContent>

        {/* ================================================================ */}
        {/* TAB 3: Actions — consolidated rule-engine recommendations        */}
        {/* ================================================================ */}
        <TabsContent
          value="actions"
          className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4"
        >
          <ActionsTab
            refreshQueue={intelRefresh}
            topPerformers={intelTop}
            loading={contentIntel.loading}
          />
        </TabsContent>

      </Tabs>
    </div>
  );
}
