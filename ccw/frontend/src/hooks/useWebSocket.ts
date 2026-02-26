// ========================================
// useWebSocket Hook
// ========================================
// Typed WebSocket connection management with auto-reconnect

import { useEffect, useRef, useCallback } from 'react';
import { useNotificationStore } from '@/stores';
import { useExecutionStore } from '@/stores/executionStore';
import { useFlowStore } from '@/stores';
import { useCliSessionStore } from '@/stores/cliSessionStore';
import {
  handleSessionLockedMessage,
  handleSessionUnlockedMessage,
} from '@/stores/sessionManagerStore';
import {
  useExecutionMonitorStore,
  type ExecutionWSMessage,
} from '@/stores/executionMonitorStore';
import {
  OrchestratorMessageSchema,
  type OrchestratorWebSocketMessage,
  type ExecutionLog,
} from '../types/execution';
import { SurfaceUpdateSchema } from '../packages/a2ui-runtime/core/A2UITypes';
import type { ToolCallKind, ToolCallExecution } from '../types/toolCall';

// Constants
const RECONNECT_DELAY_BASE = 1000; // 1 second
const RECONNECT_DELAY_MAX = 30000; // 30 seconds
const RECONNECT_DELAY_MULTIPLIER = 1.5;

// Access store state/actions via getState() - avoids calling hooks in callbacks/effects
// This is the zustand-recommended pattern for non-rendering store access
function getStoreState() {
  const notification = useNotificationStore.getState();
  const execution = useExecutionStore.getState();
  const flow = useFlowStore.getState();
  const cliSessions = useCliSessionStore.getState();
  return {
    // Notification store
    setWsStatus: notification.setWsStatus,
    setWsLastMessage: notification.setWsLastMessage,
    incrementReconnectAttempts: notification.incrementReconnectAttempts,
    resetReconnectAttempts: notification.resetReconnectAttempts,
    addA2UINotification: notification.addA2UINotification,
    // Execution store
    setExecutionStatus: execution.setExecutionStatus,
    setNodeStarted: execution.setNodeStarted,
    setNodeCompleted: execution.setNodeCompleted,
    setNodeFailed: execution.setNodeFailed,
    addLog: execution.addLog,
    completeExecution: execution.completeExecution,
    currentExecution: execution.currentExecution,
    // Tool call actions
    startToolCall: execution.startToolCall,
    updateToolCall: execution.updateToolCall,
    completeToolCall: execution.completeToolCall,
    toggleToolCallExpanded: execution.toggleToolCallExpanded,
    // Tool call getters
    getToolCallsForNode: execution.getToolCallsForNode,
    // Node output actions
    addNodeOutput: execution.addNodeOutput,
    // Flow store
    updateNode: flow.updateNode,

    // CLI session store (PTY-backed terminal)
    upsertCliSession: cliSessions.upsertSession,
    removeCliSession: cliSessions.removeSession,
    appendCliSessionOutput: cliSessions.appendOutput,
    updateCliSessionPausedState: cliSessions.updateSessionPausedState,
  };
}

export interface UseWebSocketOptions {
  enabled?: boolean;
  onMessage?: (message: OrchestratorWebSocketMessage) => void;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  send: (message: unknown) => void;
  reconnect: () => void;
}

// ========== Tool Call Parsing Helpers ==========

/**
 * Parse tool call metadata from content
 * Expected format: "[Tool] toolName(args)"
 */
function parseToolCallMetadata(content: string): { toolName: string; args: string } | null {
  // Handle string content
  if (typeof content === 'string') {
    const match = content.match(/^\[Tool\]\s+(\w+)\((.*)\)$/);
    if (match) {
      return { toolName: match[1], args: match[2] || '' };
    }
  }

  // Handle object content with toolName field
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    if (parsed && typeof parsed === 'object' && 'toolName' in parsed) {
      return {
        toolName: String(parsed.toolName),
        args: parsed.parameters ? JSON.stringify(parsed.parameters) : '',
      };
    }
  } catch {
    // Not valid JSON, return null
  }

  return null;
}

