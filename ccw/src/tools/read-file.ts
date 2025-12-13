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
});

type Params = z.infer<typeof ParamsSchema>;

interface FileEntry {
  path: string;
  size: number;
  content?: string;
  truncated?: boolean;
  matches?: string[];
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

/**
 * Read file content with truncation
 */
function readFileContent(filePath: string, maxLength: number): { content: string; truncated: boolean } {
  if (isBinaryFile(filePath)) {
    return { content: '[Binary file]', truncated: false };
  }

  try {
    const content = readFileSync(filePath, 'utf8');
    if (content.length > maxLength) {
      return {
        content: content.substring(0, maxLength) + `\n... (+${content.length - maxLength} chars)`,
        truncated: true
      };
    }
    return { content, truncated: false };
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
  description: `Read files with multi-file, directory, and regex support.

Usage:
  read_file(paths="file.ts")                    # Single file
  read_file(paths=["a.ts", "b.ts"])             # Multiple files
  read_file(paths="src/", pattern="*.ts")       # Directory with pattern
  read_file(paths="src/", contentPattern="TODO")  # Search content

Returns compact file list with optional content.`,
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
  } = parsed.data;

  const cwd = process.cwd();

  // Normalize paths to array
  const inputPaths = Array.isArray(paths) ? paths : [paths];

  // Collect all files to read
  const allFiles: string[] = [];

  for (const inputPath of inputPaths) {
    const resolvedPath = isAbsolute(inputPath) ? inputPath : resolve(cwd, inputPath);

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
      const { content, truncated } = readFileContent(filePath, maxLen);

      // If contentPattern provided, only include files with matches
      if (contentPattern) {
        const matches = findMatches(content, contentPattern);
        if (matches.length > 0) {
          entry.matches = matches;
          entry.content = content;
          entry.truncated = truncated;
          totalContent += content.length;
        } else {
          continue; // Skip files without matches
        }
      } else {
        entry.content = content;
        entry.truncated = truncated;
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
