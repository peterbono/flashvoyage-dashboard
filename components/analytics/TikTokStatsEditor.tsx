"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Video,
  Plus,
  Trash2,
  Save,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types — mirror of /api/tiktok/stats route (kept local to avoid a client
// bundle pulling in server-side github helpers).
// ---------------------------------------------------------------------------

interface TikTokAccount {
  followers: number;
  following: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  daysSinceStart: number;
}

interface TikTokVideo {
  title: string;
  format?: string;
  date: string;
  duration?: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  visibility?: string;
}

interface TikTokStats {
  lastUpdated: string;
  account: TikTokAccount;
  videos: TikTokVideo[];
}

type SaveState = "idle" | "saving" | "done" | "error";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ReelSuggestion {
  /** Short cleaned title (first line of caption, emoji stripped) */
  title: string;
  /** Which platforms already have this reel — helps the founder identify cross-posts */
  platforms: ("instagram" | "facebook")[];
}

interface Props {
  /** Optional: IG + FB published reels, used to populate title autocomplete.
   *  Since the same reel is typically cross-posted to TikTok, the founder can
   *  pick an existing title instead of retyping. */
  suggestedTitles?: ReelSuggestion[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_VIDEO: TikTokVideo = {
  title: "",
  date: new Date().toISOString().slice(0, 10),
  views: 0,
  likes: 0,
  comments: 0,
  shares: 0,
};

// Common reel formats observed in existing entries + pipeline's suggestedFormats.
// Also rendered as a datalist so the founder picks from known tags instead of
// inventing new ones that would fragment analytics.
const KNOWN_FORMATS = [
  "pick",
  "budget",
  "versus",
  "poll",
  "humor",
  "avantapres",
  "story",
  "guide",
];

function recomputeTotals(videos: TikTokVideo[]): Pick<
  TikTokAccount,
  "totalViews" | "totalLikes" | "totalComments" | "totalShares"
> {
  return videos.reduce(
    (acc, v) => ({
      totalViews: acc.totalViews + (v.views || 0),
      totalLikes: acc.totalLikes + (v.likes || 0),
      totalComments: acc.totalComments + (v.comments || 0),
      totalShares: acc.totalShares + (v.shares || 0),
    }),
    { totalViews: 0, totalLikes: 0, totalComments: 0, totalShares: 0 },
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Manual editor for TikTok stats.
 *
 * Why this exists: TikTok API app review is still pending, so the dashboard
 * can't auto-fetch the account + video stats. The founder exports numbers
 * from TikTok Studio and pastes them here — the editor writes back to
 * `data/tiktok-stats.json` in the content repo, which /api/social-stats
 * reads on every analytics page load.
 *
 * Design: disclosure panel collapsed by default so it doesn't clutter the
 * analytics view. When expanded, shows 2 sections — account aggregates and
 * a videos table (add/edit/delete rows). "Auto-compute totals" toggle
 * recomputes totals from the video list on save.
 */
export function TikTokStatsEditor({ suggestedTitles = [] }: Props = {}) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [stats, setStats] = useState<TikTokStats | null>(null);
  const [autoTotals, setAutoTotals] = useState(true);

  // Load on first expand — avoids fetching if the founder never opens the editor.
  const loadStats = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/tiktok/stats", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as TikTokStats;
      setStats(json);
    } catch (err) {
      console.error("[tiktok-editor] load", err);
      setLoadError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (expanded && !stats && !loading) {
      loadStats();
    }
  }, [expanded, stats, loading, loadStats]);

  const updateAccount = useCallback(
    (patch: Partial<TikTokAccount>) => {
      setStats((prev) =>
        prev ? { ...prev, account: { ...prev.account, ...patch } } : prev,
      );
    },
    [],
  );

  const updateVideo = useCallback(
    (idx: number, patch: Partial<TikTokVideo>) => {
      setStats((prev) => {
        if (!prev) return prev;
        const next = prev.videos.slice();
        next[idx] = { ...next[idx], ...patch };
        return { ...prev, videos: next };
      });
    },
    [],
  );

  const addVideo = useCallback(() => {
    setStats((prev) =>
      prev ? { ...prev, videos: [{ ...EMPTY_VIDEO }, ...prev.videos] } : prev,
    );
  }, []);

  const deleteVideo = useCallback((idx: number) => {
    setStats((prev) => {
      if (!prev) return prev;
      const next = prev.videos.slice();
      next.splice(idx, 1);
      return { ...prev, videos: next };
    });
  }, []);

  const save = useCallback(async () => {
    if (!stats) return;
    setSaveState("saving");
    try {
      const videos = stats.videos.filter((v) => v.title.trim() && v.date.trim());
      const account = autoTotals
        ? { ...stats.account, ...recomputeTotals(videos) }
        : stats.account;

      const res = await fetch("/api/tiktok/stats", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, videos }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as TikTokStats;
      setStats(json);
      setSaveState("done");
      setTimeout(() => setSaveState("idle"), 4000);
    } catch (err) {
      console.error("[tiktok-editor] save", err);
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 5000);
    }
  }, [stats, autoTotals]);

  return (
    <Card className="bg-zinc-900/40 border-zinc-800/60 rounded-xl">
      <CardHeader className="pb-2 px-4 pt-4">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="w-full flex items-center justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 rounded-sm"
        >
          <CardTitle className="flex items-center gap-2 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            <Video className="w-3.5 h-3.5 text-pink-400" />
            TikTok manual entry
            {stats ? (
              <span className="text-[10px] font-normal text-zinc-400 normal-case">
                · {stats.videos.length} videos · last updated {stats.lastUpdated}
              </span>
            ) : null}
          </CardTitle>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          )}
        </button>
      </CardHeader>
      {expanded && (
        <CardContent className="px-4 pb-4">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-zinc-500 py-4">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading stats…
            </div>
          ) : loadError ? (
            <div className="text-xs text-red-400 py-2">
              Failed to load: {loadError}
              <button
                onClick={loadStats}
                className="ml-2 underline hover:text-red-300"
              >
                Retry
              </button>
            </div>
          ) : !stats ? null : (
            <div className="space-y-4">
              {/* ── Account ─────────────────────────────────────── */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    Account
                  </h3>
                  <label className="flex items-center gap-1.5 text-[10px] text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoTotals}
                      onChange={(e) => setAutoTotals(e.target.checked)}
                      className="w-3 h-3 accent-pink-500"
                    />
                    Auto-compute totals from videos
                  </label>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(
                    [
                      ["followers", "Followers"],
                      ["following", "Following"],
                      ["totalViews", "Total views"],
                      ["totalLikes", "Total likes"],
                      ["totalComments", "Total comments"],
                      ["totalShares", "Total shares"],
                      ["daysSinceStart", "Days since start"],
                    ] as Array<[keyof TikTokAccount, string]>
                  ).map(([key, label]) => {
                    const isTotal =
                      key === "totalViews" ||
                      key === "totalLikes" ||
                      key === "totalComments" ||
                      key === "totalShares";
                    const disabled = autoTotals && isTotal;
                    const displayValue = disabled
                      ? recomputeTotals(stats.videos)[
                          key as keyof ReturnType<typeof recomputeTotals>
                        ]
                      : stats.account[key];
                    return (
                      <label key={key} className="flex flex-col gap-1">
                        <span className="text-[10px] text-zinc-500">{label}</span>
                        <input
                          type="number"
                          min={0}
                          value={displayValue}
                          disabled={disabled}
                          onChange={(e) =>
                            updateAccount({
                              [key]: Number(e.target.value) || 0,
                            })
                          }
                          className="bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1 text-xs text-zinc-200 tabular-nums focus:outline-none focus:border-pink-500/60 disabled:opacity-50"
                        />
                      </label>
                    );
                  })}
                </div>
              </section>

              {/* ── Videos ──────────────────────────────────────── */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    Videos ({stats.videos.length})
                  </h3>
                  <button
                    type="button"
                    onClick={addVideo}
                    className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                  >
                    <Plus className="w-3 h-3" /> Add video
                  </button>
                </div>
                {/* Autocomplete sources — browser-native datalists. The title
                    list comes from IG + FB reels actually published, so the
                    founder can pick a cross-posted reel instead of retyping.
                    Format list stays stable (pipeline-canonical tags) to
                    avoid analytics fragmentation. */}
                <datalist id="tiktok-title-suggestions">
                  {suggestedTitles.map((s) => (
                    <option
                      key={s.title}
                      value={s.title}
                      label={
                        s.platforms.length > 1
                          ? `${s.platforms.join(" + ")}`
                          : s.platforms[0]
                      }
                    />
                  ))}
                </datalist>
                <datalist id="tiktok-format-suggestions">
                  {KNOWN_FORMATS.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
                {suggestedTitles.length > 0 ? (
                  <p className="text-[10px] text-zinc-500 mb-2">
                    Start typing in the title field to see suggestions from{" "}
                    {suggestedTitles.length} reels already published on IG/FB.
                  </p>
                ) : null}
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] tabular-nums">
                    <thead>
                      <tr className="text-zinc-500 text-left">
                        <th className="py-1 pr-2 font-normal">Date</th>
                        <th className="py-1 pr-2 font-normal">Title</th>
                        <th className="py-1 pr-2 font-normal">Format</th>
                        <th className="py-1 pr-2 font-normal">Views</th>
                        <th className="py-1 pr-2 font-normal">Likes</th>
                        <th className="py-1 pr-2 font-normal">Comm.</th>
                        <th className="py-1 pr-2 font-normal">Shares</th>
                        <th className="py-1 pr-2 font-normal" />
                      </tr>
                    </thead>
                    <tbody>
                      {stats.videos.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="text-center text-zinc-600 py-4"
                          >
                            No videos yet — click &ldquo;Add video&rdquo;.
                          </td>
                        </tr>
                      ) : (
                        stats.videos.map((v, idx) => (
                          <tr
                            key={idx}
                            className="border-t border-zinc-800/50 hover:bg-zinc-800/20"
                          >
                            <td className="py-1 pr-2">
                              <input
                                type="date"
                                value={v.date}
                                onChange={(e) =>
                                  updateVideo(idx, { date: e.target.value })
                                }
                                className="bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-[11px] text-zinc-200 focus:outline-none focus:border-pink-500/60"
                              />
                            </td>
                            <td className="py-1 pr-2 min-w-[180px]">
                              <input
                                type="text"
                                value={v.title}
                                placeholder="Video title"
                                list="tiktok-title-suggestions"
                                onChange={(e) =>
                                  updateVideo(idx, { title: e.target.value })
                                }
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-[11px] text-zinc-200 focus:outline-none focus:border-pink-500/60"
                              />
                            </td>
                            <td className="py-1 pr-2">
                              <input
                                type="text"
                                value={v.format ?? ""}
                                placeholder="e.g. pick"
                                list="tiktok-format-suggestions"
                                onChange={(e) =>
                                  updateVideo(idx, { format: e.target.value })
                                }
                                className="w-20 bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-[11px] text-zinc-200 focus:outline-none focus:border-pink-500/60"
                              />
                            </td>
                            {(
                              ["views", "likes", "comments", "shares"] as const
                            ).map((field) => (
                              <td key={field} className="py-1 pr-2">
                                <input
                                  type="number"
                                  min={0}
                                  value={v[field]}
                                  onChange={(e) =>
                                    updateVideo(idx, {
                                      [field]: Number(e.target.value) || 0,
                                    })
                                  }
                                  className="w-20 bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-[11px] text-zinc-200 tabular-nums focus:outline-none focus:border-pink-500/60"
                                />
                              </td>
                            ))}
                            <td className="py-1 pr-2">
                              <button
                                type="button"
                                onClick={() => deleteVideo(idx)}
                                className="text-zinc-500 hover:text-red-400"
                                aria-label={`Delete "${v.title}"`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* ── Save bar ────────────────────────────────────── */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                <span className="text-[10px] text-zinc-500">
                  Writes to <code className="text-zinc-400">data/tiktok-stats.json</code> in
                  the content repo on save.
                </span>
                <button
                  type="button"
                  onClick={save}
                  disabled={saveState === "saving" || saveState === "done"}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-colors ${
                    saveState === "done"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                      : saveState === "error"
                      ? "border-red-500/40 bg-red-500/10 text-red-400"
                      : "border-pink-500/40 bg-pink-500/10 text-pink-300 hover:bg-pink-500/20 disabled:opacity-50"
                  }`}
                >
                  {saveState === "saving" ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : saveState === "done" ? (
                    <Check className="w-3 h-3" />
                  ) : saveState === "error" ? (
                    <X className="w-3 h-3" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                  {saveState === "saving"
                    ? "Saving…"
                    : saveState === "done"
                    ? "Saved"
                    : saveState === "error"
                    ? "Failed — retry"
                    : "Save stats"}
                </button>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
