"use client";

import { useState, useCallback } from "react";
import { useAppStore, type PostingGoal } from "@/lib/store";
import { PLATFORM_COLORS } from "@/lib/platform-colors";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Plus,
  Check,
  X,
  Instagram,
  Facebook,
  Video,
  LayoutGrid,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PostingGoalTrackerProps {
  todayPublications: { platform: string }[];
}

// ---------------------------------------------------------------------------
// Platform config
// ---------------------------------------------------------------------------

const PLATFORM_ICONS: Record<PostingGoal["platform"], LucideIcon> = {
  instagram: Instagram,
  facebook: Facebook,
  tiktok: Video,
  all: LayoutGrid,
};

const PLATFORM_LABELS: Record<PostingGoal["platform"], string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  all: "All platforms",
};

// ---------------------------------------------------------------------------
// Single goal progress indicator
// ---------------------------------------------------------------------------

function GoalIndicator({
  goal,
  count,
  onRemove,
}: {
  goal: PostingGoal;
  count: number;
  onRemove: (id: string) => void;
}) {
  const met = count >= goal.target;
  const pct = Math.min((count / goal.target) * 100, 100);
  const Icon = PLATFORM_ICONS[goal.platform];

  const platformColor =
    goal.platform === "all"
      ? "text-zinc-400"
      : PLATFORM_COLORS[goal.platform]?.text ?? "text-zinc-400";

  return (
    <div className="relative group flex items-center gap-2 rounded-lg bg-zinc-800/60 px-3 py-2 min-w-[120px]">
      {/* Remove button */}
      <button
        onClick={() => onRemove(goal.id)}
        className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center w-4 h-4 rounded-full bg-zinc-700 hover:bg-rose-500 text-zinc-400 hover:text-white transition-colors"
        aria-label={`Remove ${PLATFORM_LABELS[goal.platform]} goal`}
      >
        <X className="w-2.5 h-2.5" />
      </button>

      {/* Platform icon */}
      <div className="p-1 rounded bg-zinc-700/60">
        <Icon className={`w-3.5 h-3.5 ${platformColor}`} />
      </div>

      {/* Progress text + bar */}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={`text-xs font-semibold tabular-nums ${
              met ? "text-emerald-400" : "text-zinc-200"
            }`}
          >
            {count}/{goal.target}
          </span>
          {met && <Check className="w-3 h-3 text-emerald-400" />}
        </div>

        {/* Thin progress bar */}
        <div className="w-full h-1 rounded-full bg-zinc-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              met ? "bg-emerald-400" : "bg-amber-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline add-goal form
// ---------------------------------------------------------------------------

function AddGoalForm({ onClose }: { onClose: () => void }) {
  const addPostingGoal = useAppStore((s) => s.addPostingGoal);
  const [platform, setPlatform] = useState<PostingGoal["platform"]>("all");
  const [target, setTarget] = useState("1");

  const handleSave = useCallback(() => {
    const t = parseInt(target, 10);
    if (isNaN(t) || t < 1) return;

    addPostingGoal({
      id: crypto.randomUUID(),
      platform,
      frequency: "daily",
      target: t,
    });
    onClose();
  }, [platform, target, addPostingGoal, onClose]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={platform} onValueChange={(val) => setPlatform(val as PostingGoal["platform"])}>
        <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200 h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All platforms</SelectItem>
          <SelectItem value="instagram">Instagram</SelectItem>
          <SelectItem value="facebook">Facebook</SelectItem>
          <SelectItem value="tiktok">TikTok</SelectItem>
        </SelectContent>
      </Select>

      <Input
        type="number"
        min={1}
        max={99}
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="w-16 bg-zinc-800 border-zinc-700 text-zinc-200 h-7 text-xs text-center"
        placeholder="3"
      />
      <span className="text-xs text-zinc-500">/day</span>

      <Button size="xs" onClick={handleSave}>
        Save
      </Button>
      <Button size="xs" variant="ghost" onClick={onClose}>
        Cancel
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PostingGoalTracker({
  todayPublications,
}: PostingGoalTrackerProps) {
  const postingGoals = useAppStore((s) => s.postingGoals);
  const removePostingGoal = useAppStore((s) => s.removePostingGoal);
  const [showForm, setShowForm] = useState(false);

  // Count publications per platform
  const countForGoal = useCallback(
    (goal: PostingGoal): number => {
      if (goal.platform === "all") {
        return todayPublications.length;
      }
      return todayPublications.filter(
        (p) => p.platform.toLowerCase() === goal.platform
      ).length;
    },
    [todayPublications]
  );

  // Empty state
  if (postingGoals.length === 0 && !showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-700/60 bg-zinc-900/40 px-4 py-3 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/30 transition-all duration-200 w-full cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        <span className="text-xs font-medium">Set a posting goal</span>
      </button>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800/80">
      <CardContent className="py-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Goal indicators */}
          {postingGoals.map((goal) => (
            <GoalIndicator
              key={goal.id}
              goal={goal}
              count={countForGoal(goal)}
              onRemove={removePostingGoal}
            />
          ))}

          {/* Add button or inline form */}
          {showForm ? (
            <AddGoalForm onClose={() => setShowForm(false)} />
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center justify-center w-8 h-8 rounded-lg border border-dashed border-zinc-700/60 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400 hover:bg-zinc-800/40 transition-colors cursor-pointer"
              aria-label="Add posting goal"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
