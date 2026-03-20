"use client";

import { useEffect, useState, useCallback } from "react";
import { TrendingUp, MapPin, Target, Zap, ExternalLink, RefreshCw, AlertCircle, Plus, Cpu, X, Copy, Check, Clock } from "lucide-react";
import type { ArticleSuggestion, CallCost } from "@/app/api/suggestions/route";
import { useAppStore } from "@/lib/store";

// localStorage cost accumulation
const COST_KEY = "fv_suggestions_cost";
const CACHE_KEY = "fv_suggestions_cache";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — only used to show "stale" badge, never auto-refreshes

interface DailyCost { date: string; totalUsd: number; callCount: number }
interface SuggestionsCache {
  suggestions: ArticleSuggestion[];
  fetchedAt: number; // epoch ms
  cost: CallCost;
}

function accumulateCost(cost: CallCost) {
  const today = new Date().toISOString().slice(0, 10);
  let stored: DailyCost = { date: today, totalUsd: 0, callCount: 0 };
  try {
    const raw = localStorage.getItem(COST_KEY);
    if (raw) { const p: DailyCost = JSON.parse(raw); if (p.date === today) stored = p; }
  } catch { /* ignore */ }
  stored.totalUsd += cost.totalUsd;
  stored.callCount += 1;
  try { localStorage.setItem(COST_KEY, JSON.stringify(stored)); } catch { /* ignore */ }
}

function readCache(): SuggestionsCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SuggestionsCache;
  } catch { return null; }
}

