/**
 * Simulate frontend receiving A2UI surface
 * Tests the complete flow: Backend -> WebSocket -> "Frontend"
 */

import { WebSocket } from 'ws';
import { executeTool } from './ccw/dist/tools/index.js';

console.log('=== Frontend A2UI Simulation Test ===\n');

// Step 1: Connect WebSocket (simulating frontend)
console.log('1. Frontend connecting to WebSocket...');
const ws = new WebSocket('ws://127.0.0.1:3456/ws');

await new Promise((resolve, reject) => {
  ws.on('open', () => {
    console.log('   ✓ Frontend WebSocket connected');
    setTimeout(resolve, 300);  // Wait for server to register client
  });
  ws.on('error', reject);
  setTimeout(() => reject(new Error('Connection timeout')), 5000);
});

console.log('   ✓ Frontend registered as client\n');

// Step 2: Listen for A2UI surface (simulating frontend handler)
let surfaceReceived = false;
let receivedSurface = null;

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());

    if (message.type === 'a2ui-surface') {
      surfaceReceived = true;
      receivedSurface = message;

      console.log('3. ✅ Frontend received A2UI surface!');
      console.log('   Message structure:');
      console.log('   - type:', message.type);
      console.log('   - payload exists:', !!message.payload);
      console.log('   - timestamp:', message.timestamp);
      console.log('\n   Surface details:');
      console.log('   - surfaceId:', message.payload?.surfaceId);
      console.log('   - questionId:', message.payload?.initialState?.questionId);
      console.log('   - questionType:', message.payload?.initialState?.questionType);
      console.log('   - components:', message.payload?.components?.length);

      // Simulate user clicking "Confirm" after 1 second
      setTimeout(() => {
        console.log('\n4. Frontend sending answer (user clicked Confirm)...');
        ws.send(JSON.stringify({
          type: 'a2ui-answer',
          questionId: message.payload.initialState?.questionId,
          surfaceId: message.payload.surfaceId,
          value: true,
          cancelled: false,
          timestamp: new Date().toISOString()
        }));
        console.log('   ✓ Answer sent to backend\n');
      }, 1000);
    }
  } catch (e) {
    // Ignore non-JSON messages
  }
});

// Step 3: Execute tool (simulating backend call)
console.log('2. Backend executing ask_question tool...\n');

const toolPromise = executeTool('ask_question', {
  question: {
    id: 'frontend-sim-1',
    type: 'confirm',
    title: 'Frontend Simulation Test',
    message: 'Testing complete A2UI flow from backend to frontend',
    description: 'Click Confirm to complete the test'
  },
  timeout: 5000
});

// Wait for tool result
const result = await toolPromise;

console.log('5. Backend received result:');
console.log('   - success:', result.result.success);
console.log('   - cancelled:', result.result.cancelled);
console.log('   - answer value:', result.result.answers?.[0]?.value);
console.log('   - error:', result.result.error || 'none');

ws.close();

// Final report
console.log('\n' + '='.repeat(50));
if (surfaceReceived && result.result.success && result.result.answers?.[0]?.value === true) {
  console.log('✅ FULL INTEGRATION TEST PASSED!');
  console.log('\nVerified complete flow:');
  console.log('  1. Backend tool execution ✓');
  console.log('  2. A2UI surface generation ✓');
  console.log('  3. WebSocket message format (payload) ✓');
  console.log('  4. Frontend surface reception ✓');
  console.log('  5. User answer submission ✓');
  console.log('  6. Backend answer processing ✓');
  console.log('\n🎉 ask_question tool is fully integrated and working!');
} else {
  console.log('❌ TEST FAILED');
  console.log('Surface received:', surfaceReceived);
  console.log('Tool result:', JSON.stringify(result, null, 2));
}
console.log('='.repeat(50));
