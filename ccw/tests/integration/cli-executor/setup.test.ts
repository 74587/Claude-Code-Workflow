/**
 * Integration test infrastructure for cli-executor.
 *
 * Notes:
 * - Verifies mock project generation and stub CLI endpoint wiring.
 * - Uses a temporary CCW data directory (CCW_DATA_DIR) to isolate config writes.
 */

import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  closeCliHistoryStores,
  createTestEndpoint,
  setupTestEnv,
  setupTestProject,
  snapshotEnv,
  restoreEnv,
} from './setup.ts';

function countFiles(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      total += countFiles(p);
    } else if (entry.isFile()) {
      total += 1;
    } else if (entry.isSymbolicLink()) {
      try {
        if (statSync(p).isFile()) total += 1;
      } catch {
        // ignore broken links
      }
    }
  }
  return total;
}

describe('cli-executor integration: test infrastructure', () => {
  after(async () => {
    await closeCliHistoryStores();
  });

  it('setupTestProject creates a mock project with 10+ files', () => {
    const project = setupTestProject();
    try {
      assert.equal(existsSync(project.projectDir), true);
      assert.equal(existsSync(project.sharedDir), true);
      assert.ok(project.sampleFiles.length >= 10);
      assert.ok(countFiles(project.projectDir) >= 10);
    } finally {
      project.cleanup();
    }
  });

  it('createTestEndpoint writes tool command shim files', () => {
    const env = setupTestEnv(['gemini']);
    try {
      const ep = createTestEndpoint('gemini', { binDir: env.binDir });
      assert.equal(existsSync(ep.commandPath), true);
    } finally {
      env.restore();
      env.cleanup();
    }
  });

  it('setupTestEnv isolates CCW_DATA_DIR and can be cleaned up', async () => {
    const pathKey = Object.keys(process.env).find((k) => k.toLowerCase() === 'path') || 'Path';
    const snap = snapshotEnv(['CCW_DATA_DIR', pathKey]);

    const env = setupTestEnv(['gemini', 'qwen', 'codex']);
    try {
      assert.equal(process.env.CCW_DATA_DIR, env.ccwHome);
      const pathVal = process.env[pathKey] || '';
      assert.ok(pathVal.startsWith(env.binDir));
      assert.equal(existsSync(env.ccwHome), true);
      assert.equal(existsSync(env.binDir), true);
    } finally {
      await closeCliHistoryStores();
      env.restore();
      env.cleanup();
      restoreEnv(snap);
    }

    assert.equal(process.env.CCW_DATA_DIR, snap.CCW_DATA_DIR);
    assert.equal(process.env[pathKey], snap[pathKey]);
    rmSync(env.ccwHome, { recursive: true, force: true });
    rmSync(env.binDir, { recursive: true, force: true });
  });
});
