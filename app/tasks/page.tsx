"use client";

import { useState, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TASK_COLUMNS, TaskItem, TaskColumn } from "@/components/kanban/mockTaskData";
import { useAppStore } from "@/lib/store";
import { TaskCardComponent } from "@/components/kanban/TaskCard";
import { TaskDetailSheet } from "@/components/kanban/TaskDetailSheet";
import { AddTaskModal } from "@/components/kanban/AddTaskModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Flame, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function TasksPage() {
  const storeTaskItems = useAppStore((s) => s.taskItems);
  const addTaskItem = useAppStore((s) => s.addTaskItem);
  const updateTaskItem = useAppStore((s) => s.updateTaskItem);
  const removeTaskItem = useAppStore((s) => s.removeTaskItem);
  const [tasks, setTasks] = useState<TaskItem[]>(storeTaskItems);
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const filteredTasks = useMemo(() =>
    search === ""
      ? tasks
      : tasks.filter((t) => t.title.toLowerCase().includes(search.toLowerCase())),
    [tasks, search]
  );

  const tasksByColumn = useMemo(() => {
    const map: Record<TaskColumn, TaskItem[]> = {
      backlog: [], in_progress: [], testing: [], done: [],
    };
    filteredTasks.forEach((t) => map[t.column].push(t));
    return map;
  }, [filteredTasks]);

  function handleDragStart(event: DragStartEvent) {
    setActiveTask(tasks.find((t) => t.id === event.active.id) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    const targetColumn = TASK_COLUMNS.find((col) => col.id === overId);
    if (targetColumn) {
      setTasks((prev) =>
        prev.map((t) => t.id === activeId ? { ...t, column: targetColumn.id } : t)
      );
      updateTaskItem(activeId, { column: targetColumn.id });
      return;
    }
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask) {
      const activeCol = tasks.find((t) => t.id === activeId)?.column;
      if (overTask.column !== activeCol) {
        setTasks((prev) =>
          prev.map((t) => t.id === activeId ? { ...t, column: overTask.column } : t)
        );
        updateTaskItem(activeId, { column: overTask.column });
      }
    }
  }

  function handleUpdate(id: string, updates: Partial<TaskItem>) {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...updates } : t));
    setSelectedTask((prev) => prev?.id === id ? { ...prev, ...updates } : prev);
    updateTaskItem(id, updates);
  }

  function handleDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    removeTaskItem(id);
  }

  function handleAdd(task: TaskItem) {
    setTasks((prev) => [task, ...prev]);
    addTaskItem(task);
  }

  const TODAY = "2026-03-20";
  const donePct = tasks.length
    ? Math.round((tasks.filter((t) => t.column === "done").length / tasks.length) * 100)
    : 0;
  const urgentCount = tasks.filter((t) => t.priority === "urgent" && t.column !== "done").length;
  const overdueCount = tasks.filter(
    (t) => t.dueDate && t.dueDate < TODAY && t.column !== "done"
  ).length;

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b border-zinc-800/80 shrink-0 flex-wrap gap-y-2">
        <h1 className="text-sm font-semibold text-white tracking-tight mr-1">Tasks</h1>

        {/* Progress pill */}
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800/80 rounded-full px-3 py-1">
          <div className="w-16 sm:w-20 bg-zinc-800 rounded-full h-1">
            <div className="bg-emerald-500 h-1 rounded-full transition-all" style={{ width: `${donePct}%` }} />
          </div>
          <span className="text-xs text-zinc-500 tabular-nums">
            {tasks.filter((t) => t.column === "done").length}/{tasks.length}
          </span>
        </div>

        {/* Velocity chips */}
        {urgentCount > 0 && (
          <div className="flex items-center gap-1 text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-full px-2.5 py-1">
            <Flame className="w-2.5 h-2.5" />
            <span className="tabular-nums font-medium">{urgentCount}</span>
          </div>
        )}
        {overdueCount > 0 && (
          <div className="flex items-center gap-1 text-xs text-orange-400 bg-orange-950/30 border border-orange-900/40 rounded-full px-2.5 py-1">
            <AlertTriangle className="w-2.5 h-2.5" />
            <span className="tabular-nums font-medium">{overdueCount}</span>
          </div>
        )}

        {/* Search */}
        <div className="relative w-full sm:w-auto order-last sm:order-none">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="bg-zinc-900 border-zinc-700 text-white text-xs h-7 pl-8 w-full sm:w-48 placeholder:text-zinc-600"
          />
        </div>

        <div className="ml-auto order-first sm:order-none">
          <Button
            size="sm"
            className="bg-amber-500 hover:bg-amber-400 text-black font-medium h-7 px-3 gap-1.5 text-xs"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Task</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 h-full p-3 sm:p-4 min-w-max">
            {TASK_COLUMNS.map((col) => {
              const colTasks = tasksByColumn[col.id];
              return (
                <div key={col.id} id={col.id} className="flex flex-col w-64 shrink-0">
                  {/* Column header */}
                  <div className="flex items-center gap-2 mb-3 px-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      col.id === "done"        ? "bg-emerald-500" :
                      col.id === "in_progress" ? "bg-blue-500" :
                      col.id === "testing"     ? "bg-amber-500" : "bg-zinc-600"
                    }`} />
                    <span className={`text-xs font-semibold tracking-wide ${col.color}`}>{col.label}</span>
                    <Badge
                      variant="outline"
                      className="border-zinc-800 bg-zinc-800/50 text-zinc-500 text-xs px-1.5 py-0 h-4 ml-auto"
                    >
                      {colTasks.length}
                    </Badge>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                    <SortableContext
                      items={colTasks.map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {colTasks.map((task) => (
                        <TaskCardComponent
                          key={task.id}
                          task={task}
                          onClick={() => setSelectedTask(task)}
                        />
                      ))}
                    </SortableContext>
                    {colTasks.length === 0 && (
                      <div className="border border-dashed border-zinc-800/60 rounded-xl h-20 flex flex-col items-center justify-center gap-1.5 mt-1">
                        <div className="w-6 h-6 rounded-full bg-zinc-800/80 flex items-center justify-center">
                          <Plus className="w-3 h-3 text-zinc-600" />
                        </div>
                        <span className="text-xs text-zinc-700">Drop here</span>
                      </div>
                    )}
                  </div>

                  {/* Column footer */}
                  {colTasks.length > 0 && (() => {
                    const colUrgent = colTasks.filter((t) => t.priority === "urgent").length;
                    const colHigh = colTasks.filter((t) => t.priority === "high").length;
                    const colOverdue = colTasks.filter((t) => t.dueDate && t.dueDate < TODAY).length;
                    const colDone = col.id === "done";
                    return (
                      <div className="mt-2 pt-2 border-t border-zinc-800/60 flex flex-wrap gap-x-3 gap-y-1 px-0.5">
                        {colDone ? (
                          <span className="flex items-center gap-0.5 text-xs text-emerald-500/80">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span className="tabular-nums">{colTasks.length} completed</span>
                          </span>
                        ) : (
                          <>
                            {colUrgent > 0 && (
                              <span className="flex items-center gap-0.5 text-xs text-red-400/80">
                                <Flame className="w-2.5 h-2.5" />
                                <span className="tabular-nums">{colUrgent}</span>
                              </span>
                            )}
                            {colHigh > 0 && (
                              <span className="flex items-center gap-0.5 text-xs text-amber-400/80">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                <span className="tabular-nums">{colHigh} high</span>
                              </span>
                            )}
                            {colOverdue > 0 && (
                              <span className="flex items-center gap-0.5 text-xs text-orange-400/80">
                                <span className="tabular-nums">{colOverdue} overdue</span>
                              </span>
                            )}
                            {colUrgent === 0 && colHigh === 0 && colOverdue === 0 && (
                              <span className="text-xs text-zinc-700">{colTasks.length} tasks</span>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>

          <DragOverlay>
            {activeTask && (
              <div className="bg-zinc-800 border border-zinc-600 rounded-lg p-3 w-64 shadow-2xl shadow-black/50 opacity-95 rotate-1">
                <p className="text-xs font-medium text-white line-clamp-2">{activeTask.title}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      <TaskDetailSheet
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
      <AddTaskModal open={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAdd} />
    </div>
  );
}
