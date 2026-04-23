import { NextRequest, NextResponse } from "next/server";
import { fetchContentFile, writeContentFile } from "@/lib/github";
import {
  makeActionId,
  type AmplifierAction,
  type AmplifierQueueFile,
} from "@/lib/amplifier";

/**
 * POST /api/amplifier/dismiss
 *
 * Body: { slug: string, actionId: string, reason?: string }
 *
 * Marks an action as dismissed inside the queue file. Dismissed actions
 * are filtered out by the GET queue route so they don't surface again in
 * the UI. We keep the record in place (rather than delete) so the sibling
 * agent can skip them on regeneration.
 */

interface DismissBody {
  slug?: string;
  actionId?: string;
  reason?: string;
}

function queuePath(slug: string): string {
  return `data/amplifier-queue/${slug}.json`;
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: DismissBody;
  try {
    body = (await req.json()) as DismissBody;
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
    file = await fetchContentFile<AmplifierQueueFile>(path, {
      cacheTtlMs: 0,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Queue not found for slug "${slug}": ${String(err)}` },
      { status: 404 }
    );
  }

  const dismissedAt = new Date().toISOString();
  let matched = false;
  const updated: AmplifierAction[] = (file.actions ?? []).map((a, i) => {
    const id = a.id ?? makeActionId(file.targetSlug, i);
    if (id !== actionId) return a;
    matched = true;
    return {
      ...a,
      id,
      status: "dismissed",
      dismissedAt,
      ...(body.reason ? { dismissReason: body.reason } : {}),
    };
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
    await writeContentFile(path, content, `amplifier: dismiss ${actionId}`);
  } catch (err) {
    console.error("[api/amplifier/dismiss] write failed:", err);
    const msg = String(err);
    const status = msg.includes("GITHUB_TOKEN") ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  return NextResponse.json({
    ok: true,
    slug,
    actionId,
    status: "dismissed",
    dismissedAt,
  });
}
