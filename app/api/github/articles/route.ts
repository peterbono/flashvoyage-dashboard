import { NextResponse } from "next/server";

const RAW_URL =
  "https://raw.githubusercontent.com/peterbono/flashvoyage-ultra-content/refactor-v2/articles-database.json";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface WPCategory {
  id: number;
  name: string;
  slug: string;
}

interface WPArticle {
  id: number;
  title: string;
  url: string;
  slug: string;
  excerpt: string;
  content: string;
  categories: WPCategory[];
  tags: WPCategory[];
  date: string;
  modified: string;
  featured_image: string | null;
}

export interface Article {
  id: number;
  title: string;
  url: string;
  slug: string;
  excerpt: string;
  categories: WPCategory[];
  tags: WPCategory[];
  date: string;
  modified: string;
  featuredImage: string | null;
  wordCount: number;
}

interface RawDB {
  crawled_at: string;
  total_articles: number;
  articles: WPArticle[];
}

interface CacheEntry {
  data: { articles: Article[]; fetchedAt: string; total: number };
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

    const db = (await res.json()) as RawDB;

    const articles: Article[] = db.articles.map((a) => ({
      id: a.id,
      title: a.title,
      url: a.url,
      slug: a.slug,
      excerpt: a.excerpt,
      categories: a.categories,
      tags: a.tags,
      date: a.date,
      modified: a.modified,
      featuredImage: a.featured_image ?? null,
      wordCount: a.content.trim().split(/\s+/).length,
    }));

    const payload = {
      articles,
      fetchedAt: new Date().toISOString(),
      total: articles.length,
    };

    cache = { data: payload, expiry: now + CACHE_TTL_MS };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[api/github/articles]", err);
    return NextResponse.json(
      { articles: [], error: String(err), fetchedAt: new Date().toISOString(), total: 0 },
      { status: 200 }
    );
  }
}
