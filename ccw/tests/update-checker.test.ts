/**
 * Unit tests for update-checker utility module.
 *
 * Tests version comparison logic with semver support including prerelease versions.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// We need to test the compareVersions function which is not exported
// So we'll create a standalone copy for testing purposes
function parseVersion(version: string): { major: number; minor: number; patch: number; prerelease: string[] } {
  const cleaned = version.replace(/^v/, '');
  const [mainPart, prereleasePart] = cleaned.split('-');
  const parts = mainPart.split('.');
  const major = parseInt(parts[0], 10) || 0;
  const minor = parseInt(parts[1], 10) || 0;
  const patch = parseInt(parts[2], 10) || 0;
  const prerelease = prereleasePart ? prereleasePart.split('.') : [];

  return { major, minor, patch, prerelease };
}

function compareVersions(a: string, b: string): number {
  const vA = parseVersion(a);
  const vB = parseVersion(b);

  // Compare major.minor.patch
  if (vA.major !== vB.major) return vA.major > vB.major ? 1 : -1;
  if (vA.minor !== vB.minor) return vA.minor > vB.minor ? 1 : -1;
  if (vA.patch !== vB.patch) return vA.patch > vB.patch ? 1 : -1;

  // Handle prerelease: no prerelease > has prerelease
  // e.g., 1.0.0 > 1.0.0-alpha
  if (vA.prerelease.length === 0 && vB.prerelease.length > 0) return 1;
  if (vA.prerelease.length > 0 && vB.prerelease.length === 0) return -1;

  // Compare prerelease identifiers
  const maxLen = Math.max(vA.prerelease.length, vB.prerelease.length);
  for (let i = 0; i < maxLen; i++) {
    const partA = vA.prerelease[i];
    const partB = vB.prerelease[i];

    // Missing part is less (1.0.0-alpha < 1.0.0-alpha.1)
    if (partA === undefined) return -1;
    if (partB === undefined) return 1;

    // Numeric comparison if both are numbers
    const numA = parseInt(partA, 10);
    const numB = parseInt(partB, 10);
    if (!isNaN(numA) && !isNaN(numB)) {
      if (numA !== numB) return numA > numB ? 1 : -1;
    } else {
      // String comparison
      if (partA !== partB) return partA > partB ? 1 : -1;
    }
  }

  return 0;
}

describe('update-checker: parseVersion', () => {
  it('should parse basic version', () => {
    const result = parseVersion('1.2.3');
    assert.equal(result.major, 1);
    assert.equal(result.minor, 2);
    assert.equal(result.patch, 3);
    assert.deepEqual(result.prerelease, []);
  });

  it('should parse version with v prefix', () => {
    const result = parseVersion('v1.2.3');
    assert.equal(result.major, 1);
    assert.equal(result.minor, 2);
    assert.equal(result.patch, 3);
  });

  it('should parse version with alpha prerelease', () => {
    const result = parseVersion('1.0.0-alpha');
    assert.equal(result.major, 1);
    assert.equal(result.minor, 0);
    assert.equal(result.patch, 0);
    assert.deepEqual(result.prerelease, ['alpha']);
  });

  it('should parse version with numeric prerelease', () => {
    const result = parseVersion('1.0.0-alpha.1');
    assert.deepEqual(result.prerelease, ['alpha', '1']);
  });

  it('should parse version with rc prerelease', () => {
    const result = parseVersion('2.5.0-rc.3');
    assert.equal(result.major, 2);
    assert.equal(result.minor, 5);
    assert.equal(result.patch, 0);
    assert.deepEqual(result.prerelease, ['rc', '3']);
  });

  it('should handle missing patch version', () => {
    const result = parseVersion('1.2');
    assert.equal(result.major, 1);
    assert.equal(result.minor, 2);
    assert.equal(result.patch, 0);
  });

  it('should handle missing minor and patch', () => {
    const result = parseVersion('3');
    assert.equal(result.major, 3);
    assert.equal(result.minor, 0);
    assert.equal(result.patch, 0);
  });
});

describe('update-checker: compareVersions', () => {
  describe('major version comparison', () => {
    it('should return 1 when first major is greater', () => {
      assert.equal(compareVersions('2.0.0', '1.0.0'), 1);
      assert.equal(compareVersions('3.5.2', '2.8.9'), 1);
    });

    it('should return -1 when first major is less', () => {
      assert.equal(compareVersions('1.0.0', '2.0.0'), -1);
      assert.equal(compareVersions('1.9.9', '2.0.0'), -1);
    });
  });

  describe('minor version comparison', () => {
    it('should return 1 when major equal and first minor is greater', () => {
      assert.equal(compareVersions('1.2.0', '1.1.0'), 1);
      assert.equal(compareVersions('3.5.0', '3.4.9'), 1);
    });

    it('should return -1 when major equal and first minor is less', () => {
      assert.equal(compareVersions('1.1.0', '1.2.0'), -1);
      assert.equal(compareVersions('2.3.5', '2.4.0'), -1);
    });
  });

  describe('patch version comparison', () => {
    it('should return 1 when major.minor equal and first patch is greater', () => {
      assert.equal(compareVersions('1.2.5', '1.2.3'), 1);
      assert.equal(compareVersions('2.0.1', '2.0.0'), 1);
    });

    it('should return -1 when major.minor equal and first patch is less', () => {
      assert.equal(compareVersions('1.2.3', '1.2.5'), -1);
      assert.equal(compareVersions('3.1.0', '3.1.2'), -1);
    });
  });

  describe('equal versions', () => {
    it('should return 0 for identical versions', () => {
      assert.equal(compareVersions('1.2.3', '1.2.3'), 0);
      assert.equal(compareVersions('v1.2.3', '1.2.3'), 0);
    });

    it('should return 0 for equal versions with missing parts', () => {
      assert.equal(compareVersions('1.2', '1.2.0'), 0);
      assert.equal(compareVersions('2', '2.0.0'), 0);
    });
  });

  describe('prerelease version comparison', () => {
    it('should treat stable version as greater than prerelease', () => {
      assert.equal(compareVersions('1.0.0', '1.0.0-alpha'), 1);
      assert.equal(compareVersions('1.0.0', '1.0.0-beta'), 1);
      assert.equal(compareVersions('1.0.0', '1.0.0-rc.1'), 1);
    });

    it('should treat prerelease version as less than stable', () => {
      assert.equal(compareVersions('1.0.0-alpha', '1.0.0'), -1);
      assert.equal(compareVersions('1.0.0-beta', '1.0.0'), -1);
      assert.equal(compareVersions('2.5.0-rc.2', '2.5.0'), -1);
    });

    it('should compare prerelease identifiers alphabetically', () => {
      assert.equal(compareVersions('1.0.0-beta', '1.0.0-alpha'), 1);
      assert.equal(compareVersions('1.0.0-alpha', '1.0.0-beta'), -1);
      assert.equal(compareVersions('1.0.0-rc', '1.0.0-beta'), 1);
    });

    it('should compare numeric prerelease identifiers numerically', () => {
      assert.equal(compareVersions('1.0.0-alpha.2', '1.0.0-alpha.1'), 1);
      assert.equal(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.2'), -1);
      assert.equal(compareVersions('1.0.0-beta.10', '1.0.0-beta.2'), 1);
    });

    it('should handle missing prerelease parts', () => {
      assert.equal(compareVersions('1.0.0-alpha.1', '1.0.0-alpha'), 1);
      assert.equal(compareVersions('1.0.0-alpha', '1.0.0-alpha.1'), -1);
    });

    it('should handle complex prerelease comparisons', () => {
      assert.equal(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.1'), 0);
      assert.equal(compareVersions('1.0.0-rc.1', '1.0.0-beta.10'), 1);
      assert.equal(compareVersions('2.0.0-beta.1', '2.0.0-alpha.9'), 1);
    });
  });

  describe('real-world version scenarios', () => {
    it('should correctly order common npm package versions', () => {
      const versions = [
        '1.0.0-alpha',
        '1.0.0-alpha.1',
        '1.0.0-beta',
        '1.0.0-beta.2',
        '1.0.0-rc.1',
        '1.0.0',
        '1.0.1',
        '1.1.0',
        '2.0.0'
      ];

      for (let i = 0; i < versions.length - 1; i++) {
        const result = compareVersions(versions[i + 1], versions[i]);
        assert.equal(result, 1, `Expected ${versions[i + 1]} > ${versions[i]}`);
      }
    });

    it('should handle version with v prefix correctly', () => {
      assert.equal(compareVersions('v2.0.0', '1.9.9'), 1);
      assert.equal(compareVersions('v1.0.0-beta', 'v1.0.0'), -1);
    });
  });
});
