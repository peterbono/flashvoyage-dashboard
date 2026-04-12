import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/content-intelligence
 *
 * Aggregates per-article intelligence from 3 sources in the flashvoyage-content repo:
 *  - data/article-scores.json                   — latest composite scores + signals
 *  - data/score-history/YYYY-MM-DD.json         — daily composite score snapshots (used for 7d delta)
 *  - data/cost-history.jsonl                    — writing cost per article run
 *
 * Returns:
 *  {
 *    kpis: {
 *      avgScore, zeroTrafficCount, decliningCount, totalInvestedUSD, articleCount
 *    },
 *    refreshQueue: Array<{ slug, title, url, score, delta7d, flags }>,
 *    topPerformers: Array<{ slug, title, url, score, monetization, flags }>,
 *    fetchedAt: string
 *  }
 *
 * All joins are by slug. URLs come from articles-database.json.
 */

const BASE = "https://raw.githubusercontent.com/peterbono/flashvoyage-ultra-content/main";
const ARTICLES_DB_URL =
  "https://raw.githubusercontent.com/peterbono/flashvoyage-ultra-content/refactor-v2/articles-database.json";
const SCORES_URL = `${BASE}/data/article-scores.json`;
const COST_HISTORY_URL = `${BASE}/data/cost-history.jsonl`;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScoreSignals {
  traffic: number;
  sessionQuality: number;
  trendAlignment: number;
  reelAmplification: number;
  freshness: number;
  monetization: number;
}

interface ScoreEntry {
  wpId: number;
  slug: string;
  title: string;
  compositeScore: number;
  signals: ScoreSignals;
  flags: string[];
  date: string;
  wordCount: number;
}

interface ScoresFile {
  timestamp: string;
  articleCount: number;
  scores: ScoreEntry[];
  summary: {
    avgScore: number;
    topPerformers: number;
    staleArticles: number;
    missingWidgets: number;
    zeroTraffic: number;
    trending: number;
  };
}

interface HistoryEntry {
  slug: string;
  compositeScore: number;
}

interface HistoryFile {
  date: string;
  timestamp: string;
  scores: HistoryEntry[];
}

interface CostEntry {
  url: string;
  articleId: number | null;
  totalCostUSD: number;
}

interface ArticleDbEntry {
  id: number;
  slug: string;
  url: string;
}

interface ArticlesDbFile {
  articles: ArticleDbEntry[];
}

export interface ContentIntelligence {
  kpis: {
    avgScore: number;
    zeroTrafficCount: number;
    decliningCount: number;
    totalInvestedUSD: number;
    articleCount: number;
    avgScoreDelta7d: number | null;
  };
  refreshQueue: Array<{
    slug: string;
    title: string;
    url: string;
    score: number;
    delta7d: number;
    flags: string[];
    /** Top 2 weakest signals (Phase 2 diagnosis) — normalized 0-1 */
    weakSignals: Array<{ name: keyof ScoreSignals; value: number }>;
    /** Full 6-signal object for the client-side rule engine (v3 Action Recommendations) */
    signals: ScoreSignals;
    /** WordPress post id for building wp-admin edit URLs */
    wpId: number;
  }>;
  topPerformers: Array<{
    slug: string;
    title: string;
    url: string;
    score: number;
    monetization: number;
    flags: string[];
    /** Top 2 strongest signals (symmetric to refreshQueue.weakSignals) — shows WHY it's growing */
    strongSignals: Array<{ name: keyof ScoreSignals; value: number }>;
    /** Full 6-signal object for the client-side rule engine (v3 Action Recommendations) */
    signals: ScoreSignals;
    /** 7-day composite score delta (may be 0 if no history) */
    delta7d: number;
    /** WordPress post id for building wp-admin edit URLs */
    wpId: number;
  }>;
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Simple in-memory cache (same pattern as /api/github/articles & /api/github/costs)
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: ContentIntelligence;
  expiry: number;
}
let cache: CacheEntry | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a Date as YYYY-MM-DD in UTC (matches score-history file naming). */
function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Try to fetch the score-history file for a given date, walking back up to 3 days. */
async function fetchHistorySnapshot(targetDate: Date): Promise<HistoryFile | null> {
  for (let i = 0; i < 3; i++) {
    const probe = new Date(targetDate);
    probe.setUTCDate(probe.getUTCDate() - i);
    const url = `${BASE}/data/score-history/${toYmd(probe)}.json`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      return (await res.json()) as HistoryFile;
    } catch {
      /* try previous day */
    }
  }
  return null;
}

