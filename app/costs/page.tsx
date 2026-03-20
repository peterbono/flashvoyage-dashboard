"use client";

import { useState, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/costs/KpiCard";
import { DAILY_COSTS, MODEL_SHARES, STAGE_COSTS, ARTICLES, KPI } from "@/components/costs/mockCostData";
import { DollarSign, FileText, TrendingDown, Star, ArrowUpDown, CheckCircle2, Clock, XCircle, TrendingUp, Zap } from "lucide-react";

type Range = "7" | "30" | "90" | "all";

const RANGE_LABELS: Record<Range, string> = {
  "7": "7d",
  "30": "30d",
  "90": "90d",
  "all": "All",
};

const STATUS_CONFIG = {
  published: { label: "Published", color: "text-emerald-400 border-emerald-800/60 bg-emerald-950/30", icon: CheckCircle2 },
  review:    { label: "Review",    color: "text-amber-400 border-amber-800/60 bg-amber-950/30",       icon: Clock },
  failed:    { label: "Failed",    color: "text-red-400 border-red-800/60 bg-red-950/30",             icon: XCircle },
};

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#18181b",
  border: "1px solid #27272a",
  borderRadius: "8px",
  color: "#e4e4e7",
  fontSize: "12px",
  padding: "8px 12px",
};

// ── Period-over-period analytics (real, from DAILY_COSTS) ──────────────────
const N = 14; // window size in days
const currWindow = DAILY_COSTS.slice(-N);
const prevWindow = DAILY_COSTS.slice(-N * 2, -N);

const currCost     = currWindow.reduce((s, d) => s + d.cost, 0);
const prevCost     = prevWindow.reduce((s, d) => s + d.cost, 0);
const costPct      = ((Math.abs(currCost - prevCost) / prevCost) * 100).toFixed(1);
const costUp       = currCost > prevCost;

const currArts     = currWindow.reduce((s, d) => s + d.articles, 0);
const prevArts     = prevWindow.reduce((s, d) => s + d.articles, 0);
const artsPct      = ((Math.abs(currArts - prevArts) / prevArts) * 100).toFixed(1);
const artsUp       = currArts > prevArts;

const currAvgCost  = currCost / Math.max(currArts, 1);
const prevAvgCost  = prevCost / Math.max(prevArts, 1);
const avgCostPct   = ((Math.abs(currAvgCost - prevAvgCost) / prevAvgCost) * 100).toFixed(1);
const avgCostUp    = currAvgCost > prevAvgCost;

const currQuality  = ARTICLES.slice(0, Math.ceil(ARTICLES.length / 2)).reduce((s, a) => s + a.qualityScore, 0) / Math.ceil(ARTICLES.length / 2);
const prevQuality  = ARTICLES.slice(Math.ceil(ARTICLES.length / 2)).reduce((s, a) => s + a.qualityScore, 0) / Math.floor(ARTICLES.length / 2);
const qualPct      = ((Math.abs(currQuality - prevQuality) / prevQuality) * 100).toFixed(1);
const qualUp       = currQuality > prevQuality;

// Projected month-end cost based on 7-day daily average
const last7AvgDaily = DAILY_COSTS.slice(-7).reduce((s, d) => s + d.cost, 0) / 7;
const projectedMonthEnd = last7AvgDaily * 30;

// Spark data arrays (14 days each KPI)
const costSparkData     = currWindow.map(d => d.cost);
const artsSparkData     = currWindow.map(d => d.articles);
const avgCostSparkData  = currWindow.map(d => d.cost / Math.max(d.articles, 1));
const qualSparkData     = ARTICLES.slice(0, N).map(a => a.qualityScore);

