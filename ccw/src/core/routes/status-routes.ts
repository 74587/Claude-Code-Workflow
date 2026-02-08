/**
 * Status Routes Module
 * Aggregated status endpoint for faster dashboard loading
 */
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { getCliToolsStatus } from '../../tools/cli-executor.js';
import { checkVenvStatus, checkSemanticStatus } from '../../tools/codex-lens.js';
import type { RouteContext } from './types.js';

// Performance logging helper
const PERF_LOG_ENABLED = process.env.CCW_PERF_LOG === '1' || true; // Enable by default for debugging
function perfLog(label: string, startTime: number, extra?: Record<string, unknown>): void {
  if (!PERF_LOG_ENABLED) return;
  const duration = Date.now() - startTime;
  const extraStr = extra ? ` | ${JSON.stringify(extra)}` : '';
  console.log(`[PERF][Status] ${label}: ${duration}ms${extraStr}`);
}

/**
 * Check CCW installation status
 * Verifies that required workflow files are installed in user's home directory
 */
function checkCcwInstallStatus(): {
  installed: boolean;
  workflowsInstalled: boolean;
  missingFiles: string[];
  installPath: string;
} {
  const ccwDir = join(homedir(), '.ccw');
  const workflowsDir = join(ccwDir, 'workflows');

  // Required workflow files for full functionality
  const requiredFiles = [
    'chinese-response.md',
    'windows-platform.md',
    'cli-tools-usage.md',
    'coding-philosophy.md',
    'context-tools.md',
    'file-modification.md'
  ];

  const missingFiles: string[] = [];

  // Check each required file
  for (const file of requiredFiles) {
    const filePath = join(workflowsDir, file);
    if (!existsSync(filePath)) {
      missingFiles.push(file);
    }
  }

  const workflowsInstalled = existsSync(workflowsDir) && missingFiles.length === 0;
  const installed = existsSync(ccwDir) && workflowsInstalled;

  return {
    installed,
    workflowsInstalled,
    missingFiles,
    installPath: ccwDir
  };
}

/**
 * Handle status routes
 * @returns true if route was handled, false otherwise
 */
export async function handleStatusRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, res } = ctx;

  // API: Aggregated Status (all statuses in one call)
  if (pathname === '/api/status/all') {
    const totalStart = Date.now();
    console.log('[PERF][Status] === /api/status/all START ===');

    try {
      // Check CCW installation status (sync, fast)
      const ccwStart = Date.now();
      const ccwInstallStatus = checkCcwInstallStatus();
      perfLog('checkCcwInstallStatus', ccwStart);

      // Execute all status checks in parallel with individual timing
      const cliStart = Date.now();
      const codexStart = Date.now();
      const semanticStart = Date.now();

      const [cliStatus, codexLensStatus, semanticStatus] = await Promise.all([
        getCliToolsStatus().then(result => {
          perfLog('getCliToolsStatus', cliStart, { toolCount: Object.keys(result).length });
          return result;
        }),
        checkVenvStatus().then(result => {
          perfLog('checkVenvStatus', codexStart, { ready: result.ready });
          return result;
        }),
        // Always check semantic status (will return available: false if CodexLens not ready)
        checkSemanticStatus()
          .then(result => {
            perfLog('checkSemanticStatus', semanticStart, { available: result.available });
            return result;
          })
          .catch(() => {
            perfLog('checkSemanticStatus (error)', semanticStart);
            return { available: false, backend: null };
          })
      ]);

      const response = {
        cli: cliStatus,
        codexLens: codexLensStatus,
        semantic: semanticStatus,
        ccwInstall: ccwInstallStatus,
        timestamp: new Date().toISOString()
      };

      perfLog('=== /api/status/all TOTAL ===', totalStart);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return true;
    } catch (error) {
      perfLog('=== /api/status/all ERROR ===', totalStart);
      console.error('[Status Routes] Error fetching aggregated status:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (error as Error).message }));
      return true;
    }
  }

  return false;
}
