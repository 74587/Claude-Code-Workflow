// @ts-nocheck
/**
 * Status Routes Module
 * Aggregated status endpoint for faster dashboard loading
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { getCliToolsStatus } from '../../tools/cli-executor.js';
import { checkVenvStatus, checkSemanticStatus } from '../../tools/codex-lens.js';

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
 * Handle status routes
 * @returns true if route was handled, false otherwise
 */
export async function handleStatusRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, res } = ctx;

  // API: Aggregated Status (all statuses in one call)
  if (pathname === '/api/status/all') {
    try {
      // Execute all status checks in parallel
      const [cliStatus, codexLensStatus, semanticStatus] = await Promise.all([
        getCliToolsStatus(),
        checkVenvStatus(),
        // Always check semantic status (will return available: false if CodexLens not ready)
        checkSemanticStatus().catch(() => ({ available: false, backend: null }))
      ]);

      const response = {
        cli: cliStatus,
        codexLens: codexLensStatus,
        semantic: semanticStatus,
        timestamp: new Date().toISOString()
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return true;
    } catch (error) {
      console.error('[Status Routes] Error fetching aggregated status:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (error as Error).message }));
      return true;
    }
  }

  return false;
}
