"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, CheckCircle2, XCircle, Clock, PlayCircle, Check, X } from "lucide-react";

export interface ExecutorLogEntry {
  id: string;
  date: string;
  articleTitle: string;
  articleId?: string | number;
  actionType: string;
  status: "applied" | "dry-run" | "failed" | "pending";
  detail?: string;
}

interface Props {
  entries: ExecutorLogEntry[];
  loading: boolean;
  error: string | null;
  onApproveAll?: () => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

const STATUS_META: Record<
  string,
  { icon: React.ReactNode; style: string }
> = {
  applied: {
    icon: <CheckCircle2 className="w-3 h-3" />,
    style: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
  "dry-run": {
    icon: <Clock className="w-3 h-3" />,
    style: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  },
  failed: {
    icon: <XCircle className="w-3 h-3" />,
    style: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  },
  pending: {
    icon: <PlayCircle className="w-3 h-3" />,
    style: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
};

const ACTION_STYLES: Record<string, string> = {
  ADD_WIDGETS: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  ADD_TOC: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  UPDATE_META: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  FIX_LINKS: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  ADD_IMAGES: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  REFRESH_CONTENT: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  ADD_SCHEMA: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

export function AutoExecutorLog({
  entries,
  loading,
  error,
  onApproveAll,
  onApprove,
  onReject,
}: Props) {
  const [approving, setApproving] = useState(false);

  const pendingEntries = entries.filter((e) => e.status === "dry-run" || e.status === "pending");
  const appliedEntries = entries.filter((e) => e.status === "applied" || e.status === "failed");

  async function handleApproveAll() {
    setApproving(true);
    try {
      onApproveAll?.();
    } finally {
      setTimeout(() => setApproving(false), 2000);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-zinc-500 text-xs gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Chargement du log auto-executor...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-zinc-600 py-8 text-center">
        Log auto-executor indisponible. Le fichier auto-executor-log.json n&apos;est pas encore genere.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pending dry runs */}
      {pendingEntries.length > 0 && (
        <div className="bg-zinc-900/40 border border-amber-500/20 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-zinc-800/60 flex-wrap gap-2">
            <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Dry runs en attente ({pendingEntries.length})
            </h3>
            <Button
              size="xs"
              disabled={approving}
              onClick={handleApproveAll}
              className="bg-amber-500 hover:bg-amber-400 text-black font-medium text-xs h-6 px-2.5 gap-1"
            >
              {approving ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3 h-3" />
              )}
              Approuver tout
            </Button>
          </div>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800/60 hover:bg-transparent">
                <TableHead className="text-zinc-500 text-xs font-medium w-24">Date</TableHead>
                <TableHead className="text-zinc-500 text-xs font-medium">Article</TableHead>
                <TableHead className="text-zinc-500 text-xs font-medium w-32">Action</TableHead>
                <TableHead className="text-zinc-500 text-xs font-medium w-20">Statut</TableHead>
                <TableHead className="text-zinc-500 text-xs font-medium w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingEntries.map((entry) => {
                const statusMeta = STATUS_META[entry.status] || STATUS_META.pending;
                return (
                  <TableRow
                    key={entry.id}
                    className="border-zinc-800/40 hover:bg-zinc-800/30"
                  >
                    <TableCell className="text-xs text-zinc-500 font-mono tabular-nums">
                      {new Date(entry.date).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-200 max-w-xs truncate">
                      {entry.articleTitle}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 h-4 ${ACTION_STYLES[entry.actionType] || "border-zinc-700 text-zinc-400"}`}
                      >
                        {entry.actionType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 h-4 gap-0.5 ${statusMeta.style}`}
                      >
                        {statusMeta.icon}
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => onApprove?.(entry.id)}
                          className="text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => onReject?.(entry.id)}
                          className="text-rose-500 hover:text-rose-400 hover:bg-rose-500/10"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </div>
      )}

      {/* Applied actions log */}
      <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl overflow-hidden">
        <div className="px-3 sm:px-4 py-2.5 border-b border-zinc-800/60">
          <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            Actions recentes ({appliedEntries.length})
          </h3>
        </div>
        {appliedEntries.length === 0 ? (
          <div className="text-xs text-zinc-600 py-6 text-center">
            Aucune action auto-executor enregistree.
          </div>
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800/60 hover:bg-transparent">
                <TableHead className="text-zinc-500 text-xs font-medium w-24">Date</TableHead>
                <TableHead className="text-zinc-500 text-xs font-medium">Article</TableHead>
                <TableHead className="text-zinc-500 text-xs font-medium w-32">Action</TableHead>
                <TableHead className="text-zinc-500 text-xs font-medium w-20">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appliedEntries.slice(0, 20).map((entry) => {
                const statusMeta = STATUS_META[entry.status] || STATUS_META.applied;
                return (
                  <TableRow
                    key={entry.id}
                    className="border-zinc-800/40 hover:bg-zinc-800/30"
                  >
                    <TableCell className="text-xs text-zinc-500 font-mono tabular-nums">
                      {new Date(entry.date).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-200 max-w-xs truncate">
                      {entry.articleTitle}
                      {entry.detail && (
                        <span className="text-zinc-600 ml-1.5 text-[10px]">
                          {entry.detail}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 h-4 ${ACTION_STYLES[entry.actionType] || "border-zinc-700 text-zinc-400"}`}
                      >
                        {entry.actionType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 h-4 gap-0.5 ${statusMeta.style}`}
                      >
                        {statusMeta.icon}
                        {entry.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        )}
      </div>
    </div>
  );
}
