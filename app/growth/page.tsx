"use client";

import { TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function GrowthPage() {
  return (
    <div className="p-4 md:p-6 space-y-4 w-full max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10">
          <TrendingUp className="w-4 h-4 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">
            Growth
          </h1>
          <p className="text-[12px] text-gray-500 dark:text-zinc-500">
            Croissance par plateforme — IG, TikTok, Web
          </p>
        </div>
      </div>

      <Card className="bg-zinc-900 border-zinc-800/80">
        <CardContent className="py-12 text-center">
          <TrendingUp className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">
            Page Growth en construction — Phase 2
          </p>
          <p className="text-xs text-zinc-600 mt-1">
            Followers over time, format performance, funnel content → revenue
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