export default function CostsPage() {
  const [range, setRange] = useState<Range>("30");
  const [sortCol, setSortCol] = useState<"date" | "cost" | "quality">("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  const filteredDays = useMemo(() => {
    if (range === "all") return DAILY_COSTS;
    const n = parseInt(range);
    return DAILY_COSTS.slice(-n);
  }, [range]);

  // Comparison period: same length window before filteredDays
  const comparisonDays = useMemo(() => {
    if (range === "all") return [];
    const n = parseInt(range);
    const prev = DAILY_COSTS.slice(-(n * 2), -n);
    // Align dates to the same X axis by shifting — use index, not date
    return prev.map((d, i) => ({ ...d, _comp: true, date: filteredDays[i]?.date ?? d.date }));
  }, [range, filteredDays]);

  const chartData = useMemo(() => {
    if (!showComparison) return filteredDays;
    return filteredDays.map((d, i) => ({
      ...d,
      prevCost: comparisonDays[i]?.cost,
    }));
  }, [filteredDays, comparisonDays, showComparison]);

  const sortedArticles = useMemo(() => {
    return [...ARTICLES].sort((a, b) => {
      let cmp = 0;
      if (sortCol === "date") cmp = a.date.localeCompare(b.date);
      else if (sortCol === "cost") cmp = a.totalCost - b.totalCost;
      else if (sortCol === "quality") cmp = a.qualityScore - b.qualityScore;
      return sortAsc ? cmp : -cmp;
    });
  }, [sortCol, sortAsc]);

  function toggleSort(col: "date" | "cost" | "quality") {
    if (sortCol === col) setSortAsc((v) => !v);
    else { setSortCol(col); setSortAsc(false); }
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Cost Tracker</h1>
          <p className="text-sm text-zinc-500 mt-0.5">LLM and infrastructure spend analytics</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Forecast pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/30 border border-amber-800/40 text-amber-400 text-xs">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="font-medium">Proj. month-end:</span>
            <span className="font-bold">${projectedMonthEnd.toFixed(2)}</span>
          </div>

          {/* Comparison toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowComparison(v => !v)}
            className={`h-7 px-3 text-xs transition-colors ${showComparison ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-white hover:bg-zinc-800"}`}
          >
            vs prev period
          </Button>

          {/* Range filter */}
          <div className="flex items-center gap-0.5 bg-zinc-900 border border-zinc-800/80 rounded-lg p-1">
            {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
              <Button
                key={r}
                variant="ghost"
                size="sm"
                onClick={() => setRange(r)}
                className={`h-6 px-2.5 text-xs rounded-md transition-colors ${
                  range === r
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-500 hover:text-white hover:bg-zinc-800"
                }`}
              >
                {RANGE_LABELS[r]}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total Cost"
          value={`$${KPI.totalCost.toFixed(2)}`}
          trend={costPct + "%"}
          trendUp={costUp}
          positiveIsUp={false}
          icon={DollarSign}
          iconColor="text-amber-400"
          sparkData={costSparkData}
          sparkColor="#f59e0b"
        />
        <KpiCard
          label="Articles Generated"
          value={String(KPI.totalArticles)}
          trend={artsPct + "%"}
          trendUp={artsUp}
          positiveIsUp={true}
          icon={FileText}
          iconColor="text-blue-400"
          sparkData={artsSparkData}
          sparkColor="#60a5fa"
        />
        <KpiCard
          label="Avg Cost / Article"
          value={`$${KPI.avgCostPerArticle.toFixed(3)}`}
          trend={avgCostPct + "%"}
          trendUp={avgCostUp}
          positiveIsUp={false}
          icon={TrendingDown}
          iconColor="text-emerald-400"
          sparkData={avgCostSparkData}
          sparkColor="#34d399"
        />
        <KpiCard
          label="Avg Quality Score"
          value={`${KPI.avgQualityScore.toFixed(1)}`}
          trend={qualPct + "%"}
          trendUp={qualUp}
          positiveIsUp={true}
          icon={Star}
          iconColor="text-purple-400"
          sparkData={qualSparkData}
          sparkColor="#a78bfa"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Area chart — cost over time */}
        <Card className="bg-zinc-900 border-zinc-800/80 xl:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-white">Cost Over Time</CardTitle>
              {showComparison && (
                <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-0.5 bg-amber-400 rounded" /> Current
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 border-t border-dashed border-zinc-500" /> Previous
                  </span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.04} />
                  </linearGradient>
                  {showComparison && (
                    <linearGradient id="prevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#71717a" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#71717a" stopOpacity={0} />
                    </linearGradient>
                  )}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#52525b", fontSize: 10 }}
                  tickFormatter={(v: string) => v.slice(5)}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: "#52525b", fontSize: 10 }}
                  tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value: unknown, name: unknown) => [
                    `$${(value as number).toFixed(3)}`,
                    name === "prevCost" ? "Prev period" : "Cost",
                  ]}
                  labelFormatter={(l: unknown) => `${l}`}
                />
                {showComparison && (
                  <Area
                    type="monotone"
                    dataKey="prevCost"
                    stroke="#52525b"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    fill="url(#prevGrad)"
                    dot={false}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="cost"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fill="url(#costGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#f59e0b", stroke: "#18181b", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Donut — model distribution */}
        <Card className="bg-zinc-900 border-zinc-800/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-white">Cost by Model</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={MODEL_SHARES}
                  cx="50%"
                  cy="50%"
                  innerRadius={42}
                  outerRadius={68}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {MODEL_SHARES.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value: unknown) => [`${value}%`, ""]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 w-full mt-1">
              {MODEL_SHARES.map((m) => (
                <div key={m.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                    <span className="text-zinc-400 text-[11px]">{m.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-zinc-800 rounded-full h-1">
                      <div
                        className="h-1 rounded-full"
                        style={{ width: `${m.value}%`, backgroundColor: m.color }}
                      />
                    </div>
                    <span className="text-white font-semibold text-[11px] w-7 text-right tabular-nums">{m.value}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stage cost horizontal bar */}
      <Card className="bg-zinc-900 border-zinc-800/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-white">Cost by Pipeline Stage</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={STAGE_COSTS} layout="vertical" margin={{ top: 0, right: 16, left: 120, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: "#52525b", fontSize: 10 }}
                tickFormatter={(v: number) => `$${v.toFixed(3)}`}
              />
              <YAxis
                type="category"
                dataKey="stage"
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                width={115}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(value: unknown) => [`$${(value as number).toFixed(4)}`, "Cost"]}
              />
              <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
                {STAGE_COSTS.map((_, i) => (
                  <Cell
                    key={i}
                    fill={i === 0 ? "#f59e0b" : i === 1 ? "#f59e0b99" : "#f59e0b55"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Articles table */}
      <Card className="bg-zinc-900 border-zinc-800/80">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold text-white">
            Articles <span className="text-zinc-600 font-normal ml-1">({ARTICLES.length})</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-zinc-800 text-zinc-600 text-[10px] gap-1">
              <Zap className="w-2.5 h-2.5" />
              {ARTICLES.filter(a => a.status === "published").length} published
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800/60">
                  <th
                    className="px-4 py-2.5 text-left text-zinc-500 font-medium cursor-pointer hover:text-zinc-300 transition-colors"
                    onClick={() => toggleSort("date")}
                  >
                    <div className="flex items-center gap-1">Date <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-4 py-2.5 text-left text-zinc-500 font-medium">Title</th>
                  <th className="px-4 py-2.5 text-left text-zinc-500 font-medium">Model</th>
                  <th
                    className="px-4 py-2.5 text-right text-zinc-500 font-medium cursor-pointer hover:text-zinc-300 transition-colors"
                    onClick={() => toggleSort("cost")}
                  >
                    <div className="flex items-center justify-end gap-1">Cost <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-4 py-2.5 text-right text-zinc-500 font-medium">Tokens</th>
                  <th
                    className="px-4 py-2.5 text-right text-zinc-500 font-medium cursor-pointer hover:text-zinc-300 transition-colors"
                    onClick={() => toggleSort("quality")}
                  >
                    <div className="flex items-center justify-end gap-1">Quality <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-4 py-2.5 text-left text-zinc-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedArticles.map((article) => {
                  const sc = STATUS_CONFIG[article.status];
                  const totalTokens = article.tokensIn + article.tokensOut;
                  return (
                    <tr
                      key={article.id}
                      className="border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors group"
                    >
                      <td className="px-4 py-2.5 text-zinc-600 whitespace-nowrap tabular-nums">{article.date}</td>
                      <td className="px-4 py-2.5 text-zinc-200 max-w-[260px] group-hover:text-white transition-colors">
                        <span className="truncate block">{article.title}</span>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500 whitespace-nowrap text-[11px]">{article.model}</td>
                      <td className="px-4 py-2.5 text-right text-amber-400 font-medium whitespace-nowrap tabular-nums">
                        ${article.totalCost.toFixed(4)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-zinc-500 whitespace-nowrap tabular-nums">
                        {totalTokens.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-10 bg-zinc-800 rounded-full h-1">
                            <div
                              className={`h-1 rounded-full ${
                                article.qualityScore >= 85 ? "bg-emerald-500" :
                                article.qualityScore >= 75 ? "bg-amber-500" : "bg-rose-500"
                              }`}
                              style={{ width: `${article.qualityScore}%` }}
                            />
                          </div>
                          <span className={`font-semibold tabular-nums ${
                            article.qualityScore >= 85 ? "text-emerald-400" :
                            article.qualityScore >= 75 ? "text-amber-400" : "text-rose-400"
                          }`}>
                            {article.qualityScore}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={`text-[10px] gap-1 ${sc.color}`}>
                          <sc.icon className="w-2.5 h-2.5" />
                          {sc.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
