"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, XCircle, Clock, X, Bell } from "lucide-react";
import type { WorkflowsPayload, WorkflowStatus } from "./SystemHealthBanner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TokensData {
  [key: string]: unknown;
  threads_token_expiry?: string;
  ig_token_expiry?: string;
  fb_token_expiry?: string;
}

interface Alert {
  id: string;
  type: "token_expiry" | "workflow_failure";
  severity: "warning" | "error";
  title: string;
  detail: string;
  timestamp: string;
  link?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.floor((target - now) / (1000 * 60 * 60 * 24));
}

function buildTokenAlerts(tokens: TokensData | null): Alert[] {
  if (!tokens) return [];
  const alerts: Alert[] = [];

  const tokenFields: { key: keyof TokensData; label: string }[] = [
    { key: "threads_token_expiry", label: "Threads" },
    { key: "ig_token_expiry", label: "Instagram" },
    { key: "fb_token_expiry", label: "Facebook" },
  ];

  for (const { key, label } of tokenFields) {
    const expiry = tokens[key];
    if (typeof expiry !== "string") continue;
    const days = daysUntil(expiry);
    if (days <= 14) {
      alerts.push({
        id: `token-${key}`,
        type: "token_expiry",
        severity: days <= 3 ? "error" : "warning",
        title: `${label} token expiring`,
        detail:
          days <= 0
            ? "Token has expired!"
            : `Expires in ${days} day${days !== 1 ? "s" : ""} (${expiry.slice(0, 10)})`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return alerts;
}

function buildWorkflowAlerts(workflows: WorkflowsPayload | null): Alert[] {
  if (!workflows?.workflows) return [];

  return workflows.workflows
    .filter(
      (wf: WorkflowStatus) =>
        wf.latestRun?.conclusion === "failure" ||
        wf.latestRun?.conclusion === "cancelled"
    )
    .map((wf: WorkflowStatus) => ({
      id: `wf-${wf.id}`,
      type: "workflow_failure" as const,
      severity: "error" as const,
      title: `${wf.label} failed`,
      detail: `Last run failed at ${new Date(
        wf.latestRun!.updated_at
      ).toLocaleString("en-US", { timeZone: "Europe/Paris" })}`,
      timestamp: wf.latestRun!.updated_at,
      link: wf.latestRun!.html_url,
    }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  tokensData: TokensData | null;
  workflowData: WorkflowsPayload | null;
  loading: boolean;
}

export function AlertsFeed({ tokensData, workflowData, loading }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const allAlerts = useMemo(() => {
    const tokenAlerts = buildTokenAlerts(tokensData);
    const wfAlerts = buildWorkflowAlerts(workflowData);
    return [...tokenAlerts, ...wfAlerts].sort((a, b) => {
      // errors first, then by timestamp
      if (a.severity !== b.severity) return a.severity === "error" ? -1 : 1;
      return b.timestamp.localeCompare(a.timestamp);
    });
  }, [tokensData, workflowData]);

  const visibleAlerts = useMemo(
    () => allAlerts.filter((a) => !dismissed.has(a.id)).slice(0, 5),
    [allAlerts, dismissed]
  );

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  };

  if (loading) {
    return (
      <div className="rounded-xl border bg-white dark:bg-zinc-900/40 border-gray-200 dark:border-zinc-800/50 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-zinc-800/50">
          <Bell className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500" />
          <span className="text-[13px] font-semibold text-gray-900 dark:text-white">
            Alerts
          </span>
        </div>
        <div className="p-4 space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-10 rounded-lg bg-gray-100 dark:bg-zinc-800/40 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (visibleAlerts.length === 0) {
    return (
      <div className="rounded-xl border bg-white dark:bg-zinc-900/40 border-gray-200 dark:border-zinc-800/50 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-zinc-800/50">
          <Bell className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500" />
          <span className="text-[13px] font-semibold text-gray-900 dark:text-white">
            Alerts
          </span>
        </div>
        <div className="px-4 py-6 text-center">
          <p className="text-[12px] text-gray-400 dark:text-zinc-600">
            No active alerts — all systems nominal
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white dark:bg-zinc-900/40 border-gray-200 dark:border-zinc-800/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800/50">
        <div className="flex items-center gap-2">
          <Bell className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[13px] font-semibold text-gray-900 dark:text-white">
            Alerts
          </span>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-4 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-400"
          >
            {visibleAlerts.length}
          </Badge>
        </div>
      </div>

      <div className="divide-y divide-gray-50 dark:divide-zinc-800/40">
        {visibleAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`flex items-start gap-3 px-4 py-2.5 ${
              alert.severity === "error"
                ? "bg-rose-50/50 dark:bg-rose-950/10"
                : "bg-amber-50/30 dark:bg-amber-950/5"
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {alert.severity === "error" ? (
                <XCircle className="w-3.5 h-3.5 text-rose-500" />
              ) : alert.type === "token_expiry" ? (
                <Clock className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-gray-800 dark:text-zinc-200">
                {alert.title}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-zinc-500 mt-0.5">
                {alert.detail}
              </p>
              {alert.link && (
                <a
                  href={alert.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-blue-500 hover:text-blue-600 dark:text-blue-400"
                >
                  View logs
                </a>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              className="shrink-0 text-gray-300 dark:text-zinc-700 hover:text-gray-500 dark:hover:text-zinc-400"
              onClick={() => handleDismiss(alert.id)}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
