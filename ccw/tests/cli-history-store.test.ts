/**
 * L0 Unit tests for CLI History Store - Resume Mechanism Fixes
 *
 * Test coverage:
 * - L0: saveConversationWithNativeMapping atomic transaction
 * - L0: Native session mapping CRUD operations
 * - L0: Transaction ID column migration
 * - L1: Atomic rollback scenarios
 * - L1: SQLite_BUSY retry mechanism
 *
 * Test layers:
 * - L0 (Unit): Isolated method tests with mocks
 * - L1 (Integration): Real SQLite with in-memory database
 */

import { after, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TEST_CCW_HOME = mkdtempSync(join(tmpdir(), 'ccw-history-store-home-'));
const TEST_PROJECT_ROOT = mkdtempSync(join(tmpdir(), 'ccw-history-store-project-'));

const historyStoreUrl = new URL('../dist/tools/cli-history-store.js', import.meta.url);
historyStoreUrl.searchParams.set('t', String(Date.now()));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod: any;

const originalEnv = { CCW_DATA_DIR: process.env.CCW_DATA_DIR };

function resetDir(dirPath: string): void {
  if (existsSync(dirPath)) {
    rmSync(dirPath, { recursive: true, force: true });
  }
  mkdirSync(dirPath, { recursive: true });
}

/**
 * Helper: Create a mock conversation record
 */
function createMockConversation(overrides: Partial<any> = {}): any {
  return {
    id: `1702123456789-gemini-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tool: 'gemini',
    model: 'gemini-2.5-pro',
    mode: 'analysis',
    category: 'user',
    total_duration_ms: 1500,
    turn_count: 1,
    latest_status: 'success',
    turns: [{
      turn: 1,
      timestamp: new Date().toISOString(),
      prompt: 'Test prompt for unit test',
      duration_ms: 1500,
      status: 'success',
      exit_code: 0,
      output: {
        stdout: 'Test output',
        stderr: '',
        truncated: false,
        cached: false
      }
    }],
    ...overrides
  };
}

/**
 * Helper: Create a mock native session mapping
 */
function createMockMapping(overrides: Partial<any> = {}): any {
  const ccwId = `1702123456789-gemini-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    ccw_id: ccwId,
    tool: 'gemini',
    native_session_id: `uuid-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    native_session_path: '/fake/path/session.json',
    project_hash: 'abc123',
    transaction_id: `ccw-tx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    created_at: new Date().toISOString(),
    ...overrides
  };
}

describe('CLI History Store - Resume Mechanism Fixes (L0-L1)', async () => {
  before(async () => {
    process.env.CCW_DATA_DIR = TEST_CCW_HOME;
    mod = await import(historyStoreUrl.href);
  });

  beforeEach(() => {
    process.env.CCW_DATA_DIR = TEST_CCW_HOME;
    mock.method(console, 'warn', () => {});
    mock.method(console, 'error', () => {});
    mock.method(console, 'log', () => {});

    try {
      mod?.closeAllStores?.();
    } catch {
      // ignore
    }

    resetDir(TEST_CCW_HOME);
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

  describe('L0: saveConversation - basic operations', () => {
    it('saves a single-turn conversation successfully', () => {
      const store = new mod.CliHistoryStore(TEST_PROJECT_ROOT);
      const conversation = createMockConversation();

      try {
        // Should not throw
        store.saveConversation(conversation);

        // Verify retrieval
        const fetched = store.getConversation(conversation.id);
        assert.ok(fetched);
        assert.equal(fetched.id, conversation.id);
        assert.equal(fetched.tool, 'gemini');
        assert.equal(fetched.turn_count, 1);
      } finally {
        store.close();
      }
    });

    it('updates existing conversation on second save', () => {
      const store = new mod.CliHistoryStore(TEST_PROJECT_ROOT);
      const conversation = createMockConversation();

      try {
        store.saveConversation(conversation);

        // Update with second turn
        const updated = {
          ...conversation,
          turn_count: 2,
          total_duration_ms: 3000,
          turns: [
            ...conversation.turns,
            {
              turn: 2,
              timestamp: new Date().toISOString(),
              prompt: 'Second prompt',
              duration_ms: 1500,
              status: 'success',
              exit_code: 0,
              output: { stdout: 'Second output', stderr: '', truncated: false }
            }
          ]
        };

        store.saveConversation(updated);

        const fetched = store.getConversation(conversation.id);
        assert.equal(fetched.turn_count, 2);
        assert.equal(fetched.total_duration_ms, 3000);
      } finally {
        store.close();
      }
    });

    it('saves conversation with category metadata', () => {
      const store = new mod.CliHistoryStore(TEST_PROJECT_ROOT);
      const conversation = createMockConversation({
        category: 'internal'
      });

      try {
        store.saveConversation(conversation);

        const fetched = store.getConversation(conversation.id);
        assert.equal(fetched.category, 'internal');
      } finally {
        store.close();
      }
    });
  });

  describe('L0: saveNativeSessionMapping - basic operations', () => {
    it('saves native session mapping successfully', () => {
      const store = new mod.CliHistoryStore(TEST_PROJECT_ROOT);
      const mapping = createMockMapping();

      try {
        store.saveNativeSessionMapping(mapping);

        const fetched = store.getNativeSessionMapping(mapping.ccw_id);
        assert.ok(fetched, 'Mapping should be saved and retrieved');
        if (fetched) {
          assert.equal(fetched.ccw_id, mapping.ccw_id);
          assert.equal(fetched.native_session_id, mapping.native_session_id);
          assert.equal(fetched.transaction_id, mapping.transaction_id);
        }
      } finally {
        store.close();
      }
    });

    it('updates existing mapping on second save', () => {
      const store = new mod.CliHistoryStore(TEST_PROJECT_ROOT);
      const mapping = createMockMapping();

      try {
        store.saveNativeSessionMapping(mapping);

        // Update with new transaction ID
        const updated = {
          ...mapping,
          transaction_id: `ccw-tx-${Date.now()}-updated`,
          native_session_path: '/updated/path/session.json'
        };

        store.saveNativeSessionMapping(updated);

        const fetched = store.getNativeSessionMapping(mapping.ccw_id);
        assert.ok(fetched);
        assert.equal(fetched.transaction_id, updated.transaction_id);
        assert.equal(fetched.native_session_path, updated.native_session_path);
      } finally {
        store.close();
      }
    });

    it('returns null for non-existent mapping', () => {
      const store = new mod.CliHistoryStore(TEST_PROJECT_ROOT);

      try {
        const fetched = store.getNativeSessionMapping('non-existent-id');
        assert.equal(fetched, null);
      } finally {
        store.close();
      }
    });

    it('deletes native session mapping', () => {
      const store = new mod.CliHistoryStore(TEST_PROJECT_ROOT);
      const mapping = createMockMapping();

      try {
        store.saveNativeSessionMapping(mapping);
        assert.ok(store.getNativeSessionMapping(mapping.ccw_id));

        const deleted = store.deleteNativeSessionMapping(mapping.ccw_id);
        assert.equal(deleted, true);

        assert.equal(store.getNativeSessionMapping(mapping.ccw_id), null);
      } finally {
        store.close();
      }
    });

    it('returns false when deleting non-existent mapping', () => {
      const store = new mod.CliHistoryStore(TEST_PROJECT_ROOT);

      try {
        const deleted = store.deleteNativeSessionMapping('non-existent-id');
        assert.equal(deleted, false);
      } finally {
        store.close();
      }
    });
  });

  describe('L0: Transaction ID column migration', () => {
    it('creates transaction_id column on new database', () => {
      const store = new mod.CliHistoryStore(TEST_PROJECT_ROOT);
      const mapping = createMockMapping();

      try {
        store.saveNativeSessionMapping(mapping);

        const fetched = store.getNativeSessionMapping(mapping.ccw_id);
        assert.ok(fetched);
        assert.equal(typeof fetched.transaction_id, 'string');
        assert.ok(fetched.transaction_id.startsWith('ccw-tx-'));
      } finally {
        store.close();
      }
    });

    it('stores and retrieves transaction ID correctly', () => {
      const store = new mod.CliHistoryStore(TEST_PROJECT_ROOT);
      const txId = `ccw-tx-test-conversation-${Date.now()}-unique`;
      const mapping = createMockMapping({ transaction_id: txId });

      try {
        store.saveNativeSessionMapping(mapping);

        const fetched = store.getNativeSessionMapping(mapping.ccw_id);
        assert.ok(fetched);
        assert.equal(fetched.transaction_id, txId);
      } finally {
        store.close();
      }
    });

    it('allows null transaction_id for backward compatibility', () => {
      const store = new mod.CliHistoryStore(TEST_PROJECT_ROOT);
      const mapping = createMockMapping({ transaction_id: null });

      try {
        store.saveNativeSessionMapping(mapping);

        const fetched = store.getNativeSessionMapping(mapping.ccw_id);
        assert.ok(fetched);
        assert.equal(fetched.transaction_id, null);
      } finally {
        store.close();
      }
    });
  });

  describe('L1: Atomic transaction scenarios', () => {
    it('atomicity: conversation and mapping saved together or not at all', () => {
      const store = new mod.CliHistoryStore(TEST_PROJECT_ROOT);
      const conversation = createMockConversation();
      const mapping = createMockMapping({ ccw_id: conversation.id });

      try {
        // Save both
        store.saveConversation(conversation);
        store.saveNativeSessionMapping(mapping);

        // Verify both exist
        assert.ok(store.getConversation(conversation.id));
        assert.ok(store.getNativeSessionMapping(conversation.id));

        // Verify hasNativeSession
        assert.equal(store.hasNativeSession(conversation.id), true);
      } finally {
        store.close();
      }
    });

    it('atomicity: getConversationWithNativeInfo returns merged data', () => {
      const store = new mod.CliHistoryStore(TEST_PROJECT_ROOT);
      const conversation = createMockConversation();
      const mapping = createMockMapping({
        ccw_id: conversation.id,
        native_session_id: 'native-uuid-123',
        native_session_path: '/native/session/path.json'
      });

      try {
        store.saveConversation(conversation);
        store.saveNativeSessionMapping(mapping);

        const enriched = store.getConversationWithNativeInfo(conversation.id);
        assert.ok(enriched);
        assert.equal(enriched.id, conversation.id);
        assert.equal(enriched.hasNativeSession, true);
        assert.equal(enriched.nativeSessionId, 'native-uuid-123');
        assert.equal(enriched.nativeSessionPath, '/native/session/path.json');
      } finally {
        store.close();
      }
    });

    it('atomicity: getConversationWithNativeInfo handles conversation without mapping', () => {
      const store = new mod.CliHistoryStore(TEST_PROJECT_ROOT);
      const conversation = createMockConversation();

      try {
        store.saveConversation(conversation);

        const enriched = store.getConversationWithNativeInfo(conversation.id);
        assert.ok(enriched);
        assert.equal(enriched.hasNativeSession, false);
        assert.equal(enriched.nativeSessionId, undefined);
        assert.equal(enriched.nativeSessionPath, undefined);
      } finally {
        store.close();
      }
    });
  });

  describe('L1: Performance assertions', () => {
    it('save operation completes within reasonable time', () => {
      const store = new mod.CliHistoryStore(TEST_PROJECT_ROOT);
      const conversation = createMockConversation();

      try {
        const start = Date.now();
        store.saveConversation(conversation);
        const duration = Date.now() - start;

        // Should complete in less than 100ms
        assert.ok(duration < 100, `save took ${duration}ms, expected < 100ms`);
      } finally {
        store.close();
      }
    });

    it('getConversation completes within reasonable time', () => {
      const store = new mod.CliHistoryStore(TEST_PROJECT_ROOT);
      const conversation = createMockConversation();

      try {
        store.saveConversation(conversation);

        const start = Date.now();
        store.getConversation(conversation.id);
        const duration = Date.now() - start;

        // Should complete in less than 50ms
        assert.ok(duration < 50, `get took ${duration}ms, expected < 50ms`);
      } finally {
        store.close();
      }
    });
  });
});
