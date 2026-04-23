import { NextRequest, NextResponse } from "next/server";
import { fetchContentFile, writeContentFile } from "@/lib/github";
import {
  makeActionId,
  type AmplifierAction,
  type AmplifierQueueFile,
} from "@/lib/amplifier";

/**
 * POST /api/amplifier/execute
 *
 * Body: { slug: string, actionId: string, insertionText?: string, proposedAnswer?: string }
 *
 * MVP behavior: flag the action as `flagged_for_execution` inside the queue
 * file so the next run of the content-repo cron (or a future dispatch
 * workflow) picks it up. We intentionally do NOT call Quora directly here —
 * the actual publish lives in the content repo's `quora-local.js`.
 *
 * When `insertionText` / `proposedAnswer` is provided, we overwrite the
 * action's text in-place so Florian's tweak from the "Edit text" dialog
 * becomes the source of truth for the cron runner.
 */

interface ExecuteBody {
  slug?: string;
  actionId?: string;
  insertionText?: string;
  proposedAnswer?: string;
}

function queuePath(slug: string): string {
  return `data/amplifier-queue/${slug}.json`;
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: ExecuteBody;
  try {
    body = (await req.json()) as ExecuteBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const slug = body.slug?.trim();
  const actionId = body.actionId?.trim();
  if (!slug || !actionId) {
    return NextResponse.json(
      { error: "slug and actionId are required" },
      { status: 400 }
    );
  }

  const path = queuePath(slug);

  let file: AmplifierQueueFile;
  try {
    // Bypass cache so we don't flag a stale copy of the queue.
    file = await fetchContentFile<AmplifierQueueFile>(path, {
      cacheTtlMs: 0,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Queue not found for slug "${slug}": ${String(err)}` },
      { status: 404 }
    );
  }

  const flaggedAt = new Date().toISOString();
  let matched = false;
  const updated: AmplifierAction[] = (file.actions ?? []).map((a, i) => {
    const id = a.id ?? makeActionId(file.targetSlug, i);
    if (id !== actionId) return a;
    matched = true;
    const next: AmplifierAction = {
      ...a,
      id,
      status: "flagged_for_execution",
      flaggedAt,
    };
    if (body.insertionText !== undefined && "insertionText" in next) {
      (next as AmplifierAction & { insertionText: string }).insertionText =
        body.insertionText;
    }
    if (body.proposedAnswer !== undefined && "proposedAnswer" in next) {
      (next as AmplifierAction & { proposedAnswer: string }).proposedAnswer =
        body.proposedAnswer;
    }
    return next;
  });

  if (!matched) {
    return NextResponse.json(
      { error: `actionId "${actionId}" not found in queue "${slug}"` },
      { status: 404 }
    );
  }

  const nextFile: AmplifierQueueFile = { ...file, actions: updated };
  const content = `${JSON.stringify(nextFile, null, 2)}\n`;

  try {
    await writeContentFile(
      path,
      content,
      `amplifier: flag ${actionId} for execution`
    );
  } catch (err) {
    console.error("[api/amplifier/execute] write failed:", err);
    const msg = String(err);
    const status = msg.includes("GITHUB_TOKEN") ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  return NextResponse.json({
    ok: true,
    slug,
    actionId,
    status: "flagged_for_execution",
    flaggedAt,
  });
}
