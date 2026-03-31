"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calendar,
  Clock,
  FlaskConical,
  Loader2,
  Play,
  Rocket,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ABTest {
  id?: string;
  name?: string;
  format?: string;
  variant_a?: string;
  variant_b?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  winner?: string;
  metric?: string;
  lift?: number;
}

export interface ABTestsData {
  activeTests: ABTest[];
  completedTests: ABTest[];
  winningPatterns: ABTest[];
  meta: {
    lastRunAt: string | null;
    totalTestsRun: number;
    totalWins: number;
    avgLift: number;
    createdAt: string;
    version: string;
  };
}

// ── BASE_CALENDAR logic (mirrors smart-scheduler.js) ───────────────────────

const BASE_CALENDAR: Record<string, Record<number, string>> = {
  "05": {
    1: "pick", 2: "budget", 3: "pick", 4: "pick", 5: "pick", 6: "budget", 7: "avantapres",
  },
  "10": {
    1: "versus", 2: "month", 3: "versus", 4: "pick", 5: "versus", 6: "pick", 7: "versus",
  },
  "16": {
    1: "humor", 2: "humor-tweet", 3: "humor", 4: "humor-tweet", 5: "humor", 6: "humor-tweet", 7: "humor",
  },
};

const FORMAT_LABELS: Record<string, string> = {
  poll: "Poll",
  pick: "Trip Pick",
  humor: "Humor",
  "humor-tweet": "Humor Tweet",
  versus: "Versus",
  budget: "Budget Jour",
  avantapres: "Avant/Apres",
  month: "Ou Partir En",
};

const SLOT_LABELS: Record<string, string> = {
  "05": "07h00 (Paris)",
  "10": "12h30 (Paris)",
  "16": "18h00 (Paris)",
};

const ALL_FORMATS = ["poll", "pick", "humor", "humor-tweet", "versus", "budget", "avantapres", "month"];

// ── Helpers ────────────────────────────────────────────────────────────────

function getNextSlots(count: number): { utcHour: string; dow: number; format: string; timeLabel: string; reason: string }[] {
  const now = new Date();
  const slots: { utcHour: string; dow: number; format: string; timeLabel: string; reason: string }[] = [];
  const slotHours = [5, 10, 16];

  // Start from current time
  let cursor = new Date(now);

  while (slots.length < count) {
    const cursorHour = cursor.getUTCHours();
    const dow = cursor.getUTCDay() || 7; // Convert 0 (Sun) to 7

    for (const slotH of slotHours) {
      if (slots.length >= count) break;

      // Skip slots in the past for today
      if (cursor.toDateString() === now.toDateString() && slotH <= cursorHour) continue;

      const hourKey = String(slotH).padStart(2, "0");
      let format = BASE_CALENDAR[hourKey]?.[dow] ?? "pick";

      // Guard "month" format (only first Tuesday)
      if (format === "month") {
        const dayOfMonth = cursor.getUTCDate();
        const dayOfWeek = cursor.getUTCDay();
        if (!(dayOfMonth <= 7 && dayOfWeek === 2)) {
          format = "pick";
        }
      }

      const dayName = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"][cursor.getUTCDay()];
      const dateStr = cursor.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

      slots.push({
        utcHour: hourKey,
        dow,
        format,
        timeLabel: `${dayName} ${dateStr} - ${SLOT_LABELS[hourKey] ?? `${slotH}h UTC`}`,
        reason: `Base calendar (${hourKey}h UTC, jour ${dow})`,
      });
    }

    // Move to next day
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    cursor.setUTCHours(0, 0, 0, 0);
  }

  return slots;
}

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  abTests: ABTestsData | null;
  loading: boolean;
}

