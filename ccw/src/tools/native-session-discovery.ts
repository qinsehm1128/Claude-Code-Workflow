/**
 * Native Session Discovery - Discovers and tracks native CLI tool sessions
 * Supports Gemini, Qwen, and Codex session formats
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, basename, dirname, resolve } from 'path';
// basename is used for extracting session ID from filename
import { createHash } from 'crypto';
import { homedir } from 'os';

// Types
export interface NativeSession {
  sessionId: string;           // Native UUID
  tool: string;                // gemini | qwen | codex
  filePath: string;            // Full path to session file
  projectHash?: string;        // Project directory hash (Gemini/Qwen)
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionDiscoveryOptions {
  workingDir?: string;         // Project working directory
  limit?: number;              // Max sessions to return
  afterTimestamp?: Date;       // Only sessions after this time
}

/**
 * Calculate project hash (same algorithm as Gemini/Qwen)
 * Note: Gemini/Qwen use the absolute path AS-IS without normalization
 * On Windows, this means using backslashes and original case
 */
export function calculateProjectHash(projectDir: string): string {
  // resolve() returns absolute path with native separators (backslash on Windows)
  const absolutePath = resolve(projectDir);
  return createHash('sha256').update(absolutePath).digest('hex');
}

/**
 * Get home directory path
 */
function getHomePath(): string {
  return homedir().replace(/\\/g, '/');
}

/**
 * Normalize a project root path for comparing against Gemini's `projects.json` keys
 * and `.project_root` marker file contents.
 *
 * On Windows Gemini uses lowercased absolute paths with backslashes.
 */
function normalizeGeminiProjectRootPath(projectDir: string): string {
  const absolutePath = resolve(projectDir);
  if (process.platform !== 'win32') return absolutePath;
  return absolutePath.replace(/\//g, '\\').toLowerCase();
}

let geminiProjectsCache:
  | { configPath: string; mtimeMs: number; projects: Record<string, string> }
  | null = null;

/**
 * Load Gemini project mapping from `~/.gemini/projects.json` (best-effort).
 * Format: { "projects": { "<projectRoot>": "<projectName>" } }
 */
function getGeminiProjectsMap(): Record<string, string> | null {
  const configPath = join(getHomePath(), '.gemini', 'projects.json');

  try {
    const stat = statSync(configPath);
    if (geminiProjectsCache?.configPath === configPath && geminiProjectsCache.mtimeMs === stat.mtimeMs) {
      return geminiProjectsCache.projects;
    }

    const raw = readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as { projects?: Record<string, string> };
    if (!parsed.projects || typeof parsed.projects !== 'object') {
      return null;
    }

    geminiProjectsCache = { configPath, mtimeMs: stat.mtimeMs, projects: parsed.projects };
    return parsed.projects;
  } catch {
    return null;
  }
}

/**
 * Base session discoverer interface
 */
abstract class SessionDiscoverer {
  abstract tool: string;
  abstract basePath: string;

  /**
   * Get all sessions for a project
   */
  abstract getSessions(options?: SessionDiscoveryOptions): NativeSession[];

  /**
   * Get the latest session
   */
  getLatestSession(options?: SessionDiscoveryOptions): NativeSession | null {
    const sessions = this.getSessions({ ...options, limit: 1 });
    return sessions.length > 0 ? sessions[0] : null;
  }

  /**
   * Find session by ID
   */
  abstract findSessionById(sessionId: string): NativeSession | null;

  /**
   * Track new session created during execution
   * @param beforeTimestamp - Filter sessions created after this time
   * @param workingDir - Project working directory
   * @param prompt - Optional prompt content for precise matching (fallback)
   * @param transactionId - Optional transaction ID for exact matching (highest priority)
   */
  async trackNewSession(
    beforeTimestamp: Date,
    workingDir: string,
    prompt?: string,
    transactionId?: string
  ): Promise<NativeSession | null> {
    const sessions = this.getSessions({
      workingDir,
      afterTimestamp: beforeTimestamp,
      limit: 10 // Get more candidates for matching
    });

    if (sessions.length === 0) return null;

    // Priority 1: Match by transaction ID (exact match, highest confidence)
    if (transactionId) {
      const matched = this.matchSessionByTransactionId(transactionId, sessions);
      if (matched) {
        return matched;
      }
      // Transaction ID provided but no match - fall through to other methods
    }

    // If only one session, return it
    if (sessions.length === 1) {
      return sessions[0];
    }

    // Priority 2: Match by prompt content (fallback for parallel execution)
    if (prompt) {
      const matched = this.matchSessionByPrompt(sessions, prompt);
      if (matched) {
        return matched;
      }
    }

    // Warn if multiple sessions and no match found (low confidence)
    if (sessions.length > 1) {
      console.warn(`[ccw] Session tracking: multiple candidates found (${sessions.length}), using latest session`);
    }

    return sessions[0]; // Fallback to latest if no match
  }

  /**
   * Match session by prompt content
   * Searches for the prompt in session's user messages
   */
  matchSessionByPrompt(sessions: NativeSession[], prompt: string): NativeSession | null {
    // Normalize prompt for comparison (first 200 chars)
    const promptPrefix = prompt.substring(0, 200).trim();
    if (!promptPrefix) return null;

    for (const session of sessions) {
      try {
        const userMessage = this.extractFirstUserMessage(session.filePath);
        if (userMessage && userMessage.includes(promptPrefix)) {
          return session;
        }
      } catch {
        // Skip sessions that can't be read
      }
    }
    return null;
  }

  /**
   * Match session by transaction ID
   * Extracts transaction ID from session's first user message and compares
   * @param txId - Transaction ID to match (format: ccw-tx-${conversationId}-${uniquePart})
   * @param sessions - Candidate sessions to search
   * @returns Matching session or null
   */
  matchSessionByTransactionId(txId: string, sessions: NativeSession[]): NativeSession | null {
    if (!txId) return null;

    for (const session of sessions) {
      try {
        const userMessage = this.extractFirstUserMessage(session.filePath);
        if (userMessage) {
          // Extract transaction ID from user message
          const match = userMessage.match(/\[CCW-TX-ID:\s+([^\]]+)\]/);
          if (match && match[1] === txId) {
            return session;
          }
        }
      } catch {
        // Skip sessions that can't be read
      }
    }
    return null;
  }

  /**
   * Extract first user message from session file
   * Override in subclass for tool-specific format
   */
  abstract extractFirstUserMessage(filePath: string): string | null;
}

