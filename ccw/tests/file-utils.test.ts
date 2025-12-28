/**
 * Unit tests for file-utils utility module.
 *
 * Notes:
 * - Targets the runtime implementation shipped in `ccw/dist`.
 * - Uses in-memory fs stubs (no real file IO).
 */

import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('node:fs') as typeof import('node:fs');

type FsState = {
  existing: Set<string>;
  files: Map<string, string>;
  writeCalls: Array<{ path: string; content: string; encoding: string }>;
};

const state: FsState = {
  existing: new Set(),
  files: new Map(),
  writeCalls: [],
};

function key(filePath: string): string {
  return path.resolve(filePath).replace(/\\/g, '/').toLowerCase();
}

function setFile(filePath: string, content: string): void {
  state.existing.add(key(filePath));
  state.files.set(key(filePath), content);
}

const originalFs = {
  existsSync: fs.existsSync,
  readFileSync: fs.readFileSync,
  writeFileSync: fs.writeFileSync,
};

fs.existsSync = ((filePath: string) => state.existing.has(key(filePath))) as any;
fs.readFileSync = ((filePath: string, encoding: string) => {
  assert.equal(encoding, 'utf8');
  const content = state.files.get(key(filePath));
  if (content === undefined) {
    throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
  }
  return content;
}) as any;
fs.writeFileSync = ((filePath: string, content: string, encoding: string) => {
  state.writeCalls.push({ path: filePath, content: String(content), encoding: String(encoding) });
  setFile(filePath, String(content));
}) as any;

const fileUtilsUrl = new URL('../dist/utils/file-utils.js', import.meta.url).href;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mod: any;

beforeEach(() => {
  state.existing.clear();
  state.files.clear();
  state.writeCalls.length = 0;
});

describe('file-utils utility module', async () => {
  mod = await import(fileUtilsUrl);

  it('readJsonFile parses valid JSON and returns null on failures', () => {
    const jsonPath = 'C:\\tmp\\data.json';
    setFile(jsonPath, JSON.stringify({ ok: true, n: 1 }));

    assert.deepEqual(mod.readJsonFile(jsonPath), { ok: true, n: 1 });
    assert.equal(mod.readJsonFile('C:\\tmp\\missing.json'), null);

    const invalidPath = 'C:\\tmp\\invalid.json';
    setFile(invalidPath, '{');
    assert.equal(mod.readJsonFile(invalidPath), null);
  });

  it('readTextFile reads existing files and returns null when missing', () => {
    const textPath = 'C:\\tmp\\note.txt';
    setFile(textPath, 'hello');

    assert.equal(mod.readTextFile(textPath), 'hello');
    assert.equal(mod.readTextFile('C:\\tmp\\missing.txt'), null);
  });

  it('writeTextFile writes UTF-8 content', () => {
    mod.writeTextFile('C:\\tmp\\out.txt', 'content');

    assert.equal(state.writeCalls.length, 1);
    assert.deepEqual(state.writeCalls[0], {
      path: 'C:\\tmp\\out.txt',
      content: 'content',
      encoding: 'utf8',
    });
  });

  it('pathExists delegates to existsSync', () => {
    assert.equal(mod.pathExists('C:\\tmp\\nope'), false);
    setFile('C:\\tmp\\yes', '1');
    assert.equal(mod.pathExists('C:\\tmp\\yes'), true);
  });
});

after(() => {
  fs.existsSync = originalFs.existsSync;
  fs.readFileSync = originalFs.readFileSync;
  fs.writeFileSync = originalFs.writeFileSync;
});

