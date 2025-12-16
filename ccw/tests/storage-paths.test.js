/**
 * Storage Paths Hierarchical Structure Tests
 * Tests for hierarchical storage path generation and migration
 */

import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert';
import { join, resolve } from 'path';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { homedir } from 'os';

// Mock CCW_HOME for testing
const TEST_CCW_HOME = join(homedir(), '.ccw-test');
process.env.CCW_DATA_DIR = TEST_CCW_HOME;

// Import after setting env var
import {
  detectHierarchy,
  getProjectPaths,
  clearHierarchyCache,
  getProjectId
} from '../dist/config/storage-paths.js';

describe('Storage Paths - Hierarchical Structure', async () => {
  const cleanTestEnv = () => {
    if (existsSync(TEST_CCW_HOME)) {
      rmSync(TEST_CCW_HOME, { recursive: true, force: true });
    }
    mkdirSync(TEST_CCW_HOME, { recursive: true });
    clearHierarchyCache();
  };

  before(async () => {
    cleanTestEnv();
  });

  after(async () => {
    cleanTestEnv();
  });

  describe('Project ID Generation', async () => {
    afterEach(async () => {
      cleanTestEnv();
    });
    it('should generate consistent project IDs', async () => {
      const path1 = 'D:\\Claude_dms3';
      const path2 = 'D:\\Claude_dms3';

      const id1 = getProjectId(path1);
      const id2 = getProjectId(path2);

      assert.strictEqual(id1, id2);
      assert.ok(id1.includes('d--claude_dms3'));
    });

    it('should handle different path formats', async () => {
      // Test Windows path
      const winId = getProjectId('D:\\Claude_dms3');
      assert.ok(winId);

      // Test Unix-like path
      const unixId = getProjectId('/home/user/project');
      assert.ok(unixId);

      // Different paths should have different IDs
      assert.notStrictEqual(winId, unixId);
    });
  });

  describe('Hierarchy Detection', async () => {
    afterEach(async () => {
      cleanTestEnv();
    });

    it('should detect no parent for root project', async () => {
      const hierarchy = detectHierarchy('D:\\Claude_dms3');

      assert.strictEqual(hierarchy.parentId, null);
      assert.strictEqual(hierarchy.relativePath, '');
      assert.ok(hierarchy.currentId);
    });

    it('should detect parent when parent storage exists', async () => {
      // Create parent storage
      const parentPath = 'D:\\Claude_dms3';
      const parentId = getProjectId(parentPath);
      const parentStorageDir = join(TEST_CCW_HOME, 'projects', parentId);
      mkdirSync(parentStorageDir, { recursive: true });

      // Detect hierarchy for child
      const childPath = 'D:\\Claude_dms3\\ccw';
      const hierarchy = detectHierarchy(childPath);

      assert.strictEqual(hierarchy.parentId, parentId);
      assert.strictEqual(hierarchy.relativePath, 'ccw');
    });

    it('should detect nested hierarchy', async () => {
      // Create parent storage
      const rootPath = 'D:\\Claude_dms3';
      const rootId = getProjectId(rootPath);
      const rootStorageDir = join(TEST_CCW_HOME, 'projects', rootId);
      mkdirSync(rootStorageDir, { recursive: true });

      // Detect hierarchy for nested child
      const nestedPath = 'D:\\Claude_dms3\\ccw\\src';
      const hierarchy = detectHierarchy(nestedPath);

      assert.strictEqual(hierarchy.parentId, rootId);
      assert.strictEqual(hierarchy.relativePath, 'ccw/src');
    });

    it('should cache detection results', async () => {
      const path = 'D:\\Claude_dms3\\ccw';

      const result1 = detectHierarchy(path);
      const result2 = detectHierarchy(path);

      // Should return exact same object (cached)
      assert.strictEqual(result1, result2);
    });

    it('should clear cache when requested', async () => {
      const path = 'D:\\Claude_dms3\\ccw';

      const result1 = detectHierarchy(path);
      clearHierarchyCache();
      const result2 = detectHierarchy(path);

      // Should return different object instances after cache clear
      assert.notStrictEqual(result1, result2);
      // But same values
      assert.strictEqual(result1.currentId, result2.currentId);
    });
  });

  describe('Hierarchical Path Generation', async () => {
    afterEach(async () => {
      cleanTestEnv();
    });

    it('should generate flat path for root project', async () => {
      const projectPath = 'D:\\Claude_dms3';
      const paths = getProjectPaths(projectPath);

      assert.ok(paths.root.includes('projects'));
      assert.ok(paths.root.includes('d--claude_dms3'));
      // Check that path ends with project ID, not a subdirectory
      assert.ok(paths.root.endsWith('d--claude_dms3') || paths.root.endsWith('d--claude_dms3\\') || paths.root.endsWith('d--claude_dms3/'));
    });

    it('should generate hierarchical path when parent exists', async () => {
      // Create parent storage
      const parentPath = 'D:\\Claude_dms3';
      const parentId = getProjectId(parentPath);
      const parentStorageDir = join(TEST_CCW_HOME, 'projects', parentId);
      mkdirSync(parentStorageDir, { recursive: true });

      // Generate paths for child
      const childPath = 'D:\\Claude_dms3\\ccw';
      const paths = getProjectPaths(childPath);

      assert.ok(paths.root.includes(parentId));
      assert.ok(paths.root.includes('ccw'));
      assert.ok(paths.root.endsWith('ccw'));
    });

    it('should generate nested hierarchical paths', async () => {
      // Create parent storage
      const parentPath = 'D:\\Claude_dms3';
      const parentId = getProjectId(parentPath);
      const parentStorageDir = join(TEST_CCW_HOME, 'projects', parentId);
      mkdirSync(parentStorageDir, { recursive: true });

      // Generate paths for nested child
      const nestedPath = 'D:\\Claude_dms3\\ccw\\src';
      const paths = getProjectPaths(nestedPath);

      assert.ok(paths.root.includes(parentId));
      assert.ok(paths.root.includes('ccw'));
      assert.ok(paths.root.includes('src'));
      assert.ok(paths.root.endsWith('src'));
    });

    it('should include all required subdirectories', async () => {
      const projectPath = 'D:\\Claude_dms3';
      const paths = getProjectPaths(projectPath);

      assert.ok(paths.cliHistory.includes('cli-history'));
      assert.ok(paths.memory.includes('memory'));
      assert.ok(paths.cache.includes('cache'));
      assert.ok(paths.config.includes('config'));
      assert.ok(paths.historyDb.includes('history.db'));
      assert.ok(paths.memoryDb.includes('memory.db'));
    });
  });

  describe('Migration from Flat to Hierarchical', async () => {
    it('should migrate flat structure to hierarchical', async () => {
      // Setup: Create parent storage
      const parentPath = 'D:\\Claude_dms3';
      const parentId = getProjectId(parentPath);
      const parentStorageDir = join(TEST_CCW_HOME, 'projects', parentId);
      mkdirSync(parentStorageDir, { recursive: true });

      // Create old flat structure for child
      const childPath = 'D:\\Claude_dms3\\ccw';
      const childId = getProjectId(childPath);
      const flatStorageDir = join(TEST_CCW_HOME, 'projects', childId);
      const flatCliHistoryDir = join(flatStorageDir, 'cli-history');
      mkdirSync(flatCliHistoryDir, { recursive: true });

      // Create a test file to verify migration
      const testFile = join(flatCliHistoryDir, 'test.txt');
      writeFileSync(testFile, 'test data');

      // Trigger migration by calling getProjectPaths
      const paths = getProjectPaths(childPath);

      console.log('[DEBUG] Test file path:', testFile);
      console.log('[DEBUG] Flat storage dir:', flatStorageDir);
      console.log('[DEBUG] Flat storage exists before migration:', existsSync(flatStorageDir));
      console.log('[DEBUG] Returned paths.root:', paths.root);
      console.log('[DEBUG] Returned paths.cliHistory:', paths.cliHistory);
      console.log('[DEBUG] Expected migrated file:', join(paths.cliHistory, 'test.txt'));
      console.log('[DEBUG] Migrated file exists:', existsSync(join(paths.cliHistory, 'test.txt')));
      console.log('[DEBUG] Flat storage exists after migration:', existsSync(flatStorageDir));

      // Verify hierarchical path structure
      assert.ok(paths.root.includes('ccw'));
      assert.ok(paths.root.endsWith('ccw'));

      // Verify data was migrated
      const migratedFile = join(paths.cliHistory, 'test.txt');
      assert.ok(existsSync(migratedFile));

      // Verify old flat structure was deleted
      assert.ok(!existsSync(flatStorageDir));
    });

    it('should handle migration failures gracefully', async () => {
      // Create scenario that might fail migration
      const parentPath = 'D:\\Claude_dms3';
      const parentId = getProjectId(parentPath);
      const parentStorageDir = join(TEST_CCW_HOME, 'projects', parentId);
      mkdirSync(parentStorageDir, { recursive: true });

      const childPath = 'D:\\Claude_dms3\\ccw';

      // Should not throw error even if migration fails
      assert.doesNotThrow(() => {
        const paths = getProjectPaths(childPath);
        assert.ok(paths);
      });
    });
  });

  describe('Path Normalization', async () => {
    it('should normalize Windows path separators', async () => {
      const hierarchy = detectHierarchy('D:\\Claude_dms3\\ccw\\src');

      // Relative path should use forward slashes
      if (hierarchy.relativePath) {
        assert.ok(!hierarchy.relativePath.includes('\\'));
        assert.ok(hierarchy.relativePath.includes('/'));
      }
    });

    it('should handle trailing slashes', async () => {
      const path1 = 'D:\\Claude_dms3\\ccw';
      const path2 = 'D:\\Claude_dms3\\ccw\\';

      const id1 = getProjectId(path1);
      const id2 = getProjectId(path2);

      // Should produce same ID regardless of trailing slash
      assert.strictEqual(id1, id2);
    });
  });

  describe('Edge Cases', async () => {
    it('should handle very deep nesting', async () => {
      // Create deep parent storage
      const parentPath = 'D:\\Claude_dms3';
      const parentId = getProjectId(parentPath);
      const parentStorageDir = join(TEST_CCW_HOME, 'projects', parentId);
      mkdirSync(parentStorageDir, { recursive: true });

      // Generate paths for deeply nested child
      const deepPath = 'D:\\Claude_dms3\\a\\b\\c\\d\\e';
      const paths = getProjectPaths(deepPath);

      assert.ok(paths.root.includes(parentId));
      assert.ok(paths.root.includes('a'));
      assert.ok(paths.root.includes('e'));
    });

    it('should handle special characters in path names', async () => {
      const specialPath = 'D:\\Claude_dms3\\my-project_v2';
      const id = getProjectId(specialPath);

      assert.ok(id);
      assert.ok(id.includes('my-project_v2'));
    });

    it('should handle relative paths by resolving them', async () => {
      const relativePath = './ccw';
      const paths = getProjectPaths(relativePath);

      // Should resolve to absolute path
      assert.ok(paths.root);
    });
  });
});
