/**
 * Config Routes Module
 * HTTP API endpoints for configuration backup and synchronization from GitHub
 *
 * Backup Endpoints:
 * - POST   /api/config/backup              - Create backup
 * - GET    /api/config/backups             - List backups
 * - DELETE /api/config/backup/:name        - Delete backup
 * - POST   /api/config/backup/:name/restore - Restore backup
 *
 * Sync Endpoints:
 * - POST /api/config/sync      - Sync config files from GitHub (remote-first)
 * - GET  /api/config/status    - Get sync status (local vs remote comparison)
 * - GET  /api/config/remote    - List available remote config files
 */

import type { RouteContext } from './types.js';
import { ConfigBackupService } from '../services/config-backup.js';
import { getConfigSyncService } from '../services/config-sync.js';
import { isValidBackupName, validateConfigDirs, validateGitHubParams } from '../../utils/security-validation.js';

/**
 * Handle config routes
 * @returns true if route was handled, false otherwise
 */
export async function handleConfigRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, req, res, handlePostRequest, broadcastToClients } = ctx;

  // ========== CREATE BACKUP ==========
  // POST /api/config/backup
  if (pathname === '/api/config/backup' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: unknown) => {
      try {
        const { configDirs, backupName } = body as { configDirs?: string[]; backupName?: string };

        // SECURITY: Validate inputs
        if (backupName && !isValidBackupName(backupName)) {
          return {
            success: false,
            error: 'Invalid backup name. Only alphanumeric, hyphen, underscore, and dot characters are allowed.'
          };
        }

        if (configDirs) {
          try {
            validateConfigDirs(configDirs);
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error)
            };
          }
        }

        const backupService = new ConfigBackupService();
        const result = await backupService.createBackup({ configDirs, backupName });

        if (result.success) {
          // Broadcast backup created event
          broadcastToClients({
            type: 'CONFIG_BACKUP_CREATED',
            payload: {
              backupPath: result.backupPath,
              fileCount: result.fileCount,
              timestamp: new Date().toISOString()
            }
          });
        }

        return result;
      } catch (err) {
        return { success: false, error: (err as Error).message, fileCount: 0 };
      }
    });
    return true;
  }

  // ========== LIST BACKUPS ==========
  // GET /api/config/backups
  if (pathname === '/api/config/backups' && req.method === 'GET') {
    try {
      const backupService = new ConfigBackupService();
      const backups = await backupService.listBackups();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: backups }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: (err as Error).message }));
    }
    return true;
  }

  // ========== DELETE BACKUP ==========
  // DELETE /api/config/backup/:name
  const deleteMatch = pathname.match(/^\/api\/config\/backup\/([^/]+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    const backupName = deleteMatch[1];

    // SECURITY: Validate backup name to prevent path traversal
    if (!isValidBackupName(backupName)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Invalid backup name. Only alphanumeric, hyphen, underscore, and dot characters are allowed.'
      }));
      return true;
    }

    try {
      const backupService = new ConfigBackupService();
      const result = await backupService.deleteBackup(backupName);

      if (result.success) {
        // Broadcast backup deleted event
        broadcastToClients({
          type: 'CONFIG_BACKUP_DELETED',
          payload: {
            backupName,
            timestamp: new Date().toISOString()
          }
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: (err as Error).message }));
    }
    return true;
  }

  // ========== RESTORE BACKUP ==========
  // POST /api/config/backup/:name/restore
  const restoreMatch = pathname.match(/^\/api\/config\/backup\/([^/]+)\/restore$/);
  if (restoreMatch && req.method === 'POST') {
    const backupName = restoreMatch[1];

    // SECURITY: Validate backup name to prevent path traversal
    if (!isValidBackupName(backupName)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Invalid backup name. Only alphanumeric, hyphen, underscore, and dot characters are allowed.'
      }));
      return true;
    }

    try {
      const backupService = new ConfigBackupService();
      const result = await backupService.restoreBackup(backupName);

      if (result.success) {
        // Broadcast backup restored event
        broadcastToClients({
          type: 'CONFIG_BACKUP_RESTORED',
          payload: {
            backupName,
            timestamp: new Date().toISOString()
          }
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: (err as Error).message }));
    }
    return true;
  }

  // ========== SYNC CONFIG FROM GITHUB ==========
  // POST /api/config/sync - Sync config files from GitHub (remote-first)
  if (pathname === '/api/config/sync' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { owner, repo, branch, configDirs, baseDir, overwrite } = body as {
        owner?: string;
        repo?: string;
        branch?: string;
        configDirs?: string[];
        baseDir?: string;
        overwrite?: boolean;
      };

      // SECURITY: Validate GitHub parameters (SSRF protection)
      try {
        validateGitHubParams({ owner, repo, branch });

        // Validate config directories (path traversal protection)
        if (configDirs) {
          validateConfigDirs(configDirs);
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }

      const syncService = getConfigSyncService();
      const result = await syncService.syncConfig({
        owner,
        repo,
        branch,
        configDirs,
        baseDir,
        overwrite: overwrite !== false, // default true
      });

      // Broadcast to connected dashboard clients on success
      if (result.success && broadcastToClients) {
        broadcastToClients({
          type: 'CONFIG_SYNCED',
          payload: {
            syncedFiles: result.syncedFiles,
            skippedFiles: result.skippedFiles,
            timestamp: new Date().toISOString(),
          },
        });
      }

      return result;
    });
    return true;
  }

  // ========== GET SYNC STATUS ==========
  // GET /api/config/status - Get sync status (local vs remote comparison)
  if (pathname === '/api/config/status' && req.method === 'GET') {
    try {
      const url = ctx.url;
      const owner = url.searchParams.get('owner') || undefined;
      const repo = url.searchParams.get('repo') || undefined;
      const branch = url.searchParams.get('branch') || undefined;
      const configDirsParam = url.searchParams.get('configDirs');
      const configDirs = configDirsParam ? configDirsParam.split(',') : undefined;
      const baseDir = url.searchParams.get('baseDir') || undefined;

      // SECURITY: Validate inputs
      validateGitHubParams({ owner, repo, branch });
      if (configDirs) {
        validateConfigDirs(configDirs);
      }

      const syncService = getConfigSyncService();
      const status = await syncService.getSyncStatus({
        owner,
        repo,
        branch,
        configDirs,
        baseDir,
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
      }));
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: message,
      }));
      return true;
    }
  }

  // ========== LIST REMOTE CONFIG FILES ==========
  // GET /api/config/remote - List available remote config files
  if (pathname === '/api/config/remote' && req.method === 'GET') {
    try {
      const url = ctx.url;
      const owner = url.searchParams.get('owner') || undefined;
      const repo = url.searchParams.get('repo') || undefined;
      const branch = url.searchParams.get('branch') || undefined;
      const configDir = url.searchParams.get('configDir') || '.claude';

      // SECURITY: Validate inputs
      validateGitHubParams({ owner, repo, branch });
      validateConfigDirs([configDir]); // Single dir validation

      const syncService = getConfigSyncService();
      const files = await syncService.listRemoteFiles(configDir, {
        owner,
        repo,
        branch,
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: {
          configDir,
          files,
        },
        timestamp: new Date().toISOString(),
      }));
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: message,
      }));
      return true;
    }
  }

  return false;
}
