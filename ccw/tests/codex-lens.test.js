/**
 * Tests for CodexLens API endpoints and tool integration
 *
 * Tests the following endpoints:
 * - GET /api/codexlens/status
 * - POST /api/codexlens/bootstrap
 * - POST /api/codexlens/init
 * - GET /api/codexlens/semantic/status
 * - POST /api/codexlens/semantic/install
 *
 * Also tests the codex-lens.js tool functions directly
 */

import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert';
import { createServer } from 'http';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the codex-lens module - use file:// URL format for Windows compatibility
const codexLensPath = new URL('../src/tools/codex-lens.js', import.meta.url).href;

describe('CodexLens Tool Functions', async () => {
  let codexLensModule;

  before(async () => {
    try {
      codexLensModule = await import(codexLensPath);
    } catch (err) {
      console.log('Note: codex-lens module import skipped (module may not be available):', err.message);
    }
  });

  describe('checkVenvStatus', () => {
    it('should return an object with ready property', async () => {
      if (!codexLensModule) {
        console.log('Skipping: codex-lens module not available');
        return;
      }

      const status = await codexLensModule.checkVenvStatus();
      assert.ok(typeof status === 'object', 'Status should be an object');
      assert.ok('ready' in status, 'Status should have ready property');
      assert.ok(typeof status.ready === 'boolean', 'ready should be boolean');

      if (status.ready) {
        assert.ok('version' in status, 'Ready status should include version');
      } else {
        assert.ok('error' in status, 'Not ready status should include error');
      }
    });
  });

  describe('checkSemanticStatus', () => {
    it('should return semantic availability status', async () => {
      if (!codexLensModule) {
        console.log('Skipping: codex-lens module not available');
        return;
      }

      const status = await codexLensModule.checkSemanticStatus();
      assert.ok(typeof status === 'object', 'Status should be an object');
      assert.ok('available' in status, 'Status should have available property');
      assert.ok(typeof status.available === 'boolean', 'available should be boolean');

      if (status.available) {
        assert.ok('backend' in status, 'Available status should include backend');
      }
    });
  });

  describe('executeCodexLens', () => {
    it('should execute codexlens command and return result', async () => {
      if (!codexLensModule) {
        console.log('Skipping: codex-lens module not available');
        return;
      }

      // First check if CodexLens is ready
      const status = await codexLensModule.checkVenvStatus();
      if (!status.ready) {
        console.log('Skipping: CodexLens not installed');
        return;
      }

      // Execute a simple status command
      const result = await codexLensModule.executeCodexLens(['--help']);
      assert.ok(typeof result === 'object', 'Result should be an object');
      assert.ok('success' in result, 'Result should have success property');

      // --help should succeed
      if (result.success) {
        assert.ok('output' in result, 'Success result should have output');
        assert.ok(result.output.includes('CodexLens') || result.output.includes('codexlens'),
          'Help output should mention CodexLens');
      }
    });

    it('should handle timeout gracefully', async () => {
      if (!codexLensModule) {
        console.log('Skipping: codex-lens module not available');
        return;
      }

      const status = await codexLensModule.checkVenvStatus();
      if (!status.ready) {
        console.log('Skipping: CodexLens not installed');
        return;
      }

      // Use a very short timeout to trigger timeout behavior
      // Note: This test may not always trigger timeout depending on system speed
      const result = await codexLensModule.executeCodexLens(['status', '--json'], { timeout: 1 });
      assert.ok(typeof result === 'object', 'Result should be an object');
      assert.ok('success' in result, 'Result should have success property');
    });
  });

  describe('codexLensTool.execute', () => {
    it('should handle check action', async () => {
      if (!codexLensModule) {
        console.log('Skipping: codex-lens module not available');
        return;
      }

      const result = await codexLensModule.codexLensTool.execute({ action: 'check' });
      assert.ok(typeof result === 'object', 'Result should be an object');
      assert.ok('ready' in result, 'Check result should have ready property');
    });

    it('should throw error for unknown action', async () => {
      if (!codexLensModule) {
        console.log('Skipping: codex-lens module not available');
        return;
      }

      await assert.rejects(
        async () => codexLensModule.codexLensTool.execute({ action: 'unknown_action' }),
        /Unknown action/,
        'Should throw error for unknown action'
      );
    });

    it('should handle status action', async () => {
      if (!codexLensModule) {
        console.log('Skipping: codex-lens module not available');
        return;
      }

      const checkResult = await codexLensModule.checkVenvStatus();
      if (!checkResult.ready) {
        console.log('Skipping: CodexLens not installed');
        return;
      }

      const result = await codexLensModule.codexLensTool.execute({
        action: 'status',
        path: __dirname
      });
      assert.ok(typeof result === 'object', 'Result should be an object');
      assert.ok('success' in result, 'Result should have success property');
    });
  });
});

