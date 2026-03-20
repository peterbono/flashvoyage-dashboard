"use client";

import { useState } from "react";
import { TaskItem, PRIORITY_CONFIG } from "./mockTaskData";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Calendar, Tag, Pencil, Trash2, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Props {
  task: TaskItem | null;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<TaskItem>) => void;
  onDelete: (id: string) => void;
}

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
    if (task) {
      onDelete(task.id);
      onClose();
    }
  }

  if (!task) return null;
  const priority = PRIORITY_CONFIG[task.priority];
  const isOverdue =
    task.dueDate && new Date(task.dueDate) < new Date() && task.column !== "done";

  return (
    <Sheet open={!!task} onOpenChange={(open) => { if (!open) { setEditingTitle(false); onClose(); } }}>
      <SheetContent className="bg-zinc-950 border-zinc-800 text-white w-96">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className={`text-[10px] ${priority.color}`}>
              {priority.label}
            </Badge>
            <span className="text-[10px] text-zinc-600 capitalize">{task.column.replace("_", " ")}</span>
          </div>

          {editingTitle ? (
            <div className="flex gap-1.5">
              <Input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                className="bg-zinc-900 border-zinc-700 text-white text-xs h-8 flex-1"
                autoFocus
              />
              <Button size="icon" className="h-8 w-8 bg-emerald-600 hover:bg-emerald-500 shrink-0" onClick={saveTitle}>
                <Check className="w-3.5 h-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 hover:text-white shrink-0" onClick={() => setEditingTitle(false)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-start gap-2 group">
              <SheetTitle className="text-sm font-semibold text-white leading-snug text-left flex-1">
                {task.title}
              </SheetTitle>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-white shrink-0 transition-opacity"
                onClick={startEdit}
              >
                <Pencil className="w-3 h-3" />
              </Button>
            </div>
          )}
        </SheetHeader>

        <div className="space-y-4 text-xs overflow-y-auto">
          {/* Description */}
          {task.description && (
            <div className="bg-zinc-900 rounded-lg px-3 py-2.5 text-zinc-400 leading-relaxed">
              {task.description}
            </div>
          )}

          <Separator className="bg-zinc-800" />

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            {task.dueDate && (
              <div className="bg-zinc-900 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-zinc-500">
                  <Calendar className="w-3 h-3" />
                  <span>Due Date</span>
                </div>
                <div className={`font-medium ${isOverdue ? "text-red-400" : "text-white"}`}>
                  {task.dueDate}
                  {isOverdue && <span className="ml-1 text-[9px]">overdue</span>}
                </div>
              </div>
            )}
            {task.tags.length > 0 && (
              <div className="bg-zinc-900 rounded-lg p-3 space-y-1 col-span-2">
                <div className="flex items-center gap-1.5 text-zinc-500 mb-1.5">
                  <Tag className="w-3 h-3" />
                  <span>Tags</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {task.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[9px] px-1.5 py-0 border-zinc-700 text-zinc-400">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Separator className="bg-zinc-800" />

          {/* Actions */}
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="text-red-400 hover:text-red-300 hover:bg-red-950/30 text-xs h-7 gap-1.5"
              onClick={handleDelete}
            >
              <Trash2 className="w-3 h-3" />
              Delete Task
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
