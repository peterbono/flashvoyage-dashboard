import { NextResponse } from "next/server";

export const maxDuration = 30;

// 30 minute cache
let cache: { ts: number; data: unknown } | null = null;
const CACHE_TTL = 30 * 60 * 1000;

interface RedditPost {
  data: {
    id: string;
    title: string;
    score: number;
    url: string;
    subreddit: string;
    permalink: string;
  };
}

interface RedditListing {
  data: {
    children: RedditPost[];
  };
}

async function getRedditToken(): Promise<string> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const username = process.env.REDDIT_USERNAME;
  const password = process.env.REDDIT_PASSWORD;

  if (!clientId || !clientSecret) {
    throw new Error("Reddit credentials not configured");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const body = new URLSearchParams({
    grant_type: "password",
    username: username ?? "",
    password: password ?? "",
  });

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": `FlashVoyage/1.0 by ${username ?? "FlashVoyage"}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Reddit OAuth failed: ${res.status}`);
  }

  const data = await res.json() as { access_token: string };
  return data.access_token;
}

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  const username = process.env.REDDIT_USERNAME ?? "FlashVoyage";

  try {
    const token = await getRedditToken();

    const res = await fetch(
      "https://oauth.reddit.com/r/travel+solotravel+backpacking+digitalnomad/hot?limit=25&t=day",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": `FlashVoyage/1.0 by ${username}`,
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `Reddit API error: ${res.status}` },
        { status: res.status }
      );
    }

    const listing: RedditListing = await res.json();
    const allPosts = listing.data.children;

    const filtered = allPosts
      .filter((p) => p.data.score > 100)
      .sort((a, b) => b.data.score - a.data.score)
      .slice(0, 10)
      .map((p) => ({
        id: p.data.id,
        title: p.data.title,
        score: p.data.score,
        url: `https://www.reddit.com${p.data.permalink}`,
        subreddit: p.data.subreddit,
      }));

    const result = { source: "live", posts: filtered };
    cache = { ts: Date.now(), data: result };
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch Reddit trending", detail: String(err) },
      { status: 500 }
    );
  }
}
