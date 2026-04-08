import { NextResponse } from "next/server";
import { fetchContentFile } from "@/lib/github";

/**
 * GET /api/best-times
 *
 * Computes optimal posting times by analysing historical publication
 * times cross-referenced with engagement data from IG (reel-history +
 * Graph API) and TikTok (tiktok-stats.json).
 *
 * Returns top-3 hour-of-day recommendations with uplift % and confidence.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReelHistoryEntry {
  date: string;
  reelId: string;
  postId: number | null;
  format: string;
  permalink: string;
}

interface TikTokVideo {
  title: string;
  format: string;
  date: string;
  duration: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  visibility?: string;
}

interface TikTokStatsFile {
  videos: TikTokVideo[];
  lastUpdated: string;
}

interface HourBucket {
  totalEngagement: number;
  count: number;
  platforms: Set<string>;
}

interface Recommendation {
  utcHour: number;
  label: string;
  platforms: string[];
  avgEngagement: number;
  uplift: number;
  confidence: number;
  sampleCount: number;
}

interface HourlyDatum {
  hour: number;
  avgEngagement: number;
  count: number;
}

interface BestTimesResponse {
  recommendations: Recommendation[];
  hourlyData: HourlyDatum[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const IG_ID = "17841442283434789";
const GRAPH_API = "https://graph.facebook.com/v21.0";

/** Format a UTC hour as "Xh BKK" (UTC+7). */
function utcToBkkLabel(utcHour: number): string {
  const bkk = (utcHour + 7) % 24;
  return `${bkk}h BKK`;
}

/**
 * Fetch recent IG media engagement from the Graph API.
 * Returns a Map<reelId, engagement> where engagement = likes + comments.
 */
async function fetchIGEngagementMap(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const token = process.env.FB_PAGE_TOKEN;
  if (!token) return map;

  try {
    const res = await fetch(
      `${GRAPH_API}/${IG_ID}/media?fields=id,like_count,comments_count,timestamp&limit=50&access_token=${token}`,
      { cache: "no-store" }
    );
    if (!res.ok) return map;

    const json = (await res.json()) as {
      data?: { id: string; like_count?: number; comments_count?: number; timestamp?: string }[];
    };

    for (const m of json.data ?? []) {
      const engagement = (m.like_count ?? 0) + (m.comments_count ?? 0);
      map.set(m.id, engagement);
      // Also index by timestamp hour so we can match reel-history entries
      // that may not share the same ID format
      if (m.timestamp) {
        const hour = new Date(m.timestamp).getUTCHours();
        const key = `ts:${m.timestamp}`;
        map.set(key, engagement);
      }
    }
  } catch (err) {
    console.warn("[best-times] IG engagement fetch failed:", err);
  }

  return map;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    // Fetch both data sources in parallel
    const [reelHistory, tiktokStats, igEngagementMap] = await Promise.all([
      fetchContentFile<ReelHistoryEntry[]>("social-distributor/data/reel-history.jsonl", {
        parseAs: "jsonl",
      }).catch(() => [] as ReelHistoryEntry[]),
      fetchContentFile<TikTokStatsFile>("data/tiktok-stats.json").catch(
        () => null
      ),
      fetchIGEngagementMap(),
    ]);

    // Buckets: one per hour (0-23)
    const buckets: HourBucket[] = Array.from({ length: 24 }, () => ({
      totalEngagement: 0,
      count: 0,
      platforms: new Set<string>(),
    }));

    // --- IG reels -----------------------------------------------------------
    // Build a lookup from IG Graph API data keyed by approximate timestamp
    // We'll match reel-history entries by their reelId first, then fall back
    // to a default engagement of 1 (publication counted as signal).
    for (const reel of reelHistory) {
      const d = new Date(reel.date);
      if (isNaN(d.getTime())) continue;

      const hour = d.getUTCHours();
      // Try matching by reelId in the IG engagement map
      let engagement = igEngagementMap.get(reel.reelId);
      if (engagement === undefined) {
        // Fallback: try by timestamp key
        engagement = igEngagementMap.get(`ts:${reel.date}`);
      }
      // If we still have no engagement data, count 1 per publication
      // (a publication is still a signal of activity at that hour)
      if (engagement === undefined) engagement = 1;

      buckets[hour].totalEngagement += engagement;
      buckets[hour].count += 1;
      buckets[hour].platforms.add("instagram");
    }

    // --- TikTok videos ------------------------------------------------------
    const videos = (tiktokStats?.videos ?? []).filter(
      (v) => v.visibility !== "private"
    );

    for (const video of videos) {
      const d = new Date(video.date);
      if (isNaN(d.getTime())) continue;

      const hour = d.getUTCHours();
      // TikTok engagement = views (primary metric)
      const engagement = video.views ?? 0;

      buckets[hour].totalEngagement += engagement;
      buckets[hour].count += 1;
      buckets[hour].platforms.add("tiktok");
    }

    // --- Compute hourly averages -------------------------------------------
    const hourlyData: HourlyDatum[] = buckets.map((b, hour) => ({
      hour,
      avgEngagement: b.count > 0 ? Math.round(b.totalEngagement / b.count) : 0,
      count: b.count,
    }));

    // Overall average (only hours with data)
    const hoursWithData = hourlyData.filter((h) => h.count > 0);
    const overallAvg =
      hoursWithData.length > 0
        ? hoursWithData.reduce((s, h) => s + h.avgEngagement, 0) /
          hoursWithData.length
        : 0;

    // --- Top 3 recommendations ---------------------------------------------
    const ranked = hourlyData
      .filter((h) => h.count > 0)
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 3);

    const recommendations: Recommendation[] = ranked.map((h) => {
      const uplift =
        overallAvg > 0
          ? Math.round(((h.avgEngagement - overallAvg) / overallAvg) * 1000) /
            10
          : 0;
      const confidence = Math.min(100, h.count * 10);
      const platforms = Array.from(buckets[h.hour].platforms);

      return {
        utcHour: h.hour,
        label: utcToBkkLabel(h.hour),
        platforms,
        avgEngagement: h.avgEngagement,
        uplift,
        confidence,
        sampleCount: h.count,
      };
    });

    const response: BestTimesResponse = { recommendations, hourlyData };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[api/best-times]", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
