/**
 * Integrated WebSocket test for ask_question tool
 * This test runs a WebSocket client that connects to the running CCW server
 * and listens for A2UI surfaces
 */

import { WebSocket } from 'ws';

console.log('=== Integrated WebSocket A2UI Test ===\n');

// Step 1: Connect to WebSocket
console.log('1. Connecting to ws://127.0.0.1:3456/ws...');

const ws = new WebSocket('ws://127.0.0.1:3456/ws');

const connected = new Promise((resolve, reject) => {
  ws.on('open', () => {
    console.log('   ✓ WebSocket connected!\n');
    resolve(true);
  });
  ws.on('error', (err) => {
    console.log('   ✗ Connection error:', err.message);
    reject(err);
  });
  setTimeout(() => reject(new Error('Connection timeout')), 5000);
});

try {
  await connected;

  // Step 2: Listen for messages
  console.log('2. Listening for A2UI surface messages...\n');
  console.log('   NOTE: The CCW server running on port 3456 has its own');
  console.log('   wsClients set. This WebSocket IS connected to that server.');
  console.log('   A2UI surfaces will be received when tool is called via');
  console.log('   the same server process.\n');

  let messageCount = 0;

  ws.on('message', (data) => {
    messageCount++;
    try {
      const msg = JSON.parse(data.toString());
      console.log(`\n   📨 Message ${messageCount}:`);
      console.log(`   Type: ${msg.type}`);
      if (msg.type === 'a2ui-surface') {
        console.log(`   Surface ID: ${msg.surfaceUpdate?.surfaceId}`);
        console.log(`   Question: ${msg.surfaceUpdate?.initialState?.questionId}`);
        console.log('   ✅ A2UI SURFACE RECEIVED!');

        // Send answer back
        setTimeout(() => {
          console.log('\n   Sending answer...');
          ws.send(JSON.stringify({
            type: 'a2ui-answer',
            questionId: msg.surfaceUpdate?.initialState?.questionId,
            surfaceId: msg.surfaceUpdate?.surfaceId,
            value: true,
            cancelled: false,
            timestamp: new Date().toISOString()
          }));
          console.log('   ✓ Answer sent!\n');
        }, 500);
      }
    } catch (e) {
      console.log(`   Raw: ${data.toString().substring(0, 100)}`);
    }
  });

  // Keep connection open for 30 seconds
  console.log('3. Waiting 30 seconds for A2UI messages...');
  console.log('   To trigger, call ask_question tool through CCW server\n');

  await new Promise(resolve => setTimeout(resolve, 30000));

  console.log(`\n4. Test completed. Received ${messageCount} messages total.`);
  ws.close();

} catch (err) {
  console.error('Test failed:', err.message);
  process.exit(1);
}
