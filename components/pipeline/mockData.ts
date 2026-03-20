export type StageStatus = "idle" | "running" | "success" | "failed" | "skipped";
export type NodeVariant = "source" | "stage" | "router" | "publish";
export type PipelineTrack = "evergreen" | "news" | "shared";

export interface PipelineStageData {
  id: string;
  name: string;
  description: string;
  status: StageStatus;
  duration: number;
  cost: number;
  tokensIn?: number;
  tokensOut?: number;
  qualityScore?: number;
  logs: string[];
  icon: string;
  color: string;
  variant?: NodeVariant;
  track?: PipelineTrack;
  dimmed?: boolean;
  outputData?: Record<string, unknown>;
}

export const ALL_PIPELINE_STAGES: PipelineStageData[] = [
  // ── SOURCES ─────────────────────────────────────────────────────────────────
  {
    id: "reddit-scrape",
    name: "Reddit Scrape",
    description:
      "Fetches trending posts from r/travel, r/solotravel, r/backpacking via Reddit API. Filters to posts with >500 upvotes in the last 24h. Extracts title, body, top comments.",
    status: "success",
    duration: 3.2,
    cost: 0,
    logs: [
      "[10:12:01] Polling r/travel, r/solotravel, r/backpacking",
      "[10:12:02] Fetched 47 posts from last 24h",
      "[10:12:03] Filtered to 12 posts (>500 upvotes)",
      "[10:12:03] Done. 12 posts queued for extraction.",
    ],
    icon: "Hash",
    color: "text-orange-400",
    variant: "source",
    track: "shared",
  },
  {
    id: "rss-fetch",
    name: "RSS Fetch",
    description:
      "Polls configured RSS feeds (Lonely Planet, Nomadic Matt, TravelPulse, Atlas & Boots) every 30 min. Filters new items by recency and keyword relevance score >0.7. No LLM cost.",
    status: "success",
    duration: 2.1,
    cost: 0,
    logs: [
      "[10:10:00] Polling 6 configured RSS feeds",
      "[10:10:01] Fetched 23 new items since last poll",
      "[10:10:01] Keyword relevance filter: 8 items pass (>0.7)",
      "[10:10:02] Done. 8 items queued.",
    ],
    icon: "Rss",
    color: "text-blue-400",
    variant: "source",
    track: "shared",
  },
  {
    id: "manual-input",
    name: "Manual Input",
    description:
      "Topics queued directly by the operator — either typed in the dashboard or synced from the Notion backlog. No scraping needed; bypasses source discovery entirely.",
    status: "idle",
    duration: 0,
    cost: 0,
    logs: [
      "[--:--:--] Awaiting manual input...",
      "[--:--:--] Queue: 0 pending topics",
    ],
    icon: "PenLine",
    color: "text-zinc-400",
    variant: "source",
    track: "shared",
  },

  // ── SHARED ──────────────────────────────────────────────────────────────────
  {
    id: "extract",
    name: "Extract",
    description:
      "Extracts structured data from raw source content: destination, theme, intent, primary keyword, difficulty, and language signal. Uses Claude Haiku for speed and cost efficiency.",
    status: "success",
    duration: 1.8,
    cost: 0.012,
    tokensIn: 8200,
    tokensOut: 2100,
    logs: [
      "[10:12:04] Processing 12 items with claude-haiku",
      "[10:12:05] Extracted: destination, theme, intent, keyword",
      "[10:12:05] 10/12 extracted successfully",
      "[10:12:05] 2 skipped (insufficient data)",
    ],
    icon: "Database",
    color: "text-indigo-400",
    track: "shared",
  },
  {
    id: "content-router",
    name: "Content Router",
    description:
      "Classifies each topic as Evergreen (persistent SEO demand, 1800w, full pipeline) or News/Trending (time-sensitive, 800w, fast path). Routes to the appropriate branch. Decision is based on topic shelf-life, not source.",
    status: "success",
    duration: 0.2,
    cost: 0.002,
    tokensIn: 600,
    tokensOut: 120,
    logs: [
      "[10:12:06] Classifying 10 topics...",
      "[10:12:06] Evergreen: 7 (persistent demand signal)",
      "[10:12:06] News/Trending: 3 (time-sensitive, <12h window)",
      "[10:12:06] Routing complete.",
    ],
    icon: "GitFork",
    color: "text-amber-400",
    variant: "router",
    track: "shared",
  },

  // ── EVERGREEN TRACK ─────────────────────────────────────────────────────────
  {
    id: "pattern-detect",
    name: "Pattern Detect",
    description:
      "Clusters evergreen topics by destination/theme to identify persistent reader demand patterns. Groups similar topics before generating briefs to avoid near-duplicate articles.",
    status: "success",
    duration: 0.9,
    cost: 0.006,
    tokensIn: 3100,
    tokensOut: 890,
    logs: [
      "[10:12:07] Clustering 7 evergreen topics",
      "[10:12:07] Cluster: 'Budget Southeast Asia' (4 topics)",
      "[10:12:07] Cluster: 'Digital nomad Thailand' (3 topics)",
      "[10:12:07] 2 clusters — confidence >0.85",
    ],
    icon: "TrendingUp",
    color: "text-violet-400",
    track: "evergreen",
  },
  {
    id: "story-compile",
    name: "Story Compile",
    description:
      "Builds a long-form editorial brief: angle, hook, unique POV, H2 outline, word count target (1800w), internal linking cluster. This brief is what drives generation quality.",
    status: "success",
    duration: 0.4,
    cost: 0.003,
    tokensIn: 1200,
    tokensOut: 650,
    logs: [
      "[10:12:07] Compiling brief: 'Budget Southeast Asia'",
      "[10:12:07] Angle: first-person, budget-focused, 2026",
      "[10:12:07] Outline: 6 H2 sections, 1800w target",
      "[10:12:07] Brief ready: 650 tokens",
    ],
    icon: "BookOpen",
    color: "text-cyan-400",
    track: "evergreen",
  },
  {
    id: "editorial-ev",
    name: "Editorial Route",
    description:
      "Selects the content template (budget / luxury / nomad / itinerary), target language, affiliate vertical (Booking.com, Hostelworld, GetYourGuide), and internal linking cluster.",
    status: "success",
    duration: 0.3,
    cost: 0.002,
    tokensIn: 800,
    tokensOut: 280,
    logs: [
      "[10:12:07] Template: Budget Travel (EN)",
      "[10:12:07] Affiliates: Booking.com + Hostelworld",
      "[10:12:07] Internal link cluster: digital-nomad-thailand",
      "[10:12:07] Route confirmed.",
    ],
    icon: "GitBranch",
    color: "text-emerald-400",
    track: "evergreen",
  },
  {
    id: "generate-ev",
    name: "Generate (Sonnet)",
    description:
      "Full article generation via Claude Sonnet 4.6 — depth, nuance, and SEO-optimised structure. Target: 1800w with intro, 6 sections, FAQ, and conclusion.",
    status: "success",
    duration: 18.7,
    cost: 0.087,
    tokensIn: 2800,
    tokensOut: 3200,
    logs: [
      "[10:12:08] Brief → claude-sonnet-4-6",
      "[10:12:10] Generating intro + 6 sections + FAQ...",
      "[10:12:24] Article: 1847 words",
      "[10:12:26] Post-processing: clean markdown, fix headers",
    ],
    icon: "Sparkles",
    color: "text-amber-400",
    track: "evergreen",
  },
  {
    id: "affiliate-inject",
    name: "Affiliate Inject",
    description:
      "Injects contextual affiliate links (Booking.com, Hostelworld, GetYourGuide) at natural anchor points and adds a CTA block at the end. News articles skip this step.",
    status: "success",
    duration: 0.7,
    cost: 0.001,
    logs: [
      "[10:12:26] Scanning for injection points",
      "[10:12:26] Injected 4x Booking.com links",
      "[10:12:26] Injected 2x Hostelworld links",
      "[10:12:27] CTA block appended",
    ],
    icon: "Link",
    color: "text-orange-400",
    track: "evergreen",
  },
  {
    id: "seo-optimize",
    name: "SEO Optimize",
    description:
      "Optimises title tag, meta description, keyword density (target 1.2%), H-tag structure, and adds 3 contextual internal links. Target SEO score: 85+.",
    status: "success",
    duration: 2.1,
    cost: 0.015,
    tokensIn: 4100,
    tokensOut: 1800,
    qualityScore: 82,
    logs: [
      "[10:12:27] KW density: 1.3% ✓",
      "[10:12:28] Meta title + description generated",
      "[10:12:28] 3 internal links added",
      "[10:12:29] SEO score: 82/100",
    ],
    icon: "BarChart2",
    color: "text-green-400",
    track: "evergreen",
  },
  {
    id: "finalize",
    name: "Finalize",
    description:
      "Final pass: markdown formatting, image alt tags, schema markup (Article + BreadcrumbList), featured image placeholder, and CMS-ready HTML export.",
    status: "success",
    duration: 0.6,
    cost: 0.001,
    logs: [
      "[10:12:29] CMS formatting applied",
      "[10:12:29] Schema: Article + BreadcrumbList",
      "[10:12:29] Image alt tags generated",
      "[10:12:30] Ready for quality gate",
    ],
    icon: "FileCheck",
    color: "text-teal-400",
    track: "evergreen",
  },
  {
    id: "quality-gate-ev",
    name: "Quality Gate (85+)",
    description:
      "Full QA: quality score threshold 85/100, semantic duplicate detection, compliance check (no hallucinated facts), internal link validation. Rejects and flags if below threshold.",
    status: "success",
    duration: 1.4,
    cost: 0.009,
    tokensIn: 3800,
    tokensOut: 420,
    qualityScore: 91,
    logs: [
      "[10:12:30] Quality score: 91/100 ✓ (threshold: 85)",
      "[10:12:31] Duplicate check: unique ✓",
      "[10:12:31] Compliance: passed ✓",
      "[10:12:31] GATE PASSED → Publish",
    ],
    icon: "ShieldCheck",
    color: "text-rose-400",
    track: "evergreen",
  },

  // ── NEWS / TRENDING TRACK ────────────────────────────────────────────────────
  {
    id: "quick-brief",
    name: "Quick Brief",
    description:
      "Rapid brief for time-sensitive content: angle, hook, 800w outline. Skips Pattern Detect and Story Compile — topic urgency is already established by the source. Speed > depth.",
    status: "success",
    duration: 0.8,
    cost: 0.008,
    tokensIn: 2100,
    tokensOut: 480,
    logs: [
      "[10:12:06] Building news brief (speed mode)",
      "[10:12:07] Angle: breaking + practical advice",
      "[10:12:07] Target: 800w, 4 H2 sections",
      "[10:12:07] Brief ready: 480 tokens",
    ],
    icon: "Zap",
    color: "text-cyan-400",
    track: "news",
  },
  {
    id: "generate-news",
    name: "Generate (Haiku)",
    description:
      "800w article via Claude Haiku — optimised for speed over depth. News publish window is 6–12h from trend detection. No affiliate injection; no deep SEO pass.",
    status: "success",
    duration: 6.2,
    cost: 0.018,
    tokensIn: 1800,
    tokensOut: 1600,
    logs: [
      "[10:12:07] Brief → claude-haiku-4-5",
      "[10:12:09] Generating 4 sections...",
      "[10:12:13] Article: 812 words",
      "[10:12:13] Done.",
    ],
    icon: "Sparkles",
    color: "text-cyan-400",
    track: "news",
  },
  {
    id: "quality-gate-news",
    name: "Quality Gate (70+)",
    description:
      "Lighter QA for news: quality threshold 70/100, basic duplicate check. No internal link validation, no affiliate audit. Speed is the priority for trending content.",
    status: "success",
    duration: 0.8,
    cost: 0.004,
    tokensIn: 1600,
    tokensOut: 220,
    qualityScore: 76,
    logs: [
      "[10:12:13] Quality score: 76/100 ✓ (threshold: 70)",
      "[10:12:14] Duplicate check: unique ✓",
      "[10:12:14] GATE PASSED → Publish",
    ],
    icon: "ShieldCheck",
    color: "text-cyan-400",
    track: "news",
  },

  // ── PUBLISH ──────────────────────────────────────────────────────────────────
  {
    id: "publish",
    name: "Publish",
    description:
      "Publishes to WordPress via REST API. Evergreen articles are scheduled for peak traffic windows; news articles publish immediately. Both receive a Slack notification on success.",
    status: "success",
    duration: 1.1,
    cost: 0,
    logs: [
      "[10:12:31] Connecting to WordPress REST API",
      "[10:12:32] Creating post draft...",
      "[10:12:32] Post published ✓",
      "[10:12:32] Slack notification sent",
      "[10:12:32] Pipeline complete.",
    ],
    icon: "Globe",
    color: "text-sky-400",
    variant: "publish",
    track: "shared",
  },
];

