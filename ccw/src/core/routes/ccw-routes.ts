// @ts-nocheck
/**
 * CCW Routes Module
 * Handles all CCW-related API endpoints
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { getAllManifests } from '../manifest.js';
import { listTools } from '../../tools/index.js';

export interface RouteContext {
  pathname: string;
  url: URL;
  req: IncomingMessage;
  res: ServerResponse;
  initialPath: string;
  handlePostRequest: (req: IncomingMessage, res: ServerResponse, handler: (body: unknown) => Promise<any>) => void;
  broadcastToClients: (data: unknown) => void;
}

/**
 * Handle CCW routes
 * @returns true if route was handled, false otherwise
 */
export async function handleCcwRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, url, req, res, initialPath, handlePostRequest, broadcastToClients } = ctx;

  // API: CCW Installation Status
  if (pathname === '/api/ccw/installations') {
    const manifests = getAllManifests();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ installations: manifests }));
    return true;
  }

  // API: CCW Endpoint Tools List
  if (pathname === '/api/ccw/tools') {
    const tools = listTools();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tools }));
    return true;
  }

  // API: CCW Upgrade
  if (pathname === '/api/ccw/upgrade' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { path: installPath } = body;

      try {
        const { spawn } = await import('child_process');

        // Run ccw upgrade command
        const args = installPath ? ['upgrade', '--all'] : ['upgrade', '--all'];
        const upgradeProcess = spawn('ccw', args, {
          shell: true,
          stdio: ['ignore', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        upgradeProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        upgradeProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        return new Promise((resolve) => {
          upgradeProcess.on('close', (code) => {
            if (code === 0) {
              resolve({ success: true, message: 'Upgrade completed', output: stdout });
            } else {
              resolve({ success: false, error: stderr || 'Upgrade failed', output: stdout, status: 500 });
            }
          });

          upgradeProcess.on('error', (err) => {
            resolve({ success: false, error: err.message, status: 500 });
          });

          // Timeout after 2 minutes
          setTimeout(() => {
            upgradeProcess.kill();
            resolve({ success: false, error: 'Upgrade timed out', status: 504 });
          }, 120000);
        });
      } catch (err) {
        return { success: false, error: err.message, status: 500 };
      }
    });
    return true;
  }

  return false;
}
