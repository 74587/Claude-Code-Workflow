import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('node:fs') as typeof import('node:fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const childProcess = require('node:child_process') as typeof import('node:child_process');

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  stdinChunks: string[] = [];
  stdin = {
    write: (chunk: string | Buffer) => {
      this.stdinChunks.push(String(chunk));
      return true;
    },
    end: () => undefined,
  };
}

type SpawnCall = {
  command: string;
  args: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: any;
  child: FakeChildProcess;
};

const spawnCalls: SpawnCall[] = [];
const tempDirs: string[] = [];
let embedderAvailable = true;

const originalExistsSync = fs.existsSync;
const originalSpawn = childProcess.spawn;

fs.existsSync = ((..._args: unknown[]) => embedderAvailable) as typeof fs.existsSync;

childProcess.spawn = ((command: string, args: string[] = [], options: unknown = {}) => {
  const child = new FakeChildProcess();
  spawnCalls.push({ command: String(command), args: args.map(String), options, child });

  queueMicrotask(() => {
    child.stdout.emit('data', JSON.stringify({
      success: true,
      total_chunks: 4,
      hnsw_available: true,
      hnsw_count: 4,
      dimension: 384,
    }));
    child.emit('close', 0);
  });

  return child as unknown as ReturnType<typeof childProcess.spawn>;
}) as typeof childProcess.spawn;

after(() => {
  fs.existsSync = originalExistsSync;
  childProcess.spawn = originalSpawn;
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop() as string, { recursive: true, force: true });
  }
});

describe('unified-vector-index', () => {
  beforeEach(() => {
    embedderAvailable = true;
    spawnCalls.length = 0;
  });

  it('spawns CodexLens venv python with hidden window options', async () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'ccw-unified-vector-index-'));
    tempDirs.push(projectDir);

    const moduleUrl = new URL('../dist/core/unified-vector-index.js', import.meta.url);
    moduleUrl.searchParams.set('t', String(Date.now()));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import(moduleUrl.href);

    const index = new mod.UnifiedVectorIndex(projectDir);
    const status = await index.getStatus();

    assert.equal(status.success, true);
    assert.equal(spawnCalls.length, 1);
    assert.equal(spawnCalls[0].options.shell, false);
    assert.equal(spawnCalls[0].options.windowsHide, true);
    assert.equal(spawnCalls[0].options.env.PYTHONIOENCODING, 'utf-8');
    assert.deepEqual(spawnCalls[0].options.stdio, ['pipe', 'pipe', 'pipe']);
    assert.match(spawnCalls[0].child.stdinChunks.join(''), /"operation":"status"/);
  });
});
