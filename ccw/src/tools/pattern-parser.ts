/**
 * Pattern Parser - Parse @expression patterns to file lists
 * Supports glob patterns like @src/**.ts, @CLAUDE.md, @../shared/**
 */

import { glob } from 'glob';
import { resolve, isAbsolute, normalize } from 'path';
import { existsSync, statSync, readFileSync } from 'fs';

/** Result of parsing @patterns */
export interface PatternParseResult {
  files: string[];           // Matched file paths (absolute)
  patterns: string[];        // Original patterns
  errors: string[];          // Parse errors
  stats: {
    total_files: number;
    total_patterns: number;
    matched_patterns: number;
  };
}

/** Options for pattern parsing */
export interface PatternParseOptions {
  cwd?: string;              // Working directory
  includeDirs?: string[];    // Additional directories to include
  ignore?: string[];         // Ignore patterns
  maxFiles?: number;         // Max files to return (default: 1000)
  followSymlinks?: boolean;  // Follow symlinks (default: false)
}

/** Default ignore patterns */
const DEFAULT_IGNORE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/__pycache__/**',
  '**/*.pyc',
  '**/venv/**',
  '**/.venv/**',
];

/**
 * Extract pattern from @expression
 * Example: "@src/**.ts" -> "src/**.ts"
 */
function extractPattern(expression: string): string | null {
  const trimmed = expression.trim();
  if (!trimmed.startsWith('@')) {
    return null;
  }
  return trimmed.slice(1);
}

/**
 * Check if a pattern is a glob pattern or exact file
 */
function isGlobPattern(pattern: string): boolean {
  return pattern.includes('*') || pattern.includes('?') || pattern.includes('{') || pattern.includes('[');
}

/**
 * Validate that a path is within allowed directories
 */
function isPathAllowed(filePath: string, allowedDirs: string[]): boolean {
  const normalized = normalize(filePath);
  return allowedDirs.some(dir => normalized.startsWith(normalize(dir)));
}

/**
 * Build allowed directories list from options
 */
function buildAllowedDirs(cwd: string, includeDirs?: string[]): string[] {
  const allowed = [cwd];

  if (includeDirs) {
    for (const dir of includeDirs) {
      const absDir = isAbsolute(dir) ? dir : resolve(cwd, dir);
      if (existsSync(absDir) && statSync(absDir).isDirectory()) {
        allowed.push(absDir);
      }
    }
  }

  return allowed.map(d => normalize(d));
}

/**
 * Parse @expressions and return matched files
 */