/**
 * Gemini Session Discoverer
 * Legacy path: ~/.gemini/tmp/<projectHash>/chats/session-*.json
 * Current path (Gemini CLI): ~/.gemini/tmp/<projectName>/chats/session-*.json
 */
class GeminiSessionDiscoverer extends SessionDiscoverer {
  tool = 'gemini';
  basePath = join(getHomePath(), '.gemini', 'tmp');

  private getProjectFoldersForWorkingDir(workingDir: string): string[] {
    const folders = new Set<string>();

    // Legacy: hashed folder
    const projectHash = calculateProjectHash(workingDir);
    if (existsSync(join(this.basePath, projectHash))) {
      folders.add(projectHash);
    }

    // Current: project-name folder resolved via ~/.gemini/projects.json
    let hasProjectNameFolder = false;
    const projectsMap = getGeminiProjectsMap();
    if (projectsMap) {
      const normalized = normalizeGeminiProjectRootPath(workingDir);

      // Prefer exact match first, then walk up parents (Gemini can map nested roots)
      let cursor: string | null = normalized;
      while (cursor) {
        const mapped = projectsMap[cursor];
        if (mapped) {
          const mappedPath = join(this.basePath, mapped);
          if (existsSync(mappedPath)) {
            folders.add(mapped);
            hasProjectNameFolder = true;
          }
          break;
        }
        const parent = dirname(cursor);
        cursor = parent !== cursor ? parent : null;
      }
    }

    // Fallback: scan for `.project_root` marker (best-effort; avoids missing mappings)
    if (!hasProjectNameFolder) {
      const normalized = normalizeGeminiProjectRootPath(workingDir);
      try {
        if (existsSync(this.basePath)) {
          for (const dirName of readdirSync(this.basePath)) {
            const fullPath = join(this.basePath, dirName);
            try {
              if (!statSync(fullPath).isDirectory()) continue;

              const markerPath = join(fullPath, '.project_root');
              if (!existsSync(markerPath)) continue;

              const marker = readFileSync(markerPath, 'utf8').trim();
              if (normalizeGeminiProjectRootPath(marker) === normalized) {
                folders.add(dirName);
                break;
              }
            } catch {
              // Ignore invalid entries
            }
          }
        }
      } catch {
        // Ignore scan failures
      }
    }

    return Array.from(folders);
  }

