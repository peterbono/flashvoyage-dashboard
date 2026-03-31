import { NextRequest, NextResponse } from "next/server";
import { fetchContentFile } from "@/lib/github";

/**
 * Catch-all proxy for data files in the content repo.
 *
 * GET /api/data/cost-history.jsonl  -> fetchContentFile("data/cost-history.jsonl", {parseAs:"jsonl"})
 * GET /api/data/article-scores.json -> fetchContentFile("data/article-scores.json")
 *
 * Only whitelisted paths are served (security).
 */

// Allowed paths relative to the repo root.  The leading "data/" is
// prepended automatically so callers use  /api/data/<filename>.
const ALLOWED_PATHS = new Set([
  "cost-history.jsonl",
  "article-scores.json",
  "content-gaps.json",
  "next-articles-queue.json",
  "seo-scores.json",
  "social-metrics.json",
  "pipeline-stats.json",
  "editorial-calendar.json",
  "competitor-analysis.json",
  "roi-optimized-queue.json",
  "seasonal-forecast.json",
  "lifecycle-states.json",
  "competitor-report.json",
  "auto-executor-log.json",
  "social-distributor/data/reel-history.jsonl",
  "social-distributor/data/tokens.json",
  "social-distributor/reels/data/performance-weights.json",
  "social-distributor/data/ab-tests.json",
]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await params;
    const relativePath = segments.join("/");

    if (!ALLOWED_PATHS.has(relativePath)) {
      return NextResponse.json(
        { error: `Path not allowed: ${relativePath}` },
        { status: 403 }
      );
    }

    // social-distributor paths are already repo-root-relative; others live under data/
    const repoPath = relativePath.startsWith("social-distributor/")
      ? relativePath
      : `data/${relativePath}`;
    const parseAs = relativePath.endsWith(".jsonl") ? "jsonl" : "json";

    const data = await fetchContentFile(repoPath, { parseAs });

    return NextResponse.json({
      data,
      path: repoPath,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[api/data/[...path]]", err);
    return NextResponse.json(
      { error: String(err), fetchedAt: new Date().toISOString() },
      { status: 500 }
    );
  }
}
