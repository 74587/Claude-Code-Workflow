/**
 * Regression test: tolerate stale X-CSRF-Token headers by falling back to the cookie token.
 *
 * Background:
 * - Tokens are single-use and rotated after each successful state-changing request.
 * - Older dashboards may cache the header token while other requests rotate the cookie token.
 * - If the server prioritizes the stale header token and does not fall back, valid requests can 403.
 */

import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

function createMockRes() {
  const headers = {};
  const response = {
    status: null,
    headers,
    body: '',
    writeHead: (status, nextHeaders) => {
      response.status = status;
      if (nextHeaders) {
        for (const [k, v] of Object.entries(nextHeaders)) {
          headers[String(k).toLowerCase()] = v;
        }
      }
    },
    setHeader: (name, value) => {
      headers[String(name).toLowerCase()] = value;
    },
    getHeader: (name) => headers[String(name).toLowerCase()],
    end: (body) => {
      response.body = body ? String(body) : '';
    },
  };
  return response;
}

const middlewareUrl = new URL('../dist/core/auth/csrf-middleware.js', import.meta.url);
const managerUrl = new URL('../dist/core/auth/csrf-manager.js', import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let middleware;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let csrfManager;

describe('csrf middleware (header-cookie fallback)', async () => {
  middleware = await import(middlewareUrl.href);
  csrfManager = await import(managerUrl.href);

  afterEach(() => {
    csrfManager.resetCsrfTokenManager();
  });

  it('accepts request when header token is stale but cookie token is valid', async () => {
    const sessionId = 'session-1';
    const manager = csrfManager.getCsrfTokenManager({ cleanupIntervalMs: 0 });
    const staleHeaderToken = manager.generateToken(sessionId);
    const validCookieToken = manager.generateToken(sessionId);

    // Mark the header token as already used (simulates a previous successful request).
    assert.equal(manager.validateToken(staleHeaderToken, sessionId), true);

    const req = {
      method: 'POST',
      headers: {
        cookie: `ccw_session_id=${sessionId}; XSRF-TOKEN=${validCookieToken}`,
        'x-csrf-token': staleHeaderToken,
      },
    };
    const res = createMockRes();

    const ok = await middleware.csrfValidation({ pathname: '/api/remove-recent-path', req, res });
    assert.equal(ok, true);
    assert.equal(res.status, null);

    const rotated = res.headers['x-csrf-token'];
    assert.ok(typeof rotated === 'string' && rotated.length > 0);
    assert.notEqual(rotated, staleHeaderToken);
    assert.notEqual(rotated, validCookieToken);
  });
});
