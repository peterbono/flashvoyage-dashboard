"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { frShareTextColor } from "./FRShareBadge";

export interface ArticleScore {
  id: string | number;
  title: string;
  slug?: string;
  url?: string;
  score: number;
  lifecycle: "NEW" | "GROWING" | "PEAK" | "DECLINING" | "EVERGREEN" | "DEAD";
  traffic7d: number;
  /** ISO publish date from WordPress, e.g. "2026-03-31T16:22:55" */
  publishedAt?: string;
  actionsCount: number;
  scoreBreakdown?: {
    seo: number;
    content: number;
    freshness: number;
    engagement: number;
    monetization: number;
    technical: number;
  };
  recommendedActions?: string[];
  /**
   * Phase 1 FR-share metadata (content repo feat/fr-share-scoring).
   * `null` = intentionally absent; `undefined` = content repo hasn't shipped.
   * Rendered as "—" in the FR % column; sortable separately.
   */
  frShare?: number | null;
  frPageviews?: number;
}

interface Props {
  articles: ArticleScore[];
  loading: boolean;
  error: string | null;
}

const LIFECYCLE_STYLES: Record<string, string> = {
  NEW: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  GROWING: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  PEAK: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  DECLINING: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  EVERGREEN: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  DEAD: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

function formatPublishedAt(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function ScoreBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color =
    value >= 80
      ? "bg-emerald-500"
      : value >= 60
        ? "bg-amber-500"
        : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 bg-zinc-800 rounded-full overflow-hidden max-w-[60px]">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono tabular-nums text-zinc-300 w-7 text-right">
        {value}
      </span>
    </div>
  );
}

