// ========================================
// Orchestrator Execution Hooks
// ========================================
// React Query hooks for executing flows in terminal sessions.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useExecutionMonitorStore } from '@/stores/executionMonitorStore';
import { toast } from '@/stores/notificationStore';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';

// ========== Types ==========

export interface SessionConfig {
  tool?: 'claude' | 'gemini' | 'qwen' | 'codex' | 'opencode';
  model?: string;
  preferredShell?: 'bash' | 'pwsh' | 'cmd';
}

export interface ExecuteInSessionRequest {
  sessionConfig?: SessionConfig;
  sessionKey?: string;
  variables?: Record<string, unknown>;
  stepTimeout?: number;
  errorStrategy?: 'pause' | 'skip' | 'stop';
}

export interface ExecuteInSessionResponse {
  success: boolean;
  data: {
    executionId: string;
    flowId: string;
    sessionKey: string;
    status: 'pending' | 'running';
    totalSteps: number;
    startedAt: string;
  };
  error?: string;
}

// ========== Helper ==========

function withPath(url: string, projectPath?: string | null): string {
  const p = typeof projectPath === 'string' ? projectPath.trim() : '';
  if (!p) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}path=${encodeURIComponent(p)}`;
}

// ========== Hook ==========

export function useExecuteFlowInSession() {
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);
  const handleExecutionMessage = useExecutionMonitorStore((s) => s.handleExecutionMessage);
  const setPanelOpen = useExecutionMonitorStore((s) => s.setPanelOpen);

  return useMutation({
    mutationFn: async (params: {
      flowId: string;
      sessionConfig?: SessionConfig;
      sessionKey?: string;
    }): Promise<ExecuteInSessionResponse> => {
      const url = withPath(`/api/orchestrator/flows/${params.flowId}/execute-in-session`, projectPath);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionConfig: params.sessionConfig,
          sessionKey: params.sessionKey,
        }),
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        const { executionId, flowId, sessionKey, startedAt } = data.data;

        // Initialize execution in store
        handleExecutionMessage({
          type: 'EXECUTION_STARTED',
          payload: {
            executionId,
            flowId,
            sessionKey,
            stepName: flowId,
            timestamp: startedAt,
          },
        });

        // Note: Session locking is handled by backend WebSocket broadcast (CLI_SESSION_LOCKED)
        // Frontend sessionManagerStore updates state via WebSocket message handler

        // Open the execution monitor panel
        setPanelOpen(true);

        // Update query cache
        queryClient.setQueryData(['activeExecution'], data.data);
      }
    },
    onError: (error) => {
      console.error('[ExecuteFlowInSession] Error:', error);
      toast.error(
        'Execution Failed',
        'Could not start workflow execution in terminal session.'
      );
    },
  });
}

// ========== Session Lock Hooks ==========

export function useLockSession() {
  return useMutation({
    mutationFn: async (params: {
      sessionKey: string;
      reason: string;
      executionId?: string;
    }) => {
      const response = await fetch(`/api/sessions/${params.sessionKey}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: params.reason, executionId: params.executionId }),
      });
      return response.json();
    },
  });
}

export function useUnlockSession() {
  return useMutation({
    mutationFn: async (sessionKey: string) => {
      const response = await fetch(`/api/sessions/${sessionKey}/unlock`, {
        method: 'POST',
      });
      return response.json();
    },
  });
}

// ========== Flow to Session Conversion Hook ==========

export function usePrepareFlowForExecution() {
  const projectPath = useWorkflowStore(selectProjectPath);

  return useMutation({
    mutationFn: async (flowId: string) => {
      const url = withPath(`/api/orchestrator/flows/${flowId}`, projectPath);
      const response = await fetch(url);
      return response.json();
    },
  });
}
