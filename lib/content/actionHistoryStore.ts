/**
 * Client-side persistent log of user "Mark done" clicks on action
 * recommendations. Pure TS module — no React imports, no side effects at
 * import time. The React layer lives in components/content/useActionHistory.ts.
 *
 * Storage: localStorage key "fv-actions-done-v1".
 * Shape:   a single JSON object { entries: ActionDoneEntry[] }.
 *
 * Each entry is a DENORMALIZED snapshot of everything the user saw when they
 * clicked "Mark done" (rule headline, tag, expected lift, duration, icon,
 * article title/url). This way the history stays readable even if the rule
 * library evolves — we never look up a rule's current state to render a
 * past entry.
 *
 * The "dismissed map" (Record<slug, Set<ruleId>>) is DERIVED from the entries
 * on demand — no separate state to drift against.
 */

import type { ActionRecommendation } from "./actionRules";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActionDoneEntry {
  /** Unique id: `${slug}::${ruleId}::${markedAt}` — lets us dedupe rapid
      double-clicks by bucketing to the second. */
  id: string;
  slug: string;
  articleTitle: string;
  articleUrl: string;
  ruleId: string;
  ruleHeadline: string;
  ruleIcon: string;
  ruleTag: "Quick win" | "Long bet";
  ruleDuration: string;
  expectedLift: string;
  /** ISO timestamp of the click. */
  markedAt: string;
  /** Optional note captured from the rationale at the time of click — helps
      future-you remember why you marked it done. */
  rationale?: string;
}

export interface ActionHistoryState {
  entries: ActionDoneEntry[];
}

export interface ActionableItemLite {
  slug: string;
  title: string;
  url: string;
}

// ---------------------------------------------------------------------------
// Storage IO
// ---------------------------------------------------------------------------

const STORAGE_KEY = "fv-actions-done-v1";

/** Safely read from localStorage. SSR-safe (returns empty during hydration). */
export function loadHistory(): ActionHistoryState {
  if (typeof window === "undefined") return { entries: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { entries: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.entries)) return { entries: [] };
    // Light validation — drop entries that don't have the core fields.
    const valid = parsed.entries.filter(
      (e: unknown): e is ActionDoneEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as ActionDoneEntry).slug === "string" &&
        typeof (e as ActionDoneEntry).ruleId === "string" &&
        typeof (e as ActionDoneEntry).markedAt === "string",
    );
    return { entries: valid };
  } catch {
    return { entries: [] };
  }
}

/** Safely write to localStorage. No-op during SSR. */
export function saveHistory(state: ActionHistoryState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or storage disabled — silently drop. The worst case is
    // the history doesn't persist across reload, which is acceptable for
    // this UX.
  }
}

// ---------------------------------------------------------------------------
// Mutations (pure — take state, return new state)
// ---------------------------------------------------------------------------

/** Add a "Mark done" entry capturing the full context of the click. */
export function addEntry(
  state: ActionHistoryState,
  item: ActionableItemLite,
  rec: ActionRecommendation,
  now: Date = new Date(),
): ActionHistoryState {
  // Dedupe: if the same (slug, ruleId) was marked done within the last 2
  // seconds, treat it as a single click (React double-fire guard).
  const nowMs = now.getTime();
  const recent = state.entries.find(
    (e) =>
      e.slug === item.slug &&
      e.ruleId === rec.id &&
      nowMs - new Date(e.markedAt).getTime() < 2000,
  );
  if (recent) return state;

  const markedAt = now.toISOString();
  const entry: ActionDoneEntry = {
    id: `${item.slug}::${rec.id}::${markedAt}`,
    slug: item.slug,
    articleTitle: item.title,
    articleUrl: item.url,
    ruleId: rec.id,
    ruleHeadline: rec.headline,
    ruleIcon: rec.icon,
    ruleTag: rec.tag,
    ruleDuration: rec.duration,
    expectedLift: rec.expectedLift,
    markedAt,
    rationale: rec.rationale,
  };
  return { entries: [entry, ...state.entries] };
}

/** Remove ALL entries for a given (slug, ruleId). Used by the Undo button. */
export function removeByKey(
  state: ActionHistoryState,
  slug: string,
  ruleId: string,
): ActionHistoryState {
  return {
    entries: state.entries.filter(
      (e) => !(e.slug === slug && e.ruleId === ruleId),
    ),
  };
}

/** Remove a single entry by its unique id. */
export function removeById(
  state: ActionHistoryState,
  entryId: string,
): ActionHistoryState {
  return { entries: state.entries.filter((e) => e.id !== entryId) };
}

/** Wipe the entire history. */
export function clearAll(): ActionHistoryState {
  return { entries: [] };
}

// ---------------------------------------------------------------------------
// Derived selectors
// ---------------------------------------------------------------------------

/**
 * Build a dismissed map from the entries list. Used by the rule evaluation
 * filter in each card — if (slug, ruleId) has any entry in the history, the
 * rule is considered dismissed and filtered out of the display.
 */
export function buildDismissedMap(
  state: ActionHistoryState,
): Record<string, Set<string>> {
  const map: Record<string, Set<string>> = {};
  for (const entry of state.entries) {
    if (!map[entry.slug]) map[entry.slug] = new Set();
    map[entry.slug].add(entry.ruleId);
  }
  return map;
}

/** Count entries within the last N days, for the panel badge. */
export function countEntriesSince(
  state: ActionHistoryState,
  days: number,
  now: Date = new Date(),
): number {
  const cutoff = now.getTime() - days * 86_400_000;
  return state.entries.filter(
    (e) => new Date(e.markedAt).getTime() >= cutoff,
  ).length;
}
