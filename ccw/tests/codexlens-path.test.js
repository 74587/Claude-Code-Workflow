import { after, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('node:fs');

const originalExistsSync = fs.existsSync;
const originalCodexLensDataDir = process.env.CODEXLENS_DATA_DIR;
const tempDirs = [];

afterEach(() => {
  fs.existsSync = originalExistsSync;
  syncBuiltinESMExports();

  if (originalCodexLensDataDir === undefined) {
    delete process.env.CODEXLENS_DATA_DIR;
  } else {
    process.env.CODEXLENS_DATA_DIR = originalCodexLensDataDir;
  }
});

after(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

describe('codexlens-path hidden python selection', () => {
  it('prefers pythonw.exe for hidden Windows subprocesses when available', async () => {
    if (process.platform !== 'win32') {
      return;
    }

    const dataDir = mkdtempSync(join(tmpdir(), 'ccw-codexlens-hidden-python-'));
    tempDirs.push(dataDir);
    process.env.CODEXLENS_DATA_DIR = dataDir;

    const expectedPythonw = join(dataDir, 'venv', 'Scripts', 'pythonw.exe');
    fs.existsSync = (path) => String(path) === expectedPythonw;
    syncBuiltinESMExports();

    const moduleUrl = new URL(`../dist/utils/codexlens-path.js?t=${Date.now()}`, import.meta.url);
    const mod = await import(moduleUrl.href);

    assert.equal(mod.getCodexLensHiddenPython(), expectedPythonw);
  });

  it('falls back to python.exe when pythonw.exe is unavailable', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'ccw-codexlens-hidden-fallback-'));
    tempDirs.push(dataDir);
    process.env.CODEXLENS_DATA_DIR = dataDir;

    fs.existsSync = () => false;
    syncBuiltinESMExports();

    const moduleUrl = new URL(`../dist/utils/codexlens-path.js?t=${Date.now()}`, import.meta.url);
    const mod = await import(moduleUrl.href);

    assert.equal(mod.getCodexLensHiddenPython(), mod.getCodexLensPython());
  });
});
