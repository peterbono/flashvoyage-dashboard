/**
 * Unified GitHub API client for the FlashVoyage content repo.
 *
 * Centralises auth, caching, and common operations so that API routes
 * stay thin.  The in-memory cache survives across warm Vercel invocations.
 */

const REPO = "peterbono/flashvoyage-ultra-content";
const BRANCH = "main";
const API_BASE = `https://api.github.com/repos/${REPO}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// In-memory cache (survives across warm Vercel invocations)
// ---------------------------------------------------------------------------

const cache = new Map<string, { data: unknown; expiry: number }>();

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cacheGet<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

function cacheSet(key: string, data: unknown, ttlMs: number): void {
  cache.set(key, { data, expiry: Date.now() + ttlMs });
}

function cacheInvalidate(key: string): void {
  cache.delete(key);
}

// ---------------------------------------------------------------------------
// fetchContentFile  –  read a file from the content repo
// ---------------------------------------------------------------------------

export interface FetchContentOpts {
  /** Cache time-to-live in ms. Default: 5 min. Pass 0 to bypass cache. */
  cacheTtlMs?: number;
  /** How to parse the response body. Default: "json". */
  parseAs?: "json" | "jsonl";
}

/**
 * Fetch a file from the content repo via the GitHub raw endpoint.
 *
 * Supports JSON and JSONL (newline-delimited JSON).  Results are cached
 * in memory with a configurable TTL.
 */
export async function fetchContentFile<T = unknown>(
  path: string,
  opts?: FetchContentOpts
): Promise<T> {
  const ttl = opts?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const parseAs = opts?.parseAs ?? "json";
  const cacheKey = `content:${path}:${parseAs}`;

  if (ttl > 0) {
    const cached = cacheGet<T>(cacheKey);
    if (cached !== undefined) return cached;
  }

  const rawUrl = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${path}`;
  const res = await fetch(rawUrl, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(
      `GitHub raw fetch failed for "${path}": ${res.status} ${res.statusText}`
    );
  }

  const text = await res.text();

  let data: unknown;
  if (parseAs === "jsonl") {
    data = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line));
  } else {
    data = JSON.parse(text);
  }

  if (ttl > 0) {
    cacheSet(cacheKey, data, ttl);
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// Workflow helpers
// ---------------------------------------------------------------------------

export interface WorkflowRunSummary {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  run_number: number;
  head_branch: string;
  /** "workflow_dispatch" for manual runs, "schedule" for crons, etc. */
  event?: string;
  /** ISO timestamp when the run actually started executing (vs created_at = queued). */
  run_started_at?: string;
  /** Workflow file name (e.g. "refresh-articles.yml") — useful when merging runs across workflows. */
  workflow_file?: string;
}

/**
 * Get recent runs for a given workflow file (e.g. "auto-publish.yml").
 */
export async function getWorkflowRuns(
  workflowFile: string,
  perPage = 5
): Promise<WorkflowRunSummary[]> {
  const token = getToken();
  const url = `${API_BASE}/actions/workflows/${workflowFile}/runs?per_page=${perPage}&branch=${BRANCH}`;

  const res = await fetch(url, { headers: headers(token), cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `GitHub API error fetching runs for "${workflowFile}": ${res.status} ${res.statusText}`
    );
  }

  const json = (await res.json()) as {
    workflow_runs: WorkflowRunSummary[];
  };

  return json.workflow_runs.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    conclusion: r.conclusion,
    created_at: r.created_at,
    updated_at: r.updated_at,
    html_url: r.html_url,
    run_number: r.run_number,
    head_branch: r.head_branch,
    event: r.event,
    run_started_at: r.run_started_at,
    workflow_file: workflowFile,
  }));
}

/**
 * Trigger a workflow via `workflow_dispatch`.
 *
 * Returns the run ID of the newly created run (best-effort: we wait 2 s
 * for the run to register) and a link to the Actions page.
 */
export async function triggerWorkflow(
  workflowFile: string,
  inputs?: Record<string, string>
): Promise<{ runId: number | null; url: string }> {
  const token = getToken();
  const dispatchUrl = `${API_BASE}/actions/workflows/${workflowFile}/dispatches`;

  const body: Record<string, unknown> = { ref: BRANCH };
  if (inputs && Object.keys(inputs).length > 0) {
    body.inputs = inputs;
  }

  const res = await fetch(dispatchUrl, {
    method: "POST",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status !== 204) {
    let detail = `HTTP ${res.status}`;
    try {
      const errBody = (await res.json()) as { message?: string };
      detail = errBody.message ?? detail;
    } catch {
      // ignore parse errors
    }
    throw new Error(`Failed to dispatch "${workflowFile}": ${detail}`);
  }

  // Wait briefly for the run to register in the API
  await new Promise((resolve) => setTimeout(resolve, 2000));

  let runId: number | null = null;
  let url = `https://github.com/${REPO}/actions`;

  try {
    const runs = await getWorkflowRuns(workflowFile, 1);
    if (runs.length > 0) {
      runId = runs[0].id;
      url = runs[0].html_url;
    }
  } catch {
    // best-effort
  }

  return { runId, url };
}

/**
 * Cancel a running workflow run.
 */
export async function cancelWorkflowRun(runId: number): Promise<void> {
  const token = getToken();
  const url = `${API_BASE}/actions/runs/${runId}/cancel`;

  const res = await fetch(url, {
    method: "POST",
    headers: headers(token),
  });

  // 202 = accepted, 409 = already completed (both acceptable)
  if (res.status !== 202 && res.status !== 409) {
    throw new Error(
      `Failed to cancel run ${runId}: ${res.status} ${res.statusText}`
    );
  }
}

// ---------------------------------------------------------------------------
// writeContentFile  –  create or update a file in the content repo
// ---------------------------------------------------------------------------

/**
 * Create or update a file via the GitHub Contents API.
 *
 * If the file already exists, the current SHA is fetched first so the
 * update succeeds.  The in-memory cache for that path is invalidated
 * after a successful write.
 */
export async function writeContentFile(
  path: string,
  content: string,
  message: string
): Promise<void> {
  const token = getToken();
  const url = `${API_BASE}/contents/${path}`;

  // Try to get the current SHA (needed for updates)
  let sha: string | undefined;
  try {
    const existing = await fetch(url, {
      headers: headers(token),
      cache: "no-store",
    });
    if (existing.ok) {
      const json = (await existing.json()) as { sha: string };
      sha = json.sha;
    }
  } catch {
    // File does not exist yet — that's fine, we'll create it
  }

  const body: Record<string, string> = {
    message,
    content: Buffer.from(content, "utf-8").toString("base64"),
    branch: BRANCH,
  };
  if (sha) {
    body.sha = sha;
  }

  const res = await fetch(url, {
    method: "PUT",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errBody = (await res.json()) as { message?: string };
      detail = errBody.message ?? detail;
    } catch {
      // ignore
    }
    throw new Error(`Failed to write "${path}": ${detail}`);
  }

  // Invalidate any cached version of this file
  for (const key of cache.keys()) {
    if (key.startsWith(`content:${path}`)) {
      cacheInvalidate(key);
    }
  }
}
