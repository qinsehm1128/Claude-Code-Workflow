// ========================================
// useCliStreamWebSocket Hook
// ========================================
// Centralized WebSocket message handler for CLI stream
// Ensures each message is processed ONLY ONCE across all components

import { useEffect, useRef } from 'react';
import { useNotificationStore, selectWsLastMessage } from '@/stores';
import { useCliStreamStore, type CliOutputLine } from '@/stores/cliStreamStore';
import { useInvalidateActiveCliExecutions } from '@/hooks/useActiveCliExecutions';

// ========== Module-level Message Tracking ==========
// CRITICAL: This MUST be at module level to ensure single instance across all component mounts
// Prevents duplicate message processing when multiple components subscribe to WebSocket
let globalLastProcessedMsg: unknown = null;

// ========== Types for CLI WebSocket Messages ==========

interface CliStreamStartedPayload {
  executionId: string;
  tool: string;
  mode: string;
  timestamp: string;
}

interface CliStreamOutputPayload {
  executionId: string;
  chunkType: string;
  data: unknown;
  unit?: {
    content: unknown;
    type?: string;
  };
}

interface CliStreamCompletedPayload {
  executionId: string;
  success: boolean;
  duration?: number;
  timestamp: string;
}

interface CliStreamErrorPayload {
  executionId: string;
  error?: string;
  timestamp: string;
}

// ========== Helper Functions ==========

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

// ========== Hook ==========

/**
 * Centralized WebSocket handler for CLI stream messages
 *
 * IMPORTANT: This hook uses module-level state to ensure each WebSocket message
 * is processed exactly ONCE, even when multiple components are mounted.
 *
 * Components should simply consume data from useCliStreamStore - no need to
 * handle WebSocket messages individually.
 *
 * @example
 * ```tsx
 * // In your app root or layout component
 * useCliStreamWebSocket();
 *
 * // In any component that needs CLI output
 * const executions = useCliStreamStore(state => state.executions);
 * ```
 */
export function useCliStreamWebSocket(): void {
  const lastMessage = useNotificationStore(selectWsLastMessage);
  const invalidateActive = useInvalidateActiveCliExecutions();

  // Ref to track if this hook instance is active (for cleanup)
  const isActiveRef = useRef(true);

  useEffect(() => {
    isActiveRef.current = true;

    return () => {
      isActiveRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Skip if no message or already processed GLOBALLY
    if (!lastMessage || lastMessage === globalLastProcessedMsg) return;

    // Mark as processed immediately at module level
    globalLastProcessedMsg = lastMessage;

    // Check if hook is still active (component not unmounted)
    if (!isActiveRef.current) return;

    const { type, payload } = lastMessage;

    if (type === 'CLI_STARTED') {
      const p = payload as CliStreamStartedPayload;
      const startTime = p.timestamp ? new Date(p.timestamp).getTime() : Date.now();
      useCliStreamStore.getState().upsertExecution(p.executionId, {
        tool: p.tool || 'cli',
        mode: p.mode || 'analysis',
        status: 'running',
        startTime,
        output: [
          {
            type: 'system',
            content: `[${new Date(startTime).toLocaleTimeString()}] CLI execution started: ${p.tool} (${p.mode} mode)`,
            timestamp: startTime
          }
        ]
      });
      invalidateActive();
    } else if (type === 'CLI_OUTPUT') {
      const p = payload as CliStreamOutputPayload;
      const unitContent = p.unit?.content ?? p.data;
      const unitType = p.unit?.type || p.chunkType;

      let content: string;
      if (unitType === 'tool_call' && typeof unitContent === 'object' && unitContent !== null) {
        const toolCall = unitContent as { action?: string; toolName?: string; parameters?: unknown; status?: string; output?: string };
        if (toolCall.action === 'invoke') {
          const params = toolCall.parameters ? JSON.stringify(toolCall.parameters) : '';
          content = `[Tool] ${toolCall.toolName}(${params})`;
        } else if (toolCall.action === 'result') {
          const status = toolCall.status || 'unknown';
          const output = toolCall.output ? `: ${toolCall.output.substring(0, 200)}${toolCall.output.length > 200 ? '...' : ''}` : '';
          content = `[Tool Result] ${status}${output}`;
        } else {
          content = JSON.stringify(unitContent);
        }
      } else {
        content = typeof unitContent === 'string' ? unitContent : JSON.stringify(unitContent);
      }

      const lines = content.split('\n');
      const addOutput = useCliStreamStore.getState().addOutput;
      lines.forEach(line => {
        if (line.trim() || lines.length === 1) {
          addOutput(p.executionId, {
            type: (unitType as CliOutputLine['type']) || 'stdout',
            content: line,
            timestamp: Date.now()
          });
        }
      });
    } else if (type === 'CLI_COMPLETED') {
      const p = payload as CliStreamCompletedPayload;
      const endTime = p.timestamp ? new Date(p.timestamp).getTime() : Date.now();
      useCliStreamStore.getState().upsertExecution(p.executionId, {
        status: p.success ? 'completed' : 'error',
        endTime,
        output: [
          {
            type: 'system',
            content: `[${new Date(endTime).toLocaleTimeString()}] CLI execution ${p.success ? 'completed successfully' : 'failed'}${p.duration ? ` (${formatDuration(p.duration)})` : ''}`,
            timestamp: endTime
          }
        ]
      });
      invalidateActive();
    } else if (type === 'CLI_ERROR') {
      const p = payload as CliStreamErrorPayload;
      const endTime = p.timestamp ? new Date(p.timestamp).getTime() : Date.now();
      useCliStreamStore.getState().upsertExecution(p.executionId, {
        status: 'error',
        endTime,
        output: [
          {
            type: 'stderr',
            content: `[ERROR] ${p.error || 'Unknown error occurred'}`,
            timestamp: endTime
          }
        ]
      });
      invalidateActive();
    }
  }, [lastMessage, invalidateActive]);
}

/**
 * Reset the global message tracker
 * Useful for testing or when explicitly re-processing messages is needed
 */
export function resetCliStreamWebSocketTracker(): void {
  globalLastProcessedMsg = null;
}

export default useCliStreamWebSocket;
