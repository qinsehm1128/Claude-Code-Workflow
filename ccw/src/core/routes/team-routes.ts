/**
 * Team Routes - REST API for team message visualization & management
 *
 * Directory Structure (NEW - session-bound):
 * .workflow/.team/
 * ├── TLS-demo-2026-02-15/      # session-id (root)
 * │   ├── .msg/                 # messages (session-level)
 * │   │   ├── meta.json
 * │   │   └── messages.jsonl
 * │   ├── spec/                 # artifacts (siblings of .msg)
 * │   └── plan/
 *
 * Legacy Support: Also scans .workflow/.team-msg/{team-name}/
 *
 * Endpoints:
 * - GET    /api/teams                       - List all teams (with ?location filter)
 * - GET    /api/teams/:name/messages        - Get messages (with filters)
 * - GET    /api/teams/:name/status          - Get member status summary
 * - GET    /api/teams/:name/artifacts       - Get artifacts tree structure
 * - GET    /api/teams/:name/artifacts/*path - Get artifact file content
 * - POST   /api/teams/:name/archive         - Archive a team
 * - POST   /api/teams/:name/unarchive       - Unarchive a team
 * - DELETE /api/teams/:name                 - Delete a team
 */

import { existsSync, readdirSync, rmSync, statSync, readFileSync } from 'fs';
import { join, extname } from 'path';
import type { RouteContext } from './types.js';
import { readAllMessages, getLogDir, getEffectiveTeamMeta, readTeamMeta, writeTeamMeta } from '../../tools/team-msg.js';
import type { TeamMeta } from '../../tools/team-msg.js';
import { getProjectRoot } from '../../utils/path-validator.js';

/**
 * Artifact node structure for tree representation
 */
interface ArtifactNode {
  type: 'file' | 'directory';
  name: string;
  path: string;           // Relative to session directory
  contentType: 'markdown' | 'json' | 'text' | 'unknown';
  size?: number;          // File size (bytes)
  modifiedAt?: string;    // Last modified time
  children?: ArtifactNode[];  // Directory children
}

/**
 * Detect content type from file extension
 */
function detectContentType(fileName: string): ArtifactNode['contentType'] {
  const ext = extname(fileName).toLowerCase();
  if (['.md', '.markdown'].includes(ext)) return 'markdown';
  if (['.json'].includes(ext)) return 'json';
  if (['.txt', '.log', '.tsv', '.csv'].includes(ext)) return 'text';
  return 'unknown';
}

/**
 * Recursively scan artifacts directory
 * Skips .msg directory (message storage)
 */
function scanArtifactsDirectory(dirPath: string, basePath: string): ArtifactNode[] {
  const nodes: ArtifactNode[] = [];

  if (!existsSync(dirPath)) {
    return nodes;
  }

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // Skip .msg directory - that's for messages, not artifacts
      if (entry.name === '.msg') continue;

      const fullPath = join(dirPath, entry.name);
      const relativePath = join(basePath, entry.name).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        const children = scanArtifactsDirectory(fullPath, relativePath);
        const stat = statSync(fullPath);

        nodes.push({
          type: 'directory',
          name: entry.name,
          path: relativePath,
          contentType: 'unknown',
          modifiedAt: stat.mtime.toISOString(),
          children,
        });
      } else if (entry.isFile()) {
        const stat = statSync(fullPath);

        nodes.push({
          type: 'file',
          name: entry.name,
          path: relativePath,
          contentType: detectContentType(entry.name),
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        });
      }
    }

    // Sort: directories first, then files, both alphabetically
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  } catch (e) {
    // Ignore errors (permission, etc.)
  }

  return nodes;
}

/**
 * Get session directory (artifacts are siblings of .msg/)
 * NEW: .workflow/.team/{session-id}/
 */
function getSessionDir(sessionId: string, root: string): string {
  return join(root, '.workflow', '.team', sessionId);
}

/**
 * Get legacy team directory
 * OLD: .workflow/.team-msg/{team-name}/
 */
function getLegacyTeamDir(teamName: string, root: string): string {
  return join(root, '.workflow', '.team-msg', teamName);
}

/**
 * List all sessions from new .team/ directory
 * Each subdirectory with .msg/ folder is a valid session
 */
