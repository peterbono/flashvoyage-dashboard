export type TaskColumn = "backlog" | "in_progress" | "testing" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  column: TaskColumn;
  priority: TaskPriority;
  tags: string[];
  dueDate?: string;
}

export const TASK_COLUMNS: { id: TaskColumn; label: string; color: string }[] = [
  { id: "backlog",     label: "Backlog",     color: "text-zinc-400" },
  { id: "in_progress", label: "In Progress", color: "text-blue-400" },
  { id: "testing",     label: "Testing",     color: "text-amber-400" },
  { id: "done",        label: "Done",        color: "text-emerald-400" },
];

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; dot: string }> = {
  low:    { label: "Low",    color: "text-zinc-500 border-zinc-700 bg-zinc-800/30",       dot: "bg-zinc-500" },
  medium: { label: "Medium", color: "text-blue-400 border-blue-800 bg-blue-950/30",        dot: "bg-blue-400" },
  high:   { label: "High",   color: "text-amber-400 border-amber-800 bg-amber-950/30",     dot: "bg-amber-400" },
  urgent: { label: "Urgent", color: "text-red-400 border-red-800 bg-red-950/30",           dot: "bg-red-400" },
};

export const MOCK_TASKS: TaskItem[] = [
  // Backlog (3)
  {
    id: "t1",
    title: "Integrate Perplexity API for trend sourcing",
    description: "Replace manual Reddit scraping with Perplexity API for real-time trend discovery. Cheaper and more reliable.",
    column: "backlog",
    priority: "medium",
    tags: ["pipeline", "sourcing"],
    dueDate: "2026-04-10",
  },
  {
    id: "t2",
    title: "Add multilingual quality scoring for FR/ES",
    description: "Current quality scorer is optimised for EN only. Need separate heuristics for French and Spanish articles.",
    column: "backlog",
    priority: "high",
    tags: ["quality", "i18n"],
    dueDate: "2026-04-15",
  },
  {
    id: "t3",
    title: "Implement cost alerting — daily budget cap",
    description: "Send Slack alert when daily LLM spend exceeds €2. Prevent runaway generation jobs.",
    column: "backlog",
    priority: "low",
    tags: ["costs", "monitoring"],
  },
  // In Progress (3)
  {
    id: "t4",
    title: "Migrate generation pipeline to Claude Sonnet 4.6",
    description: "Claude 3.5 Sonnet being deprecated. Benchmark Sonnet 4.6 quality/cost ratio before full rollout.",
    column: "in_progress",
    priority: "urgent",
    tags: ["pipeline", "llm"],
    dueDate: "2026-03-25",
  },
  {
    id: "t5",
    title: "Add retry logic for failed generation jobs",
    description: "Jobs silently fail when LLM returns empty response. Need exponential backoff + dead-letter queue.",
    column: "in_progress",
    priority: "high",
    tags: ["reliability", "pipeline"],
    dueDate: "2026-03-22",
  },
  {
    id: "t6",
    title: "Build internal link graph for SEO optimisation",
    description: "Analyse existing published articles and auto-suggest internal links for new content.",
    column: "in_progress",
    priority: "medium",
    tags: ["seo", "content"],
    dueDate: "2026-03-28",
  },
  // Testing (2)
  {
    id: "t7",
    title: "Validate keyword deduplication v3 algorithm",
    description: "New dedup logic uses semantic similarity instead of exact match. Needs QA across 500 article titles.",
    column: "testing",
    priority: "high",
    tags: ["quality", "keywords"],
    dueDate: "2026-03-21",
  },
  {
    id: "t8",
    title: "Test auto-publish to WordPress REST API",
    description: "Staging integration complete. Run end-to-end test with 3 articles before enabling for production.",
    column: "testing",
    priority: "urgent",
    tags: ["publishing", "integration"],
    dueDate: "2026-03-20",
  },
  // Done (2)
  {
    id: "t9",
    title: "Set up Jira board for FlashVoyage pipeline",
    description: "FV project created with quality-95 backlog, board #3 configured.",
    column: "done",
    priority: "medium",
    tags: ["ops"],
  },
  {
    id: "t10",
    title: "Deploy FlashVoyage dashboard v1",
    description: "Pipeline visualiser, cost tracker, and content kanban shipped. Phase 0–3 complete.",
    column: "done",
    priority: "high",
    tags: ["dashboard", "milestone"],
    dueDate: "2026-03-20",
  },
];