export async function parsePatterns(
  patterns: string[],
  options: PatternParseOptions = {}
): Promise<PatternParseResult> {
  const {
    cwd = process.cwd(),
    includeDirs = [],
    ignore = [],
    maxFiles = 1000,
    followSymlinks = false,
  } = options;

  const result: PatternParseResult = {
    files: [],
    patterns: [],
    errors: [],
    stats: {
      total_files: 0,
      total_patterns: patterns.length,
      matched_patterns: 0,
    },
  };

  // Build allowed directories
  const allowedDirs = buildAllowedDirs(cwd, includeDirs);

  // Merge ignore patterns
  const allIgnore = [...DEFAULT_IGNORE, ...ignore];

  // Track unique files
  const fileSet = new Set<string>();

  for (const expr of patterns) {
    const pattern = extractPattern(expr);

    if (!pattern) {
      result.errors.push(`Invalid pattern: ${expr} (must start with @)`);
      continue;
    }

    result.patterns.push(pattern);

    try {
      if (isGlobPattern(pattern)) {
        // Glob pattern - use glob package
        // Determine base directory for pattern
        let baseDir = cwd;
        let globPattern = pattern;

        // Handle relative paths like ../shared/**
        if (pattern.startsWith('../') || pattern.startsWith('./')) {
          const parts = pattern.split('/');
          const pathParts: string[] = [];
          let i = 0;

          // Extract path prefix
          while (i < parts.length && (parts[i] === '..' || parts[i] === '.')) {
            pathParts.push(parts[i]);
            i++;
          }

          // Keep non-glob path parts
          while (i < parts.length && !isGlobPattern(parts[i])) {
            pathParts.push(parts[i]);
            i++;
          }

          // Resolve base directory
          if (pathParts.length > 0) {
            baseDir = resolve(cwd, pathParts.join('/'));
            globPattern = parts.slice(i).join('/') || '**/*';
          }
        }

        // Check if base directory is allowed
        if (!isPathAllowed(baseDir, allowedDirs)) {
          result.errors.push(`Pattern ${expr}: base directory not in allowed paths`);
          continue;
        }

        // Execute glob using the glob package
        const matches = await glob(globPattern, {
          cwd: baseDir,
          absolute: true,
          nodir: true,
          follow: followSymlinks,
          ignore: allIgnore,
          dot: false,
        });

        let matchCount = 0;
        for (const file of matches) {
          // Validate each file is in allowed directories
          if (isPathAllowed(file, allowedDirs)) {
            fileSet.add(file);
            matchCount++;
            if (fileSet.size >= maxFiles) break;
          }
        }

        if (matchCount > 0) {
          result.stats.matched_patterns++;
        }
      } else {
        // Exact file path
        const absPath = isAbsolute(pattern) ? pattern : resolve(cwd, pattern);

        // Validate path is allowed
        if (!isPathAllowed(absPath, allowedDirs)) {
          result.errors.push(`Pattern ${expr}: path not in allowed directories`);
          continue;
        }

        // Check file exists
        if (existsSync(absPath) && statSync(absPath).isFile()) {
          fileSet.add(absPath);
          result.stats.matched_patterns++;
        } else {
          result.errors.push(`Pattern ${expr}: file not found`);
        }
      }
    } catch (err) {
      result.errors.push(`Pattern ${expr}: ${(err as Error).message}`);
    }

    // Check max files limit
    if (fileSet.size >= maxFiles) {
      result.errors.push(`Max files limit (${maxFiles}) reached`);
      break;
    }
  }

  result.files = Array.from(fileSet);
  result.stats.total_files = result.files.length;

  return result;
}

/**
 * Pack files into a single content string with metadata headers
 */
export async function packFiles(
  files: string[],
  options: {
    includeMetadata?: boolean;
    separator?: string;
    maxFileSize?: number; // Max size per file in bytes (default: 1MB)
  } = {}
): Promise<{
  content: string;
  packedFiles: string[];
  skippedFiles: string[];
  totalBytes: number;
}> {
  const {
    includeMetadata = true,
    separator = '\n\n',
    maxFileSize = 1024 * 1024, // 1MB default
  } = options;

  const parts: string[] = [];
  const packedFiles: string[] = [];
  const skippedFiles: string[] = [];
  let totalBytes = 0;

  for (const file of files) {
    try {
      const stats = statSync(file);

      // Skip files that are too large
      if (stats.size > maxFileSize) {
        skippedFiles.push(file);
        continue;
      }

      const content = readFileSync(file, 'utf-8');

      if (includeMetadata) {
        // Add file header with metadata
        const header = [
          `=== FILE: ${file} ===`,
          `Size: ${stats.size} bytes`,
          `Modified: ${stats.mtime.toISOString()}`,
          '---',
        ].join('\n');
        parts.push(header + '\n' + content);
      } else {
        parts.push(content);
      }

      packedFiles.push(file);
      totalBytes += content.length;
    } catch {
      skippedFiles.push(file);
    }
  }

  return {
    content: parts.join(separator),
    packedFiles,
    skippedFiles,
    totalBytes,
  };
}

/**
 * Parse patterns and pack files in one call
 */
export async function parseAndPack(
  patterns: string[],
  options: PatternParseOptions & {
    includeMetadata?: boolean;
    separator?: string;
    maxFileSize?: number;
  } = {}
): Promise<{
  content: string;
  parseResult: PatternParseResult;
  packedFiles: string[];
  skippedFiles: string[];
  totalBytes: number;
}> {
  const parseResult = await parsePatterns(patterns, options);

  const packResult = await packFiles(parseResult.files, {
    includeMetadata: options.includeMetadata,
    separator: options.separator,
    maxFileSize: options.maxFileSize,
  });

  return {
    content: packResult.content,
    parseResult,
    packedFiles: packResult.packedFiles,
    skippedFiles: packResult.skippedFiles,
    totalBytes: packResult.totalBytes,
  };
}
