"use client";

import React, { useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeTypes,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { MOCK_PIPELINE_STAGES, PipelineStageData, TOTAL_COST, TOTAL_DURATION } from "./mockData";
import { PipelineNode } from "./PipelineNode";
import { PipelineDetailPanel } from "./PipelineDetailPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, CheckCircle2, Timer, DollarSign } from "lucide-react";

const NODE_WIDTH = 200;
const H_GAP = 60;

function buildGraph(stages: PipelineStageData[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = stages.map((stage, i) => ({
    id: stage.id,
    type: "pipelineNode",
    position: { x: i * (NODE_WIDTH + H_GAP), y: 100 },
    data: stage as unknown as Record<string, unknown>,
    draggable: true,
  }));

  const edges: Edge[] = stages.slice(0, -1).map((stage, i) => ({
    id: `e-${stage.id}-${stages[i + 1].id}`,
    source: stage.id,
    target: stages[i + 1].id,
    animated: true,
    style: { stroke: "#3f3f46", strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#3f3f46", width: 16, height: 16 },
  }));

  return { nodes, edges };
}

const nodeTypes: NodeTypes = {
  pipelineNode: PipelineNode,
};

export default function PipelineVisualizer() {
  const { nodes: initialNodes, edges: initialEdges } = buildGraph(MOCK_PIPELINE_STAGES);
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedStage, setSelectedStage] = useState<PipelineStageData | null>(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedStage(node.data as unknown as PipelineStageData);
  }, []);

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800 bg-zinc-950 shrink-0">
        <h1 className="text-sm font-semibold text-white mr-2">Pipeline Visualizer</h1>
        <Button
          size="sm"
          className="bg-amber-500 hover:bg-amber-400 text-black font-medium h-7 px-3 gap-1.5 text-xs"
        >
          <Play className="w-3 h-3" />
          Run Pipeline
        </Button>
        <div className="w-px h-4 bg-zinc-800" />
        <Badge
          variant="outline"
          className="border-emerald-800 text-emerald-400 bg-emerald-950/40 gap-1.5 text-xs"
        >
          <CheckCircle2 className="w-3 h-3" />
          Last run: success
        </Badge>
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Timer className="w-3.5 h-3.5 text-zinc-500" />
          {TOTAL_DURATION.toFixed(1)}s
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <DollarSign className="w-3.5 h-3.5 text-zinc-500" />
          ${TOTAL_COST.toFixed(3)}
        </div>
        <div className="ml-auto text-xs text-zinc-600">
          {MOCK_PIPELINE_STAGES.length} stages · click a node for details
        </div>
      </div>

      {/* Flow canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.3}
          maxZoom={2}
          colorMode="dark"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#27272a"
          />
          <Controls
            className="[&>button]:bg-zinc-900 [&>button]:border-zinc-700 [&>button]:text-zinc-400 [&>button:hover]:bg-zinc-800"
            showFitView
            showZoom
            showInteractive={false}
          />
          <MiniMap
            className="!bg-zinc-900 !border-zinc-700"
            nodeColor="#27272a"
            maskColor="rgba(0,0,0,0.4)"
          />
        </ReactFlow>

        {/* Detail panel */}
        {selectedStage && (
          <PipelineDetailPanel
            stage={selectedStage}
            onClose={() => setSelectedStage(null)}
          />
        )}
      </div>
    </div>
  );
}
