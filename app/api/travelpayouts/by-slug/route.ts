import { NextRequest, NextResponse } from "next/server";
import {
  getEarningsBySlug,
  invalidateTpCache,
  type SlugEarnings,
} from "@/lib/travelpayouts";

/**
 * GET /api/travelpayouts/by-slug
 *
 * Returns YTD earnings grouped by WordPress post id (extracted from
 * `sub_id` pattern `{wpId}-{slot}-{variant}`). Entries whose sub_id
 * does not start with a numeric segment land under `_unattributed`.
 *
 * Query params:
 *   - `bypass-cache=1` — invalidate the 15 min in-memory cache.
 *
 * Status codes: same semantics as /api/travelpayouts/earnings.
 */
export async function GET(req: NextRequest) {
  const bypassCache = req.nextUrl.searchParams.get("bypass-cache") === "1";
  if (bypassCache) invalidateTpCache();

  try {
    const bySlug = await getEarningsBySlug();
    const slugs = Object.keys(bySlug);
    const totalRevenue =
      Math.round(
        slugs.reduce((sum, key) => sum + (bySlug[key]?.amount ?? 0), 0) * 100
      ) / 100;

    return NextResponse.json({
      bySlug: bySlug as Record<string, SlugEarnings>,
      totalSlugs: slugs.length,
      totalRevenue,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes("TRAVELPAYOUTS_API_TOKEN not configured")) {
      return NextResponse.json(
        { error: "TRAVELPAYOUTS_API_TOKEN not configured" },
        { status: 503 }
      );
    }

    console.error("[api/travelpayouts/by-slug]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
