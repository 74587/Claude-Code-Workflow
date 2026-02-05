import { spawn, type ChildProcess } from 'child_process';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let docsProcess: ChildProcess | null = null;
let docsPort: number | null = null;

// Default Docusaurus port
const DEFAULT_DOCS_PORT = 3001;

type DocsStartMode = 'serve' | 'start';

function normalizeDocsStartMode(mode: string | undefined): DocsStartMode {
  const normalized = (mode ?? '').trim().toLowerCase();
  return normalized === 'start' ? 'start' : 'serve';
}

/**
 * Start Docusaurus documentation development server
 * @param port - Port to run Docusaurus server on (default: 3001)
 * @returns Promise that resolves when server is ready
 */
export async function startDocsSite(port: number = DEFAULT_DOCS_PORT): Promise<void> {
  // Check if already running
  if (docsProcess && docsPort === port) {
    console.log(chalk.yellow(`  Docs site already running on port ${port}`));
    return;
  }

  // Try to find docs-site directory (relative to ccw package)
  const possiblePaths = [
    join(__dirname, '../../docs-site'),     // From dist/utils
    join(__dirname, '../docs-site'),         // From src/utils (dev)
    join(process.cwd(), 'docs-site'),       // Current working directory
  ];

  let docsDir: string | null = null;
  for (const path of possiblePaths) {
    const resolvedPath = resolve(path);
    try {
      const { existsSync } = await import('fs');
      if (existsSync(resolvedPath)) {
        docsDir = resolvedPath;
        break;
      }
    } catch {
      // Continue to next path
    }
  }

  if (!docsDir) {
    console.log(chalk.yellow(`  Docs site directory not found. Skipping docs server startup.`));
    console.log(chalk.gray(`  The /docs endpoint will not be available.`));
    return;
  }

  console.log(chalk.cyan(`  Starting Docusaurus docs site on port ${port}...`));
  console.log(chalk.gray(`  Docs dir: ${docsDir}`));

  const requestedMode = normalizeDocsStartMode(process.env.CCW_DOCS_MODE);
  const requestedLocale = process.env.CCW_DOCS_LOCALE?.trim();

  // Check if package.json exists and has required scripts
  const packageJsonPath = join(docsDir, 'package.json');
  let effectiveMode: DocsStartMode = requestedMode;
  try {
    const { readFileSync, existsSync } = await import('fs');
    if (!existsSync(packageJsonPath)) {
      throw new Error('package.json not found in docs-site directory');
    }
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

    const hasStart = Boolean(packageJson.scripts?.start);
    const hasServe = Boolean(packageJson.scripts?.serve);

    // Default to "serve --build" because it serves all locales (i18n).
    // Docusaurus `start` serves only 1 locale at a time, so `/docs/zh/*` will
    // render "Page Not Found" when the English dev server is running.
    if (requestedMode === 'serve' && !hasServe && hasStart) {
      effectiveMode = 'start';
    } else if (requestedMode === 'start' && !hasStart && hasServe) {
      effectiveMode = 'serve';
    }

    if (effectiveMode === 'serve' && !hasServe) {
      throw new Error('No "serve" script found in package.json');
    }
    if (effectiveMode === 'start' && !hasStart) {
      throw new Error('No "start" script found in package.json');
    }
  } catch (error) {
    console.log(chalk.yellow(`  Failed to validate docs-site setup: ${error}`));
    console.log(chalk.gray(`  Skipping docs server startup.`));
    return;
  }

  const args: string[] = [];
  if (effectiveMode === 'serve') {
    // Serve the built site (all locales) at /docs/ (baseUrl)
    args.push(
      'run',
      'serve',
      '--',
      '--build',
      '--port',
      port.toString(),
      '--host',
      'localhost',
      '--no-open',
    );
  } else {
    // Start a single-locale dev server (use CCW_DOCS_LOCALE to pick locale)
    args.push(
      'run',
      'start',
      '--',
      '--port',
      port.toString(),
      '--host',
      'localhost',
      '--no-open',
    );

    if (requestedLocale) {
      args.push('--locale', requestedLocale);
    }
  }

  docsProcess = spawn('npm', args, {
    cwd: docsDir,
    stdio: 'pipe',
    shell: true,
    env: {
      ...process.env,
      // Docusaurus uses COLUMNS for terminal width
      COLUMNS: '80',
    }
  });

  docsPort = port;

  // Wait for server to be ready
  return new Promise((resolve, reject) => {
    let output = '';
    let errorOutput = '';

    const timeout = setTimeout(() => {
      docsProcess?.kill();
      reject(new Error(
        `Docs site startup timeout (60s).\n` +
        `Output: ${output}\n` +
        `Errors: ${errorOutput}`
      ));
    }, 60000); // Docusaurus can take longer to start

    const cleanup = () => {
      clearTimeout(timeout);
      docsProcess?.stdout?.removeAllListeners();
      docsProcess?.stderr?.removeAllListeners();
    };

    docsProcess?.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      output += chunk;

      // Log all Docusaurus output for debugging
      console.log(chalk.gray(`  Docs: ${chunk.trim()}`));

      const isServeReady =
        chunk.includes('Serving "build" directory at:') ||
        chunk.includes('Serving "build" directory at');

      const isStartReady =
        chunk.includes('Compiled successfully') ||
        chunk.includes('Compiled with warnings') ||
        chunk.includes('The server is running at') ||
        chunk.includes(`http://localhost:${port}`) ||
        (chunk.includes('Docusaurus') && (chunk.includes('started') || chunk.includes('ready'))) ||
        chunk.includes('➜') || // Docusaurus uses this in CLI output
        chunk.includes('Local:');

      // Check for ready signals (Docusaurus output format)
      if ((effectiveMode === 'serve' && isServeReady) || (effectiveMode === 'start' && isStartReady)) {
        cleanup();
        console.log(chalk.green(`  Docs site ready at http://localhost:${port}/docs/`));
        resolve();
      }
    });

    docsProcess?.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      errorOutput += chunk;
      // Log warnings but don't fail
      if (chunk.toLowerCase().includes('warn') || chunk.toLowerCase().includes('warning')) {
        console.log(chalk.yellow(`  Docs: ${chunk.trim()}`));
      }
    });

    docsProcess?.on('error', (err: Error) => {
      cleanup();
      reject(err);
    });

    docsProcess?.on('exit', (code: number | null) => {
      if (code !== 0 && code !== null) {
        cleanup();
        reject(new Error(`Docs process exited with code ${code}. Errors: ${errorOutput}`));
      }
    });
  });
}

/**
 * Stop Docusaurus documentation development server
 */
export async function stopDocsSite(): Promise<void> {
  if (docsProcess) {
    console.log(chalk.yellow('  Stopping docs site...'));

    const pid = docsProcess.pid;

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
      docsProcess.kill('SIGTERM');
    }

    // Wait up to 5 seconds for graceful shutdown
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        resolve();
      }, 5000);

      docsProcess?.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    // Force kill if still running
    if (docsProcess && docsProcess.exitCode === null) {
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
                  docsProcess?.kill('SIGKILL');
                }
                resolve();
              });
            });
          }
        } catch {
          // Fallback to SIGKILL
          docsProcess.kill('SIGKILL');
        }
      } else {
        docsProcess.kill('SIGKILL');
      }
    }

    // Wait a bit more for force kill to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    docsProcess = null;
    docsPort = null;
  }
}

/**
 * Get docs site status
 * @returns Object with running status and port
 */
export function getDocsSiteStatus(): { running: boolean; port: number | null } {
  return {
    running: docsProcess !== null && !docsProcess.killed,
    port: docsPort
  };
}
