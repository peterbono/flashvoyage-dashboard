"use client";

/**
 * AutoLog — sidebar tab that renders the audit log of edits auto-applied by
 * the runner. Source: GET /api/actions/audit-log (proxies the JSONL file in
 * the content repo, newest-first, paginated).
 *
 * Rows: timestamp (relative), article title (link), rule id, tier badge,
 * diff summary, status pill. Tier colors mirror AutoApplySettings
 * (emerald/amber/zinc).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Check,
  X,
  AlertTriangle,
  Loader2,
  SkipForward,
  RefreshCw,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types — mirror /api/actions/audit-log response shape
// ---------------------------------------------------------------------------

interface AuditLogEntry {
  ts: string;
  articleSlug: string;
  articleTitle: string;
  articleUrl: string;
  ruleId: string;
  tier: "LOW" | "MED" | "MANUAL";
  diffSummary: string;
  status: "success" | "skipped" | "failed";
  reason?: string;
}

interface AuditLogResponse {
  entries: AuditLogEntry[];
  nextCursor: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelative(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
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
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

export function AutoLog() {
  const [expanded, setExpanded] = useState(true);
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cursor: number | null, append: boolean) => {
    setState("loading");
    setError(null);
    try {
      const url =
        cursor != null
          ? `/api/actions/audit-log?limit=${PAGE_SIZE}&cursor=${cursor}`
          : `/api/actions/audit-log?limit=${PAGE_SIZE}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as AuditLogResponse;
      setEntries((prev) =>
        append ? [...prev, ...(json.entries ?? [])] : json.entries ?? [],
      );
      setNextCursor(json.nextCursor ?? null);
      setState("idle");
    } catch (err) {
      console.error("[AutoLog/load]", err);
      setError(String(err));
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load(null, false);
  }, [load]);

  const stats = useMemo(() => {
    const success = entries.filter((e) => e.status === "success").length;
    const skipped = entries.filter((e) => e.status === "skipped").length;
    const failed = entries.filter((e) => e.status === "failed").length;
    return { success, skipped, failed };
  }, [entries]);

  return (
    <section
      aria-label="Auto-apply audit log"
      className="rounded-xl border border-zinc-800/80 bg-zinc-900/40"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="auto-log-panel"
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-xl"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            Auto log
          </span>
          {entries.length > 0 && (
            <span className="text-[10px] text-zinc-400 normal-case tabular-nums">
              · {entries.length} entr{entries.length === 1 ? "y" : "ies"}
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
          id="auto-log-panel"
          className="px-4 pb-4 space-y-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-150"
        >
          {/* Header: stats + refresh */}
          {entries.length > 0 && (
            <div className="flex items-center gap-3 text-[11px] text-zinc-400 flex-wrap">
              <span className="flex items-center gap-1">
                <Check
                  className="w-3 h-3 text-emerald-400"
                  aria-hidden="true"
                />
                <span className="tabular-nums">{stats.success}</span> applied
              </span>
              <span className="flex items-center gap-1">
                <SkipForward
                  className="w-3 h-3 text-zinc-500"
                  aria-hidden="true"
                />
                <span className="tabular-nums">{stats.skipped}</span> skipped
              </span>
              <span className="flex items-center gap-1">
                <X
                  className="w-3 h-3 text-rose-400"
                  aria-hidden="true"
                />
                <span className="tabular-nums">{stats.failed}</span> failed
              </span>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => void load(null, false)}
                disabled={state === "loading"}
                aria-label="Reload audit log"
                className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded text-zinc-500 hover:text-zinc-300 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
              >
                <RefreshCw
                  className={`w-3 h-3 ${state === "loading" ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                Refresh
              </button>
            </div>
          )}

          {/* Body */}
          {state === "loading" && entries.length === 0 ? (
            <div className="flex items-center gap-2 text-[11px] text-zinc-500 py-4">
              <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
              Loading audit log…
            </div>
          ) : state === "error" ? (
            <div className="flex items-start gap-2 text-[11px] text-rose-400 py-2">
              <AlertTriangle className="w-3 h-3 mt-0.5" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <div>Failed to load audit log.</div>
                <div className="text-zinc-500 mt-0.5 truncate" title={error ?? ""}>
                  {error}
                </div>
              </div>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-[11px] text-zinc-500 py-4 text-center">
              No auto-applied edits yet. Turn on LOW tier in Auto-apply to get
              started.
            </div>
          ) : (
            <ul className="space-y-1">
              {entries.map((entry, i) => (
                <AuditLogRow key={`${entry.ts}-${i}`} entry={entry} />
              ))}
            </ul>
          )}

          {/* Pagination */}
          {nextCursor != null && state !== "error" && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => void load(nextCursor, true)}
                disabled={state === "loading"}
                className="text-[10px] px-2 py-0.5 rounded text-zinc-500 hover:text-zinc-300 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
              >
                {state === "loading" ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// AuditLogRow
// ---------------------------------------------------------------------------

function AuditLogRow({ entry }: { entry: AuditLogEntry }) {
  const tierStyle =
    entry.tier === "LOW"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : entry.tier === "MED"
      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
      : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";

  const statusIcon =
    entry.status === "success" ? (
      <Check className="w-3 h-3 text-emerald-400" aria-hidden="true" />
    ) : entry.status === "skipped" ? (
      <SkipForward className="w-3 h-3 text-zinc-500" aria-hidden="true" />
    ) : (
      <X className="w-3 h-3 text-rose-400" aria-hidden="true" />
    );

  const statusLabel =
    entry.status === "success"
      ? "Applied"
      : entry.status === "skipped"
      ? "Skipped"
      : "Failed";

  return (
    <li className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-800/40 group border border-transparent">
      {/* Status */}
      <span
        className="shrink-0 mt-0.5"
        aria-label={statusLabel}
        title={entry.reason ?? statusLabel}
      >
        {statusIcon}
      </span>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <a
            href={entry.articleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-zinc-200 truncate hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-400/60 rounded-sm"
            title={entry.articleTitle}
          >
            {entry.articleTitle}
          </a>
          <span
            className={`text-[9px] uppercase tracking-wide font-semibold px-1.5 py-0 rounded border tabular-nums ${tierStyle}`}
          >
            {entry.tier === "MANUAL" ? "manual" : `auto·${entry.tier.toLowerCase()}`}
          </span>
          <span className="text-[9px] font-mono tabular-nums text-zinc-500">
            {entry.ruleId}
          </span>
        </div>
        {entry.diffSummary && (
          <div className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate">
            {entry.diffSummary}
          </div>
        )}
        {entry.status === "failed" && entry.reason && (
          <div className="text-[10px] text-rose-400/80 mt-0.5 truncate" title={entry.reason}>
            {entry.reason}
          </div>
        )}
      </div>

      {/* Timestamp + link */}
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <time
          dateTime={entry.ts}
          title={formatAbsolute(entry.ts)}
          className="text-[10px] text-zinc-500 tabular-nums"
        >
          {formatRelative(entry.ts)}
        </time>
        <a
          href={entry.articleUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open "${entry.articleTitle}" in a new tab`}
          className="text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-400/60 rounded-sm"
        >
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </a>
      </div>
    </li>
  );
}
