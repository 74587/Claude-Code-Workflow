/**
 * Shared file reading utilities
 *
 * Extracted from read-file.ts for reuse across read_file and read_many_files tools.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { readFile as readFileAsync } from 'fs/promises';
import { join, extname } from 'path';

// Max content per file (truncate if larger)
export const MAX_CONTENT_LENGTH = 5000;
// Max files to return
export const MAX_FILES = 50;
// Max total content length
export const MAX_TOTAL_CONTENT = 50000;

// Common binary extensions to skip
export const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.exe', '.dll', '.so', '.dylib',
  '.mp3', '.mp4', '.wav', '.avi', '.mov',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.pyc', '.class', '.o', '.obj',
]);

export interface FileEntry {
  path: string;
  size: number;
  content?: string;
  truncated?: boolean;
  matches?: string[];
  totalLines?: number;
  lineRange?: { start: number; end: number };
}

export interface ReadContentOptions {
  maxLength: number;
  offset?: number;
  limit?: number;
}

export interface ReadContentResult {
  content: string;
  truncated: boolean;
  totalLines?: number;
  lineRange?: { start: number; end: number };
}

export interface ReadResult {
  files: FileEntry[];
  totalFiles: number;
  message: string;
}

/**
 * 3-state discriminated union for file read results.
 * Distinguishes between successful reads, missing files, and corrupt/unreadable files.
 */
export type FileReadResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'missing'; path: string }
  | { status: 'corrupt'; path: string; reason: string };

/**
 * Check if file is likely binary
 */
export function isBinaryFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

/**
 * Convert glob pattern to regex
 * Supports: *, ?, and brace expansion {a,b,c}
 */
export function globToRegex(pattern: string): RegExp {
  // Handle brace expansion: *.{md,json,ts} -> (?:.*\.md|.*\.json|.*\.ts)
  const braceMatch = pattern.match(/^(.*)\{([^}]+)\}(.*)$/);
  if (braceMatch) {
    const [, prefix, options, suffix] = braceMatch;
    const optionList = options.split(',').map(opt => `${prefix}${opt}${suffix}`);
    // Create a regex that matches any of the expanded patterns
    const expandedPatterns = optionList.map(opt => {
      return opt
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
    });
    return new RegExp(`^(?:${expandedPatterns.join('|')})$`, 'i');
  }

  // Standard glob conversion
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

/**
 * Check if filename matches glob pattern
 */
export function matchesPattern(filename: string, pattern: string): boolean {
  const regex = globToRegex(pattern);
  return regex.test(filename);
}

/**
 * Recursively collect files from directory
 */
export function collectFiles(
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
 * Read file content with truncation and optional line-based pagination
 */
export function readFileContent(filePath: string, options: ReadContentOptions): ReadContentResult {
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
 * Find regex matches in content with safety protections
 * - Empty string pattern = "match all" (no filtering) - returns null
 * - Dangerous patterns (zero-width matches) = "match all" for safety - returns null
 * - Validates pattern to prevent infinite loops
 * - Limits iterations to prevent ReDoS attacks
 * - Deduplicates results to prevent duplicates
 * - Reports errors instead of silent failure
 *
 * @returns Array of matching lines, null to match all content (empty string or dangerous pattern), empty array for no matches
 */
export function findMatches(content: string, pattern: string): string[] | null {
  // 1. Empty string pattern = "match all" (no filtering)
  if (!pattern || pattern.length === 0) {
    return null;
  }

  // 2. Pattern length limit
  if (pattern.length > 1000) {
    console.error('[read_file] contentPattern error: Pattern too long (max 1000 characters), returning all content');
    return null;
  }

  // 3. Dangerous pattern detection
  try {
    const testRegex = new RegExp(pattern, 'gm');
    const emptyTest = testRegex.exec('');

    if (emptyTest && emptyTest[0] === '' && emptyTest.index === 0) {
      const secondMatch = testRegex.exec('');
      if (secondMatch && secondMatch.index === 0) {
        console.warn(`[read_file] contentPattern: Dangerous pattern "${pattern.substring(0, 50)}" detected, returning all content`);
        return null;
      }
    }
  } catch (e) {
    console.error(`[read_file] contentPattern: Invalid regex pattern: ${(e as Error).message}, returning all content`);
    return null;
  }

  try {
    const regex = new RegExp(pattern, 'gm');
    const matches: string[] = [];
    const seen = new Set<string>();
    let match;
    let iterations = 0;
    let lastIndex = -1;
    const MAX_ITERATIONS = 1000;
    const MAX_MATCHES = 50;

    while ((match = regex.exec(content)) !== null && matches.length < MAX_MATCHES) {
      iterations++;

      if (iterations > MAX_ITERATIONS) {
        console.error(`[read_file] contentPattern warning: Exceeded ${MAX_ITERATIONS} iterations for pattern "${pattern.substring(0, 50)}"`);
        break;
      }

      if (match.index === lastIndex) {
        regex.lastIndex = match.index + 1;
        continue;
      }
      lastIndex = match.index;

      const lineStart = content.lastIndexOf('\n', match.index) + 1;
      const lineEnd = content.indexOf('\n', match.index);
      const line = content.substring(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();

      if (!line) continue;

      if (!seen.has(line)) {
        seen.add(line);
        matches.push(line.substring(0, 200));
      }

      if (matches.length >= 10) break;
    }

    return matches;
  } catch (error) {
    const errorMsg = (error as Error).message;
    console.error(`[read_file] contentPattern error: ${errorMsg}`);
    return [];
  }
}

/**
 * Read and parse a JSON file with 3-state result.
 * Returns 'missing' for ENOENT errors, 'corrupt' for JSON.parse errors.
 */
export async function readJsonFileEx<T = unknown>(filePath: string): Promise<FileReadResult<T>> {
  let content: string;
  try {
    content = await readFileAsync(filePath, 'utf-8');
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === 'ENOENT') {
      return { status: 'missing', path: filePath };
    }
    return { status: 'corrupt', path: filePath, reason: (err as Error).message };
  }
  // Parse after successful read (separate try for corrupt detection)
  try {
    const data = JSON.parse(content) as T;
    return { status: 'ok', data };
  } catch (err) {
    return { status: 'corrupt', path: filePath, reason: (err as Error).message };
  }
}

/**
 * Read a text file with 3-state result.
 * Returns 'missing' for ENOENT errors, 'corrupt' for other read errors.
 */
export async function readTextFileEx(filePath: string): Promise<FileReadResult<string>> {
  try {
    const content = await readFileAsync(filePath, 'utf-8');
    return { status: 'ok', data: content };
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === 'ENOENT') {
      return { status: 'missing', path: filePath };
    }
    return { status: 'corrupt', path: filePath, reason: (err as Error).message };
  }
}

/**
 * Extract data from ok state, returns null for missing/corrupt.
 */
export function toNullable<T>(result: FileReadResult<T>): T | null {
  if (result.status === 'ok') {
    return result.data;
  }
  return null;
}
