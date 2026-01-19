#!/usr/bin/env node
/**
 * Test script for codex_lens_lsp MCP tool
 * Tests the 4 LSP actions: symbol_search, find_definition, find_references, get_hover
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the tool
const toolModule = await import('./dist/tools/codex-lens-lsp.js');
const { schema, handler } = toolModule;

console.log('='.repeat(80));
console.log('CodexLens LSP Tool Test');
console.log('='.repeat(80));
console.log();

// Test 1: Schema validation
console.log('✓ Test 1: Tool Schema');
console.log(`  Name: ${schema.name}`);
console.log(`  Description: ${schema.description.substring(0, 100)}...`);
console.log(`  Input Schema: ${JSON.stringify(schema.inputSchema.required)}`);
console.log();

// Test 2: Symbol Search
console.log('✓ Test 2: Symbol Search');
try {
  const result = await handler({
    action: 'symbol_search',
    symbol_name: 'Config',
    limit: 5,
  });

  console.log(`  Success: ${result.success}`);
  if (!result.success) {
    console.log(`  Error: ${result.error}`);
  } else {
    console.log(`  Results: ${JSON.stringify(result.result, null, 2).substring(0, 200)}...`);
  }
} catch (err) {
  console.log(`  Exception: ${err.message}`);
}
console.log();

// Test 3: Find Definition
console.log('✓ Test 3: Find Definition');
try {
  const result = await handler({
    action: 'find_definition',
    symbol_name: 'executeCodexLens',
    symbol_kind: 'function',
  });

  console.log(`  Success: ${result.success}`);
  if (!result.success) {
    console.log(`  Error: ${result.error}`);
  } else {
    console.log(`  Results: ${JSON.stringify(result.result, null, 2).substring(0, 200)}...`);
  }
} catch (err) {
  console.log(`  Exception: ${err.message}`);
}
console.log();

// Test 4: Find References
console.log('✓ Test 4: Find References');
try {
  const result = await handler({
    action: 'find_references',
    symbol_name: 'ToolSchema',
  });

  console.log(`  Success: ${result.success}`);
  if (!result.success) {
    console.log(`  Error: ${result.error}`);
  } else {
    console.log(`  Results count: ${Array.isArray(result.result?.results) ? result.result.results.length : 0}`);
  }
} catch (err) {
  console.log(`  Exception: ${err.message}`);
}
console.log();

// Test 5: Get Hover
console.log('✓ Test 5: Get Hover');
try {
  const result = await handler({
    action: 'get_hover',
    symbol_name: 'handler',
  });

  console.log(`  Success: ${result.success}`);
  if (!result.success) {
    console.log(`  Error: ${result.error}`);
  } else {
    console.log(`  Results: ${JSON.stringify(result.result, null, 2).substring(0, 200)}...`);
  }
} catch (err) {
  console.log(`  Exception: ${err.message}`);
}
console.log();

// Test 6: Parameter Validation
console.log('✓ Test 6: Parameter Validation');
try {
  const result = await handler({
    action: 'symbol_search',
    // Missing required symbol_name
  });

  console.log(`  Success: ${result.success}`);
  console.log(`  Error (expected): ${result.error?.substring(0, 100)}...`);
} catch (err) {
  console.log(`  Exception (expected): ${err.message.substring(0, 100)}...`);
}
console.log();

console.log('='.repeat(80));
console.log('Tests completed!');
console.log('='.repeat(80));
