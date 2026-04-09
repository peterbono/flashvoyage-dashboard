import { NextRequest, NextResponse } from "next/server";
import { fetchContentFile } from "@/lib/github";

/**
 * GET /api/social-stats
 *
 * Aggregates live stats from multiple platforms:
 * - IG: recent media count, total likes/comments via Graph API
 * - FB: page followers (if available)
 * - GA4: sessions from audience-segments.json
 * - TikTok: from tiktok-stats.json
 * - Threads: token status
 *
 * Uses FB Page Token from tokens.json in the content repo.
 */

const IG_ID = "17841442283434789";
const FB_PAGE_ID = "1068729919650308";
const GRAPH_API = "https://graph.facebook.com/v21.0";

interface Publication {
  id: string;
  platform: "instagram" | "facebook" | "tiktok";
  type: "reel" | "post" | "video";
  caption: string;
  publishedAt: string;
  impressions: number;
  interactions: number;
}

interface SocialStats {
  instagram: {
    reelsPublished: number;
    recentReels: { id: string; likes: number; comments: number; plays: number; date: string; caption?: string }[];
    totalLikes: number;
    totalComments: number;
    totalImpressions: number;
    followerCount: number | null;
  };
  facebook: {
    pageLikes: number | null;
    pageFollowers: number | null;
    recentPosts: { id: string; message?: string; likes: number; comments: number; shares: number; impressions: number; date: string }[];
    totalReach: number;
    totalImpressions: number;
  };
  ga4: {
    sessions7d: number;
    topCountries: { country: string; sessions: number }[];
  };
  tiktok: {
    followers: number;
    totalViews: number;
    totalLikes: number;
    videosPosted: number;
  };
  threads: {
    tokenStatus: "active" | "expiring" | "expired";
    expiresAt: string | null;
  };
  publications: Publication[];
  deltas: {
    impressions: number;
    interactions: number;
    publications: number;
  };
  fetchedAt: string;
}

async function fetchReelInsights(
  mediaId: string,
  token: string
): Promise<number> {
  try {
    // Use "reach" metric — ig_reels_aggregated_all_plays_count is deprecated since v22.0
    const res = await fetch(
      `${GRAPH_API}/${mediaId}/insights?metric=reach&access_token=${token}`
    );
    const data = await res.json();
    if (data.error) {
      console.warn(`[social-stats] IG reel insights error for ${mediaId}:`, data.error.message);
      return 0;
    }
    // data.data is an array of metric objects; we want the first one's value
    const metric = data.data?.[0];
    return metric?.values?.[0]?.value ?? 0;
  } catch (err) {
    console.warn(`[social-stats] IG reel insights fetch failed for ${mediaId}:`, err);
    return 0;
  }
}

