export type KanbanColumn = "sourced" | "queued" | "generating" | "review" | "published";
export type SourceType = "Reddit" | "RSS" | "Manual";

export interface KanbanCard {
  id: string;
  title: string;
  column: KanbanColumn;
  source: SourceType;
  sourceUrl?: string; // original post/feed URL
  keyword: string;
  qualityScore?: number;
  cost?: number;
  date: string;
  language: "EN" | "FR" | "ES" | "DE";
  destination: string;
  wordCount?: number;
}

export const COLUMNS: { id: KanbanColumn; label: string; color: string }[] = [
  { id: "sourced",    label: "Sourced",    color: "text-blue-400" },
  { id: "queued",     label: "Queued",     color: "text-violet-400" },
  { id: "generating", label: "Generating", color: "text-amber-400" },
  { id: "review",     label: "Review",     color: "text-orange-400" },
  { id: "published",  label: "Published",  color: "text-emerald-400" },
];

export const MOCK_CARDS: KanbanCard[] = [
  // Sourced (3)
  { id: "k1",  title: "Best Rooftop Bars in Kuala Lumpur for Sunset Views",   column: "sourced",    source: "Reddit", sourceUrl: "https://reddit.com/r/travel/comments/1abc123/best_rooftop_bars_kl",      keyword: "rooftop bars KL",              language: "EN", destination: "Malaysia",     date: "2026-03-20" },
  { id: "k2",  title: "How to Get from Bangkok to Koh Samui: All Options",    column: "sourced",    source: "RSS",    sourceUrl: "https://www.nomadicmatt.com/travel-blogs/bangkok-koh-samui-guide/",         keyword: "Bangkok to Koh Samui",         language: "EN", destination: "Thailand",     date: "2026-03-19" },
  { id: "k3",  title: "Budget Travel in Sri Lanka: 2-Week Itinerary 2026",    column: "sourced",    source: "Manual", keyword: "Sri Lanka budget travel",                                                    language: "EN", destination: "Sri Lanka",    date: "2026-03-19" },
  // Queued (3)
  { id: "k4",  title: "Top 10 Things to Do in Hanoi in 48 Hours",             column: "queued",     source: "Reddit", sourceUrl: "https://reddit.com/r/solotravel/comments/2def456/hanoi_48h_tips",          keyword: "things to do in Hanoi",        language: "EN", destination: "Vietnam",      date: "2026-03-18" },
  { id: "k5",  title: "Chiang Mai vs Chiang Rai: Which to Visit?",            column: "queued",     source: "RSS",    sourceUrl: "https://www.lonelyplanet.com/articles/chiang-mai-vs-chiang-rai",            keyword: "Chiang Mai vs Chiang Rai",     language: "EN", destination: "Thailand",     date: "2026-03-18" },
  { id: "k6",  title: "Guide Ultime pour Visiter Tbilisi en 2026",            column: "queued",     source: "Manual", keyword: "visiter Tbilisi",                                                            language: "FR", destination: "Georgia",      date: "2026-03-17" },
  // Generating (2)
  { id: "k7",  title: "Digital Nomad Guide to Bali: Canggu Neighbourhood",    column: "generating", source: "Reddit", sourceUrl: "https://reddit.com/r/digitalnomad/comments/3ghi789/canggu_bali_guide",    keyword: "digital nomad Bali Canggu",   language: "EN", destination: "Bali",         date: "2026-03-20", cost: 0.03 },
  { id: "k8",  title: "Cambodia Border Crossing: Thailand to Siem Reap",      column: "generating", source: "RSS",    sourceUrl: "https://www.travelpulse.com/news/destinations/thailand-cambodia-border",    keyword: "Thailand Cambodia border",     language: "EN", destination: "Cambodia",     date: "2026-03-20", cost: 0.02 },
  // Review (3)
  { id: "k9",  title: "Vietnam Visa on Arrival: Step-by-Step 2026 Guide",     column: "review",     source: "Reddit", sourceUrl: "https://reddit.com/r/travel/comments/4jkl012/vietnam_visa_2026",           keyword: "Vietnam visa on arrival",      language: "EN", destination: "Vietnam",      date: "2026-03-19", cost: 0.14, qualityScore: 88, wordCount: 1920 },
  { id: "k10", title: "Philippines Ferry Guide: Manila to Coron Routes",       column: "review",     source: "RSS",    sourceUrl: "https://www.atlasandboots.com/travel-blog/manila-to-coron-ferry/",          keyword: "Manila to Coron ferry",        language: "EN", destination: "Philippines",  date: "2026-03-18", cost: 0.11, qualityScore: 82, wordCount: 1650 },
  { id: "k11", title: "Japan Rail Pass 2026: Worth It or Not?",               column: "review",     source: "Manual", keyword: "Japan rail pass worth it",                                                   language: "EN", destination: "Japan",        date: "2026-03-17", cost: 0.16, qualityScore: 94, wordCount: 2100 },
  // Published (4)
  { id: "k12", title: "Ultimate Guide to Digital Nomad Visas in Thailand",    column: "published",  source: "Reddit", sourceUrl: "https://reddit.com/r/digitalnomad/comments/5mno345/thailand_visa_guide",   keyword: "digital nomad visa Thailand",  language: "EN", destination: "Thailand",     date: "2026-03-15", cost: 0.13, qualityScore: 91, wordCount: 1847 },
  { id: "k13", title: "Best Hostels in Chiang Mai for Solo Travelers 2026",   column: "published",  source: "RSS",    sourceUrl: "https://www.nomadicmatt.com/travel-blogs/best-hostels-chiang-mai/",        keyword: "best hostels Chiang Mai",      language: "EN", destination: "Thailand",     date: "2026-03-14", cost: 0.10, qualityScore: 87, wordCount: 1600 },
  { id: "k14", title: "How to Travel Vietnam on $30 a Day: Full Breakdown",   column: "published",  source: "Manual", keyword: "Vietnam budget travel $30",                                                   language: "EN", destination: "Vietnam",      date: "2026-03-13", cost: 0.12, qualityScore: 89, wordCount: 1750 },
  { id: "k15", title: "Top Street Food Markets in Bangkok: Insider Guide",    column: "published",  source: "Reddit", sourceUrl: "https://reddit.com/r/travel/comments/6pqr678/bangkok_street_food_guide",   keyword: "Bangkok street food markets",  language: "EN", destination: "Thailand",     date: "2026-03-12", cost: 0.09, qualityScore: 85, wordCount: 1520 },
];
