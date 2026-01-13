/**
 * Unit tests for LiteLLM client bridge (ccw/dist/tools/litellm-client.js).
 *
 * Notes:
 * - Uses Node's built-in test runner (node:test) (no Jest in this repo).
 * - Stubs `child_process.spawn` to avoid depending on local Python/ccw_litellm installation.
 */

import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const childProcess = require('child_process') as typeof import('child_process');

type SpawnBehavior =
  | { type: 'close'; code?: number; stdout?: string; stderr?: string }
  | { type: 'error'; error: Error }
  | { type: 'hang' };

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killCalls: string[] = [];

  kill(signal?: NodeJS.Signals | number | string): boolean {
    this.killCalls.push(signal === undefined ? 'undefined' : String(signal));
    return true;
  }
}

type SpawnCall = {
  command: string;
  args: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: any;
  proc: FakeChildProcess;
};

const spawnCalls: SpawnCall[] = [];
const spawnPlan: SpawnBehavior[] = [];

const originalSpawn = childProcess.spawn;

childProcess.spawn = ((command: string, args: string[] = [], options: any = {}) => {
  const normalizedArgs = (args ?? []).map(String);
  const shouldIntercept = normalizedArgs[0] === '-m' && normalizedArgs[1] === 'ccw_litellm.cli';
  if (!shouldIntercept) {
    return originalSpawn(command as any, args as any, options as any);
  }

  const proc = new FakeChildProcess();
  spawnCalls.push({ command: String(command), args: normalizedArgs, options, proc });

  const next = spawnPlan.shift() ?? { type: 'close', code: 0, stdout: '' };

  queueMicrotask(() => {
    if (next.type === 'error') {
      proc.emit('error', next.error);
      return;
    }

    if (next.type === 'close') {
      if (next.stdout !== undefined) proc.stdout.emit('data', next.stdout);
      if (next.stderr !== undefined) proc.stderr.emit('data', next.stderr);
      proc.emit('close', next.code ?? 0);
      return;
    }

    // hang: intentionally do nothing
  });

  return proc as any;
}) as any;

