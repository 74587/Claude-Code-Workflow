/**
 * Integration tests for session clustering.
 *
 * Notes:
 * - Targets the runtime implementation shipped in `ccw/dist`.
 * - Uses isolated CCW storage via CCW_DATA_DIR to avoid touching real user data.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type TestEnv = {
  ccwHome: string;
  projectRoot: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any;
};

const ORIGINAL_CCW_DATA_DIR = process.env.CCW_DATA_DIR;

async function withClusteringEnv(fn: (env: TestEnv) => Promise<void>): Promise<void> {
  const ccwHome = mkdtempSync(join(tmpdir(), 'ccw-cluster-home-'));
  const projectRoot = mkdtempSync(join(tmpdir(), 'ccw-cluster-project-'));
  process.env.CCW_DATA_DIR = ccwHome;

  const { SessionClusteringService } = await import('../../dist/core/session-clustering-service.js');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service: any = new SessionClusteringService(projectRoot);

  try {
    await fn({ ccwHome, projectRoot, service });
  } finally {
    try {
      service?.cliHistoryStore?.close?.();
    } catch {
      // ignore
    }
    try {
      service?.coreMemoryStore?.close?.();
    } catch {
      // ignore
    }

    // Restore environment
    if (ORIGINAL_CCW_DATA_DIR === undefined) {
      delete process.env.CCW_DATA_DIR;
    } else {
      process.env.CCW_DATA_DIR = ORIGINAL_CCW_DATA_DIR;
    }

    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(ccwHome, { recursive: true, force: true });
  }
}

describe('session clustering integration', async () => {
  it('autocluster groups related sessions and prevents duplicates', async () => {
    await withClusteringEnv(async ({ service }) => {
      // Seed related core memories.
      const baseContent = `# Session: auth + session\nTouched: src/tools/session-manager.ts src/core/session-clustering-service.ts\n`;
      service.coreMemoryStore.upsertMemory({ id: 'CMEM-CLUST-1', content: baseContent + 'Fix archive logic\n' });
      service.coreMemoryStore.upsertMemory({ id: 'CMEM-CLUST-2', content: baseContent + 'Add integration tests\n' });
      service.coreMemoryStore.upsertMemory({ id: 'CMEM-CLUST-3', content: baseContent + 'Refactor validatePath\n' });

      // Seed an unrelated memory that should not be clustered.
      service.coreMemoryStore.upsertMemory({
        id: 'CMEM-CLUST-OTHER',
        content: '# Session: unrelated\nTouched: docs/readme.md\n',
      });

      // Seed related CLI history.
      const now = new Date().toISOString();
      service.cliHistoryStore.saveConversation({
        id: 'CONV-CLUST-1',
        created_at: now,
        updated_at: now,
        tool: 'codex',
        model: 'default',
        mode: 'analysis',
        category: 'user',
        total_duration_ms: 10,
        turn_count: 1,
        latest_status: 'success',
        turns: [
          {
            turn: 1,
            timestamp: now,
            prompt: 'Investigate src/tools/session-manager.ts and src/core/session-clustering-service.ts',
            duration_ms: 10,
            status: 'success',
            exit_code: 0,
            output: { stdout: '', stderr: '', truncated: false, cached: false },
          },
        ],
      });

      const first = await service.autocluster({ scope: 'all', minClusterSize: 2 });
      assert.ok(first.clustersCreated >= 1);
      assert.ok(first.sessionsClustered >= 2);

      const clusters = service.coreMemoryStore.listClusters('active');
      assert.ok(clusters.length >= 1);

      const members = service.coreMemoryStore.getClusterMembers(clusters[0].id);
      assert.ok(members.length >= 2);

      // Relevance score should be in [0, 1] for similar sessions.
      const s1 = service.coreMemoryStore.getSessionMetadata('CMEM-CLUST-1');
      const s2 = service.coreMemoryStore.getSessionMetadata('CMEM-CLUST-2');
      assert.ok(s1 && s2);
      const relevance = service.calculateRelevance(s1, s2);
      assert.ok(relevance >= 0 && relevance <= 1);
      assert.ok(relevance > 0.4);

      // Second run should not create additional clusters for already clustered sessions.
      const beforeCount = service.coreMemoryStore.listClusters('active').length;
      const second = await service.autocluster({ scope: 'all', minClusterSize: 2 });
      const afterCount = service.coreMemoryStore.listClusters('active').length;
      assert.equal(afterCount, beforeCount);
      assert.equal(second.clustersCreated, 0);
      assert.equal(second.sessionsClustered, 0);
    });
  });

  it('supports cluster CRUD via core memory store tables', async () => {
    await withClusteringEnv(async ({ service }) => {
      // Seed metadata records so cluster members have resolvable session info.
      const now = new Date().toISOString();
      service.coreMemoryStore.upsertSessionMetadata({
        session_id: 'S-ONE',
        session_type: 'workflow',
        title: 'One',
        summary: 'First',
        keywords: ['session', 'one'],
        token_estimate: 10,
        file_patterns: ['src/tools/**', '**/*.{ts}'],
        created_at: now,
        last_accessed: now,
        access_count: 1,
      });
      service.coreMemoryStore.upsertSessionMetadata({
        session_id: 'S-TWO',
        session_type: 'workflow',
        title: 'Two',
        summary: 'Second',
        keywords: ['session', 'two'],
        token_estimate: 10,
        file_patterns: ['src/tools/**', '**/*.{ts}'],
        created_at: now,
        last_accessed: now,
        access_count: 1,
      });

      const cluster = service.coreMemoryStore.createCluster({
        name: 'custom-cluster',
        description: 'Manual cluster for integration test',
        intent: 'group related workflow sessions',
        status: 'active',
      });
      assert.ok(cluster?.id);

      service.coreMemoryStore.addClusterMember({
        cluster_id: cluster.id,
        session_id: 'S-ONE',
        session_type: 'workflow',
        sequence_order: 1,
        relevance_score: 0.9,
      });
      service.coreMemoryStore.addClusterMember({
        cluster_id: cluster.id,
        session_id: 'S-TWO',
        session_type: 'workflow',
        sequence_order: 2,
        relevance_score: 0.8,
      });

      const clusters = service.coreMemoryStore.listClusters('active');
      assert.ok(clusters.some((c: any) => c.id === cluster.id));

      const members = service.coreMemoryStore.getClusterMembers(cluster.id);
      assert.deepEqual(
        members.map((m: any) => m.session_id),
        ['S-ONE', 'S-TWO'],
      );

      const one = service.coreMemoryStore.getSessionMetadata('S-ONE');
      assert.equal(one?.title, 'One');

      const removed = service.coreMemoryStore.removeClusterMember(cluster.id, 'S-ONE');
      assert.equal(removed, true);

      const remaining = service.coreMemoryStore.getClusterMembers(cluster.id);
      assert.deepEqual(remaining.map((m: any) => m.session_id), ['S-TWO']);
    });
  });
});

