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
import { MOCK_TASKS, TASK_COLUMNS, TaskItem, TaskColumn } from "@/components/kanban/mockTaskData";
import { TaskCardComponent } from "@/components/kanban/TaskCard";
import { TaskDetailSheet } from "@/components/kanban/TaskDetailSheet";
import { AddTaskModal } from "@/components/kanban/AddTaskModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>(MOCK_TASKS);
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
      return;
    }
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask) {
      const activeCol = tasks.find((t) => t.id === activeId)?.column;
      if (overTask.column !== activeCol) {
        setTasks((prev) =>
          prev.map((t) => t.id === activeId ? { ...t, column: overTask.column } : t)
        );
      }
    }
  }

  function handleUpdate(id: string, updates: Partial<TaskItem>) {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, ...updates } : t));
    setSelectedTask((prev) => prev?.id === id ? { ...prev, ...updates } : prev);
  }

  function handleDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function handleAdd(task: TaskItem) {
    setTasks((prev) => [task, ...prev]);
  }

  const donePct = tasks.length
    ? Math.round((tasks.filter((t) => t.column === "done").length / tasks.length) * 100)
    : 0;

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 shrink-0 flex-wrap gap-y-2">
        <h1 className="text-sm font-semibold text-white mr-1">Tasks</h1>

        {/* Progress pill */}
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1">
          <div className="w-20 bg-zinc-800 rounded-full h-1">
            <div className="bg-emerald-500 h-1 rounded-full transition-all" style={{ width: `${donePct}%` }} />
          </div>
          <span className="text-[10px] text-zinc-500">{donePct}% done</span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="bg-zinc-900 border-zinc-700 text-white text-xs h-7 pl-8 w-48 placeholder:text-zinc-600"
          />
        </div>

        <div className="ml-auto">
          <Button
            size="sm"
            className="bg-amber-500 hover:bg-amber-400 text-black font-medium h-7 px-3 gap-1.5 text-xs"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Task
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
          <div className="flex gap-3 h-full p-4 min-w-max">
            {TASK_COLUMNS.map((col) => {
              const colTasks = tasksByColumn[col.id];
              return (
                <div key={col.id} id={col.id} className="flex flex-col w-64 shrink-0">
                  {/* Column header */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-xs font-semibold ${col.color}`}>{col.label}</span>
                    <Badge
                      variant="outline"
                      className="border-zinc-700 text-zinc-500 text-[10px] px-1.5 py-0 h-4"
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
                      <div className="border border-dashed border-zinc-800 rounded-lg h-14 flex items-center justify-center">
                        <span className="text-[10px] text-zinc-700">Drop here</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <DragOverlay>
            {activeTask && (
              <div className="bg-zinc-900 border border-zinc-600 rounded-lg p-3 w-64 shadow-2xl opacity-90">
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
