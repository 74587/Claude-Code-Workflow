import { serveCommand } from './serve.js';
import { launchBrowser } from '../utils/browser-launcher.js';
import { validatePath } from '../utils/path-resolver.js';
import chalk from 'chalk';

/**
 * Check if server is already running on the specified port
 * @param {number} port - Port to check
 * @returns {Promise<boolean>} True if server is running
 */
async function isServerRunning(port) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);

    const response = await fetch(`http://localhost:${port}/api/health`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    return response.ok;
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
async function switchWorkspace(port, path) {
  try {
    const response = await fetch(
      `http://localhost:${port}/api/switch-path?path=${encodeURIComponent(path)}`
    );
    return await response.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * View command handler - opens dashboard for current workspace
 * If server is already running, switches workspace and opens browser
 * If not running, starts a new server
 * @param {Object} options - Command options
 */
export async function viewCommand(options) {
  const port = options.port || 3456;

  // Resolve workspace path
  let workspacePath = process.cwd();
  if (options.path) {
    const pathValidation = validatePath(options.path, { mustExist: true });
    if (!pathValidation.valid) {
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

      // Open browser with the new path
      const url = `http://localhost:${port}/?path=${encodeURIComponent(result.path)}`;

      if (options.browser !== false) {
        console.log(chalk.cyan('  Opening in browser...'));
        try {
          await launchBrowser(url);
          console.log(chalk.green.bold('\n  Dashboard opened!\n'));
        } catch (err) {
          console.log(chalk.yellow(`\n  Could not open browser: ${err.message}`));
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
      browser: options.browser
    });
  }
}
