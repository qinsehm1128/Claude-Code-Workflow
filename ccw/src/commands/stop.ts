import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface StopOptions {
  port?: number;
  force?: boolean;
}

/**
 * Find process using a specific port (Windows)
 * @param {number} port - Port number
 * @returns {Promise<string|null>} PID or null
 */
async function findProcessOnPort(port: number): Promise<string | null> {
  try {
    // Avoid filtering on the localized state column (e.g. not always "LISTENING").
    const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
    const lines = stdout.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
      // Typical format:
      // TCP    0.0.0.0:3457    0.0.0.0:0    LISTENING    31736
      // TCP    [::]:3457       [::]:0       LISTENING    31736
      const parts = line.split(/\s+/);
      if (parts.length < 4) continue;
      const proto = parts[0]?.toUpperCase();
      const localAddress = parts[1] || '';
      const pidCandidate = parts[parts.length - 1] || '';

      if (proto !== 'TCP') continue;
      if (!localAddress.endsWith(`:${port}`)) continue;
      // Reject PID 0 (System Idle Process) and non-numeric PIDs
      if (!/^[1-9]\d*$/.test(pidCandidate)) continue;

      return pidCandidate; // PID is the last column
    }
  } catch {
    // No process found
  }
  return null;
}

async function getProcessCommandLine(pid: string): Promise<string | null> {
  // Reject PID 0 (System Idle Process) and non-numeric PIDs
  if (!/^[1-9]\d*$/.test(pid)) return null;

  try {
    const probeCommand =
      process.platform === 'win32'
        ? `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine"`
        : `ps -p ${pid} -o command=`;

    const { stdout } = await execAsync(probeCommand);
    const commandLine = stdout.trim();
    return commandLine.length > 0 ? commandLine : null;
  } catch {
    return null;
  }
}

function isLikelyViteCommandLine(commandLine: string, port: number): boolean {
  const lower = commandLine.toLowerCase();
  if (!lower.includes('vite')) return false;

  const portStr = String(port);
  return (
    lower.includes(`--port ${portStr}`) ||
    lower.includes(`--port=${portStr}`) ||
    // Some npm wrappers pass through the port in a slightly different shape.
    lower.includes(`port ${portStr}`)
  );
}

/**
 * Kill process by PID (Windows)
 * @param {string} pid - Process ID
 * @returns {Promise<boolean>} Success status
 */
