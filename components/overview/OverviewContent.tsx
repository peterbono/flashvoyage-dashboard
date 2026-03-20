"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  FileText, GitBranch, DollarSign, TrendingUp, TrendingDown,
  Zap, CheckSquare, Star, Globe, ArrowRight, Database, AlertCircle,
  ExternalLink,
} from "lucide-react";
import { COLUMNS, KanbanCard } from "@/components/kanban/mockKanbanData";
import { useAppStore } from "@/lib/store";
import { WeeklyThroughputChart } from "@/components/overview/WeeklyThroughputChart";
import { TrendingSuggestions } from "@/components/overview/TrendingSuggestions";

type Range = "today" | "7d" | "30d" | "90d";
const RANGE_DAYS: Record<Range, number> = { today: 1, "7d": 7, "30d": 30, "90d": 90 };
const RANGE_LABELS: Record<Range, string> = { today: "Today", "7d": "7d", "30d": "30d", "90d": "90d" };

const colDotColor: Record<string, string> = {
  published: "bg-emerald-500",
  review: "bg-orange-500",
  generating: "bg-amber-500",
  queued: "bg-violet-500",
  sourced: "bg-blue-500",
};

interface Article {
  id: number;
  title: string;
  date: string;
  url: string;
  slug: string;
}

interface GithubArticlesResponse {
  articles: Article[];
  total: number;
  fetchedAt: string;
}

interface Props {
  publishedCards: KanbanCard[];
  isLive: boolean;
  crawledAt: string | null;
}

