/**
 * Test model alias resolution
 */
import { getSecondaryModel, getPrimaryModel } from './ccw/dist/tools/claude-cli-tools.js';

const testDir = process.cwd();

console.log('\n=== Model Alias Resolution Test ===\n');

// Test gemini
const geminiPrimary = getPrimaryModel(testDir, 'gemini');
const geminiSecondary = getSecondaryModel(testDir, 'gemini');
console.log('Gemini:');
console.log(`  PRIMARY_MODEL  => ${geminiPrimary}`);
console.log(`  SECONDARY_MODEL => ${geminiSecondary}`);

// Test claude
const claudePrimary = getPrimaryModel(testDir, 'claude');
const claudeSecondary = getSecondaryModel(testDir, 'claude');
console.log('\nClaude:');
console.log(`  PRIMARY_MODEL  => ${claudePrimary}`);
console.log(`  SECONDARY_MODEL => ${claudeSecondary}`);

// Test codex
const codexPrimary = getPrimaryModel(testDir, 'codex');
const codexSecondary = getSecondaryModel(testDir, 'codex');
console.log('\nCodex:');
console.log(`  PRIMARY_MODEL  => ${codexPrimary}`);
console.log(`  SECONDARY_MODEL => ${codexSecondary}`);

console.log('\n=== Test Complete ===\n');