async function killProcess(pid: string): Promise<boolean> {
  // Reject PID 0 (System Idle Process) and non-numeric PIDs
  if (!/^[1-9]\d*$/.test(pid)) return false;

  try {
    // Prefer taskkill to terminate the entire process tree on Windows (npm/cmd wrappers can orphan children).
    if (process.platform === 'win32') {
      await execAsync(`cmd /c "taskkill /PID ${pid} /T /F"`);
      return true;
    }

    // Best-effort on non-Windows platforms (mockable via child_process.exec in tests).
    await execAsync(`kill -TERM ${pid}`);
    return true;
  } catch {
    try {
      if (process.platform === 'win32') {
        await execAsync(`powershell -NoProfile -Command "Stop-Process -Id ${pid} -Force -ErrorAction Stop"`);
        return true;
      }

      await execAsync(`kill -KILL ${pid}`);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Clean up React frontend process on the given port
 */
async function cleanupReactFrontend(reactPort: number): Promise<void> {
  const reactPid = await findProcessOnPort(reactPort);
  if (reactPid) {
    console.log(chalk.gray(`  Cleaning up React frontend on port ${reactPort}...`));
    const killed = await killProcess(reactPid);
    if (killed) {
      console.log(chalk.green('  React frontend stopped!'));
    }
  }
}

export async function stopCommand(options: StopOptions): Promise<void> {
  const port = Number(options.port) || 3456;
  const reactPort = port + 1; // React frontend runs on port + 1
  const force = options.force || false;

  console.log(chalk.blue.bold('\n  CCW Dashboard\n'));
  console.log(chalk.gray(`  Checking server on port ${port} and ${reactPort}...`));

  try {
    // Try graceful shutdown via API first
    const healthCheck = await fetch(`http://localhost:${port}/api/health`, {
      signal: AbortSignal.timeout(2000)
    }).catch(() => null);

    if (healthCheck) {
      // CCW server is running (may require authentication) - send shutdown signal
      console.log(chalk.cyan('  CCW server found, sending shutdown signal...'));

      let token: string | undefined;
      try {
        const tokenResponse = await fetch(`http://localhost:${port}/api/auth/token`, {
          signal: AbortSignal.timeout(2000)
        });
        const tokenData = await tokenResponse.json() as { token?: string };
        token = tokenData.token;
      } catch {
        // Ignore token acquisition errors; shutdown request will fail with 401.
      }

      const shutdownResponse = await fetch(`http://localhost:${port}/api/shutdown`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        signal: AbortSignal.timeout(5000)
      }).catch(() => null);

      // Wait a moment for shutdown
      await new Promise(resolve => setTimeout(resolve, 500));

      if (shutdownResponse && 'ok' in shutdownResponse && shutdownResponse.ok) {
        await cleanupReactFrontend(reactPort);
        console.log(chalk.green.bold('\n  Server stopped successfully!\n'));
        process.exit(0);
        return;
      }

      // Best-effort verify shutdown (may still succeed even if shutdown endpoint didn't return ok)
      const postCheck = await fetch(`http://localhost:${port}/api/health`, {
        signal: AbortSignal.timeout(2000)
      }).catch(() => null);

      if (!postCheck) {
        await cleanupReactFrontend(reactPort);
        console.log(chalk.green.bold('\n  Server stopped successfully!\n'));
        process.exit(0);
        return;
      }

      const statusHint = shutdownResponse ? `HTTP ${shutdownResponse.status}` : 'no response';
      console.log(chalk.yellow(`  Shutdown request did not stop server (${statusHint}).`));
    }

    // No CCW server responding, check if port is in use
    const pid = await findProcessOnPort(port);

    if (!pid) {
      console.log(chalk.yellow(`  No server running on port ${port}\n`));

      // Also check and clean up React frontend if it's still running
      const reactPid = await findProcessOnPort(reactPort);
      if (reactPid) {
        console.log(chalk.yellow(`  React frontend still running on port ${reactPort} (PID: ${reactPid})`));

        const commandLine = await getProcessCommandLine(reactPid);
        const isLikelyVite = commandLine ? isLikelyViteCommandLine(commandLine, reactPort) : false;

        if (force || isLikelyVite) {
          console.log(chalk.cyan('  Cleaning up React frontend...'));
          const killed = await killProcess(reactPid);
          if (killed) {
            console.log(chalk.green('  React frontend stopped!\n'));
          } else {
            console.log(chalk.red('  Failed to stop React frontend.\n'));
          }
        } else {
          console.log(chalk.gray(`\n  React process does not look like Vite on port ${reactPort}.`));
          console.log(chalk.gray(`  Use --force to clean it up:\n  ccw stop --force\n`));
        }
      }
      process.exit(0);
      return;
    }

    // Port is in use by another process
    console.log(chalk.yellow(`  Port ${port} is in use by process PID: ${pid}`));

    if (force) {
      console.log(chalk.cyan('  Force killing process...'));
      const killed = await killProcess(pid);

      if (killed) {
        console.log(chalk.green('  Main server killed successfully!'));

        // Also try to kill React frontend
        console.log(chalk.gray(`  Checking React frontend on port ${reactPort}...`));
        const reactPid = await findProcessOnPort(reactPort);
        if (reactPid) {
          console.log(chalk.cyan(`  Cleaning up React frontend (PID: ${reactPid})...`));
          const reactKilled = await killProcess(reactPid);
          if (reactKilled) {
            console.log(chalk.green('  React frontend stopped!'));
          } else {
            console.log(chalk.yellow('  Failed to stop React frontend'));
          }
        } else {
          console.log(chalk.gray('  No React frontend running'));
        }

        console.log(chalk.green.bold('\n  All processes stopped successfully!\n'));
        process.exit(0);
        return;
      } else {
        console.log(chalk.red('\n  Failed to kill process. Try running as administrator.\n'));
        process.exit(1);
        return;
      }
    } else {
      // Also check React frontend port
      const reactPid = await findProcessOnPort(reactPort);
      if (reactPid) {
        console.log(chalk.yellow(`  React frontend running on port ${reactPort} (PID: ${reactPid})`));
      }

      console.log(chalk.gray(`\n  This is not a CCW server. Use --force to kill it:`));
      console.log(chalk.white(`  ccw stop --force\n`));
      process.exit(0);
      return;
    }

  } catch (err) {
    const error = err as Error;
    console.error(chalk.red(`\n  Error: ${error.message}\n`));
    process.exit(1);
    return;
  }
}
