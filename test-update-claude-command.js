/**
 * Test update_module_claude command generation
 */
import { updateModuleClaudeTool } from './ccw/dist/tools/update-module-claude.js';

console.log('\n=== Update Module Claude Tool Test ===\n');

// Mock execSync to capture the command without executing it
let capturedCommand = null;
const originalExecSync = (await import('child_process')).execSync;

// Temporarily replace execSync
const childProcess = await import('child_process');
childProcess.execSync = function(command, options) {
  capturedCommand = command;
  console.log('Generated Command:');
  console.log(command);
  throw new Error('Test mode - command not executed');
};

// Test parameters
const testParams = {
  strategy: 'single-layer',
  path: './test-update-claude/src',
  tool: 'gemini'
  // Note: no model specified, should default to SECONDARY_MODEL
};

console.log('Test Parameters:');
console.log(JSON.stringify(testParams, null, 2));
console.log('\n');

try {
  await updateModuleClaudeTool.execute(testParams);
} catch (err) {
  if (err.message !== 'Test mode - command not executed') {
    console.error('Error:', err.message);
  }
}

// Restore original
childProcess.execSync = originalExecSync;

// Analyze the captured command
if (capturedCommand) {
  console.log('\nCommand Analysis:');
  const hasSecondaryModel = capturedCommand.includes('SECONDARY_MODEL');
  const hasCcwCli = capturedCommand.includes('ccw cli');
  const hasModeWrite = capturedCommand.includes('--mode write');
  const hasToolGemini = capturedCommand.includes('--tool gemini');

  console.log(`  ✓ Uses ccw cli: ${hasCcwCli}`);
  console.log(`  ✓ Has --mode write: ${hasModeWrite}`);
  console.log(`  ✓ Has --tool gemini: ${hasToolGemini}`);
  console.log(`  ✓ Uses SECONDARY_MODEL alias: ${hasSecondaryModel}`);

  if (hasCcwCli && hasModeWrite && hasToolGemini && hasSecondaryModel) {
    console.log('\n✅ Test PASSED - Command generation is correct!');
  } else {
    console.log('\n❌ Test FAILED - Command generation has issues');
  }
}

console.log('\n=== Test Complete ===\n');
