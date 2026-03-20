import { NextResponse } from "next/server";

export const maxDuration = 30;

// 5 minute cache
let cache: { ts: number; data: unknown } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

interface WPPost {
  id: number;
  title: { rendered: string };
  date: string;
  link: string;
  slug: string;
}

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  const wpUrl = process.env.WORDPRESS_URL?.replace(/\/$/, "");
  const wpUser = process.env.WORDPRESS_USERNAME;
  const wpPass = process.env.WORDPRESS_APP_PASSWORD;

  if (!wpUrl || !wpUser || !wpPass) {
    return NextResponse.json({ error: "WordPress credentials not configured" }, { status: 500 });
  }

  const credentials = Buffer.from(`${wpUser}:${wpPass}`).toString("base64");
  const headers: Record<string, string> = {
    Authorization: `Basic ${credentials}`,
    "Content-Type": "application/json",
  };

  try {
    // Fetch recent published posts (includes X-WP-Total header)
    const res = await fetch(
      `${wpUrl}/wp-json/wp/v2/posts?per_page=6&status=publish&orderby=date&order=desc`,
      { headers, next: { revalidate: 300 } }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `WordPress API error: ${res.status}` },
        { status: res.status }
      );
    }

    const total = parseInt(res.headers.get("X-WP-Total") ?? "0", 10);
    const posts: WPPost[] = await res.json();

    // Also fetch drafts count
    let draftsCount = 0;
    try {
      const draftsRes = await fetch(
        `${wpUrl}/wp-json/wp/v2/posts?per_page=1&status=draft`,
        { headers, next: { revalidate: 300 } }
      );
      if (draftsRes.ok) {
        draftsCount = parseInt(draftsRes.headers.get("X-WP-Total") ?? "0", 10);
      }
    } catch {
      // Non-critical
    }

    const recent = posts.map((p) => ({
      id: p.id,
      title: p.title.rendered,
      date: p.date,
      url: p.link,
      slug: p.slug,
    }));

    const result = {
      total,
      drafts: draftsCount,
      lastPublished: recent[0]?.date ?? null,
      recent,
    };

    cache = { ts: Date.now(), data: result };
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch WordPress stats", detail: String(err) },
      { status: 500 }
    );
  }
}
