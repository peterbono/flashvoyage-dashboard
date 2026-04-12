"use client";

/**
 * AutoApplySettings — 3-tier toggle matrix rendered at the top of the Actions
 * tab. Controls the LOW-tier autonomous runner (mechanical edits via GitHub
 * Actions) and surfaces MEDIUM/HIGH tiers as roadmap states.
 *
 * Day-1 semantics:
 *   - LOW (emerald):   functional. Master + LOW toggles + dailyCap write to
 *                      /api/actions/settings which commits to the content repo.
 *                      Rules: R1 (YYYY refresh), T3 (preemptive refresh),
 *                      T1 (eSIM widget).
 *   - MEDIUM (amber):  visible, toggle locked. "Coming soon — draft review
 *                      workflow". Rules: R3, R4.
 *   - HIGH (rose):     visible, toggle locked off forever. "Locked — requires
 *                      editorial judgment". Rules: R5, T4, R2.
 *
 * Optimistic update: toggle flips the local state immediately, then PUTs.
 * On error the previous state is restored with a zinc flash and a tooltip.
 *
 * No emojis anywhere (user pref). lucide-react icons only.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Settings,
  Zap,
  FileEdit,
  Lock,
  Info,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types — mirror /api/actions/settings response shape
// ---------------------------------------------------------------------------

export interface AutoApplySettingsState {
  master: boolean;
  low: boolean;
  medium: boolean;
  high: boolean;
  dailyCap: number;
}

const DEFAULT_STATE: AutoApplySettingsState = {
  master: false,
  low: true,
  medium: false,
  high: false,
  dailyCap: 5,
};

// Daily-cap options 1..10 (spec §1).
const DAILY_CAP_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

// Rule groupings per tier (kept in sync with the runner allowlist).
const LOW_RULES = ["R1", "T3", "T1"] as const;
const MEDIUM_RULES = ["R3", "R4"] as const;
const HIGH_RULES = ["R5", "T4", "R2"] as const;

type FetchState = "idle" | "loading" | "saving" | "error";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AutoApplySettings() {
  const [state, setState] = useState<AutoApplySettingsState>(DEFAULT_STATE);
  const [fetchState, setFetchState] = useState<FetchState>("loading");
  const [error, setError] = useState<string | null>(null);

  // Fetch settings on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/actions/settings", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Partial<AutoApplySettingsState>;
        if (cancelled) return;
        setState({ ...DEFAULT_STATE, ...json });
        setFetchState("idle");
      } catch (err) {
        if (cancelled) return;
        console.error("[AutoApplySettings/load]", err);
        setError(String(err));
        setFetchState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist — optimistic: caller has already mutated state, we just PUT.
  // On failure we roll back to `previous`.
  const persist = useCallback(
    async (next: AutoApplySettingsState, previous: AutoApplySettingsState) => {
      setFetchState("saving");
      setError(null);
      try {
        const res = await fetch("/api/actions/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            master: next.master,
            low: next.low,
            dailyCap: next.dailyCap,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setFetchState("idle");
      } catch (err) {
        console.error("[AutoApplySettings/save]", err);
        setError(String(err));
        setState(previous);
        setFetchState("error");
      }
    },
    [],
  );

  const toggleMaster = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, master: !prev.master };
      void persist(next, prev);
      return next;
    });
  }, [persist]);

  const toggleLow = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, low: !prev.low };
      void persist(next, prev);
      return next;
    });
  }, [persist]);

  const setDailyCap = useCallback(
    (cap: number) => {
      setState((prev) => {
        if (prev.dailyCap === cap) return prev;
        const next = { ...prev, dailyCap: cap };
        void persist(next, prev);
        return next;
      });
    },
    [persist],
  );

  const disabled = fetchState === "loading";
  const effectiveLow = state.master && state.low;

  return (
    <section
      aria-labelledby="auto-apply-settings-heading"
      className="rounded-lg border border-white/[0.08] bg-white/[0.02] overflow-hidden"
    >
      {/* Header row: master toggle + daily cap */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] flex-wrap">
        <Settings
          className="w-4 h-4 text-zinc-400 shrink-0"
          aria-hidden="true"
        />
        <h3
          id="auto-apply-settings-heading"
          className="text-sm font-semibold text-zinc-50 tracking-tight"
        >
          Auto-apply
        </h3>
        <span className="text-[11px] text-zinc-500 normal-case">
          Mechanical edits run on their own. Toggle off to disable.
        </span>
        <div className="flex-1" />

        {/* Status pill */}
        {fetchState === "saving" && (
          <span className="flex items-center gap-1 text-[10px] text-amber-400 tabular-nums">
            <RefreshCw className="w-3 h-3 animate-spin" aria-hidden="true" />
            Saving…
          </span>
        )}
        {fetchState === "error" && (
          <span
            className="flex items-center gap-1 text-[10px] text-rose-400 tabular-nums"
            title={error ?? undefined}
          >
            <AlertTriangle className="w-3 h-3" aria-hidden="true" />
            Failed
          </span>
        )}

        {/* Daily cap selector */}
        <label className="flex items-center gap-2 text-[11px] text-zinc-400">
          <span>Daily cap</span>
          <select
            value={state.dailyCap}
            onChange={(e) => setDailyCap(Number(e.target.value))}
            disabled={disabled}
            aria-label="Maximum auto-applied edits per day"
            className="bg-zinc-900 border border-white/[0.08] rounded px-1.5 py-0.5 text-[11px] text-zinc-200 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 disabled:opacity-50"
          >
            {DAILY_CAP_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        {/* Master toggle */}
        <Toggle
          label="Master auto-apply"
          checked={state.master}
          onChange={toggleMaster}
          disabled={disabled}
          variant="master"
        />
      </div>

      {/* Tier rows */}
      <ul className="divide-y divide-white/[0.04]">
        <TierRow
          tier="LOW"
          label="Mechanical edits"
          description="Regex/REST swaps. No judgment required. Skip on HCU drift."
          rules={LOW_RULES}
          checked={state.low}
          onToggle={toggleLow}
          toggleDisabled={disabled || !state.master}
          effective={effectiveLow}
          variant="low"
        />
        <TierRow
          tier="MED"
          label="Review before publish"
          description="Coming soon — draft review workflow. Runner writes a draft, you approve."
          rules={MEDIUM_RULES}
          checked={false}
          onToggle={() => {
            /* intentionally blank — MED toggle is inert until runner wires
               the review workflow. */
          }}
          toggleDisabled
          effective={false}
          variant="medium"
          roadmapNote="Coming soon"
        />
        <TierRow
          tier="HIGH"
          label="Editorial judgment"
          description="Locked — SEO Guru flagged R5/T4/R2 as Russian-roulette edits. Manual only, forever."
          rules={HIGH_RULES}
          checked={false}
          onToggle={() => {
            /* locked — noop */
          }}
          toggleDisabled
          effective={false}
          variant="high"
          roadmapNote="Locked"
        />
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// TierRow
// ---------------------------------------------------------------------------

type TierVariant = "low" | "medium" | "high";

interface TierRowProps {
  tier: "LOW" | "MED" | "HIGH";
  label: string;
  description: string;
  rules: readonly string[];
  checked: boolean;
  onToggle: () => void;
  toggleDisabled: boolean;
  effective: boolean;
  variant: TierVariant;
  roadmapNote?: string;
}

function TierRow({
  tier,
  label,
  description,
  rules,
  checked,
  onToggle,
  toggleDisabled,
  effective,
  variant,
  roadmapNote,
}: TierRowProps) {
  const variantStyles = {
    low: {
      dot: "bg-emerald-500",
      pill: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
      bg: effective ? "bg-emerald-500/[0.03]" : "",
      icon: Zap,
      iconColor: "text-emerald-400",
    },
    medium: {
      dot: "bg-amber-500",
      pill: "border-amber-500/40 bg-amber-500/10 text-amber-400",
      bg: "bg-amber-500/[0.02]",
      icon: FileEdit,
      iconColor: "text-amber-400",
    },
    high: {
      dot: "bg-rose-500",
      pill: "border-rose-500/40 bg-rose-500/10 text-rose-400",
      bg: "bg-rose-500/[0.02]",
      icon: Lock,
      iconColor: "text-rose-400",
    },
  }[variant];

  const Icon = variantStyles.icon;
  const tooltip =
    variant === "high"
      ? "SEO Guru flagged R5 (H1 rewrite), T4 (internal links), R2 (trending H2 graft) as too risky to run without human review. These will never auto-apply."
      : variant === "medium"
      ? "Runner will write drafts for human review. Not yet wired — target is v2."
      : undefined;

  return (
    <li
      className={`flex items-center gap-3 px-4 py-3 flex-wrap ${variantStyles.bg}`}
    >
      {/* Dot + tier label */}
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`w-1.5 h-1.5 rounded-full ${variantStyles.dot}`}
          aria-hidden="true"
        />
        <span
          className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border tabular-nums ${variantStyles.pill}`}
        >
          {tier}
        </span>
      </div>

      {/* Icon + label + description */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Icon
          className={`w-3.5 h-3.5 shrink-0 ${variantStyles.iconColor}`}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-zinc-100">{label}</span>
            {roadmapNote && (
              <span
                className={`text-[9px] uppercase tracking-wide font-semibold px-1.5 py-0 rounded border ${variantStyles.pill}`}
              >
                {roadmapNote}
              </span>
            )}
            {tooltip && (
              <span
                title={tooltip}
                className="inline-flex items-center gap-0.5 text-[10px] text-zinc-500 hover:text-zinc-300 cursor-help"
              >
                <Info className="w-3 h-3" aria-hidden="true" />
                Why?
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">
            {description}
          </p>
        </div>
      </div>

      {/* Rule chips */}
      <div className="flex items-center gap-1 shrink-0 flex-wrap">
        {rules.map((r) => (
          <span
            key={r}
            className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded border border-white/[0.06] bg-white/[0.02] text-zinc-400"
          >
            {r}
          </span>
        ))}
      </div>

      {/* Toggle */}
      <Toggle
        label={`${tier} tier auto-apply`}
        checked={checked}
        onChange={onToggle}
        disabled={toggleDisabled}
        variant={variant}
      />
    </li>
  );
}

// ---------------------------------------------------------------------------
// Toggle — simple accessible switch
// ---------------------------------------------------------------------------

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  variant: TierVariant | "master";
}

function Toggle({ label, checked, onChange, disabled, variant }: ToggleProps) {
  const activeBg =
    variant === "master"
      ? "bg-sky-500"
      : variant === "low"
      ? "bg-emerald-500"
      : variant === "medium"
      ? "bg-amber-500"
      : "bg-rose-500";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-white/[0.08] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? activeBg : "bg-zinc-800"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-[2px]"
        }`}
        aria-hidden="true"
      />
    </button>
  );
}
