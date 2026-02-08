/**
 * Read File Tool - Read files with multi-file, directory, and regex support
 *
 * Features:
 * - Read single or multiple files
 * - Read all files in a directory (with depth control)
 * - Filter files by glob/regex pattern
 * - Content search with regex
 * - Compact output format
 */

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { resolve, isAbsolute, join, relative, extname } from 'path';
import { validatePath, getProjectRoot } from '../utils/path-validator.js';

// Max content per file (truncate if larger)
const MAX_CONTENT_LENGTH = 5000;
// Max files to return
const MAX_FILES = 50;
// Max total content length
const MAX_TOTAL_CONTENT = 50000;

// Define Zod schema for validation
const ParamsSchema = z.object({
  paths: z.union([z.string(), z.array(z.string())]).describe('File path(s) or directory'),
  pattern: z.string().optional().describe('Glob pattern to filter files (e.g., "*.ts", "**/*.js")'),
  contentPattern: z.string().optional().describe('Regex to search within file content'),
  maxDepth: z.number().default(3).describe('Max directory depth to traverse'),
  includeContent: z.boolean().default(true).describe('Include file content in result'),
  maxFiles: z.number().default(MAX_FILES).describe('Max number of files to return'),
  offset: z.number().min(0).optional().describe('Line offset to start reading from (0-based, for single file only)'),
  limit: z.number().min(1).optional().describe('Number of lines to read (for single file only)'),
}).refine((data) => {
  // Validate: offset/limit only allowed for single file mode
  const hasPagination = data.offset !== undefined || data.limit !== undefined;
  const isMultiple = Array.isArray(data.paths) && data.paths.length > 1;
  return !(hasPagination && isMultiple);
}, {
  message: 'offset/limit parameters are only supported for single file mode. Cannot use with multiple paths.',
  path: ['offset', 'limit', 'paths'],
});

type Params = z.infer<typeof ParamsSchema>;

interface FileEntry {
  path: string;
  size: number;
  content?: string;
  truncated?: boolean;
  matches?: string[];
  totalLines?: number;
  lineRange?: { start: number; end: number };
}

interface ReadResult {
  files: FileEntry[];
  totalFiles: number;
  message: string;
}

// Common binary extensions to skip
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.exe', '.dll', '.so', '.dylib',
  '.mp3', '.mp4', '.wav', '.avi', '.mov',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.pyc', '.class', '.o', '.obj',
]);

/**
 * Check if file is likely binary
 */
function isBinaryFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

/**
 * Convert glob pattern to regex
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

/**
 * Check if filename matches glob pattern
 */
function matchesPattern(filename: string, pattern: string): boolean {
  const regex = globToRegex(pattern);
  return regex.test(filename);
}

/**
 * Recursively collect files from directory
 */
function collectFiles(
  dir: string,
  pattern: string | undefined,
  maxDepth: number,
  currentDepth: number = 0
): string[] {
  if (currentDepth > maxDepth) return [];

  const files: string[] = [];

  try {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip hidden files/dirs and node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        files.push(...collectFiles(fullPath, pattern, maxDepth, currentDepth + 1));
      } else if (entry.isFile()) {
        if (!pattern || matchesPattern(entry.name, pattern)) {
          files.push(fullPath);
        }
      }
    }
  } catch {
    // Skip directories we can't read
  }

  return files;
}

interface ReadContentOptions {
  maxLength: number;
  offset?: number;
  limit?: number;
}

interface ReadContentResult {
  content: string;
  truncated: boolean;
  totalLines?: number;
  lineRange?: { start: number; end: number };
}

/**
 * Read file content with truncation and optional line-based pagination
 */
function readFileContent(filePath: string, options: ReadContentOptions): ReadContentResult {
  const { maxLength, offset, limit } = options;

  if (isBinaryFile(filePath)) {
    return { content: '[Binary file]', truncated: false };
  }

  try {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const totalLines = lines.length;

    // If offset/limit specified, use line-based pagination
    if (offset !== undefined || limit !== undefined) {
      const startLine = Math.min(offset ?? 0, totalLines);
      const endLine = limit !== undefined ? Math.min(startLine + limit, totalLines) : totalLines;
      const selectedLines = lines.slice(startLine, endLine);
      const selectedContent = selectedLines.join('\n');

      const actualEnd = endLine;
      const hasMore = actualEnd < totalLines;

      let finalContent = selectedContent;
      if (selectedContent.length > maxLength) {
        finalContent = selectedContent.substring(0, maxLength) + `\n... (+${selectedContent.length - maxLength} chars)`;
      }

      // Calculate actual line range (handle empty selection)
      const actualLineEnd = selectedLines.length > 0 ? startLine + selectedLines.length - 1 : startLine;

      return {
        content: finalContent,
        truncated: hasMore || selectedContent.length > maxLength,
        totalLines,
        lineRange: { start: startLine, end: actualLineEnd },
      };
    }

    // Default behavior: truncate by character length
    if (content.length > maxLength) {
      return {
        content: content.substring(0, maxLength) + `\n... (+${content.length - maxLength} chars)`,
        truncated: true,
        totalLines,
      };
    }
    return { content, truncated: false, totalLines };
  } catch (error) {
    return { content: `[Error: ${(error as Error).message}]`, truncated: false };
  }
}

/**
 * Find regex matches in content
 */
