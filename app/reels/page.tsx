"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Film, CalendarDays, SlidersHorizontal, Wifi } from "lucide-react";
import { ReelCalendar, type ReelHistoryEntry } from "@/components/reels/ReelCalendar";
import { ManualControl } from "@/components/reels/ManualControl";

export default function ReelsPage() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [history, setHistory] = useState<ReelHistoryEntry[]>([]);

  const [historyLoading, setHistoryLoading] = useState(true);

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

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

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
              Calendar
            </TabsTrigger>
            <TabsTrigger value="publish" className="gap-1.5 text-xs sm:text-sm">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Manual Publish
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar">
            <ReelCalendar history={history} loading={historyLoading} />
          </TabsContent>

          <TabsContent value="publish">
            <ManualControl abTests={null} loading={false} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
