// ========================================
// useNativeSessionByPath Hook
// ========================================
// TanStack Query hook for native CLI session content by file path

import { useQuery } from '@tanstack/react-query';
import {
  fetchNativeSessionWithOptions,
  type NativeSession,
} from '../lib/api';

// ========== Query Keys ==========

export const nativeSessionPathKeys = {
  all: ['nativeSessionPath'] as const,
  details: () => [...nativeSessionPathKeys.all, 'detail'] as const,
  detail: (filePath: string | null) => [...nativeSessionPathKeys.details(), filePath] as const,
};

// ========== Constants ==========

const STALE_TIME = 5 * 60 * 1000;  // 5 minutes
const GC_TIME = 30 * 60 * 1000;    // 30 minutes

// ========== Types ==========

export interface UseNativeSessionByPathOptions {
  staleTime?: number;
  gcTime?: number;
  enabled?: boolean;
}

export interface UseNativeSessionByPathReturn {
  data: NativeSession | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// ========== Hook ==========

/**
 * Hook for fetching native CLI session content by file path
 *
 * @param filePath - The file path to the session file
 * @param tool - The tool type (gemini, qwen, codex, claude, opencode)
 * @param options - Query options
 */
export function useNativeSessionByPath(
  filePath: string | null,
  tool?: string,
  options: UseNativeSessionByPathOptions = {}
): UseNativeSessionByPathReturn {
  const { staleTime = STALE_TIME, gcTime = GC_TIME, enabled = true } = options;

  const query = useQuery<NativeSession>({
    queryKey: nativeSessionPathKeys.detail(filePath),
    queryFn: () => {
      if (!filePath) throw new Error('filePath is required');
      return fetchNativeSessionWithOptions({
        filePath,
        tool: tool as 'gemini' | 'qwen' | 'codex' | 'claude' | 'opencode' | undefined,
      }) as Promise<NativeSession>;
    },
    enabled: !!filePath && enabled,
    staleTime,
    gcTime,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  const refetch = async () => {
    await query.refetch();
  };

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch,
  };
}
