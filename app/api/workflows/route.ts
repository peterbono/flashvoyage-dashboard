import { NextResponse } from "next/server";
import { getWorkflowRuns, WorkflowRunSummary } from "@/lib/github";

/**
 * GET /api/workflows
 *
 * Returns the latest run status for ALL known workflows in a single
 * aggregated response.  The dashboard uses this to paint the Command
 * Center overview without making six separate requests.
 */

const WORKFLOWS: { id: string; file: string; label: string; cron?: string; cronDays?: string }[] = [
  // Content pipeline
  { id: "publish-article", file: "publish-article.yml", label: "Publish Article" },
  { id: "content-intelligence", file: "content-intelligence.yml", label: "Content Intelligence", cron: "0 3 * * *" },
  { id: "daily-analytics", file: "daily-analytics.yml", label: "Daily Analytics", cron: "0 4 * * *" },
  // Reels pipeline
  { id: "publish-reels", file: "publish-reels.yml", label: "Publish Reels", cron: "0 5,16 * * *;30 10 * * *" },
  // Social
  { id: "publish-social-posts", file: "publish-social-posts.yml", label: "Social Posts (Tue+Sat)", cron: "0 12 * * 2,6", cronDays: "2,6" },
  // Digest & maintenance
  { id: "daily-digest", file: "daily-digest.yml", label: "Daily Digest", cron: "15 1 * * *" },
  { id: "refresh-articles", file: "refresh-articles.yml", label: "Content Refresh" },
];

export interface WorkflowStatus {
  id: string;
  label: string;
  file: string;
  latestRun: WorkflowRunSummary | null;
  error?: string;
}

export async function GET() {
  const results: WorkflowStatus[] = await Promise.all(
    WORKFLOWS.map(async (wf) => {
      try {
        const runs = await getWorkflowRuns(wf.file, 1);
        return {
          id: wf.id,
          label: wf.label,
          file: wf.file,
          latestRun: runs[0] ?? null,
        };
      } catch (err) {
        return {
          id: wf.id,
          label: wf.label,
          file: wf.file,
          latestRun: null,
          error: String(err),
        };
      }
    })
  );

  return NextResponse.json({
    workflows: results,
    fetchedAt: new Date().toISOString(),
  });
}
