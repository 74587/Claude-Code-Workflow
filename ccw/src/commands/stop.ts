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
    const { stdout } = await execAsync(`netstat -ano | findstr :${port} | findstr LISTENING`);
    const lines = stdout.trim().split('\n');
    if (lines.length > 0) {
      const parts = lines[0].trim().split(/\s+/);
      return parts[parts.length - 1]; // PID is the last column
    }
  } catch {
    // No process found
  }
  return null;
}

/**
 * Kill process by PID (Windows)
 * @param {string} pid - Process ID
 * @returns {Promise<boolean>} Success status
 */
async function killProcess(pid: string): Promise<boolean> {
  try {
    await execAsync(`taskkill /PID ${pid} /F`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Stop command handler - stops the running CCW dashboard server
 * @param {Object} options - Command options
 */
export async function stopCommand(options: StopOptions): Promise<void> {
  const port = options.port || 3456;
  const force = options.force || false;

  console.log(chalk.blue.bold('\n  CCW Dashboard\n'));
  console.log(chalk.gray(`  Checking server on port ${port}...`));

  try {
    // Try graceful shutdown via API first
    const healthCheck = await fetch(`http://localhost:${port}/api/health`, {
      signal: AbortSignal.timeout(2000)
    }).catch(() => null);

    if (healthCheck && healthCheck.ok) {
      // CCW server is running - send shutdown signal
      console.log(chalk.cyan('  CCW server found, sending shutdown signal...'));

      await fetch(`http://localhost:${port}/api/shutdown`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000)
      }).catch(() => null);

      // Wait a moment for shutdown
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log(chalk.green.bold('\n  Server stopped successfully!\n'));
      return;
    }

    // No CCW server responding, check if port is in use
    const pid = await findProcessOnPort(port);

    if (!pid) {
      console.log(chalk.yellow(`  No server running on port ${port}\n`));
      return;
    }

    // Port is in use by another process
    console.log(chalk.yellow(`  Port ${port} is in use by process PID: ${pid}`));

    if (force) {
      console.log(chalk.cyan('  Force killing process...'));
      const killed = await killProcess(pid);

      if (killed) {
        console.log(chalk.green.bold('\n  Process killed successfully!\n'));
      } else {
        console.log(chalk.red('\n  Failed to kill process. Try running as administrator.\n'));
      }
    } else {
      console.log(chalk.gray(`\n  This is not a CCW server. Use --force to kill it:`));
      console.log(chalk.white(`  ccw stop --force\n`));
    }

  } catch (err) {
    const error = err as Error;
    console.error(chalk.red(`\n  Error: ${error.message}\n`));
  }
}
