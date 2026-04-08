"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, ExternalLink, Eye, Heart } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ReelHistoryEntry {
  format: string;
  destination?: string;
  articleId?: number | string;
  publishedAt: string;
  igPermalink?: string;
  plays?: number;
  engagement?: number;
  slot?: string; // "07h", "12h30", "18h"
  reason?: string;
  isBreakingNews?: boolean;
}

// ── Format color map ───────────────────────────────────────────────────────

const FORMAT_COLORS: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  poll:       { dot: "bg-blue-500",    bg: "bg-blue-500/10",    text: "text-blue-400",    label: "Poll" },
  pick:       { dot: "bg-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Trip Pick" },
  humor:      { dot: "bg-orange-500",  bg: "bg-orange-500/10",  text: "text-orange-400",  label: "Humor" },
  "humor-tweet": { dot: "bg-orange-400", bg: "bg-orange-400/10", text: "text-orange-300", label: "Humor Tweet" },
  versus:     { dot: "bg-purple-500",  bg: "bg-purple-500/10",  text: "text-purple-400",  label: "Versus" },
  budget:     { dot: "bg-teal-500",    bg: "bg-teal-500/10",    text: "text-teal-400",    label: "Budget" },
  avantapres: { dot: "bg-red-500",     bg: "bg-red-500/10",     text: "text-red-400",     label: "Before/After" },
  month:      { dot: "bg-amber-500",   bg: "bg-amber-500/10",   text: "text-amber-400",   label: "Where to Go" },
};

function getFormatStyle(format: string) {
  return FORMAT_COLORS[format] ?? { dot: "bg-zinc-500", bg: "bg-zinc-500/10", text: "text-zinc-400", label: format };
}

// ── Time slots ─────────────────────────────────────────────────────────────

const TIME_SLOTS = ["07h", "12h30", "18h"] as const;

function guessSlot(dateStr: string): string {
  const d = new Date(dateStr);
  const utcHour = d.getUTCHours();
  if (utcHour <= 6) return "07h";
  if (utcHour <= 12) return "12h30";
  return "18h";
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  // 0=Sun, 1=Mon, ..., 6=Sat. We want Monday=0.
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  history: ReelHistoryEntry[];
  loading: boolean;
}