  getSessions(options: SessionDiscoveryOptions = {}): NativeSession[] {
    const { workingDir, limit, afterTimestamp } = options;
    const sessions: NativeSession[] = [];

    try {
      if (!existsSync(this.basePath)) return [];

      // If workingDir provided, only look in that project's folder
      let projectDirs: string[];
      if (workingDir) {
        projectDirs = this.getProjectFoldersForWorkingDir(workingDir);
      } else {
        projectDirs = readdirSync(this.basePath).filter(d => {
          const fullPath = join(this.basePath, d);
          return statSync(fullPath).isDirectory();
        });
      }

      for (const projectFolder of projectDirs) {
        const chatsDir = join(this.basePath, projectFolder, 'chats');
        if (!existsSync(chatsDir)) continue;

        const sessionFiles = readdirSync(chatsDir)
          .filter(f => f.startsWith('session-') && f.endsWith('.json'))
          .map(f => ({
            name: f,
            path: join(chatsDir, f),
            stat: statSync(join(chatsDir, f))
          }))
          .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

        for (const file of sessionFiles) {
          if (afterTimestamp && file.stat.mtime <= afterTimestamp) {
            // sessionFiles are sorted descending by mtime, we can stop early
            break;
          }

          try {
            const content = JSON.parse(readFileSync(file.path, 'utf8'));
            sessions.push({
              sessionId: content.sessionId,
              tool: this.tool,
              filePath: file.path,
              projectHash: content.projectHash,
              createdAt: new Date(content.startTime || file.stat.birthtime),
              updatedAt: new Date(content.lastUpdated || file.stat.mtime)
            });
          } catch {
            // Skip invalid files
          }
        }
      }

      // Sort by updatedAt descending
      sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      const seen = new Set<string>();
      const uniqueSessions = sessions.filter(s => {
        if (seen.has(s.sessionId)) return false;
        seen.add(s.sessionId);
        return true;
      });

      return limit ? uniqueSessions.slice(0, limit) : uniqueSessions;
    } catch {
      return [];
    }
  }

  findSessionById(sessionId: string): NativeSession | null {
    const sessions = this.getSessions();
    return sessions.find(s => s.sessionId === sessionId) || null;
  }

  /**
   * Extract first user message from Gemini session file
   * Format: { "messages": [{ "type": "user", "content": "..." }] }
   */
  extractFirstUserMessage(filePath: string): string | null {
    try {
      const content = JSON.parse(readFileSync(filePath, 'utf8'));
      if (content.messages && Array.isArray(content.messages)) {
        const userMsg = content.messages.find((m: { type: string }) => m.type === 'user');
        return userMsg?.content || null;
      }
      return null;
    } catch {
      return null;
    }
  }
}

/**
 * Encode a path to Qwen's project folder name format
 * D:\Claude_dms3 -> D--Claude-dms3
 * Rules: : -> -, \ -> -, _ -> -
 */
function encodeQwenProjectPath(projectDir: string): string {
  const absolutePath = resolve(projectDir);
  // Replace : -> -, \ -> -, _ -> -
  return absolutePath
    .replace(/:/g, '-')
    .replace(/\\/g, '-')
    .replace(/_/g, '-');
}

/**
 * Encode a path to Claude Code's project folder name format
 * D:\Claude_dms3 -> D--Claude-dms3 (same as Qwen)
 * Rules: : -> -, \ -> -, _ -> -
 */
function encodeClaudeProjectPath(projectDir: string): string {
  const absolutePath = resolve(projectDir);
  return absolutePath
    .replace(/:/g, '-')
    .replace(/\\/g, '-')
    .replace(/_/g, '-');
}

/**
 * Qwen Session Discoverer
 * New path: ~/.qwen/projects/<path-encoded>/chats/<uuid>.jsonl
 * Old path: ~/.qwen/tmp/<projectHash>/chats/session-*.json (deprecated, fallback)
 */
class QwenSessionDiscoverer extends SessionDiscoverer {
  tool = 'qwen';
  basePath = join(getHomePath(), '.qwen', 'projects');
  legacyBasePath = join(getHomePath(), '.qwen', 'tmp');

