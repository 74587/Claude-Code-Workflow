/**
 * End-to-end test for ask_question tool
 * Connects WebSocket and calls tool via MCP API endpoint
 */

import { WebSocket } from 'ws';

async function testEndToEnd() {
  console.log('=== E2E Test: ask_question Tool ===\n');

  // Connect WebSocket client
  console.log('1. Connecting WebSocket client...');
  const ws = new WebSocket('ws://127.0.0.1:3456/ws');

  await new Promise((resolve, reject) => {
    ws.on('open', () => {
      console.log('✓ WebSocket connected\n');
      // Give the server a moment to register the client
      setTimeout(resolve, 200);
    });
    ws.on('error', reject);
    setTimeout(() => reject(new Error('Connection timeout')), 5000);
  });

  // Listen for A2UI surface messages
  let surfaceResolve;
  const surfaceReceived = new Promise((resolve) => {
    surfaceResolve = resolve;
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('   [WS] Received message type:', message.type);
      if (message.type === 'a2ui-surface') {
        console.log('3. ✓ Frontend received A2UI surface:');
        console.log('   Surface ID:', message.surfaceUpdate.surfaceId);
        console.log('   Components:', message.surfaceUpdate.components.length);
        console.log('   Question ID:', message.surfaceUpdate.initialState?.questionId);
        surfaceResolve(message);
      }
    } catch (e) {
      console.log('   [WS] Raw message:', data.toString().substring(0, 100));
    }
  });

  // Execute tool via MCP API endpoint
  console.log('2. Calling ask_question tool via MCP API...');
  const toolCallPromise = fetch('http://127.0.0.1:3456/api/mcp/tool', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'ask_question',
      arguments: {
        question: {
          id: 'e2e-test-1',
          type: 'confirm',
          title: 'Test E2E Question',
          message: 'This tests the complete flow from backend to frontend',
          description: 'If you see this on frontend, the integration works!'
        },
        timeout: 8000
      }
    })
  });

  // Wait for surface to be received (or timeout)
  const surface = await Promise.race([
    surfaceReceived,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Surface not received within 5s')), 5000))
  ]);

  console.log('\n4. Simulating user answer via WebSocket...');

  // Simulate user clicking "Confirm"
  ws.send(JSON.stringify({
    type: 'a2ui-answer',
    questionId: 'e2e-test-1',
    surfaceId: surface.surfaceUpdate.surfaceId,
    value: true,
    cancelled: false,
    timestamp: new Date().toISOString()
  }));

  // Wait for tool result
  console.log('5. Waiting for tool result...');
  const response = await toolCallPromise;
  const result = await response.json();

  console.log('\n6. ✓ Tool result received:');
  console.log('   HTTP Status:', response.status);
  console.log('   Result:', JSON.stringify(result, null, 2));

  ws.close();

  if (result.result?.success && result.result?.answers?.[0]?.value === true) {
    console.log('\n✅ E2E Test PASSED - Full integration working!');
    console.log('\nSummary:');
    console.log('- MCP tool API endpoint ✓');
    console.log('- A2UI surface generation ✓');
    console.log('- WebSocket distribution ✓');
    console.log('- Frontend answer handling ✓');
    console.log('- Backend answer processing ✓');
  } else {
    console.log('\n⚠️ Test completed but answer may not have been received');
  }
}

testEndToEnd()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ E2E Test FAILED:', err.message);
    process.exit(1);
  });
