"use client";

import { Trophy, ExternalLink, Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TopPerformerItem {
  slug: string;
  title: string;
  url: string;
  score: number;
  monetization: number;
  flags: string[];
}

interface Props {
  items: TopPerformerItem[];
  loading: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColorClass(score: number): string {
  if (score >= 70) return "text-emerald-400";
  if (score >= 50) return "text-cyan-400";
  if (score >= 30) return "text-amber-400";
  return "text-zinc-500";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TopPerformersCard({ items, loading }: Props) {
  return (
    <Card className="bg-zinc-900/40 border-zinc-800/60 rounded-xl h-full">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="flex items-center gap-2 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          Top performers
          {items.length > 0 ? (
            <span className="text-[10px] font-normal text-zinc-500 normal-case">
              ({items.length})
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-3">
        {loading && items.length === 0 ? (
          <div className="text-xs text-zinc-600 text-center py-6">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-xs text-zinc-600 text-center py-6">
            No scored articles yet.
          </div>
        ) : (
          <ul className="space-y-0.5">
            {items.map((item, idx) => {
              const isTopPerformer = item.flags.includes("top_performer");
              return (
                <li
                  key={item.slug}
                  className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-800/40 transition-colors group"
                >
                  <span
                    className="text-[10px] font-mono text-zinc-400 tabular-nums mt-0.5 w-4 shrink-0"
                    aria-hidden="true"
                  >
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-zinc-200 truncate flex-1 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm"
                        >
                          {item.title}
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-200 truncate flex-1">
                          {item.title}
                        </span>
                      )}
                      {isTopPerformer ? (
                        <Sparkles
                          className="w-3 h-3 text-amber-400 shrink-0"
                          aria-label="Top performer"
                        />
                      ) : null}
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open "${item.title}" in a new tab`}
                          className="text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100 focus-within:opacity-100 focus-visible:opacity-100 transition-opacity shrink-0 p-[14px] -m-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`text-[10px] tabular-nums font-mono ${scoreColorClass(item.score)}`}
                      >
                        <span className="sr-only">Composite score </span>score {item.score}
                      </span>
                      {item.monetization > 0 ? (
                        <span className="text-[10px] text-blue-400 tabular-nums">
                          <span aria-hidden="true">💰</span>{" "}
                          <span className="sr-only">Monetization </span>
                          {(item.monetization * 100).toFixed(0)}%
                        </span>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
