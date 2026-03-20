"use client";

import { useState, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/costs/KpiCard";
import { DAILY_COSTS, MODEL_SHARES, STAGE_COSTS, ARTICLES, KPI } from "@/components/costs/mockCostData";
import { DollarSign, FileText, TrendingDown, Star, ArrowUpDown, CheckCircle2, Clock, XCircle } from "lucide-react";

type Range = "7" | "30" | "90" | "all";

const RANGE_LABELS: Record<Range, string> = {
  "7": "Last 7 days",
  "30": "Last 30 days",
  "90": "Last 90 days",
  "all": "All time",
};

const STATUS_CONFIG = {
  published: { label: "Published", color: "text-emerald-400 border-emerald-800 bg-emerald-950/40", icon: CheckCircle2 },
  review:    { label: "Review",    color: "text-amber-400 border-amber-800 bg-amber-950/40",       icon: Clock },
  failed:    { label: "Failed",    color: "text-red-400 border-red-800 bg-red-950/40",             icon: XCircle },
};

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "12px",
};

export default function CostsPage() {
  const [range, setRange] = useState<Range>("30");
  const [sortCol, setSortCol] = useState<"date" | "cost" | "quality">("date");
  const [sortAsc, setSortAsc] = useState(false);

  const filteredDays = useMemo(() => {
    if (range === "all") return DAILY_COSTS;
    const n = parseInt(range);
    return DAILY_COSTS.slice(-n);
  }, [range]);

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
    <div className="p-6 space-y-6 overflow-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cost Tracker</h1>
          <p className="text-sm text-zinc-400 mt-0.5">LLM and infrastructure spend analytics</p>
        </div>
        {/* Range filter */}
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
            <Button
              key={r}
              variant="ghost"
              size="sm"
              onClick={() => setRange(r)}
              className={`h-7 px-3 text-xs rounded-md transition-colors ${
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

      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total Cost"
          value={`$${KPI.totalCost.toFixed(2)}`}
          trend="8%"
          trendUp={false}
          icon={DollarSign}
          iconColor="text-amber-400"
        />
        <KpiCard
          label="Articles Generated"
          value={String(KPI.totalArticles)}
          trend="12%"
          trendUp={true}
          icon={FileText}
          iconColor="text-blue-400"
        />
        <KpiCard
          label="Avg Cost / Article"
          value={`$${KPI.avgCostPerArticle.toFixed(3)}`}
          trend="3%"
          trendUp={false}
          icon={TrendingDown}
          iconColor="text-emerald-400"
        />
        <KpiCard
          label="Avg Quality Score"
          value={`${KPI.avgQualityScore.toFixed(1)}`}
          trend="2%"
          trendUp={false}
          icon={Star}
          iconColor="text-purple-400"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Area chart — cost over time */}
        <Card className="bg-zinc-900 border-zinc-800 xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-white">Cost Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={filteredDays} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  tickFormatter={(v: string) => v.slice(5)}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value: unknown) => [`$${(value as number).toFixed(3)}`, "Cost"]}
                  labelFormatter={(l: unknown) => `Date: ${l}`}
                />
                <Area type="monotone" dataKey="cost" stroke="#f59e0b" strokeWidth={2} fill="url(#costGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Donut — model distribution */}
        <Card className="bg-zinc-900 border-zinc-800">
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
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
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
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                    <span className="text-zinc-400">{m.name}</span>
                  </div>
                  <span className="text-white font-medium">{m.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stage cost horizontal bar */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-white">Cost by Pipeline Stage</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={STAGE_COSTS} layout="vertical" margin={{ top: 0, right: 12, left: 100, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: "#71717a", fontSize: 10 }}
                tickFormatter={(v: number) => `$${v.toFixed(3)}`}
              />
              <YAxis
                type="category"
                dataKey="stage"
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                width={95}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(value: unknown) => [`$${(value as number).toFixed(4)}`, "Cost"]}
              />
              <Bar dataKey="cost" fill="#f59e0b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Articles table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold text-white">Articles ({ARTICLES.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th
                    className="px-4 py-2.5 text-left text-zinc-500 font-medium cursor-pointer hover:text-white transition-colors"
                    onClick={() => toggleSort("date")}
                  >
                    <div className="flex items-center gap-1">Date <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-4 py-2.5 text-left text-zinc-500 font-medium">Title</th>
                  <th className="px-4 py-2.5 text-left text-zinc-500 font-medium">Model</th>
                  <th
                    className="px-4 py-2.5 text-right text-zinc-500 font-medium cursor-pointer hover:text-white transition-colors"
                    onClick={() => toggleSort("cost")}
                  >
                    <div className="flex items-center justify-end gap-1">Cost <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-4 py-2.5 text-right text-zinc-500 font-medium">Tokens</th>
                  <th
                    className="px-4 py-2.5 text-right text-zinc-500 font-medium cursor-pointer hover:text-white transition-colors"
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
                  return (
                    <tr key={article.id} className="border-b border-zinc-800/60 hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-2.5 text-zinc-500 whitespace-nowrap">{article.date}</td>
                      <td className="px-4 py-2.5 text-white max-w-[280px]">
                        <span className="truncate block">{article.title}</span>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-400 whitespace-nowrap">{article.model}</td>
                      <td className="px-4 py-2.5 text-right text-amber-400 font-medium whitespace-nowrap">${article.totalCost.toFixed(4)}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-400 whitespace-nowrap">{(article.tokensIn + article.tokensOut).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`font-semibold ${article.qualityScore >= 85 ? "text-emerald-400" : article.qualityScore >= 75 ? "text-amber-400" : "text-red-400"}`}>
                          {article.qualityScore}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
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
