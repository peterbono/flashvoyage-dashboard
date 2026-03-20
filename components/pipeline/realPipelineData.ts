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
];

// Ordered viz-bridge stage IDs (for sequencing)
export const VIZ_BRIDGE_STAGE_IDS = [
  "scout",
  "extractor",
  "generator",
  "finalizer",
  "post-processing",
  "marie",
  "publisher",
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
  // Linear pipeline stages
  "scout":           { x: 280,  y: 130 },
  "extractor":       { x: 560,  y: 130 },
  "generator":       { x: 840,  y: 130 },
  "finalizer":       { x: 1120, y: 130 },
  "post-processing": { x: 1400, y: 130 },
  "marie":           { x: 1680, y: 130 },
  "publisher":       { x: 1960, y: 130 },
};
