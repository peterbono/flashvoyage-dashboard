// Pipeline types
export type PipelineStage =
  | "idea"
  | "briefing"
  | "writing"
  | "editing"
  | "seo_review"
  | "published";

export interface Article {
  id: string;
  title: string;
  slug: string;
  stage: PipelineStage;
  author: string;
  assignee?: string;
  wordCount?: number;
  targetWordCount?: number;
  seoScore?: number;
  qualityScore?: number;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  destination?: string;
  language: "fr" | "en" | "es" | "de" | "it" | "pt";
  priority: "low" | "medium" | "high" | "urgent";
}

// Cost types
export interface CostEntry {
  id: string;
  date: string;
  service: string; // e.g., "OpenAI GPT-4o", "Claude Sonnet", "Midjourney"
  category: "llm" | "image" | "seo" | "hosting" | "tools" | "other";
  tokens?: number;
  amount: number; // in EUR
  articleId?: string;
  description?: string;
}

export interface CostSummary {
  totalMonthly: number;
  totalDaily: number;
  byService: Record<string, number>;
  byCategory: Record<string, number>;
  perArticle: number;
}

// Task types
export type TaskStatus = "backlog" | "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string;
  dueDate?: string;
  createdAt: string;
  labels: string[];
  articleId?: string;
}

// Dashboard overview types
export interface DashboardStats {
  articlesPublishedToday: number;
  articlesInPipeline: number;
  avgQualityScore: number;
  avgSeoScore: number;
  dailyCost: number;
  monthlyCost: number;
  totalArticles: number;
}
