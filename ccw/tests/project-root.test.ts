/**
 * Unit tests for project-root utility module.
 *
 * Tests path resolution logic for finding project root directory.
 * Note: These tests work with the actual filesystem rather than mocks
 * because ESM module caching makes fs mocking unreliable.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the actual module
import { findProjectRoot, loadPackageInfo, getPackageVersion, getPackageRoot } from '../dist/utils/project-root.js';

describe('project-root: findProjectRoot', () => {
  it('should find project root from tests directory', () => {
    const result = findProjectRoot(__dirname);

    // Should find the actual project root
    assert.ok(result, 'Should find a project root');

    // Verify it has the expected package.json
    const pkgPath = join(result, 'package.json');
    assert.ok(existsSync(pkgPath), 'Should have package.json at root');

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    assert.ok(
      pkg.name === 'claude-code-workflow' || pkg.bin?.ccw,
      'Should find correct project by name or bin'
    );
  });

  it('should find project root from deeply nested directory', () => {
    const deepDir = join(__dirname, 'integration', 'cli-executor');
    const result = findProjectRoot(deepDir);

    assert.ok(result, 'Should find project root from deep directory');
  });

  it('should find project root from src directory', () => {
    const srcDir = join(__dirname, '..', 'src', 'utils');
    const result = findProjectRoot(srcDir);

    assert.ok(result, 'Should find project root from src');
  });

  it('should return consistent result regardless of starting point', () => {
    const fromTests = findProjectRoot(__dirname);
    const fromSrc = findProjectRoot(join(__dirname, '..', 'src'));
    const fromCommands = findProjectRoot(join(__dirname, '..', 'src', 'commands'));

    assert.equal(fromTests, fromSrc, 'Should find same root from tests and src');
    assert.equal(fromSrc, fromCommands, 'Should find same root from src and commands');
  });
});

describe('project-root: loadPackageInfo', () => {
  it('should load package info successfully', () => {
    const pkg = loadPackageInfo();

    assert.ok(pkg, 'Should return package info');
    assert.ok(pkg.name, 'Should have name field');
    assert.ok(pkg.version, 'Should have version field');
  });

  it('should return correct package name', () => {
    const pkg = loadPackageInfo();

    assert.ok(
      pkg?.name === 'claude-code-workflow' || pkg?.bin?.ccw,
      'Should return the correct project package'
    );
  });

  it('should include version field', () => {
    const pkg = loadPackageInfo();

    assert.ok(pkg?.version, 'Should have version');
    assert.match(pkg!.version, /^\d+\.\d+\.\d+/, 'Version should be semver format');
  });
});

describe('project-root: getPackageVersion', () => {
  it('should return version string', () => {
    const version = getPackageVersion();

    assert.ok(version, 'Should return a version');
    assert.equal(typeof version, 'string', 'Version should be a string');
  });

  it('should return valid semver format', () => {
    const version = getPackageVersion();

    // Basic semver pattern: X.Y.Z or X.Y.Z-prerelease
    assert.match(version, /^\d+\.\d+\.\d+/, 'Should be semver format');
  });

  it('should return consistent version', () => {
    const v1 = getPackageVersion();
    const v2 = getPackageVersion();

    assert.equal(v1, v2, 'Should return same version on multiple calls');
  });
});

describe('project-root: getPackageRoot', () => {
  it('should return project root path', () => {
    const root = getPackageRoot();

    assert.ok(root, 'Should return a path');
    assert.equal(typeof root, 'string', 'Should be a string');
  });

  it('should return existing directory', () => {
    const root = getPackageRoot();

    assert.ok(existsSync(root), 'Root directory should exist');
  });

  it('should contain package.json', () => {
    const root = getPackageRoot();
    const pkgPath = join(root, 'package.json');

    assert.ok(existsSync(pkgPath), 'Should have package.json');
  });

  it('should return absolute path', () => {
    const root = getPackageRoot();

    assert.equal(root, resolve(root), 'Should be absolute path');
  });
});

describe('project-root: integration', () => {
  it('should have consistent data across functions', () => {
    const root = getPackageRoot();
    const pkg = loadPackageInfo();
    const version = getPackageVersion();

    // Read package.json directly for comparison
    const directPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

    assert.equal(pkg?.version, directPkg.version, 'loadPackageInfo should match direct read');
    assert.equal(version, directPkg.version, 'getPackageVersion should match direct read');
  });

  it('should find root matching package.json location', () => {
    const root = getPackageRoot();
    const foundRoot = findProjectRoot(__dirname);

    assert.equal(root, foundRoot, 'getPackageRoot and findProjectRoot should match');
  });
});
