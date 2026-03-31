import { NextResponse } from "next/server";
import { getWorkflowRuns } from "@/lib/github";

const WORKFLOW_FILE = "publish-article.yml";

export interface WorkflowRun {
  id: number;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export async function GET() {
  try {
    const runs = await getWorkflowRuns(WORKFLOW_FILE, 1);
    const latest = runs[0] ?? null;

    const run: WorkflowRun | null = latest
      ? {
          id: latest.id,
          status: latest.status,
          conclusion: latest.conclusion,
          created_at: latest.created_at,
          updated_at: latest.updated_at,
          html_url: latest.html_url,
        }
      : null;

    return NextResponse.json({ run, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error("[api/github/run-status]", err);
    return NextResponse.json(
      { run: null, error: String(err), fetchedAt: new Date().toISOString() },
      { status: 200 }
    );
  }
}
