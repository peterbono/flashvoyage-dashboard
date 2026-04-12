"use client";

/**
 * Shared disclosure panel that renders a list of ActionRecommendations.
 *
 * Used by RefreshQueueCard and TopPerformersCard to show per-article action
 * recommendations computed by the rule engine (lib/content/actionRules).
 *
 * A11y: WAI-ARIA Disclosure pattern (non-modal). The parent row is
 * responsible for wiring the toggle button with aria-expanded/aria-controls;
 * this component renders the expanded region with role="region".
 */

import { useCallback, useState } from "react";
import {
  DollarSign,
  Sparkles,
  LayoutTemplate,
  ShieldCheck,
  Zap,
  Target,
  ExternalLink,
  RefreshCw,
  Check,
  X,
  Film,
  Search,
  TrendingUp,
  GitMerge,
  Globe,
  Link as LinkIcon,
  type LucideIcon,
} from "lucide-react";
import type { ActionRecommendation, ActionCta } from "@/lib/content/actionRules";
export type { ActionRecommendation } from "@/lib/content/actionRules";

// ---------------------------------------------------------------------------
// Icon registry — rule engine refers to icons by string name
// ---------------------------------------------------------------------------

const ICON_REGISTRY: Record<string, LucideIcon> = {
  DollarSign,
  Sparkles,
  LayoutTemplate,
  ShieldCheck,
  Zap,
  Target,
  Film,
  Search,
  TrendingUp,
  GitMerge,
  Globe,
  Link: LinkIcon,
};

function getIcon(name: string): LucideIcon {
  return ICON_REGISTRY[name] ?? Zap;
}

// ---------------------------------------------------------------------------
// CTA state machine — per-action, so clicks on different actions don't
// clobber each other's visual feedback.
// ---------------------------------------------------------------------------

