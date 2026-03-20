"use client";

import { useState } from "react";
import { TaskItem, TaskColumn, TaskPriority } from "./mockTaskData";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (task: TaskItem) => void;
}

export function AddTaskModal({ open, onClose, onAdd }: Props) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [column, setColumn] = useState<TaskColumn>("backlog");
  const [tags, setTags] = useState("");
  const [dueDate, setDueDate] = useState("");

  function handleAdd() {
    if (!title.trim()) return;
    const task: TaskItem = {
      id: `t${Date.now()}`,
      title: title.trim(),
      column,
      priority,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      dueDate: dueDate || undefined,
    };
    onAdd(task);
    setTitle("");
    setPriority("medium");
    setColumn("backlog");
    setTags("");
    setDueDate("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Add New Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              placeholder="Task title..."
              className="bg-zinc-900 border-zinc-700 text-white text-xs h-8 placeholder:text-zinc-600"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {(["low", "medium", "high", "urgent"] as TaskPriority[]).map((p) => (
                    <SelectItem key={p} value={p} className="text-xs text-white capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Column</Label>
              <Select value={column} onValueChange={(v) => setColumn(v as TaskColumn)}>
                <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {(["backlog", "in_progress", "testing", "done"] as TaskColumn[]).map((c) => (
                    <SelectItem key={c} value={c} className="text-xs text-white capitalize">
                      {c.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400">Tags <span className="text-zinc-600">(comma-separated)</span></Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="pipeline, seo, quality..."
              className="bg-zinc-900 border-zinc-700 text-white text-xs h-8 placeholder:text-zinc-600"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400">Due Date <span className="text-zinc-600">(optional)</span></Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-white text-xs h-8"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-400 hover:text-white text-xs h-8">
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-amber-500 hover:bg-amber-400 text-black font-medium text-xs h-8"
            onClick={handleAdd}
            disabled={!title.trim()}
          >
            Add Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
