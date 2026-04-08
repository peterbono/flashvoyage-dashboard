"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import {
  Sunrise,
  TrendingUp,
  GitBranch,
  Film,
  DollarSign,
  FileText,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Zap,
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
  { href: "/", label: "Brief du Matin", icon: Sunrise },
  { href: "/growth", label: "Croissance", icon: TrendingUp },
  { href: "/pipeline", label: "Pipeline", icon: GitBranch },
  { href: "/reels", label: "Reels", icon: Film },
  { href: "/costs", label: "Couts", icon: DollarSign },
  { href: "/content", label: "Contenu", icon: FileText },
  { href: "/tasks", label: "Taches", icon: CheckSquare },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useAppStore();

  return (
    <TooltipProvider delay={0}>
      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside
        className={cn(
          "hidden md:flex flex-col h-screen shrink-0 transition-all duration-300",
          "bg-gray-50 border-r border-gray-200",
          "dark:bg-[#111111] dark:border-zinc-800/50",
          sidebarCollapsed ? "w-14" : "w-52"
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex items-center gap-2.5 px-3 h-14 border-b border-gray-200 dark:border-zinc-800/50 shrink-0",
            sidebarCollapsed && "justify-center px-0"
          )}
        >
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500 shrink-0 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
            <Zap className="w-3.5 h-3.5 text-black" />
          </div>
          {!sidebarCollapsed && (
            <span className="text-[13px] font-semibold text-gray-900 dark:text-white tracking-tight">
              FlashVoyage
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-px">
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
                          "relative flex items-center justify-center w-10 mx-auto py-2.5 rounded-md transition-all duration-150",
                          isActive
                            ? "bg-gray-200 dark:bg-zinc-800/80 text-gray-900 dark:text-white"
                            : "text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800/40"
                        )}
                      />
                    }
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-amber-500" />
                    )}
                    <Icon className={cn("w-4 h-4 shrink-0", isActive && "text-amber-500")} />
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
                  "relative flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-all duration-150",
                  isActive
                    ? "bg-gray-200 dark:bg-zinc-800/80 text-gray-900 dark:text-white"
                    : "text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800/40"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-amber-500" />
                )}
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0 transition-colors",
                    isActive ? "text-amber-500" : ""
                  )}
                />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Command K hint */}
        {!sidebarCollapsed && (
          <div className="px-2 pb-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-gray-100 dark:bg-zinc-900/60 border border-gray-200 dark:border-zinc-800/60 text-xs text-gray-400 dark:text-zinc-600 cursor-default select-none">
              <Command className="w-2.5 h-2.5 shrink-0" />
              <span>Command menu</span>
              <kbd className="ml-auto font-mono text-xs">⌘K</kbd>
            </div>
          </div>
        )}

        {/* Bottom actions */}
        <div
          className={cn(
            "px-2 py-3 border-t border-gray-200 dark:border-zinc-800/50 flex gap-1",
            sidebarCollapsed ? "flex-col items-center" : "flex-row items-center"
          )}
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800/60 transition-all duration-150 rounded-md"
                  onClick={toggleSidebar}
                />
              }
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <ChevronLeft className="w-3.5 h-3.5" />
              )}
            </TooltipTrigger>
            <TooltipContent side={sidebarCollapsed ? "right" : "top"}>
              {sidebarCollapsed ? "Expand" : "Collapse"}
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>

      {/* ── Mobile bottom tab bar ───────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-gray-50 dark:bg-[#111111] border-t border-gray-200 dark:border-zinc-800/50 px-1 py-1 safe-area-pb">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg min-w-[48px] transition-colors",
                isActive
                  ? "text-amber-500"
                  : "text-gray-400 dark:text-zinc-500"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-medium leading-none">{label}</span>
            </Link>
          );
        })}
      </nav>
    </TooltipProvider>
  );
}
