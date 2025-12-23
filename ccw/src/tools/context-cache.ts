/**
 * Context Cache MCP Tool
 * Pack files by @patterns, cache in memory, paginated read by session ID
 *
 * Operations:
 * - pack: Parse @patterns and cache file contents
 * - read: Paginated read from cache by session ID
 * - status: Get cache/session status
 * - release: Release session cache
 * - cleanup: Cleanup expired caches
 */

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';
import { parseAndPack } from './pattern-parser.js';
import {
  getContextCacheStore,
  type CacheMetadata,
  type PagedReadResult,
  type CacheStatus,
  type SessionStatus,
} from './context-cache-store.js';

// Zod schema for parameter validation
const OperationEnum = z.enum(['pack', 'read', 'status', 'release', 'cleanup']);

const ParamsSchema = z.object({
  operation: OperationEnum,
  // Pack parameters
  patterns: z.array(z.string()).optional(),
  content: z.string().optional(), // Direct text content to cache
  session_id: z.string().optional(),
  cwd: z.string().optional(),
  include_dirs: z.array(z.string()).optional(),
  ttl: z.number().optional(),
  include_metadata: z.boolean().optional().default(true),
  max_file_size: z.number().optional(),
  // Read parameters
  offset: z.number().optional().default(0),
  limit: z.number().optional().default(65536), // 64KB default
});

type Params = z.infer<typeof ParamsSchema>;

// Result types
interface PackResult {
  operation: 'pack';
  session_id: string;
  files_packed: number;
  files_skipped: number;
  total_bytes: number;
  patterns_matched: number;
  patterns_failed: number;
  expires_at: string;
  errors?: string[];
}

interface ReadResult {
  operation: 'read';
  session_id: string;
  content: string;
  offset: number;
  limit: number;
  total_bytes: number;
  has_more: boolean;
  next_offset: number | null;
}

interface StatusResult {
  operation: 'status';
  session_id?: string;
  session?: SessionStatus;
  cache?: CacheStatus;
}

interface ReleaseResult {
  operation: 'release';
  session_id: string;
  released: boolean;
  freed_bytes: number;
}

interface CleanupResult {
  operation: 'cleanup';
  removed: number;
  remaining: number;
}

type OperationResult = PackResult | ReadResult | StatusResult | ReleaseResult | CleanupResult;

/**
 * Generate session ID if not provided
 */
