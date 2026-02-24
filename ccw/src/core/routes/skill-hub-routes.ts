/**
 * Skill Hub Routes Module
 * Handles shared skill repository management endpoints
 *
 * Endpoints:
 * - GET  /api/skill-hub/remote       - Fetch remote skill index
 * - GET  /api/skill-hub/local        - List local shared skills
 * - GET  /api/skill-hub/installed    - List installed skills from hub
 * - POST /api/skill-hub/install      - Install skill to claude/codex
 * - POST /api/skill-hub/cache        - Cache remote skill locally
 * - GET  /api/skill-hub/updates      - Check for available updates
 */

import { readFileSync, existsSync, readdirSync, statSync, mkdirSync, cpSync, rmSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { validatePath as validateAllowedPath } from '../../utils/path-validator.js';
import type { RouteContext } from './types.js';

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type CliType = 'claude' | 'codex';

// ============================================================================
// Security Helpers
// ============================================================================

/**
 * Allowed domains for remote skill downloads (SSRF protection)
 */
const ALLOWED_REMOTE_DOMAINS = [
  'raw.githubusercontent.com',
  'github.com',
  'gist.githubusercontent.com',
];

/**
 * Validate that a URL is from an allowed domain (SSRF protection)
 */
function isUrlAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow HTTPS
    if (parsed.protocol !== 'https:') {
      return false;
    }
    // Check against whitelist
    return ALLOWED_REMOTE_DOMAINS.some(domain =>
      parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

/**
 * Validate skill name for filesystem safety
 * Only allows alphanumeric, dash, and underscore characters
 */
function isValidSkillName(name: string): boolean {
  if (!name || name.length === 0 || name.length > 100) {
    return false;
  }
  // Only allow safe characters: a-z, A-Z, 0-9, -, _
  const safeNameRegex = /^[a-zA-Z0-9_-]+$/;
  return safeNameRegex.test(name);
}

/**
 * Sanitize error message for client response
 * Returns a generic message while logging the actual error
 */
function sanitizeErrorMessage(error: unknown, operation: string): string {
  // Log the actual error for debugging
  console.error(`[SkillHub] ${operation} failed:`, error instanceof Error ? error.message : String(error));
  // Return generic message to client
  return `${operation} failed. Please try again later.`;
}

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Remote skill index entry (from GitHub or HTTP source)
 */
export interface RemoteSkillEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  tags: string[];
  downloadUrl: string;
  readmeUrl?: string;
  homepage?: string;
  license?: string;
  updatedAt?: string;
}

/**
 * Remote skill index response
 */
export interface RemoteSkillIndex {
  version: string;
  updated_at: string;
  source: 'github' | 'http' | 'local';
  skills: RemoteSkillEntry[];
}

/**
 * Local shared skill info
 */
export interface LocalSkillInfo {
  id: string;
  name: string;
  folderName: string;
  description: string;
  version: string;
  author?: string;
  category?: string;
  tags?: string[];
  path: string;
  source: 'local';
  updatedAt: string;
}

/**
 * Installed skill info (from hub)
 */
export interface InstalledSkillInfo {
  id: string;
  name: string;
  folderName: string;
  version: string;
  installedAt: string;
  installedTo: 'claude' | 'codex';
  source: 'remote' | 'local';
  originalId: string;
  updatesAvailable?: boolean;
  latestVersion?: string;
}

/**
 * Skill install request
 */
interface SkillInstallRequest {
  skillId: string;
  cliType: CliType;
  source: 'remote' | 'local';
  customName?: string;
}

/**
 * Skill cache request
 */
interface SkillCacheRequest {
  skillId: string;
  downloadUrl: string;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * GitHub repository configuration for remote skills
 */
const GITHUB_CONFIG = {
  owner: 'anthropics',
  repo: 'claude-code-workflow',
  branch: 'main',
  skillIndexPath: 'skill-hub/index.json'
};

/**
 * Remote skills cache with TTL (10 minutes)
 */
let remoteSkillsCache: {
  data: RemoteSkillIndex | null;
  timestamp: number;
} = { data: null, timestamp: 0 };
const CACHE_TTL_MS = 10 * 60 * 1000;

// ============================================================================
// Storage Helpers
// ============================================================================

/**
 * Get the skill-hub directory path
 */
function getSkillHubDir(): string {
  return join(homedir(), '.ccw', 'skill-hub');
}

/**
 * Get the cached skills directory
 */
function getCachedSkillsDir(): string {
  return join(getSkillHubDir(), 'cached');
}

/**
 * Get the local skills directory
 */
function getLocalSkillsDir(): string {
  return join(getSkillHubDir(), 'local');
}

/**
 * Get the installed skills tracking file path
 */
function getInstalledSkillsFile(): string {
  return join(getSkillHubDir(), 'installed.json');
}

/**
 * Ensure skill-hub directories exist
 */
function ensureSkillHubDirs(): void {
  const dirs = [getSkillHubDir(), getCachedSkillsDir(), getLocalSkillsDir()];
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Get CLI skills directory based on cliType
 */
function getCliSkillsDir(cliType: CliType): string {
  const cliDir = cliType === 'codex' ? '.codex' : '.claude';
  return join(homedir(), cliDir, 'skills');
}

// ============================================================================
// Skill Parsing Helpers
// ============================================================================

/**
 * Parse skill frontmatter (YAML header)
 */
function parseSkillFrontmatter(content: string): {
  name: string;
  description: string;
  version: string;
  author?: string;
  category?: string;
  tags?: string[];
} {
  const result = {
    name: '',
    description: '',
    version: '1.0.0',
    author: undefined as string | undefined,
    category: undefined as string | undefined,
    tags: undefined as string[] | undefined,
  };

  if (content.startsWith('---')) {
    const endIndex = content.indexOf('---', 3);
    if (endIndex > 0) {
      const frontmatter = content.substring(3, endIndex).trim();
      const lines = frontmatter.split('\n');

      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim().toLowerCase();
          const value = line.substring(colonIndex + 1).trim();

          switch (key) {
            case 'name':
              result.name = value.replace(/^["']|["']$/g, '');
              break;
            case 'description':
              result.description = value.replace(/^["']|["']$/g, '');
              break;
            case 'version':
              result.version = value.replace(/^["']|["']$/g, '');
              break;
            case 'author':
              result.author = value.replace(/^["']|["']$/g, '');
              break;
            case 'category':
              result.category = value.replace(/^["']|["']$/g, '');
              break;
            case 'tags':
              result.tags = value
                .replace(/^\[|\]$/g, '')
                .split(',')
                .map(t => t.trim())
                .filter(Boolean);
              break;
          }
        }
      }
    }
  }

  return result;
}

// ============================================================================
// Remote Skills Helpers
// ============================================================================

/**
 * Fetch remote skill index from GitHub
 */
async function fetchRemoteSkillIndex(): Promise<RemoteSkillIndex> {
  // Check cache
  const now = Date.now();
  if (remoteSkillsCache.data && (now - remoteSkillsCache.timestamp) < CACHE_TTL_MS) {
    return remoteSkillsCache.data;
  }

  const indexUrl = `https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${GITHUB_CONFIG.skillIndexPath}`;

  try {
    const response = await fetch(indexUrl);
    if (!response.ok) {
      // Try local fallback
      const localIndex = loadLocalIndex();
      if (localIndex) {
        return localIndex;
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const index = await response.json() as RemoteSkillIndex;
    index.source = 'github';

    // Update cache
    remoteSkillsCache = { data: index, timestamp: now };

    // Persist to local cache file
    saveCachedIndex(index);

    return index;
  } catch (error) {
    // Return cached data if available, even if expired
    if (remoteSkillsCache.data) {
      return remoteSkillsCache.data;
    }

    // Try local fallback
    const localIndex = loadLocalIndex();
    if (localIndex) {
      return localIndex;
    }

    throw error;
  }
}

/**
 * Load cached index from local file
 */
function loadLocalIndex(): RemoteSkillIndex | null {
  try {
    const cachedPath = join(getSkillHubDir(), 'index.json');
    if (existsSync(cachedPath)) {
      const content = readFileSync(cachedPath, 'utf8');
      const index = JSON.parse(content) as RemoteSkillIndex;
      index.source = 'local';
      return index;
    }
  } catch (error) {
    console.error('[SkillHub] Failed to load cached index:', error instanceof Error ? error.message : String(error));
  }
  return null;
}

/**
 * Save index to local cache
 */
function saveCachedIndex(index: RemoteSkillIndex): void {
  try {
    ensureSkillHubDirs();
    const cachedPath = join(getSkillHubDir(), 'index.json');
    writeFileSync(cachedPath, JSON.stringify(index, null, 2), 'utf8');
  } catch (error) {
    console.error('[SkillHub] Failed to save cached index:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Fetch a single skill from remote URL
 */
async function fetchRemoteSkill(downloadUrl: string): Promise<string> {
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch skill: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

// ============================================================================
// Local Skills Helpers
// ============================================================================

/**
 * List local shared skills from ~/.ccw/skill-hub/local/
 */
function listLocalSkills(): LocalSkillInfo[] {
  const result: LocalSkillInfo[] = [];
  const localDir = getLocalSkillsDir();

  if (!existsSync(localDir)) {
    return result;
  }

  try {
    const entries = readdirSync(localDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillDir = join(localDir, entry.name);
      const skillMdPath = join(skillDir, 'SKILL.md');

      if (!existsSync(skillMdPath)) continue;

      try {
        const content = readFileSync(skillMdPath, 'utf8');
        const parsed = parseSkillFrontmatter(content);
        const stat = statSync(skillMdPath);

        result.push({
          id: `local-${entry.name}`,
          name: parsed.name || entry.name,
          folderName: entry.name,
          description: parsed.description || '',
          version: parsed.version || '1.0.0',
          author: parsed.author,
          category: parsed.category,
          tags: parsed.tags,
          path: skillDir,
          source: 'local',
          updatedAt: stat.mtime.toISOString(),
        });
      } catch {
        // Skip invalid skills
      }
    }
  } catch (error) {
    console.error('[SkillHub] Failed to list local skills:', error);
  }

  return result;
}

// ============================================================================
// Installed Skills Tracking
// ============================================================================

interface InstalledSkillsRegistry {
  version: string;
  updatedAt: string;
  installed: InstalledSkillInfo[];
}

/**
 * Load installed skills registry
 */
function loadInstalledSkills(): InstalledSkillsRegistry {
  try {
    const filePath = getInstalledSkillsFile();
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf8');
      return JSON.parse(content) as InstalledSkillsRegistry;
    }
  } catch {
    // Ignore errors
  }

  return {
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
    installed: [],
  };
}

/**
 * Save installed skills registry
 */
function saveInstalledSkills(registry: InstalledSkillsRegistry): void {
  try {
    ensureSkillHubDirs();
    registry.updatedAt = new Date().toISOString();
    const filePath = getInstalledSkillsFile();
    writeFileSync(filePath, JSON.stringify(registry, null, 2), 'utf8');
  } catch (error) {
    console.error('[SkillHub] Failed to save installed skills:', error);
  }
}

/**
 * Add installed skill to registry
 */
function addInstalledSkill(info: InstalledSkillInfo): void {
  const registry = loadInstalledSkills();

  // Remove existing entry with same id
  registry.installed = registry.installed.filter(
    s => !(s.originalId === info.originalId && s.installedTo === info.installedTo)
  );

  registry.installed.push(info);
  saveInstalledSkills(registry);
}

/**
 * Remove installed skill from registry
 */
function removeInstalledSkill(skillId: string, cliType: CliType): void {
  const registry = loadInstalledSkills();
  registry.installed = registry.installed.filter(
    s => !(s.originalId === skillId && s.installedTo === cliType)
  );
  saveInstalledSkills(registry);
}

// ============================================================================
// Skill Installation Helpers
// ============================================================================

/**
 * Install skill from local path
 */
async function installSkillFromLocal(
  localPath: string,
  cliType: CliType,
  customName?: string
): Promise<{ success: boolean; message: string; installedPath?: string }> {
  try {
    // Validate source path exists
    if (!existsSync(localPath)) {
      return { success: false, message: 'Source skill path not found' };
    }

    // Validate source path is within allowed skill-hub directory
    const localSkillsDir = getLocalSkillsDir();
    const resolvedLocalPath = localPath;
    if (!resolvedLocalPath.startsWith(localSkillsDir)) {
      console.error('[SkillHub] Path traversal attempt blocked:', localPath);
      return { success: false, message: 'Invalid source path' };
    }

    // Read skill metadata
    const skillMdPath = join(localPath, 'SKILL.md');
    if (!existsSync(skillMdPath)) {
      return { success: false, message: 'SKILL.md not found in source' };
    }

    const content = readFileSync(skillMdPath, 'utf8');
    const parsed = parseSkillFrontmatter(content);
    const skillName = customName || parsed.name;

    if (!skillName) {
      return { success: false, message: 'Skill name is required' };
    }

    // Validate skill name with strict whitelist
    if (!isValidSkillName(skillName)) {
      console.error('[SkillHub] Invalid skill name rejected:', skillName);
      return { success: false, message: 'Invalid skill name. Only letters, numbers, dash and underscore allowed.' };
    }

    // Get target directory
    const targetDir = getCliSkillsDir(cliType);
    const targetSkillDir = join(targetDir, skillName);

    // Create target directory if needed
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    // Check if already exists
    if (existsSync(targetSkillDir)) {
      return { success: false, message: `Skill '${skillName}' already exists in ${cliType}` };
    }

    // Copy skill directory
    cpSync(localPath, targetSkillDir, { recursive: true });

    return {
      success: true,
      message: `Skill '${skillName}' installed to ${cliType}`,
      installedPath: targetSkillDir,
    };
  } catch (error) {
    return {
      success: false,
      message: sanitizeErrorMessage(error, 'Skill installation'),
    };
  }
}

/**
 * Install skill from remote URL
 */
async function installSkillFromRemote(
  downloadUrl: string,
  cliType: CliType,
  skillId: string,
  customName?: string
): Promise<{ success: boolean; message: string; installedPath?: string }> {
  try {
    // Validate URL for SSRF protection
    if (!isUrlAllowed(downloadUrl)) {
      console.error('[SkillHub] Blocked download from unauthorized URL:', downloadUrl);
      return { success: false, message: 'Download URL is not from an allowed source' };
    }

    // Fetch skill content
    const skillContent = await fetchRemoteSkill(downloadUrl);

    // Parse metadata
    const parsed = parseSkillFrontmatter(skillContent);
    const skillName = customName || parsed.name;

    if (!skillName) {
      return { success: false, message: 'Skill name is required' };
    }

    // Validate skill name with strict whitelist
    if (!isValidSkillName(skillName)) {
      console.error('[SkillHub] Invalid skill name rejected:', skillName);
      return { success: false, message: 'Invalid skill name. Only letters, numbers, dash and underscore allowed.' };
    }

    // Validate skillId for caching path safety
    if (!isValidSkillName(skillId.replace('remote-', '').replace('local-', ''))) {
      console.error('[SkillHub] Invalid skill ID rejected:', skillId);
      return { success: false, message: 'Invalid skill ID' };
    }

    // Get target directory
    const targetDir = getCliSkillsDir(cliType);
    const targetSkillDir = join(targetDir, skillName);

    // Create target directory if needed
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    // Check if already exists
    if (existsSync(targetSkillDir)) {
      return { success: false, message: `Skill '${skillName}' already exists in ${cliType}` };
    }

    // Create skill directory and write SKILL.md
    mkdirSync(targetSkillDir, { recursive: true });
    writeFileSync(join(targetSkillDir, 'SKILL.md'), skillContent, 'utf8');

    // Cache the skill locally
    try {
      ensureSkillHubDirs();
      const cachedDir = join(getCachedSkillsDir(), skillId);
      if (!existsSync(cachedDir)) {
        mkdirSync(cachedDir, { recursive: true });
      }
      writeFileSync(join(cachedDir, 'SKILL.md'), skillContent, 'utf8');
    } catch (cacheError) {
      // Log but don't fail - caching is optional
      console.error('[SkillHub] Failed to cache skill:', cacheError instanceof Error ? cacheError.message : String(cacheError));
    }

    return {
      success: true,
      message: `Skill '${skillName}' installed to ${cliType}`,
      installedPath: targetSkillDir,
    };
  } catch (error) {
    return {
      success: false,
      message: sanitizeErrorMessage(error, 'Skill installation'),
    };
  }
}

// ============================================================================
// Updates Check Helpers
// ============================================================================

/**
 * Check for available updates
 */
async function checkForUpdates(
  installedSkills: InstalledSkillInfo[],
  remoteSkills: RemoteSkillEntry[]
): Promise<InstalledSkillInfo[]> {
  const remoteMap = new Map(remoteSkills.map(s => [s.id, s]));

  return installedSkills.map(skill => {
    const remote = remoteMap.get(skill.originalId);
    if (remote && remote.version !== skill.version) {
      return {
        ...skill,
        updatesAvailable: true,
        latestVersion: remote.version,
      };
    }
    return {
      ...skill,
      updatesAvailable: false,
    };
  });
}

// ============================================================================
// Route Handler
// ============================================================================

/**
 * Handle skill hub routes
 * @returns true if route was handled, false otherwise
 */
export async function handleSkillHubRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, req, res, handlePostRequest } = ctx;

  // Ensure skill-hub directories exist
  ensureSkillHubDirs();

  // ==== LIST REMOTE SKILLS ====
  // GET /api/skill-hub/remote
  if (pathname === '/api/skill-hub/remote' && req.method === 'GET') {
    try {
      const index = await fetchRemoteSkillIndex();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: index.skills,
        meta: {
          version: index.version,
          updated_at: index.updated_at,
          source: index.source,
        },
        total: index.skills.length,
        timestamp: new Date().toISOString(),
      }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: (error as Error).message,
        message: 'Failed to fetch remote skills. Check network connectivity.',
      }));
      return true;
    }
  }

  // ==== LIST LOCAL SKILLS ====
  // GET /api/skill-hub/local
  if (pathname === '/api/skill-hub/local' && req.method === 'GET') {
    try {
      const skills = listLocalSkills();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: skills,
        total: skills.length,
        timestamp: new Date().toISOString(),
      }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: (error as Error).message,
      }));
      return true;
    }
  }

  // ==== LIST INSTALLED SKILLS ====
  // GET /api/skill-hub/installed
  if (pathname === '/api/skill-hub/installed' && req.method === 'GET') {
    try {
      const registry = loadInstalledSkills();

      // Optionally check for updates
      const checkUpdates = ctx.url.searchParams.get('checkUpdates') === 'true';
      let installed = registry.installed;

      if (checkUpdates) {
        try {
          const remoteIndex = await fetchRemoteSkillIndex();
          installed = await checkForUpdates(installed, remoteIndex.skills);
        } catch {
          // Ignore update check errors
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: installed,
        total: installed.length,
        timestamp: new Date().toISOString(),
      }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: (error as Error).message,
      }));
      return true;
    }
  }

  // ==== INSTALL SKILL ====
  // POST /api/skill-hub/install
  if (pathname === '/api/skill-hub/install' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { skillId, cliType, source, customName, downloadUrl } = body as SkillInstallRequest & { downloadUrl?: string };

      // Validation
      if (!skillId) {
        return { success: false, error: 'skillId is required', status: 400 };
      }

      if (cliType !== 'claude' && cliType !== 'codex') {
        return { success: false, error: 'cliType must be "claude" or "codex"', status: 400 };
      }

      if (source !== 'remote' && source !== 'local') {
        return { success: false, error: 'source must be "remote" or "local"', status: 400 };
      }

      try {
        let result;

        if (source === 'local') {
          // Install from local
          const localSkills = listLocalSkills();
          const localSkill = localSkills.find(s => s.id === skillId);

          if (!localSkill) {
            return { success: false, error: 'Local skill not found', status: 404 };
          }

          result = await installSkillFromLocal(localSkill.path, cliType, customName);
        } else {
          // Install from remote
          let url = downloadUrl;

          if (!url) {
            // Fetch from remote index
            const index = await fetchRemoteSkillIndex();
            const remoteSkill = index.skills.find(s => s.id === skillId);

            if (!remoteSkill) {
              return { success: false, error: 'Remote skill not found', status: 404 };
            }

            url = remoteSkill.downloadUrl;
          }

          result = await installSkillFromRemote(url, cliType, skillId, customName);
        }

        if (result.success) {
          // Track installation
          addInstalledSkill({
            id: `${skillId}-${cliType}`,
            name: customName || skillId,
            folderName: customName || skillId,
            version: '1.0.0', // Would need to parse from installed skill
            installedAt: new Date().toISOString(),
            installedTo: cliType,
            source: source,
            originalId: skillId,
          });
        }

        return result;
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message,
          status: 500,
        };
      }
    });
    return true;
  }

  // ==== CACHE REMOTE SKILL ====
  // POST /api/skill-hub/cache
  if (pathname === '/api/skill-hub/cache' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { skillId, downloadUrl } = body as SkillCacheRequest;

      if (!skillId || !downloadUrl) {
        return { success: false, error: 'skillId and downloadUrl are required', status: 400 };
      }

      try {
        const content = await fetchRemoteSkill(downloadUrl);

        ensureSkillHubDirs();
        const cachedDir = join(getCachedSkillsDir(), skillId);
        mkdirSync(cachedDir, { recursive: true });
        writeFileSync(join(cachedDir, 'SKILL.md'), content, 'utf8');

        return {
          success: true,
          message: 'Skill cached successfully',
          path: cachedDir,
        };
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message,
          status: 500,
        };
      }
    });
    return true;
  }

  // ==== CHECK UPDATES ====
  // GET /api/skill-hub/updates
  if (pathname === '/api/skill-hub/updates' && req.method === 'GET') {
    try {
      const registry = loadInstalledSkills();
      const remoteIndex = await fetchRemoteSkillIndex();
      const updated = await checkForUpdates(registry.installed, remoteIndex.skills);
      const updatesAvailable = updated.filter(s => s.updatesAvailable);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: updatesAvailable,
        total: updatesAvailable.length,
        timestamp: new Date().toISOString(),
      }));
      return true;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: (error as Error).message,
      }));
      return true;
    }
  }

  // ==== UNINSTALL SKILL ====
  // DELETE /api/skill-hub/installed/:id
  if (pathname.match(/^\/api\/skill-hub\/installed\/[^/]+$/) && req.method === 'DELETE') {
    const skillId = pathname.split('/').pop();

    handlePostRequest(req, res, async (body) => {
      const { cliType } = body as { cliType: CliType };

      if (!cliType) {
        return { success: false, error: 'cliType is required', status: 400 };
      }

      try {
        const registry = loadInstalledSkills();
        const installed = registry.installed.find(
          s => s.id === skillId && s.installedTo === cliType
        );

        if (!installed) {
          return { success: false, error: 'Installed skill not found', status: 404 };
        }

        // Remove skill directory
        const skillDir = join(getCliSkillsDir(cliType), installed.folderName);
        if (existsSync(skillDir)) {
          rmSync(skillDir, { recursive: true, force: true });
        }

        // Remove from registry
        removeInstalledSkill(installed.originalId, cliType);

        return { success: true, message: 'Skill uninstalled' };
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message,
          status: 500,
        };
      }
    });
    return true;
  }

  return false;
}
