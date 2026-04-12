"use client";

/**
 * Actions Tab — v3 redesign.
 *
 * Left zone: Today's Briefing progress bar + filter chips + unified table-row list.
 * Right zone: Context sidebar — HealthRing + Done/Impact/Runs tabs.
 *
 * Visual language: Linear / Vercel / Ahrefs Site Audit table rows.
 * All data logic preserved from v2 (useMemo, useCallback, useState, useRef, handlers).
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

type SidebarTab = "done" | "runs";

type FilterKey = "all" | "quick" | "long";

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
  // Expansion state for the accordion rows.
  const userInteractedRef = useRef(false);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  // Per-group batch dispatch state.
  const [groupStates, setGroupStates] = useState<Record<string, GroupState>>(
    {},
  );

  // Sidebar tab state.
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("done");

  // v3: filter chips (replaces Quick Wins / Long Bets section headers).
  const [filter, setFilter] = useState<FilterKey>("all");

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
      case "runs":
        return <ActionHistory />;
    }
  }, [sidebarTab]);

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
      <div
        className="flex border-b border-white/[0.08]"
        role="tablist"
        aria-label="Sidebar tabs"
      >
        {(
          [
            { id: "done", label: "Done" },
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

  // ── Filter out R8 and compute filtered display list ─────────────────────
  const displayGroups = groups.filter(
    (g) => g.ruleId !== "R8-investigate-decline",
  );

  const quickCount = displayGroups.filter((g) => g.tag === "Quick win").length;
  const longCount = displayGroups.filter((g) => g.tag === "Long bet").length;

  const filteredGroups = displayGroups.filter((g) => {
    if (filter === "quick") return g.tag === "Quick win";
    if (filter === "long") return g.tag === "Long bet";
    return true;
  });

  // ── Render a single action row (Ahrefs-style table row) ────────────────
  function renderActionRow(group: ActionGroup) {
    const isExpanded = effectiveExpanded === group.ruleId;
    const isQuickWin = group.tag === "Quick win";
    const borderAccent = isQuickWin
      ? "border-l-emerald-500"
      : "border-l-amber-500";
    const groupState = groupStates[group.ruleId] ?? "idle";
    const isBatchable =
      BATCHABLE_RULE_IDS.has(group.ruleId) && group.items.length > 0;
    const totalTimeForGroup = group.durationMinutes * group.items.length;
    const panelId = `actions-row-${group.ruleId}`;
    const RuleIcon = getIcon(group.icon);
    // Count "fresh" articles: those with NO entry in the action-done history
    // (any rule). Signals articles the founder has never acted on yet vs
    // articles that have accumulated edits over time.
    const freshItems = group.items.filter(
      ({ item }) =>
        !history.entries.some((e) => e.slug === item.slug),
    );
    const freshCount = freshItems.length;

    return (
      <li key={group.ruleId} className="group">
        {/* Main row — clickable, full-width */}
        <button
          type="button"
          onClick={() => toggleExpand(group.ruleId)}
          aria-expanded={isExpanded}
          aria-controls={panelId}
          className={`w-full flex items-center gap-3 min-h-[48px] px-4 py-3 border-l-[3px] ${borderAccent} text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:bg-white/[0.04] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-sky-400/60`}
        >
          {/* Rule icon */}
          <RuleIcon
            className="w-4 h-4 text-zinc-400 shrink-0"
            aria-hidden="true"
          />

          {/* Title */}
          <span className="flex-1 min-w-0 text-sm font-medium text-zinc-50 truncate">
            {group.headline}
          </span>

          {/* "NEW" badge if any article is fresh (no prior action-done entry) */}
          {freshCount > 0 && freshCount < group.items.length && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 tabular-nums shrink-0"
              title={`${freshCount} article${freshCount !== 1 ? "s" : ""} never worked on before`}
            >
              {freshCount} new
            </span>
          )}
          {freshCount === group.items.length && group.items.length > 0 && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 shrink-0"
              title="All articles in this group are untouched"
            >
              all new
            </span>
          )}

          {/* Metadata — articles · time */}
          <span className="text-xs text-zinc-500 tabular-nums shrink-0 whitespace-nowrap">
            {group.items.length} article{group.items.length !== 1 ? "s" : ""}
            {" \u00b7 "}
            {formatMinutes(totalTimeForGroup)}
          </span>

          {/* Fix → affordance */}
          <span
            className="text-xs text-zinc-400 group-hover:text-zinc-200 shrink-0 flex items-center gap-1 transition-colors"
            aria-hidden="true"
          >
            Fix
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </span>
        </button>

        {/* Expanded panel — article list inline */}
        {isExpanded && (
          <div
            id={panelId}
            role="region"
            aria-label={`${group.headline} \u2014 affected articles`}
            className="border-l-[3px] border-l-transparent bg-white/[0.01]"
          >
            <div className="pl-11 pr-4 py-2">
              {/* Batch run all (if applicable) */}
              {isBatchable && (
                <div className="flex items-center justify-between py-2 mb-1">
                  <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                    {group.items.length} affected article
                    {group.items.length !== 1 ? "s" : ""}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRunAll(group);
                    }}
                    disabled={
                      groupState === "refreshing" || groupState === "done"
                    }
                    aria-label={`Run workflow on all ${group.items.length} articles in this group`}
                    title={
                      groupState === "done"
                        ? `Dispatched \u2014 processing ${group.items.length} articles`
                        : groupState === "error"
                          ? "Dispatch failed \u2014 check console"
                          : groupState === "refreshing"
                            ? "Dispatching batch..."
                            : `Run all ${group.items.length} articles in one batch`
                    }
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
                      groupState === "done"
                        ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                        : groupState === "error"
                          ? "border-red-500/30 text-red-400 bg-red-500/10"
                          : groupState === "refreshing"
                            ? "border-amber-500/30 text-amber-400 bg-amber-500/10"
                            : "border-white/[0.08] text-zinc-200 hover:bg-white/[0.06]"
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
                      ? "Running..."
                      : groupState === "done"
                        ? "Done"
                        : groupState === "error"
                          ? "Failed"
                          : `Run all ${group.items.length}`}
                  </button>
                </div>
              )}

              {/* Article rows */}
              <ul className="divide-y divide-white/[0.04]">
                {group.items.map(({ rec, item }) => {
                  const dollarRange =
                    rec.liftHigh != null
                      ? formatDollarRange(rec.liftLow ?? 0, rec.liftHigh)
                      : "";
                  const isFresh = !history.entries.some(
                    (e) => e.slug === item.slug,
                  );
                  return (
                    <li
                      key={`${group.ruleId}-${item.slug}`}
                      className="flex items-center gap-3 py-2"
                    >
                      {/* Slug + title */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-zinc-300 truncate hover:text-zinc-50 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-400/60 rounded-sm"
                            title={item.title}
                          >
                            {item.title}
                          </a>
                          {isFresh && (
                            <span
                              className="text-[9px] font-semibold px-1 py-[1px] rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 shrink-0 uppercase tracking-wider"
                              title="No prior edits logged on this article"
                            >
                              new
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono tabular-nums truncate block">
                          {item.slug}
                        </span>
                      </div>

                      {/* Dollar range (if any) */}
                      {dollarRange && (
                        <span className="text-[10px] text-emerald-400 font-mono tabular-nums shrink-0">
                          {dollarRange}
                        </span>
                      )}

                      {/* Mark done */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          history.markDone(
                            {
                              slug: item.slug,
                              title: item.title,
                              url: item.url,
                            },
                            rec,
                          );
                        }}
                        aria-label={`Mark "${item.title}" as done`}
                        className="text-[10px] text-zinc-500 hover:text-zinc-200 shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-400/60 rounded-sm px-1"
                      >
                        Mark done
                      </button>

                      {/* Per-item CTA */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          runItemCta(rec);
                        }}
                        disabled={rec.cta.kind === "todo"}
                        aria-label={`${rec.cta.label ?? "Run"} for "${item.title}"`}
                        title={
                          rec.cta.kind === "todo" ? rec.cta.note : undefined
                        }
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
                          rec.cta.kind === "todo"
                            ? "border-white/[0.04] text-zinc-600 cursor-not-allowed"
                            : "border-white/[0.08] text-zinc-300 hover:bg-white/[0.06] hover:text-zinc-50"
                        }`}
                      >
                        {rec.cta.kind === "url" ? (
                          <ExternalLink
                            className="w-2.5 h-2.5"
                            aria-hidden="true"
                          />
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
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </li>
    );
  }

  // ── Main view ───────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6">
      {/* ─── Left zone: Today's Briefing table ─── */}
      <div className="min-w-0 space-y-4">
        {/* Header + progress bar */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-xl font-semibold text-zinc-50 tracking-tight">
              Today&apos;s Briefing
            </h2>
            <span className="text-xs text-zinc-500 tabular-nums">
              {doneGroupCount} of {displayGroups.length} cleared
            </span>
          </div>
          <div
            className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden"
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

        {/* Filter chips */}
        <div
          className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1"
          role="tablist"
          aria-label="Filter actions"
        >
          {(
            [
              { id: "all", label: "All", count: displayGroups.length },
              { id: "quick", label: "Quick wins", count: quickCount },
              { id: "long", label: "Long bets", count: longCount },
            ] as const
          ).map((chip) => {
            const active = filter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(chip.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
                  active
                    ? "bg-white/[0.08] border-white/[0.12] text-zinc-50"
                    : "border-white/[0.06] text-zinc-400 hover:bg-white/[0.04]"
                }`}
              >
                {chip.label}
                <span
                  className={`ml-1.5 text-[10px] tabular-nums ${active ? "text-zinc-400" : "text-zinc-500"}`}
                >
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Action list — unified Ahrefs-style table */}
        {filteredGroups.length > 0 ? (
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] overflow-hidden">
            <ul className="divide-y divide-white/[0.06]">
              {filteredGroups.map(renderActionRow)}
            </ul>
          </div>
        ) : (
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-8 text-center">
            <p className="text-sm text-zinc-400">
              No actions match this filter.
            </p>
            <button
              type="button"
              onClick={() => setFilter("all")}
              className="mt-2 text-xs text-zinc-500 hover:text-zinc-200 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-400/60 rounded-sm px-1"
            >
              Show all
            </button>
          </div>
        )}

        {/* Impact tracker — cohort comparison + per-article Before/Now/Δ */}
        <ImpactTracker />
      </div>

      {/* ─── Right zone: Context sidebar ─── */}
      {sidebarNode}
    </div>
  );
}
