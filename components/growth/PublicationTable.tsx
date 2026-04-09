"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CsvExportButton } from "@/components/ui/csv-export-button";
import { PLATFORM_COLORS } from "@/lib/platform-colors";
import { Search, ChevronLeft, ChevronRight, Instagram, Facebook, Video } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Publication {
  id: string;
  platform: "instagram" | "facebook" | "tiktok";
  type: "reel" | "post" | "video";
  caption: string;
  publishedAt: string;
  impressions: number;
  interactions: number;
}

export interface PublicationTableProps {
  publications: Publication[];
  loading: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZES = [10, 25, 50] as const;

const TYPE_STYLES: Record<Publication["type"], string> = {
  reel: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  post: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  video: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
};

const CSV_COLUMNS: { key: keyof Publication; header: string }[] = [
  { key: "platform", header: "Platform" },
  { key: "caption", header: "Caption" },
  { key: "type", header: "Type" },
  { key: "publishedAt", header: "Published At" },
  { key: "impressions", header: "Impressions" },
  { key: "interactions", header: "Interactions" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function relativeDate(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Skeleton rows for loading state
// ---------------------------------------------------------------------------

function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <TableRow key={i} className="border-zinc-800/40">
          <TableCell>
            <div className="h-2.5 w-2.5 rounded-full bg-zinc-800 animate-pulse" />
          </TableCell>
          <TableCell>
            <div className="h-3 w-40 bg-zinc-800 rounded animate-pulse" />
          </TableCell>
          <TableCell>
            <div className="h-4 w-12 bg-zinc-800 rounded-full animate-pulse" />
          </TableCell>
          <TableCell>
            <div className="h-3 w-16 bg-zinc-800 rounded animate-pulse" />
          </TableCell>
          <TableCell>
            <div className="h-3 w-12 bg-zinc-800 rounded animate-pulse ml-auto" />
          </TableCell>
          <TableCell>
            <div className="h-3 w-12 bg-zinc-800 rounded animate-pulse ml-auto" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function PublicationTable({ publications, loading }: PublicationTableProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);

  // Filter by caption text, then sort by impressions desc
  const filtered = useMemo(() => {
    let list = publications;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.caption.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => b.impressions - a.impressions);
  }, [publications, search]);

  // Reset page when search or pageSize changes
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const rangeStart = filtered.length === 0 ? 0 : safePage * pageSize + 1;
  const rangeEnd = Math.min((safePage + 1) * pageSize, filtered.length);

  // Cast for CSV export (the generic expects Record<string, unknown>)
  const csvData = filtered as unknown as Record<string, unknown>[];

  return (
    <Card className="bg-zinc-900 border-zinc-800/80">
      {/* Header */}
      <CardHeader>
        <CardTitle>Publications</CardTitle>
        <CardAction>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Search captions..."
                className="bg-zinc-900 border-zinc-700 text-white text-xs h-7 pl-8 w-48 placeholder:text-zinc-600"
              />
            </div>
            <CsvExportButton
              data={csvData}
              columns={CSV_COLUMNS}
              filename="publications.csv"
              disabled={filtered.length === 0}
            />
          </div>
        </CardAction>
      </CardHeader>

      {/* Table */}
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800/60 hover:bg-transparent">
                <TableHead className="text-zinc-500 text-xs font-medium w-10">
                  Platform
                </TableHead>
                <TableHead className="text-zinc-500 text-xs font-medium">
                  Caption
                </TableHead>
                <TableHead className="text-zinc-500 text-xs font-medium w-16">
                  Type
                </TableHead>
                <TableHead className="text-zinc-500 text-xs font-medium w-28">
                  Date
                </TableHead>
                <TableHead className="text-zinc-500 text-xs font-medium w-24 text-right">
                  Impressions
                </TableHead>
                <TableHead className="text-zinc-500 text-xs font-medium w-24 text-right">
                  Interactions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <SkeletonRows />
              ) : paged.length === 0 ? (
                <TableRow className="border-zinc-800/40">
                  <TableCell
                    colSpan={6}
                    className="text-xs text-zinc-600 text-center py-10"
                  >
                    {search
                      ? "No publications match your search."
                      : "No publications yet"}
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((pub) => {
                  const colors =
                    PLATFORM_COLORS[pub.platform as keyof typeof PLATFORM_COLORS];
                  return (
                    <TableRow
                      key={pub.id}
                      className="border-zinc-800/40 hover:bg-zinc-800/30"
                    >
                      {/* Platform icon + label */}
                      <TableCell>
                        <div className="flex items-center gap-1.5" title={pub.platform}>
                          {pub.platform === "instagram" ? (
                            <Instagram className="w-3.5 h-3.5 text-pink-500" />
                          ) : pub.platform === "facebook" ? (
                            <Facebook className="w-3.5 h-3.5 text-blue-500" />
                          ) : (
                            <Video className="w-3.5 h-3.5 text-cyan-400" />
                          )}
                          <span className={`text-[10px] font-medium ${colors?.text ?? "text-zinc-500"}`}>
                            {pub.platform === "instagram" ? "IG" : pub.platform === "facebook" ? "FB" : "TT"}
                          </span>
                        </div>
                      </TableCell>

                      {/* Caption (truncated) */}
                      <TableCell className="text-xs text-zinc-200 max-w-[280px]">
                        <span className="block truncate" title={pub.caption}>
                          {pub.caption}
                        </span>
                      </TableCell>

                      {/* Type badge */}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 h-4 capitalize ${TYPE_STYLES[pub.type] ?? ""}`}
                        >
                          {pub.type}
                        </Badge>
                      </TableCell>

                      {/* Relative date */}
                      <TableCell className="text-xs text-zinc-400">
                        {relativeDate(pub.publishedAt)}
                      </TableCell>

                      {/* Impressions */}
                      <TableCell className="text-right">
                        <span className="text-xs font-mono tabular-nums text-zinc-300">
                          {formatNumber(pub.impressions)}
                        </span>
                      </TableCell>

                      {/* Interactions */}
                      <TableCell className="text-right">
                        <span className="text-xs font-mono tabular-nums text-zinc-300">
                          {formatNumber(pub.interactions)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination footer */}
        {!loading && filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-zinc-800/60 mt-1">
            <span className="text-[11px] text-zinc-500">
              Showing {rangeStart}-{rangeEnd} of {filtered.length}
            </span>

            <div className="flex items-center gap-2">
              {/* Page size selector */}
              <div className="flex items-center gap-1">
                {PAGE_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      setPageSize(size);
                      setPage(0);
                    }}
                    className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                      pageSize === size
                        ? "bg-zinc-800 text-white"
                        : "text-zinc-600 hover:text-zinc-400"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>

              {/* Prev / Next */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  disabled={safePage === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <span className="text-[10px] text-zinc-500 tabular-nums min-w-[3ch] text-center">
                  {safePage + 1}/{totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  disabled={safePage >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
