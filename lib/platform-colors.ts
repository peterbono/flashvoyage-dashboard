export const PLATFORM_COLORS = {
  instagram: { bg: "bg-pink-500", text: "text-pink-500", hex: "#ec4899" },
  facebook: { bg: "bg-blue-500", text: "text-blue-500", hex: "#3b82f6" },
  tiktok: { bg: "bg-cyan-400", text: "text-cyan-400", hex: "#22d3ee" },
  ga4: { bg: "bg-amber-500", text: "text-amber-500", hex: "#f59e0b" },
  threads: { bg: "bg-zinc-400", text: "text-zinc-400", hex: "#a1a1aa" },
} as const;

export type Platform = keyof typeof PLATFORM_COLORS;
