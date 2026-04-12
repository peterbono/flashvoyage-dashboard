"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string | null;
}

/**
 * Error boundary around the TikTok stats editor.
 *
 * Why this exists: some browser extensions (LaunchDarkly, Claude Chrome,
 * MetaMask/LavaMoat, Grammarly-style injectors) mutate the DOM directly,
 * which breaks React's reconciler when a re-render fires mid-mutation.
 * The failure mode is a `NotFoundError: insertBefore` that loops through
 * React's fiber scheduler (`ur/ua/ur/ua...`) until Chrome kills the tab
 * renderer and shows its native "This page couldn't load" page.
 *
 * With this boundary in place, the reconciler error stays scoped to the
 * editor subtree: the rest of the analytics page keeps polling, and the
 * founder sees a recoverable fallback + a Reload button. The PUT has
 * already succeeded server-side by the time this triggers (we checked
 * Vercel logs: 200 OK), and the persistent save receipt in localStorage
 * confirms it — so the reload is cosmetic, not data recovery.
 *
 * Keeping it as a class component because React hasn't shipped a hook
 * equivalent of `componentDidCatch` yet.
 */
export class TikTokStatsEditorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: null };

  static getDerivedStateFromError(err: unknown): State {
    return {
      hasError: true,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }

  componentDidCatch(err: unknown, info: unknown) {
    // eslint-disable-next-line no-console
    console.error("[tiktok-editor-boundary]", err, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="w-5 h-5 text-amber-400 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="flex-1 space-y-2">
            <h3 className="text-sm font-semibold text-amber-200">
              TikTok editor hit a render glitch
            </h3>
            <p className="text-[12px] text-zinc-300 leading-relaxed">
              Your save likely succeeded — check the green receipt above (or
              the content repo) to confirm. The display is desynced because a
              browser extension (LaunchDarkly, Claude Chrome, MetaMask, or
              similar) mutated the DOM during a React re-render, which broke
              reconciliation.
            </p>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              If this keeps happening: disable content-script extensions on
              this domain, or use a clean profile / incognito.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
              >
                <RefreshCw className="w-3 h-3" />
                Reload page
              </button>
              {this.state.errorMessage ? (
                <code className="text-[10px] text-zinc-600 truncate max-w-sm">
                  {this.state.errorMessage}
                </code>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }
}
