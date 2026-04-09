"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { PLATFORM_COLORS } from "@/lib/platform-colors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Publication {
  platform: string;
  type: string;
  impressions: number;
  interactions: number;
  caption?: string;
}

interface Props {
  data: {
    formatScores: Record<string, number>;
    killedFormats: string[];
  } | null;
  publications?: Publication[];
  loading: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize a string: lowercase + strip diacritics (é→e, à→a, etc.) */
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function guessFormat(caption: string): string {
  const c = norm(caption);
  if (c.includes("spot") || c.includes("pick") || c.includes("rater") || c.includes("incontournable")) return "pick";
  if (c.includes("budget") || c.includes("cout") || c.includes("prix") || c.includes("cher") || c.includes("journalier")) return "budget";
  if (c.includes("expect") || c.includes("reality") || c.includes("avant") || c.includes("apres") || c.includes("realite")) return "avantapres";
  if (c.includes("vs") || c.includes("moins cher") || c.includes("compare") || c.includes("comparatif") || c.includes("lequel")) return "cost-vs";
  if (c.includes("top") || c.includes("classement") || c.includes("leaderboard") || c.includes("ranking")) return "leaderboard";
  if (c.includes("humor") || c.includes("quand tu") || c.includes("meme") || c.includes("drole")) return "humor";
  if (c.includes("quand") || c.includes("best time") || c.includes("saison") || c.includes("meilleur") || c.includes("partir")) return "best-time";
  if (c.includes("mois") || c.includes("ou aller") || c.includes("ou partir") || c.includes("destination")) return "month";
  return "other";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FormatPerformanceChart({ data, publications, loading }: Props) {
  // Build per-format × per-platform data from publications
  const chartData = useMemo(() => {
    if (!data?.formatScores) return [];

    // If we have publications, compute real per-platform breakdown
    const formatPlatformData: Record<string, { ig: number; fb: number; tt: number; count: Record<string, number> }> = {};

    if (publications && publications.length > 0) {
      for (const pub of publications) {
        const format = guessFormat(pub.caption || "");
        if (!formatPlatformData[format]) {
          formatPlatformData[format] = { ig: 0, fb: 0, tt: 0, count: { ig: 0, fb: 0, tt: 0 } };
        }
        const d = formatPlatformData[format];
        if (pub.platform === "instagram") { d.ig += pub.impressions; d.count.ig++; }
        else if (pub.platform === "facebook") { d.fb += pub.impressions; d.count.fb++; }
        else if (pub.platform === "tiktok") { d.tt += pub.impressions; d.count.tt++; }
      }
    }

    return Object.entries(data.formatScores)
      .filter(([, score]) => score > 0)
      .map(([format, score]) => {
        const pd = formatPlatformData[format];
        return {
          format,
          score,
          ig: pd ? (pd.count.ig > 0 ? Math.round(pd.ig / pd.count.ig) : 0) : 0,
          fb: pd ? (pd.count.fb > 0 ? Math.round(pd.fb / pd.count.fb) : 0) : 0,
          tt: pd ? (pd.count.tt > 0 ? Math.round(pd.tt / pd.count.tt) : 0) : 0,
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [data, publications]);

  const hasPublications = publications && publications.length > 0;

  if (loading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800/80">
        <CardContent className="py-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-48 bg-zinc-700 rounded" />
            <div className="h-48 bg-zinc-800 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800/80">
      <CardContent className="py-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-white">
            Format Performance
          </span>
          <Badge
            variant="outline"
            className="ml-auto text-[10px] bg-zinc-800 border-zinc-700 text-zinc-400"
          >
            {hasPublications ? "Avg Impressions" : "Score IG"}
          </Badge>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            {hasPublications ? (
              // Multi-platform bars (Metricool-style)
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="format"
                  width={90}
                  tick={{ fill: "#a1a1aa", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#e4e4e7" }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }}
                />
                <Bar
                  dataKey="ig"
                  name="Instagram"
                  fill={PLATFORM_COLORS.instagram.hex}
                  radius={[0, 3, 3, 0]}
                />
                <Bar
                  dataKey="fb"
                  name="Facebook"
                  fill={PLATFORM_COLORS.facebook.hex}
                  radius={[0, 3, 3, 0]}
                />
                <Bar
                  dataKey="tt"
                  name="TikTok"
                  fill={PLATFORM_COLORS.tiktok.hex}
                  radius={[0, 3, 3, 0]}
                />
              </BarChart>
            ) : (
              // Fallback: single score bar (when no publications data)
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="format"
                  width={90}
                  tick={{ fill: "#a1a1aa", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #3f3f46",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value) => [String(value), "Score"]}
                />
                <Bar dataKey="score" fill="#eab308" radius={[0, 4, 4, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
