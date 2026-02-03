import { listTools, executeTool } from './ccw/dist/tools/index.js';

console.log('=== Testing ask_question Tool Registration ===\n');

// List all tools
const tools = listTools();
console.log(`Total registered tools: ${tools.length}\n`);

// Find ask_question tool
const askTool = tools.find(t => t.name === 'ask_question');

if (askTool) {
  console.log('✅ ask_question tool is registered!\n');
  console.log('Tool details:');
  console.log(JSON.stringify(askTool, null, 2));
} else {
  console.log('❌ ask_question tool NOT found');
  console.log('\nRegistered tools:', tools.map(t => t.name).join(', '));
}
