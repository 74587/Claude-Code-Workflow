/**
 * Integration tests for LiteLLM retry/rate limiting behavior (ccw/dist/tools/litellm-executor.js).
 *
 * Notes:
 * - Targets runtime implementation shipped in `ccw/dist`.
 * - Uses a temporary CCW data directory (CCW_DATA_DIR) to isolate config writes.
 * - Stubs `child_process.spawn` to prevent real Python/ccw_litellm execution.
 */

import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CCW_HOME = mkdtempSync(join(tmpdir(), 'ccw-litellm-integration-home-'));
const PROJECT_ROOT = mkdtempSync(join(tmpdir(), 'ccw-litellm-integration-project-'));
const CONFIG_DIR = join(CCW_HOME, 'config');
const CONFIG_PATH = join(CONFIG_DIR, 'litellm-api-config.json');

const originalEnv = {
  CCW_DATA_DIR: process.env.CCW_DATA_DIR,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_API_BASE: process.env.OPENAI_API_BASE,
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
  atMs: number;
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
  spawnCalls.push({ atMs: performance.now(), command: String(command), args: normalizedArgs, options, proc });

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

    // hang: intentionally do nothing (timeout tests)
  });

  return proc as any;
}) as any;

function writeDefaultConfig(): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(
    CONFIG_PATH,
    JSON.stringify(
      {
        version: 1,
        providers: [
          {
            id: 'prov-1',
            name: 'Provider 1',
            type: 'openai',
            apiKey: 'sk-test',
            apiBase: undefined,
            enabled: true,
            createdAt: new Date(0).toISOString(),
            updatedAt: new Date(0).toISOString(),
          },
        ],
        endpoints: [
          {
            id: 'ep-1',
            name: 'Endpoint 1',
            providerId: 'prov-1',
            model: 'gpt-4o',
            cacheStrategy: { enabled: false, ttlMinutes: 60, maxSizeKB: 8, filePatterns: [] },
            enabled: true,
            createdAt: new Date(0).toISOString(),
            updatedAt: new Date(0).toISOString(),
          },
        ],
        globalCacheSettings: { enabled: true, cacheDir: '~/.ccw/cache/context', maxTotalSizeMB: 100 },
      },
      null,
      2,
    ),
    'utf8',
  );
}

async function importExecutorModule(): Promise<any> {
  const url = new URL('../dist/tools/litellm-executor.js', import.meta.url);
  url.searchParams.set('t', `${Date.now()}-${Math.random()}`);
  return import(url.href);
}

function assertWithinPercent(actualMs: number, expectedMs: number, percent: number): void {
  const min = expectedMs * (1 - percent);
  const max = expectedMs * (1 + percent);
  assert.ok(
    actualMs >= min && actualMs <= max,
    `Expected ${actualMs.toFixed(1)}ms to be within ${(percent * 100).toFixed(0)}% of ${expectedMs}ms`,
  );
}

beforeEach(() => {
  spawnCalls.length = 0;
  spawnPlan.length = 0;
  writeDefaultConfig();
  process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY;
  process.env.OPENAI_API_BASE = originalEnv.OPENAI_API_BASE;
});

after(() => {
  childProcess.spawn = originalSpawn;
  process.env.CCW_DATA_DIR = originalEnv.CCW_DATA_DIR;
  process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY;
  process.env.OPENAI_API_BASE = originalEnv.OPENAI_API_BASE;
  rmSync(CCW_HOME, { recursive: true, force: true });
  rmSync(PROJECT_ROOT, { recursive: true, force: true });
});

