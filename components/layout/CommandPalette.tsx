"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  LayoutDashboard,
  GitBranch,
  DollarSign,
  FileText,
  CheckSquare,
  Globe,
  Star,
  Zap,
} from "lucide-react";
import { MOCK_CARDS } from "@/components/kanban/mockKanbanData";

const NAV_ITEMS = [
  { label: "Overview",  href: "/",         icon: LayoutDashboard, desc: "Dashboard & KPIs" },
  { label: "Pipeline",  href: "/pipeline",  icon: GitBranch,       desc: "Visualize article flow" },
  { label: "Costs",     href: "/costs",     icon: DollarSign,      desc: "LLM cost tracker" },
  { label: "Content",   href: "/content",   icon: FileText,        desc: "Content kanban" },
  { label: "Tasks",     href: "/tasks",     icon: CheckSquare,     desc: "Task management" },
];

const RECENT = MOCK_CARDS.filter((c) => c.column === "published").slice(0, 4);

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const toggle = useCallback(() => setOpen((o) => !o), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggle();
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  function navigate(href: string) {
    router.push(href);
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="relative w-full max-w-lg mx-4 bg-zinc-950 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Command className="text-white" label="Command palette">
          {/* Input */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <Command.Input
              placeholder="Search pages, articles..."
              className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 outline-none"
            />
            <kbd className="text-[10px] text-zinc-600 border border-zinc-700 rounded px-1.5 py-0.5">esc</kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto py-2">
            <Command.Empty className="py-8 text-center text-xs text-zinc-500">
              No results found.
            </Command.Empty>

            {/* Navigation */}
            <Command.Group>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                Navigation
              </div>
              {NAV_ITEMS.map((item) => (
                <Command.Item
                  key={item.href}
                  value={`nav ${item.label} ${item.desc}`}
                  onSelect={() => navigate(item.href)}
                  className="flex items-center gap-3 px-3 py-2.5 mx-1 rounded-lg cursor-pointer text-sm
                    text-zinc-300 hover:bg-zinc-800 hover:text-white
                    data-[selected=true]:bg-zinc-800 data-[selected=true]:text-white
                    transition-colors"
                >
                  <item.icon className="w-4 h-4 text-zinc-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium">{item.label}</div>
                    <div className="text-[10px] text-zinc-600">{item.desc}</div>
                  </div>
                </Command.Item>
              ))}
            </Command.Group>

            {/* Recent articles */}
            {RECENT.length > 0 && (
              <Command.Group>
                <div className="px-3 py-1.5 mt-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                  Recent Articles
                </div>
                {RECENT.map((card) => (
                  <Command.Item
                    key={card.id}
                    value={`article ${card.title} ${card.keyword} ${card.destination}`}
                    onSelect={() => navigate("/content")}
                    className="flex items-center gap-3 px-3 py-2.5 mx-1 rounded-lg cursor-pointer
                      text-zinc-300 hover:bg-zinc-800 hover:text-white
                      data-[selected=true]:bg-zinc-800 data-[selected=true]:text-white
                      transition-colors"
                  >
                    <FileText className="w-4 h-4 text-zinc-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{card.title}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-zinc-600 flex items-center gap-0.5">
                          <Globe className="w-2.5 h-2.5" />
                          {card.destination}
                        </span>
                        {card.qualityScore && (
                          <span className="text-[10px] text-emerald-500 flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5" />
                            {card.qualityScore}
                          </span>
                        )}
                      </div>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          {/* Footer */}
          <div className="flex items-center gap-3 px-4 py-2 border-t border-zinc-800 text-[10px] text-zinc-600">
            <span><kbd className="border border-zinc-700 rounded px-1">↑↓</kbd> navigate</span>
            <span><kbd className="border border-zinc-700 rounded px-1">↵</kbd> select</span>
            <span><kbd className="border border-zinc-700 rounded px-1">esc</kbd> close</span>
            <span className="ml-auto flex items-center gap-1">
              <kbd className="border border-zinc-700 rounded px-1">⌘K</kbd>
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}
