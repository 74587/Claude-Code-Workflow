import { spawn, type ChildProcess } from 'child_process';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let reactProcess: ChildProcess | null = null;
let reactPort: number | null = null;

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
  reactProcess = spawn('npm', ['run', 'dev', '--', '--port', port.toString()], {
    cwd: frontendDir,
    stdio: 'pipe',
    shell: true,
    env: {
      ...process.env,
      BROWSER: 'none', // Prevent React from auto-opening browser
      VITE_BASE_URL: '/react/', // Set base URL for React frontend
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
      
      // Check for ready signals
      if (
        chunk.includes('Local:') ||
        chunk.includes('ready in') ||
        chunk.includes('VITE') && chunk.includes(port.toString())
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
export function stopReactFrontend(): void {
  if (reactProcess) {
    console.log(chalk.yellow('  Stopping React frontend...'));
    reactProcess.kill('SIGTERM');
    
    // Force kill after timeout
    setTimeout(() => {
      if (reactProcess && !reactProcess.killed) {
        reactProcess.kill('SIGKILL');
      }
    }, 5000);
    
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