// ========================================
// useGraphData Hook
// ========================================
// TanStack Query hooks for Graph Explorer with data transformation

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchGraphDependencies,
  fetchGraphImpact,
  type GraphDependenciesRequest,
  type GraphDependenciesResponse,
} from '../lib/api';
import type {
  GraphData,
  GraphFilters,
  NodeType,
  EdgeType,
} from '../types/graph-explorer';

// Query key factory
export const graphKeys = {
  all: ['graph'] as const,
  dependencies: () => [...graphKeys.all, 'dependencies'] as const,
  dependency: (request: GraphDependenciesRequest) => [...graphKeys.dependencies(), request] as const,
  impact: (nodeId: string) => [...graphKeys.all, 'impact', nodeId] as const,
};

// Default stale time: 5 minutes (graph data doesn't change frequently)
const STALE_TIME = 5 * 60 * 1000;

export interface UseGraphDataOptions {
  /** Override default stale time (ms) */
  staleTime?: number;
  /** Enable/disable the query */
  enabled?: boolean;
  /** Root path for analysis */
  rootPath?: string;
  /** Maximum depth for traversal */
  maxDepth?: number;
  /** Filter by node types */
  nodeTypes?: NodeType[];
  /** Filter by edge types */
  edgeTypes?: EdgeType[];
}

export interface UseGraphDataReturn {
  /** Graph data with nodes and edges */
  graphData: GraphData | undefined;
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Fetching state (initial or refetch) */
  isFetching: boolean;
  /** Error object if query failed */
  error: Error | null;
  /** Manually refetch data */
  refetch: () => Promise<void>;
  /** Invalidate and refetch graph data */
  invalidate: () => Promise<void>;
  /** Apply filters to graph data */
  applyFilters: (filters: GraphFilters) => GraphData | undefined;
}

/**
 * Transform API response to GraphData format
 */
function transformToGraphData(response: GraphDependenciesResponse): GraphData {
  return {
    nodes: response.nodes,
    edges: response.edges,
    metadata: response.metadata,
  };
}

/**
 * Apply filters to graph data
 */
