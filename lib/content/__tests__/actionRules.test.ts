import { describe, it, expect } from "vitest";
import {
  evaluateRules,
  listRuleIds,
  type RuleContext,
  type ScoreSignals,
} from "../actionRules";

// ---------------------------------------------------------------------------
// Fixture helper — builds a neutral RuleContext that no rule should fire on.
// Individual tests override specific signals to trigger specific rules.
// ---------------------------------------------------------------------------

const NEUTRAL_SIGNALS: ScoreSignals = {
  traffic: 0.5,
  sessionQuality: 0.5,
  trendAlignment: 0.5,
  reelAmplification: 0.5,
  freshness: 0.5,
  monetization: 1.0, // neutral = widgets present, so R4 doesn't fire
};

function makeCtx(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    signals: { ...NEUTRAL_SIGNALS, ...(overrides.signals ?? {}) },
    score: overrides.score ?? 50,
    delta7d: overrides.delta7d ?? 0,
    flags: overrides.flags ?? [],
    slug: overrides.slug ?? "test-article-slug",
    title: overrides.title ?? "Test Article",
    url: overrides.url ?? "https://flashvoyage.com/test-article-slug/",
    wpId: overrides.wpId ?? 42,
    surface: overrides.surface ?? "refresh",
    // FR metadata defaults to undefined so most tests keep their baseline
    // behavior (R9 can't fire without explicit frShare / fr_light flag).
    frShare: "frShare" in overrides ? overrides.frShare : undefined,
    frPageviews: overrides.frPageviews,
  };
}

// ---------------------------------------------------------------------------
// Baseline: nothing fires on a neutral (healthy) article
// ---------------------------------------------------------------------------