function generateSessionId(): string {
  return `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Operation: pack
 * Parse @patterns and/or cache text content directly
 */
async function executePack(params: Params): Promise<PackResult> {
  const {
    patterns,
    content,
    session_id,
    cwd,
    include_dirs,
    ttl,
    include_metadata,
    max_file_size,
  } = params;

  // Require at least patterns or content
  if ((!patterns || patterns.length === 0) && !content) {
    throw new Error('Either "patterns" or "content" is required for pack operation');
  }

  const sessionId = session_id || generateSessionId();
  const store = getContextCacheStore();

  let finalContent = '';
  let filesPacked = 0;
  let filesSkipped = 0;
  let totalBytes = 0;
  let patternsMatched = 0;
  let patternsFailed = 0;
  let errors: string[] = [];
  let files: string[] = [];
  let parsedPatterns: string[] = [];

  // Pack files from patterns if provided
  if (patterns && patterns.length > 0) {
    const result = await parseAndPack(patterns, {
      cwd: cwd || process.cwd(),
      includeDirs: include_dirs,
      includeMetadata: include_metadata,
      maxFileSize: max_file_size,
    });

    finalContent = result.content;
    filesPacked = result.packedFiles.length;
    filesSkipped = result.skippedFiles.length;
    totalBytes = result.totalBytes;
    patternsMatched = result.parseResult.stats.matched_patterns;
    patternsFailed = result.parseResult.stats.total_patterns - patternsMatched;
    errors = result.parseResult.errors;
    files = result.packedFiles;
    parsedPatterns = result.parseResult.patterns;
  }

  // Append direct content if provided
  if (content) {
    if (finalContent) {
      finalContent += '\n\n=== ADDITIONAL CONTENT ===\n' + content;
    } else {
      finalContent = content;
    }
    totalBytes += Buffer.byteLength(content, 'utf-8');
  }

  // Store in cache
  const metadata: CacheMetadata = {
    files,
    patterns: parsedPatterns,
    total_bytes: totalBytes,
    file_count: filesPacked,
  };

  const entry = store.set(sessionId, finalContent, metadata, ttl);
  const expiresAt = new Date(entry.created_at + entry.ttl).toISOString();

  return {
    operation: 'pack',
    session_id: sessionId,
    files_packed: filesPacked,
    files_skipped: filesSkipped,
    total_bytes: totalBytes,
    patterns_matched: patternsMatched,
    patterns_failed: patternsFailed,
    expires_at: expiresAt,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Operation: read
 * Paginated read from cache
 */
function executeRead(params: Params): ReadResult {
  const { session_id, offset, limit } = params;

  if (!session_id) {
    throw new Error('Parameter "session_id" is required for read operation');
  }

  const store = getContextCacheStore();
  const result = store.read(session_id, offset, limit);

  if (!result) {
    throw new Error(`Session "${session_id}" not found or expired`);
  }

  return {
    operation: 'read',
    session_id,
    content: result.content,
    offset: result.offset,
    limit: result.limit,
    total_bytes: result.total_bytes,
    has_more: result.has_more,
    next_offset: result.next_offset,
  };
}

/**
 * Operation: status
 * Get session or overall cache status
 */
function executeStatus(params: Params): StatusResult {
  const { session_id } = params;
  const store = getContextCacheStore();

  if (session_id) {
    // Session-specific status
    const sessionStatus = store.getSessionStatus(session_id);
    return {
      operation: 'status',
      session_id,
      session: sessionStatus,
    };
  }

  // Overall cache status
  const cacheStatus = store.getStatus();
  return {
    operation: 'status',
    cache: cacheStatus,
  };
}

/**
 * Operation: release
 * Release session cache
 */
function executeRelease(params: Params): ReleaseResult {
  const { session_id } = params;

  if (!session_id) {
    throw new Error('Parameter "session_id" is required for release operation');
  }

  const store = getContextCacheStore();
  const result = store.release(session_id);

  return {
    operation: 'release',
    session_id,
    released: result.released,
    freed_bytes: result.freed_bytes,
  };
}

/**
 * Operation: cleanup
 * Cleanup expired caches
 */
function executeCleanup(): CleanupResult {
  const store = getContextCacheStore();
  const result = store.cleanupExpired();
  const status = store.getStatus();

  return {
    operation: 'cleanup',
    removed: result.removed,
    remaining: status.entries,
  };
}

/**
 * Route to operation handler
 */
async function execute(params: Params): Promise<OperationResult> {
  const { operation } = params;

  switch (operation) {
    case 'pack':
      return executePack(params);
    case 'read':
      return executeRead(params);
    case 'status':
      return executeStatus(params);
    case 'release':
      return executeRelease(params);
    case 'cleanup':
      return executeCleanup();
    default:
      throw new Error(
        `Unknown operation: ${operation}. Valid operations: pack, read, status, release, cleanup`
      );
  }
}

// MCP Tool Schema
export const schema: ToolSchema = {
  name: 'context_cache',
  description: `Context file cache with @pattern and text content support, paginated reading.

Usage:
  context_cache(operation="pack", patterns=["@src/**/*.ts"], session_id="...")
  context_cache(operation="pack", content="text to cache", session_id="...")
  context_cache(operation="pack", patterns=["@src/**/*.ts"], content="extra text")
  context_cache(operation="read", session_id="...", offset=0, limit=65536)
  context_cache(operation="status", session_id="...")
  context_cache(operation="release", session_id="...")
  context_cache(operation="cleanup")

Pattern syntax:
  @src/**/*.ts     - All TypeScript files in src
  @CLAUDE.md       - Specific file
  @../shared/**/*  - Sibling directory (needs include_dirs)`,
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['pack', 'read', 'status', 'release', 'cleanup'],
        description: 'Operation to perform',
      },
      patterns: {
        type: 'array',
        items: { type: 'string' },
        description: '@patterns to pack (e.g., ["@src/**/*.ts"]). Either patterns or content required for pack.',
      },
      content: {
        type: 'string',
        description: 'Direct text content to cache. Either patterns or content required for pack.',
      },
      session_id: {
        type: 'string',
        description: 'Cache session ID. Auto-generated for pack if not provided.',
      },
      cwd: {
        type: 'string',
        description: 'Working directory for pattern resolution (default: process.cwd())',
      },
      include_dirs: {
        type: 'array',
        items: { type: 'string' },
        description: 'Additional directories to include for pattern matching',
      },
      ttl: {
        type: 'number',
        description: 'Cache TTL in milliseconds (default: 1800000 = 30min)',
      },
      include_metadata: {
        type: 'boolean',
        description: 'Include file metadata headers in packed content (default: true)',
      },
      max_file_size: {
        type: 'number',
        description: 'Max file size in bytes to include (default: 1MB). Larger files are skipped.',
      },
      offset: {
        type: 'number',
        description: 'Byte offset for paginated read (default: 0)',
      },
      limit: {
        type: 'number',
        description: 'Max bytes to read (default: 65536 = 64KB)',
      },
    },
    required: ['operation'],
  },
};

// Handler function
export async function handler(
  params: Record<string, unknown>
): Promise<ToolResult<OperationResult>> {
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
