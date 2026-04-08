import { NextResponse } from "next/server";
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
const GRAPH_API = "https://graph.facebook.com/v21.0";

interface SocialStats {
  instagram: {
    reelsPublished: number;
    recentReels: { id: string; likes: number; comments: number; plays?: number; date: string; caption?: string }[];
    totalLikes: number;
    totalComments: number;
    followerCount: number | null;
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
  fetchedAt: string;
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
      return { reelsPublished: 0, recentReels: [], totalLikes: 0, totalComments: 0, followerCount: null };
    }

    const reels = (mediaData.data || [])
      .filter((m: { media_type: string }) => m.media_type === "VIDEO")
      .map((m: { id: string; like_count?: number; comments_count?: number; timestamp: string; caption?: string }) => ({
        id: m.id,
        likes: m.like_count || 0,
        comments: m.comments_count || 0,
        date: m.timestamp,
        caption: m.caption?.slice(0, 100),
      }));

    const totalLikes = reels.reduce((s: number, r: { likes: number }) => s + r.likes, 0);
    const totalComments = reels.reduce((s: number, r: { comments: number }) => s + r.comments, 0);

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
      followerCount,
    };
  } catch (err) {
    console.error("[social-stats] IG fetch error:", err);
    return { reelsPublished: 0, recentReels: [], totalLikes: 0, totalComments: 0, followerCount: null };
  }
}

export async function GET() {
  try {
    // Fetch tokens from content repo
    const tokensData = (await fetchContentFile("social-distributor/data/tokens.json")) as {
      facebook?: { token: string };
      threads?: { token: string; expiresAt: string };
    };

    const fbToken = tokensData?.facebook?.token || process.env.FB_PAGE_TOKEN || "";

    // Parallel fetch all sources
    const [igStats, audienceData, tiktokData] = await Promise.all([
      fbToken ? fetchIGStats(fbToken) : Promise.resolve({ reelsPublished: 0, recentReels: [], totalLikes: 0, totalComments: 0, followerCount: null }),
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
    const threadsExpiry = tokensData?.threads?.expiresAt || null;
    if (threadsExpiry) {
      const daysLeft = Math.floor(
        (new Date(threadsExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysLeft <= 0) threadsStatus = "expired";
      else if (daysLeft <= 14) threadsStatus = "expiring";
    }

    const stats: SocialStats = {
      instagram: igStats,
      ga4: { sessions7d: ga4Sessions, topCountries },
      tiktok: {
        followers: tkAccount?.followers || 0,
        totalViews: tkAccount?.totalViews || 0,
        totalLikes: tkAccount?.totalLikes || 0,
        videosPosted: tiktokData?.videos?.length || 0,
      },
      threads: { tokenStatus: threadsStatus, expiresAt: threadsExpiry },
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
