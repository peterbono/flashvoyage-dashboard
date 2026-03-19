import { Badge } from "@/components/ui/badge";
import { CheckSquare } from "lucide-react";

export default function TasksPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tasks</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Sprint tasks and team work tracking
          </p>
        </div>
        <Badge variant="outline" className="border-zinc-700 text-zinc-400 gap-1.5">
          <CheckSquare className="w-3 h-3" />
          Phase 1 — Coming soon
        </Badge>
      </div>

      <div className="flex items-center justify-center h-96 border border-dashed border-zinc-800 rounded-xl">
        <div className="text-center">
          <CheckSquare className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500 font-medium">Tasks Kanban</p>
          <p className="text-xs text-zinc-600 mt-1">Linear-style task management — Phase 1</p>
        </div>
      </div>
    </div>
  );
}
