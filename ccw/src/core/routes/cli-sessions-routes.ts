/**
 * CLI Sessions (PTY) Routes Module
 * Independent from existing /api/cli/* execution endpoints.
 *
 * Endpoints:
 * - GET  /api/cli-sessions
 * - POST /api/cli-sessions
 * - GET  /api/cli-sessions/:sessionKey/buffer
 * - POST /api/cli-sessions/:sessionKey/send
 * - POST /api/cli-sessions/:sessionKey/execute
 * - POST /api/cli-sessions/:sessionKey/resize
 * - POST /api/cli-sessions/:sessionKey/close
 */

import type { RouteContext } from './types.js';
import { getCliSessionManager } from '../services/cli-session-manager.js';

export async function handleCliSessionsRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, req, res, handlePostRequest, initialPath } = ctx;
  const manager = getCliSessionManager(process.cwd());

  // GET /api/cli-sessions
  if (pathname === '/api/cli-sessions' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ sessions: manager.listSessions() }));
    return true;
  }

  // POST /api/cli-sessions
  if (pathname === '/api/cli-sessions' && req.method === 'POST') {
    handlePostRequest(req, res, async (body: unknown) => {
      const {
        workingDir,
        cols,
        rows,
        preferredShell,
        tool,
        model,
        resumeKey
      } = (body || {}) as any;

      const session = manager.createSession({
        workingDir: workingDir || initialPath,
        cols: typeof cols === 'number' ? cols : undefined,
        rows: typeof rows === 'number' ? rows : undefined,
        preferredShell: preferredShell === 'pwsh' ? 'pwsh' : 'bash',
        tool,
        model,
        resumeKey
      });

      return { success: true, session };
    });
    return true;
  }

  // GET /api/cli-sessions/:sessionKey/buffer
  const bufferMatch = pathname.match(/^\/api\/cli-sessions\/([^/]+)\/buffer$/);
  if (bufferMatch && req.method === 'GET') {
    const sessionKey = decodeURIComponent(bufferMatch[1]);
    const session = manager.getSession(sessionKey);
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
      return true;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ session, buffer: manager.getBuffer(sessionKey) }));
    return true;
  }

  // POST /api/cli-sessions/:sessionKey/send
  const sendMatch = pathname.match(/^\/api\/cli-sessions\/([^/]+)\/send$/);
  if (sendMatch && req.method === 'POST') {
    const sessionKey = decodeURIComponent(sendMatch[1]);
    handlePostRequest(req, res, async (body: unknown) => {
      const { text, appendNewline } = (body || {}) as any;
      if (typeof text !== 'string') {
        return { error: 'text is required', status: 400 };
      }
      manager.sendText(sessionKey, text, appendNewline !== false);
      return { success: true };
    });
    return true;
  }

  // POST /api/cli-sessions/:sessionKey/execute
  const executeMatch = pathname.match(/^\/api\/cli-sessions\/([^/]+)\/execute$/);
  if (executeMatch && req.method === 'POST') {
    const sessionKey = decodeURIComponent(executeMatch[1]);
    handlePostRequest(req, res, async (body: unknown) => {
      const {
        tool,
        prompt,
        mode,
        model,
        workingDir,
        category,
        resumeKey,
        resumeStrategy
      } = (body || {}) as any;

      if (!tool || typeof tool !== 'string') {
        return { error: 'tool is required', status: 400 };
      }
      if (!prompt || typeof prompt !== 'string') {
        return { error: 'prompt is required', status: 400 };
      }

      const result = manager.execute(sessionKey, {
        tool,
        prompt,
        mode,
        model,
        workingDir,
        category,
        resumeKey,
        resumeStrategy: resumeStrategy === 'promptConcat' ? 'promptConcat' : 'nativeResume'
      });

      return { success: true, ...result };
    });
    return true;
  }

  // POST /api/cli-sessions/:sessionKey/resize
  const resizeMatch = pathname.match(/^\/api\/cli-sessions\/([^/]+)\/resize$/);
  if (resizeMatch && req.method === 'POST') {
    const sessionKey = decodeURIComponent(resizeMatch[1]);
    handlePostRequest(req, res, async (body: unknown) => {
      const { cols, rows } = (body || {}) as any;
      if (typeof cols !== 'number' || typeof rows !== 'number') {
        return { error: 'cols and rows are required', status: 400 };
      }
      manager.resize(sessionKey, cols, rows);
      return { success: true };
    });
    return true;
  }

  // POST /api/cli-sessions/:sessionKey/close
  const closeMatch = pathname.match(/^\/api\/cli-sessions\/([^/]+)\/close$/);
  if (closeMatch && req.method === 'POST') {
    const sessionKey = decodeURIComponent(closeMatch[1]);
    manager.close(sessionKey);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return true;
  }

  return false;
}

