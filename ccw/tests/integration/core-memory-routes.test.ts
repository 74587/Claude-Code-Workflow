/**
 * Integration tests for core-memory routes.
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

const CCW_HOME = mkdtempSync(join(tmpdir(), 'ccw-core-memory-routes-home-'));
const PROJECT_ROOT = mkdtempSync(join(tmpdir(), 'ccw-core-memory-routes-project-'));

const coreMemoryRoutesUrl = new URL('../../dist/core/routes/core-memory-routes.js', import.meta.url);
coreMemoryRoutesUrl.searchParams.set('t', String(Date.now()));

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
      const handled = await mod.handleCoreMemoryRoutes(ctx);
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

describe('core-memory routes integration', async () => {
  before(async () => {
    process.env.CCW_DATA_DIR = CCW_HOME;
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});
    mod = await import(coreMemoryRoutesUrl.href);
  });

  after(async () => {
    try {
      const coreStoreUrl = new URL('../../dist/core/core-memory-store.js', import.meta.url);
      const coreStoreMod: any = await import(coreStoreUrl.href);
      coreStoreMod?.closeAllStores?.();
    } catch {
      // ignore
    }
    mock.restoreAll();
    process.env.CCW_DATA_DIR = originalEnv.CCW_DATA_DIR;
    rmSync(CCW_HOME, { recursive: true, force: true });
    rmSync(PROJECT_ROOT, { recursive: true, force: true });
  });

  it('validates required fields for memory and cluster creation', async () => {
    const broadcasts: any[] = [];
    const { server, baseUrl } = await createServer(PROJECT_ROOT, broadcasts);
    try {
      const missingContent = await requestJson(baseUrl, 'POST', '/api/core-memory/memories', { summary: 'nope' });
      assert.equal(missingContent.status, 400);
      assert.ok(String(missingContent.json.error).includes('content is required'));

      const missingName = await requestJson(baseUrl, 'POST', '/api/core-memory/clusters', { description: 'nope' });
      assert.equal(missingName.status, 400);
      assert.ok(String(missingName.json.error).includes('name is required'));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('supports core memory CRUD endpoints and broadcasts updates', async () => {
    const broadcasts: any[] = [];
    const { server, baseUrl } = await createServer(PROJECT_ROOT, broadcasts);
    try {
      const created = await requestJson(baseUrl, 'POST', '/api/core-memory/memories', {
        content: 'Hello core memory',
        summary: 'Test memory',
        path: PROJECT_ROOT,
      });
      assert.equal(created.status, 200);
      assert.equal(created.json.success, true);
      assert.ok(created.json.memory?.id);
      const memoryId = created.json.memory.id as string;

      assert.ok(broadcasts.some((b) => (b as any)?.type === 'CORE_MEMORY_UPDATED'));

      const list = await requestJson(
        baseUrl,
        'GET',
        `/api/core-memory/memories?path=${encodeURIComponent(PROJECT_ROOT)}&limit=10`,
      );
      assert.equal(list.status, 200);
      assert.equal(list.json.success, true);
      assert.equal(Array.isArray(list.json.memories), true);
      assert.ok(list.json.memories.some((m: any) => m.id === memoryId));

      const detail = await requestJson(
        baseUrl,
        'GET',
        `/api/core-memory/memories/${encodeURIComponent(memoryId)}?path=${encodeURIComponent(PROJECT_ROOT)}`,
      );
      assert.equal(detail.status, 200);
      assert.equal(detail.json.success, true);
      assert.equal(detail.json.memory.id, memoryId);
      assert.equal(detail.json.memory.summary, 'Test memory');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('supports cluster lifecycle endpoints and broadcasts updates', async () => {
    const broadcasts: any[] = [];
    const { server, baseUrl } = await createServer(PROJECT_ROOT, broadcasts);
    try {
      const created = await requestJson(baseUrl, 'POST', '/api/core-memory/clusters', {
        name: 'Test Cluster',
        description: 'desc',
        path: PROJECT_ROOT,
      });
      assert.equal(created.status, 200);
      assert.equal(created.json.success, true);
      assert.ok(created.json.cluster?.id);
      const clusterId = created.json.cluster.id as string;

      assert.ok(broadcasts.some((b) => (b as any)?.type === 'CLUSTER_UPDATED'));

      const updated = await requestJson(
        baseUrl,
        'PATCH',
        `/api/core-memory/clusters/${encodeURIComponent(clusterId)}`,
        { name: 'Renamed Cluster', path: PROJECT_ROOT },
      );
      assert.equal(updated.status, 200);
      assert.equal(updated.json.success, true);
      assert.equal(updated.json.cluster.id, clusterId);
      assert.equal(updated.json.cluster.name, 'Renamed Cluster');

      const deleted = await requestJson(
        baseUrl,
        'DELETE',
        `/api/core-memory/clusters/${encodeURIComponent(clusterId)}?path=${encodeURIComponent(PROJECT_ROOT)}`,
      );
      assert.equal(deleted.status, 204);
      assert.equal(deleted.text, '');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('GET /api/core-memory/embed-status returns availability payload', async () => {
    const broadcasts: any[] = [];
    const { server, baseUrl } = await createServer(PROJECT_ROOT, broadcasts);
    try {
      const res = await requestJson(
        baseUrl,
        'GET',
        `/api/core-memory/embed-status?path=${encodeURIComponent(PROJECT_ROOT)}`,
      );
      assert.equal(res.status, 200);
      assert.equal(typeof res.json?.available, 'boolean');
      assert.ok(Object.prototype.hasOwnProperty.call(res.json, 'by_type'));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('POST /api/core-memory/embed returns 503 when semantic search unavailable', async () => {
    const broadcasts: any[] = [];
    const { server, baseUrl } = await createServer(PROJECT_ROOT, broadcasts);
    try {
      const res = await requestJson(baseUrl, 'POST', '/api/core-memory/embed', { path: PROJECT_ROOT, batchSize: 1 });

      if (res.status === 503) {
        assert.ok(res.json?.error);
      } else {
        assert.equal(res.status, 200);
        assert.equal(typeof res.json.success, 'boolean');
        assert.equal(typeof res.json.elapsed_time, 'number');
      }
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

