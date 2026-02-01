/**
 * CCW Routes Module
 * Handles all CCW-related API endpoints
 */
import { getAllManifests } from '../manifest.js';
import { listTools } from '../../tools/index.js';
import { loadProjectOverview } from '../data-aggregator.js';
import { resolvePath } from '../../utils/path-resolver.js';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import type { RouteContext } from './types.js';

/**
 * Handle CCW routes
 * @returns true if route was handled, false otherwise
 */
export async function handleCcwRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, url, req, res, initialPath, handlePostRequest, broadcastToClients } = ctx;

  // API: Project Overview
  if (pathname === '/api/ccw' && req.method === 'GET') {
    const projectPath = url.searchParams.get('path') || initialPath;
    const resolvedPath = resolvePath(projectPath);
    const workflowDir = join(resolvedPath, '.workflow');

    const projectOverview = loadProjectOverview(workflowDir);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ projectOverview }));
    return true;
  }

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

  // API: Get Project Guidelines
  if (pathname === '/api/ccw/guidelines' && req.method === 'GET') {
    const projectPath = url.searchParams.get('path') || initialPath;
    const resolvedPath = resolvePath(projectPath);
    const guidelinesFile = join(resolvedPath, '.workflow', 'project-guidelines.json');

    if (!existsSync(guidelinesFile)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ guidelines: null }));
      return true;
    }

    try {
      const content = readFileSync(guidelinesFile, 'utf-8');
      const guidelines = JSON.parse(content);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ guidelines }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to read guidelines file' }));
    }
    return true;
  }

  // API: Update Project Guidelines
  if (pathname === '/api/ccw/guidelines' && req.method === 'PUT') {
    handlePostRequest(req, res, async (body) => {
      const projectPath = url.searchParams.get('path') || initialPath;
      const resolvedPath = resolvePath(projectPath);
      const guidelinesFile = join(resolvedPath, '.workflow', 'project-guidelines.json');

      try {
        const data = body as Record<string, unknown>;

        // Read existing file to preserve _metadata.created_at
        let existingMetadata: Record<string, unknown> = {};
        if (existsSync(guidelinesFile)) {
          try {
            const existing = JSON.parse(readFileSync(guidelinesFile, 'utf-8'));
            existingMetadata = existing._metadata || {};
          } catch { /* ignore parse errors */ }
        }

        // Build the guidelines object
        const guidelines = {
          conventions: data.conventions || { coding_style: [], naming_patterns: [], file_structure: [], documentation: [] },
          constraints: data.constraints || { architecture: [], tech_stack: [], performance: [], security: [] },
          quality_rules: data.quality_rules || [],
          learnings: data.learnings || [],
          _metadata: {
            created_at: (existingMetadata.created_at as string) || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            version: (existingMetadata.version as string) || '1.0.0',
          },
        };

        writeFileSync(guidelinesFile, JSON.stringify(guidelines, null, 2), 'utf-8');

        broadcastToClients({
          type: 'PROJECT_GUIDELINES_UPDATED',
          payload: { timestamp: new Date().toISOString() },
        });

        return { success: true, guidelines };
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  // API: CCW Upgrade
  if (pathname === '/api/ccw/upgrade' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { path: installPath } = body as { path?: unknown };
      const resolvedInstallPath = typeof installPath === 'string' && installPath.trim().length > 0 ? installPath : undefined;

      try {
        const { spawn } = await import('child_process');

        // Run ccw upgrade command
        const args = resolvedInstallPath ? ['upgrade', '--all'] : ['upgrade', '--all'];
        const upgradeProcess = spawn('ccw', args, {
          shell: true,
          stdio: ['ignore', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        upgradeProcess.stdout?.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        upgradeProcess.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        return new Promise((resolve) => {
          upgradeProcess.on('close', (code: number | null) => {
            if (code === 0) {
              resolve({ success: true, message: 'Upgrade completed', output: stdout });
            } else {
              resolve({ success: false, error: stderr || 'Upgrade failed', output: stdout, status: 500 });
            }
          });

          upgradeProcess.on('error', (err: Error) => {
            resolve({ success: false, error: err.message, status: 500 });
          });

          // Timeout after 2 minutes
          setTimeout(() => {
            upgradeProcess.kill();
            resolve({ success: false, error: 'Upgrade timed out', status: 504 });
          }, 120000);
        });
      } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : String(err), status: 500 };
      }
    });
    return true;
  }

  return false;
}