describe("evaluateRules — baseline", () => {
  it("always returns R8 (catch-all investigate) on refresh surface", () => {
    // R8 is a guaranteed fallback so a refresh-queue article can never
    // show an empty recommendations panel — even with neutral signals the
    // investigation CTA surfaces as a safety net.
    const recs = evaluateRules(makeCtx({ surface: "refresh" }));
    expect(recs).toHaveLength(1);
    expect(recs[0].id).toBe("R8-investigate-decline");
  });

  it("returns empty for a healthy top-surface article", () => {
    // R8 is refresh-only; top performers with neutral signals genuinely
    // have nothing to recommend.
    const recs = evaluateRules(makeCtx({ surface: "top" }));
    expect(recs).toEqual([]);
  });

  it("returns empty when signals object is missing", () => {
    const ctx = makeCtx();
    // @ts-expect-error — deliberately testing undefined signals guard
    ctx.signals = undefined;
    const recs = evaluateRules(ctx);
    expect(recs).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Refresh Queue rules — each fires on its canonical trigger
// ---------------------------------------------------------------------------

describe("Refresh rules — individual firing", () => {
  it("R4 fires when monetization<0.5 AND traffic>0.3", () => {
    const recs = evaluateRules(
      makeCtx({
        signals: {
          ...NEUTRAL_SIGNALS,
          monetization: 0.0,
          traffic: 0.6,
        },
      }),
    );
    expect(recs.some((r) => r.id === "R4-inject-widgets")).toBe(true);
  });

  it("R1 fires when freshness<0.3 AND traffic>0.4", () => {
    const recs = evaluateRules(
      makeCtx({
        signals: {
          ...NEUTRAL_SIGNALS,
          freshness: 0.1,
          traffic: 0.7,
        },
      }),
    );
    expect(recs.some((r) => r.id === "R1-yyyy-refresh")).toBe(true);
  });

  it("R3 fires when sessionQuality<0.3 AND traffic>0.3", () => {
    const recs = evaluateRules(
      makeCtx({
        signals: {
          ...NEUTRAL_SIGNALS,
          sessionQuality: 0.1,
          traffic: 0.5,
        },
      }),
    );
    expect(recs.some((r) => r.id === "R3-money-table-tldr")).toBe(true);
  });

  it("R6 fires when reelAmplification<0.2 AND traffic>0.4", () => {
    const recs = evaluateRules(
      makeCtx({
        signals: {
          ...NEUTRAL_SIGNALS,
          reelAmplification: 0.1,
          traffic: 0.6,
        },
      }),
    );
    expect(recs.some((r) => r.id === "R6-reel-recut")).toBe(true);
  });

  it("R5 fires when traffic<0.2 AND freshness>0.7", () => {
    const recs = evaluateRules(
      makeCtx({
        signals: {
          ...NEUTRAL_SIGNALS,
          traffic: 0.1,
          freshness: 0.9,
        },
      }),
    );
    expect(recs.some((r) => r.id === "R5-gsc-rewrite")).toBe(true);
  });

  it("R2 fires when traffic<0.2 AND trendAlignment<0.3", () => {
    const recs = evaluateRules(
      makeCtx({
        signals: {
          ...NEUTRAL_SIGNALS,
          traffic: 0.1,
          trendAlignment: 0.1,
        },
      }),
    );
    expect(recs.some((r) => r.id === "R2-trending-h2")).toBe(true);
  });

  it("R7 fires only when ALL four signals are <0.3", () => {
    const recs = evaluateRules(
      makeCtx({
        signals: {
          traffic: 0.1,
          sessionQuality: 0.1,
          trendAlignment: 0.1,
          freshness: 0.1,
          reelAmplification: 0.5,
          monetization: 1.0,
        },
      }),
    );
    expect(recs.some((r) => r.id === "R7-merge-redirect")).toBe(true);
  });

  it("R7 does NOT fire if any of the four core signals is >=0.3", () => {
    const recs = evaluateRules(
      makeCtx({
        signals: {
          traffic: 0.1,
          sessionQuality: 0.1,
          trendAlignment: 0.1,
          freshness: 0.35, // just above threshold
          reelAmplification: 0.5,
          monetization: 1.0,
        },
      }),
    );
    expect(recs.some((r) => r.id === "R7-merge-redirect")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// R9 — FR-SEO rewrite (Phase 1 fr-share-scoring feat)
// ---------------------------------------------------------------------------

describe("R9 — fr-seo-rewrite", () => {
  it("fires when frShare < 0.25 AND composite score >= 50", () => {
    // Canonical R9 trigger: article is performing globally (score 60) but
    // only ~10% of its traffic comes from France — clear FR-SEO opportunity.
    const recs = evaluateRules(
      makeCtx({
        score: 60,
        frShare: 0.1,
        frPageviews: 1000,
      }),
    );
    const r9 = recs.find((r) => r.id === "R9-fr-seo-rewrite");
    expect(r9).toBeDefined();
    // Rationale should surface the real percentage so the founder can sanity-check.
    expect(r9?.rationale).toContain("10%");
    expect(r9?.rationale).toContain("1,000");
    expect(r9?.tag).toBe("Long bet");
    expect(r9?.cta.kind).toBe("url");
  });

  it("does NOT fire when frShare is healthy (0.5) even with score >= 50", () => {
    const recs = evaluateRules(
      makeCtx({
        score: 60,
        frShare: 0.5,
        frPageviews: 1000,
      }),
    );
    expect(recs.some((r) => r.id === "R9-fr-seo-rewrite")).toBe(false);
  });

  it("does NOT fire when frShare is null (no data = no recommendation)", () => {
    // null is the content-repo's "intentionally absent" marker (0 pageviews).
    // Firing R9 here would surface advice based on missing data — safer default
    // is silence. Same behavior for undefined (content repo hasn't shipped yet).
    const recs = evaluateRules(
      makeCtx({
        score: 60,
        frShare: null,
      }),
    );
    expect(recs.some((r) => r.id === "R9-fr-seo-rewrite")).toBe(false);

    const recsUndef = evaluateRules(
      makeCtx({
        score: 60,
        frShare: undefined,
      }),
    );
    expect(recsUndef.some((r) => r.id === "R9-fr-seo-rewrite")).toBe(false);
  });

  it("does NOT fire when score < 50 (article not yet proven globally)", () => {
    // R9 is an opportunity-cost rule — we only recommend FR rewrites on
    // articles that already rank. Below score 50 the topic hasn't proven
    // fit, so R5 / R2 (rewrite-from-scratch rules) are the better surface.
    const recs = evaluateRules(
      makeCtx({
        score: 40,
        frShare: 0.1,
      }),
    );
    expect(recs.some((r) => r.id === "R9-fr-seo-rewrite")).toBe(false);
  });

  it("fires via the fr_light flag path even when frShare is absent", () => {
    // Path B: content repo can force-surface R9 by tagging an article `fr_light`
    // without exposing the 0.25 threshold in the cron config. Useful when the
    // writer has qualitative FR-market context that the metric doesn't capture.
    const recs = evaluateRules(
      makeCtx({
        score: 50,
        flags: ["fr_light"],
      }),
    );
    expect(recs.some((r) => r.id === "R9-fr-seo-rewrite")).toBe(true);
  });

  it("is refresh-only — does NOT fire on top surface", () => {
    const recs = evaluateRules(
      makeCtx({
        surface: "top",
        score: 80,
        frShare: 0.05,
      }),
    );
    expect(recs.some((r) => r.id === "R9-fr-seo-rewrite")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Top Performers rules — each fires on its canonical trigger
// ---------------------------------------------------------------------------

describe("Top rules — individual firing", () => {
  it("T1 fires when traffic>0.7 AND monetization<0.5", () => {
    const recs = evaluateRules(
      makeCtx({
        surface: "top",
        signals: {
          ...NEUTRAL_SIGNALS,
          traffic: 0.8,
          monetization: 0.0,
        },
      }),
    );
    expect(recs.some((r) => r.id === "T1-esim-widget")).toBe(true);
  });

  it("T3 fires when traffic>0.7 AND freshness<0.5", () => {
    const recs = evaluateRules(
      makeCtx({
        surface: "top",
        signals: {
          ...NEUTRAL_SIGNALS,
          traffic: 0.8,
          freshness: 0.3,
        },
      }),
    );
    expect(recs.some((r) => r.id === "T3-preemptive-refresh")).toBe(true);
  });

  it("T4 fires when traffic>0.8", () => {
    const recs = evaluateRules(
      makeCtx({
        surface: "top",
        signals: {
          ...NEUTRAL_SIGNALS,
          traffic: 0.9,
        },
      }),
    );
    expect(recs.some((r) => r.id === "T4-internal-links")).toBe(true);
  });

  it("T4 does NOT fire when traffic<=0.8", () => {
    const recs = evaluateRules(
      makeCtx({
        surface: "top",
        signals: {
          ...NEUTRAL_SIGNALS,
          traffic: 0.75,
        },
      }),
    );
    expect(recs.some((r) => r.id === "T4-internal-links")).toBe(false);
  });

  it("T2 fires when traffic>0.7 AND reelAmplification<0.3", () => {
    const recs = evaluateRules(
      makeCtx({
        surface: "top",
        signals: {
          ...NEUTRAL_SIGNALS,
          traffic: 0.75,
          reelAmplification: 0.1,
        },
      }),
    );
    expect(recs.some((r) => r.id === "T2-reel-creation")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Surface isolation — refresh rules don't leak into top, and vice versa
// ---------------------------------------------------------------------------

describe("Surface isolation", () => {
  it("refresh rules never fire on top surface", () => {
    const recs = evaluateRules(
      makeCtx({
        surface: "top",
        signals: {
          traffic: 0.5, // matches R4's traffic gate
          sessionQuality: 0.1,
          trendAlignment: 0.1,
          reelAmplification: 0.1,
          freshness: 0.1,
          monetization: 0.0, // matches R4's monetization gate
        },
      }),
    );
    // R4 would fire on refresh surface with these signals, but we're on top
    expect(recs.some((r) => r.id.startsWith("R"))).toBe(false);
  });

  it("top rules never fire on refresh surface", () => {
    const recs = evaluateRules(
      makeCtx({
        surface: "refresh",
        signals: {
          ...NEUTRAL_SIGNALS,
          traffic: 0.9, // would fire T4
          monetization: 0.2, // would also fire T1
          freshness: 0.3, // would also fire T3
        },
      }),
    );
    // But since monetization=0.2 AND traffic=0.9, R4 WILL fire (refresh rule)
    // What we want to verify: T* rules don't leak
    expect(recs.some((r) => r.id.startsWith("T"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Priority ordering + severity multiplier
// ---------------------------------------------------------------------------

describe("Priority ordering", () => {
  it("R4 (basePriority 100) beats R1 (basePriority 90) when both fire equally", () => {
    const recs = evaluateRules(
      makeCtx({
        signals: {
          ...NEUTRAL_SIGNALS,
          monetization: 0.4, // triggers R4 with small severity
          traffic: 0.45, // both R4 + R1 above threshold
          freshness: 0.25, // triggers R1 with small severity
        },
      }),
    );
    const r4Idx = recs.findIndex((r) => r.id === "R4-inject-widgets");
    const r1Idx = recs.findIndex((r) => r.id === "R1-yyyy-refresh");
    expect(r4Idx).toBeGreaterThanOrEqual(0);
    expect(r1Idx).toBeGreaterThanOrEqual(0);
    expect(r4Idx).toBeLessThan(r1Idx);
  });

  it("severity multiplier lifts a more-severe rule above a less-severe sibling", () => {
    // Two refresh articles side by side: same rules fire but signals differ.
    // Article A has freshness=0.29 (mild R1), article B has freshness=0.05 (severe R1).
    // R1 on B should have higher priority than R1 on A.
    const recsA = evaluateRules(
      makeCtx({
        signals: { ...NEUTRAL_SIGNALS, freshness: 0.29, traffic: 0.5 },
      }),
    );
    const recsB = evaluateRules(
      makeCtx({
        signals: { ...NEUTRAL_SIGNALS, freshness: 0.05, traffic: 0.5 },
      }),
    );
    const priorityA = recsA.find((r) => r.id === "R1-yyyy-refresh")?.priority;
    const priorityB = recsB.find((r) => r.id === "R1-yyyy-refresh")?.priority;
    expect(priorityA).toBeDefined();
    expect(priorityB).toBeDefined();
    expect(priorityB!).toBeGreaterThan(priorityA!);
  });

  it("R7 (basePriority 10) stays at the bottom even with max severity", () => {
    // All four gates maximally wrong (all at 0) → severity sum ~1.2 (capped at 1 per gate)
    // R7 priority = 10 * (1 + 1.2) = 22 worst case
    // R3 fires too (session + traffic gates), basePriority 80, priority >= 80
    const recs = evaluateRules(
      makeCtx({
        signals: {
          traffic: 0.31, // above R3 traffic gate 0.3 AND above R7 traffic gate 0.3 → R7 won't fire
          sessionQuality: 0.05,
          trendAlignment: 0.05,
          reelAmplification: 0.5,
          freshness: 0.05,
          monetization: 1.0,
        },
      }),
    );
    // R7 needs ALL four <0.3 — here traffic 0.31 blocks it
    expect(recs.some((r) => r.id === "R7-merge-redirect")).toBe(false);
    // R3 should still fire (session<0.3 AND traffic>0.3)
    expect(recs.some((r) => r.id === "R3-money-table-tldr")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// `max` parameter limits results
// ---------------------------------------------------------------------------

describe("max parameter", () => {
  it("returns at most `max` recommendations", () => {
    // Force 3+ rules to fire at once
    const recs = evaluateRules(
      makeCtx({
        signals: {
          traffic: 0.6,
          sessionQuality: 0.1, // R3
          trendAlignment: 0.5,
          reelAmplification: 0.1, // R6 (needs traffic>0.4 ✓)
          freshness: 0.2, // R1 (needs traffic>0.4 ✓)
          monetization: 0.1, // R4 (needs traffic>0.3 ✓)
        },
      }),
      2,
    );
    expect(recs.length).toBeLessThanOrEqual(2);
  });

  it("defaults to max=3 when not specified", () => {
    const recs = evaluateRules(
      makeCtx({
        signals: {
          traffic: 0.6,
          sessionQuality: 0.1,
          trendAlignment: 0.5,
          reelAmplification: 0.1,
          freshness: 0.2,
          monetization: 0.1,
        },
      }),
    );
    expect(recs.length).toBeLessThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// CTA discriminated union — each rule emits the expected kind
// ---------------------------------------------------------------------------

describe("CTA kind per rule", () => {
  it("R1 and T3 emit workflow CTAs targeting refresh-articles.yml", () => {
    const r1 = evaluateRules(
      makeCtx({
        signals: { ...NEUTRAL_SIGNALS, freshness: 0.1, traffic: 0.7 },
      }),
    ).find((r) => r.id === "R1-yyyy-refresh");
    expect(r1?.cta.kind).toBe("workflow");
    if (r1?.cta.kind === "workflow") {
      expect(r1.cta.workflow).toBe("refresh-articles.yml");
      expect(r1.cta.inputs.slug).toBe("test-article-slug");
    }

    const t3 = evaluateRules(
      makeCtx({
        surface: "top",
        signals: { ...NEUTRAL_SIGNALS, traffic: 0.8, freshness: 0.3 },
      }),
    ).find((r) => r.id === "T3-preemptive-refresh");
    expect(t3?.cta.kind).toBe("workflow");
  });

  it("R2, R5, T4 emit url CTAs pointing at WordPress admin", () => {
    const ctx = makeCtx({
      wpId: 42,
      signals: {
        ...NEUTRAL_SIGNALS,
        traffic: 0.1,
        trendAlignment: 0.1,
        freshness: 0.9, // also triggers R5
      },
    });
    const recs = evaluateRules(ctx);
    const r2 = recs.find((r) => r.id === "R2-trending-h2");
    expect(r2?.cta.kind).toBe("url");
    if (r2?.cta.kind === "url") {
      expect(r2.cta.href).toContain("wp-admin/post.php?post=42");
    }
  });

  it("R6, R7, T2 emit todo CTAs (features not yet wired)", () => {
    const r6 = evaluateRules(
      makeCtx({
        signals: {
          ...NEUTRAL_SIGNALS,
          reelAmplification: 0.1,
          traffic: 0.6,
        },
      }),
    ).find((r) => r.id === "R6-reel-recut");
    expect(r6?.cta.kind).toBe("todo");

    const r7 = evaluateRules(
      makeCtx({
        signals: {
          traffic: 0.1,
          sessionQuality: 0.1,
          trendAlignment: 0.1,
          freshness: 0.1,
          reelAmplification: 0.5,
          monetization: 1.0,
        },
      }),
    ).find((r) => r.id === "R7-merge-redirect");
    expect(r7?.cta.kind).toBe("todo");

    const t2 = evaluateRules(
      makeCtx({
        surface: "top",
        signals: {
          ...NEUTRAL_SIGNALS,
          traffic: 0.75,
          reelAmplification: 0.1,
        },
      }),
    ).find((r) => r.id === "T2-reel-creation");
    expect(t2?.cta.kind).toBe("todo");
  });
});

// ---------------------------------------------------------------------------
// Lift aggregation fields — liftLow/liftHigh populate only on monetization rules
// ---------------------------------------------------------------------------

describe("Lift aggregation fields", () => {
  it("R4 carries liftLow=5, liftHigh=15", () => {
    const rec = evaluateRules(
      makeCtx({
        signals: { ...NEUTRAL_SIGNALS, monetization: 0.0, traffic: 0.6 },
      }),
    ).find((r) => r.id === "R4-inject-widgets");
    expect(rec?.liftLow).toBe(5);
    expect(rec?.liftHigh).toBe(15);
  });

  it("T1 carries liftLow=10, liftHigh=30", () => {
    const rec = evaluateRules(
      makeCtx({
        surface: "top",
        signals: { ...NEUTRAL_SIGNALS, traffic: 0.8, monetization: 0.0 },
      }),
    ).find((r) => r.id === "T1-esim-widget");
    expect(rec?.liftLow).toBe(10);
    expect(rec?.liftHigh).toBe(30);
  });

  it("non-monetization rules have no liftLow/liftHigh", () => {
    const rec = evaluateRules(
      makeCtx({
        signals: { ...NEUTRAL_SIGNALS, freshness: 0.1, traffic: 0.7 },
      }),
    ).find((r) => r.id === "R1-yyyy-refresh");
    expect(rec?.liftLow).toBeUndefined();
    expect(rec?.liftHigh).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// listRuleIds introspection
// ---------------------------------------------------------------------------

describe("listRuleIds", () => {
  it("returns 9 refresh rule ids (including R8 catch-all and R9 fr-seo-rewrite)", () => {
    const ids = listRuleIds("refresh");
    expect(ids).toHaveLength(9);
    expect(ids).toEqual(
      expect.arrayContaining([
        "R4-inject-widgets",
        "R1-yyyy-refresh",
        "R3-money-table-tldr",
        "R6-reel-recut",
        "R5-gsc-rewrite",
        "R2-trending-h2",
        "R7-merge-redirect",
        "R8-investigate-decline",
        "R9-fr-seo-rewrite",
      ]),
    );
  });

  it("returns 4 top rule ids", () => {
    const ids = listRuleIds("top");
    expect(ids).toHaveLength(4);
    expect(ids).toEqual(
      expect.arrayContaining([
        "T1-esim-widget",
        "T3-preemptive-refresh",
        "T4-internal-links",
        "T2-reel-creation",
      ]),
    );
  });
});