async function fetchIGStats(token: string): Promise<SocialStats["instagram"]> {
  try {
    // Fetch recent media (last 20)
    const mediaRes = await fetch(
      `${GRAPH_API}/${IG_ID}/media?fields=id,like_count,comments_count,timestamp,caption,media_type&limit=20&access_token=${token}`
    );
    const mediaData = await mediaRes.json();

    if (mediaData.error) {
      console.warn("[social-stats] IG media error:", mediaData.error.message);
      return { reelsPublished: 0, recentReels: [], totalLikes: 0, totalComments: 0, totalImpressions: 0, followerCount: null };
    }

    const videoMedia = (mediaData.data || []).filter(
      (m: { media_type: string }) => m.media_type === "VIDEO"
    );

    // Fetch real play counts for each reel in parallel
    const reelInsightsPromises = videoMedia.map(
      (m: { id: string }) => fetchReelInsights(m.id, token)
    );
    const playCounts: number[] = await Promise.all(reelInsightsPromises);

    const reels = videoMedia.map(
      (m: { id: string; like_count?: number; comments_count?: number; timestamp: string; caption?: string }, i: number) => ({
        id: m.id,
        likes: m.like_count || 0,
        comments: m.comments_count || 0,
        plays: playCounts[i],
        date: m.timestamp,
        caption: m.caption?.slice(0, 100),
      })
    );

    const totalLikes = reels.reduce((s: number, r: { likes: number }) => s + r.likes, 0);
    const totalComments = reels.reduce((s: number, r: { comments: number }) => s + r.comments, 0);
    const totalImpressions = reels.reduce((s: number, r: { plays: number }) => s + r.plays, 0);

    // Try to get follower count
    let followerCount: number | null = null;
    try {
      const profileRes = await fetch(
        `${GRAPH_API}/${IG_ID}?fields=followers_count&access_token=${token}`
      );
      const profileData = await profileRes.json();
      if (profileData.followers_count) followerCount = profileData.followers_count;
    } catch { /* non-fatal */ }

    return {
      reelsPublished: reels.length,
      recentReels: reels,
      totalLikes,
      totalComments,
      totalImpressions,
      followerCount,
    };
  } catch (err) {
    console.error("[social-stats] IG fetch error:", err);
    return { reelsPublished: 0, recentReels: [], totalLikes: 0, totalComments: 0, totalImpressions: 0, followerCount: null };
  }
}

async function fetchPostImpressions(
  postId: string,
  token: string
): Promise<number> {
  try {
    const res = await fetch(
      `${GRAPH_API}/${postId}/insights/post_impressions_unique?access_token=${token}`
    );
    const data = await res.json();
    if (data.error) {
      console.warn(`[social-stats] FB post insights error for ${postId}:`, data.error.message);
      return 0;
    }
    const metric = data.data?.[0];
    return metric?.values?.[0]?.value ?? 0;
  } catch (err) {
    console.warn(`[social-stats] FB post insights fetch failed for ${postId}:`, err);
    return 0;
  }
}

async function fetchFBPageImpressions(
  token: string,
  sinceDays: number = 30
): Promise<number> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const since = now - sinceDays * 86400;
    const res = await fetch(
      `${GRAPH_API}/${FB_PAGE_ID}/insights?metric=page_impressions&period=day&since=${since}&until=${now}&access_token=${token}`
    );
    const data = await res.json();
    if (data.error) {
      console.warn("[social-stats] FB page impressions error:", data.error.message);
      return 0;
    }
    // Sum all daily values over the period
    const values = data.data?.[0]?.values || [];
    return values.reduce((sum: number, v: { value?: number }) => sum + (v.value || 0), 0);
  } catch (err) {
    console.warn("[social-stats] FB page impressions fetch failed:", err);
    return 0;
  }
}

async function fetchFBStats(token: string): Promise<SocialStats["facebook"]> {
  try {
    // Page info (likes + followers)
    const pageRes = await fetch(
      `${GRAPH_API}/${FB_PAGE_ID}?fields=fan_count,followers_count&access_token=${token}`
    );
    const pageData = await pageRes.json();

    const pageLikes = pageData.fan_count ?? null;
    const pageFollowers = pageData.followers_count ?? null;

    // Recent posts (last 10) with inline insights for post_impressions
    const feedRes = await fetch(
      `${GRAPH_API}/${FB_PAGE_ID}/feed?fields=id,message,created_time,type,likes.summary(true),comments.summary(true),shares&limit=10&access_token=${token}`
    );
    const feedData = await feedRes.json();

    const rawPosts = (feedData.data || []).map((p: {
      id: string;
      message?: string;
      created_time: string;
      type?: string;
      likes?: { summary?: { total_count?: number } };
      comments?: { summary?: { total_count?: number } };
      shares?: { count?: number };
    }) => ({
      id: p.id,
      message: p.message?.slice(0, 80),
      type: p.type === "video" ? "video" : "post",
      likes: p.likes?.summary?.total_count || 0,
      comments: p.comments?.summary?.total_count || 0,
      shares: p.shares?.count || 0,
      date: p.created_time,
    }));

    // Fetch real impressions per post in parallel
    const impressionPromises = rawPosts.map(
      (p: { id: string }) => fetchPostImpressions(p.id, token)
    );
    const postImpressions: number[] = await Promise.all(impressionPromises);

    const recentPosts = rawPosts.map(
      (p: { id: string; message?: string; likes: number; comments: number; shares: number; date: string }, i: number) => ({
        ...p,
        impressions: postImpressions[i],
      })
    );

    // totalReach = sum of all post-level impressions
    const totalReach = recentPosts.reduce(
      (s: number, p: { impressions: number }) => s + p.impressions,
      0
    );

    // Use sum of post-level impressions (page_impressions requires read_insights scope)
    const totalImpressions = recentPosts.reduce(
      (s: number, p: { impressions: number }) => s + p.impressions,
      0
    );

    return { pageLikes, pageFollowers, recentPosts, totalReach, totalImpressions };
  } catch (err) {
    console.error("[social-stats] FB fetch error:", err);
    return { pageLikes: null, pageFollowers: null, recentPosts: [], totalReach: 0, totalImpressions: 0 };
  }
}

