// Real viz-bridge stage definitions matching peterbono/flashvoyage-ultra-content refactor-v2
// Agent names: scout → extractor → generator → finalizer → post-processing → marie → publisher
// Source: data/viz-events.json

export type StageStatus = "idle" | "running" | "success" | "failed" | "skipped";
export type NodeVariant = "source" | "stage" | "publish";
export type PipelineTrack = "shared";

export interface RealPipelineStageData {
  id: string;
  name: string;
  description: string;
  status: StageStatus;
  durationMs?: number;
  cost?: number;
  qualityScore?: number;
  logs: string[];
  icon: string;
  color: string;
  variant?: NodeVariant;
  dimmed?: boolean;
  outputData?: Record<string, unknown>;
  // Viz-bridge detail string (from stages[].detail)
  detail?: string;
}

// ── Real viz-bridge stage sequence ───────────────────────────────────────────
// Layout: left-to-right linear. X spacing = 260px per stage.
// Input column at x=0, scout at x=260, then +260 each stage.

export const REAL_PIPELINE_NODES: RealPipelineStageData[] = [
  // ── INPUT SOURCES (feed into scout) ──────────────────────────────────────
  {
    id: "reddit-input",
    name: "Reddit",
    description:
      "Reddit scraping — r/travel, r/solotravel, r/backpacking. Trending posts with high engagement are fed to the Scout agent for source selection.",
    status: "idle",
    durationMs: 0,
    logs: [],
    icon: "Hash",
    color: "text-orange-400",
    variant: "source",
  },
  {
    id: "rss-input",
    name: "RSS",
    description:
      "RSS feed aggregator — Lonely Planet, Nomadic Matt, TravelPulse. New items are polled every 30 min and passed to Scout for curation.",
    status: "idle",
    durationMs: 0,
    logs: [],
    icon: "Rss",
    color: "text-blue-400",
    variant: "source",
  },
  {
    id: "manual-input",
    name: "Manual",
    description:
      "Operator-queued topics — typed via dashboard or synced from Notion editorial calendar. Bypasses source discovery entirely.",
    status: "idle",
    durationMs: 0,
    logs: [],
    icon: "PenLine",
    color: "text-zinc-400",
    variant: "source",
  },

  // ── VIZ-BRIDGE STAGES (linear) ────────────────────────────────────────────
  {
    id: "scout",
    name: "Scout",
    description:
      "Reddit/RSS scraping + source selection. Crawls configured sources, scores relevance, and selects the best topic from the editorial calendar for this run.",
    status: "idle",
    durationMs: 0,
    logs: [],
    icon: "Search",
    color: "text-amber-400",
  },
  {
    id: "extractor",
    name: "Extractor",
    description:
      "Semantic extraction + pattern detection. Extracts destination, angle, keyword, language, shelf-life from the raw source. Uses Claude Haiku for speed.",
    status: "idle",
    durationMs: 0,
    logs: [],
    icon: "Database",
    color: "text-indigo-400",
  },
  {
    id: "generator",
    name: "Generator",
    description:
      "LLM article generation — Claude Haiku 4.5 or GPT-4o. Full article generation: intro, H2 sections, FAQ, conclusion. Target 1800w for evergreen topics.",
    status: "idle",
    durationMs: 0,
    logs: [],
    icon: "Sparkles",
    color: "text-violet-400",
  },
  {
    id: "finalizer",
    name: "Finalizer",
    description:
      "Article finalization — 20+ editorial passes. Applies structural fixes, tone adjustments, deduplication checks, and CMS-ready HTML export.",
    status: "idle",
    durationMs: 0,
    logs: [],
    icon: "FileCheck",
    color: "text-teal-400",
  },
  {
    id: "post-processing",
    name: "Post-Processing",
    description:
      "Text fixers + affiliate injection + SEO. Runs post-processing fixers: affiliate link injection, SEO meta generation, schema markup, internal linking.",
    status: "idle",
    durationMs: 0,
    logs: [],
    icon: "Wrench",
    color: "text-orange-400",
  },
  {
    id: "marie",
    name: "MARIE Review",
    description:
      "MARIE quality panel — 5 expert agents + CEO validator. Multi-agent review: style, factuality, SEO, affiliate compliance, and final score. Threshold: 80/100.",
    status: "idle",
    durationMs: 0,
    logs: [],
    icon: "ShieldCheck",
    color: "text-rose-400",
  },
  {
    id: "publisher",
    name: "Publisher",
    description:
      "WordPress publish + production validation. Publishes to WordPress via REST API. Validates post ID, sends Slack notification, and logs the final production URL.",
    status: "idle",
    durationMs: 0,
    logs: [],
    icon: "Globe",
    color: "text-emerald-400",
    variant: "publish",
  },

  // ── REEL PIPELINE (separate row) ──────────────────────────────────────────
  {
    id: "reel-scheduler",
    name: "Smart Scheduler",
    description:
      "Selects the next reel series + destination based on the content calendar rotation. Picks from Trip Pick, Budget Jour, Avant/Apres, Versus, Humor.",
    status: "idle",
    durationMs: 0,
    logs: [],
    icon: "TrendingUp",
    color: "text-fuchsia-400",
  },
  {
    id: "reel-generator",
    name: "Reel Generator",
    description:
      "Generates reel content: script, overlay text, music selection, visual scenes. Uses Haiku for speed. Outputs a structured JSON reel spec.",
    status: "idle",
    durationMs: 0,
    logs: [],
    icon: "Sparkles",
    color: "text-fuchsia-400",
  },
  {
    id: "reel-publisher",
    name: "IG Publisher",
    description:
      "Publishes the reel to Instagram via the Graph API. Uploads media container, waits for processing, then publishes. Returns media ID and permalink.",
    status: "idle",
    durationMs: 0,
    logs: [],
    icon: "Globe",
    color: "text-fuchsia-400",
  },
  {
    id: "reel-cross-publisher",
    name: "Cross-Publisher",
    description:
      "Cross-posts the reel to Facebook Page and Threads. Adapts caption format per platform. Logs reach and engagement metrics.",
    status: "idle",
    durationMs: 0,
    logs: [],
    icon: "Globe",
    color: "text-fuchsia-400",
    variant: "publish",
  },

  // ── SOCIAL DISTRIBUTION PIPELINE (3rd row) ──────────────────────────────
  {
    id: "social-carousel",
    name: "IG Carousel",
    description:
      "Generates and publishes an Instagram carousel post from an article (4 slides: hook, info, budget, CTA).",
    status: "idle",
    durationMs: 0,
    logs: [],
    icon: "Image",
    color: "text-pink-400",
  },
  {
    id: "social-fb",
    name: "FB Post",
    description:
      "Publishes photo to Facebook Page with article link in first comment (preserves organic reach).",
    status: "idle",
    durationMs: 0,
    logs: [],
    icon: "Facebook",
    color: "text-blue-500",
    variant: "publish",
  },
  {
    id: "social-threads",
    name: "Threads",
    description:
      "Posts caption + image to Threads (text truncated to 500 chars).",
    status: "idle",
    durationMs: 0,
    logs: [],
    icon: "AtSign",
    color: "text-zinc-300",
    variant: "publish",
  },
  {
    id: "social-story",
    name: "Auto-Story",
    description:
      "Publishes Instagram Story with clickable link sticker pointing to the flashvoyage.com article.",
    status: "idle",
    durationMs: 0,
    logs: [],
    icon: "Smartphone",
    color: "text-amber-400",
    variant: "publish",
  },

  // ── INTELLIGENCE PIPELINE (4th row) ──────────────────────────────────────
  {
    id: "intel-trends",
    name: "Google Trends",
    description:
      "Scans Google Trends for FR travel rising queries. Identifies trending destinations and content gaps.",
    status: "idle",
    durationMs: 0,
    logs: [],
    icon: "TrendingUp",
    color: "text-green-400",
  },
  {
    id: "intel-analytics",
    name: "GA4 + GSC",
    description:
      "Fetches GA4 traffic data + Google Search Console keyword positions. Computes article scores.",
    status: "idle",
    durationMs: 0,
    logs: [],
    icon: "BarChart2",
    color: "text-cyan-400",
  },
  {
    id: "intel-scorer",
    name: "Scorer",
    description:
      "Scores all articles on 6 dimensions. Generates performance weights for the reel scheduler.",
    status: "idle",
    durationMs: 0,
    logs: [],
    icon: "Calculator",
    color: "text-yellow-400",
  },
  {
    id: "intel-scheduler",
    name: "Smart Scheduler",
    description:
      "Decides what to publish next based on trends, performance, breaking news, and content dedup.",
    status: "idle",
    durationMs: 0,
    logs: [],
    icon: "Brain",
    color: "text-purple-400",
  },
];

