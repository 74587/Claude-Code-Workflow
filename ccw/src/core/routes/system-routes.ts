/**
 * System Routes Module
 * Handles all system-related API endpoints
 */
import type { Server } from 'http';
import { readFileSync, existsSync, promises as fsPromises } from 'fs';
import { join } from 'path';
import { resolvePath, getRecentPaths, trackRecentPath, removeRecentPath, normalizePathForDisplay } from '../../utils/path-resolver.js';
import { validatePath as validateAllowedPath } from '../../utils/path-validator.js';
import { scanSessions } from '../session-scanner.js';
import { aggregateData } from '../data-aggregator.js';
import {
  getStorageStats,
  getStorageConfig,
  cleanProjectStorage,
  cleanAllStorage,
  resolveProjectId,
  projectExists,
   formatBytes
 } from '../../tools/storage-manager.js';
import type { RouteContext } from './types.js';

interface SystemRouteContext extends RouteContext {
  server: Server;
}

// ========================================
// Helper Functions
// ========================================

// Package name on npm registry
const NPM_PACKAGE_NAME = 'claude-code-workflow';

// Cache for version check (avoid too frequent requests)
let versionCheckCache: Record<string, unknown> | null = null;
let versionCheckTime = 0;
const VERSION_CHECK_CACHE_TTL = 3600000; // 1 hour

/**
 * Get current package version from package.json
 * @returns {string}
 */
function getCurrentVersion(): string {
  try {
    const packageJsonPath = join(import.meta.dirname, '../../../../package.json');
    if (existsSync(packageJsonPath)) {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      return pkg.version || '0.0.0';
    }
  } catch (e) {
    console.error('Error reading package.json:', e);
  }
  return '0.0.0';
}

/**
 * Compare two semver versions
 * @param {string} v1
 * @param {string} v2
 * @returns {number} 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

/**
 * Check npm registry for latest version
 * @returns {Promise<Object>}
 */
async function checkNpmVersion(): Promise<Record<string, unknown>> {
  // Return cached result if still valid
  const now = Date.now();
  if (versionCheckCache && (now - versionCheckTime) < VERSION_CHECK_CACHE_TTL) {
    return versionCheckCache;
  }

  const currentVersion = getCurrentVersion();

  try {
    // Fetch latest version from npm registry
    const npmUrl = 'https://registry.npmjs.org/' + encodeURIComponent(NPM_PACKAGE_NAME) + '/latest';
    const response = await fetch(npmUrl, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }

    const data = await response.json() as { version?: unknown };
    const latestVersion = typeof data.version === 'string' ? data.version : currentVersion;

    // Compare versions
    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

    const result = {
      currentVersion,
      latestVersion,
      hasUpdate,
      packageName: NPM_PACKAGE_NAME,
      updateCommand: 'npm update -g ' + NPM_PACKAGE_NAME,
      checkedAt: new Date().toISOString()
    };

    // Cache the result
    versionCheckCache = result;
    versionCheckTime = now;

    return result;
  } catch (error: unknown) {
    console.error('Version check failed:', (error as Error).message);
    return {
      currentVersion,
      latestVersion: null,
      hasUpdate: false,
      error: (error as Error).message,
      checkedAt: new Date().toISOString()
    };
  }
}

/**
 * Get workflow data for a project path
 * @param {string} projectPath
 * @returns {Promise<Object>}
 */
async function getWorkflowData(projectPath: string): Promise<any> {
  const resolvedPath = resolvePath(projectPath);
  const workflowDir = join(resolvedPath, '.workflow');

  // Track this path
  trackRecentPath(resolvedPath);

  // Check if .workflow exists
  if (!existsSync(workflowDir)) {
    return {
      generatedAt: new Date().toISOString(),
      activeSessions: [],
      archivedSessions: [],
      liteTasks: { litePlan: [], liteFix: [], multiCliPlan: [] },
      reviewData: { dimensions: {} },
      projectOverview: null,
      statistics: {
        totalSessions: 0,
        activeSessions: 0,
        totalTasks: 0,
        completedTasks: 0,
        reviewFindings: 0,
        litePlanCount: 0,
        liteFixCount: 0,
        multiCliPlanCount: 0
      },
      projectPath: normalizePathForDisplay(resolvedPath),
      recentPaths: getRecentPaths()
    };
  }

  // Scan and aggregate data
  const sessions = await scanSessions(workflowDir);
  const data = await aggregateData(sessions, workflowDir);

  return {
    ...data,
    projectPath: normalizePathForDisplay(resolvedPath),
    recentPaths: getRecentPaths()
  };
}

