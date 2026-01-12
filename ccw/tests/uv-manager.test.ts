/**
 * Unit tests for uv-manager utility module.
 *
 * Notes:
 * - Targets the runtime implementation shipped in `ccw/dist`.
 * - Tests UV binary detection, installation, and virtual environment management.
 * - Gracefully handles cases where UV is not installed.
 */

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const uvManagerUrl = new URL('../dist/utils/uv-manager.js', import.meta.url);
uvManagerUrl.searchParams.set('t', String(Date.now()));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod: any;

// Test venv path with unique timestamp
const TEST_VENV_PATH = join(tmpdir(), `uv-test-venv-${Date.now()}`);

// Track UV availability for conditional tests
let uvAvailable = false;

describe('UV Manager Tests', async () => {
  mod = await import(uvManagerUrl.href);

  // Cleanup after all tests
  after(() => {
    if (existsSync(TEST_VENV_PATH)) {
      console.log(`[Cleanup] Removing test venv: ${TEST_VENV_PATH}`);
      try {
        rmSync(TEST_VENV_PATH, { recursive: true, force: true });
      } catch (err) {
        console.log(`[Cleanup] Failed to remove venv: ${(err as Error).message}`);
      }
    }
  });

  describe('UV Binary Detection', () => {
    it('should check UV availability', async () => {
      uvAvailable = await mod.isUvAvailable();
      console.log(`[Test] UV available: ${uvAvailable}`);
      assert.equal(typeof uvAvailable, 'boolean', 'isUvAvailable should return boolean');
    });

    it('should get UV version when available', async () => {
      if (uvAvailable) {
        const version = await mod.getUvVersion();
        console.log(`[Test] UV version: ${version}`);
        assert.ok(version !== null, 'getUvVersion should return version string');
        assert.ok(version.length > 0, 'Version string should not be empty');
      } else {
        console.log('[Test] UV not installed, skipping version test');
        const version = await mod.getUvVersion();
        assert.equal(version, null, 'getUvVersion should return null when UV not available');
      }
    });

    it('should get UV binary path', async () => {
      const path = mod.getUvBinaryPath();
      console.log(`[Test] UV path: ${path}`);
      assert.equal(typeof path, 'string', 'getUvBinaryPath should return string');
      assert.ok(path.length > 0, 'Path should not be empty');

      if (uvAvailable) {
        assert.ok(existsSync(path), 'UV binary should exist when UV is available');
      }
    });
  });

  describe('UV Installation', () => {
    it('should ensure UV is installed', async () => {
      const installed = await mod.ensureUvInstalled();
      console.log(`[Test] UV ensured: ${installed}`);
      assert.equal(typeof installed, 'boolean', 'ensureUvInstalled should return boolean');

      // Update availability after potential installation
      if (installed) {
        uvAvailable = await mod.isUvAvailable();
        assert.ok(uvAvailable, 'UV should be available after ensureUvInstalled returns true');
      }
    });
  });

  describe('UvManager Class', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let manager: any;

    before(async () => {
      // Ensure UV is available for class tests
      if (!uvAvailable) {
        console.log('[Test] UV not available, attempting installation...');
        await mod.ensureUvInstalled();
        uvAvailable = await mod.isUvAvailable();
      }

      manager = new mod.UvManager({
        venvPath: TEST_VENV_PATH,
        pythonVersion: '>=3.10',
      });
      console.log(`[Test] Created UvManager with venv path: ${TEST_VENV_PATH}`);
    });

    it('should get venv Python path', () => {
      const pythonPath = manager.getVenvPython();
      console.log(`[Test] Venv Python path: ${pythonPath}`);
      assert.equal(typeof pythonPath, 'string', 'getVenvPython should return string');
      assert.ok(pythonPath.includes(TEST_VENV_PATH), 'Python path should be inside venv');
    });

    it('should get venv pip path', () => {
      const pipPath = manager.getVenvPip();
      console.log(`[Test] Venv pip path: ${pipPath}`);
      assert.equal(typeof pipPath, 'string', 'getVenvPip should return string');
      assert.ok(pipPath.includes(TEST_VENV_PATH), 'Pip path should be inside venv');
    });

    it('should report venv as invalid before creation', () => {
      const valid = manager.isVenvValid();
      console.log(`[Test] Venv valid (before create): ${valid}`);
      assert.equal(valid, false, 'Venv should not be valid before creation');
    });

    it('should create virtual environment', async () => {
      if (!uvAvailable) {
        console.log('[Test] Skipping venv creation - UV not available');
        return;
      }

      const result = await manager.createVenv();
      console.log(`[Test] Create venv result:`, result);

      if (result.success) {
        assert.ok(existsSync(TEST_VENV_PATH), 'Venv directory should exist');
        assert.ok(result.duration !== undefined, 'Duration should be reported');
        console.log(`[Test] Venv created in ${result.duration}ms`);
      } else {
        // May fail if Python is not installed
        console.log(`[Test] Venv creation failed: ${result.error}`);
        assert.equal(typeof result.error, 'string', 'Error should be a string');
      }
    });

    it('should check if venv is valid after creation', () => {
      const valid = manager.isVenvValid();
      console.log(`[Test] Venv valid (after create): ${valid}`);
      assert.equal(typeof valid, 'boolean', 'isVenvValid should return boolean');
    });

    it('should get Python version in venv', async () => {
      if (!manager.isVenvValid()) {
        console.log('[Test] Skipping Python version check - venv not valid');
        return;
      }

      const version = await manager.getPythonVersion();
      console.log(`[Test] Python version: ${version}`);
      assert.ok(version !== null, 'getPythonVersion should return version');
      assert.ok(version.startsWith('3.'), 'Should be Python 3.x');
    });

    it('should list installed packages', async () => {
      if (!manager.isVenvValid()) {
        console.log('[Test] Skipping package list - venv not valid');
        return;
      }

      const packages = await manager.list();
      console.log(`[Test] Installed packages count: ${packages?.length ?? 0}`);

      if (packages !== null) {
        assert.ok(Array.isArray(packages), 'list() should return array');
        // UV creates minimal venvs without pip by default
        console.log(`[Test] Packages in venv: ${packages.map((p: { name: string }) => p.name).join(', ') || '(empty)'}`);
      }
    });

    it('should check if package is installed', async () => {
      if (!manager.isVenvValid()) {
        console.log('[Test] Skipping package check - venv not valid');
        return;
      }

      // First install a package, then check if it's installed
      const installResult = await manager.install(['six']);
      if (installResult.success) {
        const installed = await manager.isPackageInstalled('six');
        console.log(`[Test] six installed: ${installed}`);
        assert.ok(installed, 'six should be installed after install');

        // Clean up
        await manager.uninstall(['six']);
      } else {
        console.log('[Test] Could not install test package, skipping check');
      }
    });

    it('should install a simple package', async () => {
      if (!manager.isVenvValid()) {
        console.log('[Test] Skipping package install - venv not valid');
        return;
      }

      // Install a small, fast-installing package
      const result = await manager.install(['pip-install-test']);
      console.log(`[Test] Install result:`, result);
      assert.equal(typeof result.success, 'boolean', 'success should be boolean');

      if (result.success) {
        console.log(`[Test] Package installed in ${result.duration}ms`);
      } else {
        console.log(`[Test] Package install failed: ${result.error}`);
      }
    });

    it('should uninstall a package', async () => {
      if (!manager.isVenvValid()) {
        console.log('[Test] Skipping uninstall - venv not valid');
        return;
      }

      const result = await manager.uninstall(['pip-install-test']);
      console.log(`[Test] Uninstall result:`, result);
      assert.equal(typeof result.success, 'boolean', 'success should be boolean');

      if (result.success) {
        console.log(`[Test] Package uninstalled in ${result.duration}ms`);
      } else {
        console.log(`[Test] Package uninstall failed: ${result.error}`);
      }
    });

    it('should handle empty package list for install', async () => {
      const result = await manager.install([]);
      console.log(`[Test] Empty install result:`, result);
      assert.ok(result.success, 'Empty install should succeed');
      assert.equal(result.duration, 0, 'Empty install should have 0 duration');
    });

    it('should handle empty package list for uninstall', async () => {
      const result = await manager.uninstall([]);
      console.log(`[Test] Empty uninstall result:`, result);
      assert.ok(result.success, 'Empty uninstall should succeed');
      assert.equal(result.duration, 0, 'Empty uninstall should have 0 duration');
    });

    it('should run Python command in venv', async () => {
      if (!manager.isVenvValid()) {
        console.log('[Test] Skipping Python command - venv not valid');
        return;
      }

      const result = await manager.runPython(['-c', 'print("hello from venv")']);
      console.log(`[Test] Run Python result:`, result);

      if (result.success) {
        assert.ok(result.stdout.includes('hello from venv'), 'Output should contain expected text');
      } else {
        console.log(`[Test] Python command failed: ${result.stderr}`);
      }
    });

    it('should delete virtual environment', async () => {
      if (!manager.isVenvValid()) {
        console.log('[Test] Skipping delete - venv not valid');
        return;
      }

      const result = await manager.deleteVenv();
      console.log(`[Test] Delete venv result: ${result}`);

      if (result) {
        assert.ok(!existsSync(TEST_VENV_PATH), 'Venv directory should be deleted');
      }
    });

    it('should handle deleteVenv when venv does not exist', async () => {
      const result = await manager.deleteVenv();
      console.log(`[Test] Delete non-existent venv result: ${result}`);
      assert.ok(result, 'Deleting non-existent venv should succeed');
    });
  });

  describe('Helper Functions', () => {
    it('should create CodexLens UV manager with defaults', () => {
      const codexLensManager = mod.createCodexLensUvManager();
      console.log(`[Test] CodexLens manager created`);
      assert.ok(codexLensManager !== null, 'createCodexLensUvManager should return manager');
      assert.ok(codexLensManager.getVenvPython, 'Manager should have getVenvPython method');
    });

    it('should create CodexLens UV manager with custom data dir', () => {
      const customDir = join(tmpdir(), 'custom-codexlens');
      const codexLensManager = mod.createCodexLensUvManager(customDir);
      const pythonPath = codexLensManager.getVenvPython();
      console.log(`[Test] Custom CodexLens manager Python path: ${pythonPath}`);
      assert.ok(pythonPath.includes(customDir), 'Python path should use custom dir');
    });

    it('should bootstrap UV venv', async () => {
      if (!uvAvailable) {
        console.log('[Test] Skipping bootstrap - UV not available');
        return;
      }

      const bootstrapPath = join(tmpdir(), `uv-bootstrap-test-${Date.now()}`);
      console.log(`[Test] Bootstrap venv path: ${bootstrapPath}`);

      try {
        const result = await mod.bootstrapUvVenv(bootstrapPath, '>=3.10');
        console.log(`[Test] Bootstrap result:`, result);
        assert.equal(typeof result.success, 'boolean', 'success should be boolean');

        if (result.success) {
          assert.ok(existsSync(bootstrapPath), 'Bootstrap venv should exist');
        }
      } finally {
        // Cleanup bootstrap venv
        if (existsSync(bootstrapPath)) {
          rmSync(bootstrapPath, { recursive: true, force: true });
        }
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle install when UV not available gracefully', async () => {
      // Create manager pointing to non-existent venv
      const badManager = new mod.UvManager({
        venvPath: join(tmpdir(), 'non-existent-venv'),
        pythonVersion: '>=3.10',
      });

      const result = await badManager.install(['some-package']);
      console.log(`[Test] Install with invalid venv:`, result);
      assert.equal(result.success, false, 'Install should fail with invalid venv');
      assert.ok(result.error, 'Error message should be present');
    });

    it('should handle uninstall when venv not valid', async () => {
      const badManager = new mod.UvManager({
        venvPath: join(tmpdir(), 'non-existent-venv'),
        pythonVersion: '>=3.10',
      });

      const result = await badManager.uninstall(['some-package']);
      console.log(`[Test] Uninstall with invalid venv:`, result);
      assert.equal(result.success, false, 'Uninstall should fail with invalid venv');
      assert.ok(result.error, 'Error message should be present');
    });

    it('should handle list when venv not valid', async () => {
      const badManager = new mod.UvManager({
        venvPath: join(tmpdir(), 'non-existent-venv'),
        pythonVersion: '>=3.10',
      });

      const packages = await badManager.list();
      console.log(`[Test] List with invalid venv: ${packages}`);
      assert.equal(packages, null, 'list() should return null for invalid venv');
    });

    it('should handle isPackageInstalled when venv not valid', async () => {
      const badManager = new mod.UvManager({
        venvPath: join(tmpdir(), 'non-existent-venv'),
        pythonVersion: '>=3.10',
      });

      const installed = await badManager.isPackageInstalled('pip');
      console.log(`[Test] isPackageInstalled with invalid venv: ${installed}`);
      assert.equal(installed, false, 'isPackageInstalled should return false for invalid venv');
    });

    it('should handle runPython when venv not valid', async () => {
      const badManager = new mod.UvManager({
        venvPath: join(tmpdir(), 'non-existent-venv'),
        pythonVersion: '>=3.10',
      });

      const result = await badManager.runPython(['--version']);
      console.log(`[Test] runPython with invalid venv:`, result);
      assert.equal(result.success, false, 'runPython should fail for invalid venv');
      assert.ok(result.stderr.length > 0, 'Error message should be present');
    });

    it('should handle sync when venv not valid', async () => {
      const badManager = new mod.UvManager({
        venvPath: join(tmpdir(), 'non-existent-venv'),
        pythonVersion: '>=3.10',
      });

      const result = await badManager.sync('requirements.txt');
      console.log(`[Test] sync with invalid venv:`, result);
      assert.equal(result.success, false, 'sync should fail for invalid venv');
      assert.ok(result.error, 'Error message should be present');
    });

    it('should handle installFromProject when venv not valid', async () => {
      const badManager = new mod.UvManager({
        venvPath: join(tmpdir(), 'non-existent-venv'),
        pythonVersion: '>=3.10',
      });

      const result = await badManager.installFromProject('/some/project');
      console.log(`[Test] installFromProject with invalid venv:`, result);
      assert.equal(result.success, false, 'installFromProject should fail for invalid venv');
      assert.ok(result.error, 'Error message should be present');
    });
  });
});
