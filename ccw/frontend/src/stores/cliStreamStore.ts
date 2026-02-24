// ========================================
// CLI Stream Store
// ========================================
// Zustand store for managing CLI streaming output

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ========== Types ==========

/**
 * Output line type for CLI streaming
 */
export interface CliOutputLine {
  type: 'stdout' | 'stderr' | 'metadata' | 'thought' | 'system' | 'tool_call';
  content: string;
  timestamp: number;
}

/**
 * CLI execution status
 */
export type CliExecutionStatus = 'running' | 'completed' | 'error';

/**
 * CLI execution state
 */
export interface CliExecutionState {
  tool: string;
  mode: string;
  status: CliExecutionStatus;
  output: CliOutputLine[];
  startTime: number;
  endTime?: number;
  recovered?: boolean;
}

/**
 * Log line within a block (minimal interface compatible with LogBlock component)
 * This matches the LogLine type in components/shared/LogBlock/types.ts
 */
export interface LogLine {
  type: 'stdout' | 'stderr' | 'thought' | 'system' | 'metadata' | 'tool_call';
  content: string;
  timestamp: number;
}

/**
 * Log block data (minimal interface compatible with LogBlock component)
 * This matches the LogBlockData type in components/shared/LogBlock/types.ts
 * Defined here to avoid circular dependencies
 */
export interface LogBlockData {
  id: string;
  title: string;
  type: 'command' | 'tool' | 'output' | 'error' | 'warning' | 'info';
  status: 'running' | 'completed' | 'error' | 'pending';
  toolName?: string;
  lineCount: number;
  duration?: number;
  lines: LogLine[];
  timestamp: number;
}

/**
 * Block cache state
 */
interface BlockCacheState {
  blocks: Record<string, LogBlockData[]>;  // executionId -> cached blocks
  lastUpdate: Record<string, number>;       // executionId -> timestamp of last cache update
}

/**
 * CLI stream state interface
 */
interface CliStreamState extends BlockCacheState {
  outputs: Record<string, CliOutputLine[]>;
  executions: Record<string, CliExecutionState>;
  currentExecutionId: string | null;
  userClosedExecutions: Set<string>;  // Track executions closed by user

  // Legacy methods
  addOutput: (executionId: string, line: CliOutputLine) => void;
  clearOutputs: (executionId: string) => void;
  getOutputs: (executionId: string) => CliOutputLine[];

  // Multi-execution methods
  getAllExecutions: () => CliExecutionState[];
  upsertExecution: (executionId: string, exec: Partial<CliExecutionState> & { tool?: string; mode?: string }) => void;
  removeExecution: (executionId: string) => void;
  markExecutionClosedByUser: (executionId: string) => void;
  isExecutionClosedByUser: (executionId: string) => boolean;
  cleanupUserClosedExecutions: (serverIds: Set<string>) => void;
  setCurrentExecution: (executionId: string | null) => void;

  // Block cache methods
  getBlocks: (executionId: string) => LogBlockData[];
  invalidateBlocks: (executionId: string) => void;
}

// ========== Constants ==========

/**
 * Maximum number of output lines to keep per execution
 * Prevents memory issues for long-running executions
 */
const MAX_OUTPUT_LINES = 5000;

// ========== Helper Functions ==========

/**
 * Parse tool call metadata from content
 * Expected format: "[Tool] toolName(args)"
 */
function parseToolCallMetadata(content: string): { toolName: string; args: string } | undefined {
  const toolCallMatch = content.match(/^\[Tool\]\s+(\w+)\((.*)\)$/);
  if (toolCallMatch) {
    return {
      toolName: toolCallMatch[1],
      args: toolCallMatch[2] || '',
    };
  }
  return undefined;
}

/**
 * Generate block title based on type and content
 */
