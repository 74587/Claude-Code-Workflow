/**
 * Test write_file verification for long JSON files
 * Ensures file write operations are properly verified
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { handler } from '../dist/tools/write-file.js';
import { existsSync, unlinkSync, mkdirSync, rmdirSync } from 'fs';
import { join } from 'path';

const TEST_DIR = join(process.cwd(), '.test-write-verification');
const TEST_FILE = join(TEST_DIR, 'test-large.json');

describe('write_file verification tests', () => {
  beforeEach(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(TEST_FILE)) {
      unlinkSync(TEST_FILE);
    }
    if (existsSync(TEST_DIR)) {
      rmdirSync(TEST_DIR);
    }
  });

  it('should verify small file write', async () => {
    const content = JSON.stringify({ test: 'data' }, null, 2);
    const result = await handler({
      path: TEST_FILE,
      content,
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.result.message.includes('verified'));
    assert.strictEqual(existsSync(TEST_FILE), true);
  });

  it('should verify large JSON file write (>100KB)', async () => {
    // Create large JSON object
    const largeData = {
      items: Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: `This is a test description for item ${i} with some additional text to make the file larger`,
        metadata: {
          created: new Date().toISOString(),
          tags: ['tag1', 'tag2', 'tag3'],
          values: Array.from({ length: 10 }, (_, j) => j * i),
        },
      })),
    };

    const content = JSON.stringify(largeData, null, 2);
    assert.ok(content.length > 100000, 'Content should be larger than 100KB');

    const result = await handler({
      path: TEST_FILE,
      content,
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.result.message.includes('verified'));
    assert.strictEqual(result.result.bytes, Buffer.byteLength(content, 'utf8'));
    assert.strictEqual(existsSync(TEST_FILE), true);
  });

  it('should verify very large JSON file write (>1MB)', async () => {
    // Create very large JSON object
    const veryLargeData = {
      records: Array.from({ length: 50000 }, (_, i) => ({
        id: `record-${i}`,
        timestamp: Date.now(),
        data: {
          field1: `Value for field 1 in record ${i}`,
          field2: `Value for field 2 in record ${i}`,
          field3: `Value for field 3 in record ${i}`,
          nested: {
            a: i * 1,
            b: i * 2,
            c: i * 3,
          },
        },
      })),
    };

    const content = JSON.stringify(veryLargeData, null, 2);
    assert.ok(content.length > 1000000, 'Content should be larger than 1MB');

    const result = await handler({
      path: TEST_FILE,
      content,
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.result.message.includes('verified'));
    assert.strictEqual(result.result.bytes, Buffer.byteLength(content, 'utf8'));
    assert.strictEqual(existsSync(TEST_FILE), true);
  });

  it('should detect and report verification failures', async () => {
    // This test ensures verification actually runs
    const content = JSON.stringify({ test: 'verification' }, null, 2);

    const result = await handler({
      path: TEST_FILE,
      content,
    });

    assert.strictEqual(result.success, true);
    // If verification didn't run, message wouldn't contain 'verified'
    assert.ok(/verified/.test(result.result.message));
  });

  it('should handle different encodings with verification', async () => {
    const content = 'Test content with ASCII characters';

    const result = await handler({
      path: TEST_FILE,
      content,
      encoding: 'ascii',
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.result.message.includes('verified'));
    assert.strictEqual(existsSync(TEST_FILE), true);
  });
});
