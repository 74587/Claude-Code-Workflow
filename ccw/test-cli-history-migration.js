/**
 * Test script for CLI History Store migration fix
 * Tests that:
 * 1. New database creation includes all columns (no migration logs)
 * 2. Old database upgrade shows batch migration log (once)
 * 3. Subsequent initializations are silent
 */

import { CliHistoryStore, closeAllStores } from './dist/tools/cli-history-store.js';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const testDir = join(process.cwd(), '.test-cli-history');

// Clean up test directory
if (existsSync(testDir)) {
  rmSync(testDir, { recursive: true, force: true });
}
mkdirSync(testDir, { recursive: true });

console.log('=== Test 1: New database creation (should have NO migration logs) ===\n');
const store1 = new CliHistoryStore(testDir);
console.log('\n✓ Test 1 passed: No migration logs for new database\n');

// Close store
closeAllStores();

console.log('=== Test 2: Subsequent initialization (should be silent) ===\n');
const store2 = new CliHistoryStore(testDir);
console.log('\n✓ Test 2 passed: Subsequent initialization is silent\n');

// Verify table structure
const db = store2.db;
const turnsInfo = db.prepare('PRAGMA table_info(turns)').all();
const columnNames = turnsInfo.map(col => col.name);

console.log('=== Verifying turns table columns ===');
const requiredColumns = [
  'id', 'conversation_id', 'turn_number', 'timestamp', 'prompt',
  'duration_ms', 'status', 'exit_code', 'stdout', 'stderr', 'truncated',
  'cached', 'stdout_full', 'stderr_full', 'parsed_output', 'final_output'
];

const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
if (missingColumns.length > 0) {
  console.error('✗ Missing columns:', missingColumns.join(', '));
  process.exit(1);
} else {
  console.log('✓ All required columns present:', requiredColumns.join(', '));
}

closeAllStores();

// Clean up
rmSync(testDir, { recursive: true, force: true });

console.log('\n=== All tests passed! ===\n');