  getSessions(options: SessionDiscoveryOptions = {}): NativeSession[] {
    const { workingDir, limit, afterTimestamp } = options;
    const sessions: NativeSession[] = [];

    // Try new format first (projects folder)
    try {
      if (existsSync(this.basePath)) {
        let projectDirs: string[];
        if (workingDir) {
          const encodedPath = encodeQwenProjectPath(workingDir);
          const projectPath = join(this.basePath, encodedPath);
          projectDirs = existsSync(projectPath) ? [encodedPath] : [];
        } else {
          projectDirs = readdirSync(this.basePath).filter(d => {
            const fullPath = join(this.basePath, d);
            return statSync(fullPath).isDirectory();
          });
        }

        for (const projectFolder of projectDirs) {
          const chatsDir = join(this.basePath, projectFolder, 'chats');
          if (!existsSync(chatsDir)) continue;

          // New format: <uuid>.jsonl files
          const sessionFiles = readdirSync(chatsDir)
            .filter(f => f.endsWith('.jsonl'))
            .map(f => ({
              name: f,
              path: join(chatsDir, f),
              stat: statSync(join(chatsDir, f))
            }))
            .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

          for (const file of sessionFiles) {
            if (afterTimestamp && file.stat.mtime <= afterTimestamp) continue;

            try {
              // Parse JSONL - read first line for session info
              const content = readFileSync(file.path, 'utf8');
              const firstLine = content.split('\n')[0];
              const firstEntry = JSON.parse(firstLine);

              // Session ID is in the filename or first entry
              const sessionId = firstEntry.sessionId || basename(file.name, '.jsonl');

              // Find timestamp from entries
              let createdAt = file.stat.birthtime;
              let updatedAt = file.stat.mtime;

              if (firstEntry.timestamp) {
                createdAt = new Date(firstEntry.timestamp);
              }

              // Get last entry for updatedAt
              const lines = content.trim().split('\n').filter(l => l.trim());
              if (lines.length > 0) {
                try {
                  const lastEntry = JSON.parse(lines[lines.length - 1]);
                  if (lastEntry.timestamp) {
                    updatedAt = new Date(lastEntry.timestamp);
                  }
                } catch { /* ignore */ }
              }

              sessions.push({
                sessionId,
                tool: this.tool,
                filePath: file.path,
                projectHash: projectFolder, // Using encoded path as project identifier
                createdAt,
                updatedAt
              });
            } catch {
              // Skip invalid files
            }
          }
        }
      }
    } catch { /* ignore errors */ }

    // Fallback to legacy format (tmp folder with hash)
    try {
      if (existsSync(this.legacyBasePath)) {
        let projectDirs: string[];
        if (workingDir) {
          const projectHash = calculateProjectHash(workingDir);
          const projectPath = join(this.legacyBasePath, projectHash);
          projectDirs = existsSync(projectPath) ? [projectHash] : [];
        } else {
          projectDirs = readdirSync(this.legacyBasePath).filter(d => {
            const fullPath = join(this.legacyBasePath, d);
            return statSync(fullPath).isDirectory();
          });
        }

        for (const projectHash of projectDirs) {
          const chatsDir = join(this.legacyBasePath, projectHash, 'chats');
          if (!existsSync(chatsDir)) continue;

          const sessionFiles = readdirSync(chatsDir)
            .filter(f => f.startsWith('session-') && f.endsWith('.json'))
            .map(f => ({
              name: f,
              path: join(chatsDir, f),
              stat: statSync(join(chatsDir, f))
            }))
            .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

          for (const file of sessionFiles) {
            if (afterTimestamp && file.stat.mtime <= afterTimestamp) continue;

            try {
              const content = JSON.parse(readFileSync(file.path, 'utf8'));
              sessions.push({
                sessionId: content.sessionId,
                tool: this.tool,
                filePath: file.path,
                projectHash,
                createdAt: new Date(content.startTime || file.stat.birthtime),
                updatedAt: new Date(content.lastUpdated || file.stat.mtime)
              });
            } catch {
              // Skip invalid files
            }
          }
        }
      }
    } catch { /* ignore errors */ }

    // Sort by updatedAt descending and dedupe by sessionId
    sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    // Dedupe (new format takes precedence as it's checked first)
    const seen = new Set<string>();
    const uniqueSessions = sessions.filter(s => {
      if (seen.has(s.sessionId)) return false;
      seen.add(s.sessionId);
      return true;
    });

    return limit ? uniqueSessions.slice(0, limit) : uniqueSessions;
  }

  findSessionById(sessionId: string): NativeSession | null {
    const sessions = this.getSessions();
    return sessions.find(s => s.sessionId === sessionId) || null;
  }

  /**
   * Extract first user message from Qwen session file
   * New format (.jsonl): { type: "user", message: { role: "user", parts: [{ text: "..." }] } }
   * Legacy format (.json): { "messages": [{ "type": "user", "content": "..." }] }
   */
  extractFirstUserMessage(filePath: string): string | null {
    try {
      const content = readFileSync(filePath, 'utf8');

      // Check if JSONL (new format) or JSON (legacy)
      if (filePath.endsWith('.jsonl')) {
        // JSONL format - find first user message
        const lines = content.split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            // New Qwen format: { type: "user", message: { parts: [{ text: "..." }] } }
            if (entry.type === 'user' && entry.message?.parts?.[0]?.text) {
              return entry.message.parts[0].text;
            }
            // Alternative format
            if (entry.role === 'user' && entry.content) {
              return entry.content;
            }
          } catch { /* skip invalid lines */ }
        }
      } else {
        // Legacy JSON format
        const data = JSON.parse(content);
        if (data.messages && Array.isArray(data.messages)) {
          const userMsg = data.messages.find((m: { type: string }) => m.type === 'user');
          return userMsg?.content || null;
        }
      }
      return null;
    } catch {
      return null;
    }
  }
}

