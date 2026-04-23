import { NextRequest, NextResponse } from "next/server";
import {
  fetchContentFile,
  listContentDirectory,
} from "@/lib/github";
import {
  enrichQueue,
  type AmplifierQueue,
  type AmplifierQueueFile,
  type AmplifierQueueResponse,
  type AmplifierSummary,
} from "@/lib/amplifier";

/**
 * GET /api/amplifier/queue
 *
 * Aggregates every queue file under `data/amplifier-queue/*.json` in the
 * content repo into a single response the dashboard can render in one shot.
 *
 * Cache TTL: 2 min (matches the dashboard polling interval).
 *
 * `?demo=1`  — when the real queue is empty, return 2 mock entries flagged
 *              with `demo: true`. Used so Florian can review the UI shell
 *              before the sibling agent starts producing queue files.
 */

const QUEUE_DIR = "data/amplifier-queue";
const CACHE_TTL_MS = 2 * 60 * 1000;

function buildSummary(queues: AmplifierQueue[]): AmplifierSummary {
  const byPlatform: Record<string, number> = {};
  let pendingActions = 0;
  let totalReach = 0;
  for (const q of queues) {
    pendingActions += q.actionCount;
    totalReach += q.totalReach;
    byPlatform[q.platform] = (byPlatform[q.platform] ?? 0) + q.actionCount;
  }
  return { pendingActions, totalReach, byPlatform };
}

function demoQueues(): AmplifierQueue[] {
  const now = new Date().toISOString();
  const files: AmplifierQueueFile[] = [
    {
      generatedAt: now,
      targetSlug: "demo-esim-japon",
      targetUrl: "https://flashvoyage.com/esim-japon/",
      platform: "quora",
      account: "Florian-Gouloubi",
      actions: [
        {
          type: "edit_existing_answer",
          priority: "high",
          answerUrl: "https://www.quora.com/example-answer-1",
          questionTitle: "Quelle eSIM choisir pour un voyage au Japon ?",
          estimatedReachViews: 11000,
          topicRelevanceScore: 8,
          confidenceScore: 0.9,
          insertionText:
            "J'ai publié un comparatif détaillé des eSIM pour le Japon avec les tarifs 2026 et les vitesses réelles mesurées sur place: https://flashvoyage.com/esim-japon/",
          rationale:
            "Answer currently ranks #2 on the question; inserting the link should capture ~15% of existing traffic.",
        },
        {
          type: "answer_new_question",
          priority: "medium",
          questionUrl: "https://www.quora.com/example-question-2",
          questionTitle: "eSIM ou SIM physique au Japon en 2026 ?",
          existingAnswerCount: 14,
          estimatedReachViews: 4200,
          topicRelevanceScore: 7,
          confidenceScore: 0.75,
          proposedAnswer:
            "En 2026, l'eSIM s'impose clairement: activation en 2 min depuis l'aéroport, pas de frais d'itinérance et ~15€ pour 10 jours. La SIM physique reste utile si votre iPhone est verrouillé opérateur. Détails et comparatif: https://flashvoyage.com/esim-japon/",
          rationale:
            "Question has 14 answers but none link to a 2026 comparison — we can take the top slot.",
        },
      ],
    },
    {
      generatedAt: now,
      targetSlug: "demo-visa-thailande",
      targetUrl: "https://flashvoyage.com/visa-thailande/",
      platform: "quora",
      account: "Florian-Gouloubi",
      actions: [
        {
          type: "edit_existing_answer",
          priority: "low",
          answerUrl: "https://www.quora.com/example-answer-3",
          questionTitle:
            "Quelles sont les démarches pour un visa touristique en Thaïlande ?",
          estimatedReachViews: 1800,
          topicRelevanceScore: 6,
          confidenceScore: 0.6,
          insertionText:
            "Mise à jour 2026: l'exemption de visa est désormais de 60 jours. Guide complet des démarches: https://flashvoyage.com/visa-thailande/",
          rationale: "Older answer missing the 2024 policy change.",
        },
      ],
    },
  ];
  return files.map((f) => enrichQueue(f));
}

export async function GET(req: NextRequest): Promise<Response> {
  const demo = req.nextUrl.searchParams.get("demo") === "1";

  try {
    const entries = await listContentDirectory(QUEUE_DIR, {
      cacheTtlMs: CACHE_TTL_MS,
    });
    const jsonFiles = entries.filter(
      (e) => e.type === "file" && e.name.endsWith(".json")
    );

    // Fetch each queue file in parallel. An individual bad file should not
    // take down the whole endpoint — we log and skip.
    const files = await Promise.all(
      jsonFiles.map(async (entry) => {
        try {
          return await fetchContentFile<AmplifierQueueFile>(entry.path, {
            cacheTtlMs: CACHE_TTL_MS,
          });
        } catch (err) {
          console.warn(`[amplifier/queue] skip ${entry.path}:`, err);
          return null;
        }
      })
    );

    const queues = files
      .filter((f): f is AmplifierQueueFile => f !== null)
      .map((f) => enrichQueue(f))
      // Surface queues with most pending impact first.
      .sort((a, b) => b.totalReach - a.totalReach);

    const usingDemo = demo && queues.length === 0;
    const finalQueues = usingDemo ? demoQueues() : queues;

    const payload: AmplifierQueueResponse = {
      queues: finalQueues,
      summary: buildSummary(finalQueues),
      fetchedAt: new Date().toISOString(),
      ...(usingDemo ? { demo: true } : {}),
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[api/amplifier/queue]", err);
    // On catastrophic failure, return an empty shape with a 200 so the UI
    // can render its own "Queue unavailable" state without needing to parse
    // error envelopes. In demo mode we still inject fixtures so the UI
    // shell can be previewed even when GITHUB_TOKEN is unset locally.
    if (demo) {
      const demoQueuesList = demoQueues();
      const payload: AmplifierQueueResponse = {
        queues: demoQueuesList,
        summary: buildSummary(demoQueuesList),
        fetchedAt: new Date().toISOString(),
        demo: true,
      };
      return NextResponse.json(payload);
    }
    const empty: AmplifierQueueResponse = {
      queues: [],
      summary: { pendingActions: 0, totalReach: 0, byPlatform: {} },
      fetchedAt: new Date().toISOString(),
    };
    return NextResponse.json(
      { ...empty, error: String(err) },
      { status: 200 }
    );
  }
}
