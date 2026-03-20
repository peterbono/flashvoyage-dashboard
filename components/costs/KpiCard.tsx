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
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">{label}</CardTitle>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-white">{value}</div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs mt-1 ${trendUp ? "text-red-400" : "text-emerald-400"}`}>
            {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend} vs last period
          </div>
        )}
      </CardContent>
    </Card>
  );
}
