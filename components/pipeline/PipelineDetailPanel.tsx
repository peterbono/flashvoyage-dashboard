"use client";

import React, { useState } from "react";
import { PipelineStageData } from "./mockData";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { X, Timer, DollarSign, Zap, Star, RotateCcw, Eye, EyeOff, AlertTriangle } from "lucide-react";

interface Props {
  stage: PipelineStageData;
  onClose: () => void;
  onRetry?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  success: "border-emerald-800 text-emerald-400 bg-emerald-950/40",
  failed:  "border-red-800 text-red-400 bg-red-950/40",
  running: "border-blue-800 text-blue-400 bg-blue-950/40",
  skipped: "border-zinc-700 text-zinc-500 bg-zinc-900/40",
  idle:    "border-zinc-700 text-zinc-400 bg-zinc-900/40",
};

const GENERATE_STAGES = ["generate-ev", "generate-news"];
const QUALITY_STAGES = ["quality-gate-ev", "quality-gate-news"];

export function PipelineDetailPanel({ stage, onClose, onRetry }: Props) {
  const [showArticle, setShowArticle] = useState(false);

  // Normalize: handle both PipelineStageData (duration in s) and RealPipelineStageData (durationMs)
  const raw = stage as unknown as Record<string, unknown>;
  const durationSec: number =
    typeof raw.durationMs === "number"
      ? raw.durationMs / 1000
      : typeof stage.duration === "number"
      ? stage.duration
      : 0;
  const cost: number = stage.cost ?? 0;
  const logs: string[] = Array.isArray(stage.logs) ? stage.logs : [];
  // detail string from viz-bridge events
  const detail = typeof raw.detail === "string" ? raw.detail : null;

  const isGenerateStage = GENERATE_STAGES.includes(stage.id);
  const isQualityStage = QUALITY_STAGES.includes(stage.id);
  const articleHtml = stage.outputData?.article as string | undefined;
  const qualityIssues = stage.outputData?.issues as string[] | undefined;
  const qualityVerdict = stage.outputData?.verdict as string | undefined;
  const qualityThreshold = stage.id === "quality-gate-ev" ? 85 : 70;

  // Strip HTML tags for plain-text preview
  const articleText = articleHtml
    ? articleHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    : "";

  return (
    <AnimatePresence>
      <motion.div
        key={stage.id}
        initial={{ x: 320, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 320, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="absolute top-0 right-0 h-full w-full sm:w-80 bg-zinc-950 border-l border-zinc-800 flex flex-col z-10 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold text-white">{stage.name}</h2>
            <Badge
              variant="outline"
              className={`text-xs mt-1 ${STATUS_COLORS[stage.status]}`}
            >
              {stage.status}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-zinc-400 hover:text-white hover:bg-zinc-800"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 text-xs">
          {/* Description */}
          <p className="text-zinc-400 leading-relaxed">{stage.description}</p>

          <Separator className="bg-zinc-800" />

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-900 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <Timer className="w-3 h-3" />
                <span>Duration</span>
              </div>
              <div className="text-white font-semibold">
                {durationSec >= 60
                  ? `${(durationSec / 60).toFixed(1)}min`
                  : durationSec > 0
                  ? `${durationSec.toFixed(2)}s`
                  : "—"}
              </div>
            </div>
            <div className="bg-zinc-900 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <DollarSign className="w-3 h-3" />
                <span>Cost</span>
              </div>
              <div className="text-white font-semibold">{cost > 0 ? `$${cost.toFixed(4)}` : "—"}</div>
            </div>
            {stage.tokensIn !== undefined && (
              <div className="bg-zinc-900 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-zinc-500">
                  <Zap className="w-3 h-3" />
                  <span>Tokens In</span>
                </div>
                <div className="text-white font-semibold">{stage.tokensIn.toLocaleString()}</div>
              </div>
            )}
            {stage.tokensOut !== undefined && (
              <div className="bg-zinc-900 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-zinc-500">
                  <Zap className="w-3 h-3" />
                  <span>Tokens Out</span>
                </div>
                <div className="text-white font-semibold">{stage.tokensOut.toLocaleString()}</div>
              </div>
            )}
            {stage.qualityScore !== undefined && (
              <div className="bg-zinc-900 rounded-lg p-3 space-y-1 col-span-2">
                <div className="flex items-center gap-1.5 text-zinc-500">
                  <Star className="w-3 h-3" />
                  <span>Quality Score</span>
                  {isQualityStage && (
                    <span className="ml-auto text-zinc-600">threshold {qualityThreshold}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className={`text-white font-semibold ${stage.status === "failed" ? "text-red-400" : "text-white"}`}>
                    {stage.qualityScore}/100
                  </div>
                  {isQualityStage && stage.status === "failed" && (
                    <span className="text-red-400 text-xs">
                      missing {qualityThreshold - stage.qualityScore} pts
                    </span>
                  )}
                  <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${stage.status === "failed" ? "bg-red-500" : "bg-amber-500"}`}
                      style={{ width: `${stage.qualityScore}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quality issues */}
          {isQualityStage && stage.status === "failed" && qualityIssues && qualityIssues.length > 0 && (
            <>
              <Separator className="bg-zinc-800" />
              <div>
                <div className="flex items-center gap-1.5 text-red-400 font-medium mb-2">
                  <AlertTriangle className="w-3 h-3" />
                  Issues detected
                </div>
                <ul className="space-y-1">
                  {qualityIssues.map((issue, i) => (
                    <li key={i} className="text-zinc-400 flex items-start gap-1.5">
                      <span className="text-red-500 mt-0.5">·</span>
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {/* Article preview */}
          {isGenerateStage && stage.status === "success" && articleText && (
            <>
              <Separator className="bg-zinc-800" />
              <div>
                <button
                  type="button"
                  onClick={() => setShowArticle(!showArticle)}
                  className="flex items-center gap-1.5 text-zinc-400 hover:text-white font-medium mb-2 transition-colors"
                >
                  {showArticle ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  Article preview
                  <span className="text-zinc-600 font-normal ml-1">
                    (~{Math.round(articleText.split(/\s+/).length)} words)
                  </span>
                </button>
                {showArticle && (
                  <div className="bg-zinc-900 rounded-lg p-3 text-zinc-300 leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap">
                    {articleText.slice(0, 1500)}{articleText.length > 1500 ? "…" : ""}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Quality gate verdict when pass */}
          {isQualityStage && stage.status === "success" && qualityVerdict === "pass" && (
            <>
              <Separator className="bg-zinc-800" />
              <div className="bg-emerald-950/30 border border-emerald-900/40 rounded-lg px-3 py-2 text-emerald-400 text-xs font-medium">
                Gate passed — article cleared for publish
              </div>
            </>
          )}

          <Separator className="bg-zinc-800" />

          {/* Viz-bridge detail (real pipeline output) */}
          {detail && (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2.5">
              <p className="text-[11px] text-zinc-500 font-medium mb-1 uppercase tracking-wide">Agent output</p>
              <p className="text-xs text-zinc-300 leading-relaxed">{detail}</p>
            </div>
          )}

          {/* Logs */}
          {logs.length > 0 && (
            <div>
              <h3 className="text-zinc-400 font-medium mb-2">Logs</h3>
              <div className="bg-zinc-900 rounded-lg p-3 space-y-1 font-mono text-xs text-zinc-400 max-h-48 overflow-y-auto">
                {logs.map((log, i) => (
                  <div key={i} className="leading-relaxed">{log}</div>
                ))}
              </div>
            </div>
          )}

          {/* Retry button */}
          {stage.status === "failed" && onRetry && (
            <>
              <Separator className="bg-zinc-800" />
              <Button
                onClick={onRetry}
                className="w-full h-8 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium gap-1.5 border border-zinc-700"
                variant="outline"
              >
                <RotateCcw className="w-3 h-3" />
                Retry from this stage
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
