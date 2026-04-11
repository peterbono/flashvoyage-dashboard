import { NextRequest, NextResponse } from "next/server";
import { getWorkflowRuns, type WorkflowRunSummary } from "@/lib/github";

/**
 * GET /api/workflows/runs
 *
 * Aggregates recent runs across a set of workflows in parallel, merges them
 * sorted by created_at desc, returns top N. Powers the Action History view
 * on the content dashboard — "what did I actually dispatch from this UI".
 *
 * Query params:
 *   - workflows: comma-separated list of workflow files to include. Defaults
 *     to the set of user-dispatchable workflows that the dashboard has any
 *     business showing. MUST be a subset of ALLOWED_WORKFLOWS for safety.
 *   - limit: max total runs returned across all workflows. Default 30.
 *   - event: filter by event type ("workflow_dispatch" for manual only,
 *     "schedule" for crons, or empty for all). Default: all events.
 *   - perWorkflow: how many runs to fetch PER workflow before merging.
 *     Default 20. Larger values let us show more manual runs when crons
 *     dominate recent history.
 */

// Only these workflow files may be queried from the dashboard. Keep in sync
// with the allowlist in /api/workflows/dispatch.
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

// The default set when the caller doesn't pass ?workflows= — these are the
// ones the content dashboard actively dispatches via CTAs and are most
// likely to reflect the founder's own "recent actions" activity.
const DEFAULT_WORKFLOWS = [
  "refresh-articles.yml",
  "content-intelligence.yml",
  "daily-analytics.yml",
  "publish-article.yml",
];

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const workflowsParam = params.get("workflows");
    const event = params.get("event") ?? "";
    const limit = Math.min(
      Math.max(parseInt(params.get("limit") ?? "30", 10) || 30, 1),
      100,
    );
    const perWorkflow = Math.min(
      Math.max(parseInt(params.get("perWorkflow") ?? "20", 10) || 20, 1),
      50,
    );

    const requestedWorkflows = workflowsParam
      ? workflowsParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : DEFAULT_WORKFLOWS;

    // Drop anything not in the allowlist — defensive.
    const workflows = requestedWorkflows.filter((w) =>
      ALLOWED_WORKFLOWS.has(w),
    );

    if (workflows.length === 0) {
      return NextResponse.json(
        { error: "No allowed workflows requested" },
        { status: 400 },
      );
    }

    // Fetch in parallel. Individual failures degrade to empty lists rather
    // than tanking the whole response — one broken workflow shouldn't hide
    // the others.
    const results = await Promise.allSettled(
      workflows.map((wf) => getWorkflowRuns(wf, perWorkflow)),
    );

    const allRuns: WorkflowRunSummary[] = [];
    const errors: Array<{ workflow: string; error: string }> = [];

    results.forEach((result, i) => {
      const wf = workflows[i];
      if (result.status === "fulfilled") {
        allRuns.push(...result.value);
      } else {
        errors.push({
          workflow: wf,
          error: String(result.reason),
        });
      }
    });

    // Filter by event if requested
    const filtered = event
      ? allRuns.filter((r) => r.event === event)
      : allRuns;

    // Sort by created_at desc and slice
    filtered.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const truncated = filtered.slice(0, limit);

    return NextResponse.json({
      runs: truncated,
      workflows,
      errors: errors.length > 0 ? errors : undefined,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[api/workflows/runs]", err);
    const status = String(err).includes("GITHUB_TOKEN") ? 503 : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
