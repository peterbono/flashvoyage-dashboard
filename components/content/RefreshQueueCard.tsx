"use client";

import { useState, useCallback } from "react";
import { RefreshCw, ExternalLink, TrendingDown, Check, X } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RefreshQueueItem {
  slug: string;
  title: string;
  url: string;
  score: number;
  delta7d: number;
  flags: string[];
  /** Top 2 weakest signals (Phase 2 diagnosis) */
  weakSignals?: { name: string; value: number }[];
}

type RowState = "idle" | "refreshing" | "done" | "error";

interface Props {
  items: RefreshQueueItem[];
  loading: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta.toFixed(0)}`;
  return delta.toFixed(0);
}

function deltaColorClass(delta: number): string {
  if (delta <= -20) return "text-red-400";
  if (delta <= -10) return "text-orange-400";
  if (delta < 0) return "text-amber-400";
  return "text-zinc-500";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Signal label + color for Phase 2 diagnosis badges
// ---------------------------------------------------------------------------

const SIGNAL_META: Record<string, { label: string; color: string }> = {
  traffic: { label: "traffic", color: "text-rose-400 bg-rose-950/40 border-rose-800/40" },
  trendAlignment: { label: "trend", color: "text-orange-400 bg-orange-950/40 border-orange-800/40" },
  reelAmplification: { label: "reels", color: "text-purple-400 bg-purple-950/40 border-purple-800/40" },
  freshness: { label: "freshness", color: "text-cyan-400 bg-cyan-950/40 border-cyan-800/40" },
  sessionQuality: { label: "session", color: "text-blue-400 bg-blue-950/40 border-blue-800/40" },
  monetization: { label: "monetiz.", color: "text-emerald-400 bg-emerald-950/40 border-emerald-800/40" },
};

export function RefreshQueueCard({ items, loading }: Props) {
  // Per-row refresh state, keyed by slug.
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});

  const handleRefresh = useCallback(async (slug: string) => {
    setRowStates((s) => ({ ...s, [slug]: "refreshing" }));
    try {
      const res = await fetch("/api/workflows/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow: "refresh-articles.yml",
          inputs: { slug },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRowStates((s) => ({ ...s, [slug]: "done" }));
      setTimeout(() => {
        setRowStates((s) => {
          const next = { ...s };
          delete next[slug];
          return next;
        });
      }, 5000);
    } catch (err) {
      console.error("[refresh-queue]", slug, err);
      setRowStates((s) => ({ ...s, [slug]: "error" }));
      setTimeout(() => {
        setRowStates((s) => {
          const next = { ...s };
          delete next[slug];
          return next;
        });
      }, 5000);
    }
  }, []);

  return (
    <Card className="bg-zinc-900/40 border-zinc-800/60 rounded-xl h-full">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="flex items-center gap-2 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          <RefreshCw className="w-3.5 h-3.5 text-orange-400" />
          Refresh queue
          {items.length > 0 ? (
            <span className="text-[10px] font-normal text-zinc-500 normal-case">
              ({items.length})
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-3">
        {loading && items.length === 0 ? (
          <div className="text-xs text-zinc-600 text-center py-6">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-xs text-zinc-600 text-center py-6">
            No declining articles — portfolio is stable.
          </div>
        ) : (
          <ul className="space-y-0.5">
            {items.map((item) => {
              const rowState = rowStates[item.slug] ?? "idle";
              const isBusy = rowState === "refreshing";
              return (
                <li
                  key={item.slug}
                  className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-800/40 transition-colors group"
                >
                  <TrendingDown
                    className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${deltaColorClass(item.delta7d)}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-zinc-200 truncate flex-1 hover:text-white hover:underline"
                        >
                          {item.title}
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-200 truncate flex-1">
                          {item.title}
                        </span>
                      )}
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : null}
                      {/* Per-row Refresh button (Phase 1) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isBusy && rowState !== "done") handleRefresh(item.slug);
                        }}
                        disabled={isBusy || rowState === "done"}
                        title={
                          rowState === "done"
                            ? "Refresh dispatched — workflow running in background"
                            : rowState === "error"
                            ? "Dispatch failed — check console"
                            : rowState === "refreshing"
                            ? "Dispatching refresh workflow…"
                            : "Refresh this article (live data update)"
                        }
                        className={`shrink-0 transition-opacity ${
                          rowState === "idle"
                            ? "text-zinc-600 hover:text-orange-400 opacity-0 group-hover:opacity-100"
                            : rowState === "refreshing"
                            ? "text-orange-400 opacity-100"
                            : rowState === "done"
                            ? "text-emerald-400 opacity-100"
                            : "text-red-400 opacity-100"
                        }`}
                      >
                        {rowState === "refreshing" ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : rowState === "done" ? (
                          <Check className="w-3 h-3" />
                        ) : rowState === "error" ? (
                          <X className="w-3 h-3" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-zinc-500 tabular-nums">
                        score {item.score}
                      </span>
                      <span
                        className={`text-[10px] tabular-nums font-mono ${deltaColorClass(item.delta7d)}`}
                      >
                        {formatDelta(item.delta7d)} pts/7d
                      </span>
                      {/* Phase 2: top weak signals (diagnosis) */}
                      {item.weakSignals?.slice(0, 2).map((sig) => {
                        const meta = SIGNAL_META[sig.name];
                        if (!meta) return null;
                        return (
                          <span
                            key={sig.name}
                            className={`text-[9px] px-1.5 py-0 rounded border tabular-nums ${meta.color}`}
                            title={`${sig.name}: ${(sig.value * 100).toFixed(0)}%`}
                          >
                            {meta.label}
                          </span>
                        );
                      })}
                      {item.flags.length > 0 && !item.weakSignals?.length ? (
                        <span className="text-[9px] text-zinc-600 truncate">
                          {item.flags[0]}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
