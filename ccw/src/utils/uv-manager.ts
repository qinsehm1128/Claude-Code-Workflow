/**
 * UV Package Manager Tool
 * Provides unified UV (https://github.com/astral-sh/uv) tool management capabilities
 *
 * Features:
 * - Cross-platform UV binary discovery and installation
 * - Virtual environment creation and management
 * - Python dependency installation with UV's fast resolver
 * - Support for local project installs with extras
 */

import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir, platform, arch } from 'os';
import { EXEC_TIMEOUTS } from './exec-constants.js';
import { getCodexLensDataDir, getCodexLensVenvDir } from './codexlens-path.js';

/**
 * Configuration for UvManager
 */
export interface UvManagerConfig {
  /** Path to the virtual environment directory */
  venvPath: string;
  /** Python version requirement (e.g., ">=3.10", "3.11") */
  pythonVersion?: string;
}

/**
 * Result of UV operations
 */
export interface UvInstallResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Error message if operation failed */
  error?: string;
  /** Duration of the operation in milliseconds */
  duration?: number;
}

/**
 * UV binary search locations in priority order
 */
interface UvSearchLocation {
  path: string;
  description: string;
}

// Platform-specific constants
const IS_WINDOWS = platform() === 'win32';
const UV_BINARY_NAME = IS_WINDOWS ? 'uv.exe' : 'uv';
const VENV_BIN_DIR = IS_WINDOWS ? 'Scripts' : 'bin';
const PYTHON_EXECUTABLE = IS_WINDOWS ? 'python.exe' : 'python';

/**
 * Get the path to the UV binary
 * Search order:
 * 1. CCW_UV_PATH environment variable
 * 2. Project vendor/uv/ directory
 * 3. User local directories (~/.local/bin, ~/.cargo/bin)
 * 4. System PATH
 *
 * @returns Path to the UV binary
 */
export function getUvBinaryPath(): string {
  const searchLocations: UvSearchLocation[] = [];

  // 1. Environment variable (highest priority)
  const envPath = process.env.CCW_UV_PATH;
  if (envPath) {
    searchLocations.push({ path: envPath, description: 'CCW_UV_PATH environment variable' });
  }

  // 2. Project vendor directory
  const vendorPaths = [
    join(process.cwd(), 'vendor', 'uv', UV_BINARY_NAME),
    join(dirname(process.cwd()), 'vendor', 'uv', UV_BINARY_NAME),
  ];
  for (const vendorPath of vendorPaths) {
    searchLocations.push({ path: vendorPath, description: 'Project vendor directory' });
  }

  // 3. User local directories
  const home = homedir();
  if (IS_WINDOWS) {
    // Windows: AppData\Local\uv and .cargo\bin
    searchLocations.push(
      { path: join(home, 'AppData', 'Local', 'uv', 'bin', UV_BINARY_NAME), description: 'UV AppData' },
      { path: join(home, '.cargo', 'bin', UV_BINARY_NAME), description: 'Cargo bin' },
      { path: join(home, '.local', 'bin', UV_BINARY_NAME), description: 'Local bin' },
    );
  } else {
    // Unix: ~/.local/bin and ~/.cargo/bin
    searchLocations.push(
      { path: join(home, '.local', 'bin', UV_BINARY_NAME), description: 'Local bin' },
      { path: join(home, '.cargo', 'bin', UV_BINARY_NAME), description: 'Cargo bin' },
    );
  }

  // Check each location
  for (const location of searchLocations) {
    if (existsSync(location.path)) {
      return location.path;
    }
  }

  // 4. Try system PATH using 'which' or 'where'
  try {
    const cmd = IS_WINDOWS ? 'where uv' : 'which uv';
    const result = execSync(cmd, { encoding: 'utf-8', timeout: EXEC_TIMEOUTS.SYSTEM_INFO, stdio: ['pipe', 'pipe', 'pipe'] });
    const foundPath = result.trim().split('\n')[0];
    if (foundPath && existsSync(foundPath)) {
      return foundPath;
    }
  } catch {
    // UV not found in PATH
  }

  // Return default path (may not exist)
  if (IS_WINDOWS) {
    return join(home, 'AppData', 'Local', 'uv', 'bin', UV_BINARY_NAME);
  }
  return join(home, '.local', 'bin', UV_BINARY_NAME);
}