function writeCache(data: SuggestionsCache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

function timeAgo(epochMs: number): string {
  const diffMin = Math.floor((Date.now() - epochMs) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

type State =
  | { status: "idle"; cache: SuggestionsCache }
  | { status: "loading" }
  | { status: "error"; message: string; cache: SuggestionsCache | null }
  | { status: "ok"; suggestions: ArticleSuggestion[]; fetchedAt: number };

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8 ? "text-emerald-400 bg-emerald-950/40 border-emerald-800/60" :
    score >= 6 ? "text-amber-400 bg-amber-950/40 border-amber-800/60" :
    "text-zinc-400 bg-zinc-800/40 border-zinc-700";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded border tabular-nums ${color}`}>
      <TrendingUp className="w-2.5 h-2.5" />
      {score}/10
    </span>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button
      onClick={copy}
      title="Copy keyword"
      className="p-1 rounded text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-400 transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export function TrendingSuggestions() {
  const addKanbanCard = useAppStore((s) => s.addKanbanCard);

  // Boot from cache — NEVER auto-fetch
  const [state, setState] = useState<State>(() => {
    const cache = readCache();
    if (cache) return { status: "idle", cache };
    return { status: "error", message: "No data yet — click Refresh to fetch suggestions", cache: null };
  });

  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [queued, setQueued] = useState<Set<number>>(new Set());
  const [generated, setGenerated] = useState<Set<number>>(new Set());

  // Derive display suggestions from whichever state has data
  const currentSuggestions: ArticleSuggestion[] =
    state.status === "idle" ? state.cache.suggestions :
    state.status === "ok" ? state.suggestions :
    state.status === "error" && state.cache ? state.cache.suggestions : [];

  const fetchedAt: number | null =
    state.status === "idle" ? state.cache.fetchedAt :
    state.status === "ok" ? state.fetchedAt :
    state.status === "error" && state.cache ? state.cache.fetchedAt : null;

  const isStale = fetchedAt !== null && Date.now() - fetchedAt > CACHE_TTL_MS;

  const load = useCallback(async () => {
    const prevCache = readCache();
    setState({ status: "loading" });
    setDismissed(new Set());
    setQueued(new Set());
    setGenerated(new Set());
    try {
      const res = await fetch("/api/suggestions");
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "API error");
      const cost: CallCost = data.callCost ?? { inputTokens: 0, outputTokens: 0, totalUsd: 0 };
      if (data.callCost) accumulateCost(data.callCost);
      const now = Date.now();
      const newCache: SuggestionsCache = { suggestions: data.suggestions ?? [], fetchedAt: now, cost };
      writeCache(newCache);
      setState({ status: "ok", suggestions: data.suggestions ?? [], fetchedAt: now });
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : "Unknown error", cache: prevCache });
    }
  }, []);

  // NO useEffect auto-load — manual only

  function addToQueue(s: ArticleSuggestion, idx: number, column: "queued" | "generating") {
    addKanbanCard({
      id: `sug-${Date.now()}-${idx}`,
      title: s.title,
      column,
      source: "RSS",
      sourceUrl: s.sourceUrl || undefined,
      keyword: s.keyword,
      date: new Date().toISOString().slice(0, 10),
      language: "EN",
      destination: s.destination,
    });
    if (column === "queued") setQueued((prev) => new Set(prev).add(idx));
    else setGenerated((prev) => new Set(prev).add(idx));
  }

  const visibleSuggestions = currentSuggestions.filter((_, i) => !dismissed.has(i));

  return (
    <div className="bg-white dark:bg-zinc-900/40 border border-gray-200 dark:border-zinc-800/50 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-amber-500/10">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-[13px] font-semibold text-gray-900 dark:text-white">Trending Opportunities</h2>
            <p className="text-xs text-gray-400 dark:text-zinc-500 flex items-center gap-1">
              RSS + Claude scoring · manual refresh
              {fetchedAt && (
                <span className={`flex items-center gap-0.5 ${isStale ? "text-amber-500" : "text-zinc-600"}`}>
                  · <Clock className="w-2.5 h-2.5" /> {timeAgo(fetchedAt)}
                  {isStale && " · stale"}
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={state.status === "loading"}
          title="Fetch fresh suggestions (calls Claude API)"
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 hover:text-amber-400 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3 h-3 ${state.status === "loading" ? "animate-spin" : ""}`} />
          {state.status === "loading" ? "Fetching…" : "Refresh"}
        </button>
      </div>

      {state.status === "loading" && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse flex flex-col gap-1.5 bg-gray-50 dark:bg-zinc-800/30 rounded-lg p-3">
              <div className="h-3 bg-gray-200 dark:bg-zinc-700 rounded w-3/4" />
              <div className="h-2.5 bg-gray-100 dark:bg-zinc-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {state.status === "error" && !state.cache && (
        <div className="flex items-start gap-2.5 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-800/40 rounded-lg px-3 py-3">
          <AlertCircle className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-medium text-zinc-600 dark:text-zinc-400">{state.message}</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-0.5">Suggestions are only loaded on demand — no background calls.</p>
          </div>
        </div>
      )}

      {(state.status === "ok" || state.status === "idle" || (state.status === "error" && state.cache)) && (
        <div className="space-y-2">
          {visibleSuggestions.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-zinc-600 text-center py-4">All suggestions actioned</p>
          )}
          {currentSuggestions.map((s, i) => {
            if (dismissed.has(i)) return null;
            const isQueued = queued.has(i);
            const isGenerated = generated.has(i);
            const actioned = isQueued || isGenerated;
            return (
              <div
                key={i}
                className={`group flex flex-col gap-1.5 border rounded-lg px-3 py-2.5 transition-colors ${
                  actioned
                    ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40"
                    : "bg-gray-50 dark:bg-zinc-800/30 hover:bg-gray-100 dark:hover:bg-zinc-800/60 border-gray-100 dark:border-zinc-800/40"
                }`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-medium text-gray-900 dark:text-white leading-snug flex-1">
                    {s.title}
                  </p>
                  <div className="flex items-center gap-1 shrink-0">
                    <ScoreBadge score={s.trendScore} />
                    {s.sourceUrl && (
                      <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-400 transition-all">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      onClick={() => setDismissed((prev) => new Set(prev).add(i))}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-all"
                      title="Dismiss"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-zinc-500">
                    <Target className="w-2.5 h-2.5 text-amber-500" />
                    {s.keyword}
                    <CopyBtn text={s.keyword} />
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-zinc-500">
                    <MapPin className="w-2.5 h-2.5" />
                    {s.destination}
                  </span>
                </div>

                {/* Angle */}
                <p className="text-xs text-gray-400 dark:text-zinc-500 italic leading-snug">{s.angle}</p>

                {/* CTAs */}
                <div className="flex items-center gap-1.5 pt-1">
                  {actioned ? (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      {isQueued ? "✓ Added to queue" : "✓ Sent to generation"}
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => addToQueue(s, i, "queued")}
                        className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Add to queue
                      </button>
                      <button
                        onClick={() => addToQueue(s, i, "generating")}
                        className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-black transition-colors"
                      >
                        <Cpu className="w-3 h-3" />
                        Generate now
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
