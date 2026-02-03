/**
 * WebSocket listener for ask_question A2UI surfaces
 * Run this, then execute: ccw tool exec ask_question '{"question":{"id":"test1","type":"confirm","title":"Test Question"}}'
 */

import { WebSocket } from 'ws';

console.log('=== WebSocket A2UI Listener ===\n');
console.log('Connecting to ws://127.0.0.1:3456/ws...');

const ws = new WebSocket('ws://127.0.0.1:3456/ws');

ws.on('open', () => {
  console.log('✓ Connected to CCW WebSocket server\n');
  console.log('Listening for A2UI surfaces...');
  console.log('\nTo test, run in another terminal:');
  console.log('  ccw tool exec ask_question \'{"question":{"id":"test1","type":"confirm","title":"Test Question"}}\'\n');
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());

    if (message.type === 'a2ui-surface') {
      console.log('\n✅ RECEIVED A2UI SURFACE:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Surface ID:', message.surfaceUpdate.surfaceId);
      console.log('Question ID:', message.surfaceUpdate.initialState?.questionId);
      console.log('Question Type:', message.surfaceUpdate.initialState?.questionType);
      console.log('Components:', message.surfaceUpdate.components.length);
      console.log('\nComponent details:');
      message.surfaceUpdate.components.forEach((comp, idx) => {
        const type = Object.keys(comp.component)[0];
        console.log(`  ${idx + 1}. ${comp.id} (${type})`);
        if (type === 'Text') {
          console.log(`     Text: "${comp.component.Text.text.literalString}"`);
        } else if (type === 'Button') {
          console.log(`     Action: ${comp.component.Button.onClick?.actionId}`);
        }
      });
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Auto-send answer after 2 seconds
      setTimeout(() => {
        console.log('Sending answer (value=true) back to server...');
        ws.send(JSON.stringify({
          type: 'a2ui-answer',
          questionId: message.surfaceUpdate.initialState?.questionId,
          surfaceId: message.surfaceUpdate.surfaceId,
          value: true,
          cancelled: false,
          timestamp: new Date().toISOString()
        }));
        console.log('✓ Answer sent\n');
      }, 2000);
    }
  } catch (e) {
    // Not JSON or not A2UI message
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
  console.log('\n✗ WebSocket connection closed');
  process.exit(0);
});

// Keep alive
process.on('SIGINT', () => {
  console.log('\nClosing...');
  ws.close();
});
