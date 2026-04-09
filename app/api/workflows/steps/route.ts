import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/workflows/steps?runId=12345
 *
 * Returns the jobs and their steps for a specific workflow run.
 * Uses the GitHub Actions API to fetch job details.
 */

const REPO = "peterbono/flashvoyage-ultra-content";
const API_BASE = `https://api.github.com/repos/${REPO}`;

function getToken(): string {
  const token = process.env.GITHUB_TOKEN ?? process.env.GITHUB_PAT ?? "";
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN is not configured. Add it to your Vercel environment variables."
    );
  }
  return token;
}

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

interface GitHubStep {
  name: string;
  status: string;
  conclusion: string | null;
  number: number;
  started_at: string | null;
  completed_at: string | null;
}

interface GitHubJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  steps: GitHubStep[];
}

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("runId");

  if (!runId) {
    return NextResponse.json(
      { error: "Missing required query parameter: runId" },
      { status: 400 }
    );
  }

  try {
    const token = getToken();
    const url = `${API_BASE}/actions/runs/${runId}/jobs`;

    const res = await fetch(url, {
      headers: headers(token),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `GitHub API error: ${res.status} ${res.statusText}` },
        { status: res.status }
      );
    }

    const json = (await res.json()) as { jobs: GitHubJob[] };

    const jobs = json.jobs.map((job) => ({
      id: job.id,
      name: job.name,
      status: job.status,
      conclusion: job.conclusion,
      started_at: job.started_at,
      completed_at: job.completed_at,
      steps: job.steps.map((step) => ({
        name: step.name,
        status: step.status,
        conclusion: step.conclusion,
        number: step.number,
        started_at: step.started_at,
        completed_at: step.completed_at,
      })),
    }));

    return NextResponse.json({ jobs });
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
