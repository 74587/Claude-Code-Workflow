import { spawn, type ChildProcess } from 'child_process';
import { createServer } from 'net';
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

async function fetchStatus(url: string, timeoutMs: number): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response.status;
  } catch {
    return null;
  }
}

async function isPortAvailable(port: number, host: string = '127.0.0.1'): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const server = createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

async function findAvailablePort({
  preferredPort,
  maxAttempts,
}: {
  preferredPort: number;
  maxAttempts: number;
}): Promise<number | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = preferredPort + i;
    if (await isPortAvailable(port)) return port;
  }
  return null;
}

/**
 * Start Docusaurus documentation server.
 *
 * Notes:
 * - Docusaurus `start` serves a single locale; `/docs/zh/*` will 404 unless started with `--locale zh`.
 * - Docusaurus `serve --build` serves all locales (multi-locale i18n).
 *
 * @param port - Preferred port to run Docusaurus server on (default: 3001)
 * @returns Promise that resolves with the actual port used
 */
export async function startDocsSite(port: number = DEFAULT_DOCS_PORT): Promise<number> {
  // Check if already running (CCW-managed)
  if (docsProcess && docsPort === port) {
    console.log(chalk.yellow(`  Docs site already running on port ${port}`));
    return port;
  }

  const requestedMode = normalizeDocsStartMode(process.env.CCW_DOCS_MODE);
  const requestedLocale = process.env.CCW_DOCS_LOCALE?.trim();

  // If something else is already listening on this port, avoid spawning a second server.
  // If zh routes are missing (common with `docusaurus start` default-locale), start CCW docs on a fallback port.
  let effectivePort = port;
  const portAvailable = await isPortAvailable(port);
  if (!portAvailable) {
    const docsStatus = await fetchStatus(`http://localhost:${port}/docs/`, 800);
    const zhStatus = docsStatus !== null ? await fetchStatus(`http://localhost:${port}/docs/zh/`, 800) : null;

    if (docsStatus !== null) {
      console.log(chalk.yellow(`  Docs server already running on port ${port} (GET /docs/ -> ${docsStatus}).`));

      if (zhStatus === 200) {
        return port;
      }

      console.log(chalk.yellow(`  Note: GET /docs/zh/ -> ${zhStatus ?? 'no response'}.`));
      console.log(chalk.gray(`  Docusaurus dev server (start) serves a single locale; /docs/zh/* will 404 unless started with --locale zh.`));
      console.log(chalk.gray(`  Fix options:`));
      console.log(chalk.gray(`    - Stop the existing process on port ${port} and restart CCW`));
      console.log(chalk.gray(`    - Or run: cd ccw/docs-site && npm run serve -- --build --port ${port} --no-open`));
      console.log(chalk.gray(`    - Or run a single-locale zh dev server: cd ccw/docs-site && npm run start -- --locale zh --port ${port} --no-open`));
    } else {
      console.log(chalk.yellow(`  Port ${port} is already in use.`));
    }

    const fallbackPort = await findAvailablePort({ preferredPort: port + 1, maxAttempts: 20 });
    if (!fallbackPort) {
      console.log(chalk.yellow(`  Could not find a free port near ${port}. Reusing ${port}.`));
      return port;
    }

    effectivePort = fallbackPort;
    console.log(chalk.yellow(`  Starting CCW-managed docs site on fallback port ${effectivePort}...`));
  }

  // Try to find docs-site directory (relative to ccw package)
  const possiblePaths = [
    join(__dirname, '../../docs-site'), // From dist/utils
    join(__dirname, '../docs-site'), // From src/utils (dev)
    join(process.cwd(), 'docs-site'), // Current working directory
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
    return effectivePort;
  }

  console.log(chalk.cyan(`  Starting Docusaurus docs site on port ${effectivePort}...`));
  console.log(chalk.gray(`  Docs dir: ${docsDir}`));

  // Check if package.json exists and has required scripts
  const packageJsonPath = join(docsDir, 'package.json');
  let effectiveMode: DocsStartMode = requestedMode;
  try {
    const { readFileSync, existsSync, readdirSync } = await import('fs');
    if (!existsSync(packageJsonPath)) {
      throw new Error('package.json not found in docs-site directory');
    }
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

    const hasStart = Boolean(packageJson.scripts?.start);
    const hasServe = Boolean(packageJson.scripts?.serve);

    const hasMultipleLocales = (() => {
      try {
        const i18nDir = join(docsDir, 'i18n');
        if (!existsSync(i18nDir)) return false;
        // Presence of any locale subfolder implies multi-locale setup.
        return readdirSync(i18nDir, { withFileTypes: true }).some((entry) => entry.isDirectory());
      } catch {
        return false;
      }
    })();

    // Docusaurus `start` serves only 1 locale at a time.
    // If the site has multiple locales and no locale is explicitly requested,
    // prefer serving the built site so `/docs/zh/*` works.
    if (requestedMode === 'start' && !requestedLocale && hasMultipleLocales && hasServe) {
      effectiveMode = 'serve';
      console.log(chalk.yellow(`  CCW_DOCS_MODE=start detected, but CCW_DOCS_LOCALE is not set.`));
      console.log(chalk.gray(`  Falling back to "serve --build" so all locales (e.g. /docs/zh/) are available.`));
      console.log(chalk.gray(`  Tip: set CCW_DOCS_LOCALE=zh if you specifically want a single-locale dev server.`));
    }

    // If the requested script isn't available, fall back to the other script.
    if (effectiveMode === 'serve' && !hasServe && hasStart) {
      effectiveMode = 'start';
    } else if (effectiveMode === 'start' && !hasStart && hasServe) {
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
    return effectivePort;
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
      effectivePort.toString(),
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
      effectivePort.toString(),
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
    },
  });

  docsPort = effectivePort;

  // Wait for server to be ready
  await new Promise<void>((resolve, reject) => {
    let output = '';
    let errorOutput = '';

    const timeout = setTimeout(() => {
      docsProcess?.kill();
      reject(new Error(
        `Docs site startup timeout (60s).\n` +
        `Output: ${output}\n` +
        `Errors: ${errorOutput}`,
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
        chunk.includes(`http://localhost:${effectivePort}`) ||
        (chunk.includes('Docusaurus') && (chunk.includes('started') || chunk.includes('ready'))) ||
        chunk.includes('Local:');

      // Check for ready signals (Docusaurus output format)
      if ((effectiveMode === 'serve' && isServeReady) || (effectiveMode === 'start' && isStartReady)) {
        cleanup();
        console.log(chalk.green(`  Docs site ready at http://localhost:${effectivePort}/docs/`));
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

  return effectivePort;
}

/**
 * Stop Docusaurus documentation server (only if CCW started it).
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
    await new Promise((resolve) => setTimeout(resolve, 500));

    docsProcess = null;
    docsPort = null;
  }
}

/**
 * Get docs site status (CCW-managed only).
 */
export function getDocsSiteStatus(): { running: boolean; port: number | null } {
  return {
    running: docsProcess !== null && !docsProcess.killed,
    port: docsPort,
  };
}
