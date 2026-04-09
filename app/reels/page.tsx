"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Film, Wifi } from "lucide-react";
import { ReelCalendar, type ReelHistoryEntry } from "@/components/reels/ReelCalendar";

/** Normalize a string: lowercase + strip diacritics (é→e, à→a, etc.) */
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function guessFormat(caption: string): string {
  const c = norm(caption);
  if (c.includes("spot") || c.includes("pick") || c.includes("rater") || c.includes("incontournable")) return "pick";
  if (c.includes("budget") || c.includes("cout") || c.includes("prix") || c.includes("cher") || c.includes("journalier")) return "budget";
  if (c.includes("expect") || c.includes("reality") || c.includes("avant") || c.includes("apres") || c.includes("realite")) return "avantapres";
  if (c.includes("vs") || c.includes("moins cher") || c.includes("compare") || c.includes("comparatif") || c.includes("lequel")) return "cost-vs";
  if (c.includes("top") || c.includes("classement") || c.includes("leaderboard") || c.includes("ranking")) return "leaderboard";
  if (c.includes("humor") || c.includes("quand tu") || c.includes("meme") || c.includes("drole")) return "humor";
  if (c.includes("quand") || c.includes("best time") || c.includes("saison") || c.includes("meilleur") || c.includes("partir")) return "best-time";
  if (c.includes("mois") || c.includes("ou aller") || c.includes("ou partir") || c.includes("destination")) return "month";
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

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/social-stats");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const pubs: Publication[] = data.publications || [];

      const entries: ReelHistoryEntry[] = pubs.map((p) => ({
        format: guessFormat(p.caption || ""),
        destination: p.caption?.split("\n")[0]?.slice(0, 50) || undefined,
        publishedAt: p.publishedAt,
        plays: p.impressions,
        engagement: p.interactions,
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
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/80 shrink-0">
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

      {/* Calendar only — click a cell to publish */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        <ReelCalendar history={history} loading={historyLoading} />
      </div>
    </div>
  );
}
