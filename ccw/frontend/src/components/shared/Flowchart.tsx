// ========================================
// Flowchart Component
// ========================================
// Interactive flowchart component using @xyflow/react

import * as React from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CheckCircle, Circle, Loader2 } from 'lucide-react';
import type { FlowControl } from '@/lib/api';

// Custom node types
interface FlowchartNodeData extends Record<string, unknown> {
  label: string;
  description?: string;
  step?: number | string;
  output?: string;
  type: 'pre-analysis' | 'implementation' | 'section';
  dependsOn?: string[];
  status?: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'skipped';
  showStepStatus?: boolean;
}

// Status icon component
const StatusIcon: React.FC<{ status?: string; className?: string }> = ({ status, className = 'h-4 w-4' }) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className={`${className} text-green-500`} />;
    case 'in_progress':
      return <Loader2 className={`${className} text-amber-500 animate-spin`} />;
    case 'blocked':
      return <Circle className={`${className} text-red-500`} />;
    case 'skipped':
      return <Circle className={`${className} text-gray-400`} />;
    default:
      return <Circle className={`${className} text-gray-300`} />;
  }
};

// Custom node component
const CustomNode: React.FC<{ data: FlowchartNodeData }> = ({ data }) => {
  const isPreAnalysis = data.type === 'pre-analysis';
  const isSection = data.type === 'section';
  const showStatus = data.showStepStatus !== false;
  const isCompleted = showStatus && data.status === 'completed';
  const isInProgress = showStatus && data.status === 'in_progress';

  if (isSection) {
    return (
      <div className="px-4 py-2 bg-muted rounded border-2 border-border relative">
        <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-0 !h-0" />
        <span className="text-sm font-semibold text-foreground">{data.label}</span>
        <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-0 !h-0" />
      </div>
    );
  }

  // Color scheme based on status
  let nodeColor = isPreAnalysis ? '#f59e0b' : '#3b82f6';
  let bgClass = isPreAnalysis
    ? 'bg-amber-50 border-amber-500 dark:bg-amber-950/30'
    : 'bg-blue-50 border-blue-500 dark:bg-blue-950/30';
  let stepBgClass = isPreAnalysis ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white';

  // Override for completed status
  if (isCompleted) {
    nodeColor = '#22c55e'; // green-500
    bgClass = 'bg-green-50 border-green-500 dark:bg-green-950/30';
    stepBgClass = 'bg-green-500 text-white';
  } else if (isInProgress) {
    nodeColor = '#f59e0b'; // amber-500
    bgClass = 'bg-amber-50 border-amber-500 dark:bg-amber-950/30';
    stepBgClass = 'bg-amber-500 text-white';
  }

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 shadow-sm min-w-[280px] max-w-[400px] relative ${bgClass}`}
    >
      {/* Top handle for incoming edges */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !-top-1.5"
        style={{ background: nodeColor, border: `2px solid ${nodeColor}` }}
      />

      <div className="flex items-start gap-2">
        <span
          className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${stepBgClass}`}
        >
          {isCompleted && showStatus ? <CheckCircle className="h-4 w-4" /> : data.step}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${isCompleted ? 'text-green-700 dark:text-green-400' : 'text-foreground'}`}>
              {data.label}
            </span>
            {showStatus && data.status && data.status !== 'pending' && (
              <StatusIcon status={data.status} className="h-3.5 w-3.5" />
            )}
          </div>
          {data.description && (
            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{data.description}</div>
          )}
          {data.output && (
            <div className="text-xs text-green-600 dark:text-green-400 mt-1">
              {'->'} {data.output}
            </div>
          )}
        </div>
      </div>

      {/* Bottom handle for outgoing edges */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !-bottom-1.5"
        style={{ background: nodeColor, border: `2px solid ${nodeColor}` }}
      />
    </div>
  );
};

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

export interface FlowchartProps {
  flowControl: FlowControl;
  className?: string;
  showStepStatus?: boolean;
}

/**
 * Flowchart component for visualizing implementation approach
 */
export function Flowchart({ flowControl, className = '', showStepStatus = true }: FlowchartProps) {
  const preAnalysis = flowControl.pre_analysis || [];
  const implSteps = flowControl.implementation_approach || [];

  // Build nodes and edges
  const initialNodes: Node[] = [];
  const initialEdges: Edge[] = [];

  let currentY = 0;
  const nodeHeight = 100;
  const verticalGap = 80;
  const sectionGap = 60;

  // Add Pre-Analysis section
  if (preAnalysis.length > 0) {
    // Section header node
    initialNodes.push({
      id: 'pre-section',
      type: 'custom',
      position: { x: 0, y: currentY },
      data: {
        label: 'Pre-Analysis Steps',
        type: 'section' as const,
      },
    });
    currentY += sectionGap;

    preAnalysis.forEach((step, idx) => {
      const nodeId = `pre-${idx}`;
      initialNodes.push({
        id: nodeId,
        type: 'custom',
        position: { x: 0, y: currentY },
        data: {
          label: step.step || step.action || `Pre-step ${idx + 1}`,
          description: step.action,
          step: `P${idx + 1}`,
          output: step.output_to,
          type: 'pre-analysis' as const,
          showStepStatus,
        },
      });

      // Edge from previous node
      if (idx === 0) {
        initialEdges.push({
          id: `pre-section-${idx}`,
          source: 'pre-section',
          target: nodeId,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#f59e0b', strokeWidth: 2 },
          markerEnd: { type: 'arrowclosed' as const, color: '#f59e0b' },
        });
      } else {
        initialEdges.push({
          id: `pre-${idx - 1}-${idx}`,
          source: `pre-${idx - 1}`,
          target: nodeId,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#f59e0b', strokeWidth: 2 },
          markerEnd: { type: 'arrowclosed' as const, color: '#f59e0b' },
        });
      }

      currentY += nodeHeight + verticalGap;
    });

    currentY += sectionGap;
  }

  // Add Implementation section
  if (implSteps.length > 0) {
    // Section header node
    const implSectionId = 'impl-section';
    initialNodes.push({
      id: implSectionId,
      type: 'custom',
      position: { x: 0, y: currentY },
      data: {
        label: 'Implementation Steps',
        type: 'section' as const,
      },
    });

    // Edge from pre-analysis to impl section (if both exist)
    if (preAnalysis.length > 0) {
      initialEdges.push({
        id: `pre-impl-conn`,
        source: `pre-${preAnalysis.length - 1}`,
        target: implSectionId,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#3b82f6', strokeWidth: 2 },
        markerEnd: { type: 'arrowclosed' as const, color: '#3b82f6' },
      });
    }

    currentY += sectionGap;

    implSteps.forEach((step, idx) => {
      const nodeId = `impl-${idx}`;

      // Handle both string and ImplementationStep types
      const isString = typeof step === 'string';

      // Extract just the number from strings like "Step 1", "step1", etc.
      const rawStep = isString ? (idx + 1) : (step.step || idx + 1);
      const stepNumber = typeof rawStep === 'string'
        ? (rawStep.match(/\d+/)?.[0] || idx + 1)
        : rawStep;

      // Try multiple fields for label (matching JS version priority)
      // Check for content in various possible field names
      let label: string;
      let description: string | undefined;

      if (isString) {
        label = step;
      } else {
        // Try title first (JS version uses this), then action, description, phase, or any string value
        label = step.title || step.action || step.phase || step.description || '';

        // If still empty, try to extract any non-empty string from the step object
        if (!label) {
          const stepKeys = Object.keys(step).filter(k =>
            k !== 'step' && k !== 'depends_on' && k !== 'modification_points' && k !== 'logic_flow'
          );
          for (const key of stepKeys) {
            const val = step[key as keyof typeof step];
            if (typeof val === 'string' && val.trim()) {
              label = val;
              break;
            }
          }
        }

        // Final fallback
        if (!label) {
          label = `Step ${stepNumber}`;
        }

        // Set description if different from label
        description = step.description && step.description !== label ? step.description : undefined;
      }

      const dependsOn = isString ? undefined : step.depends_on?.map((d: number | string) => `impl-${Number(d) - 1}`);

      // Extract status from step (may be in 'status' field or other locations)
      const stepStatus = isString ? undefined : (step.status as string | undefined);

      initialNodes.push({
        id: nodeId,
        type: 'custom',
        position: { x: 0, y: currentY },
        data: {
          label,
          description,
          step: stepNumber,
          type: 'implementation' as const,
          dependsOn,
          status: stepStatus,
          showStepStatus,
        },
      });

      // Edge from section header to first step
      if (idx === 0) {
        initialEdges.push({
          id: `impl-section-${idx}`,
          source: implSectionId,
          target: nodeId,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#3b82f6', strokeWidth: 2 },
          markerEnd: { type: 'arrowclosed' as const, color: '#3b82f6' },
        });
      } else {
        // Sequential edge with styled connection
        initialEdges.push({
          id: `impl-${idx - 1}-${idx}`,
          source: `impl-${idx - 1}`,
          target: nodeId,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#3b82f6', strokeWidth: 2 },
          markerEnd: { type: 'arrowclosed' as const, color: '#3b82f6' },
        });
      }

      // Dependency edges
      if (!isString && step.depends_on && step.depends_on.length > 0) {
        step.depends_on.forEach((depIdx: number | string) => {
          const depNodeId = `impl-${Number(depIdx) - 1}`;
          initialEdges.push({
            id: `dep-${depIdx}-${idx}`,
            source: depNodeId,
            target: nodeId,
            type: 'smoothstep',
            animated: false,
            style: { strokeDasharray: '5,5', stroke: '#f59e0b', strokeWidth: 2 },
            markerEnd: { type: 'arrowclosed' as const, color: '#f59e0b' },
          });
        });
      }

      currentY += nodeHeight + verticalGap;
    });
  }

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Handle new connections (disabled for this use case)
  const onConnect = React.useCallback(
    (connection: Connection) => {
      setEdges((eds) => [
        ...eds,
        {
          ...connection,
          id: `edge-${Date.now()}`,
          type: 'smoothstep',
        },
      ]);
    },
    [setEdges]
  );

  // If no data, show empty state
  if (preAnalysis.length === 0 && implSteps.length === 0) {
    return (
      <div className={`flex items-center justify-center p-8 text-center ${className}`}>
        <div>
          <p className="text-sm text-muted-foreground">No flowchart data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ height: `${currentY + 100}px` }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        selectNodesOnDrag={false}
        zoomOnScroll={true}
        panOnScroll={true}
      >
        <Background color="var(--color-border, #e0e0e0)" style={{ backgroundColor: 'var(--color-background, white)' }} />
        <Controls className="bg-card border border-border rounded shadow-sm" />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as FlowchartNodeData;
            if (data.type === 'section') return '#9ca3af';
            // Status-based colors (only when status tracking is enabled)
            if (data.showStepStatus !== false) {
              if (data.status === 'completed') return '#22c55e'; // green-500
              if (data.status === 'in_progress') return '#f59e0b'; // amber-500
              if (data.status === 'blocked') return '#ef4444'; // red-500
            }
            if (data.type === 'pre-analysis') return '#f59e0b';
            return '#3b82f6';
          }}
          className="!bg-card !border-border !rounded !shadow-sm"
        />
      </ReactFlow>
    </div>
  );
}

export default Flowchart;
