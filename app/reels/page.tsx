"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Film, CalendarDays, BarChart3, SlidersHorizontal, Wifi, Video } from "lucide-react";
import { ReelCalendar, type ReelHistoryEntry } from "@/components/reels/ReelCalendar";
import { FormatPerformance, type PerformanceWeights } from "@/components/reels/FormatPerformance";
import { ManualControl, type ABTestsData } from "@/components/reels/ManualControl";
import { TikTokTab } from "@/components/reels/TikTokTab";

export default function ReelsPage() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [history, setHistory] = useState<ReelHistoryEntry[]>([]);
  const [weights, setWeights] = useState<PerformanceWeights | null>(null);
  const [abTests, setAbTests] = useState<ABTestsData | null>(null);

  const [historyLoading, setHistoryLoading] = useState(true);
  const [weightsLoading, setWeightsLoading] = useState(true);
  const [abLoading, setAbLoading] = useState(true);

  const [historyError, setHistoryError] = useState(false);
  const [isLive, setIsLive] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/data/social-distributor/data/reel-history.jsonl");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const raw = Array.isArray(json.data) ? json.data : [];
      // Map API fields to component interface
      const entries: ReelHistoryEntry[] = raw.map((r: Record<string, unknown>) => ({
        format: (r.format as string) || "pick",
        destination: (r.destination as string) || undefined,
        articleId: r.postId || r.articleId || undefined,
        publishedAt: (r.date as string) || (r.publishedAt as string) || new Date().toISOString(),
        igPermalink: (r.permalink as string) || (r.igPermalink as string) || undefined,
        plays: (r.plays as number) || undefined,
        engagement: (r.engagement as number) || undefined,
        slot: (r.slot as string) || undefined,
        reason: (r.reason as string) || undefined,
        isBreakingNews: (r.isBreakingNews as boolean) || false,
      }));
      setHistory(entries);
      setIsLive(entries.length > 0);
      setHistoryError(false);
    } catch {
      // Expected when no history file exists yet
      setHistory([]);
      setHistoryError(true);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const fetchWeights = useCallback(async () => {
    try {
      const res = await fetch("/api/data/social-distributor/reels/data/performance-weights.json");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setWeights(json.data ?? null);
    } catch {
      setWeights(null);
    } finally {
      setWeightsLoading(false);
    }
  }, []);

  const fetchAbTests = useCallback(async () => {
    try {
      const res = await fetch("/api/data/social-distributor/data/ab-tests.json");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setAbTests(json.data ?? null);
    } catch {
      setAbTests(null);
    } finally {
      setAbLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    fetchWeights();
    fetchAbTests();
  }, [fetchHistory, fetchWeights, fetchAbTests]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const totalReels = history.length;

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/80 shrink-0 flex-wrap gap-y-2">
        <Film className="w-4 h-4 text-amber-500" />
        <h1 className="text-sm font-semibold text-white tracking-tight">Reels</h1>

        {isLive && (
          <Badge
            variant="outline"
            className="border-emerald-800/60 bg-emerald-950/30 text-emerald-400 gap-1 text-xs"
          >
            <Wifi className="w-2.5 h-2.5" />
            {totalReels} reels
          </Badge>
        )}

        {historyError && (
          <Badge variant="outline" className="border-zinc-800 text-zinc-600 text-xs">
            pas de donnees
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        <Tabs defaultValue="calendar">
          <TabsList variant="line" className="mb-4 overflow-x-auto">
            <TabsTrigger value="calendar" className="gap-1.5 text-xs sm:text-sm">
              <CalendarDays className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Calendrier</span>
              <span className="sm:hidden">Cal.</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="gap-1.5 text-xs sm:text-sm">
              <BarChart3 className="w-3.5 h-3.5" />
              Perf.
            </TabsTrigger>
            <TabsTrigger value="tiktok" className="gap-1.5 text-xs sm:text-sm">
              <Video className="w-3.5 h-3.5" />
              TikTok
            </TabsTrigger>
            <TabsTrigger value="control" className="gap-1.5 text-xs sm:text-sm">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Controle</span>
              <span className="sm:hidden">Ctrl</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar">
            <ReelCalendar history={history} loading={historyLoading} />
          </TabsContent>

          <TabsContent value="performance">
            <FormatPerformance
              history={history}
              weights={weights}
              loading={weightsLoading}
            />
          </TabsContent>

          <TabsContent value="tiktok">
            <TikTokTab />
          </TabsContent>

          <TabsContent value="control">
            <ManualControl abTests={abTests} loading={abLoading} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