describe('LiteLLM retry/rate limiting integration', () => {
  it('retries transient 503 failures and eventually succeeds', async () => {
    const mod = await importExecutorModule();
    spawnPlan.push({ type: 'close', code: 1, stderr: 'HTTP 503 Service Unavailable' });
    spawnPlan.push({ type: 'close', code: 0, stdout: 'OK' });

    const res = await mod.executeLiteLLMEndpoint({
      prompt: 'hi',
      endpointId: 'ep-1',
      baseDir: PROJECT_ROOT,
      enableCache: false,
      maxRetries: 1,
      retryBaseDelayMs: 10,
    });

    assert.equal(res.success, true);
    assert.equal(res.output, 'OK');
    assert.equal(spawnCalls.length, 2);
  });

  it('uses exponential backoff for 503 retries (±20%)', async () => {
    const mod = await importExecutorModule();
    spawnPlan.push({ type: 'close', code: 1, stderr: 'HTTP 503 Service Unavailable' });
    spawnPlan.push({ type: 'close', code: 1, stderr: 'HTTP 503 Service Unavailable' });
    spawnPlan.push({ type: 'close', code: 1, stderr: 'HTTP 503 Service Unavailable' });
    spawnPlan.push({ type: 'close', code: 0, stdout: 'OK' });

    const base = 100;
    const res = await mod.executeLiteLLMEndpoint({
      prompt: 'hi',
      endpointId: 'ep-1',
      baseDir: PROJECT_ROOT,
      enableCache: false,
      maxRetries: 3,
      retryBaseDelayMs: base,
    });

    assert.equal(res.success, true);
    assert.equal(spawnCalls.length, 4);

    const d1 = spawnCalls[1].atMs - spawnCalls[0].atMs;
    const d2 = spawnCalls[2].atMs - spawnCalls[1].atMs;
    const d3 = spawnCalls[3].atMs - spawnCalls[2].atMs;
    assertWithinPercent(d1, base, 0.2);
    assertWithinPercent(d2, base * 2, 0.2);
    assertWithinPercent(d3, base * 4, 0.2);
  });

  it('does not retry auth errors (401)', async () => {
    const mod = await importExecutorModule();
    spawnPlan.push({ type: 'close', code: 1, stderr: 'HTTP 401 Unauthorized' });

    const res = await mod.executeLiteLLMEndpoint({
      prompt: 'hi',
      endpointId: 'ep-1',
      baseDir: PROJECT_ROOT,
      enableCache: false,
      maxRetries: 3,
      retryBaseDelayMs: 10,
    });

    assert.equal(res.success, false);
    assert.ok(String(res.error).includes('401'));
    assert.equal(spawnCalls.length, 1);
  });

  it('does not retry auth errors (403)', async () => {
    const mod = await importExecutorModule();
    spawnPlan.push({ type: 'close', code: 1, stderr: 'HTTP 403 Forbidden' });

    const res = await mod.executeLiteLLMEndpoint({
      prompt: 'hi',
      endpointId: 'ep-1',
      baseDir: PROJECT_ROOT,
      enableCache: false,
      maxRetries: 3,
      retryBaseDelayMs: 10,
    });

    assert.equal(res.success, false);
    assert.ok(String(res.error).includes('403'));
    assert.equal(spawnCalls.length, 1);
  });

  it('retries spawn errors (network) and succeeds', async () => {
    const mod = await importExecutorModule();
    spawnPlan.push({ type: 'error', error: new Error('socket hang up') });
    spawnPlan.push({ type: 'close', code: 0, stdout: 'OK' });

    const res = await mod.executeLiteLLMEndpoint({
      prompt: 'hi',
      endpointId: 'ep-1',
      baseDir: PROJECT_ROOT,
      enableCache: false,
      maxRetries: 1,
      retryBaseDelayMs: 10,
    });

    assert.equal(res.success, true);
    assert.equal(res.output, 'OK');
    assert.equal(spawnCalls.length, 2);
  });

  it('fails after retry exhaustion for persistent 503 errors', async () => {
    const mod = await importExecutorModule();
    spawnPlan.push({ type: 'close', code: 1, stderr: 'HTTP 503 Service Unavailable' });
    spawnPlan.push({ type: 'close', code: 1, stderr: 'HTTP 503 Service Unavailable' });
    spawnPlan.push({ type: 'close', code: 1, stderr: 'HTTP 503 Service Unavailable' });

    const res = await mod.executeLiteLLMEndpoint({
      prompt: 'hi',
      endpointId: 'ep-1',
      baseDir: PROJECT_ROOT,
      enableCache: false,
      maxRetries: 2,
      retryBaseDelayMs: 10,
    });

    assert.equal(res.success, false);
    assert.ok(String(res.error).includes('503'));
    assert.equal(spawnCalls.length, 3);
  });

  it('queues 429 retries across concurrent requests (>=5 parallel)', async () => {
    const mod = await importExecutorModule();
    const base = 50;
    for (let i = 0; i < 5; i++) {
      spawnPlan.push({ type: 'close', code: 1, stderr: 'HTTP 429 Too Many Requests' });
    }
    for (let i = 0; i < 5; i++) {
      spawnPlan.push({ type: 'close', code: 0, stdout: 'OK' });
    }

    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        mod.executeLiteLLMEndpoint({
          prompt: `req-${i + 1}`,
          endpointId: 'ep-1',
          baseDir: PROJECT_ROOT,
          enableCache: false,
          maxRetries: 1,
          retryBaseDelayMs: base,
        }),
      ),
    );

    assert.equal(results.every((r: any) => r.success === true), true);
    assert.equal(spawnCalls.length, 10);

    // Validate that retry attempts are not all immediate (basic queueing check).
    const secondAttemptTimes: number[] = [];
    for (let i = 0; i < 5; i++) {
      const prompt = `req-${i + 1}`;
      const calls = spawnCalls.filter((c) => c.args.at(-1) === prompt);
      assert.equal(calls.length, 2);
      secondAttemptTimes.push(calls[1].atMs);
    }

    secondAttemptTimes.sort((a, b) => a - b);
    for (let i = 1; i < secondAttemptTimes.length; i++) {
      const delta = secondAttemptTimes[i] - secondAttemptTimes[i - 1];
      assert.ok(delta >= base * 0.8, `Expected queued retries; observed delta ${delta.toFixed(1)}ms`);
    }
  });

  it('uses exponential backoff for 429 retries (±20%)', async () => {
    const mod = await importExecutorModule();
    spawnPlan.push({ type: 'close', code: 1, stderr: 'HTTP 429 Too Many Requests' });
    spawnPlan.push({ type: 'close', code: 1, stderr: 'HTTP 429 Too Many Requests' });
    spawnPlan.push({ type: 'close', code: 1, stderr: 'HTTP 429 Too Many Requests' });
    spawnPlan.push({ type: 'close', code: 0, stdout: 'OK' });

    const base = 100;
    const res = await mod.executeLiteLLMEndpoint({
      prompt: 'hi',
      endpointId: 'ep-1',
      baseDir: PROJECT_ROOT,
      enableCache: false,
      maxRetries: 3,
      retryBaseDelayMs: base,
    });

    assert.equal(res.success, true);
    assert.equal(spawnCalls.length, 4);

    const d1 = spawnCalls[1].atMs - spawnCalls[0].atMs;
    const d2 = spawnCalls[2].atMs - spawnCalls[1].atMs;
    const d3 = spawnCalls[3].atMs - spawnCalls[2].atMs;
    assertWithinPercent(d1, base, 0.2);
    assertWithinPercent(d2, base * 2, 0.2);
    assertWithinPercent(d3, base * 4, 0.2);
  });

  it('fails after exhausting 429 retries (3+ retries before failure)', async () => {
    const mod = await importExecutorModule();
    spawnPlan.push({ type: 'close', code: 1, stderr: 'HTTP 429 Too Many Requests' });
    spawnPlan.push({ type: 'close', code: 1, stderr: 'HTTP 429 Too Many Requests' });
    spawnPlan.push({ type: 'close', code: 1, stderr: 'HTTP 429 Too Many Requests' });
    spawnPlan.push({ type: 'close', code: 1, stderr: 'HTTP 429 Too Many Requests' });

    const res = await mod.executeLiteLLMEndpoint({
      prompt: 'hi',
      endpointId: 'ep-1',
      baseDir: PROJECT_ROOT,
      enableCache: false,
      maxRetries: 3,
      retryBaseDelayMs: 10,
    });

    assert.equal(res.success, false);
    assert.ok(String(res.error).includes('429'));
    assert.equal(spawnCalls.length, 4);
  });

  it('applies timeout per attempt (not cumulative) when retrying', async () => {
    const mod = await importExecutorModule();

    const originalSetTimeout = global.setTimeout;
    const timeoutDelays: number[] = [];
    (global as any).setTimeout = ((fn: any, delay: number, ...args: any[]) => {
      if (delay === 240000) {
        timeoutDelays.push(delay);
        return originalSetTimeout(fn, 0, ...args);
      }
      return originalSetTimeout(fn, delay, ...args);
    }) as any;

    try {
      spawnPlan.push({ type: 'hang' });
      spawnPlan.push({ type: 'hang' });
      spawnPlan.push({ type: 'hang' });

      const res = await mod.executeLiteLLMEndpoint({
        prompt: 'hi',
        endpointId: 'ep-1',
        baseDir: PROJECT_ROOT,
        enableCache: false,
        maxRetries: 2,
        retryBaseDelayMs: 0,
      });

      assert.equal(res.success, false);
      assert.ok(String(res.error).includes('Command timed out'));
      assert.equal(spawnCalls.length, 3);
      assert.equal(timeoutDelays.length, 3);
      assert.equal(spawnCalls.every((c) => c.proc.killCalls.includes('SIGTERM')), true);
    } finally {
      (global as any).setTimeout = originalSetTimeout;
    }
  });

  it('defaults to no retries when maxRetries is omitted', async () => {
    const mod = await importExecutorModule();
    spawnPlan.push({ type: 'close', code: 1, stderr: 'HTTP 503 Service Unavailable' });

    const res = await mod.executeLiteLLMEndpoint({
      prompt: 'hi',
      endpointId: 'ep-1',
      baseDir: PROJECT_ROOT,
      enableCache: false,
    });

    assert.equal(res.success, false);
    assert.equal(spawnCalls.length, 1);
  });
});
