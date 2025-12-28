/**
 * Unit tests for browser-launcher utility module.
 *
 * Notes:
 * - Targets the runtime implementation shipped in `ccw/dist`.
 * - Prevents real browser launches by stubbing `child_process.spawn` used by the `open` package.
 * - Stubs `os.platform` and `path.resolve` to exercise platform-specific URL formatting.
 */

import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const os = require('node:os') as typeof import('node:os');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const childProcess = require('node:child_process') as typeof import('node:child_process');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pathModule = require('node:path') as typeof import('node:path');

const ORIGINAL_ENV = { ...process.env };

type SpawnCall = { command: string; args: string[] };

const spawnCalls: SpawnCall[] = [];
const spawnPlan: Array<{ type: 'return' } | { type: 'throw'; error: Error }> = [];

const originalPlatform = os.platform;
const originalSpawn = childProcess.spawn;
const originalResolve = pathModule.resolve;

let platformValue: NodeJS.Platform = originalPlatform();
let resolveImpl = (...args: string[]) => originalResolve(...args);

os.platform = (() => platformValue) as any;
pathModule.resolve = ((...args: string[]) => resolveImpl(...args)) as any;

childProcess.spawn = ((command: string, args: string[] = []) => {
  spawnCalls.push({ command: String(command), args: args.map(String) });

  const next = spawnPlan.shift();
  if (next?.type === 'throw') {
    throw next.error;
  }

  return { unref() {} } as any;
}) as any;

const browserLauncherUrl = new URL('../dist/utils/browser-launcher.js', import.meta.url).href;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod: any;

function extractOpenTargets(): string[] {
  const targets: string[] = [];

  for (const call of spawnCalls) {
    const encodedIndex = call.args.indexOf('-EncodedCommand');
    if (encodedIndex !== -1) {
      const base64 = call.args[encodedIndex + 1];
      if (!base64) continue;

      const decoded = Buffer.from(base64, 'base64').toString('utf16le');
      const match = decoded.match(/Start\\s+\"([^\"]+)\"/);
      targets.push(match?.[1] ?? decoded);
      continue;
    }

    targets.push([call.command, ...call.args].join(' '));
  }

  return targets;
}

function normalizedTargets(): string[] {
  return extractOpenTargets().map((t) => t.replace(/\\/g, '/'));
}

beforeEach(() => {
  spawnCalls.length = 0;
  spawnPlan.length = 0;

  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    process.env[key] = value;
  }

  platformValue = originalPlatform();
  resolveImpl = (...args: string[]) => originalResolve(...args);
});

describe('browser-launcher utility module', async () => {
  mod = await import(browserLauncherUrl);

  it('launchBrowser opens HTTP/HTTPS URLs', async () => {
    await mod.launchBrowser('http://example.com');
    await mod.launchBrowser('https://example.com');

    const targets = normalizedTargets().join('\n');
    assert.ok(targets.includes('http://example.com'));
    assert.ok(targets.includes('https://example.com'));
  });

  it('launchBrowser converts file path to file:// URL (Windows)', async () => {
    platformValue = 'win32';
    resolveImpl = () => 'C:\\tmp\\file.html';

    await mod.launchBrowser('file.html');
    assert.ok(normalizedTargets().join('\n').includes('file:///C:/tmp/file.html'));
  });

  it('launchBrowser converts file path to file:// URL (Unix)', async () => {
    platformValue = 'linux';
    resolveImpl = () => '/tmp/file.html';

    await mod.launchBrowser('file.html');
    assert.ok(normalizedTargets().join('\n').includes('file:///tmp/file.html'));
  });

  it('isHeadlessEnvironment detects common CI env vars', () => {
    for (const key of ['CI', 'CONTINUOUS_INTEGRATION', 'GITHUB_ACTIONS', 'GITLAB_CI', 'JENKINS_URL']) {
      delete process.env[key];
    }
    assert.equal(mod.isHeadlessEnvironment(), false);

    process.env.CI = '1';
    assert.equal(mod.isHeadlessEnvironment(), true);

    delete process.env.CI;
    process.env.GITHUB_ACTIONS = 'true';
    assert.equal(mod.isHeadlessEnvironment(), true);
  });

  it('wraps browser launch errors for URLs', async () => {
    spawnPlan.push({ type: 'throw', error: new Error('boom') });
    await assert.rejects(
      mod.launchBrowser('https://example.com'),
      (err: any) => err instanceof Error && err.message.includes('Failed to open browser: boom'),
    );
  });

  it('falls back to opening file path directly when URL open fails', async () => {
    platformValue = 'win32';
    resolveImpl = () => 'C:\\tmp\\file.html';
    spawnPlan.push({ type: 'throw', error: new Error('primary fail') });
    spawnPlan.push({ type: 'return' });

    await mod.launchBrowser('file.html');
    const targets = normalizedTargets().join('\n');
    assert.ok(targets.includes('file:///C:/tmp/file.html'));
    assert.ok(targets.includes('C:/tmp/file.html'));
  });

  it('throws when both primary and fallback file opens fail', async () => {
    platformValue = 'win32';
    resolveImpl = () => 'C:\\tmp\\file.html';
    spawnPlan.push({ type: 'throw', error: new Error('primary fail') });
    spawnPlan.push({ type: 'throw', error: new Error('fallback fail') });

    await assert.rejects(
      mod.launchBrowser('file.html'),
      (err: any) =>
        err instanceof Error && err.message.includes('Failed to open browser: primary fail'),
    );
  });
});

after(() => {
  os.platform = originalPlatform;
  childProcess.spawn = originalSpawn;
  pathModule.resolve = originalResolve;

  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    process.env[key] = value;
  }
});