function filterGraphData(
  graphData: GraphData | undefined,
  filters: GraphFilters
): GraphData | undefined {
  if (!graphData) return undefined;

  let filteredNodes = [...graphData.nodes];
  let filteredEdges = [...graphData.edges];

  // Filter by node types
  if (filters.nodeTypes && filters.nodeTypes.length > 0) {
    const nodeTypeSet = new Set(filters.nodeTypes);
    filteredNodes = filteredNodes.filter(node => node.type && nodeTypeSet.has(node.type));
  }

  // Filter by edge types
  if (filters.edgeTypes && filters.edgeTypes.length > 0) {
    const edgeTypeSet = new Set(filters.edgeTypes);
    filteredEdges = filteredEdges.filter(edge => edge.data?.edgeType && edgeTypeSet.has(edge.data.edgeType));
  }

  // Filter by search query
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    filteredNodes = filteredNodes.filter(node =>
      node.data.label.toLowerCase().includes(query) ||
      node.data.filePath?.toLowerCase().includes(query)
    );
  }

  // Filter by file path pattern
  if (filters.filePathPattern) {
    const pattern = new RegExp(filters.filePathPattern, 'i');
    filteredNodes = filteredNodes.filter(node =>
      node.data.filePath?.match(pattern)
    );
  }

  // Filter by categories
  if (filters.categories && filters.categories.length > 0) {
    const categorySet = new Set(filters.categories);
    filteredNodes = filteredNodes.filter(node =>
      node.data.category && categorySet.has(node.data.category)
    );
  }

  // Filter only nodes with issues
  if (filters.showOnlyIssues) {
    filteredNodes = filteredNodes.filter(node => node.data.hasIssues);
  }

  // Filter by minimum complexity
  if (filters.minComplexity !== undefined) {
    filteredNodes = filteredNodes.filter(_node => {
      // This would require complexity data to be available
      // For now, we'll skip this filter
      return true;
    });
  }

  // Filter by tags
  if (filters.tags && filters.tags.length > 0) {
    const tagSet = new Set(filters.tags);
    filteredNodes = filteredNodes.filter(node =>
      node.data.tags?.some(tag => tagSet.has(tag))
    );
  }

  // Exclude tags
  if (filters.excludeTags && filters.excludeTags.length > 0) {
    const excludeTagSet = new Set(filters.excludeTags);
    filteredNodes = filteredNodes.filter(node =>
      !node.data.tags?.some(tag => excludeTagSet.has(tag))
    );
  }

  // Show/hide isolated nodes
  if (!filters.showIsolatedNodes) {
    const connectedNodeIds = new Set<string>();
    filteredEdges.forEach(edge => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });
    filteredNodes = filteredNodes.filter(node => connectedNodeIds.has(node.id));
  }

  // Build set of visible node IDs
  const visibleNodeIds = new Set(filteredNodes.map(node => node.id));

  // Filter edges to only include edges between visible nodes
  filteredEdges = filteredEdges.filter(edge =>
    visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
  );

  // Apply max depth filter (focus on specific node)
  if (filters.focusNodeId) {
    const focusNode = filteredNodes.find(n => n.id === filters.focusNodeId);
    if (focusNode) {
      // Collect nodes within max depth
      const nodesWithinDepth = new Set<string>([filters.focusNodeId]);
      const visited = new Set<string>();

      const traverse = (nodeId: string, depth: number) => {
        if (depth > (filters.maxDepth || 3)) return;
        if (visited.has(nodeId)) return;
        visited.add(nodeId);

        filteredEdges.forEach(edge => {
          if (edge.source === nodeId && !nodesWithinDepth.has(edge.target)) {
            nodesWithinDepth.add(edge.target);
            traverse(edge.target, depth + 1);
          }
          if (edge.target === nodeId && !nodesWithinDepth.has(edge.source)) {
            nodesWithinDepth.add(edge.source);
            traverse(edge.source, depth + 1);
          }
        });
      };

      traverse(filters.focusNodeId, 0);

      filteredNodes = filteredNodes.filter(node => nodesWithinDepth.has(node.id));
      const depthNodeIds = new Set(nodesWithinDepth);
      filteredEdges = filteredEdges.filter(edge =>
        depthNodeIds.has(edge.source) && depthNodeIds.has(edge.target)
      );
    }
  }

  return {
    nodes: filteredNodes,
    edges: filteredEdges,
    metadata: graphData.metadata,
  };
}

/**
 * Hook for fetching and filtering graph data
 *
 * @example
 * ```tsx
 * const { graphData, isLoading, applyFilters } = useGraphData({
 *   rootPath: '/src',
 *   maxDepth: 3
 * });
 *
 * // Apply filters
 * const filteredData = applyFilters({
 *   nodeTypes: ['component', 'hook'],
 *   edgeTypes: ['imports', 'uses']
 * });
 * ```
 */
export function useGraphData(options: UseGraphDataOptions = {}): UseGraphDataReturn {
  const {
    staleTime = STALE_TIME,
    enabled = true,
    rootPath,
    maxDepth,
    nodeTypes,
  } = options;

  const queryClient = useQueryClient();

  const request: GraphDependenciesRequest = {
    rootPath,
    maxDepth,
    includeTypes: nodeTypes,
  };

  const query = useQuery({
    queryKey: graphKeys.dependency(request),
    queryFn: () => fetchGraphDependencies(request),
    staleTime,
    enabled,
    retry: 2,
    select: transformToGraphData,
  });

  const refetch = async () => {
    await query.refetch();
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: graphKeys.all });
  };

  const applyFilters = (filters: GraphFilters) => {
    return filterGraphData(query.data, filters);
  };

  return {
    graphData: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch,
    invalidate,
    applyFilters,
  };
}

/**
 * Hook for fetching impact analysis for a specific node
 */
export function useGraphImpact(
  nodeId: string | null,
  options: {
    direction?: 'upstream' | 'downstream' | 'both';
    maxDepth?: number;
    enabled?: boolean;
  } = {}
) {
  const { direction = 'both', maxDepth = 3, enabled = true } = options;

  return useQuery({
    queryKey: graphKeys.impact(nodeId || ''),
    queryFn: () => {
      if (!nodeId) throw new Error('Node ID is required');
      return fetchGraphImpact({ nodeId, direction, maxDepth });
    },
    enabled: enabled && !!nodeId,
    staleTime: STALE_TIME,
    retry: 1,
  });
}
