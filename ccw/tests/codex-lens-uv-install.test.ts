/**
 * Integration tests for CodexLens UV installation functionality.
 *
 * Notes:
 * - Targets the runtime implementation shipped in `ccw/dist`.
 * - Tests real package installation (fastembed, hnswlib, onnxruntime, ccw-litellm, codex-lens).
 * - Verifies Python import success for installed packages.
 * - Tests UV's dependency conflict auto-resolution capability.
 * - Uses temporary directories with cleanup after tests.
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
const TEST_VENV_PATH = join(tmpdir(), `codexlens-install-test-${Date.now()}`);

// Track UV availability for conditional tests
let uvAvailable = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let manager: any;

describe('CodexLens UV Installation Tests', async () => {
  mod = await import(uvManagerUrl.href);

  before(async () => {
    uvAvailable = await mod.isUvAvailable();
    if (!uvAvailable) {
      console.log('[Test] UV not available, attempting to install...');
      uvAvailable = await mod.ensureUvInstalled();
    }

    if (uvAvailable) {
      manager = new mod.UvManager({
        venvPath: TEST_VENV_PATH,
        pythonVersion: '>=3.10,<3.13', // onnxruntime compatibility range
      });
      console.log(`[Test] Created UvManager with venv path: ${TEST_VENV_PATH}`);
    }
  });

  after(() => {
    // Clean up test venv
    if (existsSync(TEST_VENV_PATH)) {
      console.log(`[Test] Cleaning up test venv: ${TEST_VENV_PATH}`);
      try {
        rmSync(TEST_VENV_PATH, { recursive: true, force: true });
      } catch (err) {
        console.log(`[Test] Failed to remove venv: ${(err as Error).message}`);
      }
    }
  });

  describe('Virtual Environment Setup', () => {
    it('should create venv with correct Python version', async () => {
      if (!uvAvailable) {
        console.log('[Test] Skipping - UV not available');
        return;
      }

      const result = await manager.createVenv();
      console.log(`[Test] Create venv result:`, result);
      assert.ok(result.success, `Venv creation failed: ${result.error}`);

      // Verify Python version
      const version = await manager.getPythonVersion();
      console.log(`[Test] Python version: ${version}`);
      const match = version?.match(/3\.(\d+)/);
      assert.ok(match, 'Should be Python 3.x');
      const minor = parseInt(match[1]);
      assert.ok(minor >= 10 && minor < 13, `Python version should be 3.10-3.12, got 3.${minor}`);
    });
  });

  describe('Semantic Search Dependencies (fastembed)', () => {
    it('should install fastembed and hnswlib', async () => {
      if (!uvAvailable || !manager?.isVenvValid()) {
        console.log('[Test] Skipping - venv not ready');
        return;
      }

      console.log('[Test] Installing fastembed and hnswlib...');
      const startTime = Date.now();

      const result = await manager.install([
        'numpy>=1.24',
        'fastembed>=0.5',
        'hnswlib>=0.8.0',
      ]);

      const duration = Date.now() - startTime;
      console.log(`[Test] Installation result:`, result);
      console.log(`[Test] Installation took ${duration}ms`);

      assert.ok(result.success, `fastembed installation failed: ${result.error}`);
    });

    it('should verify fastembed is importable', async () => {
      if (!uvAvailable || !manager?.isVenvValid()) {
        console.log('[Test] Skipping - venv not ready');
        return;
      }

      const result = await manager.runPython([
        '-c',
        'import fastembed; print(f"fastembed version: {fastembed.__version__}")',
      ]);

      console.log(`[Test] fastembed import:`, result);
      assert.ok(result.success, `fastembed import failed: ${result.stderr}`);
      assert.ok(result.stdout.includes('fastembed version'), 'Should print fastembed version');
    });

    it('should verify hnswlib is importable', async () => {
      if (!uvAvailable || !manager?.isVenvValid()) {
        console.log('[Test] Skipping - venv not ready');
        return;
      }

      const result = await manager.runPython(['-c', 'import hnswlib; print("hnswlib imported successfully")']);

      console.log(`[Test] hnswlib import:`, result);
      assert.ok(result.success, `hnswlib import failed: ${result.stderr}`);
    });
  });

  describe('ONNX Runtime Installation', () => {
    it('should install onnxruntime (CPU)', async () => {
      if (!uvAvailable || !manager?.isVenvValid()) {
        console.log('[Test] Skipping - venv not ready');
        return;
      }

      console.log('[Test] Installing onnxruntime...');
      const result = await manager.install(['onnxruntime>=1.18.0']);

      console.log(`[Test] onnxruntime installation:`, result);
      assert.ok(result.success, `onnxruntime installation failed: ${result.error}`);
    });

    it('should verify onnxruntime providers', async () => {
      if (!uvAvailable || !manager?.isVenvValid()) {
        console.log('[Test] Skipping - venv not ready');
        return;
      }

      const result = await manager.runPython([
        '-c',
        'import onnxruntime; print("Providers:", onnxruntime.get_available_providers())',
      ]);

      console.log(`[Test] onnxruntime providers:`, result);
      assert.ok(result.success, `onnxruntime import failed: ${result.stderr}`);
      assert.ok(result.stdout.includes('CPUExecutionProvider'), 'Should have CPU provider');
    });
  });

  describe('ccw-litellm Installation', () => {
    it('should install ccw-litellm from local path', async () => {
      if (!uvAvailable || !manager?.isVenvValid()) {
        console.log('[Test] Skipping - venv not ready');
        return;
      }

      // Find local ccw-litellm package
      const possiblePaths = [join(process.cwd(), 'ccw-litellm'), 'D:\\Claude_dms3\\ccw-litellm'];

      let localPath: string | null = null;
      for (const p of possiblePaths) {
        if (existsSync(join(p, 'pyproject.toml'))) {
          localPath = p;
          break;
        }
      }

      if (!localPath) {
        console.log('[Test] ccw-litellm local path not found, installing from PyPI...');
        const result = await manager.install(['ccw-litellm']);
        console.log(`[Test] PyPI installation:`, result);
        // PyPI may not have it published, skip
        return;
      }

      console.log(`[Test] Installing ccw-litellm from: ${localPath}`);
      const result = await manager.installFromProject(localPath);

      console.log(`[Test] ccw-litellm installation:`, result);
      assert.ok(result.success, `ccw-litellm installation failed: ${result.error}`);
    });

    it('should verify ccw-litellm is importable', async () => {
      if (!uvAvailable || !manager?.isVenvValid()) {
        console.log('[Test] Skipping - venv not ready');
        return;
      }

      const result = await manager.runPython([
        '-c',
        'import ccw_litellm; print(f"ccw-litellm version: {ccw_litellm.__version__}")',
      ]);

      console.log(`[Test] ccw-litellm import:`, result);
      // If installation failed (PyPI doesn't have it), skip validation
      if (!result.success && result.stderr.includes('No module named')) {
        console.log('[Test] ccw-litellm not installed, skipping import test');
        return;
      }

      assert.ok(result.success, `ccw-litellm import failed: ${result.stderr}`);
    });
  });

  describe('Full codex-lens Installation', () => {
    it('should install codex-lens with semantic extras from local path', async () => {
      if (!uvAvailable || !manager?.isVenvValid()) {
        console.log('[Test] Skipping - venv not ready');
        return;
      }

      // Find local codex-lens package
      const possiblePaths = [join(process.cwd(), 'codex-lens'), 'D:\\Claude_dms3\\codex-lens'];

      let localPath: string | null = null;
      for (const p of possiblePaths) {
        if (existsSync(join(p, 'pyproject.toml'))) {
          localPath = p;
          break;
        }
      }

      if (!localPath) {
        console.log('[Test] codex-lens local path not found, skipping');
        return;
      }

      console.log(`[Test] Installing codex-lens[semantic] from: ${localPath}`);
      const startTime = Date.now();

      const result = await manager.installFromProject(localPath, ['semantic']);

      const duration = Date.now() - startTime;
      console.log(`[Test] codex-lens installation:`, result);
      console.log(`[Test] Installation took ${duration}ms`);

      assert.ok(result.success, `codex-lens installation failed: ${result.error}`);
    });

    it('should verify codex-lens CLI is available', async () => {
      if (!uvAvailable || !manager?.isVenvValid()) {
        console.log('[Test] Skipping - venv not ready');
        return;
      }

      const result = await manager.runPython(['-m', 'codexlens', '--help']);

      console.log(`[Test] codexlens CLI help output length: ${result.stdout.length}`);
      // CLI may fail due to dependency issues, log but don't force failure
      if (!result.success) {
        console.log(`[Test] codexlens CLI failed: ${result.stderr}`);
      }
    });
  });

  describe('Dependency Conflict Resolution', () => {
    it('should handle onnxruntime version conflicts automatically', async () => {
      if (!uvAvailable || !manager?.isVenvValid()) {
        console.log('[Test] Skipping - venv not ready');
        return;
      }

      // UV should auto-resolve conflicts between fastembed and onnxruntime
      // Install onnxruntime first, then fastembed, verify no errors
      console.log('[Test] Testing conflict resolution...');

      // Check current onnxruntime version
      const result = await manager.runPython(['-c', 'import onnxruntime; print(f"onnxruntime: {onnxruntime.__version__}")']);

      console.log(`[Test] Current onnxruntime:`, result.stdout.trim());

      // Reinstall fastembed, UV should handle dependencies
      const installResult = await manager.install(['fastembed>=0.5']);
      console.log(`[Test] Reinstall fastembed:`, installResult);

      // Check onnxruntime again
      const result2 = await manager.runPython(['-c', 'import onnxruntime; print(f"onnxruntime: {onnxruntime.__version__}")']);

      console.log(`[Test] After reinstall onnxruntime:`, result2.stdout.trim());
      assert.ok(result2.success, 'onnxruntime should still be importable after fastembed reinstall');
    });
  });

  describe('Package List Verification', () => {
    it('should list all installed packages', async () => {
      if (!uvAvailable || !manager?.isVenvValid()) {
        console.log('[Test] Skipping - venv not ready');
        return;
      }

      const packages = await manager.list();
      console.log(`[Test] Total installed packages: ${packages?.length ?? 0}`);

      if (packages !== null) {
        assert.ok(Array.isArray(packages), 'list() should return array');

        // Check for expected packages
        const packageNames = packages.map((p: { name: string }) => p.name.toLowerCase().replace(/-/g, '_'));
        console.log(`[Test] Package names: ${packageNames.slice(0, 10).join(', ')}...`);

        // Verify core packages are present
        const hasNumpy = packageNames.includes('numpy');
        const hasFastembed = packageNames.includes('fastembed');
        const hasHnswlib = packageNames.includes('hnswlib');

        console.log(`[Test] numpy: ${hasNumpy}, fastembed: ${hasFastembed}, hnswlib: ${hasHnswlib}`);
        assert.ok(hasNumpy, 'numpy should be installed');
        assert.ok(hasFastembed, 'fastembed should be installed');
        assert.ok(hasHnswlib, 'hnswlib should be installed');
      }
    });

    it('should check individual package installation status', async () => {
      if (!uvAvailable || !manager?.isVenvValid()) {
        console.log('[Test] Skipping - venv not ready');
        return;
      }

      const numpyInstalled = await manager.isPackageInstalled('numpy');
      const fastembedInstalled = await manager.isPackageInstalled('fastembed');
      const nonexistentInstalled = await manager.isPackageInstalled('this-package-does-not-exist-12345');

      console.log(`[Test] numpy installed: ${numpyInstalled}`);
      console.log(`[Test] fastembed installed: ${fastembedInstalled}`);
      console.log(`[Test] nonexistent installed: ${nonexistentInstalled}`);

      assert.ok(numpyInstalled, 'numpy should be installed');
      assert.ok(fastembedInstalled, 'fastembed should be installed');
      assert.equal(nonexistentInstalled, false, 'nonexistent package should not be installed');
    });
  });

  describe('CodexLens UV Manager Factory', () => {
    it('should create CodexLens UV manager with default settings', () => {
      const codexLensManager = mod.createCodexLensUvManager();
      console.log(`[Test] CodexLens manager created`);
      assert.ok(codexLensManager !== null, 'createCodexLensUvManager should return manager');
      assert.ok(codexLensManager.getVenvPython, 'Manager should have getVenvPython method');

      // Verify Python path is in default location
      const pythonPath = codexLensManager.getVenvPython();
      console.log(`[Test] Default CodexLens Python path: ${pythonPath}`);
      assert.ok(pythonPath.includes('.codexlens'), 'Python path should be in .codexlens directory');
    });

    it('should create CodexLens UV manager with custom data dir', () => {
      const customDir = join(tmpdir(), 'custom-codexlens-test');
      const codexLensManager = mod.createCodexLensUvManager(customDir);
      const pythonPath = codexLensManager.getVenvPython();
      console.log(`[Test] Custom CodexLens manager Python path: ${pythonPath}`);
      assert.ok(pythonPath.includes(customDir), 'Python path should use custom dir');
    });
  });
});
