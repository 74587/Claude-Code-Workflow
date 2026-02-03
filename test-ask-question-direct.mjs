/**
 * Direct test of ask_question tool by importing and calling the handler
 * This runs in the same Node.js process as imports, so it tests tool execution
 * but WebSocket distribution will only work if there are actual clients connected
 */

import { handler } from './ccw/dist/tools/ask-question.js';

console.log('=== Direct ask_question Tool Test ===\n');

console.log('1. Calling ask_question handler directly...\n');

const params = {
  question: {
    id: 'direct-test-1',
    type: 'confirm',
    title: 'Direct Test Question',
    message: 'This is a direct test of the ask_question tool',
    description: 'If you see this in the frontend, the integration is working!'
  },
  timeout: 10000  // 10 second timeout
};

console.log('2. Tool parameters:', JSON.stringify(params, null, 2));
console.log('\n3. Executing tool (will wait for answer or timeout)...\n');

try {
  const result = await handler(params);

  console.log('4. Tool execution completed!\n');
  console.log('Result:', JSON.stringify(result, null, 2));

  if (result.success && !result.result.error) {
    console.log('\n✅ SUCCESS!');
    console.log('Answer received:', result.result.answers?.[0]?.value);
  } else if (result.result.error === 'Question timed out') {
    console.log('\n⏱️ TIMEOUT - No answer received within 10 seconds');
    console.log('Check if frontend dialog appeared');
  } else {
    console.log('\n❌ FAILED:', result.result.error);
  }
} catch (error) {
  console.error('\n❌ ERROR:', error);
}
