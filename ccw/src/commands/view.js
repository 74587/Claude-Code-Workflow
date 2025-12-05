import { serveCommand } from './serve.js';

/**
 * View command handler - starts dashboard server (unified with serve mode)
 * @param {Object} options - Command options
 */
export async function viewCommand(options) {
  // Forward to serve command with same options
  await serveCommand({
    path: options.path,
    port: options.port || 3456,
    browser: options.browser
  });
}