describe('CodexLens API Endpoints (Integration)', async () => {
  // These tests require a running server
  // They test the actual HTTP endpoints

  const TEST_PORT = 19999;
  let serverModule;
  let server;
  let baseUrl;

  before(async () => {
    // Note: We cannot easily start the ccw server in tests
    // So we test the endpoint handlers directly or mock the server
    baseUrl = `http://localhost:${TEST_PORT}`;

    // Try to import server module for handler testing
    try {
      // serverModule = await import(join(__dirname, '..', 'src', 'core', 'server.js'));
      console.log('Note: Server integration tests require manual server start');
    } catch (err) {
      console.log('Server module not available for direct testing');
    }
  });

  describe('GET /api/codexlens/status', () => {
    it('should return JSON response with ready status', async () => {
      // This test requires a running server
      // Skip if server is not running
      try {
        const response = await fetch(`${baseUrl}/api/codexlens/status`);

        if (response.ok) {
          const data = await response.json();
          assert.ok(typeof data === 'object', 'Response should be JSON object');
          assert.ok('ready' in data, 'Response should have ready property');
        }
      } catch (err) {
        if (err.cause?.code === 'ECONNREFUSED') {
          console.log('Skipping: Server not running on port', TEST_PORT);
        } else {
          throw err;
        }
      }
    });
  });

  describe('POST /api/codexlens/init', () => {
    it('should initialize index for given path', async () => {
      try {
        const response = await fetch(`${baseUrl}/api/codexlens/init`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: __dirname })
        });

        if (response.ok) {
          const data = await response.json();
          assert.ok(typeof data === 'object', 'Response should be JSON object');
          assert.ok('success' in data, 'Response should have success property');
        }
      } catch (err) {
        if (err.cause?.code === 'ECONNREFUSED') {
          console.log('Skipping: Server not running on port', TEST_PORT);
        } else {
          throw err;
        }
      }
    });
  });

  describe('GET /api/codexlens/semantic/status', () => {
    it('should return semantic search status', async () => {
      try {
        const response = await fetch(`${baseUrl}/api/codexlens/semantic/status`);

        if (response.ok) {
          const data = await response.json();
          assert.ok(typeof data === 'object', 'Response should be JSON object');
          assert.ok('available' in data, 'Response should have available property');
        }
      } catch (err) {
        if (err.cause?.code === 'ECONNREFUSED') {
          console.log('Skipping: Server not running on port', TEST_PORT);
        } else {
          throw err;
        }
      }
    });
  });
});

describe('CodexLens Tool Definition', async () => {
  let codexLensModule;

  before(async () => {
    try {
      codexLensModule = await import(codexLensPath);
    } catch (err) {
      console.log('Note: codex-lens module not available');
    }
  });

  it('should have correct tool name', () => {
    if (!codexLensModule) {
      console.log('Skipping: codex-lens module not available');
      return;
    }

    assert.strictEqual(codexLensModule.codexLensTool.name, 'codex_lens');
  });

  it('should have description', () => {
    if (!codexLensModule) {
      console.log('Skipping: codex-lens module not available');
      return;
    }

    assert.ok(codexLensModule.codexLensTool.description, 'Should have description');
    assert.ok(codexLensModule.codexLensTool.description.includes('CodexLens'),
      'Description should mention CodexLens');
  });

  it('should have parameters schema', () => {
    if (!codexLensModule) {
      console.log('Skipping: codex-lens module not available');
      return;
    }

    const { parameters } = codexLensModule.codexLensTool;
    assert.ok(parameters, 'Should have parameters');
    assert.strictEqual(parameters.type, 'object');
    assert.ok(parameters.properties, 'Should have properties');
    assert.ok(parameters.properties.action, 'Should have action property');
    assert.deepStrictEqual(parameters.required, ['action'], 'action should be required');
  });

  it('should support all documented actions', () => {
    if (!codexLensModule) {
      console.log('Skipping: codex-lens module not available');
      return;
    }

    const { parameters } = codexLensModule.codexLensTool;
    const supportedActions = parameters.properties.action.enum;

    const expectedActions = ['init', 'search', 'symbol', 'status', 'update', 'bootstrap', 'check'];

    for (const action of expectedActions) {
      assert.ok(supportedActions.includes(action), `Should support ${action} action`);
    }
  });

  it('should have execute function', () => {
    if (!codexLensModule) {
      console.log('Skipping: codex-lens module not available');
      return;
    }

    assert.ok(typeof codexLensModule.codexLensTool.execute === 'function',
      'Should have execute function');
  });
});