function listSessions(root: string): Array<{ sessionId: string; path: string }> {
  const teamDir = join(root, '.workflow', '.team');
  const sessions: Array<{ sessionId: string; path: string }> = [];

  console.log('[team-routes] listSessions - root:', root);
  console.log('[team-routes] listSessions - teamDir:', teamDir);
  console.log('[team-routes] listSessions - existsSync(teamDir):', existsSync(teamDir));

  if (!existsSync(teamDir)) {
    return sessions;
  }

  try {
    const entries = readdirSync(teamDir, { withFileTypes: true });
    console.log('[team-routes] listSessions - entries:', entries.map(e => e.name));
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const msgDir = join(teamDir, entry.name, '.msg');
        console.log('[team-routes] listSessions - checking msgDir:', msgDir, 'exists:', existsSync(msgDir));
        if (existsSync(msgDir)) {
          sessions.push({ sessionId: entry.name, path: join(teamDir, entry.name) });
        }
      }
    }
  } catch (err) {
    console.error('[team-routes] listSessions error:', err);
  }

  console.log('[team-routes] listSessions - found sessions:', sessions.length);
  return sessions;
}

/**
 * List teams from old .team-msg/ directory (backward compatibility)
 */
function listLegacyTeams(root: string): Array<{ teamName: string; path: string }> {
  const teamMsgDir = join(root, '.workflow', '.team-msg');
  const teams: Array<{ teamName: string; path: string }> = [];

  if (!existsSync(teamMsgDir)) {
    return teams;
  }

  try {
    const entries = readdirSync(teamMsgDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        teams.push({ teamName: entry.name, path: join(teamMsgDir, entry.name) });
      }
    }
  } catch {
    // Ignore errors
  }

  return teams;
}

