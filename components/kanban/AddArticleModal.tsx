"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KanbanCard, KanbanColumn, SourceType } from "./mockKanbanData";
import { Sparkles, ListPlus } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd?: (card: KanbanCard) => void;
}

const EMPTY = { title: "", keyword: "", destination: "", source: "" as SourceType | "", language: "" };

export function AddArticleModal({ open, onClose, onAdd }: Props) {
  const [form, setForm] = useState(EMPTY);

  const isValid = form.title.trim() && form.keyword.trim() && form.source && form.language;

  function reset() {
    setForm(EMPTY);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function submit(runNow: boolean) {
    if (!isValid) return;
    const targetColumn: KanbanColumn = runNow ? "generating" : "sourced";
    const card: KanbanCard = {
      id: `manual-${Date.now()}`,
      title: form.title.trim(),
      keyword: form.keyword.trim(),
      source: form.source as SourceType,
      column: targetColumn,
      date: new Date().toISOString().slice(0, 10),
      language: form.language as KanbanCard["language"],
      destination: form.destination.trim() || "International",
      cost: runNow ? 0.00 : undefined,
    };
    onAdd?.(card);
    handleClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Add Article</DialogTitle>
          <p className="text-xs text-zinc-600 mt-0.5">
            Queue it for later or trigger a pipeline run immediately.
          </p>
        </DialogHeader>

        <div className="space-y-3.5 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400">Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Article title or topic idea..."
              className="bg-zinc-900 border-zinc-700 text-white text-xs h-8 placeholder:text-zinc-600"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400">Target Keyword</Label>
            <Input
              value={form.keyword}
              onChange={(e) => setForm((f) => ({ ...f, keyword: e.target.value }))}
              placeholder="Primary keyword..."
              className="bg-zinc-900 border-zinc-700 text-white text-xs h-8 placeholder:text-zinc-600"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400">Destination <span className="text-zinc-600">(optional)</span></Label>
            <Input
              value={form.destination}
              onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
              placeholder="Thailand, Japan, Bali..."
              className="bg-zinc-900 border-zinc-700 text-white text-xs h-8 placeholder:text-zinc-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Source</Label>
              <Select
                value={form.source}
                onValueChange={(v) => setForm((f) => ({ ...f, source: v as SourceType }))}
              >
                <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white text-xs h-8">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  <SelectItem value="Manual" className="text-xs text-white">Manual</SelectItem>
                  <SelectItem value="Reddit" className="text-xs text-white">Reddit</SelectItem>
                  <SelectItem value="RSS" className="text-xs text-white">RSS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Language</Label>
              <Select
                value={form.language}
                onValueChange={(v) => setForm((f) => ({ ...f, language: v ?? "" }))}
              >
                <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white text-xs h-8">
                  <SelectValue placeholder="Lang" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {["EN", "FR", "ES", "DE"].map((l) => (
                    <SelectItem key={l} value={l} className="text-xs text-white">{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="text-zinc-400 hover:text-white text-xs h-8"
          >
            Cancel
          </Button>

          <div className="flex gap-2 ml-auto">
            <Button
              size="sm"
              variant="outline"
              disabled={!isValid}
              onClick={() => submit(false)}
              className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white text-xs h-8 gap-1.5"
            >
              <ListPlus className="w-3.5 h-3.5" />
              Add to Queue
            </Button>
            <Button
              size="sm"
              disabled={!isValid}
              onClick={() => submit(true)}
              className="bg-amber-500 hover:bg-amber-400 text-black font-medium text-xs h-8 gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate Now
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
