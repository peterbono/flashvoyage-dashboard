"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Rocket, ArrowUpDown } from "lucide-react";

export interface ROIQueueItem {
  id?: string;
  title?: string;
  topic?: string;
  action?: string;
  type?: "new" | "update" | "enrich" | string;
  priority?: "urgent" | "high" | "medium" | "low" | string;
  priorityScore?: number;
  expectedROI?: number;
  roi?: { expectedRoi?: number; projectedMonthlyTraffic?: number; productionCost?: number };
  keywords?: string[];
  destination?: string;
  rank?: number;
  context?: string;
  [key: string]: unknown;
}

interface Props {
  items: ROIQueueItem[];
  loading: boolean;
  error: string | null;
}

const PRIORITY_STYLES: Record<string, string> = {
  urgent:
    "bg-rose-500/15 text-rose-400 border-rose-500/30",
  high:
    "bg-amber-500/15 text-amber-400 border-amber-500/30",
  medium:
    "bg-blue-500/15 text-blue-400 border-blue-500/30",
  low:
    "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

const TYPE_STYLES: Record<string, string> = {
  new: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  update: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  enrich: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
};

export function ROIQueueTable({ items, loading, error }: Props) {
  const [producingId, setProducingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"roi" | "priority">("roi");

  const sorted = [...items].sort((a, b) => {
    if (sortBy === "roi") return (b.expectedROI ?? b.roi?.expectedRoi ?? 0) - (a.expectedROI ?? a.roi?.expectedRoi ?? 0);
    const pOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    return (pOrder[a.priority || "low"] ?? 3) - (pOrder[b.priority || "low"] ?? 3);
  });

  async function handleProduce(item: ROIQueueItem) {
    setProducingId(item.id || null);
    try {
      await fetch("/api/workflows/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow: "auto-publish.yml",
          inputs: {
            topic: item.topic || item.title,
            track: "evergreen",
          },
        }),
      });
    } catch {
      // non-blocking
    } finally {
      setTimeout(() => setProducingId(null), 2000);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-zinc-500 text-xs gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Chargement de la queue ROI...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-zinc-600 py-6 text-center">
        Donnees ROI indisponibles. Les fichiers intelligence ne sont pas encore generes.
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-xs text-zinc-600 py-6 text-center">
        La queue ROI est vide. Ajoutez un article ci-dessus ou attendez le prochain cycle intelligence.
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-zinc-800/60">
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          Queue par ROI ({items.length})
        </h3>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => setSortBy(sortBy === "roi" ? "priority" : "roi")}
          className="text-zinc-500 hover:text-white text-xs gap-1"
        >
          <ArrowUpDown className="w-3 h-3" />
          {sortBy === "roi" ? "Par ROI" : "Par priorite"}
        </Button>
      </div>
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800/60 hover:bg-transparent">
            <TableHead className="text-zinc-500 text-xs font-medium w-20">Priorite</TableHead>
            <TableHead className="text-zinc-500 text-xs font-medium">Titre / Sujet</TableHead>
            <TableHead className="text-zinc-500 text-xs font-medium w-20">Type</TableHead>
            <TableHead className="text-zinc-500 text-xs font-medium w-24 text-right">ROI</TableHead>
            <TableHead className="text-zinc-500 text-xs font-medium w-28 text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((item) => (
            <TableRow
              key={item.id}
              className="border-zinc-800/40 hover:bg-zinc-800/30"
            >
              <TableCell>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 h-4 ${PRIORITY_STYLES[item.priority || "low"] || ""}`}
                >
                  {item.priority === "urgent" ? "P1" : item.priority === "high" ? "P2" : item.priority === "medium" ? "P3" : "Low"}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-zinc-200 max-w-xs truncate">
                {item.title}
                {item.destination && (
                  <span className="text-zinc-600 ml-1.5">
                    ({item.destination})
                  </span>
                )}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 h-4 ${TYPE_STYLES[item.type || item.action || "new"] || ""}`}
                >
                  {item.type}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <span className="text-xs font-mono text-amber-400 tabular-nums">
                  {(item.expectedROI ?? item.roi?.expectedRoi ?? 0).toFixed(1)}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="xs"
                  variant="outline"
                  disabled={producingId === item.id}
                  onClick={() => handleProduce(item)}
                  className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-amber-500/20 hover:text-amber-400 hover:border-amber-500/40 text-xs h-6 px-2 gap-1"
                >
                  {producingId === item.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Rocket className="w-3 h-3" />
                  )}
                  Produire
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
