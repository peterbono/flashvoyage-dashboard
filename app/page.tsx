import Link from "next/link";
import { readFile } from "fs/promises";
import { join } from "path";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  GitBranch,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Zap,
  CheckSquare,
  Star,
  Globe,
  ArrowRight,
  Command,
  Database,
} from "lucide-react";
import { MOCK_CARDS, COLUMNS } from "@/components/kanban/mockKanbanData";
import { MOCK_TASKS } from "@/components/kanban/mockTaskData";
import { DAILY_COSTS } from "@/components/costs/mockCostData";
import { WeeklyThroughputChart } from "@/components/overview/WeeklyThroughputChart";
import type { KanbanCard } from "@/components/kanban/mockKanbanData";

const DATA_PATH =
  process.env.FLASHVOYAGE_DATA_PATH ??
  "/Users/floriangouloubi/Documents/perso/flashvoyage";

interface WPArticle {
  id: number;
  title: string;
  date: string;
  categories: { id: number; name: string; slug: string }[];
  url: string;
  slug: string;
  content: string;
  excerpt: string;
}

function decodeHtml(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function getDestination(article: WPArticle): string {
  const catName = article.categories[0]?.name ?? "";
  const stripped = catName.replace(/^Digital Nomades?\s+/i, "").trim();
  return stripped && stripped !== catName ? stripped : catName || "International";
}

async function loadRealArticles(): Promise<{
  cards: KanbanCard[];
  crawledAt: string;
} | null> {
  try {
    const raw = await readFile(
      join(DATA_PATH, "articles-database.json"),
      "utf-8"
    );
    const db = JSON.parse(raw) as {
      crawled_at: string;
      total_articles: number;
      articles: WPArticle[];
    };

    const cards: KanbanCard[] = db.articles.map((a) => ({
      id: String(a.id),
      title: decodeHtml(a.title),
      column: "published" as const,
      source: a.content.includes("Extrait Reddit") ? "Reddit" : ("Manual" as "Reddit" | "Manual"),
      keyword: a.slug.replace(/-/g, " ").split(" ").slice(0, 4).join(" "),
      date: a.date.slice(0, 10),
      language: "FR" as const, // All current articles are in French
      destination: getDestination(a),
    }));

    return { cards, crawledAt: db.crawled_at };
  } catch {
    return null;
  }
}

// Mock-derived stats (no real cost/quality data)
const MOCK_PIPELINE_CARDS = MOCK_CARDS.filter((c) => c.column !== "published");
const mockWithQuality = MOCK_CARDS.filter((c) => c.qualityScore !== undefined);
const mockAvgQuality = mockWithQuality.length
  ? Math.round(
      mockWithQuality.reduce((s, c) => s + (c.qualityScore ?? 0), 0) /
        mockWithQuality.length
    )
  : null;
const mockTotalCost = MOCK_CARDS.reduce((s, c) => s + (c.cost ?? 0), 0);
const urgentTasks = MOCK_TASKS.filter(
  (t) => t.priority === "urgent" && t.column !== "done"
);

// 7-day period-over-period trends from DAILY_COSTS
const N = 7;
const curr7 = DAILY_COSTS.slice(-N);
const prev7 = DAILY_COSTS.slice(-N * 2, -N);
const curr7Cost = curr7.reduce((s, d) => s + d.cost, 0);
const prev7Cost = prev7.reduce((s, d) => s + d.cost, 0);
const curr7Arts = curr7.reduce((s, d) => s + d.articles, 0);
const prev7Arts = prev7.reduce((s, d) => s + d.articles, 0);
const costTrendPct = prev7Cost ? ((Math.abs(curr7Cost - prev7Cost) / prev7Cost) * 100).toFixed(1) : null;
const costTrendUp = curr7Cost > prev7Cost;
const artsTrendPct = prev7Arts ? ((Math.abs(curr7Arts - prev7Arts) / prev7Arts) * 100).toFixed(1) : null;
const artsTrendUp = curr7Arts > prev7Arts;

export default async function OverviewPage() {
  const real = await loadRealArticles();

  // Published: real WordPress articles (or fall back to mock published cards)
  const publishedCards = real?.cards ?? MOCK_CARDS.filter((c) => c.column === "published");
  const isLive = real !== null;

  // Combine for recent articles display (real published + pipeline mocks)
  const allCards = [...publishedCards, ...MOCK_PIPELINE_CARDS];

  const recentArticles = [...publishedCards]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  // Pipeline counts: real for "published", mock for other stages
  const pipelineByColumn = COLUMNS.map((col) => ({
    ...col,
    count:
      col.id === "published"
        ? publishedCards.length
        : MOCK_PIPELINE_CARDS.filter((c) => c.column === col.id).length,
  }));
  const totalForBar = allCards.length;

  const tasksDone = MOCK_TASKS.filter((t) => t.column === "done").length;
  const tasksPct = Math.round((tasksDone / MOCK_TASKS.length) * 100);

  const stats = [
    {
      label: "Published Articles",
      value: publishedCards.length.toString(),
      sub: isLive
        ? `synced ${real!.crawledAt.slice(0, 10)}`
        : `${allCards.length} total in board`,
      icon: FileText,
      color: "text-emerald-400",
      href: "/content",
      live: isLive,
      trendPct: artsTrendPct,
      trendUp: artsTrendUp,
      positiveIsUp: true,
    },
    {
      label: "In Pipeline",
      value: MOCK_PIPELINE_CARDS.length.toString(),
      sub: `${COLUMNS.length} active stages`,
      icon: GitBranch,
      color: "text-blue-400",
      href: "/pipeline",
      live: false,
      trendPct: null,
      trendUp: false,
      positiveIsUp: true,
    },
    {
      label: "Total LLM Cost",
      value: `$${mockTotalCost.toFixed(2)}`,
      sub: `avg $${(mockTotalCost / Math.max(MOCK_CARDS.filter((c) => c.column === "published").length, 1)).toFixed(3)}/article`,
      icon: DollarSign,
      color: "text-amber-400",
      href: "/costs",
      live: false,
      trendPct: costTrendPct,
      trendUp: costTrendUp,
      positiveIsUp: false,
    },
    {
      label: "Avg Quality Score",
      value: mockAvgQuality ? `${mockAvgQuality}/100` : "—",
      sub: mockAvgQuality
        ? mockAvgQuality >= 85
          ? "Above target (85)"
          : "Below target (85)"
        : "No scored articles",
      icon: TrendingUp,
      color:
        mockAvgQuality && mockAvgQuality >= 85
          ? "text-emerald-400"
          : "text-purple-400",
      href: "/content",
      live: false,
      trendPct: null,
      trendUp: false,
      positiveIsUp: true,
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Overview</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            FlashVoyage content pipeline dashboard
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-zinc-800 text-zinc-600 text-[10px] gap-1.5 hidden sm:flex"
          >
            <Command className="w-2.5 h-2.5" />
            ⌘K to search
          </Badge>
          {isLive && (
            <Badge
              variant="outline"
              className="border-emerald-800/60 bg-emerald-950/30 text-emerald-400 gap-1.5 text-[10px]"
            >
              <Database className="w-2.5 h-2.5" />
              WordPress live
            </Badge>
          )}
          <Badge
            variant="outline"
            className="border-amber-800/60 bg-amber-950/30 text-amber-400 gap-1.5"
          >
            <Zap className="w-3 h-3" />
            Live
          </Badge>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map(({ label, value, sub, icon: Icon, color, href, live, trendPct, trendUp, positiveIsUp }) => {
          const isGood = trendPct ? trendUp === positiveIsUp : null;
          const TrendIcon = trendUp ? TrendingUp : TrendingDown;
          return (
            <Link key={label} href={href}>
              <Card className="bg-zinc-900 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-800/60 transition-all duration-200 cursor-pointer h-full group">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-1.5">
                    <CardTitle className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                      {label}
                    </CardTitle>
                    {!live && (
                      <span className="text-[9px] text-zinc-700 border border-zinc-800 rounded px-1">
                        mock
                      </span>
                    )}
                  </div>
                  <div className={`p-1.5 rounded-md bg-zinc-800 group-hover:bg-zinc-700/80 transition-colors ${color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white tracking-tight tabular-nums">{value}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[11px] text-zinc-600 flex-1">{sub}</p>
                    {trendPct && (
                      <span className={`flex items-center gap-0.5 text-[10px] font-medium shrink-0 ${
                        isGood ? "text-emerald-400" : "text-rose-400"
                      }`}>
                        <TrendIcon className="w-3 h-3" />
                        {trendPct}%
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent articles */}
        <div className="lg:col-span-2">
          <Card className="bg-zinc-900 border-zinc-800/80 h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Recent Articles
                  </CardTitle>
                  {isLive && (
                    <span className="text-[9px] text-emerald-500 border border-emerald-900/60 bg-emerald-950/30 rounded px-1">
                      live
                    </span>
                  )}
                </div>
                <Link
                  href="/content"
                  className="text-[10px] text-zinc-600 hover:text-white flex items-center gap-1 transition-colors"
                >
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-0.5 pt-0">
              {recentArticles.map((card) => (
                <div
                  key={card.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800/60 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-200 truncate group-hover:text-amber-300 transition-colors">
                      {card.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-zinc-600 flex items-center gap-0.5">
                        <Globe className="w-2.5 h-2.5" />
                        {card.destination}
                      </span>
                      <span className="text-[10px] text-zinc-700">
                        {card.date.slice(5)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {card.qualityScore !== undefined && (
                      <span
                        className={`text-[10px] flex items-center gap-0.5 font-medium ${
                          card.qualityScore >= 85
                            ? "text-emerald-400"
                            : "text-amber-400"
                        }`}
                      >
                        <Star className="w-2.5 h-2.5" />
                        {card.qualityScore}
                      </span>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1.5 py-0 capitalize ${
                        card.column === "published"
                          ? "border-emerald-800/60 bg-emerald-950/30 text-emerald-400"
                          : card.column === "review"
                          ? "border-orange-800/60 bg-orange-950/30 text-orange-400"
                          : "border-zinc-700/60 text-zinc-500"
                      }`}
                    >
                      {card.column}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right column: pipeline status + tasks */}
        <div className="space-y-4">
          {/* Pipeline status */}
          <Card className="bg-zinc-900 border-zinc-800/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                Pipeline Status
                <Link
                  href="/pipeline"
                  className="text-[10px] text-zinc-600 hover:text-white flex items-center gap-1 transition-colors font-normal normal-case"
                >
                  View <ArrowRight className="w-3 h-3" />
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2.5">
              {pipelineByColumn.map((col) => (
                <div key={col.id} className="flex items-center gap-3">
                  <span className={`text-[11px] w-20 shrink-0 font-medium ${col.color}`}>
                    {col.label}
                  </span>
                  <div className="flex-1 bg-zinc-800/60 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        col.id === "published"
                          ? "bg-emerald-500"
                          : col.id === "review"
                          ? "bg-orange-500"
                          : col.id === "generating"
                          ? "bg-amber-500"
                          : col.id === "queued"
                          ? "bg-violet-500"
                          : "bg-blue-500"
                      }`}
                      style={{
                        width: `${(col.count / Math.max(totalForBar, 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-zinc-600 w-6 text-right tabular-nums">
                    {col.count}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Tasks summary */}
          <Card className="bg-zinc-900 border-zinc-800/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  Sprint Tasks
                  <span className="text-[9px] text-zinc-700 border border-zinc-800 rounded px-1">
                    mock
                  </span>
                </div>
                <Link
                  href="/tasks"
                  className="text-[10px] text-zinc-600 hover:text-white flex items-center gap-1 transition-colors font-normal normal-case"
                >
                  View <ArrowRight className="w-3 h-3" />
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-zinc-800/60 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all"
                    style={{ width: `${tasksPct}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-400 font-semibold tabular-nums">
                  {tasksPct}%
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-zinc-800/40 rounded-lg px-2.5 py-2 border border-zinc-800/60">
                  <div className="text-zinc-600 mb-0.5">Total</div>
                  <div className="text-white font-semibold">
                    {MOCK_TASKS.length}
                  </div>
                </div>
                <div className="bg-zinc-800/40 rounded-lg px-2.5 py-2 border border-zinc-800/60">
                  <div className="text-zinc-600 mb-0.5">Done</div>
                  <div className="text-emerald-400 font-semibold">
                    {tasksDone}
                  </div>
                </div>
                <div className="bg-zinc-800/40 rounded-lg px-2.5 py-2 border border-zinc-800/60">
                  <div className="text-zinc-600 mb-0.5">In progress</div>
                  <div className="text-blue-400 font-semibold">
                    {
                      MOCK_TASKS.filter((t) => t.column === "in_progress")
                        .length
                    }
                  </div>
                </div>
                <div className="bg-zinc-800/40 rounded-lg px-2.5 py-2 border border-zinc-800/60">
                  <div className="text-zinc-600 mb-0.5">Urgent</div>
                  <div
                    className={`font-semibold ${
                      urgentTasks.length > 0 ? "text-rose-400" : "text-zinc-600"
                    }`}
                  >
                    {urgentTasks.length}
                  </div>
                </div>
              </div>
              {urgentTasks.length > 0 && (
                <div className="border border-rose-900/40 bg-rose-950/20 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-1.5 text-rose-400 text-[10px] font-medium mb-1">
                    <CheckSquare className="w-3 h-3" />
                    Urgent — needs attention
                  </div>
                  {urgentTasks.slice(0, 2).map((t) => (
                    <p key={t.id} className="text-[10px] text-zinc-500 truncate">
                      {t.title}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Weekly throughput chart */}
      <Card className="bg-zinc-900 border-zinc-800/80">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Weekly Throughput
            </CardTitle>
            <div className="flex items-center gap-3 text-[10px] text-zinc-600">
              <span>
                <span className="tabular-nums font-medium text-amber-400">{curr7Arts}</span>
                {" "}articles · last 7 days
              </span>
              {artsTrendPct && (
                <span className={`flex items-center gap-0.5 font-medium ${artsTrendUp ? "text-emerald-400" : "text-rose-400"}`}>
                  {artsTrendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {artsTrendPct}% vs prev week
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 -mx-2">
          <WeeklyThroughputChart />
        </CardContent>
      </Card>
    </div>
  );
}
