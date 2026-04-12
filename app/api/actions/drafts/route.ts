import { NextResponse } from "next/server";

/**
 * GET /api/actions/drafts
 *
 * Stub for the MEDIUM-tier draft review queue. Day 1 always returns an empty
 * array — the runner doesn't produce drafts yet. The endpoint exists so the
 * DraftsTab can start calling it without a tombstone, and so the future
 * implementation ships behind a stable contract.
 */

export async function GET(): Promise<Response> {
  try {
    // Stub — future impl will read from data/auto-apply/drafts.jsonl. Kept as
    // a try/catch so the contract matches the other action endpoints and any
    // future I/O error surfaces in Vercel logs / Runtime Logs.
    return NextResponse.json({ drafts: [] });
  } catch (err) {
    console.error("[api/actions/drafts]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
