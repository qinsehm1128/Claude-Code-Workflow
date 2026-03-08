// ========================================
// useActiveCliExecutions Hook
// ========================================
// Hook for syncing active CLI executions from server

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchExecutionDetail, type ConversationRecord } from '@/lib/api';
import { useCliStreamStore, type CliExecutionState } from '@/stores/cliStreamStore';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';

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

function normalizeTimestampMs(value: unknown): number | undefined {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 0 && value < 1_000_000_000_000 ? value * 1000 : value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const numericValue = Number(trimmed);
    if (Number.isFinite(numericValue)) {
      return numericValue > 0 && numericValue < 1_000_000_000_000 ? numericValue * 1000 : numericValue;
    }

    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
}

function isSavedExecutionNewerThanActive(activeStartTime: unknown, savedTimestamp: unknown): boolean {
  const activeStartTimeMs = normalizeTimestampMs(activeStartTime);
  if (activeStartTimeMs === undefined) {
    return false;
  }

  const savedTimestampMs = normalizeTimestampMs(savedTimestamp);
  if (savedTimestampMs === undefined) {
    return false;
  }

  return savedTimestampMs >= activeStartTimeMs;
}

async function filterSupersededRunningExecutions(
  executions: ActiveCliExecution[],
  currentExecutions: Record<string, CliExecutionState>,
  projectPath?: string
): Promise<{ filteredExecutions: ActiveCliExecution[]; removedIds: string[] }> {
  const candidates = executions.filter((execution) => {
    if (execution.status !== 'running') {
      return false;
    }

    const existing = currentExecutions[execution.id];
    return !existing || existing.recovered;
  });

  if (candidates.length === 0) {
    return { filteredExecutions: executions, removedIds: [] };
  }

  const removedIds = new Set<string>();

  await Promise.all(candidates.map(async (execution) => {
    try {
      const detail = await fetchExecutionDetail(execution.id, projectPath) as ConversationRecord & { _active?: boolean };
      if (detail._active) {
        return;
      }

      if (isSavedExecutionNewerThanActive(
        execution.startTime,
        detail.updated_at || detail.created_at
      )) {
        removedIds.add(execution.id);
      }
    } catch {
      // Ignore detail lookup failures and keep server active state.
    }
  }));

  if (removedIds.size === 0) {
    return { filteredExecutions: executions, removedIds: [] };
  }

  return {
    filteredExecutions: executions.filter((execution) => !removedIds.has(execution.id)),
    removedIds: Array.from(removedIds),
  };
}

function pickPreferredExecutionId(executions: Record<string, CliExecutionState>): string | null {
  const sortedEntries = Object.entries(executions).sort(([, executionA], [, executionB]) => {
    if (executionA.status === 'running' && executionB.status !== 'running') return -1;
    if (executionA.status !== 'running' && executionB.status === 'running') return 1;
    return executionB.startTime - executionA.startTime;
  });

  return sortedEntries[0]?.[0] ?? null;
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
  const projectPath = useWorkflowStore(selectProjectPath);

  return useQuery({
    queryKey: [...ACTIVE_CLI_EXECUTIONS_QUERY_KEY, projectPath || 'default'],
    queryFn: async () => {
      const store = useCliStreamStore.getState();
      const currentExecutions = store.executions;
      const params = new URLSearchParams();
      if (projectPath) {
        params.set('path', projectPath);
      }

      const activeUrl = params.size > 0
        ? `/api/cli/active?${params.toString()}`
        : '/api/cli/active';
      const response = await fetch(activeUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch active executions: ${response.statusText}`);
      }
      const data: ActiveCliExecutionsResponse = await response.json();
      const { filteredExecutions, removedIds } = await filterSupersededRunningExecutions(
        data.executions,
        currentExecutions,
        projectPath || undefined
      );

      removedIds.forEach((executionId) => {
        store.removeExecution(executionId);
      });

      const serverIds = new Set(filteredExecutions.map(e => e.id));

      store.cleanupUserClosedExecutions(serverIds);

      for (const [id, exec] of Object.entries(currentExecutions)) {
        if (store.isExecutionClosedByUser(id)) {
          store.removeExecution(id);
        } else if (exec.recovered && !serverIds.has(id)) {
          store.removeExecution(id);
        }
      }

      let hasNewExecution = false;
      const now = Date.now();

      for (const exec of filteredExecutions) {
        if (store.isExecutionClosedByUser(exec.id)) {
          continue;
        }

        const existing = currentExecutions[exec.id];
        const historicalOutput = parseHistoricalOutput(exec.output || '', exec.startTime);

        if (!existing) {
          hasNewExecution = true;
        }

        const existingOutput = existing?.output || [];
        const existingContentSet = new Set(existingOutput.map(o => o.content));
        const missingLines = historicalOutput.filter(h => !existingContentSet.has(h.content));

        const systemMsgIndex = existingOutput.findIndex(o => o.type === 'system');
        const insertIndex = systemMsgIndex >= 0 ? systemMsgIndex + 1 : 0;

        const mergedOutput = [...existingOutput];
        if (missingLines.length > 0) {
          mergedOutput.splice(insertIndex, 0, ...missingLines);
        }

        if (mergedOutput.length > MAX_OUTPUT_LINES) {
          mergedOutput.splice(0, mergedOutput.length - MAX_OUTPUT_LINES);
        }

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

      if (hasNewExecution) {
        const runningExec = filteredExecutions.find(e => e.status === 'running' && !store.isExecutionClosedByUser(e.id));
        if (runningExec && !currentExecutions[runningExec.id]) {
          store.setCurrentExecution(runningExec.id);
        }
      }

      const nextState = useCliStreamStore.getState();
      const currentExecutionId = nextState.currentExecutionId;
      if (!currentExecutionId || !nextState.executions[currentExecutionId]) {
        const preferredExecutionId = pickPreferredExecutionId(nextState.executions);
        if (preferredExecutionId !== currentExecutionId) {
          store.setCurrentExecution(preferredExecutionId);
        }
      }

      return filteredExecutions;
    },
    enabled,
    refetchInterval,
    staleTime: 2000,
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
