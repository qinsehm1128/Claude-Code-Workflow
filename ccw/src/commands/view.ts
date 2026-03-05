import { serveCommand } from './serve.js';
import { launchBrowser } from '../utils/browser-launcher.js';
import { validatePath } from '../utils/path-resolver.js';
import { checkForUpdates } from '../utils/update-checker.js';
import chalk from 'chalk';

interface ViewOptions {
  port?: number;
  path?: string;
  host?: string;
  browser?: boolean;
}

interface SwitchWorkspaceResult {
  success: boolean;
  path?: string;
  error?: string;
}

/**
 * Safely parse JSON response with content-type validation
 * Provides better error messages when response is not JSON (e.g., proxy errors)
 */
async function safeParseJson<T>(response: Response, endpoint: string): Promise<T> {
  const contentType = response.headers.get('content-type') || 'unknown';
  const isJson = contentType.includes('application/json');

  const truncate = (text: string, maxLen: number = 200): string => {
    const trimmed = text.trim();
    if (trimmed.length <= maxLen) return trimmed;
    return `${trimmed.slice(0, maxLen)}…`;
  };

  const isApiKeyProxyMessage = (text: string): boolean => {
    return /APIKEY|api\s*key|apiKey/i.test(text);
  };

  // If response claims to not be JSON, surface a helpful error with a preview.
  if (!isJson) {
    const text = await response.text();
    const preview = truncate(text);

    if (isApiKeyProxyMessage(text)) {
      throw new Error(
        `Request to ${endpoint} was intercepted by a proxy requiring an API key. ` +
        `Check HTTP_PROXY/HTTPS_PROXY environment variables. ` +
        `Response: ${preview}`
      );
    }

    throw new Error(
      `Unexpected response from ${endpoint} (expected JSON, got: ${contentType}). ` +
      `This may indicate a proxy or network issue. Response: ${preview}`
    );
  }

  // Read text once so we can provide good errors even when JSON parsing fails.
  const text = await response.text();
  const preview = truncate(text);

  // Check for HTTP errors first; try to parse error JSON if possible.
  if (!response.ok) {
    if (isApiKeyProxyMessage(text)) {
      throw new Error(
        `Request to ${endpoint} was intercepted by a proxy requiring an API key. ` +
        `Check HTTP_PROXY/HTTPS_PROXY environment variables. ` +
        `Response: ${preview}`
      );
    }

    let errorMessage = response.statusText;
    if (text.trim()) {
      try {
        const body = JSON.parse(text) as { error?: string; message?: string };
        errorMessage = body.error || body.message || response.statusText;
      } catch {
        errorMessage = `${response.statusText} (invalid JSON body)`;
      }
    }

    throw new Error(`HTTP ${response.status}: ${errorMessage}${preview ? `. Response: ${preview}` : ''}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    if (isApiKeyProxyMessage(text)) {
      throw new Error(
        `Request to ${endpoint} was intercepted by a proxy requiring an API key. ` +
        `Check HTTP_PROXY/HTTPS_PROXY environment variables. ` +
        `Response: ${preview}`
      );
    }

    throw new Error(
      `Unexpected response from ${endpoint} (invalid JSON despite content-type: ${contentType}). ` +
      `This may indicate a proxy or network issue. Response: ${preview}`
    );
  }
}

/**
 * Check if server is already running on the specified port
 * @param {number} port - Port to check
 * @returns {Promise<boolean>} True if server is running
 */
async function isServerRunning(port: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);

    const response = await fetch(`http://localhost:${port}/api/health`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    // Authenticated APIs may return 401; any HTTP response means server is running.
    return response.status > 0;
  } catch {
    return false;
  }
}

/**
 * Switch workspace on running server
 * @param {number} port - Server port
 * @param {string} path - New workspace path
 * @returns {Promise<Object>} Result with success status
 */
async function switchWorkspace(port: number, path: string): Promise<SwitchWorkspaceResult> {
  try {
    // Get auth token with content-type validation
    const tokenResponse = await fetch(`http://localhost:${port}/api/auth/token`);
    const tokenData = await safeParseJson<{ token?: string; expiresAt?: string }>(
      tokenResponse,
      '/api/auth/token'
    );
    const token = tokenData.token;

    // Switch workspace with content-type validation
    const response = await fetch(
      `http://localhost:${port}/api/switch-path?path=${encodeURIComponent(path)}`,
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
    );
    return safeParseJson<SwitchWorkspaceResult>(response, '/api/switch-path');
  } catch (err) {
    const error = err as Error;
    return { success: false, error: error.message };
  }
}

/**
 * View command handler - opens dashboard for current workspace
 * If server is already running, switches workspace and opens browser
 * If not running, starts a new server
 * @param {Object} options - Command options
 */
export async function viewCommand(options: ViewOptions): Promise<void> {
  // Check for updates (fire-and-forget, non-blocking)
  checkForUpdates().catch(() => { /* ignore errors */ });

  const port = Number(options.port) || 3456;
  const host = options.host || '127.0.0.1';
  const browserHost = host === '0.0.0.0' || host === '::' ? 'localhost' : host;

  // Resolve workspace path
  let workspacePath = process.cwd();
  if (options.path) {
    const pathValidation = validatePath(options.path, { mustExist: true });
    if (!pathValidation.valid || !pathValidation.path) {
      console.error(chalk.red(`\n  Error: ${pathValidation.error}\n`));
      process.exit(1);
    }
    workspacePath = pathValidation.path;
  }

  // Check if server is already running
  const serverRunning = await isServerRunning(port);

  if (serverRunning) {
    // Server is running - switch workspace and open browser
    console.log(chalk.blue.bold('\n  CCW Dashboard\n'));
    console.log(chalk.gray(`  Server already running on port ${port}`));
    console.log(chalk.cyan(`  Switching workspace to: ${workspacePath}`));

    const result = await switchWorkspace(port, workspacePath);

    if (result.success) {
      console.log(chalk.green(`  Workspace switched successfully`));

      const url = `http://${browserHost}:${port}/?path=${encodeURIComponent(workspacePath)}`;

      if (options.browser !== false) {
        console.log(chalk.cyan('  Opening in browser...'));
        try {
          await launchBrowser(url);
          console.log(chalk.green.bold('\n  Dashboard opened!\n'));
        } catch (err) {
          const error = err as Error;
          console.log(chalk.yellow(`\n  Could not open browser: ${error.message}`));
          console.log(chalk.gray(`  Open manually: ${url}\n`));
        }
      } else {
        console.log(chalk.gray(`\n  URL: ${url}\n`));
      }
    } else {
      console.error(chalk.red(`\n  Failed to switch workspace: ${result.error}\n`));
      process.exit(1);
    }
  } else {
    // Server not running - start new server
    await serveCommand({
      path: workspacePath,
      port: port,
      host,
      browser: options.browser
    });
  }
}