type CtaState = "idle" | "running" | "done" | "error";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  recommendations: ActionRecommendation[];
  /** DOM id for the region — must match aria-controls on the parent toggle. */
  panelId: string;
  /** Human label for the article the actions apply to. Used in aria-label. */
  articleTitle: string;
  /** When the user clicks "Mark done" on a rule, parent persists it to the
      shared action history and re-evaluates the rules so the action
      disappears from the display. */
  onMarkDone?: (rec: ActionRecommendation) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActionPanel({
  recommendations,
  panelId,
  articleTitle,
  onMarkDone,
}: Props) {
  const [ctaStates, setCtaStates] = useState<Record<string, CtaState>>({});

  const runCta = useCallback(
    async (ruleId: string, cta: ActionCta) => {
      setCtaStates((s) => ({ ...s, [ruleId]: "running" }));
      try {
        if (cta.kind === "workflow") {
          const res = await fetch("/api/workflows/dispatch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workflow: cta.workflow,
              inputs: cta.inputs,
            }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } else if (cta.kind === "url") {
          window.open(cta.href, "_blank", "noopener,noreferrer");
        } else {
          // todo — no-op, UI should render disabled
          return;
        }
        setCtaStates((s) => ({ ...s, [ruleId]: "done" }));
        setTimeout(
          () => setCtaStates((s) => ({ ...s, [ruleId]: "idle" })),
          4000
        );
      } catch (err) {
        console.error("[ActionPanel/runCta]", ruleId, err);
        setCtaStates((s) => ({ ...s, [ruleId]: "error" }));
        setTimeout(
          () => setCtaStates((s) => ({ ...s, [ruleId]: "idle" })),
          4000
        );
      }
    },
    []
  );

  if (recommendations.length === 0) {
    // Note: on the Refresh Queue surface, R8 (catch-all) should always fire
    // so this branch should only render on Top Performers. If it ever shows
    // up on a declining Refresh Queue article, treat it as a rule gap and
    // point the founder at manual diagnostics rather than claiming "healthy".
    return (
      <div
        id={panelId}
        role="region"
        aria-label={`No recommendations for ${articleTitle}`}
        className="mt-2 mx-6 px-3 py-2 rounded-md border border-zinc-800/60 bg-zinc-900/40 text-[11px] text-zinc-400 flex items-center gap-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-150"
      >
        <Check className="w-3 h-3 text-emerald-400 shrink-0" aria-hidden="true" />
        No automated action matches right now — signals are within healthy thresholds.
      </div>
    );
  }

  return (
    <div
      id={panelId}
      role="region"
      aria-label={`Recommended actions for ${articleTitle}`}
      className="mt-2 mx-6 space-y-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-150"
    >
      {recommendations.map((rec) => {
        const Icon = getIcon(rec.icon);
        const ctaState = ctaStates[rec.id] ?? "idle";
        const isQuickWin = rec.tag === "Quick win";
        const borderAccent = isQuickWin
          ? "border-l-amber-500"
          : "border-l-cyan-500";
        const tagStyle = isQuickWin
          ? "bg-amber-500/15 text-amber-400"
          : "bg-cyan-500/15 text-cyan-400";
        const isTodo = rec.cta.kind === "todo";
        return (
          <article
            key={rec.id}
            aria-labelledby={`${panelId}-${rec.id}-title`}
            className={`rounded-md border border-zinc-800/80 border-l-2 ${borderAccent} bg-zinc-900/60 p-3`}
          >
            <div className="flex items-start gap-2.5">
              <Icon
                className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                  isQuickWin ? "text-amber-400" : "text-cyan-400"
                }`}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h4
                    id={`${panelId}-${rec.id}-title`}
                    className="text-xs font-medium text-zinc-100"
                  >
                    {rec.headline}
                  </h4>
                  <span
                    className={`text-[9px] uppercase tracking-wide font-semibold px-1.5 py-0 rounded ${tagStyle}`}
                  >
                    {rec.tag}
                  </span>
                  <span className="text-[10px] text-zinc-400 tabular-nums">
                    <span className="sr-only">Estimated duration </span>
                    {rec.duration}
                  </span>
                </div>
                <div className="text-[10px] text-emerald-400 font-mono tabular-nums mt-0.5">
                  <span className="sr-only">Expected lift </span>
                  {rec.expectedLift}
                </div>
                <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                  {rec.rationale}
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => !isTodo && runCta(rec.id, rec.cta)}
                    disabled={isTodo || ctaState === "running" || ctaState === "done"}
                    title={
                      isTodo && rec.cta.kind === "todo"
                        ? rec.cta.note
                        : ctaState === "done"
                        ? "Dispatched successfully"
                        : ctaState === "error"
                        ? "Action failed — check console"
                        : undefined
                    }
                    aria-describedby={`${panelId}-${rec.id}-title`}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
                      ctaState === "done"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                        : ctaState === "error"
                        ? "border-red-500/40 bg-red-500/10 text-red-400"
                        : isTodo
                        ? "border-zinc-800 text-zinc-500 cursor-not-allowed"
                        : "border-cyan-800/60 bg-cyan-950/30 text-cyan-400 hover:bg-cyan-900/40 disabled:opacity-50"
                    }`}
                  >
                    {ctaState === "running" ? (
                      <RefreshCw
                        className="w-3 h-3 animate-spin"
                        aria-hidden="true"
                      />
                    ) : ctaState === "done" ? (
                      <Check className="w-3 h-3" aria-hidden="true" />
                    ) : ctaState === "error" ? (
                      <X className="w-3 h-3" aria-hidden="true" />
                    ) : rec.cta.kind === "url" ? (
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    ) : rec.cta.kind === "workflow" ? (
                      <Zap className="w-3 h-3" aria-hidden="true" />
                    ) : null}
                    {ctaState === "running"
                      ? "Running…"
                      : ctaState === "done"
                      ? "Done"
                      : ctaState === "error"
                      ? "Failed"
                      : rec.cta.label ??
                        (rec.cta.kind === "workflow"
                          ? "Run"
                          : rec.cta.kind === "url"
                          ? "Open"
                          : "Manual")}
                  </button>
                  {onMarkDone && (
                    <button
                      type="button"
                      onClick={() => onMarkDone(rec)}
                      aria-label={`Mark "${rec.headline}" as done`}
                      title="Mark as done — logs to the Action History and filters the rule out of this view until you undo"
                      className="text-[10px] text-zinc-500 hover:text-zinc-300 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm px-1"
                    >
                      Mark done
                    </button>
                  )}
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
