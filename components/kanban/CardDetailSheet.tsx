"use client";

import { KanbanCard, KanbanColumn } from "./mockKanbanData";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ExternalLink, Target, Globe, Calendar, FileText, Zap, Star, DollarSign, ArrowRight } from "lucide-react";

interface Props {
  card: KanbanCard | null;
  onClose: () => void;
}

const COLUMN_META: Record<KanbanColumn, { label: string; color: string; dot: string }> = {
  sourced:    { label: "Sourced",    color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60",    dot: "bg-blue-500" },
  queued:     { label: "Queued",     color: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800/60", dot: "bg-violet-500" },
  generating: { label: "Generating", color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60",  dot: "bg-amber-500" },
  review:     { label: "In Review",  color: "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800/60", dot: "bg-orange-500" },
  published:  { label: "Published",  color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60", dot: "bg-emerald-500" },
};

const SOURCE_META: Record<string, { color: string }> = {
  Reddit: { color: "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/60" },
  RSS:    { color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/60" },
  Manual: { color: "text-gray-600 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-800/40 border-gray-200 dark:border-zinc-700" },
};

const LANG_LABELS: Record<string, string> = { EN: "English", FR: "Français", ES: "Español", DE: "Deutsch" };

function MetaRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-zinc-800/60 last:border-0">
      <div className="flex items-center gap-2 text-gray-400 dark:text-zinc-500">
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[12px]">{label}</span>
      </div>
      <span className="text-[13px] font-medium text-gray-800 dark:text-zinc-200">{value}</span>
    </div>
  );
}

export function CardDetailSheet({ card, onClose }: Props) {
  return (
    <Sheet open={!!card} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="bg-white dark:bg-[#111111] border-l border-gray-200 dark:border-zinc-800/60 text-gray-900 dark:text-white w-[420px] p-0 flex flex-col">
        {card && (() => {
          const col = COLUMN_META[card.column];
          const src = SOURCE_META[card.source] ?? SOURCE_META.Manual;
          const qualityColor = card.qualityScore !== undefined
            ? card.qualityScore >= 85 ? "text-emerald-500" : card.qualityScore >= 70 ? "text-amber-500" : "text-rose-500"
            : "";

          return (
            <>
              {/* Header */}
              <div className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-zinc-800/50">
                {/* Status row */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${col.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
                    {col.label}
                  </span>
                  <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${src.color}`}>
                    {card.source}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-zinc-600 ml-auto">
                    {card.language}
                  </span>
                </div>

                {/* Title */}
                <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white leading-snug">
                  {card.title}
                </h2>

                {/* Date + destination */}
                <div className="flex items-center gap-3 mt-2.5 text-[12px] text-gray-400 dark:text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    {card.destination}
                  </span>
                  <span className="w-px h-3 bg-gray-200 dark:bg-zinc-700" />
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {card.date}
                  </span>
                  {card.wordCount && (
                    <>
                      <span className="w-px h-3 bg-gray-200 dark:bg-zinc-700" />
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {card.wordCount.toLocaleString()}w
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

                {/* Target Keyword */}
                <div>
                  <p className="text-xs font-medium text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                    Target keyword
                  </p>
                  <div className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-900/60 border border-gray-200 dark:border-zinc-800/60 rounded-lg px-3 py-2.5">
                    <Target className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="text-[13px] font-medium text-gray-800 dark:text-zinc-200">{card.keyword}</span>
                  </div>
                </div>

                {/* Scores */}
                {(card.qualityScore !== undefined || card.cost !== undefined) && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                      Performance
                    </p>
                    <div className="space-y-3">
                      {card.qualityScore !== undefined && (
                        <div className="bg-gray-50 dark:bg-zinc-900/60 border border-gray-200 dark:border-zinc-800/60 rounded-lg px-3 py-2.5">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5 text-[12px] text-gray-500 dark:text-zinc-500">
                              <Star className="w-3.5 h-3.5" />
                              Quality Score
                            </div>
                            <span className={`text-[15px] font-bold tabular-nums ${qualityColor}`}>
                              {card.qualityScore}
                              <span className="text-xs font-normal text-gray-400 dark:text-zinc-600">/100</span>
                            </span>
                          </div>
                          <div className="h-1.5 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                card.qualityScore >= 85 ? "bg-emerald-500" :
                                card.qualityScore >= 70 ? "bg-amber-500" : "bg-rose-500"
                              }`}
                              style={{ width: `${card.qualityScore}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-400 dark:text-zinc-600 mt-1.5">
                            {card.qualityScore >= 85 ? "Above target (85)" : card.qualityScore >= 70 ? "Acceptable range" : "Below target — needs review"}
                          </p>
                        </div>
                      )}
                      {card.cost !== undefined && (
                        <div className="flex items-center justify-between bg-gray-50 dark:bg-zinc-900/60 border border-gray-200 dark:border-zinc-800/60 rounded-lg px-3 py-2.5">
                          <div className="flex items-center gap-1.5 text-[12px] text-gray-500 dark:text-zinc-500">
                            <DollarSign className="w-3.5 h-3.5" />
                            LLM Cost
                          </div>
                          <span className="text-[15px] font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                            ${card.cost.toFixed(4)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Meta */}
                <div>
                  <p className="text-xs font-medium text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                    Details
                  </p>
                  <div className="bg-gray-50 dark:bg-zinc-900/60 border border-gray-200 dark:border-zinc-800/60 rounded-lg px-3">
                    <MetaRow icon={Globe} label="Destination" value={card.destination} />
                    <MetaRow icon={Zap} label="Language" value={LANG_LABELS[card.language] ?? card.language} />
                    <MetaRow icon={Calendar} label="Published" value={card.date} />
                    {card.wordCount && (
                      <MetaRow icon={FileText} label="Word count" value={`${card.wordCount.toLocaleString()} words`} />
                    )}
                  </div>
                </div>
              </div>

              {/* Footer — article / source link */}
              {card.sourceUrl && (
                <div className="px-5 py-3 border-t border-gray-100 dark:border-zinc-800/50">
                  {card.column === "published" ? (
                    /* Published: prominent green "View live article" button */
                    <a
                      href={card.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors group"
                    >
                      <div className="flex items-center gap-2 text-[13px] font-semibold text-emerald-700 dark:text-emerald-400">
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        View live article
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
                    </a>
                  ) : (
                    /* Other columns: smaller "Source" link */
                    <a
                      href={card.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-zinc-900/60 border border-gray-200 dark:border-zinc-800/60 hover:bg-gray-100 dark:hover:bg-zinc-800/80 transition-colors group"
                    >
                      <div className="flex items-center gap-2 text-[12px] font-medium text-gray-500 dark:text-zinc-400">
                        <ExternalLink className="w-3 h-3 text-gray-400 dark:text-zinc-500 shrink-0" />
                        Source
                      </div>
                      <ArrowRight className="w-3 h-3 text-gray-300 dark:text-zinc-600 group-hover:text-gray-500 dark:group-hover:text-zinc-400 transition-colors" />
                    </a>
                  )}
                </div>
              )}
            </>
          );
        })()}
      </SheetContent>
    </Sheet>
  );
}