function ExpandedRow({ article }: { article: ArticleScore }) {
  const bd = article.scoreBreakdown;
  return (
    <TableRow className="border-zinc-800/40 bg-zinc-900/60">
      <TableCell colSpan={7} className="py-3 px-3 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Score breakdown */}
          {bd && (
            <div>
              <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-2">
                Score breakdown
              </p>
              <div className="space-y-1.5">
                {Object.entries(bd).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 w-24 capitalize">
                      {key}
                    </span>
                    <ScoreBar value={val} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended actions */}
          {article.recommendedActions && article.recommendedActions.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-2">
                Recommended actions
              </p>
              <ul className="space-y-1">
                {article.recommendedActions.map((action, i) => (
                  <li
                    key={i}
                    className="text-xs text-zinc-400 flex items-start gap-1.5"
                  >
                    <span className="text-amber-500 mt-0.5 shrink-0">&#8226;</span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function ArticleScoreTable({ articles, loading, error }: Props) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | number | null>(null);
  // Top-of-table global sort toggle (existing). FR column sort is opt-in
  // and local — see `frSortDir` below, which is mutually exclusive with
  // this one so clicking either surface resets the other.
  const [sortBy, setSortBy] = useState<"score" | "traffic" | "frShare">("score");
  // Direction toggle for the FR column header. `null` = FR sort inactive
  // (fall back to score/traffic); "desc" / "asc" = active with direction.
  const [frSortDir, setFrSortDir] = useState<"asc" | "desc" | null>(null);
  const [lifecycleFilter, setLifecycleFilter] = useState<string>("all");

  const handleFrSortClick = () => {
    // Cycle: inactive → desc → asc → inactive (back to default sort).
    setFrSortDir((prev) => (prev === null ? "desc" : prev === "desc" ? "asc" : null));
    setSortBy("frShare");
  };

  const filtered = useMemo(() => {
    let list = articles;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.title.toLowerCase().includes(q));
    }
    if (lifecycleFilter !== "all") {
      list = list.filter((a) => a.lifecycle.toUpperCase() === lifecycleFilter.toUpperCase());
    }
    return [...list].sort((a, b) => {
      if (sortBy === "frShare" && frSortDir !== null) {
        // Articles with no FR data sink to the bottom regardless of direction
        // — the column's "—" placeholder has no meaningful numeric rank.
        const aHas = typeof a.frShare === "number";
        const bHas = typeof b.frShare === "number";
        if (!aHas && !bHas) return 0;
        if (!aHas) return 1;
        if (!bHas) return -1;
        const diff = (a.frShare as number) - (b.frShare as number);
        return frSortDir === "desc" ? -diff : diff;
      }
      return sortBy === "traffic"
        ? b.traffic7d - a.traffic7d
        : b.score - a.score;
    });
  }, [articles, search, sortBy, frSortDir, lifecycleFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-zinc-500 text-xs gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading article scores...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-zinc-600 py-8 text-center">
        Scoring data unavailable. The article-scores.json file has not been generated yet.
      </div>
    );
  }

  const lifecycles = ["all", "NEW", "GROWING", "PEAK", "DECLINING", "EVERGREEN", "DEAD"];

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 flex-wrap">
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter articles..."
            className="bg-zinc-900 border-zinc-700 text-white text-xs h-7 pl-8 w-full sm:w-52 placeholder:text-zinc-600"
          />
        </div>

        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 overflow-x-auto max-w-full">
          {lifecycles.map((lc) => (
            <Button
              key={lc}
              variant="ghost"
              size="xs"
              onClick={() => setLifecycleFilter(lc)}
              className={`h-5 px-1.5 text-[10px] rounded-md transition-colors shrink-0 ${
                lifecycleFilter === lc
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-500 hover:text-white hover:bg-zinc-800"
              }`}
            >
              {lc === "all" ? "All" : lc}
            </Button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="xs"
          onClick={() => {
            // Clicking the global toggle always exits FR-sort mode so the
            // header arrow stays in sync with the active sort field.
            setFrSortDir(null);
            setSortBy((prev) =>
              prev === "score" ? "traffic" : prev === "traffic" ? "score" : "score",
            );
          }}
          className="text-zinc-500 hover:text-white text-xs gap-1 sm:ml-auto"
        >
          <ArrowUpDown className="w-3 h-3" />
          {sortBy === "traffic" ? "By traffic" : "By score"}
        </Button>
      </div>

      {/* Table */}
      <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800/60 hover:bg-transparent">
              <TableHead className="text-zinc-500 text-xs font-medium w-8" />
              <TableHead className="text-zinc-500 text-xs font-medium">Title</TableHead>
              <TableHead className="text-zinc-500 text-xs font-medium w-20">Published</TableHead>
              <TableHead className="text-zinc-500 text-xs font-medium w-16 text-right">Score</TableHead>
              <TableHead className="text-zinc-500 text-xs font-medium w-24">Lifecycle</TableHead>
              <TableHead className="text-zinc-500 text-xs font-medium w-20 text-right">Traffic 7d</TableHead>
              <TableHead className="text-zinc-500 text-xs font-medium w-20 text-right">
                {/* FR share — sortable. Cycles desc → asc → inactive.
                    Keyboard users get the same toggle via Enter/Space on the button. */}
                <button
                  type="button"
                  onClick={handleFrSortClick}
                  aria-label={
                    sortBy === "frShare" && frSortDir
                      ? `FR share column, sorted ${frSortDir}ending. Click to change sort.`
                      : "Sort by FR share"
                  }
                  title={
                    sortBy === "frShare" && frSortDir === "desc"
                      ? "FR share desc — click for asc"
                      : sortBy === "frShare" && frSortDir === "asc"
                        ? "FR share asc — click to clear"
                        : "Click to sort by FR share"
                  }
                  className="inline-flex items-center gap-1 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm"
                >
                  <span aria-hidden="true">🇫🇷</span> FR %
                  {sortBy === "frShare" && frSortDir === "desc" ? (
                    <ArrowDown className="w-3 h-3" aria-hidden="true" />
                  ) : sortBy === "frShare" && frSortDir === "asc" ? (
                    <ArrowUp className="w-3 h-3" aria-hidden="true" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-50" aria-hidden="true" />
                  )}
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="border-zinc-800/40">
                <TableCell colSpan={7} className="text-xs text-zinc-600 text-center py-6">
                  No articles match the filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((article) => {
                const isExpanded = expandedId === article.id;
                const scoreColor =
                  article.score >= 80
                    ? "text-emerald-400"
                    : article.score >= 60
                      ? "text-amber-400"
                      : "text-rose-400";
                return (
                  <>
                    <TableRow
                      key={article.id}
                      className="border-zinc-800/40 hover:bg-zinc-800/30 cursor-pointer"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : article.id)
                      }
                    >
                      <TableCell className="pr-0">
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3 text-zinc-500" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-zinc-500" />
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-200 max-w-md">
                        <div className="flex items-center gap-1.5 group/title">
                          {article.slug ? (
                            <a
                              href={`https://flashvoyage.com/${article.slug}/`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="truncate hover:underline"
                            >
                              {article.title}
                            </a>
                          ) : (
                            <span className="truncate">{article.title}</span>
                          )}
                          {(article.slug || article.url) && (
                            <a
                              href={article.url || `https://flashvoyage.com/${article.slug}/`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="shrink-0 opacity-0 group-hover/title:opacity-100 transition-opacity"
                            >
                              <ExternalLink className="w-3 h-3 text-zinc-600 hover:text-amber-400 transition-colors" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono text-zinc-500 tabular-nums whitespace-nowrap">
                          {formatPublishedAt(article.publishedAt)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`text-xs font-mono font-semibold tabular-nums ${scoreColor}`}
                        >
                          {article.score}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 h-4 ${LIFECYCLE_STYLES[article.lifecycle] || ""}`}
                        >
                          {article.lifecycle}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-xs font-mono text-zinc-400 tabular-nums">
                          {article.traffic7d >= 1000
                            ? `${((article.traffic7d ?? 0) / 1000).toFixed(1)}k`
                            : article.traffic7d}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {typeof article.frShare === "number" ? (
                          <span
                            className={`text-xs font-mono tabular-nums ${frShareTextColor(article.frShare)}`}
                            title={
                              typeof article.frPageviews === "number" && article.frPageviews > 0
                                ? `${Math.round(article.frShare * 100)}% of ${article.frPageviews.toLocaleString("en-US")} tracked pageviews`
                                : `${Math.round(article.frShare * 100)}% FR share`
                            }
                          >
                            {Math.round(article.frShare * 100)}%
                          </span>
                        ) : (
                          <span className="text-xs font-mono text-zinc-600 tabular-nums" aria-label="No FR data">
                            —
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <ExpandedRow
                        key={`${article.id}-expanded`}
                        article={article}
                      />
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>
      </div>
    </div>
  );
}