type Period = "7d" | "30d" | "90d";

const PERIOD_DAYS: Record<Period, number> = { "7d": 7, "30d": 30, "90d": 90 };

function parsePeriod(raw: string | null): Period {
  if (raw === "7d" || raw === "30d" || raw === "90d") return raw;
  return "30d";
}

function filterByDateRange(
  pubs: Publication[],
  startMs: number,
  endMs: number
): Publication[] {
  return pubs.filter((p) => {
    const t = new Date(p.publishedAt).getTime();
    return t >= startMs && t < endMs;
  });
}

function computeDeltas(
  allPubs: Publication[],
  periodDays: number,
  now: number
): SocialStats["deltas"] {
  const currentStart = now - periodDays * 86_400_000;
  const previousStart = currentStart - periodDays * 86_400_000;

  const current = filterByDateRange(allPubs, currentStart, now);
  const previous = filterByDateRange(allPubs, previousStart, currentStart);

  const curImpressions = current.reduce((s, p) => s + p.impressions, 0);
  const prevImpressions = previous.reduce((s, p) => s + p.impressions, 0);

  const curInteractions = current.reduce((s, p) => s + p.interactions, 0);
  const prevInteractions = previous.reduce((s, p) => s + p.interactions, 0);

  const pctChange = (cur: number, prev: number) =>
    prev === 0 ? 0 : Math.round(((cur - prev) / prev) * 10000) / 100;

  return {
    impressions: pctChange(curImpressions, prevImpressions),
    interactions: pctChange(curInteractions, prevInteractions),
    publications: pctChange(current.length, previous.length),
  };
}

