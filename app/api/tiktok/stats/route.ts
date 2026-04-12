import { NextRequest, NextResponse } from "next/server";
import { fetchContentFile, writeContentFile } from "@/lib/github";

/**
 * GET/PUT /api/tiktok/stats
 *
 * Manual-entry proxy for `data/tiktok-stats.json` in the content repo.
 * Until TikTok API app review is approved, the founder enters stats by hand
 * (exported from TikTok Studio). The dashboard renders this file on the
 * Analytics page and writes back through this endpoint.
 *
 * Shape on disk mirrors what social-stats/route.ts expects:
 *   {
 *     lastUpdated: "YYYY-MM-DD",
 *     account: { followers, following, totalViews, totalLikes, totalComments, totalShares, daysSinceStart },
 *     videos: [{ title, format, date, duration, views, likes, comments, shares }]
 *   }
 */

const STATS_PATH = "data/tiktok-stats.json";

export interface TikTokAccount {
  followers: number;
  following: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  daysSinceStart: number;
}

export interface TikTokVideo {
  title: string;
  format?: string;
  date: string;
  duration?: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  visibility?: string;
}

export interface TikTokStatsShape {
  lastUpdated: string;
  account: TikTokAccount;
  videos: TikTokVideo[];
  _readme?: string;
}

const DEFAULT_STATS: TikTokStatsShape = {
  _readme:
    "Manual TikTok stats — edited via dashboard (/analytics TikTok editor) or by hand. App-review auto-fetch pending.",
  lastUpdated: new Date().toISOString().slice(0, 10),
  account: {
    followers: 0,
    following: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
    daysSinceStart: 0,
  },
  videos: [],
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function clampInt(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.trunc(value));
}

function sanitizeAccount(raw: unknown): TikTokAccount {
  const r = (raw ?? {}) as Partial<TikTokAccount>;
  return {
    followers: clampInt(r.followers, 0),
    following: clampInt(r.following, 0),
    totalViews: clampInt(r.totalViews, 0),
    totalLikes: clampInt(r.totalLikes, 0),
    totalComments: clampInt(r.totalComments, 0),
    totalShares: clampInt(r.totalShares, 0),
    daysSinceStart: clampInt(r.daysSinceStart, 0),
  };
}

function sanitizeVideo(raw: unknown): TikTokVideo | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<TikTokVideo>;
  // A video without a title or date is unusable — drop silently.
  if (typeof r.title !== "string" || !r.title.trim()) return null;
  if (typeof r.date !== "string" || !r.date.trim()) return null;
  return {
    title: r.title.trim().slice(0, 200),
    format:
      typeof r.format === "string" && r.format.trim()
        ? r.format.trim().slice(0, 40)
        : undefined,
    date: r.date.trim(),
    duration:
      typeof r.duration === "number" && Number.isFinite(r.duration)
        ? Math.max(0, Math.trunc(r.duration))
        : undefined,
    views: clampInt(r.views, 0),
    likes: clampInt(r.likes, 0),
    comments: clampInt(r.comments, 0),
    shares: clampInt(r.shares, 0),
    visibility:
      typeof r.visibility === "string" && r.visibility.trim()
        ? r.visibility.trim().slice(0, 20)
        : undefined,
  };
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(): Promise<Response> {
  try {
    const json = await fetchContentFile<Partial<TikTokStatsShape>>(STATS_PATH, {
      cacheTtlMs: 0,
    });
    const merged: TikTokStatsShape = {
      _readme: typeof json._readme === "string" ? json._readme : DEFAULT_STATS._readme,
      lastUpdated:
        typeof json.lastUpdated === "string" && json.lastUpdated.trim()
          ? json.lastUpdated
          : DEFAULT_STATS.lastUpdated,
      account: sanitizeAccount(json.account),
      videos: Array.isArray(json.videos)
        ? json.videos
            .map(sanitizeVideo)
            .filter((v): v is TikTokVideo => v !== null)
        : [],
    };
    return NextResponse.json(merged);
  } catch (err) {
    const msg = String(err);
    if (msg.includes("404")) {
      return NextResponse.json(DEFAULT_STATS);
    }
    console.error("[api/tiktok/stats/GET]", err);
    const status = msg.includes("GITHUB_TOKEN") ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

// ---------------------------------------------------------------------------
// PUT
// ---------------------------------------------------------------------------

interface PutBody {
  account?: unknown;
  videos?: unknown;
}

export async function PUT(req: NextRequest): Promise<Response> {
  try {
    const body = (await req.json()) as PutBody;

    // Sanitize payload — reject nothing silently, but coerce to safe shape.
    const account = sanitizeAccount(body.account);
    const videos = Array.isArray(body.videos)
      ? body.videos
          .map(sanitizeVideo)
          .filter((v): v is TikTokVideo => v !== null)
      : [];

    const next: TikTokStatsShape = {
      _readme: DEFAULT_STATS._readme,
      lastUpdated: new Date().toISOString().slice(0, 10),
      account,
      videos,
    };

    const payload = JSON.stringify(next, null, 2) + "\n";
    await writeContentFile(
      STATS_PATH,
      payload,
      `chore(tiktok): update stats (${videos.length} videos, ${account.followers} followers)`,
    );

    return NextResponse.json(next);
  } catch (err) {
    console.error("[api/tiktok/stats/PUT]", err);
    const msg = String(err);
    const status = msg.includes("GITHUB_TOKEN") ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
