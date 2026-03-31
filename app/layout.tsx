import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { PageTransition } from "@/components/layout/PageTransition";
import { ThemeProvider } from "@/components/layout/ThemeProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FlashVoyage Dashboard",
  description: "Content pipeline, cost tracking, and task management for FlashVoyage",
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased h-screen`}
      >
        {/*
          ThemeProvider renders a wrapper <div class="dark"> based on Zustand state.
          This avoids any <html> className mutation, keeping hydration clean.
          Server default darkMode=true matches client initial render.
        */}
        <ThemeProvider>
          <div className="flex h-full overflow-hidden bg-white dark:bg-[#0a0a0a] text-zinc-900 dark:text-zinc-100">
            <Sidebar />
            <main className="flex-1 overflow-auto bg-white dark:bg-[#0a0a0a] pb-16 md:pb-0">
              <PageTransition>{children}</PageTransition>
            </main>
            <CommandPalette />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
