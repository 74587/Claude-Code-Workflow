/**
 * Core Memory Tool - MCP tool for core memory management
 * Operations: list, import, export, summary, embed, search, embed_status
 */

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';
import { getCoreMemoryStore, findMemoryAcrossProjects } from '../core/core-memory-store.js';
import * as MemoryEmbedder from '../core/memory-embedder-bridge.js';
import { StoragePaths } from '../config/storage-paths.js';
import { join } from 'path';
import { getProjectRoot } from '../utils/path-validator.js';

// Zod schemas
const OperationEnum = z.enum(['list', 'import', 'export', 'summary', 'embed', 'search', 'embed_status']);

const ParamsSchema = z.object({
  operation: OperationEnum,
  // Path parameter - highest priority for project resolution
  path: z.string().optional(),
  text: z.string().optional(),
  id: z.string().optional(),
  tool: z.enum(['gemini', 'qwen']).optional().default('gemini'),
  limit: z.number().optional().default(100),
  // Search parameters
  query: z.string().optional(),
  top_k: z.number().optional().default(10),
  min_score: z.number().optional().default(0.3),
  source_type: z.enum(['core_memory', 'workflow', 'cli_history']).optional(),
  // Embed parameters
  source_id: z.string().optional(),
  batch_size: z.number().optional().default(8),
  force: z.boolean().optional().default(false),
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

/** Compact memory info for list operation */
interface CoreMemoryCompact {
  id: string;
  preview: string;  // Truncated content/summary preview
  archived: boolean;
  updated_at: string;
}

interface ListResult {
  operation: 'list';
  memories: CoreMemoryCompact[];
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

interface EmbedResult {
  operation: 'embed';
  chunks_processed: number;
  chunks_failed: number;
  elapsed_time: number;
  message: string;
}

interface SearchResult {
  operation: 'search';
  query: string;
  matches: Array<{
    source_id: string;
    source_type: string;
    score: number;
    excerpt: string;
    restore_command: string;
  }>;
  total_matches: number;
}

interface EmbedStatusResult {
  operation: 'embed_status';
  total_chunks: number;
  embedded_chunks: number;
  pending_chunks: number;
  by_type: Record<string, { total: number; embedded: number }>;
}

type OperationResult = ListResult | ImportResult | ExportResult | SummaryResult | EmbedResult | SearchResult | EmbedStatusResult;

/**
 * Get project path - uses explicit path if provided, otherwise falls back to current working directory
 * Priority: path parameter > getProjectRoot()
 */
function getProjectPath(explicitPath?: string): string {
  if (explicitPath) {
    return explicitPath;
  }
  return getProjectRoot();
}

/**
 * Get database path for project
 */
function getDatabasePath(explicitPath?: string): string {
  const projectPath = getProjectPath(explicitPath);
  const paths = StoragePaths.project(projectPath);
  return join(paths.root, 'core-memory', 'core_memory.db');
}

/** Max preview length for list operation */
const PREVIEW_MAX_LENGTH = 100;

/**
 * Operation: list
 * List all memories with compact output
 */
function executeList(params: Params): ListResult {
  const { limit, path } = params;
  const store = getCoreMemoryStore(getProjectPath(path));
  const memories = store.getMemories({ limit }) as CoreMemory[];

  // Convert to compact format with truncated preview
  const compactMemories: CoreMemoryCompact[] = memories.map((m) => {
    const source = m.summary || m.content;
    const preview = source.length > PREVIEW_MAX_LENGTH
      ? source.substring(0, PREVIEW_MAX_LENGTH) + '...'
      : source;

    return {
      id: m.id,
      preview,
      archived: m.archived,
      updated_at: m.updated_at,
    };
  });

  return {
    operation: 'list',
    memories: compactMemories,
    total: memories.length,
  };
}

/**
 * Operation: import
 * Import text as a new memory
 */
function executeImport(params: Params): ImportResult {
  const { text, path } = params;

  if (!text || text.trim() === '') {
    throw new Error('Parameter "text" is required for import operation');
  }

  const store = getCoreMemoryStore(getProjectPath(path));
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
 * Searches current project first, then all projects if not found
 */
function executeExport(params: Params): ExportResult {
  const { id, path } = params;

  if (!id) {
    throw new Error('Parameter "id" is required for export operation');
  }

  // Try current project first (or explicit path if provided)
  const store = getCoreMemoryStore(getProjectPath(path));
  let memory = store.getMemory(id);

  // If not found, search across all projects
  if (!memory) {
    const result = findMemoryAcrossProjects(id);
    if (result) {
      memory = result.memory;
    }
  }

  if (!memory) {
    throw new Error(`Memory "${id}" not found in any project`);
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
  const { id, tool = 'gemini', path } = params;

  if (!id) {
    throw new Error('Parameter "id" is required for summary operation');
  }

  const store = getCoreMemoryStore(getProjectPath(path));
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
 * Operation: embed
 * Generate embeddings for memory chunks
 */
async function executeEmbed(params: Params): Promise<EmbedResult> {
  const { source_id, batch_size = 8, force = false, path } = params;
  const dbPath = getDatabasePath(path);

  const result = await MemoryEmbedder.generateEmbeddings(dbPath, {
    sourceId: source_id,
    batchSize: batch_size,
    force,
  });

  if (!result.success) {
    throw new Error(result.error || 'Embedding generation failed');
  }

  return {
    operation: 'embed',
    chunks_processed: result.chunks_processed,
    chunks_failed: result.chunks_failed,
    elapsed_time: result.elapsed_time,
    message: `Successfully processed ${result.chunks_processed} chunks in ${result.elapsed_time.toFixed(2)}s`,
  };
}

/**
 * Operation: search
 * Search memory chunks using semantic search
 */
async function executeSearch(params: Params): Promise<SearchResult> {
  const { query, top_k = 10, min_score = 0.3, source_type, path } = params;

  if (!query) {
    throw new Error('Parameter "query" is required for search operation');
  }

  const dbPath = getDatabasePath(path);

  const result = await MemoryEmbedder.searchMemories(dbPath, query, {
    topK: top_k,
    minScore: min_score,
    sourceType: source_type,
  });

  if (!result.success) {
    throw new Error(result.error || 'Search failed');
  }

  return {
    operation: 'search',
    query,
    matches: result.matches.map((match) => ({
      source_id: match.source_id,
      source_type: match.source_type,
      score: match.score,
      excerpt: match.content.substring(0, 200) + (match.content.length > 200 ? '...' : ''),
      restore_command: match.restore_command,
    })),
    total_matches: result.matches.length,
  };
}

/**
 * Operation: embed_status
 * Get embedding status statistics
 */
async function executeEmbedStatus(params: Params): Promise<EmbedStatusResult> {
  const { path } = params;
  const dbPath = getDatabasePath(path);

  const result = await MemoryEmbedder.getEmbeddingStatus(dbPath);

  if (!result.success) {
    throw new Error(result.error || 'Failed to get embedding status');
  }

  return {
    operation: 'embed_status',
    total_chunks: result.total_chunks,
    embedded_chunks: result.embedded_chunks,
    pending_chunks: result.pending_chunks,
    by_type: result.by_type,
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
    case 'embed':
      return executeEmbed(params);
    case 'search':
      return executeSearch(params);
    case 'embed_status':
      return executeEmbedStatus(params);
    default:
      throw new Error(
        `Unknown operation: ${operation}. Valid operations: list, import, export, summary, embed, search, embed_status`
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
  core_memory(operation="embed", source_id="CMEM-xxx")       # Generate embeddings for memory
  core_memory(operation="search", query="authentication")    # Search memories semantically
  core_memory(operation="embed_status")                      # Check embedding status

Path parameter (highest priority):
  core_memory(operation="list", path="/path/to/project")     # Use specific project path

Memory IDs use format: CMEM-YYYYMMDD-HHMMSS`,
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['list', 'import', 'export', 'summary', 'embed', 'search', 'embed_status'],
        description: 'Operation to perform',
      },
      path: {
        type: 'string',
        description: 'Project path (highest priority - overrides auto-detected project root)',
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
      query: {
        type: 'string',
        description: 'Search query text (required for search operation)',
      },
      top_k: {
        type: 'number',
        description: 'Number of search results to return (default: 10)',
      },
      min_score: {
        type: 'number',
        description: 'Minimum similarity score threshold (default: 0.3)',
      },
      source_type: {
        type: 'string',
        enum: ['core_memory', 'workflow', 'cli_history'],
        description: 'Filter search by source type',
      },
      source_id: {
        type: 'string',
        description: 'Source ID to embed (optional for embed operation)',
      },
      batch_size: {
        type: 'number',
        description: 'Batch size for embedding generation (default: 8)',
      },
      force: {
        type: 'boolean',
        description: 'Force re-embedding even if embeddings exist (default: false)',
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
