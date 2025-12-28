/**
 * Unit tests for Core Memory command module (ccw core-memory)
 *
 * Notes:
 * - Targets the runtime implementation shipped in `ccw/dist`.
 * - Uses Node's built-in test runner (node:test).
 * - Stubs HTTP notifications and avoids external tool execution by mocking store methods.
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

const TEST_CCW_HOME = mkdtempSync(join(tmpdir(), 'ccw-core-memory-command-'));

const coreMemoryCommandPath = new URL('../dist/commands/core-memory.js', import.meta.url).href;
const coreMemoryStorePath = new URL('../dist/core/core-memory-store.js', import.meta.url).href;

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

describe('core-memory command module', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let commandModule: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let storeModule: any;

  const originalEnv = { CCW_DATA_DIR: process.env.CCW_DATA_DIR };

  before(async () => {
    process.env.CCW_DATA_DIR = TEST_CCW_HOME;
    commandModule = await import(coreMemoryCommandPath);
    storeModule = await import(coreMemoryStorePath);
  });

  beforeEach(() => {
    process.env.CCW_DATA_DIR = TEST_CCW_HOME;
    try {
      storeModule?.closeAllStores?.();
    } catch {
      // ignore
    }

    if (existsSync(TEST_CCW_HOME)) {
      rmSync(TEST_CCW_HOME, { recursive: true, force: true });
    }
    mkdirSync(TEST_CCW_HOME, { recursive: true });
  });

  afterEach(() => {
    mock.restoreAll();
  });

  after(() => {
    try {
      storeModule?.closeAllStores?.();
    } catch {
      // ignore
    }
    process.env.CCW_DATA_DIR = originalEnv.CCW_DATA_DIR;
    rmSync(TEST_CCW_HOME, { recursive: true, force: true });
  });

  it('import requires non-empty text', async () => {
    stubHttpRequest();
    mock.method(console, 'log', () => {});
    mock.method(console, 'error', () => {});
    mock.method(process as any, 'exit', (code?: number) => {
      throw new ExitError(code);
    });

    await assert.rejects(
      commandModule.coreMemoryCommand('import', [], {}),
      (err: any) => err instanceof ExitError && err.code === 1,
    );
  });

  it('imports text, lists memories, and exports by id', async () => {
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

    // Import memory
    await commandModule.coreMemoryCommand('import', ['Hello', 'world'], {});

    const store = storeModule.getCoreMemoryStore(process.cwd());
    const memories = store.getMemories({ limit: 10 });
    assert.equal(memories.length, 1);
    const id = memories[0].id;
    assert.ok(memories[0].content.includes('Hello world'));

    // List should include ID
    logs.length = 0;
    await commandModule.coreMemoryCommand('list', [], {});
    assert.ok(logs.some((l) => l.includes(id)));

    // Export prints plain content
    logs.length = 0;
    await commandModule.coreMemoryCommand('export', [], { id });
    assert.ok(logs.some((l) => l.includes('Hello world')));
  });

  it('summary uses store.generateSummary (mocked) and does not call external tools', async () => {
    stubHttpRequest();
    mock.method(process as any, 'exit', (code?: number) => {
      throw new ExitError(code);
    });

    const store = storeModule.getCoreMemoryStore(process.cwd());
    store.upsertMemory({ id: 'CMEM-TEST-1', content: 'Auth architecture notes' });

    mock.method(store, 'generateSummary', async () => 'Short summary');

    const logs: string[] = [];
    mock.method(console, 'log', (...args: any[]) => {
      logs.push(args.map(String).join(' '));
    });
    mock.method(console, 'error', (...args: any[]) => {
      logs.push(args.map(String).join(' '));
    });

    await commandModule.coreMemoryCommand('summary', [], { id: 'CMEM-TEST-1', tool: 'gemini' });
    assert.ok(logs.some((l) => l.includes('Short summary')));
  });

  it('projects json outputs an array (empty when no projects exist)', async () => {
    stubHttpRequest();
    mock.method(process as any, 'exit', (code?: number) => {
      throw new ExitError(code);
    });

    const logs: string[] = [];
    mock.method(console, 'log', (...args: any[]) => {
      logs.push(args.map(String).join(' '));
    });

    await commandModule.coreMemoryCommand('projects', [], { json: true });
    const parsed = JSON.parse(logs.at(-1) ?? 'null');
    assert.ok(Array.isArray(parsed));
  });

  it('cluster create/list/view flows and search finds session metadata', async () => {
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

    const store = storeModule.getCoreMemoryStore(process.cwd());
    store.upsertSessionMetadata({
      session_id: 'CMEM-TEST-1',
      session_type: 'core_memory',
      title: 'Auth flow',
      summary: 'JWT + refresh tokens',
      keywords: ['auth', 'jwt'],
      token_estimate: 123,
    });

    // Create a cluster with one member
    await commandModule.coreMemoryCommand('cluster', [], { create: true, name: 'Cluster A', members: 'CMEM-TEST-1' });

    const clusters = store.listClusters();
    assert.equal(clusters.length, 1);
    const clusterId = clusters[0].id;
    assert.equal(clusters[0].name, 'Cluster A');

    // List clusters as JSON
    logs.length = 0;
    await commandModule.coreMemoryCommand('clusters', [], { json: true });
    const clustersJson = JSON.parse(logs.at(-1) ?? 'null');
    assert.ok(Array.isArray(clustersJson));
    assert.ok(clustersJson.some((c: any) => c.id === clusterId));

    // View cluster details (should include member ID)
    logs.length = 0;
    await commandModule.coreMemoryCommand('cluster', [clusterId], {});
    assert.ok(logs.some((l) => l.includes(clusterId)));
    assert.ok(logs.some((l) => l.includes('CMEM-TEST-1')));

    // Search finds session by keyword
    logs.length = 0;
    await commandModule.coreMemoryCommand('search', ['auth'], { type: 'all' });
    assert.ok(logs.some((l) => l.includes('CMEM-TEST-1')));
  });
});

