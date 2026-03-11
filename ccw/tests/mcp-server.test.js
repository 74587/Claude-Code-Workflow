/**
 * Basic MCP server tests
 * Tests the MCP server functionality with mock requests
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverPath = join(__dirname, '../bin/ccw-mcp.js');

async function waitForServerStart(child) {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Server start timeout'));
    }, 5000);

    const onData = (data) => {
      const message = data.toString();
      if (message.includes('started')) {
        clearTimeout(timeout);
        child.stderr.off('data', onData);
        child.off('exit', onExit);
        resolve();
      }
    };

    const onExit = (code, signal) => {
      clearTimeout(timeout);
      child.stderr.off('data', onData);
      reject(new Error(`Server exited before start (code=${code}, signal=${signal})`));
    };

    child.stderr.on('data', onData);
    child.once('exit', onExit);
  });
}

describe('MCP Server', () => {
  let serverProcess;

  before(async () => {
    // Start the MCP server
    serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Wait for server to start
    await waitForServerStart(serverProcess);
  });

  after(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  it('should respond to tools/list request', async () => {
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    };

    // Send request
    serverProcess.stdin.write(JSON.stringify(request) + '\n');

    // Wait for response
    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 5000);

      serverProcess.stdout.once('data', (data) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(data.toString());
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
    });

    assert.equal(response.jsonrpc, '2.0');
    assert.equal(response.id, 1);
    assert(response.result);
    assert(Array.isArray(response.result.tools));
    assert(response.result.tools.length > 0);

    // Check that essential tools are present
    const toolNames = response.result.tools.map(t => t.name);
    assert(toolNames.includes('edit_file'));
    assert(toolNames.includes('write_file'));
    assert(toolNames.includes('smart_search'));
  });

  it('should respond to tools/call request', async () => {
    const request = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'get_modules_by_depth',
        arguments: {}
      }
    };

    // Send request
    serverProcess.stdin.write(JSON.stringify(request) + '\n');

    // Wait for response
    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 5000);

      serverProcess.stdout.once('data', (data) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(data.toString());
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
    });

    assert.equal(response.jsonrpc, '2.0');
    assert.equal(response.id, 2);
    assert(response.result);
    assert(Array.isArray(response.result.content));
    assert(response.result.content.length > 0);
    assert.equal(response.result.content[0].type, 'text');
  });

  it('should handle invalid tool name gracefully', async () => {
    const request = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'nonexistent_tool',
        arguments: {}
      }
    };

    // Send request
    serverProcess.stdin.write(JSON.stringify(request) + '\n');

    // Wait for response
    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 5000);

      serverProcess.stdout.once('data', (data) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(data.toString());
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
    });

    assert.equal(response.jsonrpc, '2.0');
    assert.equal(response.id, 3);
    assert(response.result);
    assert.equal(response.result.isError, true);
    // Error could be "not enabled" (filtered by default tools) or "not found" (all tools enabled)
    assert(response.result.content[0].text.includes('not enabled') || response.result.content[0].text.includes('not found'));
  });
  it('should exit when stdout disconnects during a request', async () => {
    const disconnectedProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    try {
      await waitForServerStart(disconnectedProcess);

      const exitPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          disconnectedProcess.kill('SIGKILL');
          reject(new Error('Server did not exit after stdout disconnect'));
        }, 1500);

        disconnectedProcess.once('exit', (code, signal) => {
          clearTimeout(timeout);
          resolve({ code, signal });
        });
      });

      // Simulate the MCP client disappearing before the server sends its response.
      disconnectedProcess.stdout.destroy();
      disconnectedProcess.stdin.write(JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/list',
        params: {}
      }) + '\n');

      const exitResult = await exitPromise;

      assert.equal(exitResult.code, 0);
      assert.equal(exitResult.signal, null);
    } finally {
      if (disconnectedProcess.exitCode === null) {
        disconnectedProcess.kill('SIGKILL');
      }
    }
  });
});
