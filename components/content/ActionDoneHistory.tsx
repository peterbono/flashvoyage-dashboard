"use client";

/**
 * Primary Action History panel — the log of "Mark done" clicks the founder
 * has made on action recommendations, persisted to localStorage.
 *
 * This is the view the user actually asked for: "what actions did I decide
 * to put in place on the Actions tab?" It's complementary to ActionHistory
 * (which shows GitHub Actions runs — workflow dispatches that may or may
 * not have been user-initiated).
 */

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Undo2,
  Trash2,
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
  Link as LinkIcon,
  type LucideIcon,
} from "lucide-react";
import { useActionHistory } from "./useActionHistory";
import type { ActionDoneEntry } from "@/lib/content/actionHistoryStore";

// ---------------------------------------------------------------------------
// Icon registry — mirrors ActionPanel / ActionsTab
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
  return ICON_REGISTRY[name] ?? CheckCircle2;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelative(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const deltaMs = now - t;
  const sec = Math.round(deltaMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type DateFilter = "all" | "today" | "7d" | "30d";

function filterByDate(entries: ActionDoneEntry[], filter: DateFilter) {
  if (filter === "all") return entries;
  const now = Date.now();
  const windowMs =
    filter === "today"
      ? 24 * 3_600_000
      : filter === "7d"
      ? 7 * 86_400_000
      : 30 * 86_400_000;
  const cutoff = now - windowMs;
  return entries.filter((e) => new Date(e.markedAt).getTime() >= cutoff);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActionDoneHistory() {
  const history = useActionHistory();
  const [expanded, setExpanded] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [confirmClear, setConfirmClear] = useState(false);

  const filteredEntries = useMemo(
    () => filterByDate(history.entries, dateFilter),
    [history.entries, dateFilter],
  );

  // Counts for the segmented control
  const counts = useMemo(() => {
    return {
      all: history.entries.length,
      today: filterByDate(history.entries, "today").length,
      "7d": filterByDate(history.entries, "7d").length,
      "30d": filterByDate(history.entries, "30d").length,
    };
  }, [history.entries]);

  // Quick stats on the filtered slice
  const stats = useMemo(() => {
    const quickWins = filteredEntries.filter(
      (e) => e.ruleTag === "Quick win",
    ).length;
    const longBets = filteredEntries.length - quickWins;
    const uniqueArticles = new Set(filteredEntries.map((e) => e.slug)).size;
    return { quickWins, longBets, uniqueArticles };
  }, [filteredEntries]);

  const totalCount = history.entries.length;

  return (
    <section
      className="rounded-xl border border-emerald-900/40 bg-emerald-950/10"
      aria-label="Actions marked done history"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="action-done-history-panel"
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-xl"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2
            className="w-3.5 h-3.5 text-emerald-400"
            aria-hidden="true"
          />
          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            Actions done
          </span>
          {totalCount > 0 && (
            <span className="text-[10px] font-mono tabular-nums px-1 py-0 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              {totalCount}
            </span>
          )}
          {totalCount === 0 && (
            <span className="text-[10px] text-zinc-500 normal-case">
              · No actions marked yet
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronDown
            className="w-3.5 h-3.5 text-zinc-500"
            aria-hidden="true"
          />
        ) : (
          <ChevronRight
            className="w-3.5 h-3.5 text-zinc-500"
            aria-hidden="true"
          />
        )}
      </button>

      {expanded && (
        <div
          id="action-done-history-panel"
          className="px-4 pb-4 space-y-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-150"
        >
          {totalCount === 0 ? (
            <div className="text-[11px] text-zinc-500 py-4 text-center">
              Click <span className="text-zinc-300">&ldquo;Mark done&rdquo;</span> on
              any action recommendation to start logging your content-ops
              decisions here. Entries survive page reloads and sync across
              browser tabs.
            </div>
          ) : (
            <>
              {/* Header row: filter + stats + clear */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-0.5 bg-zinc-900 border border-zinc-800/80 rounded-lg p-0.5 w-fit">
                  {(
                    [
                      { key: "all", label: `All (${counts.all})` },
                      { key: "today", label: `Today (${counts.today})` },
                      { key: "7d", label: `7d (${counts["7d"]})` },
                      { key: "30d", label: `30d (${counts["30d"]})` },
                    ] as const
                  ).map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setDateFilter(key)}
                      aria-pressed={dateFilter === key}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
                        dateFilter === key
                          ? "bg-zinc-800 text-white"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {totalCount > 0 && (
                  <div className="flex items-center gap-2">
                    {confirmClear ? (
                      <>
                        <span className="text-[10px] text-zinc-400">
                          Clear all {totalCount}?
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            history.clear();
                            setConfirmClear(false);
                          }}
                          className="text-[10px] px-2 py-0.5 rounded border border-rose-800/60 bg-rose-950/30 text-rose-400 hover:bg-rose-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                        >
                          Yes, clear
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmClear(false)}
                          className="text-[10px] px-2 py-0.5 rounded text-zinc-500 hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmClear(true)}
                        aria-label="Clear all action history"
                        title="Wipe the entire Actions Done log"
                        className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded text-zinc-500 hover:text-rose-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
                      >
                        <Trash2 className="w-3 h-3" aria-hidden="true" />
                        Clear all
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Stats strip */}
              <div className="flex items-center gap-4 text-[11px] text-zinc-400">
                <span className="tabular-nums">
                  <span className="text-zinc-200 font-semibold">
                    {filteredEntries.length}
                  </span>{" "}
                  action{filteredEntries.length !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" aria-hidden="true" />
                  <span className="tabular-nums">{stats.quickWins}</span>{" "}
                  quick win{stats.quickWins !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1">
                  <Target
                    className="w-3 h-3 text-cyan-400"
                    aria-hidden="true"
                  />
                  <span className="tabular-nums">{stats.longBets}</span>{" "}
                  long bet{stats.longBets !== 1 ? "s" : ""}
                </span>
                <span className="tabular-nums">
                  <span className="text-zinc-200 font-semibold">
                    {stats.uniqueArticles}
                  </span>{" "}
                  article{stats.uniqueArticles !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Entry list */}
              {filteredEntries.length === 0 ? (
                <div className="text-[11px] text-zinc-500 py-4 text-center">
                  No actions marked done in this period.
                </div>
              ) : (
                <ul className="space-y-1">
                  {filteredEntries.map((entry) => {
                    const Icon = getIcon(entry.ruleIcon);
                    const isQuickWin = entry.ruleTag === "Quick win";
                    const tagStyle = isQuickWin
                      ? "bg-amber-500/15 text-amber-400"
                      : "bg-cyan-500/15 text-cyan-400";
                    const accent = isQuickWin
                      ? "border-l-amber-500"
                      : "border-l-cyan-500";
                    return (
                      <li
                        key={entry.id}
                        className={`flex items-start gap-2 px-3 py-2 rounded-md border border-zinc-800/60 border-l-2 ${accent} bg-zinc-900/40 group`}
                      >
                        <Icon
                          className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                            isQuickWin
                              ? "text-amber-400"
                              : "text-cyan-400"
                          }`}
                          aria-hidden="true"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-xs text-zinc-100 font-medium">
                              {entry.ruleHeadline}
                            </span>
                            <span
                              className={`text-[9px] uppercase tracking-wide font-semibold px-1.5 py-0 rounded ${tagStyle}`}
                            >
                              {entry.ruleTag}
                            </span>
                            <span className="text-[10px] text-zinc-500 tabular-nums">
                              {entry.ruleDuration}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <a
                              href={entry.articleUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-zinc-400 truncate hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm"
                            >
                              {entry.articleTitle}
                            </a>
                            <a
                              href={entry.articleUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Open "${entry.articleTitle}" in a new tab`}
                              className="text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0 p-[8px] -m-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm"
                            >
                              <ExternalLink
                                className="w-3 h-3"
                                aria-hidden="true"
                              />
                            </a>
                          </div>
                          {entry.expectedLift && (
                            <div className="text-[10px] text-emerald-400 font-mono tabular-nums mt-0.5">
                              {entry.expectedLift}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <time
                            dateTime={entry.markedAt}
                            title={formatAbsolute(entry.markedAt)}
                            className="text-[10px] text-zinc-500 tabular-nums"
                          >
                            {formatRelative(entry.markedAt)}
                          </time>
                          <button
                            type="button"
                            onClick={() => history.undoById(entry.id)}
                            aria-label={`Undo "${entry.ruleHeadline}" on ${entry.articleTitle}`}
                            title="Undo — the rule will fire again on the next evaluation if the signal still matches"
                            className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-amber-400 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm"
                          >
                            <Undo2
                              className="w-2.5 h-2.5"
                              aria-hidden="true"
                            />
                            Undo
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="text-[10px] text-zinc-600 text-right">
                Stored in this browser · persists across reloads and tabs
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
