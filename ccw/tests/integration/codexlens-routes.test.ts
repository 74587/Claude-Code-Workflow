/**
 * Integration tests for CodexLens v2 routes.
 *
 * Tests the new v2 API endpoints:
 * - GET  /api/codexlens/models
 * - POST /api/codexlens/models/download
 * - POST /api/codexlens/models/delete
 * - GET  /api/codexlens/index/status?projectPath=
 * - POST /api/codexlens/index/sync
 * - POST /api/codexlens/index/rebuild
 * - GET  /api/codexlens/env
 * - POST /api/codexlens/env
 * - GET  /api/codexlens/mcp-config
 */

import { after, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

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
        res.on('data', (chunk) => { responseBody += chunk.toString(); });
        res.on('end', () => {
          let json: any = null;
          try { json = responseBody ? JSON.parse(responseBody) : null; } catch { json = null; }
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
  req.on('data', (chunk) => { body += chunk.toString(); });
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

async function createServer(): Promise<{ server: http.Server; baseUrl: string }> {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const pathname = url.pathname;
    const ctx = { pathname, url, req, res, handlePostRequest, broadcastToClients() {} };
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

async function withServer(fn: (baseUrl: string) => Promise<void>): Promise<void> {
  const { server, baseUrl } = await createServer();
  try {
    await fn(baseUrl);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

// Temp dir for env file isolation
let tmpDir: string;
let originalHome: string | undefined;
let originalUserProfile: string | undefined;

describe('codexlens v2 routes integration', async () => {
  before(async () => {
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});
    mod = await import(codexLensRoutesUrl.href);

    // Redirect HOME/USERPROFILE so env file writes go to a temp location
    tmpDir = join(tmpdir(), `codexlens-test-${Date.now()}`);
    mkdirSync(join(tmpDir, '.ccw'), { recursive: true });
    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;
    process.env.HOME = tmpDir;
    process.env.USERPROFILE = tmpDir;
  });

  beforeEach(() => {
    try { rmSync(join(tmpDir, '.ccw', 'codexlens-env.json'), { force: true }); } catch {}
  });

  after(() => {
    mock.restoreAll();
    if (originalHome !== undefined) process.env.HOME = originalHome;
    if (originalUserProfile !== undefined) process.env.USERPROFILE = originalUserProfile;
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  // ── GET /api/codexlens/models (real CLI) ──────────────────
  it('GET /api/codexlens/models returns models array from real CLI', async () => {
    await withServer(async (baseUrl) => {
      const res = await requestJson(baseUrl, 'GET', '/api/codexlens/models');
      assert.equal(res.status, 200);
      assert.equal(res.json.success, true);
      assert.ok(Array.isArray(res.json.models), 'models should be an array');
      // Each model should have name and installed fields
      if (res.json.models.length > 0) {
        assert.ok(typeof res.json.models[0].name === 'string');
        assert.ok(typeof res.json.models[0].installed === 'boolean');
      }
    });
  });

  it('GET /api/codexlens/models returns non-empty list with known model names', async () => {
    await withServer(async (baseUrl) => {
      const res = await requestJson(baseUrl, 'GET', '/api/codexlens/models');
      assert.equal(res.status, 200);
      const names = res.json.models.map((m: any) => m.name);
      // bge-small should be in the list (it's the default model)
      assert.ok(names.some((n: string) => n.includes('bge-small')), 'bge-small should be in model list');
    });
  });

  // ── POST /api/codexlens/models/download ────────────────────
  it('POST /api/codexlens/models/download requires name', async () => {
    await withServer(async (baseUrl) => {
      const res = await requestJson(baseUrl, 'POST', '/api/codexlens/models/download', {});
      assert.equal(res.status, 400);
      assert.ok(res.json.error?.includes('name is required'));
    });
  });

  // ── POST /api/codexlens/models/delete ──────────────────────
  it('POST /api/codexlens/models/delete requires name', async () => {
    await withServer(async (baseUrl) => {
      const res = await requestJson(baseUrl, 'POST', '/api/codexlens/models/delete', {});
      assert.equal(res.status, 400);
      assert.ok(res.json.error?.includes('name is required'));
    });
  });

  // ── GET /api/codexlens/index/status ────────────────────────
  it('GET /api/codexlens/index/status requires projectPath query param', async () => {
    await withServer(async (baseUrl) => {
      const res = await requestJson(baseUrl, 'GET', '/api/codexlens/index/status');
      assert.equal(res.status, 400);
      assert.ok(res.json.error?.includes('projectPath'));
    });
  });

  it('GET /api/codexlens/index/status returns status object for real project path', async () => {
    await withServer(async (baseUrl) => {
      // Use tmpDir as the project path (unindexed directory)
      const res = await requestJson(
        baseUrl,
        'GET',
        `/api/codexlens/index/status?projectPath=${encodeURIComponent(tmpDir)}`,
      );
      assert.equal(res.status, 200);
      assert.equal(res.json.success, true);
      assert.ok(typeof res.json.status === 'object', 'status should be an object');
      // status should have a status field (e.g. 'not_initialized')
      assert.ok(typeof res.json.status.status === 'string', 'status.status should be a string');
    });
  });

  it('GET /api/codexlens/index/status normalizes total_chunks from CLI output', async () => {
    const projectPath = join(tmpDir, 'status-project');
    const dbPath = join(projectPath, '.codexlens');
    mkdirSync(projectPath, { recursive: true });
    execFileSync('codexlens-search', ['--db-path', dbPath, 'init'], { encoding: 'utf8' });

    await withServer(async (baseUrl) => {
      const res = await requestJson(
        baseUrl,
        'GET',
        `/api/codexlens/index/status?projectPath=${encodeURIComponent(projectPath)}`,
      );
      assert.equal(res.status, 200);
      assert.equal(res.json.status.status, 'ok');
      assert.equal(res.json.status.total_chunks, 0);
      assert.equal(res.json.status.deleted_chunks, 0);
    });
  });

  // ── POST /api/codexlens/index/sync ─────────────────────────
  it('POST /api/codexlens/index/sync requires projectPath', async () => {
    await withServer(async (baseUrl) => {
      const res = await requestJson(baseUrl, 'POST', '/api/codexlens/index/sync', {});
      assert.equal(res.status, 400);
      assert.ok(res.json.error?.includes('projectPath'));
    });
  });

  // ── POST /api/codexlens/index/rebuild ──────────────────────
  it('POST /api/codexlens/index/rebuild requires projectPath', async () => {
    await withServer(async (baseUrl) => {
      const res = await requestJson(baseUrl, 'POST', '/api/codexlens/index/rebuild', {});
      assert.equal(res.status, 400);
      assert.ok(res.json.error?.includes('projectPath'));
    });
  });

  it('POST /api/codexlens/index/rebuild clears stale index state before syncing', async () => {
    const projectPath = join(tmpDir, 'rebuild-project');
    rmSync(projectPath, { recursive: true, force: true });
    mkdirSync(projectPath, { recursive: true });
    writeFileSync(join(projectPath, 'alpha.ts'), 'export const alpha = 1;\n', 'utf8');
    writeFileSync(join(projectPath, 'beta.ts'), 'export const beta = 2;\n', 'utf8');

    await withServer(async (baseUrl) => {
      const initialRebuild = await requestJson(baseUrl, 'POST', '/api/codexlens/index/rebuild', { projectPath });
      assert.equal(initialRebuild.status, 200);
      assert.equal(initialRebuild.json.success, true);

      rmSync(join(projectPath, 'alpha.ts'), { force: true });

      const syncRes = await requestJson(baseUrl, 'POST', '/api/codexlens/index/sync', { projectPath });
      assert.equal(syncRes.status, 200);
      assert.equal(syncRes.json.success, true);

      const staleStatus = await requestJson(
        baseUrl,
        'GET',
        `/api/codexlens/index/status?projectPath=${encodeURIComponent(projectPath)}`,
      );
      assert.equal(staleStatus.status, 200);
      assert.equal(staleStatus.json.status.files_tracked, 1);
      assert.ok(staleStatus.json.status.deleted_chunks > 0);

      const rebuilt = await requestJson(baseUrl, 'POST', '/api/codexlens/index/rebuild', { projectPath });
      assert.equal(rebuilt.status, 200);
      assert.equal(rebuilt.json.success, true);
      assert.equal(JSON.parse(rebuilt.json.syncOutput).files_processed, 1);

      const rebuiltStatus = await requestJson(
        baseUrl,
        'GET',
        `/api/codexlens/index/status?projectPath=${encodeURIComponent(projectPath)}`,
      );
      assert.equal(rebuiltStatus.status, 200);
      assert.equal(rebuiltStatus.json.status.files_tracked, 1);
      assert.equal(rebuiltStatus.json.status.deleted_chunks, 0);
    });
  });

  // ── GET /api/codexlens/env ──────────────────────────────────
  it('GET /api/codexlens/env returns empty object when no file exists', async () => {
    await withServer(async (baseUrl) => {
      const res = await requestJson(baseUrl, 'GET', '/api/codexlens/env');
      assert.equal(res.status, 200);
      assert.equal(res.json.success, true);
      assert.ok(typeof res.json.env === 'object');
      assert.equal(res.json.env.CODEXLENS_INDEX_WORKERS, undefined);
      assert.equal(res.json.defaults.CODEXLENS_INDEX_WORKERS, '2');
      assert.equal(res.json.defaults.CODEXLENS_MAX_FILE_SIZE, '1000000');
    });
  });

  // ── POST /api/codexlens/env ─────────────────────────────────
  it('POST /api/codexlens/env saves env and GET reads it back', async () => {
    const envPayload = {
      CODEXLENS_EMBED_API_URL: 'https://api.example.com/v1',
      CODEXLENS_EMBED_API_MODEL: 'text-embedding-3-small',
    };

    await withServer(async (baseUrl) => {
      const saveRes = await requestJson(baseUrl, 'POST', '/api/codexlens/env', { env: envPayload });
      assert.equal(saveRes.status, 200);
      assert.equal(saveRes.json.success, true);

      const getRes = await requestJson(baseUrl, 'GET', '/api/codexlens/env');
      assert.equal(getRes.status, 200);
      assert.equal(getRes.json.env.CODEXLENS_EMBED_API_URL, 'https://api.example.com/v1');
      assert.equal(getRes.json.env.CODEXLENS_EMBED_API_MODEL, 'text-embedding-3-small');
      assert.equal(getRes.json.defaults.CODEXLENS_EMBED_DIM, '1536');
    });
  });

  it('POST /api/codexlens/env rejects missing env field', async () => {
    await withServer(async (baseUrl) => {
      const res = await requestJson(baseUrl, 'POST', '/api/codexlens/env', { other: 'value' });
      assert.equal(res.status, 400);
      assert.ok(res.json.error?.includes('env'));
    });
  });

  // ── GET /api/codexlens/mcp-config ──────────────────────────
  it('GET /api/codexlens/mcp-config returns mcpServers structure', async () => {
    await withServer(async (baseUrl) => {
      const res = await requestJson(baseUrl, 'GET', '/api/codexlens/mcp-config');
      assert.equal(res.status, 200);
      assert.equal(res.json.success, true);
      assert.ok(res.json.config?.mcpServers?.codexlens);
      assert.equal(res.json.config.mcpServers.codexlens.command, 'uvx');
      assert.deepEqual(res.json.config.mcpServers.codexlens.args, ['--from', 'codexlens-search[mcp]', 'codexlens-mcp']);
      assert.equal(res.json.config.mcpServers.codexlens.env, undefined);
    });
  });

  it('GET /api/codexlens/mcp-config filters out empty env values', async () => {
    const envPayload = {
      CODEXLENS_EMBED_API_URL: 'https://api.example.com/v1',
      CODEXLENS_EMBED_API_KEY: '',
      CODEXLENS_EMBED_API_MODEL: 'text-embedding-3-small',
    };

    await withServer(async (baseUrl) => {
      await requestJson(baseUrl, 'POST', '/api/codexlens/env', { env: envPayload });

      const res = await requestJson(baseUrl, 'GET', '/api/codexlens/mcp-config');
      assert.equal(res.status, 200);
      const mcpEnv = res.json.config.mcpServers.codexlens.env;
      assert.equal(mcpEnv.CODEXLENS_EMBED_API_URL, 'https://api.example.com/v1');
      assert.equal(mcpEnv.CODEXLENS_EMBED_API_MODEL, 'text-embedding-3-small');
      assert.equal(mcpEnv.CODEXLENS_EMBED_DIM, '1536');
      assert.equal(mcpEnv.CODEXLENS_EMBED_API_KEY, undefined);
    });
  });

  // ── Unknown routes ──────────────────────────────────────────
  it('unhandled routes return 404', async () => {
    await withServer(async (baseUrl) => {
      const res = await requestJson(baseUrl, 'GET', '/api/codexlens/nonexistent');
      assert.equal(res.status, 404);
    });
  });
});
