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
} from "lucide-react";

export interface ArticleScore {
  id: string | number;
  title: string;
  url?: string;
  score: number;
  lifecycle: "NEW" | "GROWING" | "PEAK" | "DECLINING" | "EVERGREEN" | "DEAD";
  traffic7d: number;
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
      <TableCell colSpan={5} className="py-3 px-3 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Score breakdown */}
          {bd && (
            <div>
              <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-2">
                Decomposition du score
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
                Actions recommandees
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
  const [sortBy, setSortBy] = useState<"score" | "traffic">("score");
  const [lifecycleFilter, setLifecycleFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    let list = articles;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.title.toLowerCase().includes(q));
    }
    if (lifecycleFilter !== "all") {
      list = list.filter((a) => a.lifecycle === lifecycleFilter);
    }
    return [...list].sort((a, b) =>
      sortBy === "score" ? b.score - a.score : b.traffic7d - a.traffic7d
    );
  }, [articles, search, sortBy, lifecycleFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-zinc-500 text-xs gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Chargement des scores articles...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-zinc-600 py-8 text-center">
        Donnees de scoring indisponibles. Le fichier article-scores.json n&apos;est pas encore genere.
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
            placeholder="Filtrer les articles..."
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
              {lc === "all" ? "Tous" : lc}
            </Button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="xs"
          onClick={() => setSortBy(sortBy === "score" ? "traffic" : "score")}
          className="text-zinc-500 hover:text-white text-xs gap-1 sm:ml-auto"
        >
          <ArrowUpDown className="w-3 h-3" />
          {sortBy === "score" ? "Par score" : "Par trafic"}
        </Button>
      </div>

      {/* Table */}
      <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800/60 hover:bg-transparent">
              <TableHead className="text-zinc-500 text-xs font-medium w-8" />
              <TableHead className="text-zinc-500 text-xs font-medium">Titre</TableHead>
              <TableHead className="text-zinc-500 text-xs font-medium w-16 text-right">Score</TableHead>
              <TableHead className="text-zinc-500 text-xs font-medium w-24">Lifecycle</TableHead>
              <TableHead className="text-zinc-500 text-xs font-medium w-20 text-right">Trafic 7j</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="border-zinc-800/40">
                <TableCell colSpan={5} className="text-xs text-zinc-600 text-center py-6">
                  Aucun article ne correspond aux filtres.
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
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{article.title}</span>
                          {article.url && (
                            <a
                              href={article.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="shrink-0"
                            >
                              <ExternalLink className="w-3 h-3 text-zinc-600 hover:text-amber-400 transition-colors" />
                            </a>
                          )}
                        </div>
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
