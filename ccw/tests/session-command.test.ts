/**
 * Unit tests for Session command module (ccw session)
 *
 * Notes:
 * - Targets the runtime implementation shipped in `ccw/dist`.
 * - Uses Node's built-in test runner (node:test).
 * - Runs in an isolated temp workspace to avoid touching repo `.workflow`.
 */

import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

class ExitError extends Error {
  code?: number;

  constructor(code?: number) {
    super(`process.exit(${code ?? 'undefined'})`);
    this.code = code;
  }
}

const sessionCommandPath = new URL('../dist/commands/session.js', import.meta.url).href;

function stubHttpRequest(): void {
  mock.method(http, 'request', (_options: any, cb?: any) => {
    const res = { statusCode: 204, on(_event: string, _handler: any) {} };
    if (cb) cb(res);

    const req: any = {
      on(event: string, handler: any) {
        if (event === 'socket') handler({ unref() {} });
        return req;
      },
      write() {},
      end() {},
      destroy() {},
    };
    return req;
  });
}

describe('session command module', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sessionModule: any;

  const originalCwd = process.cwd();
  const testWorkspace = mkdtempSync(join(tmpdir(), 'ccw-session-command-'));

  before(async () => {
    process.chdir(testWorkspace);
    sessionModule = await import(sessionCommandPath);
  });

  beforeEach(() => {
    stubHttpRequest();
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});
  });

  afterEach(() => {
    mock.restoreAll();
  });

  after(() => {
    process.chdir(originalCwd);
    rmSync(testWorkspace, { recursive: true, force: true });
  });

  it('init requires session id', async () => {
    mock.method(process as any, 'exit', (code?: number) => {
      throw new ExitError(code);
    });

    await assert.rejects(
      sessionModule.sessionCommand('init', [], {}),
      (err: any) => err instanceof ExitError && err.code === 1,
    );
  });

  it('init + write + read roundtrip (plan)', async () => {
    mock.method(process as any, 'exit', (code?: number) => {
      throw new ExitError(code);
    });

    const sessionId = 'WFS-TEST-1';

    await sessionModule.sessionCommand('init', [sessionId], { location: 'active' });

    // Write plan content
    await sessionModule.sessionCommand('write', [sessionId, 'IMPL_PLAN.md', '# Plan'], {});

    // Verify file exists in temp workspace
    const sessionDir = join(testWorkspace, '.workflow', 'active', sessionId);
    assert.ok(existsSync(join(sessionDir, 'workflow-session.json')));
    assert.ok(existsSync(join(sessionDir, 'IMPL_PLAN.md')));
    assert.equal(readFileSync(join(sessionDir, 'IMPL_PLAN.md'), 'utf8').trim(), '# Plan');

    // Read returns raw content
    const outputs: string[] = [];
    mock.method(console, 'log', (...args: any[]) => {
      outputs.push(args.map(String).join(' '));
    });

    await sessionModule.sessionCommand('read', [sessionId, 'IMPL_PLAN.md'], { raw: true });
    assert.ok(outputs.some((l) => l.includes('# Plan')));

    // List shows the active session
    outputs.length = 0;
    await sessionModule.sessionCommand('list', [], { location: 'both', metadata: true });
    assert.ok(outputs.some((l) => l.includes(sessionId)));
  });
});

