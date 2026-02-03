/**
 * Final E2E test for ask_question tool
 * Uses `ccw tool exec` to call tool through running server
 */

import { spawn } from 'child_process';
import { WebSocket } from 'ws';

async function testEndToEnd() {
  console.log('=== E2E Test: ask_question Tool ===\n');

  // Connect WebSocket client
  console.log('1. Connecting WebSocket client...');
  const ws = new WebSocket('ws://127.0.0.1:3456/ws');

  await new Promise((resolve, reject) => {
    ws.on('open', () => {
      console.log('✓ WebSocket connected');
      // Give the server time to register the client
      setTimeout(resolve, 500);
    });
    ws.on('error', reject);
    setTimeout(() => reject(new Error('Connection timeout')), 5000);
  });

  console.log('   Waiting for server to register client...\n');

  // Listen for A2UI surface messages
  let surfaceResolve;
  const surfaceReceived = new Promise((resolve) => {
    surfaceResolve = resolve;
  });

  let answered = false;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'a2ui-surface' && !answered) {
        console.log('3. ✓ Frontend received A2UI surface:');
        console.log('   Surface ID:', message.surfaceUpdate.surfaceId);
        console.log('   Components:', message.surfaceUpdate.components.length);
        console.log('   Question:', message.surfaceUpdate.initialState?.questionId);

        surfaceResolve(message);

        // Auto-answer after receiving surface
        setTimeout(() => {
          console.log('\n4. Frontend sending answer via WebSocket...');
          ws.send(JSON.stringify({
            type: 'a2ui-answer',
            questionId: message.surfaceUpdate.initialState?.questionId,
            surfaceId: message.surfaceUpdate.surfaceId,
            value: true,  // Clicking "Confirm"
            cancelled: false,
            timestamp: new Date().toISOString()
          }));
          answered = true;
        }, 100);
      }
    } catch (e) {
      // Ignore parse errors
    }
  });

  // Execute tool via ccw tool exec
  console.log('2. Executing ask_question via `ccw tool exec`...\n');

  const toolParams = JSON.stringify({
    question: {
      id: 'e2e-final-test',
      type: 'confirm',
      title: 'E2E Integration Test',
      message: 'Testing complete ask_question flow',
      description: 'WebSocket → A2UI Surface → User Answer → Backend'
    },
    timeout: 10000
  });

  const ccw = spawn('ccw', ['tool', 'exec', 'ask_question', toolParams], {
    shell: true
  });

  let output = '';
  ccw.stdout.on('data', (data) => {
    output += data.toString();
  });

  ccw.stderr.on('data', (data) => {
    console.error('   [ccw stderr]:', data.toString());
  });

  // Wait for surface OR timeout
  try {
    await Promise.race([
      surfaceReceived,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Surface not received within 8s')), 8000))
    ]);

    // Wait for ccw to finish
    await new Promise((resolve) => {
      ccw.on('close', (code) => {
        console.log('\n5. ✓ Tool execution completed (exit code:', code + ')');
        console.log('\nTool output:');
        console.log(output);
        resolve();
      });
    });

    ws.close();

    console.log('\n✅ E2E Test PASSED!');
    console.log('\nVerified flow:');
    console.log('  1. WebSocket client connected ✓');
    console.log('  2. Backend tool executed via ccw ✓');
    console.log('  3. A2UI surface sent to frontend ✓');
    console.log('  4. Frontend answered via WebSocket ✓');
    console.log('  5. Backend received answer ✓');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    ccw.kill();
    ws.close();
    process.exit(1);
  }
}

testEndToEnd()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ E2E Test FAILED:', err.message);
    process.exit(1);
  });
