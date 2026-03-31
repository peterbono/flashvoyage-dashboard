import { NextRequest, NextResponse } from "next/server";
import { triggerWorkflow } from "@/lib/github";

const WORKFLOW_FILE = "publish-article.yml";

interface TriggerBody {
  dryRun?: boolean;
  topic?: string;
}

export async function POST(req: NextRequest) {
  let body: TriggerBody = {};
  try {
    body = (await req.json()) as TriggerBody;
  } catch {
    // Empty or malformed body is fine — use defaults
  }

  try {
    const inputs: Record<string, string> = {};
    if (body.dryRun) inputs.dry_run = "1";

    const { runId, url } = await triggerWorkflow(WORKFLOW_FILE, inputs);

    return NextResponse.json({
      triggered: true,
      configured: true,
      message: "Pipeline launched on GitHub Actions",
      actionsUrl: url,
      runId,
      topic: body.topic ?? null,
    });
  } catch (err) {
    const errMsg = String(err);
    console.error("[api/github/trigger]", errMsg);

    // Distinguish config errors from runtime errors
    if (errMsg.includes("GITHUB_TOKEN is not configured")) {
      return NextResponse.json(
        { error: "GitHub token required. Add GITHUB_TOKEN to Vercel env.", configured: false },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: errMsg, configured: true },
      { status: 500 }
    );
  }
}