/**
 * Infer tool call kind from tool name
 */
function inferToolCallKind(toolName: string): ToolCallKind {
  const name = toolName.toLowerCase();

  if (name === 'exec_command' || name === 'execute') return 'execute';
  if (name === 'apply_patch' || name === 'patch') return 'patch';
  if (name === 'web_search' || name === 'exa_search') return 'web_search';
  if (name.startsWith('mcp_') || name.includes('mcp')) return 'mcp_tool';
  if (name.includes('file') || name.includes('read') || name.includes('write')) return 'file_operation';
  if (name.includes('think') || name.includes('reason')) return 'thinking';

  // Default to execute
  return 'execute';
}

/**
 * Generate unique tool call ID
 */
function generateToolCallId(): string {
  return `tool_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { enabled = true, onMessage } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelayRef = useRef(RECONNECT_DELAY_BASE);
  const mountedRef = useRef(true);

  // Handle incoming WebSocket messages
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      // Guard against state updates after unmount
      if (!mountedRef.current) {
        return;
      }

      try {
        const data = JSON.parse(event.data);
        const stores = getStoreState();

        // Store last message for debugging
        stores.setWsLastMessage(data);

        // Handle CLI messages
        if (data.type?.startsWith('CLI_')) {
          switch (data.type) {
            // ========== PTY CLI Sessions ==========
            case 'CLI_SESSION_CREATED': {
              const session = data.payload?.session;
              if (session?.sessionKey) {
                stores.upsertCliSession(session);
              }
              break;
            }

            case 'CLI_SESSION_OUTPUT': {
              const { sessionKey, data: chunk } = data.payload ?? {};
              if (typeof sessionKey === 'string' && typeof chunk === 'string') {
                stores.appendCliSessionOutput(sessionKey, chunk);
              }
              break;
            }

            case 'CLI_SESSION_CLOSED': {
              const { sessionKey } = data.payload ?? {};
              if (typeof sessionKey === 'string') {
                stores.removeCliSession(sessionKey);
              }
              break;
            }

            case 'CLI_SESSION_PAUSED': {
              const { sessionKey } = data.payload ?? {};
              if (typeof sessionKey === 'string') {
                stores.updateCliSessionPausedState(sessionKey, true);
              }
              break;
            }

            case 'CLI_SESSION_RESUMED': {
              const { sessionKey } = data.payload ?? {};
              if (typeof sessionKey === 'string') {
                stores.updateCliSessionPausedState(sessionKey, false);
              }
              break;
            }

            case 'CLI_SESSION_LOCKED': {
              const { sessionKey, reason, executionId, timestamp } = data.payload ?? {};
              if (typeof sessionKey === 'string') {
                handleSessionLockedMessage({
                  sessionKey,
                  reason: reason ?? 'Workflow execution',
                  executionId,
                  timestamp: timestamp ?? new Date().toISOString(),
                });
              }
              break;
            }

            case 'CLI_SESSION_UNLOCKED': {
              const { sessionKey, timestamp } = data.payload ?? {};
              if (typeof sessionKey === 'string') {
                handleSessionUnlockedMessage({
                  sessionKey,
                  timestamp: timestamp ?? new Date().toISOString(),
                });
              }
              break;
            }

            case 'CLI_OUTPUT': {
              const { chunkType, data: outputData, unit } = data.payload;

              // Handle structured output
              const unitContent = unit?.content || outputData;
              const unitType = unit?.type || chunkType;

              // Convert content to string for display
              let content: string;
              if (unitType === 'tool_call' && typeof unitContent === 'object' && unitContent !== null) {
                // Format tool_call display
                content = JSON.stringify(unitContent);
              } else {
                content = typeof unitContent === 'string' ? unitContent : JSON.stringify(unitContent);
              }

              // ========== Tool Call Processing ==========
              // Parse and start new tool call if this is a tool_call type
              if (unitType === 'tool_call') {
                const metadata = parseToolCallMetadata(content);
                if (metadata) {
                  const callId = generateToolCallId();
                  const currentNodeId = stores.currentExecution?.currentNodeId;

                  if (currentNodeId) {
                    stores.startToolCall(currentNodeId, callId, {
                      kind: inferToolCallKind(metadata.toolName),
                      description: metadata.args
                        ? `${metadata.toolName}(${metadata.args})`
                        : metadata.toolName,
                    });

                    // Also add to node output for streaming display
                    stores.addNodeOutput(currentNodeId, {
                      type: 'tool_call',
                      content,
                      timestamp: Date.now(),
                    });
                  }
                }
              }

              // ========== Stream Processing ==========
              // Update tool call output buffer if we have an active tool call for this node
              const currentNodeId = stores.currentExecution?.currentNodeId;
              if (currentNodeId && (unitType === 'stdout' || unitType === 'stderr')) {
                const toolCalls = stores.getToolCallsForNode?.(currentNodeId);
                const activeCall = toolCalls?.find((c: ToolCallExecution) => c.status === 'executing');

                if (activeCall) {
                  stores.updateToolCall(currentNodeId, activeCall.callId, {
                    outputChunk: content,
                    stream: unitType === 'stderr' ? 'stderr' : 'stdout',
                  });
                }
              }

              break;
            }
          }
          return;
        }

        // Handle EXECUTION messages (from orchestrator execution-in-session)
        if (data.type?.startsWith('EXECUTION_')) {
          const handleExecutionMessage = useExecutionMonitorStore.getState().handleExecutionMessage;
          handleExecutionMessage(data as ExecutionWSMessage);
          return;
        }

        // Handle A2UI surface messages
        if (data.type === 'a2ui-surface') {
          const parsed = SurfaceUpdateSchema.safeParse(data.payload);
          if (parsed.success) {
            stores.addA2UINotification(parsed.data, 'Interactive UI');
          } else {
            console.warn('[WebSocket] Invalid A2UI surface:', parsed.error.issues);
          }
          return;
        }

        // Check if this is an orchestrator message
        if (!data.type?.startsWith('ORCHESTRATOR_')) {
          return;
        }

        // Validate message with zod schema
        const parsed = OrchestratorMessageSchema.safeParse(data);
        if (!parsed.success) {
          console.warn('[WebSocket] Invalid orchestrator message:', parsed.error.issues);
          return;
        }

        // Cast validated data to our TypeScript interface
        const message = parsed.data as OrchestratorWebSocketMessage;

        // Only process messages for current execution
        const { currentExecution } = stores;
        if (currentExecution && message.execId !== currentExecution.execId) {
          return;
        }

        // Dispatch to execution store based on message type
        switch (message.type) {
          case 'ORCHESTRATOR_STATE_UPDATE':
            stores.setExecutionStatus(message.status, message.currentNodeId);
            // Check for completion
            if (message.status === 'completed' || message.status === 'failed') {
              stores.completeExecution(message.status);
            }
            break;

          case 'ORCHESTRATOR_NODE_STARTED':
            stores.setNodeStarted(message.nodeId);
            // Update canvas node status
            stores.updateNode(message.nodeId, { executionStatus: 'running' });
            break;

          case 'ORCHESTRATOR_NODE_COMPLETED':
            stores.setNodeCompleted(message.nodeId, message.result);
            // Update canvas node status
            stores.updateNode(message.nodeId, {
              executionStatus: 'completed',
              executionResult: message.result,
            });
            break;

          case 'ORCHESTRATOR_NODE_FAILED':
            stores.setNodeFailed(message.nodeId, message.error);
            // Update canvas node status
            stores.updateNode(message.nodeId, {
              executionStatus: 'failed',
              executionError: message.error,
            });
            break;

          case 'ORCHESTRATOR_LOG':
            stores.addLog(message.log as ExecutionLog);
            break;
        }

        // Call custom message handler if provided
        onMessage?.(message);
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    },
    [onMessage] // Only dependency is onMessage, store access via getState()
  );

  // Connect to WebSocket
  // Use ref to avoid circular dependency with scheduleReconnect
  const connectRef = useRef<(() => void) | null>(null);

  // Schedule reconnection with exponential backoff
  // Define this first to avoid circular dependency
  const scheduleReconnect = useCallback(() => {
    // Don't reconnect after unmount
    if (!mountedRef.current) return;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = reconnectDelayRef.current;
    console.log(`[WebSocket] Reconnecting in ${delay}ms...`);

    const stores = getStoreState();
    stores.setWsStatus('reconnecting');
    stores.incrementReconnectAttempts();

    reconnectTimeoutRef.current = setTimeout(() => {
      connectRef.current?.();
    }, delay);

    // Increase delay for next attempt (exponential backoff)
    reconnectDelayRef.current = Math.min(
      reconnectDelayRef.current * RECONNECT_DELAY_MULTIPLIER,
      RECONNECT_DELAY_MAX
    );
  }, []); // No dependencies - uses connectRef and getStoreState()

  const connect = useCallback(() => {
    if (!enabled || !mountedRef.current) return;

    // Close existing connection to avoid orphaned sockets
    if (wsRef.current) {
      wsRef.current.onclose = null; // Prevent onclose from triggering reconnect
      wsRef.current.close();
      wsRef.current = null;
    }

    // Construct WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      getStoreState().setWsStatus('connecting');

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected');
        const s = getStoreState();
        s.setWsStatus('connected');
        s.resetReconnectAttempts();
        reconnectDelayRef.current = RECONNECT_DELAY_BASE;

        // Request any pending questions from backend
        ws.send(JSON.stringify({
          type: 'FRONTEND_READY',
          payload: { action: 'requestPendingQuestions' }
        }));
      };

      ws.onmessage = handleMessage;

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        getStoreState().setWsStatus('disconnected');
        wsRef.current = null;
        scheduleReconnect();
      };

      ws.onerror = () => {
        console.warn('[WebSocket] Connection error');
        getStoreState().setWsStatus('error');
      };
    } catch (error) {
      console.error('[WebSocket] Failed to connect:', error);
      getStoreState().setWsStatus('error');
      scheduleReconnect();
    }
  }, [enabled, handleMessage, scheduleReconnect]);

  // Update connect ref after connect is defined
  connectRef.current = connect;

  // Send message through WebSocket
  const send = useCallback((message: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Cannot send message: not connected');
    }
  }, []);

  // Manual reconnect
  // Use connectRef to avoid depending on connect
  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    reconnectDelayRef.current = RECONNECT_DELAY_BASE;
    connectRef.current?.();
  }, []); // No dependencies - uses connectRef

  // Check connection status
  const isConnected = wsRef.current?.readyState === WebSocket.OPEN;

  // Connect on mount, cleanup on unmount
  useEffect(() => {
    // Reset mounted flag (needed after React Strict Mode remount)
    mountedRef.current = true;

    if (enabled) {
      connect();
    }

    // Listen for A2UI action events and send via WebSocket
    const handleA2UIAction = (event: CustomEvent) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(event.detail));
      } else {
        console.warn('[WebSocket] Cannot send A2UI action: not connected');
      }
    };

    // Type the event listener properly
    window.addEventListener('a2ui-action', handleA2UIAction as EventListener);

    return () => {
      // Mark as unmounted to prevent state updates in handleMessage
      mountedRef.current = false;

      window.removeEventListener('a2ui-action', handleA2UIAction as EventListener);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent onclose from triggering orphaned reconnect
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, connect]);

  return {
    isConnected,
    send,
    reconnect,
  };
}

export default useWebSocket;
