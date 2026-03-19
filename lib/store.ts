import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Article, Task, CostEntry, DashboardStats, PipelineStage } from "./types";

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

  // UI state
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;

  // Stats
  stats: DashboardStats | null;
  setStats: (stats: DashboardStats) => void;
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

      // UI
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      darkMode: true,
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),

      // Stats
      stats: null,
      setStats: (stats) => set({ stats }),
    }),
    {
      name: "flashvoyage-dashboard",
      partialize: (state) => ({
        darkMode: state.darkMode,
        sidebarCollapsed: state.sidebarCollapsed,
        articles: state.articles,
        tasks: state.tasks,
        costs: state.costs,
      }),
    }
  )
);
