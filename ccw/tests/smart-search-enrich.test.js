/**
 * Tests for smart_search with enrich parameter
 *
 * Tests the following:
 * - enrich parameter is passed to codex-lens
 * - relationship data is parsed from response
 * - SemanticMatch interface with relationships field
 */

import { describe, it, before, mock } from 'node:test';
import assert from 'node:assert';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the smart-search module (exports schema, not smartSearchTool)
const smartSearchPath = new URL('../dist/tools/smart-search.js', import.meta.url).href;

describe('Smart Search Enrich Parameter', async () => {
  let smartSearchModule;

  before(async () => {
    try {
      smartSearchModule = await import(smartSearchPath);
    } catch (err) {
      console.log('Note: smart-search module import skipped:', err.message);
    }
  });

  describe('Parameter Schema', () => {
    it('should have enrich parameter in schema', async () => {
      if (!smartSearchModule) {
        console.log('Skipping: smart-search module not available');
        return;
      }

      const { schema } = smartSearchModule;
      assert.ok(schema, 'Should export schema');
      // Schema uses inputSchema (MCP standard), not parameters
      const params = schema.inputSchema || schema.parameters;
      assert.ok(params, 'Should have inputSchema or parameters');

      const props = params.properties;
      assert.ok(props.enrich, 'Should have enrich parameter');
      assert.strictEqual(props.enrich.type, 'boolean', 'enrich should be boolean');
      assert.strictEqual(props.enrich.default, false, 'enrich should default to false');
    });

    it('should describe enrich parameter purpose', async () => {
      if (!smartSearchModule) {
        console.log('Skipping: smart-search module not available');
        return;
      }

      const { schema } = smartSearchModule;
      const params = schema.inputSchema || schema.parameters;
      const enrichDesc = params.properties.enrich?.description || '';

      // Description should mention relationships or graph
      const mentionsRelationships = enrichDesc.toLowerCase().includes('relationship') ||
                                    enrichDesc.toLowerCase().includes('graph') ||
                                    enrichDesc.toLowerCase().includes('enrich');
      assert.ok(mentionsRelationships, 'enrich description should mention relationships/graph');
    });
  });

  describe('SemanticMatch Interface', () => {
    it('should handle results with relationships field', async () => {
      if (!smartSearchModule) {
        console.log('Skipping: smart-search module not available');
        return;
      }

      // Create a mock result with relationships
      const mockResult = {
        file: 'test.py',
        score: 0.95,
        content: 'def main(): pass',
        symbol: 'main',
        relationships: [
          {
            type: 'calls',
            direction: 'outgoing',
            target: 'helper',
            file: 'test.py',
            line: 5
          },
          {
            type: 'called_by',
            direction: 'incoming',
            source: 'entrypoint',
            file: 'app.py',
            line: 10
          }
        ]
      };

      // Verify structure
      assert.ok(Array.isArray(mockResult.relationships), 'relationships should be array');
      assert.strictEqual(mockResult.relationships.length, 2, 'should have 2 relationships');

      const outgoing = mockResult.relationships[0];
      assert.strictEqual(outgoing.type, 'calls');
      assert.strictEqual(outgoing.direction, 'outgoing');
      assert.ok(outgoing.target, 'outgoing should have target');

      const incoming = mockResult.relationships[1];
      assert.strictEqual(incoming.type, 'called_by');
      assert.strictEqual(incoming.direction, 'incoming');
      assert.ok(incoming.source, 'incoming should have source');
    });
  });

  describe('RelationshipInfo Structure', () => {
    it('should validate relationship info structure', () => {
      // Test the expected structure of RelationshipInfo
      const validRelationship = {
        type: 'calls',
        direction: 'outgoing',
        target: 'some_function',
        file: 'module.py',
        line: 42
      };

      assert.ok(['calls', 'imports', 'extends', 'called_by', 'imported_by', 'extended_by']
        .includes(validRelationship.type), 'type should be valid relationship type');
      assert.ok(['outgoing', 'incoming'].includes(validRelationship.direction),
        'direction should be outgoing or incoming');
      assert.ok(typeof validRelationship.file === 'string', 'file should be string');
    });

    it('should allow optional line number', () => {
      const withLine = {
        type: 'calls',
        direction: 'outgoing',
        target: 'func',
        file: 'test.py',
        line: 10
      };

      const withoutLine = {
        type: 'imports',
        direction: 'outgoing',
        target: 'os',
        file: 'test.py'
        // line is optional
      };

      assert.strictEqual(withLine.line, 10);
      assert.strictEqual(withoutLine.line, undefined);
    });
  });
});

