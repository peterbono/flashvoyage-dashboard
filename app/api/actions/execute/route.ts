import { NextRequest, NextResponse } from "next/server";
import { triggerWorkflow } from "@/lib/github";

/**
 * POST /api/actions/execute
 *
 * Manually dispatches the auto-apply runner workflow (`auto-apply.yml`) in
 * the content repo. The workflow itself reads settings.json, iterates over
 * LOW-tier rules (R1, T3, T1), and writes an entry to data/auto-edit-log.jsonl
 * per action.
 *
 * Body (all optional):
 *   { dryRun?: boolean, ruleIds?: string[] }
 *
 * Forwarded as workflow inputs:
 *   dryRun:  "true" | "false" (stringified for workflow_dispatch)
 *   ruleIds: CSV of rule ids (empty string means "all LOW rules")
 */

const AUTO_APPLY_WORKFLOW = "auto-apply.yml";

// Only rules whitelisted in the runner contract (LOW + MED for future). High
// tier rules are rejected here too (defense in depth, mirrors /settings).
const ALLOWED_RULE_IDS = new Set<string>([
  // LOW
  "R1-yyyy-refresh",
  "T3-preemptive-refresh",
  "T1-esim-widget",
  // MED (not yet active; listed so the runner can opt-in when ready)
  "R3-money-table-tldr",
  "R4-inject-widgets",
]);

interface ExecuteBody {
  dryRun?: boolean;
  ruleIds?: string[];
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as ExecuteBody;

    const dryRun = body.dryRun === true;
    const rawRuleIds = Array.isArray(body.ruleIds) ? body.ruleIds : [];
    const invalid = rawRuleIds.filter((id) => !ALLOWED_RULE_IDS.has(id));
    if (invalid.length > 0) {
      return NextResponse.json(
        {
          error: `Rule ids not allowed for auto-apply: ${invalid.join(", ")}`,
          allowed: Array.from(ALLOWED_RULE_IDS),
        },
        { status: 400 },
      );
    }

    const inputs: Record<string, string> = {
      dryRun: dryRun ? "true" : "false",
      ruleIds: rawRuleIds.join(","),
    };

    const result = await triggerWorkflow(AUTO_APPLY_WORKFLOW, inputs);

    return NextResponse.json({
      triggered: true,
      workflow: AUTO_APPLY_WORKFLOW,
      runId: result.runId,
      runUrl: result.url,
      inputs,
    });
  } catch (err) {
    console.error("[api/actions/execute]", err);
    const msg = String(err);
    const status = msg.includes("GITHUB_TOKEN") ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
