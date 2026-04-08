"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Film, CalendarDays, SlidersHorizontal, Wifi } from "lucide-react";
import { ReelCalendar, type ReelHistoryEntry } from "@/components/reels/ReelCalendar";
import { ManualControl } from "@/components/reels/ManualControl";

// Guess format from caption text
function guessFormat(caption: string): string {
  const c = caption.toLowerCase();
  if (c.includes("spot") || c.includes("pick") || c.includes("rater")) return "pick";
  if (c.includes("budget") || c.includes("cout") || c.includes("jour")) return "budget";
  if (c.includes("expect") || c.includes("reality") || c.includes("avant")) return "avantapres";
  if (c.includes("vs") || c.includes("moins cher") || c.includes("compare")) return "cost-vs";
  if (c.includes("quand") || c.includes("best time") || c.includes("saison")) return "best-time";
  if (c.includes("top") || c.includes("classement")) return "leaderboard";
  if (c.includes("humor") || c.includes("quand tu")) return "humor";
  if (c.includes("partir") || c.includes("mois")) return "month";
  return "pick";
}

interface Publication {
  id: string;
  platform: string;
  type: string;
  caption: string;
  publishedAt: string;
  impressions: number;
  interactions: number;
}

export default function ReelsPage() {
  const [history, setHistory] = useState<ReelHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(false);

  // Fetch from /api/social-stats (live data) instead of broken reel-history.jsonl
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/social-stats");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const pubs: Publication[] = data.publications || [];

      // Map publications to ReelHistoryEntry format for the calendar
      const entries: ReelHistoryEntry[] = pubs.map((p) => ({
        format: guessFormat(p.caption || ""),
        destination: p.caption?.split("\n")[0]?.slice(0, 50) || undefined,
        publishedAt: p.publishedAt,
        igPermalink: p.platform === "instagram" ? `https://instagram.com` : undefined,
        plays: p.impressions,
        engagement: p.interactions,
        slot: undefined,
        reason: p.platform,
        isBreakingNews: false,
      }));

      setHistory(entries);
      setHistoryError(false);
    } catch {
      setHistory([]);
      setHistoryError(true);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const totalReels = history.length;

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/80 shrink-0 flex-wrap gap-y-2">
        <Film className="w-4 h-4 text-amber-500" />
        <h1 className="text-sm font-semibold text-white tracking-tight">Planner</h1>

        {totalReels > 0 && (
          <Badge
            variant="outline"
            className="border-emerald-800/60 bg-emerald-950/30 text-emerald-400 gap-1 text-xs"
          >
            <Wifi className="w-2.5 h-2.5" />
            {totalReels} posts
          </Badge>
        )}

        {historyError && (
          <Badge variant="outline" className="border-zinc-800 text-zinc-600 text-xs">
            no data
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