/**
 * Codex Session Discoverer
 * Path: ~/.codex/sessions/YYYY/MM/DD/rollout-*-<uuid>.jsonl
 */
class CodexSessionDiscoverer extends SessionDiscoverer {
  tool = 'codex';
  basePath = join(getHomePath(), '.codex', 'sessions');

  getSessions(options: SessionDiscoveryOptions = {}): NativeSession[] {
    const { limit, afterTimestamp } = options;
    const sessions: NativeSession[] = [];

    try {
      if (!existsSync(this.basePath)) return [];

      // Get year directories (e.g., 2025)
      const yearDirs = readdirSync(this.basePath)
        .filter(d => /^\d{4}$/.test(d))
        .sort((a, b) => b.localeCompare(a)); // Descending

      for (const year of yearDirs) {
        const yearPath = join(this.basePath, year);
        if (!statSync(yearPath).isDirectory()) continue;

        // Get month directories
        const monthDirs = readdirSync(yearPath)
          .filter(d => /^\d{2}$/.test(d))
          .sort((a, b) => b.localeCompare(a));

        for (const month of monthDirs) {
          const monthPath = join(yearPath, month);
          if (!statSync(monthPath).isDirectory()) continue;

          // Get day directories
          const dayDirs = readdirSync(monthPath)
            .filter(d => /^\d{2}$/.test(d))
            .sort((a, b) => b.localeCompare(a));

          for (const day of dayDirs) {
            const dayPath = join(monthPath, day);
            if (!statSync(dayPath).isDirectory()) continue;

            // Get session files
            const sessionFiles = readdirSync(dayPath)
              .filter(f => f.startsWith('rollout-') && f.endsWith('.jsonl'))
              .map(f => ({
                name: f,
                path: join(dayPath, f),
                stat: statSync(join(dayPath, f))
              }))
              .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

            for (const file of sessionFiles) {
              if (afterTimestamp && file.stat.mtime <= afterTimestamp) continue;

              try {
                // Parse first line for session_meta
                const firstLine = readFileSync(file.path, 'utf8').split('\n')[0];
                const meta = JSON.parse(firstLine);

                if (meta.type === 'session_meta' && meta.payload?.id) {
                  sessions.push({
                    sessionId: meta.payload.id,
                    tool: this.tool,
                    filePath: file.path,
                    createdAt: new Date(meta.payload.timestamp || file.stat.birthtime),
                    updatedAt: file.stat.mtime
                  });
                }
              } catch {
                // Try extracting UUID from filename
                const uuidMatch = file.name.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i);
                if (uuidMatch) {
                  sessions.push({
                    sessionId: uuidMatch[1],
                    tool: this.tool,
                    filePath: file.path,
                    createdAt: file.stat.birthtime,
                    updatedAt: file.stat.mtime
                  });
                }
              }
            }
          }
        }
      }

      sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      return limit ? sessions.slice(0, limit) : sessions;
    } catch {
      return [];
    }
  }

  findSessionById(sessionId: string): NativeSession | null {
    const sessions = this.getSessions();
    return sessions.find(s => s.sessionId === sessionId) || null;
  }

  /**
   * Extract first user message from Codex session file (.jsonl)
   * Format: {"type":"event_msg","payload":{"type":"user_message","message":"..."}}
   */
  extractFirstUserMessage(filePath: string): string | null {
    try {
      const content = readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          // Look for user_message event
          if (entry.type === 'event_msg' &&
              entry.payload?.type === 'user_message' &&
              entry.payload?.message) {
            return entry.payload.message;
          }
        } catch { /* skip invalid lines */ }
      }
      return null;
    } catch {
      return null;
    }
  }
}

/**
 * Claude Code Session Discoverer
 * Path: ~/.claude/projects/<projectHash>/sessions/*.jsonl
 * Claude Code stores sessions with UUID-based session IDs
 */
class ClaudeSessionDiscoverer extends SessionDiscoverer {
  tool = 'claude';
  basePath = join(getHomePath(), '.claude', 'projects');

