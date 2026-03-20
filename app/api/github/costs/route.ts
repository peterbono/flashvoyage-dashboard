import { NextResponse } from "next/server";

const RAW_URL =
  "https://raw.githubusercontent.com/peterbono/flashvoyage-ultra-content/refactor-v2/data/cost-history.jsonl";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface ByStepMetrics {
  [step: string]: {
    costUSD?: number;
    tokensIn?: number;
    tokensOut?: number;
    calls?: number;
    durationMs?: number;
  };
}

interface ByModelMetrics {
  [model: string]: {
    costUSD?: number;
    tokensIn?: number;
    tokensOut?: number;
    calls?: number;
  };
}

export interface CostEntry {
  date: string;
  articleId: number | null;
  title: string;
  slug: string | null;
  url: string;
  wordCount: number;
  totalCostUSD: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalTokens: number;
  totalCalls: number;
  durationMs: number;
  llmDurationMs: number;
  llmTimeRatio: number;
  costPerWord: number;
  byStep: ByStepMetrics;
  byModel: ByModelMetrics;
}

interface CacheEntry {
  data: { entries: CostEntry[]; total: number; fetchedAt: string };
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

    const text = await res.text();
    const entries: CostEntry[] = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as CostEntry);

    const payload = {
      entries,
      total: entries.length,
      fetchedAt: new Date().toISOString(),
    };

    cache = { data: payload, expiry: now + CACHE_TTL_MS };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[api/github/costs]", err);
    return NextResponse.json(
      { entries: [], total: 0, error: String(err), fetchedAt: new Date().toISOString() },
      { status: 200 }
    );
  }
}
