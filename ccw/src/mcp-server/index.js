#!/usr/bin/env node
/**
 * CCW MCP Server
 * Exposes CCW tools through the Model Context Protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getAllToolSchemas, executeTool } from '../tools/index.js';

const SERVER_NAME = 'ccw-tools';
const SERVER_VERSION = '6.1.4';

// Default enabled tools (core set)
const DEFAULT_TOOLS = ['write_file', 'edit_file', 'codex_lens', 'smart_search'];

/**
 * Get list of enabled tools from environment or defaults
 */
function getEnabledTools() {
  const envTools = process.env.CCW_ENABLED_TOOLS;
  if (envTools) {
    // Support "all" to enable all tools
    if (envTools.toLowerCase() === 'all') {
      return null; // null means all tools
    }
    return envTools.split(',').map(t => t.trim()).filter(Boolean);
  }
  return DEFAULT_TOOLS;
}

/**
 * Filter tools based on enabled list
 */
function filterTools(tools, enabledList) {
  if (!enabledList) return tools; // null = all tools
  return tools.filter(tool => enabledList.includes(tool.name));
}

/**
 * Create and configure the MCP server
 */
function createServer() {
  const enabledTools = getEnabledTools();

  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  /**
   * Handler for tools/list - Returns enabled CCW tools
   */
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const allTools = getAllToolSchemas();
    const tools = filterTools(allTools, enabledTools);
    return { tools };
  });

  /**
   * Handler for tools/call - Executes a CCW tool
   */
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Check if tool is enabled
    if (enabledTools && !enabledTools.includes(name)) {
      return {
        content: [{ type: 'text', text: `Tool "${name}" is not enabled` }],
        isError: true,
      };
    }

    try {
      const result = await executeTool(name, args || {});

      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Error: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: formatToolResult(result.result) }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Tool execution failed: ${error.message}` }],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Format tool result for display
 * @param {*} result - Tool execution result
 * @returns {string} - Formatted result string
 */
function formatToolResult(result) {
  if (result === null || result === undefined) {
    return 'Tool completed successfully (no output)';
  }

  if (typeof result === 'string') {
    return result;
  }

  if (typeof result === 'object') {
    // Pretty print JSON with indentation
    return JSON.stringify(result, null, 2);
  }

  return String(result);
}

/**
 * Main server execution
 */
async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();

  // Connect server to transport
  await server.connect(transport);

  // Error handling
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.close();
    process.exit(0);
  });

  // Log server start (to stderr to not interfere with stdio protocol)
  console.error(`${SERVER_NAME} v${SERVER_VERSION} started`);
}

// Run server
main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