function findMatches(content: string, pattern: string): string[] {
  try {
    const regex = new RegExp(pattern, 'gm');
    const matches: string[] = [];
    let match;

    while ((match = regex.exec(content)) !== null && matches.length < 10) {
      // Get line containing match
      const lineStart = content.lastIndexOf('\n', match.index) + 1;
      const lineEnd = content.indexOf('\n', match.index);
      const line = content.substring(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();
      matches.push(line.substring(0, 200)); // Truncate long lines
    }

    return matches;
  } catch {
    return [];
  }
}

// Tool schema for MCP
export const schema: ToolSchema = {
  name: 'read_file',
  description: `Read files with multi-file, directory, regex support, and line-based pagination.

Usage:
  read_file(paths="file.ts")                              # Single file (full content)
  read_file(paths="file.ts", offset=100, limit=50)        # Lines 100-149 (0-based)
  read_file(paths=["a.ts", "b.ts"])                       # Multiple files
  read_file(paths="src/", pattern="*.ts")                 # Directory with pattern
  read_file(paths="src/", contentPattern="TODO")          # Search content

Supports both absolute and relative paths. Relative paths are resolved from project root.
Returns compact file list with optional content. Use offset/limit for large file pagination.`,
  inputSchema: {
    type: 'object',
    properties: {
      paths: {
        oneOf: [
          { type: 'string', description: 'Single file or directory path' },
          { type: 'array', items: { type: 'string' }, description: 'Array of file paths' }
        ],
        description: 'File path(s) or directory to read',
      },
      pattern: {
        type: 'string',
        description: 'Glob pattern to filter files (e.g., "*.ts", "*.{js,ts}")',
      },
      contentPattern: {
        type: 'string',
        description: 'Regex pattern to search within file content',
      },
      maxDepth: {
        type: 'number',
        description: 'Max directory depth to traverse (default: 3)',
        default: 3,
      },
      includeContent: {
        type: 'boolean',
        description: 'Include file content in result (default: true)',
        default: true,
      },
      maxFiles: {
        type: 'number',
        description: `Max number of files to return (default: ${MAX_FILES})`,
        default: MAX_FILES,
      },
      offset: {
        type: 'number',
        description: 'Line offset to start reading from (0-based). **Only for single file mode** - validation error if used with multiple paths.',
        minimum: 0,
      },
      limit: {
        type: 'number',
        description: 'Number of lines to read. **Only for single file mode** - validation error if used with multiple paths.',
        minimum: 1,
      },
    },
    required: ['paths'],
  },
};

// Handler function
export async function handler(params: Record<string, unknown>): Promise<ToolResult<ReadResult>> {
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return { success: false, error: `Invalid params: ${parsed.error.message}` };
  }

  const {
    paths,
    pattern,
    contentPattern,
    maxDepth,
    includeContent,
    maxFiles,
    offset,
    limit,
  } = parsed.data;

  const cwd = getProjectRoot();

  // Normalize paths to array
  const inputPaths = Array.isArray(paths) ? paths : [paths];

  // Collect all files to read
  const allFiles: string[] = [];

  for (const inputPath of inputPaths) {
    const resolvedPath = await validatePath(inputPath);

    if (!existsSync(resolvedPath)) {
      continue; // Skip non-existent paths
    }

    const stat = statSync(resolvedPath);

    if (stat.isDirectory()) {
      // Collect files from directory
      const dirFiles = collectFiles(resolvedPath, pattern, maxDepth);
      allFiles.push(...dirFiles);
    } else if (stat.isFile()) {
      // Add single file (check pattern if provided)
      if (!pattern || matchesPattern(relative(cwd, resolvedPath), pattern)) {
        allFiles.push(resolvedPath);
      }
    }
  }

  // Limit files
  const limitedFiles = allFiles.slice(0, maxFiles);
  const totalFiles = allFiles.length;

  // Process files
  const files: FileEntry[] = [];
  let totalContent = 0;

  // Only apply offset/limit for single file mode
  const isSingleFile = limitedFiles.length === 1;
  const useLinePagination = isSingleFile && (offset !== undefined || limit !== undefined);

  for (const filePath of limitedFiles) {
    if (totalContent >= MAX_TOTAL_CONTENT) break;

    const stat = statSync(filePath);
    const entry: FileEntry = {
      path: relative(cwd, filePath) || filePath,
      size: stat.size,
    };

    if (includeContent) {
      const remainingSpace = MAX_TOTAL_CONTENT - totalContent;
      const maxLen = Math.min(MAX_CONTENT_LENGTH, remainingSpace);

      // Pass offset/limit only for single file mode
      const readOptions: ReadContentOptions = { maxLength: maxLen };
      if (useLinePagination) {
        if (offset !== undefined) readOptions.offset = offset;
        if (limit !== undefined) readOptions.limit = limit;
      }

      const { content, truncated, totalLines, lineRange } = readFileContent(filePath, readOptions);

      // If contentPattern provided, only include files with matches
      if (contentPattern) {
        const matches = findMatches(content, contentPattern);
        if (matches.length > 0) {
          entry.matches = matches;
          entry.content = content;
          entry.truncated = truncated;
          entry.totalLines = totalLines;
          entry.lineRange = lineRange;
          totalContent += content.length;
        } else {
          continue; // Skip files without matches
        }
      } else {
        entry.content = content;
        entry.truncated = truncated;
        entry.totalLines = totalLines;
        entry.lineRange = lineRange;
        totalContent += content.length;
      }
    }

    files.push(entry);
  }

  // Build message
  let message = `Read ${files.length} file(s)`;
  if (totalFiles > maxFiles) {
    message += ` (showing ${maxFiles} of ${totalFiles})`;
  }
  if (useLinePagination && files.length > 0 && files[0].lineRange) {
    const { start, end } = files[0].lineRange;
    message += ` [lines ${start}-${end} of ${files[0].totalLines}]`;
  }
  if (contentPattern) {
    message += ` matching "${contentPattern}"`;
  }

  return {
    success: true,
    result: {
      files,
      totalFiles,
      message,
    },
  };
}
