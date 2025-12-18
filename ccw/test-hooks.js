#!/usr/bin/env node
/**
 * Test script for hooks integration
 * Tests the session-start hook with progressive disclosure
 */

import http from 'http';

const DASHBOARD_PORT = process.env.DASHBOARD_PORT || '3456';

async function testSessionStartHook() {
  console.log('🧪 Testing session-start hook...\n');

  const payload = JSON.stringify({
    type: 'session-start',
    sessionId: 'test-session-001',
    projectPath: process.cwd()
  });

  const options = {
    hostname: 'localhost',
    port: Number(DASHBOARD_PORT),
    path: '/api/hook?format=markdown',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('✅ Hook Response:');
          console.log('─'.repeat(80));
          console.log(`Status: ${res.statusCode}`);
          console.log(`Success: ${result.success}`);
          console.log(`Type: ${result.type}`);
          console.log(`Format: ${result.format}`);
          console.log(`Session ID: ${result.sessionId}`);
          console.log('\nContent Preview:');
          console.log('─'.repeat(80));
          if (result.content) {
            // Show first 500 characters
            const preview = result.content.substring(0, 500);
            console.log(preview);
            if (result.content.length > 500) {
              console.log(`\n... (${result.content.length - 500} more characters)`);
            }
          } else {
            console.log('(Empty content)');
          }
          console.log('─'.repeat(80));

          if (result.error) {
            console.log(`\n⚠️  Error: ${result.error}`);
          }

          resolve(result);
        } catch (error) {
          console.error('❌ Failed to parse response:', error);
          console.log('Raw response:', data);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request failed:', error.message);
      console.log('\n💡 Make sure the CCW server is running:');
      console.log('   ccw server');
      reject(error);
    });

    req.write(payload);
    req.end();
  });
}

async function testContextHook() {
  console.log('\n🧪 Testing context hook...\n');

  const payload = JSON.stringify({
    type: 'context',
    sessionId: 'test-session-002',
    projectPath: process.cwd()
  });

  const options = {
    hostname: 'localhost',
    port: Number(DASHBOARD_PORT),
    path: '/api/hook?format=json',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('✅ Context Hook Response:');
          console.log('─'.repeat(80));
          console.log(`Status: ${res.statusCode}`);
          console.log(`Success: ${result.success}`);
          console.log(`Type: ${result.type}`);
          console.log(`Format: ${result.format}`);
          console.log('─'.repeat(80));

          resolve(result);
        } catch (error) {
          console.error('❌ Failed to parse response:', error);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request failed:', error.message);
      reject(error);
    });

    req.write(payload);
    req.end();
  });
}

// Run tests
async function runTests() {
  try {
    await testSessionStartHook();
    await testContextHook();
    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Tests failed:', error);
    process.exit(1);
  }
}

runTests();
