/**
 * Unit tests for LiteLLM executor (ccw/dist/tools/litellm-executor.js).
 *
 * Notes:
 * - Targets the runtime implementation shipped in `ccw/dist`.
 * - Uses a temporary CCW data directory (CCW_DATA_DIR) to isolate config writes.
 * - Stubs `child_process.spawn` to prevent real Python/ccw_litellm execution.
 */

import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const CCW_HOME = mkdtempSync(join(tmpdir(), 'ccw-litellm-executor-home-'));
const PROJECT_ROOT = mkdtempSync(join(tmpdir(), 'ccw-litellm-executor-project-'));
const CONFIG_DIR = join(CCW_HOME, 'config');
const CONFIG_PATH = join(CONFIG_DIR, 'litellm-api-config.json');

const originalEnv = {
  CCW_DATA_DIR: process.env.CCW_DATA_DIR,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_API_BASE: process.env.OPENAI_API_BASE,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  ANTHROPIC_API_BASE: process.env.ANTHROPIC_API_BASE,
  AZURE_API_KEY: process.env.AZURE_API_KEY,
  AZURE_API_BASE: process.env.AZURE_API_BASE,
};

process.env.CCW_DATA_DIR = CCW_HOME;

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

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const childProcess = require('child_process') as typeof import('child_process');
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

function writeConfig(config: any): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

function baseConfig(overrides: Partial<any> = {}): any {
  return {
    version: 1,
    providers: [],
    endpoints: [],
    globalCacheSettings: { enabled: true, cacheDir: '~/.ccw/cache/context', maxTotalSizeMB: 100 },
    ...overrides,
  };
}

