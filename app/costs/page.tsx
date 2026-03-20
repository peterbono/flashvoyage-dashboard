"use client";

import { useState, useMemo, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/costs/KpiCard";
import {
  DollarSign, FileText, TrendingDown, Star, ArrowUpDown,
  CheckCircle2, Clock, XCircle, TrendingUp, Zap, ExternalLink,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { useSuggestionsCost } from "@/lib/useSuggestionsCost";
import { useAppStore } from "@/lib/store";
import type { PipelineHistoryEntry } from "@/lib/store";

// ── Types ────────────────────────────────────────────────────────────────────

type Range = "1" | "7" | "30" | "90" | "all";

interface DailyCost {
  date: string;
  cost: number;
  articles: number;
}

interface ModelShare {
  name: string;
  value: number;
  color: string;
}

interface ArticleRow {
  id: string;
  date: string;
  title: string;
  totalCost: number;
  tokensIn: number;
  tokensOut: number;
  totalCalls?: number;
  wordCount?: number;
  costPerWord?: number;
  durationMs?: number;
  llmTimeRatio?: number;
  qualityScore: number;
  status: "published" | "review" | "failed";
  model: string;
  url?: string;
}

interface WpStats {
  total: number;
  drafts: number;
  recent: { id: number; title: string; date: string; url: string; slug: string }[];
}

// GitHub API response types
interface GithubArticle {
  id: number;
  title: string;
  date: string;
  url: string;
  slug: string;
}

interface GithubArticlesResponse {
  articles: GithubArticle[];
  total: number;
  fetchedAt: string;
}

interface CostEntry {
  date: string;
  articleId: number | null;
  title: string;
  slug: string | null;
  url: string;
  wordCount: number;
  totalCostUSD: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalTokens: number;
  totalCalls: number;
  durationMs: number;
  llmDurationMs: number;
  llmTimeRatio: number;
  costPerWord: number;
  byStep: Record<string, unknown>;
  byModel: Record<string, unknown>;
}

interface GithubCostsResponse {
  entries: CostEntry[];
  total: number;
  fetchedAt: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const RANGE_LABELS: Record<Range, string> = {
  "1": "1d",
  "7": "7d",
  "30": "30d",
  "90": "90d",
  "all": "All",
};

const STATUS_CONFIG = {
  published: { label: "Published", color: "text-emerald-400 border-emerald-800/60 bg-emerald-950/30", icon: CheckCircle2 },
  review:    { label: "Review",    color: "text-amber-400 border-amber-800/60 bg-amber-950/30",       icon: Clock },
  failed:    { label: "Failed",    color: "text-red-400 border-red-800/60 bg-red-950/30",             icon: XCircle },
};

// Model names derived from track type
const MODEL_BY_TRACK: Record<PipelineHistoryEntry["track"], string> = {
  evergreen: "claude-sonnet-4-5",
  news: "claude-haiku-4-5",
};

// Palette for model donut — assigned by index so unknown model names still get a color
const MODEL_PALETTE = ["#6366f1", "#f59e0b", "#34d399", "#60a5fa", "#f472b6", "#a78bfa", "#fb923c", "#22d3ee"];

// Fuzzy color lookup: match by substring, fall back to palette slot
function modelColor(name: string, index: number): string {
  const n = name.toLowerCase();
  if (n.includes("sonnet"))    return "#6366f1";
  if (n.includes("haiku"))     return "#f59e0b";
  if (n.includes("opus"))      return "#a78bfa";
  if (n.includes("gpt-4o-mini") || n.includes("gpt-4-mini")) return "#34d399";
  if (n.includes("gpt-4"))     return "#60a5fa";
  if (n.includes("gpt-3"))     return "#fb923c";
  if (n.includes("gemini"))    return "#f472b6";
  if (n.includes("mistral"))   return "#22d3ee";
  return MODEL_PALETTE[index % MODEL_PALETTE.length];
}

const PAGE_SIZE = 20;

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#18181b",
  border: "1px solid #27272a",
  borderRadius: "8px",
  color: "#e4e4e7",
  fontSize: "12px",
  padding: "8px 12px",
};
const TOOLTIP_LABEL_STYLE = { color: "#ffffff", fontWeight: 600, marginBottom: 2 };
const TOOLTIP_ITEM_STYLE  = { color: "#e4e4e7" };

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10);
}

function cutoffForRange(range: Range): string | null {
  if (range === "all") return null;
  const d = new Date();
  d.setDate(d.getDate() - parseInt(range));
  return d.toISOString().slice(0, 10);
}

function prevCutoffForRange(range: Range): string | null {
  if (range === "all") return null;
  const n = parseInt(range);
  const d = new Date();
  d.setDate(d.getDate() - n * 2);
  return d.toISOString().slice(0, 10);
}

