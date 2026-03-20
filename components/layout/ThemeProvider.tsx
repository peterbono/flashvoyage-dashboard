"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";

// Wrapper div carries "dark" for non-portal content (SSR-safe).
// useEffect also syncs "dark" on <html> so portals (Sheet, Dialog, etc.)
// rendered outside this div also pick up dark: variants.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const darkMode = useAppStore((s) => s.darkMode);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  return (
    <div className={darkMode ? "dark h-full" : "h-full"}>
      {children}
    </div>
  );
}
