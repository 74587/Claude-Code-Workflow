/**
 * Integration tests for status routes.
 *
 * Notes:
 * - Targets runtime implementation shipped in `ccw/dist`.
 * - Exercises real HTTP request/response flow via a minimal test server.
 */

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const statusRoutesUrl = new URL('../../dist/core/routes/status-routes.js', import.meta.url);
statusRoutesUrl.searchParams.set('t', String(Date.now()));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod: any;

type JsonResponse = { status: number; json: any; text: string };

async function requestJson(baseUrl: string, method: string, path: string): Promise<JsonResponse> {
  const url = new URL(path, baseUrl);

  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      { method, headers: { Accept: 'application/json' } },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk.toString();
        });
        res.on('end', () => {
          let json: any = null;
          try {
            json = body ? JSON.parse(body) : null;
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode || 0, json, text: body });
        });
      },
    );
    req.on('error', reject);
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

describe('status routes integration', async () => {
  let server: http.Server | null = null;
  let baseUrl = '';

  before(async () => {
    mod = await import(statusRoutesUrl.href);

    server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', 'http://localhost');
      const pathname = url.pathname;

      const ctx = {
        pathname,
        url,
        req,
        res,
        initialPath: process.cwd(),
        handlePostRequest,
        broadcastToClients() {},
      };

      try {
        const handled = await mod.handleStatusRoutes(ctx);
        if (!handled) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not Found' }));
        }
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err?.message || String(err) }));
      }
    });

    await new Promise<void>((resolve) => {
      server!.listen(0, () => resolve());
    });

    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (!server) return;
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  });

  it('GET /api/status/all returns aggregated status payload', async () => {
    const res = await requestJson(baseUrl, 'GET', '/api/status/all');
    assert.equal(res.status, 200);
    assert.ok(res.json);

    for (const key of ['cli', 'codexLens', 'semantic', 'ccwInstall', 'timestamp']) {
      assert.ok(Object.prototype.hasOwnProperty.call(res.json, key), `missing key: ${key}`);
    }

    assert.equal(typeof res.json.timestamp, 'string');
    assert.ok(res.json.timestamp.length > 0);

    assert.equal(typeof res.json.ccwInstall.installed, 'boolean');
    assert.equal(Array.isArray(res.json.ccwInstall.missingFiles), true);
    assert.equal(typeof res.json.ccwInstall.installPath, 'string');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await requestJson(baseUrl, 'GET', '/api/status/unknown');
    assert.equal(res.status, 404);
    assert.ok(res.json?.error);
  });
});