export function OverviewContent({ isLive, crawledAt }: Props) {
  const [range, setRange] = useState<Range>("30d");

  // Zustand store — real data
  const kanbanCards = useAppStore((s) => s.kanbanCards);
  const taskItems = useAppStore((s) => s.taskItems);
  const pipelineHistory = useAppStore((s) => s.pipelineHistory);

  // GitHub articles state (full database, auto-updated after every pipeline run)
  const [ghArticles, setGhArticles] = useState<GithubArticlesResponse | null>(null);
  const [wpLoading, setWpLoading] = useState(true);
  const [wpError, setWpError] = useState(false);

  // GitHub costs state (real production cost-history.jsonl)
  interface GhCostEntry { date: string; totalCostUSD: number; title: string; url?: string }
  const [ghCosts, setGhCosts] = useState<GhCostEntry[]>([]);

  // Viz-events state for quality scores (marie.score from MARIE panel)
  const [avgQuality, setAvgQuality] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setWpLoading(true);
    setWpError(false);

    fetch("/api/github/articles")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<GithubArticlesResponse>;
      })
      .then((data) => { if (!cancelled) { setGhArticles(data); setWpLoading(false); } })
      .catch(() => { if (!cancelled) { setWpError(true); setWpLoading(false); } });

    fetch("/api/github/costs")
      .then((r) => r.ok ? r.json() : null)
      .then((data: { entries?: GhCostEntry[] } | null) => {
        if (!cancelled && data?.entries) setGhCosts(data.entries);
      })
      .catch(() => {});

    // Fetch viz-events to get MARIE quality scores
    fetch("/api/github/viz-events")
      .then((r) => r.ok ? r.json() : null)
      .then((data: { events?: { stages?: { agent?: string; score?: number }[] }[] } | null) => {
        if (!cancelled && data?.events?.length) {
          const scores: number[] = [];
          for (const evt of data.events) {
            for (const stage of (evt.stages ?? [])) {
              if (stage.agent === "marie" && typeof stage.score === "number") {
                scores.push(stage.score);
              }
            }
          }
          if (scores.length > 0) {
            setAvgQuality(Math.round(scores.reduce((s, v) => s + v, 0) / scores.length * 10) / 10);
          }
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  // Cutoff date for the selected range
  const cutoffDate = useMemo(() => {
    const d = new Date();
    if (range !== "today") d.setDate(d.getDate() - RANGE_DAYS[range]);
    return d.toISOString().slice(0, 10);
  }, [range]);

  // GitHub articles filtered by range
  const filteredWpArticles = useMemo(() => {
    if (!ghArticles) return [];
    return ghArticles.articles
      .filter((a) => a.date.slice(0, 10) >= cutoffDate)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6);
  }, [ghArticles, cutoffDate]);

  // Published Articles KPI: total from GitHub articles database
  const publishedKpiValue = useMemo(() => {
    if (ghArticles) return ghArticles.total;
    return 0;
  }, [ghArticles]);

  // Cost stats — real GitHub production costs, 0 if not loaded yet
  const costStats = useMemo(() => {
    const n = range === "today" ? 1 : RANGE_DAYS[range];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - n);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);

    const prevCutoff = new Date();
    prevCutoff.setDate(prevCutoff.getDate() - n * 2);
    const prevCutoffStr = prevCutoff.toISOString().slice(0, 10);

    const curr = ghCosts.filter((e) => e.date.slice(0, 10) >= cutoffStr);
    const prev = ghCosts.filter((e) => {
      const d = e.date.slice(0, 10);
      return d >= prevCutoffStr && d < cutoffStr;
    });

    const currCost = curr.reduce((s, e) => s + (e.totalCostUSD ?? 0), 0);
    const prevCost = prev.reduce((s, e) => s + (e.totalCostUSD ?? 0), 0);
    const currArts = curr.length;
    const prevArts = prev.length;
    const artsTrend = prevArts ? ((Math.abs(currArts - prevArts) / prevArts) * 100).toFixed(1) : null;
    const costTrend = prevCost ? ((Math.abs(currCost - prevCost) / prevCost) * 100).toFixed(1) : null;
    return { currCost, currArts, artsTrend, artsTrendUp: currArts > prevArts, costTrend, costTrendUp: currCost > prevCost };
  }, [range, ghCosts]);

  // Pipeline bar — from Zustand kanbanCards
  const pipelineByColumn = useMemo(() => {
    return COLUMNS.map((col) => ({
      ...col,
      count: kanbanCards.filter((c) => c.column === col.id).length,
    }));
  }, [kanbanCards]);

  const totalForBar = useMemo(() => kanbanCards.length, [kanbanCards]);

  // Tasks summary — from Zustand taskItems
  const tasksDone = useMemo(
    () => taskItems.filter((t) => t.column === "done").length,
    [taskItems]
  );
  const tasksPct = useMemo(
    () => (taskItems.length > 0 ? Math.round((tasksDone / taskItems.length) * 100) : 0),
    [tasksDone, taskItems]
  );
  const urgentTasks = useMemo(
    () => taskItems.filter((t) => t.priority === "urgent" && t.column !== "done"),
    [taskItems]
  );

  const stats = [
    {
      label: "Published Articles",
      value: wpLoading ? "…" : publishedKpiValue.toLocaleString("en-US"),
      sub: wpLoading
        ? "loading…"
        : wpError
        ? "GitHub unavailable"
        : isLive
        ? `synced ${crawledAt?.slice(0, 10) ?? ghArticles?.fetchedAt?.slice(0, 10) ?? "—"}`
        : "from GitHub",
      icon: FileText,
      accent: "text-emerald-500",
      accentBg: "bg-emerald-500/10 dark:bg-emerald-500/10",
      href: "/content",
      live: !wpError && !wpLoading,
      trendPct: costStats.artsTrend,
      trendUp: costStats.artsTrendUp,
      positiveIsUp: true,
    },
    {
      label: "In Pipeline",
      value: (kanbanCards.filter((c) => c.column !== "published").length).toString(),
      sub: `across ${COLUMNS.length} stages`,
      icon: GitBranch,
      accent: "text-blue-500",
      accentBg: "bg-blue-500/10",
      href: "/pipeline",
      live: true,
      trendPct: null,
      trendUp: false,
      positiveIsUp: true,
    },
    {
      label: `LLM Cost (${RANGE_LABELS[range]})`,
      value: `$${costStats.currCost.toFixed(2)}`,
      sub: `${costStats.currArts} articles in period`,
      icon: DollarSign,
      accent: "text-amber-500",
      accentBg: "bg-amber-500/10",
      href: "/costs",
      live: pipelineHistory.length > 0,
      trendPct: costStats.costTrend,
      trendUp: costStats.costTrendUp,
      positiveIsUp: false,
    },
    {
      label: "Avg Quality Score",
      value: avgQuality !== null ? `${avgQuality}` : "—",
      sub: avgQuality !== null ? "MARIE panel · production runs" : "No MARIE scores yet",
      icon: Star,
      accent: "text-violet-500",
      accentBg: "bg-violet-500/10",
      href: "/costs",
      live: avgQuality !== null,
      trendPct: null,
      trendUp: false,
      positiveIsUp: true,
    },
  ];

  return (
    <div className="p-6 space-y-6 w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">
            Overview
          </h1>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-0.5">
            FlashVoyage content pipeline
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Range filter */}
          <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800/80 rounded-lg p-0.5">
            {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`h-6 px-2.5 text-xs rounded-md transition-colors font-medium ${
                  range === r
                    ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300"
                }`}
              >
                {RANGE_LABELS[r]}
              </button>
            ))}
          </div>

          {isLive ? (
            <Badge
              variant="outline"
              className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-400 gap-1.5 text-xs"
            >
              <Database className="w-2.5 h-2.5" />
              GitHub live
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-400 gap-1.5 text-xs"
            >
              <Zap className="w-2.5 h-2.5" />
              Mock data
            </Badge>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {stats.map(({ label, value, sub, icon: Icon, accent, accentBg, href, live, trendPct, trendUp, positiveIsUp }) => {
          const isGood = trendPct ? trendUp === positiveIsUp : null;
          const TrendIcon = trendUp ? TrendingUp : TrendingDown;
          return (
            <Link key={label} href={href} className="block group">
              <div className="relative rounded-xl border bg-white dark:bg-zinc-900/40 border-gray-200 dark:border-zinc-800/50 p-4 hover:border-gray-300 dark:hover:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-900/70 transition-all duration-200 h-full">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[13px] font-medium text-gray-500 dark:text-zinc-400">{label}</p>
                  <div className={`p-1.5 rounded-lg ${accentBg}`}>
                    <Icon className={`w-3.5 h-3.5 ${accent}`} />
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight tabular-nums leading-none mb-2">
                  {value}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] text-gray-400 dark:text-zinc-600 flex-1 leading-tight">{sub}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!live && (
                      <span className="text-xs text-gray-300 dark:text-zinc-700 border border-gray-200 dark:border-zinc-800 rounded px-1 py-px">
                        mock
                      </span>
                    )}
                    {trendPct && (
                      <span className={`flex items-center gap-0.5 text-[12px] font-medium ${isGood ? "text-emerald-500" : "text-rose-500"}`}>
                        <TrendIcon className="w-3 h-3" />
                        {trendPct}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Main content row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Recent articles — from GitHub articles database */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border bg-white dark:bg-zinc-900/40 border-gray-200 dark:border-zinc-800/50 overflow-hidden h-full">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800/50">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-gray-900 dark:text-white">Recent Articles</span>
                <span className="text-xs text-gray-400 dark:text-zinc-600">{RANGE_LABELS[range]}</span>
                {!wpLoading && !wpError && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded px-1.5 py-px">
                    live
                  </span>
                )}
              </div>
              <Link
                href="/content"
                className="flex items-center gap-1 text-[12px] text-gray-400 dark:text-zinc-600 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors"
              >
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-zinc-800/40">
              {wpLoading ? (
                // Loading skeleton
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5 animate-pulse">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="h-3 bg-gray-100 dark:bg-zinc-800 rounded w-3/4" />
                      <div className="h-2.5 bg-gray-100 dark:bg-zinc-800 rounded w-1/3" />
                    </div>
                    <div className="h-5 w-16 bg-gray-100 dark:bg-zinc-800 rounded shrink-0" />
                  </div>
                ))
              ) : wpError ? (
                <p className="px-4 py-6 text-xs text-gray-400 dark:text-zinc-600 text-center">
                  GitHub unavailable — check network
                </p>
              ) : filteredWpArticles.length === 0 ? (
                <p className="px-4 py-6 text-xs text-gray-400 dark:text-zinc-600 text-center">
                  No articles in this period
                </p>
              ) : filteredWpArticles.map((article) => (
                <div
                  key={article.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 group/link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="text-[13px] font-medium text-gray-800 dark:text-zinc-200 truncate group-hover/link:text-amber-600 dark:group-hover/link:text-amber-400 transition-colors">
                        {article.title}
                      </p>
                      <ExternalLink className="w-3 h-3 text-gray-300 dark:text-zinc-700 shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                    </a>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400 dark:text-zinc-600 flex items-center gap-0.5">
                        <Globe className="w-2.5 h-2.5" />
                        FlashVoyage
                      </span>
                      <span className="text-xs text-gray-300 dark:text-zinc-700">
                        {article.date.slice(5, 10)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant="outline"
                      className="text-xs px-1.5 py-px border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-400"
                    >
                      published
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-3">
          {/* Pipeline status — from Zustand kanbanCards */}
          <div className="rounded-xl border bg-white dark:bg-zinc-900/40 border-gray-200 dark:border-zinc-800/50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800/50">
              <span className="text-[13px] font-semibold text-gray-900 dark:text-white">Pipeline</span>
              <Link
                href="/pipeline"
                className="flex items-center gap-1 text-[12px] text-gray-400 dark:text-zinc-600 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors"
              >
                View <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="px-4 py-3 space-y-2.5">
              {pipelineByColumn.map((col) => (
                <div key={col.id} className="flex items-center gap-2.5">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${colDotColor[col.id] ?? "bg-zinc-500"}`} />
                  <span className={`text-[12px] font-medium w-20 shrink-0 ${col.color}`}>{col.label}</span>
                  <div className="flex-1 bg-gray-100 dark:bg-zinc-800/60 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${colDotColor[col.id] ?? "bg-zinc-500"}`}
                      style={{ width: `${(col.count / Math.max(totalForBar, 1)) * 100}%` }}
                    />
                  </div>
                  <span className="text-[12px] text-gray-400 dark:text-zinc-600 w-5 text-right tabular-nums">{col.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tasks — from Zustand taskItems */}
          <div className="rounded-xl border bg-white dark:bg-zinc-900/40 border-gray-200 dark:border-zinc-800/50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800/50">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-semibold text-gray-900 dark:text-white">Sprint Tasks</span>
              </div>
              <Link
                href="/tasks"
                className="flex items-center gap-1 text-[12px] text-gray-400 dark:text-zinc-600 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors"
              >
                View <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="px-4 py-3 space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-gray-500 dark:text-zinc-500">{tasksDone} of {taskItems.length} done</span>
                  <span className="font-semibold text-gray-700 dark:text-zinc-300 tabular-nums">{tasksPct}%</span>
                </div>
                <div className="bg-gray-100 dark:bg-zinc-800/60 rounded-full h-1.5">
                  <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${tasksPct}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "In progress", value: taskItems.filter((t) => t.column === "in_progress").length, color: "text-blue-500 dark:text-blue-400" },
                  { label: "Done", value: tasksDone, color: "text-emerald-500 dark:text-emerald-400" },
                  { label: "Queued", value: taskItems.filter((t) => t.column === "backlog").length, color: "text-gray-500 dark:text-zinc-400" },
                  { label: "Urgent", value: urgentTasks.length, color: urgentTasks.length > 0 ? "text-rose-500 dark:text-rose-400" : "text-gray-400 dark:text-zinc-600" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-gray-50 dark:bg-zinc-800/40 rounded-lg px-2.5 py-2 border border-gray-100 dark:border-zinc-800/60">
                    <div className="text-xs text-gray-400 dark:text-zinc-600 mb-0.5">{label}</div>
                    <div className={`text-[15px] font-semibold tabular-nums ${color}`}>{value}</div>
                  </div>
                ))}
              </div>
              {urgentTasks.length > 0 && (
                <div className="border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 text-xs font-medium mb-1">
                    <AlertCircle className="w-3 h-3" />
                    Needs attention
                  </div>
                  {urgentTasks.slice(0, 2).map((t) => (
                    <p key={t.id} className="text-xs text-gray-500 dark:text-zinc-500 truncate">{t.title}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Weekly throughput chart */}
      <div className="rounded-xl border bg-white dark:bg-zinc-900/40 border-gray-200 dark:border-zinc-800/50 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800/50">
          <span className="text-[13px] font-semibold text-gray-900 dark:text-white">
            Throughput
          </span>
          <div className="flex items-center gap-3 text-[12px] text-gray-400 dark:text-zinc-500">
            <span>
              <span className="tabular-nums font-semibold text-amber-600 dark:text-amber-400">{costStats.currArts}</span>
              {" "}articles · {RANGE_LABELS[range]}
            </span>
            {costStats.artsTrend && (
              <span className={`flex items-center gap-1 font-medium ${costStats.artsTrendUp ? "text-emerald-500" : "text-rose-500"}`}>
                {costStats.artsTrendUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {costStats.artsTrend}% vs prev
              </span>
            )}
          </div>
        </div>
        <div className="px-2 py-2">
          <WeeklyThroughputChart data={(() => {
            // Build last 7 days from real GitHub cost entries
            const days: { day: string; articles: number; cost: number }[] = [];
            for (let i = 6; i >= 0; i--) {
              const d = new Date();
              d.setDate(d.getDate() - i);
              const dateStr = d.toISOString().slice(0, 10);
              const entries = ghCosts.filter((e) => e.date.slice(0, 10) === dateStr);
              days.push({ day: dateStr.slice(5), articles: entries.length, cost: entries.reduce((s, e) => s + (e.totalCostUSD ?? 0), 0) });
            }
            return days;
          })()} />
        </div>
      </div>

      {/* Trending Opportunities */}
      <TrendingSuggestions />

      {/* Quick actions row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { href: "/content", icon: FileText, label: "Add Article", desc: "Queue or generate content", accent: "group-hover:text-amber-500 dark:group-hover:text-amber-400", iconColor: "text-amber-500" },
          { href: "/pipeline", icon: GitBranch, label: "View Pipeline", desc: "Monitor generation stages", accent: "group-hover:text-blue-500 dark:group-hover:text-blue-400", iconColor: "text-blue-500" },
          { href: "/tasks", icon: CheckSquare, label: "Sprint Board", desc: "Track ops & dev tasks", accent: "group-hover:text-emerald-500 dark:group-hover:text-emerald-400", iconColor: "text-emerald-500" },
        ].map(({ href, icon: Icon, label, desc, accent, iconColor }) => (
          <Link key={href} href={href} className="group block">
            <div className="rounded-xl border bg-white dark:bg-zinc-900/40 border-gray-200 dark:border-zinc-800/50 px-4 py-3 hover:border-gray-300 dark:hover:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-900/70 transition-all duration-200 flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-gray-50 dark:bg-zinc-800/60 ${iconColor}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className={`text-[13px] font-medium text-gray-900 dark:text-zinc-200 transition-colors ${accent}`}>{label}</p>
                <p className="text-xs text-gray-400 dark:text-zinc-600">{desc}</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-gray-300 dark:text-zinc-700 ml-auto group-hover:text-gray-500 dark:group-hover:text-zinc-400 transition-colors shrink-0" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
