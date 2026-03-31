"use client";

import { Badge } from "@/components/ui/badge";
import { ExternalLink, Loader2, Eye } from "lucide-react";

export interface CompetitorArticle {
  competitor: string;
  title: string;
  url?: string;
  publishedAt: string;
  estimatedTraffic?: number;
  overlap?: "direct" | "adjacent" | "new_niche";
}

interface Props {
  items: CompetitorArticle[];
  loading: boolean;
  error: string | null;
}

const OVERLAP_STYLES: Record<string, string> = {
  direct: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  adjacent: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  new_niche: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

export function CompetitorMoves({ items, loading, error }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-zinc-500 text-xs gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Chargement des mouvements concurrents...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-zinc-600 py-6 text-center">
        Donnees concurrentielles indisponibles.
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-xs text-zinc-600 py-4 text-center">
        Aucun mouvement concurrent recent detecte.
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-zinc-800/60">
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-violet-400" />
          Mouvements concurrents ({items.length})
        </h3>
      </div>
      <div className="divide-y divide-zinc-800/40">
        {items.map((item, i) => (
          <div
            key={`${item.competitor}-${i}`}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/30 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-zinc-200 truncate">
                  {item.title}
                </span>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                  >
                    <ExternalLink className="w-3 h-3 text-zinc-600 hover:text-amber-400 transition-colors" />
                  </a>
                )}
              </div>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {item.competitor} - {new Date(item.publishedAt).toLocaleDateString("fr-FR")}
                {item.estimatedTraffic != null && (
                  <span className="ml-2 text-zinc-600">
                    ~{item.estimatedTraffic >= 1000
                      ? `${((item.estimatedTraffic ?? 0) / 1000).toFixed(1)}k`
                      : item.estimatedTraffic}{" "}
                    visits
                  </span>
                )}
              </p>
            </div>
            {item.overlap && (
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 h-4 shrink-0 ${OVERLAP_STYLES[item.overlap] || ""}`}
              >
                {item.overlap === "direct"
                  ? "Direct"
                  : item.overlap === "adjacent"
                    ? "Adjacent"
                    : "Niche"}
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
