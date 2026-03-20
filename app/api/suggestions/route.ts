import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30;

// Simple in-memory cache — survives across warm invocations (1h TTL)
let cache: { ts: number; data: unknown } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1h

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Haiku 4.5 pricing
const PRICE_INPUT_PER_TOKEN = 0.80 / 1_000_000;
const PRICE_OUTPUT_PER_TOKEN = 4.00 / 1_000_000;

export interface CallCost {
  inputTokens: number;
  outputTokens: number;
  totalUsd: number;
}

export interface ArticleSuggestion {
  title: string;
  keyword: string;
  destination: string;
  angle: string;
  sourceHeadline: string;
  sourceUrl: string;
  trendScore: number;
}

// Curated SE Asia travel headlines — real topics, updated periodically.
// Google News RSS hangs from Vercel (TLS-level issue), so we use these static
// seeds and let Claude generate fresh content ideas from them each hour.
const SEED_HEADLINES = [
  { title: "Thailand Tourism Record: 40M Visitors Expected in 2026", link: "https://www.bangkokpost.com/thailand/general" },
  { title: "Best Digital Nomad Destinations in Southeast Asia 2026", link: "https://www.nomadicmatt.com/travel-guides/southeast-asia/" },
  { title: "Vietnam Extends Visa-Free Access to 30 More Countries", link: "https://vietnamtourism.com/news" },
  { title: "Bali vs Chiang Mai: Remote Work Living Cost Comparison", link: "https://www.theguardian.com/travel/southeast-asia" },
  { title: "Philippines Opens New Eco-Tourism Island Circuits", link: "https://www.rappler.com/travel" },
  { title: "Solo Female Travel Safety Guide: Southeast Asia 2026", link: "https://www.lonelyplanet.com/southeast-asia" },
  { title: "Hidden Temples in Northern Thailand Most Tourists Skip", link: "https://www.roughguides.com/thailand" },
  { title: "Cambodia Beyond Angkor: Underrated Destinations to Visit", link: "https://www.cambodiapocketguide.com" },
  { title: "Budget Travel Southeast Asia: $50/Day Full Itinerary", link: "https://www.budgetyourtrip.com/southeast-asia" },
  { title: "Malaysia Digital Nomad Visa: Full Application Guide 2026", link: "https://www.malaysia.travel/en-my" },
];

export async function GET() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  // Return cached response if still fresh
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json({ ...cache.data as object, callCost: null });
  }

  const headlineList = SEED_HEADLINES
    .map((it, i) => `${i + 1}. ${it.title} | URL: ${it.link}`)
    .join("\n");

  let suggestions: ArticleSuggestion[] = [];
  let callCost: CallCost | null = null;
  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `SE Asia travel SEO strategist. From these headlines pick 5 article ideas.

Return a JSON array of exactly 5 objects using EXACTLY these field names (no others):
- "title": SEO article title (max 8 words)
- "keyword": one long-tail keyword phrase
- "destination": country or city name only
- "angle": one short sentence on what makes it unique
- "sourceHeadline": copy the exact headline text from the list
- "sourceUrl": copy the exact URL from the list (after the | URL: part)
- "trendScore": integer 1-10

No markdown, no explanation, output only the array.

Headlines:
${headlineList}`,
        },
        {
          // Prefill forces JSON array output — Anthropic strips this from response
          role: "assistant",
          content: '[{"title":',
        },
      ],
    });

    if (message.stop_reason === "max_tokens") {
      return NextResponse.json(
        { error: "Claude output truncated", detail: "stop_reason: max_tokens" },
        { status: 500 }
      );
    }

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    // Prepend the prefill that Anthropic strips from the response
    const full = '[{"title":' + text;
    let clean = full.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const arrStart = clean.indexOf("[");
    const arrEnd = clean.lastIndexOf("]");
    if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
      clean = clean.slice(arrStart, arrEnd + 1);
    }
    suggestions = JSON.parse(clean);
    callCost = {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      totalUsd:
        message.usage.input_tokens * PRICE_INPUT_PER_TOKEN +
        message.usage.output_tokens * PRICE_OUTPUT_PER_TOKEN,
    };
  } catch (e) {
    return NextResponse.json(
      { error: "Claude parse error", detail: String(e) },
      { status: 500 }
    );
  }

  // Match suggestion back to its seed URL
  const enriched = suggestions.map((s) => {
    let sourceUrl = s.sourceUrl ?? "";
    if (!sourceUrl) {
      const headline = (s.sourceHeadline ?? "").toLowerCase();
      const matched = SEED_HEADLINES.find((item) => {
        const words = item.title.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
        return words.some((w) => headline.includes(w));
      });
      sourceUrl = matched?.link ?? "";
    }
    return { ...s, sourceUrl };
  });

  const result = { source: "curated", suggestions: enriched };
  cache = { ts: Date.now(), data: result };
  return NextResponse.json({ ...result, callCost });
}