export async function GET(request: NextRequest) {
  try {
    const period = parsePeriod(request.nextUrl.searchParams.get("period"));
    const periodDays = PERIOD_DAYS[period];
    const now = Date.now();

    // Use env var (tokens.json is gitignored, not available via raw GitHub)
    const fbToken = process.env.FB_PAGE_TOKEN || "";

    // Try to get Threads token expiry from content repo (non-fatal)
    let threadsExpiresAt: string | null = null;
    try {
      const tokensData = (await fetchContentFile("social-distributor/data/tokens.json")) as {
        threads?: { expiresAt: string };
      };
      threadsExpiresAt = tokensData?.threads?.expiresAt || null;
    } catch {
      // tokens.json is gitignored — expected 404
    }

    // Parallel fetch all sources
    const [igStats, fbStats, audienceData, tiktokData] = await Promise.all([
      fbToken ? fetchIGStats(fbToken) : Promise.resolve({ reelsPublished: 0, recentReels: [], totalLikes: 0, totalComments: 0, totalImpressions: 0, followerCount: null }),
      fbToken ? fetchFBStats(fbToken) : Promise.resolve({ pageLikes: null, pageFollowers: null, recentPosts: [], totalReach: 0, totalImpressions: 0 }),
      fetchContentFile("social-distributor/data/audience-segments.json").catch(() => null) as Promise<{
        byCountry?: { country: string; sessions: number }[];
      } | null>,
      fetchContentFile("data/tiktok-stats.json").catch(() => null) as Promise<{
        account?: { followers: number; totalViews: number; totalLikes: number };
        videos?: unknown[];
      } | null>,
    ]);

    // GA4
    const ga4Sessions = (audienceData?.byCountry || []).reduce(
      (s, c) => s + (c.sessions || 0),
      0
    );
    const topCountries = (audienceData?.byCountry || []).slice(0, 5);

    // TikTok
    const tkAccount = tiktokData?.account;

    // Threads token status
    let threadsStatus: "active" | "expiring" | "expired" = "active";
    const threadsExpiry = threadsExpiresAt;
    if (threadsExpiry) {
      const daysLeft = Math.floor(
        (new Date(threadsExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysLeft <= 0) threadsStatus = "expired";
      else if (daysLeft <= 14) threadsStatus = "expiring";
    }

    // Build unified publications array from all platforms
    const igPublications: Publication[] = igStats.recentReels.map((r) => ({
      id: r.id,
      platform: "instagram" as const,
      type: "reel" as const,
      caption: r.caption || "",
      publishedAt: r.date,
      impressions: r.plays, // real view count from insights API
      interactions: r.likes + r.comments,
    }));

    const fbPublications: Publication[] = fbStats.recentPosts.map((p: { id: string; message?: string; type?: string; date: string; impressions: number; likes: number; comments: number; shares: number }) => ({
      id: p.id,
      platform: "facebook" as const,
      type: (p.type === "video" ? "video" : "post") as "reel" | "post" | "video",
      caption: p.message || "",
      publishedAt: p.date,
      impressions: p.impressions, // real post impressions from insights API
      interactions: p.likes + p.comments + p.shares,
    }));

    const tkVideos = (tiktokData?.videos || []) as {
      title?: string;
      date?: string;
      views?: number;
      likes?: number;
      comments?: number;
      visibility?: string;
    }[];
    const tiktokPublications: Publication[] = tkVideos
      .filter((v) => v.visibility !== "private")
      .map((v, i) => ({
        id: `tiktok-${i}`,
        platform: "tiktok" as const,
        type: "video" as const,
        caption: v.title || "",
        publishedAt: v.date || "",
        impressions: v.views || 0,
        interactions: (v.likes || 0) + (v.comments || 0),
      }));

    const allPublications: Publication[] = [
      ...igPublications,
      ...fbPublications,
      ...tiktokPublications,
    ].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    // Compute deltas using the full (unfiltered) publications array
    const deltas = computeDeltas(allPublications, periodDays, now);

    // Filter publications to the requested period
    const periodStart = now - periodDays * 86_400_000;
    const publications = filterByDateRange(allPublications, periodStart, now);

    const stats: SocialStats = {
      instagram: igStats,
      facebook: fbStats,
      ga4: { sessions7d: ga4Sessions, topCountries },
      tiktok: {
        followers: tkAccount?.followers || 0,
        totalViews: tkAccount?.totalViews || 0,
        totalLikes: tkAccount?.totalLikes || 0,
        videosPosted: tiktokData?.videos?.length || 0,
      },
      threads: { tokenStatus: threadsStatus, expiresAt: threadsExpiry },
      publications,
      deltas,
      fetchedAt: new Date().toISOString(),
    };

    return NextResponse.json(stats);
  } catch (err) {
    console.error("[api/social-stats]", err);
    return NextResponse.json(
      { error: String(err), fetchedAt: new Date().toISOString() },
      { status: 500 }
    );
  }
}
