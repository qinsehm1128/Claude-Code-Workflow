// ========================================
// useFileExplorer Hook
// ========================================
// TanStack Query hooks for File Explorer with WebSocket subscription

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  fetchFileTree,
  fetchFileContent,
  fetchRootDirectories,
  searchFiles,
  type RootDirectory,
  type SearchFilesResponse,
} from '../lib/api';
import type { FileSystemNode, FileContent, ExplorerState } from '../types/file-explorer';

// Query key factory
export const fileExplorerKeys = {
  all: ['fileExplorer'] as const,
  trees: () => [...fileExplorerKeys.all, 'tree'] as const,
  tree: (rootPath: string) => [...fileExplorerKeys.trees(), rootPath] as const,
  contents: () => [...fileExplorerKeys.all, 'content'] as const,
  content: (path: string) => [...fileExplorerKeys.contents(), path] as const,
  roots: () => [...fileExplorerKeys.all, 'roots'] as const,
  search: (query: string) => [...fileExplorerKeys.all, 'search', query] as const,
};

// Default stale time: 5 minutes for file tree (stable structure)
const TREE_STALE_TIME = 5 * 60 * 1000;
// Default stale time: 10 minutes for file content
const CONTENT_STALE_TIME = 10 * 60 * 1000;

export interface UseFileExplorerOptions {
  /** Root directory path (default: '/') */
  rootPath?: string;
  /** Maximum tree depth (0 = unlimited) */
  maxDepth?: number;
  /** Include hidden files */
  includeHidden?: boolean;
  /** File patterns to exclude (glob patterns) */
  excludePatterns?: string[];
  /** Override default stale time (ms) */
  staleTime?: number;
  /** Enable/disable the query */
  enabled?: boolean;
}

export interface UseFileExplorerReturn {
  /** Current explorer state */
  state: ExplorerState;
  /** Root nodes of the file tree */
  rootNodes: FileSystemNode[];
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Fetching state (initial or refetch) */
  isFetching: boolean;
  /** Error object if query failed */
  error: Error | null;
  /** Manually refetch file tree */
  refetch: () => Promise<void>;
  /** Set the selected file path */
  setSelectedFile: (path: string | null) => void;
  /** Toggle directory expanded state */
  toggleExpanded: (path: string) => void;
  /** Expand a directory */
  expandDirectory: (path: string) => void;
  /** Collapse a directory */
  collapseDirectory: (path: string) => void;
  /** Expand all directories */
  expandAll: () => void;
  /** Collapse all directories */
  collapseAll: () => void;
  /** Set view mode */
  setViewMode: (mode: ExplorerState['viewMode']) => void;
  /** Set sort order */
  setSortOrder: (order: ExplorerState['sortOrder']) => void;
  /** Toggle hidden files visibility */
  toggleShowHidden: () => void;
  /** Set filter string */
  setFilter: (filter: string) => void;
  /** Load file content */
  loadFileContent: (path: string) => Promise<FileContent | undefined>;
  /** Available root directories */
  rootDirectories: RootDirectory[] | undefined;
  /** Root directories loading state */
  isLoadingRoots: boolean;
  /** Search files */
  searchFiles: (query: string) => Promise<SearchFilesResponse | undefined>;
  /** Search results */
  searchResults: SearchFilesResponse | undefined;
  /** Is searching */
  isSearching: boolean;
  /** Clear file content cache */
  clearFileCache: (path?: string) => void;
}

/**
 * Hook for File Explorer with WebSocket subscription for real-time updates
 *
 * @example
 * ```tsx
 * const { rootNodes, state, setSelectedFile, toggleExpanded } = useFileExplorer({
 *   rootPath: '/src'
 * });
 * ```
 */
