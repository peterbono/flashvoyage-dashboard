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
  /** Duration in minutes — used by Actions tab for total time aggregation. */
  durationMinutes: number;
  tag: "Quick win" | "Long bet";
  expectedLift: string;
  /** Numeric lift estimate in USD/mo (low bound) for cross-rule aggregation. */
  liftLow?: number;
  /** Numeric lift estimate in USD/mo (high bound). */
  liftHigh?: number;
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
      durationMinutes: 5,
      tag: "Quick win",
      expectedLift: "+$5-15/mo EPC per widget",
      liftLow: 5,
      liftHigh: 15,
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
      durationMinutes: 10,
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
      durationMinutes: 20,
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
  {
    // R6 — reels exist but the linked reel is flopping on IG
    id: "R6-reel-recut",
    surface: "refresh",
    basePriority: 70,
    gates: [
      ["reelAmplification", "<", 0.2],
      ["traffic", ">", 0.4],
    ],
    when: (ctx) =>
      ctx.signals.reelAmplification < 0.2 && ctx.signals.traffic > 0.4,
    build: (ctx) => ({
      headline: "Re-cut the reel with a 1.5s hook",
      duration: "30 min",
      durationMinutes: 30,
      tag: "Quick win",
      expectedLift: "+reel reach if the hook lands",
      rationale: `Article has traffic (${formatPct(
        ctx.signals.traffic
      )}) but reel amplification is weak (${formatPct(
        ctx.signals.reelAmplification
      )}). Existing reel likely has a slow opener.`,
      icon: "Film",
      cta: {
        kind: "todo",
        note: "Reel regen workflow not yet wired — re-cut manually in your reel tool",
        label: "Manual re-cut",
      },
    }),
  },
  {
    // R5 — fresh article with no traffic = SERP intent mismatch
    id: "R5-gsc-rewrite",
    surface: "refresh",
    basePriority: 60,
    gates: [
      ["traffic", "<", 0.2],
      ["freshness", ">", 0.7],
    ],
    when: (ctx) =>
      ctx.signals.traffic < 0.2 && ctx.signals.freshness > 0.7,
    build: (ctx) => ({
      headline: "Check GSC + rewrite H1 to the #1 query",
      duration: "45 min",
      durationMinutes: 45,
      tag: "Long bet",
      expectedLift: "+30-60% impressions if intent aligns",
      rationale: `Article is fresh (${formatPct(
        ctx.signals.freshness
      )}) but traffic is stuck at ${formatPct(
        ctx.signals.traffic
      )}. Classic SERP intent mismatch — check GSC top queries first.`,
      icon: "Search",
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
  {
    // R2 — trend-aware H2 grafting on a stuck article
    id: "R2-trending-h2",
    surface: "refresh",
    basePriority: 50,
    gates: [
      ["traffic", "<", 0.2],
      ["trendAlignment", "<", 0.3],
    ],
    when: (ctx) =>
      ctx.signals.traffic < 0.2 && ctx.signals.trendAlignment < 0.3,
    build: (ctx) => ({
      headline: "Graft a trending H2 section",
      duration: "90 min",
      durationMinutes: 90,
      tag: "Long bet",
      expectedLift: "+traffic if the trend matches intent",
      rationale: `Traffic is stuck (${formatPct(
        ctx.signals.traffic
      )}) and trend alignment is low (${formatPct(
        ctx.signals.trendAlignment
      )}). Consider grafting a new H2 on the current trending angle.`,
      icon: "TrendingUp",
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
  {
    // R8 — catch-all "investigate" action. Lowest priority (5) so every other
    // rule wins when they fire. Always triggers on the refresh surface so an
    // article in the Refresh Queue can never show an empty recommendations
    // panel — the founder always gets at least one next step.
    id: "R8-investigate-decline",
    surface: "refresh",
    basePriority: 5,
    gates: [], // no severity contribution — stays at priority 5 always
    when: (ctx) => ctx.surface === "refresh",
    build: (ctx) => {
      // Pick the weakest signal to personalize the rationale.
      const sortedSignals = (
        Object.entries(ctx.signals) as Array<
          [keyof typeof ctx.signals, number]
        >
      )
        .filter(([, v]) => typeof v === "number")
        .sort(([, a], [, b]) => a - b);
      const weakest = sortedSignals[0]?.[0] ?? "traffic";
      return {
        headline: "Investigate decline manually",
        duration: "15 min",
        durationMinutes: 15,
        tag: "Quick win",
        expectedLift: "Diagnostic — no automated fix available",
        rationale: `None of the automated rules match this article cleanly. Weakest signal is ${String(
          weakest,
        )} (${formatPct(
          ctx.signals[weakest],
        )}). Open GSC to check for query drops and SERP competitor shifts, then decide whether to rewrite, merge, or leave alone.`,
        icon: "Search",
        cta: {
          kind: "url",
          href: `https://search.google.com/search-console/performance/search-analytics?resource_id=sc-domain%3Aflashvoyage.com&breakdown=query&page=*${encodeURIComponent(
            ctx.slug,
          )}*`,
          label: "Open GSC",
        },
      };
    },
  },
  {
    // R7 — all signals weak = merge candidate (last-resort destructive)
    id: "R7-merge-redirect",
    surface: "refresh",
    basePriority: 10,
    gates: [
      ["traffic", "<", 0.3],
      ["sessionQuality", "<", 0.3],
      ["trendAlignment", "<", 0.3],
      ["freshness", "<", 0.3],
    ],
    when: (ctx) =>
      ctx.signals.traffic < 0.3 &&
      ctx.signals.sessionQuality < 0.3 &&
      ctx.signals.trendAlignment < 0.3 &&
      ctx.signals.freshness < 0.3,
    build: () => ({
      headline: "Flag for merge or redirect to a stronger sibling",
      duration: "60 min",
      durationMinutes: 60,
      tag: "Long bet",
      expectedLift: "Consolidate authority into a winning URL",
      rationale:
        "All four core signals are weak — this article is likely a merge candidate rather than a refresh target.",
      icon: "GitMerge",
      cta: {
        kind: "todo",
        note: "Destructive — requires manual review. Merge or 301 redirect to the strongest sibling.",
        label: "Manual review",
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
      durationMinutes: 5,
      tag: "Quick win",
      expectedLift: "+$10-30/mo — highest EPC",
      liftLow: 10,
      liftHigh: 30,
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
      durationMinutes: 10,
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
  {
    // T4 — authority pass from top-quartile winners to weak siblings
    id: "T4-internal-links",
    surface: "top",
    basePriority: 90,
    gates: [["traffic", ">", 0.8]],
    when: (ctx) => ctx.signals.traffic > 0.8,
    build: (ctx) => ({
      headline: "Inject internal links to 3-5 weak siblings",
      duration: "15 min",
      durationMinutes: 15,
      tag: "Quick win",
      expectedLift: "+authority flow to struggling articles",
      rationale: `Top-quartile traffic (${formatPct(
        ctx.signals.traffic
      )}) — use this page as an authority source to lift your weaker siblings.`,
      icon: "Link",
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
  {
    // T2 — create a reel as a second discovery funnel for a winner
    id: "T2-reel-creation",
    surface: "top",
    basePriority: 70,
    gates: [
      ["traffic", ">", 0.7],
      ["reelAmplification", "<", 0.3],
    ],
    when: (ctx) =>
      ctx.signals.traffic > 0.7 && ctx.signals.reelAmplification < 0.3,
    build: (ctx) => ({
      headline: "Create a reel to amplify this winner",
      duration: "60 min",
      durationMinutes: 60,
      tag: "Long bet",
      expectedLift: "+social amplification (IG/FB/TikTok)",
      rationale: `Top traffic (${formatPct(
        ctx.signals.traffic
      )}) but no linked reels (${formatPct(
        ctx.signals.reelAmplification
      )}). A reel adds a second discovery funnel on top of SEO.`,
      icon: "Film",
      cta: {
        kind: "todo",
        note: "Reel creation workflow not yet wired — craft manually in your reel tool",
        label: "Manual create",
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
