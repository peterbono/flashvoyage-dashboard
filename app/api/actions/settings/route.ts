import { NextRequest, NextResponse } from "next/server";
import { fetchContentFile, writeContentFile } from "@/lib/github";

/**
 * GET/PUT /api/actions/settings
 *
 * Proxies `data/auto-apply/settings.json` in the content repo. This file is
 * the source of truth for the runner (GitHub Actions workflow in the content
 * repo) — the dashboard only reads/writes it.
 *
 * Shape on disk:
 *   {
 *     "master": boolean,
 *     "low": boolean,
 *     "medium": boolean,
 *     "high": boolean,
 *     "dailyCap": number
 *   }
 *
 * Day-1 defense in depth: the dashboard can only flip `master`, `low`, and
 * `dailyCap`. Attempting to set `medium: true` or `high: true` from the UI
 * returns 400 — the runner contract forbids those tiers until the review
 * workflow ships (MED) or forever (HIGH, SEO Guru veto).
 */

const SETTINGS_PATH = "data/auto-apply/settings.json";

interface SettingsShape {
  master: boolean;
  low: boolean;
  medium: boolean;
  high: boolean;
  dailyCap: number;
}

const DEFAULT_SETTINGS: SettingsShape = {
  master: false,
  low: true,
  medium: false,
  high: false,
  dailyCap: 5,
};

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(): Promise<Response> {
  try {
    // Bypass in-memory cache so the UI always reflects the latest commit —
    // toggle latency matters more than GitHub rate-limiting here.
    const json = await fetchContentFile<Partial<SettingsShape>>(SETTINGS_PATH, {
      cacheTtlMs: 0,
    });
    const merged: SettingsShape = {
      master: typeof json.master === "boolean" ? json.master : DEFAULT_SETTINGS.master,
      low: typeof json.low === "boolean" ? json.low : DEFAULT_SETTINGS.low,
      medium:
        typeof json.medium === "boolean" ? json.medium : DEFAULT_SETTINGS.medium,
      high: typeof json.high === "boolean" ? json.high : DEFAULT_SETTINGS.high,
      dailyCap:
        typeof json.dailyCap === "number" && Number.isFinite(json.dailyCap)
          ? Math.min(Math.max(Math.trunc(json.dailyCap), 1), 10)
          : DEFAULT_SETTINGS.dailyCap,
    };
    return NextResponse.json(merged);
  } catch (err) {
    const msg = String(err);
    // The file might not exist yet — that's fine, return defaults. The
    // raw-content endpoint returns 404 in that case.
    if (msg.includes("404")) {
      return NextResponse.json(DEFAULT_SETTINGS);
    }
    console.error("[api/actions/settings/GET]", err);
    const status = msg.includes("GITHUB_TOKEN") ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

// ---------------------------------------------------------------------------
// PUT
// ---------------------------------------------------------------------------

interface PutBody {
  master?: unknown;
  low?: unknown;
  medium?: unknown;
  high?: unknown;
  dailyCap?: unknown;
}

export async function PUT(req: NextRequest): Promise<Response> {
  try {
    const body = (await req.json()) as PutBody;

    // Defense in depth: refuse to flip medium/high from the UI. The runner
    // contract owns those tiers; the dashboard is read-only on them.
    if (body.medium === true) {
      return NextResponse.json(
        {
          error:
            "MEDIUM tier cannot be enabled from the UI — review workflow not wired yet.",
        },
        { status: 400 },
      );
    }
    if (body.high === true) {
      return NextResponse.json(
        {
          error:
            "HIGH tier is locked — SEO Guru flagged R5/T4/R2 as too risky to auto-apply.",
        },
        { status: 400 },
      );
    }

    // Read current state (if any) so we preserve medium/high as-is.
    let current: SettingsShape = { ...DEFAULT_SETTINGS };
    try {
      const json = await fetchContentFile<Partial<SettingsShape>>(
        SETTINGS_PATH,
        { cacheTtlMs: 0 },
      );
      current = {
        master:
          typeof json.master === "boolean" ? json.master : current.master,
        low: typeof json.low === "boolean" ? json.low : current.low,
        medium:
          typeof json.medium === "boolean" ? json.medium : current.medium,
        high: typeof json.high === "boolean" ? json.high : current.high,
        dailyCap:
          typeof json.dailyCap === "number" && Number.isFinite(json.dailyCap)
            ? Math.min(Math.max(Math.trunc(json.dailyCap), 1), 10)
            : current.dailyCap,
      };
    } catch (err) {
      const msg = String(err);
      if (!msg.includes("404")) throw err;
      // File missing — fall through with defaults.
    }

    const next: SettingsShape = {
      ...current,
      master: typeof body.master === "boolean" ? body.master : current.master,
      low: typeof body.low === "boolean" ? body.low : current.low,
      // medium/high preserved from disk — UI can't touch them.
      dailyCap:
        typeof body.dailyCap === "number" && Number.isFinite(body.dailyCap)
          ? Math.min(Math.max(Math.trunc(body.dailyCap), 1), 10)
          : current.dailyCap,
    };

    const payload = JSON.stringify(next, null, 2) + "\n";
    await writeContentFile(
      SETTINGS_PATH,
      payload,
      "chore(auto-apply): update settings",
    );

    return NextResponse.json(next);
  } catch (err) {
    console.error("[api/actions/settings/PUT]", err);
    const msg = String(err);
    const status = msg.includes("GITHUB_TOKEN") ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
