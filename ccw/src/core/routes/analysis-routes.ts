/**
 * Analysis Routes Module
 * Provides API endpoints for viewing analysis sessions from .workflow/.analysis/
 *
 * Endpoints:
 * - GET /api/analysis - Returns list of all analysis sessions
 * - GET /api/analysis/:id - Returns detailed content of a specific session
 */

import { readdir, readFile, stat } from 'fs/promises';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import type { RouteContext } from './types.js';
import { resolvePath } from '../../utils/path-resolver.js';

// Concurrency limit for processing folders
const MAX_CONCURRENT = 10;
// Timeout for individual file operations (ms)
const FILE_TIMEOUT = 5000;

/**
 * Analysis session summary for list view
 */
export interface AnalysisSessionSummary {
  id: string;
  name: string;
  topic: string;
  createdAt: string;
  status: 'in_progress' | 'completed';
  hasConclusions: boolean;
}

/**
 * Analysis session detail
 */
export interface AnalysisSessionDetail {
  id: string;
  name: string;
  topic: string;
  createdAt: string;
  status: 'in_progress' | 'completed';
  discussion: string | null;
  conclusions: Record<string, unknown> | null;
  explorations: Record<string, unknown> | null;
  perspectives: Record<string, unknown> | null;
}

/**
 * Parse session folder name to extract metadata
 */
function parseSessionId(folderName: string): { slug: string; date: string } | null {
  // Format: ANL-{slug}-{YYYY-MM-DD}
  const match = folderName.match(/^ANL-(.+)-(\d{4}-\d{2}-\d{2})$/);
  if (!match) return null;
  return { slug: match[1], date: match[2] };
}

/**
 * Read JSON file safely
 */
async function readJsonFile(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    if (!existsSync(filePath)) return null;
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Read text file safely
 */
async function readTextFile(filePath: string): Promise<string | null> {
  try {
    if (!existsSync(filePath)) return null;
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Get analysis session summary from folder
 */
async function getSessionSummary(
  analysisDir: string,
  folderName: string
): Promise<AnalysisSessionSummary | null> {
  const parsed = parseSessionId(folderName);
  if (!parsed) return null;

  const sessionPath = join(analysisDir, folderName);
  const folderStat = await stat(sessionPath);
  if (!folderStat.isDirectory()) return null;

  const conclusionsPath = join(sessionPath, 'conclusions.json');

  const hasConclusions = existsSync(conclusionsPath);
  const conclusions = hasConclusions ? await readJsonFile(conclusionsPath) : null;

  // Extract topic from conclusions or folder name
  const topic = (conclusions?.topic as string) || parsed.slug.replace(/-/g, ' ');

  return {
    id: folderName,
    name: folderName,
    topic,
    createdAt: parsed.date,
    status: hasConclusions ? 'completed' : 'in_progress',
    hasConclusions
  };
}

/**
 * Get detailed session content
 */
async function getSessionDetail(
  analysisDir: string,
  sessionId: string
): Promise<AnalysisSessionDetail | null> {
  const parsed = parseSessionId(sessionId);
  if (!parsed) return null;

  const sessionPath = join(analysisDir, sessionId);
  if (!existsSync(sessionPath)) return null;

  const [discussion, conclusions, explorations, perspectives] = await Promise.all([
    readTextFile(join(sessionPath, 'discussion.md')),
    readJsonFile(join(sessionPath, 'conclusions.json')),
    readJsonFile(join(sessionPath, 'explorations.json')),
    readJsonFile(join(sessionPath, 'perspectives.json'))
  ]);

  const topic = (conclusions?.topic as string) || parsed.slug.replace(/-/g, ' ');

  return {
    id: sessionId,
    name: sessionId,
    topic,
    createdAt: parsed.date,
    status: conclusions ? 'completed' : 'in_progress',
    discussion,
    conclusions,
    explorations,
    perspectives
  };
}

/**
 * Handle analysis routes
 * @returns true if route was handled, false otherwise
 */
export async function handleAnalysisRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, req, res, initialPath } = ctx;

  // GET /api/analysis - List all analysis sessions
  if (pathname === '/api/analysis' && req.method === 'GET') {
    try {
      const projectPath = ctx.url.searchParams.get('projectPath') || initialPath;
      const limit = Math.min(parseInt(ctx.url.searchParams.get('limit') || '50', 10), 100);
      const offset = parseInt(ctx.url.searchParams.get('offset') || '0', 10);
      const resolvedPath = resolvePath(projectPath);
      const analysisDir = join(resolvedPath, '.workflow', '.analysis');

      if (!existsSync(analysisDir)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: [], total: 0 }));
        return true;
      }

      const folders = await readdir(analysisDir);

      // Parallel processing for better performance
      const summaries = await Promise.all(
        folders.map(folder => getSessionSummary(analysisDir, folder))
      );

      // Filter valid sessions and sort by date descending
      const allSessions = summaries
        .filter((s): s is AnalysisSessionSummary => s !== null)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      const total = allSessions.length;
      const paginatedSessions = allSessions.slice(offset, offset + limit);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: paginatedSessions, total }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: (error as Error).message }));
      return true;
    }
  }

  // GET /api/analysis/:id - Get session detail
  const detailMatch = pathname.match(/^\/api\/analysis\/([^/]+)$/);
  if (detailMatch && req.method === 'GET') {
    try {
      const sessionId = decodeURIComponent(detailMatch[1]!);
      const projectPath = ctx.url.searchParams.get('projectPath') || initialPath;
      const resolvedPath = resolvePath(projectPath);
      const analysisDir = join(resolvedPath, '.workflow', '.analysis');

      const detail = await getSessionDetail(analysisDir, sessionId);

      if (!detail) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Session not found' }));
        return true;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: detail }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: (error as Error).message }));
      return true;
    }
  }

  return false;
}