  getSessions(options: SessionDiscoveryOptions = {}): NativeSession[] {
    const { workingDir, limit, afterTimestamp } = options;
    const sessions: NativeSession[] = [];

    try {
      if (!existsSync(this.basePath)) return [];

      // If workingDir provided, only look in that project's folder
      let projectDirs: string[];
      if (workingDir) {
        // Claude Code uses path encoding (D:\path -> D--path) not SHA256 hash
        const encodedPath = encodeClaudeProjectPath(workingDir);
        const projectPath = join(this.basePath, encodedPath);
        projectDirs = existsSync(projectPath) ? [encodedPath] : [];
      } else {
        projectDirs = readdirSync(this.basePath).filter(d => {
          const fullPath = join(this.basePath, d);
          return statSync(fullPath).isDirectory();
        });
      }

      for (const projectHash of projectDirs) {
        // Claude Code stores session files directly in project folder (not in 'sessions' subdirectory)
        // e.g., ~/.claude/projects/D--Claude-dms3/<uuid>.jsonl
        const projectDir = join(this.basePath, projectHash);
        if (!existsSync(projectDir)) continue;

        const sessionFiles = readdirSync(projectDir)
          .filter(f => f.endsWith('.jsonl') || f.endsWith('.json'))
          .map(f => ({
            name: f,
            path: join(projectDir, f),
            stat: statSync(join(projectDir, f))
          }))
          .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

        for (const file of sessionFiles) {
          if (afterTimestamp && file.stat.mtime <= afterTimestamp) continue;

          try {
            // Extract session ID from filename or content
            const uuidMatch = file.name.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
            if (uuidMatch) {
              sessions.push({
                sessionId: uuidMatch[1],
                tool: this.tool,
                filePath: file.path,
                projectHash,
                createdAt: file.stat.birthtime,
                updatedAt: file.stat.mtime
              });
            } else {
              // Try reading first line for session metadata
              const firstLine = readFileSync(file.path, 'utf8').split('\n')[0];
              const meta = JSON.parse(firstLine);
              if (meta.session_id) {
                sessions.push({
                  sessionId: meta.session_id,
                  tool: this.tool,
                  filePath: file.path,
                  projectHash,
                  createdAt: new Date(meta.timestamp || file.stat.birthtime),
                  updatedAt: file.stat.mtime
                });
              }
            }
          } catch {
            // Skip invalid files
          }
        }
      }

      sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      return limit ? sessions.slice(0, limit) : sessions;
    } catch {
      return [];
    }
  }

  findSessionById(sessionId: string): NativeSession | null {
    const sessions = this.getSessions();
    return sessions.find(s => s.sessionId === sessionId) || null;
  }

  /**
   * Extract first user message from Claude Code session file (.jsonl)
   * Format: {"type":"user","message":{"role":"user","content":"..."},"isMeta":false,...}
   * Content can be: string | array of {type,text} | array of {type,source} etc.
   */
  extractFirstUserMessage(filePath: string): string | null {
    try {
      const content = readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          // Claude Code format: type="user", message.role="user", message.content can be string or array
          // Skip meta messages and command messages
          if (entry.type === 'user' &&
              entry.message?.role === 'user' &&
              entry.message?.content &&
              !entry.isMeta) {

            const msgContent = entry.message.content;

            // Handle string content (simple case)
            if (typeof msgContent === 'string') {
              if (!msgContent.startsWith('<command-') && !msgContent.includes('<local-command')) {
                return msgContent;
              }
            }
            // Handle array content (can contain text, image, tool_result, etc.)
            else if (Array.isArray(msgContent)) {
              for (const item of msgContent) {
                // Look for text items
                if (item.type === 'text' && item.text) {
                  return item.text;
                }
              }
            }
          }
        } catch { /* skip invalid lines */ }
      }
      return null;
    } catch {
      return null;
    }
  }
}

/**
 * OpenCode Session Discoverer
 * Storage path: ~/.local/share/opencode/storage/ (all platforms)
 * Structure:
 *   session/<project-hash>/<session-id>.json  - Session metadata
 *   message/<session-id>/<message-id>.json    - Message content
 *   part/<message-id>/<part-id>.json          - Message parts
 *   project/<project-hash>.json               - Project metadata
 * https://opencode.ai/docs/config/
 */
class OpenCodeSessionDiscoverer extends SessionDiscoverer {
  tool = 'opencode';
  // Storage base path: ~/.local/share/opencode/storage
  basePath = join(
    process.env.USERPROFILE || getHomePath(),
    '.local',
    'share',
    'opencode',
    'storage'
  );