/**
 * Check if UV is available and working
 * @returns True if UV is installed and functional
 */
export async function isUvAvailable(): Promise<boolean> {
  const uvPath = getUvBinaryPath();

  if (!existsSync(uvPath)) {
    return false;
  }

  return new Promise((resolve) => {
    const child = spawn(uvPath, ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: EXEC_TIMEOUTS.PYTHON_VERSION,
    });

    child.on('close', (code) => {
      resolve(code === 0);
    });

    child.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Get UV version string
 * @returns UV version or null if not available
 */
export async function getUvVersion(): Promise<string | null> {
  const uvPath = getUvBinaryPath();

  if (!existsSync(uvPath)) {
    return null;
  }

  return new Promise((resolve) => {
    const child = spawn(uvPath, ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: EXEC_TIMEOUTS.PYTHON_VERSION,
    });

    let stdout = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        // Parse "uv 0.4.0" -> "0.4.0"
        const match = stdout.match(/uv\s+(\S+)/);
        resolve(match ? match[1] : stdout.trim());
      } else {
        resolve(null);
      }
    });

    child.on('error', () => {
      resolve(null);
    });
  });
}

/**
 * Download and install UV using the official installation script
 * @returns True if installation succeeded
 */
export async function ensureUvInstalled(): Promise<boolean> {
  // Check if already installed
  if (await isUvAvailable()) {
    return true;
  }

  console.log('[UV] Installing UV package manager...');

  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;

    if (IS_WINDOWS) {
      // Windows: Use PowerShell to run the install script
      const installCmd = 'irm https://astral.sh/uv/install.ps1 | iex';
      child = spawn('powershell', ['-ExecutionPolicy', 'ByPass', '-Command', installCmd], {
        stdio: 'inherit',
        timeout: EXEC_TIMEOUTS.PACKAGE_INSTALL,
      });
    } else {
      // Unix: Use curl and sh
      const installCmd = 'curl -LsSf https://astral.sh/uv/install.sh | sh';
      child = spawn('sh', ['-c', installCmd], {
        stdio: 'inherit',
        timeout: EXEC_TIMEOUTS.PACKAGE_INSTALL,
      });
    }

    child.on('close', (code) => {
      if (code === 0) {
        console.log('[UV] UV installed successfully');
        resolve(true);
      } else {
        console.error(`[UV] Installation failed with code ${code}`);
        resolve(false);
      }
    });

    child.on('error', (err) => {
      console.error(`[UV] Installation failed: ${err.message}`);
      resolve(false);
    });
  });
}

/**
 * UvManager class for virtual environment and package management
 */
export class UvManager {
  private readonly venvPath: string;
  private readonly pythonVersion?: string;

  /**
   * Create a new UvManager instance
   * @param config - Configuration options
   */
  constructor(config: UvManagerConfig) {
    this.venvPath = config.venvPath;
    this.pythonVersion = config.pythonVersion;
  }

  /**
   * Get the path to the Python executable inside the virtual environment
   * @returns Path to the Python executable
   */
  getVenvPython(): string {
    return join(this.venvPath, VENV_BIN_DIR, PYTHON_EXECUTABLE);
  }

  /**
   * Get the path to pip inside the virtual environment
   * @returns Path to the pip executable
   */
  getVenvPip(): string {
    const pipName = IS_WINDOWS ? 'pip.exe' : 'pip';
    return join(this.venvPath, VENV_BIN_DIR, pipName);
  }

  /**
   * Check if the virtual environment exists and is valid
   * @returns True if the venv exists and has a working Python
   */
  isVenvValid(): boolean {
    const pythonPath = this.getVenvPython();
    return existsSync(pythonPath);
  }

  /**
   * Create a virtual environment using UV
   * @returns Installation result
   */
  async createVenv(): Promise<UvInstallResult> {
    const startTime = Date.now();

    // Ensure UV is available
    if (!(await isUvAvailable())) {
      const installed = await ensureUvInstalled();
      if (!installed) {
        return { success: false, error: 'Failed to install UV' };
      }
    }

    const uvPath = getUvBinaryPath();

    // Ensure parent directory exists
    const parentDir = dirname(this.venvPath);
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }

