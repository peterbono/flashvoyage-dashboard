import { NextRequest, NextResponse } from "next/server";
import { writeContentFile } from "@/lib/github";

/**
 * POST /api/tiktok/upload
 *
 * Accepts TikTok stats JSON (parsed from CSV or manual input)
 * and writes it to data/tiktok-stats.json in the content repo.
 */

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

interface TikTokUpload {
  videos: TikTokVideo[];
}

function computeFormatSummary(videos: TikTokVideo[]) {
  const byFormat: Record<string, TikTokVideo[]> = {};
  for (const v of videos) {
    if (v.visibility === "private") continue;
    if (!byFormat[v.format]) byFormat[v.format] = [];
    byFormat[v.format].push(v);
  }

  return Object.entries(byFormat).map(([format, vids]) => {
    const avgViews = Math.round(vids.reduce((s, v) => s + v.views, 0) / vids.length);
    const avgLikes = Math.round(vids.reduce((s, v) => s + v.likes, 0) / vids.length);
    const likeRate = avgViews > 0 ? +((avgLikes / avgViews) * 100).toFixed(1) : 0;

    let verdict = "OK";
    if (likeRate >= 3) verdict = "STAR";
    else if (avgViews >= 400) verdict = "Good reach";
    else if (likeRate < 1) verdict = "Weak";
    if (likeRate < 0.5 && vids.length >= 2) verdict = "DEAD";

    return { format, videos: vids.length, avgViews, avgLikes, likeRate, verdict };
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TikTokUpload;

    if (!body.videos || !Array.isArray(body.videos)) {
      return NextResponse.json({ error: "Missing videos array" }, { status: 400 });
    }

    const publicVideos = body.videos.filter((v) => v.visibility !== "private");

    const account = {
      followers: 0, // manual — can't get from CSV
      following: 0,
      totalViews: publicVideos.reduce((s, v) => s + (v.views || 0), 0),
      totalLikes: publicVideos.reduce((s, v) => s + (v.likes || 0), 0),
      totalComments: publicVideos.reduce((s, v) => s + (v.comments || 0), 0),
      totalShares: publicVideos.reduce((s, v) => s + (v.shares || 0), 0),
      daysSinceStart: 0,
    };

    // Compute days since first video
    const dates = body.videos.map((v) => new Date(v.date).getTime()).filter((d) => !isNaN(d));
    if (dates.length > 0) {
      const earliest = Math.min(...dates);
      account.daysSinceStart = Math.floor((Date.now() - earliest) / (1000 * 60 * 60 * 24));
    }

    const stats = {
      _readme: "Auto-generated from dashboard TikTok upload",
      lastUpdated: new Date().toISOString().slice(0, 10),
      account,
      videos: body.videos,
      formatSummary: computeFormatSummary(body.videos),
    };

    await writeContentFile(
      "data/tiktok-stats.json",
      JSON.stringify(stats, null, 2),
      `chore: update TikTok stats (${publicVideos.length} videos, ${account.totalViews} views)`
    );

    return NextResponse.json({ ok: true, stats });
  } catch (err) {
    console.error("[api/tiktok/upload]", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
