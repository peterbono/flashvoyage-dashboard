import { NextRequest, NextResponse } from "next/server";
import { cancelWorkflowRun } from "@/lib/github";

/**
 * POST /api/workflows/cancel
 *
 * Cancel a running workflow run by ID.
 *
 * Body:
 *   { "runId": 12345678 }
 */

interface CancelBody {
  runId: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CancelBody;

    if (!body.runId || typeof body.runId !== "number") {
      return NextResponse.json(
        { error: "Missing or invalid required field: runId (number)" },
        { status: 400 }
      );
    }

    await cancelWorkflowRun(body.runId);

    return NextResponse.json({
      cancelled: true,
      runId: body.runId,
    });
  } catch (err) {
    console.error("[api/workflows/cancel]", err);
    const status = String(err).includes("GITHUB_TOKEN") ? 503 : 500;
    return NextResponse.json({ error: String(err) }, { status });
  }
}
