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
  pointerWithin,
  rectIntersection,
  useDroppable,
} from "@dnd-kit/core";
import { COLUMNS, KanbanCard, KanbanColumn } from "@/components/kanban/mockKanbanData";
import { KanbanCardComponent } from "@/components/kanban/KanbanCard";
import { CardDetailSheet } from "@/components/kanban/CardDetailSheet";
import { AddArticleModal } from "@/components/kanban/AddArticleModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Wifi, DollarSign, Star, FileText } from "lucide-react";
import { useAppStore } from "@/lib/store";

// Droppable wrapper so dnd-kit recognises each column as a valid drop target
function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 overflow-y-auto space-y-2 pr-0.5 rounded-lg transition-colors duration-150 ${
        isOver ? "ring-1 ring-amber-500/40 bg-amber-500/5" : ""
      }`}
    >
      {children}
    </div>
  );
}

export default function ContentPage() {
  const storeCards = useAppStore((s) => s.kanbanCards);
  const addKanbanCard = useAppStore((s) => s.addKanbanCard);
  const updateKanbanCard = useAppStore((s) => s.updateKanbanCard);
  // sourcedCards: real Reddit trending posts
  const [sourcedCards, setSourcedCards] = useState<KanbanCard[]>([]);
  // publishedCards: real WordPress articles
  const [publishedCards, setPublishedCards] = useState<KanbanCard[]>([]);
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Fetch published articles from WordPress
  useEffect(() => {
    fetch("/api/articles")
      .then((r) => r.json())
      .then((data: { source: string; total: number; articles: KanbanCard[] }) => {
        if (data.source === "real" && data.articles?.length) {
          setPublishedCards(data.articles);
          setLiveCount(data.total);
        }
      })
      .catch(() => setLoadError(true));
  }, []);

  // Fetch Reddit trending → sourced column
  useEffect(() => {
    fetch("/api/reddit/trending")
      .then((r) => r.json())
      .then((data: { source?: string; posts?: { id: string; title: string; score: number; url: string; subreddit: string }[] }) => {
        if (data.posts?.length) {
          const redditCards: KanbanCard[] = data.posts.map((p) => ({
            id: `reddit-${p.id}`,
            title: p.title,
            column: "sourced" as const,
            source: "Reddit" as const,
            sourceUrl: p.url,
            keyword: p.title.split(" ").slice(0, 4).join(" ").toLowerCase(),
            date: new Date().toISOString().slice(0, 10),
            language: "EN" as const,
            destination: p.subreddit,
          }));
          setSourcedCards(redditCards);
        }
      })
      .catch(() => { /* non-blocking */ });
  }, []);
  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null);
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // All real cards: sourced (Reddit) + store (queued/generating/review set by user/pipeline) + published (WP)
  const mergedCards = useMemo(() => {
    const seen = new Set<string>();
    const all = [...sourcedCards, ...storeCards, ...publishedCards];
    return all.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }, [sourcedCards, storeCards, publishedCards]);

  const filteredCards = useMemo(() => {
    return mergedCards.filter((c) => {
      const matchSearch = search === "" || c.title.toLowerCase().includes(search.toLowerCase());
      const matchSource = sourceFilter === "all" || c.source === sourceFilter;
      return matchSearch && matchSource;
    });
  }, [mergedCards, search, sourceFilter]);

  const cardsByColumn = useMemo(() => {
    const map: Record<KanbanColumn, KanbanCard[]> = {
      sourced: [], queued: [], generating: [], review: [], published: [],
    };
    filteredCards.forEach((c) => map[c.column].push(c));
    return map;
  }, [filteredCards]);

  function handleDragStart(event: DragStartEvent) {
    const card = mergedCards.find((c) => c.id === event.active.id);
    setActiveCard(card ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCard(null);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const draggedCard = mergedCards.find((c) => c.id === activeId);
    if (!draggedCard) return;

    // over could be: a column id (droppable) OR a card id (sortable within/across columns)
    const isColumn = COLUMNS.some((col) => col.id === overId);
    const newCol: KanbanColumn | undefined = isColumn
      ? (overId as KanbanColumn)
      : mergedCards.find((c) => c.id === overId)?.column;

    if (!newCol || newCol === draggedCard.column) return;

    const updatedCard = { ...draggedCard, column: newCol };

    // If already in store: update it
    if (storeCards.some((c) => c.id === activeId)) {
      updateKanbanCard(activeId, { column: newCol });
    } else {
      // Move from sourced/published into store (now user-managed)
      addKanbanCard(updatedCard);
      // Remove from sourced if dragged away
      if (sourcedCards.some((c) => c.id === activeId)) {
        setSourcedCards((prev) => prev.filter((c) => c.id !== activeId));
      }
    }
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/80 shrink-0 flex-wrap gap-y-2">
        <h1 className="text-sm font-semibold text-white tracking-tight mr-1">Content</h1>
        {liveCount !== null && (
          <Badge variant="outline" className="border-emerald-800/60 bg-emerald-950/30 text-emerald-400 gap-1 text-xs">
            <Wifi className="w-2.5 h-2.5" />
            {liveCount} live
          </Badge>
        )}
        {loadError && (
          <Badge variant="outline" className="border-zinc-800 text-zinc-600 text-xs">
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
              className={`h-6 px-2 text-xs rounded-md transition-colors capitalize ${
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
          collisionDetection={(args) => {
            // Prefer column droppables first (pointer inside column area)
            const pw = pointerWithin(args);
            if (pw.length > 0) return pw;
            // Fallback for edge cases (dragging outside column bounds)
            return rectIntersection(args);
          }}
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
                    <Badge variant="outline" className="border-zinc-800 bg-zinc-800/50 text-zinc-500 text-xs px-1.5 py-0 h-4 ml-auto">
                      {colCards.length}
                    </Badge>
                  </div>

                  {/* Cards — DroppableColumn registers col.id as a valid dnd-kit drop zone */}
                  <DroppableColumn id={col.id}>
                      {colCards.map((card) => (
                        <KanbanCardComponent
                          key={card.id}
                          card={card}
                          onClick={() => setSelectedCard(card)}
                        />
                      ))}
                    {colCards.length === 0 && (
                      <div className="border border-dashed border-zinc-800/60 rounded-xl h-24 flex flex-col items-center justify-center gap-1.5 mt-1">
                        <div className="w-6 h-6 rounded-full bg-zinc-800/80 flex items-center justify-center">
                          <Plus className="w-3 h-3 text-zinc-600" />
                        </div>
                        <span className="text-xs text-zinc-700">Drop here</span>
                      </div>
                    )}
                  </DroppableColumn>


                  {/* Column footer aggregates */}
                  {colCards.length > 0 && (() => {
                    const withCost = colCards.filter((c) => c.cost !== undefined);
                    const withQuality = colCards.filter((c) => c.qualityScore !== undefined);
                    const withWords = colCards.filter((c) => c.wordCount !== undefined);
                    const totalCost = withCost.reduce((s, c) => s + (c.cost ?? 0), 0);
                    const avgQuality = withQuality.length
                      ? withQuality.reduce((s, c) => s + (c.qualityScore ?? 0), 0) / withQuality.length
                      : null;
                    const totalWords = withWords.reduce((s, c) => s + (c.wordCount ?? 0), 0);
                    if (!withCost.length && !withQuality.length && !withWords.length) return null;
                    return (
                      <div className="mt-2 pt-2 border-t border-zinc-800/60 flex flex-wrap gap-x-3 gap-y-1 px-0.5">
                        {withCost.length > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-zinc-500">
                            <DollarSign className="w-2.5 h-2.5 text-amber-500/70" />
                            <span className="tabular-nums">{totalCost.toFixed(3)}</span>
                          </span>
                        )}
                        {avgQuality !== null && (
                          <span className="flex items-center gap-0.5 text-xs text-zinc-500">
                            <Star className="w-2.5 h-2.5 text-amber-500/70" />
                            <span className="tabular-nums">{avgQuality.toFixed(0)}</span>
                          </span>
                        )}
                        {withWords.length > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-zinc-500">
                            <FileText className="w-2.5 h-2.5 text-zinc-600" />
                            <span className="tabular-nums">{totalWords.toLocaleString("en-US")}w</span>
                          </span>
                        )}
                      </div>
                    );
                  })()}
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
      <AddArticleModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={(card) => addKanbanCard(card)}
      />
    </div>
  );
}
