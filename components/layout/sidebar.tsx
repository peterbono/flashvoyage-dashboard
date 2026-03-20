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
  Command,
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
          "flex flex-col h-screen bg-zinc-950 border-r border-zinc-800/80 transition-all duration-300 shrink-0",
          sidebarCollapsed ? "w-14" : "w-56"
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex items-center gap-2.5 px-3 py-4 border-b border-zinc-800/80",
            sidebarCollapsed && "justify-center px-0"
          )}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500 shrink-0 shadow-[0_0_16px_rgba(245,158,11,0.35)]">
            <Zap className="w-4 h-4 text-black" />
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-white tracking-tight leading-none">
                FlashVoyage
              </span>
              <span className="text-[10px] text-zinc-600 mt-0.5">Dashboard</span>
            </div>
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
                          "relative flex items-center justify-center w-10 mx-auto py-2 rounded-md text-sm font-medium transition-all duration-200",
                          isActive
                            ? "bg-zinc-800/80 text-white"
                            : "text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800/50"
                        )}
                      />
                    }
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4 shrink-0 transition-colors",
                        isActive ? "text-amber-400" : ""
                      )}
                    />
                    {isActive && (
                      <span className="absolute left-0 inset-y-2 w-0.5 rounded-r-full bg-amber-400" />
                    )}
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
                  "relative flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-zinc-800/80 text-white"
                    : "text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800/40"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 inset-y-2 w-0.5 rounded-r-full bg-amber-400" />
                )}
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0 transition-colors",
                    isActive ? "text-amber-400" : ""
                  )}
                />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* ⌘K hint (expanded only) */}
        {!sidebarCollapsed && (
          <div className="px-2 pb-2">
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-zinc-900/60 border border-zinc-800/60 text-[10px] text-zinc-600 cursor-default select-none">
              <Command className="w-2.5 h-2.5 shrink-0" />
              <span>Command menu</span>
              <kbd className="ml-auto font-mono">⌘K</kbd>
            </div>
          </div>
        )}

        {/* Bottom actions */}
        <div
          className={cn(
            "px-2 py-3 border-t border-zinc-800/80 flex flex-col gap-1",
            sidebarCollapsed && "items-center"
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-zinc-500 hover:text-white hover:bg-zinc-800/60 transition-all duration-200"
            onClick={toggleDarkMode}
            title="Toggle theme"
          >
            {darkMode ? (
              <Sun className="w-3.5 h-3.5" />
            ) : (
              <Moon className="w-3.5 h-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-zinc-500 hover:text-white hover:bg-zinc-800/60 transition-all duration-200"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
