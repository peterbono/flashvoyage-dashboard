"use client";

import { useState } from "react";
import { TaskItem, TaskColumn, PRIORITY_CONFIG } from "./mockTaskData";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Calendar, Tag, Pencil, Trash2, Check, X, Clock, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  task: TaskItem | null;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<TaskItem>) => void;
  onDelete: (id: string) => void;
}

const COLUMN_META: Record<TaskColumn, { label: string; color: string; dot: string }> = {
  backlog:     { label: "Backlog",     color: "text-zinc-400 bg-zinc-800/60 border-zinc-700",             dot: "bg-zinc-500" },
  in_progress: { label: "In Progress", color: "text-blue-400 bg-blue-950/40 border-blue-800/60",          dot: "bg-blue-400" },
  testing:     { label: "Testing",     color: "text-amber-400 bg-amber-950/40 border-amber-800/60",       dot: "bg-amber-400" },
  done:        { label: "Done",        color: "text-emerald-400 bg-emerald-950/40 border-emerald-800/60", dot: "bg-emerald-400" },
};

export function TaskDetailSheet({ task, onClose, onUpdate, onDelete }: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");

  function startEdit() {
    setDraftTitle(task?.title ?? "");
    setEditingTitle(true);
  }

  function saveTitle() {
    if (task && draftTitle.trim()) {
      onUpdate(task.id, { title: draftTitle.trim() });
    }
    setEditingTitle(false);
  }

  function handleDelete() {
    if (task) { onDelete(task.id); onClose(); }
  }

  return (
    <Sheet open={!!task} onOpenChange={(open) => { if (!open) { setEditingTitle(false); onClose(); } }}>
      <SheetContent className="bg-white dark:bg-[#111111] border-l border-gray-200 dark:border-zinc-800/60 text-gray-900 dark:text-white w-[420px] p-0 flex flex-col">
        {task && (() => {
          const col = COLUMN_META[task.column];
          const pri = PRIORITY_CONFIG[task.priority];
          const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.column !== "done";

          return (
            <>
              {/* Header */}
              <div className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-zinc-800/50">
                {/* Chips row */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${col.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
                    {col.label}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${pri.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${pri.dot}`} />
                    {pri.label}
                  </span>
                  {isOverdue && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border text-red-400 bg-red-950/40 border-red-800/60 ml-auto">
                      <AlertCircle className="w-3 h-3" />
                      Overdue
                    </span>
                  )}
                </div>

                {/* Title */}
                {editingTitle ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                      className="bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white text-[14px] h-9 flex-1"
                      autoFocus
                    />
                    <Button size="icon" className="h-8 w-8 bg-emerald-600 hover:bg-emerald-500 shrink-0" onClick={saveTitle}>
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-white shrink-0" onClick={() => setEditingTitle(false)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 group">
                    <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white leading-snug flex-1">
                      {task.title}
                    </h2>
                    <button
                      className="mt-0.5 p-1 rounded opacity-0 group-hover:opacity-100 text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-white transition-opacity"
                      onClick={startEdit}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Due date inline */}
                {task.dueDate && (
                  <div className={`flex items-center gap-1.5 mt-2.5 text-xs ${isOverdue ? "text-red-400" : "text-gray-400 dark:text-zinc-500"}`}>
                    <Clock className="w-3 h-3" />
                    <span>Due {task.dueDate}</span>
                    {isOverdue && <span className="font-medium">· overdue</span>}
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

                {/* Description */}
                {task.description && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                      Description
                    </p>
                    <div className="bg-gray-50 dark:bg-zinc-900/60 border border-gray-200 dark:border-zinc-800/60 rounded-lg px-3 py-2.5 text-[13px] text-gray-700 dark:text-zinc-300 leading-relaxed">
                      {task.description}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {task.tags.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                      Tags
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {task.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400"
                        >
                          <Tag className="w-2.5 h-2.5" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Meta */}
                <div>
                  <p className="text-xs font-medium text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                    Details
                  </p>
                  <div className="bg-gray-50 dark:bg-zinc-900/60 border border-gray-200 dark:border-zinc-800/60 rounded-lg px-3 divide-y divide-gray-100 dark:divide-zinc-800/60">
                    <div className="flex items-center justify-between py-2.5">
                      <span className="text-[12px] text-gray-400 dark:text-zinc-500">Status</span>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
                        <span className="text-gray-800 dark:text-zinc-200">{col.label}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2.5">
                      <span className="text-[12px] text-gray-400 dark:text-zinc-500">Priority</span>
                      <span className={`text-[13px] font-medium`} style={{ color: "inherit" }}>
                        <span className={`text-xs font-medium ${pri.color.split(" ")[0]}`}>{pri.label}</span>
                      </span>
                    </div>
                    {task.dueDate && (
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-[12px] text-gray-400 dark:text-zinc-500">Due date</span>
                        <span className={`text-[13px] font-medium ${isOverdue ? "text-red-400" : "text-gray-800 dark:text-zinc-200"}`}>
                          {task.dueDate}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-2.5">
                      <span className="text-[12px] text-gray-400 dark:text-zinc-500">Task ID</span>
                      <span className="text-[13px] font-mono text-gray-500 dark:text-zinc-500">#{task.id}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-gray-100 dark:border-zinc-800/50">
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-[13px] font-medium text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete task
                </button>
              </div>
            </>
          );
        })()}
      </SheetContent>
    </Sheet>
  );
}
