import { spawn, type ChildProcess } from 'child_process';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let reactProcess: ChildProcess | null = null;
let reactPort: number | null = null;
let staticServer: ReturnType<typeof createServer> | null = null;

/**
 * Check if we're in production mode (globally installed)
 */
function isProductionMode(frontendDir: string): boolean {
  const distDir = join(frontendDir, 'dist');
  const nodeModulesDir = join(frontendDir, 'node_modules');
  // Production if dist exists but node_modules doesn't (no dev dependencies)
  return existsSync(distDir) && !existsSync(nodeModulesDir);
}

/**
 * Start static file server for production
 */
async function startStaticServer(frontendDir: string, port: number): Promise<void> {
  const distDir = join(frontendDir, 'dist');

  if (!existsSync(distDir)) {
    throw new Error('Frontend dist directory not found. Build the frontend first.');
  }

  return new Promise((resolve, reject) => {
    staticServer = createServer((req, res) => {
      let filePath = join(distDir, req.url === '/' ? 'index.html' : req.url || '');

      // Security: prevent directory traversal
      if (!filePath.startsWith(distDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      // Read and serve file
      try {
        if (!existsSync(filePath)) {
          // For SPA routing, serve index.html for non-file requests
          filePath = join(distDir, 'index.html');
        }

        const content = readFileSync(filePath);
        const ext = filePath.split('.').pop() || '';
        const mimeTypes: Record<string, string> = {
          'html': 'text/html',
          'css': 'text/css',
          'js': 'application/javascript',
          'json': 'application/json',
          'png': 'image/png',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'svg': 'image/svg+xml',
          'ico': 'image/x-icon',
        };

        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
        res.end(content);
      } catch (error) {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
    });

    staticServer.listen(port, () => {
      console.log(chalk.green(`  React frontend (static) ready at http://localhost:${port}`));
      resolve();
    });

    staticServer.on('error', reject);
  });
}

/**
 * Start React frontend development server
 * @param port - Port to run React frontend on
 * @returns Promise that resolves when server is ready
 */
export async function startReactFrontend(port: number): Promise<void> {
  // Check if already running
  if (reactProcess && reactPort === port) {
    console.log(chalk.yellow(`  React frontend already running on port ${port}`));
    return;
  }

  // Try to find frontend directory (relative to ccw package)
  const possiblePaths = [
    join(__dirname, '../../frontend'),      // From dist/utils
    join(__dirname, '../frontend'),          // From src/utils (dev)
    join(process.cwd(), 'frontend'),       // Current working directory
  ];

  let frontendDir: string | null = null;
  for (const path of possiblePaths) {
    const resolvedPath = resolve(path);
    try {
      const { existsSync } = await import('fs');
      if (existsSync(resolvedPath)) {
        frontendDir = resolvedPath;
        break;
      }
    } catch {
      // Continue to next path
    }
  }

  if (!frontendDir) {
    throw new Error(
      'Could not find React frontend directory. ' +
      'Make sure the frontend folder exists in the ccw package.'
    );
  }

  console.log(chalk.cyan(`  Starting React frontend on port ${port}...`));
  console.log(chalk.gray(`  Frontend dir: ${frontendDir}`));

  // Check if we're in production mode
  const isProduction = isProductionMode(frontendDir);

  if (isProduction) {
    // Production: serve static files from dist
    console.log(chalk.gray(`  Mode: Production (static files)`));
    reactPort = port;
    return startStaticServer(frontendDir, port);
  }

  // Development: use vite dev server
  console.log(chalk.gray(`  Mode: Development (vite dev server)`));

  // Check if package.json exists and has dev script
  const packageJsonPath = join(frontendDir, 'package.json');
  try {
    const { readFileSync, existsSync } = await import('fs');
    if (!existsSync(packageJsonPath)) {
      throw new Error('package.json not found in frontend directory');
    }
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    if (!packageJson.scripts?.dev) {
      throw new Error('No "dev" script found in package.json');
    }
  } catch (error) {
    throw new Error(`Failed to validate frontend setup: ${error}`);
  }

  // Spawn React dev server
  // Use 'dev:vite' directly instead of 'dev' to avoid the 'concurrently' wrapper
  // which doesn't properly pass the --port argument to vite
  reactProcess = spawn('npm', ['run', 'dev:vite', '--', '--port', port.toString(), '--strictPort'], {
    cwd: frontendDir,
    stdio: 'pipe',
    shell: true,
    env: {
      ...process.env,
      BROWSER: 'none', // Prevent React from auto-opening browser
      VITE_BASE_URL: '/', // Set base URL for React frontend (root path)
    }
  });

  reactPort = port;

  // Wait for server to be ready
  return new Promise((resolve, reject) => {
    let output = '';
    let errorOutput = '';
    
    const timeout = setTimeout(() => {
      reactProcess?.kill();
      reject(new Error(
        `React frontend startup timeout (30s).\n` +
        `Output: ${output}\n` +
        `Errors: ${errorOutput}`
      ));
    }, 30000);

    const cleanup = () => {
      clearTimeout(timeout);
      reactProcess?.stdout?.removeAllListeners();
      reactProcess?.stderr?.removeAllListeners();
    };

    reactProcess?.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      output += chunk;
      
      // Check for ready signals (Vite 5/6 output format)
      if (
        chunk.includes('Local:') ||
        chunk.includes('ready in') ||
        chunk.includes('VITE') && chunk.includes(port.toString()) ||
        chunk.includes(`http://localhost:${port}`) ||
        chunk.includes(`https://localhost:${port}`)
      ) {
        cleanup();
        console.log(chalk.green(`  React frontend ready at http://localhost:${port}`));
        resolve();
      }
    });

    reactProcess?.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      errorOutput += chunk;
      // Log warnings but don't fail
      if (chunk.toLowerCase().includes('warn')) {
        console.log(chalk.yellow(`  React: ${chunk.trim()}`));
      }
    });

    reactProcess?.on('error', (err: Error) => {
      cleanup();
      reject(err);
    });

    reactProcess?.on('exit', (code: number | null) => {
      if (code !== 0 && code !== null) {
        cleanup();
        reject(new Error(`React process exited with code ${code}. Errors: ${errorOutput}`));
      }
    });
  });
}