// Ordered viz-bridge stage IDs (for sequencing — article pipeline)
export const VIZ_BRIDGE_STAGE_IDS = [
  "scout",
  "extractor",
  "generator",
  "finalizer",
  "post-processing",
  "marie",
  "publisher",
] as const;

// Reel pipeline stage IDs (for sequencing)
export const REEL_STAGE_IDS = [
  "reel-scheduler",
  "reel-generator",
  "reel-publisher",
  "reel-cross-publisher",
] as const;

// Social distribution pipeline stage IDs
export const SOCIAL_STAGE_IDS = [
  "social-carousel",
  "social-fb",
  "social-threads",
  "social-story",
] as const;

// Intelligence pipeline stage IDs
export const INTEL_STAGE_IDS = [
  "intel-trends",
  "intel-analytics",
  "intel-scorer",
  "intel-scheduler",
] as const;

export type VizBridgeStageId = (typeof VIZ_BRIDGE_STAGE_IDS)[number];

// ── Real viz-events schema ────────────────────────────────────────────────────
// Shape of data/viz-events.json from GitHub

export interface VizEventStage {
  agent: string;
  duration_ms: number;
  status: "pass" | "success" | "failed" | string;
  detail: string;
  score?: number;
}

export interface VizRun {
  id: string;
  article: string;
  destination: string;
  timestamp: string;
  stages: VizEventStage[];
}

