/**
 * Integration tests for CCW semantic search bridge (memory-embedder-bridge).
 *
 * Notes:
 * - Targets runtime implementations shipped in `ccw/dist`.
 * - Uses a real temporary SQLite database created by CoreMemoryStore.
 * - Runs the Python `ccw/scripts/memory_embedder.py` via the CodexLens venv when available.
 */

import { after, before, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CCW_HOME = mkdtempSync(join(tmpdir(), 'ccw-semantic-search-home-'));
const PROJECT_A = mkdtempSync(join(tmpdir(), 'ccw-semantic-search-project-a-'));
const PROJECT_B = mkdtempSync(join(tmpdir(), 'ccw-semantic-search-project-b-'));

const VENV_PYTHON =
  process.platform === 'win32'
    ? join(homedir(), '.codexlens', 'venv', 'Scripts', 'python.exe')
    : join(homedir(), '.codexlens', 'venv', 'bin', 'python');

const EMBEDDER_SCRIPT_PATH = fileURLToPath(
  new URL('../../scripts/memory_embedder.py', import.meta.url),
);

const EMBEDDER_AVAILABLE = existsSync(VENV_PYTHON) && existsSync(EMBEDDER_SCRIPT_PATH);

const coreMemoryStoreUrl = new URL('../../dist/core/core-memory-store.js', import.meta.url);
coreMemoryStoreUrl.searchParams.set('t', String(Date.now()));

const embedderBridgeUrl = new URL('../../dist/core/memory-embedder-bridge.js', import.meta.url);
embedderBridgeUrl.searchParams.set('t', String(Date.now()));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let storeMod: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let bridgeMod: any;

const originalEnv = { CCW_DATA_DIR: process.env.CCW_DATA_DIR };

function insertCoreMemoryChunk(store: any, sourceId: string, chunkIndex: number, content: string): void {
  store.insertChunk({
    source_id: sourceId,
    source_type: 'core_memory',
    chunk_index: chunkIndex,
    content,
  });
}

describe('semantic search integration (memory-embedder-bridge)', async () => {
  before(async () => {
    process.env.CCW_DATA_DIR = CCW_HOME;
    mock.method(console, 'warn', () => {});

    storeMod = await import(coreMemoryStoreUrl.href);
    bridgeMod = await import(embedderBridgeUrl.href);
  });

  after(() => {
    try {
      storeMod?.closeAllStores?.();
    } catch {
      // ignore
    }
    mock.restoreAll();
    process.env.CCW_DATA_DIR = originalEnv.CCW_DATA_DIR;
    rmSync(CCW_HOME, { recursive: true, force: true });
    rmSync(PROJECT_A, { recursive: true, force: true });
    rmSync(PROJECT_B, { recursive: true, force: true });
  });

  it(
    'embeds chunks and performs semantic search with top_k/min_score filtering',
    { skip: !EMBEDDER_AVAILABLE },
    async () => {
      const storeA = storeMod.getCoreMemoryStore(PROJECT_A);
      const storeB = storeMod.getCoreMemoryStore(PROJECT_B);

      // Project A: two core memories
      storeA.upsertMemory({
        id: 'CMEM-SEM-1',
        content: 'Authentication uses JWT access tokens with refresh tokens.',
      });
      insertCoreMemoryChunk(storeA, 'CMEM-SEM-1', 0, 'JWT access token refresh token authentication');

      storeA.upsertMemory({
        id: 'CMEM-SEM-2',
        content: 'Database uses SQLite via better-sqlite3.',
      });
      insertCoreMemoryChunk(storeA, 'CMEM-SEM-2', 0, 'SQLite better-sqlite3 database layer persistence');

      // Project B: one core memory
      storeB.upsertMemory({
        id: 'CMEM-SEM-3',
        content: 'Frontend uses React components and CSS.',
      });
      insertCoreMemoryChunk(storeB, 'CMEM-SEM-3', 0, 'React components CSS frontend UI');

      const dbPathA = storeA.dbPath as string;
      const dbPathB = storeB.dbPath as string;

      const beforeA = await bridgeMod.getEmbeddingStatus(dbPathA);
      assert.equal(beforeA.success, true);
      assert.equal(beforeA.total_chunks, 2);

      const embedA = await bridgeMod.generateEmbeddings(dbPathA, { batchSize: 4 });
      assert.equal(embedA.success, true);
      assert.equal(embedA.chunks_failed, 0);
      assert.ok(embedA.chunks_processed >= 2);

      const embedB = await bridgeMod.generateEmbeddings(dbPathB);
      assert.equal(embedB.success, true);
      assert.equal(embedB.chunks_failed, 0);
      assert.ok(embedB.chunks_processed >= 1);

      const afterA = await bridgeMod.getEmbeddingStatus(dbPathA);
      assert.equal(afterA.success, true);
      assert.equal(afterA.embedded_chunks, 2);
      assert.equal(afterA.pending_chunks, 0);
      assert.equal(afterA.by_type.core_memory.total, 2);

      // Query should find the JWT-related memory
      const search = await bridgeMod.searchMemories(dbPathA, 'jwt authentication', {
        minScore: -1,
        topK: 10,
      });
      assert.equal(search.success, true);
      assert.ok(Array.isArray(search.matches));
      assert.ok(search.matches.length > 0);
      assert.ok(search.matches.some((m: any) => m.source_id === 'CMEM-SEM-1'));
      assert.ok(search.matches.every((m: any) => typeof m.restore_command === 'string' && m.restore_command.length > 0));

      // top_k should limit results
      const top1 = await bridgeMod.searchMemories(dbPathA, 'token', { minScore: -1, topK: 1 });
      assert.equal(top1.success, true);
      assert.ok(top1.matches.length <= 1);

      // min_score above 1 forces no matches
      const none = await bridgeMod.searchMemories(dbPathA, 'jwt authentication', { minScore: 1.1, topK: 10 });
      assert.equal(none.success, true);
      assert.deepEqual(none.matches, []);

      // Project isolation: React should be found in project B but not in project A
      const reactA = await bridgeMod.searchMemories(dbPathA, 'react frontend', { minScore: -1, topK: 10 });
      assert.equal(reactA.success, true);
      assert.ok(!reactA.matches.some((m: any) => m.source_id === 'CMEM-SEM-3'));

      const reactB = await bridgeMod.searchMemories(dbPathB, 'react frontend', { minScore: -1, topK: 10 });
      assert.equal(reactB.success, true);
      assert.ok(reactB.matches.some((m: any) => m.source_id === 'CMEM-SEM-3'));

      // Incremental embed run should not re-embed by default
      const embedAgain = await bridgeMod.generateEmbeddings(dbPathA);
      assert.equal(embedAgain.success, true);
      assert.equal(embedAgain.chunks_failed, 0);
      assert.equal(embedAgain.chunks_processed, 0);
    },
  );
});
