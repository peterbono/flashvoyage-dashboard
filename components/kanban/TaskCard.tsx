"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TaskItem, PRIORITY_CONFIG } from "./mockTaskData";
import { Badge } from "@/components/ui/badge";
import { Calendar, AlertCircle } from "lucide-react";

interface Props {
  task: TaskItem;
  onClick: () => void;
}

export function TaskCardComponent({ task, onClick }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const priority = PRIORITY_CONFIG[task.priority];
  const isOverdue =
    task.dueDate && new Date(task.dueDate) < new Date() && task.column !== "done";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 cursor-pointer hover:border-zinc-600 transition-all duration-150 select-none"
    >
      {/* Priority dot + title */}
      <div className="flex items-start gap-2 mb-2.5">
        <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${priority.dot}`} />
        <p className="text-xs font-medium text-white leading-snug line-clamp-2">{task.title}</p>
      </div>

      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="text-[9px] px-1.5 py-0 border-zinc-700 text-zinc-500 bg-zinc-800/30"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-1">
        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${priority.color}`}>
          {priority.label}
        </Badge>
        {task.dueDate && (
          <span className={`flex items-center gap-0.5 text-[10px] ${isOverdue ? "text-red-400" : "text-zinc-500"}`}>
            {isOverdue && <AlertCircle className="w-2.5 h-2.5" />}
            <Calendar className="w-2.5 h-2.5" />
            {task.dueDate.slice(5)}
          </span>
        )}
      </div>
    </div>
  );
}
