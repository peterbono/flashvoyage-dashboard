/**
 * Rule engine for the Action Recommendations feature on the content dashboard.
 *
 * Given an article's 6 scoring signals (traffic, sessionQuality, trendAlignment,
 * reelAmplification, freshness, monetization — all normalized 0-1) this module
 * evaluates a set of declarative rules and returns up to N prioritized action
 * recommendations ranked by (basePriority × severity) where severity measures
 * how far the triggering signals miss their thresholds.
 *
 * Pure TS module, zero React / Next.js imports — trivially unit-testable.
 * A v2 Haiku-augmented layer can call `evaluateRules()` server-side and
 * enrich each fired rule with a personalized rationale/expectedLift without
 * changing the Rule contract.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ScoreSignals {
  traffic: number;
  sessionQuality: number;
  trendAlignment: number;
  reelAmplification: number;
  freshness: number;
  monetization: number;
}

export interface RuleContext {
  signals: ScoreSignals;
  score: number;
  delta7d: number;
  flags: string[];
  slug: string;
  title: string;
  url: string;
  wpId?: number;
  surface: "refresh" | "top";
}

export type ActionCta =
  | {
      kind: "workflow";
      /** Workflow file name (must be whitelisted in /api/workflows/dispatch). */
      workflow: string;
      inputs: Record<string, string>;
      /** Optional label override for the CTA button. */
      label?: string;
    }
  | {
      kind: "url";
      href: string;
      label?: string;
    }
  | {
      kind: "todo";
      /** Tooltip explaining why this action isn't wired yet. */
      note: string;
      label?: string;
    };

export interface ActionRecommendation {
  /** Stable rule id — used for React keys, analytics, and "Mark done" dismissal. */
  id: string;
  headline: string;
  duration: string;
  tag: "Quick win" | "Long bet";
  expectedLift: string;
  rationale: string;
  /** Resolved at eval time: higher surfaces first. */
  priority: number;
  cta: ActionCta;
  /** Icon name for the lucide-react registry (Zap, Target, Sparkles, DollarSign, Film...). */
  icon: string;
}

export interface Rule {
  id: string;
  surface: "refresh" | "top";
  /** Hardcoded editorial ranking — higher = surfaces first when ties. */
  basePriority: number;
  /**
   * List of signals this rule gates on + their thresholds. Used for the
   * severity multiplier (how badly the signal misses). Each entry is a
   * tuple: [signal name, comparator, threshold].
   */
  gates: Array<[keyof ScoreSignals, "<" | ">", number]>;
  when: (ctx: RuleContext) => boolean;
  build: (ctx: RuleContext) => Omit<ActionRecommendation, "id" | "priority">;
}

// ---------------------------------------------------------------------------
// Severity helper
// ---------------------------------------------------------------------------

function computeSeverity(
  signals: ScoreSignals,
  gates: Rule["gates"]
): number {
  // Sum of (threshold - actualValue) for "<" gates and (actualValue - threshold)
  // for ">" gates, only counting gates the article is ON THE WRONG SIDE of.
  // Clamped to [0, 1] per gate to prevent runaway severity on extreme signals.
  let severity = 0;
  for (const [signal, comparator, threshold] of gates) {
    const value = signals[signal];
    if (typeof value !== "number") continue;
    if (comparator === "<" && value < threshold) {
      severity += Math.min(1, threshold - value);
    } else if (comparator === ">" && value > threshold) {
      // "Above threshold" gates mean the article is strong on this axis —
      // they contribute a smaller severity bonus so stronger articles
      // still surface in the priority order.
      severity += Math.min(1, value - threshold) * 0.2;
    }
  }
  return severity;
}

// ---------------------------------------------------------------------------
// Rule library — v1: 5 high-leverage Quick Win rules
// ---------------------------------------------------------------------------

