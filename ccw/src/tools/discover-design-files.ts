/**
 * Discover Design Files Tool
 * Find CSS/JS/HTML design-related files and output JSON
 */

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';
import { readdirSync, statSync, existsSync, writeFileSync } from 'fs';
import { join, resolve, relative, extname } from 'path';

// Directories to exclude
const EXCLUDE_DIRS = [
  'node_modules',
  'dist',
  '.git',
  'build',
  'coverage',
  '.cache',
  '.next',
  '.nuxt',
  '__pycache__',
  '.venv',
];

// File type patterns
const FILE_PATTERNS = {
  css: ['.css', '.scss', '.sass', '.less', '.styl'],
  js: ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.vue', '.svelte'],
  html: ['.html', '.htm'],
};

// Zod schema
const ParamsSchema = z.object({
  sourceDir: z.string().default('.'),
  outputPath: z.string().optional(),
});

type Params = z.infer<typeof ParamsSchema>;

interface DiscoveryResult {
  discovery_time: string;
  source_directory: string;
  file_types: {
    css: { count: number; files: string[] };
    js: { count: number; files: string[] };
    html: { count: number; files: string[] };
  };
  total_files: number;
}

interface ToolOutput {
  css_count: number;
  js_count: number;
  html_count: number;
  total_files: number;
  output_path: string | null;
  result: DiscoveryResult;
}

/**
 * Find files matching extensions recursively
 */
function findFiles(basePath: string, extensions: string[]): string[] {
  const results: string[] = [];

  function scan(dirPath: string): void {
    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (EXCLUDE_DIRS.includes(entry.name)) continue;
          scan(join(dirPath, entry.name));
        } else if (entry.isFile()) {
          const ext = extname(entry.name).toLowerCase();
          if (extensions.includes(ext)) {
            results.push(relative(basePath, join(dirPath, entry.name)).replace(/\\/g, '/'));
          }
        }
      }
    } catch (e) {
      // Ignore permission errors
    }
  }

  scan(basePath);
  return results.sort();
}

/**
 * Main execute function
 */
async function execute(params: Params): Promise<ToolOutput> {
  const { sourceDir = '.', outputPath } = params;

  const basePath = resolve(process.cwd(), sourceDir);

  if (!existsSync(basePath)) {
    throw new Error(`Directory not found: ${basePath}`);
  }

  if (!statSync(basePath).isDirectory()) {
    throw new Error(`Not a directory: ${basePath}`);
  }

  // Find files by type
  const cssFiles = findFiles(basePath, FILE_PATTERNS.css);
  const jsFiles = findFiles(basePath, FILE_PATTERNS.js);
  const htmlFiles = findFiles(basePath, FILE_PATTERNS.html);

  // Build result
  const result: DiscoveryResult = {
    discovery_time: new Date().toISOString(),
    source_directory: basePath,
    file_types: {
      css: {
        count: cssFiles.length,
        files: cssFiles,
      },
      js: {
        count: jsFiles.length,
        files: jsFiles,
      },
      html: {
        count: htmlFiles.length,
        files: htmlFiles,
      },
    },
    total_files: cssFiles.length + jsFiles.length + htmlFiles.length,
  };

  // Write to file if outputPath specified
  if (outputPath) {
    const outPath = resolve(process.cwd(), outputPath);
    writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
  }

  return {
    css_count: cssFiles.length,
    js_count: jsFiles.length,
    html_count: htmlFiles.length,
    total_files: result.total_files,
    output_path: outputPath || null,
    result,
  };
}

// Tool schema for MCP
export const schema: ToolSchema = {
  name: 'discover_design_files',
  description: `Discover CSS/JS/HTML design-related files in a directory.
Scans recursively and excludes common build/cache directories.
Returns JSON with file discovery results.`,
  inputSchema: {
    type: 'object',
    properties: {
      sourceDir: {
        type: 'string',
        description: 'Source directory to scan (default: current directory)',
        default: '.',
      },
      outputPath: {
        type: 'string',
        description: 'Optional path to write JSON output file',
      },
    },
    required: [],
  },
};

// Handler function
export async function handler(params: Record<string, unknown>): Promise<ToolResult<ToolOutput>> {
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
