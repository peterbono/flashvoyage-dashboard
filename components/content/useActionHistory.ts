"use client";

/**
 * Shared React hook around the actionHistoryStore.
 *
 * - Persists to localStorage on every mutation.
 * - Syncs across tabs via a storage event listener (so marking done in one
 *   tab updates the other tab within a few ms).
 * - Exposes a stable dismissedMap that the card components pass to their
 *   filter functions.
 *
 * Used by: RefreshQueueCard, TopPerformersCard, ActionsTab, ActionDoneHistory.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addEntry,
  buildDismissedMap,
  clearAll,
  loadHistory,
  removeById,
  removeByKey,
  saveHistory,
  type ActionDoneEntry,
  type ActionHistoryState,
  type ActionableItemLite,
} from "@/lib/content/actionHistoryStore";
import type { ActionRecommendation } from "@/lib/content/actionRules";

const STORAGE_KEY = "fv-actions-done-v1";

export interface UseActionHistoryResult {
  entries: ActionDoneEntry[];
  dismissedMap: Record<string, Set<string>>;
  markDone: (item: ActionableItemLite, rec: ActionRecommendation) => void;
  undoByKey: (slug: string, ruleId: string) => void;
  undoById: (entryId: string) => void;
  clear: () => void;
  isDismissed: (slug: string, ruleId: string) => boolean;
}

export function useActionHistory(): UseActionHistoryResult {
  const [state, setState] = useState<ActionHistoryState>(() => ({
    entries: [],
  }));

  // Hydrate from localStorage on mount (deferred so SSR doesn't mismatch).
  useEffect(() => {
    setState(loadHistory());
  }, []);

  // Cross-tab sync: listen for localStorage changes from OTHER tabs.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      setState(loadHistory());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((next: ActionHistoryState) => {
    setState(next);
    saveHistory(next);
  }, []);

  const markDone = useCallback(
    (item: ActionableItemLite, rec: ActionRecommendation) => {
      setState((prev) => {
        const next = addEntry(prev, item, rec);
        saveHistory(next);
        return next;
      });
    },
    [],
  );

  const undoByKey = useCallback((slug: string, ruleId: string) => {
    setState((prev) => {
      const next = removeByKey(prev, slug, ruleId);
      saveHistory(next);
      return next;
    });
  }, []);

  const undoById = useCallback((entryId: string) => {
    setState((prev) => {
      const next = removeById(prev, entryId);
      saveHistory(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    const empty = clearAll();
    persist(empty);
  }, [persist]);

  const dismissedMap = useMemo(() => buildDismissedMap(state), [state]);

  const isDismissed = useCallback(
    (slug: string, ruleId: string) =>
      dismissedMap[slug]?.has(ruleId) ?? false,
    [dismissedMap],
  );

  return {
    entries: state.entries,
    dismissedMap,
    markDone,
    undoByKey,
    undoById,
    clear,
    isDismissed,
  };
}