function generateBlockTitle(lineType: string, content: string): string {
  switch (lineType) {
    case 'tool_call':
      const metadata = parseToolCallMetadata(content);
      if (metadata) {
        return metadata.args ? `${metadata.toolName}(${metadata.args})` : metadata.toolName;
      }
      return 'Tool Call';
    case 'thought':
      return 'Thought';
    case 'system':
      return 'System';
    case 'stderr':
      return 'Error Output';
    case 'stdout':
      return 'Output';
    case 'metadata':
      return 'Metadata';
    default:
      return 'Log';
  }
}

/**
 * Get block type for a line
 */
function getBlockType(lineType: string): LogBlockData['type'] {
  switch (lineType) {
    case 'tool_call':
      return 'tool';
    case 'thought':
      return 'info';
    case 'system':
      return 'info';
    case 'stderr':
      return 'error';
    case 'stdout':
    case 'metadata':
    default:
      return 'output';
  }
}

/**
 * Check if a line type should start a new block
 */
function shouldStartNewBlock(lineType: string, currentBlockType: string | null): boolean {
  // No current block exists
  if (!currentBlockType) {
    return true;
  }

  // These types always start new blocks
  if (lineType === 'tool_call' || lineType === 'thought' || lineType === 'system') {
    return true;
  }

  // stderr starts a new block if not already in stderr
  if (lineType === 'stderr' && currentBlockType !== 'stderr') {
    return true;
  }

  // tool_call block captures all following stdout/stderr until next tool_call
  if (currentBlockType === 'tool_call' && (lineType === 'stdout' || lineType === 'stderr')) {
    return false;
  }

  // stderr block captures all stderr until next different type
  if (currentBlockType === 'stderr' && lineType === 'stderr') {
    return false;
  }

  // stdout merges into current stdout block
  if (currentBlockType === 'stdout' && lineType === 'stdout') {
    return false;
  }

  // Different type - start new block
  if (currentBlockType !== lineType) {
    return true;
  }

  return false;
}

/**
 * Group CLI output lines into log blocks
 *
 * Block grouping rules:
 * 1. tool_call starts new block, includes following stdout/stderr until next tool_call
 * 2. thought becomes independent block
 * 3. system becomes independent block
 * 4. stderr becomes highlighted block
 * 5. Other stdout merges into normal blocks
 */
function groupLinesIntoBlocks(
  lines: CliOutputLine[],
  executionId: string,
  executionStatus: 'running' | 'completed' | 'error'
): LogBlockData[] {
  const blocks: LogBlockData[] = [];
  let currentLines: LogLine[] = [];
  let currentType: string | null = null;
  let currentTitle = '';
  let currentToolName: string | undefined;
  let blockStartTime = 0;
  let blockIndex = 0;

  for (const line of lines) {
    // Check if we need to start a new block
    if (shouldStartNewBlock(line.type, currentType)) {
      // Save current block if exists
      if (currentLines.length > 0) {
        const duration = blockStartTime > 0 ? line.timestamp - blockStartTime : undefined;
        blocks.push({
          id: `${executionId}-block-${blockIndex}`,
          title: currentTitle || generateBlockTitle(currentType || '', currentLines[0]?.content || ''),
          type: getBlockType(currentType || ''),
          status: executionStatus === 'running' ? 'running' : 'completed',
          toolName: currentToolName,
          lineCount: currentLines.length,
          duration,
          lines: currentLines,
          timestamp: blockStartTime,
        });
        blockIndex++;
      }

      // Start new block
      currentType = line.type;
      currentTitle = generateBlockTitle(line.type, line.content);
      currentLines = [
        {
          type: line.type,
          content: line.content,
          timestamp: line.timestamp,
        },
      ];
      blockStartTime = line.timestamp;

      // Extract tool name for tool_call blocks
      if (line.type === 'tool_call') {
        const metadata = parseToolCallMetadata(line.content);
        currentToolName = metadata?.toolName;
      } else {
        currentToolName = undefined;
      }
    } else {
      // Add line to current block
      currentLines.push({
        type: line.type,
        content: line.content,
        timestamp: line.timestamp,
      });
    }
  }

  // Finalize the last block
  if (currentLines.length > 0) {
    const lastLine = currentLines[currentLines.length - 1];
    const duration = blockStartTime > 0 ? lastLine.timestamp - blockStartTime : undefined;
    blocks.push({
      id: `${executionId}-block-${blockIndex}`,
      title: currentTitle || generateBlockTitle(currentType || '', currentLines[0]?.content || ''),
      type: getBlockType(currentType || ''),
      status: executionStatus === 'running' ? 'running' : 'completed',
      toolName: currentToolName,
      lineCount: currentLines.length,
      duration,
      lines: currentLines,
      timestamp: blockStartTime,
    });
  }

  return blocks;
}