function getClientModuleUrl(): URL {
  const url = new URL('../dist/tools/litellm-client.js', import.meta.url);
  url.searchParams.set('t', `${Date.now()}-${Math.random()}`);
  return url;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod: any;

beforeEach(async () => {
  spawnCalls.length = 0;
  spawnPlan.length = 0;
  mod = await import(getClientModuleUrl().href);
});

after(() => {
  childProcess.spawn = originalSpawn;
});

describe('LiteLLM client bridge', () => {
  it('uses default pythonPath and version check arguments', async () => {
    spawnPlan.push({ type: 'close', code: 0, stdout: '1.2.3\n' });

    const client = new mod.LiteLLMClient();
    const available = await client.isAvailable();

    assert.equal(available, true);
    assert.equal(spawnCalls.length, 1);
    assert.equal(spawnCalls[0].command, 'python');
    assert.deepEqual(spawnCalls[0].args, ['-m', 'ccw_litellm.cli', 'version']);
  });

  it('uses custom pythonPath when provided', async () => {
    spawnPlan.push({ type: 'close', code: 0, stdout: 'ok' });

    const client = new mod.LiteLLMClient({ pythonPath: 'python3', timeout: 10 });
    await client.chat('hello', 'default');

    assert.equal(spawnCalls.length, 1);
    assert.equal(spawnCalls[0].command, 'python3');
  });

  it('isAvailable returns false on spawn error', async () => {
    spawnPlan.push({ type: 'error', error: new Error('ENOENT') });

    const client = new mod.LiteLLMClient({ timeout: 10 });
    const available = await client.isAvailable();

    assert.equal(available, false);
  });

  it('getStatus returns version on success', async () => {
    spawnPlan.push({ type: 'close', code: 0, stdout: 'v9.9.9\n' });

    const client = new mod.LiteLLMClient({ timeout: 10 });
    const status = await client.getStatus();

    assert.equal(status.available, true);
    assert.equal(status.version, 'v9.9.9');
  });

  it('getStatus returns error details on non-zero exit', async () => {
    spawnPlan.push({ type: 'close', code: 1, stderr: 'HTTP 500 Internal Server Error' });

    const client = new mod.LiteLLMClient({ timeout: 10 });
    const status = await client.getStatus();

    assert.equal(status.available, false);
    assert.ok(String(status.error).includes('HTTP 500'));
  });

  it('getConfig parses JSON output', async () => {
    spawnPlan.push({ type: 'close', code: 0, stdout: JSON.stringify({ ok: true }) });

    const client = new mod.LiteLLMClient({ timeout: 10 });
    const cfg = await client.getConfig();

    assert.deepEqual(cfg, { ok: true });
    assert.equal(spawnCalls.length, 1);
    assert.deepEqual(spawnCalls[0].args, ['-m', 'ccw_litellm.cli', 'config', '--json']);
  });

  it('getConfig throws on malformed JSON', async () => {
    spawnPlan.push({ type: 'close', code: 0, stdout: '{not-json' });

    const client = new mod.LiteLLMClient({ timeout: 10 });
    await assert.rejects(() => client.getConfig());
  });

  it('embed rejects empty texts input and does not spawn', async () => {
    const client = new mod.LiteLLMClient({ timeout: 10 });
    await assert.rejects(() => client.embed([]), /texts array cannot be empty/);
    assert.equal(spawnCalls.length, 0);
  });

  it('embed rejects null/undefined input', async () => {
    const client = new mod.LiteLLMClient({ timeout: 10 });
    await assert.rejects(() => client.embed(null as any), /texts array cannot be empty/);
    await assert.rejects(() => client.embed(undefined as any), /texts array cannot be empty/);
    assert.equal(spawnCalls.length, 0);
  });

  it('embed returns vectors with derived dimensions', async () => {
    spawnPlan.push({ type: 'close', code: 0, stdout: JSON.stringify([[1, 2, 3], [4, 5, 6]]) });

    const client = new mod.LiteLLMClient({ timeout: 10 });
    const res = await client.embed(['a', 'b'], 'embed-model');

    assert.equal(res.model, 'embed-model');
    assert.equal(res.dimensions, 3);
    assert.deepEqual(res.vectors, [
      [1, 2, 3],
      [4, 5, 6],
    ]);

    assert.equal(spawnCalls.length, 1);
    assert.deepEqual(spawnCalls[0].args, [
      '-m',
      'ccw_litellm.cli',
      'embed',
      '--model',
      'embed-model',
      '--output',
      'json',
      'a',
      'b',
    ]);
  });

  it('embed throws on malformed JSON output', async () => {
    spawnPlan.push({ type: 'close', code: 0, stdout: 'not-json' });

    const client = new mod.LiteLLMClient({ timeout: 10 });
    await assert.rejects(() => client.embed(['a'], 'embed-model'));
  });

  it('chat rejects empty message and does not spawn', async () => {
    const client = new mod.LiteLLMClient({ timeout: 10 });
    await assert.rejects(() => client.chat(''), /message cannot be empty/);
    assert.equal(spawnCalls.length, 0);
  });

  it('chat returns trimmed stdout on success', async () => {
    spawnPlan.push({ type: 'close', code: 0, stdout: 'Hello\n' });

    const client = new mod.LiteLLMClient({ timeout: 10 });
    const out = await client.chat('hi', 'chat-model');

    assert.equal(out, 'Hello');
    assert.equal(spawnCalls.length, 1);
    assert.deepEqual(spawnCalls[0].args, ['-m', 'ccw_litellm.cli', 'chat', '--model', 'chat-model', 'hi']);
  });

  it('chat propagates auth errors (401)', async () => {
    spawnPlan.push({ type: 'close', code: 1, stderr: 'HTTP 401 Unauthorized' });

    const client = new mod.LiteLLMClient({ timeout: 10 });
    await assert.rejects(() => client.chat('hi', 'chat-model'), /401/);
  });

  it('chat propagates auth errors (403)', async () => {
    spawnPlan.push({ type: 'close', code: 1, stderr: 'HTTP 403 Forbidden' });

    const client = new mod.LiteLLMClient({ timeout: 10 });
    await assert.rejects(() => client.chat('hi', 'chat-model'), /403/);
  });

  it('chat propagates rate limit errors (429)', async () => {
    spawnPlan.push({ type: 'close', code: 1, stderr: 'HTTP 429 Too Many Requests' });

    const client = new mod.LiteLLMClient({ timeout: 10 });
    await assert.rejects(() => client.chat('hi', 'chat-model'), /429/);
  });

  it('chat propagates server errors (500)', async () => {
    spawnPlan.push({ type: 'close', code: 1, stderr: 'HTTP 500 Internal Server Error' });

    const client = new mod.LiteLLMClient({ timeout: 10 });
    await assert.rejects(() => client.chat('hi', 'chat-model'), /500/);
  });

  it('chat propagates server errors (503)', async () => {
    spawnPlan.push({ type: 'close', code: 1, stderr: 'HTTP 503 Service Unavailable' });

    const client = new mod.LiteLLMClient({ timeout: 10 });
    await assert.rejects(() => client.chat('hi', 'chat-model'), /503/);
  });

  it('chat falls back to exit code when stderr is empty', async () => {
    spawnPlan.push({ type: 'close', code: 2, stdout: '' });

    const client = new mod.LiteLLMClient({ timeout: 10 });
    await assert.rejects(() => client.chat('hi', 'chat-model'), /Process exited with code 2/);
  });

  it('chat surfaces spawn failures with descriptive message', async () => {
    spawnPlan.push({ type: 'error', error: new Error('spawn ENOENT') });

    const client = new mod.LiteLLMClient({ timeout: 10 });
    await assert.rejects(() => client.chat('hi', 'chat-model'), /Failed to spawn Python process: spawn ENOENT/);
  });

  it('chat enforces timeout and terminates process', async () => {
    const originalSetTimeout = global.setTimeout;
    let observedDelay: number | null = null;

    (global as any).setTimeout = ((fn: any, delay: number, ...args: any[]) => {
      observedDelay = delay;
      return originalSetTimeout(fn, 0, ...args);
    }) as any;

    try {
      spawnPlan.push({ type: 'hang' });

      const client = new mod.LiteLLMClient({ timeout: 11 });
      await assert.rejects(() => client.chat('hi', 'chat-model'), /Command timed out after 22ms/);

      assert.equal(observedDelay, 22);
      assert.equal(spawnCalls.length, 1);
      assert.ok(spawnCalls[0].proc.killCalls.includes('SIGTERM'));
    } finally {
      (global as any).setTimeout = originalSetTimeout;
    }
  });

  it('chatMessages rejects empty inputs', async () => {
    const client = new mod.LiteLLMClient({ timeout: 10 });
    await assert.rejects(() => client.chatMessages([]), /messages array cannot be empty/);
    await assert.rejects(() => client.chatMessages(null as any), /messages array cannot be empty/);
    assert.equal(spawnCalls.length, 0);
  });

  it('chatMessages uses the last message content', async () => {
    spawnPlan.push({ type: 'close', code: 0, stdout: 'OK' });

    const client = new mod.LiteLLMClient({ timeout: 10 });
    const res = await client.chatMessages(
      [
        { role: 'user', content: 'first' },
        { role: 'user', content: 'last' },
      ],
      'chat-model',
    );

    assert.equal(res.content, 'OK');
    assert.equal(res.model, 'chat-model');
    assert.equal(spawnCalls.length, 1);
    assert.equal(spawnCalls[0].args.at(-1), 'last');
  });

  it('getLiteLLMClient returns a singleton instance', () => {
    const c1 = mod.getLiteLLMClient();
    const c2 = mod.getLiteLLMClient();
    assert.equal(c1, c2);
  });

  it('checkLiteLLMAvailable returns false when version check fails', async () => {
    spawnPlan.push({ type: 'close', code: 1, stderr: 'ccw_litellm not installed' });

    const available = await mod.checkLiteLLMAvailable();
    assert.equal(available, false);
  });

  it('getLiteLLMStatus includes error message when unavailable', async () => {
    spawnPlan.push({ type: 'close', code: 1, stderr: 'ccw_litellm not installed' });

    const status = await mod.getLiteLLMStatus();
    assert.equal(status.available, false);
    assert.ok(String(status.error).includes('ccw_litellm not installed'));
  });
});

describe('getCodexLensVenvPython (Issue #68 fix)', () => {
  it('should be exported from the module', async () => {
    assert.ok(typeof mod.getCodexLensVenvPython === 'function');
  });

  it('should return a string path', async () => {
    const pythonPath = mod.getCodexLensVenvPython();
    assert.equal(typeof pythonPath, 'string');
    assert.ok(pythonPath.length > 0);
  });

  it('should return correct path structure for CodexLens venv', async () => {
    const pythonPath = mod.getCodexLensVenvPython();

    // On Windows: should contain Scripts/python.exe
    // On Unix: should contain bin/python
    const isWindows = process.platform === 'win32';

    if (isWindows) {
      // Either it's the venv path with Scripts, or fallback to 'python'
      const isVenvPath = pythonPath.includes('Scripts') && pythonPath.includes('python');
      const isFallback = pythonPath === 'python';
      assert.ok(isVenvPath || isFallback, `Expected venv path or 'python' fallback, got: ${pythonPath}`);
    } else {
      // On Unix: either venv path with bin/python, or fallback
      const isVenvPath = pythonPath.includes('bin') && pythonPath.includes('python');
      const isFallback = pythonPath === 'python';
      assert.ok(isVenvPath || isFallback, `Expected venv path or 'python' fallback, got: ${pythonPath}`);
    }
  });

  it('should include .codexlens/venv in path when venv exists', async () => {
    const pythonPath = mod.getCodexLensVenvPython();

    // If not falling back to 'python', should contain .codexlens/venv
    if (pythonPath !== 'python') {
      assert.ok(pythonPath.includes('.codexlens'), `Expected .codexlens in path, got: ${pythonPath}`);
      assert.ok(pythonPath.includes('venv'), `Expected venv in path, got: ${pythonPath}`);
    }
  });
});