// ========================================
// Route Handler
// ========================================

/**
 * Handle System routes
 * @returns true if route was handled, false otherwise
 */
export async function handleSystemRoutes(ctx: SystemRouteContext): Promise<boolean> {
  const { pathname, url, req, res, initialPath, handlePostRequest, broadcastToClients, server } = ctx;

  // API: Get workflow data for a path
  if (pathname === '/api/data') {
    const projectPath = url.searchParams.get('path') || initialPath;
    const data = await getWorkflowData(projectPath);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return true;
  }

  // API: Get recent paths
  if (pathname === '/api/recent-paths') {
    const paths = getRecentPaths();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ paths }));
    return true;
  }

  // API: Switch workspace path (for ccw view command)
  if (pathname === '/api/switch-path') {
    const newPath = url.searchParams.get('path');
    if (!newPath) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Path is required' }));
      return true;
    }

    const resolved = resolvePath(newPath);
    if (!existsSync(resolved)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Path does not exist' }));
      return true;
    }

    // Get full workflow data for the new path
    const workflowData = await getWorkflowData(resolved);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      ...workflowData
    }));
    return true;
  }

  // API: Health check (for ccw view to detect running server)
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
    return true;
  }

  // API: Version check (check for npm updates)
  if (pathname === '/api/version-check') {
    const versionData = await checkNpmVersion();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(versionData));
    return true;
  }

  // API: Shutdown server (for ccw stop command)
  if (pathname === '/api/shutdown' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'shutting_down' }));

    // Graceful shutdown
    console.log('\n  Received shutdown signal...');
    setTimeout(() => {
      server.close(() => {
        console.log('  Server stopped.\n');
        process.exit(0);
      });
      // Force exit after 3 seconds if graceful shutdown fails
      setTimeout(() => process.exit(0), 3000);
    }, 100);
    return true;
  }

  // API: Remove a recent path
  if (pathname === '/api/remove-recent-path' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { path } = body as { path?: string };
      if (!path) {
        return { error: 'path is required', status: 400 };
      }
      const removed = removeRecentPath(path);
      return { success: removed, paths: getRecentPaths() };
    });
    return true;
  }

  // API: Read a JSON file (for fix progress tracking)
  if (pathname === '/api/file') {
    const filePath = url.searchParams.get('path');
    if (!filePath) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File path is required' }));
      return true;
    }

    let validatedPath: string;
    try {
      // Validate path is within allowed directories (fix: sec-001-a1b2c3d4)
      validatedPath = await validateAllowedPath(filePath, { mustExist: true, allowedDirectories: [initialPath] });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes('Access denied') ? 403 : (message.includes('File not found') ? 404 : 400);
      console.error(`[System] Path validation failed: ${message}`);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: status === 403 ? 'Access denied' : (status === 404 ? 'File not found' : 'Invalid path')
      }));
      return true;
    }

    try {
      const content = await fsPromises.readFile(validatedPath, 'utf-8');
      const json = JSON.parse(content);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(json));
    } catch (err: unknown) {
      const errno = typeof err === 'object' && err !== null && 'code' in err ? String((err as any).code) : null;
      const status = err instanceof SyntaxError ? 400 : (errno === 'EACCES' ? 403 : 404);
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[System] Failed to read JSON file: ${message}`);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: status === 403 ? 'Access denied' : (status === 400 ? 'Invalid JSON' : 'File not found')
      }));
    }
    return true;
  }

  // API: System notify - CLI to Server communication bridge
  // Allows CLI commands to trigger WebSocket broadcasts for UI updates
  if (pathname === '/api/system/notify' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { type, scope, data } = body as {
        type: 'REFRESH_REQUIRED' | 'MEMORY_UPDATED' | 'HISTORY_UPDATED' | 'INSIGHT_GENERATED';
        scope: 'memory' | 'history' | 'insights' | 'all';
        data?: Record<string, unknown>;
      };

      if (!type || !scope) {
        return { error: 'type and scope are required', status: 400 };
      }

      // Map CLI notification types to WebSocket broadcast format
      const notification = {
        type,
        payload: {
          scope,
          timestamp: new Date().toISOString(),
          ...data
        }
      };

      broadcastToClients(notification);

      return { success: true, broadcast: true };
    });
    return true;
  }

  // API: Get storage statistics
  if (pathname === '/api/storage/stats') {
    try {
      const stats = getStorageStats();
      const config = getStorageConfig();

      // Format for dashboard display
      const response = {
        location: stats.rootPath,
        isCustomLocation: config.isCustom,
        totalSize: stats.totalSize,
        totalSizeFormatted: formatBytes(stats.totalSize),
        projectCount: stats.projectCount,
        globalDb: stats.globalDb,
        projects: stats.projects.map(p => ({
          id: p.projectId,
          totalSize: p.totalSize,
          totalSizeFormatted: formatBytes(p.totalSize),
          historyRecords: p.cliHistory.recordCount ?? 0,
          hasCliHistory: p.cliHistory.exists,
          hasMemory: p.memory.exists,
          hasCache: p.cache.exists,
          lastModified: p.lastModified?.toISOString() || null
        }))
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to get storage stats', details: String(err) }));
    }
    return true;
  }

  // API: Clean storage
  if (pathname === '/api/storage/clean' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { projectId, projectPath, all, types } = body as {
        projectId?: string;
        projectPath?: string;
        all?: boolean;
        types?: { cliHistory?: boolean; memory?: boolean; cache?: boolean; config?: boolean };
      };

      const cleanOptions = types || { all: true };

      if (projectId) {
        // Clean specific project by ID
        if (!projectExists(projectId)) {
          return { error: 'Project not found', status: 404 };
        }
        const result = cleanProjectStorage(projectId, cleanOptions);
        return {
          success: result.success,
          freedBytes: result.freedBytes,
          freedFormatted: formatBytes(result.freedBytes),
          errors: result.errors
        };
      } else if (projectPath) {
        // Clean specific project by path
        const id = resolveProjectId(projectPath);
        if (!projectExists(id)) {
          return { error: 'No storage found for project', status: 404 };
        }
        const result = cleanProjectStorage(id, cleanOptions);
        return {
          success: result.success,
          freedBytes: result.freedBytes,
          freedFormatted: formatBytes(result.freedBytes),
          errors: result.errors
        };
      } else if (all) {
        // Clean all storage
        const result = cleanAllStorage(cleanOptions);
        return {
          success: result.success,
          projectsCleaned: result.projectsCleaned,
          freedBytes: result.freedBytes,
          freedFormatted: formatBytes(result.freedBytes),
          errors: result.errors
        };
      } else {
        return { error: 'Specify projectId, projectPath, or all=true', status: 400 };
      }
    });
    return true;
  }

  // API: File dialog - list directory contents for file browser
  if (pathname === '/api/dialog/browse' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { path: browsePath, showHidden } = body as {
        path?: string;
        showHidden?: boolean;
      };

      const os = await import('os');
      const path = await import('path');
      const fs = await import('fs');

      // Default to home directory
      let targetPath = browsePath || os.homedir();

      // Expand ~ to home directory
      if (targetPath.startsWith('~')) {
        targetPath = path.join(os.homedir(), targetPath.slice(1));
      }

      // Resolve to absolute path
      if (!path.isAbsolute(targetPath)) {
        targetPath = path.resolve(targetPath);
      }

      // Validate path is within allowed directories (fix: sec-003-c3d4e5f6)
      try {
        targetPath = await validateAllowedPath(targetPath, {
          mustExist: true,
          allowedDirectories: [initialPath, os.homedir()]
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const status = message.includes('Access denied') ? 403 : 400;
        console.error(`[System] Path validation failed: ${message}`);
        return { error: status === 403 ? 'Access denied' : 'Invalid path', status };
      }

      try {
        const stat = await fs.promises.stat(targetPath);
        if (!stat.isDirectory()) {
          return { error: 'Path is not a directory', status: 400 };
        }

        const entries = await fs.promises.readdir(targetPath, { withFileTypes: true });
        const items = entries
          .filter(entry => showHidden || !entry.name.startsWith('.'))
          .map(entry => ({
            name: entry.name,
            path: path.join(targetPath, entry.name),
            isDirectory: entry.isDirectory(),
            isFile: entry.isFile()
          }))
          .sort((a, b) => {
            // Directories first, then files
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
          });

        return {
          currentPath: targetPath,
          parentPath: path.dirname(targetPath),
          items,
          homePath: os.homedir()
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[System] Failed to browse directory: ${message}`);
        return { error: 'Cannot access directory', status: 400 };
      }
    });
    return true;
  }

  // API: File dialog - select file (validate path exists)
  if (pathname === '/api/dialog/open-file' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { path: filePath } = body as { path?: string };

      if (!filePath) {
        return { error: 'Path is required', status: 400 };
      }

      const os = await import('os');
      const path = await import('path');
      const fs = await import('fs');

      let targetPath = filePath;

      // Expand ~ to home directory
      if (targetPath.startsWith('~')) {
        targetPath = path.join(os.homedir(), targetPath.slice(1));
      }

      // Resolve to absolute path
      if (!path.isAbsolute(targetPath)) {
        targetPath = path.resolve(targetPath);
      }

      // Validate path is within allowed directories (fix: sec-003-c3d4e5f6)
      try {
        targetPath = await validateAllowedPath(targetPath, {
          mustExist: true,
          allowedDirectories: [initialPath, os.homedir()]
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const status = message.includes('Access denied') ? 403 : 400;
        console.error(`[System] Path validation failed: ${message}`);
        return { error: status === 403 ? 'Access denied' : 'Invalid path', status };
      }

      try {
        await fs.promises.access(targetPath, fs.constants.R_OK);
        const stat = await fs.promises.stat(targetPath);

        return {
          success: true,
          path: targetPath,
          isFile: stat.isFile(),
          isDirectory: stat.isDirectory()
        };
      } catch (err: unknown) {
        const errno = typeof err === 'object' && err !== null && 'code' in err ? String((err as any).code) : null;
        const status = errno === 'EACCES' ? 403 : 404;
        return { error: status === 403 ? 'Access denied' : 'File not accessible', status };
      }
    });
    return true;
  }

  // API: Test ask_question popup (for development testing)
  if (pathname === '/api/test/ask-question' && req.method === 'GET') {
    try {
      // Import the A2UI handler
      const { a2uiWebSocketHandler } = await import('../a2ui/A2UIWebSocketHandler.js');

      // Create a test surface with displayMode: 'popup'
      const testSurface = {
        surfaceId: `test-question-${Date.now()}`,
        components: [
          {
            id: 'title',
            component: {
              Text: {
                text: { literalString: 'Test Popup Question' },
                usageHint: 'h3',
              },
            },
          },
          {
            id: 'message',
            component: {
              Text: {
                text: { literalString: 'This is a test popup card. Does it appear in the center?' },
                usageHint: 'p',
              },
            },
          },
          {
            id: 'confirm-btn',
            component: {
              Button: {
                onClick: { actionId: 'confirm', parameters: { questionId: 'test-q-1' } },
                content: {
                  Text: { text: { literalString: 'Confirm' } },
                },
                variant: 'primary',
              },
            },
          },
          {
            id: 'cancel-btn',
            component: {
              Button: {
                onClick: { actionId: 'cancel', parameters: { questionId: 'test-q-1' } },
                content: {
                  Text: { text: { literalString: 'Cancel' } },
                },
                variant: 'secondary',
              },
            },
          },
        ],
        initialState: {
          questionId: 'test-q-1',
          questionType: 'confirm',
        },
        displayMode: 'popup' as const,
      };

      // Send the surface via WebSocket
      const sentCount = a2uiWebSocketHandler.sendSurface(testSurface);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Test popup sent',
        sentToClients: sentCount,
        surfaceId: testSurface.surfaceId
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to send test popup', details: String(err) }));
    }
    return true;
  }

  return false;
}
