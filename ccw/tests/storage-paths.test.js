/**
 * Storage Paths Hierarchical Structure Tests
 * Tests for hierarchical storage path generation and migration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
} from '../src/config/storage-paths.js';

describe('Storage Paths - Hierarchical Structure', () => {
  beforeEach(() => {
    // Clean test directory
    if (existsSync(TEST_CCW_HOME)) {
      rmSync(TEST_CCW_HOME, { recursive: true, force: true });
    }
    mkdirSync(TEST_CCW_HOME, { recursive: true });
    clearHierarchyCache();
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(TEST_CCW_HOME)) {
      rmSync(TEST_CCW_HOME, { recursive: true, force: true });
    }
    clearHierarchyCache();
  });

  describe('Project ID Generation', () => {
    it('should generate consistent project IDs', () => {
      const path1 = 'D:\\Claude_dms3';
      const path2 = 'D:\\Claude_dms3';

      const id1 = getProjectId(path1);
      const id2 = getProjectId(path2);

      expect(id1).toBe(id2);
      expect(id1).toContain('d--claude_dms3');
    });

    it('should handle different path formats', () => {
      // Test Windows path
      const winId = getProjectId('D:\\Claude_dms3');
      expect(winId).toBeTruthy();

      // Test Unix-like path
      const unixId = getProjectId('/home/user/project');
      expect(unixId).toBeTruthy();

      // Different paths should have different IDs
      expect(winId).not.toBe(unixId);
    });
  });

  describe('Hierarchy Detection', () => {
    it('should detect no parent for root project', () => {
      const hierarchy = detectHierarchy('D:\\Claude_dms3');

      expect(hierarchy.parentId).toBeNull();
      expect(hierarchy.relativePath).toBe('');
      expect(hierarchy.currentId).toBeTruthy();
    });

    it('should detect parent when parent storage exists', () => {
      // Create parent storage
      const parentPath = 'D:\\Claude_dms3';
      const parentId = getProjectId(parentPath);
      const parentStorageDir = join(TEST_CCW_HOME, 'projects', parentId);
      mkdirSync(parentStorageDir, { recursive: true });

      // Detect hierarchy for child
      const childPath = 'D:\\Claude_dms3\\ccw';
      const hierarchy = detectHierarchy(childPath);

      expect(hierarchy.parentId).toBe(parentId);
      expect(hierarchy.relativePath).toBe('ccw');
    });

    it('should detect nested hierarchy', () => {
      // Create parent storage
      const rootPath = 'D:\\Claude_dms3';
      const rootId = getProjectId(rootPath);
      const rootStorageDir = join(TEST_CCW_HOME, 'projects', rootId);
      mkdirSync(rootStorageDir, { recursive: true });

      // Detect hierarchy for nested child
      const nestedPath = 'D:\\Claude_dms3\\ccw\\src';
      const hierarchy = detectHierarchy(nestedPath);

      expect(hierarchy.parentId).toBe(rootId);
      expect(hierarchy.relativePath).toBe('ccw/src');
    });

    it('should cache detection results', () => {
      const path = 'D:\\Claude_dms3\\ccw';

      const result1 = detectHierarchy(path);
      const result2 = detectHierarchy(path);

      // Should return exact same object (cached)
      expect(result1).toBe(result2);
    });

    it('should clear cache when requested', () => {
      const path = 'D:\\Claude_dms3\\ccw';

      const result1 = detectHierarchy(path);
      clearHierarchyCache();
      const result2 = detectHierarchy(path);

      // Should return different object instances after cache clear
      expect(result1).not.toBe(result2);
      // But same values
      expect(result1.currentId).toBe(result2.currentId);
    });
  });

  describe('Hierarchical Path Generation', () => {
    it('should generate flat path for root project', () => {
      const projectPath = 'D:\\Claude_dms3';
      const paths = getProjectPaths(projectPath);

      expect(paths.root).toContain('projects');
      expect(paths.root).toContain('d--claude_dms3');
      expect(paths.root).not.toContain('ccw');
    });

    it('should generate hierarchical path when parent exists', () => {
      // Create parent storage
      const parentPath = 'D:\\Claude_dms3';
      const parentId = getProjectId(parentPath);
      const parentStorageDir = join(TEST_CCW_HOME, 'projects', parentId);
      mkdirSync(parentStorageDir, { recursive: true });

      // Generate paths for child
      const childPath = 'D:\\Claude_dms3\\ccw';
      const paths = getProjectPaths(childPath);

      expect(paths.root).toContain(parentId);
      expect(paths.root).toContain('ccw');
      expect(paths.root.endsWith('ccw')).toBe(true);
    });

    it('should generate nested hierarchical paths', () => {
      // Create parent storage
      const parentPath = 'D:\\Claude_dms3';
      const parentId = getProjectId(parentPath);
      const parentStorageDir = join(TEST_CCW_HOME, 'projects', parentId);
      mkdirSync(parentStorageDir, { recursive: true });

      // Generate paths for nested child
      const nestedPath = 'D:\\Claude_dms3\\ccw\\src';
      const paths = getProjectPaths(nestedPath);

      expect(paths.root).toContain(parentId);
      expect(paths.root).toContain('ccw');
      expect(paths.root).toContain('src');
      expect(paths.root.endsWith('src')).toBe(true);
    });

    it('should include all required subdirectories', () => {
      const projectPath = 'D:\\Claude_dms3';
      const paths = getProjectPaths(projectPath);

      expect(paths.cliHistory).toContain('cli-history');
      expect(paths.memory).toContain('memory');
      expect(paths.cache).toContain('cache');
      expect(paths.config).toContain('config');
      expect(paths.historyDb).toContain('history.db');
      expect(paths.memoryDb).toContain('memory.db');
    });
  });

  describe('Migration from Flat to Hierarchical', () => {
    it('should migrate flat structure to hierarchical', () => {
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

      // Verify hierarchical path structure
      expect(paths.root).toContain('ccw');
      expect(paths.root.endsWith('ccw')).toBe(true);

      // Verify data was migrated
      const migratedFile = join(paths.cliHistory, 'test.txt');
      expect(existsSync(migratedFile)).toBe(true);

      // Verify old flat structure was deleted
      expect(existsSync(flatStorageDir)).toBe(false);
    });

    it('should handle migration failures gracefully', () => {
      // Create scenario that might fail migration
      const parentPath = 'D:\\Claude_dms3';
      const parentId = getProjectId(parentPath);
      const parentStorageDir = join(TEST_CCW_HOME, 'projects', parentId);
      mkdirSync(parentStorageDir, { recursive: true });

      const childPath = 'D:\\Claude_dms3\\ccw';

      // Should not throw error even if migration fails
      expect(() => {
        const paths = getProjectPaths(childPath);
        expect(paths).toBeTruthy();
      }).not.toThrow();
    });
  });

  describe('Path Normalization', () => {
    it('should normalize Windows path separators', () => {
      const hierarchy = detectHierarchy('D:\\Claude_dms3\\ccw\\src');

      // Relative path should use forward slashes
      if (hierarchy.relativePath) {
        expect(hierarchy.relativePath).not.toContain('\\');
        expect(hierarchy.relativePath).toContain('/');
      }
    });

    it('should handle trailing slashes', () => {
      const path1 = 'D:\\Claude_dms3\\ccw';
      const path2 = 'D:\\Claude_dms3\\ccw\\';

      const id1 = getProjectId(path1);
      const id2 = getProjectId(path2);

      // Should produce same ID regardless of trailing slash
      expect(id1).toBe(id2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very deep nesting', () => {
      // Create deep parent storage
      const parentPath = 'D:\\Claude_dms3';
      const parentId = getProjectId(parentPath);
      const parentStorageDir = join(TEST_CCW_HOME, 'projects', parentId);
      mkdirSync(parentStorageDir, { recursive: true });

      // Generate paths for deeply nested child
      const deepPath = 'D:\\Claude_dms3\\a\\b\\c\\d\\e';
      const paths = getProjectPaths(deepPath);

      expect(paths.root).toContain(parentId);
      expect(paths.root).toContain('a');
      expect(paths.root).toContain('e');
    });

    it('should handle special characters in path names', () => {
      const specialPath = 'D:\\Claude_dms3\\my-project_v2';
      const id = getProjectId(specialPath);

      expect(id).toBeTruthy();
      expect(id).toContain('my-project_v2');
    });

    it('should handle relative paths by resolving them', () => {
      const relativePath = './ccw';
      const paths = getProjectPaths(relativePath);

      // Should resolve to absolute path
      expect(paths.root).toBeTruthy();
    });
  });
});
