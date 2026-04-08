import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Article, Task, CostEntry, DashboardStats, PipelineStage } from "./types";
import { KanbanCard } from "@/components/kanban/mockKanbanData";
import { TaskItem, MOCK_TASKS } from "@/components/kanban/mockTaskData";

// Pipeline run types
export interface PipelineStageResult {
  status: "idle" | "running" | "success" | "failed";
  logs: string[];
  cost?: number;
  outputData?: Record<string, unknown>;
}

export interface PipelineRun {
  status: "idle" | "running" | "stopping" | "done" | "failed";
  track: "evergreen" | "news";
  topic: string;
  currentStage: string | null;
  stages: Record<string, PipelineStageResult>;
  totalCost: number;
  startedAt: number | null;
  durationMs: number | null;
  publishedUrl?: string;
  publishedId?: number;
  editUrl?: string;
  failedStage?: string;
  failedLog?: string;
  // GitHub Actions mode fields
  mode?: "local" | "github";
  ghRunId?: number | null;
  ghActionsUrl?: string;
  ghWorkflowStatus?: string | null;
  ghWorkflowConclusion?: string | null;
  vizRunId?: string | null;
}

export interface PipelineHistoryEntry {
  id: string;
  topic: string;
  track: "evergreen" | "news";
  status: "done" | "failed" | "stopped";
  totalCost: number;
  durationMs: number;
  startedAt: number;
  failedStage?: string;
  qualityScore?: number;
  editUrl?: string;
  publishedUrl?: string;
  stagesCompleted: number;
  // Source of this run
  mode?: "local" | "github";
  destination?: string;
}

export interface PostingGoal {
  id: string;
  platform: "instagram" | "facebook" | "tiktok" | "all";
  frequency: "daily" | "weekly";
  target: number;
}

interface AppState {
  // Articles / Pipeline
  articles: Article[];
  setArticles: (articles: Article[]) => void;
  addArticle: (article: Article) => void;
  updateArticle: (id: string, updates: Partial<Article>) => void;
  moveArticle: (id: string, stage: PipelineStage) => void;
  removeArticle: (id: string) => void;

  // Tasks
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;

  // Costs
  costs: CostEntry[];
  setCosts: (costs: CostEntry[]) => void;
  addCost: (cost: CostEntry) => void;

  // Kanban cards (Content pipeline)
  kanbanCards: KanbanCard[];
  setKanbanCards: (cards: KanbanCard[]) => void;
  addKanbanCard: (card: KanbanCard) => void;
  updateKanbanCard: (id: string, updates: Partial<KanbanCard>) => void;
  removeKanbanCard: (id: string) => void;

  // Task items (Tasks kanban)
  taskItems: TaskItem[];
  setTaskItems: (tasks: TaskItem[]) => void;
  addTaskItem: (task: TaskItem) => void;
  updateTaskItem: (id: string, updates: Partial<TaskItem>) => void;
  removeTaskItem: (id: string) => void;

  // UI state
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;

  // Stats
  stats: DashboardStats | null;
  setStats: (stats: DashboardStats) => void;

  // Posting goals
  postingGoals: PostingGoal[];
  setPostingGoals: (goals: PostingGoal[]) => void;
  addPostingGoal: (goal: PostingGoal) => void;
  removePostingGoal: (id: string) => void;

  // Pipeline run state (not persisted)
  pipelineRun: PipelineRun | null;
  setPipelineRun: (run: PipelineRun | null | ((prev: PipelineRun | null) => PipelineRun | null)) => void;
  updatePipelineStage: (stageId: string, result: PipelineStageResult) => void;

