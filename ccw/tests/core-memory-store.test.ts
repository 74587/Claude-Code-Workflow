/**
 * Unit tests for CoreMemoryStore (core memory persistence + clustering helpers).
 *
 * Notes:
 * - Targets the runtime implementation shipped in `ccw/dist`.
 * - Uses a real temporary CCW data directory to avoid touching user state.
 * - Exercises SQLite-backed CRUD behavior (better-sqlite3) in an isolated temp dir.
 */

import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TEST_CCW_HOME = mkdtempSync(join(tmpdir(), 'ccw-core-memory-store-home-'));
const TEST_PROJECT_ROOT = mkdtempSync(join(tmpdir(), 'ccw-core-memory-store-project-'));

const coreMemoryStoreUrl = new URL('../dist/core/core-memory-store.js', import.meta.url);
coreMemoryStoreUrl.searchParams.set('t', String(Date.now()));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod: any;

const originalEnv = { CCW_DATA_DIR: process.env.CCW_DATA_DIR };

function resetDir(dirPath: string): void {
  if (existsSync(dirPath)) {
    rmSync(dirPath, { recursive: true, force: true });
  }
  mkdirSync(dirPath, { recursive: true });
}

describe('CoreMemoryStore', async () => {
  before(async () => {
    process.env.CCW_DATA_DIR = TEST_CCW_HOME;
    mod = await import(coreMemoryStoreUrl.href);
  });

  beforeEach(() => {
    process.env.CCW_DATA_DIR = TEST_CCW_HOME;
    mock.method(console, 'warn', () => {});

    try {
      mod?.closeAllStores?.();
    } catch {
      // ignore
    }

    resetDir(TEST_CCW_HOME);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  after(() => {
    try {
      mod?.closeAllStores?.();
    } catch {
      // ignore
    }
    process.env.CCW_DATA_DIR = originalEnv.CCW_DATA_DIR;
    rmSync(TEST_CCW_HOME, { recursive: true, force: true });
    rmSync(TEST_PROJECT_ROOT, { recursive: true, force: true });
  });

  it('upserts, lists, archives, and deletes memories', () => {
    const store = mod.getCoreMemoryStore(TEST_PROJECT_ROOT);

    const created = store.upsertMemory({
      id: 'CMEM-TEST-1',
      content: 'Hello world',
      summary: 'Greeting',
    });
    assert.equal(created.id, 'CMEM-TEST-1');
    assert.equal(created.content, 'Hello world');
    assert.equal(created.archived, false);

    assert.equal(store.getMemory('CMEM-MISSING'), null);

    const fetched = store.getMemory('CMEM-TEST-1');
    assert.ok(fetched);
    assert.equal(fetched?.summary, 'Greeting');

    // Default listing excludes archived
    const active = store.getMemories({ limit: 10 });
    assert.equal(active.length, 1);
    assert.equal(active[0].id, 'CMEM-TEST-1');

    // Update existing record (including archived flag)
    const updated = store.upsertMemory({
      id: 'CMEM-TEST-1',
      content: 'Hello updated',
      archived: true,
      metadata: JSON.stringify({ source: 'test' }),
    });
    assert.equal(updated.content, 'Hello updated');
    assert.equal(updated.archived, true);
    assert.equal(updated.metadata, JSON.stringify({ source: 'test' }));

    assert.equal(store.getMemories({ limit: 10 }).length, 0);
    assert.equal(store.getMemories({ archived: true, limit: 10 }).length, 1);

    // Delete should remove the record (no throw for missing ids)
    store.deleteMemory('CMEM-TEST-1');
    assert.equal(store.getMemory('CMEM-TEST-1'), null);
    store.deleteMemory('CMEM-TEST-1');
  });

  it('lists projects with memory/cluster counts', () => {
    const store = mod.getCoreMemoryStore(TEST_PROJECT_ROOT);
    store.upsertMemory({ id: 'CMEM-TEST-2', content: 'Project memory' });

    const cluster = store.createCluster({ name: 'Cluster A' });
    assert.ok(cluster);

    const projects = mod.listAllProjects();
    assert.equal(projects.length, 1);
    assert.equal(projects[0].memoriesCount, 1);
    assert.equal(projects[0].clustersCount, 1);
    assert.ok(typeof projects[0].id === 'string' && projects[0].id.length > 0);
  });

  it('manages cluster membership and session metadata cache', () => {
    const store = mod.getCoreMemoryStore(TEST_PROJECT_ROOT);

    const meta1 = store.upsertSessionMetadata({
      session_id: 'WFS-TEST-1',
      session_type: 'workflow',
      title: 'Auth flow',
      summary: 'JWT + refresh',
      keywords: ['auth', 'jwt'],
      token_estimate: 42,
      file_patterns: ['src/auth/**'],
    });
    assert.ok(meta1);
    assert.equal(meta1?.access_count, 1);

    const meta2 = store.upsertSessionMetadata({
      session_id: 'WFS-TEST-1',
      session_type: 'workflow',
      title: 'Auth flow (updated)',
      keywords: ['auth', 'jwt', 'refresh'],
    });
    assert.ok(meta2);
    assert.equal(meta2?.access_count, 2);

    const matches = store.searchSessionsByKeyword('auth');
    assert.equal(matches.length, 1);
    assert.equal(matches[0].session_id, 'WFS-TEST-1');

    const cluster = store.createCluster({ name: 'Cluster B', description: 'Testing clusters' });
    assert.ok(cluster);

    const activeClusters = store.listClusters('active');
    assert.ok(activeClusters.some((c: any) => c.id === cluster.id));
    assert.equal(store.listClusters('archived').length, 0);

    store.addClusterMember({
      cluster_id: cluster.id,
      session_id: 'WFS-TEST-1',
      session_type: 'workflow',
      sequence_order: 1,
      relevance_score: 1.0,
    });

    const sessionClusters = store.getSessionClusters('WFS-TEST-1');
    assert.equal(sessionClusters.length, 1);
    assert.equal(sessionClusters[0].id, cluster.id);

    assert.equal(store.removeClusterMember(cluster.id, 'WFS-TEST-1'), true);
    assert.equal(store.getSessionClusters('WFS-TEST-1').length, 0);
  });

  it('throws clear errors for invalid cross-project access', () => {
    assert.throws(
      () => mod.getMemoriesFromProject('missing-project-id'),
      (err: any) => err instanceof Error && err.message.includes('Project not found'),
    );

    assert.equal(mod.findMemoryAcrossProjects('CMEM-NOT-THERE'), null);
  });
});
