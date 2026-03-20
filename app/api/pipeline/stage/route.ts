import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

const PRICE_INPUT_PER_TOKEN = 0.80 / 1_000_000;
const PRICE_OUTPUT_PER_TOKEN = 4.00 / 1_000_000;

interface StageContext {
  destination?: string;
  keyword?: string;
  angle?: string;
  language?: string;
  shelf_life?: string;
  brief?: string;
  article?: string;
  qualityScore?: number;
  track?: string;
}

interface StageRequest {
  stageId: string;
  topic: string;
  track: "evergreen" | "news";
  context: StageContext;
}

interface StageResponse {
  status: "success" | "failed";
  logs: string[];
  durationMs: number;
  cost?: number;
  inputTokens?: number;
  outputTokens?: number;
  outputData?: Record<string, unknown>;
}

function ts(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Simulated stages ──────────────────────────────────────────────────────────

async function runSimulatedStage(
  stageId: string,
  topic: string,
  context: StageContext
): Promise<StageResponse> {
  const start = Date.now();

  const simConfigs: Record<string, { delay: number; logsFn: () => string[] }> = {
    "reddit-scrape": {
      delay: 2000,
      logsFn: () => [
        `[${ts()}] Polling r/travel, r/solotravel, r/backpacking, r/digitalnomad`,
        `[${ts()}] Fetching hot posts for topic: "${topic}"`,
        `[${ts()}] Fetched 25 posts, filtering by score > 100`,
        `[${ts()}] Found 12 relevant posts`,
        `[${ts()}] Done. 12 posts queued for extraction.`,
      ],
    },
    "rss-fetch": {
      delay: 1500,
      logsFn: () => [
        `[${ts()}] Polling 6 configured RSS feeds (Lonely Planet, Nomadic Matt, TravelPulse…)`,
        `[${ts()}] Fetched 18 new items since last poll`,
        `[${ts()}] Keyword relevance filter: 7 items pass (> 0.7)`,
        `[${ts()}] Done. 7 items queued.`,
      ],
    },
    "pattern-detect": {
      delay: 1000,
      logsFn: () => [
        `[${ts()}] Clustering topics for destination: ${context.destination ?? "unknown"}`,
        `[${ts()}] Pattern: '${context.keyword ?? topic}' — strong evergreen signal`,
        `[${ts()}] Confidence: 0.91`,
        `[${ts()}] Done.`,
      ],
    },
    "story-compile": {
      delay: 800,
      logsFn: () => [
        `[${ts()}] Compiling brief for: '${context.keyword ?? topic}'`,
        `[${ts()}] Angle: ${context.angle ?? "informational, traveler-focused, 2026"}`,
        `[${ts()}] Outline: 6 H2 sections, 1800w target`,
        `[${ts()}] Brief ready.`,
      ],
    },
    "editorial-ev": {
      delay: 500,
      logsFn: () => [
        `[${ts()}] Template: Travel Guide (${(context.language ?? "en").toUpperCase()})`,
        `[${ts()}] Affiliates: Booking.com + Hostelworld`,
        `[${ts()}] Internal link cluster: ${context.destination ?? "southeast-asia"}`,
        `[${ts()}] Route confirmed.`,
      ],
    },
    "affiliate-inject": {
      delay: 700,
      logsFn: () => [
        `[${ts()}] Scanning article for injection points`,
        `[${ts()}] Injected 4x Booking.com links`,
        `[${ts()}] Injected 2x Hostelworld links`,
        `[${ts()}] CTA block appended`,
      ],
    },
    "seo-optimize": {
      delay: 1000,
      logsFn: () => [
        `[${ts()}] KW density check for '${context.keyword ?? topic}': 1.2% ✓`,
        `[${ts()}] Meta title + description generated`,
        `[${ts()}] 3 internal links added`,
        `[${ts()}] SEO score: 84/100`,
      ],
    },
    "finalize": {
      delay: 500,
      logsFn: () => [
        `[${ts()}] CMS formatting applied`,
        `[${ts()}] Schema: Article + BreadcrumbList`,
        `[${ts()}] Image alt tags generated`,
        `[${ts()}] Ready for quality gate`,
      ],
    },
    "content-router": {
      delay: 200,
      logsFn: () => {
        const shelf = context.shelf_life ?? "long";
        const track = shelf === "short" ? "news" : "evergreen";
        return [
          `[${ts()}] Analyzing shelf life: ${shelf}`,
          `[${ts()}] Route decision: ${track.toUpperCase()}`,
          `[${ts()}] Routing complete.`,
        ];
      },
    },
  };

  const cfg = simConfigs[stageId];
  if (!cfg) {
    return {
      status: "failed",
      logs: [`[${ts()}] Unknown stage: ${stageId}`],
      durationMs: 0,
    };
  }

  await sleep(cfg.delay);
  const durationMs = Date.now() - start;
  const logs = cfg.logsFn();

  let outputData: Record<string, unknown> | undefined;
  if (stageId === "content-router") {
    const shelf = context.shelf_life ?? "long";
    outputData = { track: shelf === "short" ? "news" : "evergreen" };
  }

  return { status: "success", logs, durationMs, outputData };
}

// ── Claude API stages ─────────────────────────────────────────────────────────

async function runExtract(
  topic: string,
  anthropic: Anthropic
): Promise<StageResponse> {
  const start = Date.now();
  const logs: string[] = [`[${ts()}] Starting extraction for topic: "${topic}"`];

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `Extract structured data from this travel topic and return ONLY valid JSON (no markdown):
Topic: "${topic}"

Return JSON with:
- destination (string: country or city)
- keyword (string: primary long-tail SEO keyword)
- angle (string: 1 sentence unique angle)
- language (string: "en", "fr", "es", "de", or "it")
- shelf_life (string: "long" for evergreen content, "short" for time-sensitive/news)`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "{}";
    const clean = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const extracted = JSON.parse(clean) as Record<string, unknown>;

    const inputTokens = message.usage.input_tokens;
    const outputTokens = message.usage.output_tokens;
    const cost = inputTokens * PRICE_INPUT_PER_TOKEN + outputTokens * PRICE_OUTPUT_PER_TOKEN;

    logs.push(`[${ts()}] Extracted: destination=${extracted.destination}, language=${extracted.language}`);
    logs.push(`[${ts()}] Keyword: "${extracted.keyword}"`);
    logs.push(`[${ts()}] Shelf life: ${extracted.shelf_life}`);
    logs.push(`[${ts()}] Tokens: ${inputTokens} in / ${outputTokens} out`);

    return {
      status: "success",
      logs,
      durationMs: Date.now() - start,
      cost,
      inputTokens,
      outputTokens,
      outputData: extracted,
    };
  } catch (err) {
    logs.push(`[${ts()}] ERROR: ${String(err)}`);
    return { status: "failed", logs, durationMs: Date.now() - start };
  }
}

