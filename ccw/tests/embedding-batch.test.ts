/**
 * Unit tests for memory embedding batch/status bridge (ccw/dist/core/memory-embedder-bridge.js).
 *
 * Notes:
 * - Targets runtime implementation shipped in `ccw/dist`.
 * - Stubs `fs.existsSync` and `child_process.spawn` to avoid depending on local Python setup.
 */

import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('node:fs') as typeof import('node:fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const childProcess = require('node:child_process') as typeof import('node:child_process');

type SpawnBehavior =
  | { type: 'close'; code?: number; stdout?: string; stderr?: string }
  | { type: 'error'; error: Error }
  | { type: 'hang' };

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
}

type SpawnCall = {
  command: string;
  args: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: any;
};

const spawnCalls: SpawnCall[] = [];
const spawnPlan: SpawnBehavior[] = [];

let embedderAvailable = true;

const originalExistsSync = fs.existsSync;
const originalSpawn = childProcess.spawn;

fs.existsSync = ((..._args: any[]) => embedderAvailable) as any;

childProcess.spawn = ((command: string, args: string[] = [], options: any = {}) => {
  spawnCalls.push({ command: String(command), args: args.map(String), options });

  const proc = new FakeChildProcess();
  const next = spawnPlan.shift() ?? { type: 'close', code: 0, stdout: '{}' };

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

const bridgeUrl = new URL('../dist/core/memory-embedder-bridge.js', import.meta.url);
bridgeUrl.searchParams.set('t', String(Date.now()));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod: any;

beforeEach(async () => {
  embedderAvailable = true;
  spawnCalls.length = 0;
  spawnPlan.length = 0;

  mod = await import(bridgeUrl.href);
});

describe('memory-embedder-bridge', () => {
  it('getEmbeddingStatus returns parsed status and adds success=true', async () => {
    spawnPlan.push({
      type: 'close',
      code: 0,
      stdout: JSON.stringify({
        total_chunks: 3,
        embedded_chunks: 1,
        pending_chunks: 2,
        by_type: { core_memory: { total: 3, embedded: 1, pending: 2 } },
      }),
    });

    const status = await mod.getEmbeddingStatus('C:\\tmp\\db.sqlite');
    assert.equal(status.success, true);
    assert.equal(status.total_chunks, 3);
    assert.equal(status.pending_chunks, 2);
    assert.equal(status.by_type.core_memory.total, 3);

    assert.equal(spawnCalls.length, 1);
    assert.equal(spawnCalls[0].args.at(-2), 'status');
    assert.equal(spawnCalls[0].args.at(-1), 'C:\\tmp\\db.sqlite');
    assert.equal(spawnCalls[0].options.timeout, 30000);
  });

  it('generateEmbeddings builds args for sourceId, batchSize, and force', async () => {
    spawnPlan.push({
      type: 'close',
      code: 0,
      stdout: JSON.stringify({ success: true, chunks_processed: 2, chunks_failed: 0, elapsed_time: 0.01 }),
    });

    const result = await mod.generateEmbeddings('C:\\tmp\\db.sqlite', {
      sourceId: 'CMEM-1',
      batchSize: 4,
      force: true,
    });

    assert.equal(result.success, true);
    assert.equal(result.chunks_failed, 0);

    assert.equal(spawnCalls.length, 1);
    const args = spawnCalls[0].args.map((a) => a.replace(/\\/g, '/'));
    assert.ok(args[0].endsWith('memory_embedder.py'));
    assert.ok(args.includes('embed'));
    assert.ok(args.includes('C:/tmp/db.sqlite'));
    const sourceIdIndex = args.indexOf('--source-id');
    assert.ok(sourceIdIndex !== -1);
    assert.equal(args[sourceIdIndex + 1], 'CMEM-1');

    const batchSizeIndex = args.indexOf('--batch-size');
    assert.ok(batchSizeIndex !== -1);
    assert.equal(args[batchSizeIndex + 1], '4');

    assert.ok(args.includes('--force'));
    assert.equal(spawnCalls[0].options.timeout, 300000);

    spawnCalls.length = 0;
    spawnPlan.push({
      type: 'close',
      code: 0,
      stdout: JSON.stringify({ success: true, chunks_processed: 0, chunks_failed: 0, elapsed_time: 0.01 }),
    });

    await mod.generateEmbeddings('C:\\tmp\\db.sqlite', { batchSize: 8, force: false });
    assert.equal(spawnCalls.length, 1);
    const argsDefault = spawnCalls[0].args;
    assert.equal(argsDefault.includes('--batch-size'), false);
    assert.equal(argsDefault.includes('--force'), false);
  });

  it('returns failure objects when embedder is unavailable (no spawn)', async () => {
    embedderAvailable = false;

    const status = await mod.getEmbeddingStatus('C:\\tmp\\db.sqlite');
    assert.equal(status.success, false);
    assert.equal(status.total_chunks, 0);
    assert.ok(String(status.error).includes('Memory embedder not available'));

    const embed = await mod.generateEmbeddings('C:\\tmp\\db.sqlite');
    assert.equal(embed.success, false);
    assert.equal(embed.chunks_processed, 0);
    assert.ok(String(embed.error).includes('Memory embedder not available'));

    assert.equal(spawnCalls.length, 0);
  });

  it('handles timeouts and non-zero exit codes gracefully', async () => {
    const timeoutErr: any = new Error('spawn timeout');
    timeoutErr.code = 'ETIMEDOUT';
    spawnPlan.push({ type: 'error', error: timeoutErr });

    const timed = await mod.generateEmbeddings('C:\\tmp\\db.sqlite');
    assert.equal(timed.success, false);
    assert.ok(String(timed.error).includes('Python script timed out'));

    spawnPlan.push({ type: 'close', code: 1, stdout: '{"success": false, "error": "partial"}' });
    const failed = await mod.getEmbeddingStatus('C:\\tmp\\db.sqlite');
    assert.equal(failed.success, false);
    assert.ok(String(failed.error).includes('Python script failed (exit code 1)'));
  });
});

after(() => {
  fs.existsSync = originalExistsSync;
  childProcess.spawn = originalSpawn;
});
