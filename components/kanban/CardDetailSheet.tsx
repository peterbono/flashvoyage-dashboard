"use client";

import { KanbanCard } from "./mockKanbanData";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Star, DollarSign, Globe, Calendar, FileText, Zap } from "lucide-react";

interface Props {
  card: KanbanCard | null;
  onClose: () => void;
}

const SOURCE_COLORS: Record<string, string> = {
  Reddit: "text-orange-400 border-orange-800 bg-orange-950/30",
  RSS:    "text-blue-400 border-blue-800 bg-blue-950/30",
  Manual: "text-zinc-400 border-zinc-700 bg-zinc-800/30",
};

export function CardDetailSheet({ card, onClose }: Props) {
  return (
    <Sheet open={!!card} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="bg-zinc-950 border-zinc-800 text-white w-96">
        {card && (
          <>
            <SheetHeader className="pb-4">
              <div className="flex gap-2 mb-2">
                <Badge variant="outline" className={`text-[10px] ${SOURCE_COLORS[card.source]}`}>{card.source}</Badge>
                <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">{card.language}</Badge>
              </div>
              <SheetTitle className="text-sm font-semibold text-white leading-snug text-left">
                {card.title}
              </SheetTitle>
            </SheetHeader>

            <div className="space-y-4 text-xs overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Globe,    label: "Destination", value: card.destination },
                  { icon: Calendar, label: "Date",        value: card.date },
                  { icon: FileText, label: "Word Count",  value: card.wordCount ? `${card.wordCount.toLocaleString()} words` : "—" },
                  { icon: Zap,      label: "Language",    value: card.language },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="bg-zinc-900 rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-zinc-500">
                      <Icon className="w-3 h-3" />
                      <span>{label}</span>
                    </div>
                    <div className="text-white font-medium">{value}</div>
                  </div>
                ))}
                {card.qualityScore !== undefined && (
                  <div className="bg-zinc-900 rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-zinc-500">
                      <Star className="w-3 h-3" />
                      <span>Quality Score</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${card.qualityScore >= 85 ? "text-emerald-400" : "text-amber-400"}`}>
                        {card.qualityScore}/100
                      </span>
                      <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                        <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${card.qualityScore}%` }} />
                      </div>
                    </div>
                  </div>
                )}
                {card.cost !== undefined && (
                  <div className="bg-zinc-900 rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-zinc-500">
                      <DollarSign className="w-3 h-3" />
                      <span>Total Cost</span>
                    </div>
                    <div className="text-amber-400 font-semibold">${card.cost.toFixed(4)}</div>
                  </div>
                )}
              </div>

              <Separator className="bg-zinc-800" />

              <div>
                <p className="text-zinc-500 mb-1.5 font-medium">Target Keyword</p>
                <div className="bg-zinc-900 rounded-lg px-3 py-2 text-white">{card.keyword}</div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
