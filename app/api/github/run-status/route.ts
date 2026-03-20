import { NextResponse } from "next/server";

const WORKFLOW_FILE = "auto-publish.yml";
const REPO = "peterbono/flashvoyage-ultra-content";
const BRANCH = "refactor-v2";

const RUNS_URL = `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=1&branch=${BRANCH}`;

const CACHE_TTL_MS = 15 * 1000; // 15 seconds

export interface WorkflowRun {
  id: number;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
}

interface CacheEntry {
  data: { run: WorkflowRun | null; fetchedAt: string; error?: string };
  expiry: number;
}

let cache: CacheEntry | null = null;

export async function GET() {
  const token = process.env.GITHUB_TOKEN ?? process.env.GITHUB_PAT ?? "";

  if (!token) {
    return NextResponse.json({
      run: null,
      error: "GITHUB_TOKEN not configured",
      fetchedAt: new Date().toISOString(),
    });
  }

  const now = Date.now();
  if (cache && now < cache.expiry) {
    return NextResponse.json(cache.data);
  }

  try {
    const res = await fetch(RUNS_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as {
      workflow_runs: Array<{
        id: number;
        status: string;
        conclusion: string | null;
        created_at: string;
        updated_at: string;
        html_url: string;
      }>;
    };

    const latest = json.workflow_runs[0] ?? null;

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

    const payload = { run, fetchedAt: new Date().toISOString() };
    cache = { data: payload, expiry: now + CACHE_TTL_MS };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[api/github/run-status]", err);
    return NextResponse.json(
      { run: null, error: String(err), fetchedAt: new Date().toISOString() },
      { status: 200 }
    );
  }
}