function jsonResponse(res: import('http').ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Resolve project root from context
 * Priority: initialPath (from server startup) > getProjectRoot()
 */
function resolveProjectRoot(ctx: RouteContext): string {
  return ctx.initialPath || getProjectRoot();
}

export async function handleTeamRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, req, res, url, handlePostRequest } = ctx;

  if (!pathname.startsWith('/api/teams')) return false;

  // ====== GET /api/teams/debug - Debug endpoint ======
  if (pathname === '/api/teams/debug' && req.method === 'GET') {
    const root = resolveProjectRoot(ctx);
    const teamDir = join(root, '.workflow', '.team');
    const legacyDir = join(root, '.workflow', '.team-msg');

    const debug = {
      projectRoot: root,
      teamDir,
      legacyDir,
      teamDirExists: existsSync(teamDir),
      legacyDirExists: existsSync(legacyDir),
      teamDirContents: [] as string[],
      sessionMsgDirs: [] as { session: string; msgExists: boolean }[],
    };

    if (existsSync(teamDir)) {
      try {
        const entries = readdirSync(teamDir, { withFileTypes: true });
        debug.teamDirContents = entries.map(e => `${e.name} (${e.isDirectory() ? 'dir' : 'file'})`);
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const msgDir = join(teamDir, entry.name, '.msg');
            debug.sessionMsgDirs.push({
              session: entry.name,
              msgExists: existsSync(msgDir),
            });
          }
        }
      } catch (err) {
        (debug as any).error = String(err);
      }
    }

    jsonResponse(res, 200, debug);
    return true;
  }

  // ====== GET /api/teams - List all teams ======
  if (pathname === '/api/teams' && req.method === 'GET') {
    try {
      const root = resolveProjectRoot(ctx);
      const locationFilter = url.searchParams.get('location') || 'active';

      // Collect from new session-bound structure
      const sessions = listSessions(root);
      // Collect from legacy structure
      const legacyTeams = listLegacyTeams(root);

      // Build unified team list
      const teams: Array<{
        name: string;
        messageCount: number;
        lastActivity: string;
        status: string;
        created_at: string;
        updated_at: string;
        archived_at?: string;
        pipeline_mode?: string;
        memberCount: number;
        members: string[];
        isLegacy: boolean;
      }> = [];

      // Process new sessions
      for (const session of sessions) {
        const messages = readAllMessages(session.sessionId);
        const lastMsg = messages[messages.length - 1];
        const meta = getEffectiveTeamMeta(session.sessionId);

        const memberSet = new Set<string>();
        for (const msg of messages) {
          memberSet.add(msg.from);
          memberSet.add(msg.to);
        }

        teams.push({
          name: session.sessionId,
          messageCount: messages.length,
          lastActivity: lastMsg?.ts || '',
          status: meta.status,
          created_at: meta.created_at,
          updated_at: meta.updated_at,
          archived_at: meta.archived_at,
          pipeline_mode: meta.pipeline_mode,
          memberCount: memberSet.size,
          members: Array.from(memberSet),
          isLegacy: false,
        });
      }

      // Process legacy teams
      for (const team of legacyTeams) {
        // Skip if already found in new structure (same name)
        if (teams.some(t => t.name === team.teamName)) continue;

        const messages = readAllMessages(team.teamName);
        const lastMsg = messages[messages.length - 1];
        const meta = getEffectiveTeamMeta(team.teamName);

        const memberSet = new Set<string>();
        for (const msg of messages) {
          memberSet.add(msg.from);
          memberSet.add(msg.to);
        }

        teams.push({
          name: team.teamName,
          messageCount: messages.length,
          lastActivity: lastMsg?.ts || '',
          status: meta.status,
          created_at: meta.created_at,
          updated_at: meta.updated_at,
          archived_at: meta.archived_at,
          pipeline_mode: meta.pipeline_mode,
          memberCount: memberSet.size,
          members: Array.from(memberSet),
          isLegacy: true,
        });
      }

      // Apply filters
      const filteredTeams = teams
        .filter(t => {
          if (locationFilter === 'all') return true;
          if (locationFilter === 'archived') return t.status === 'archived';
          return t.status !== 'archived';
        })
        .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));

      jsonResponse(res, 200, { teams: filteredTeams });
      return true;
    } catch (error) {
      jsonResponse(res, 500, { error: (error as Error).message });
      return true;
    }
  }

  // ====== POST /api/teams/:name/archive ======
  const archiveMatch = pathname.match(/^\/api\/teams\/([^/]+)\/archive$/);
  if (archiveMatch && req.method === 'POST') {
    const teamName = decodeURIComponent(archiveMatch[1]);
    handlePostRequest(req, res, async () => {
      const dir = getLogDir(teamName);
      if (!existsSync(dir)) {
        throw new Error(`Team "${teamName}" not found`);
      }
      const meta = getEffectiveTeamMeta(teamName);
      meta.status = 'archived';
      meta.archived_at = new Date().toISOString();
      meta.updated_at = new Date().toISOString();
      writeTeamMeta(teamName, meta);
      return { success: true, team: teamName, status: 'archived' };
    });
    return true;
  }

  // ====== POST /api/teams/:name/unarchive ======
  const unarchiveMatch = pathname.match(/^\/api\/teams\/([^/]+)\/unarchive$/);
  if (unarchiveMatch && req.method === 'POST') {
    const teamName = decodeURIComponent(unarchiveMatch[1]);
    handlePostRequest(req, res, async () => {
      const dir = getLogDir(teamName);
      if (!existsSync(dir)) {
        throw new Error(`Team "${teamName}" not found`);
      }
      const meta = getEffectiveTeamMeta(teamName);
      meta.status = 'active';
      delete meta.archived_at;
      meta.updated_at = new Date().toISOString();
      writeTeamMeta(teamName, meta);
      return { success: true, team: teamName, status: 'active' };
    });
    return true;
  }

  // ====== DELETE /api/teams/:name ======
  const deleteMatch = pathname.match(/^\/api\/teams\/([^/]+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    const teamName = decodeURIComponent(deleteMatch[1]);
    const root = resolveProjectRoot(ctx);
    try {
      // Try new session-bound location first
      const sessionDir = getSessionDir(teamName, root);
      if (existsSync(sessionDir)) {
        rmSync(sessionDir, { recursive: true, force: true });
        jsonResponse(res, 200, { success: true, team: teamName, deleted: true });
        return true;
      }

      // Fallback to legacy location
      const legacyDir = getLegacyTeamDir(teamName, root);
      if (existsSync(legacyDir)) {
        rmSync(legacyDir, { recursive: true, force: true });
        jsonResponse(res, 200, { success: true, team: teamName, deleted: true });
        return true;
      }

      jsonResponse(res, 404, { error: `Team "${teamName}" not found` });
      return true;
    } catch (error) {
      jsonResponse(res, 500, { error: (error as Error).message });
      return true;
    }
  }

  // ====== GET requests only from here ======
  if (req.method !== 'GET') return false;

  // ====== GET /api/teams/:name/artifacts or /api/teams/:name/artifacts/*path ======
  const artifactsMatch = pathname.match(/^\/api\/teams\/([^/]+)\/artifacts(?:\/(.*))?$/);
  if (artifactsMatch) {
    const artifactsTeamName = decodeURIComponent(artifactsMatch[1]);
    const artifactPath = artifactsMatch[2] ? decodeURIComponent(artifactsMatch[2]) : null;
    const root = resolveProjectRoot(ctx);

    try {
      // NEW: Session directory contains both .msg/ and artifacts
      // The team name IS the session ID now
      const sessionDir = getSessionDir(artifactsTeamName, root);

      if (!existsSync(sessionDir)) {
        // Check if it's a legacy team with session_id
        const meta = getEffectiveTeamMeta(artifactsTeamName);
        if (meta.session_id) {
          // Legacy team with session_id - redirect to session directory
          const legacySessionDir = getSessionDir(meta.session_id, root);
          if (existsSync(legacySessionDir)) {
            serveArtifacts(legacySessionDir, meta.session_id, meta, artifactPath, res);
            return true;
          }
        }

        jsonResponse(res, 200, {
          tree: [],
          sessionId: null,
          message: 'Session directory not found'
        });
        return true;
      }

      // Direct session access - artifacts are siblings of .msg/
      const meta = getEffectiveTeamMeta(artifactsTeamName);
      serveArtifacts(sessionDir, artifactsTeamName, meta, artifactPath, res);
      return true;
    } catch (error) {
      jsonResponse(res, 500, { error: (error as Error).message });
      return true;
    }
  }

  // ====== GET /api/teams/:name/messages or /api/teams/:name/status ======
  const match = pathname.match(/^\/api\/teams\/([^/]+)\/(messages|status)$/);
  if (!match) return false;

  const teamName = decodeURIComponent(match[1]);
  const action = match[2];

  // GET /api/teams/:name/messages
  if (action === 'messages') {
    try {
      let messages = readAllMessages(teamName);

      // Apply query filters
      const fromFilter = url.searchParams.get('from');
      const toFilter = url.searchParams.get('to');
      const typeFilter = url.searchParams.get('type');
      const last = parseInt(url.searchParams.get('last') || '50', 10);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);

      if (fromFilter) messages = messages.filter(m => m.from === fromFilter);
      if (toFilter) messages = messages.filter(m => m.to === toFilter);
      if (typeFilter) messages = messages.filter(m => m.type === typeFilter);

      const total = messages.length;
      const sliced = messages.slice(Math.max(0, total - last - offset), total - offset);

      jsonResponse(res, 200, { total, showing: sliced.length, messages: sliced });
      return true;
    } catch (error) {
      jsonResponse(res, 500, { error: (error as Error).message });
      return true;
    }
  }

  // GET /api/teams/:name/status
  if (action === 'status') {
    try {
      const messages = readAllMessages(teamName);

      const memberMap = new Map<string, { member: string; lastSeen: string; lastAction: string; messageCount: number }>();

      for (const msg of messages) {
        for (const role of [msg.from, msg.to]) {
          if (!memberMap.has(role)) {
            memberMap.set(role, { member: role, lastSeen: msg.ts, lastAction: '', messageCount: 0 });
          }
        }
        const entry = memberMap.get(msg.from)!;
        entry.lastSeen = msg.ts;
        entry.lastAction = `sent ${msg.type} -> ${msg.to}`;
        entry.messageCount++;
      }

      const members = Array.from(memberMap.values()).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));

      jsonResponse(res, 200, { members, total_messages: messages.length });
      return true;
    } catch (error) {
      jsonResponse(res, 500, { error: (error as Error).message });
      return true;
    }
  }

  return false;
}

