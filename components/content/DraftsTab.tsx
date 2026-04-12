"use client";

/**
 * DraftsTab — placeholder for the MEDIUM-tier draft review workflow. Day 1
 * this tab is intentionally empty: the runner doesn't yet produce drafts,
 * and the review UI is a v2 deliverable. The stub keeps the tab registration
 * stable so the future implementation ships without a routing change.
 *
 * Calls GET /api/actions/drafts (which always returns an empty array) so the
 * network shape matches what the real component will consume.
 */

import { useEffect, useState } from "react";
import { FileEdit, ChevronDown, ChevronRight, Info } from "lucide-react";

interface DraftsResponse {
  drafts: unknown[];
}

export function DraftsTab() {
  const [expanded, setExpanded] = useState(true);
  const [count, setCount] = useState(0);

  // Best-effort fetch so the stub already exercises the endpoint shape. If
  // it fails we quietly show "0" — this view is a placeholder regardless.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/actions/drafts", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as DraftsResponse;
        if (cancelled) return;
        setCount(Array.isArray(json.drafts) ? json.drafts.length : 0);
      } catch {
        // stub — swallow.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      aria-label="Auto-apply drafts (MEDIUM tier)"
      className="rounded-xl border border-zinc-800/80 bg-zinc-900/40"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="drafts-tab-panel"
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-xl"
      >
        <div className="flex items-center gap-2">
          <FileEdit
            className="w-3.5 h-3.5 text-amber-400"
            aria-hidden="true"
          />
          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            Drafts
          </span>
          <span className="text-[10px] text-zinc-500 normal-case tabular-nums">
            · {count} pending
          </span>
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
          id="drafts-tab-panel"
          className="px-4 pb-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-150"
        >
          <div className="flex flex-col items-center text-center py-6 gap-3">
            <div
              className="w-10 h-10 rounded-full border border-amber-500/30 bg-amber-500/10 flex items-center justify-center"
              aria-hidden="true"
            >
              <FileEdit className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="text-xs font-medium text-zinc-100">
                No drafts yet
              </div>
              <p className="text-[11px] text-zinc-500 mt-1 max-w-[32ch] leading-snug">
                MEDIUM tier is not active. Once the review workflow is wired,
                auto-generated drafts will land here for approval before
                publishing.
              </p>
            </div>
            <span className="flex items-center gap-1 text-[10px] text-zinc-500">
              <Info className="w-3 h-3" aria-hidden="true" />
              Coming soon
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
