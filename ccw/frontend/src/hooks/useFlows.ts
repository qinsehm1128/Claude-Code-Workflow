// ========================================
// useFlows Hook
// ========================================
// TanStack Query hooks for flow API operations

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Flow } from '../types/flow';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';

// API base URL
const API_BASE = '/api/orchestrator';

function withPath(url: string, projectPath?: string | null): string {
  const p = typeof projectPath === 'string' ? projectPath.trim() : '';
  if (!p) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}path=${encodeURIComponent(p)}`;
}

// Query keys
export const flowKeys = {
  all: ['flows'] as const,
  lists: () => [...flowKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...flowKeys.lists(), filters] as const,
  details: () => [...flowKeys.all, 'detail'] as const,
  detail: (id: string) => [...flowKeys.details(), id] as const,
  executions: () => [...flowKeys.all, 'execution'] as const,
  executionState: (execId: string) => [...flowKeys.executions(), 'state', execId] as const,
  executionLogs: (execId: string, options?: Record<string, unknown>) => [...flowKeys.executions(), 'logs', execId, options] as const,
};

// API response types
interface FlowsListResponse {
  flows: Flow[];
  total: number;
}

interface ExecutionStartResponse {
  execId: string;
  flowId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  startedAt: string;
}

interface ExecutionControlResponse {
  execId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  message: string;
}

// ========== Fetch Functions ==========

async function fetchFlows(): Promise<FlowsListResponse> {
  const response = await fetch(`${API_BASE}/flows`, { credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error(`Failed to fetch flows: ${response.statusText}`);
  }
  const json = await response.json();
  const flows = Array.isArray(json?.data) ? json.data : (json?.flows || []);
  const total = typeof json?.total === 'number' ? json.total : flows.length;
  return { flows, total };
}

async function fetchFlow(id: string): Promise<Flow> {
  const response = await fetch(`${API_BASE}/flows/${id}`, { credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error(`Failed to fetch flow: ${response.statusText}`);
  }
  const json = await response.json();
  return (json && typeof json === 'object' && 'data' in json) ? json.data : json;
}

async function createFlow(flow: Omit<Flow, 'id' | 'created_at' | 'updated_at'>): Promise<Flow> {
  const response = await fetch(`${API_BASE}/flows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(flow),
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(`Failed to create flow: ${response.statusText}`);
  }
  const json = await response.json();
  return (json && typeof json === 'object' && 'data' in json) ? json.data : json;
}

async function updateFlow(id: string, flow: Partial<Flow>): Promise<Flow> {
  const response = await fetch(`${API_BASE}/flows/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(flow),
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(`Failed to update flow: ${response.statusText}`);
  }
  const json = await response.json();
  return (json && typeof json === 'object' && 'data' in json) ? json.data : json;
}

async function deleteFlow(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/flows/${id}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete flow: ${response.statusText}`);
  }
}

async function duplicateFlow(id: string): Promise<Flow> {
  const response = await fetch(`${API_BASE}/flows/${id}/duplicate`, {
    method: 'POST',
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(`Failed to duplicate flow: ${response.statusText}`);
  }
  const json = await response.json();
  return (json && typeof json === 'object' && 'data' in json) ? json.data : json;
}

// ========== Execution Functions ==========

async function executeFlow(flowId: string, projectPath?: string | null): Promise<ExecutionStartResponse> {
  const response = await fetch(withPath(`${API_BASE}/flows/${flowId}/execute`, projectPath), {
    method: 'POST',
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(`Failed to execute flow: ${response.statusText}`);
  }
  const json = await response.json();
  return (json && typeof json === 'object' && 'data' in json) ? json.data : json;
}

async function pauseExecution(execId: string, projectPath?: string | null): Promise<ExecutionControlResponse> {
  const response = await fetch(withPath(`${API_BASE}/executions/${execId}/pause`, projectPath), {
    method: 'POST',
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(`Failed to pause execution: ${response.statusText}`);
  }
  const json = await response.json();
  if (json?.data?.id) {
    return { execId: json.data.id, status: json.data.status, message: json.message || 'Execution paused' };
  }
  return json;
}

async function resumeExecution(execId: string, projectPath?: string | null): Promise<ExecutionControlResponse> {
  const response = await fetch(withPath(`${API_BASE}/executions/${execId}/resume`, projectPath), {
    method: 'POST',
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(`Failed to resume execution: ${response.statusText}`);
  }
  const json = await response.json();
  if (json?.data?.id) {
    return { execId: json.data.id, status: json.data.status, message: json.message || 'Execution resumed' };
  }
  return json;
}

async function stopExecution(execId: string, projectPath?: string | null): Promise<ExecutionControlResponse> {
  const response = await fetch(withPath(`${API_BASE}/executions/${execId}/stop`, projectPath), {
    method: 'POST',
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(`Failed to stop execution: ${response.statusText}`);
  }
  const json = await response.json();
  if (json?.data?.id) {
    return { execId: json.data.id, status: json.data.status, message: json.message || 'Execution stopped' };
  }
  return json;
}

// ========== Query Hooks ==========

/**
 * Fetch all flows
 */
export function useFlows() {
  return useQuery({
    queryKey: flowKeys.lists(),
    queryFn: fetchFlows,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Fetch a single flow by ID
 */
export function useFlow(id: string | null) {
  return useQuery({
    queryKey: flowKeys.detail(id ?? ''),
    queryFn: () => fetchFlow(id!),
    enabled: !!id,
    staleTime: 30000,
  });
}

// ========== Mutation Hooks ==========

/**
 * Create a new flow
 */
export function useCreateFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createFlow,
    onSuccess: (newFlow) => {
      // Optimistically add to list
      queryClient.setQueryData<FlowsListResponse>(flowKeys.lists(), (old) => {
        if (!old) return { flows: [newFlow], total: 1 };
        return {
          flows: [...old.flows, newFlow],
          total: old.total + 1,
        };
      });
      // Invalidate to refetch
      queryClient.invalidateQueries({ queryKey: flowKeys.lists() });
    },
  });
}

/**
 * Update an existing flow
 */
export function useUpdateFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, flow }: { id: string; flow: Partial<Flow> }) => updateFlow(id, flow),
    onSuccess: (updatedFlow) => {
      // Update in cache
      queryClient.setQueryData<Flow>(flowKeys.detail(updatedFlow.id), updatedFlow);
      queryClient.setQueryData<FlowsListResponse>(flowKeys.lists(), (old) => {
        if (!old) return old;
        return {
          ...old,
          flows: old.flows.map((f) => (f.id === updatedFlow.id ? updatedFlow : f)),
        };
      });
    },
  });
}

