/**
 * Unit tests for LiteLLM embedding client bridge (ccw/dist/tools/litellm-client.js).
 *
 * Notes:
 * - Targets the runtime implementation shipped in `ccw/dist`.
 * - Stubs `child_process.spawn` to prevent real Python execution.
 * - Uses Node's built-in test runner (node:test).
 */

import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const childProcess = require('node:child_process') as typeof import('node:child_process');

type SpawnBehavior =
  | { type: 'close'; code?: number; stdout?: string; stderr?: string }
  | { type: 'error'; error: Error }
  | { type: 'hang' };

type SpawnCall = {
  command: string;
  args: string[];
  options: unknown;
  proc: FakeChildProcess;
};

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killCalls: Array<string | undefined> = [];

  kill(signal?: string): boolean {
    this.killCalls.push(signal);
    return true;
  }
}

const spawnCalls: SpawnCall[] = [];
const spawnPlan: SpawnBehavior[] = [];

const originalSpawn = childProcess.spawn;

childProcess.spawn = ((command: string, args: string[] = [], options: unknown = {}) => {
  const proc = new FakeChildProcess();
  const call: SpawnCall = {
    command: String(command),
    args: args.map(String),
    options,
    proc,
  };
  spawnCalls.push(call);

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

    // hang: intentionally do nothing (used for timeout tests)
  });

  return proc as any;
}) as any;

const litellmClientUrl = new URL('../dist/tools/litellm-client.js', import.meta.url);
litellmClientUrl.searchParams.set('t', String(Date.now()));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod: any;

beforeEach(async () => {
  spawnCalls.length = 0;
  spawnPlan.length = 0;

  mod = await import(litellmClientUrl.href);
});

describe('LiteLLMClient (embedding)', () => {
  it('embed constructs the expected Python CLI invocation and parses vectors', async () => {
    spawnPlan.push({ type: 'close', code: 0, stdout: JSON.stringify([[1, 2, 3]]) });

    const client = new mod.LiteLLMClient({ pythonPath: 'python', timeout: 123 });
    const res = await client.embed(['hello'], 'test-model');

    assert.equal(res.model, 'test-model');
    assert.equal(res.dimensions, 3);
    assert.deepEqual(res.vectors, [[1, 2, 3]]);

    assert.equal(spawnCalls.length, 1);
    assert.equal(spawnCalls[0].command, 'python');
    assert.deepEqual(spawnCalls[0].args, [
      '-m',
      'ccw_litellm.cli',
      'embed',
      '--model',
      'test-model',
      '--output',
      'json',
      'hello',
    ]);
  });

  it('embed supports multiple texts (batch via CLI args)', async () => {
    spawnPlan.push({ type: 'close', code: 0, stdout: JSON.stringify([[0, 0], [1, 1]]) });

    const client = new mod.LiteLLMClient({ pythonPath: 'py' });
    const res = await client.embed(['a', 'b']);

    assert.equal(res.model, 'default');
    assert.equal(res.dimensions, 2);
    assert.deepEqual(res.vectors, [[0, 0], [1, 1]]);

    assert.equal(spawnCalls.length, 1);
    assert.equal(spawnCalls[0].command, 'py');
    assert.ok(spawnCalls[0].args.includes('a'));
    assert.ok(spawnCalls[0].args.includes('b'));
  });

  it('isAvailable returns true when version succeeds', async () => {
    spawnPlan.push({ type: 'close', code: 0, stdout: '1.2.3' });

    const client = new mod.LiteLLMClient({ pythonPath: 'python' });
    assert.equal(await client.isAvailable(), true);

    assert.equal(spawnCalls.length, 1);
    assert.deepEqual(spawnCalls[0].args, ['-m', 'ccw_litellm.cli', 'version']);
  });

  it('getStatus returns version when available and returns error when unavailable', async () => {
    spawnPlan.push({ type: 'close', code: 0, stdout: '9.9.9' });

    const client = new mod.LiteLLMClient({ pythonPath: 'python' });
    const ok = await client.getStatus();
    assert.deepEqual(ok, { available: true, version: '9.9.9' });

    spawnPlan.push({ type: 'error', error: new Error('spawn ENOENT') });
    const bad = await client.getStatus();
    assert.equal(bad.available, false);
    assert.ok(String(bad.error).includes('Failed to spawn Python process: spawn ENOENT'));
  });

  it('embed throws clear errors for invalid input', async () => {
    const client = new mod.LiteLLMClient();

    await assert.rejects(
      client.embed([]),
      (err: any) => err instanceof Error && err.message.includes('texts array cannot be empty'),
    );

    await assert.rejects(
      client.embed(null as any),
      (err: any) => err instanceof Error && err.message.includes('texts array cannot be empty'),
    );
  });

  it('embed times out and terminates the spawned process', async () => {
    spawnPlan.push({ type: 'hang' });

    const client = new mod.LiteLLMClient({ pythonPath: 'python', timeout: 5 });
    await assert.rejects(
      client.embed(['slow']),
      (err: any) => err instanceof Error && err.message.includes('Command timed out after 10ms'),
    );

    assert.equal(spawnCalls.length, 1);
    assert.deepEqual(spawnCalls[0].proc.killCalls, ['SIGTERM']);
  });

  it('propagates stderr when the Python process exits non-zero', async () => {
    spawnPlan.push({ type: 'close', code: 2, stderr: 'boom' });

    const client = new mod.LiteLLMClient({ pythonPath: 'python', timeout: 50 });
    await assert.rejects(
      client.embed(['x']),
      (err: any) => err instanceof Error && err.message.includes('boom'),
    );
  });
});

after(() => {
  childProcess.spawn = originalSpawn;
});

