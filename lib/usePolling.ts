"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface UsePollingResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** Manually trigger a fetch outside the normal interval. */
  refetch: () => Promise<void>;
}

/**
 * Client-side hook that polls an API endpoint at a fixed interval.
 *
 * Features:
 * - Immediate fetch on mount
 * - Auto-pause when the browser tab is hidden (document.visibilitychange)
 * - Configurable interval and enable/disable flag
 * - Stable `refetch` callback (does not cause re-renders)
 */
export function usePolling<T = unknown>(
  url: string,
  intervalMs: number,
  enabled = true
): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Keep a ref to the latest url so the interval closure always uses the
  // current value without needing to restart the timer.
  const urlRef = useRef(url);
  urlRef.current = url;

  // Abort controller ref for in-flight requests
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      const res = await fetch(urlRef.current, {
        signal: controller.signal,
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const json = (await res.json()) as T;
      setData(json);
      setError(null);
    } catch (err: unknown) {
      // Don't treat aborts as errors
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []); // stable — url comes from ref

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    // Initial fetch
    fetchData();

    // Set up interval
    let timer: ReturnType<typeof setInterval> | null = setInterval(
      fetchData,
      intervalMs
    );

    // Pause when tab is hidden, resume when visible
    function handleVisibility() {
      if (document.hidden) {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      } else {
        // Fetch immediately when tab becomes visible again
        fetchData();
        timer = setInterval(fetchData, intervalMs);
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
      abortRef.current?.abort();
    };
  }, [enabled, intervalMs, fetchData]);

  return { data, error, loading, refetch: fetchData };
}