async function runGenerateEv(
  topic: string,
  context: StageContext,
  anthropic: Anthropic
): Promise<StageResponse> {
  const start = Date.now();
  const logs: string[] = [`[${ts()}] Generating evergreen article via claude-haiku`];

  const keyword = context.keyword ?? topic;
  const destination = context.destination ?? "Southeast Asia";
  const angle = context.angle ?? "practical travel guide";
  const language = context.language ?? "en";

  const systemPrompt = language === "fr"
    ? "Tu es un rédacteur SEO pour FlashVoyage, un site de voyage. Génère un article en français."
    : `You are an SEO travel writer for FlashVoyage. Write in ${language}.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [
        {
          role: "user",
          content: `${systemPrompt}

Write a ~900 word evergreen travel article as clean HTML (h1, h2, p tags only).
Topic: ${topic}
Primary keyword: ${keyword}
Destination: ${destination}
Angle: ${angle}

Structure: h1 title, intro paragraph, 4-5 h2 sections with content, brief conclusion.
Use the keyword naturally 2-3 times. Make it helpful, practical, and SEO-friendly.`,
        },
      ],
    });

    const article = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const inputTokens = message.usage.input_tokens;
    const outputTokens = message.usage.output_tokens;
    const cost = inputTokens * PRICE_INPUT_PER_TOKEN + outputTokens * PRICE_OUTPUT_PER_TOKEN;

    const wordCount = article.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    logs.push(`[${ts()}] Article generated: ~${wordCount} words`);
    logs.push(`[${ts()}] Tokens: ${inputTokens} in / ${outputTokens} out`);
    logs.push(`[${ts()}] Cost: $${cost.toFixed(5)}`);

    return {
      status: "success",
      logs,
      durationMs: Date.now() - start,
      cost,
      inputTokens,
      outputTokens,
      outputData: { article },
    };
  } catch (err) {
    logs.push(`[${ts()}] ERROR: ${String(err)}`);
    return { status: "failed", logs, durationMs: Date.now() - start };
  }
}

async function runQuickBrief(
  topic: string,
  context: StageContext,
  anthropic: Anthropic
): Promise<StageResponse> {
  const start = Date.now();
  const logs: string[] = [`[${ts()}] Quick brief generation for news topic: "${topic}"`];

  const keyword = context.keyword ?? topic;
  const destination = context.destination ?? "travel";
  const angle = context.angle ?? "breaking travel news";

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `You are a travel news editor. Generate a rapid editorial brief for a time-sensitive news article. Return ONLY valid JSON (no markdown).

Topic: "${topic}"
Keyword: "${keyword}"
Destination: "${destination}"
Source angle: "${angle}"

Return JSON:
{
  "headline": "punchy news headline (max 70 chars)",
  "hook": "first sentence that grabs the reader (1-2 sentences)",
  "outline": ["section 1 title", "section 2 title", "section 3 title", "section 4 title"],
  "wordTarget": 800,
  "tone": "urgent|informative|analytical"
}`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "{}";
    const clean = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const brief = JSON.parse(clean) as { headline: string; hook: string; outline: string[]; wordTarget: number; tone: string };

    const inputTokens = message.usage.input_tokens;
    const outputTokens = message.usage.output_tokens;
    const cost = inputTokens * PRICE_INPUT_PER_TOKEN + outputTokens * PRICE_OUTPUT_PER_TOKEN;

    logs.push(`[${ts()}] Headline: "${brief.headline}"`);
    logs.push(`[${ts()}] Outline: ${brief.outline.length} sections`);
    logs.push(`[${ts()}] Tone: ${brief.tone} · Target: ${brief.wordTarget}w`);
    logs.push(`[${ts()}] Tokens: ${inputTokens} in / ${outputTokens} out`);

    return {
      status: "success",
      logs,
      durationMs: Date.now() - start,
      cost,
      inputTokens,
      outputTokens,
      outputData: { brief: JSON.stringify(brief), headline: brief.headline },
    };
  } catch (err) {
    logs.push(`[${ts()}] ERROR: ${String(err)}`);
    return { status: "failed", logs, durationMs: Date.now() - start };
  }
}

async function runGenerateNews(
  topic: string,
  context: StageContext,
  anthropic: Anthropic
): Promise<StageResponse> {
  const start = Date.now();
  const logs: string[] = [`[${ts()}] Generating news article via claude-haiku`];

  const keyword = context.keyword ?? topic;
  const destination = context.destination ?? "travel";
  const language = context.language ?? "en";

  // Use brief from quick-brief stage if available
  let briefInstructions = "";
  if (context.brief) {
    try {
      const parsedBrief = JSON.parse(context.brief) as { headline?: string; hook?: string; outline?: string[]; tone?: string };
      briefInstructions = `\nUse this editorial brief:\n- Headline: ${parsedBrief.headline ?? ""}\n- Hook: ${parsedBrief.hook ?? ""}\n- Sections: ${(parsedBrief.outline ?? []).join(", ")}\n- Tone: ${parsedBrief.tone ?? "informative"}`;
    } catch { /* ignore parse error */ }
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: `You are a travel news writer for FlashVoyage. Write in ${language}.

Write a ~600 word breaking travel news article as clean HTML (h1, h2, p tags only).
Topic: ${topic}
Keyword: ${keyword}
Destination: ${destination}${briefInstructions}

Structure: h1 headline, brief news intro, 3-4 h2 sections, quick tips, conclusion.
Make it timely, practical, and engaging. Keep it concise.`,
        },
      ],
    });

    const article = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const inputTokens = message.usage.input_tokens;
    const outputTokens = message.usage.output_tokens;
    const cost = inputTokens * PRICE_INPUT_PER_TOKEN + outputTokens * PRICE_OUTPUT_PER_TOKEN;

    const wordCount = article.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    logs.push(`[${ts()}] News article generated: ~${wordCount} words`);
    logs.push(`[${ts()}] Tokens: ${inputTokens} in / ${outputTokens} out`);

    return {
      status: "success",
      logs,
      durationMs: Date.now() - start,
      cost,
      inputTokens,
      outputTokens,
      outputData: { article },
    };
  } catch (err) {
    logs.push(`[${ts()}] ERROR: ${String(err)}`);
    return { status: "failed", logs, durationMs: Date.now() - start };
  }
}

async function runQualityGate(
  stageId: string,
  context: StageContext,
  anthropic: Anthropic
): Promise<StageResponse> {
  const start = Date.now();
  const isEv = stageId === "quality-gate-ev";
  const threshold = isEv ? 85 : 70;
  const logs: string[] = [`[${ts()}] Running quality gate (threshold: ${threshold}/100)`];

  const article = context.article ?? "";
  if (!article) {
    logs.push(`[${ts()}] ERROR: No article to score`);
    return { status: "failed", logs, durationMs: Date.now() - start };
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `Score this travel article for quality (0-100) and return ONLY valid JSON (no markdown).

Article (first 1500 chars):
${article.slice(0, 1500)}

Return JSON:
{
  "score": number,
  "verdict": "pass" or "fail",
  "issues": ["issue1", "issue2"] (empty array if passing)
}

Scoring criteria: factual accuracy (25), readability (25), SEO structure (25), uniqueness (25).
Verdict is "pass" if score >= ${threshold}, "fail" otherwise.`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "{}";
    const clean = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const result = JSON.parse(clean) as { score: number; verdict: string; issues: string[] };

    const inputTokens = message.usage.input_tokens;
    const outputTokens = message.usage.output_tokens;
    const cost = inputTokens * PRICE_INPUT_PER_TOKEN + outputTokens * PRICE_OUTPUT_PER_TOKEN;

    const passed = result.verdict === "pass";
    logs.push(`[${ts()}] Quality score: ${result.score}/100 ${passed ? "✓" : "✗"} (threshold: ${threshold})`);
    if (result.issues?.length > 0) {
      result.issues.forEach((issue) => logs.push(`[${ts()}] Issue: ${issue}`));
    }
    logs.push(`[${ts()}] GATE ${passed ? "PASSED" : "FAILED"} → ${passed ? "Publish" : "Rejected"}`);

    return {
      status: passed ? "success" : "failed",
      logs,
      durationMs: Date.now() - start,
      cost,
      inputTokens,
      outputTokens,
      outputData: { score: result.score, verdict: result.verdict, issues: result.issues },
    };
  } catch (err) {
    logs.push(`[${ts()}] ERROR: ${String(err)}`);
    return { status: "failed", logs, durationMs: Date.now() - start };
  }
}

async function runPublish(
  topic: string,
  context: StageContext
): Promise<StageResponse> {
  const start = Date.now();
  const logs: string[] = [`[${ts()}] Connecting to WordPress REST API`];

  const wpUrl = process.env.WORDPRESS_URL?.trim().replace(/\/$/, "");
  const wpUser = process.env.WORDPRESS_USERNAME;
  const wpPass = process.env.WORDPRESS_APP_PASSWORD;

  if (!wpUrl || !wpUser || !wpPass) {
    logs.push(`[${ts()}] ERROR: WordPress credentials not configured`);
    return { status: "failed", logs, durationMs: Date.now() - start };
  }

  const article = context.article ?? "";
  if (!article) {
    logs.push(`[${ts()}] ERROR: No article content to publish`);
    return { status: "failed", logs, durationMs: Date.now() - start };
  }

  const credentials = Buffer.from(`${wpUser}:${wpPass}`).toString("base64");

  // Extract plain text excerpt from article HTML
  const plainText = article.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const excerpt = plainText.slice(0, 150) + (plainText.length > 150 ? "…" : "");

  const title = context.keyword ?? topic;

  try {
    logs.push(`[${ts()}] Publishing post: "${title}"`);

    const res = await fetch(`${wpUrl}/wp-json/wp/v2/posts`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        content: article,
        status: "publish",
        excerpt,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      logs.push(`[${ts()}] ERROR: WordPress API returned ${res.status}: ${errText.slice(0, 200)}`);
      return { status: "failed", logs, durationMs: Date.now() - start };
    }

    const post = await res.json() as { id: number; link: string };

    const postId = post.id;
    const postUrl = post.link;
    const editUrl = `${wpUrl}/wp-admin/post.php?post=${postId}&action=edit`;

    logs.push(`[${ts()}] Post published live ✓ (ID: ${postId})`);
    logs.push(`[${ts()}] Public URL: ${postUrl}`);
    logs.push(`[${ts()}] Edit URL: ${editUrl}`);
    logs.push(`[${ts()}] Pipeline complete.`);

    return {
      status: "success",
      logs,
      durationMs: Date.now() - start,
      outputData: { postId, postUrl, editUrl },
    };
  } catch (err) {
    logs.push(`[${ts()}] ERROR: ${String(err)}`);
    return { status: "failed", logs, durationMs: Date.now() - start };
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  let body: StageRequest;
  try {
    body = await request.json() as StageRequest;
  } catch {
    return NextResponse.json({ status: "failed", logs: ["Invalid JSON body"], durationMs: 0 }, { status: 400 });
  }

  const { stageId, topic, context = {} } = body;

  if (!stageId || !topic) {
    return NextResponse.json(
      { status: "failed", logs: ["Missing stageId or topic"], durationMs: 0 },
      { status: 400 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

  let result: StageResponse;

  // Real Claude stages
  if (stageId === "extract") {
    if (!anthropic) {
      result = { status: "failed", logs: ["ANTHROPIC_API_KEY not configured"], durationMs: 0 };
    } else {
      result = await runExtract(topic, anthropic);
    }
  } else if (stageId === "generate-ev") {
    if (!anthropic) {
      result = { status: "failed", logs: ["ANTHROPIC_API_KEY not configured"], durationMs: 0 };
    } else {
      result = await runGenerateEv(topic, context, anthropic);
    }
  } else if (stageId === "quick-brief") {
    if (!anthropic) {
      result = { status: "failed", logs: ["ANTHROPIC_API_KEY not configured"], durationMs: 0 };
    } else {
      result = await runQuickBrief(topic, context, anthropic);
    }
  } else if (stageId === "generate-news") {
    if (!anthropic) {
      result = { status: "failed", logs: ["ANTHROPIC_API_KEY not configured"], durationMs: 0 };
    } else {
      result = await runGenerateNews(topic, context, anthropic);
    }
  } else if (stageId === "quality-gate-ev" || stageId === "quality-gate-news") {
    if (!anthropic) {
      result = { status: "failed", logs: ["ANTHROPIC_API_KEY not configured"], durationMs: 0 };
    } else {
      result = await runQualityGate(stageId, context, anthropic);
    }
  } else if (stageId === "publish") {
    result = await runPublish(topic, context);
  } else {
    // Simulated stages
    result = await runSimulatedStage(stageId, topic, context);
  }

  return NextResponse.json(result as unknown as Record<string, unknown>);
}
