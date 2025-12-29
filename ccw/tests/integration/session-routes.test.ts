/**
 * Integration tests for session routes.
 *
 * Notes:
 * - Targets runtime implementation shipped in `ccw/dist`.
 * - Exercises real HTTP request/response flow via a minimal test server.
 */
import { after, before, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sessionRoutesUrl = new URL('../../dist/core/routes/session-routes.js', import.meta.url);
sessionRoutesUrl.searchParams.set('t', String(Date.now()));

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
    };

    try {
      const handled = await mod.handleSessionRoutes(ctx);
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

function createSessionFixture(): string {
  const sessionPath = mkdtempSync(join(tmpdir(), 'ccw-session-routes-session-'));

  mkdirSync(join(sessionPath, '.task'), { recursive: true });
  writeFileSync(
    join(sessionPath, '.task', 'IMPL-002.json'),
    JSON.stringify({ status: 'in_progress', title: 'Two' }, null, 2),
    'utf8',
  );
  writeFileSync(
    join(sessionPath, '.task', 'IMPL-001.json'),
    JSON.stringify({ status: 'pending', title: 'One' }, null, 2),
    'utf8',
  );

  mkdirSync(join(sessionPath, '.process'), { recursive: true });
  writeFileSync(
    join(sessionPath, '.process', 'context-package.json'),
    JSON.stringify({ hello: 'world' }, null, 2),
    'utf8',
  );

  mkdirSync(join(sessionPath, '.summaries'), { recursive: true });
  writeFileSync(join(sessionPath, '.summaries', 'IMPL-001-summary.md'), 'summary for task 1', 'utf8');
  writeFileSync(join(sessionPath, 'plan.json'), JSON.stringify({ steps: ['a', 'b'] }, null, 2), 'utf8');

  return sessionPath;
}

describe('session routes integration', async () => {
  before(async () => {
    mock.method(console, 'error', () => {});
    mod = await import(sessionRoutesUrl.href);
  });

  after(() => {
    mock.restoreAll();
  });

  it('GET /api/session-detail validates required path', async () => {
    const { server, baseUrl } = await createServer(process.cwd());
    try {
      const res = await requestJson(baseUrl, 'GET', '/api/session-detail');
      assert.equal(res.status, 400);
      assert.ok(String(res.json.error).includes('Session path is required'));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('GET /api/session-detail returns aggregated session detail', async () => {
    const sessionPath = createSessionFixture();
    const { server, baseUrl } = await createServer(process.cwd());

    try {
      const res = await requestJson(baseUrl, 'GET', `/api/session-detail?path=${encodeURIComponent(sessionPath)}`);
      assert.equal(res.status, 200);
      assert.ok(res.json);

      assert.equal(Array.isArray(res.json.tasks), true);
      assert.equal(res.json.tasks.length, 2);
      assert.equal(res.json.tasks[0].task_id, 'IMPL-001');
      assert.equal(res.json.tasks[1].task_id, 'IMPL-002');

      assert.equal(res.json.context?.hello, 'world');
      assert.equal(Array.isArray(res.json.summaries), true);
      assert.ok(res.json.summaries.some((s: any) => s.name === 'IMPL-001-summary'));
      assert.equal(Array.isArray(res.json.plan?.steps), true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      rmSync(sessionPath, { recursive: true, force: true });
    }
  });

  it('GET /api/session-detail supports type=context', async () => {
    const sessionPath = createSessionFixture();
    const { server, baseUrl } = await createServer(process.cwd());

    try {
      const res = await requestJson(
        baseUrl,
        'GET',
        `/api/session-detail?path=${encodeURIComponent(sessionPath)}&type=context`,
      );
      assert.equal(res.status, 200);
      assert.equal(res.json?.context?.hello, 'world');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      rmSync(sessionPath, { recursive: true, force: true });
    }
  });

  it('GET /api/session-detail supports type=tasks and sorts by task_id', async () => {
    const sessionPath = createSessionFixture();
    const { server, baseUrl } = await createServer(process.cwd());

    try {
      const res = await requestJson(
        baseUrl,
        'GET',
        `/api/session-detail?path=${encodeURIComponent(sessionPath)}&type=tasks`,
      );
      assert.equal(res.status, 200);
      assert.equal(Array.isArray(res.json?.tasks), true);
      assert.equal(res.json.tasks.length, 2);
      assert.equal(res.json.tasks[0].task_id, 'IMPL-001');
      assert.equal(res.json.tasks[1].task_id, 'IMPL-002');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      rmSync(sessionPath, { recursive: true, force: true });
    }
  });

  it('POST /api/update-task-status updates persisted task status', async () => {
    const sessionPath = createSessionFixture();
    const { server, baseUrl } = await createServer(process.cwd());

    try {
      const res = await requestJson(baseUrl, 'POST', '/api/update-task-status', {
        sessionPath,
        taskId: 'IMPL-001',
        newStatus: 'completed',
      });
      assert.equal(res.status, 200);
      assert.equal(res.json.success, true);
      assert.equal(res.json.oldStatus, 'pending');
      assert.equal(res.json.newStatus, 'completed');

      const updated = JSON.parse(readFileSync(join(sessionPath, '.task', 'IMPL-001.json'), 'utf8'));
      assert.equal(updated.status, 'completed');
      assert.equal(Array.isArray(updated.status_history), true);
      assert.equal(updated.status_history.length, 1);
      assert.equal(updated.status_history[0].from, 'pending');
      assert.equal(updated.status_history[0].to, 'completed');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      rmSync(sessionPath, { recursive: true, force: true });
    }
  });

  it('POST /api/bulk-update-task-status returns per-task results', async () => {
    const sessionPath = createSessionFixture();
    const { server, baseUrl } = await createServer(process.cwd());

    try {
      const res = await requestJson(baseUrl, 'POST', '/api/bulk-update-task-status', {
        sessionPath,
        taskIds: ['IMPL-002', 'IMPL-404'],
        newStatus: 'completed',
      });
      assert.equal(res.status, 200);
      assert.equal(res.json.success, true);
      assert.equal(Array.isArray(res.json.results), true);
      assert.equal(res.json.results.length, 2);

      const okResult = res.json.results.find((r: any) => r?.success === true);
      const errorResult = res.json.results.find((r: any) => r?.error);
      assert.equal(okResult.taskId, 'IMPL-002');
      assert.equal(okResult.newStatus, 'completed');
      assert.equal(errorResult.taskId, 'IMPL-404');
      assert.ok(String(errorResult.error).includes('Task file not found'));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      rmSync(sessionPath, { recursive: true, force: true });
    }
  });
});

