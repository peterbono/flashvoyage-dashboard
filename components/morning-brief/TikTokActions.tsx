"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Video, Clock, Copy, Check } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReelEntry {
  date: string;
  time?: string;
  format: string;
  destination?: string;
  caption?: string;
  igUrl?: string;
}

interface Props {
  reels: ReelEntry[] | null;
  loading: boolean;
}

// ---------------------------------------------------------------------------
// Schedule & format colors
// ---------------------------------------------------------------------------

const TIKTOK_SLOTS = [
  { label: "14h BKK", subtitle: "9h Paris", utcHour: 7 },
  { label: "19h BKK", subtitle: "14h Paris", utcHour: 12 },
  { label: "00h BKK", subtitle: "19h Paris", utcHour: 17 },
];

const FORMAT_COLORS: Record<string, string> = {
  pick: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  budget: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  avantapres: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  "cost-vs": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  humor: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  "humor-tweet": "bg-pink-500/15 text-pink-400 border-pink-500/30",
  leaderboard: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  "best-time": "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  month: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
};

function getFormatColor(format: string): string {
  return FORMAT_COLORS[format] || "bg-zinc-700/40 text-zinc-400 border-zinc-600/30";
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-emerald-400" />
          <span className="text-emerald-400">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Slot card
// ---------------------------------------------------------------------------

function SlotCard({
  slot,
  reel,
  index,
}: {
  slot: (typeof TIKTOK_SLOTS)[0];
  reel: ReelEntry | null;
  index: number;
}) {
  const now = new Date();
  const slotPassed =
    now.getUTCHours() > slot.utcHour ||
    (now.getUTCHours() === slot.utcHour && now.getUTCMinutes() > 30);

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
        reel
          ? "bg-zinc-800/50 border-zinc-700/50"
          : slotPassed
          ? "bg-zinc-900/50 border-zinc-800/30 opacity-50"
          : "bg-zinc-900/80 border-amber-500/20"
      }`}
    >
      {/* Time badge */}
      <div className="flex flex-col items-center min-w-[60px]">
        <span className="text-sm font-bold text-white">{slot.label}</span>
        <span className="text-[10px] text-zinc-500">{slot.subtitle}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {reel ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 ${getFormatColor(reel.format)}`}
              >
                {reel.format}
              </Badge>
              {reel.destination && (
                <span className="text-xs text-zinc-400 truncate">
                  {reel.destination}
                </span>
              )}
            </div>
          </div>
        ) : slotPassed ? (
          <span className="text-xs text-zinc-600">No reel</span>
        ) : (
          <span className="text-xs text-amber-500/70">
            Waiting for 1pm batch
          </span>
        )}
      </div>

      {/* Copy button */}
      {reel?.caption && <CopyButton text={reel.caption} />}

      {/* IG link */}
      {reel?.igUrl && (
        <a
          href={reel.igUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-zinc-500 hover:text-amber-400 transition-colors shrink-0"
        >
          IG
        </a>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TikTokActions({ reels, loading }: Props) {
  // Match reels to TikTok slots (closest time match for today)
  const today = new Date().toISOString().slice(0, 10);
  const todayReels = reels?.filter((r) => r.date === today) || [];

  const slotReels = TIKTOK_SLOTS.map((slot) => {
    // Find the reel closest to this slot's UTC hour
    const match = todayReels.find((r) => {
      if (!r.time) return false;
      const hour = parseInt(r.time.split(":")[0], 10);
      return Math.abs(hour - slot.utcHour) <= 2;
    });
    return match || null;
  });

  if (loading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800/80">
        <CardContent className="py-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-48 bg-zinc-700 rounded" />
            <div className="h-12 bg-zinc-800 rounded" />
            <div className="h-12 bg-zinc-800 rounded" />
            <div className="h-12 bg-zinc-800 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const postedCount = slotReels.filter(Boolean).length;

  return (
    <Card className="bg-zinc-900 border-zinc-800/80">
      <CardContent className="py-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-md bg-cyan-500/10">
            <Video className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <span className="text-sm font-semibold text-white">
            TikToks to Post
          </span>
          <Badge
            variant="outline"
            className="ml-auto text-[10px] bg-zinc-800 border-zinc-700 text-zinc-400"
          >
            {postedCount}/3
          </Badge>
        </div>

        <div className="space-y-2">
          {TIKTOK_SLOTS.map((slot, i) => (
            <SlotCard key={slot.label} slot={slot} reel={slotReels[i]} index={i} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
