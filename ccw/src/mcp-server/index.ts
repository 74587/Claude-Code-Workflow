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
import { getProjectRoot, getAllowedDirectories, isSandboxEnabled } from '../utils/path-validator.js';

const SERVER_NAME = 'ccw-tools';
const SERVER_VERSION = '6.2.0';

// Environment variable names for documentation
const ENV_PROJECT_ROOT = 'CCW_PROJECT_ROOT';
const ENV_ALLOWED_DIRS = 'CCW_ALLOWED_DIRS';
const STDIO_DISCONNECT_ERROR_CODES = new Set(['EPIPE', 'ERR_STREAM_DESTROYED']);

// Default enabled tools (core set - file operations, core memory, and smart search)
const DEFAULT_TOOLS: string[] = ['write_file', 'edit_file', 'read_file', 'read_many_files', 'read_outline', 'core_memory', 'smart_search'];

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
 * Detect broken stdio pipes so orphaned MCP processes can terminate cleanly.
 */
function isStdioDisconnectError(error: unknown): error is NodeJS.ErrnoException {
  if (error && typeof error === 'object') {
    const maybeErrnoError = error as NodeJS.ErrnoException;
    if (typeof maybeErrnoError.code === 'string' && STDIO_DISCONNECT_ERROR_CODES.has(maybeErrnoError.code)) {
      return true;
    }
  }

  return error instanceof Error && /broken pipe/i.test(error.message);
}

/**
 * Best-effort logging for teardown paths where stderr may already be gone.
 */
function safeStderrWrite(message: string): void {
  try {
    if (process.stderr.destroyed || !process.stderr.writable) {
      return;
    }

    process.stderr.write(`${message}\n`);
  } catch {
    // Ignore logging failures while stdio is tearing down.
  }
}

function safeLogError(prefix: string, error: unknown): void {
  if (error instanceof Error) {
    safeStderrWrite(`${prefix}: ${error.message}`);
    if (error.stack) {
      safeStderrWrite(error.stack);
    }
    return;
  }

  safeStderrWrite(`${prefix}: ${String(error)}`);
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
  let shutdownPromise: Promise<void> | null = null;

  const shutdown = (reason: string, exitCode = 0, error?: unknown): Promise<void> => {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    if (error && !isStdioDisconnectError(error)) {
      safeLogError(`[${SERVER_NAME}] ${reason}`, error);
    }

    shutdownPromise = (async () => {
      try {
        await server.close();
      } catch (closeError) {
        if (!isStdioDisconnectError(closeError)) {
          safeLogError(`[${SERVER_NAME}] Failed to close server`, closeError);
        }
      }

      process.exit(exitCode);
    })();

    return shutdownPromise;
  };

  const handleStreamClose = (streamName: string) => () => {
    void shutdown(`${streamName} disconnected`);
  };

  const handleStreamError = (streamName: string) => (error: unknown) => {
    const exitCode = isStdioDisconnectError(error) ? 0 : 1;
    void shutdown(`${streamName} stream error`, exitCode, error);
  };

  // Connect server to transport
  await server.connect(transport);

  process.stdin.once('end', handleStreamClose('stdin'));
  process.stdin.once('close', handleStreamClose('stdin'));
  process.stdin.once('error', handleStreamError('stdin'));
  process.stdout.once('close', handleStreamClose('stdout'));
  process.stdout.once('error', handleStreamError('stdout'));
  process.stderr.once('close', handleStreamClose('stderr'));
  process.stderr.once('error', handleStreamError('stderr'));

  // Error handling - stdio disconnects should terminate, other errors stay logged.
  process.on('uncaughtException', (error) => {
    if (isStdioDisconnectError(error)) {
      void shutdown('Uncaught stdio disconnect', 0, error);
      return;
    }

    safeLogError(`[${SERVER_NAME}] Uncaught exception`, error);
  });

  process.on('unhandledRejection', (reason) => {
    if (isStdioDisconnectError(reason)) {
      void shutdown('Unhandled stdio disconnect', 0, reason);
      return;
    }

    safeLogError(`[${SERVER_NAME}] Unhandled rejection`, reason);
  });

  process.on('SIGINT', async () => {
    await shutdown('Received SIGINT');
  });

  process.on('SIGTERM', async () => {
    await shutdown('Received SIGTERM');
  });

  // Log server start (to stderr to not interfere with stdio protocol)
  const projectRoot = getProjectRoot();
  const allowedDirs = getAllowedDirectories();
  const sandboxEnabled = isSandboxEnabled();
  console.error(`${SERVER_NAME} v${SERVER_VERSION} started`);
  console.error(`Project root: ${projectRoot}`);
  if (sandboxEnabled) {
    console.error(`Sandbox: ENABLED (CCW_ENABLE_SANDBOX=true)`);
    console.error(`Allowed directories: ${allowedDirs.join(', ')}`);
  } else {
    console.error(`Sandbox: DISABLED (default)`);
  }
  if (!process.env[ENV_PROJECT_ROOT]) {
    console.error(`[Warning] ${ENV_PROJECT_ROOT} not set, using process.cwd()`);
    console.error(`[Tip] Set ${ENV_PROJECT_ROOT} in your MCP config to specify project directory`);
  }
}

// Run server
main().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error('Server error:', errorMessage);
  process.exit(1);
});
