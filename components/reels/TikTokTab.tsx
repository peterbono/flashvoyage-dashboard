"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import { usePolling } from "@/lib/usePolling";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Video, TrendingUp, Eye, Heart, Users, Upload, Check, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TikTokVideo {
  title: string;
  format: string;
  date: string;
  duration: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  visibility?: string;
}

interface FormatSummary {
  format: string;
  videos: number;
  avgViews: number;
  avgLikes: number;
  likeRate: number;
  verdict: string;
}

interface TikTokStats {
  account: {
    followers: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
  };
  videos: TikTokVideo[];
  formatSummary: FormatSummary[];
  lastUpdated: string;
}

const VERDICT_COLORS: Record<string, string> = {
  STAR: "text-amber-400 bg-amber-500/10",
  "Good reach": "text-emerald-400 bg-emerald-500/10",
  OK: "text-blue-400 bg-blue-500/10",
  Weak: "text-zinc-500 bg-zinc-700/30",
  "Low reach": "text-zinc-500 bg-zinc-700/30",
  DEAD: "text-rose-400 bg-rose-500/10",
  "Too early": "text-zinc-500 bg-zinc-700/30",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// CSV Parser — TikTok Studio export format
// ---------------------------------------------------------------------------

function parseTikTokCSV(text: string): TikTokVideo[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  // Detect separator
  const sep = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase());

  return lines.slice(1).map((line) => {
    const cols = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cols[i] || ""; });

    return {
      title: row["title"] || row["video title"] || row["titre"] || "Untitled",
      format: row["format"] || guessFormat(row["title"] || row["video title"] || row["titre"] || ""),
      date: row["date"] || row["post date"] || row["date de publication"] || new Date().toISOString().slice(0, 10),
      duration: parseInt(row["duration"] || row["duree"] || "0", 10),
      views: parseInt(row["views"] || row["video views"] || row["vues"] || "0", 10),
      likes: parseInt(row["likes"] || "0", 10),
      comments: parseInt(row["comments"] || row["commentaires"] || "0", 10),
      shares: parseInt(row["shares"] || row["partages"] || "0", 10),
    };
  }).filter((v) => v.title !== "Untitled" || v.views > 0);
}

