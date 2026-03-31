import { NextResponse } from "next/server";
import { fetchContentFile } from "@/lib/github";

interface VizStage {
  agent: string;
  duration_ms: number;
  status: string;
  detail: string;
  score?: number;
}

export interface VizEvent {
  id: string;
  article: string;
  destination: string;
  timestamp: string;
  stages: VizStage[];
}

export async function GET() {
  try {
    const events = await fetchContentFile<VizEvent[]>("data/viz-events.json", {
      cacheTtlMs: 30 * 1000, // 30s — updates during live runs
    });

    return NextResponse.json({
      events,
      total: Array.isArray(events) ? events.length : 0,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[api/github/viz-events]", err);
    return NextResponse.json(
      { events: [], total: 0, error: String(err), fetchedAt: new Date().toISOString() },
      { status: 200 }
    );
  }
}
