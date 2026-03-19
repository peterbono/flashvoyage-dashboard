"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import {
  LayoutDashboard,
  GitBranch,
  DollarSign,
  FileText,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Zap,
  Moon,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/pipeline", label: "Pipeline", icon: GitBranch },
  { href: "/costs", label: "Costs", icon: DollarSign },
  { href: "/content", label: "Content", icon: FileText },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, darkMode, toggleDarkMode } =
    useAppStore();

  return (
    <TooltipProvider delay={0}>
      <aside
        className={cn(
          "flex flex-col h-screen bg-zinc-950 border-r border-zinc-800 transition-all duration-300 shrink-0",
          sidebarCollapsed ? "w-14" : "w-56"
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-4 border-b border-zinc-800",
            sidebarCollapsed && "justify-center px-0"
          )}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500 shrink-0">
            <Zap className="w-4 h-4 text-black" />
          </div>
          {!sidebarCollapsed && (
            <span className="text-sm font-semibold text-white tracking-tight">
              FlashVoyage
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            if (sidebarCollapsed) {
              return (
                <Tooltip key={href}>
                  <TooltipTrigger
                    render={
                      <Link
                        href={href}
                        className={cn(
                          "flex items-center justify-center w-10 mx-auto py-2 rounded-md text-sm font-medium transition-colors",
                          isActive
                            ? "bg-zinc-800 text-white"
                            : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                        )}
                      />
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            }
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 px-2 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div
          className={cn(
            "px-2 py-3 border-t border-zinc-800 flex flex-col gap-1",
            sidebarCollapsed && "items-center"
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-zinc-400 hover:text-white hover:bg-zinc-900"
            onClick={toggleDarkMode}
            title="Toggle theme"
          >
            {darkMode ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-zinc-400 hover:text-white hover:bg-zinc-900"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
