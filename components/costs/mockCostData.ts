export interface ArticleRow {
  id: string;
  date: string;
  title: string;
  totalCost: number;
  tokensIn: number;
  tokensOut: number;
  qualityScore: number;
  status: "published" | "review" | "failed";
  model: string;
}

export interface DailyCost {
  date: string;
  cost: number;
  articles: number;
}

export interface ModelShare {
  name: string;
  value: number;
  color: string;
}

export interface StageCost {
  stage: string;
  cost: number;
}

// Seeded deterministic pseudo-random — avoids server/client hydration mismatch
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    return (s >>> 0) / 0xffffffff;
  };
}

// Generate 30 days of daily cost data with fixed dates relative to a stable anchor
const ANCHOR_DATE = "2026-03-20"; // matches currentDate in project memory
function daysBeforeAnchor(n: number): string {
  const d = new Date(ANCHOR_DATE);
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

const rngDaily = seeded(42);
export const DAILY_COSTS: DailyCost[] = Array.from({ length: 30 }, (_, i) => ({
  date: daysBeforeAnchor(29 - i),
  cost: parseFloat((rngDaily() * 0.8 + 0.05).toFixed(3)),
  articles: Math.floor(rngDaily() * 6 + 1),
}));

export const MODEL_SHARES: ModelShare[] = [
  { name: "Claude Haiku 4.5", value: 65, color: "#f59e0b" },
  { name: "GPT-4o", value: 25, color: "#6366f1" },
  { name: "GPT-4o-mini", value: 10, color: "#10b981" },
];

export const STAGE_COSTS: StageCost[] = [
  { stage: "Generate (LLM)", cost: 0.087 },
  { stage: "SEO Optimize", cost: 0.015 },
  { stage: "Extract", cost: 0.012 },
  { stage: "Quality Gate", cost: 0.009 },
  { stage: "Pattern Detect", cost: 0.006 },
  { stage: "Story Compile", cost: 0.003 },
  { stage: "Editorial Route", cost: 0.002 },
  { stage: "Affiliate Inject", cost: 0.001 },
  { stage: "Finalize", cost: 0.001 },
];

const TITLES = [
  "Ultimate Guide to Digital Nomad Visas in Thailand 2026",
  "Best Budget Hostels in Chiang Mai for Solo Travelers",
  "Bali vs Lombok: Which Island Should You Visit First?",
  "How to Travel Southeast Asia on $30 a Day",
  "Top 10 Street Food Markets in Bangkok",
  "Vietnam Backpacker Route: 3 Weeks Itinerary",
  "Cheapest Flights from Europe to Asia: Full Strategy",
  "Living in Lisbon as a Digital Nomad: 2026 Cost Breakdown",
  "Japan on a Budget: Tokyo to Osaka for Under €800",
  "Hidden Gems in Northern Portugal Every Traveler Misses",
  "Best Co-Working Spaces in Medellín for Remote Workers",
  "Philippines Island Hopping: Palawan vs Siargao Guide",
  "Travel Insurance for Long-Term Nomads: What to Buy",
  "Georgia (Country) Travel Guide: Tbilisi & Beyond",
  "How to Get a Thai LTR Visa Step by Step",
  "Mexico City Neighborhoods Guide for First-Timers",
  "Budget Travel in Eastern Europe: Romania & Bulgaria",
  "Best Time to Visit Patagonia: Month-by-Month Breakdown",
];

const MODELS = ["Claude Haiku 4.5", "Claude Haiku 4.5", "Claude Haiku 4.5", "GPT-4o", "GPT-4o-mini"];
const STATUSES: ArticleRow["status"][] = ["published", "published", "published", "review", "failed"];

const rngArticles = seeded(99);
export const ARTICLES: ArticleRow[] = TITLES.map((title, i) => {
  const cost = parseFloat((rngArticles() * 0.18 + 0.04).toFixed(4));
  const tokensIn = Math.floor(rngArticles() * 6000 + 2000);
  const tokensOut = Math.floor(rngArticles() * 4000 + 1000);
  return {
    id: `art-${i + 1}`,
    date: daysBeforeAnchor(Math.floor(rngArticles() * 30)),
    title,
    totalCost: cost,
    tokensIn,
    tokensOut,
    qualityScore: Math.floor(rngArticles() * 20 + 75),
    status: STATUSES[i % STATUSES.length],
    model: MODELS[i % MODELS.length],
  };
}).sort((a, b) => b.date.localeCompare(a.date));

export const KPI = {
  totalCost: DAILY_COSTS.reduce((s, d) => s + d.cost, 0),
  totalArticles: ARTICLES.length,
  avgCostPerArticle: ARTICLES.reduce((s, a) => s + a.totalCost, 0) / ARTICLES.length,
  avgQualityScore: ARTICLES.reduce((s, a) => s + a.qualityScore, 0) / ARTICLES.length,
};