export function ReelCalendar({ history, loading }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedReel, setSelectedReel] = useState<ReelHistoryEntry | null>(null);

  // Group reels by date string (YYYY-MM-DD)
  const reelsByDate = useMemo(() => {
    const map: Record<string, ReelHistoryEntry[]> = {};
    for (const reel of history) {
      const dateKey = reel.publishedAt.slice(0, 10);
      if (!map[dateKey]) map[dateKey] = [];
      // Ensure slot is set
      const withSlot = { ...reel, slot: reel.slot || guessSlot(reel.publishedAt) };
      map[dateKey].push(withSlot);
    }
    // Sort each day's reels by slot order
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => {
        const order = { "07h": 0, "12h30": 1, "18h": 2 };
        return (order[a.slot as keyof typeof order] ?? 9) - (order[b.slot as keyof typeof order] ?? 9);
      });
    }
    return map;
  }, [history]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  // Stats for this month
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthReels = history.filter((r) => r.publishedAt.startsWith(monthKey));
  const totalPlays = monthReels.reduce((s, r) => s + (r.plays ?? 0), 0);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  }

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <>
      <Card className="border-zinc-800/50 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-white">Reels Calendar</CardTitle>
          <CardAction>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs">
                {monthReels.length} reels
              </Badge>
              {totalPlays > 0 && (
                <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-xs gap-1">
                  <Eye className="w-2.5 h-2.5" />
                  {totalPlays.toLocaleString()}
                </Badge>
              )}
            </div>
          </CardAction>
        </CardHeader>

        <CardContent>
          {/* Month navigator */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon-sm" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium text-white">
              {MONTH_NAMES[month]} {year}
            </span>
            <Button variant="ghost" size="icon-sm" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <span className="text-zinc-500 text-sm">Loading...</span>
            </div>
          ) : (
            <>
              {/* Horizontal scroll wrapper for small screens */}
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <div className="min-w-[420px]">
                  {/* Day headers */}
                  <div className="grid grid-cols-7 gap-px mb-1">
                    {DAY_HEADERS.map((d) => (
                      <div key={d} className="text-center text-[10px] sm:text-xs text-zinc-600 font-medium py-1">
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-px">
                    {/* Empty cells before first day */}
                    {Array.from({ length: firstDay }).map((_, i) => (
                      <div key={`empty-${i}`} className="h-14 sm:h-20 bg-zinc-900/30 rounded" />
                    ))}

                    {/* Day cells */}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const dayReels = reelsByDate[dateKey] ?? [];
                      const isToday = dateKey === todayStr;

                      return (
                        <div
                          key={day}
                          className={`h-14 sm:h-20 rounded border transition-colors p-1 ${
                            isToday
                              ? "border-amber-500/50 bg-amber-500/5"
                              : "border-zinc-800/40 bg-zinc-900/30 hover:border-zinc-700/60"
                          }`}
                        >
                          <span className={`text-[10px] sm:text-xs tabular-nums ${isToday ? "text-amber-400 font-semibold" : "text-zinc-500"}`}>
                            {day}
                          </span>

                          {/* Reel dots — up to 3 */}
                          <div className="flex flex-col gap-0.5 mt-0.5 sm:mt-1">
                            {dayReels.slice(0, 3).map((reel, ri) => {
                              const style = getFormatStyle(reel.format);
                              return (
                                <button
                                  key={ri}
                                  onClick={() => setSelectedReel(reel)}
                                  className={`flex items-center gap-0.5 sm:gap-1 rounded px-0.5 sm:px-1 py-0.5 transition-colors hover:ring-1 hover:ring-zinc-600 ${style.bg}`}
                                  title={`${style.label} (${reel.slot})`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
                                  <span className={`text-[8px] sm:text-[9px] leading-none truncate ${style.text}`}>
                                    {style.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-2 sm:gap-3 mt-4 pt-3 border-t border-zinc-800/50">
                {Object.entries(FORMAT_COLORS).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${val.dot}`} />
                    <span className="text-[10px] sm:text-xs text-zinc-500">{val.label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selectedReel} onOpenChange={(open) => !open && setSelectedReel(null)}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">
              {selectedReel && getFormatStyle(selectedReel.format).label}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {selectedReel?.publishedAt
                ? new Date(selectedReel.publishedAt).toLocaleString("en-US", {
                    dateStyle: "long",
                    timeStyle: "short",
                  })
                : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedReel && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-zinc-800/50 p-3">
                  <span className="text-xs text-zinc-500 block mb-0.5">Format</span>
                  <Badge className={`${getFormatStyle(selectedReel.format).bg} ${getFormatStyle(selectedReel.format).text} border-0`}>
                    {getFormatStyle(selectedReel.format).label}
                  </Badge>
                </div>
                <div className="rounded-lg bg-zinc-800/50 p-3">
                  <span className="text-xs text-zinc-500 block mb-0.5">Time Slot</span>
                  <span className="text-sm text-white font-medium">{selectedReel.slot || "N/A"}</span>
                </div>
              </div>

              {selectedReel.destination && (
                <div className="rounded-lg bg-zinc-800/50 p-3">
                  <span className="text-xs text-zinc-500 block mb-0.5">Destination</span>
                  <span className="text-sm text-white">{selectedReel.destination}</span>
                </div>
              )}

              {(selectedReel.plays !== undefined || selectedReel.engagement !== undefined) && (
                <div className="grid grid-cols-2 gap-3">
                  {selectedReel.plays !== undefined && (
                    <div className="rounded-lg bg-zinc-800/50 p-3">
                      <span className="text-xs text-zinc-500 block mb-0.5">Views</span>
                      <span className="text-sm text-white font-medium flex items-center gap-1">
                        <Eye className="w-3 h-3 text-zinc-500" />
                        {selectedReel.plays.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {selectedReel.engagement !== undefined && (
                    <div className="rounded-lg bg-zinc-800/50 p-3">
                      <span className="text-xs text-zinc-500 block mb-0.5">Engagement</span>
                      <span className="text-sm text-white font-medium flex items-center gap-1">
                        <Heart className="w-3 h-3 text-zinc-500" />
                        {selectedReel.engagement.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {selectedReel.reason && (
                <div className="rounded-lg bg-zinc-800/50 p-3">
                  <span className="text-xs text-zinc-500 block mb-0.5">Scheduler Reason</span>
                  <span className="text-xs text-zinc-300 leading-relaxed">{selectedReel.reason}</span>
                </div>
              )}

              {selectedReel.igPermalink && (
                <a
                  href={selectedReel.igPermalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  View on Instagram
                </a>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
