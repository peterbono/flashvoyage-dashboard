import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

export default function ContentPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Content</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Kanban board for article management
          </p>
        </div>
        <Badge variant="outline" className="border-zinc-700 text-zinc-400 gap-1.5">
          <FileText className="w-3 h-3" />
          Phase 1 — Coming soon
        </Badge>
      </div>

      <div className="flex items-center justify-center h-96 border border-dashed border-zinc-800 rounded-xl">
        <div className="text-center">
          <FileText className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500 font-medium">Content Kanban</p>
          <p className="text-xs text-zinc-600 mt-1">dnd-kit drag &amp; drop — Phase 1</p>
        </div>
      </div>
    </div>
  );
}