/**
 * Delete a flow
 */
export function useDeleteFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteFlow,
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: flowKeys.detail(deletedId) });
      queryClient.setQueryData<FlowsListResponse>(flowKeys.lists(), (old) => {
        if (!old) return old;
        return {
          flows: old.flows.filter((f) => f.id !== deletedId),
          total: old.total - 1,
        };
      });
    },
  });
}

/**
 * Duplicate a flow
 */
export function useDuplicateFlow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: duplicateFlow,
    onSuccess: (newFlow) => {
      // Add to list
      queryClient.setQueryData<FlowsListResponse>(flowKeys.lists(), (old) => {
        if (!old) return { flows: [newFlow], total: 1 };
        return {
          flows: [...old.flows, newFlow],
          total: old.total + 1,
        };
      });
      queryClient.invalidateQueries({ queryKey: flowKeys.lists() });
    },
  });
}

// ========== Execution Mutation Hooks ==========

/**
 * Execute a flow
 */
export function useExecuteFlow() {
  const projectPath = useWorkflowStore(selectProjectPath);
  return useMutation({
    mutationFn: (flowId: string) => executeFlow(flowId, projectPath),
  });
}

/**
 * Pause execution
 */
export function usePauseExecution() {
  const projectPath = useWorkflowStore(selectProjectPath);
  return useMutation({
    mutationFn: (execId: string) => pauseExecution(execId, projectPath),
  });
}

/**
 * Resume execution
 */
export function useResumeExecution() {
  const projectPath = useWorkflowStore(selectProjectPath);
  return useMutation({
    mutationFn: (execId: string) => resumeExecution(execId, projectPath),
  });
}

/**
 * Stop execution
 */
export function useStopExecution() {
  const projectPath = useWorkflowStore(selectProjectPath);
  return useMutation({
    mutationFn: (execId: string) => stopExecution(execId, projectPath),
  });
}

// ========== Execution Monitoring Fetch Functions ==========

async function fetchExecutionStateById(
  execId: string,
  projectPath?: string | null
): Promise<{ success: boolean; data: { execId: string; flowId: string; status: string; currentNodeId?: string; startedAt: string; completedAt?: string; elapsedMs: number } }> {
  const response = await fetch(withPath(`${API_BASE}/executions/${execId}`, projectPath), { credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error(`Failed to fetch execution state: ${response.statusText}`);
  }
  return response.json();
}

async function fetchExecutionLogsById(
  execId: string,
  options?: {
    limit?: number;
    offset?: number;
    level?: string;
    nodeId?: string;
  },
  projectPath?: string | null
): Promise<{ success: boolean; data: { execId: string; logs: unknown[]; total: number; limit: number; offset: number; hasMore: boolean } }> {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', String(options.limit));
  if (options?.offset) params.append('offset', String(options.offset));
  if (options?.level) params.append('level', options.level);
  if (options?.nodeId) params.append('nodeId', options.nodeId);

  const queryString = params.toString();
  const url = withPath(
    `${API_BASE}/executions/${execId}/logs${queryString ? `?${queryString}` : ''}`,
    projectPath
  );
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error(`Failed to fetch execution logs: ${response.statusText}`);
  }
  return response.json();
}

// ========== Execution Monitoring Query Hooks ==========

/**
 * Fetch execution state
 * Uses useQuery to get execution state, enabled when execId exists
 */
export function useExecutionState(execId: string | null) {
  const projectPath = useWorkflowStore(selectProjectPath);
  return useQuery({
    queryKey: [...flowKeys.executionState(execId ?? ''), projectPath],
    queryFn: () => fetchExecutionStateById(execId!, projectPath),
    enabled: !!execId,
    staleTime: 5000, // 5 seconds - needs more frequent updates for monitoring
  });
}

/**
 * Fetch execution logs with pagination
 * Uses useQuery to get execution logs with pagination support
 */
export function useExecutionLogs(
  execId: string | null,
  options?: {
    limit?: number;
    offset?: number;
    level?: string;
    nodeId?: string;
  }
) {
  const projectPath = useWorkflowStore(selectProjectPath);
  return useQuery({
    queryKey: [...flowKeys.executionLogs(execId ?? '', options), projectPath],
    queryFn: () => fetchExecutionLogsById(execId!, options, projectPath),
    enabled: !!execId,
    staleTime: 10000, // 10 seconds
  });
}
