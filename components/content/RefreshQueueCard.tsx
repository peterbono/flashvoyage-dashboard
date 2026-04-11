"use client";

import { useState, useCallback, useMemo } from "react";
import { RefreshCw, ExternalLink, TrendingDown, Check, X, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ActionPanel } from "./ActionPanel";
import { evaluateRules, type ScoreSignals, type ActionRecommendation } from "@/lib/content/actionRules";
import { SignalExplainer, SIGNAL_META as SIGNAL_DOCS, buildSignalTooltip } from "./SignalExplainer";
import { useActionHistory } from "./useActionHistory";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RefreshQueueItem {
  slug: string;
  title: string;
  url: string;
  score: number;
  delta7d: number;
  flags: string[];
  /** Top 2 weakest signals (Phase 2 diagnosis) */
  weakSignals?: { name: string; value: number }[];
  /** Full 6-signal object for the rule engine */
  signals?: ScoreSignals;
  /** WordPress post id for wp-admin edit URLs */
  wpId?: number;
}

type RowState = "idle" | "refreshing" | "done" | "error";

interface Props {
  items: RefreshQueueItem[];
  loading: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta.toFixed(0)}`;
  return delta.toFixed(0);
}

function deltaColorClass(delta: number): string {
  if (delta <= -20) return "text-red-400";
  if (delta <= -10) return "text-orange-400";
  if (delta < 0) return "text-amber-400";
  return "text-zinc-500";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// Signal label + color now live in ./SignalExplainer (shared source of truth
// so the popover docs and the badge rendering never drift).

export function RefreshQueueCard({ items, loading }: Props) {
  // Per-row refresh state, keyed by slug.
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  // Multi-select for batch refresh — a single workflow run processes N slugs
  // in ~6 min instead of N × 15 min sequential runs (one dispatch per click).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchState, setBatchState] = useState<RowState>("idle");
  // Disclosure: which row has its Action Recommendations panel expanded.
  // Only one at a time — clicking another row collapses the previous.
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  // Shared action history hook — persists Mark done across reloads, tabs,
  // and component remounts (localStorage-backed, cross-tab synced).
  const history = useActionHistory();

  const toggleExpand = useCallback((slug: string) => {
    setExpandedSlug((prev) => (prev === slug ? null : slug));
  }, []);

  const handleMarkDone = useCallback(
    (item: RefreshQueueItem) => (rec: ActionRecommendation) => {
      history.markDone(
        { slug: item.slug, title: item.title, url: item.url },
        rec,
      );
    },
    [history],
  );

  const toggleSelect = useCallback((slug: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const dispatchRefresh = useCallback(
    async (inputs: Record<string, string>) => {
      const res = await fetch("/api/workflows/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow: "refresh-articles.yml",
          inputs,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
    [],
  );

  const handleRefresh = useCallback(
    async (slug: string) => {
      setRowStates((s) => ({ ...s, [slug]: "refreshing" }));
      try {
        await dispatchRefresh({ slug });
        setRowStates((s) => ({ ...s, [slug]: "done" }));
        setTimeout(() => {
          setRowStates((s) => {
            const next = { ...s };
            delete next[slug];
            return next;
          });
        }, 5000);
      } catch (err) {
        console.error("[refresh-queue]", slug, err);
        setRowStates((s) => ({ ...s, [slug]: "error" }));
        setTimeout(() => {
          setRowStates((s) => {
            const next = { ...s };
            delete next[slug];
            return next;
          });
        }, 5000);
      }
    },
    [dispatchRefresh],
  );

  const handleBatchRefresh = useCallback(async () => {
    if (selected.size === 0) return;
    const slugs = Array.from(selected);
    setBatchState("refreshing");
    // Mark each selected row as refreshing for visual feedback
    setRowStates((s) => {
      const next = { ...s };
      for (const slug of slugs) next[slug] = "refreshing";
      return next;
    });
    try {
      await dispatchRefresh({ slugs: slugs.join(",") });
      setBatchState("done");
      setRowStates((s) => {
        const next = { ...s };
        for (const slug of slugs) next[slug] = "done";
        return next;
      });
      setTimeout(() => {
        setBatchState("idle");
        clearSelection();
        setRowStates((s) => {
          const next = { ...s };
          for (const slug of slugs) delete next[slug];
          return next;
        });
      }, 5000);
    } catch (err) {
      console.error("[refresh-queue/batch]", err);
      setBatchState("error");
      setRowStates((s) => {
        const next = { ...s };
        for (const slug of slugs) next[slug] = "error";
        return next;
      });
      setTimeout(() => {
        setBatchState("idle");
        setRowStates((s) => {
          const next = { ...s };
          for (const slug of slugs) delete next[slug];
          return next;
        });
      }, 5000);
    }
  }, [selected, dispatchRefresh, clearSelection]);

  return (
    <Card className="bg-zinc-900/40 border-zinc-800/60 rounded-xl h-full">
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            <RefreshCw className="w-3.5 h-3.5 text-orange-400" />
            Refresh queue
            {items.length > 0 ? (
              <span className="text-[10px] font-normal text-zinc-400 normal-case">
                ({items.length})
              </span>
            ) : null}
            <SignalExplainer />
          </CardTitle>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={handleBatchRefresh}
              disabled={batchState === "refreshing" || batchState === "done"}
              title={
                batchState === "done"
                  ? `Batch dispatched (${selected.size}) — single workflow run ~6 min`
                  : batchState === "error"
                  ? "Batch dispatch failed — check console"
                  : batchState === "refreshing"
                  ? `Dispatching batch (${selected.size})…`
                  : `Refresh ${selected.size} selected article${selected.size > 1 ? "s" : ""} in a single batch run`
              }
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
                batchState === "done"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : batchState === "error"
                  ? "border-red-500/40 bg-red-500/10 text-red-400"
                  : "border-orange-800/60 bg-orange-950/30 text-orange-400 hover:bg-orange-900/40 disabled:opacity-50"
              }`}
            >
              {batchState === "refreshing" ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : batchState === "done" ? (
                <Check className="w-3 h-3" />
              ) : batchState === "error" ? (
                <X className="w-3 h-3" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              {batchState === "refreshing"
                ? "Dispatching…"
                : batchState === "done"
                ? `Dispatched (${selected.size})`
                : batchState === "error"
                ? "Failed"
                : `Refresh ${selected.size} selected`}
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-3">
        {loading && items.length === 0 ? (
          <div className="text-xs text-zinc-600 text-center py-6">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-xs text-zinc-600 text-center py-6">
            No declining articles — portfolio is stable.
          </div>
        ) : (
          <ul className="space-y-0.5">
            {items.map((item) => {
              const rowState = rowStates[item.slug] ?? "idle";
              const isBusy = rowState === "refreshing";
              const isChecked = selected.has(item.slug);
              const checkboxId = `refresh-select-${item.slug}`;
              const isExpanded = expandedSlug === item.slug;
              const panelId = `refresh-panel-${item.slug}`;
              // Compute recommendations lazily: only when the row is expanded
              // (avoids running the rule engine on every render for all 10 rows).
              const recommendations = isExpanded && item.signals
                ? evaluateRules(
                    {
                      signals: item.signals,
                      score: item.score,
                      delta7d: item.delta7d,
                      flags: item.flags,
                      slug: item.slug,
                      title: item.title,
                      url: item.url,
                      wpId: item.wpId,
                      surface: "refresh",
                    },
                    3,
                  ).filter((rec) => !history.isDismissed(item.slug, rec.id))
                : [];
              return (
                <li
                  key={item.slug}
                  className="flex flex-col rounded-md hover:bg-zinc-800/40 transition-colors group"
                >
                  <div className="flex items-start gap-2 px-2 py-1.5">
                  {/* Selection checkbox — always visible so batch mode is discoverable */}
                  <label
                    htmlFor={checkboxId}
                    className="relative shrink-0 cursor-pointer p-[14px] -m-[14px]"
                    title={isChecked ? "Remove from batch selection" : "Add to batch selection"}
                  >
                    <input
                      id={checkboxId}
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelect(item.slug)}
                      aria-label={`Select "${item.title}" for batch refresh`}
                      className="peer sr-only"
                    />
                    <span
                      className={`inline-block w-3.5 h-3.5 rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-sky-400 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-zinc-900 ${
                        isChecked
                          ? "bg-orange-500/30 border-orange-400"
                          : "border-zinc-700 group-hover:border-zinc-500"
                      }`}
                    >
                      {isChecked && (
                        <Check className="w-3 h-3 text-orange-300 -mt-px" />
                      )}
                    </span>
                  </label>
                  <TrendingDown
                    className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${deltaColorClass(item.delta7d)}`}
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-zinc-200 truncate flex-1 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm"
                        >
                          {item.title}
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-200 truncate flex-1">
                          {item.title}
                        </span>
                      )}
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open "${item.title}" in a new tab`}
                          className="text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100 focus-within:opacity-100 focus-visible:opacity-100 transition-opacity shrink-0 p-[14px] -m-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : null}
                      {/* Per-row Refresh button (Phase 1) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isBusy && rowState !== "done") handleRefresh(item.slug);
                        }}
                        disabled={isBusy || rowState === "done"}
                        aria-label={`Refresh ${item.title}`}
                        title={
                          rowState === "done"
                            ? "Refresh dispatched — workflow running in background"
                            : rowState === "error"
                            ? "Dispatch failed — check console"
                            : rowState === "refreshing"
                            ? "Dispatching refresh workflow…"
                            : "Refresh this article (live data update)"
                        }
                        className={`shrink-0 transition-opacity p-[14px] -m-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm ${
                          rowState === "idle"
                            ? "text-zinc-500 hover:text-orange-400 opacity-0 group-hover:opacity-100 focus-within:opacity-100 focus-visible:opacity-100"
                            : rowState === "refreshing"
                            ? "text-orange-400 opacity-100"
                            : rowState === "done"
                            ? "text-emerald-400 opacity-100"
                            : "text-red-400 opacity-100"
                        }`}
                      >
                        {rowState === "refreshing" ? (
                          <RefreshCw className="w-3 h-3 animate-spin" aria-hidden="true" />
                        ) : rowState === "done" ? (
                          <Check className="w-3 h-3" aria-hidden="true" />
                        ) : rowState === "error" ? (
                          <X className="w-3 h-3" aria-hidden="true" />
                        ) : (
                          <RefreshCw className="w-3 h-3" aria-hidden="true" />
                        )}
                      </button>
                      {/* Action Recommendations disclosure trigger */}
                      {item.signals && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(item.slug);
                          }}
                          aria-expanded={isExpanded}
                          aria-controls={panelId}
                          aria-label={`${
                            isExpanded ? "Hide" : "Show"
                          } action recommendations for ${item.title}`}
                          title={
                            isExpanded
                              ? "Hide recommendations"
                              : "Show action recommendations"
                          }
                          className="shrink-0 text-zinc-500 hover:text-amber-400 transition-colors p-[14px] -m-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3 h-3" aria-hidden="true" />
                          ) : (
                            <ChevronRight className="w-3 h-3" aria-hidden="true" />
                          )}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-zinc-400 tabular-nums">
                        <span className="sr-only">Composite score </span>score {item.score}
                      </span>
                      <span
                        className={`text-[10px] tabular-nums font-mono ${deltaColorClass(item.delta7d)}`}
                      >
                        <span className="sr-only">7-day delta </span>
                        {formatDelta(item.delta7d)} pts/7d
                      </span>
                      {/* Phase 2: top weak signals (diagnosis) — rich tooltip
                          on hover/focus shows the full definition + fix hint
                          from SignalExplainer (same source of truth as the
                          docs popover). */}
                      {item.weakSignals?.slice(0, 2).map((sig) => {
                        const meta = SIGNAL_DOCS[sig.name];
                        if (!meta) return null;
                        return (
                          <span
                            key={sig.name}
                            tabIndex={0}
                            role="note"
                            className={`text-[9px] px-1.5 py-0 rounded border tabular-nums cursor-help focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${meta.color}`}
                            title={buildSignalTooltip(sig.name, sig.value)}
                            aria-label={`${meta.label} signal at ${Math.round(
                              sig.value * 100,
                            )} percent`}
                          >
                            {meta.label}
                          </span>
                        );
                      })}
                      {item.flags.length > 0 && !item.weakSignals?.length ? (
                        <span className="text-[9px] text-zinc-400 truncate">
                          {item.flags[0]}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  </div>
                  {isExpanded && (
                    <ActionPanel
                      recommendations={recommendations}
                      panelId={panelId}
                      articleTitle={item.title}
                      onMarkDone={handleMarkDone(item)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