  private getProjectHash(workingDir: string): string | null {
    // OpenCode uses SHA1 hash of the project directory path
    const sessionDir = join(this.basePath, 'session');
    if (!existsSync(sessionDir)) return null;

    try {
      const projectHashes = readdirSync(sessionDir).filter(d => {
        const fullPath = join(sessionDir, d);
        return statSync(fullPath).isDirectory();
      });

      if (projectHashes.length === 0) return null;

      // If workingDir provided, try to find matching project
      if (workingDir) {
        const normalizedWorkDir = resolve(workingDir);
        // Check project files for directory match
        const projectDir = join(this.basePath, 'project');
        if (existsSync(projectDir)) {
          for (const hash of projectHashes) {
            const projectFile = join(projectDir, `${hash}.json`);
            if (existsSync(projectFile)) {
              try {
                const projectData = JSON.parse(readFileSync(projectFile, 'utf8'));
                // Normalize path comparison for Windows
                const projectPath = projectData.directory?.replace(/\\/g, '/').toLowerCase();
                const targetPath = normalizedWorkDir.replace(/\\/g, '/').toLowerCase();
                if (projectPath === targetPath) {
                  return hash;
                }
              } catch {
                // Skip invalid project files
              }
            }
          }
        }
      }

      // Return first available project hash if no match
      return projectHashes[0];
    } catch {
      return null;
    }
  }

  getSessions(options: SessionDiscoveryOptions = {}): NativeSession[] {
    const { workingDir, limit, afterTimestamp } = options;
    const sessions: NativeSession[] = [];

    const sessionDir = join(this.basePath, 'session');
    if (!existsSync(sessionDir)) return [];

    try {
      // Get all project directories or specific one
      let projectHashes: string[];
      if (workingDir) {
        const hash = this.getProjectHash(workingDir);
        projectHashes = hash ? [hash] : [];
      } else {
        projectHashes = readdirSync(sessionDir).filter(d => {
          const fullPath = join(sessionDir, d);
          return statSync(fullPath).isDirectory();
        });
      }

      for (const projectHash of projectHashes) {
        const projectSessionDir = join(sessionDir, projectHash);
        if (!existsSync(projectSessionDir)) continue;

        // Get all session files
        const sessionFiles = readdirSync(projectSessionDir)
          .filter(f => f.endsWith('.json'))
          .map(f => ({
            name: f,
            path: join(projectSessionDir, f),
            stat: statSync(join(projectSessionDir, f))
          }))
          .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

        for (const file of sessionFiles) {
          if (afterTimestamp && file.stat.mtime <= afterTimestamp) continue;

          try {
            const sessionData = JSON.parse(readFileSync(file.path, 'utf8'));
            sessions.push({
              sessionId: sessionData.id || basename(file.name, '.json'),
              tool: this.tool,
              filePath: file.path,
              projectHash,
              createdAt: new Date(sessionData.time?.created || file.stat.birthtime),
              updatedAt: new Date(sessionData.time?.updated || file.stat.mtime)
            });
          } catch {
            // Skip invalid files
          }
        }
      }

      // Sort by updatedAt descending
      sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      return limit ? sessions.slice(0, limit) : sessions;
    } catch {
      return [];
    }
  }

  findSessionById(sessionId: string): NativeSession | null {
    const sessions = this.getSessions();
    return sessions.find(s => s.sessionId === sessionId) || null;
  }