// Per-path cost and duration (one Reddit source + shared non-source + track stages)
const _src = ALL_PIPELINE_STAGES.find((s) => s.id === "reddit-scrape")!;
const _shared = ALL_PIPELINE_STAGES.filter(
  (s) => s.track === "shared" && s.variant !== "source"
);
const _ev = ALL_PIPELINE_STAGES.filter((s) => s.track === "evergreen");
const _news = ALL_PIPELINE_STAGES.filter((s) => s.track === "news");

const _sum = (arr: PipelineStageData[], key: "cost" | "duration") =>
  arr.reduce((s, d) => s + d[key], 0);

export const EVERGREEN_PATH_COST = +(_src.cost + _sum(_shared, "cost") + _sum(_ev, "cost")).toFixed(3);
export const EVERGREEN_PATH_DURATION = +(_src.duration + _sum(_shared, "duration") + _sum(_ev, "duration")).toFixed(1);
export const NEWS_PATH_COST = +(_src.cost + _sum(_shared, "cost") + _sum(_news, "cost")).toFixed(3);
export const NEWS_PATH_DURATION = +(_src.duration + _sum(_shared, "duration") + _sum(_news, "duration")).toFixed(1);

// Legacy aliases
export const MOCK_PIPELINE_STAGES = ALL_PIPELINE_STAGES;
export const TOTAL_COST = EVERGREEN_PATH_COST;
export const TOTAL_DURATION = EVERGREEN_PATH_DURATION;
