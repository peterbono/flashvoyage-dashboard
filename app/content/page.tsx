"use client";

import { useState, useMemo, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { MOCK_CARDS, COLUMNS, KanbanCard, KanbanColumn } from "@/components/kanban/mockKanbanData";
import { KanbanCardComponent } from "@/components/kanban/KanbanCard";
import { CardDetailSheet } from "@/components/kanban/CardDetailSheet";
import { AddArticleModal } from "@/components/kanban/AddArticleModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Wifi } from "lucide-react";

// Non-published mock cards represent the pipeline stages we don't have real data for
const PIPELINE_MOCK_CARDS = MOCK_CARDS.filter((c) => c.column !== "published");

export default function ContentPage() {
  const [cards, setCards] = useState<KanbanCard[]>(PIPELINE_MOCK_CARDS);
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetch("/api/articles")
      .then((r) => r.json())
      .then((data: { source: string; total: number; articles: KanbanCard[] }) => {
        if (data.source === "real" && data.articles?.length) {
          setCards([...PIPELINE_MOCK_CARDS, ...data.articles]);
          setLiveCount(data.total);
        }
      })
      .catch(() => {
        // Fallback: show all mock data
        setCards(MOCK_CARDS);
        setLoadError(true);
      });
  }, []);
  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null);
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const filteredCards = useMemo(() => {
    return cards.filter((c) => {
      const matchSearch = search === "" || c.title.toLowerCase().includes(search.toLowerCase());
      const matchSource = sourceFilter === "all" || c.source === sourceFilter;
      return matchSearch && matchSource;
    });
  }, [cards, search, sourceFilter]);

  const cardsByColumn = useMemo(() => {
    const map: Record<KanbanColumn, KanbanCard[]> = {
      sourced: [], queued: [], generating: [], review: [], published: [],
    };
    filteredCards.forEach((c) => map[c.column].push(c));
    return map;
  }, [filteredCards]);

  function handleDragStart(event: DragStartEvent) {
    const card = cards.find((c) => c.id === event.active.id);
    setActiveCard(card ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCard(null);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dropped over a column droppable
    const targetColumn = COLUMNS.find((col) => col.id === overId);
    if (targetColumn) {
      setCards((prev) =>
        prev.map((c) => c.id === activeId ? { ...c, column: targetColumn.id } : c)
      );
      return;
    }

    // Dropped over another card — move to same column
    const overCard = cards.find((c) => c.id === overId);
    if (overCard && overCard.column !== cards.find((c) => c.id === activeId)?.column) {
      setCards((prev) =>
        prev.map((c) => c.id === activeId ? { ...c, column: overCard.column } : c)
      );
    }
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/80 shrink-0 flex-wrap gap-y-2">
        <h1 className="text-sm font-semibold text-white tracking-tight mr-1">Content</h1>
        {liveCount !== null && (
          <Badge variant="outline" className="border-emerald-800/60 bg-emerald-950/30 text-emerald-400 gap-1 text-[10px]">
            <Wifi className="w-2.5 h-2.5" />
            {liveCount} live
          </Badge>
        )}
        {loadError && (
          <Badge variant="outline" className="border-zinc-800 text-zinc-600 text-[10px]">
            mock data
          </Badge>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search articles..."
            className="bg-zinc-900 border-zinc-700 text-white text-xs h-7 pl-8 w-52 placeholder:text-zinc-600"
          />
        </div>

        {/* Source filter */}
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
          {["all", "Reddit", "RSS", "Manual"].map((s) => (
            <Button
              key={s}
              variant="ghost"
              size="sm"
              onClick={() => setSourceFilter(s)}
              className={`h-6 px-2 text-[11px] rounded-md transition-colors capitalize ${
                sourceFilter === s
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-500 hover:text-white hover:bg-zinc-800"
              }`}
            >
              {s === "all" ? "All sources" : s}
            </Button>
          ))}
        </div>

        <div className="ml-auto">
          <Button
            size="sm"
            className="bg-amber-500 hover:bg-amber-400 text-black font-medium h-7 px-3 gap-1.5 text-xs"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Article
          </Button>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 h-full p-4 min-w-max">
            {COLUMNS.map((col) => {
              const colCards = cardsByColumn[col.id];
              return (
                <div
                  key={col.id}
                  id={col.id}
                  className="flex flex-col w-60 shrink-0"
                >
                  {/* Column header */}
                  <div className="flex items-center gap-2 mb-3 px-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      col.id === "published" ? "bg-emerald-500" :
                      col.id === "review"    ? "bg-orange-500" :
                      col.id === "generating"? "bg-amber-500" :
                      col.id === "queued"    ? "bg-violet-500" : "bg-blue-500"
                    }`} />
                    <span className={`text-xs font-semibold tracking-wide ${col.color}`}>{col.label}</span>
                    <Badge variant="outline" className="border-zinc-800 bg-zinc-800/50 text-zinc-500 text-[10px] px-1.5 py-0 h-4 ml-auto">
                      {colCards.length}
                    </Badge>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                    <SortableContext
                      items={colCards.map((c) => c.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {colCards.map((card) => (
                        <KanbanCardComponent
                          key={card.id}
                          card={card}
                          onClick={() => setSelectedCard(card)}
                        />
                      ))}
                    </SortableContext>
                    {colCards.length === 0 && (
                      <div className="border border-dashed border-zinc-800/60 rounded-xl h-24 flex flex-col items-center justify-center gap-1.5 mt-1">
                        <div className="w-6 h-6 rounded-full bg-zinc-800/80 flex items-center justify-center">
                          <Plus className="w-3 h-3 text-zinc-600" />
                        </div>
                        <span className="text-[10px] text-zinc-700">Drop here</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <DragOverlay>
            {activeCard && (
              <div className="bg-zinc-800 border border-zinc-600 rounded-lg p-3 w-60 shadow-2xl shadow-black/50 opacity-95 rotate-1">
                <p className="text-xs font-medium text-white line-clamp-2">{activeCard.title}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Modals */}
      <CardDetailSheet card={selectedCard} onClose={() => setSelectedCard(null)} />
      <AddArticleModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
