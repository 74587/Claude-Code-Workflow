/**
 * Core Memory Tool - MCP tool for core memory management
 * Operations: list, import, export, summary
 */

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';
import { getCoreMemoryStore } from '../core/core-memory-store.js';

// Zod schemas
const OperationEnum = z.enum(['list', 'import', 'export', 'summary']);

const ParamsSchema = z.object({
  operation: OperationEnum,
  text: z.string().optional(),
  id: z.string().optional(),
  tool: z.enum(['gemini', 'qwen']).optional().default('gemini'),
  limit: z.number().optional().default(100),
});

type Params = z.infer<typeof ParamsSchema>;

interface CoreMemory {
  id: string;
  content: string;
  summary: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

interface ListResult {
  operation: 'list';
  memories: CoreMemory[];
  total: number;
}

interface ImportResult {
  operation: 'import';
  id: string;
  message: string;
}

interface ExportResult {
  operation: 'export';
  id: string;
  content: string;
}

interface SummaryResult {
  operation: 'summary';
  id: string;
  summary: string;
}

type OperationResult = ListResult | ImportResult | ExportResult | SummaryResult;

/**
 * Get project path from current working directory
 */
function getProjectPath(): string {
  return process.cwd();
}

/**
 * Operation: list
 * List all memories
 */
function executeList(params: Params): ListResult {
  const { limit } = params;
  const store = getCoreMemoryStore(getProjectPath());
  const memories = store.getMemories({ limit }) as CoreMemory[];

  return {
    operation: 'list',
    memories,
    total: memories.length,
  };
}

/**
 * Operation: import
 * Import text as a new memory
 */
function executeImport(params: Params): ImportResult {
  const { text } = params;

  if (!text || text.trim() === '') {
    throw new Error('Parameter "text" is required for import operation');
  }

  const store = getCoreMemoryStore(getProjectPath());
  const memory = store.upsertMemory({
    content: text.trim(),
  });

  return {
    operation: 'import',
    id: memory.id,
    message: `Created memory: ${memory.id}`,
  };
}

/**
 * Operation: export
 * Export a memory as plain text
 */
function executeExport(params: Params): ExportResult {
  const { id } = params;

  if (!id) {
    throw new Error('Parameter "id" is required for export operation');
  }

  const store = getCoreMemoryStore(getProjectPath());
  const memory = store.getMemory(id);

  if (!memory) {
    throw new Error(`Memory "${id}" not found`);
  }

  return {
    operation: 'export',
    id,
    content: memory.content,
  };
}

/**
 * Operation: summary
 * Generate AI summary for a memory
 */
async function executeSummary(params: Params): Promise<SummaryResult> {
  const { id, tool = 'gemini' } = params;

  if (!id) {
    throw new Error('Parameter "id" is required for summary operation');
  }

  const store = getCoreMemoryStore(getProjectPath());
  const memory = store.getMemory(id);

  if (!memory) {
    throw new Error(`Memory "${id}" not found`);
  }

  const summary = await store.generateSummary(id, tool);

  return {
    operation: 'summary',
    id,
    summary,
  };
}

/**
 * Route to appropriate operation handler
 */
async function execute(params: Params): Promise<OperationResult> {
  const { operation } = params;

  switch (operation) {
    case 'list':
      return executeList(params);
    case 'import':
      return executeImport(params);
    case 'export':
      return executeExport(params);
    case 'summary':
      return executeSummary(params);
    default:
      throw new Error(
        `Unknown operation: ${operation}. Valid operations: list, import, export, summary`
      );
  }
}

// Tool schema for MCP
export const schema: ToolSchema = {
  name: 'core_memory',
  description: `Core memory management for strategic context.

Usage:
  core_memory(operation="list")                              # List all memories
  core_memory(operation="import", text="important context")  # Import text as new memory
  core_memory(operation="export", id="CMEM-xxx")             # Export memory as plain text
  core_memory(operation="summary", id="CMEM-xxx")            # Generate AI summary

Memory IDs use format: CMEM-YYYYMMDD-HHMMSS`,
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['list', 'import', 'export', 'summary'],
        description: 'Operation to perform',
      },
      text: {
        type: 'string',
        description: 'Text content to import (required for import operation)',
      },
      id: {
        type: 'string',
        description: 'Memory ID (required for export/summary operations)',
      },
      tool: {
        type: 'string',
        enum: ['gemini', 'qwen'],
        description: 'AI tool for summary generation (default: gemini)',
      },
      limit: {
        type: 'number',
        description: 'Max number of memories to list (default: 100)',
      },
    },
    required: ['operation'],
  },
};

// Handler function
export async function handler(params: Record<string, unknown>): Promise<ToolResult<OperationResult>> {
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return { success: false, error: `Invalid params: ${parsed.error.message}` };
  }

  try {
    const result = await execute(parsed.data);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
