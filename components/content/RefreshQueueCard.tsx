"use client";

import { RefreshCw, ExternalLink, TrendingDown } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RefreshQueueItem {
  slug: string;
  title: string;
  url: string;
  score: number;
  delta7d: number;
  flags: string[];
}

interface Props {
  items: RefreshQueueItem[];
  loading: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta.toFixed(0)}`;
  return delta.toFixed(0);
}

function deltaColorClass(delta: number): string {
  if (delta <= -20) return "text-red-400";
  if (delta <= -10) return "text-orange-400";
  if (delta < 0) return "text-amber-400";
  return "text-zinc-500";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RefreshQueueCard({ items, loading }: Props) {
  return (
    <Card className="bg-zinc-900/40 border-zinc-800/60 rounded-xl h-full">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="flex items-center gap-2 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          <RefreshCw className="w-3.5 h-3.5 text-orange-400" />
          Refresh queue
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
            No declining articles — portfolio is stable.
          </div>
        ) : (
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li
                key={item.slug}
                className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-800/40 transition-colors group"
              >
                <TrendingDown
                  className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${deltaColorClass(item.delta7d)}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-zinc-200 truncate flex-1 hover:text-white hover:underline"
                      >
                        {item.title}
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-200 truncate flex-1">
                        {item.title}
                      </span>
                    )}
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-zinc-500 tabular-nums">
                      score {item.score}
                    </span>
                    <span
                      className={`text-[10px] tabular-nums font-mono ${deltaColorClass(item.delta7d)}`}
                    >
                      {formatDelta(item.delta7d)} pts/7d
                    </span>
                    {item.flags.length > 0 ? (
                      <span className="text-[9px] text-zinc-600 truncate">
                        {item.flags[0]}
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
