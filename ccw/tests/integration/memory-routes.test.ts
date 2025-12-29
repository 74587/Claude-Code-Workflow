/**
 * Integration tests for memory routes.
 *
 * Notes:
 * - Targets runtime implementation shipped in `ccw/dist`.
 * - Uses a temporary CCW data directory (CCW_DATA_DIR) to isolate databases/files.
 */

import { after, before, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CCW_HOME = mkdtempSync(join(tmpdir(), 'ccw-memory-routes-home-'));
const PROJECT_ROOT = mkdtempSync(join(tmpdir(), 'ccw-memory-routes-project-'));

const memoryRoutesUrl = new URL('../../dist/core/routes/memory-routes.js', import.meta.url);
memoryRoutesUrl.searchParams.set('t', String(Date.now()));

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

async function createServer(initialPath: string, broadcasts: any[]): Promise<{ server: http.Server; baseUrl: string }> {
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
      broadcastToClients(data: unknown) {
        broadcasts.push(data);
      },
    };

    try {
      const handled = await mod.handleMemoryRoutes(ctx);
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

describe('memory routes integration', async () => {
  before(async () => {
    process.env.CCW_DATA_DIR = CCW_HOME;
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});
    mod = await import(memoryRoutesUrl.href);
  });

  after(() => {
    mock.restoreAll();
    process.env.CCW_DATA_DIR = originalEnv.CCW_DATA_DIR;
    rmSync(CCW_HOME, { recursive: true, force: true });
    rmSync(PROJECT_ROOT, { recursive: true, force: true });
  });

  it('POST /api/memory/track validates required fields', async () => {
    const broadcasts: any[] = [];
    const { server, baseUrl } = await createServer(PROJECT_ROOT, broadcasts);
    try {
      const res = await requestJson(baseUrl, 'POST', '/api/memory/track', { type: 'file' });
      assert.equal(res.status, 400);
      assert.ok(String(res.json.error).includes('type, action, and value are required'));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('POST /api/memory/track records access and broadcasts MEMORY_UPDATED', async () => {
    const broadcasts: any[] = [];
    const { server, baseUrl } = await createServer(PROJECT_ROOT, broadcasts);
    try {
      const res = await requestJson(baseUrl, 'POST', '/api/memory/track', {
        type: 'file',
        action: 'read',
        value: 'README.md',
        path: PROJECT_ROOT,
        metadata: { context: 'test' },
      });
      assert.equal(res.status, 200);
      assert.equal(res.json.success, true);
      assert.ok(typeof res.json.entity_id === 'number' || typeof res.json.entity_id === 'string');

      assert.ok(broadcasts.some((b) => (b as any)?.type === 'MEMORY_UPDATED'));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('GET /api/memory/stats returns aggregated stats payload', async () => {
    const broadcasts: any[] = [];
    const { server, baseUrl } = await createServer(PROJECT_ROOT, broadcasts);
    try {
      const res = await requestJson(
        baseUrl,
        'GET',
        `/api/memory/stats?path=${encodeURIComponent(PROJECT_ROOT)}&limit=5&filter=all`,
      );
      assert.equal(res.status, 200);
      assert.ok(res.json);
      assert.ok(Object.prototype.hasOwnProperty.call(res.json, 'stats'));
      assert.ok(Object.prototype.hasOwnProperty.call(res.json, 'aggregated'));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

