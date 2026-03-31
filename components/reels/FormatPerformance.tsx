"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import type { ReelHistoryEntry } from "./ReelCalendar";

// ── Types ──────────────────────────────────────────────────────────────────

export interface PerformanceWeights {
  lastUpdated: string;
  formatScores: Record<string, number>;
  destinationScores: Record<string, number>;
  recommendations: string[];
}

// ── Format metadata ────────────────────────────────────────────────────────

const FORMAT_META: Record<string, { label: string; color: string; barColor: string }> = {
  poll:          { label: "Poll",         color: "text-blue-400",    barColor: "bg-blue-500" },
  pick:          { label: "Trip Pick",    color: "text-emerald-400", barColor: "bg-emerald-500" },
  humor:         { label: "Humor",        color: "text-orange-400",  barColor: "bg-orange-500" },
  "humor-tweet": { label: "Humor Tweet",  color: "text-orange-300",  barColor: "bg-orange-400" },
  versus:        { label: "Versus",       color: "text-purple-400",  barColor: "bg-purple-500" },
  budget:        { label: "Budget",       color: "text-teal-400",    barColor: "bg-teal-500" },
  avantapres:    { label: "Avant/Apres",  color: "text-red-400",     barColor: "bg-red-500" },
  month:         { label: "Ou Partir En", color: "text-amber-400",   barColor: "bg-amber-500" },
};

function getMeta(format: string) {
  return FORMAT_META[format] ?? { label: format, color: "text-zinc-400", barColor: "bg-zinc-500" };
}

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  history: ReelHistoryEntry[];
  weights: PerformanceWeights | null;
  loading: boolean;
}

export function FormatPerformance({ history, weights, loading }: Props) {
  // Count reels per format
  const formatCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const reel of history) {
      counts[reel.format] = (counts[reel.format] ?? 0) + 1;
    }
    return counts;
  }, [history]);

  // Compute avg engagement per format (from history)
  const formatEngagement = useMemo(() => {
    const totals: Record<string, { sum: number; count: number }> = {};
    for (const reel of history) {
      if (reel.engagement === undefined) continue;
      if (!totals[reel.format]) totals[reel.format] = { sum: 0, count: 0 };
      totals[reel.format].sum += reel.engagement;
      totals[reel.format].count += 1;
    }
    const avgs: Record<string, number> = {};
    for (const [fmt, { sum, count }] of Object.entries(totals)) {
      avgs[fmt] = count > 0 ? sum / count : 0;
    }
    return avgs;
  }, [history]);

  // All formats (from both history + weights)
  const allFormats = useMemo(() => {
    const set = new Set<string>();
    Object.keys(formatCounts).forEach((f) => set.add(f));
    if (weights?.formatScores) {
      Object.keys(weights.formatScores).forEach((f) => set.add(f));
    }
    // Also add known formats for completeness
    Object.keys(FORMAT_META).forEach((f) => set.add(f));
    return Array.from(set).sort();
  }, [formatCounts, weights]);

  const maxCount = Math.max(1, ...Object.values(formatCounts));

  // Determine recommendation per format
  function getRecommendation(format: string): { label: string; icon: React.ReactNode; color: string } {
    const score = weights?.formatScores?.[format] ?? 0;
    const allScores = Object.values(weights?.formatScores ?? {});
    const avg = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;

    if (avg === 0 || score === 0) {
      return { label: "Pas de donnees", icon: <Minus className="w-3 h-3" />, color: "text-zinc-500" };
    }

    const ratio = score / avg;
    if (ratio > 1.2) {
      return { label: "Augmenter", icon: <TrendingUp className="w-3 h-3" />, color: "text-emerald-400" };
    }
    if (ratio < 0.8) {
      return { label: "Reduire", icon: <TrendingDown className="w-3 h-3" />, color: "text-red-400" };
    }
    return { label: "Maintenir", icon: <Minus className="w-3 h-3" />, color: "text-amber-400" };
  }

  if (loading) {
    return (
      <Card className="border-zinc-800/50 bg-zinc-900/50">
        <CardContent className="flex items-center justify-center h-64">
          <span className="text-zinc-500 text-sm">Chargement des performances...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bar chart card */}
      <Card className="border-zinc-800/50 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-500" />
            Reels par format
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-zinc-600 text-sm">
              <BarChart3 className="w-8 h-8 mb-2 text-zinc-700" />
              Aucun reel publie pour le moment
            </div>
          ) : (
            <div className="space-y-2">
              {allFormats.map((format) => {
                const count = formatCounts[format] ?? 0;
                const meta = getMeta(format);
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;

                return (
                  <div key={format} className="flex items-center gap-3">
                    <span className={`text-xs w-24 shrink-0 text-right ${meta.color}`}>
                      {meta.label}
                    </span>
                    <div className="flex-1 h-5 bg-zinc-800/50 rounded overflow-hidden">
                      <div
                        className={`h-full rounded transition-all duration-500 ${meta.barColor}`}
                        style={{ width: `${pct}%`, opacity: count > 0 ? 1 : 0.15 }}
                      />
                    </div>
                    <span className="text-xs text-zinc-400 tabular-nums w-8 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance table */}
      <Card className="border-zinc-800/50 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-white">Analyse par format</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800">
                <TableHead className="text-zinc-400">Format</TableHead>
                <TableHead className="text-zinc-400 text-right">Publies</TableHead>
                <TableHead className="text-zinc-400 text-right">Score moyen</TableHead>
                <TableHead className="text-zinc-400 text-right">Engagement moy.</TableHead>
                <TableHead className="text-zinc-400">Recommandation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allFormats.map((format) => {
                const meta = getMeta(format);
                const count = formatCounts[format] ?? 0;
                const score = weights?.formatScores?.[format] ?? 0;
                const avgEng = formatEngagement[format];
                const rec = getRecommendation(format);

                return (
                  <TableRow key={format} className="border-zinc-800/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${meta.barColor}`} />
                        <span className={`text-sm ${meta.color}`}>{meta.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm text-white tabular-nums">{count}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm text-white tabular-nums">
                        {score > 0 ? score.toFixed(1) : "--"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm text-white tabular-nums">
                        {avgEng !== undefined ? avgEng.toFixed(0) : "--"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`border-zinc-700/50 gap-1 ${rec.color}`}
                      >
                        {rec.icon}
                        {rec.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Recommendations from weights file */}
          {weights?.recommendations && weights.recommendations.length > 0 && (
            <div className="mt-4 pt-3 border-t border-zinc-800/50">
              <span className="text-xs text-zinc-500 block mb-2">Notes du systeme</span>
              <div className="space-y-1">
                {weights.recommendations.map((rec, i) => (
                  <p key={i} className="text-xs text-zinc-400 leading-relaxed">
                    {rec}
                  </p>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
