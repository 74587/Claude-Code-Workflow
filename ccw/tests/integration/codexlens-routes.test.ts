/**
 * Integration tests for CodexLens routes.
 *
 * Notes:
 * - Targets runtime implementation shipped in `ccw/dist`.
 * - Exercises real HTTP request/response flow via a minimal test server.
 */

import { after, before, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const codexLensRoutesUrl = new URL('../../dist/core/routes/codexlens-routes.js', import.meta.url);
codexLensRoutesUrl.searchParams.set('t', String(Date.now()));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod: any;

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

function handlePostRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  handler: (body: unknown) => Promise<any>,
): void {
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
      const handled = await mod.handleCodexLensRoutes(ctx);
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

describe('codexlens routes integration', async () => {
  before(async () => {
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});
    mod = await import(codexLensRoutesUrl.href);
  });

  after(() => {
    mock.restoreAll();
  });

  it('GET /api/codexlens/status returns venv status', async () => {
    const broadcasts: any[] = [];
    const { server, baseUrl } = await createServer(process.cwd(), broadcasts);
    try {
      const res = await requestJson(baseUrl, 'GET', '/api/codexlens/status');
      assert.equal(res.status, 200);
      assert.equal(typeof res.json, 'object');
      assert.equal(typeof res.json.ready, 'boolean');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('GET /api/codexlens/config returns configuration payload', async () => {
    const broadcasts: any[] = [];
    const { server, baseUrl } = await createServer(process.cwd(), broadcasts);
    try {
      const res = await requestJson(baseUrl, 'GET', '/api/codexlens/config');
      assert.equal(res.status, 200);
      assert.equal(typeof res.json?.index_dir, 'string');
      assert.equal(typeof res.json?.index_count, 'number');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('POST /api/codexlens/config validates required index_dir', async () => {
    const broadcasts: any[] = [];
    const { server, baseUrl } = await createServer(process.cwd(), broadcasts);
    try {
      const res = await requestJson(baseUrl, 'POST', '/api/codexlens/config', {});
      assert.equal(res.status, 400);
      assert.ok(String(res.json.error).includes('index_dir is required'));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('GET /api/codexlens/indexing-status returns inProgress flag', async () => {
    const broadcasts: any[] = [];
    const { server, baseUrl } = await createServer(process.cwd(), broadcasts);
    try {
      const res = await requestJson(baseUrl, 'GET', '/api/codexlens/indexing-status');
      assert.equal(res.status, 200);
      assert.equal(res.json.success, true);
      assert.equal(typeof res.json.inProgress, 'boolean');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('GET /api/codexlens/semantic/status returns semantic availability', async () => {
    const broadcasts: any[] = [];
    const { server, baseUrl } = await createServer(process.cwd(), broadcasts);
    try {
      const res = await requestJson(baseUrl, 'GET', '/api/codexlens/semantic/status');
      assert.equal(res.status, 200);
      assert.equal(typeof res.json?.available, 'boolean');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('GET /api/codexlens/indexes returns indexes list payload', async () => {
    const broadcasts: any[] = [];
    const { server, baseUrl } = await createServer(process.cwd(), broadcasts);
    try {
      const res = await requestJson(baseUrl, 'GET', '/api/codexlens/indexes');
      assert.equal(res.status, 200);
      assert.equal(res.json.success, true);
      assert.equal(Array.isArray(res.json.indexes), true);

      const totalSize =
        typeof res.json.totalSize === 'number' ? res.json.totalSize : res.json.summary?.totalSize;
      const totalSizeFormatted =
        typeof res.json.totalSizeFormatted === 'string'
          ? res.json.totalSizeFormatted
          : res.json.summary?.totalSizeFormatted;

      assert.equal(typeof totalSize, 'number');
      assert.equal(typeof totalSizeFormatted, 'string');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('GET /api/codexlens/dashboard-init returns aggregated payload', async () => {
    const broadcasts: any[] = [];
    const { server, baseUrl } = await createServer(process.cwd(), broadcasts);
    try {
      const res = await requestJson(baseUrl, 'GET', '/api/codexlens/dashboard-init');
      assert.equal(res.status, 200);
      assert.equal(typeof res.json?.installed, 'boolean');
      assert.ok(res.json?.config);
      assert.equal(typeof res.json.config.index_dir, 'string');
      assert.equal(typeof res.json.config.index_count, 'number');
      assert.ok(res.json?.semantic);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