/**
 * Stop React frontend development server
 */
export async function stopReactFrontend(): Promise<void> {
  // Stop static server if running
  if (staticServer) {
    console.log(chalk.yellow('  Stopping React frontend (static)...'));
    staticServer.close();
    staticServer = null;
    reactPort = null;
    return;
  }

  // Stop vite dev server if running
  if (reactProcess) {
    console.log(chalk.yellow('  Stopping React frontend...'));

    const pid = reactProcess.pid;

    // On Windows with shell: true, killing the shell process can orphan children.
    // Prefer taskkill to terminate the entire process tree.
    if (process.platform === 'win32' && pid) {
      try {
        const { exec } = await import('child_process');
        await new Promise<void>((resolve) => {
          exec(`taskkill /T /PID ${pid}`, () => resolve());
        });
      } catch {
        // Fall back to SIGTERM below
      }
    } else {
      // Try graceful shutdown first
      reactProcess.kill('SIGTERM');
    }

    // Wait up to 5 seconds for graceful shutdown
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        resolve();
      }, 5000);

      reactProcess?.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    // Force kill if still running
    if (reactProcess && reactProcess.exitCode === null) {
      // On Windows with shell: true, we need to kill the entire process group
      if (process.platform === 'win32') {
        try {
          // Use taskkill to forcefully terminate the process tree
          const { exec } = await import('child_process');
          if (pid) {
            await new Promise<void>((resolve) => {
              exec(`taskkill /F /T /PID ${pid}`, (err) => {
                if (err) {
                  // Fallback to SIGKILL if taskkill fails
                  reactProcess?.kill('SIGKILL');
                }
                resolve();
              });
            });
          }
        } catch {
          // Fallback to SIGKILL
          reactProcess.kill('SIGKILL');
        }
      } else {
        reactProcess.kill('SIGKILL');
      }
    }

    // Wait a bit more for force kill to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    reactProcess = null;
    reactPort = null;
  }
}

/**
 * Get React frontend status
 * @returns Object with running status and port
 */
export function getReactFrontendStatus(): { running: boolean; port: number | null } {
  return {
    running: reactProcess !== null && !reactProcess.killed,
    port: reactPort
  };
}