  // Pipeline history (persisted)
  pipelineHistory: PipelineHistoryEntry[];
  addPipelineHistory: (entry: PipelineHistoryEntry) => void;
  clearPipelineHistory: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Articles
      articles: [],
      setArticles: (articles) => set({ articles }),
      addArticle: (article) =>
        set((state) => ({ articles: [...state.articles, article] })),
      updateArticle: (id, updates) =>
        set((state) => ({
          articles: state.articles.map((a) =>
            a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
          ),
        })),
      moveArticle: (id, stage) =>
        set((state) => ({
          articles: state.articles.map((a) =>
            a.id === id ? { ...a, stage, updatedAt: new Date().toISOString() } : a
          ),
        })),
      removeArticle: (id) =>
        set((state) => ({ articles: state.articles.filter((a) => a.id !== id) })),

      // Tasks
      tasks: [],
      setTasks: (tasks) => set({ tasks }),
      addTask: (task) =>
        set((state) => ({ tasks: [...state.tasks, task] })),
      updateTask: (id, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),
      removeTask: (id) =>
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),

      // Costs
      costs: [],
      setCosts: (costs) => set({ costs }),
      addCost: (cost) =>
        set((state) => ({ costs: [...state.costs, cost] })),

      // Kanban cards
      kanbanCards: [],
      setKanbanCards: (kanbanCards) => set({ kanbanCards }),
      addKanbanCard: (card) => set((state) => ({ kanbanCards: [card, ...state.kanbanCards] })),
      updateKanbanCard: (id, updates) =>
        set((state) => ({ kanbanCards: state.kanbanCards.map((c) => c.id === id ? { ...c, ...updates } : c) })),
      removeKanbanCard: (id) =>
        set((state) => ({ kanbanCards: state.kanbanCards.filter((c) => c.id !== id) })),

      // Task items — seeded with MOCK_TASKS on first load
      taskItems: MOCK_TASKS,
      setTaskItems: (taskItems) => set({ taskItems }),
      addTaskItem: (task) => set((state) => ({ taskItems: [task, ...state.taskItems] })),
      updateTaskItem: (id, updates) =>
        set((state) => ({ taskItems: state.taskItems.map((t) => t.id === id ? { ...t, ...updates } : t) })),
      removeTaskItem: (id) =>
        set((state) => ({ taskItems: state.taskItems.filter((t) => t.id !== id) })),

      // Posting goals
      postingGoals: [],
      setPostingGoals: (postingGoals) => set({ postingGoals }),
      addPostingGoal: (goal) =>
        set((state) => ({ postingGoals: [...state.postingGoals, goal] })),
      removePostingGoal: (id) =>
        set((state) => ({ postingGoals: state.postingGoals.filter((g) => g.id !== id) })),

      // UI
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      darkMode: true,
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),

      // Stats
      stats: null,
      setStats: (stats) => set({ stats }),

      // Pipeline run (not persisted)
      pipelineRun: null,
      setPipelineRun: (run) =>
        set((state) => ({
          pipelineRun: typeof run === "function" ? run(state.pipelineRun) : run,
        })),
      updatePipelineStage: (stageId, result) =>
        set((state) => {
          if (!state.pipelineRun) return {};
          const newCost = state.pipelineRun.totalCost + (result.cost ?? 0);
          return {
            pipelineRun: {
              ...state.pipelineRun,
              stages: { ...state.pipelineRun.stages, [stageId]: result },
              totalCost: newCost,
            },
          };
        }),

      // Pipeline history
      pipelineHistory: [],
      addPipelineHistory: (entry) =>
        set((state) => ({
          pipelineHistory: [entry, ...state.pipelineHistory].slice(0, 50),
        })),
      clearPipelineHistory: () => set({ pipelineHistory: [] }),
    }),
    {
      name: "flashvoyage-dashboard",
      partialize: (state) => ({
        darkMode: state.darkMode,
        sidebarCollapsed: state.sidebarCollapsed,
        articles: state.articles,
        tasks: state.tasks,
        costs: state.costs,
        kanbanCards: state.kanbanCards,
        taskItems: state.taskItems,
        pipelineHistory: state.pipelineHistory,
        postingGoals: state.postingGoals,
      }),
    }
  )
);
