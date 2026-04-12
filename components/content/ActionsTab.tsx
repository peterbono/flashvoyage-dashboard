"use client";

/**
 * Consolidated Actions view — the primary "plan my content ops session" surface.
 *
 * Aggregates rule evaluations across all articles (Refresh Queue + Top Performers),
 * groups by rule (not by article — matches the founder's batch-the-same-work mental
 * model), sorts by total impact, and surfaces "Run all N" batch dispatch on
 * workflow-backed rules.
 *
 * Designed per the Product Designer + UX Researcher synthesis:
 * - Hero line: money + time + count (anxiety killer)
 * - Group by rule, sorted by summed priority desc
 * - Top group auto-expanded on first render
 * - Cap visible at top 10 with "+N lower priority" expand
 * - No confirm dialog on Run all — informational toast only (trust = reversibility)
 * - Empty state celebrates without condescending
 */

import { useCallback, useMemo, useRef, useState } from "react";
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
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Film,
  Search,
  TrendingUp,
  GitMerge,
  Link as LinkIcon,
  type LucideIcon,
} from "lucide-react";
import {
  evaluateRules,
  type ActionRecommendation,
  type ScoreSignals,
} from "@/lib/content/actionRules";
import { ActionHistory } from "./ActionHistory";
import { ActionDoneHistory } from "./ActionDoneHistory";
import { ImpactTracker } from "./ImpactTracker";
import { useActionHistory } from "./useActionHistory";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ActionableItem {
  slug: string;
  title: string;
  url: string;
  score: number;
  /** Optional — top performer items may not have a 7-day delta */
  delta7d?: number;
  flags: string[];
  signals?: ScoreSignals;
  wpId?: number;
}

interface Props {
  refreshQueue: ActionableItem[];
  topPerformers: ActionableItem[];
  loading: boolean;
}

// ---------------------------------------------------------------------------
// Icon registry (mirrors ActionPanel — DRY would require a shared module)
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
  Link: LinkIcon,
};

function getIcon(name: string): LucideIcon {
  return ICON_REGISTRY[name] ?? Zap;
}

// Rules whose CTA dispatches a workflow that ACCEPTS a batch `slugs` CSV input.
// Used to decide whether to render "Run all N" on a group header. Extend as
// new batch-capable workflows ship.
const BATCHABLE_RULE_IDS = new Set<string>([
  "R1-yyyy-refresh",
  "T3-preemptive-refresh",
]);

// ---------------------------------------------------------------------------
// Derived data types
// ---------------------------------------------------------------------------

interface EvaluatedAction {
  rec: ActionRecommendation;
  item: ActionableItem;
}

interface ActionGroup {
  ruleId: string;
  headline: string;
  icon: string;
  tag: "Quick win" | "Long bet";
  durationMinutes: number;
  expectedLiftPerArticle: string;
  items: EvaluatedAction[];
  totalPriority: number;
  liftLowSum: number;
  liftHighSum: number;
}

type GroupState = "idle" | "refreshing" | "done" | "error";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}