const RULES: Rule[] = [
  // ── REFRESH QUEUE ─────────────────────────────────────────────────────
  {
    // R4 — highest ROI per CEO: direct revenue impact via affiliate widgets
    id: "R4-inject-widgets",
    surface: "refresh",
    basePriority: 100,
    gates: [
      ["monetization", "<", 0.5],
      ["traffic", ">", 0.3],
    ],
    when: (ctx) =>
      ctx.signals.monetization < 0.5 && ctx.signals.traffic > 0.3,
    build: (ctx) => ({
      headline: "Inject Travelpayouts widgets",
      duration: "5 min",
      tag: "Quick win",
      expectedLift: "+$5-15/mo EPC per widget",
      rationale: `Article has real traffic (${formatPct(
        ctx.signals.traffic
      )}) but no monetization — every view is leaving revenue on the table.`,
      icon: "DollarSign",
      cta: ctx.wpId
        ? {
            kind: "url",
            href: `https://flashvoyage.com/wp-admin/post.php?post=${ctx.wpId}&action=edit`,
            label: "Open in WordPress",
          }
        : {
            kind: "url",
            href: `https://flashvoyage.com/${ctx.slug}/`,
            label: "Open article",
          },
    }),
  },
  {
    // R1 — freshness decay on a still-performing article
    id: "R1-yyyy-refresh",
    surface: "refresh",
    basePriority: 90,
    gates: [
      ["freshness", "<", 0.3],
      ["traffic", ">", 0.4],
    ],
    when: (ctx) =>
      ctx.signals.freshness < 0.3 && ctx.signals.traffic > 0.4,
    build: (ctx) => ({
      headline: "Refresh live data + update YYYY",
      duration: "10 min",
      tag: "Quick win",
      expectedLift: "+15-25% traffic in 7d",
      rationale: `Freshness decayed to ${formatPct(
        ctx.signals.freshness
      )} but traffic still at ${formatPct(
        ctx.signals.traffic
      )}. Google rewards visible updates on proven winners.`,
      icon: "Sparkles",
      cta: {
        kind: "workflow",
        workflow: "refresh-articles.yml",
        inputs: { slug: ctx.slug },
        label: "Run refresh workflow",
      },
    }),
  },
  {
    // R3 — low dwell time on a visible article
    id: "R3-money-table-tldr",
    surface: "refresh",
    basePriority: 80,
    gates: [
      ["sessionQuality", "<", 0.3],
      ["traffic", ">", 0.3],
    ],
    when: (ctx) =>
      ctx.signals.sessionQuality < 0.3 && ctx.signals.traffic > 0.3,
    build: (ctx) => ({
      headline: "Move money table above fold + add TL;DR",
      duration: "20 min",
      tag: "Quick win",
      expectedLift: "+30-50% session duration",
      rationale: `People find the article (traffic ${formatPct(
        ctx.signals.traffic
      )}) but bounce fast (session ${formatPct(
        ctx.signals.sessionQuality
      )}). The answer is buried.`,
      icon: "LayoutTemplate",
      cta: ctx.wpId
        ? {
            kind: "url",
            href: `https://flashvoyage.com/wp-admin/post.php?post=${ctx.wpId}&action=edit`,
            label: "Edit in WordPress",
          }
        : {
            kind: "url",
            href: `https://flashvoyage.com/${ctx.slug}/`,
            label: "Open article",
          },
    }),
  },

  // ── TOP PERFORMERS ────────────────────────────────────────────────────
  {
    // T1 — highest-EPC revenue unlock on a proven winner
    id: "T1-esim-widget",
    surface: "top",
    basePriority: 100,
    gates: [
      ["traffic", ">", 0.7],
      ["monetization", "<", 0.5],
    ],
    when: (ctx) =>
      ctx.signals.traffic > 0.7 && ctx.signals.monetization < 0.5,
    build: (ctx) => ({
      headline: "Add eSIM widget (highest EPC on travel)",
      duration: "5 min",
      tag: "Quick win",
      expectedLift: "+$10-30/mo — highest EPC",
      rationale: `Top-quartile traffic (${formatPct(
        ctx.signals.traffic
      )}) but weak monetization. eSIM has the best EPC across your affiliate mix.`,
      icon: "DollarSign",
      cta: ctx.wpId
        ? {
            kind: "url",
            href: `https://flashvoyage.com/wp-admin/post.php?post=${ctx.wpId}&action=edit`,
            label: "Open in WordPress",
          }
        : {
            kind: "url",
            href: `https://flashvoyage.com/${ctx.slug}/`,
            label: "Open article",
          },
    }),
  },
  {
    // T3 — preemptive freshness on a still-winning article
    id: "T3-preemptive-refresh",
    surface: "top",
    basePriority: 80,
    gates: [
      ["traffic", ">", 0.7],
      ["freshness", "<", 0.5],
    ],
    when: (ctx) =>
      ctx.signals.traffic > 0.7 && ctx.signals.freshness < 0.5,
    build: (ctx) => ({
      headline: "Pre-emptive YYYY refresh",
      duration: "10 min",
      tag: "Quick win",
      expectedLift: "Protect current ranking",
      rationale: `Winner at ${formatPct(
        ctx.signals.traffic
      )} traffic but freshness slipping (${formatPct(
        ctx.signals.freshness
      )}). Refresh before the decline starts.`,
      icon: "ShieldCheck",
      cta: {
        kind: "workflow",
        workflow: "refresh-articles.yml",
        inputs: { slug: ctx.slug },
        label: "Run refresh workflow",
      },
    }),
  },
];

// ---------------------------------------------------------------------------
// Main evaluator
// ---------------------------------------------------------------------------

/**
 * Evaluates all rules against the given context and returns the top `max`
 * recommendations, sorted by priority descending.
 *
 * Priority formula: `basePriority * (1 + severity)` where severity is the
 * sum of (threshold - actualValue) across all gates the article is on the
 * wrong side of.
 *
 * Surface-scoped: rules with `surface: "refresh"` only fire on Refresh Queue
 * items, `surface: "top"` only on Top Performers items.
 */
export function evaluateRules(
  ctx: RuleContext,
  max: number = 3
): ActionRecommendation[] {
  if (!ctx.signals) return [];

  const fired: ActionRecommendation[] = [];
  for (const rule of RULES) {
    if (rule.surface !== ctx.surface) continue;
    if (!rule.when(ctx)) continue;
    const severity = computeSeverity(ctx.signals, rule.gates);
    const priority = rule.basePriority * (1 + severity);
    const built = rule.build(ctx);
    fired.push({
      id: rule.id,
      priority,
      ...built,
    });
  }

  fired.sort((a, b) => b.priority - a.priority);
  return fired.slice(0, max);
}

/**
 * Returns the list of rule ids that COULD fire on a given surface — used for
 * tests and introspection. Does NOT evaluate against any context.
 */
export function listRuleIds(surface: "refresh" | "top"): string[] {
  return RULES.filter((r) => r.surface === surface).map((r) => r.id);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}
