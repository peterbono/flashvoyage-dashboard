"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";
import type { WorkflowsPayload } from "@/components/command-center/SystemHealthBanner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  data: WorkflowsPayload | null;
  loading: boolean;
}

interface HealthGroup {
  label: string;
  workflowIds: string[];
}

const GROUPS: HealthGroup[] = [
  {
    label: "Pipeline Contenu",
    workflowIds: ["publish-article", "content-intelligence"],
  },
  {
    label: "Distribution Sociale",
    workflowIds: ["publish-reels", "publish-social-posts"],
  },
  {
    label: "SEO & Analytics",
    workflowIds: ["daily-analytics", "refresh-articles", "daily-digest"],
  },
];

type HealthStatus = "ok" | "issue" | "running" | "unknown";

const STATUS_STYLES: Record<HealthStatus, { dot: string; text: string; label: string }> = {
  ok: { dot: "bg-emerald-400", text: "text-emerald-400", label: "OK" },
  issue: { dot: "bg-rose-400", text: "text-rose-400", label: "Issue" },
  running: { dot: "bg-amber-400 animate-pulse", text: "text-amber-400", label: "Running" },
  unknown: { dot: "bg-zinc-600", text: "text-zinc-500", label: "N/A" },
};

const GH_ACTIONS_URL = "https://github.com/peterbono/flashvoyage-ultra-content/actions";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SystemHealthLight({ data, loading }: Props) {
  const groupStatuses = useMemo(() => {
    if (!data?.workflows) return GROUPS.map(() => "unknown" as HealthStatus);

    return GROUPS.map((group) => {
      const workflows = group.workflowIds
        .map((id) => data.workflows.find((w) => w.id === id))
        .filter(Boolean);

      if (workflows.length === 0) return "unknown" as HealthStatus;

      const anyFailed = workflows.some(
        (w) => w!.latestRun?.conclusion === "failure"
      );
      const anyRunning = workflows.some(
        (w) => w!.latestRun?.status === "in_progress"
      );

      if (anyFailed) return "issue" as HealthStatus;
      if (anyRunning) return "running" as HealthStatus;
      return "ok" as HealthStatus;
    });
  }, [data]);

  if (loading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800/80">
        <CardContent className="py-3">
          <div className="flex items-center gap-6 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                <div className="h-3 w-24 rounded bg-zinc-700" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-zinc-900 border-zinc-800/80">
      <CardContent className="py-3">
        <div className="flex flex-wrap items-center gap-4 md:gap-6">
          {GROUPS.map((group, i) => {
            const status = groupStatuses[i];
            const style = STATUS_STYLES[status];

            return (
              <a
                key={group.label}
                href={GH_ACTIONS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 group hover:opacity-80 transition-opacity"
              >
                <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                <span className="text-xs text-zinc-400 group-hover:text-zinc-300">
                  {group.label}
                </span>
                <span className={`text-xs font-medium ${style.text}`}>
                  {style.label}
                </span>
                <ExternalLink className="w-2.5 h-2.5 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
