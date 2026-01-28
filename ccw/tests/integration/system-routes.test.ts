/**
 * Integration tests for system routes (data/health/recent-paths/switch-path/shutdown).
 *
 * Notes:
 * - Targets runtime implementation shipped in `ccw/dist`.
 * - Uses a temporary CCW data directory (CCW_DATA_DIR) to isolate recent-paths writes.
 */

import { after, before, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, parse } from 'node:path';

const CCW_HOME = mkdtempSync(join(tmpdir(), 'ccw-system-routes-home-'));
const PROJECT_ROOT = mkdtempSync(join(tmpdir(), 'ccw-system-routes-project-'));
const OUTSIDE_ROOT = mkdtempSync(join(tmpdir(), 'ccw-system-routes-outside-'));

const systemRoutesUrl = new URL('../../dist/core/routes/system-routes.js', import.meta.url);
systemRoutesUrl.searchParams.set('t', String(Date.now()));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod: any;

const originalEnv = { CCW_DATA_DIR: process.env.CCW_DATA_DIR };

type JsonResponse = { status: number; json: any; text: string };

async function requestJson(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<JsonResponse> {
  const url = new URL(path, baseUrl);
  const payload = body === undefined ? null : Buffer.from(JSON.stringify(body), 'utf8');

  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      {
        method,
        headers: {
          Accept: 'application/json',
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': String(payload.length) }
            : {}),
        },
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk.toString();
        });
        res.on('end', () => {
          let json: any = null;
          try {
            json = responseBody ? JSON.parse(responseBody) : null;
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode || 0, json, text: responseBody });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function handlePostRequest(req: http.IncomingMessage, res: http.ServerResponse, handler: (body: unknown) => Promise<any>): void {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString();
  });
  req.on('end', async () => {
    try {
      const parsed = body ? JSON.parse(body) : {};
      const result = await handler(parsed);

      if (result?.error) {
        res.writeHead(result.status || 500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: result.error }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      }
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err?.message || String(err) }));
    }
  });
}

async function createServer(initialPath: string): Promise<{ server: http.Server; baseUrl: string }> {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const pathname = url.pathname;

    const ctx = {
      pathname,
      url,
      req,
      res,
      initialPath,
      handlePostRequest,
      broadcastToClients() {},
      server,
    };

    try {
      const handled = await mod.handleSystemRoutes(ctx);
      if (!handled) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
      }
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err?.message || String(err) }));
    }
  });

  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

