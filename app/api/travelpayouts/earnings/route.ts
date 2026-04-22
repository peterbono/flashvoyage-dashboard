import { NextRequest, NextResponse } from "next/server";
import { getEarningsRollup, invalidateTpCache } from "@/lib/travelpayouts";

/**
 * GET /api/travelpayouts/earnings
 *
 * Returns YTD / MTD / today rollups for Travelpayouts conversions in EUR.
 *
 * Query params:
 *   - `bypass-cache=1` — invalidate the 15 min in-memory cache before fetching.
 *
 * Status codes:
 *   - 200: rollup object (may contain all zeros if the account has no conversions).
 *   - 503: `TRAVELPAYOUTS_API_TOKEN` missing from env — expected locally without .env.
 *   - 502: upstream TP API error (rate-limited, 5xx, etc.).
 *
 * The dashboard is protected at the domain level (Vercel password), so no
 * per-route auth is enforced here. The token itself is never echoed in
 * responses or error messages (redacted by `lib/travelpayouts.ts`).
 */
export async function GET(req: NextRequest) {
  const bypassCache = req.nextUrl.searchParams.get("bypass-cache") === "1";
  if (bypassCache) invalidateTpCache();

  try {
    const rollup = await getEarningsRollup();
    return NextResponse.json(rollup);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Token missing → 503 so the KPI card can render a clean "unavailable"
    // state without flashing a red banner. Dashboards hitting the API
    // without a configured env should see this on first boot only.
    if (message.includes("TRAVELPAYOUTS_API_TOKEN not configured")) {
      return NextResponse.json(
        { error: "TRAVELPAYOUTS_API_TOKEN not configured" },
        { status: 503 }
      );
    }

    // Upstream errors — bucket as 502 to distinguish from our own bugs.
    console.error("[api/travelpayouts/earnings]", message);
    return NextResponse.json(
      { error: message },
      { status: 502 }
    );
  }
}