function formatDollarRange(low: number, high: number): string {
  if (low === 0 && high === 0) return "";
  if (low === high) return `$${low}/mo`;
  return `$${low}-${high}/mo`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActionsTab({ refreshQueue, topPerformers, loading }: Props) {
  // Expansion state for the accordion groups. Auto-expands the top group on
  // first render via the userInteracted ref — after the user clicks anything,
  // we respect their choice instead of forcing the top group open on re-poll.
  const userInteractedRef = useRef(false);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [showOverflow, setShowOverflow] = useState(false);

  // Per-group batch dispatch state.
  const [groupStates, setGroupStates] = useState<Record<string, GroupState>>(
    {},
  );

  // Shared action history — same source of truth as RefreshQueueCard +
  // TopPerformersCard. Filter out dismissed rules consistently.
  const history = useActionHistory();

  // ── Evaluate rules across both surfaces ──────────────────────────────────
  const evaluated = useMemo<EvaluatedAction[]>(() => {
    const result: EvaluatedAction[] = [];
    for (const item of refreshQueue) {
      if (!item.signals) continue;
      const recs = evaluateRules(
        {
          signals: item.signals,
          score: item.score,
          delta7d: item.delta7d ?? 0,
          flags: item.flags,
          slug: item.slug,
          title: item.title,
          url: item.url,
          wpId: item.wpId,
          surface: "refresh",
        },
        3,
      );
      for (const rec of recs) {
        if (history.isDismissed(item.slug, rec.id)) continue;
        result.push({ rec, item });
      }
    }
    for (const item of topPerformers) {
      if (!item.signals) continue;
      const recs = evaluateRules(
        {
          signals: item.signals,
          score: item.score,
          delta7d: item.delta7d ?? 0,
          flags: item.flags,
          slug: item.slug,
          title: item.title,
          url: item.url,
          wpId: item.wpId,
          surface: "top",
        },
        3,
      );
      for (const rec of recs) {
        if (history.isDismissed(item.slug, rec.id)) continue;
        result.push({ rec, item });
      }
    }
    return result;
  }, [refreshQueue, topPerformers, history]);

  // ── Group by rule id ─────────────────────────────────────────────────────
  const groups = useMemo<ActionGroup[]>(() => {
    const map = new Map<string, ActionGroup>();
    for (const { rec, item } of evaluated) {
      let g = map.get(rec.id);
      if (!g) {
        g = {
          ruleId: rec.id,
          headline: rec.headline,
          icon: rec.icon,
          tag: rec.tag,
          durationMinutes: rec.durationMinutes,
          expectedLiftPerArticle: rec.expectedLift,
          items: [],
          totalPriority: 0,
          liftLowSum: 0,
          liftHighSum: 0,
        };
        map.set(rec.id, g);
      }
      g.items.push({ rec, item });
      g.totalPriority += rec.priority;
      g.liftLowSum += rec.liftLow ?? 0;
      g.liftHighSum += rec.liftHigh ?? 0;
    }
    return Array.from(map.values()).sort(
      (a, b) => b.totalPriority - a.totalPriority,
    );
  }, [evaluated]);

  // Resolve the effective expanded group: user choice wins, otherwise top group.
  const effectiveExpanded = userInteractedRef.current
    ? expandedGroupId
    : groups[0]?.ruleId ?? null;

  const toggleExpand = useCallback((ruleId: string) => {
    userInteractedRef.current = true;
    setExpandedGroupId((prev) => (prev === ruleId ? null : ruleId));
  }, []);

  // ── Hero aggregation ─────────────────────────────────────────────────────
  // Tracked slugs for the Impact Tracker: all unique articles that appear
  // in either surface (Refresh Queue or Top Performers) OR have entries in
  // the action-done history. This gives us "everything the founder cares
  // about right now" as the tracking scope.
  const trackedSlugs = useMemo(() => {
    const map = new Map<string, { slug: string; title: string; url: string }>();
    for (const item of refreshQueue) {
      if (!map.has(item.slug)) {
        map.set(item.slug, { slug: item.slug, title: item.title, url: item.url });
      }
    }
    for (const item of topPerformers) {
      if (!map.has(item.slug)) {
        map.set(item.slug, { slug: item.slug, title: item.title, url: item.url });
      }
    }
    // Also include articles from action history that may have left the queue
    for (const entry of history.entries) {
      if (!map.has(entry.slug)) {
        map.set(entry.slug, {
          slug: entry.slug,
          title: entry.articleTitle,
          url: entry.articleUrl,
        });
      }
    }
    return Array.from(map.values());
  }, [refreshQueue, topPerformers, history.entries]);

  const hero = useMemo(() => {
    const count = evaluated.length;
    const quickWins = evaluated.filter(
      (e) => e.rec.tag === "Quick win",
    ).length;
    const longBets = count - quickWins;
    const liftLowTotal = groups.reduce((s, g) => s + g.liftLowSum, 0);
    const liftHighTotal = groups.reduce((s, g) => s + g.liftHighSum, 0);
    const totalMinutes = evaluated.reduce(
      (sum, e) => sum + e.rec.durationMinutes,
      0,
    );
    const articlesAffected = new Set(evaluated.map((e) => e.item.slug)).size;
    return {
      count,
      quickWins,
      longBets,
      liftLowTotal,
      liftHighTotal,
      totalMinutes,
      articlesAffected,
    };
  }, [evaluated, groups]);

  // ── Run all handler ──────────────────────────────────────────────────────
  const handleRunAll = useCallback(async (group: ActionGroup) => {
    // Only workflow-kind CTAs are batchable — take the first to extract the
    // workflow file name; all items in the group dispatch the SAME workflow.
    const firstWorkflowAction = group.items.find(
      ({ rec }) => rec.cta.kind === "workflow",
    );
    if (!firstWorkflowAction || firstWorkflowAction.rec.cta.kind !== "workflow") {
      return;
    }
    const workflowFile = firstWorkflowAction.rec.cta.workflow;
    const slugs = group.items.map(({ item }) => item.slug).join(",");

    setGroupStates((s) => ({ ...s, [group.ruleId]: "refreshing" }));
    try {
      const res = await fetch("/api/workflows/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow: workflowFile,
          inputs: { slugs },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setGroupStates((s) => ({ ...s, [group.ruleId]: "done" }));
      setTimeout(
        () =>
          setGroupStates((s) => {
            const next = { ...s };
            delete next[group.ruleId];
            return next;
          }),
        5000,
      );
    } catch (err) {
      console.error("[actions-tab/runAll]", group.ruleId, err);
      setGroupStates((s) => ({ ...s, [group.ruleId]: "error" }));
      setTimeout(
        () =>
          setGroupStates((s) => {
            const next = { ...s };
            delete next[group.ruleId];
            return next;
          }),
        5000,
      );
    }
  }, []);

  // ── Per-item CTA runner (for expanded group item list) ──────────────────
  const runItemCta = useCallback(
    async (rec: ActionRecommendation) => {
      if (rec.cta.kind === "workflow") {
        try {
          await fetch("/api/workflows/dispatch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workflow: rec.cta.workflow,
              inputs: rec.cta.inputs,
            }),
          });
        } catch (err) {
          console.error("[actions-tab/runItem]", rec.id, err);
        }
      } else if (rec.cta.kind === "url") {
        window.open(rec.cta.href, "_blank", "noopener,noreferrer");
      }
      // todo → no-op
    },
    [],
  );

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading && evaluated.length === 0) {
    return (
      <div className="text-xs text-zinc-500 text-center py-12">
        Computing recommendations…
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (evaluated.length === 0) {
    const totalArticles = refreshQueue.length + topPerformers.length;
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4">
            <CheckCircle2
              className="w-6 h-6 text-emerald-400"
              aria-hidden="true"
            />
          </div>
          <h3 className="text-sm font-semibold text-zinc-100">
            Portfolio is healthy
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            {totalArticles > 0
              ? `${totalArticles} articles scanned — 0 actions needed right now.`
              : "No articles loaded yet."}
          </p>
          <p className="text-[11px] text-zinc-500 mt-3">
            Rules re-evaluate on every dashboard poll (every 2 min).
          </p>
        </div>
        {/* Both histories stay available even when nothing is pending — the
            founder may still want to review past marked-done actions or
            recent workflow runs. */}
        <ActionDoneHistory />
        <ActionHistory />
      </div>
    );
  }

  const visibleGroups = showOverflow ? groups : groups.slice(0, 10);
  const overflowCount = Math.max(0, groups.length - 10);

  // ── Main view ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 md:p-5">
        <div className="flex items-baseline gap-3 flex-wrap">
          <DollarSign
            className="w-5 h-5 text-amber-400 self-center"
            aria-hidden="true"
          />
          <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
            On the table
          </div>
          {hero.liftHighTotal > 0 ? (
            <div className="text-2xl md:text-3xl font-bold text-white tabular-nums">
              {formatDollarRange(hero.liftLowTotal, hero.liftHighTotal)}
            </div>
          ) : (
            <div className="text-2xl md:text-3xl font-bold text-white tabular-nums">
              {hero.count} actions
            </div>
          )}
          <div className="text-xs text-zinc-400">
            {hero.liftHighTotal > 0 ? (
              <>
                across <span className="text-zinc-200">{hero.count}</span>{" "}
                action{hero.count !== 1 ? "s" : ""} ·{" "}
              </>
            ) : null}
            ~{formatMinutes(hero.totalMinutes)} of work · {hero.articlesAffected}{" "}
            article{hero.articlesAffected !== 1 ? "s" : ""} affected
          </div>
        </div>
        <div className="flex items-center gap-4 mt-2 text-[11px] text-zinc-400">
          <span className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-amber-400" aria-hidden="true" />
            <span className="tabular-nums">{hero.quickWins}</span> quick win
            {hero.quickWins !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1.5">
            <Target className="w-3 h-3 text-cyan-400" aria-hidden="true" />
            <span className="tabular-nums">{hero.longBets}</span> long bet
            {hero.longBets !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Impact Tracker — score evolution of tracked articles */}
      <ImpactTracker trackedSlugs={trackedSlugs} />

      {/* Groups */}
      <div className="space-y-2">
        {visibleGroups.map((group) => {
          const Icon = getIcon(group.icon);
          const isExpanded = effectiveExpanded === group.ruleId;
          const isQuickWin = group.tag === "Quick win";
          const accent = isQuickWin
            ? "border-l-amber-500"
            : "border-l-cyan-500";
          const tagStyle = isQuickWin
            ? "bg-amber-500/15 text-amber-400"
            : "bg-cyan-500/15 text-cyan-400";
          const groupState = groupStates[group.ruleId] ?? "idle";
          const isBatchable =
            BATCHABLE_RULE_IDS.has(group.ruleId) && group.items.length > 0;
          const totalTimeForGroup = group.durationMinutes * group.items.length;
          const panelId = `actions-group-${group.ruleId}`;

          return (
            <article
              key={group.ruleId}
              className={`rounded-md border border-zinc-800/80 border-l-2 ${accent} bg-zinc-900/60`}
            >
              <div className="flex items-start gap-2.5 p-3">
                <Icon
                  className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                    isQuickWin ? "text-amber-400" : "text-cyan-400"
                  }`}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={() => toggleExpand(group.ruleId)}
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                  className="flex-1 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm"
                >
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h3 className="text-xs font-medium text-zinc-100">
                      {group.headline}
                    </h3>
                    <span
                      className={`text-[9px] uppercase tracking-wide font-semibold px-1.5 py-0 rounded ${tagStyle}`}
                    >
                      {group.tag}
                    </span>
                    <span className="text-[10px] text-zinc-400 tabular-nums">
                      <span className="text-zinc-200 font-semibold">
                        {group.items.length}
                      </span>{" "}
                      article{group.items.length !== 1 ? "s" : ""}
                    </span>
                    <span className="text-[10px] text-zinc-400 tabular-nums">
                      · {formatMinutes(totalTimeForGroup)}
                    </span>
                    {group.liftHighSum > 0 ? (
                      <span className="text-[10px] text-emerald-400 font-mono tabular-nums">
                        ·{" "}
                        {formatDollarRange(
                          group.liftLowSum,
                          group.liftHighSum,
                        )}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">
                    {group.expectedLiftPerArticle} per article
                  </div>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  {isBatchable && (
                    <button
                      type="button"
                      onClick={() => handleRunAll(group)}
                      disabled={
                        groupState === "refreshing" || groupState === "done"
                      }
                      aria-label={`Run refresh workflow on all ${group.items.length} articles in this group`}
                      title={
                        groupState === "done"
                          ? `Dispatched — single workflow run processing ${group.items.length} articles (~6 min)`
                          : groupState === "error"
                          ? "Dispatch failed — check console"
                          : groupState === "refreshing"
                          ? "Dispatching batch…"
                          : `Run this rule on all ${group.items.length} articles in one batch workflow run (reversible via git)`
                      }
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
                        groupState === "done"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                          : groupState === "error"
                          ? "border-red-500/40 bg-red-500/10 text-red-400"
                          : "border-amber-800/60 bg-amber-950/30 text-amber-400 hover:bg-amber-900/40 disabled:opacity-50"
                      }`}
                    >
                      {groupState === "refreshing" ? (
                        <RefreshCw
                          className="w-3 h-3 animate-spin"
                          aria-hidden="true"
                        />
                      ) : groupState === "done" ? (
                        <Check className="w-3 h-3" aria-hidden="true" />
                      ) : groupState === "error" ? (
                        <X className="w-3 h-3" aria-hidden="true" />
                      ) : (
                        <Zap className="w-3 h-3" aria-hidden="true" />
                      )}
                      {groupState === "refreshing"
                        ? "Dispatching…"
                        : groupState === "done"
                        ? `Dispatched (${group.items.length})`
                        : groupState === "error"
                        ? "Failed"
                        : `Run all ${group.items.length}`}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleExpand(group.ruleId)}
                    aria-label={`${
                      isExpanded ? "Collapse" : "Expand"
                    } ${group.headline}`}
                    className="text-zinc-500 hover:text-zinc-200 transition-colors p-[14px] -m-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="w-3 h-3" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div
                  id={panelId}
                  role="region"
                  aria-label={`${group.headline} — affected articles`}
                  className="border-t border-zinc-800/60 px-3 py-2 space-y-1 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-150"
                >
                  {group.items.map(({ rec, item }) => (
                    <div
                      key={`${group.ruleId}-${item.slug}`}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-800/40 group/item"
                    >
                      <span className="text-zinc-600 text-[10px]" aria-hidden="true">
                        —
                      </span>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-zinc-200 truncate flex-1 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm"
                      >
                        {item.title}
                      </a>
                      {rec.liftHigh ? (
                        <span className="text-[10px] text-emerald-400 font-mono tabular-nums shrink-0">
                          {formatDollarRange(rec.liftLow ?? 0, rec.liftHigh)}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => runItemCta(rec)}
                        disabled={rec.cta.kind === "todo"}
                        aria-label={`${rec.cta.label ?? "Run"} for "${
                          item.title
                        }"`}
                        title={
                          rec.cta.kind === "todo" ? rec.cta.note : undefined
                        }
                        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
                          rec.cta.kind === "todo"
                            ? "border-zinc-800 text-zinc-600 cursor-not-allowed"
                            : "border-cyan-800/60 bg-cyan-950/20 text-cyan-400 hover:bg-cyan-900/40"
                        }`}
                      >
                        {rec.cta.kind === "url" ? (
                          <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
                        ) : rec.cta.kind === "workflow" ? (
                          <Zap className="w-2.5 h-2.5" aria-hidden="true" />
                        ) : null}
                        {rec.cta.label ??
                          (rec.cta.kind === "workflow"
                            ? "Run"
                            : rec.cta.kind === "url"
                            ? "Open"
                            : "Manual")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* Overflow */}
      {overflowCount > 0 && !showOverflow && (
        <button
          type="button"
          onClick={() => setShowOverflow(true)}
          className="text-[11px] text-zinc-500 hover:text-zinc-200 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm px-1"
        >
          Show +{overflowCount} lower-priority action
          {overflowCount !== 1 ? "s" : ""}
        </button>
      )}
      {showOverflow && overflowCount > 0 && (
        <button
          type="button"
          onClick={() => setShowOverflow(false)}
          className="text-[11px] text-zinc-500 hover:text-zinc-200 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm px-1"
        >
          Hide lower-priority actions
        </button>
      )}

      {/* Actions done — user's own "Mark done" log, persisted in localStorage */}
      <ActionDoneHistory />
      {/* Workflow runs — GitHub Actions runs across user-dispatchable workflows */}
      <ActionHistory />
    </div>
  );
}