describe('system routes integration', async () => {
  before(async () => {
    process.env.CCW_DATA_DIR = CCW_HOME;
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});
    mod = await import(systemRoutesUrl.href);
  });

  after(() => {
    mock.restoreAll();
    process.env.CCW_DATA_DIR = originalEnv.CCW_DATA_DIR;
    rmSync(CCW_HOME, { recursive: true, force: true });
    rmSync(PROJECT_ROOT, { recursive: true, force: true });
    rmSync(OUTSIDE_ROOT, { recursive: true, force: true });
  });

  it('GET /api/health returns ok payload', async () => {
    const { server, baseUrl } = await createServer(PROJECT_ROOT);
    try {
      const res = await requestJson(baseUrl, 'GET', '/api/health');
      assert.equal(res.status, 200);
      assert.equal(res.json.status, 'ok');
      assert.equal(typeof res.json.timestamp, 'number');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('GET /api/data returns default workflow data when .workflow is missing', async () => {
    const { server, baseUrl } = await createServer(PROJECT_ROOT);
    try {
      const res = await requestJson(baseUrl, 'GET', `/api/data?path=${encodeURIComponent(PROJECT_ROOT)}`);
      assert.equal(res.status, 200);

      assert.equal(Array.isArray(res.json.activeSessions), true);
      assert.equal(Array.isArray(res.json.archivedSessions), true);
      assert.ok(typeof res.json.generatedAt === 'string' && res.json.generatedAt.length > 0);
      assert.ok(typeof res.json.projectPath === 'string' && res.json.projectPath.length > 0);
      assert.equal(Array.isArray(res.json.recentPaths), true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('GET /api/recent-paths returns an array and /api/switch-path validates paths', async () => {
    const { server, baseUrl } = await createServer(PROJECT_ROOT);
    try {
      const recent = await requestJson(baseUrl, 'GET', '/api/recent-paths');
      assert.equal(recent.status, 200);
      assert.equal(Array.isArray(recent.json.paths), true);

      const missing = await requestJson(baseUrl, 'GET', '/api/switch-path');
      assert.equal(missing.status, 400);
      assert.ok(String(missing.json.error).includes('Path is required'));

      const invalidPath = join(PROJECT_ROOT, 'does-not-exist');
      const invalid = await requestJson(baseUrl, 'GET', `/api/switch-path?path=${encodeURIComponent(invalidPath)}`);
      assert.equal(invalid.status, 404);
      assert.ok(String(invalid.json.error).includes('Path does not exist'));

      const ok = await requestJson(baseUrl, 'GET', `/api/switch-path?path=${encodeURIComponent(PROJECT_ROOT)}`);
      assert.equal(ok.status, 200);
      assert.equal(ok.json.success, true);
      assert.ok(typeof ok.json.path === 'string' && ok.json.path.length > 0);
      assert.equal(Array.isArray(ok.json.recentPaths), true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('POST /api/shutdown responds and triggers graceful shutdown callbacks', async () => {
    const { server, baseUrl } = await createServer(PROJECT_ROOT);

    const exitCalls: Array<number | undefined> = [];
    const originalSetTimeout = global.setTimeout;

    // Avoid the 3s forced-exit timer from calling the real process.exit later.
    (global as any).setTimeout = ((fn: any, delay: number, ...args: any[]) => {
      if (delay === 3000) {
        return originalSetTimeout(() => {}, 0);
      }
      return originalSetTimeout(fn, delay, ...args);
    }) as any;

    // Keep server open; mark that close was requested.
    const originalClose = server.close.bind(server);
    let closeRequested = 0;
    (server as any).close = ((cb?: any) => {
      closeRequested += 1;
      if (cb) cb();
      return server;
    }) as any;

    mock.method(process as any, 'exit', (code?: number) => {
      exitCalls.push(code);
    });

    try {
      const res = await requestJson(baseUrl, 'POST', '/api/shutdown', {});
      assert.equal(res.status, 200);
      assert.equal(res.json.status, 'shutting_down');

      await new Promise((resolve) => setTimeout(resolve, 150));
      assert.equal(closeRequested, 1);
      assert.ok(exitCalls.includes(0));
    } finally {
      (global as any).setTimeout = originalSetTimeout;
      (server as any).close = originalClose as any;
      await new Promise<void>((resolve) => originalClose(() => resolve()));
    }
  });

  it('GET /api/file reads JSON within initialPath and rejects outside paths', async () => {
    const insideFile = join(PROJECT_ROOT, '.review', 'fixes', 'active-fix-session.json');
    mkdirSync(join(PROJECT_ROOT, '.review', 'fixes'), { recursive: true });
    writeFileSync(insideFile, JSON.stringify({ ok: true }), 'utf8');

    const outsideFile = join(OUTSIDE_ROOT, 'outside.json');
    writeFileSync(outsideFile, JSON.stringify({ ok: true }), 'utf8');

    const { server, baseUrl } = await createServer(PROJECT_ROOT);
    try {
      const ok = await requestJson(baseUrl, 'GET', `/api/file?path=${encodeURIComponent(insideFile)}`);
      assert.equal(ok.status, 200);
      assert.equal(ok.json.ok, true);

      const denied = await requestJson(baseUrl, 'GET', `/api/file?path=${encodeURIComponent(outsideFile)}`);
      assert.equal(denied.status, 403);
      assert.equal(denied.json.error, 'Access denied');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('POST /api/dialog/browse rejects paths outside allowed roots', async () => {
    const { server, baseUrl } = await createServer(PROJECT_ROOT);
    try {
      const rootPath = parse(homedir()).root;
      const denied = await requestJson(baseUrl, 'POST', '/api/dialog/browse', { path: rootPath, showHidden: true });
      assert.equal(denied.status, 403);
      assert.equal(denied.json.error, 'Access denied');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('POST /api/dialog/open-file accepts files under initialPath and rejects outside paths', async () => {
    const allowedFile = join(PROJECT_ROOT, 'allowed.txt');
    writeFileSync(allowedFile, 'ok', 'utf8');

    const rootPath = parse(homedir()).root;
    const deniedPath = join(rootPath, 'ccw-not-allowed.txt');

    const { server, baseUrl } = await createServer(PROJECT_ROOT);
    try {
      const ok = await requestJson(baseUrl, 'POST', '/api/dialog/open-file', { path: allowedFile });
      assert.equal(ok.status, 200);
      assert.equal(ok.json.success, true);
      assert.equal(ok.json.isFile, true);

      const denied = await requestJson(baseUrl, 'POST', '/api/dialog/open-file', { path: deniedPath });
      assert.equal(denied.status, 403);
      assert.equal(denied.json.error, 'Access denied');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
