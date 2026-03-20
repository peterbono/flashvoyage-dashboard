"use client";
import dynamic from "next/dynamic";

const PipelineVisualizer = dynamic(
  () => import("@/components/pipeline/PipelineVisualizer"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="text-zinc-500 text-sm">Loading pipeline...</div>
      </div>
    ),
  }
);

export default function PipelinePage() {
  return (
    <div className="h-screen flex flex-col">
      <PipelineVisualizer />
    </div>
  );
}