async function fetchScores(): Promise<ScoresFile> {
  const res = await fetch(SCORES_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`article-scores.json fetch failed: ${res.status}`);
  }
  return (await res.json()) as ScoresFile;
}

async function fetchArticlesDb(): Promise<Map<string, string>> {
  // Returns slug -> url map
  const res = await fetch(ARTICLES_DB_URL, { cache: "no-store" });
  if (!res.ok) {
    console.warn("[content-intelligence] articles-database fetch failed:", res.status);
    return new Map();
  }
  const db = (await res.json()) as ArticlesDbFile;
  const map = new Map<string, string>();
  for (const a of db.articles ?? []) {
    if (a.slug && a.url) map.set(a.slug, a.url);
  }
  return map;
}

async function fetchCostByUrl(): Promise<Map<string, number>> {
  // Returns url -> summed totalCostUSD across all runs
  const res = await fetch(COST_HISTORY_URL, { cache: "no-store" });
  if (!res.ok) {
    console.warn("[content-intelligence] cost-history fetch failed:", res.status);
    return new Map();
  }
  const text = await res.text();
  const byUrl = new Map<string, number>();
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const entry = JSON.parse(trimmed) as CostEntry;
      if (entry.url && typeof entry.totalCostUSD === "number") {
        byUrl.set(entry.url, (byUrl.get(entry.url) ?? 0) + entry.totalCostUSD);
      }
    } catch {
      /* skip malformed line */
    }
  }
  return byUrl;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const now = Date.now();
    const bypassCache = req.nextUrl.searchParams.get("bypass-cache") === "1";
    if (!bypassCache && cache && now < cache.expiry) {
      return NextResponse.json(cache.data);
    }

    const [scoresFile, slugToUrl, costByUrl, historySnapshot] = await Promise.all([
      fetchScores(),
      fetchArticlesDb(),
      fetchCostByUrl(),
      fetchHistorySnapshot(new Date(Date.now() - 7 * 86_400_000)),
    ]);

    const scores = scoresFile.scores ?? [];
    const prevBySlug = new Map<string, number>();
    for (const entry of historySnapshot?.scores ?? []) {
      prevBySlug.set(entry.slug, entry.compositeScore);
    }

    // ── Build enriched rows (join scores + history + url) ─────────────────
    const enriched = scores.map((s) => {
      const prevScore = prevBySlug.get(s.slug);
      const delta7d = typeof prevScore === "number" ? s.compositeScore - prevScore : 0;
      return {
        slug: s.slug,
        title: s.title,
        url: slugToUrl.get(s.slug) ?? (s.slug ? `https://flashvoyage.com/${s.slug}/` : ""),
        score: s.compositeScore,
        monetization: s.signals?.monetization ?? 0,
        trafficSignal: s.signals?.traffic ?? 0,
        signals: s.signals,
        flags: s.flags ?? [],
        delta7d,
        wpId: s.wpId,
      };
    });

    // Phase 2 diagnosis: pick the top 2 WEAKEST signals for an article.
    // This answers "why is this article's score low right now" without
    // requiring per-signal history files — it just surfaces the current
    // weak spots so the founder knows what to focus on before clicking refresh.
    const computeWeakSignals = (
      signals: ScoreSignals | undefined
    ): Array<{ name: keyof ScoreSignals; value: number }> => {
      if (!signals) return [];
      const entries = (Object.entries(signals) as Array<[keyof ScoreSignals, number]>)
        .filter(([, v]) => typeof v === "number")
        .sort(([, a], [, b]) => a - b)
        .slice(0, 2)
        .map(([name, value]) => ({ name, value }));
      return entries;
    };

    // Mirror of computeWeakSignals for top performers — highest 2 signals
    // answer "why is this article winning right now?" so the founder knows
    // which pattern to replicate on weaker siblings (or amplify via reels/links).
    const computeStrongSignals = (
      signals: ScoreSignals | undefined
    ): Array<{ name: keyof ScoreSignals; value: number }> => {
      if (!signals) return [];
      const entries = (Object.entries(signals) as Array<[keyof ScoreSignals, number]>)
        .filter(([, v]) => typeof v === "number" && v > 0)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2)
        .map(([name, value]) => ({ name, value }));
      return entries;
    };

    // ── KPIs ──────────────────────────────────────────────────────────────
    const totalInvestedUSD = Array.from(costByUrl.values()).reduce(
      (sum, v) => sum + v,
      0
    );

    // Decline = lost 10+ composite points vs 7d ago
    const declining = enriched.filter((e) => e.delta7d <= -10);
    const deltaSamples = enriched.filter(
      (e) => prevBySlug.has(e.slug)
    );
    const avgScoreDelta7d =
      deltaSamples.length > 0
        ? deltaSamples.reduce((s, e) => s + e.delta7d, 0) / deltaSamples.length
        : null;

    const kpis: ContentIntelligence["kpis"] = {
      avgScore: scoresFile.summary?.avgScore ?? 0,
      zeroTrafficCount: scoresFile.summary?.zeroTraffic ?? 0,
      decliningCount: declining.length,
      totalInvestedUSD: Math.round(totalInvestedUSD * 100) / 100,
      articleCount: scoresFile.articleCount ?? scores.length,
      avgScoreDelta7d:
        avgScoreDelta7d !== null ? Math.round(avgScoreDelta7d * 100) / 100 : null,
    };

    // ── Refresh queue: biggest negative delta first, then lowest score ───
    const refreshQueue = [...enriched]
      .filter((e) => e.delta7d < 0 || e.flags.includes("underperformer") || e.score < 30)
      .sort((a, b) => {
        // More negative delta first
        if (a.delta7d !== b.delta7d) return a.delta7d - b.delta7d;
        // Tie-breaker: lower score first
        return a.score - b.score;
      })
      .slice(0, 10)
      .map(({ slug, title, url, score, delta7d, flags, signals, wpId }) => ({
        slug,
        title,
        url,
        score,
        delta7d,
        flags,
        weakSignals: computeWeakSignals(signals),
        signals,
        wpId,
      }));

    // ── Top performers: highest composite score first, ties by monetization ──
    const topPerformers = [...enriched]
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.monetization - a.monetization;
      })
      .slice(0, 10)
      .map(({ slug, title, url, score, monetization, flags, signals, delta7d, wpId }) => ({
        slug,
        title,
        url,
        score,
        monetization,
        flags,
        strongSignals: computeStrongSignals(signals),
        signals,
        delta7d,
        wpId,
      }));

    const payload: ContentIntelligence = {
      kpis,
      refreshQueue,
      topPerformers,
      fetchedAt: new Date().toISOString(),
    };

    cache = { data: payload, expiry: now + CACHE_TTL_MS };
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[api/content-intelligence]", err);
    return NextResponse.json(
      {
        kpis: {
          avgScore: 0,
          zeroTrafficCount: 0,
          decliningCount: 0,
          totalInvestedUSD: 0,
          articleCount: 0,
          avgScoreDelta7d: null,
        },
        refreshQueue: [],
        topPerformers: [],
        fetchedAt: new Date().toISOString(),
        error: String(err),
      },
      { status: 200 }
    );
  }
}
