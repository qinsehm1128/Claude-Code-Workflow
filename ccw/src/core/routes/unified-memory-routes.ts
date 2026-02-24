/**
 * Unified Memory API Routes
 *
 * Provides HTTP endpoints for the unified memory system:
 * - GET  /api/unified-memory/search          - RRF fusion search (vector + FTS5)
 * - GET  /api/unified-memory/stats           - Aggregated statistics
 * - POST /api/unified-memory/reindex         - Rebuild HNSW vector index
 * - GET  /api/unified-memory/recommendations/:id - KNN recommendations
 */

import type { RouteContext } from './types.js';

/**
 * Handle Unified Memory API routes.
 * @returns true if route was handled, false otherwise
 */
export async function handleUnifiedMemoryRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, url, req, res, initialPath, handlePostRequest } = ctx;

  // =========================================================================
  // GET /api/unified-memory/search
  // Query params: q (required), categories, topK, minScore
  // =========================================================================
  if (pathname === '/api/unified-memory/search' && req.method === 'GET') {
    const query = url.searchParams.get('q');
    const projectPath = url.searchParams.get('path') || initialPath;
    const topK = parseInt(url.searchParams.get('topK') || '20', 10);
    const minScore = parseFloat(url.searchParams.get('minScore') || '0');
    const category = url.searchParams.get('category') || undefined;

    if (!query) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Query parameter q is required' }));
      return true;
    }

    try {
      const { UnifiedMemoryService } = await import('../unified-memory-service.js');
      const service = new UnifiedMemoryService(projectPath);

      const results = await service.search(query, {
        limit: topK,
        minScore,
        category: category as any,
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        query,
        total: results.length,
        results,
      }));
    } catch (error: unknown) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (error as Error).message }));
    }
    return true;
  }

  // =========================================================================
  // GET /api/unified-memory/stats
  // =========================================================================
  if (pathname === '/api/unified-memory/stats' && req.method === 'GET') {
    const projectPath = url.searchParams.get('path') || initialPath;

    try {
      const { UnifiedMemoryService } = await import('../unified-memory-service.js');
      const service = new UnifiedMemoryService(projectPath);
      const stats = await service.getStats();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, stats }));
    } catch (error: unknown) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (error as Error).message }));
    }
    return true;
  }

  // =========================================================================
  // POST /api/unified-memory/reindex
  // Body (optional): { path: string }
  // =========================================================================
  if (pathname === '/api/unified-memory/reindex' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: any) => {
      const { path: projectPath } = body || {};
      const basePath = projectPath || initialPath;

      try {
        const { UnifiedVectorIndex, isUnifiedEmbedderAvailable } = await import('../unified-vector-index.js');

        if (!isUnifiedEmbedderAvailable()) {
          return {
            error: 'Unified embedder is not available. Ensure Python venv and embedder script are set up.',
            status: 503,
          };
        }

        const index = new UnifiedVectorIndex(basePath);
        const result = await index.reindexAll();

        return {
          success: result.success,
          hnsw_count: result.hnsw_count,
          elapsed_time: result.elapsed_time,
          error: result.error,
        };
      } catch (error: unknown) {
        return { error: (error as Error).message, status: 500 };
      }
    });
    return true;
  }

  // =========================================================================
  // GET /api/unified-memory/recommendations/:id
  // Query params: limit (optional, default 5)
  // =========================================================================
  if (pathname.startsWith('/api/unified-memory/recommendations/') && req.method === 'GET') {
    const memoryId = pathname.replace('/api/unified-memory/recommendations/', '');
    const projectPath = url.searchParams.get('path') || initialPath;
    const limit = parseInt(url.searchParams.get('limit') || '5', 10);

    if (!memoryId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Memory ID is required' }));
      return true;
    }

    try {
      const { UnifiedMemoryService } = await import('../unified-memory-service.js');
      const service = new UnifiedMemoryService(projectPath);
      const recommendations = await service.getRecommendations(memoryId, limit);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        memory_id: memoryId,
        total: recommendations.length,
        recommendations,
      }));
    } catch (error: unknown) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (error as Error).message }));
    }
    return true;
  }

  return false;
}
