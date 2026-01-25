/**
 * Unit tests for Settings Persistence Functions
 *
 * Tests the new setter/getter functions for ClaudeCliSettingsConfig:
 * - setPromptFormat / getPromptFormat
 * - setDefaultModel / getDefaultModel
 * - setAutoSyncEnabled / getAutoSyncEnabled
 * - setSmartContextEnabled / getSmartContextEnabled
 * - setNativeResume / getNativeResume
 */

import { after, afterEach, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Set up isolated test environment
const TEST_CCW_HOME = mkdtempSync(join(tmpdir(), 'ccw-settings-test-'));
process.env.CCW_DATA_DIR = TEST_CCW_HOME;

const claudeCliToolsPath = new URL('../dist/tools/claude-cli-tools.js', import.meta.url).href;

describe('Settings Persistence Functions', async () => {
  let claudeCliTools: any;
  const testProjectDir = join(TEST_CCW_HOME, 'test-project');

  before(async () => {
    claudeCliTools = await import(claudeCliToolsPath);
  });

  after(() => {
    rmSync(TEST_CCW_HOME, { recursive: true, force: true });
  });

  afterEach(() => {
    // Clean up settings file after each test
    const settingsPath = join(TEST_CCW_HOME, '.claude', 'cli-settings.json');
    if (existsSync(settingsPath)) {
      rmSync(settingsPath);
    }
  });

  describe('setPromptFormat / getPromptFormat', () => {
    it('should set and get prompt format', () => {
      const result = claudeCliTools.setPromptFormat(testProjectDir, 'yaml');
      assert.equal(result.promptFormat, 'yaml');

      const retrieved = claudeCliTools.getPromptFormat(testProjectDir);
      assert.equal(retrieved, 'yaml');
    });

    it('should persist prompt format to file', () => {
      claudeCliTools.setPromptFormat(testProjectDir, 'json');

      const settingsPath = join(TEST_CCW_HOME, '.claude', 'cli-settings.json');
      assert.ok(existsSync(settingsPath), 'Settings file should exist');

      const content = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      assert.equal(content.promptFormat, 'json');
    });

    it('should update existing prompt format', () => {
      claudeCliTools.setPromptFormat(testProjectDir, 'plain');
      claudeCliTools.setPromptFormat(testProjectDir, 'yaml');

      const retrieved = claudeCliTools.getPromptFormat(testProjectDir);
      assert.equal(retrieved, 'yaml');
    });

    it('should return default when file does not exist', () => {
      const retrieved = claudeCliTools.getPromptFormat(testProjectDir);
      assert.equal(retrieved, 'plain');
    });

    it('should accept all valid format values', () => {
      const formats: Array<'plain' | 'yaml' | 'json'> = ['plain', 'yaml', 'json'];

      for (const format of formats) {
        claudeCliTools.setPromptFormat(testProjectDir, format);
        const retrieved = claudeCliTools.getPromptFormat(testProjectDir);
        assert.equal(retrieved, format, `Format ${format} should be set correctly`);
      }
    });
  });

  describe('setDefaultModel / getDefaultModel', () => {
    it('should set and get default model', () => {
      const result = claudeCliTools.setDefaultModel(testProjectDir, 'gemini-2.5-pro');
      assert.equal(result.defaultModel, 'gemini-2.5-pro');

      const retrieved = claudeCliTools.getDefaultModel(testProjectDir);
      assert.equal(retrieved, 'gemini-2.5-pro');
    });

    it('should persist default model to file', () => {
      claudeCliTools.setDefaultModel(testProjectDir, 'claude-opus-4');

      const settingsPath = join(TEST_CCW_HOME, '.claude', 'cli-settings.json');
      assert.ok(existsSync(settingsPath), 'Settings file should exist');

      const content = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      assert.equal(content.defaultModel, 'claude-opus-4');
    });

    it('should update existing default model', () => {
      claudeCliTools.setDefaultModel(testProjectDir, 'gpt-4.1');
      claudeCliTools.setDefaultModel(testProjectDir, 'gpt-5.2');

      const retrieved = claudeCliTools.getDefaultModel(testProjectDir);
      assert.equal(retrieved, 'gpt-5.2');
    });

    it('should return undefined when not set', () => {
      const retrieved = claudeCliTools.getDefaultModel(testProjectDir);
      assert.equal(retrieved, undefined);
    });

    it('should handle arbitrary model names', () => {
      const models = ['custom-model-1', 'test-model', 'my-fine-tuned-model'];

      for (const model of models) {
        claudeCliTools.setDefaultModel(testProjectDir, model);
        const retrieved = claudeCliTools.getDefaultModel(testProjectDir);
        assert.equal(retrieved, model, `Model ${model} should be set correctly`);
      }
    });
  });

  describe('setAutoSyncEnabled / getAutoSyncEnabled', () => {
    it('should set and get auto-sync enabled status', () => {
      const result = claudeCliTools.setAutoSyncEnabled(testProjectDir, true);
      assert.equal(result.autoSyncEnabled, true);

      const retrieved = claudeCliTools.getAutoSyncEnabled(testProjectDir);
      assert.equal(retrieved, true);
    });

    it('should persist auto-sync status to file', () => {
      claudeCliTools.setAutoSyncEnabled(testProjectDir, false);

      const settingsPath = join(TEST_CCW_HOME, '.claude', 'cli-settings.json');
      assert.ok(existsSync(settingsPath), 'Settings file should exist');

      const content = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      assert.equal(content.autoSyncEnabled, false);
    });

    it('should update existing auto-sync status', () => {
      claudeCliTools.setAutoSyncEnabled(testProjectDir, true);
      claudeCliTools.setAutoSyncEnabled(testProjectDir, false);

      const retrieved = claudeCliTools.getAutoSyncEnabled(testProjectDir);
      assert.equal(retrieved, false);
    });

    it('should return undefined when not set', () => {
      const retrieved = claudeCliTools.getAutoSyncEnabled(testProjectDir);
      assert.equal(retrieved, undefined);
    });

    it('should toggle between true and false', () => {
      claudeCliTools.setAutoSyncEnabled(testProjectDir, true);
      let retrieved = claudeCliTools.getAutoSyncEnabled(testProjectDir);
      assert.equal(retrieved, true);

      claudeCliTools.setAutoSyncEnabled(testProjectDir, false);
      retrieved = claudeCliTools.getAutoSyncEnabled(testProjectDir);
      assert.equal(retrieved, false);

      claudeCliTools.setAutoSyncEnabled(testProjectDir, true);
      retrieved = claudeCliTools.getAutoSyncEnabled(testProjectDir);
      assert.equal(retrieved, true);
    });
  });

  describe('setSmartContextEnabled / getSmartContextEnabled', () => {
    it('should set and get smart context enabled status', () => {
      const result = claudeCliTools.setSmartContextEnabled(testProjectDir, true);
      assert.equal(result.smartContext.enabled, true);

      const retrieved = claudeCliTools.getSmartContextEnabled(testProjectDir);
      assert.equal(retrieved, true);
    });

    it('should persist smart context status to file', () => {
      claudeCliTools.setSmartContextEnabled(testProjectDir, true);

      const settingsPath = join(TEST_CCW_HOME, '.claude', 'cli-settings.json');
      assert.ok(existsSync(settingsPath), 'Settings file should exist');

      const content = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      assert.equal(content.smartContext.enabled, true);
    });

    it('should preserve other smartContext properties', () => {
      // First, load settings to check default maxFiles
      const settings = claudeCliTools.loadClaudeCliSettings(testProjectDir);
      const defaultMaxFiles = settings.smartContext.maxFiles;

      claudeCliTools.setSmartContextEnabled(testProjectDir, true);

      const settingsPath = join(TEST_CCW_HOME, '.claude', 'cli-settings.json');
      const content = JSON.parse(readFileSync(settingsPath, 'utf-8'));

      assert.equal(content.smartContext.enabled, true);
      assert.equal(content.smartContext.maxFiles, defaultMaxFiles, 'maxFiles should be preserved');
    });

    it('should return false when not set', () => {
      const retrieved = claudeCliTools.getSmartContextEnabled(testProjectDir);
      assert.equal(retrieved, false);
    });
  });

  describe('setNativeResume / getNativeResume', () => {
    it('should set and get native resume status', () => {
      const result = claudeCliTools.setNativeResume(testProjectDir, false);
      assert.equal(result.nativeResume, false);

      const retrieved = claudeCliTools.getNativeResume(testProjectDir);
      assert.equal(retrieved, false);
    });

    it('should persist native resume status to file', () => {
      claudeCliTools.setNativeResume(testProjectDir, false);

      const settingsPath = join(TEST_CCW_HOME, '.claude', 'cli-settings.json');
      assert.ok(existsSync(settingsPath), 'Settings file should exist');

      const content = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      assert.equal(content.nativeResume, false);
    });

    it('should return true when not set (default)', () => {
      const retrieved = claudeCliTools.getNativeResume(testProjectDir);
      assert.equal(retrieved, true);
    });
  });

  describe('Multiple settings updates', () => {
    it('should handle multiple settings updates in sequence', () => {
      claudeCliTools.setPromptFormat(testProjectDir, 'yaml');
      claudeCliTools.setDefaultModel(testProjectDir, 'gemini-2.5-pro');
      claudeCliTools.setAutoSyncEnabled(testProjectDir, true);
      claudeCliTools.setSmartContextEnabled(testProjectDir, true);
      claudeCliTools.setNativeResume(testProjectDir, false);

      assert.equal(claudeCliTools.getPromptFormat(testProjectDir), 'yaml');
      assert.equal(claudeCliTools.getDefaultModel(testProjectDir), 'gemini-2.5-pro');
      assert.equal(claudeCliTools.getAutoSyncEnabled(testProjectDir), true);
      assert.equal(claudeCliTools.getSmartContextEnabled(testProjectDir), true);
      assert.equal(claudeCliTools.getNativeResume(testProjectDir), false);
    });

    it('should preserve existing settings when updating one', () => {
      claudeCliTools.setPromptFormat(testProjectDir, 'json');
      claudeCliTools.setDefaultModel(testProjectDir, 'test-model');

      // Update only auto-sync
      claudeCliTools.setAutoSyncEnabled(testProjectDir, true);

      // Verify previous settings are preserved
      assert.equal(claudeCliTools.getPromptFormat(testProjectDir), 'json');
      assert.equal(claudeCliTools.getDefaultModel(testProjectDir), 'test-model');
      assert.equal(claudeCliTools.getAutoSyncEnabled(testProjectDir), true);
    });
  });

  describe('Performance', () => {
    it('should complete setter operations in under 10ms', () => {
      const operations = [
        () => claudeCliTools.setPromptFormat(testProjectDir, 'yaml'),
        () => claudeCliTools.setDefaultModel(testProjectDir, 'test-model'),
        () => claudeCliTools.setAutoSyncEnabled(testProjectDir, true),
        () => claudeCliTools.setSmartContextEnabled(testProjectDir, true),
        () => claudeCliTools.setNativeResume(testProjectDir, false),
      ];

      for (const operation of operations) {
        const start = Date.now();
        operation();
        const duration = Date.now() - start;
        assert.ok(duration < 10, `Operation should complete in under 10ms (took ${duration}ms)`);
      }
    });

    it('should complete getter operations in under 10ms', () => {
      // Set up some data first
      claudeCliTools.setPromptFormat(testProjectDir, 'yaml');
      claudeCliTools.setDefaultModel(testProjectDir, 'test-model');
      claudeCliTools.setAutoSyncEnabled(testProjectDir, true);

      const operations = [
        () => claudeCliTools.getPromptFormat(testProjectDir),
        () => claudeCliTools.getDefaultModel(testProjectDir),
        () => claudeCliTools.getAutoSyncEnabled(testProjectDir),
        () => claudeCliTools.getSmartContextEnabled(testProjectDir),
        () => claudeCliTools.getNativeResume(testProjectDir),
      ];

      for (const operation of operations) {
        const start = Date.now();
        operation();
        const duration = Date.now() - start;
        assert.ok(duration < 10, `Operation should complete in under 10ms (took ${duration}ms)`);
      }
    });
  });

  describe('File corruption handling', () => {
    it('should handle invalid JSON gracefully', () => {
      const settingsPath = join(TEST_CCW_HOME, '.claude', 'cli-settings.json');
      const claudeDir = join(TEST_CCW_HOME, '.claude');

      // Create .claude directory if it doesn't exist
      if (!existsSync(claudeDir)) {
        mkdtempSync(claudeDir);
      }

      // Write invalid JSON
      writeFileSync(settingsPath, '{invalid json}', 'utf-8');

      // Getters should return defaults
      assert.equal(claudeCliTools.getPromptFormat(testProjectDir), 'plain');
      assert.equal(claudeCliTools.getDefaultModel(testProjectDir), undefined);
      assert.equal(claudeCliTools.getAutoSyncEnabled(testProjectDir), undefined);
    });

    it('should recover from corrupted file by overwriting', () => {
      const settingsPath = join(TEST_CCW_HOME, '.claude', 'cli-settings.json');
      const claudeDir = join(TEST_CCW_HOME, '.claude');

      // Create .claude directory if it doesn't exist
      if (!existsSync(claudeDir)) {
        mkdtempSync(claudeDir);
      }

      // Write invalid JSON
      writeFileSync(settingsPath, '{invalid json}', 'utf-8');

      // Setter should fix the file
      claudeCliTools.setPromptFormat(testProjectDir, 'yaml');

      // Should now read correctly
      assert.equal(claudeCliTools.getPromptFormat(testProjectDir), 'yaml');

      // File should be valid JSON
      const content = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      assert.equal(content.promptFormat, 'yaml');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string for defaultModel', () => {
      claudeCliTools.setDefaultModel(testProjectDir, '');
      const retrieved = claudeCliTools.getDefaultModel(testProjectDir);
      assert.equal(retrieved, '');
    });

    it('should handle very long model names', () => {
      const longModelName = 'a'.repeat(1000);
      claudeCliTools.setDefaultModel(testProjectDir, longModelName);
      const retrieved = claudeCliTools.getDefaultModel(testProjectDir);
      assert.equal(retrieved, longModelName);
    });

    it('should handle special characters in model names', () => {
      const specialName = 'model-@#$%^&*()_+{}[]|:;<>?,./~`';
      claudeCliTools.setDefaultModel(testProjectDir, specialName);
      const retrieved = claudeCliTools.getDefaultModel(testProjectDir);
      assert.equal(retrieved, specialName);
    });
  });
});
