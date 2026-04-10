"use client";

import { useState, useMemo, useEffect, Fragment } from "react";
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { KpiCard } from "@/components/costs/KpiCard";
import { DateRangeSelector, type DateRange } from "@/components/ui/date-range-selector";
import { CsvExportButton } from "@/components/ui/csv-export-button";
import {
  DollarSign, CalendarDays, TrendingDown, Type,
  ArrowUpDown, ChevronDown, ChevronRight,
  ChevronLeft, ChevronRight as ChevronRightPage,
  Loader2, AlertTriangle, ExternalLink, TrendingUp,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface ByStepMetrics {
  costUSD?: number;
  tokensIn?: number;
  tokensOut?: number;
  calls?: number;
  durationMs?: number;
  model?: string;
}

interface ByModelMetrics {
  costUSD?: number;
  tokensIn?: number;
  tokensOut?: number;
  calls?: number;
}

interface CostEntry {
  date: string;
  articleId?: number | null;
  /** Article title — missing on non-article runs like reels */
  title?: string;
  slug?: string | null;
  url?: string;
  wordCount?: number;
  totalCostUSD: number;
  totalTokensIn?: number;
  totalTokensOut?: number;
  totalTokens?: number;
  totalCalls?: number;
  durationMs?: number;
  llmDurationMs?: number;
  llmTimeRatio?: number;
  costPerWord?: number;
  byStep?: Record<string, ByStepMetrics>;
  byModel?: Record<string, ByModelMetrics>;
  /** Non-article run type (e.g. "reel"). Absent for articles. */
  type?: string;
  format?: string;
  destination?: string;
}

type Granularity = "daily" | "weekly" | "monthly";
type SortColumn = "date" | "cost" | "tokens" | "duration" | "costPerWord";
type Channel = "articles" | "reels";

// ── Constants ────────────────────────────────────────────────────────────────

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#18181b",
  border: "1px solid #27272a",
  borderRadius: "8px",
  color: "#e4e4e7",
  fontSize: "12px",
  padding: "8px 12px",
};
const TOOLTIP_LABEL_STYLE = { color: "#ffffff", fontWeight: 600, marginBottom: 2 };

const MODEL_COLORS: Record<string, string> = {
  "gpt-4o": "#6366f1",
  "gpt-4o-mini": "#34d399",
  "claude-haiku-4-5": "#f59e0b",
  "claude-sonnet-4-5": "#a78bfa",
};
const FALLBACK_COLORS = ["#60a5fa", "#f472b6", "#fb923c", "#22d3ee", "#fbbf24", "#4ade80"];

