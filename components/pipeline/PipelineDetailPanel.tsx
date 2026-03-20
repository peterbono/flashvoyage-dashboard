"use client";

import React from "react";
import { PipelineStageData } from "./mockData";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { X, Timer, DollarSign, Zap, Star } from "lucide-react";

interface Props {
  stage: PipelineStageData;
  onClose: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  success: "border-emerald-800 text-emerald-400 bg-emerald-950/40",
  failed:  "border-red-800 text-red-400 bg-red-950/40",
  running: "border-blue-800 text-blue-400 bg-blue-950/40",
  skipped: "border-zinc-700 text-zinc-500 bg-zinc-900/40",
  idle:    "border-zinc-700 text-zinc-400 bg-zinc-900/40",
};

export function PipelineDetailPanel({ stage, onClose }: Props) {
  return (
    <AnimatePresence>
      <motion.div
        key={stage.id}
        initial={{ x: 320, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 320, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="absolute top-0 right-0 h-full w-80 bg-zinc-950 border-l border-zinc-800 flex flex-col z-10 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold text-white">{stage.name}</h2>
            <Badge
              variant="outline"
              className={`text-[10px] mt-1 ${STATUS_COLORS[stage.status]}`}
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
              <div className="text-white font-semibold">{stage.duration.toFixed(2)}s</div>
            </div>
            <div className="bg-zinc-900 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-500">
                <DollarSign className="w-3 h-3" />
                <span>Cost</span>
              </div>
              <div className="text-white font-semibold">${stage.cost.toFixed(4)}</div>
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
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-white font-semibold">{stage.qualityScore}/100</div>
                  <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                    <div
                      className="bg-amber-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${stage.qualityScore}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator className="bg-zinc-800" />

          {/* Logs */}
          <div>
            <h3 className="text-zinc-400 font-medium mb-2">Logs</h3>
            <div className="bg-zinc-900 rounded-lg p-3 space-y-1 font-mono text-[10px] text-zinc-400 max-h-48 overflow-y-auto">
              {stage.logs.map((log, i) => (
                <div key={i} className="leading-relaxed">{log}</div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
