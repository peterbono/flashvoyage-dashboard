import { NextRequest, NextResponse } from "next/server";

const WORKFLOW_FILE = "auto-publish.yml";
const REPO = "peterbono/flashvoyage-ultra-content";
const BRANCH = "main";

const DISPATCH_URL = `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`;

interface TriggerBody {
  dryRun?: boolean;
  topic?: string;
}

export async function POST(req: NextRequest) {
  const token = process.env.GITHUB_TOKEN ?? process.env.GITHUB_PAT ?? "";

  if (!token) {
    return NextResponse.json(
      {
        error: "GitHub token required. Add GITHUB_TOKEN to Vercel env.",
        configured: false,
      },
      { status: 503 }
    );
  }

  let body: TriggerBody = {};
  try {
    body = (await req.json()) as TriggerBody;
  } catch {
    // Empty or malformed body is fine — use defaults
  }

  const res = await fetch(DISPATCH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: BRANCH }),
  });

  // GitHub returns 204 No Content on success
  if (res.status === 204) {
    // Best-effort: fetch the latest run id for polling
    const REPO = "peterbono/flashvoyage-ultra-content";
    const BRANCH = "main";
    const RUNS_URL = `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=1&branch=${BRANCH}`;

    let latestRunId: number | null = null;
    let actionsUrl = `https://github.com/${REPO}/actions`;

    try {
      // Small delay so the run registers in the API
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const runsRes = await fetch(RUNS_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
      if (runsRes.ok) {
        const runsData = (await runsRes.json()) as {
          workflow_runs: { id: number; html_url: string }[];
        };
        if (runsData.workflow_runs.length > 0) {
          latestRunId = runsData.workflow_runs[0].id;
          actionsUrl = runsData.workflow_runs[0].html_url;
        }
      }
    } catch {
      // best-effort — not critical
    }

    return NextResponse.json({
      triggered: true,
      configured: true,
      message: "Pipeline launched on GitHub Actions",
      actionsUrl,
      runId: latestRunId,
      topic: body.topic ?? null,
    });
  }

  let errorDetail = `HTTP ${res.status}`;
  try {
    const errBody = (await res.json()) as { message?: string };
    errorDetail = errBody.message ?? errorDetail;
  } catch {
    // ignore parse errors
  }

  console.error("[api/github/trigger]", errorDetail);
  return NextResponse.json(
    { error: errorDetail, configured: true },
    { status: res.status >= 400 ? res.status : 500 }
  );
}