function getModelColor(name: string, index: number): string {
  const lower = name.toLowerCase();
  for (const [key, color] of Object.entries(MODEL_COLORS)) {
    if (lower.includes(key) || lower.replace(/[^a-z0-9]/g, "").includes(key.replace(/[^a-z0-9]/g, ""))) {
      return color;
    }
  }
  // Fuzzy substring match
  if (lower.includes("gpt-4o-mini") || lower.includes("gpt-4-mini")) return "#34d399";
  if (lower.includes("gpt-4o") || lower.includes("gpt4o")) return "#6366f1";
  if (lower.includes("haiku")) return "#f59e0b";
  if (lower.includes("sonnet")) return "#a78bfa";
  if (lower.includes("opus")) return "#f472b6";
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

const PAGE_SIZE = 20;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Get ISO week key like "2026-W09" */
function isoWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** Get month key like "2026-03" */
function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/** Format duration in ms to human-readable */
function formatDuration(ms: number): string {
  if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/** Aggregate entries into time-bucketed chart data, split by model */
function buildChartData(
  entries: CostEntry[],
  granularity: Granularity,
): { data: Record<string, unknown>[]; modelKeys: string[] } {
  // Collect all models
  const allModels = new Set<string>();
  for (const entry of entries) {
    for (const model of Object.keys(entry.byModel ?? {})) {
      allModels.add(model);
    }
  }
  const modelKeys = Array.from(allModels).sort();

  // Group by time bucket
  const buckets = new Map<string, Record<string, number>>();

  for (const entry of entries) {
    const dateStr = entry.date.slice(0, 10);
    let bucket: string;
    if (granularity === "daily") bucket = dateStr;
    else if (granularity === "weekly") bucket = isoWeek(dateStr);
    else bucket = monthKey(dateStr);

    if (!buckets.has(bucket)) {
      const init: Record<string, number> = {};
      for (const m of modelKeys) init[m] = 0;
      init["_total"] = 0;
      buckets.set(bucket, init);
    }

    const b = buckets.get(bucket)!;
    for (const [model, metrics] of Object.entries(entry.byModel ?? {})) {
      const cost = (metrics as ByModelMetrics)?.costUSD ?? 0;
      b[model] = (b[model] ?? 0) + cost;
      b["_total"] = (b["_total"] ?? 0) + cost;
    }
    // If no byModel data, aggregate total
    if (!entry.byModel || Object.keys(entry.byModel).length === 0) {
      b["_total"] = (b["_total"] ?? 0) + entry.totalCostUSD;
    }
  }

  const data = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, values]) => ({
      bucket,
      ...values,
    }));

  return { data, modelKeys };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CostsPage() {
  // ── Data fetch ───────────────────────────────────────────────────────────
  const [entries, setEntries] = useState<CostEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("/api/github/costs")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { entries: CostEntry[]; total: number }) => {
        setEntries(data.entries ?? []);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, []);

  // ── Date Range Filter ────────────────────────────────────────────────────
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { from, to, preset: "30d" };
  });

  // Filter entries by selected date range
  const filteredEntries = useMemo(() => {
    const fromStr = dateRange.from.toISOString().slice(0, 10);
    const toStr = dateRange.to.toISOString().slice(0, 10);
    return entries.filter((e) => {
      const d = e.date.slice(0, 10);
      return d >= fromStr && d <= toStr;
    });
  }, [entries, dateRange]);

  // ── Channel split (articles vs reels) ────────────────────────────────────
  // Reels are cost entries with type === "reel". Everything else is articles.
  // The active channel drives every downstream memo (KPIs, charts, table).
  const [channel, setChannel] = useState<Channel>("articles");

  // Unfiltered breakdown for the hero header — always shows both channels so
  // the user sees the 95/5 ratio regardless of which tab they're on.
  const breakdown = useMemo(() => {
    let articlesCost = 0, articlesCount = 0;
    let reelsCost = 0, reelsCount = 0;
    for (const e of filteredEntries) {
      if (e.type === "reel") {
        reelsCost += e.totalCostUSD ?? 0;
        reelsCount += 1;
      } else {
        articlesCost += e.totalCostUSD ?? 0;
        articlesCount += 1;
      }
    }
    const total = articlesCost + reelsCost;
    return {
      articles: { cost: articlesCost, count: articlesCount, share: total > 0 ? articlesCost / total : 0 },
      reels: { cost: reelsCost, count: reelsCount, share: total > 0 ? reelsCost / total : 0 },
      total,
    };
  }, [filteredEntries]);

  // Scoped entries: the single insertion point that feeds every downstream
  // memo (kpis, sparkData, chartData, modelShares, sortedEntries).
  const scopedEntries = useMemo(
    () => filteredEntries.filter((e) =>
      channel === "reels" ? e.type === "reel" : e.type !== "reel"
    ),
    [filteredEntries, channel],
  );

  // Compute previous period of equal length for delta comparison.
  // Scoped to the active channel so the delta reflects Articles-only or
  // Reels-only burn trend, not the mixed total.
  const periodSummary = useMemo(() => {
    const periodMs = dateRange.to.getTime() - dateRange.from.getTime();
    const prevTo = new Date(dateRange.from.getTime() - 1); // day before current range start
    const prevFrom = new Date(prevTo.getTime() - periodMs);
    const prevFromStr = prevFrom.toISOString().slice(0, 10);
    const prevToStr = prevTo.toISOString().slice(0, 10);

    const isChannelMatch = (e: CostEntry) =>
      channel === "reels" ? e.type === "reel" : e.type !== "reel";

    const currentTotal = scopedEntries.reduce((s, e) => s + e.totalCostUSD, 0);
    const prevEntries = entries.filter((e) => {
      const d = e.date.slice(0, 10);
      return d >= prevFromStr && d <= prevToStr && isChannelMatch(e);
    });
    const prevTotal = prevEntries.reduce((s, e) => s + e.totalCostUSD, 0);
    const deltaPercent = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : null;

    const presetLabel = dateRange.preset === "custom" ? "period" : dateRange.preset;

    return { currentTotal, prevTotal, deltaPercent, presetLabel };
  }, [entries, scopedEntries, dateRange, channel]);

  // ── State ────────────────────────────────────────────────────────────────
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [sortCol, setSortCol] = useState<SortColumn>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // Reset pagination + expanded row whenever the channel changes — stale
  // indices/keys would be meaningless across the two datasets.
  useEffect(() => {
    setPage(0);
    setExpandedRow(null);
  }, [channel]);

  // ── KPI Computation (scoped to the active channel) ───────────────────────
  const kpis = useMemo(() => {
    if (scopedEntries.length === 0) {
      return {
        totalSpend: 0,
        totalSpendDelta: undefined as number | undefined,
        mtdSpend: 0,
        avgCostPerRun: 0,
        avgCostWord: 0,
        runCount: 0,
      };
    }

    const totalSpend = scopedEntries.reduce((s, e) => s + e.totalCostUSD, 0);
    const totalWords = scopedEntries.reduce((s, e) => s + (e.wordCount ?? 0), 0);
    const avgCostPerRun = totalSpend / scopedEntries.length;
    const avgCostWord = totalWords > 0 ? totalSpend / totalWords : 0;

    // MTD: current month
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const mtdSpend = scopedEntries
      .filter((e) => e.date.slice(0, 7) === currentMonth)
      .reduce((s, e) => s + e.totalCostUSD, 0);

    // Delta: compare last 30d vs previous 30d (scoped to channel)
    const today = new Date();
    const d30ago = new Date(today);
    d30ago.setDate(d30ago.getDate() - 30);
    const d60ago = new Date(today);
    d60ago.setDate(d60ago.getDate() - 60);
    const d30str = d30ago.toISOString().slice(0, 10);
    const d60str = d60ago.toISOString().slice(0, 10);

    const isChannelMatch = (e: CostEntry) =>
      channel === "reels" ? e.type === "reel" : e.type !== "reel";

    const last30 = scopedEntries
      .filter((e) => e.date.slice(0, 10) >= d30str)
      .reduce((s, e) => s + e.totalCostUSD, 0);
    const prev30 = entries
      .filter((e) => {
        const d = e.date.slice(0, 10);
        return d >= d60str && d < d30str && isChannelMatch(e);
      })
      .reduce((s, e) => s + e.totalCostUSD, 0);

    const totalSpendDelta = prev30 > 0 ? ((last30 - prev30) / prev30) * 100 : undefined;

    return { totalSpend, totalSpendDelta, mtdSpend, avgCostPerRun, avgCostWord, runCount: scopedEntries.length };
  }, [entries, scopedEntries, channel]);

  // Spark data for KPI cards (scoped to active channel)
  const sparkData = useMemo(() => {
    if (scopedEntries.length === 0) return { cost: [], mtd: [], avgRun: [], avgWord: [], runs: [] };

    // Build daily totals for spark
    const dailyMap = new Map<string, { cost: number; count: number; words: number }>();
    for (const e of scopedEntries) {
      const d = e.date.slice(0, 10);
      const existing = dailyMap.get(d);
      if (existing) {
        existing.cost += e.totalCostUSD;
        existing.count += 1;
        existing.words += e.wordCount ?? 0;
      } else {
        dailyMap.set(d, { cost: e.totalCostUSD, count: 1, words: e.wordCount ?? 0 });
      }
    }
    const days = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14);

    return {
      cost: days.map(([, d]) => d.cost),
      mtd: days.map(([, d]) => d.cost),
      avgRun: days.map(([, d]) => d.count > 0 ? d.cost / d.count : 0),
      avgWord: days.map(([, d]) => d.words > 0 ? d.cost / d.words : 0),
      runs: days.map(([, d]) => d.count),
    };
  }, [scopedEntries]);

  // ── Cost Trend Chart (scoped to active channel) ──────────────────────────
  const { data: chartData, modelKeys } = useMemo(
    () => buildChartData(scopedEntries, granularity),
    [scopedEntries, granularity],
  );

  // ── Model Breakdown (donut, scoped to active channel) ────────────────────
  const modelShares = useMemo(() => {
    const totals = new Map<string, number>();
    let grand = 0;
    for (const entry of scopedEntries) {
      for (const [model, metrics] of Object.entries(entry.byModel ?? {})) {
        const cost = (metrics as ByModelMetrics)?.costUSD ?? 0;
        totals.set(model, (totals.get(model) ?? 0) + cost);
        grand += cost;
      }
    }
    if (grand === 0) return [];

    // Group small models into "Other". Threshold is 1% per-channel (was 3%
    // on the old unified view) — the reel pool is ~30x smaller so a higher
    // threshold would collapse every model into "Other".
    const threshold = grand * 0.01;
    let otherTotal = 0;
    const significantModels: { name: string; value: number; absValue: number }[] = [];

    for (const [name, cost] of totals.entries()) {
      if (cost < threshold) {
        otherTotal += cost;
      } else {
        significantModels.push({
          name,
          value: Math.round((cost / grand) * 100),
          absValue: cost,
        });
      }
    }

    significantModels.sort((a, b) => b.absValue - a.absValue);

    const shares = significantModels.map((m, i) => ({
      name: m.name,
      value: m.value,
      absValue: m.absValue,
      color: getModelColor(m.name, i),
    }));

    if (otherTotal > 0) {
      shares.push({
        name: "Other",
        value: Math.round((otherTotal / grand) * 100),
        absValue: otherTotal,
        color: "#71717a",
      });
    }

    return shares;
  }, [scopedEntries]);

  // ── Run Detail Table (scoped to active channel) ──────────────────────────
  const sortedEntries = useMemo(() => {
    return [...scopedEntries].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "date": cmp = a.date.localeCompare(b.date); break;
        case "cost": cmp = (a.totalCostUSD ?? 0) - (b.totalCostUSD ?? 0); break;
        case "tokens": cmp = (a.totalTokens ?? 0) - (b.totalTokens ?? 0); break;
        case "duration": cmp = (a.durationMs ?? 0) - (b.durationMs ?? 0); break;
        case "costPerWord": cmp = (a.costPerWord ?? 0) - (b.costPerWord ?? 0); break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [scopedEntries, sortCol, sortAsc]);

  const totalPages = Math.ceil(sortedEntries.length / PAGE_SIZE);
  const pagedEntries = sortedEntries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(col: SortColumn) {
    if (sortCol === col) setSortAsc((v) => !v);
    else { setSortCol(col); setSortAsc(false); }
    setPage(0);
  }

  function toggleExpand(id: string) {
    setExpandedRow((prev) => (prev === id ? null : id));
  }

  function getDisplayTitle(entry: CostEntry): string {
    if (entry.title) return entry.title;
    // Non-article runs (reels, etc.) — synthesize a readable label
    const parts = [entry.type, entry.format, entry.destination].filter(Boolean);
    return parts.length > 0 ? parts.join(" — ") : "Run (no title)";
  }

  function entryKey(entry: CostEntry, index: number): string {
    return `${entry.date}-${entry.articleId ?? index}-${getDisplayTitle(entry).slice(0, 20)}`;
  }

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
          <p className="text-sm text-zinc-500">Loading cost data from production pipeline...</p>
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-center max-w-md">
          <AlertTriangle className="w-8 h-8 text-rose-400" />
          <p className="text-sm text-zinc-400">Failed to load cost data</p>
          <p className="text-xs text-zinc-600 font-mono">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.reload()}
            className="mt-2 text-zinc-400 hover:text-white"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-auto h-full max-w-7xl">
      {/* Header + Date Range Selector */}
      <div className="space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-white tracking-tight">Cost Tracker</h1>
            <p className="text-xs md:text-sm text-zinc-500 mt-0.5">
              {filteredEntries.length === 0 && entries.length > 0 ? (
                <>
                  No costs in this period. Last entry:{" "}
                  {[...entries].sort((a, b) => b.date.localeCompare(a.date))[0]?.date.slice(0, 10)}
                </>
              ) : (
                <>
                  {scopedEntries.length} {channel} runs
                  <span className="text-zinc-600"> (of {filteredEntries.length} total in period)</span>
                </>
              )}
            </p>
          </div>
          <DateRangeSelector value={dateRange} onChange={setDateRange} />
        </div>

        {/* ── Hero: unified total + per-channel breakdown ───────────────── */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 md:p-5 space-y-3">
          <div className="flex items-baseline justify-between flex-wrap gap-3">
            <div className="flex items-baseline gap-3">
              <DollarSign className="w-5 h-5 text-amber-400 self-center" />
              <div className="text-xs uppercase tracking-wider text-zinc-500 font-medium">
                Total spend · {periodSummary.presetLabel}
              </div>
              <div className="text-2xl md:text-3xl font-bold text-white tabular-nums">
                ${breakdown.total.toFixed(2)}
              </div>
            </div>
            {periodSummary.deltaPercent !== null ? (
              <Badge
                variant="outline"
                className={
                  periodSummary.deltaPercent <= 0
                    ? "border-emerald-800/60 bg-emerald-950/30 text-emerald-400 gap-1 text-xs"
                    : "border-rose-800/60 bg-rose-950/30 text-rose-400 gap-1 text-xs"
                }
              >
                {periodSummary.deltaPercent <= 0 ? (
                  <TrendingDown className="w-3 h-3" />
                ) : (
                  <TrendingUp className="w-3 h-3" />
                )}
                {periodSummary.deltaPercent > 0 ? "+" : ""}
                {periodSummary.deltaPercent.toFixed(1)}% · {channel} vs previous {periodSummary.presetLabel}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-zinc-800 text-zinc-600 text-xs">
                No previous period data
              </Badge>
            )}
          </div>

          {/* Breakdown lines */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-amber-400 shrink-0" />
              <span className="text-zinc-400">Articles</span>
              <span className="text-white font-semibold tabular-nums">
                ${breakdown.articles.cost.toFixed(2)}
              </span>
              <span className="text-zinc-600 tabular-nums">
                ({(breakdown.articles.share * 100).toFixed(1)}% · {breakdown.articles.count} runs)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-cyan-400 shrink-0" />
              <span className="text-zinc-400">Reels</span>
              <span className="text-white font-semibold tabular-nums">
                ${breakdown.reels.cost.toFixed(2)}
              </span>
              <span className="text-zinc-600 tabular-nums">
                ({(breakdown.reels.share * 100).toFixed(1)}% · {breakdown.reels.count} runs)
              </span>
            </div>
          </div>

          {/* Stacked proportion bar */}
          {breakdown.total > 0 && (
            <div className="flex h-1.5 rounded-full overflow-hidden bg-zinc-800/60">
              <div
                className="bg-amber-400"
                style={{ width: `${breakdown.articles.share * 100}%` }}
                title={`Articles ${(breakdown.articles.share * 100).toFixed(1)}%`}
              />
              <div
                className="bg-cyan-400"
                style={{ width: `${breakdown.reels.share * 100}%` }}
                title={`Reels ${(breakdown.reels.share * 100).toFixed(1)}%`}
              />
            </div>
          )}
        </div>

        {/* ── Segmented control: active channel ─────────────────────────── */}
        <div className="flex items-center gap-0.5 bg-zinc-900 border border-zinc-800/80 rounded-lg p-0.5 w-fit">
          {([
            { key: "articles" as Channel, label: "Articles", color: "text-amber-400" },
            { key: "reels" as Channel, label: "Reels", color: "text-cyan-400" },
          ]).map(({ key, label, color }) => (
            <button
              key={key}
              type="button"
              onClick={() => setChannel(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                channel === key
                  ? `bg-zinc-800 text-white`
                  : `text-zinc-500 hover:text-zinc-300`
              }`}
            >
              <span className={channel === key ? color : ""}>●</span> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 1. KPI Bar ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total Spend"
          value={`$${kpis.totalSpend.toFixed(2)}`}
          trend={
            kpis.totalSpendDelta !== undefined
              ? `${Math.abs(kpis.totalSpendDelta).toFixed(1)}%`
              : undefined
          }
          trendUp={kpis.totalSpendDelta !== undefined ? kpis.totalSpendDelta > 0 : undefined}
          positiveIsUp={false}
          icon={DollarSign}
          iconColor="text-amber-400"
          sparkData={sparkData.cost}
          sparkColor="#f59e0b"
        />
        <KpiCard
          label="MTD Spend"
          value={`$${kpis.mtdSpend.toFixed(2)}`}
          icon={CalendarDays}
          iconColor="text-blue-400"
          sparkData={sparkData.mtd}
          sparkColor="#60a5fa"
        />
        <KpiCard
          label={channel === "reels" ? "Avg Cost / Reel" : "Avg Cost / Article"}
          value={`$${kpis.avgCostPerRun.toFixed(channel === "reels" ? 4 : 3)}`}
          icon={TrendingDown}
          iconColor="text-emerald-400"
          sparkData={sparkData.avgRun}
          sparkColor="#34d399"
        />
        {channel === "reels" ? (
          <KpiCard
            label="Runs"
            value={kpis.runCount.toLocaleString()}
            icon={Type}
            iconColor="text-purple-400"
            sparkData={sparkData.runs}
            sparkColor="#a78bfa"
          />
        ) : (
          <KpiCard
            label="Avg Cost / Word"
            value={`$${kpis.avgCostWord.toFixed(6)}`}
            icon={Type}
            iconColor="text-purple-400"
            sparkData={sparkData.avgWord}
            sparkColor="#a78bfa"
          />
        )}
      </div>

      {/* ── 2. Cost Trend Chart + 3. Model Breakdown ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Line chart — cost over time, stacked by model */}
        <Card className="bg-zinc-900 border-zinc-800/80 lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm font-semibold text-white">Cost Trend</CardTitle>
              <div className="flex items-center gap-0.5 bg-zinc-800 border border-zinc-700/60 rounded-lg p-0.5">
                {(["daily", "weekly", "monthly"] as Granularity[]).map((g) => (
                  <Button
                    key={g}
                    variant="ghost"
                    size="sm"
                    onClick={() => setGranularity(g)}
                    className={`h-6 px-2.5 text-xs rounded-md transition-colors capitalize ${
                      granularity === g
                        ? "bg-zinc-700 text-white"
                        : "text-zinc-500 hover:text-white hover:bg-zinc-800"
                    }`}
                  >
                    {g}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-[240px] text-zinc-600 text-sm">
                No cost data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="bucket"
                    tick={{ fill: "#52525b", fontSize: 10 }}
                    tickFormatter={(v: string) => {
                      if (granularity === "daily") return v.slice(5);
                      if (granularity === "weekly") return v.replace(/^\d{4}-/, "");
                      return v;
                    }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: "#52525b", fontSize: 10 }}
                    tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    formatter={(value: unknown, name: unknown) => [
                      `$${(value as number).toFixed(4)}`,
                      name as string,
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                    iconSize={8}
                    iconType="circle"
                  />
                  {modelKeys.map((model, i) => (
                    <Line
                      key={model}
                      type="monotone"
                      dataKey={model}
                      name={model}
                      stroke={getModelColor(model, i)}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 3, strokeWidth: 2, stroke: "#18181b" }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Donut — model distribution */}
        <Card className="bg-zinc-900 border-zinc-800/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-white">Model Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {modelShares.length === 0 ? (
              <div className="flex items-center justify-center h-[160px] text-zinc-600 text-sm">
                No model data
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={modelShares}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={72}
                      paddingAngle={3}
                      dataKey="absValue"
                      strokeWidth={0}
                    >
                      {modelShares.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={TOOLTIP_LABEL_STYLE}
                      formatter={(value: unknown, _name: unknown, props: unknown) => {
                        const payload = (props as { payload?: { name?: string; value?: number } })?.payload;
                        return [
                          `$${(value as number).toFixed(4)} (${payload?.value ?? 0}%)`,
                          payload?.name ?? "",
                        ];
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 w-full mt-2">
                  {modelShares.map((m) => (
                    <div key={m.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: m.color }}
                        />
                        <span className="text-zinc-400 truncate">{m.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-zinc-500 tabular-nums text-xs">
                          ${m.absValue.toFixed(2)}
                        </span>
                        <div className="w-14 bg-zinc-800 rounded-full h-1">
                          <div
                            className="h-1 rounded-full"
                            style={{ width: `${m.value}%`, backgroundColor: m.color }}
                          />
                        </div>
                        <span className="text-white font-semibold text-xs w-8 text-right tabular-nums">
                          {m.value}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 4. Run Detail Table ─────────────────────────────────────────── */}
      <Card className="bg-zinc-900 border-zinc-800/80">
        <CardHeader className="flex flex-row items-center justify-between pb-3 flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold text-white">
            Run Details{" "}
            <span className="text-zinc-600 font-normal ml-1">({scopedEntries.length})</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <CsvExportButton
              data={scopedEntries as unknown as Record<string, unknown>[]}
              columns={channel === "reels"
                ? [
                    { key: "date" as keyof Record<string, unknown>, header: "Date" },
                    { key: "type" as keyof Record<string, unknown>, header: "Type" },
                    { key: "format" as keyof Record<string, unknown>, header: "Format" },
                    { key: "destination" as keyof Record<string, unknown>, header: "Destination" },
                    { key: "totalCostUSD" as keyof Record<string, unknown>, header: "Total Cost (USD)" },
                    { key: "totalTokens" as keyof Record<string, unknown>, header: "Tokens" },
                  ]
                : [
                    { key: "date" as keyof Record<string, unknown>, header: "Date" },
                    { key: "title" as keyof Record<string, unknown>, header: "Title" },
                    { key: "totalCostUSD" as keyof Record<string, unknown>, header: "Total Cost (USD)" },
                    { key: "totalTokens" as keyof Record<string, unknown>, header: "Tokens" },
                    { key: "durationMs" as keyof Record<string, unknown>, header: "Duration (ms)" },
                    { key: "costPerWord" as keyof Record<string, unknown>, header: "Cost Per Word" },
                    { key: "wordCount" as keyof Record<string, unknown>, header: "Word Count" },
                    { key: "url" as keyof Record<string, unknown>, header: "URL" },
                  ]}
              filename={`costs-${channel}-${dateRange.preset}-${new Date().toISOString().slice(0, 10)}.csv`}
            />
            <Badge variant="outline" className={`text-xs gap-1 ${channel === "reels" ? "border-cyan-800/60 bg-cyan-950/30 text-cyan-400" : "border-amber-800/60 bg-amber-950/30 text-amber-400"}`}>
              {scopedEntries.length} {channel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-zinc-800/60 hover:bg-transparent">
                  <TableHead className="w-8" />
                  <TableHead
                    className="cursor-pointer hover:text-zinc-300 transition-colors"
                    onClick={() => toggleSort("date")}
                  >
                    <div className="flex items-center gap-1">
                      Date
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead
                    className="text-right cursor-pointer hover:text-zinc-300 transition-colors"
                    onClick={() => toggleSort("cost")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Total Cost
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer hover:text-zinc-300 transition-colors"
                    onClick={() => toggleSort("tokens")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Tokens
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer hover:text-zinc-300 transition-colors"
                    onClick={() => toggleSort("duration")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Duration
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </TableHead>
                  {channel !== "reels" && (
                    <TableHead
                      className="text-right cursor-pointer hover:text-zinc-300 transition-colors"
                      onClick={() => toggleSort("costPerWord")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        $/Word
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={channel === "reels" ? 6 : 7} className="text-center text-zinc-600 py-8">
                      {filteredEntries.length === 0 && entries.length > 0 ? (
                        <div className="space-y-1">
                          <p>No costs in this period.</p>
                          <p className="text-zinc-500 text-xs">
                            Last entry:{" "}
                            {[...entries].sort((a, b) => b.date.localeCompare(a.date))[0]?.date.slice(0, 10)}
                          </p>
                        </div>
                      ) : (
                        "No pipeline runs recorded"
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedEntries.map((entry, idx) => {
                    const key = entryKey(entry, page * PAGE_SIZE + idx);
                    const isExpanded = expandedRow === key;
                    const stepEntries = Object.entries(entry.byStep ?? {})
                      .filter(([, m]) => (m as ByStepMetrics)?.costUSD !== undefined)
                      .sort(
                        ([, a], [, b]) =>
                          ((b as ByStepMetrics).costUSD ?? 0) - ((a as ByStepMetrics).costUSD ?? 0),
                      );

                    return (
                      <Fragment key={key}>
                        <TableRow
                          className="border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors cursor-pointer group"
                          onClick={() => toggleExpand(key)}
                        >
                          <TableCell className="w-8 px-2">
                            {stepEntries.length > 0 && (
                              isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                              )
                            )}
                          </TableCell>
                          <TableCell className="text-zinc-500 tabular-nums">
                            {entry.date.slice(0, 10)}
                          </TableCell>
                          <TableCell className="text-zinc-200 max-w-[280px] group-hover:text-white transition-colors">
                            {entry.url ? (
                              <a
                                href={entry.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 hover:text-amber-400 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="truncate">{getDisplayTitle(entry)}</span>
                                <ExternalLink className="w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100" />
                              </a>
                            ) : (
                              <span className="truncate block">{getDisplayTitle(entry)}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-amber-400 font-medium tabular-nums">
                            ${(entry.totalCostUSD ?? 0).toFixed(4)}
                          </TableCell>
                          <TableCell className="text-right text-zinc-500 tabular-nums">
                            {(entry.totalTokens ?? 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-zinc-500 tabular-nums">
                            {entry.durationMs && entry.durationMs > 0 ? formatDuration(entry.durationMs) : "---"}
                          </TableCell>
                          {channel !== "reels" && (
                            <TableCell className="text-right text-zinc-500 tabular-nums">
                              ${(entry.costPerWord ?? 0).toFixed(6)}
                            </TableCell>
                          )}
                        </TableRow>

                        {/* Expanded: per-step breakdown */}
                        {isExpanded && stepEntries.length > 0 && (
                          <TableRow className="bg-zinc-950/50 hover:bg-zinc-950/50">
                            <TableCell colSpan={channel === "reels" ? 6 : 7} className="p-0">
                              <div className="px-6 py-3 ml-8 border-l-2 border-zinc-700/50">
                                <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-2">
                                  Step Breakdown
                                </p>
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-zinc-600">
                                      <th className="text-left pb-1.5 font-medium">Step</th>
                                      <th className="text-right pb-1.5 font-medium">Calls</th>
                                      <th className="text-right pb-1.5 font-medium">Tokens In</th>
                                      <th className="text-right pb-1.5 font-medium">Tokens Out</th>
                                      <th className="text-right pb-1.5 font-medium">Cost</th>
                                      <th className="text-right pb-1.5 font-medium">Duration</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {stepEntries.map(([step, metrics]) => {
                                      const m = metrics as ByStepMetrics;
                                      return (
                                        <tr
                                          key={step}
                                          className="border-t border-zinc-800/30 hover:bg-zinc-800/20"
                                        >
                                          <td className="py-1.5 text-zinc-300 font-medium">
                                            {step}
                                          </td>
                                          <td className="py-1.5 text-right text-zinc-500 tabular-nums">
                                            {m.calls ?? "---"}
                                          </td>
                                          <td className="py-1.5 text-right text-zinc-500 tabular-nums">
                                            {(m.tokensIn ?? 0).toLocaleString()}
                                          </td>
                                          <td className="py-1.5 text-right text-zinc-500 tabular-nums">
                                            {(m.tokensOut ?? 0).toLocaleString()}
                                          </td>
                                          <td className="py-1.5 text-right text-amber-400/80 font-medium tabular-nums">
                                            ${(m.costUSD ?? 0).toFixed(4)}
                                          </td>
                                          <td className="py-1.5 text-right text-zinc-500 tabular-nums">
                                            {m.durationMs ? formatDuration(m.durationMs) : "---"}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 md:px-4 py-3 border-t border-zinc-800/60 flex-wrap gap-2">
              <span className="text-[10px] md:text-xs text-zinc-600">
                {page * PAGE_SIZE + 1}--{Math.min((page + 1) * PAGE_SIZE, sortedEntries.length)} of{" "}
                {sortedEntries.length} runs
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="h-7 w-7 p-0 text-zinc-500 hover:text-white disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                  // Show pages around current page
                  let pageIdx: number;
                  if (totalPages <= 7) {
                    pageIdx = i;
                  } else if (page < 4) {
                    pageIdx = i;
                  } else if (page > totalPages - 5) {
                    pageIdx = totalPages - 7 + i;
                  } else {
                    pageIdx = page - 3 + i;
                  }
                  return (
                    <Button
                      key={pageIdx}
                      variant="ghost"
                      size="sm"
                      onClick={() => setPage(pageIdx)}
                      className={`h-7 w-7 p-0 text-xs rounded-md transition-colors ${
                        pageIdx === page
                          ? "bg-zinc-700 text-white"
                          : "text-zinc-500 hover:text-white hover:bg-zinc-800"
                      }`}
                    >
                      {pageIdx + 1}
                    </Button>
                  );
                })}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                  className="h-7 w-7 p-0 text-zinc-500 hover:text-white disabled:opacity-30"
                >
                  <ChevronRightPage className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