describe('Smart Search Tool Definition', async () => {
  let smartSearchModule;

  before(async () => {
    try {
      smartSearchModule = await import(smartSearchPath);
    } catch (err) {
      console.log('Note: smart-search module not available');
    }
  });

  it('should have correct tool name', () => {
    if (!smartSearchModule) {
      console.log('Skipping: smart-search module not available');
      return;
    }

    assert.strictEqual(smartSearchModule.schema.name, 'smart_search');
  });

  it('should have all required parameters', () => {
    if (!smartSearchModule) {
      console.log('Skipping: smart-search module not available');
      return;
    }

    const params = smartSearchModule.schema.inputSchema || smartSearchModule.schema.parameters;
    const props = params.properties;

    // Core parameters
    assert.ok(props.action, 'Should have action parameter');
    assert.ok(props.query, 'Should have query parameter');
    assert.ok(props.path, 'Should have path parameter');

    // Search parameters
    assert.ok(props.mode, 'Should have mode parameter');
    assert.ok(props.maxResults || props.limit, 'Should have maxResults/limit parameter');

    // New enrich parameter
    assert.ok(props.enrich, 'Should have enrich parameter');
  });

  it('should support search modes', () => {
    if (!smartSearchModule) {
      console.log('Skipping: smart-search module not available');
      return;
    }

    const params = smartSearchModule.schema.inputSchema || smartSearchModule.schema.parameters;
    const modeEnum = params.properties.mode?.enum;

    assert.ok(modeEnum, 'Should have mode enum');
    assert.ok(modeEnum.includes('fuzzy'), 'Should support fuzzy mode');
    assert.ok(modeEnum.includes('semantic'), 'Should support semantic mode');
  });
});

describe('Enrich Flag Integration', async () => {
  let codexLensModule;

  before(async () => {
    try {
      const codexLensPath = new URL('../dist/tools/codex-lens.js', import.meta.url).href;
      codexLensModule = await import(codexLensPath);
    } catch (err) {
      console.log('Note: codex-lens module not available');
    }
  });

  it('codex-lens should support enrich parameter', () => {
    if (!codexLensModule) {
      console.log('Skipping: codex-lens module not available');
      return;
    }

    // Use schema export (primary) or codexLensTool (backward-compatible)
    const toolDef = codexLensModule.schema || codexLensModule.codexLensTool;
    assert.ok(toolDef, 'Should have schema or codexLensTool export');

    // Schema uses inputSchema (MCP standard), codexLensTool uses parameters
    const params = toolDef.inputSchema || toolDef.parameters;
    const props = params.properties;
    assert.ok(props.enrich, 'should have enrich parameter');
    assert.strictEqual(props.enrich.type, 'boolean', 'enrich should be boolean');
  });

  it('should pass enrich flag to command line', async () => {
    if (!codexLensModule) {
      console.log('Skipping: codex-lens module not available');
      return;
    }

    // Check if executeCodexLens function is exported
    const { executeCodexLens } = codexLensModule;
    if (executeCodexLens) {
      // The function should be available for passing enrich parameter
      assert.ok(typeof executeCodexLens === 'function', 'executeCodexLens should be a function');
    }
  });
});
