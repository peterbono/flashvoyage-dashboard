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
    activeTab === "portfolio"
  );

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------
  const handleQueueSubmitted = useCallback(() => {
    setQueueRefreshKey((k) => k + 1);
    roiQueue.refetch();
  }, [roiQueue]);

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
        actions: (r.actions as string[]) ?? [],
        breakdown: r.signals as Record<string, number> ?? {},
      };
    }) as unknown as ArticleScore[];
  }, [articleScores.data, lifecycleBySlug]);

  // Content intelligence payload (server-aggregated)
  const intelKpis = contentIntel.data?.kpis ?? null;
  const intelRefresh = contentIntel.data?.refreshQueue ?? [];
  const intelTop = contentIntel.data?.topPerformers ?? [];

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
        <DateRangeSelector value={dateRange} onChange={setDateRange} />
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

      </Tabs>
    </div>
  );
}