// ── Derive node statuses from a VizRun ───────────────────────────────────────
// The run object has a flat stages[] array. Agents can appear multiple times
// (extractor, generator, finalizer repeat). We take the LAST occurrence per agent.
export function deriveNodeStatuses(
  run: VizRun
): Record<string, { status: StageStatus; durationMs: number; detail: string; score?: number }> {
  const result: Record<string, { status: StageStatus; durationMs: number; detail: string; score?: number }> = {};

  // Walk stages in order — last occurrence wins
  for (const stage of run.stages) {
    const agentId = stage.agent;
    let mappedStatus: StageStatus;
    if (stage.status === "pass" || stage.status === "success") {
      mappedStatus = "success";
    } else if (stage.status === "failed") {
      mappedStatus = "failed";
    } else {
      mappedStatus = "success"; // treat unknown as success
    }
    result[agentId] = {
      status: mappedStatus,
      durationMs: stage.duration_ms,
      detail: stage.detail,
      score: stage.score,
    };
  }

  // scout is not in the real viz-events but is part of our display — mark as success if run exists
  if (!result["scout"] && Object.keys(result).length > 0) {
    result["scout"] = { status: "success", durationMs: 0, detail: "Source selected" };
  }

  return result;
}

// ── Node positions ────────────────────────────────────────────────────────────
export const REAL_POSITIONS: Record<string, { x: number; y: number }> = {
  // Input nodes stacked vertically on the left
  "reddit-input":    { x: 0,    y: 0   },
  "rss-input":       { x: 0,    y: 130 },
  "manual-input":    { x: 0,    y: 260 },
  // Article pipeline stages (top row)
  "scout":           { x: 280,  y: 130 },
  "extractor":       { x: 560,  y: 130 },
  "generator":       { x: 840,  y: 130 },
  "finalizer":       { x: 1120, y: 130 },
  "post-processing": { x: 1400, y: 130 },
  "marie":           { x: 1680, y: 130 },
  "publisher":       { x: 1960, y: 130 },
  // Reel pipeline stages (row 2)
  "reel-scheduler":       { x: 280,  y: 420 },
  "reel-generator":       { x: 660,  y: 420 },
  "reel-publisher":       { x: 1040, y: 420 },
  "reel-cross-publisher": { x: 1420, y: 420 },
  // Social distribution pipeline (row 3)
  "social-carousel":      { x: 280,  y: 700 },
  "social-fb":            { x: 660,  y: 700 },
  "social-threads":       { x: 1040, y: 700 },
  "social-story":         { x: 1420, y: 700 },
  // Intelligence pipeline (row 4)
  "intel-trends":         { x: 280,  y: 980 },
  "intel-analytics":      { x: 660,  y: 980 },
  "intel-scorer":         { x: 1040, y: 980 },
  "intel-scheduler":      { x: 1420, y: 980 },
};

// ── Map node IDs to GitHub workflow files ─────────────────────────────────────
// Used to color nodes based on real workflow run status from /api/workflows.
export const NODE_TO_WORKFLOW: Record<string, string> = {
  // Article pipeline nodes map to publish-article.yml
  "scout":           "publish-article",
  "extractor":       "publish-article",
  "generator":       "publish-article",
  "finalizer":       "publish-article",
  "post-processing": "publish-article",
  "marie":           "publish-article",
  "publisher":       "publish-article",
  // Reel pipeline nodes map to publish-reels.yml
  "reel-scheduler":       "publish-reels",
  "reel-generator":       "publish-reels",
  "reel-publisher":       "publish-reels",
  "reel-cross-publisher": "publish-reels",
  // Social distribution nodes map to publish-social-posts.yml
  "social-carousel":      "publish-social-posts",
  "social-fb":            "publish-social-posts",
  "social-threads":       "publish-social-posts",
  "social-story":         "publish-social-posts",
  // Intelligence nodes map to content-intelligence.yml and daily-analytics.yml
  "intel-trends":         "daily-analytics",
  "intel-analytics":      "daily-analytics",
  "intel-scorer":         "content-intelligence",
  "intel-scheduler":      "publish-reels",
};
