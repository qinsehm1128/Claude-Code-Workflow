/**
 * Unified Package Discovery for local Python packages (codex-lens, ccw-litellm)
 *
 * Provides a single, transparent path discovery mechanism with:
 * - Environment variable overrides (highest priority)
 * - ~/.codexlens/config.json configuration
 * - Extended search paths (npm global, PACKAGE_ROOT, siblings, etc.)
 * - Full search result transparency for diagnostics
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { getCodexLensDataDir } from './codexlens-path.js';
import { EXEC_TIMEOUTS } from './exec-constants.js';

// Get directory of this module (src/utils/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ========================================
// Types
// ========================================

/** Source that found the package path */
export type PackageSource =
  | 'env'           // Environment variable override
  | 'config'        // ~/.codexlens/config.json
  | 'sibling'       // Sibling directory to ccw project root
  | 'npm-global'    // npm global prefix
  | 'cwd'           // Current working directory
  | 'cwd-parent'    // Parent of current working directory
  | 'homedir'       // User home directory
  | 'package-root'; // npm package internal path

/** A single search attempt result */
export interface SearchAttempt {
  path: string;
  source: PackageSource;
  exists: boolean;
}

/** Result of package discovery */
export interface PackageDiscoveryResult {
  /** Resolved package path, or null if not found */
  path: string | null;
  /** Source that found the package */
  source: PackageSource | null;
  /** All paths searched (for diagnostics) */
  searchedPaths: SearchAttempt[];
  /** Whether the found path is inside node_modules */
  insideNodeModules: boolean;
}

/** Known local package names */
export type LocalPackageName = 'codex-lens' | 'ccw-litellm';

/** Environment variable mapping for each package */
const PACKAGE_ENV_VARS: Record<LocalPackageName, string> = {
  'codex-lens': 'CODEXLENS_PACKAGE_PATH',
  'ccw-litellm': 'CCW_LITELLM_PATH',
};

/** Config key mapping for each package */
const PACKAGE_CONFIG_KEYS: Record<LocalPackageName, string> = {
  'codex-lens': 'codexLensPath',
  'ccw-litellm': 'ccwLitellmPath',
};

// ========================================
// Helpers
// ========================================

/**
 * Check if a path is inside node_modules
 */
export function isInsideNodeModules(pathToCheck: string): boolean {
  const normalized = pathToCheck.replace(/\\/g, '/').toLowerCase();
  return normalized.includes('/node_modules/');
}

/**
 * Check if running in a development environment (not from node_modules)
 */
export function isDevEnvironment(): boolean {
  // Yarn PnP detection
  if ((process.versions as Record<string, unknown>).pnp) {
    return false;
  }
  return !isInsideNodeModules(__dirname);
}

/**
 * Read package paths from ~/.codexlens/config.json
 */
