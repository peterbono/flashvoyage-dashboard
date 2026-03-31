"use client";

import React, { useEffect, useState } from "react";
import { Clock } from "lucide-react";

// ── Cron definitions (UTC hours) ──────────────────────────────────────────────

interface CronEntry {
  id: string;
  label: string;
  utcHour: number;
  utcMinute: number;
  /** If set, only fires on these days of week (0=Sun, 1=Mon, ..., 6=Sat) */
  days?: number[];
  color: string;
}

const CRONS: CronEntry[] = [
  { id: "digest",       label: "Daily Digest",        utcHour: 1,  utcMinute: 15, color: "bg-zinc-500" },
  { id: "intelligence", label: "Content Intelligence", utcHour: 3,  utcMinute: 0,  color: "bg-violet-500" },
  { id: "analytics",    label: "Daily Analytics",      utcHour: 4,  utcMinute: 0,  color: "bg-blue-500" },
  { id: "reel-1",       label: "Reel #1",              utcHour: 5,  utcMinute: 0,  color: "bg-fuchsia-500" },
  { id: "reel-2",       label: "Reel #2",              utcHour: 10, utcMinute: 30, color: "bg-fuchsia-500" },
  { id: "social",       label: "Social Posts",         utcHour: 12, utcMinute: 0,  days: [2, 6], color: "bg-amber-500" },
  { id: "reel-3",       label: "Reel #3",              utcHour: 16, utcMinute: 0,  color: "bg-fuchsia-500" },
];

function cronToMinutes(entry: CronEntry): number {
  return entry.utcHour * 60 + entry.utcMinute;
}

function formatTime(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function utcToParis(hour: number, minute: number): string {
  // Paris = UTC+2 (summer CEST)
  const h = (hour + 2) % 24;
  return `${h.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function utcToBangkok(hour: number, minute: number): string {
  // Bangkok = UTC+7
  const h = (hour + 7) % 24;
  return `${h.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function dayLabel(days: number[]): string {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days.map((d) => names[d]).join("+");
}

export function CronTimeline() {
  const [nowMinutes, setNowMinutes] = useState<number>(() => {
    const now = new Date();
    return now.getUTCHours() * 60 + now.getUTCMinutes();
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setNowMinutes(now.getUTCHours() * 60 + now.getUTCMinutes());
    }, 30_000); // update every 30s
    return () => clearInterval(interval);
  }, []);

  const TOTAL_MINUTES = 24 * 60;
  const nowPercent = (nowMinutes / TOTAL_MINUTES) * 100;

  // Find next upcoming cron
  const today = new Date().getUTCDay();
  const nextCron = CRONS
    .filter((c) => {
      if (c.days && !c.days.includes(today)) return false;
      return cronToMinutes(c) > nowMinutes;
    })
    .sort((a, b) => cronToMinutes(a) - cronToMinutes(b))[0] ?? null;

  return (
    <div className="shrink-0 border-t border-zinc-800 bg-zinc-950 px-3 md:px-4 py-3">
      {/* Header with multi-timezone */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Clock className="w-3.5 h-3.5 text-zinc-500" />
        <span className="text-xs font-semibold text-zinc-400">Cron Schedule</span>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-zinc-600">UTC {formatTime(Math.floor(nowMinutes / 60), nowMinutes % 60)}</span>
          <span className="text-blue-400/70">🇫🇷 {utcToParis(Math.floor(nowMinutes / 60), nowMinutes % 60)}</span>
          <span className="text-amber-400/70">🇹🇭 {utcToBangkok(Math.floor(nowMinutes / 60), nowMinutes % 60)}</span>
        </div>
        {nextCron && (
          <span className="text-[10px] text-zinc-600 ml-auto">
            Next: <span className="text-zinc-400 font-medium">{nextCron.label}</span>{" "}
            <span className="text-blue-400/70">{utcToParis(nextCron.utcHour, nextCron.utcMinute)} 🇫🇷</span>{" "}
            <span className="text-amber-400/70">{utcToBangkok(nextCron.utcHour, nextCron.utcMinute)} 🇹🇭</span>
          </span>
        )}
      </div>

      {/* Timeline strip — horizontal scroll on mobile */}
      <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
      <div className="relative h-10 bg-zinc-900 rounded-lg overflow-hidden min-w-[500px]">
        {/* Hour tick marks */}
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={h}
            className="absolute top-0 bottom-0 border-l border-zinc-800"
            style={{ left: `${(h / 24) * 100}%` }}
          >
            {h % 3 === 0 && (
              <span className="absolute -top-0.5 left-1 text-[9px] text-zinc-700 font-mono select-none">
                {h.toString().padStart(2, "0")}
              </span>
            )}
          </div>
        ))}

        {/* Cron markers */}
        {CRONS.map((cron) => {
          const pct = (cronToMinutes(cron) / TOTAL_MINUTES) * 100;
          const isNext = nextCron?.id === cron.id;
          return (
            <div
              key={cron.id}
              className="absolute top-0 bottom-0 flex flex-col items-center justify-end group"
              style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
            >
              {/* Marker dot */}
              <div
                className={`w-2.5 h-2.5 rounded-full ${cron.color} mb-1 ${
                  isNext ? "ring-2 ring-white/30 animate-pulse" : ""
                }`}
              />
              {/* Tooltip on hover */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block z-20">
                <div className="bg-zinc-800 border border-zinc-700 rounded-md px-2.5 py-1.5 text-[10px] text-white whitespace-nowrap shadow-lg space-y-0.5">
                  <div className="font-semibold text-[11px]">{cron.label}</div>
                  <div className="text-zinc-500">{formatTime(cron.utcHour, cron.utcMinute)} UTC</div>
                  <div className="text-blue-400">🇫🇷 {utcToParis(cron.utcHour, cron.utcMinute)} Paris</div>
                  <div className="text-amber-400">🇹🇭 {utcToBangkok(cron.utcHour, cron.utcMinute)} Bangkok</div>
                  {cron.days && (
                    <div className="text-zinc-600">{dayLabel(cron.days)} only</div>
                  )}
                </div>
              </div>
              {/* Label below dot */}
              <span
                className={`text-[9px] font-medium truncate max-w-[56px] leading-none ${
                  isNext ? "text-white" : "text-zinc-600"
                }`}
              >
                {cron.label.length > 8 ? cron.label.split(" ").pop() : cron.label}
              </span>
            </div>
          );
        })}

        {/* Current time marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-emerald-500 z-10"
          style={{ left: `${nowPercent}%` }}
        >
          <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[9px] text-emerald-400 font-mono whitespace-nowrap">
            now
          </div>
        </div>
      </div>
      </div>

      {/* Legend row with timezone info */}
      <div className="flex items-center gap-2 sm:gap-3 mt-2 flex-wrap">
        {CRONS.map((cron) => (
          <div key={cron.id} className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${cron.color}`} />
            <span className="text-[10px] text-zinc-600">
              {cron.label}
              <span className="text-zinc-700 ml-0.5">
                {utcToBangkok(cron.utcHour, cron.utcMinute)}
              </span>
              {cron.days ? ` (${dayLabel(cron.days)})` : ""}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1 ml-auto">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-zinc-600">Now</span>
        </div>
      </div>
    </div>
  );
}
