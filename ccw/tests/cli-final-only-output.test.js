/**
 * ccw cli exec --final output mode
 *
 * Ensures programmatic callers can get a clean final agent result without
 * banners/spinner/summary noise on stdout.
 */

import { afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const cliCommandPath = new URL('../dist/commands/cli.js', import.meta.url).href;
const cliExecutorPath = new URL('../dist/tools/cli-executor.js', import.meta.url).href;

function stubHttpRequest() {
  mock.method(http, 'request', () => {
    const req = {
      on(event, handler) {
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

describe('ccw cli exec --final', async () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('writes only finalOutput to stdout (no banner/summary)', async () => {
    stubHttpRequest();

    const cliModule = await import(cliCommandPath);
    const cliExecutorModule = await import(cliExecutorPath);

    const stdoutWrites = [];
    mock.method(process.stdout, 'write', (chunk) => {
      stdoutWrites.push(String(chunk));
      return true;
    });
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});

    mock.method(cliExecutorModule.cliExecutorTool, 'execute', async () => {
      return {
        success: true,
        stdout: 'STDOUT_SHOULD_NOT_WIN',
        stderr: '',
        parsedOutput: 'PARSED_SHOULD_NOT_WIN',
        finalOutput: 'FINAL',
        execution: { id: 'EXEC-FINAL', duration_ms: 1, status: 'success' },
        conversation: { turn_count: 1, total_duration_ms: 1 },
      };
    });

    // Prevent the command from terminating the test runner.
    mock.method(process, 'exit', () => {});

    // Ensure the CLI's internal delayed exit timer doesn't keep the test process alive.
    const realSetTimeout = globalThis.setTimeout;
    mock.method(globalThis, 'setTimeout', (fn, ms, ...args) => {
      const t = realSetTimeout(fn, ms, ...args);
      t?.unref?.();
      return t;
    });

    await cliModule.cliCommand('exec', [], { prompt: 'Hello', tool: 'gemini', final: true });

    assert.equal(stdoutWrites.join(''), 'FINAL');
  });
});
