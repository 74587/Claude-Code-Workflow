import { startServer } from '../core/server.js';
import { launchBrowser } from '../utils/browser-launcher.js';
import { resolvePath, validatePath } from '../utils/path-resolver.js';
import { startReactFrontend, stopReactFrontend } from '../utils/react-frontend.js';
import chalk from 'chalk';
import type { Server } from 'http';

interface ServeOptions {
  port?: number;
  path?: string;
  host?: string;
  browser?: boolean;
  frontend?: 'js' | 'react' | 'both';
}

/**
 * Serve command handler - starts dashboard server with live path switching
 * @param {Object} options - Command options
 */
export async function serveCommand(options: ServeOptions): Promise<void> {
  const port = options.port || 3456;
  const host = options.host || '127.0.0.1';
  const frontend = options.frontend || 'js';

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

  console.log(chalk.blue.bold('\n  CCW Dashboard Server\n'));
  console.log(chalk.gray(`  Initial project: ${initialPath}`));
  console.log(chalk.gray(`  Host: ${host}`));
  console.log(chalk.gray(`  Port: ${port}`));
  console.log(chalk.gray(`  Frontend: ${frontend}\n`));

  // Start React frontend if needed
  let reactPort: number | undefined;
  if (frontend === 'react' || frontend === 'both') {
    reactPort = port + 1;
    try {
      await startReactFrontend(reactPort);
    } catch (error) {
      console.error(chalk.red(`\n  Failed to start React frontend: ${error}\n`));
      process.exit(1);
    }
  }

  try {
    // Start server
    console.log(chalk.cyan('  Starting server...'));
    const server = await startServer({ 
      port, 
      host, 
      initialPath,
      frontend,
      reactPort
    });

    const boundUrl = `http://${host}:${port}`;
    const browserUrl = host === '0.0.0.0' || host === '::' ? `http://localhost:${port}` : boundUrl;

    if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
      console.log(chalk.yellow(`\n  WARNING: Binding to ${host} exposes the server to network attacks.`));
      console.log(chalk.yellow('  Ensure firewall is configured and never expose tokens publicly.\n'));
    }

    console.log(chalk.green(`  Server running at ${boundUrl}`));

    // Display frontend URLs
    if (frontend === 'both') {
      console.log(chalk.gray(`  JS Frontend:    ${boundUrl}`));
      console.log(chalk.gray(`  React Frontend: ${boundUrl}/react`));
    } else if (frontend === 'react') {
      console.log(chalk.gray(`  React Frontend: ${boundUrl}/react`));
    }

    // Open browser
    if (options.browser !== false) {
      console.log(chalk.cyan('  Opening in browser...'));
      try {
        // Determine which URL to open based on frontend setting
        let openUrl = browserUrl;
        if (frontend === 'react') {
          openUrl = `${browserUrl}/react`;
        }
        await launchBrowser(openUrl);
        console.log(chalk.green.bold('\n  Dashboard opened in browser!'));
      } catch (err) {
        const error = err as Error;
        console.log(chalk.yellow(`\n  Could not open browser: ${error.message}`));
        console.log(chalk.gray(`  Open manually: ${browserUrl}`));
      }
    }

    console.log(chalk.gray('\n  Press Ctrl+C to stop the server\n'));

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n  Shutting down server...'));
      stopReactFrontend();
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
    stopReactFrontend();
    process.exit(1);
  }
}