export function useFileExplorer(options: UseFileExplorerOptions = {}): UseFileExplorerReturn {
  const {
    rootPath = '/',
    maxDepth = 5,
    // includeHidden is now controlled by internal showHiddenFiles state
    excludePatterns,
    staleTime,
    enabled = true,
  } = options;

  const queryClient = useQueryClient();

  // Explorer state
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set([rootPath]));
  const [selectedFile, setSelectedFileState] = useState<string | null>(null);
  const [viewMode, setViewModeState] = useState<ExplorerState['viewMode']>('tree');
  const [sortOrder, setSortOrderState] = useState<ExplorerState['sortOrder']>('name');
  const [showHiddenFiles, setShowHiddenFiles] = useState(false);
  const [filter, setFilterState] = useState('');
  const [searchResults, setSearchResults] = useState<SearchFilesResponse | undefined>();

  // Fetch file tree - use showHiddenFiles state instead of options.includeHidden
  const treeQuery = useQuery({
    queryKey: [...fileExplorerKeys.tree(rootPath), { showHidden: showHiddenFiles }],
    queryFn: () => fetchFileTree(rootPath, { maxDepth, includeHidden: showHiddenFiles, excludePatterns }),
    staleTime: staleTime ?? TREE_STALE_TIME,
    enabled,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // Fetch root directories
  const rootsQuery = useQuery({
    queryKey: fileExplorerKeys.roots(),
    queryFn: fetchRootDirectories,
    staleTime: TREE_STALE_TIME,
    enabled,
    retry: 1,
  });

  const rootNodes = treeQuery.data?.rootNodes ?? [];
  const rootDirectories = rootsQuery.data;

  // Toggle expanded state
  const toggleExpanded = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Expand directory
  const expandDirectory = useCallback((path: string) => {
    setExpandedPaths((prev) => new Set([...prev, path]));
  }, []);

  // Collapse directory
  const collapseDirectory = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, []);

  // Expand all directories
  const expandAll = useCallback(() => {
    const allPaths = new Set<string>();
    const collectPaths = (nodes: FileSystemNode[]) => {
      for (const node of nodes) {
        if (node.type === 'directory') {
          allPaths.add(node.path);
          if (node.children) {
            collectPaths(node.children);
          }
        }
      }
    };
    collectPaths(rootNodes);
    setExpandedPaths(allPaths);
  }, [rootNodes]);

  // Collapse all directories
  const collapseAll = useCallback(() => {
    setExpandedPaths(new Set([rootPath]));
  }, [rootPath]);

  // Set selected file
  const setSelectedFile = useCallback((path: string | null) => {
    setSelectedFileState(path);
    // Add to query cache for quick access
    if (path) {
      queryClient.prefetchQuery({
        queryKey: fileExplorerKeys.content(path),
        queryFn: () => fetchFileContent(path),
        staleTime: CONTENT_STALE_TIME,
      });
    }
  }, [queryClient]);

  // Set view mode
  const setViewMode = useCallback((mode: ExplorerState['viewMode']) => {
    setViewModeState(mode);
  }, []);

  // Set sort order
  const setSortOrder = useCallback((order: ExplorerState['sortOrder']) => {
    setSortOrderState(order);
  }, []);

  // Toggle hidden files
  const toggleShowHidden = useCallback(() => {
    setShowHiddenFiles((prev) => !prev);
  }, []);

  // Set filter
  const setFilter = useCallback((value: string) => {
    setFilterState(value);
  }, []);

  // Load file content
  const loadFileContent = useCallback(async (path: string) => {
    try {
      const content = await queryClient.fetchQuery({
        queryKey: fileExplorerKeys.content(path),
        queryFn: () => fetchFileContent(path),
        staleTime: CONTENT_STALE_TIME,
      });
      return content;
    } catch (error) {
      console.error(`[useFileExplorer] Failed to load file content: ${path}`, error);
      throw error;
    }
  }, [queryClient]);

  // Search files
  const searchFilesHandler = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults(undefined);
      return undefined;
    }
    try {
      const results = await queryClient.fetchQuery({
        queryKey: fileExplorerKeys.search(query),
        queryFn: () => searchFiles({ rootPath, query, maxResults: 100 }),
        staleTime: 60000, // 1 minute
      });
      setSearchResults(results);
      return results;
    } catch (error) {
      console.error('[useFileExplorer] Search failed:', error);
      throw error;
    }
  }, [queryClient, rootPath]);

  const isSearching = queryClient.isFetching({ queryKey: fileExplorerKeys.all }) > 0;

  // Clear file cache
  const clearFileCache = useCallback((path?: string) => {
    if (path) {
      queryClient.removeQueries({ queryKey: fileExplorerKeys.content(path) });
    } else {
      queryClient.removeQueries({ queryKey: fileExplorerKeys.contents() });
    }
  }, [queryClient]);

  // Refetch
  const refetch = async () => {
    await treeQuery.refetch();
  };

  // Build explorer state object
  const state: ExplorerState = {
    currentPath: rootPath,
    selectedFile,
    expandedPaths,
    fileTree: rootNodes,
    viewMode,
    sortOrder,
    showHiddenFiles,
    filter,
    isLoading: treeQuery.isLoading,
    error: treeQuery.error?.message ?? null,
    fileContents: {},
    recentFiles: [],
    maxRecentFiles: 10,
    directoriesFirst: true,
  };

  return {
    state,
    rootNodes,
    isLoading: treeQuery.isLoading,
    isFetching: treeQuery.isFetching,
    error: treeQuery.error,
    refetch,
    setSelectedFile,
    toggleExpanded,
    expandDirectory,
    collapseDirectory,
    expandAll,
    collapseAll,
    setViewMode,
    setSortOrder,
    toggleShowHidden,
    setFilter,
    loadFileContent,
    rootDirectories,
    isLoadingRoots: rootsQuery.isLoading,
    searchFiles: searchFilesHandler,
    searchResults,
    isSearching,
    clearFileCache,
  };
}