function guessFormat(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("spot") || t.includes("pick")) return "pick";
  if (t.includes("budget") || t.includes("astuce")) return "budget";
  if (t.includes("expect") || t.includes("avant") || t.includes("reality")) return "avantapres";
  if (t.includes("vs") || t.includes("versus")) return "versus";
  if (t.includes("humor") || t.includes("quand")) return "humor";
  if (t.includes("best time") || t.includes("quand partir")) return "best-time";
  if (t.includes("leaderboard") || t.includes("top")) return "leaderboard";
  if (t.includes("cost") || t.includes("cout")) return "cost-vs";
  return "pick";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TikTokTab() {
  const { data: raw, loading, refetch } = usePolling<TikTokStats>(
    "/api/data/tiktok-stats.json",
    300_000
  );
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    if (!raw) return null;
    const d = raw as unknown as { data?: TikTokStats };
    return d?.data ?? (raw as TikTokStats);
  }, [raw]);

  const handleCSVUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const text = await file.text();
      const videos = parseTikTokCSV(text);

      if (videos.length === 0) {
        setUploadResult("No videos found in CSV");
        return;
      }

      // Merge with existing data (keep manual entries, update matching ones)
      const existing = stats?.videos || [];
      const merged = [...existing];
      for (const v of videos) {
        const idx = merged.findIndex(
          (m) => m.title === v.title || (m.date === v.date && m.views === v.views)
        );
        if (idx >= 0) merged[idx] = v;
        else merged.push(v);
      }

      const res = await fetch("/api/tiktok/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videos: merged }),
      });

      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);

      setUploadResult(`${videos.length} videos uploaded`);
      // Refresh data after a short delay (GitHub cache)
      setTimeout(() => refetch(), 3000);
    } catch (err) {
      setUploadResult(`Error: ${err}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [stats, refetch]);

  if (loading || !stats) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-zinc-900 border-zinc-800/80">
              <CardContent className="py-3">
                <div className="animate-pulse space-y-2">
                  <div className="h-3 w-16 bg-zinc-700 rounded" />
                  <div className="h-5 w-10 bg-zinc-800 rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const a = stats.account;
  const publicVideos = stats.videos?.filter((v) => v.visibility !== "private") || [];

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Eye, label: "Total Views", value: a.totalViews.toLocaleString("en-US"), color: "text-cyan-400" },
          { icon: Heart, label: "Likes", value: String(a.totalLikes), color: "text-pink-400" },
          { icon: Users, label: "Followers", value: String(a.followers), color: "text-amber-400" },
          { icon: Video, label: "Videos", value: String(publicVideos.length), color: "text-violet-400" },
        ].map((kpi) => (
          <Card key={kpi.label} className="bg-zinc-900 border-zinc-800/80">
            <CardContent className="py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <kpi.icon className={`w-3 h-3 ${kpi.color}`} />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{kpi.label}</span>
              </div>
              <div className="text-lg font-bold text-white">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Format matrix */}
      <Card className="bg-zinc-900 border-zinc-800/80">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-white">Format Performance</span>
            <Badge variant="outline" className="ml-auto text-[10px] bg-zinc-800 border-zinc-700 text-zinc-400">
              Updated {stats.lastUpdated}
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-2 text-zinc-500 font-medium">Format</th>
                  <th className="text-right py-2 text-zinc-500 font-medium">Videos</th>
                  <th className="text-right py-2 text-zinc-500 font-medium">Avg Views</th>
                  <th className="text-right py-2 text-zinc-500 font-medium">Avg Likes</th>
                  <th className="text-right py-2 text-zinc-500 font-medium">Like Rate</th>
                  <th className="text-right py-2 text-zinc-500 font-medium">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {(stats.formatSummary || []).map((row) => (
                  <tr key={row.format} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="py-2 text-zinc-300 font-medium">{row.format}</td>
                    <td className="py-2 text-right text-zinc-400">{row.videos}</td>
                    <td className="py-2 text-right text-zinc-300">{row.avgViews}</td>
                    <td className="py-2 text-right text-zinc-300">{row.avgLikes}</td>
                    <td className="py-2 text-right text-zinc-300">{row.likeRate}%</td>
                    <td className="py-2 text-right">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${VERDICT_COLORS[row.verdict] || "text-zinc-500"}`}>
                        {row.verdict}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 mt-3">
            <p className="text-[10px] text-zinc-600 flex-1">
              Data from tiktok-stats.json
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              className="hidden"
              onChange={handleCSVUpload}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-7 border-zinc-700 text-zinc-400 hover:text-white"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : uploadResult ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Upload className="w-3 h-3" />
              )}
              {uploading ? "Uploading..." : uploadResult || "Import CSV"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Individual videos */}
      <Card className="bg-zinc-900 border-zinc-800/80">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-4">
            <Video className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold text-white">All Videos</span>
            <Badge variant="outline" className="ml-auto text-[10px] bg-zinc-800 border-zinc-700 text-zinc-400">
              {publicVideos.length} public
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-2 text-zinc-500 font-medium">Title</th>
                  <th className="text-left py-2 text-zinc-500 font-medium">Format</th>
                  <th className="text-right py-2 text-zinc-500 font-medium">Date</th>
                  <th className="text-right py-2 text-zinc-500 font-medium">Views</th>
                  <th className="text-right py-2 text-zinc-500 font-medium">Likes</th>
                  <th className="text-right py-2 text-zinc-500 font-medium">Rate</th>
                </tr>
              </thead>
              <tbody>
                {publicVideos
                  .sort((a, b) => b.views - a.views)
                  .map((v, i) => (
                    <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="py-2 text-zinc-300 max-w-[200px] truncate">{v.title}</td>
                      <td className="py-2 text-zinc-400">{v.format}</td>
                      <td className="py-2 text-right text-zinc-500">{v.date.slice(5)}</td>
                      <td className="py-2 text-right text-zinc-300">{v.views}</td>
                      <td className="py-2 text-right text-zinc-300">{v.likes}</td>
                      <td className="py-2 text-right text-zinc-300">
                        {v.views > 0 ? ((v.likes / v.views) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
