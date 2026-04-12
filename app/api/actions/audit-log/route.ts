import { NextRequest, NextResponse } from "next/server";
import { fetchContentFile } from "@/lib/github";

/**
 * GET /api/actions/audit-log
 *
 * Reads `data/auto-edit-log.jsonl` from the content repo, returns entries
 * newest-first with cursor-based pagination.
 *
 * Query params:
 *   limit:   max entries to return (1..200, default 50)
 *   cursor:  line-number offset to start from (0-indexed into the
 *            newest-first ordering). Default 0.
 *
 * Response:
 *   {
 *     entries: [{ ts, articleSlug, articleTitle, articleUrl, ruleId, tier,
 *                 diffSummary, status, reason? }],
 *     nextCursor: number | null
 *   }
 *
 * Tolerates blank lines and malformed JSON (skipped with a console.warn).
 * The runner writes append-only, so we reverse the array once to get
 * newest-first before slicing.
 */

const AUDIT_LOG_PATH = "data/auto-edit-log.jsonl";

type AuditLogTier = "LOW" | "MED" | "MANUAL";
type AuditLogStatus = "success" | "skipped" | "failed";

interface AuditLogEntry {
  ts: string;
  articleSlug: string;
  articleTitle: string;
  articleUrl: string;
  ruleId: string;
  tier: AuditLogTier;
  diffSummary: string;
  status: AuditLogStatus;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function isValidTier(v: unknown): v is AuditLogTier {
  return v === "LOW" || v === "MED" || v === "MANUAL";
}

function isValidStatus(v: unknown): v is AuditLogStatus {
  return v === "success" || v === "skipped" || v === "failed";
}

/**
 * Best-effort coercion of a raw JSONL object into an AuditLogEntry. Returns
 * `null` if the entry is missing required fields — the caller will skip it.
 */
function coerceEntry(raw: unknown): AuditLogEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const ts = typeof r.ts === "string" ? r.ts : undefined;
  const articleSlug =
    typeof r.articleSlug === "string"
      ? r.articleSlug
      : typeof r.slug === "string"
      ? r.slug
      : undefined;
  const articleTitle =
    typeof r.articleTitle === "string"
      ? r.articleTitle
      : typeof r.title === "string"
      ? r.title
      : articleSlug ?? "";
  const articleUrl =
    typeof r.articleUrl === "string"
      ? r.articleUrl
      : typeof r.url === "string"
      ? r.url
      : articleSlug
      ? `https://flashvoyage.com/${articleSlug}/`
      : "";
  const ruleId = typeof r.ruleId === "string" ? r.ruleId : undefined;
  const tier = isValidTier(r.tier) ? r.tier : "MANUAL";
  const diffSummary =
    typeof r.diffSummary === "string" ? r.diffSummary : "";
  const status = isValidStatus(r.status) ? r.status : "success";
  const reason = typeof r.reason === "string" ? r.reason : undefined;

  if (!ts || !articleSlug || !ruleId) return null;

  return {
    ts,
    articleSlug,
    articleTitle,
    articleUrl,
    ruleId,
    tier,
    diffSummary,
    status,
    reason,
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const params = req.nextUrl.searchParams;
    const limit = Math.min(
      Math.max(parseInt(params.get("limit") ?? "50", 10) || 50, 1),
      200,
    );
    const cursor = Math.max(
      parseInt(params.get("cursor") ?? "0", 10) || 0,
      0,
    );

    // Bypass cache — the runner writes to this file frequently and a few
    // seconds of staleness would be visible in the UI as "missing edits".
    let rawLines: unknown[];
    try {
      rawLines = await fetchContentFile<unknown[]>(AUDIT_LOG_PATH, {
        cacheTtlMs: 15_000,
        parseAs: "jsonl",
      });
    } catch (err) {
      const msg = String(err);
      // File doesn't exist yet (runner hasn't produced any edit) — return
      // an empty page rather than a 5xx, so the UI shows the empty state.
      if (msg.includes("404")) {
        return NextResponse.json({ entries: [], nextCursor: null });
      }
      throw err;
    }

    // Coerce + drop malformed entries.
    const coerced: AuditLogEntry[] = [];
    for (let i = 0; i < rawLines.length; i++) {
      const entry = coerceEntry(rawLines[i]);
      if (entry) {
        coerced.push(entry);
      } else {
        console.warn(
          `[api/actions/audit-log] skipping malformed line ${i}`,
        );
      }
    }

    // Newest-first: runner appends, so reverse the array once.
    coerced.reverse();

    const slice = coerced.slice(cursor, cursor + limit);
    const nextCursor =
      cursor + limit < coerced.length ? cursor + limit : null;

    return NextResponse.json({
      entries: slice,
      nextCursor,
    });
  } catch (err) {
    console.error("[api/actions/audit-log]", err);
    const msg = String(err);
    const status = msg.includes("GITHUB_TOKEN") ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