    return new Promise((resolve) => {
      const args = ['venv', this.venvPath];

      // Add Python version constraint if specified
      if (this.pythonVersion) {
        args.push('--python', this.pythonVersion);
      }

      console.log(`[UV] Creating virtual environment at ${this.venvPath}`);
      if (this.pythonVersion) {
        console.log(`[UV] Python version: ${this.pythonVersion}`);
      }

      const child = spawn(uvPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: EXEC_TIMEOUTS.PROCESS_SPAWN,
      });

      let stderr = '';

      child.stdout.on('data', (data) => {
        const line = data.toString().trim();
        if (line) {
          console.log(`[UV] ${line}`);
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
        const line = data.toString().trim();
        if (line) {
          console.log(`[UV] ${line}`);
        }
      });

      child.on('close', (code) => {
        const duration = Date.now() - startTime;
        if (code === 0) {
          console.log(`[UV] Virtual environment created successfully (${duration}ms)`);
          resolve({ success: true, duration });
        } else {
          resolve({ success: false, error: stderr || `Process exited with code ${code}`, duration });
        }
      });

      child.on('error', (err) => {
        const duration = Date.now() - startTime;
        resolve({ success: false, error: `Failed to spawn UV: ${err.message}`, duration });
      });
    });
  }

  /**
   * Install packages from a local project with optional extras
   * Uses `uv pip install` for standard installs, or `-e` for editable installs
   * @param projectPath - Path to the project directory (must contain pyproject.toml or setup.py)
   * @param extras - Optional array of extras to install (e.g., ['semantic', 'dev'])
   * @param editable - Whether to install in editable mode (default: false for stability)
   * @returns Installation result
   */
  async installFromProject(projectPath: string, extras?: string[], editable = false): Promise<UvInstallResult> {
    const startTime = Date.now();

    // Ensure UV is available
    if (!(await isUvAvailable())) {
      return { success: false, error: 'UV is not available' };
    }

    // Ensure venv exists
    if (!this.isVenvValid()) {
      return { success: false, error: 'Virtual environment does not exist. Call createVenv() first.' };
    }

    const uvPath = getUvBinaryPath();

    // Build the install specifier
    let installSpec = projectPath;
    if (extras && extras.length > 0) {
      installSpec = `${projectPath}[${extras.join(',')}]`;
    }

    return new Promise((resolve) => {
      const args = editable
        ? ['pip', 'install', '-e', installSpec, '--python', this.getVenvPython()]
        : ['pip', 'install', installSpec, '--python', this.getVenvPython()];

      console.log(`[UV] Installing from project: ${installSpec} (editable: ${editable})`);

      const child = spawn(uvPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: EXEC_TIMEOUTS.PACKAGE_INSTALL,
        cwd: projectPath,
      });

      let stderr = '';

      child.stdout.on('data', (data) => {
        const line = data.toString().trim();
        if (line) {
          console.log(`[UV] ${line}`);
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
        const line = data.toString().trim();
        if (line && !line.startsWith('Resolved') && !line.startsWith('Prepared') && !line.startsWith('Installed')) {
          // Only log non-progress lines to stderr
          console.log(`[UV] ${line}`);
        }
      });

      child.on('close', (code) => {
        const duration = Date.now() - startTime;
        if (code === 0) {
          console.log(`[UV] Project installation successful (${duration}ms)`);
          resolve({ success: true, duration });
        } else {
          resolve({ success: false, error: stderr || `Process exited with code ${code}`, duration });
        }
      });

      child.on('error', (err) => {
        const duration = Date.now() - startTime;
        resolve({ success: false, error: `Failed to spawn UV: ${err.message}`, duration });
      });
    });
  }

  /**
   * Install a list of packages
   * @param packages - Array of package specifiers (e.g., ['numpy>=1.24', 'requests'])
   * @returns Installation result
   */
  async install(packages: string[]): Promise<UvInstallResult> {
    const startTime = Date.now();

    if (packages.length === 0) {
      return { success: true, duration: 0 };
    }

    // Ensure UV is available
    if (!(await isUvAvailable())) {
      return { success: false, error: 'UV is not available' };
    }

    // Ensure venv exists
    if (!this.isVenvValid()) {
      return { success: false, error: 'Virtual environment does not exist. Call createVenv() first.' };
    }

    const uvPath = getUvBinaryPath();

    return new Promise((resolve) => {
      const args = ['pip', 'install', ...packages, '--python', this.getVenvPython()];

      console.log(`[UV] Installing packages: ${packages.join(', ')}`);

      const child = spawn(uvPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: EXEC_TIMEOUTS.PACKAGE_INSTALL,
      });

      let stderr = '';

      child.stdout.on('data', (data) => {
        const line = data.toString().trim();
        if (line) {
          console.log(`[UV] ${line}`);
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        const duration = Date.now() - startTime;
        if (code === 0) {
          console.log(`[UV] Package installation successful (${duration}ms)`);
          resolve({ success: true, duration });
        } else {
          resolve({ success: false, error: stderr || `Process exited with code ${code}`, duration });
        }
      });

      child.on('error', (err) => {
        const duration = Date.now() - startTime;
        resolve({ success: false, error: `Failed to spawn UV: ${err.message}`, duration });
      });
    });
  }

  /**
   * Uninstall packages
   * @param packages - Array of package names to uninstall
   * @returns Uninstall result
   */
  async uninstall(packages: string[]): Promise<UvInstallResult> {
    const startTime = Date.now();

    if (packages.length === 0) {
      return { success: true, duration: 0 };
    }

    // Ensure UV is available
    if (!(await isUvAvailable())) {
      return { success: false, error: 'UV is not available' };
    }

    // Ensure venv exists
    if (!this.isVenvValid()) {
      return { success: false, error: 'Virtual environment does not exist.' };
    }

    const uvPath = getUvBinaryPath();

    return new Promise((resolve) => {
      const args = ['pip', 'uninstall', ...packages, '--python', this.getVenvPython()];

      console.log(`[UV] Uninstalling packages: ${packages.join(', ')}`);

      const child = spawn(uvPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: EXEC_TIMEOUTS.PACKAGE_INSTALL,
      });

      let stderr = '';

      child.stdout.on('data', (data) => {
        const line = data.toString().trim();
        if (line) {
          console.log(`[UV] ${line}`);
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        const duration = Date.now() - startTime;
        if (code === 0) {
          console.log(`[UV] Package uninstallation successful (${duration}ms)`);
          resolve({ success: true, duration });
        } else {
          resolve({ success: false, error: stderr || `Process exited with code ${code}`, duration });
        }
      });

      child.on('error', (err) => {
        const duration = Date.now() - startTime;
        resolve({ success: false, error: `Failed to spawn UV: ${err.message}`, duration });
      });
    });
  }

  /**
   * Sync dependencies from a requirements file or pyproject.toml
   * Uses `uv pip sync` for deterministic installs
   * @param requirementsPath - Path to requirements.txt or pyproject.toml
   * @returns Sync result
   */
  async sync(requirementsPath: string): Promise<UvInstallResult> {
    const startTime = Date.now();

    // Ensure UV is available
    if (!(await isUvAvailable())) {
      return { success: false, error: 'UV is not available' };
    }

    // Ensure venv exists
    if (!this.isVenvValid()) {
      return { success: false, error: 'Virtual environment does not exist. Call createVenv() first.' };
    }

    const uvPath = getUvBinaryPath();

    return new Promise((resolve) => {
      const args = ['pip', 'sync', requirementsPath, '--python', this.getVenvPython()];

      console.log(`[UV] Syncing dependencies from: ${requirementsPath}`);

      const child = spawn(uvPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: EXEC_TIMEOUTS.PACKAGE_INSTALL,
      });

      let stderr = '';

      child.stdout.on('data', (data) => {
        const line = data.toString().trim();
        if (line) {
          console.log(`[UV] ${line}`);
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        const duration = Date.now() - startTime;
        if (code === 0) {
          console.log(`[UV] Sync successful (${duration}ms)`);
          resolve({ success: true, duration });
        } else {
          resolve({ success: false, error: stderr || `Process exited with code ${code}`, duration });
        }
      });

      child.on('error', (err) => {
        const duration = Date.now() - startTime;
        resolve({ success: false, error: `Failed to spawn UV: ${err.message}`, duration });
      });
    });
  }

  /**
   * List installed packages in the virtual environment
   * @returns List of installed packages or null on error
   */
  async list(): Promise<{ name: string; version: string }[] | null> {
    // Ensure UV is available
    if (!(await isUvAvailable())) {
      return null;
    }

    // Ensure venv exists
    if (!this.isVenvValid()) {
      return null;
    }

    const uvPath = getUvBinaryPath();

    return new Promise((resolve) => {
      const args = ['pip', 'list', '--format', 'json', '--python', this.getVenvPython()];

      const child = spawn(uvPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: EXEC_TIMEOUTS.PROCESS_SPAWN,
      });

      let stdout = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          try {
            const packages = JSON.parse(stdout);
            resolve(packages);
          } catch {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });

      child.on('error', () => {
        resolve(null);
      });
    });
  }

  /**
   * Check if a specific package is installed
   * @param packageName - Name of the package to check
   * @returns True if the package is installed
   */
  async isPackageInstalled(packageName: string): Promise<boolean> {
    const packages = await this.list();
    if (!packages) {
      return false;
    }

    const normalizedName = packageName.toLowerCase().replace(/-/g, '_');
    return packages.some(
      (pkg) => pkg.name.toLowerCase().replace(/-/g, '_') === normalizedName
    );
  }

  /**
   * Run a Python command in the virtual environment
   * @param args - Arguments to pass to Python
   * @param options - Spawn options
   * @returns Result with stdout/stderr
   */
  async runPython(
    args: string[],
    options: { timeout?: number; cwd?: string } = {}
  ): Promise<{ success: boolean; stdout: string; stderr: string }> {
    const pythonPath = this.getVenvPython();

    if (!existsSync(pythonPath)) {
      return { success: false, stdout: '', stderr: 'Virtual environment does not exist' };
    }

    return new Promise((resolve) => {
      const child = spawn(pythonPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: options.timeout ?? EXEC_TIMEOUTS.PROCESS_SPAWN,
        cwd: options.cwd,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ success: code === 0, stdout: stdout.trim(), stderr: stderr.trim() });
      });

      child.on('error', (err) => {
        resolve({ success: false, stdout: '', stderr: err.message });
      });
    });
  }

  /**
   * Get Python version in the virtual environment
   * @returns Python version string or null
   */
  async getPythonVersion(): Promise<string | null> {
    const result = await this.runPython(['--version']);
    if (result.success) {
      const match = result.stdout.match(/Python\s+(\S+)/);
      return match ? match[1] : null;
    }
    return null;
  }

  /**
   * Delete the virtual environment
   * @returns True if deletion succeeded
   */
  async deleteVenv(): Promise<boolean> {
    if (!existsSync(this.venvPath)) {
      return true;
    }

    try {
      const fs = await import('fs');
      fs.rmSync(this.venvPath, { recursive: true, force: true });
      console.log(`[UV] Virtual environment deleted: ${this.venvPath}`);
      return true;
    } catch (err) {
      console.error(`[UV] Failed to delete venv: ${(err as Error).message}`);
      return false;
    }
  }
}

/**
 * Create a UvManager with default settings for CodexLens
 * @param dataDir - Base data directory (defaults to ~/.codexlens)
 * @returns Configured UvManager instance
 */
export function createCodexLensUvManager(dataDir?: string): UvManager {
  const baseDir = dataDir ?? getCodexLensDataDir();
  return new UvManager({
    venvPath: getCodexLensVenvDir(),
    pythonVersion: '>=3.10,<3.13', // onnxruntime compatibility
  });
}

/**
 * Quick bootstrap function: ensure UV is installed and create a venv
 * @param venvPath - Path to the virtual environment
 * @param pythonVersion - Optional Python version constraint
 * @returns Installation result
 */
export async function bootstrapUvVenv(
  venvPath: string,
  pythonVersion?: string
): Promise<UvInstallResult> {
  // Ensure UV is installed first
  const uvInstalled = await ensureUvInstalled();
  if (!uvInstalled) {
    return { success: false, error: 'Failed to install UV' };
  }

  // Create the venv
  const manager = new UvManager({ venvPath, pythonVersion });
  return manager.createVenv();
}
