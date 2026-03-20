import { NextResponse } from "next/server";

const RAW_URL =
  "https://raw.githubusercontent.com/peterbono/flashvoyage-ultra-content/refactor-v2/data/viz-events.json";

const CACHE_TTL_MS = 30 * 1000; // 30 seconds — updates during live runs

interface VizStage {
  agent: string;
  duration_ms: number;
  status: string;
  detail: string;
  score?: number;
}

export interface VizEvent {
  id: string;
  article: string;
  destination: string;
  timestamp: string;
  stages: VizStage[];
}

interface CacheEntry {
  data: { events: VizEvent[]; total: number; fetchedAt: string };
  expiry: number;
}

let cache: CacheEntry | null = null;

export async function GET() {
  try {
    const now = Date.now();
    if (cache && now < cache.expiry) {
      return NextResponse.json(cache.data);
    }

    const res = await fetch(RAW_URL, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`GitHub raw fetch failed: ${res.status} ${res.statusText}`);
    }

    const events = (await res.json()) as VizEvent[];

    const payload = {
      events,
      total: Array.isArray(events) ? events.length : 0,
      fetchedAt: new Date().toISOString(),
    };

    cache = { data: payload, expiry: now + CACHE_TTL_MS };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[api/github/viz-events]", err);
    return NextResponse.json(
      { events: [], total: 0, error: String(err), fetchedAt: new Date().toISOString() },
      { status: 200 }
    );
  }
}