// ========== Store ==========

/**
 * Zustand store for CLI streaming output
 *
 * @remarks
 * Manages streaming output from CLI executions in memory.
 * Each execution has its own output array, accessible by executionId.
 *
 * @example
 * ```tsx
 * const addOutput = useCliStreamStore(state => state.addOutput);
 * addOutput('exec-123', { type: 'stdout', content: 'Hello', timestamp: Date.now() });
 * ```
 */
export const useCliStreamStore = create<CliStreamState>()(
  devtools(
    (set, get) => ({
      outputs: {},
      executions: {},
      currentExecutionId: null,
      userClosedExecutions: new Set<string>(),

      // Block cache state
      blocks: {},
      lastUpdate: {},

      addOutput: (executionId: string, line: CliOutputLine) => {
        set((state) => {
          const current = state.outputs[executionId] || [];
          const updated = [...current, line];

          // Trim if too long to prevent memory issues
          if (updated.length > MAX_OUTPUT_LINES) {
            return {
              outputs: {
                ...state.outputs,
                [executionId]: updated.slice(-MAX_OUTPUT_LINES),
              },
            };
          }

          return {
            outputs: {
              ...state.outputs,
              [executionId]: updated,
            },
          };
        }, false, 'cliStream/addOutput');

        // Also update in executions
        const state = get();
        if (state.executions[executionId]) {
          set((state) => {
            const currentOutput = state.executions[executionId].output;
            const updatedOutput = [...currentOutput, line];
            return {
              executions: {
                ...state.executions,
                [executionId]: {
                  ...state.executions[executionId],
                  output: updatedOutput.length > MAX_OUTPUT_LINES
                    ? updatedOutput.slice(-MAX_OUTPUT_LINES)
                    : updatedOutput,
                },
              },
            };
          }, false, 'cliStream/updateExecutionOutput');
        }
      },

      clearOutputs: (executionId: string) => {
        set(
          (state) => ({
            outputs: {
              ...state.outputs,
              [executionId]: [],
            },
          }),
          false,
          'cliStream/clearOutputs'
        );
      },

      getOutputs: (executionId: string) => {
        return get().outputs[executionId] || [];
      },

      // Multi-execution methods
      getAllExecutions: () => {
        return Object.values(get().executions);
      },

      upsertExecution: (executionId: string, exec: Partial<CliExecutionState> & { tool?: string; mode?: string }) => {
        set((state) => {
          const existing = state.executions[executionId];
          const updated: CliExecutionState = existing
            ? { ...existing, ...exec }
            : {
                tool: exec.tool || 'cli',
                mode: exec.mode || 'analysis',
                status: exec.status || 'running',
                output: exec.output || [],
                startTime: exec.startTime || Date.now(),
                endTime: exec.endTime,
                recovered: exec.recovered,
              };

          return {
            executions: {
              ...state.executions,
              [executionId]: updated,
            },
          };
        }, false, 'cliStream/upsertExecution');
      },

      removeExecution: (executionId: string) => {
        set((state) => {
          const newExecutions = { ...state.executions };
          const newBlocks = { ...state.blocks };
          const newLastUpdate = { ...state.lastUpdate };
          delete newExecutions[executionId];
          delete newBlocks[executionId];
          delete newLastUpdate[executionId];
          return {
            executions: newExecutions,
            blocks: newBlocks,
            lastUpdate: newLastUpdate,
            currentExecutionId: state.currentExecutionId === executionId ? null : state.currentExecutionId,
          };
        }, false, 'cliStream/removeExecution');
      },

      markExecutionClosedByUser: (executionId: string) => {
        set((state) => {
          const newUserClosedExecutions = new Set(state.userClosedExecutions);
          newUserClosedExecutions.add(executionId);
          return {
            userClosedExecutions: newUserClosedExecutions,
          };
        }, false, 'cliStream/markExecutionClosedByUser');
      },

      isExecutionClosedByUser: (executionId: string) => {
        return get().userClosedExecutions.has(executionId);
      },

      cleanupUserClosedExecutions: (serverIds: Set<string>) => {
        set((state) => {
          const newUserClosedExecutions = new Set<string>();
          for (const executionId of state.userClosedExecutions) {
            // Only keep if still on server (user might want to keep it closed)
            if (serverIds.has(executionId)) {
              newUserClosedExecutions.add(executionId);
            }
          }
          return {
            userClosedExecutions: newUserClosedExecutions,
          };
        }, false, 'cliStream/cleanupUserClosedExecutions');
      },

      setCurrentExecution: (executionId: string | null) => {
        set({ currentExecutionId: executionId }, false, 'cliStream/setCurrentExecution');
      },

      // Block cache methods
      getBlocks: (executionId: string) => {
        const state = get();
        const execution = state.executions[executionId];

        // Return empty array if execution doesn't exist
        if (!execution) {
          return [];
        }

        // Check if cache is valid
        // Cache is valid if:
        // 1. Cache exists and has blocks
        // 2. Execution has ended (has endTime)
        // 3. Cache was updated after or at the execution end time
        const cachedBlocks = state.blocks[executionId];
        const lastUpdateTime = state.lastUpdate[executionId];
        const isCacheValid =
          cachedBlocks &&
          lastUpdateTime &&
          execution.endTime &&
          lastUpdateTime >= execution.endTime;

        // Return cached blocks if valid
        if (isCacheValid) {
          return cachedBlocks;
        }

        // Recompute blocks from output
        const newBlocks = groupLinesIntoBlocks(execution.output, executionId, execution.status);

        // Update cache
        set((state) => ({
          blocks: {
            ...state.blocks,
            [executionId]: newBlocks,
          },
          lastUpdate: {
            ...state.lastUpdate,
            [executionId]: Date.now(),
          },
        }), false, 'cliStream/updateBlockCache');

        return newBlocks;
      },

      invalidateBlocks: (executionId: string) => {
        set((state) => {
          const newBlocks = { ...state.blocks };
          const newLastUpdate = { ...state.lastUpdate };
          delete newBlocks[executionId];
          delete newLastUpdate[executionId];
          return {
            blocks: newBlocks,
            lastUpdate: newLastUpdate,
          };
        }, false, 'cliStream/invalidateBlocks');
      },
    }),
    { name: 'CliStreamStore' }
  )
);

// ========== Selectors ==========

/** Stable empty array to avoid new references */
const EMPTY_OUTPUTS: CliOutputLine[] = [];

/**
 * Selector for getting outputs by execution ID
 */
export const selectOutputs = (state: CliStreamState, executionId: string) =>
  state.outputs[executionId] || EMPTY_OUTPUTS;

/**
 * Selector for getting addOutput action
 */
export const selectAddOutput = (state: CliStreamState) => state.addOutput;

/**
 * Selector for getting clearOutputs action
 */
export const selectClearOutputs = (state: CliStreamState) => state.clearOutputs;

/**
 * Selector for getting all executions
 */
export const selectAllExecutions = (state: CliStreamState) => state.executions;

/**
 * Selector for getting current execution ID
 */
export const selectCurrentExecutionId = (state: CliStreamState) => state.currentExecutionId;

/**
 * Selector for getting active execution count
 */
export const selectActiveExecutionCount = (state: CliStreamState) =>
  Object.values(state.executions).filter(e => e.status === 'running').length;
