export type StageStatus = "idle" | "running" | "success" | "failed" | "skipped";

export interface PipelineStageData {
  id: string;
  name: string;
  description: string;
  status: StageStatus;
  duration: number; // in seconds
  cost: number; // in USD
  tokensIn?: number;
  tokensOut?: number;
  qualityScore?: number;
  logs: string[];
  icon: string; // lucide icon name
  color: string; // tailwind color class for the icon
}

export const MOCK_PIPELINE_STAGES: PipelineStageData[] = [
  {
    id: "reddit-scrape",
    name: "Reddit Scrape",
    description: "Scrapes trending posts from travel subreddits using Reddit API",
    status: "success",
    duration: 3.2,
    cost: 0.00,
    logs: [
      "[10:12:01] Starting Reddit scrape for r/travel, r/solotravel, r/backpacking",
      "[10:12:02] Fetched 47 posts from last 24h",
      "[10:12:03] Filtered to 12 trending posts (>500 upvotes)",
      "[10:12:03] Done. 12 posts queued for extraction.",
    ],
    icon: "Search",
    color: "text-blue-400",
  },
  {
    id: "extract",
    name: "Extract",
    description: "Extracts structured data from raw posts — destination, theme, keywords",
    status: "success",
    duration: 1.8,
    cost: 0.012,
    tokensIn: 8200,
    tokensOut: 2100,
    logs: [
      "[10:12:04] Processing 12 posts with Claude Haiku",
      "[10:12:05] Extracted: destination, theme, intent, keywords",
      "[10:12:05] 10/12 posts extracted successfully",
      "[10:12:05] 2 posts skipped (insufficient data)",
    ],
    icon: "Database",
    color: "text-indigo-400",
  },
  {
    id: "pattern-detect",
    name: "Pattern Detect",
    description: "Identifies recurring travel patterns and trending topics across posts",
    status: "success",
    duration: 0.9,
    cost: 0.006,
    tokensIn: 3100,
    tokensOut: 890,
    logs: [
      "[10:12:06] Clustering 10 extracts by destination",
      "[10:12:06] Pattern found: 'Budget Southeast Asia' (4 posts)",
      "[10:12:06] Pattern found: 'Digital nomad Thailand' (3 posts)",
      "[10:12:06] 2 patterns identified, confidence >0.85",
    ],
    icon: "TrendingUp",
    color: "text-violet-400",
  },
  {
    id: "story-compile",
    name: "Story Compile",
    description: "Compiles scraped patterns into a narrative brief for the LLM",
    status: "success",
    duration: 0.4,
    cost: 0.003,
    tokensIn: 1200,
    tokensOut: 650,
    logs: [
      "[10:12:07] Compiling brief for pattern: 'Budget Southeast Asia'",
      "[10:12:07] Brief: angle, hooks, unique POV, word count target",
      "[10:12:07] Brief ready: 650 tokens",
    ],
    icon: "BookOpen",
    color: "text-cyan-400",
  },
  {
    id: "editorial-route",
    name: "Editorial Route",
    description: "Decides which template, language, and affiliate vertical to use",
    status: "success",
    duration: 0.3,
    cost: 0.002,
    tokensIn: 800,
    tokensOut: 280,
    logs: [
      "[10:12:07] Routing to: EN → Budget Travel template",
      "[10:12:07] Affiliate vertical: Booking.com + Hostelworld",
      "[10:12:07] Word count target: 1800",
      "[10:12:07] Route confirmed.",
    ],
    icon: "GitBranch",
    color: "text-emerald-400",
  },
  {
    id: "generate",
    name: "Generate (LLM)",
    description: "Full article generation using Claude Sonnet with the editorial brief",
    status: "success",
    duration: 18.7,
    cost: 0.087,
    tokensIn: 2800,
    tokensOut: 3200,
    logs: [
      "[10:12:08] Sending brief to claude-sonnet-4-6",
      "[10:12:10] Generating intro + 6 sections...",
      "[10:12:24] Article generated: 1847 words",
      "[10:12:26] Post-processing: clean markdown, fix headers",
    ],
    icon: "Sparkles",
    color: "text-amber-400",
  },
  {
    id: "affiliate-inject",
    name: "Affiliate Inject",
    description: "Injects contextual affiliate links and CTAs throughout the article",
    status: "success",
    duration: 0.7,
    cost: 0.001,
    logs: [
      "[10:12:26] Scanning article for injection points",
      "[10:12:26] Injected 4x Booking.com links",
      "[10:12:26] Injected 2x Hostelworld links",
      "[10:12:27] CTA block added at end",
    ],
    icon: "Link",
    color: "text-orange-400",
  },
  {
    id: "seo-optimize",
    name: "SEO Optimize",
    description: "Optimizes title, meta, headers, keyword density and internal links",
    status: "success",
    duration: 2.1,
    cost: 0.015,
    tokensIn: 4100,
    tokensOut: 1800,
    qualityScore: 82,
    logs: [
      "[10:12:27] Analyzing keyword distribution",
      "[10:12:28] Primary KW density: 1.3% ✓",
      "[10:12:28] Generated meta title + description",
      "[10:12:29] Added 3 internal links",
      "[10:12:29] SEO score: 82/100",
    ],
    icon: "BarChart2",
    color: "text-green-400",
  },
  {
    id: "finalize",
    name: "Finalize",
    description: "Final formatting, image placeholders, schema markup, and CMS prep",
    status: "success",
    duration: 0.6,
    cost: 0.001,
    logs: [
      "[10:12:29] Applying CMS formatting",
      "[10:12:29] Schema markup: Article + BreadcrumbList",
      "[10:12:29] Image alt tags generated",
      "[10:12:30] Article ready for quality gate",
    ],
    icon: "FileCheck",
    color: "text-teal-400",
  },
  {
    id: "quality-gate",
    name: "Quality Gate",
    description: "Automated quality check: score threshold, duplicate detection, compliance",
    status: "success",
    duration: 1.4,
    cost: 0.009,
    tokensIn: 3800,
    tokensOut: 420,
    qualityScore: 91,
    logs: [
      "[10:12:30] Running quality checks...",
      "[10:12:31] Duplicate check: unique ✓",
      "[10:12:31] Compliance check: passed ✓",
      "[10:12:31] Quality score: 91/100 ✓ (threshold: 80)",
      "[10:12:31] GATE PASSED → Publish",
    ],
    icon: "ShieldCheck",
    color: "text-rose-400",
  },
  {
    id: "publish",
    name: "Publish",
    description: "Publishes article to WordPress CMS with all metadata and scheduling",
    status: "success",
    duration: 1.1,
    cost: 0.00,
    logs: [
      "[10:12:31] Connecting to WordPress API",
      "[10:12:32] Creating post draft...",
      "[10:12:32] Uploading featured image placeholder",
      "[10:12:32] Post published: /best-budget-travel-southeast-asia",
      "[10:12:32] Pipeline complete",
    ],
    icon: "Globe",
    color: "text-sky-400",
  },
];

export const TOTAL_COST = MOCK_PIPELINE_STAGES.reduce((sum, s) => sum + s.cost, 0);
export const TOTAL_DURATION = MOCK_PIPELINE_STAGES.reduce((sum, s) => sum + s.duration, 0);
