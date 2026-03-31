"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";

export interface ContentGap {
  topic: string;
  searchVolume: number;
  trend: "up" | "down" | "stable";
  source: "Trends" | "GSC" | "Competitor" | "Reddit";
  difficulty?: number;
}

interface Props {
  items: ContentGap[];
  loading: boolean;
  error: string | null;
}

const SOURCE_STYLES: Record<string, string> = {
  Trends: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  GSC: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Competitor: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  Reddit: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

function TrendIcon({ trend }: { trend: ContentGap["trend"] }) {
  if (trend === "up") return <TrendingUp className="w-3 h-3 text-emerald-400" />;
  if (trend === "down") return <TrendingDown className="w-3 h-3 text-rose-400" />;
  return <Minus className="w-3 h-3 text-zinc-500" />;
}

export function ContentGapsList({ items, loading, error }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-zinc-500 text-xs gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Chargement des gaps...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-zinc-600 py-6 text-center">
        Donnees content gaps indisponibles.
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-xs text-zinc-600 py-4 text-center">
        Aucun gap de contenu detecte.
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl overflow-hidden">
      <div className="px-3 sm:px-4 py-2.5 border-b border-zinc-800/60">
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          Top content gaps ({items.length})
        </h3>
      </div>
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800/60 hover:bg-transparent">
            <TableHead className="text-zinc-500 text-xs font-medium">Sujet</TableHead>
            <TableHead className="text-zinc-500 text-xs font-medium w-28 text-right">Volume</TableHead>
            <TableHead className="text-zinc-500 text-xs font-medium w-20 text-center">Tendance</TableHead>
            <TableHead className="text-zinc-500 text-xs font-medium w-24">Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.slice(0, 10).map((gap, i) => (
            <TableRow
              key={`${gap.topic}-${i}`}
              className="border-zinc-800/40 hover:bg-zinc-800/30"
            >
              <TableCell className="text-xs text-zinc-200">
                {gap.topic}
              </TableCell>
              <TableCell className="text-right">
                <span className="text-xs font-mono text-zinc-300 tabular-nums">
                  {gap.searchVolume >= 1000
                    ? `${(gap.searchVolume / 1000).toFixed(1)}k`
                    : gap.searchVolume}
                </span>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center">
                  <TrendIcon trend={gap.trend} />
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 h-4 ${SOURCE_STYLES[gap.source] || ""}`}
                >
                  {gap.source}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
