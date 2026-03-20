"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DayPoint { day: string; articles: number; cost: number }

interface TooltipProps {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs shadow-xl">
      <p className="text-zinc-400 font-semibold mb-0.5">{label}</p>
      <p className="text-white font-bold">{payload[0].value} articles</p>
    </div>
  );
}

interface Props {
  data: DayPoint[];
}

export function WeeklyThroughputChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={64}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="wt-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="day"
          tick={{ fill: "#52525b", fontSize: 9 }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <YAxis hide domain={[0, "auto"]} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#3f3f46", strokeWidth: 1 }} />
        <Area
          type="monotone"
          dataKey="articles"
          stroke="#f59e0b"
          strokeWidth={1.5}
          fill="url(#wt-grad)"
          dot={false}
          activeDot={{ r: 3, fill: "#f59e0b", stroke: "#18181b", strokeWidth: 1.5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
