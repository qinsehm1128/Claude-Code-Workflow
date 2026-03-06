// ========================================
// useDeepWiki Hook
// ========================================
// TanStack Query hooks for DeepWiki documentation system

import { useQuery } from '@tanstack/react-query';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';

// Types
export interface DeepWikiFile {
  id?: number;
  path: string;
  contentHash: string;
  lastIndexed: string;
  symbolsCount: number;
  docsGenerated: boolean;
}

export interface DeepWikiSymbol {
  id?: number;
  name: string;
  type: string;
  sourceFile: string;
  docFile: string;
  anchor: string;
  lineRange: [number, number];
  createdAt?: string;
  updatedAt?: string;
}

export interface DeepWikiDoc {
  id?: number;
  path: string;
  contentHash: string;
  symbols: string[];
  generatedAt: string;
  llmTool?: string;
}

export interface DeepWikiStats {
  available: boolean;
  files: number;
  symbols: number;
  docs: number;
  filesNeedingDocs?: number;
  dbPath?: string;
}

export interface DocumentResponse {
  doc: DeepWikiDoc | null;
  content: string;
  symbols: DeepWikiSymbol[];
}

// Query key factory
export const deepWikiKeys = {
  all: ['deepWiki'] as const,
  files: (projectPath: string) => [...deepWikiKeys.all, 'files', projectPath] as const,
  doc: (path: string) => [...deepWikiKeys.all, 'doc', path] as const,
  stats: (projectPath: string) => [...deepWikiKeys.all, 'stats', projectPath] as const,
  search: (query: string) => [...deepWikiKeys.all, 'search', query] as const,
};

// Default stale time: 2 minutes
const STALE_TIME = 2 * 60 * 1000;

/**
 * Fetch list of documented files
 */
async function fetchDeepWikiFiles(): Promise<DeepWikiFile[]> {
  const response = await fetch('/api/deepwiki/files');
  if (!response.ok) {
    throw new Error(`Failed to fetch files: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch document by source file path
 */
async function fetchDeepWikiDoc(filePath: string): Promise<DocumentResponse> {
  const response = await fetch(`/api/deepwiki/doc?path=${encodeURIComponent(filePath)}`);
  if (!response.ok) {
    if (response.status === 404) {
      return { doc: null, content: '', symbols: [] };
    }
    throw new Error(`Failed to fetch document: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch DeepWiki statistics
 */
async function fetchDeepWikiStats(): Promise<DeepWikiStats> {
  const response = await fetch('/api/deepwiki/stats');
  if (!response.ok) {
    throw new Error(`Failed to fetch stats: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Search symbols by query
 */
async function searchDeepWikiSymbols(query: string, limit = 50): Promise<DeepWikiSymbol[]> {
  const response = await fetch(`/api/deepwiki/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  if (!response.ok) {
    throw new Error(`Failed to search symbols: ${response.statusText}`);
  }
  return response.json();
}

// ========== Hooks ==========

export interface UseDeepWikiFilesOptions {
  staleTime?: number;
  enabled?: boolean;
}

export interface UseDeepWikiFilesReturn {
  files: DeepWikiFile[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching list of documented files
 */
export function useDeepWikiFiles(options: UseDeepWikiFilesOptions = {}): UseDeepWikiFilesReturn {
  const { staleTime = STALE_TIME, enabled = true } = options;
  const projectPath = useWorkflowStore(selectProjectPath);

  const query = useQuery({
    queryKey: deepWikiKeys.files(projectPath ?? ''),
    queryFn: fetchDeepWikiFiles,
    staleTime,
    enabled: enabled && !!projectPath,
    retry: 2,
  });

  return {
    files: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: async () => {
      await query.refetch();
    },
  };
}

export interface UseDeepWikiDocOptions {
  staleTime?: number;
  enabled?: boolean;
}

export interface UseDeepWikiDocReturn {
  doc: DeepWikiDoc | null;
  content: string;
  symbols: DeepWikiSymbol[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching a document by source file path
 */
export function useDeepWikiDoc(filePath: string | null, options: UseDeepWikiDocOptions = {}): UseDeepWikiDocReturn {
  const { staleTime = STALE_TIME, enabled = true } = options;

  const query = useQuery({
    queryKey: deepWikiKeys.doc(filePath ?? ''),
    queryFn: () => fetchDeepWikiDoc(filePath!),
    staleTime,
    enabled: enabled && !!filePath,
    retry: 2,
  });

  return {
    doc: query.data?.doc ?? null,
    content: query.data?.content ?? '',
    symbols: query.data?.symbols ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: async () => {
      await query.refetch();
    },
  };
}

export interface UseDeepWikiStatsOptions {
  staleTime?: number;
  enabled?: boolean;
}

export interface UseDeepWikiStatsReturn {
  stats: DeepWikiStats | null;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching DeepWiki statistics
 */
export function useDeepWikiStats(options: UseDeepWikiStatsOptions = {}): UseDeepWikiStatsReturn {
  const { staleTime = STALE_TIME, enabled = true } = options;
  const projectPath = useWorkflowStore(selectProjectPath);

  const query = useQuery({
    queryKey: deepWikiKeys.stats(projectPath ?? ''),
    queryFn: fetchDeepWikiStats,
    staleTime,
    enabled: enabled && !!projectPath,
    retry: 2,
  });

  return {
    stats: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: async () => {
      await query.refetch();
    },
  };
}

export interface UseDeepWikiSearchOptions {
  limit?: number;
  staleTime?: number;
  enabled?: boolean;
}

export interface UseDeepWikiSearchReturn {
  symbols: DeepWikiSymbol[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for searching symbols
 */
export function useDeepWikiSearch(query: string, options: UseDeepWikiSearchOptions = {}): UseDeepWikiSearchReturn {
  const { limit = 50, staleTime = STALE_TIME, enabled = true } = options;

  const queryResult = useQuery({
    queryKey: deepWikiKeys.search(query),
    queryFn: () => searchDeepWikiSymbols(query, limit),
    staleTime,
    enabled: enabled && query.length > 0,
    retry: 2,
  });

  return {
    symbols: queryResult.data ?? [],
    isLoading: queryResult.isLoading,
    isFetching: queryResult.isFetching,
    error: queryResult.error,
    refetch: async () => {
      await queryResult.refetch();
    },
  };
}
