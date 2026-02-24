// ========================================
// useActiveCliExecutions Hook
// ========================================
// Hook for syncing active CLI executions from server

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCliStreamStore } from '@/stores/cliStreamStore';

/**
 * Response type from /api/cli/active endpoint
 */
interface ActiveCliExecution {
  id: string;
  tool: string;
  mode: string;
  status: 'running' | 'completed' | 'error';
  output?: string;
  startTime: number;
  isComplete?: boolean;
}

interface ActiveCliExecutionsResponse {
  executions: ActiveCliExecution[];
}

/**
 * Maximum number of output lines to sync per execution
 */
const MAX_OUTPUT_LINES = 5000;

/**
 * Parse message type from content for proper formatting
 * Maps Chinese prefixes to output types
 */
function parseMessageType(content: string): { type: 'stdout' | 'stderr' | 'metadata' | 'thought' | 'system' | 'tool_call'; hasPrefix: boolean } {
  const patterns = {
    system: /^\[系统\]/,
    thought: /^\[思考\]/,
    response: /^\[响应\]/,
    result: /^\[结果\]/,
    error: /^\[错误\]/,
    warning: /^\[警告\]/,
    info: /^\[信息\]/
  };

  for (const [type, pattern] of Object.entries(patterns)) {
    if (pattern.test(content)) {
      const typeMap: Record<string, 'stdout' | 'stderr' | 'metadata' | 'thought' | 'system' | 'tool_call'> = {
        system: 'system',
        thought: 'thought',
        response: 'stdout',
        result: 'metadata',
        error: 'stderr',
        warning: 'stderr',
        info: 'metadata'
      };
      return { type: typeMap[type] || 'stdout', hasPrefix: true };
    }
  }
  return { type: 'stdout', hasPrefix: false };
}

/**
 * Parse historical output from server response
 */
function parseHistoricalOutput(rawOutput: string, startTime: number) {
  if (!rawOutput) return [];

  const lines = rawOutput.split('\n');
  const startIndex = Math.max(0, lines.length - MAX_OUTPUT_LINES + 1);
  const historicalLines: Array<{ type: 'stdout' | 'stderr' | 'metadata' | 'thought' | 'system' | 'tool_call'; content: string; timestamp: number }> = [];

  lines.slice(startIndex).forEach(line => {
    if (line.trim()) {
      const { type } = parseMessageType(line);
      historicalLines.push({
        type,
        content: line,
        timestamp: startTime || Date.now()
      });
    }
  });

  return historicalLines;
}

/**
 * Query key for active CLI executions
 */
export const ACTIVE_CLI_EXECUTIONS_QUERY_KEY = ['cliActive'];

/**
 * Hook to sync active CLI executions from server
 *
 * @param enabled - Whether the query should be enabled
 * @param refetchInterval - Refetch interval in milliseconds (default: 5000)
 *
 * @example
 * ```tsx
 * const { data: executions, isLoading } = useActiveCliExecutions(true);
 * ```
 */
export function useActiveCliExecutions(
  enabled: boolean,
  refetchInterval: number = 5000
) {
  return useQuery({
    queryKey: ACTIVE_CLI_EXECUTIONS_QUERY_KEY,
    queryFn: async () => {
      // Access store state at execution time to avoid stale closures
      const store = useCliStreamStore.getState();
      const currentExecutions = store.executions;

      const response = await fetch('/api/cli/active');
      if (!response.ok) {
        throw new Error(`Failed to fetch active executions: ${response.statusText}`);
      }
      const data: ActiveCliExecutionsResponse = await response.json();

      // Get server execution IDs
      const serverIds = new Set(data.executions.map(e => e.id));

      // Clean up userClosedExecutions - remove those no longer on server
      store.cleanupUserClosedExecutions(serverIds);

      // Remove executions that are no longer on server and were closed by user
      for (const [id, exec] of Object.entries(currentExecutions)) {
        if (store.isExecutionClosedByUser(id)) {
          // User closed this execution, remove from local state
          store.removeExecution(id);
        } else if (exec.status !== 'running' && !serverIds.has(id) && exec.recovered) {
          // Not running, not on server, and was recovered (not user-created)
          store.removeExecution(id);
        }
      }

      // Process executions and sync to store
      let hasNewExecution = false;
      const now = Date.now();

      for (const exec of data.executions) {
        // Skip if user closed this execution
        if (store.isExecutionClosedByUser(exec.id)) {
          continue;
        }

        const existing = currentExecutions[exec.id];
        const historicalOutput = parseHistoricalOutput(exec.output || '', exec.startTime);

        if (!existing) {
          hasNewExecution = true;
        }

        // Merge existing output with historical output
        const existingOutput = existing?.output || [];
        const existingContentSet = new Set(existingOutput.map(o => o.content));
        const missingLines = historicalOutput.filter(h => !existingContentSet.has(h.content));

        // Prepend missing historical lines before existing output
        // Skip system start message when prepending
        const systemMsgIndex = existingOutput.findIndex(o => o.type === 'system');
        const insertIndex = systemMsgIndex >= 0 ? systemMsgIndex + 1 : 0;

        const mergedOutput = [...existingOutput];
        if (missingLines.length > 0) {
          mergedOutput.splice(insertIndex, 0, ...missingLines);
        }

        // Trim if too long
        if (mergedOutput.length > MAX_OUTPUT_LINES) {
          mergedOutput.splice(0, mergedOutput.length - MAX_OUTPUT_LINES);
        }

        // Add system message for new executions
        let finalOutput = mergedOutput;
        if (!existing) {
          finalOutput = [
            {
              type: 'system',
              content: `[${new Date(exec.startTime).toLocaleTimeString()}] CLI execution started: ${exec.tool} (${exec.mode} mode)`,
              timestamp: exec.startTime
            },
            ...mergedOutput
          ];
        }

        store.upsertExecution(exec.id, {
          tool: exec.tool || 'cli',
          mode: exec.mode || 'analysis',
          status: exec.status || 'running',
          output: finalOutput,
          startTime: exec.startTime || Date.now(),
          endTime: exec.status !== 'running' ? now : undefined,
          recovered: !existing
        });
      }

      // Set current execution to first running execution if none selected
      if (hasNewExecution) {
        const runningExec = data.executions.find(e => e.status === 'running' && !store.isExecutionClosedByUser(e.id));
        if (runningExec && !currentExecutions[runningExec.id]) {
          store.setCurrentExecution(runningExec.id);
        }
      }

      return data.executions;
    },
    enabled,
    refetchInterval,
    staleTime: 2000, // Consider data fresh for 2 seconds
  });
}

/**
 * Hook to invalidate active CLI executions query
 * Use this to trigger a refetch after an execution event
 */
export function useInvalidateActiveCliExecutions() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ACTIVE_CLI_EXECUTIONS_QUERY_KEY });
  };
}
