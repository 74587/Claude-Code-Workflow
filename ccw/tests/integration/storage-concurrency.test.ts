/**
 * Integration tests for CCW storage manager concurrency.
 *
 * Notes:
 * - Targets runtime implementations shipped in `ccw/dist`.
 * - Uses a temporary CCW data directory (CCW_DATA_DIR) to isolate databases/files.
 * - Uses Promise.all() to simulate high-concurrency access patterns.
 */

import { after, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';

const CCW_HOME = mkdtempSync(join(tmpdir(), 'ccw-storage-concurrency-home-'));

const memoryStoreUrl = new URL('../../dist/core/memory-store.js', import.meta.url);
memoryStoreUrl.searchParams.set('t', String(Date.now()));

const coreMemoryStoreUrl = new URL('../../dist/core/core-memory-store.js', import.meta.url);
coreMemoryStoreUrl.searchParams.set('t', String(Date.now()));

const storagePathsUrl = new URL('../../dist/config/storage-paths.js', import.meta.url);
storagePathsUrl.searchParams.set('t', String(Date.now()));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let memoryMod: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let coreMod: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pathsMod: any;

const originalEnv = { CCW_DATA_DIR: process.env.CCW_DATA_DIR };

function resetDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

function createProjectRoot(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function tick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function makeEntity(type: string, value: string, timestamp: string): any {
  return {
    type,
    value,
    normalized_value: value.toLowerCase(),
    first_seen_at: timestamp,
    last_seen_at: timestamp,
    metadata: null,
  };
}

describe('storage concurrency integration (MemoryStore/CoreMemoryStore)', async () => {
  before(async () => {
    process.env.CCW_DATA_DIR = CCW_HOME;
    mock.method(console, 'log', () => {});
    mock.method(console, 'warn', () => {});
    mock.method(console, 'error', () => {});

    pathsMod = await import(storagePathsUrl.href);
    memoryMod = await import(memoryStoreUrl.href);
    coreMod = await import(coreMemoryStoreUrl.href);
  });

  beforeEach(() => {
    process.env.CCW_DATA_DIR = CCW_HOME;

    try {
      memoryMod?.closeAllStores?.();
    } catch {
      // ignore
    }
    try {
      coreMod?.closeAllStores?.();
    } catch {
      // ignore
    }
    try {
      pathsMod?.clearHierarchyCache?.();
    } catch {
      // ignore
    }

    resetDir(CCW_HOME);
  });

  after(() => {
    try {
      memoryMod?.closeAllStores?.();
    } catch {
      // ignore
    }
    try {
      coreMod?.closeAllStores?.();
    } catch {
      // ignore
    }

    mock.restoreAll();
    process.env.CCW_DATA_DIR = originalEnv.CCW_DATA_DIR;
    rmSync(CCW_HOME, { recursive: true, force: true });
  });

  describe('MemoryStore concurrency', () => {
    it('enables WAL mode for memory.db', () => {
      const projectRoot = createProjectRoot('ccw-storage-concurrency-memory-wal-');
      try {
        memoryMod.getMemoryStore(projectRoot);
        const paths = pathsMod.getProjectPaths(projectRoot);
        const db = new Database(paths.memoryDb, { readonly: true });
        try {
          const mode = String(db.pragma('journal_mode', { simple: true })).toLowerCase();
          assert.equal(mode, 'wal');
        } finally {
          db.close();
        }
      } finally {
        rmSync(projectRoot, { recursive: true, force: true });
      }
    });

    it('handles 50+ concurrent upserts for distinct entities', async () => {
      const projectRoot = createProjectRoot('ccw-storage-concurrency-memory-upserts-');
      try {
        const store = memoryMod.getMemoryStore(projectRoot);
        const timestamp = new Date().toISOString();

        const ids = await Promise.all(
          Array.from({ length: 60 }, async (_, i) => {
            await tick();
            const id = store.upsertEntity(makeEntity('file', `file-${i}.ts`, timestamp));
            await tick();
            return id;
          }),
        );

        assert.equal(ids.length, 60);
        assert.equal(new Set(ids).size, 60);

        const db = (store as any).db as Database.Database;
        const countRow = db.prepare('SELECT COUNT(*) as count FROM entities').get() as { count: number };
        assert.equal(countRow.count, 60);
      } finally {
        rmSync(projectRoot, { recursive: true, force: true });
      }
    });

    it('deduplicates concurrent upserts for the same entity', async () => {
      const projectRoot = createProjectRoot('ccw-storage-concurrency-memory-upsert-same-');
      try {
        const store = memoryMod.getMemoryStore(projectRoot);
        const timestamp = new Date().toISOString();
        const entity = makeEntity('file', 'README.md', timestamp);

        const ids = await Promise.all(
          Array.from({ length: 50 }, async () => {
            await tick();
            const id = store.upsertEntity(entity);
            await tick();
            return id;
          }),
        );

        assert.equal(new Set(ids).size, 1);

        const db = (store as any).db as Database.Database;
        const countRow = db.prepare('SELECT COUNT(*) as count FROM entities').get() as { count: number };
        assert.equal(countRow.count, 1);
      } finally {
        rmSync(projectRoot, { recursive: true, force: true });
      }
    });

    it('handles 100+ concurrent access log writes and stats updates', async () => {
      const projectRoot = createProjectRoot('ccw-storage-concurrency-memory-access-');
      try {
        const store = memoryMod.getMemoryStore(projectRoot);
        const timestamp = new Date().toISOString();
        const entityId = store.upsertEntity(makeEntity('file', 'src/index.ts', timestamp));

        const writes = 120;
        await Promise.all(
          Array.from({ length: writes }, async (_, i) => {
            await tick();
            store.logAccess({
              entity_id: entityId,
              action: 'read',
              session_id: `S-${i}`,
              timestamp: new Date().toISOString(),
              context_summary: 'concurrency',
            });
            store.updateStats(entityId, 'read');
            await tick();
          }),
        );

        const db = (store as any).db as Database.Database;
        const row = db
          .prepare('SELECT COUNT(*) as count FROM access_logs WHERE entity_id = ?')
          .get(entityId) as { count: number };
        assert.equal(row.count, writes);

        const stats = store.getStats(entityId);
        assert.ok(stats);
        assert.equal(stats?.read_count, writes);
      } finally {
        rmSync(projectRoot, { recursive: true, force: true });
      }
    });

    it('maintains accurate stats under 200+ concurrent updateStats operations', async () => {
      const projectRoot = createProjectRoot('ccw-storage-concurrency-memory-stats-');
      try {
        const store = memoryMod.getMemoryStore(projectRoot);
        const entityId = store.upsertEntity(makeEntity('file', 'src/app.ts', new Date().toISOString()));

        const actions: Array<'read' | 'write' | 'mention'> = ['read', 'write', 'mention'];
        const expected = { read: 0, write: 0, mention: 0 };
        const ops = 210;

        await Promise.all(
          Array.from({ length: ops }, async (_, i) => {
            const action = actions[i % actions.length];
            expected[action] += 1;
            await tick();
            store.updateStats(entityId, action);
            await tick();
          }),
        );

        const stats = store.getStats(entityId);
        assert.ok(stats);
        assert.equal(stats?.read_count, expected.read);
        assert.equal(stats?.write_count, expected.write);
        assert.equal(stats?.mention_count, expected.mention);
      } finally {
        rmSync(projectRoot, { recursive: true, force: true });
      }
    });

    it('supports 200+ mixed read/write operations without BUSY errors', async () => {
      const projectRoot = createProjectRoot('ccw-storage-concurrency-memory-mixed-');
      try {
        const store = memoryMod.getMemoryStore(projectRoot);
        const baseEntityId = store.upsertEntity(makeEntity('file', 'src/base.ts', new Date().toISOString()));

        const operations = 240;
        await Promise.all(
          Array.from({ length: operations }, async (_, i) => {
            await tick();
            if (i % 4 === 0) {
              const id = store.upsertEntity(
                makeEntity('file', `src/concurrent-${i}.ts`, new Date().toISOString()),
              );
              store.updateStats(id, 'write');
            } else if (i % 4 === 1) {
              store.getEntityById(baseEntityId);
            } else if (i % 4 === 2) {
              store.logAccess({
                entity_id: baseEntityId,
                action: 'mention',
                session_id: `M-${i}`,
                timestamp: new Date().toISOString(),
                context_summary: 'mixed',
              });
              store.updateStats(baseEntityId, 'mention');
            } else {
              store.calculateHeatScore(baseEntityId);
            }
            await tick();
          }),
        );

        const stats = store.getStats(baseEntityId);
        assert.ok(stats);
        assert.ok((stats?.mention_count || 0) > 0);
      } finally {
        rmSync(projectRoot, { recursive: true, force: true });
      }
    });

    it('rolls back better-sqlite3 transactions on error (no partial commits)', () => {
      const projectRoot = createProjectRoot('ccw-storage-concurrency-memory-rollback-');
      try {
        const store = memoryMod.getMemoryStore(projectRoot);
        const db = (store as any).db as Database.Database;

        const baseline = db.prepare('SELECT COUNT(*) as count FROM entities').get() as { count: number };

        const insert = db.prepare(
          'INSERT INTO entities (type, value, normalized_value, first_seen_at, last_seen_at, metadata) VALUES (?, ?, ?, ?, ?, ?)',
        );

        const now = new Date().toISOString();
        const tx = db.transaction(() => {
          insert.run('file', 'ok', 'ok', now, now, null);
          // Violates NOT NULL constraint on "type"
          insert.run(null as any, 'bad', 'bad', now, now, null);
        });

        assert.throws(() => tx(), /NOT NULL|SQLITE_CONSTRAINT/i);

        const afterCount = db.prepare('SELECT COUNT(*) as count FROM entities').get() as { count: number };
        assert.equal(afterCount.count, baseline.count);
      } finally {
        rmSync(projectRoot, { recursive: true, force: true });
      }
    });

    it('keeps calculateHeatScore consistent under concurrent calls', async () => {
      const projectRoot = createProjectRoot('ccw-storage-concurrency-memory-heat-');
      const originalNow = Date.now;
      const fixedNow = Date.now();
      try {
        Date.now = () => fixedNow;
        const store = memoryMod.getMemoryStore(projectRoot);
        const iso = new Date(fixedNow).toISOString();
        const entityId = store.upsertEntity(makeEntity('file', 'src/heat.ts', iso));

        const logs = 20;
        for (let i = 0; i < logs; i += 1) {
          store.logAccess({
            entity_id: entityId,
            action: 'read',
            session_id: `H-${i}`,
            timestamp: iso,
            context_summary: 'heat',
          });
          store.updateStats(entityId, 'read');
        }

        const expected = logs * 1 + logs * 5;
        const results = await Promise.all(
          Array.from({ length: 40 }, async () => {
            await tick();
            const score = store.calculateHeatScore(entityId);
            await tick();
            return score;
          }),
        );

        assert.ok(results.length > 0);
        assert.ok(results.every((r) => r === expected));
        assert.equal(store.getStats(entityId)?.heat_score, expected);
      } finally {
        Date.now = originalNow;
        rmSync(projectRoot, { recursive: true, force: true });
      }
    });
  });

  describe('CoreMemoryStore concurrency', () => {
    it('enables WAL mode for core_memory.db', () => {
      const projectRoot = createProjectRoot('ccw-storage-concurrency-core-wal-');
      try {
        coreMod.getCoreMemoryStore(projectRoot);
        const paths = pathsMod.getProjectPaths(projectRoot);
        const dbPath = join(paths.root, 'core-memory', 'core_memory.db');
        const db = new Database(dbPath, { readonly: true });
        try {
          const mode = String(db.pragma('journal_mode', { simple: true })).toLowerCase();
          assert.equal(mode, 'wal');
        } finally {
          db.close();
        }
      } finally {
        rmSync(projectRoot, { recursive: true, force: true });
      }
    });

    it('increments access_count under concurrent upsertSessionMetadata calls', async () => {
      const projectRoot = createProjectRoot('ccw-storage-concurrency-core-meta-');
      try {
        const store = coreMod.getCoreMemoryStore(projectRoot);
        const sessionId = 'WFS-CONC-1';

        const ops = 60;
        await Promise.all(
          Array.from({ length: ops }, async (_, i) => {
            await tick();
            store.upsertSessionMetadata({
              session_id: sessionId,
              session_type: 'workflow',
              title: `Auth flow ${i}`,
              keywords: ['auth', 'jwt'],
              token_estimate: 42,
              file_patterns: ['src/**'],
            });
            await tick();
          }),
        );

        const meta = store.getSessionMetadata(sessionId);
        assert.ok(meta);
        assert.equal(meta?.access_count, ops);
      } finally {
        rmSync(projectRoot, { recursive: true, force: true });
      }
    });

    it('handles 50+ concurrent cluster member writes with correct membership', async () => {
      const projectRoot = createProjectRoot('ccw-storage-concurrency-core-cluster-');
      try {
        const store = coreMod.getCoreMemoryStore(projectRoot);
        const cluster = store.createCluster({ name: 'Concurrency Cluster', description: 'stress' });

        await Promise.all(
          Array.from({ length: 55 }, async (_, i) => {
            const sessionId = `WFS-${i}`;
            await tick();
            store.upsertSessionMetadata({ session_id: sessionId, session_type: 'workflow', title: `S ${i}` });
            store.addClusterMember({
              cluster_id: cluster.id,
              session_id: sessionId,
              session_type: 'workflow',
              sequence_order: i + 1,
              relevance_score: 1.0,
            });
            await tick();
          }),
        );

        const members = store.getClusterMembers(cluster.id);
        assert.equal(members.length, 55);
        assert.equal(new Set(members.map((m: any) => m.session_id)).size, 55);

        const clustersForOne = store.getSessionClusters('WFS-0');
        assert.ok(clustersForOne.some((c: any) => c.id === cluster.id));
      } finally {
        rmSync(projectRoot, { recursive: true, force: true });
      }
    });

    it('supports concurrent updateCluster calls without corrupting rows', async () => {
      const projectRoot = createProjectRoot('ccw-storage-concurrency-core-update-');
      try {
        const store = coreMod.getCoreMemoryStore(projectRoot);
        const cluster = store.createCluster({ name: 'Mutable Cluster', description: 'v0' });

        const descriptions = Array.from({ length: 25 }, (_, i) => `desc-${i}`);
        await Promise.all(
          descriptions.map(async (desc) => {
            await tick();
            store.updateCluster(cluster.id, { description: desc });
            await tick();
          }),
        );

        const updated = store.getCluster(cluster.id);
        assert.ok(updated);
        assert.ok(descriptions.includes(updated?.description || ''));
      } finally {
        rmSync(projectRoot, { recursive: true, force: true });
      }
    });

    it('rolls back insertChunksBatch when a chunk insert fails', () => {
      const projectRoot = createProjectRoot('ccw-storage-concurrency-core-chunks-');
      try {
        const store = coreMod.getCoreMemoryStore(projectRoot);
        const sourceId = 'CMEM-ROLLBACK-1';

        assert.throws(
          () =>
            store.insertChunksBatch([
              { source_id: sourceId, source_type: 'core_memory', chunk_index: 0, content: 'ok' },
              { source_id: sourceId, source_type: 'core_memory', chunk_index: 1, content: null as any },
            ]),
          /NOT NULL|SQLITE_CONSTRAINT/i,
        );

        assert.deepEqual(store.getChunks(sourceId), []);
      } finally {
        rmSync(projectRoot, { recursive: true, force: true });
      }
    });
  });
});

