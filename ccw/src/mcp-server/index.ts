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
import { getAllToolSchemas, executeTool, executeToolWithProgress } from '../tools/index.js';
import type { ToolSchema, ToolResult } from '../types/tool.js';

const SERVER_NAME = 'ccw-tools';
const SERVER_VERSION = '6.2.0';

// Default enabled tools (core set)
const DEFAULT_TOOLS: string[] = ['write_file', 'edit_file', 'read_file', 'smart_search', 'core_memory'];

/**
 * Get list of enabled tools from environment or defaults
 */
function getEnabledTools(): string[] | null {
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
function filterTools(tools: ToolSchema[], enabledList: string[] | null): ToolSchema[] {
  if (!enabledList) return tools; // null = all tools
  return tools.filter(tool => enabledList.includes(tool.name));
}

/**
 * Format tool result for display
 */
function formatToolResult(result: unknown): string {
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
 * Create and configure the MCP server
 */
function createServer(): Server {
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
    const allTools = getAllToolSchemas().filter((tool): tool is ToolSchema => tool !== null);
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
        content: [{ type: 'text' as const, text: `Tool "${name}" is not enabled` }],
        isError: true,
      };
    }

    try {
      // For smart_search init action, use progress-aware execution
      const isInitAction = name === 'smart_search' && args?.action === 'init';

      let result: ToolResult;
      if (isInitAction) {
        // Execute with progress callback that writes to stderr
        result = await executeToolWithProgress(name, args || {}, (progress) => {
          // Output progress to stderr (visible in terminal, doesn't interfere with JSON-RPC)
          console.error(`[Progress] ${progress.percent}% - ${progress.message}`);
        });
      } else {
        result = await executeTool(name, args || {});
      }

      if (!result.success) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: formatToolResult(result.result) }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `Tool execution failed: ${errorMessage}` }],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Main server execution
 */
async function main(): Promise<void> {
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
main().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error('Server error:', errorMessage);
  process.exit(1);
});
