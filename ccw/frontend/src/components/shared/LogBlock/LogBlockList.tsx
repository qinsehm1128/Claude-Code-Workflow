// ========================================
// LogBlockList Component
// ========================================
// Container component for displaying grouped CLI output blocks

import { useState, useCallback } from 'react';
import { useCliStreamStore, type LogBlockData } from '@/stores/cliStreamStore';
import { LogBlock } from './LogBlock';

/**
 * Props for LogBlockList component
 */
export interface LogBlockListProps {
  /** Execution ID to display logs for */
  executionId: string | null;
  /** Optional CSS class name */
  className?: string;
}

/**
 * LogBlockList component
 * Displays CLI output grouped into collapsible blocks
 *
 * Uses the store's getBlocks method to retrieve pre-computed blocks,
 * avoiding duplicate logic and ensuring consistent block grouping.
 */
export function LogBlockList({ executionId, className }: LogBlockListProps) {
  // Get blocks directly from store using the getBlocks selector
  // This avoids duplicate logic and leverages store-side caching
  const blocks = useCliStreamStore(
    (state) => executionId ? state.getBlocks(executionId) : []
  ) as LogBlockData[];

  // Get execution status for empty state display
  const currentExecution = useCliStreamStore((state) =>
    executionId ? state.executions[executionId] : null
  );

  // Manage expanded blocks state
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());

  // Toggle block expand/collapse
  const toggleBlockExpand = useCallback((blockId: string) => {
    setExpandedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
  }, []);

  // Copy command to clipboard
  const copyCommand = useCallback((block: LogBlockData) => {
    const command = block.lines.find((l) => l.type === 'tool_call')?.content || '';
    navigator.clipboard.writeText(command).catch((err) => {
      console.error('Failed to copy command:', err);
    });
  }, []);

  // Copy output to clipboard
  const copyOutput = useCallback((block: LogBlockData) => {
    const output = block.lines.map((l) => l.content).join('\n');
    navigator.clipboard.writeText(output).catch((err) => {
      console.error('Failed to copy output:', err);
    });
  }, []);

  // Re-run block (placeholder for future implementation)
  const reRun = useCallback((block: LogBlockData) => {
    console.log('Re-run block:', block.id);
    // TODO: Implement re-run functionality
  }, []);

  // Empty states
  if (!executionId) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center h-full text-muted-foreground">
          No execution selected
        </div>
      </div>
    );
  }

  if (!currentExecution) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Execution not found
        </div>
      </div>
    );
  }

  if (blocks.length === 0) {
    const isRunning = currentExecution.status === 'running';
    return (
      <div className={className}>
        <div className="flex items-center justify-center h-full text-muted-foreground">
          {isRunning ? 'Waiting for output...' : 'No output available'}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-2 p-3">
        {blocks.map((block) => (
          <LogBlock
            key={block.id}
            block={block}
            isExpanded={expandedBlocks.has(block.id)}
            onToggleExpand={() => toggleBlockExpand(block.id)}
            onCopyCommand={() => copyCommand(block)}
            onCopyOutput={() => copyOutput(block)}
            onReRun={() => reRun(block)}
          />
        ))}
      </div>
    </div>
  );
}

export default LogBlockList;
