import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  GitBranch,
  DollarSign,
  TrendingUp,
  Zap,
  CheckSquare,
} from "lucide-react";

const stats = [
  {
    label: "Articles Published Today",
    value: "0",
    icon: FileText,
    trend: "+0%",
    color: "text-emerald-400",
  },
  {
    label: "In Pipeline",
    value: "0",
    icon: GitBranch,
    trend: "stages active",
    color: "text-blue-400",
  },
  {
    label: "Daily Cost",
    value: "€0.00",
    icon: DollarSign,
    trend: "est. €0/month",
    color: "text-amber-400",
  },
  {
    label: "Avg Quality Score",
    value: "—",
    icon: TrendingUp,
    trend: "no data yet",
    color: "text-purple-400",
  },
];

export default function OverviewPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Overview</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            FlashVoyage content pipeline dashboard
          </p>
        </div>
        <Badge variant="outline" className="border-zinc-700 text-zinc-400 gap-1.5">
          <Zap className="w-3 h-3 text-amber-400" />
          Phase 0 — Setup
        </Badge>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, trend, color }) => (
          <Card key={label} className="bg-zinc-900 border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                {label}
              </CardTitle>
              <Icon className={`w-4 h-4 ${color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{value}</div>
              <p className="text-xs text-zinc-500 mt-1">{trend}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { title: "Pipeline", desc: "Visualize article flow through stages", href: "/pipeline", icon: GitBranch, color: "text-blue-400" },
          { title: "Content", desc: "Kanban board for article management", href: "/content", icon: FileText, color: "text-emerald-400" },
          { title: "Tasks", desc: "Track team tasks and sprint work", href: "/tasks", icon: CheckSquare, color: "text-purple-400" },
        ].map(({ title, desc, icon: Icon, color }) => (
          <Card key={title} className="bg-zinc-900 border-zinc-800 hover:border-zinc-600 transition-colors cursor-pointer">
            <CardContent className="pt-5">
              <Icon className={`w-5 h-5 mb-3 ${color}`} />
              <h3 className="text-sm font-semibold text-white">{title}</h3>
              <p className="text-xs text-zinc-500 mt-1">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty state notice */}
      <Card className="bg-zinc-900/50 border-zinc-800 border-dashed">
        <CardContent className="py-12 text-center">
          <Zap className="w-8 h-8 text-amber-400 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white mb-1">Dashboard Ready</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Phase 0 setup complete. Connect data sources in Phase 1 to populate the dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
