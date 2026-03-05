import { startServer } from '../core/server.js';
import { launchBrowser } from '../utils/browser-launcher.js';
import { validatePath } from '../utils/path-resolver.js';
import { startReactFrontend, stopReactFrontend } from '../utils/react-frontend.js';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ServeOptions {
  port?: number;
  path?: string;
  host?: string;
  browser?: boolean;
}

/**
 * Check if a port is in use
 * @param port - Port number to check
 * @returns Promise<boolean> - true if port is in use
 */
async function isPortInUse(port: number): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
    const lines = stdout.trim().split(/\r?\n/).filter(Boolean);

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4) continue;

      const proto = parts[0]?.toUpperCase();
      const localAddress = parts[1] || '';
      const state = parts[3]?.toUpperCase();

      // Check if this is a TCP connection in LISTENING state on our port
      if (proto === 'TCP' && localAddress.endsWith(`:${port}`) && state === 'LISTENING') {
        return true;
      }
    }
    return false;
  } catch {
    // If netstat fails or no matches found, assume port is free
    return false;
  }
}

/**
 * Serve command handler - starts dashboard server with live path switching
 * @param {Object} options - Command options
 */
export async function serveCommand(options: ServeOptions): Promise<void> {
  const port = Number(options.port) || 3456;
  const host = options.host || '127.0.0.1';

  // Keep Vite dev-server proxy aligned with the dashboard server port.
  process.env.VITE_BACKEND_PORT = port.toString();

  // Validate project path
  let initialPath = process.cwd();
  if (options.path) {
    const pathValidation = validatePath(options.path, { mustExist: true });
    if (!pathValidation.valid || !pathValidation.path) {
      console.error(chalk.red(`\n  Error: ${pathValidation.error}\n`));
      process.exit(1);
    }
    initialPath = pathValidation.path;
  }

  const startupId = Math.random().toString(36).substring(7);
  console.log(chalk.blue.bold('\n  CCW Dashboard Server\n'));
  console.log(chalk.gray(`  Startup ID: ${startupId}`));
  console.log(chalk.gray(`  Initial project: ${initialPath}`));
  console.log(chalk.gray(`  Host: ${host}`));
  console.log(chalk.gray(`  Port: ${port}\n`));

  // Calculate React frontend port
  const reactPort = port + 1;

  // Check if ports are already in use
  const mainPortInUse = await isPortInUse(port);
  const reactPortInUse = await isPortInUse(reactPort);

  if (mainPortInUse) {
    console.error(chalk.red(`\n  Error: Port ${port} is already in use.`));
    console.error(chalk.yellow(`  Another CCW server may be running.`));
    console.error(chalk.gray(`  Try stopping it first: ccw stop`));
    console.error(chalk.gray(`  Or use a different port: ccw serve --port ${port + 2}\n`));
    process.exit(1);
  }

  if (reactPortInUse) {
    console.error(chalk.red(`\n  Error: Port ${reactPort} (React frontend) is already in use.`));
    console.error(chalk.yellow(`  Another process may be using this port.`));
    console.error(chalk.gray(`  Try using a different port: ccw serve --port ${port + 2}\n`));
    process.exit(1);
  }

  // Start React frontend
  try {
    await startReactFrontend(reactPort);
  } catch (error) {
    console.error(chalk.red(`\n  Failed to start React frontend: ${error}\n`));
    process.exit(1);
  }

  try {
    // Start server
    console.log(chalk.cyan('  Starting server...'));
    const server = await startServer({
      port,
      host,
      initialPath,
      reactPort
    });

    const boundUrl = `http://${host}:${port}`;
    const browserUrl = host === '0.0.0.0' || host === '::' ? `http://localhost:${port}` : boundUrl;

    if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
      console.log(chalk.yellow(`\n  WARNING: Binding to ${host} exposes the server to network attacks.`));
      console.log(chalk.yellow('  Ensure firewall is configured and never expose tokens publicly.\n'));
    }

    console.log(chalk.green(`  Server running at ${boundUrl}`));

    // Open browser
    if (options.browser !== false) {
      console.log(chalk.cyan('  Opening in browser...'));
      try {
        const pathParam = initialPath ? `?path=${encodeURIComponent(initialPath)}` : '';
        await launchBrowser(browserUrl + pathParam);
        console.log(chalk.green.bold('\n  Dashboard opened in browser!'));
      } catch (err) {
        const error = err as Error;
        console.log(chalk.yellow(`\n  Could not open browser: ${error.message}`));
        console.log(chalk.gray(`  Open manually: ${browserUrl}`));
      }
    }

    console.log(chalk.gray('\n  Press Ctrl+C to stop the server\n'));

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n  Shutting down server...'));
      await stopReactFrontend();
      server.close(() => {
        console.log(chalk.green('  Server stopped.\n'));
        process.exit(0);
      });
    });

  } catch (error) {
    const err = error as Error & { code?: string };
    console.error(chalk.red(`\n  Error: ${err.message}\n`));
    if (err.code === 'EADDRINUSE') {
      console.error(chalk.yellow(`  Port ${port} is already in use.`));
      console.error(chalk.gray(`  Try a different port: ccw serve --port ${port + 1}\n`));
    }
    await stopReactFrontend();
    process.exit(1);
  }
}