/**
 * Serve artifacts from session directory
 */
function serveArtifacts(
  sessionDir: string,
  sessionId: string,
  meta: TeamMeta,
  artifactPath: string | null,
  res: import('http').ServerResponse
): void {
  // If specific file path requested
  if (artifactPath) {
    const filePath = join(sessionDir, artifactPath);

    if (!existsSync(filePath)) {
      jsonResponse(res, 404, {
        error: 'Artifact not found',
        path: artifactPath
      });
      return;
    }

    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      // Return directory listing
      const children = scanArtifactsDirectory(filePath, artifactPath);
      jsonResponse(res, 200, {
        type: 'directory',
        name: artifactPath.split('/').pop() || '',
        path: artifactPath,
        children,
        modifiedAt: stat.mtime.toISOString()
      });
      return;
    }

    // Return file content
    const content = readFileSync(filePath, 'utf-8');
    const contentType = detectContentType(artifactPath.split('/').pop() || '');

    jsonResponse(res, 200, {
      type: 'file',
      name: artifactPath.split('/').pop() || '',
      path: artifactPath,
      contentType,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      content
    });
    return;
  }

  // Return full artifacts tree
  const tree = scanArtifactsDirectory(sessionDir, '');

  jsonResponse(res, 200, {
    teamName: sessionId,
    sessionId: sessionId,
    sessionPath: sessionDir,
    pipelineMode: meta.pipeline_mode,
    tree,
    totalFiles: countFiles(tree),
    totalDirectories: countDirectories(tree),
    totalSize: countTotalSize(tree)
  });
}

/**
 * Count total files in artifact tree
 */
function countFiles(nodes: ArtifactNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === 'file') {
      count++;
    } else if (node.children) {
      count += countFiles(node.children);
    }
  }
  return count;
}

/**
 * Count total directories in artifact tree
 */
function countDirectories(nodes: ArtifactNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === 'directory') {
      count++;
      if (node.children) {
        count += countDirectories(node.children);
      }
    }
  }
  return count;
}

/**
 * Count total size of all files in artifact tree
 */
function countTotalSize(nodes: ArtifactNode[]): number {
  let totalSize = 0;
  for (const node of nodes) {
    if (node.type === 'file' && node.size) {
      totalSize += node.size;
    } else if (node.children) {
      totalSize += countTotalSize(node.children);
    }
  }
  return totalSize;
}
