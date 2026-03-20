"use client";

import { useEffect, useState } from "react";

const COST_KEY = "fv_suggestions_cost";

export interface DailyCost {
  date: string;
  totalUsd: number;
  callCount: number;
}

export function useSuggestionsCost(): DailyCost | null {
  const [cost, setCost] = useState<DailyCost | null>(null);

  useEffect(() => {
    function read() {
      try {
        const raw = localStorage.getItem(COST_KEY);
        if (!raw) return;
        const parsed: DailyCost = JSON.parse(raw);
        const today = new Date().toISOString().slice(0, 10);
        if (parsed.date === today) setCost(parsed);
      } catch { /* ignore */ }
    }
    read();
    // Re-read when storage changes (e.g. after a fresh API call on another tab)
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, []);

  return cost;
}