/** Build daily cost array from pipelineHistory, filtered to [fromDate, toDate) */
function buildDailyCosts(
  history: PipelineHistoryEntry[],
  fromDate: string | null,
  toDate: string | null = null,
): DailyCost[] {
  const map = new Map<string, DailyCost>();

  for (const entry of history) {
    const date = toDateStr(entry.startedAt);
    if (fromDate && date < fromDate) continue;
    if (toDate && date >= toDate) continue;

    const existing = map.get(date);
    if (existing) {
      existing.cost += entry.totalCost;
      existing.articles += entry.status === "done" ? 1 : 0;
    } else {
      map.set(date, {
        date,
        cost: entry.totalCost,
        articles: entry.status === "done" ? 1 : 0,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** Build daily cost array from real production cost-history.jsonl entries */
function buildDailyCostsFromGhEntries(entries: CostEntry[]): DailyCost[] {
  const map = new Map<string, DailyCost>();
  for (const entry of entries) {
    const date = entry.date.slice(0, 10);
    const existing = map.get(date);
    if (existing) {
      existing.cost += entry.totalCostUSD ?? 0;
      existing.articles += 1;
    } else {
      map.set(date, { date, cost: entry.totalCostUSD ?? 0, articles: 1 });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}


// ── Component ─────────────────────────────────────────────────────────────────

export default function CostsPage() {
  const suggestionsCost = useSuggestionsCost();
  const pipelineHistory = useAppStore((s) => s.pipelineHistory);

  const [range, setRange] = useState<Range>("all");
  const [sortCol, setSortCol] = useState<"date" | "cost" | "quality">("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [page, setPage] = useState(0);

  // WordPress stats (async fetch — kept for backwards-compat slug matching)
  const [wpStats, setWpStats] = useState<WpStats | null>(null);
  useEffect(() => {
    fetch("/api/wordpress/stats")
      .then((r) => r.json())
      .then((data: WpStats) => {
        if (!data || "error" in data) return;
        setWpStats(data);
      })
      .catch(() => { /* non-critical */ });
  }, []);

  // GitHub articles — for URL enrichment of production pipeline entries
  const [ghArticles, setGhArticles] = useState<GithubArticlesResponse | null>(null);
  useEffect(() => {
    fetch("/api/github/articles")
      .then((r) => r.json())
      .then((data: GithubArticlesResponse) => {
        if (!data || "error" in data) return;
        setGhArticles(data);
      })
      .catch(() => { /* non-critical */ });
  }, []);

  // GitHub costs — production pipeline real cost data
  const [ghCosts, setGhCosts] = useState<GithubCostsResponse | null>(null);
  const [ghCostsLoading, setGhCostsLoading] = useState(true);
  useEffect(() => {
    setGhCostsLoading(true);
    fetch("/api/github/costs")
      .then((r) => r.json())
      .then((data: GithubCostsResponse) => {
        setGhCosts(data);
        setGhCostsLoading(false);
      })
      .catch(() => {
        setGhCostsLoading(false);
      });
  }, []);

  // ── Derived daily cost data ──────────────────────────────────────────────
  const currFromDate = cutoffForRange(range);
  const prevFromDate = prevCutoffForRange(range);

  // Merge real production data (ghCosts) + dashboard-triggered runs (pipelineHistory)
  const allDailyCosts = useMemo(() => {
    const ghDays = ghCosts ? buildDailyCostsFromGhEntries(ghCosts.entries) : [];
    const dashDays = buildDailyCosts(pipelineHistory, null);
    const map = new Map<string, DailyCost>();
    for (const d of ghDays) map.set(d.date, { ...d });
    for (const d of dashDays) {
      const ex = map.get(d.date);
      if (ex) { ex.cost += d.cost; ex.articles += d.articles; }
      else map.set(d.date, { ...d });
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [pipelineHistory, ghCosts]);

  const filteredDays = useMemo(() => {
    if (range === "all") return allDailyCosts;
    return allDailyCosts.filter((d) => d.date >= (currFromDate ?? ""));
  }, [allDailyCosts, range, currFromDate]);

  const prevDays = useMemo(() => {
    if (range === "all") return [];
    return allDailyCosts.filter(
      (d) => d.date >= (prevFromDate ?? "") && d.date < (currFromDate ?? ""),
    );
  }, [allDailyCosts, range, prevFromDate, currFromDate]);

  const comparisonDays = useMemo(() =>
    prevDays.map((d, i) => ({
      ...d,
      date: filteredDays[i]?.date ?? d.date,
    })),
  [prevDays, filteredDays]);

  const chartData = useMemo(() => {
    if (!showComparison) return filteredDays;
    return filteredDays.map((d, i) => ({ ...d, prevCost: comparisonDays[i]?.cost }));
  }, [filteredDays, comparisonDays, showComparison]);

  // ── Model shares: real byModel data from production cost-history.jsonl ──
  const modelShares = useMemo((): ModelShare[] => {
    const totals = new Map<string, number>();
    let grand = 0;
    // Primary: real production data
    if (ghCosts?.entries.length) {
      for (const entry of ghCosts.entries) {
        const byModel = entry.byModel as Record<string, { costUSD?: number }> | undefined;
        if (!byModel) continue;
        for (const [model, metrics] of Object.entries(byModel)) {
          const cost = metrics?.costUSD ?? 0;
          totals.set(model, (totals.get(model) ?? 0) + cost);
          grand += cost;
        }
      }
    }
    // Fallback: dashboard-triggered history
    if (grand === 0) {
      for (const entry of pipelineHistory) {
        const model = MODEL_BY_TRACK[entry.track];
        totals.set(model, (totals.get(model) ?? 0) + entry.totalCost);
        grand += entry.totalCost;
      }
    }
    if (grand === 0) return [];
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, cost], idx) => ({
        name,
        value: Math.round((cost / grand) * 100),
        color: modelColor(name, idx),
      }));
  }, [ghCosts, pipelineHistory]);

  // ── KPI computation ──────────────────────────────────────────────────────
  const rangeStats = useMemo(() => {
    const curr = filteredDays;
    const prev = prevDays;

    const currCost = curr.reduce((s, d) => s + d.cost, 0);
    const prevCost = prev.reduce((s, d) => s + d.cost, 0);
    const currArts = curr.reduce((s, d) => s + d.articles, 0);
    const prevArts = prev.reduce((s, d) => s + d.articles, 0);
    const currAvg  = currCost / Math.max(currArts, 1);
    const prevAvg  = prevCost / Math.max(prevArts, 1);

    const hasPrev = prev.length > 0;
    const costPct = hasPrev && prevCost ? ((Math.abs(currCost - prevCost) / prevCost) * 100).toFixed(1) : undefined;
    const artsPct = hasPrev && prevArts ? ((Math.abs(currArts - prevArts) / prevArts) * 100).toFixed(1) : undefined;
    const avgPct  = hasPrev && prevAvg  ? ((Math.abs(currAvg  - prevAvg)  / prevAvg)  * 100).toFixed(1) : undefined;

    const spark   = curr.length > 14 ? curr.slice(-14) : curr;
    const last7   = curr.slice(-Math.min(7, curr.length));
    const projected = (last7.reduce((s, d) => s + d.cost, 0) / Math.max(last7.length, 1)) * 30;

    return {
      totalCost: currCost,
      totalArts: currArts,
      avgCost:   currAvg,
      costPct,   costUp:  currCost > prevCost,
      artsPct,   artsUp:  currArts > prevArts,
      avgPct,    avgUp:   currAvg  > prevAvg,
      projected,
      costSpark: spark.map((d) => d.cost),
      artsSpark: spark.map((d) => d.articles),
      avgSpark:  spark.map((d) => d.cost / Math.max(d.articles, 1)),
    };
  }, [filteredDays, prevDays]);

  // ── Quality KPI (from pipelineHistory entries in range) ──────────────────
  const qualStats = useMemo(() => {
    const currEntries = pipelineHistory.filter((e) => {
      const date = toDateStr(e.startedAt);
      return !currFromDate || date >= currFromDate;
    });
    const prevEntries = range !== "all"
      ? pipelineHistory.filter((e) => {
          const date = toDateStr(e.startedAt);
          return date >= (prevFromDate ?? "") && date < (currFromDate ?? "");
        })
      : [];

    const withScore = (entries: PipelineHistoryEntry[]) =>
      entries.filter((e): e is PipelineHistoryEntry & { qualityScore: number } =>
        e.qualityScore !== undefined,
      );

    const currQ = withScore(currEntries);
    const prevQ = withScore(prevEntries);

    const currAvg = currQ.length ? currQ.reduce((s, e) => s + e.qualityScore, 0) / currQ.length : 0;
    const prevAvg = prevQ.length ? prevQ.reduce((s, e) => s + e.qualityScore, 0) / prevQ.length : 0;

    const qualPct = prevAvg ? ((Math.abs(currAvg - prevAvg) / prevAvg) * 100).toFixed(1) : undefined;

    return {
      avg:     currAvg,
      qualPct,
      qualUp:  currAvg > prevAvg,
      spark:   currQ.slice(-14).map((e) => e.qualityScore),
    };
  }, [pipelineHistory, range, currFromDate, prevFromDate]);

  // ── Articles table ────────────────────────────────────────────────────────
  // Merge GitHub production pipeline entries (cost-history.jsonl) with
  // dashboard-triggered pipelineHistory entries. GitHub entries are primary;
  // pipelineHistory fills in dashboard-triggered runs not yet in the file.
  const articleRows = useMemo((): ArticleRow[] => {
    // Index WP posts by slug/title for URL fallback
    const wpBySlug = new Map<string, WpStats["recent"][number]>();
    if (wpStats) {
      for (const post of wpStats.recent) {
        wpBySlug.set(post.slug.toLowerCase(), post);
        wpBySlug.set(post.title.toLowerCase(), post);
      }
    }

    // Index GitHub articles by title (lowercase) and by slug for URL matching
    const ghByTitle = new Map<string, GithubArticle>();
    const ghBySlug  = new Map<string, GithubArticle>();
    if (ghArticles) {
      for (const a of ghArticles.articles) {
        ghByTitle.set(a.title.toLowerCase(), a);
        ghBySlug.set(a.slug.toLowerCase(), a);
      }
    }

    const rows: ArticleRow[] = [];

    // 1. Production pipeline entries from GitHub cost-history.jsonl
    if (ghCosts) {
      for (const entry of ghCosts.entries) {
        const dateStr = entry.date.slice(0, 10);

        // Resolve URL: entry.url first, then match by title in GitHub articles DB
        const ghMatch =
          ghByTitle.get(entry.title.toLowerCase()) ??
          (entry.slug ? ghBySlug.get(entry.slug.toLowerCase()) : undefined);
        const resolvedUrl = entry.url || ghMatch?.url;

        // Determine model from byModel keys if available, fall back to unknown
        const modelKeys = Object.keys(entry.byModel ?? {});
        const dominantModel =
          modelKeys.length === 1
            ? modelKeys[0]
            : modelKeys.find((k) => k.includes("sonnet")) ??
              modelKeys.find((k) => k.includes("haiku")) ??
              modelKeys[0] ??
              "unknown";

        rows.push({
          id: `gh-${entry.articleId ?? dateStr}-${entry.title.slice(0, 20)}`,
          date: dateStr,
          title: entry.title,
          totalCost: entry.totalCostUSD,
          tokensIn: entry.totalTokensIn ?? 0,
          tokensOut: entry.totalTokensOut ?? 0,
          totalCalls: entry.totalCalls || undefined,
          wordCount: entry.wordCount || undefined,
          costPerWord: entry.costPerWord || undefined,
          durationMs: entry.durationMs || undefined,
          llmTimeRatio: entry.llmTimeRatio || undefined,
          qualityScore: 0,
          status: resolvedUrl ? "published" : "review",
          model: dominantModel,
          url: resolvedUrl,
        });
      }
    }

    // 2. Dashboard-triggered pipeline history entries
    //    Deduplicate by title+date against GitHub entries already added
    const ghKeys = new Set(rows.map((r) => `${r.date}::${r.title.toLowerCase()}`));

    for (const entry of pipelineHistory) {
      const date = toDateStr(entry.startedAt);
      const titleKey = `${date}::${entry.topic.toLowerCase()}`;
      if (ghKeys.has(titleKey)) continue; // already present from GitHub data

      const topicKey = entry.topic.toLowerCase().replace(/\s+/g, "-");
      const wpPost = wpBySlug.get(topicKey) ?? wpBySlug.get(entry.topic.toLowerCase());

      const status: ArticleRow["status"] =
        entry.status === "done"
          ? entry.publishedUrl
            ? "published"
            : "review"
          : "failed";

      const estimatedTokens = entry.totalCost > 0
        ? Math.round((entry.totalCost / 0.00000125) * 0.8)
        : 0;

      rows.push({
        id: entry.id,
        date,
        title: wpPost?.title ?? entry.topic,
        totalCost: entry.totalCost,
        tokensIn:  Math.round(estimatedTokens * 0.7),
        tokensOut: Math.round(estimatedTokens * 0.3),
        qualityScore: entry.qualityScore ?? 0,
        status,
        model: MODEL_BY_TRACK[entry.track],
        url: entry.publishedUrl ?? wpPost?.url,
      });
    }

    return rows;
  }, [pipelineHistory, wpStats, ghCosts, ghArticles]);

  const filteredArticleRows = useMemo(() => {
    const filtered = range === "all"
      ? articleRows
      : articleRows.filter((a) => !currFromDate || a.date >= currFromDate);
    // Default sort: date descending (most recent first)
    return [...filtered].sort((a, b) => b.date.localeCompare(a.date));
  }, [articleRows, range, currFromDate]);

  const sortedArticles = useMemo(() => {
    return [...filteredArticleRows].sort((a, b) => {
      let cmp = 0;
      if (sortCol === "date")    cmp = a.date.localeCompare(b.date);
      else if (sortCol === "cost")    cmp = a.totalCost - b.totalCost;
      else if (sortCol === "quality") cmp = a.qualityScore - b.qualityScore;
      return sortAsc ? cmp : -cmp;
    });
  }, [filteredArticleRows, sortCol, sortAsc]);

  function toggleSort(col: "date" | "cost" | "quality") {
    if (sortCol === col) setSortAsc((v) => !v);
    else { setSortCol(col); setSortAsc(false); }
    setPage(0);
  }

  // Paginated slice of sorted articles
  const totalPages = Math.ceil(sortedArticles.length / PAGE_SIZE);
  const pagedArticles = sortedArticles.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const hasHistory = pipelineHistory.length > 0 || (ghCosts?.entries.length ?? 0) > 0;

  // ── Helper: aggregate byStep across a subset of entries ─────────────────
  function aggregateSteps(entries: CostEntry[], fromDate: string | null) {
    const agg: Record<string, { calls: number; tokensIn: number; tokensOut: number; cost: number }> = {};
    let count = 0;
    for (const entry of entries) {
      if (fromDate && entry.date.slice(0, 10) < fromDate) continue;
      count++;
      const byStep = entry.byStep as Record<string, { costUSD?: number; tokensIn?: number; tokensOut?: number; calls?: number }> | undefined;
      if (!byStep) continue;
      for (const [step, metrics] of Object.entries(byStep)) {
        if (!agg[step]) agg[step] = { calls: 0, tokensIn: 0, tokensOut: 0, cost: 0 };
        agg[step].calls    += metrics?.calls    ?? 0;
        agg[step].tokensIn  += metrics?.tokensIn  ?? 0;
        agg[step].tokensOut += metrics?.tokensOut ?? 0;
        agg[step].cost      += metrics?.costUSD   ?? 0;
      }
    }
    const totalCost = Object.values(agg).reduce((s, v) => s + v.cost, 0);
    const rows = Object.entries(agg)
      .map(([step, data]) => ({ step, ...data, pct: totalCost > 0 ? (data.cost / totalCost) * 100 : 0 }))
      .filter((s) => s.cost > 0)
      .sort((a, b) => b.cost - a.cost);
    return { rows, count };
  }

  // Cost by Pipeline Stage bar chart — always ALL-TIME data.
  // The bar chart shows the structural cost breakdown of the pipeline (which
  // steps cost most per article). Using all 154 runs gives a reliable baseline.
  // It should NOT change when the range filter is switched — that would be
  // misleading because short windows have too few samples.
  const realStageCosts = useMemo(() => {
    if (!ghCosts?.entries.length) return [];
    const { rows, count } = aggregateSteps(ghCosts.entries, null); // null = no date filter
    const n = Math.max(count, 1);
    return rows.map((r) => ({ stage: r.step, cost: r.cost / n, total: r.cost }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghCosts]);

  // Pipeline Step Breakdown table — filtered by selected range (user-requested).
  // Shows calls / tokens / cost for the selected period for deeper analysis.
  const realStepDetails = useMemo(() => {
    const empty = { rows: [] as { step: string; calls: number; tokensIn: number; tokensOut: number; cost: number; pct: number }[], count: 0 };
    if (!ghCosts?.entries.length) return empty;
    return aggregateSteps(ghCosts.entries, currFromDate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghCosts, currFromDate]);

  return (
    <div className="p-6 space-y-6 overflow-auto h-full max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Cost Tracker</h1>
          <p className="text-sm text-zinc-500 mt-0.5">LLM and infrastructure spend analytics</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Forecast pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/30 border border-amber-800/40 text-amber-400 text-xs">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="font-medium">Proj. month-end:</span>
            <span className="font-bold">${rangeStats.projected.toFixed(2)}</span>
          </div>

          {/* Comparison toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowComparison(v => !v)}
            className={`h-7 px-3 text-xs transition-colors ${showComparison ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-white hover:bg-zinc-800"}`}
          >
            vs prev period
          </Button>

          {/* Range filter */}
          <div className="flex items-center gap-0.5 bg-zinc-900 border border-zinc-800/80 rounded-lg p-1">
            {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
              <Button
                key={r}
                variant="ghost"
                size="sm"
                onClick={() => { setRange(r); setPage(0); }}
                className={`h-6 px-2.5 text-xs rounded-md transition-colors ${
                  range === r
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-500 hover:text-white hover:bg-zinc-800"
                }`}
              >
                {RANGE_LABELS[r]}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Live suggestions cost banner */}
      {suggestionsCost && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-950/30 border border-violet-800/40">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-violet-500/10 shrink-0">
            <Zap className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-white">
              Trending Suggestions · today
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {suggestionsCost.callCount} Claude call{suggestionsCost.callCount > 1 ? "s" : ""} · real spend tracked from localStorage
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-violet-300 tabular-nums">
              ${suggestionsCost.totalUsd.toFixed(4)}
            </p>
            <p className="text-xs text-zinc-600">today</p>
          </div>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total Cost"
          value={`$${rangeStats.totalCost.toFixed(2)}`}
          trend={rangeStats.costPct !== undefined ? rangeStats.costPct + "%" : undefined}
          trendUp={rangeStats.costUp}
          positiveIsUp={false}
          icon={DollarSign}
          iconColor="text-amber-400"
          sparkData={rangeStats.costSpark}
          sparkColor="#f59e0b"
        />
        <KpiCard
          label="Articles Generated"
          value={String(rangeStats.totalArts)}
          trend={rangeStats.artsPct !== undefined ? rangeStats.artsPct + "%" : undefined}
          trendUp={rangeStats.artsUp}
          positiveIsUp={true}
          icon={FileText}
          iconColor="text-blue-400"
          sparkData={rangeStats.artsSpark}
          sparkColor="#60a5fa"
        />
        <KpiCard
          label="Avg Cost / Article"
          value={`$${rangeStats.avgCost.toFixed(3)}`}
          trend={rangeStats.avgPct !== undefined ? rangeStats.avgPct + "%" : undefined}
          trendUp={rangeStats.avgUp}
          positiveIsUp={false}
          icon={TrendingDown}
          iconColor="text-emerald-400"
          sparkData={rangeStats.avgSpark}
          sparkColor="#34d399"
        />
        <KpiCard
          label="Avg Quality Score"
          value={qualStats.avg > 0 ? `${qualStats.avg.toFixed(1)}` : "—"}
          trend={qualStats.qualPct !== undefined ? qualStats.qualPct + "%" : undefined}
          trendUp={qualStats.qualUp}
          positiveIsUp={true}
          icon={Star}
          iconColor="text-purple-400"
          sparkData={qualStats.spark}
          sparkColor="#a78bfa"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Area chart — cost over time */}
        <Card className="bg-zinc-900 border-zinc-800/80 xl:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-white">Cost Over Time</CardTitle>
              {showComparison && (
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-0.5 bg-amber-400 rounded" /> Current
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 border-t border-dashed border-zinc-500" /> Previous
                  </span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!hasHistory || filteredDays.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-zinc-600 text-sm">
                No pipeline runs yet in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.04} />
                    </linearGradient>
                    {showComparison && (
                      <linearGradient id="prevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#71717a" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#71717a" stopOpacity={0} />
                      </linearGradient>
                    )}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#52525b", fontSize: 10 }}
                    tickFormatter={(v: string) => v.slice(5)}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: "#52525b", fontSize: 10 }}
                    tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                    formatter={(value: unknown, name: unknown) => [
                      `$${(value as number).toFixed(3)}`,
                      name === "prevCost" ? "Prev period" : "Cost",
                    ]}
                    labelFormatter={(l: unknown) => `${l}`}
                  />
                  {showComparison && (
                    <Area
                      type="monotone"
                      dataKey="prevCost"
                      stroke="#52525b"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      fill="url(#prevGrad)"
                      dot={false}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="cost"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fill="url(#costGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: "#f59e0b", stroke: "#18181b", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Donut — model distribution */}
        <Card className="bg-zinc-900 border-zinc-800/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-white">Cost by Model</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {modelShares.length === 0 ? (
              <div className="flex items-center justify-center h-[160px] text-zinc-600 text-sm">
                No pipeline data yet
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={modelShares}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={68}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {modelShares.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={TOOLTIP_LABEL_STYLE}
                      itemStyle={TOOLTIP_ITEM_STYLE}
                      formatter={(value: unknown) => [`${value}%`, ""]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 w-full mt-1">
                  {modelShares.map((m) => (
                    <div key={m.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                        <span className="text-zinc-400 text-xs">{m.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-zinc-800 rounded-full h-1">
                          <div
                            className="h-1 rounded-full"
                            style={{ width: `${m.value}%`, backgroundColor: m.color }}
                          />
                        </div>
                        <span className="text-white font-semibold text-xs w-7 text-right tabular-nums">{m.value}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stage cost horizontal bar — avg per article, individual step granularity */}
      <Card className="bg-zinc-900 border-zinc-800/80">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-white">Cost by Pipeline Stage</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-500">avg per article · all time</span>
              <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-xs">
                {realStageCosts.length > 0 ? `${ghCosts?.entries.length ?? 0} runs` : "no data"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {realStageCosts.length === 0 ? (
            <div className="flex items-center justify-center h-[220px] text-zinc-600 text-xs">
              No production runs in this period
            </div>
          ) : (
          <ResponsiveContainer width="100%" height={Math.max(220, realStageCosts.length * 26)}>
            <BarChart data={realStageCosts} layout="vertical" margin={{ top: 0, right: 70, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: "#52525b", fontSize: 10 }}
                tickFormatter={(v: number) => `$${v.toFixed(4)}`}
              />
              <YAxis
                type="category"
                dataKey="stage"
                tick={{ fill: "#a1a1aa", fontSize: 10 }}
                width={185}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                formatter={(value: unknown, _name: unknown, props: unknown) => {
                  const entry = (props as { payload?: { total?: number } })?.payload;
                  const avg = value as number;
                  const total = entry?.total ?? 0;
                  return [
                    <span key="v">
                      <span className="text-amber-400 font-bold">${avg.toFixed(5)}</span>
                      <span className="text-zinc-500 ml-2 text-xs">avg · ${total.toFixed(4)} total</span>
                    </span>,
                    "Avg / article",
                  ];
                }}
              />
              <Bar dataKey="cost" radius={[0, 3, 3, 0]} label={{ position: "right", fill: "#71717a", fontSize: 9, formatter: (v: unknown) => `$${(v as number).toFixed(5)}` }}>
                {realStageCosts.map((_, i) => {
                  const palette = ["#f59e0b", "#6366f1", "#34d399", "#60a5fa", "#f472b6", "#a78bfa", "#fb923c", "#22d3ee"];
                  return <Cell key={i} fill={palette[i % palette.length]} fillOpacity={0.85} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* byStep detail table — calls, tokensIn, tokensOut, cost, % */}
      {realStepDetails.rows.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800/80">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-white">Pipeline Step Breakdown</CardTitle>
              <Badge variant="outline" className="border-emerald-800/50 text-emerald-500 text-xs">
                {RANGE_LABELS[range]} · {realStepDetails.count} run{realStepDetails.count !== 1 ? "s" : ""}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800/60">
                    <th className="px-4 py-2.5 text-left text-zinc-500 font-medium">Step</th>
                    <th className="px-4 py-2.5 text-right text-zinc-500 font-medium">Calls</th>
                    <th className="px-4 py-2.5 text-right text-zinc-500 font-medium">Tokens IN</th>
                    <th className="px-4 py-2.5 text-right text-zinc-500 font-medium">Tokens OUT</th>
                    <th className="px-4 py-2.5 text-right text-zinc-500 font-medium">Cost USD</th>
                    <th className="px-4 py-2.5 text-right text-zinc-500 font-medium w-40">% of total</th>
                  </tr>
                </thead>
                <tbody>
                  {realStepDetails.rows.map((row) => (
                    <tr key={row.step} className="border-b border-zinc-800/40 hover:bg-zinc-800/20 transition-colors">
                      <td className="px-4 py-2.5 text-zinc-200 font-medium">{row.step}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-500 tabular-nums">{row.calls.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-500 tabular-nums">{row.tokensIn.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-500 tabular-nums">{row.tokensOut.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-amber-400 font-medium tabular-nums">${row.cost.toFixed(4)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 bg-zinc-800 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-amber-500/70"
                              style={{ width: `${Math.max(2, row.pct)}%` }}
                            />
                          </div>
                          <span className="text-zinc-500 tabular-nums w-10 text-right">{row.pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Articles table */}
      <Card className="bg-zinc-900 border-zinc-800/80">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold text-white">
            Articles <span className="text-zinc-600 font-normal ml-1">({sortedArticles.length})</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {ghCostsLoading && (
              <Badge variant="outline" className="border-zinc-800 text-zinc-600 text-xs gap-1 animate-pulse">
                <Clock className="w-2.5 h-2.5" />
                loading production data…
              </Badge>
            )}
            {!ghCostsLoading && ghCosts && (
              <Badge variant="outline" className="border-emerald-800/60 bg-emerald-950/30 text-emerald-400 text-xs gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" />
                {ghCosts.entries.length} production runs
              </Badge>
            )}
            <Badge variant="outline" className="border-zinc-800 text-zinc-600 text-xs gap-1">
              <Zap className="w-2.5 h-2.5" />
              {sortedArticles.filter(a => a.status === "published").length} published
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800/60">
                  <th
                    className="px-4 py-2.5 text-left text-zinc-500 font-medium cursor-pointer hover:text-zinc-300 transition-colors"
                    onClick={() => toggleSort("date")}
                  >
                    <div className="flex items-center gap-1">Date <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-4 py-2.5 text-left text-zinc-500 font-medium">Title</th>
                  <th className="px-4 py-2.5 text-left text-zinc-500 font-medium">Model</th>
                  <th
                    className="px-4 py-2.5 text-right text-zinc-500 font-medium cursor-pointer hover:text-zinc-300 transition-colors"
                    onClick={() => toggleSort("cost")}
                  >
                    <div className="flex items-center justify-end gap-1">Cost <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-4 py-2.5 text-right text-zinc-500 font-medium">Tokens</th>
                  <th className="px-4 py-2.5 text-right text-zinc-500 font-medium">Calls</th>
                  <th className="px-4 py-2.5 text-right text-zinc-500 font-medium">Words</th>
                  <th className="px-4 py-2.5 text-right text-zinc-500 font-medium">$/1k w</th>
                  <th className="px-4 py-2.5 text-right text-zinc-500 font-medium">Duration</th>
                  <th className="px-4 py-2.5 text-right text-zinc-500 font-medium">LLM%</th>
                  <th
                    className="px-4 py-2.5 text-right text-zinc-500 font-medium cursor-pointer hover:text-zinc-300 transition-colors"
                    onClick={() => toggleSort("quality")}
                  >
                    <div className="flex items-center justify-end gap-1">Quality <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-4 py-2.5 text-left text-zinc-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {ghCostsLoading && sortedArticles.length === 0 ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-zinc-800/40 animate-pulse">
                      <td className="px-4 py-2.5"><div className="h-3 bg-zinc-800 rounded w-20" /></td>
                      <td className="px-4 py-2.5"><div className="h-3 bg-zinc-800 rounded w-48" /></td>
                      <td className="px-4 py-2.5"><div className="h-3 bg-zinc-800 rounded w-28" /></td>
                      <td className="px-4 py-2.5"><div className="h-3 bg-zinc-800 rounded w-12 ml-auto" /></td>
                      <td className="px-4 py-2.5"><div className="h-3 bg-zinc-800 rounded w-14 ml-auto" /></td>
                      <td className="px-4 py-2.5"><div className="h-3 bg-zinc-800 rounded w-8 ml-auto" /></td>
                      <td className="px-4 py-2.5"><div className="h-3 bg-zinc-800 rounded w-10 ml-auto" /></td>
                      <td className="px-4 py-2.5"><div className="h-3 bg-zinc-800 rounded w-10 ml-auto" /></td>
                      <td className="px-4 py-2.5"><div className="h-3 bg-zinc-800 rounded w-12 ml-auto" /></td>
                      <td className="px-4 py-2.5"><div className="h-3 bg-zinc-800 rounded w-8 ml-auto" /></td>
                      <td className="px-4 py-2.5"><div className="h-3 bg-zinc-800 rounded w-8 ml-auto" /></td>
                      <td className="px-4 py-2.5"><div className="h-5 bg-zinc-800 rounded w-16" /></td>
                    </tr>
                  ))
                ) : sortedArticles.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-zinc-600 text-xs">
                      {hasHistory ? "No articles in this period" : "No pipeline runs yet"}
                    </td>
                  </tr>
                ) : pagedArticles.map((article) => {
                  const sc = STATUS_CONFIG[article.status];
                  const totalTokens = (article.tokensIn ?? 0) + (article.tokensOut ?? 0);
                  const avgCost = sortedArticles.length > 3
                    ? sortedArticles.reduce((s, a) => s + a.totalCost, 0) / sortedArticles.length
                    : Infinity;
                  const isOutlier = article.totalCost > 0 && article.totalCost > avgCost * 2;
                  return (
                    <tr
                      key={article.id}
                      className={`border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors group ${isOutlier ? "bg-rose-950/20" : ""}`}
                    >
                      <td className="px-4 py-2.5 text-zinc-600 whitespace-nowrap tabular-nums">{article.date}</td>
                      <td className="px-4 py-2.5 text-zinc-200 max-w-[240px] group-hover:text-white transition-colors">
                        {article.url ? (
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 hover:text-amber-400 transition-colors"
                          >
                            <span className="truncate">{article.title}</span>
                            <ExternalLink className="w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100" />
                          </a>
                        ) : (
                          <span className="truncate block">{article.title}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500 whitespace-nowrap text-xs">{article.model}</td>
                      <td className="px-4 py-2.5 text-right text-amber-400 font-medium whitespace-nowrap tabular-nums">
                        ${article.totalCost.toFixed(4)}{isOutlier ? " ⚠" : ""}
                      </td>
                      <td className="px-4 py-2.5 text-right text-zinc-500 whitespace-nowrap tabular-nums">
                        {totalTokens > 0 ? totalTokens.toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-zinc-500 whitespace-nowrap tabular-nums">
                        {article.totalCalls ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-zinc-500 whitespace-nowrap tabular-nums">
                        {article.wordCount ? article.wordCount.toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-zinc-500 whitespace-nowrap tabular-nums">
                        {article.costPerWord ? `$${(article.costPerWord * 1000).toFixed(3)}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-zinc-500 whitespace-nowrap tabular-nums">
                        {article.durationMs ? `${(article.durationMs / 60000).toFixed(1)}m` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-zinc-500 whitespace-nowrap tabular-nums">
                        {article.llmTimeRatio ? `${(article.llmTimeRatio * 100).toFixed(0)}%` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {article.qualityScore > 0 ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="w-10 bg-zinc-800 rounded-full h-1">
                              <div
                                className={`h-1 rounded-full ${
                                  article.qualityScore >= 85 ? "bg-emerald-500" :
                                  article.qualityScore >= 75 ? "bg-amber-500" : "bg-rose-500"
                                }`}
                                style={{ width: `${article.qualityScore}%` }}
                              />
                            </div>
                            <span className={`font-semibold tabular-nums ${
                              article.qualityScore >= 85 ? "text-emerald-400" :
                              article.qualityScore >= 75 ? "text-amber-400" : "text-rose-400"
                            }`}>
                              {article.qualityScore}
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={`text-xs gap-1 ${sc.color}`}>
                          <sc.icon className="w-2.5 h-2.5" />
                          {sc.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Pagination footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800/60">
              <span className="text-xs text-zinc-600">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sortedArticles.length)} of {sortedArticles.length} articles
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
                {Array.from({ length: totalPages }).map((_, i) => (
                  <Button
                    key={i}
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage(i)}
                    className={`h-7 w-7 p-0 text-xs rounded-md transition-colors ${
                      i === page
                        ? "bg-zinc-700 text-white"
                        : "text-zinc-500 hover:text-white hover:bg-zinc-800"
                    }`}
                  >
                    {i + 1}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                  className="h-7 w-7 p-0 text-zinc-500 hover:text-white disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
