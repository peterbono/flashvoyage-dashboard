"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";

const DESTINATIONS = [
  "Thailand",
  "Vietnam",
  "Bali",
  "Japan",
  "Philippines",
  "Cambodia",
  "Sri Lanka",
  "Malaysia",
  "South Korea",
  "Georgia",
  "India",
  "International",
];

interface Props {
  onSubmitted?: () => void;
}

export function ArticleInjectorForm({ onSubmitted }: Props) {
  const [form, setForm] = useState({
    title: "",
    keyword: "",
    destination: "",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = form.title.trim() && form.keyword.trim();

  async function handleSubmit() {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          topic: form.keyword.trim(),
          keywords: [form.keyword.trim()],
          priority: form.priority,
          notes: [form.destination, form.notes].filter(Boolean).join(" | "),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setSuccess(true);
      setForm({ title: "", keyword: "", destination: "", priority: "medium", notes: "" });
      onSubmitted?.();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
      <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">
        Injecter un article
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
        {/* Title */}
        <div className="sm:col-span-2 lg:col-span-2 space-y-1">
          <Label className="text-xs text-zinc-500">Titre / Sujet</Label>
          <Input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Ex: Guide complet Bali 2026..."
            className="bg-zinc-950 border-zinc-700 text-white text-xs h-8 placeholder:text-zinc-600"
          />
        </div>

        {/* Keyword */}
        <div className="space-y-1">
          <Label className="text-xs text-zinc-500">Mot-cle</Label>
          <Input
            value={form.keyword}
            onChange={(e) => setForm((f) => ({ ...f, keyword: e.target.value }))}
            placeholder="voyage bali budget"
            className="bg-zinc-950 border-zinc-700 text-white text-xs h-8 placeholder:text-zinc-600"
          />
        </div>

        {/* Destination */}
        <div className="space-y-1">
          <Label className="text-xs text-zinc-500">Destination</Label>
          <Select
            value={form.destination}
            onValueChange={(v) => setForm((f) => ({ ...f, destination: v ?? "" }))}
          >
            <SelectTrigger className="bg-zinc-950 border-zinc-700 text-white text-xs h-8 w-full">
              <SelectValue placeholder="Choisir..." />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              {DESTINATIONS.map((d) => (
                <SelectItem key={d} value={d} className="text-xs text-white">
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Priority */}
        <div className="space-y-1">
          <Label className="text-xs text-zinc-500">Priorite</Label>
          <Select
            value={form.priority}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, priority: v as typeof form.priority }))
            }
          >
            <SelectTrigger className="bg-zinc-950 border-zinc-700 text-white text-xs h-8 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="urgent" className="text-xs text-white">
                P1 - Urgent
              </SelectItem>
              <SelectItem value="high" className="text-xs text-white">
                P2 - High
              </SelectItem>
              <SelectItem value="medium" className="text-xs text-white">
                P3 - Medium
              </SelectItem>
              <SelectItem value="low" className="text-xs text-white">
                Low
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Submit */}
        <div className="space-y-1">
          <Label className="text-xs text-zinc-500 invisible">Submit</Label>
          <Button
            size="sm"
            disabled={!isValid || submitting}
            onClick={handleSubmit}
            className="bg-amber-500 hover:bg-amber-400 text-black font-medium text-xs h-8 w-full gap-1.5"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            Ajouter
          </Button>
        </div>
      </div>

      {/* Notes field (optional, full width below) */}
      <div className="mt-2">
        <Input
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Notes (optionnel)..."
          className="bg-zinc-950 border-zinc-700 text-white text-xs h-7 placeholder:text-zinc-600"
        />
      </div>

      {/* Feedback */}
      {success && (
        <p className="text-xs text-emerald-400 mt-2">
          Article ajoute a la queue avec succes.
        </p>
      )}
      {error && (
        <p className="text-xs text-rose-400 mt-2">Erreur: {error}</p>
      )}
    </div>
  );
}
