import { startServer } from '../core/server.js';
import { launchBrowser } from '../utils/browser-launcher.js';
import { resolvePath, validatePath } from '../utils/path-resolver.js';
import chalk from 'chalk';

/**
 * Serve command handler - starts dashboard server with live path switching
 * @param {Object} options - Command options
 */
export async function serveCommand(options) {
  const port = options.port || 3456;

  // Validate project path
  let initialPath = process.cwd();
  if (options.path) {
    const pathValidation = validatePath(options.path, { mustExist: true });
    if (!pathValidation.valid) {
      console.error(chalk.red(`\n  Error: ${pathValidation.error}\n`));
      process.exit(1);
    }
    initialPath = pathValidation.path;
  }

  console.log(chalk.blue.bold('\n  CCW Dashboard Server\n'));
  console.log(chalk.gray(`  Initial project: ${initialPath}`));
  console.log(chalk.gray(`  Port: ${port}\n`));

  try {
    // Start server
    console.log(chalk.cyan('  Starting server...'));
    const server = await startServer({ port, initialPath });

    const url = `http://localhost:${port}`;
    console.log(chalk.green(`  Server running at ${url}`));

    // Open browser
    if (options.browser !== false) {
      console.log(chalk.cyan('  Opening in browser...'));
      try {
        await launchBrowser(url);
        console.log(chalk.green.bold('\n  Dashboard opened in browser!'));
      } catch (err) {
        console.log(chalk.yellow(`\n  Could not open browser: ${err.message}`));
        console.log(chalk.gray(`  Open manually: ${url}`));
      }
    }

    console.log(chalk.gray('\n  Press Ctrl+C to stop the server\n'));

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n  Shutting down server...'));
      server.close(() => {
        console.log(chalk.green('  Server stopped.\n'));
        process.exit(0);
      });
    });

  } catch (error) {
    console.error(chalk.red(`\n  Error: ${error.message}\n`));
    if (error.code === 'EADDRINUSE') {
      console.error(chalk.yellow(`  Port ${port} is already in use.`));
      console.error(chalk.gray(`  Try a different port: ccw serve --port ${port + 1}\n`));
    }
    process.exit(1);
  }
}
