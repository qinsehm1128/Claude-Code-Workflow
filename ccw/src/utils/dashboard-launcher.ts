// ========================================
// Dashboard Launcher Utility
// ========================================
// Detects Dashboard server status and auto-starts if needed

import { spawn, type ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Constants
const DASHBOARD_PORT = Number(process.env.CCW_PORT || 3456);
const DASHBOARD_HOST = process.env.CCW_HOST || '127.0.0.1';
const DASHBOARD_CHECK_TIMEOUT_MS = 500;
const DASHBOARD_STARTUP_TIMEOUT_MS = 30000;
const DASHBOARD_STARTUP_POLL_INTERVAL_MS = 500;

// Path to CCW CLI (adjust based on build output location)
const CCW_CLI_PATH = join(__dirname, '../../bin/ccw.js');

// Track spawned dashboard process
let dashboardProcess: ChildProcess | null = null;

/**
 * Check if the Dashboard server is running by attempting to connect to its health endpoint.
 * @returns Promise that resolves to true if server is reachable
 */
export async function isDashboardServerRunning(
  port: number = DASHBOARD_PORT,
  host: string = DASHBOARD_HOST
): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(
      {
        hostname: host,
        port,
        path: '/api/health',
        timeout: DASHBOARD_CHECK_TIMEOUT_MS,
      },
      (res) => {
        res.resume(); // Consume response data
        res.on('end', () => {
          resolve(res.statusCode === 200);
        });
      }
    );

    req.on('error', () => {
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Wait for Dashboard server to become available.
 * Polls the health endpoint until it responds or timeout is reached.
 * @param port - Port to check
 * @param host - Host to check
 * @param timeoutMs - Maximum time to wait
 * @returns Promise that resolves to true if server became available
 */
export async function waitForDashboardReady(
  port: number = DASHBOARD_PORT,
  host: string = DASHBOARD_HOST,
  timeoutMs: number = DASHBOARD_STARTUP_TIMEOUT_MS
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const isRunning = await isDashboardServerRunning(port, host);
    if (isRunning) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, DASHBOARD_STARTUP_POLL_INTERVAL_MS));
  }

  return false;
}

/**
 * Attempt to start the CCW Dashboard server in a detached child process.
 * @param port - Port to start the server on
 * @param host - Host to bind the server to
 * @param openBrowser - Whether to open browser (default: false)
 * @returns Promise that resolves to true if process was successfully spawned and became ready
 */
export async function startCcwServeProcess(
  port: number = DASHBOARD_PORT,
  host: string = DASHBOARD_HOST,
  openBrowser: boolean = false
): Promise<boolean> {
  // Don't start if already running
  const alreadyRunning = await isDashboardServerRunning(port, host);
  if (alreadyRunning) {
    console.log(`[DashboardLauncher] Dashboard already running at ${host}:${port}`);
    return true;
  }

  // Don't spawn duplicate process
  if (dashboardProcess && !dashboardProcess.killed) {
    console.log(`[DashboardLauncher] Dashboard process already spawned, waiting for ready...`);
    return waitForDashboardReady(port, host);
  }

  console.log(`[DashboardLauncher] Starting Dashboard server at ${host}:${port}...`);

  return new Promise((resolve) => {
    try {
      const args = ['serve', '--port', port.toString(), '--host', host];
      if (!openBrowser) {
        args.push('--no-browser');
      }

      dashboardProcess = spawn('node', [CCW_CLI_PATH, ...args], {
        detached: true,
        stdio: 'ignore', // Detach stdio from parent
        shell: process.platform === 'win32', // Use shell on Windows for better compatibility
        env: {
          ...process.env,
          CCW_PORT: port.toString(),
          CCW_HOST: host,
        },
      });

      dashboardProcess.unref(); // Allow parent to exit independently

      dashboardProcess.on('error', (err) => {
        console.error(`[DashboardLauncher] Failed to start Dashboard: ${err.message}`);
        dashboardProcess = null;
        resolve(false);
      });

      // Wait for server to become ready
      waitForDashboardReady(port, host)
        .then((ready) => {
          if (ready) {
            console.log(`[DashboardLauncher] Dashboard started successfully (PID: ${dashboardProcess?.pid})`);
          } else {
            console.error(`[DashboardLauncher] Dashboard failed to start within timeout`);
            dashboardProcess = null;
          }
          resolve(ready);
        })
        .catch(() => {
          resolve(false);
        });
    } catch (err) {
      console.error(`[DashboardLauncher] Exception while starting Dashboard: ${(err as Error).message}`);
      dashboardProcess = null;
      resolve(false);
    }
  });
}

/**
 * Get the current dashboard process info.
 * @returns Object with process status and PID
 */
export function getDashboardProcessStatus(): { running: boolean; pid: number | null } {
  return {
    running: dashboardProcess !== null && !dashboardProcess.killed,
    pid: dashboardProcess?.pid ?? null,
  };
}

/**
 * Stop the spawned dashboard process (if any).
 * Note: This only stops the process we spawned, not externally started servers.
 */
export async function stopSpawnedDashboard(): Promise<void> {
  if (dashboardProcess && !dashboardProcess.killed) {
    console.log(`[DashboardLauncher] Stopping spawned Dashboard process (PID: ${dashboardProcess.pid})...`);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (dashboardProcess && !dashboardProcess.killed) {
          dashboardProcess.kill('SIGKILL');
        }
        dashboardProcess = null;
        resolve();
      }, 5000);

      dashboardProcess!.once('exit', () => {
        clearTimeout(timeout);
        dashboardProcess = null;
        console.log(`[DashboardLauncher] Dashboard process stopped`);
        resolve();
      });

      dashboardProcess!.kill('SIGTERM');
    });
  }
}
