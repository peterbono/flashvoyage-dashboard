import { NextRequest, NextResponse } from "next/server";
import { triggerWorkflow } from "@/lib/github";

/**
 * POST /api/workflows/dispatch
 *
 * Trigger any workflow by file name with optional inputs.
 *
 * Body:
 *   { "workflow": "auto-publish.yml", "inputs": { "topic": "..." } }
 */

// Only these workflow files may be dispatched from the dashboard.
const ALLOWED_WORKFLOWS = new Set([
  "auto-publish.yml",
  "social-distribute.yml",
  "seo-audit.yml",
  "cost-tracker.yml",
  "quality-check.yml",
  "content-refresh.yml",
  "publish-reels.yml",
  "publish-article.yml",
  "content-intelligence.yml",
  "daily-analytics.yml",
  "refresh-articles.yml",
]);

interface DispatchBody {
  workflow: string;
  inputs?: Record<string, string>;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DispatchBody;

    if (!body.workflow || typeof body.workflow !== "string") {
      return NextResponse.json(
        { error: "Missing required field: workflow" },
        { status: 400 }
      );
    }

    if (!ALLOWED_WORKFLOWS.has(body.workflow)) {
      return NextResponse.json(
        {
          error: `Workflow not allowed: ${body.workflow}`,
          allowed: Array.from(ALLOWED_WORKFLOWS),
        },
        { status: 403 }
      );
    }

    const result = await triggerWorkflow(body.workflow, body.inputs);

    return NextResponse.json({
      triggered: true,
      workflow: body.workflow,
      runId: result.runId,
      url: result.url,
      inputs: body.inputs ?? null,
    });
  } catch (err) {
    console.error("[api/workflows/dispatch]", err);
    const status = String(err).includes("GITHUB_TOKEN") ? 503 : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
