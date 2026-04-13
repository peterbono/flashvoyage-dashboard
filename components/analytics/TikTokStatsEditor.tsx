"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Video,
  Save,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Loader2,
  Upload,
  FileText,
  ExternalLink,
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
type ParseState =
  | { status: "idle" }
  | { status: "parsing" }
  | { status: "parsed"; count: number; filename: string }
  | { status: "error"; message: string };

/** Persistent "last successful save" receipt — survives transient UI state and
 *  is stored in localStorage so the founder always has proof the save landed,
 *  even if the page crashes or the "Saved" toast disappears before they see it. */
interface SaveReceipt {
  at: string; // ISO timestamp
  videoCount: number;
  followers: number;
  commitFileUrl: string; // deep link to data/tiktok-stats.json on GitHub
}

const RECEIPT_STORAGE_KEY = "fv-tiktok-save-receipt-v1";
const CONTENT_FILE_URL =
  "https://github.com/peterbono/flashvoyage-ultra-content/blob/main/data/tiktok-stats.json";

// ---------------------------------------------------------------------------
// CSV parser — handles the TikTok Studio "Content" export format
// ---------------------------------------------------------------------------

/** Parse a single CSV line with standard quoted-field rules. */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && inQuotes && line[i + 1] === '"') {
      field += '"';
      i++;
    } else if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      result.push(field);
      field = "";
    } else {
      field += c;
    }
  }
  result.push(field);
  return result;
}

const FR_MONTHS = [
  "janvier",
  "février",
  "fevrier",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "aout",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
  "decembre",
] as const;

const FR_MONTH_INDEX: Record<string, number> = {
  janvier: 0,
  février: 1,
  fevrier: 1,
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  août: 7,
  aout: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  décembre: 11,
  decembre: 11,
};

/** "4 avril" (or "4 avril 2026") → "2026-04-04". Defaults to current year. */
function parseFrenchDate(raw: string): string {
  const today = new Date();
  const fallback = today.toISOString().slice(0, 10);
  if (!raw) return fallback;
  const m = raw.trim().toLowerCase().match(/^(\d{1,2})\s+([a-zéû]+)(?:\s+(\d{4}))?/i);
  if (!m) return fallback;
  const day = Number(m[1]);
  const monthKey = FR_MONTHS.find((mm) => m[2].startsWith(mm));
  if (!monthKey) return fallback;
  const month = FR_MONTH_INDEX[monthKey];
  const year = m[3] ? Number(m[3]) : today.getUTCFullYear();
  const d = new Date(Date.UTC(year, month, day));
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toISOString().slice(0, 10);
}

