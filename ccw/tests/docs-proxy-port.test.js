/**
 * Docs proxy (dashboard server) - configured docsPort plumbing
 *
 * Runs against the shipped runtime in `ccw/dist`.
 */

import { afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ORIGINAL_ENV = { ...process.env };

const serverUrl = new URL('../dist/core/server.js', import.meta.url);
serverUrl.searchParams.set('t', String(Date.now()));

function httpGetText(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body: data }));
    });
    req.on('error', reject);
  });
}

describe('docs proxy port', () => {
  afterEach(() => {
    mock.restoreAll();
    process.env = ORIGINAL_ENV;
  });

  it('proxies /docs/* to the configured docsPort', async () => {
    const ccwHome = mkdtempSync(join(tmpdir(), 'ccw-docs-proxy-home-'));
    process.env = { ...ORIGINAL_ENV, CCW_DATA_DIR: ccwHome, CCW_DISABLE_WARMUP: '1' };

    const serverMod = await import(serverUrl.href);

    let proxiedToUrl = null;
    mock.method(globalThis, 'fetch', async (url) => {
      proxiedToUrl = String(url);
      return new Response('ok', {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    });

    const server = await serverMod.startServer({
      port: 0,
      initialPath: process.cwd(),
      frontend: 'react',
      reactPort: 65530,
      docsPort: 39999,
    });

    try {
      const addr = server.address();
      assert.equal(typeof addr, 'object');
      assert.ok(addr);

      const { statusCode, body } = await httpGetText(`http://127.0.0.1:${addr.port}/docs/zh/`);
      assert.equal(statusCode, 200);
      assert.equal(body, 'ok');
      assert.equal(proxiedToUrl, 'http://localhost:39999/docs/zh/');
    } finally {
      await new Promise((resolve) => server.close(resolve));
      rmSync(ccwHome, { recursive: true, force: true });
    }
  });
});
