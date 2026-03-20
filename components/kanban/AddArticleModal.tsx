"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AddArticleModal({ open, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [keyword, setKeyword] = useState("");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Add New Article</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Article title..."
              className="bg-zinc-900 border-zinc-700 text-white text-xs h-8 placeholder:text-zinc-600"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400">Target Keyword</Label>
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Primary keyword..."
              className="bg-zinc-900 border-zinc-700 text-white text-xs h-8 placeholder:text-zinc-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Source</Label>
              <Select>
                <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white text-xs h-8">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {["Reddit", "RSS", "Manual"].map((s) => (
                    <SelectItem key={s} value={s} className="text-xs text-white">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Language</Label>
              <Select>
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
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-zinc-400 hover:text-white text-xs h-8">
            Cancel
          </Button>
          <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-black font-medium text-xs h-8" onClick={onClose}>
            Add Article
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
