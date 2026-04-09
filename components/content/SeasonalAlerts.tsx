"use client";

import { Badge } from "@/components/ui/badge";
import { CalendarClock, AlertTriangle, Loader2 } from "lucide-react";

export interface SeasonalItem {
  destination: string;
  peakMonth?: string;
  publishBy?: string;
  daysUntilPeak?: number;
  daysUntilPublish?: number;
  suggestedTopic?: string;
  confidence?: number;
  urgency?: string;
  [key: string]: unknown;
}

interface Props {
  items: SeasonalItem[];
  loading: boolean;
  error: string | null;
}

const URGENCY_STYLES: Record<string, { badge: string; icon: string }> = {
  critical: {
    badge: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    icon: "text-rose-400",
  },
  urgent: {
    badge: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    icon: "text-rose-400",
  },
  soon: {
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    icon: "text-amber-400",
  },
  planned: {
    badge: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    icon: "text-zinc-500",
  },
};

export function SeasonalAlerts({ items, loading, error }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-zinc-500 text-xs gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading seasonal data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-zinc-600 py-4 text-center">
        Seasonal data unavailable.
      </div>
    );
  }

  // Show urgent items (any urgency flag)
  const urgent = items.filter((i) => {
    const u = String(i.urgency || '').toLowerCase();
    return u === 'critical' || u === 'soon' || u === 'urgent' ||
           (i.daysUntilPublish != null && (i.daysUntilPublish as number) <= 45);
  });

  if (urgent.length === 0) {
    return (
      <div className="text-xs text-zinc-600 py-4 text-center">
        No urgent seasonal alerts.
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-zinc-800/60">
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
          <CalendarClock className="w-3.5 h-3.5 text-amber-500" />
          Seasonal alerts ({urgent.length})
        </h3>
      </div>
      <div className="divide-y divide-zinc-800/40">
        {urgent.map((item, i) => {
          const style = URGENCY_STYLES[String(item.urgency || 'soon').toLowerCase()] || URGENCY_STYLES.soon;
          return (
            <div
              key={`${item.destination}-${i}`}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/30 transition-colors"
            >
              <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${style.icon}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-200 truncate">
                  {item.suggestedTopic || `Publish article on ${item.destination}`}
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  {item.destination} — peak in {item.peakMonth || '?'}{item.publishBy ? ` (publish before ${item.publishBy})` : ''}
                </p>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 h-4 shrink-0 ${style?.badge || 'border-amber-800/60 text-amber-400'}`}
              >
                {item.daysUntilPeak ?? item.daysUntilPublish ?? '?'}d
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}
