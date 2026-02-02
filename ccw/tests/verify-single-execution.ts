/**
 * Quick verification script for a specific execution ID
 */

import { getHistoryStore } from '../src/tools/cli-history-store.js';

const executionId = process.argv[2];
if (!executionId) {
  console.error('Usage: tsx verify-single-execution.ts <execution-id>');
  process.exit(1);
}

const projectPath = 'D:\\Claude_dms3';
const store = getHistoryStore(projectPath);
const conversation = store.getConversationWithNativeInfo(executionId);

if (!conversation) {
  console.log(`❌ Execution not found: ${executionId}`);
  process.exit(1);
}

console.log(`\n✅ Execution found: ${executionId}`);
console.log(`   Tool: ${conversation.tool}`);
console.log(`   Mode: ${conversation.mode}`);
console.log(`   Turns: ${conversation.turns.length}\n`);

if (conversation.turns.length > 0) {
  const turn = conversation.turns[0];
  const stdout = turn.output.stdout || '';
  const parsedOutput = turn.output.parsed_output || '';
  
  console.log('📊 Output Analysis:');
  console.log(`   stdout length: ${stdout.length}`);
  console.log(`   parsed_output length: ${parsedOutput.length}\n`);
  
  // Check if stdout is JSON lines
  const stdoutFirstLine = stdout.split('\n')[0]?.trim();
  let stdoutIsJson = false;
  if (stdoutFirstLine) {
    try {
      JSON.parse(stdoutFirstLine);
      stdoutIsJson = true;
    } catch {}
  }
  
  // Check if parsed_output is JSON lines
  const parsedFirstLine = parsedOutput.split('\n')[0]?.trim();
  let parsedIsJson = false;
  if (parsedFirstLine) {
    try {
      JSON.parse(parsedFirstLine);
      parsedIsJson = true;
    } catch {}
  }
  
  console.log('📝 Content Format:');
  console.log(`   stdout: ${stdoutIsJson ? '⚠️  JSON lines' : '✅ Plain text'}`);
  console.log(`   parsed_output: ${parsedIsJson ? '❌ JSON lines (BUG!)' : '✅ Plain text (CORRECT)'}\n`);
  
  console.log('📄 First 150 chars of parsed_output:');
  console.log(`   "${parsedOutput.substring(0, 150)}${parsedOutput.length > 150 ? '...' : ''}"\n`);
  
  if (parsedIsJson) {
    console.log('❌ ISSUE: parsed_output still contains JSON lines!');
  } else {
    console.log('✅ SUCCESS: parsed_output contains plain text');
  }
}
