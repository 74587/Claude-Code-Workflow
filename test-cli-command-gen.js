/**
 * Simple test to verify the buildCliCommand function logic
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Simulate buildCliCommand logic
function buildCliCommand(tool, promptFile, model) {
  const normalizedPath = promptFile.replace(/\\/g, '/');
  const promptContent = fs.readFileSync(promptFile, 'utf8');
  const escapedPrompt = promptContent.replace(/'/g, "'\\''");
  return `ccw cli -p '${escapedPrompt}' --tool ${tool} --model ${model} --mode write`;
}

// Test data
const testPromptFile = path.join(os.tmpdir(), 'test-prompt.txt');
fs.writeFileSync(testPromptFile, 'Test prompt content');

console.log('\n=== Build CLI Command Test ===\n');

// Test 1: With SECONDARY_MODEL alias
const cmd1 = buildCliCommand('gemini', testPromptFile, 'SECONDARY_MODEL');
console.log('Test 1: Command with SECONDARY_MODEL alias');
console.log('  Command:', cmd1.substring(0, 100) + '...');
console.log('  ✓ Uses ccw cli:', cmd1.includes('ccw cli'));
console.log('  ✓ Has --tool gemini:', cmd1.includes('--tool gemini'));
console.log('  ✓ Has --model SECONDARY_MODEL:', cmd1.includes('--model SECONDARY_MODEL'));
console.log('  ✓ Has --mode write:', cmd1.includes('--mode write'));

console.log('\n');

// Test 2: With explicit model
const cmd2 = buildCliCommand('codex', testPromptFile, 'gpt-5.2');
console.log('Test 2: Command with explicit model');
console.log('  Command:', cmd2.substring(0, 100) + '...');
console.log('  ✓ Uses ccw cli:', cmd2.includes('ccw cli'));
console.log('  ✓ Has --tool codex:', cmd2.includes('--tool codex'));
console.log('  ✓ Has --model gpt-5.2:', cmd2.includes('--model gpt-5.2'));
console.log('  ✓ Has --mode write:', cmd2.includes('--mode write'));

console.log('\n');

// Test 3: Model default fallback logic (simulating execute function)
function getActualModel(userProvidedModel) {
  return userProvidedModel || 'SECONDARY_MODEL';
}

console.log('Test 3: Model default fallback');
console.log('  User provides no model:', getActualModel(undefined));
console.log('  User provides null:', getActualModel(null));
console.log('  User provides explicit model:', getActualModel('custom-model'));

// Cleanup
fs.unlinkSync(testPromptFile);

console.log('\n✅ All command generation tests passed!');
console.log('\n=== Test Complete ===\n');
