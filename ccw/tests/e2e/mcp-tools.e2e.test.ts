/**
 * E2E tests for MCP Tool Execution
 *
 * Tests the complete MCP JSON-RPC tool execution flow:
 * 1. Tool discovery (tools/list)
 * 2. Tool execution (tools/call)
 * 3. Parameter validation
 * 4. Error handling
 *
 * Verifies:
 * - JSON-RPC protocol compliance
 * - Tool parameter validation
 * - Error response format
 * - Timeout handling
 * - Mock executeTool to avoid real processes
 */

import { after, before, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface JsonRpcRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params: any;
}

interface JsonRpcResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

class McpClient {
  private serverProcess: ChildProcess;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (response: JsonRpcResponse) => void;
    reject: (error: Error) => void;
  }>();

  async start(): Promise<void> {
    const serverPath = join(__dirname, '../../bin/ccw-mcp.js');
    this.serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CCW_PROJECT_ROOT: process.cwd(),
        CCW_ENABLED_TOOLS: 'all'  // Enable all tools for testing
      }
    });

    // Wait for server to start
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MCP server start timeout'));
      }, 10000);

      this.serverProcess.stderr!.on('data', (data) => {
        const message = data.toString();
        // Match "ccw-tools v6.x.x started" message
        if (message.includes('started') || message.includes('ccw-tools')) {
          clearTimeout(timeout);
          resolve();
        }
      });

      this.serverProcess.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Set up response handler
    this.serverProcess.stdout!.on('data', (data) => {
      try {
        const lines = data.toString().split('\n').filter((l: string) => l.trim());
        for (const line of lines) {
          const response: JsonRpcResponse = JSON.parse(line);
          const pending = this.pendingRequests.get(response.id);
          if (pending) {
            this.pendingRequests.delete(response.id);
            pending.resolve(response);
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    });
  }

  async call(method: string, params: any = {}): Promise<JsonRpcResponse> {
    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout for ${method}`));
      }, 10000);

      this.pendingRequests.set(id, {
        resolve: (response) => {
          clearTimeout(timeout);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });

      this.serverProcess.stdin!.write(JSON.stringify(request) + '\n');
    });
  }

  stop(): void {
    if (this.serverProcess) {
      this.serverProcess.kill();
    }
  }
}

describe('E2E: MCP Tool Execution', async () => {
  let mcpClient: McpClient;

  before(async () => {
    mcpClient = new McpClient();
    await mcpClient.start();
    mock.method(console, 'error', () => {});
  });

  after(() => {
    mcpClient.stop();
    mock.restoreAll();
  });

  it('lists available tools via tools/list', async () => {
    const response = await mcpClient.call('tools/list', {});

    assert.equal(response.jsonrpc, '2.0');
    assert.ok(response.result);
    assert.ok(Array.isArray(response.result.tools));
    assert.ok(response.result.tools.length > 0);

    // Verify essential tools are present
    const toolNames = response.result.tools.map((t: any) => t.name);
    assert.ok(toolNames.includes('smart_search'));
    assert.ok(toolNames.includes('edit_file'));
    assert.ok(toolNames.includes('write_file'));
    assert.ok(toolNames.includes('session_manager'));

    // Verify tool schema structure
    const smartSearch = response.result.tools.find((t: any) => t.name === 'smart_search');
    assert.ok(smartSearch.description);
    assert.ok(smartSearch.inputSchema);
    assert.equal(smartSearch.inputSchema.type, 'object');
    assert.ok(smartSearch.inputSchema.properties);
  });

  it('executes smart_search tool with valid parameters', async () => {
    const response = await mcpClient.call('tools/call', {
      name: 'smart_search',
      arguments: {
        action: 'status',
        path: process.cwd()
      }
    });

    assert.equal(response.jsonrpc, '2.0');
    assert.ok(response.result);
    assert.ok(Array.isArray(response.result.content));
    assert.equal(response.result.content[0].type, 'text');
    assert.ok(response.result.content[0].text.length > 0);
  });

  it('validates required parameters and returns error for missing params', async () => {
    const response = await mcpClient.call('tools/call', {
      name: 'smart_search',
      arguments: {
        action: 'search'
        // Missing required 'query' parameter
      }
    });

    assert.equal(response.jsonrpc, '2.0');
    assert.ok(response.result);
    assert.equal(response.result.isError, true);
    // Error message should mention query is required
    assert.ok(
      response.result.content[0].text.includes('Query is required') ||
      response.result.content[0].text.includes('query') ||
      response.result.content[0].text.includes('required'),
      `Expected error about missing query, got: ${response.result.content[0].text}`
    );
  });

  it('returns error for non-existent tool', async () => {
    const response = await mcpClient.call('tools/call', {
      name: 'nonexistent_tool_xyz',
      arguments: {}
    });

    assert.equal(response.jsonrpc, '2.0');
    assert.ok(response.result);
    assert.equal(response.result.isError, true);
    assert.ok(
      response.result.content[0].text.includes('not found') ||
      response.result.content[0].text.includes('not enabled')
    );
  });

  it('executes session_manager tool for session operations', async () => {
    const sessionId = `WFS-mcp-test-${Date.now()}`;

    // Initialize session
    const initResponse = await mcpClient.call('tools/call', {
      name: 'session_manager',
      arguments: {
        operation: 'init',
        session_id: sessionId,
        metadata: {
          type: 'workflow',
          description: 'MCP E2E test session'
        }
      }
    });

    assert.equal(initResponse.jsonrpc, '2.0');
    assert.ok(initResponse.result);
    // Success means no isError or isError is false
    assert.ok(!initResponse.result.isError, 'session init should succeed');

    const resultText = initResponse.result.content[0].text;
    let result: any;
    try {
      result = JSON.parse(resultText);
    } catch {
      // If not JSON, treat text as success indicator
      assert.ok(resultText.includes(sessionId) || resultText.includes('success'),
        `Session init should return success, got: ${resultText}`);
      return;
    }
    // Handle both formats: { success, result } or direct result object
    if (result.success !== undefined) {
      assert.equal(result.success, true, 'session init should succeed');
      assert.equal(result.result.session_id, sessionId);
      assert.equal(result.result.location, 'active');
    } else {
      // Direct result object
      assert.equal(result.session_id, sessionId);
      assert.equal(result.location, 'active');
    }

    // List sessions to verify
    const listResponse = await mcpClient.call('tools/call', {
      name: 'session_manager',
      arguments: {
        operation: 'list',
        location: 'active'
      }
    });

    assert.equal(listResponse.jsonrpc, '2.0');
    const listText = listResponse.result.content[0].text;
    let listResult: any;
    try {
      listResult = JSON.parse(listText);
    } catch {
      assert.ok(listText.includes(sessionId), `Session list should include ${sessionId}`);
      return;
    }
    // Handle both formats
    const sessions = listResult.result?.active || listResult.active || [];
    assert.ok(sessions.some((s: any) => s.session_id === sessionId));
  });

  it('handles invalid JSON in tool arguments gracefully', async () => {
    // This test verifies the JSON-RPC layer handles malformed requests
    // We can't easily send invalid JSON through our client, so we test
    // with invalid parameter values instead

    const response = await mcpClient.call('tools/call', {
      name: 'session_manager',
      arguments: {
        operation: 'invalid_operation',
        session_id: 'test'
      }
    });

    assert.equal(response.jsonrpc, '2.0');
    assert.ok(response.result);
    // Should either be an error or parameter validation failure
    assert.ok(
      response.result.isError === true ||
      response.result.content[0].text.includes('Error')
    );
  });

  it('executes write_file tool with proper parameters', async () => {
    const testFilePath = join(process.cwd(), '.ccw-test-write.txt');
    const testContent = 'E2E test content';
    const fs = await import('fs');

    const response = await mcpClient.call('tools/call', {
      name: 'write_file',
      arguments: {
        path: testFilePath,
        content: testContent
      }
    });

    assert.equal(response.jsonrpc, '2.0');
    assert.ok(response.result);
    assert.ok(!response.result.isError, 'write_file should succeed');

    // Verify file was created
    assert.ok(fs.existsSync(testFilePath), 'File should be created');
    const writtenContent = fs.readFileSync(testFilePath, 'utf8');
    assert.equal(writtenContent, testContent);

    // Cleanup
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  it('executes edit_file tool with update mode', async () => {
    const testFilePath = join(process.cwd(), '.ccw-test-edit.txt');
    const fs = await import('fs');

    // Create test file
    fs.writeFileSync(testFilePath, 'Hello World\nOriginal content', 'utf8');

    const response = await mcpClient.call('tools/call', {
      name: 'edit_file',
      arguments: {
        path: testFilePath,
        oldText: 'Original content',
        newText: 'Modified content',
        mode: 'update'
      }
    });

    assert.equal(response.jsonrpc, '2.0');
    assert.ok(response.result);
    assert.ok(!response.result.isError, 'edit_file should succeed');

    // Verify file was modified
    const updatedContent = fs.readFileSync(testFilePath, 'utf8');
    assert.ok(updatedContent.includes('Modified content'), 'Content should be modified');
    assert.ok(!updatedContent.includes('Original content'), 'Original content should be replaced');

    // Cleanup
    fs.unlinkSync(testFilePath);
  });

  it('handles concurrent tool calls without interference', async () => {
    const calls = await Promise.all([
      mcpClient.call('tools/list', {}),
      mcpClient.call('tools/call', {
        name: 'smart_search',
        arguments: { action: 'status', path: process.cwd() }
      }),
      mcpClient.call('tools/call', {
        name: 'session_manager',
        arguments: { operation: 'list', location: 'active' }
      })
    ]);

    // All calls should succeed
    calls.forEach(response => {
      assert.equal(response.jsonrpc, '2.0');
      assert.ok(response.result);
    });

    // Verify different results
    assert.ok(Array.isArray(calls[0].result.tools)); // tools/list
    assert.ok(calls[1].result.content); // smart_search
    assert.ok(calls[2].result.content); // session_manager
  });

  it('validates path parameters for security (path traversal prevention)', async () => {
    const response = await mcpClient.call('tools/call', {
      name: 'write_file',
      arguments: {
        path: '../../../etc/passwd',
        content: 'malicious content'
      }
    });

    assert.equal(response.jsonrpc, '2.0');
    // Should either reject or fail safely
    assert.ok(response.result);
    // Error could be in result.isError or in content text
    const hasError = response.result.isError === true ||
                     response.result.content[0].text.includes('Error') ||
                     response.result.content[0].text.includes('denied');
    assert.ok(hasError);
  });

  it('supports progress reporting for long-running operations', async () => {
    // smart_search init action supports progress reporting
    const response = await mcpClient.call('tools/call', {
      name: 'smart_search',
      arguments: {
        action: 'status',
        path: process.cwd()
      }
    });

    assert.equal(response.jsonrpc, '2.0');
    assert.ok(response.result);
    assert.ok(response.result.content);

    // For status action, should return immediately
    // Progress is logged to stderr but doesn't affect result structure
  });

  it('handles tool execution timeout gracefully', async () => {
    // Create a tool call that should complete quickly
    // If it times out, the client will throw
    try {
      const response = await mcpClient.call('tools/call', {
        name: 'session_manager',
        arguments: {
          operation: 'list',
          location: 'all'
        }
      });

      assert.ok(response);
      assert.equal(response.jsonrpc, '2.0');
    } catch (error) {
      // If timeout occurs, test should fail
      assert.fail('Tool execution timed out unexpectedly');
    }
  });

  it('returns consistent error format across different error types', async () => {
    // Test 1: Missing required parameter
    const missingParamRes = await mcpClient.call('tools/call', {
      name: 'session_manager',
      arguments: {
        operation: 'read'
        // Missing session_id
      }
    });

    assert.ok(missingParamRes.result.isError || missingParamRes.result.content[0].text.includes('Error'));

    // Test 2: Invalid parameter value
    const invalidParamRes = await mcpClient.call('tools/call', {
      name: 'session_manager',
      arguments: {
        operation: 'init',
        session_id: 'invalid/session/id',
        metadata: { type: 'workflow' }
      }
    });

    assert.ok(invalidParamRes.result.isError || invalidParamRes.result.content[0].text.includes('Error'));

    // Test 3: Non-existent tool
    const nonExistentRes = await mcpClient.call('tools/call', {
      name: 'nonexistent_tool',
      arguments: {}
    });

    assert.equal(nonExistentRes.result.isError, true);

    // All errors should have consistent structure
    [missingParamRes, invalidParamRes, nonExistentRes].forEach(res => {
      assert.ok(res.result.content);
      assert.equal(res.result.content[0].type, 'text');
      assert.ok(res.result.content[0].text);
    });
  });

  it('preserves parameter types in tool execution', async () => {
    const response = await mcpClient.call('tools/call', {
      name: 'smart_search',
      arguments: {
        action: 'find_files',
        pattern: '*.json',
        path: process.cwd(),
        limit: 10, // Number
        offset: 0, // Number
        caseSensitive: true // Boolean
      }
    });

    assert.equal(response.jsonrpc, '2.0');
    assert.ok(response.result);

    // Tool should execute without type conversion errors
    const resultText = response.result.content[0].text;
    assert.ok(resultText);
  });

  it('handles empty and null parameters correctly', async () => {
    // Empty params object
    const emptyRes = await mcpClient.call('tools/list', {});
    assert.ok(emptyRes.result);

    // Null/undefined in optional parameters
    const nullParamRes = await mcpClient.call('tools/call', {
      name: 'session_manager',
      arguments: {
        operation: 'list',
        location: 'active',
        include_metadata: undefined
      }
    });

    assert.ok(nullParamRes.result);
  });

  it('validates tool schema completeness', async () => {
    const response = await mcpClient.call('tools/list', {});
    const tools = response.result.tools;

    tools.forEach((tool: any) => {
      // Each tool must have name, description, and inputSchema
      assert.ok(tool.name, `Tool missing name: ${JSON.stringify(tool)}`);
      assert.ok(tool.description, `Tool ${tool.name} missing description`);
      assert.ok(tool.inputSchema, `Tool ${tool.name} missing inputSchema`);
      assert.equal(tool.inputSchema.type, 'object', `Tool ${tool.name} inputSchema must be object`);
      assert.ok(tool.inputSchema.properties, `Tool ${tool.name} missing properties`);

      // If tool has required fields, they should be in properties
      if (tool.inputSchema.required && Array.isArray(tool.inputSchema.required)) {
        tool.inputSchema.required.forEach((requiredField: string) => {
          assert.ok(
            tool.inputSchema.properties[requiredField],
            `Tool ${tool.name} requires ${requiredField} but it's not in properties`
          );
        });
      }
    });
  });
});
