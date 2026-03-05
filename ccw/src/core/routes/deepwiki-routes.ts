/**
 * DeepWiki Routes Module
 * Handles all DeepWiki documentation API endpoints.
 *
 * Endpoints:
 * - GET /api/deepwiki/files - List all documented files
 * - GET /api/deepwiki/doc?path=<filePath> - Get document with symbols
 * - GET /api/deepwiki/stats - Get storage statistics
 * - GET /api/deepwiki/search?q=<query> - Search symbols
 */

import type { RouteContext } from './types.js';
import { getDeepWikiService } from '../../services/deepwiki-service.js';

/**
 * Handle DeepWiki routes
 * @returns true if route was handled, false otherwise
 */
export async function handleDeepWikiRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, url, res } = ctx;

  // GET /api/deepwiki/files - List all documented files
  if (pathname === '/api/deepwiki/files') {
    try {
      const service = getDeepWikiService();

      // Return empty array if database not available (not an error)
      if (!service.isAvailable()) {
        console.log('[DeepWiki] Database not available, returning empty files list');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([]));
        return true;
      }

      const files = service.listDocumentedFiles();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(files));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[DeepWiki] Error listing files:', message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
    }
    return true;
  }

  // GET /api/deepwiki/doc?path=<filePath> - Get document with symbols
  if (pathname === '/api/deepwiki/doc') {
    const filePath = url.searchParams.get('path');

    if (!filePath) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'path parameter is required' }));
      return true;
    }

    try {
      const service = getDeepWikiService();

      // Return 404 if database not available
      if (!service.isAvailable()) {
        console.log('[DeepWiki] Database not available');
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'DeepWiki database not available' }));
        return true;
      }

      const doc = service.getDocumentByPath(filePath);

      if (!doc) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Document not found', path: filePath }));
        return true;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(doc));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[DeepWiki] Error getting document:', message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
    }
    return true;
  }

  // GET /api/deepwiki/stats - Get storage statistics
  if (pathname === '/api/deepwiki/stats') {
    try {
      const service = getDeepWikiService();

      if (!service.isAvailable()) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ available: false, files: 0, symbols: 0, docs: 0 }));
        return true;
      }

      const stats = service.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ available: true, ...stats }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[DeepWiki] Error getting stats:', message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
    }
    return true;
  }

  // GET /api/deepwiki/search?q=<query> - Search symbols
  if (pathname === '/api/deepwiki/search') {
    const query = url.searchParams.get('q');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    if (!query) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'q parameter is required' }));
      return true;
    }

    try {
      const service = getDeepWikiService();

      if (!service.isAvailable()) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([]));
        return true;
      }

      const symbols = service.searchSymbols(query, limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(symbols));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[DeepWiki] Error searching symbols:', message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
    }
    return true;
  }

  return false;
}
