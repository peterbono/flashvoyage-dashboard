"use client";

import React from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { PipelineStageData, StageStatus } from "./mockData";
import { motion } from "framer-motion";
import {
  Search, Database, TrendingUp, BookOpen, GitBranch, GitFork,
  Sparkles, Link, BarChart2, FileCheck, ShieldCheck, Globe,
  Hash, Rss, PenLine, Zap,
  Clock, CheckCircle2, XCircle, SkipForward, Loader2,
} from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Search, Database, TrendingUp, BookOpen, GitBranch, GitFork,
  Sparkles, Link, BarChart2, FileCheck, ShieldCheck, Globe,
  Hash, Rss, PenLine, Zap,
};

const STATUS_CONFIG: Record<StageStatus, { label: string; color: string; borderColor: string; bg: string }> = {
  idle:    { label: "Idle",    color: "text-zinc-400",    borderColor: "border-zinc-700",  bg: "bg-zinc-900" },
  running: { label: "Running", color: "text-blue-400",    borderColor: "border-blue-500",  bg: "bg-blue-500/10" },
  success: { label: "Done",    color: "text-emerald-400", borderColor: "border-zinc-800",  bg: "bg-zinc-900" },
  failed:  { label: "Failed",  color: "text-red-400",     borderColor: "border-red-700",   bg: "bg-red-900/10" },
  skipped: { label: "Skipped", color: "text-zinc-500",    borderColor: "border-zinc-800",  bg: "bg-zinc-900/50" },
};

function StatusIcon({ status }: { status: StageStatus }) {
  if (status === "success") return <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
  if (status === "failed")  return <XCircle className="w-3 h-3 text-red-400" />;
  if (status === "skipped") return <SkipForward className="w-3 h-3 text-zinc-500" />;
  if (status === "running") return <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />;
  return <Clock className="w-3 h-3 text-zinc-500" />;
}

export function PipelineNode({ data, selected }: NodeProps) {
  const stage = data as unknown as PipelineStageData;
  const cfg = STATUS_CONFIG[stage.status];
  const Icon = ICONS[stage.icon] || Search;
  const isRunning = stage.status === "running";
  const dimmed = stage.dimmed === true;

  // ── SOURCE NODE ──────────────────────────────────────────────────────────────
  if (stage.variant === "source") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: dimmed ? 0.2 : 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="relative"
      >
        <div
          className={[
            "w-[170px] rounded-full border px-3 py-2 cursor-pointer transition-all duration-150",
            cfg.borderColor,
            cfg.bg,
            selected ? "ring-2 ring-amber-500" : "hover:border-zinc-600",
          ].join(" ")}
        >
          <div className="flex items-center gap-2">
            <Icon className={`w-3.5 h-3.5 shrink-0 ${stage.color}`} />
            <span className="text-xs font-semibold text-white truncate flex-1">{stage.name}</span>
            <StatusIcon status={stage.status} />
          </div>
          <Handle
            type="source"
            position={Position.Right}
            className="!w-2 !h-2 !bg-zinc-700 !border-zinc-600"
          />
        </div>
      </motion.div>
    );
  }

  // ── ROUTER NODE ──────────────────────────────────────────────────────────────
  if (stage.variant === "router") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: dimmed ? 0.2 : 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="relative"
      >
        <div
          className={[
            "w-[200px] rounded-xl border border-amber-700/60 bg-amber-950/25 px-3 py-2.5 cursor-pointer transition-all duration-150",
            selected ? "ring-2 ring-amber-500" : "hover:border-amber-600/80",
          ].join(" ")}
        >
          <Handle
            type="target"
            position={Position.Left}
            className="!w-2 !h-2 !bg-zinc-700 !border-zinc-600"
          />

          {/* Header */}
          <div className="flex items-center gap-2 mb-2.5">
            <div className="p-1 rounded-md bg-zinc-800">
              <Icon className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-xs font-semibold text-white">{stage.name}</span>
          </div>

          {/* Branch labels */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-amber-400 font-medium">↗ Evergreen</span>
              <span className="text-zinc-600">1800w · Sonnet</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-cyan-400 font-medium">↘ News</span>
              <span className="text-zinc-600">800w · Haiku</span>
            </div>
          </div>

          {/* Two output handles */}
          <Handle
            id="ev"
            type="source"
            position={Position.Right}
            style={{ top: "32%" }}
            className="!w-2 !h-2 !bg-amber-600 !border-amber-500"
          />
          <Handle
            id="news"
            type="source"
            position={Position.Right}
            style={{ top: "68%" }}
            className="!w-2 !h-2 !bg-cyan-600 !border-cyan-500"
          />
        </div>
      </motion.div>
    );
  }

  // ── PUBLISH NODE ─────────────────────────────────────────────────────────────
  if (stage.variant === "publish") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: dimmed ? 0.2 : 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="relative"
      >
        <div
          className={[
            "w-[180px] rounded-xl border border-emerald-700/60 bg-emerald-950/20 px-3 py-2.5 cursor-pointer transition-all",
            selected ? "ring-2 ring-amber-500" : "hover:border-emerald-600/80",
          ].join(" ")}
        >
          <Handle
            type="target"
            position={Position.Left}
            className="!w-2 !h-2 !bg-zinc-700 !border-zinc-600"
          />
          <div className="flex items-center gap-2 mb-1.5">
            <div className="p-1 rounded-md bg-emerald-900/60">
              <Icon className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="text-xs font-semibold text-white">{stage.name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] text-emerald-400 font-medium">WordPress · REST API</span>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── REGULAR STAGE NODE ───────────────────────────────────────────────────────
  const trackStripe =
    stage.track === "evergreen"
      ? "bg-amber-500/50"
      : stage.track === "news"
      ? "bg-cyan-500/50"
      : "";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: dimmed ? 0.2 : 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="relative"
    >
      {isRunning && (
        <motion.div
          className="absolute inset-0 rounded-xl border border-blue-500"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        />
      )}
      <div
        className={[
          "w-[200px] rounded-xl border relative overflow-hidden",
          cfg.borderColor,
          cfg.bg,
          "px-3 py-2.5 cursor-pointer transition-all duration-150",
          selected ? "ring-2 ring-amber-500 ring-offset-0" : "hover:border-zinc-600",
          isRunning ? "border-blue-500" : "",
        ].join(" ")}
      >
        {/* Track color stripe */}
        {trackStripe && (
          <div className={`absolute left-0 inset-y-0 w-0.5 ${trackStripe}`} />
        )}

        <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-zinc-700 !border-zinc-600" />

        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1 rounded-md bg-zinc-800">
            <Icon className={`w-3.5 h-3.5 ${stage.color}`} />
          </div>
          <span className="text-xs font-semibold text-white leading-tight truncate flex-1">{stage.name}</span>
        </div>

        {/* Status row */}
        <div className="flex items-center gap-1.5 mb-2">
          <StatusIcon status={stage.status} />
          <span className={`text-[10px] font-medium ${cfg.color}`}>{cfg.label}</span>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-[10px] text-zinc-500">
          <span>{stage.duration.toFixed(1)}s</span>
          {stage.cost > 0 && <span className="text-zinc-600">${stage.cost.toFixed(3)}</span>}
          {stage.qualityScore !== undefined && (
            <span className="text-amber-500 font-medium">Q{stage.qualityScore}</span>
          )}
        </div>

        <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-zinc-700 !border-zinc-600" />
      </div>
    </motion.div>
  );
}
