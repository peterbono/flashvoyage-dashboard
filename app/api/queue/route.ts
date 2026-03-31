import { NextRequest, NextResponse } from "next/server";
import { fetchContentFile, writeContentFile } from "@/lib/github";

/**
 * /api/queue
 *
 * GET  — Read the current article suggestion queue.
 * POST — Append a new article suggestion to the queue.
 *
 * The queue lives at  data/next-articles-queue.json  in the content repo.
 */

const QUEUE_PATH = "data/next-articles-queue.json";

export interface QueueItem {
  id: string;
  title: string;
  topic: string;
  keywords?: string[];
  priority?: "low" | "medium" | "high" | "urgent";
  notes?: string;
  addedAt: string;
  addedBy: string;
}

interface QueueFile {
  queue: QueueItem[];
  updatedAt: string;
}

// ---- GET ----------------------------------------------------------------

export async function GET() {
  try {
    const data = await fetchContentFile<QueueFile>(QUEUE_PATH, {
      cacheTtlMs: 60_000, // 1 min cache for the queue
    });

    return NextResponse.json({
      ...data,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    // If the file doesn't exist yet, return an empty queue
    if (String(err).includes("404")) {
      return NextResponse.json({
        queue: [],
        updatedAt: null,
        fetchedAt: new Date().toISOString(),
      });
    }

    console.error("[api/queue] GET", err);
    return NextResponse.json(
      { error: String(err), fetchedAt: new Date().toISOString() },
      { status: 500 }
    );
  }
}

// ---- POST ---------------------------------------------------------------

interface AddBody {
  title: string;
  topic: string;
  keywords?: string[];
  priority?: "low" | "medium" | "high" | "urgent";
  notes?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AddBody;

    if (!body.title || !body.topic) {
      return NextResponse.json(
        { error: "Missing required fields: title, topic" },
        { status: 400 }
      );
    }

    // Read the current queue (or start with an empty one)
    let current: QueueFile;
    try {
      current = await fetchContentFile<QueueFile>(QUEUE_PATH, {
        cacheTtlMs: 0, // bypass cache for write operations
      });
    } catch {
      current = { queue: [], updatedAt: new Date().toISOString() };
    }

    const newItem: QueueItem = {
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: body.title,
      topic: body.topic,
      keywords: body.keywords,
      priority: body.priority ?? "medium",
      notes: body.notes,
      addedAt: new Date().toISOString(),
      addedBy: "dashboard",
    };

    current.queue.push(newItem);
    current.updatedAt = new Date().toISOString();

    await writeContentFile(
      QUEUE_PATH,
      JSON.stringify(current, null, 2),
      `[dashboard] Add article suggestion: ${body.title}`
    );

    return NextResponse.json({
      added: true,
      item: newItem,
      queueLength: current.queue.length,
    });
  } catch (err) {
    console.error("[api/queue] POST", err);
    const status = String(err).includes("GITHUB_TOKEN") ? 503 : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
