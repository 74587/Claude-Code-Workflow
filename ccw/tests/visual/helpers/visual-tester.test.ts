import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

import { compareSnapshots, updateBaseline } from './visual-tester.ts';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PNG } = require('pngjs') as typeof import('pngjs');

const ORIGINAL_ENV = { ...process.env };

function writeSolidPng(filePath: string, rgba: [number, number, number, number], pixelCount = 100): void {
  const size = Math.max(1, Math.floor(Math.sqrt(pixelCount)));
  const png = new PNG({ width: size, height: size });

  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = rgba[0];
    png.data[i + 1] = rgba[1];
    png.data[i + 2] = rgba[2];
    png.data[i + 3] = rgba[3];
  }

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, PNG.sync.write(png));
}

describe('visual-tester helpers', () => {
  const snapshotRoot = mkdtempSync(join(tmpdir(), 'ccw-visual-snapshots-'));

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, CCW_VISUAL_SNAPSHOT_ROOT: snapshotRoot };
  });

  after(() => {
    process.env = ORIGINAL_ENV;
    rmSync(snapshotRoot, { recursive: true, force: true });
  });

  it('updates baseline from current snapshots', () => {
    const currentPath = join(snapshotRoot, 'current', 'baseline-copy.png');
    writeSolidPng(currentPath, [10, 20, 30, 255]);

    const baselinePath = updateBaseline('baseline-copy');
    assert.deepEqual(readFileSync(baselinePath), readFileSync(currentPath));
  });

  it('compares identical PNGs as pass', () => {
    const baselinePath = join(snapshotRoot, 'baseline', 'same.png');
    const currentPath = join(snapshotRoot, 'current', 'same.png');
    writeSolidPng(currentPath, [255, 0, 0, 255]);
    writeSolidPng(baselinePath, [255, 0, 0, 255]);

    const result = compareSnapshots(baselinePath, currentPath);
    assert.equal(result.pass, true);
    assert.equal(result.diffPixels, 0);
  });

  it('fails and generates a diff PNG when over tolerance', () => {
    const baselinePath = join(snapshotRoot, 'baseline', 'different.png');
    const currentPath = join(snapshotRoot, 'current', 'different.png');
    writeSolidPng(baselinePath, [255, 255, 255, 255]);
    writeSolidPng(currentPath, [255, 255, 255, 255]);

    const png = PNG.sync.read(readFileSync(currentPath));
    png.data[0] = 0;
    writeFileSync(currentPath, PNG.sync.write(png));

    const result = compareSnapshots(baselinePath, currentPath, 0.1);
    assert.equal(result.pass, false);
    assert.ok(result.diffPath);
    assert.ok(readFileSync(result.diffPath!).length > 0);
  });

  it('respects configured tolerance percent', () => {
    const baselinePath = join(snapshotRoot, 'baseline', 'tolerance.png');
    const currentPath = join(snapshotRoot, 'current', 'tolerance.png');
    writeSolidPng(baselinePath, [0, 0, 0, 255]);
    writeSolidPng(currentPath, [0, 0, 0, 255]);

    const png = PNG.sync.read(readFileSync(currentPath));
    png.data[0] = 255;
    writeFileSync(currentPath, PNG.sync.write(png));

    const failResult = compareSnapshots(baselinePath, currentPath, 0.1);
    assert.equal(failResult.pass, false);

    const passResult = compareSnapshots(baselinePath, currentPath, 100);
    assert.equal(passResult.pass, true);
  });
});
