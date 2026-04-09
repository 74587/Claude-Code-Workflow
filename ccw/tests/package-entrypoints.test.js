import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..');

describe('package entrypoints', () => {
  it('publishes stable root bin entrypoints', () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));

    assert.equal(packageJson.bin.ccw, 'bin/ccw.js');
    assert.equal(packageJson.bin['ccw-mcp'], 'bin/ccw-mcp.js');
    assert.ok(packageJson.files.includes('bin/'));
  });

  it('keeps root and legacy shim files available', () => {
    const requiredFiles = [
      'bin/ccw.js',
      'bin/ccw-mcp.js',
      'ccw/bin/ccw.js',
      'ccw/bin/ccw-mcp.js',
    ];

    for (const relativePath of requiredFiles) {
      assert.ok(existsSync(join(repoRoot, relativePath)), `Expected ${relativePath} to exist`);
    }
  });

  it('boots the root CLI shim from the compiled dist output', () => {
    const rootBin = readFileSync(join(repoRoot, 'bin', 'ccw.js'), 'utf8');
    const legacyBin = readFileSync(join(repoRoot, 'ccw', 'bin', 'ccw.js'), 'utf8');

    assert.match(rootBin, /\.\.\/ccw\/dist\/cli\.js/);
    assert.match(legacyBin, /\.\.\/dist\/cli\.js/);
  });
});