export function ManualControl({ abTests, loading }: Props) {
  const [selectedFormat, setSelectedFormat] = useState<string>("");
  const [articleId, setArticleId] = useState("");
  const [testOnly, setTestOnly] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ ok: boolean; message: string } | null>(null);

  const nextSlots = useMemo(() => getNextSlots(3), []);

  async function handlePublish() {
    if (!selectedFormat) return;
    setPublishing(true);
    setPublishResult(null);

    try {
      const inputs: Record<string, string> = {
        format: selectedFormat,
        test_only: testOnly ? "true" : "false",
      };
      if (articleId.trim()) {
        inputs.article_id = articleId.trim();
      }

      const res = await fetch("/api/workflows/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow: "publish-reels.yml",
          inputs,
        }),
      });

      const data = await res.json();

      if (res.ok && data.triggered) {
        setPublishResult({
          ok: true,
          message: `Workflow lance avec succes${data.runId ? ` (run #${data.runId})` : ""}`,
        });
      } else {
        setPublishResult({
          ok: false,
          message: data.error ?? "Echec du declenchement",
        });
      }
    } catch (err) {
      setPublishResult({
        ok: false,
        message: `Erreur reseau: ${String(err)}`,
      });
    } finally {
      setPublishing(false);
    }
  }

  const hasActiveTests = (abTests?.activeTests?.length ?? 0) > 0;
  const hasCompletedTests = (abTests?.completedTests?.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      {/* Next 3 scheduled reels */}
      <Card className="border-zinc-800/50 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-500" />
            Prochains 3 Reels
          </CardTitle>
          <CardDescription>
            Preview du smart scheduler (base calendar)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {nextSlots.map((slot, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-zinc-800/50 bg-zinc-800/20 p-3"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 shrink-0">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white font-medium">
                      {FORMAT_LABELS[slot.format] ?? slot.format}
                    </span>
                    <Badge
                      variant="outline"
                      className="border-zinc-700/50 text-zinc-400 text-xs"
                    >
                      {slot.utcHour}h UTC
                    </Badge>
                  </div>
                  <span className="text-xs text-zinc-500">{slot.timeLabel}</span>
                </div>
                <Badge
                  variant="outline"
                  className="border-zinc-700/50 text-zinc-500 text-xs shrink-0"
                >
                  #{i + 1}
                </Badge>
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-600 mt-3">
            Les formats peuvent changer en temps reel selon les breaking news, trends et performances.
          </p>
        </CardContent>
      </Card>

      {/* Override Form */}
      <Card className="border-zinc-800/50 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Rocket className="w-4 h-4 text-amber-500" />
            Publication manuelle
          </CardTitle>
          <CardDescription>
            Forcer la publication d&apos;un reel hors planning
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Format selector */}
            <div className="space-y-2">
              <Label className="text-zinc-400 text-xs">Format</Label>
              <Select value={selectedFormat} onValueChange={(v) => setSelectedFormat(v ?? "")}>
                <SelectTrigger className="bg-zinc-800/50 border-zinc-700 text-white h-9 w-full">
                  <SelectValue placeholder="Choisir un format..." />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  {ALL_FORMATS.map((f) => (
                    <SelectItem key={f} value={f} className="text-white">
                      {FORMAT_LABELS[f] ?? f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Article ID */}
            <div className="space-y-2">
              <Label className="text-zinc-400 text-xs">
                Article ID <span className="text-zinc-600">(optionnel)</span>
              </Label>
              <Input
                value={articleId}
                onChange={(e) => setArticleId(e.target.value)}
                placeholder="ex: 1234"
                className="bg-zinc-800/50 border-zinc-700 text-white h-9 placeholder:text-zinc-600"
              />
            </div>

            {/* Test Only toggle */}
            <div className="flex items-center justify-between rounded-lg border border-zinc-800/50 bg-zinc-800/20 p-3">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-zinc-400" />
                <div>
                  <span className="text-sm text-white">Mode test</span>
                  <p className="text-xs text-zinc-500">Genere le reel sans le publier</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={testOnly}
                onClick={() => setTestOnly(!testOnly)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 ${
                  testOnly ? "bg-amber-500" : "bg-zinc-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    testOnly ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Publish button */}
            <Button
              onClick={handlePublish}
              disabled={!selectedFormat || publishing}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold h-10 gap-2 disabled:opacity-40"
            >
              {publishing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Lancement...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  {testOnly ? "Tester maintenant" : "Publier maintenant"}
                </>
              )}
            </Button>

            {/* Result feedback */}
            {publishResult && (
              <div
                className={`flex items-start gap-2 rounded-lg border p-3 ${
                  publishResult.ok
                    ? "border-emerald-800/50 bg-emerald-950/30"
                    : "border-red-800/50 bg-red-950/30"
                }`}
              >
                {publishResult.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                )}
                <span className={`text-xs ${publishResult.ok ? "text-emerald-300" : "text-red-300"}`}>
                  {publishResult.message}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* A/B Test Status */}
      <Card className="border-zinc-800/50 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            Tests A/B
          </CardTitle>
          <CardDescription>
            {abTests?.meta?.totalTestsRun
              ? `${abTests.meta.totalTestsRun} tests effectues, ${abTests.meta.totalWins} gagnants`
              : "Aucun test effectue"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-20">
              <span className="text-zinc-500 text-sm">Chargement...</span>
            </div>
          ) : !hasActiveTests && !hasCompletedTests ? (
            <div className="flex flex-col items-center justify-center h-24 text-zinc-600 text-sm">
              <FlaskConical className="w-6 h-6 mb-2 text-zinc-700" />
              Aucun test A/B actif
              <span className="text-xs text-zinc-700 mt-1">
                Les tests se lanceront automatiquement quand le systeme detecte une opportunite
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              {hasActiveTests && (
                <div>
                  <span className="text-xs text-zinc-500 font-medium mb-2 block">Tests actifs</span>
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800">
                        <TableHead className="text-zinc-400">Test</TableHead>
                        <TableHead className="text-zinc-400">Variante A</TableHead>
                        <TableHead className="text-zinc-400">Variante B</TableHead>
                        <TableHead className="text-zinc-400">Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {abTests!.activeTests.map((test, i) => (
                        <TableRow key={i} className="border-zinc-800/50">
                          <TableCell className="text-sm text-white">
                            {test.name ?? test.format ?? `Test #${i + 1}`}
                          </TableCell>
                          <TableCell className="text-sm text-zinc-300">{test.variant_a ?? "--"}</TableCell>
                          <TableCell className="text-sm text-zinc-300">{test.variant_b ?? "--"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-amber-800/50 text-amber-400 gap-1 text-xs">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              {test.status ?? "en cours"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </div>
              )}

              {hasCompletedTests && (
                <div>
                  <span className="text-xs text-zinc-500 font-medium mb-2 block">Tests termines</span>
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-zinc-800">
                        <TableHead className="text-zinc-400">Test</TableHead>
                        <TableHead className="text-zinc-400">Gagnant</TableHead>
                        <TableHead className="text-zinc-400">Lift</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {abTests!.completedTests.map((test, i) => (
                        <TableRow key={i} className="border-zinc-800/50">
                          <TableCell className="text-sm text-white">
                            {test.name ?? test.format ?? `Test #${i + 1}`}
                          </TableCell>
                          <TableCell className="text-sm text-emerald-400">
                            {test.winner ?? "--"}
                          </TableCell>
                          <TableCell className="text-sm text-white tabular-nums">
                            {test.lift !== undefined ? `+${(test.lift * 100).toFixed(1)}%` : "--"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
