import { NextRequest, NextResponse } from "next/server";
import { fetchContentFile } from "@/lib/github";

/**
 * GET /api/data/score-timeline?days=14&slugs=slug1,slug2
 *
 * Fetches daily score snapshots from the content repo's data/score-history/
 * directory and returns a per-slug timeline for the requested articles.
 *
 * Each snapshot file is `data/score-history/YYYY-MM-DD.json` containing:
 *   { date, timestamp, scores: Array<{ slug, compositeScore }> }
 *
 * Response shape:
 *   {
 *     dates: ["2026-04-01", "2026-04-02", ...],
 *     timelines: {
 *       "article-slug": [67, 65, 63, null, 60, ...],  // null if missing that day
 *     },
 *     fetchedAt: string
 *   }
 *
 * The endpoint fetches up to `days` files in parallel, tolerating 404s
 * (some days may not have a snapshot if the cron didn't run).
 */

interface ScoreHistoryFile {
  date: string;
  timestamp: string;
  scores: Array<{ slug: string; compositeScore: number }>;
}

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const days = Math.min(
      Math.max(parseInt(params.get("days") ?? "14", 10) || 14, 1),
      90,
    );
    const slugsParam = params.get("slugs");
    const filterSlugs = slugsParam
      ? new Set(
          slugsParam
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        )
      : null; // null = return all slugs

    // Build date list: today minus N days
    const today = new Date();
    const dateStrings: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      dateStrings.push(d.toISOString().slice(0, 10));
    }

    // Fetch all score-history files in parallel, tolerating 404s
    const results = await Promise.allSettled(
      dateStrings.map((date) =>
        fetchContentFile<ScoreHistoryFile>(
          `data/score-history/${date}.json`,
          { cacheTtlMs: 300_000 }, // 5 min cache per file
        ),
      ),
    );

    // Build per-slug timelines
    const timelines: Record<string, (number | null)[]> = {};
    const allSlugs = new Set<string>();

    results.forEach((result, i) => {
      if (result.status !== "fulfilled" || !result.value?.scores) return;
      const file = result.value;
      for (const entry of file.scores) {
        if (filterSlugs && !filterSlugs.has(entry.slug)) continue;
        allSlugs.add(entry.slug);
        if (!timelines[entry.slug]) {
          timelines[entry.slug] = new Array(dateStrings.length).fill(null);
        }
        timelines[entry.slug][i] = entry.compositeScore;
      }
    });

    // Fill missing slugs with null arrays (so the client always gets a
    // consistent shape even for articles that appeared mid-window)
    if (filterSlugs) {
      for (const slug of filterSlugs) {
        if (!timelines[slug]) {
          timelines[slug] = new Array(dateStrings.length).fill(null);
        }
      }
    }

    return NextResponse.json({
      dates: dateStrings,
      timelines,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[api/data/score-timeline]", err);
    return NextResponse.json(
      { error: String(err), fetchedAt: new Date().toISOString() },
      { status: 500 },
    );
  }
}