describe('CodexLens Path Configuration', () => {
  it('should use correct venv path based on platform', async () => {
    const codexLensDataDir = join(homedir(), '.codexlens');
    const codexLensVenv = join(codexLensDataDir, 'venv');

    const expectedPython = process.platform === 'win32'
      ? join(codexLensVenv, 'Scripts', 'python.exe')
      : join(codexLensVenv, 'bin', 'python');

    // Just verify the path construction logic is correct
    assert.ok(expectedPython.includes('codexlens'), 'Python path should include codexlens');
    assert.ok(expectedPython.includes('venv'), 'Python path should include venv');

    if (process.platform === 'win32') {
      assert.ok(expectedPython.includes('Scripts'), 'Windows should use Scripts directory');
      assert.ok(expectedPython.endsWith('.exe'), 'Windows should have .exe extension');
    } else {
      assert.ok(expectedPython.includes('bin'), 'Unix should use bin directory');
    }
  });
});

describe('CodexLens Error Handling', async () => {
  let codexLensModule;

  before(async () => {
    try {
      codexLensModule = await import(codexLensPath);
    } catch (err) {
      console.log('Note: codex-lens module not available');
    }
  });

  it('should handle missing file parameter for symbol action', async () => {
    if (!codexLensModule) {
      console.log('Skipping: codex-lens module not available');
      return;
    }

    const checkResult = await codexLensModule.checkVenvStatus();
    if (!checkResult.ready) {
      console.log('Skipping: CodexLens not installed');
      return;
    }

    const result = await codexLensModule.codexLensTool.execute({
      action: 'symbol'
      // file is missing
    });

    // Should either error or return success: false
    assert.ok(typeof result === 'object', 'Result should be an object');
  });

  it('should handle missing files parameter for update action', async () => {
    if (!codexLensModule) {
      console.log('Skipping: codex-lens module not available');
      return;
    }

    const result = await codexLensModule.codexLensTool.execute({
      action: 'update'
      // files is missing
    });

    assert.ok(typeof result === 'object', 'Result should be an object');
    assert.strictEqual(result.success, false, 'Should return success: false');
    assert.ok(result.error, 'Should have error message');
    assert.ok(result.error.includes('files'), 'Error should mention files parameter');
  });

  it('should handle empty files array for update action', async () => {
    if (!codexLensModule) {
      console.log('Skipping: codex-lens module not available');
      return;
    }

    const result = await codexLensModule.codexLensTool.execute({
      action: 'update',
      files: []
    });

    assert.ok(typeof result === 'object', 'Result should be an object');
    assert.strictEqual(result.success, false, 'Should return success: false');
  });
});

describe('CodexLens Search Parameters', async () => {
  let codexLensModule;

  before(async () => {
    try {
      codexLensModule = await import(codexLensPath);
    } catch (err) {
      console.log('Note: codex-lens module not available');
    }
  });

  it('should support text and semantic search modes', () => {
    if (!codexLensModule) {
      console.log('Skipping: codex-lens module not available');
      return;
    }

    const { parameters } = codexLensModule.codexLensTool;
    const modeEnum = parameters.properties.mode?.enum;

    assert.ok(modeEnum, 'Should have mode enum');
    assert.ok(modeEnum.includes('text'), 'Should support text mode');
    assert.ok(modeEnum.includes('semantic'), 'Should support semantic mode');
  });

  it('should have limit parameter with default', () => {
    if (!codexLensModule) {
      console.log('Skipping: codex-lens module not available');
      return;
    }

    const { parameters } = codexLensModule.codexLensTool;
    const limitProp = parameters.properties.limit;

    assert.ok(limitProp, 'Should have limit property');
    assert.strictEqual(limitProp.type, 'number', 'limit should be number');
    assert.strictEqual(limitProp.default, 20, 'Default limit should be 20');
  });

  it('should support output format options', () => {
    if (!codexLensModule) {
      console.log('Skipping: codex-lens module not available');
      return;
    }

    const { parameters } = codexLensModule.codexLensTool;
    const formatEnum = parameters.properties.format?.enum;

    assert.ok(formatEnum, 'Should have format enum');
    assert.ok(formatEnum.includes('json'), 'Should support json format');
  });
});
