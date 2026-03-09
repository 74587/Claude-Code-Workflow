/**
 * Integration tests for CodexLens ignore-pattern configuration routes.
 *
 * Notes:
 * - Targets runtime implementation shipped in `ccw/dist`.
 * - Calls route handler directly (no HTTP server required).
 * - Uses temporary CODEXLENS_DATA_DIR to isolate ~/.codexlens writes.
 */

import { after, before, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CODEXLENS_HOME = mkdtempSync(join(tmpdir(), 'codexlens-ignore-home-'));
const PROJECT_ROOT = mkdtempSync(join(tmpdir(), 'codexlens-ignore-project-'));

const configRoutesUrl = new URL('../../dist/core/routes/codexlens/config-handlers.js', import.meta.url);
configRoutesUrl.searchParams.set('t', String(Date.now()));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod: any;

const originalEnv = {
  CODEXLENS_DATA_DIR: process.env.CODEXLENS_DATA_DIR,
};

async function callConfigRoute(
  initialPath: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ handled: boolean; status: number; json: any }> {
  const url = new URL(path, 'http://localhost');
  let status = 0;
  let text = '';
  let postPromise: Promise<void> | null = null;

  const res = {
    writeHead(code: number) {
      status = code;
    },
    end(chunk?: unknown) {
      text = chunk === undefined ? '' : String(chunk);
    },
  };

  const handlePostRequest = (_req: unknown, _res: unknown, handler: (parsed: any) => Promise<any>) => {
    postPromise = (async () => {
      const result = await handler(body ?? {});
      const errorValue = result && typeof result === 'object' ? result.error : undefined;
      const statusValue = result && typeof result === 'object' ? result.status : undefined;

      if (typeof errorValue === 'string' && errorValue.length > 0) {
        res.writeHead(typeof statusValue === 'number' ? statusValue : 500);
        res.end(JSON.stringify({ error: errorValue }));
        return;
      }

      res.writeHead(200);
      res.end(JSON.stringify(result));
    })();
  };

  const handled = await mod.handleCodexLensConfigRoutes({
    pathname: url.pathname,
    url,
    req: { method },
    res,
    initialPath,
    handlePostRequest,
    broadcastToClients() {},
  });

  if (postPromise) {
    await postPromise;
  }

  return { handled, status, json: text ? JSON.parse(text) : null };
}

describe('codexlens ignore-pattern routes integration', async () => {
  before(async () => {
    process.env.CODEXLENS_DATA_DIR = CODEXLENS_HOME;
    mock.method(console, 'log', () => {});
    mock.method(console, 'warn', () => {});
    mock.method(console, 'error', () => {});
    mod = await import(configRoutesUrl.href);
  });

  after(() => {
    mock.restoreAll();
    process.env.CODEXLENS_DATA_DIR = originalEnv.CODEXLENS_DATA_DIR;
    rmSync(CODEXLENS_HOME, { recursive: true, force: true });
    rmSync(PROJECT_ROOT, { recursive: true, force: true });
  });

  it('GET /api/codexlens/ignore-patterns returns defaults before config exists', async () => {
    const res = await callConfigRoute(PROJECT_ROOT, 'GET', '/api/codexlens/ignore-patterns');

    assert.equal(res.handled, true);
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
    assert.equal(Array.isArray(res.json.patterns), true);
    assert.equal(Array.isArray(res.json.extensionFilters), true);
    assert.ok(res.json.patterns.includes('dist'));
    assert.ok(res.json.extensionFilters.includes('*.min.js'));
  });

  it('POST /api/codexlens/ignore-patterns persists custom patterns and filters', async () => {
    const saveRes = await callConfigRoute(PROJECT_ROOT, 'POST', '/api/codexlens/ignore-patterns', {
      patterns: ['dist', 'frontend/dist'],
      extensionFilters: ['*.min.js', 'frontend/skip.ts'],
    });

    assert.equal(saveRes.handled, true);
    assert.equal(saveRes.status, 200);
    assert.equal(saveRes.json.success, true);
    assert.deepEqual(saveRes.json.patterns, ['dist', 'frontend/dist']);
    assert.deepEqual(saveRes.json.extensionFilters, ['*.min.js', 'frontend/skip.ts']);

    const settingsPath = join(CODEXLENS_HOME, 'settings.json');
    assert.equal(existsSync(settingsPath), true);
    const savedSettings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    assert.deepEqual(savedSettings.ignore_patterns, ['dist', 'frontend/dist']);
    assert.deepEqual(savedSettings.extension_filters, ['*.min.js', 'frontend/skip.ts']);

    const getRes = await callConfigRoute(PROJECT_ROOT, 'GET', '/api/codexlens/ignore-patterns');
    assert.equal(getRes.status, 200);
    assert.deepEqual(getRes.json.patterns, ['dist', 'frontend/dist']);
    assert.deepEqual(getRes.json.extensionFilters, ['*.min.js', 'frontend/skip.ts']);
  });

  it('POST /api/codexlens/ignore-patterns rejects invalid entries', async () => {
    const res = await callConfigRoute(PROJECT_ROOT, 'POST', '/api/codexlens/ignore-patterns', {
      patterns: ['bad pattern!'],
    });

    assert.equal(res.handled, true);
    assert.equal(res.status, 400);
    assert.match(String(res.json.error), /Invalid patterns:/);
  });
});