/**
 * Hook for file content with caching
 */
export function useFileContent(filePath: string | null, options: {
  enabled?: boolean;
  staleTime?: number;
} = {}) {
  const { enabled = true, staleTime = CONTENT_STALE_TIME } = options;

  const query = useQuery({
    queryKey: fileExplorerKeys.content(filePath ?? ''),
    queryFn: () => fetchFileContent(filePath ?? ''),
    staleTime,
    enabled: enabled && !!filePath,
    retry: 1,
  });

  return {
    content: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => query.refetch(),
  };
}

/**
 * WebSocket hook for real-time file updates
 *
 * @example
 * ```tsx
 * const { isConnected } = useFileExplorerWebSocket({
 *   onFileChanged: (path) => {
 *     console.log('File changed:', path);
 *     refetch();
 *   }
 * });
 * ```
 */
export interface UseFileExplorerWebSocketOptions {
  /** Enable WebSocket connection */
  enabled?: boolean;
  /** Callback when file changes */
  onFileChanged?: (path: string) => void;
  /** Callback when directory changes */
  onDirectoryChanged?: (path: string) => void;
}

export interface UseFileExplorerWebSocketReturn {
  /** WebSocket connection status */
  isConnected: boolean;
}

export function useFileExplorerWebSocket(
  options: UseFileExplorerWebSocketOptions = {}
): UseFileExplorerWebSocketReturn {
  const { enabled = true, onFileChanged, onDirectoryChanged } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    // Construct WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[FileExplorerWS] Connected');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle file system change events
          if (data.type === 'FILE_CHANGED') {
            const { path } = data.payload || {};
            if (path) {
              onFileChanged?.(path);
            }
          } else if (data.type === 'DIRECTORY_CHANGED') {
            const { path } = data.payload || {};
            if (path) {
              onDirectoryChanged?.(path);
            }
          }
        } catch (error) {
          console.error('[FileExplorerWS] Failed to parse message:', error);
        }
      };

      ws.onclose = () => {
        console.log('[FileExplorerWS] Disconnected');
        setIsConnected(false);
        wsRef.current = null;
      };

      ws.onerror = (error) => {
        console.error('[FileExplorerWS] Error:', error);
        setIsConnected(false);
      };
    } catch (error) {
      console.error('[FileExplorerWS] Failed to connect:', error);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, onFileChanged, onDirectoryChanged]);

  return { isConnected };
}

export default useFileExplorer;