/** Trim hashtags + normalize whitespace; prefer first sentence/segment. */
function shortenTitle(raw: string): string {
  if (!raw) return "";
  // Strip hashtags + mentions for a cleaner display title
  const noTags = raw.replace(/#\S+/g, "").replace(/@\S+/g, "");
  // First line or sentence-ish break — TikTok captions often run the full
  // caption as the "title", which is too long for analytics display.
  const firstSegment =
    noTags.split(/\n|!|\?|…|\s•\s/)[0]?.trim() || noTags.trim();
  return firstSegment.replace(/\s+/g, " ").slice(0, 90).trim();
}

/** Heuristic format detection from the full caption's hashtags + keywords. */
function detectFormat(caption: string): string | undefined {
  const lower = caption.toLowerCase();
  // FV-FIX 2026-04-14: broadened pick/listicle regex — kept in sync with
  // performance-scorer.js detectFormatFromTitle() server-side.
  // Catches FR nouns: spots/plats/choses/lieux/endroits/raisons/erreurs/pièges/astuces.
  if (/#trippick|\b\d+\s+(spots?|plats|choses|lieux|endroits|raisons|erreurs|pi[eè]ges|astuces|incontournables?)\b|\btop\s*\d/.test(lower)) return "pick";
  if (/#budget|budget|€\/jour|\/nuit/.test(lower)) return "budget";
  if (/expectation.*reality|avant.*apr[eè]s|#avantapres/.test(lower)) return "avantapres";
  if (/\bvs\b|versus|#versus/.test(lower)) return "versus";
  if (/#poll|sondage|ou\s*\?/.test(lower)) return "poll";
  if (/#humor|humour/.test(lower)) return "humor";
  if (/guide|comment/.test(lower)) return "guide";
  return undefined;
}

/** Parse a TikTok Studio "Content" CSV export. Returns videos + diagnostic. */
function parseTikTokCsv(text: string): { videos: TikTokVideo[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { videos: [], errors: ["CSV has no data rows"] };
  }
  // Validate header roughly — we expect Time, Title, Link, Post time, Likes, Comments, Shares, Views
  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const titleIdx = header.findIndex((h) => h.includes("title"));
  const postTimeIdx = header.findIndex((h) => h.includes("post time"));
  const likesIdx = header.findIndex((h) => h.includes("likes"));
  const commentsIdx = header.findIndex((h) => h.includes("comments"));
  const sharesIdx = header.findIndex((h) => h.includes("shares"));
  const viewsIdx = header.findIndex((h) => h.includes("views"));
  if (titleIdx < 0 || viewsIdx < 0 || postTimeIdx < 0) {
    return {
      videos: [],
      errors: [
        `Unexpected CSV header — expected TikTok Studio "Content" export. Got: ${header.join(", ")}`,
      ],
    };
  }

  const videos: TikTokVideo[] = [];
  const errors: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    try {
      const fields = parseCsvLine(lines[i]);
      const rawTitle = fields[titleIdx] ?? "";
      if (!rawTitle.trim()) {
        errors.push(`Row ${i + 1}: empty title, skipped`);
        continue;
      }
      videos.push({
        title: shortenTitle(rawTitle) || rawTitle.slice(0, 60),
        format: detectFormat(rawTitle),
        date: parseFrenchDate(fields[postTimeIdx] ?? ""),
        views: Number(fields[viewsIdx]) || 0,
        likes: Number(fields[likesIdx]) || 0,
        comments: Number(fields[commentsIdx]) || 0,
        shares: Number(fields[sharesIdx]) || 0,
      });
    } catch (err) {
      errors.push(`Row ${i + 1}: ${String(err)}`);
    }
  }
  return { videos, errors };
}

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

interface EditorProps {
  /** Called after a successful save so the parent can force-refresh the
   *  analytics page's /api/social-stats poll — otherwise the TikTok card at
   *  the top of the dashboard stays stale for up to 7 min (2 min poll + 5
   *  min raw-CDN edge cache on GitHub). */
  onSaved?: () => void;
}

/**
 * TikTok stats importer — drop a CSV export from TikTok Studio.
 *
 * Why: TikTok API app-review is pending, so the only data source is the
 * manual "Content" CSV export from TikTok Studio. Retyping stats row by row
 * was annoying; this component parses the CSV client-side, fills the videos
 * list, auto-computes totals, and commits to `data/tiktok-stats.json`.
 *
 * The only fields not in the CSV are followers / following / daysSinceStart
 * — those stay as manual inputs. Video totals auto-compute from the parsed
 * rows on save (views + likes + comments + shares).
 */
export function TikTokStatsEditor({ onSaved }: EditorProps = {}) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [stats, setStats] = useState<TikTokStats | null>(null);
  const [parseState, setParseState] = useState<ParseState>({ status: "idle" });
  const [dragActive, setDragActive] = useState(false);
  const [receipt, setReceipt] = useState<SaveReceipt | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hydrate the persistent save receipt from localStorage on mount — so the
  // founder sees "last saved at X" even after a browser crash or hard refresh.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECEIPT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SaveReceipt;
      if (parsed && typeof parsed.at === "string") setReceipt(parsed);
    } catch {
      // Corrupt or unavailable storage — ignore, next save will rewrite.
    }
  }, []);

  // Load current stats the first time the panel opens.
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

  const updateAccount = useCallback((patch: Partial<TikTokAccount>) => {
    setStats((prev) =>
      prev ? { ...prev, account: { ...prev.account, ...patch } } : prev,
    );
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setParseState({ status: "error", message: "File must be a .csv export from TikTok Studio" });
      return;
    }
    setParseState({ status: "parsing" });
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const { videos, errors } = parseTikTokCsv(text);
        if (videos.length === 0) {
          setParseState({
            status: "error",
            message:
              errors[0] ||
              "No videos parsed — check that this is the TikTok Studio Content CSV export.",
          });
          return;
        }
        setStats((prev) =>
          prev
            ? { ...prev, videos }
            : {
                lastUpdated: new Date().toISOString().slice(0, 10),
                account: {
                  followers: 0,
                  following: 0,
                  daysSinceStart: 0,
                  ...recomputeTotals(videos),
                },
                videos,
              },
        );
        setParseState({ status: "parsed", count: videos.length, filename: file.name });
      } catch (err) {
        setParseState({ status: "error", message: String(err) });
      }
    };
    reader.onerror = () => {
      setParseState({ status: "error", message: "Failed to read file" });
    };
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const save = useCallback(async () => {
    if (!stats) return;
    setSaveState("saving");
    try {
      // Always auto-compute video totals on save — the CSV is source of truth.
      const account: TikTokAccount = {
        ...stats.account,
        ...recomputeTotals(stats.videos),
      };
      const res = await fetch("/api/tiktok/stats", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, videos: stats.videos }),
      });
      if (!res.ok) {
        // Try to read the server error body for diagnostics instead of
        // swallowing it as a generic HTTP N code.
        let detail = `HTTP ${res.status}`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) detail = body.error;
        } catch {
          /* non-JSON body, keep status code */
        }
        throw new Error(detail);
      }
      const json = (await res.json()) as TikTokStats;

      // Persist the save receipt BEFORE touching component state — so even if
      // the subsequent render crashes the tab, the founder can reload and see
      // "last saved" still rendered from localStorage.
      const nextReceipt: SaveReceipt = {
        at: new Date().toISOString(),
        videoCount: json.videos.length,
        followers: json.account.followers,
        commitFileUrl: CONTENT_FILE_URL,
      };
      try {
        window.localStorage.setItem(
          RECEIPT_STORAGE_KEY,
          JSON.stringify(nextReceipt),
        );
      } catch {
        /* storage full or disabled — non-fatal */
      }
      setReceipt(nextReceipt);

      setStats(json);
      setSaveState("done");
      setTimeout(() => setSaveState("idle"), 4000);

      // Notify the parent so the analytics page can force-refresh the
      // /api/social-stats poll. Without this the "Followers" card stays
      // stale for up to 7 min (2 min client poll + 5 min raw-CDN edge
      // cache). Fire-and-forget: a failure here shouldn't surface to the
      // user since the save itself already succeeded.
      try {
        onSaved?.();
      } catch (err) {
        console.warn("[tiktok-editor] onSaved callback threw:", err);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[tiktok-editor] save failed:", msg, err);
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 6000);
    }
  }, [stats, onSaved]);

  const totals = stats ? recomputeTotals(stats.videos) : null;

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
            TikTok CSV import
            {stats ? (
              <span className="text-[10px] font-normal text-zinc-400 normal-case">
                · {stats.videos.length} videos · updated {stats.lastUpdated}
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
              {/* ── CSV Drop Zone ───────────────────────────────── */}
              <div
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                }}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                  dragActive
                    ? "border-pink-500 bg-pink-500/10"
                    : parseState.status === "parsed"
                    ? "border-emerald-500/50 bg-emerald-500/5"
                    : parseState.status === "error"
                    ? "border-red-500/50 bg-red-500/5"
                    : "border-zinc-700 hover:border-zinc-600 bg-zinc-950/40"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
                {parseState.status === "parsing" ? (
                  <>
                    <Loader2 className="w-6 h-6 text-pink-400 animate-spin" />
                    <span className="text-xs text-zinc-300">Parsing CSV…</span>
                  </>
                ) : parseState.status === "parsed" ? (
                  <>
                    <FileText className="w-6 h-6 text-emerald-400" />
                    <span className="text-xs text-zinc-200">
                      {parseState.filename} · {parseState.count} videos parsed
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      Review totals below → click &ldquo;Save stats&rdquo; to commit.
                    </span>
                  </>
                ) : parseState.status === "error" ? (
                  <>
                    <X className="w-6 h-6 text-red-400" />
                    <span className="text-xs text-red-300">{parseState.message}</span>
                    <span className="text-[10px] text-zinc-500">
                      Click to retry with another file.
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-zinc-500" />
                    <span className="text-xs text-zinc-300">
                      Drop TikTok Studio CSV here, or click to browse
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      Export &ldquo;Content&rdquo; from TikTok Studio → uploads videos + auto-computes totals
                    </span>
                  </>
                )}
              </div>

              {/* ── Parsed totals (auto-computed read-only) ─────── */}
              {totals ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(
                    [
                      ["totalViews", "Total views"],
                      ["totalLikes", "Total likes"],
                      ["totalComments", "Total comments"],
                      ["totalShares", "Total shares"],
                    ] as Array<[keyof typeof totals, string]>
                  ).map(([key, label]) => (
                    <div
                      key={key}
                      className="rounded-md bg-zinc-950/60 border border-zinc-800/60 px-3 py-2"
                    >
                      <div className="text-[10px] text-zinc-500">{label}</div>
                      <div className="text-sm text-zinc-200 tabular-nums font-semibold">
                        {totals[key].toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* ── Manual-only account fields (not in CSV) ─────── */}
              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  Account (not in CSV — enter manually)
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["followers", "Followers"],
                      ["following", "Following"],
                      ["daysSinceStart", "Days since start"],
                    ] as Array<[keyof TikTokAccount, string]>
                  ).map(([key, label]) => (
                    <label key={key} className="flex flex-col gap-1">
                      <span className="text-[10px] text-zinc-500">{label}</span>
                      <input
                        type="number"
                        min={0}
                        value={stats.account[key]}
                        onChange={(e) =>
                          updateAccount({ [key]: Number(e.target.value) || 0 })
                        }
                        className="bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1 text-xs text-zinc-200 tabular-nums focus:outline-none focus:border-pink-500/60"
                      />
                    </label>
                  ))}
                </div>
              </section>

              {/* ── Persistent save receipt ─────────────────────── */}
              {/* Renders the LAST SUCCESSFUL save independently of the
                  transient `saveState`. Backed by localStorage so even if
                  the tab crashes mid-save or refreshes, the founder still
                  sees "saved at X" with a link to the actual GitHub file
                  as proof the data landed. This is the B-fix for the bug
                  where clicking Save showed a browser error page but the
                  PUT actually succeeded — founder was left unsure whether
                  their data was saved. */}
              {receipt ? (
                <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
                  <div className="flex items-center gap-2 text-[11px] text-emerald-300">
                    <Check className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span>
                      Last save:{" "}
                      <time
                        dateTime={receipt.at}
                        title={new Date(receipt.at).toLocaleString()}
                      >
                        {new Date(receipt.at).toLocaleString()}
                      </time>
                      {" · "}
                      {receipt.videoCount} videos · {receipt.followers} followers
                    </span>
                  </div>
                  <a
                    href={receipt.commitFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline"
                  >
                    View on GitHub
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                </div>
              ) : null}

              {/* ── Save bar ────────────────────────────────────── */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                <span className="text-[10px] text-zinc-500">
                  Writes to{" "}
                  <code className="text-zinc-400">data/tiktok-stats.json</code> on save.
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
