#!/usr/bin/env node
/**
 * MCP Tools Test Script
 * Tests the modified read_file and edit_file tools with parameter validation
 */

import { executeTool } from './ccw/dist/tools/index.js';

console.log('🧪 MCP Tools Test Suite\n');
console.log('Testing modified parameters:\n');

let passed = 0;
let failed = 0;

// Test helper
async function test(name, testFn) {
  try {
    await testFn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.error(`   Error: ${error.message}`);
    failed++;
  }
}

// Test 1: read_file - single file with offset/limit (should succeed)
await test('read_file: single file + offset/limit (valid)', async () => {
  const result = await executeTool('read_file', {
    paths: 'README.md',
    offset: 0,
    limit: 5
  });

  if (!result.success) {
    throw new Error(result.error);
  }
  console.log(`   → Read ${result.result.files.length} file, ${result.result.message}`);
});

// Test 2: read_file - multiple files with offset/limit (should FAIL with new validation)
await test('read_file: multiple files + offset/limit (validation error)', async () => {
  const result = await executeTool('read_file', {
    paths: ['README.md', 'package.json'],
    offset: 0,
    limit: 5
  });

  if (result.success) {
    throw new Error('Expected validation error but succeeded');
  }

  if (!result.error.includes('offset/limit')) {
    throw new Error(`Expected error message about offset/limit, got: ${result.error}`);
  }
  console.log(`   → Got expected error: ${result.error.substring(0, 60)}...`);
});

// Test 3: read_file - multiple files without offset/limit (should succeed)
await test('read_file: multiple files without offset/limit (valid)', async () => {
  const result = await executeTool('read_file', {
    paths: ['README.md', 'package.json']
  });

  if (!result.success) {
    throw new Error(result.error);
  }
  console.log(`   → Read ${result.result.files.length} files`);
});

// Test 4: edit_file - update mode with oldText/newText (should succeed)
await test('edit_file: update mode + oldText/newText (valid)', async () => {
  const result = await executeTool('edit_file', {
    path: 'README.md',
    mode: 'update',
    oldText: 'old content',
    newText: 'new content',
    dryRun: true
  });

  if (!result.success) {
    throw new Error(result.error);
  }
  console.log(`   → ${result.result.message}`);
});

// Test 5: edit_file - update mode with edits (should succeed)
await test('edit_file: update mode + edits (valid)', async () => {
  const result = await executeTool('edit_file', {
    path: 'README.md',
    mode: 'update',
    edits: [{ oldText: 'old', newText: 'new' }],
    dryRun: true
  });

  if (!result.success) {
    throw new Error(result.error);
  }
  console.log(`   → ${result.result.message}`);
});

// Test 6: edit_file - update mode with BOTH oldText/newText AND edits (should FAIL)
await test('edit_file: update mode + both oldText/newText AND edits (validation error)', async () => {
  const result = await executeTool('edit_file', {
    path: 'README.md',
    mode: 'update',
    oldText: 'old',
    newText: 'new',
    edits: [{ oldText: 'old2', newText: 'new2' }],
    dryRun: true
  });

  if (result.success) {
    throw new Error('Expected validation error but succeeded');
  }

  if (!result.error.includes('oldText/newText') && !result.error.includes('edits')) {
    throw new Error(`Expected error about oldText/newText or edits, got: ${result.error}`);
  }
  console.log(`   → Got expected error: ${result.error.substring(0, 80)}...`);
});

// Test 7: edit_file - update mode without proper parameters (should FAIL - no oldText/newText or edits)
await test('edit_file: update mode without proper parameters (validation error)', async () => {
  const result = await executeTool('edit_file', {
    path: 'README.md',
    mode: 'update'
    // Missing both oldText/newText and edits
  });

  if (result.success) {
    throw new Error('Expected validation error but succeeded');
  }
  console.log(`   → Got expected error: ${result.error.substring(0, 80)}...`);
});

// Test 8: edit_file - line mode with line mode parameters (should succeed)
await test('edit_file: line mode + line mode parameters (valid)', async () => {
  const result = await executeTool('edit_file', {
    path: 'README.md',
    mode: 'line',
    operation: 'insert_after',
    line: 1,
    text: 'new line'
  });

  if (!result.success) {
    throw new Error(result.error);
  }
  console.log(`   → ${result.result.message}`);
});

// Test 9: edit_file - line mode missing required text (should FAIL)
await test('edit_file: line mode + insert without text (validation error)', async () => {
  const result = await executeTool('edit_file', {
    path: 'README.md',
    mode: 'line',
    operation: 'insert_after',
    line: 1
    // missing 'text' parameter
  });

  if (result.success) {
    throw new Error('Expected validation error but succeeded');
  }
  console.log(`   → Got expected error: ${result.error.substring(0, 80)}...`);
});

// Summary
console.log(`\n📊 Test Results:`);
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`   📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed === 0) {
  console.log('\n🎉 All tests passed!');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${failed} test(s) failed`);
  process.exit(1);
}
