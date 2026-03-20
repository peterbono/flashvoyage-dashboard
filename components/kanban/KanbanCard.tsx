"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { KanbanCard as KanbanCardType, SourceType } from "./mockKanbanData";
import { Badge } from "@/components/ui/badge";
import { Star, DollarSign } from "lucide-react";

interface Props {
  card: KanbanCardType;
  onClick: () => void;
}

const SOURCE_COLORS: Record<SourceType, string> = {
  Reddit: "text-orange-400 border-orange-800 bg-orange-950/30",
  RSS:    "text-blue-400 border-blue-800 bg-blue-950/30",
  Manual: "text-zinc-400 border-zinc-700 bg-zinc-800/30",
};

const LANG_COLORS: Record<string, string> = {
  EN: "text-sky-400 border-sky-800 bg-sky-950/30",
  FR: "text-violet-400 border-violet-800 bg-violet-950/30",
  ES: "text-amber-400 border-amber-800 bg-amber-950/30",
  DE: "text-emerald-400 border-emerald-800 bg-emerald-950/30",
};

export function KanbanCardComponent({ card, onClick }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-zinc-900 border border-zinc-800/80 rounded-lg p-3 cursor-pointer hover:border-zinc-700 hover:bg-zinc-800/60 hover:shadow-lg hover:shadow-black/30 transition-all duration-200 group select-none"
    >
      {/* Title */}
      <p className="text-xs font-medium text-white leading-snug mb-2.5 line-clamp-2">
        {card.title}
      </p>

      {/* Badges row */}
      <div className="flex flex-wrap gap-1 mb-2">
        <Badge variant="outline" className={`text-xs px-1.5 py-0 ${SOURCE_COLORS[card.source]}`}>
          {card.source}
        </Badge>
        <Badge variant="outline" className={`text-xs px-1.5 py-0 ${LANG_COLORS[card.language]}`}>
          {card.language}
        </Badge>
      </div>

      {/* Keyword */}
      <p className="text-xs text-zinc-500 truncate mb-2.5">
        🔑 {card.keyword}
      </p>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-xs text-zinc-500">
        {card.qualityScore !== undefined && (
          <span className={`flex items-center gap-0.5 font-medium ${card.qualityScore >= 85 ? "text-emerald-400" : card.qualityScore >= 75 ? "text-amber-400" : "text-red-400"}`}>
            <Star className="w-2.5 h-2.5" />
            {card.qualityScore}
          </span>
        )}
        {card.cost !== undefined && (
          <span className="flex items-center gap-0.5 text-zinc-500">
            <DollarSign className="w-2.5 h-2.5" />
            {card.cost.toFixed(3)}
          </span>
        )}
        {card.wordCount && (
          <span>{card.wordCount.toLocaleString("en-US")}w</span>
        )}
        <span className="ml-auto">{card.date.slice(5)}</span>
      </div>
    </div>
  );
}
