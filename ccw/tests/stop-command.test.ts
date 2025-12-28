/**
 * Unit tests for Stop command module (ccw stop)
 *
 * Notes:
 * - Targets the runtime implementation shipped in `ccw/dist`.
 * - Uses Node's built-in test runner (node:test).
 * - Mocks fetch and child_process.exec to avoid real netstat/taskkill.
 */

import { after, afterEach, before, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stopCommandPath = new URL('../dist/commands/stop.js', import.meta.url).href;

describe('stop command module', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stopModule: any;

  const require = createRequire(import.meta.url);
  const childProcess = require('child_process');
  const originalExec = childProcess.exec;
  const execCalls: string[] = [];

  before(async () => {
    // Patch child_process.exec BEFORE importing stop module (it captures exec at module init).
    childProcess.exec = (command: string, cb: any) => {
      execCalls.push(command);
      if (/^netstat -ano/i.test(command)) {
        const stdout = 'TCP    0.0.0.0:56792    0.0.0.0:0    LISTENING    4242\r\n';
        cb(null, stdout, '');
        return {} as any;
      }
      if (/^taskkill /i.test(command)) {
        cb(null, '', '');
        return {} as any;
      }
      cb(new Error(`Unexpected exec: ${command}`), '', '');
      return {} as any;
    };

    stopModule = await import(stopCommandPath);
  });

  afterEach(() => {
    execCalls.length = 0;
    mock.restoreAll();
  });

  after(() => {
    childProcess.exec = originalExec;
  });

  it('gracefully stops when CCW server responds to health check', async () => {
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});
    const exitCodes: Array<number | undefined> = [];
    mock.method(process as any, 'exit', (code?: number) => {
      exitCodes.push(code);
    });

    mock.method(globalThis as any, 'fetch', async (url: string, init?: any) => {
      if (url.includes('/api/health')) {
        return { ok: true };
      }
      if (url.includes('/api/shutdown')) {
        return { ok: true };
      }
      throw new Error(`Unexpected fetch: ${url} ${JSON.stringify(init)}`);
    });

    await stopModule.stopCommand({ port: 56792 });
    assert.ok(exitCodes.includes(0));
    assert.ok(!exitCodes.includes(1));
  });

  it('force-kills process when port is in use and --force is set (mocked)', async () => {
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});
    const exitCodes: Array<number | undefined> = [];
    mock.method(process as any, 'exit', (code?: number) => {
      exitCodes.push(code);
    });

    // No server responding, fall back to netstat/taskkill
    mock.method(globalThis as any, 'fetch', async () => null);

    await stopModule.stopCommand({ port: 56792, force: true });
    assert.ok(execCalls.some((c) => /^taskkill /i.test(c)));
    assert.ok(exitCodes.includes(0));
    assert.ok(!exitCodes.includes(1));
  });

  it('does not kill process when --force is not set (exits 0 with guidance)', async () => {
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});
    const exitCodes: Array<number | undefined> = [];
    mock.method(process as any, 'exit', (code?: number) => {
      exitCodes.push(code);
    });

    mock.method(globalThis as any, 'fetch', async () => null);

    await stopModule.stopCommand({ port: 56792, force: false });
    assert.ok(execCalls.some((c) => /^netstat -ano/i.test(c)));
    assert.ok(!execCalls.some((c) => /^taskkill /i.test(c)));
    assert.ok(exitCodes.includes(0));
    assert.ok(!exitCodes.includes(1));
  });
});
