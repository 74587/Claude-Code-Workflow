/**
 * Unit tests for Memory command module (ccw memory)
 *
 * Notes:
 * - Targets the runtime implementation shipped in `ccw/dist`.
 * - Uses Node's built-in test runner (node:test).
 * - Avoids real network / Python executions by stubbing HTTP and asserting fail-fast paths.
 */

import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

class ExitError extends Error {
  code?: number;

  constructor(code?: number) {
    super(`process.exit(${code ?? 'undefined'})`);
    this.code = code;
  }
}

const TEST_CCW_HOME = mkdtempSync(join(tmpdir(), 'ccw-memory-command-'));
const TEST_USER_HOME = join(TEST_CCW_HOME, 'user-home');

const memoryCommandPath = new URL('../dist/commands/memory.js', import.meta.url).href;
const memoryStorePath = new URL('../dist/core/memory-store.js', import.meta.url).href;
const coreMemoryStorePath = new URL('../dist/core/core-memory-store.js', import.meta.url).href;
const historyStorePath = new URL('../dist/tools/cli-history-store.js', import.meta.url).href;

function stubHttpRequest(): void {
  mock.method(http, 'request', (_options: any, cb?: any) => {
    const res = {
      statusCode: 204,
      on(_event: string, _handler: any) {},
    };
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

describe('memory command module', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let memoryModule: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let memoryStoreModule: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let coreMemoryStoreModule: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let historyStoreModule: any;

  const originalEnv = {
    CCW_DATA_DIR: process.env.CCW_DATA_DIR,
    USERPROFILE: process.env.USERPROFILE,
    HOME: process.env.HOME,
  };

  before(async () => {
    process.env.CCW_DATA_DIR = TEST_CCW_HOME;
    process.env.USERPROFILE = TEST_USER_HOME;
    process.env.HOME = TEST_USER_HOME;

    memoryModule = await import(memoryCommandPath);
    memoryStoreModule = await import(memoryStorePath);
    coreMemoryStoreModule = await import(coreMemoryStorePath);
    historyStoreModule = await import(historyStorePath);
  });

  beforeEach(() => {
    // Ensure we don't read real user data or write to real CCW storage
    process.env.CCW_DATA_DIR = TEST_CCW_HOME;
    process.env.USERPROFILE = TEST_USER_HOME;
    process.env.HOME = TEST_USER_HOME;

    try {
      memoryStoreModule?.closeAllStores?.();
      coreMemoryStoreModule?.closeAllStores?.();
      historyStoreModule?.closeAllStores?.();
    } catch {
      // ignore cleanup errors
    }

    if (existsSync(TEST_CCW_HOME)) {
      rmSync(TEST_CCW_HOME, { recursive: true, force: true });
    }
    mkdirSync(TEST_CCW_HOME, { recursive: true });
    mkdirSync(TEST_USER_HOME, { recursive: true });
  });

  afterEach(() => {
    mock.restoreAll();
  });

  after(() => {
    try {
      memoryStoreModule?.closeAllStores?.();
      coreMemoryStoreModule?.closeAllStores?.();
      historyStoreModule?.closeAllStores?.();
    } catch {
      // ignore
    }

    process.env.CCW_DATA_DIR = originalEnv.CCW_DATA_DIR;
    process.env.USERPROFILE = originalEnv.USERPROFILE;
    process.env.HOME = originalEnv.HOME;

    rmSync(TEST_CCW_HOME, { recursive: true, force: true });
  });

  it('tracks entity access and persists entity stats', async () => {
    stubHttpRequest();
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});
    mock.method(process as any, 'exit', (code?: number) => {
      throw new ExitError(code);
    });

    const value = 'D:\\Repo\\src\\auth.ts';
    await memoryModule.memoryCommand('track', [], {
      type: 'file',
      action: 'read',
      value,
      session: 'S-1',
    });

    const store = memoryStoreModule.getMemoryStore(process.cwd());
    const normalized = 'd:/Repo/src/auth.ts';
    const entity = store.getEntity('file', normalized);
    assert.ok(entity, 'Expected entity to be persisted');

    const stats = store.getStats(entity.id);
    assert.ok(stats, 'Expected entity stats to exist');
    assert.equal(stats.read_count, 1);
  });

  it('validates required track options (type/action/value)', async () => {
    stubHttpRequest();
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});
    mock.method(process as any, 'exit', (code?: number) => {
      throw new ExitError(code);
    });

    await assert.rejects(
      memoryModule.memoryCommand('track', [], { type: 'file' }),
      (err: any) => err instanceof ExitError && err.code === 1,
    );
  });

  it('imports history safely (no-op when ~/.claude/history.jsonl is missing)', async () => {
    stubHttpRequest();
    mock.method(process as any, 'exit', (code?: number) => {
      throw new ExitError(code);
    });

    const logs: string[] = [];
    mock.method(console, 'log', (...args: any[]) => {
      logs.push(args.map(String).join(' '));
    });
    mock.method(console, 'error', (...args: any[]) => {
      logs.push(args.map(String).join(' '));
    });

    await memoryModule.memoryCommand('import', [], { source: 'history' });
    assert.ok(logs.some((l) => l.includes('Import Complete')));
    assert.ok(logs.some((l) => l.includes('Total Imported: 0')));
  });

  it('outputs empty JSON for stats/search/suggest when no data exists', async () => {
    stubHttpRequest();
    mock.method(process as any, 'exit', (code?: number) => {
      throw new ExitError(code);
    });

    const outputs: string[] = [];
    mock.method(console, 'log', (...args: any[]) => {
      outputs.push(args.map(String).join(' '));
    });

    outputs.length = 0;
    await memoryModule.memoryCommand('stats', [], { json: true, limit: '5' });
    assert.deepEqual(JSON.parse(outputs.at(-1) ?? 'null'), []);

    outputs.length = 0;
    await memoryModule.memoryCommand('search', ['auth'], { json: true, limit: '5' });
    assert.deepEqual(JSON.parse(outputs.at(-1) ?? 'null'), []);

    outputs.length = 0;
    await memoryModule.memoryCommand('suggest', [], { json: true, limit: '3', context: 'ctx' });
    const suggestJson = JSON.parse(outputs.at(-1) ?? 'null');
    assert.deepEqual(suggestJson.suggestions, []);
    assert.equal(suggestJson.context, 'ctx');
  });

  it('prune is a no-op when database is missing', async () => {
    stubHttpRequest();
    mock.method(process as any, 'exit', (code?: number) => {
      throw new ExitError(code);
    });

    const logs: string[] = [];
    mock.method(console, 'log', (...args: any[]) => {
      logs.push(args.map(String).join(' '));
    });

    await memoryModule.memoryCommand('prune', [], { olderThan: '1d', dryRun: true });
    assert.ok(logs.some((l) => l.includes('Nothing to prune') || l.includes('No memory database found')));
  });

  it('prune validates age format', async () => {
    stubHttpRequest();

    const errors: string[] = [];
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', (...args: any[]) => {
      errors.push(args.map(String).join(' '));
    });

    mock.method(process as any, 'exit', (code?: number) => {
      throw new ExitError(code);
    });

    await assert.rejects(
      memoryModule.memoryCommand('prune', [], { olderThan: 'not-an-age', dryRun: true }),
      (err: any) => err instanceof ExitError && err.code === 1,
    );

    assert.ok(errors.some((e) => e.includes('Invalid age format')));
  });

  it('embed/embed-status/semantic-search fail fast without core-memory database', async () => {
    stubHttpRequest();

    const errors: string[] = [];
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', (...args: any[]) => {
      errors.push(args.map(String).join(' '));
    });

    mock.method(process as any, 'exit', (code?: number) => {
      throw new ExitError(code);
    });

    // Embed
    await assert.rejects(
      memoryModule.memoryCommand('embed', [], {}),
      (err: any) => err instanceof ExitError && err.code === 1,
    );

    // Embed status
    await assert.rejects(
      memoryModule.memoryCommand('embed-status', [], { json: true }),
      (err: any) => err instanceof ExitError && err.code === 1,
    );

    // Semantic search (topK/minScore triggers semantic mode)
    await assert.rejects(
      memoryModule.memoryCommand('search', ['auth'], { topK: '5', minScore: '0.5', json: true }),
      (err: any) => err instanceof ExitError && err.code === 1,
    );

    // Should not attempt long-running operations; it should fail before Python execution.
    assert.ok(
      errors.some((e) => /embedder not available|database not found/i.test(e)),
      'Expected a fast-fail message about embedder availability or missing DB',
    );
  });
});
