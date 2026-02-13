// ========================================
// useAudit Hooks
// ========================================
// TanStack Query hooks for audit/observability APIs

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { workspaceQueryKeys } from '@/lib/queryKeys';
import {
  fetchCliSessionAudit,
  type CliSessionAuditEventType,
  type CliSessionAuditListResponse,
} from '@/lib/api';

export interface UseCliSessionAuditOptions {
  sessionKey?: string;
  type?: CliSessionAuditEventType | CliSessionAuditEventType[];
  q?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

export function useCliSessionAudit(
  options: UseCliSessionAuditOptions = {}
): UseQueryResult<{ success: boolean; data: CliSessionAuditListResponse }> {
  const projectPath = useWorkflowStore(selectProjectPath);
  const enabled = (options.enabled ?? true) && !!projectPath;

  const typeParam = Array.isArray(options.type)
    ? options.type.join(',')
    : options.type;

  return useQuery({
    queryKey: projectPath
      ? workspaceQueryKeys.cliSessionAudit(projectPath, {
        sessionKey: options.sessionKey,
        type: typeParam,
        q: options.q,
        limit: options.limit,
        offset: options.offset,
      })
      : ['audit', 'cliSessions', 'no-project'],
    queryFn: () => fetchCliSessionAudit({
      projectPath: projectPath ?? undefined,
      sessionKey: options.sessionKey,
      type: options.type,
      q: options.q,
      limit: options.limit,
      offset: options.offset,
    }),
    enabled,
    staleTime: 10_000,
    retry: 1,
  });
}

