"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown, TrendingUp, LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  icon: LucideIcon;
  iconColor: string;
}

export function KpiCard({ label, value, trend, trendUp, icon: Icon, iconColor }: Props) {
  return (
    <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/60 transition-all duration-200 group">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{label}</CardTitle>
        <div className={`p-1.5 rounded-md bg-zinc-800 group-hover:bg-zinc-700/80 transition-colors ${iconColor}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
        {trend && (
          <div className={`flex items-center gap-1 text-[11px] mt-1.5 font-medium ${trendUp ? "text-rose-400" : "text-emerald-400"}`}>
            {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{trend} vs last period</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
