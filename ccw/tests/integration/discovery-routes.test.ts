/**
 * Integration tests for discovery routes.
 *
 * Notes:
 * - Targets runtime implementation shipped in `ccw/dist`.
 * - Uses a temporary project directory to isolate `.workflow/issues/discoveries`.
 */

import { after, before, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const discoveryRoutesUrl = new URL('../../dist/core/routes/discovery-routes.js', import.meta.url);
discoveryRoutesUrl.searchParams.set('t', String(Date.now()));

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
      const handled = await mod.handleDiscoveryRoutes(ctx);
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

function createDiscoveryFixture(projectRoot: string): { discoveryId: string; findingId: string; discoveryDir: string } {
  const discoveryId = `DSC-TEST-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const findingId = 'F-001';

  const discoveryDir = join(projectRoot, '.workflow', 'issues', 'discoveries', discoveryId);
  const perspectivesDir = join(discoveryDir, 'perspectives');
  mkdirSync(perspectivesDir, { recursive: true });

  const createdAt = new Date().toISOString();
  writeFileSync(
    join(discoveryDir, 'discovery-state.json'),
    JSON.stringify(
      {
        target_pattern: 'src/**/*.ts',
        phase: 'complete',
        created_at: createdAt,
        updated_at: createdAt,
        metadata: { perspectives: ['bug'], created_at: createdAt },
        perspectives: [{ id: 'bug', status: 'completed' }],
        results: { issues_generated: 0 },
        total_findings: 1,
        issues_generated: 0,
        priority_distribution: { '3': 1 },
      },
      null,
      2,
    ),
    'utf8',
  );

  writeFileSync(
    join(perspectivesDir, 'bug.json'),
    JSON.stringify(
      {
        summary: { total: 1 },
        findings: [
          {
            id: findingId,
            title: 'Example finding',
            description: 'Example description',
            priority: '3',
            perspective: 'bug',
            file: 'src/example.ts',
            line: 42,
            suggested_issue: { title: 'Example issue', priority: 3, labels: ['bug'] },
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  return { discoveryId, findingId, discoveryDir };
}

/**
 * Creates a discovery fixture using the NEW format:
 * - perspectives is a string array
 * - status tracked in perspectives_completed/perspectives_failed
 * - stats in results object
 */
function createNewFormatDiscoveryFixture(projectRoot: string): { discoveryId: string; findingId: string; discoveryDir: string } {
  const discoveryId = `DSC-NEW-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const findingId = 'F-NEW-001';

  const discoveryDir = join(projectRoot, '.workflow', 'issues', 'discoveries', discoveryId);
  const perspectivesDir = join(discoveryDir, 'perspectives');
  mkdirSync(perspectivesDir, { recursive: true });

  const createdAt = new Date().toISOString();
  writeFileSync(
    join(discoveryDir, 'discovery-state.json'),
    JSON.stringify(
      {
        discovery_id: discoveryId,
        target_pattern: 'src/**/*.ts',
        phase: 'complete',
        created_at: createdAt,
        updated_at: createdAt,
        target: {
          files_count: { total: 10 },
          project: { name: 'test', path: projectRoot },
        },
        // New format: perspectives as string array
        perspectives: ['bug', 'security', 'performance'],
        perspectives_completed: ['bug', 'security'],
        perspectives_failed: ['performance'],
        external_research: { enabled: false, completed: false },
        // New format: stats in results object
        results: {
          total_findings: 5,
          issues_generated: 2,
          priority_distribution: { critical: 1, high: 2, medium: 1, low: 1 },
          findings_by_perspective: { bug: 3, security: 2 },
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  writeFileSync(
    join(perspectivesDir, 'bug.json'),
    JSON.stringify(
      {
        summary: { total: 3 },
        findings: [
          {
            id: findingId,
            title: 'New format finding',
            description: 'Example from new format',
            priority: 'high',
            perspective: 'bug',
            file: 'src/example.ts',
            line: 100,
            suggested_issue: { title: 'New format issue', priority: 2, labels: ['bug'] },
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  return { discoveryId, findingId, discoveryDir };
}

describe('discovery routes integration', async () => {
  before(async () => {
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});
    mod = await import(discoveryRoutesUrl.href);
  });

  after(() => {
    mock.restoreAll();
  });

  it('GET /api/discoveries lists discovery sessions', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'ccw-discovery-routes-project-'));
    try {
      const { discoveryId } = createDiscoveryFixture(projectRoot);
      const { server, baseUrl } = await createServer(projectRoot);
      try {
        const res = await requestJson(baseUrl, 'GET', '/api/discoveries');
        assert.equal(res.status, 200);
        assert.equal(Array.isArray(res.json.discoveries), true);
        assert.equal(res.json.total, 1);
        assert.equal(res.json.discoveries[0].discovery_id, discoveryId);
        assert.equal(typeof res.json.discoveries[0].phase, 'string');
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('GET /api/discoveries/:id returns discovery detail and 404 for missing', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'ccw-discovery-routes-project-'));
    try {
      const { discoveryId } = createDiscoveryFixture(projectRoot);
      const { server, baseUrl } = await createServer(projectRoot);
      try {
        const res = await requestJson(baseUrl, 'GET', `/api/discoveries/${encodeURIComponent(discoveryId)}`);
        assert.equal(res.status, 200);
        assert.equal(res.json.target_pattern, 'src/**/*.ts');
        assert.ok(res.json.progress);
        assert.equal(Array.isArray(res.json.perspectives), true);
        assert.equal(Array.isArray(res.json.discovery_issues), true);

        const missing = await requestJson(baseUrl, 'GET', '/api/discoveries/DSC-NOT-FOUND');
        assert.equal(missing.status, 404);
        assert.ok(String(missing.json.error).includes('not found'));
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('GET /api/discoveries/:id/findings returns flattened findings', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'ccw-discovery-routes-project-'));
    try {
      const { discoveryId, findingId } = createDiscoveryFixture(projectRoot);
      const { server, baseUrl } = await createServer(projectRoot);
      try {
        const res = await requestJson(baseUrl, 'GET', `/api/discoveries/${encodeURIComponent(discoveryId)}/findings`);
        assert.equal(res.status, 200);
        assert.equal(Array.isArray(res.json.findings), true);
        assert.equal(res.json.total, 1);
        assert.equal(res.json.findings[0].id, findingId);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('GET /api/discoveries/:id/progress returns progress payload', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'ccw-discovery-routes-project-'));
    try {
      const { discoveryId } = createDiscoveryFixture(projectRoot);
      const { server, baseUrl } = await createServer(projectRoot);
      try {
        const res = await requestJson(baseUrl, 'GET', `/api/discoveries/${encodeURIComponent(discoveryId)}/progress`);
        assert.equal(res.status, 200);
        assert.equal(res.json.discovery_id, discoveryId);
        assert.ok(res.json.progress);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('PATCH /api/discoveries/:id/findings/:fid updates finding status', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'ccw-discovery-routes-project-'));
    try {
      const { discoveryId, findingId } = createDiscoveryFixture(projectRoot);
      const { server, baseUrl } = await createServer(projectRoot);
      try {
        const res = await requestJson(
          baseUrl,
          'PATCH',
          `/api/discoveries/${encodeURIComponent(discoveryId)}/findings/${encodeURIComponent(findingId)}`,
          { status: 'dismissed', dismissed: true },
        );
        assert.equal(res.status, 200);
        assert.equal(res.json.success, true);
        assert.equal(res.json.finding_id, findingId);

        const bugPath = join(projectRoot, '.workflow', 'issues', 'discoveries', discoveryId, 'perspectives', 'bug.json');
        const content = JSON.parse(readFileSync(bugPath, 'utf8'));
        assert.equal(content.findings[0].status, 'dismissed');
        assert.equal(content.findings[0].dismissed, true);
        assert.equal(typeof content.findings[0].updated_at, 'string');
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('POST /api/discoveries/:id/export appends issues.jsonl and marks findings exported', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'ccw-discovery-routes-project-'));
    try {
      const { discoveryId, findingId } = createDiscoveryFixture(projectRoot);
      const { server, baseUrl } = await createServer(projectRoot);
      try {
        const res = await requestJson(
          baseUrl,
          'POST',
          `/api/discoveries/${encodeURIComponent(discoveryId)}/export`,
          { export_all: true },
        );
        assert.equal(res.status, 200);
        assert.equal(res.json.success, true);
        assert.equal(res.json.exported_count, 1);

        const issuesPath = join(projectRoot, '.workflow', 'issues', 'issues.jsonl');
        assert.equal(existsSync(issuesPath), true);
        const issuesLines = readFileSync(issuesPath, 'utf8').split('\n').filter((l) => l.trim());
        assert.equal(issuesLines.length, 1);
        const issue = JSON.parse(issuesLines[0]);
        assert.equal(issue.source, 'discovery');
        assert.equal(issue.source_discovery_id, discoveryId);
        assert.equal(issue.source_finding_id, findingId);

        const bugPath = join(projectRoot, '.workflow', 'issues', 'discoveries', discoveryId, 'perspectives', 'bug.json');
        const content = JSON.parse(readFileSync(bugPath, 'utf8'));
        assert.equal(content.findings[0].exported, true);
        assert.equal(typeof content.findings[0].exported_at, 'string');
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('DELETE /api/discoveries/:id deletes discovery session', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'ccw-discovery-routes-project-'));
    try {
      const { discoveryId, discoveryDir } = createDiscoveryFixture(projectRoot);
      const { server, baseUrl } = await createServer(projectRoot);
      try {
        const res = await requestJson(baseUrl, 'DELETE', `/api/discoveries/${encodeURIComponent(discoveryId)}`);
        assert.equal(res.status, 200);
        assert.equal(res.json.success, true);
        assert.equal(res.json.deleted, discoveryId);
        assert.equal(existsSync(discoveryDir), false);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  // ========== NEW FORMAT TESTS ==========

  it('GET /api/discoveries lists new format discovery sessions with correct stats', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'ccw-discovery-routes-newformat-'));
    try {
      const { discoveryId } = createNewFormatDiscoveryFixture(projectRoot);
      const { server, baseUrl } = await createServer(projectRoot);
      try {
        const res = await requestJson(baseUrl, 'GET', '/api/discoveries');
        assert.equal(res.status, 200);
        assert.equal(Array.isArray(res.json.discoveries), true);
        assert.equal(res.json.total, 1);

        const discovery = res.json.discoveries[0];
        assert.equal(discovery.discovery_id, discoveryId);
        assert.equal(discovery.phase, 'complete');
        // Verify stats are extracted from results object
        assert.equal(discovery.total_findings, 5);
        assert.equal(discovery.issues_generated, 2);
        assert.deepEqual(discovery.priority_distribution, { critical: 1, high: 2, medium: 1, low: 1 });
        // Verify perspectives is string array
        assert.ok(Array.isArray(discovery.perspectives));
        assert.ok(discovery.perspectives.includes('bug'));
        assert.ok(discovery.perspectives.includes('security'));
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('GET /api/discoveries/:id/progress returns correct progress for new format', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'ccw-discovery-routes-newformat-'));
    try {
      const { discoveryId } = createNewFormatDiscoveryFixture(projectRoot);
      const { server, baseUrl } = await createServer(projectRoot);
      try {
        const res = await requestJson(baseUrl, 'GET', `/api/discoveries/${encodeURIComponent(discoveryId)}/progress`);
        assert.equal(res.status, 200);
        assert.equal(res.json.discovery_id, discoveryId);
        assert.ok(res.json.progress);

        const pa = res.json.progress.perspective_analysis;
        assert.equal(pa.total, 3); // bug, security, performance
        assert.equal(pa.completed, 2); // bug, security
        assert.equal(pa.failed, 1); // performance
        assert.equal(pa.in_progress, 0);
        assert.equal(pa.percent_complete, 100); // (completed + failed) / total = 3/3 = 100%

        // Verify agent_status is converted to object array for UI compatibility
        assert.ok(Array.isArray(res.json.agent_status));
        const bugStatus = res.json.agent_status.find((s: any) => s.name === 'bug');
        assert.ok(bugStatus);
        assert.equal(bugStatus.status, 'completed');
        const perfStatus = res.json.agent_status.find((s: any) => s.name === 'performance');
        assert.ok(perfStatus);
        assert.equal(perfStatus.status, 'failed');
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it('mixed old and new format discoveries are listed correctly', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'ccw-discovery-routes-mixed-'));
    try {
      const oldFormat = createDiscoveryFixture(projectRoot);
      const newFormat = createNewFormatDiscoveryFixture(projectRoot);
      const { server, baseUrl } = await createServer(projectRoot);
      try {
        const res = await requestJson(baseUrl, 'GET', '/api/discoveries');
        assert.equal(res.status, 200);
        assert.equal(res.json.total, 2);

        // Both formats should be parsed correctly
        const oldDiscovery = res.json.discoveries.find((d: any) => d.discovery_id === oldFormat.discoveryId);
        const newDiscovery = res.json.discoveries.find((d: any) => d.discovery_id === newFormat.discoveryId);

        assert.ok(oldDiscovery);
        assert.ok(newDiscovery);

        // Old format stats
        assert.equal(oldDiscovery.total_findings, 1);

        // New format stats from results object
        assert.equal(newDiscovery.total_findings, 5);
        assert.equal(newDiscovery.issues_generated, 2);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});