  /**
   * Extract first user message from OpenCode session
   * Messages are stored in: message/<session-id>/<message-id>.json
   * Format: { id, sessionID, role, time }
   * Content is in parts: part/<message-id>/<part-id>.json
   */
  extractFirstUserMessage(filePath: string): string | null {
    try {
      // filePath is the session JSON file
      const sessionData = JSON.parse(readFileSync(filePath, 'utf8'));
      const sessionId = sessionData.id;
      if (!sessionId) return null;

      // Find messages for this session
      const messageDir = join(this.basePath, 'message', sessionId);
      if (!existsSync(messageDir)) return null;

      // Get message files sorted by time
      const messageFiles = readdirSync(messageDir)
        .filter(f => f.endsWith('.json'))
        .map(f => ({
          name: f,
          path: join(messageDir, f)
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      for (const msgFile of messageFiles) {
        try {
          const msgData = JSON.parse(readFileSync(msgFile.path, 'utf8'));
          if (msgData.role === 'user') {
            // Get content from parts
            const partDir = join(this.basePath, 'part', msgData.id);
            if (existsSync(partDir)) {
              const partFiles = readdirSync(partDir)
                .filter(f => f.endsWith('.json'))
                .sort();

              for (const partFile of partFiles) {
                try {
                  const partData = JSON.parse(readFileSync(join(partDir, partFile), 'utf8'));
                  if (partData.type === 'text' && partData.text) {
                    return partData.text;
                  }
                } catch {
                  // Skip invalid parts
                }
              }
            }
            // Fallback to title if available
            return msgData.summary?.title || sessionData.title || null;
          }
        } catch {
          // Skip invalid messages
        }
      }
      return sessionData.title || null;
    } catch {
      return null;
    }
  }
}

// Singleton discoverers
const discoverers: Record<string, SessionDiscoverer> = {
  gemini: new GeminiSessionDiscoverer(),
  qwen: new QwenSessionDiscoverer(),
  codex: new CodexSessionDiscoverer(),
  claude: new ClaudeSessionDiscoverer(),
  opencode: new OpenCodeSessionDiscoverer()
};

/**
 * Get session discoverer for a tool
 */
export function getDiscoverer(tool: string): SessionDiscoverer | null {
  return discoverers[tool] || null;
}

/**
 * Get latest native session for a tool
 */
export function getLatestNativeSession(
  tool: string,
  workingDir?: string
): NativeSession | null {
  const discoverer = discoverers[tool];
  if (!discoverer) return null;
  return discoverer.getLatestSession({ workingDir });
}

/**
 * Find native session by ID
 */
export function findNativeSessionById(
  tool: string,
  sessionId: string
): NativeSession | null {
  const discoverer = discoverers[tool];
  if (!discoverer) return null;
  return discoverer.findSessionById(sessionId);
}

/**
 * Track new session created during execution
 * @param tool - CLI tool name (gemini, qwen, codex, claude)
 * @param beforeTimestamp - Filter sessions created after this time
 * @param workingDir - Project working directory
 * @param prompt - Optional prompt for precise matching in parallel execution
 * @param transactionId - Optional transaction ID for exact session matching
 */
export async function trackNewSession(
  tool: string,
  beforeTimestamp: Date,
  workingDir: string,
  prompt?: string,
  transactionId?: string
): Promise<NativeSession | null> {
  const discoverer = discoverers[tool];
  if (!discoverer) return null;
  return discoverer.trackNewSession(beforeTimestamp, workingDir, prompt, transactionId);
}

/**
 * Get all sessions for a tool
 */
export function getNativeSessions(
  tool: string,
  options?: SessionDiscoveryOptions
): NativeSession[] {
  const discoverer = discoverers[tool];
  if (!discoverer) return [];
  return discoverer.getSessions(options);
}

/**
 * Check if a tool supports native resume
 * Note: codex is excluded because `codex resume` requires a TTY (terminal)
 * which doesn't work in spawn() context. Codex uses prompt-concat mode instead.
 */
export function supportsNativeResume(tool: string): boolean {
  // codex resume requires TTY - use prompt-concat mode instead
  if (tool === 'codex') {
    return false;
  }
  return tool in discoverers;
}

/**
 * Get native resume command arguments for a tool
 */
export function getNativeResumeArgs(
  tool: string,
  sessionId: string | 'latest'
): string[] {
  switch (tool) {
    case 'gemini':
      // gemini -r <uuid> or -r latest
      return ['-r', sessionId];

    case 'qwen':
      // qwen --continue (latest) or --resume <uuid>
      if (sessionId === 'latest') {
        return ['--continue'];
      }
      return ['--resume', sessionId];

    case 'codex':
      // codex resume <uuid> or codex resume --last
      if (sessionId === 'latest') {
        return ['resume', '--last'];
      }
      return ['resume', sessionId];

    case 'opencode':
      // opencode run --continue (latest) or --session <uuid>
      if (sessionId === 'latest') {
        return ['--continue'];
      }
      return ['--session', sessionId];

    default:
      return [];
  }
}

/**
 * Get base path for a tool's sessions
 */
export function getToolSessionPath(tool: string): string | null {
  const discoverer = discoverers[tool];
  return discoverer?.basePath || null;
}

/**
 * List all native sessions from all supported CLI tools
 * Aggregates sessions from Gemini, Qwen, Codex, Claude, and OpenCode
 * @param options - Optional filtering (workingDir, limit, afterTimestamp)
 * @returns Combined sessions sorted by updatedAt descending
 */
export function listAllNativeSessions(options?: SessionDiscoveryOptions): NativeSession[] {
  const allSessions: NativeSession[] = [];

  // Collect sessions from all discoverers
  for (const tool of Object.keys(discoverers)) {
    const discoverer = discoverers[tool];
    const sessions = discoverer.getSessions(options);
    allSessions.push(...sessions);
  }

  // Sort by updatedAt descending
  allSessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  // Apply limit if provided
  if (options?.limit) {
    return allSessions.slice(0, options.limit);
  }

  return allSessions;
}
