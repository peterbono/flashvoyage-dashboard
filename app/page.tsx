import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  GitBranch,
  DollarSign,
  TrendingUp,
  Zap,
  CheckSquare,
  Star,
  Globe,
  ArrowRight,
  Command,
} from "lucide-react";
import { MOCK_CARDS, COLUMNS } from "@/components/kanban/mockKanbanData";
import { MOCK_TASKS } from "@/components/kanban/mockTaskData";

// Derived stats from mock data
const published = MOCK_CARDS.filter((c) => c.column === "published");
const inPipeline = MOCK_CARDS.filter((c) => c.column !== "published");
const withQuality = MOCK_CARDS.filter((c) => c.qualityScore !== undefined);
const avgQuality = withQuality.length
  ? Math.round(withQuality.reduce((s, c) => s + (c.qualityScore ?? 0), 0) / withQuality.length)
  : null;
const totalCost = MOCK_CARDS.reduce((s, c) => s + (c.cost ?? 0), 0);
const urgentTasks = MOCK_TASKS.filter((t) => t.priority === "urgent" && t.column !== "done");

const stats = [
  {
    label: "Published Articles",
    value: published.length.toString(),
    sub: `${MOCK_CARDS.length} total in board`,
    icon: FileText,
    color: "text-emerald-400",
    href: "/content",
  },
  {
    label: "In Pipeline",
    value: inPipeline.length.toString(),
    sub: `${COLUMNS.length} active stages`,
    icon: GitBranch,
    color: "text-blue-400",
    href: "/pipeline",
  },
  {
    label: "Total LLM Cost",
    value: `$${totalCost.toFixed(2)}`,
    sub: `avg $${(totalCost / Math.max(published.length, 1)).toFixed(3)}/article`,
    icon: DollarSign,
    color: "text-amber-400",
    href: "/costs",
  },
  {
    label: "Avg Quality Score",
    value: avgQuality ? `${avgQuality}/100` : "—",
    sub: avgQuality
      ? avgQuality >= 85 ? "Above target (85)" : "Below target (85)"
      : "No scored articles",
    icon: TrendingUp,
    color: avgQuality && avgQuality >= 85 ? "text-emerald-400" : "text-purple-400",
    href: "/content",
  },
];

export default function OverviewPage() {
  const recentArticles = [...MOCK_CARDS]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const pipelineByColumn = COLUMNS.map((col) => ({
    ...col,
    count: MOCK_CARDS.filter((c) => c.column === col.id).length,
  }));

  const tasksDone = MOCK_TASKS.filter((t) => t.column === "done").length;
  const tasksPct = Math.round((tasksDone / MOCK_TASKS.length) * 100);

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Overview</h1>
          <p className="text-sm text-zinc-400 mt-0.5">FlashVoyage content pipeline dashboard</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-[10px] gap-1.5 hidden sm:flex">
            <Command className="w-2.5 h-2.5" />
            ⌘K to search
          </Badge>
          <Badge variant="outline" className="border-amber-800 text-amber-400 gap-1.5">
            <Zap className="w-3 h-3" />
            Live
          </Badge>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map(({ label, value, sub, icon: Icon, color, href }) => (
          <Link key={label} href={href}>
            <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-600 transition-colors cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">
                  {label}
                </CardTitle>
                <Icon className={`w-4 h-4 ${color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{value}</div>
                <p className="text-[11px] text-zinc-500 mt-1">{sub}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent articles */}
        <div className="lg:col-span-2">
          <Card className="bg-zinc-900 border-zinc-800 h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">
                  Recent Articles
                </CardTitle>
                <Link href="/content" className="text-[10px] text-zinc-500 hover:text-white flex items-center gap-1 transition-colors">
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 pt-0">
              {recentArticles.map((card) => (
                <div
                  key={card.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate group-hover:text-amber-300 transition-colors">
                      {card.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-zinc-600 flex items-center gap-0.5">
                        <Globe className="w-2.5 h-2.5" />
                        {card.destination}
                      </span>
                      <span className="text-[10px] text-zinc-700">{card.date.slice(5)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {card.qualityScore !== undefined && (
                      <span className={`text-[10px] flex items-center gap-0.5 font-medium ${card.qualityScore >= 85 ? "text-emerald-400" : "text-amber-400"}`}>
                        <Star className="w-2.5 h-2.5" />
                        {card.qualityScore}
                      </span>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1.5 py-0 capitalize ${
                        card.column === "published"
                          ? "border-emerald-800 text-emerald-400"
                          : card.column === "review"
                          ? "border-orange-800 text-orange-400"
                          : "border-zinc-700 text-zinc-500"
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
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold text-zinc-300 uppercase tracking-wide flex items-center justify-between">
                Pipeline Status
                <Link href="/pipeline" className="text-[10px] text-zinc-500 hover:text-white flex items-center gap-1 transition-colors font-normal normal-case">
                  View <ArrowRight className="w-3 h-3" />
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {pipelineByColumn.map((col) => (
                <div key={col.id} className="flex items-center gap-3">
                  <span className={`text-[11px] w-20 shrink-0 ${col.color}`}>{col.label}</span>
                  <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        col.id === "published" ? "bg-emerald-500" :
                        col.id === "review"    ? "bg-orange-500" :
                        col.id === "generating"? "bg-amber-500" :
                        col.id === "queued"    ? "bg-violet-500" : "bg-blue-500"
                      }`}
                      style={{ width: `${(col.count / MOCK_CARDS.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-zinc-500 w-4 text-right">{col.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Tasks summary */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold text-zinc-300 uppercase tracking-wide flex items-center justify-between">
                Sprint Tasks
                <Link href="/tasks" className="text-[10px] text-zinc-500 hover:text-white flex items-center gap-1 transition-colors font-normal normal-case">
                  View <ArrowRight className="w-3 h-3" />
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-zinc-800 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all"
                    style={{ width: `${tasksPct}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-400 font-medium">{tasksPct}%</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-zinc-800/50 rounded-lg px-2.5 py-2">
                  <div className="text-zinc-500">Total</div>
                  <div className="text-white font-semibold">{MOCK_TASKS.length}</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg px-2.5 py-2">
                  <div className="text-zinc-500">Done</div>
                  <div className="text-emerald-400 font-semibold">{tasksDone}</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg px-2.5 py-2">
                  <div className="text-zinc-500">In progress</div>
                  <div className="text-blue-400 font-semibold">{MOCK_TASKS.filter((t) => t.column === "in_progress").length}</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg px-2.5 py-2">
                  <div className="text-zinc-500">Urgent</div>
                  <div className={`font-semibold ${urgentTasks.length > 0 ? "text-red-400" : "text-zinc-500"}`}>
                    {urgentTasks.length}
                  </div>
                </div>
              </div>
              {urgentTasks.length > 0 && (
                <div className="border border-red-900/50 bg-red-950/20 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-1.5 text-red-400 text-[10px] font-medium mb-1">
                    <CheckSquare className="w-3 h-3" />
                    Urgent — needs attention
                  </div>
                  {urgentTasks.slice(0, 2).map((t) => (
                    <p key={t.id} className="text-[10px] text-zinc-400 truncate">{t.title}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