function makeProvider(overrides: Partial<any> = {}): any {
  return {
    id: 'prov-1',
    name: 'Provider 1',
    type: 'openai',
    apiKey: 'sk-test',
    apiBase: undefined,
    enabled: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

function makeEndpoint(overrides: Partial<any> = {}): any {
  return {
    id: 'ep-1',
    name: 'Endpoint 1',
    providerId: 'prov-1',
    model: 'gpt-4o',
    description: 'test endpoint',
    cacheStrategy: { enabled: true, ttlMinutes: 60, maxSizeKB: 8, filePatterns: [] },
    enabled: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

const executorUrl = new URL('../dist/tools/litellm-executor.js', import.meta.url);
executorUrl.searchParams.set('t', String(Date.now()));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod: any;

before(async () => {
  mod = await import(executorUrl.href);
});

beforeEach(() => {
  spawnCalls.length = 0;
  spawnPlan.length = 0;
  writeConfig(baseConfig());
});

afterEach(() => {
  process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY;
  process.env.OPENAI_API_BASE = originalEnv.OPENAI_API_BASE;
  process.env.ANTHROPIC_API_KEY = originalEnv.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_BASE = originalEnv.ANTHROPIC_API_BASE;
  process.env.AZURE_API_KEY = originalEnv.AZURE_API_KEY;
  process.env.AZURE_API_BASE = originalEnv.AZURE_API_BASE;
});

after(() => {
  childProcess.spawn = originalSpawn;
  process.env.CCW_DATA_DIR = originalEnv.CCW_DATA_DIR;
  rmSync(CCW_HOME, { recursive: true, force: true });
  rmSync(PROJECT_ROOT, { recursive: true, force: true });
});

describe('litellm-executor', () => {
  it('extractPatterns returns @patterns in order', () => {
    assert.deepEqual(mod.extractPatterns('hello @src/**/*.ts and @README.md'), ['@src/**/*.ts', '@README.md']);
    assert.deepEqual(mod.extractPatterns('no patterns here'), []);
    assert.deepEqual(mod.extractPatterns('@a @b @c'), ['@a', '@b', '@c']);
  });

  it('returns Endpoint not found error without spawning', async () => {
    const res = await mod.executeLiteLLMEndpoint({
      prompt: 'hi',
      endpointId: 'missing',
      baseDir: PROJECT_ROOT,
      enableCache: false,
    });

    assert.equal(res.success, false);
    assert.equal(res.error, 'Endpoint not found: missing');
    assert.equal(res.model, '');
    assert.equal(res.provider, '');
    assert.equal(res.cacheUsed, false);
    assert.equal(spawnCalls.length, 0);
  });

  it('returns Provider not found when endpoint references missing provider', async () => {
    writeConfig(
      baseConfig({
        providers: [],
        endpoints: [makeEndpoint({ providerId: 'prov-missing' })],
      }),
    );

    const res = await mod.executeLiteLLMEndpoint({
      prompt: 'hi',
      endpointId: 'ep-1',
      baseDir: PROJECT_ROOT,
      enableCache: false,
    });

    assert.equal(res.success, false);
    assert.equal(res.error, 'Provider not found: prov-missing');
    assert.equal(res.model, '');
    assert.equal(res.provider, '');
    assert.equal(spawnCalls.length, 0);
  });

  it('returns API key not configured when resolvedApiKey is empty', async () => {
    writeConfig(
      baseConfig({
        providers: [makeProvider({ apiKey: '' })],
        endpoints: [makeEndpoint()],
      }),
    );

    const res = await mod.executeLiteLLMEndpoint({
      prompt: 'hi',
      endpointId: 'ep-1',
      baseDir: PROJECT_ROOT,
      enableCache: false,
    });

    assert.equal(res.success, false);
    assert.equal(res.error, 'API key not configured for provider: Provider 1');
    assert.equal(res.model, 'gpt-4o');
    assert.equal(res.provider, 'openai');
    assert.equal(spawnCalls.length, 0);
  });

  it('resolves ${ENV_VAR} apiKey and fails when missing', async () => {
    delete process.env.MISSING_LITELLM_KEY;

    writeConfig(
      baseConfig({
        providers: [makeProvider({ apiKey: '${MISSING_LITELLM_KEY}' })],
        endpoints: [makeEndpoint()],
      }),
    );

    const res = await mod.executeLiteLLMEndpoint({
      prompt: 'hi',
      endpointId: 'ep-1',
      baseDir: PROJECT_ROOT,
      enableCache: false,
    });

    assert.equal(res.success, false);
    assert.equal(res.error, 'API key not configured for provider: Provider 1');
    assert.equal(spawnCalls.length, 0);
  });

  it('disables caching when enableCache=false even if endpoint cacheStrategy is enabled', async () => {
    writeFileSync(join(PROJECT_ROOT, 'note.txt'), 'cached text', 'utf8');
    writeConfig(
      baseConfig({
        providers: [makeProvider()],
        endpoints: [makeEndpoint({ cacheStrategy: { enabled: true, ttlMinutes: 60, maxSizeKB: 8, filePatterns: [] } })],
      }),
    );

    spawnPlan.push({ type: 'close', code: 0, stdout: 'OK' });
    const res = await mod.executeLiteLLMEndpoint({
      prompt: 'hello @note.txt',
      endpointId: 'ep-1',
      baseDir: PROJECT_ROOT,
      cwd: PROJECT_ROOT,
      enableCache: false,
    });

    assert.equal(res.success, true);
    assert.equal(res.cacheUsed, false);
    assert.equal(spawnCalls.length, 1);
    assert.equal(String(spawnCalls[0].args.at(-1)).includes('=== FILE:'), false);
  });

  it('applies context cache when @patterns exist and caching is enabled', async () => {
    writeFileSync(join(PROJECT_ROOT, 'note.txt'), 'cached text', 'utf8');
    writeConfig(
      baseConfig({
        providers: [makeProvider()],
        endpoints: [makeEndpoint()],
      }),
    );

    spawnPlan.push({ type: 'close', code: 0, stdout: 'OK' });
    const res = await mod.executeLiteLLMEndpoint({
      prompt: 'hello @note.txt',
      endpointId: 'ep-1',
      baseDir: PROJECT_ROOT,
      cwd: PROJECT_ROOT,
      enableCache: true,
    });

    assert.equal(res.success, true);
    assert.equal(res.output, 'OK');
    assert.equal(res.cacheUsed, true);
    assert.deepEqual(res.cachedFiles, ['...']);

    assert.equal(spawnCalls.length, 1);
    const finalPrompt = String(spawnCalls[0].args.at(-1));
    assert.ok(finalPrompt.includes('=== FILE:'));
    assert.ok(finalPrompt.includes('cached text'));
    assert.ok(finalPrompt.includes('---'));
  });

  it('handles context cache validation failure and still calls LiteLLM', async () => {
    writeConfig(
      baseConfig({
        providers: [makeProvider()],
        endpoints: [makeEndpoint()],
      }),
    );

    const outputs: Array<{ type: string; data: string }> = [];
    spawnPlan.push({ type: 'close', code: 0, stdout: 'OK' });

    const res = await mod.executeLiteLLMEndpoint({
      prompt: 'hello @note.txt',
      endpointId: 'ep-1',
      baseDir: PROJECT_ROOT,
      cwd: PROJECT_ROOT,
      enableCache: true,
      includeDirs: 'not-an-array' as any,
      onOutput: (data: { type: string; data: string }) => outputs.push(data),
    });

    assert.equal(res.success, true);
    assert.equal(res.cacheUsed, false);
    assert.equal(spawnCalls.length, 1);
    assert.ok(outputs.some((o) => o.type === 'stderr' && o.data.includes('[Context cache warning:')));
  });

  it('sets provider env vars for API key and base URL', async () => {
    writeConfig(
      baseConfig({
        providers: [makeProvider({ apiKey: 'sk-test-2', apiBase: 'https://example.com/v1' })],
        endpoints: [makeEndpoint()],
      }),
    );

    spawnPlan.push({ type: 'close', code: 0, stdout: 'OK' });
    const res = await mod.executeLiteLLMEndpoint({
      prompt: 'hi',
      endpointId: 'ep-1',
      baseDir: PROJECT_ROOT,
      enableCache: false,
    });

    assert.equal(res.success, true);
    assert.equal(process.env.OPENAI_API_KEY, 'sk-test-2');
    assert.equal(process.env.OPENAI_API_BASE, 'https://example.com/v1');
  });

  it('returns success=false with model/provider context when LiteLLM call fails', async () => {
    writeConfig(
      baseConfig({
        providers: [makeProvider()],
        endpoints: [makeEndpoint({ model: 'model-x', providerId: 'prov-1' })],
      }),
    );

    spawnPlan.push({ type: 'close', code: 1, stderr: 'HTTP 503 Service Unavailable' });
    const res = await mod.executeLiteLLMEndpoint({
      prompt: 'hi',
      endpointId: 'ep-1',
      baseDir: PROJECT_ROOT,
      enableCache: false,
    });

    assert.equal(res.success, false);
    assert.equal(res.model, 'model-x');
    assert.equal(res.provider, 'openai');
    assert.ok(String(res.error).includes('HTTP 503'));
  });

  it('uses 2-minute base timeout (chat sets 2x) when Python hangs', async () => {
    writeConfig(
      baseConfig({
        providers: [makeProvider()],
        endpoints: [makeEndpoint()],
      }),
    );

    const originalSetTimeout = global.setTimeout;
    let observedDelay: number | null = null;
    (global as any).setTimeout = ((fn: any, delay: number, ...args: any[]) => {
      observedDelay = delay;
      return originalSetTimeout(fn, 0, ...args);
    }) as any;

    try {
      spawnPlan.push({ type: 'hang' });
      const res = await mod.executeLiteLLMEndpoint({
        prompt: 'hi',
        endpointId: 'ep-1',
        baseDir: PROJECT_ROOT,
        enableCache: false,
      });

      assert.equal(res.success, false);
      assert.ok(String(res.error).includes('Command timed out'));
      assert.equal(observedDelay, 240000);
      assert.equal(spawnCalls.length, 1);
      assert.ok(spawnCalls[0].proc.killCalls.includes('SIGTERM'));
    } finally {
      (global as any).setTimeout = originalSetTimeout;
    }
  });
});