function readConfigPath(packageName: LocalPackageName): string | null {
  try {
    const configPath = join(getCodexLensDataDir(), 'config.json');
    if (!existsSync(configPath)) return null;

    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    const key = PACKAGE_CONFIG_KEYS[packageName];
    const value = config?.packagePaths?.[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Get npm global prefix directory
 */
let _npmGlobalPrefix: string | null | undefined;
function getNpmGlobalPrefix(): string | null {
  if (_npmGlobalPrefix !== undefined) return _npmGlobalPrefix;

  try {
    const result = execSync('npm prefix -g', {
      encoding: 'utf-8',
      timeout: EXEC_TIMEOUTS.SYSTEM_INFO,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    _npmGlobalPrefix = result.trim() || null;
  } catch {
    _npmGlobalPrefix = null;
  }
  return _npmGlobalPrefix;
}

/**
 * Check if a directory contains a valid Python package (has pyproject.toml)
 */
function isValidPackageDir(dir: string): boolean {
  return existsSync(join(dir, 'pyproject.toml'));
}

// ========================================
// Main Discovery Function
// ========================================

/**
 * Find a local Python package path with unified search logic.
 *
 * Search priority:
 * 1. Environment variable (CODEXLENS_PACKAGE_PATH / CCW_LITELLM_PATH)
 * 2. ~/.codexlens/config.json packagePaths
 * 3. Sibling directory to ccw project root (src/utils -> ../../..)
 * 4. npm global prefix node_modules path
 * 5. Current working directory
 * 6. Parent of current working directory
 * 7. Home directory
 *
 * Two-pass search: first pass skips node_modules paths, second pass allows them.
 *
 * @param packageName - Package to find ('codex-lens' or 'ccw-litellm')
 * @returns Discovery result with path, source, and all searched paths
 */
export function findPackagePath(packageName: LocalPackageName): PackageDiscoveryResult {
  const searched: SearchAttempt[] = [];

  // Helper to check and record a path
  const check = (path: string, source: PackageSource): boolean => {
    const resolvedPath = resolve(path);
    const exists = isValidPackageDir(resolvedPath);
    searched.push({ path: resolvedPath, source, exists });
    return exists;
  };

  // 1. Environment variable (highest priority, skip two-pass)
  const envKey = PACKAGE_ENV_VARS[packageName];
  const envPath = process.env[envKey];
  if (envPath) {
    if (check(envPath, 'env')) {
      return {
        path: resolve(envPath),
        source: 'env',
        searchedPaths: searched,
        insideNodeModules: isInsideNodeModules(envPath),
      };
    }
    // Env var set but path invalid — continue searching but warn
    console.warn(`[PackageDiscovery] ${envKey}="${envPath}" set but pyproject.toml not found, continuing search...`);
  }

  // 2. Config file
  const configPath = readConfigPath(packageName);
  if (configPath) {
    if (check(configPath, 'config')) {
      return {
        path: resolve(configPath),
        source: 'config',
        searchedPaths: searched,
        insideNodeModules: isInsideNodeModules(configPath),
      };
    }
  }

  // Build candidate paths for two-pass search
  const candidates: { path: string; source: PackageSource }[] = [];

  // 3. Sibling directory to ccw project root
  //    __dirname = src/utils/ → project root = ../../..
  //    Also try one more level up for nested structures
  const projectRoot = join(__dirname, '..', '..', '..');
  candidates.push({ path: join(projectRoot, packageName), source: 'sibling' });
  candidates.push({ path: join(projectRoot, '..', packageName), source: 'sibling' });

  // 4. npm global prefix
  const npmPrefix = getNpmGlobalPrefix();
  if (npmPrefix) {
    // npm global: prefix/node_modules/claude-code-workflow/<packageName>
    candidates.push({
      path: join(npmPrefix, 'node_modules', 'claude-code-workflow', packageName),
      source: 'npm-global',
    });
    // npm global: prefix/lib/node_modules/claude-code-workflow/<packageName> (Linux/Mac)
    candidates.push({
      path: join(npmPrefix, 'lib', 'node_modules', 'claude-code-workflow', packageName),
      source: 'npm-global',
    });
    // npm global sibling: prefix/node_modules/<packageName>
    candidates.push({
      path: join(npmPrefix, 'node_modules', packageName),
      source: 'npm-global',
    });
  }

  // 5. Current working directory
  const cwd = process.cwd();
  candidates.push({ path: join(cwd, packageName), source: 'cwd' });

  // 6. Parent of cwd (common workspace layout)
  const cwdParent = dirname(cwd);
  if (cwdParent !== cwd) {
    candidates.push({ path: join(cwdParent, packageName), source: 'cwd-parent' });
  }

  // 7. Home directory
  candidates.push({ path: join(homedir(), packageName), source: 'homedir' });

  // Two-pass search: prefer non-node_modules paths first
  // First pass: skip node_modules
  for (const candidate of candidates) {
    const resolvedPath = resolve(candidate.path);
    if (isInsideNodeModules(resolvedPath)) continue;
    if (check(resolvedPath, candidate.source)) {
      console.log(`[PackageDiscovery] Found ${packageName} at: ${resolvedPath} (source: ${candidate.source})`);
      return {
        path: resolvedPath,
        source: candidate.source,
        searchedPaths: searched,
        insideNodeModules: false,
      };
    }
  }

  // Second pass: allow node_modules paths
  for (const candidate of candidates) {
    const resolvedPath = resolve(candidate.path);
    if (!isInsideNodeModules(resolvedPath)) continue;
    // Skip if already checked in first pass
    if (searched.some(s => s.path === resolvedPath)) continue;
    if (check(resolvedPath, candidate.source)) {
      console.log(`[PackageDiscovery] Found ${packageName} in node_modules at: ${resolvedPath} (source: ${candidate.source})`);
      return {
        path: resolvedPath,
        source: candidate.source,
        searchedPaths: searched,
        insideNodeModules: true,
      };
    }
  }

  // Not found
  return {
    path: null,
    source: null,
    searchedPaths: searched,
    insideNodeModules: false,
  };
}

/**
 * Find codex-lens package path (convenience wrapper)
 */
export function findCodexLensPath(): PackageDiscoveryResult {
  return findPackagePath('codex-lens');
}

/**
 * Find ccw-litellm package path (convenience wrapper)
 */
export function findCcwLitellmPath(): PackageDiscoveryResult {
  return findPackagePath('ccw-litellm');
}

/**
 * Format search results for error messages
 */
export function formatSearchResults(result: PackageDiscoveryResult, packageName: string): string {
  const lines = [`Cannot find '${packageName}' package directory.\n`];
  lines.push('Searched locations:');
  for (const attempt of result.searchedPaths) {
    const status = attempt.exists ? '✓' : '✗';
    lines.push(`  ${status} [${attempt.source}] ${attempt.path}`);
  }
  lines.push('');
  lines.push('To fix this:');

  const envKey = PACKAGE_ENV_VARS[packageName as LocalPackageName] || `${packageName.toUpperCase().replace(/-/g, '_')}_PATH`;
  lines.push(`  1. Set environment variable: ${envKey}=/path/to/${packageName}`);
  lines.push(`  2. Or add to ~/.codexlens/config.json: { "packagePaths": { "${PACKAGE_CONFIG_KEYS[packageName as LocalPackageName] || packageName}": "/path/to/${packageName}" } }`);
  lines.push(`  3. Or ensure '${packageName}' directory exists as a sibling to the ccw project`);

  return lines.join('\n');
}
