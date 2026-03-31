"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Film, ExternalLink, Clock, CheckCircle2, Loader2, XCircle } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReelHistoryEntry {
  date: string;
  time?: string;
  format: string;
  destination?: string;
  status: string;
  igUrl?: string;
  fbUrl?: string;
  threadsUrl?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The 3 daily reel slots in Paris (Europe/Paris) time */
const SLOTS = [
  { label: "7h00", hour: 7, minute: 0 },
  { label: "12h30", hour: 12, minute: 30 },
  { label: "18h00", hour: 18, minute: 0 },
] as const;

/** Color per reel format */
const FORMAT_COLORS: Record<string, string> = {
  poll: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/60",
  pick: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800/60",
  humor: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/60",
  versus: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/60",
  budget: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/60",
  avantapres: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-800/60",
  month: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800/60",
};

const STATUS_CONFIG: Record<
  string,
  { icon: React.ElementType; label: string; color: string }
> = {
  scheduled: {
    icon: Clock,
    label: "Scheduled",
    color: "text-gray-400 dark:text-zinc-500",
  },
  running: {
    icon: Loader2,
    label: "Running",
    color: "text-amber-500",
  },
  done: {
    icon: CheckCircle2,
    label: "Done",
    color: "text-emerald-500",
  },
  published: {
    icon: CheckCircle2,
    label: "Published",
    color: "text-emerald-500",
  },
  failed: {
    icon: XCircle,
    label: "Failed",
    color: "text-rose-500",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTodayParis(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
}

function matchSlot(
  entry: ReelHistoryEntry,
  slotHour: number,
  slotMinute: number
): boolean {
  // Try to parse the time field (HH:MM) or created_at timestamp
  const timeStr = entry.time;
  if (!timeStr) return false;
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return false;
  // Match within a 2-hour window around the slot
  const slotMins = slotHour * 60 + slotMinute;
  const entryMins = h * 60 + m;
  return Math.abs(entryMins - slotMins) <= 90;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  data: ReelHistoryEntry[] | null;
  loading: boolean;
}

export function ReelsTimeline({ data, loading }: Props) {
  const todayStr = useMemo(getTodayParis, []);

  // Filter for today's entries
  const todayReels = useMemo(() => {
    if (!data) return [];
    return data.filter((entry) => {
      const entryDate = (entry.date ?? "").slice(0, 10);
      return entryDate === todayStr;
    });
  }, [data, todayStr]);

  // Map each slot to its reel (or null)
  const slotData = useMemo(() => {
    return SLOTS.map((slot) => {
      const match = todayReels.find((r) => matchSlot(r, slot.hour, slot.minute));
      return { ...slot, reel: match ?? null };
    });
  }, [todayReels]);

  const currentParis = useMemo(() => {
    const now = new Date();
    const parisStr = now.toLocaleTimeString("en-GB", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      minute: "2-digit",
    });
    const [h, m] = parisStr.split(":").map(Number);
    return h * 60 + m;
  }, []);

  return (
    <div className="rounded-xl border bg-white dark:bg-zinc-900/40 border-gray-200 dark:border-zinc-800/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800/50">
        <div className="flex items-center gap-2">
          <Film className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[13px] font-semibold text-gray-900 dark:text-white">
            Today&apos;s Reels
          </span>
          <span className="text-[11px] text-gray-400 dark:text-zinc-600">
            Paris time
          </span>
        </div>
        <span className="text-[11px] text-gray-400 dark:text-zinc-600 tabular-nums">
          {todayReels.length}/3
        </span>
      </div>

      <div className="px-4 py-3">
        {loading ? (
          <div className="flex gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-1 rounded-lg border border-gray-100 dark:border-zinc-800/50 p-3 animate-pulse">
                <div className="h-3 w-10 rounded bg-gray-200 dark:bg-zinc-700 mb-2" />
                <div className="h-2.5 w-16 rounded bg-gray-100 dark:bg-zinc-800" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-3">
            {slotData.map((slot) => {
              const slotMins = slot.hour * 60 + slot.minute;
              const isPast = currentParis > slotMins + 60;
              const isCurrent =
                currentParis >= slotMins - 30 && currentParis <= slotMins + 60;

              const reel = slot.reel;
              const statusKey = reel
                ? reel.status === "published"
                  ? "done"
                  : reel.status
                : isPast
                ? "failed"
                : isCurrent
                ? "scheduled"
                : "scheduled";

              const cfg = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.scheduled;
              const StatusIcon = cfg.icon;

              return (
                <div
                  key={slot.label}
                  className={`flex-1 rounded-lg border p-3 transition-all ${
                    isCurrent
                      ? "border-amber-300 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-950/10"
                      : "border-gray-100 dark:border-zinc-800/50"
                  }`}
                >
                  {/* Slot header */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] font-semibold text-gray-800 dark:text-zinc-200 tabular-nums">
                      {slot.label}
                    </span>
                    <StatusIcon
                      className={`w-3.5 h-3.5 ${cfg.color} ${
                        statusKey === "running" ? "animate-spin" : ""
                      }`}
                    />
                  </div>

                  {reel ? (
                    <div className="space-y-1.5">
                      {/* Format badge */}
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 h-4 ${
                          FORMAT_COLORS[reel.format] ?? FORMAT_COLORS.poll
                        }`}
                      >
                        {reel.format}
                      </Badge>

                      {/* Destination */}
                      {reel.destination && (
                        <p className="text-[11px] text-gray-500 dark:text-zinc-500 truncate">
                          {reel.destination}
                        </p>
                      )}

                      {/* IG link if done */}
                      {(reel.status === "done" || reel.status === "published") &&
                        reel.igUrl && (
                          <a
                            href={reel.igUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            View on IG
                          </a>
                        )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-300 dark:text-zinc-700">
                      {isPast ? "Missed" : "Pending"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
