/**
 * Shared types + helpers for the Authority Amplifier feature.
 *
 * Queue files are written by the sibling content-repo agent at
 * `data/amplifier-queue/<slug>.json`. This module defines the canonical
 * shape both the API routes and the /amplifier page consume.
 */

export type AmplifierActionType =
  | "edit_existing_answer"
  | "answer_new_question"
  | "comment_on_thread"
  | "post_followup";

export type AmplifierPriority = "high" | "medium" | "low";

export interface AmplifierActionBase {
  /** Stable id within the queue; if missing we derive one client-side. */
  id?: string;
  type: AmplifierActionType;
  priority: AmplifierPriority;
  questionTitle?: string;
  estimatedReachViews?: number;
  topicRelevanceScore?: number;
  confidenceScore?: number;
  rationale?: string;
  /** Dispatch state written back by the execute/dismiss routes. */
  status?: "pending" | "flagged_for_execution" | "dismissed" | "done";
  dismissedAt?: string;
  dismissReason?: string;
  flaggedAt?: string;
}

export interface EditExistingAnswerAction extends AmplifierActionBase {
  type: "edit_existing_answer";
  answerUrl: string;
  insertionText: string;
}

export interface AnswerNewQuestionAction extends AmplifierActionBase {
  type: "answer_new_question";
  questionUrl: string;
  existingAnswerCount?: number;
  proposedAnswer: string;
}

export type AmplifierAction =
  | EditExistingAnswerAction
  | AnswerNewQuestionAction
  | AmplifierActionBase;

export interface AmplifierQueueFile {
  generatedAt: string;
  targetSlug: string;
  targetUrl: string;
  platform: string;
  account?: string;
  actions: AmplifierAction[];
}

export interface AmplifierQueue extends AmplifierQueueFile {
  /** Number of pending (non-dismissed, non-done) actions. */
  actionCount: number;
  /** Sum of estimatedReachViews across pending actions. */
  totalReach: number;
}

export interface AmplifierSummary {
  pendingActions: number;
  totalReach: number;
  byPlatform: Record<string, number>;
}

export interface AmplifierQueueResponse {
  queues: AmplifierQueue[];
  summary: AmplifierSummary;
  fetchedAt: string;
  /** True when we're returning the demo fixtures (?demo=1 and no real data). */
  demo?: boolean;
}

/** Deterministic id for an action so UI and API agree without a generator. */
export function makeActionId(slug: string, index: number): string {
  return `${slug}__${index}`;
}

/** Priority sort weight: high > medium > low, unknown last. */
export function priorityWeight(p: AmplifierPriority | undefined): number {
  switch (p) {
    case "high":
      return 0;
    case "medium":
      return 1;
    case "low":
      return 2;
    default:
      return 3;
  }
}

/** Sort actions by priority, then confidenceScore desc. */
export function sortActions(a: AmplifierAction, b: AmplifierAction): number {
  const pw = priorityWeight(a.priority) - priorityWeight(b.priority);
  if (pw !== 0) return pw;
  return (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0);
}

/**
 * Tag pending actions with a stable id, and roll up counts / reach.
 * Dismissed + done actions are filtered out of the surface area.
 */
export function enrichQueue(file: AmplifierQueueFile): AmplifierQueue {
  const tagged = (file.actions ?? []).map((a, i) => ({
    ...a,
    id: a.id ?? makeActionId(file.targetSlug, i),
  }));
  const pending = tagged.filter(
    (a) => a.status !== "dismissed" && a.status !== "done"
  );
  const totalReach = pending.reduce(
    (s, a) => s + (a.estimatedReachViews ?? 0),
    0
  );
  return {
    ...file,
    actions: tagged,
    actionCount: pending.length,
    totalReach,
  };
}
