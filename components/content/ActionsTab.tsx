"use client";

/**
 * Actions Tab — Two-zone split redesign.
 *
 * Left zone (66%): Morning briefing — progress bar + Quick Wins / Long Bets cards.
 * Right zone (33%): Context sidebar — HealthRing + Done/Impact/Runs tabs.
 *
 * All data logic (useMemo, useCallback, state) preserved from the original.
 * Visual layer completely rewritten per Product Designer spec.
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
import { HealthRing } from "./HealthRing";
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

type SidebarTab = "done" | "impact" | "runs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h${mins}min`;
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
  // Expansion state for the accordion groups.
  const userInteractedRef = useRef(false);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [showOverflow, setShowOverflow] = useState(false);

  // Per-group batch dispatch state.
  const [groupStates, setGroupStates] = useState<Record<string, GroupState>>(
    {},
  );

  // Sidebar tab state.
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("done");

  // Shared action history.
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

  // Resolve the effective expanded group.
  const effectiveExpanded = userInteractedRef.current
    ? expandedGroupId
    : groups[0]?.ruleId ?? null;

  const toggleExpand = useCallback((ruleId: string) => {
    userInteractedRef.current = true;
    setExpandedGroupId((prev) => (prev === ruleId ? null : ruleId));
  }, []);

  // ── Tracked slugs for ImpactTracker ─────────────────────────────────────
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

  // ── Hero aggregation ────────────────────────────────────────────────────
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

  // ── Health data for HealthRing ──────────────────────────────────────────
  const healthData = useMemo(() => {
    const allItems = [...refreshQueue, ...topPerformers];
    const scores = allItems.map((i) => i.score).filter((s) => typeof s === "number");
    const avgScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;
    const healthy = scores.filter((s) => s >= 50).length;
    const warning = scores.filter((s) => s >= 30 && s < 50).length;
    const declining = scores.filter((s) => s < 30).length;
    const quickWinGroupCount = groups.filter((g) => g.tag === "Quick win").length;
    const totalGroupCount = groups.length;
    return { avgScore, healthy, warning, declining, quickWinGroupCount, totalGroupCount };
  }, [refreshQueue, topPerformers, groups]);

  // ── Progress bar data ───────────────────────────────────────────────────
  const doneGroupCount = useMemo(() => {
    return groups.filter((g) => {
      const state = groupStates[g.ruleId];
      return state === "done";
    }).length;
  }, [groups, groupStates]);

  // ── Run all handler ─────────────────────────────────────────────────────
  const handleRunAll = useCallback(async (group: ActionGroup) => {
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

  // ── Per-item CTA runner ─────────────────────────────────────────────────
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
    },
    [],
  );

  // ── Sidebar content renderer ────────────────────────────────────────────
  const sidebarTabContent = useMemo(() => {
    switch (sidebarTab) {
      case "done":
        return <ActionDoneHistory />;
      case "impact":
        return <ImpactTracker trackedSlugs={trackedSlugs} />;
      case "runs":
        return <ActionHistory />;
    }
  }, [sidebarTab, trackedSlugs]);

  // ── Sidebar component (reused in empty + main views) ───────────────────
  const sidebarNode = (
    <aside className="flex flex-col min-h-0">
      {/* HealthRing */}
      <div className="flex justify-center py-4">
        <HealthRing
          score={healthData.avgScore}
          segments={{
            healthy: healthData.healthy,
            warning: healthData.warning,
            declining: healthData.declining,
          }}
          subtitle={
            healthData.quickWinGroupCount > 0
              ? `${healthData.quickWinGroupCount} quick win${healthData.quickWinGroupCount !== 1 ? "s" : ""} available`
              : undefined
          }
        />
      </div>

      {/* Mini tab bar */}
      <div className="flex border-b border-zinc-800/60" role="tablist" aria-label="Sidebar tabs">
        {(
          [
            { id: "done", label: "Done" },
            { id: "impact", label: "Impact" },
            { id: "runs", label: "Runs" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={sidebarTab === tab.id}
            onClick={() => setSidebarTab(tab.id)}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
              sidebarTab === tab.id
                ? "text-zinc-50 border-b-2 border-emerald-500"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scrollable tab content */}
      <div className="flex-1 overflow-y-auto min-h-0 pt-3" role="tabpanel">
        {sidebarTabContent}
      </div>
    </aside>
  );

  // ── Loading state ───────────────────────────────────────────────────────
  if (loading && evaluated.length === 0) {
    return (
      <div className="text-xs text-zinc-500 text-center py-12">
        Computing recommendations...
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────
  if (evaluated.length === 0) {
    const totalArticles = refreshQueue.length + topPerformers.length;
    return (
      <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6">
        {/* Left zone — empty celebration */}
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-5">
            <CheckCircle2
              className="w-7 h-7 text-emerald-400"
              aria-hidden="true"
            />
          </div>
          <h3 className="text-lg font-semibold text-zinc-50">
            Portfolio is healthy
          </h3>
          <p className="text-sm text-zinc-400 mt-2 max-w-sm">
            {totalArticles > 0
              ? `${totalArticles} articles scanned \u2014 0 actions needed right now.`
              : "No articles loaded yet."}
          </p>
          <p className="text-xs text-zinc-500 mt-4">
            Rules re-evaluate on every dashboard poll (every 2 min).
          </p>
        </div>

        {/* Right zone — sidebar always visible */}
        {sidebarNode}
      </div>
    );
  }

  // ── Filter out R8 and split groups ──────────────────────────────────────
  const displayGroups = groups.filter(
    (g) => g.ruleId !== "R8-investigate-decline",
  );
  const visibleGroups = showOverflow ? displayGroups : displayGroups.slice(0, 10);
  const overflowCount = Math.max(0, displayGroups.length - 10);

  const quickWinGroups = visibleGroups.filter((g) => g.tag === "Quick win");
  const longBetGroups = visibleGroups.filter((g) => g.tag === "Long bet");

  const quickWinActionCount = quickWinGroups.reduce((s, g) => s + g.items.length, 0);
  const quickWinTotalMin = quickWinGroups.reduce(
    (s, g) => s + g.durationMinutes * g.items.length,
    0,
  );
  const longBetActionCount = longBetGroups.reduce((s, g) => s + g.items.length, 0);
  const longBetTotalMin = longBetGroups.reduce(
    (s, g) => s + g.durationMinutes * g.items.length,
    0,
  );

  // ── Render a single action group card ──────────────────────────────────
  function renderGroupCard(group: ActionGroup) {
    const isExpanded = effectiveExpanded === group.ruleId;
    const isQuickWin = group.tag === "Quick win";
    const dotColor = isQuickWin ? "bg-emerald-500" : "bg-amber-500";
    const groupState = groupStates[group.ruleId] ?? "idle";
    const isBatchable =
      BATCHABLE_RULE_IDS.has(group.ruleId) && group.items.length > 0;
    const totalTimeForGroup = group.durationMinutes * group.items.length;
    const panelId = `actions-group-${group.ruleId}`;

    return (
      <article key={group.ruleId} className="group border-b border-zinc-800/40 last:border-b-0">
        <div className="flex items-center gap-3 py-2.5 px-1">
          {/* Colored dot */}
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`}
            aria-hidden="true"
          />

          {/* Title + expand trigger */}
          <button
            type="button"
            onClick={() => toggleExpand(group.ruleId)}
            aria-expanded={isExpanded}
            aria-controls={panelId}
            className="flex-1 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm"
          >
            <span className="text-sm font-medium text-zinc-200 truncate block">
              {group.headline}
            </span>
          </button>

          {/* Right-aligned metadata */}
          <span className="text-xs text-zinc-500 tabular-nums shrink-0 whitespace-nowrap">
            {group.items.length} article{group.items.length !== 1 ? "s" : ""} &middot;{" "}
            {formatMinutes(totalTimeForGroup)}
          </span>

          {/* Run all — ghost, hover-only */}
          {isBatchable && (
            <button
              type="button"
              onClick={() => handleRunAll(group)}
              disabled={groupState === "refreshing" || groupState === "done"}
              aria-label={`Run refresh workflow on all ${group.items.length} articles in this group`}
              title={
                groupState === "done"
                  ? `Dispatched \u2014 processing ${group.items.length} articles`
                  : groupState === "error"
                    ? "Dispatch failed \u2014 check console"
                    : groupState === "refreshing"
                      ? "Dispatching batch..."
                      : `Run all ${group.items.length} articles in one batch`
              }
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 shrink-0 ${
                groupState === "done"
                  ? "text-emerald-400 opacity-100"
                  : groupState === "error"
                    ? "text-red-400 opacity-100"
                    : groupState === "refreshing"
                      ? "text-amber-400 opacity-100"
                      : "text-zinc-400 hover:text-zinc-200 opacity-0 group-hover:opacity-100"
              }`}
            >
              {groupState === "refreshing" ? (
                <RefreshCw className="w-3 h-3 animate-spin" aria-hidden="true" />
              ) : groupState === "done" ? (
                <Check className="w-3 h-3" aria-hidden="true" />
              ) : groupState === "error" ? (
                <X className="w-3 h-3" aria-hidden="true" />
              ) : (
                <Zap className="w-3 h-3" aria-hidden="true" />
              )}
              {groupState === "refreshing"
                ? "Running..."
                : groupState === "done"
                  ? "Done"
                  : groupState === "error"
                    ? "Failed"
                    : `Run all`}
            </button>
          )}

          {/* Chevron */}
          <button
            type="button"
            onClick={() => toggleExpand(group.ruleId)}
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${group.headline}`}
            className="text-zinc-500 hover:text-zinc-200 transition-colors p-1 -m-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Expanded panel — article list */}
        {isExpanded && (
          <div
            id={panelId}
            role="region"
            aria-label={`${group.headline} \u2014 affected articles`}
            className="pb-3 pl-6 pr-1 space-y-0.5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-150"
          >
            {group.items.map(({ rec, item }) => (
              <div
                key={`${group.ruleId}-${item.slug}`}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-800/40 group/item"
              >
                <span className="text-zinc-600 text-[10px]" aria-hidden="true">
                  &mdash;
                </span>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-zinc-300 truncate flex-1 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm"
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
                  aria-label={`${rec.cta.label ?? "Run"} for "${item.title}"`}
                  title={rec.cta.kind === "todo" ? rec.cta.note : undefined}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
                    rec.cta.kind === "todo"
                      ? "text-zinc-600 cursor-not-allowed"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
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
  }

  // ── Main view ───────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6">
      {/* ─── Left zone: Morning briefing ─── */}
      <div className="min-w-0 space-y-5">
        {/* Progress bar */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-xl font-semibold text-zinc-50">
              Today&apos;s Briefing
            </h2>
            <span className="text-xs text-zinc-500 tabular-nums">
              {doneGroupCount} of {displayGroups.length} groups cleared
            </span>
          </div>
          <div
            className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden"
            role="progressbar"
            aria-valuenow={doneGroupCount}
            aria-valuemin={0}
            aria-valuemax={displayGroups.length}
            aria-label="Groups cleared progress"
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out"
              style={{
                width:
                  displayGroups.length > 0
                    ? `${(doneGroupCount / displayGroups.length) * 100}%`
                    : "0%",
              }}
            />
          </div>
        </div>

        {/* Quick Wins section */}
        {quickWinGroups.length > 0 && (
          <section aria-labelledby="quick-wins-heading">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              <h3
                id="quick-wins-heading"
                className="text-sm font-medium text-zinc-200"
              >
                Quick Wins
              </h3>
              <span className="text-xs text-zinc-500">
                &middot; {quickWinActionCount} action{quickWinActionCount !== 1 ? "s" : ""} &middot;{" "}
                ~{formatMinutes(quickWinTotalMin)}
              </span>
            </div>
            <div>{quickWinGroups.map(renderGroupCard)}</div>
          </section>
        )}

        {/* Long Bets section */}
        {longBetGroups.length > 0 && (
          <section aria-labelledby="long-bets-heading">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-amber-400" aria-hidden="true" />
              <h3
                id="long-bets-heading"
                className="text-sm font-medium text-zinc-200"
              >
                Long Bets
              </h3>
              <span className="text-xs text-zinc-500">
                &middot; {longBetActionCount} action{longBetActionCount !== 1 ? "s" : ""} &middot;{" "}
                ~{formatMinutes(longBetTotalMin)}
              </span>
            </div>
            <div>{longBetGroups.map(renderGroupCard)}</div>
          </section>
        )}

        {/* Overflow toggle */}
        {overflowCount > 0 && !showOverflow && (
          <button
            type="button"
            onClick={() => setShowOverflow(true)}
            className="text-xs text-zinc-500 hover:text-zinc-200 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm px-1"
          >
            Show +{overflowCount} lower-priority action
            {overflowCount !== 1 ? "s" : ""}
          </button>
        )}
        {showOverflow && overflowCount > 0 && (
          <button
            type="button"
            onClick={() => setShowOverflow(false)}
            className="text-xs text-zinc-500 hover:text-zinc-200 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm px-1"
          >
            Hide lower-priority actions
          </button>
        )}
      </div>

      {/* ─── Right zone: Context sidebar ─── */}
      {sidebarNode}
    </div>
  );
}
