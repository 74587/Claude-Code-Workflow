/**
 * Get Modules by Depth Tool
 * Scan project structure and organize modules by directory depth (deepest first)
 */

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';
import { readdirSync, statSync, existsSync, readFileSync } from 'fs';
import { join, resolve, relative, extname } from 'path';

// System/cache directories to always exclude
const SYSTEM_EXCLUDES = [
  // Version control and IDE
  '.git', '.gitignore', '.gitmodules', '.gitattributes',
  '.svn', '.hg', '.bzr',
  '.history', '.vscode', '.idea', '.vs', '.vscode-test',
  '.sublime-text', '.atom',
  // Python
  '__pycache__', '.pytest_cache', '.mypy_cache', '.tox',
  '.coverage', 'htmlcov', '.nox', '.venv', 'venv', 'env',
  '.egg-info', '.eggs', '.wheel',
  'site-packages', '.python-version',
  // Node.js/JavaScript
  'node_modules', '.npm', '.yarn', '.pnpm', 'yarn-error.log',
  '.nyc_output', 'coverage', '.next', '.nuxt',
  '.cache', '.parcel-cache', '.vite', 'dist', 'build',
  '.turbo', '.vercel', '.netlify',
  // Build/compile outputs
  'out', 'output', '_site', 'public',
  '.output', '.generated', 'generated', 'gen',
  'bin', 'obj', 'Debug', 'Release',
  // Testing
  'test-results', 'junit.xml', 'test_results',
  'cypress', 'playwright-report', '.playwright',
  // Logs and temp files
  'logs', 'log', 'tmp', 'temp', '.tmp', '.temp',
  // Documentation build outputs
  '_book', 'docs/_build', 'site', 'gh-pages',
  '.docusaurus', '.vuepress', '.gitbook',
  // Cloud and deployment
  '.serverless', '.terraform',
  '.aws', '.azure', '.gcp',
  // Mobile development
  '.gradle', '.expo', '.metro',
  'DerivedData',
  // Game development
  'Library', 'Temp', 'ProjectSettings',
  'MemoryCaptures', 'UserSettings'
];

// Define Zod schema for validation
const ParamsSchema = z.object({
  format: z.enum(['list', 'grouped', 'json']).default('list'),
  path: z.string().default('.'),
});

type Params = z.infer<typeof ParamsSchema>;

interface ModuleInfo {
  depth: number;
  path: string;
  files: number;
  types: string[];
  has_claude: boolean;
}

interface ToolOutput {
  format: string;
  total_modules: number;
  max_depth: number;
  output: string;
}

/**
 * Parse .gitignore file and return patterns
 */
function parseGitignore(basePath: string): string[] {
  const gitignorePath = join(basePath, '.gitignore');
  const patterns: string[] = [];

  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf8');
    content.split('\n').forEach(line => {
      line = line.trim();
      // Skip empty lines and comments
      if (!line || line.startsWith('#')) return;
      // Remove trailing slash
      line = line.replace(/\/$/, '');
      patterns.push(line);
    });
  }

  return patterns;
}

/**
 * Check if a path should be excluded
 */
function shouldExclude(name: string, gitignorePatterns: string[]): boolean {
  // Check system excludes
  if (SYSTEM_EXCLUDES.includes(name)) return true;

  // Check gitignore patterns (simple matching)
  for (const pattern of gitignorePatterns) {
    if (name === pattern) return true;
    // Simple wildcard matching
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      if (regex.test(name)) return true;
    }
  }

  return false;
}

/**
 * Get file types in a directory
 */
function getFileTypes(dirPath: string): string[] {
  const types = new Set<string>();
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    entries.forEach(entry => {
      if (entry.isFile()) {
        const ext = extname(entry.name).slice(1);
        if (ext) types.add(ext);
      }
    });
  } catch (e) {
    // Ignore errors
  }
  return Array.from(types);
}

/**
 * Count files in a directory (non-recursive)
 */
function countFiles(dirPath: string): number {
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    return entries.filter(e => e.isFile()).length;
  } catch (e) {
    return 0;
  }
}

/**
 * Recursively scan directories and collect info
 */
function scanDirectories(
  basePath: string,
  currentPath: string,
  depth: number,
  gitignorePatterns: string[],
  results: ModuleInfo[]
): void {
  try {
    const entries = readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (shouldExclude(entry.name, gitignorePatterns)) continue;

      const fullPath = join(currentPath, entry.name);
      const relPath = './' + relative(basePath, fullPath).replace(/\\/g, '/');
      const fileCount = countFiles(fullPath);

      // Only include directories with files
      if (fileCount > 0) {
        const types = getFileTypes(fullPath);
        const hasClaude = existsSync(join(fullPath, 'CLAUDE.md'));

        results.push({
          depth: depth + 1,
          path: relPath,
          files: fileCount,
          types,
          has_claude: hasClaude
        });
      }

      // Recurse into subdirectories
      scanDirectories(basePath, fullPath, depth + 1, gitignorePatterns, results);
    }
  } catch (e) {
    // Ignore permission errors, etc.
  }
}

/**
 * Format output as list (default)
 */
function formatList(results: ModuleInfo[]): string {
  // Sort by depth descending (deepest first)
  results.sort((a, b) => b.depth - a.depth);

  return results.map(r =>
    `depth:${r.depth}|path:${r.path}|files:${r.files}|types:[${r.types.join(',')}]|has_claude:${r.has_claude ? 'yes' : 'no'}`
  ).join('\n');
}

/**
 * Format output as grouped
 */
function formatGrouped(results: ModuleInfo[]): string {
  // Sort by depth descending
  results.sort((a, b) => b.depth - a.depth);

  const maxDepth = results.length > 0 ? Math.max(...results.map(r => r.depth)) : 0;
  const lines = ['Modules by depth (deepest first):'];

  for (let d = maxDepth; d >= 0; d--) {
    const atDepth = results.filter(r => r.depth === d);
    if (atDepth.length > 0) {
      lines.push(`  Depth ${d}:`);
      atDepth.forEach(r => {
        const claudeIndicator = r.has_claude ? ' [OK]' : '';
        lines.push(`    - ${r.path}${claudeIndicator}`);
      });
    }
  }

  return lines.join('\n');
}

/**
 * Format output as JSON
 */
function formatJson(results: ModuleInfo[]): string {
  // Sort by depth descending
  results.sort((a, b) => b.depth - a.depth);

  const maxDepth = results.length > 0 ? Math.max(...results.map(r => r.depth)) : 0;
  const modules: Record<number, { path: string; has_claude: boolean }[]> = {};

  for (let d = maxDepth; d >= 0; d--) {
    const atDepth = results.filter(r => r.depth === d);
    if (atDepth.length > 0) {
      modules[d] = atDepth.map(r => ({
        path: r.path,
        has_claude: r.has_claude
      }));
    }
  }

  return JSON.stringify({
    max_depth: maxDepth,
    modules
  }, null, 2);
}

// Tool schema for MCP
export const schema: ToolSchema = {
  name: 'get_modules_by_depth',
  description: `Scan project structure and organize modules by directory depth (deepest first).
Respects .gitignore patterns and excludes common system directories.
Output formats: list (pipe-delimited), grouped (human-readable), json.`,
  inputSchema: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        enum: ['list', 'grouped', 'json'],
        description: 'Output format (default: list)',
        default: 'list'
      },
      path: {
        type: 'string',
        description: 'Target directory path (default: current directory)',
        default: '.'
      }
    },
    required: []
  }
};

// Handler function
export async function handler(params: Record<string, unknown>): Promise<ToolResult<ToolOutput>> {
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return { success: false, error: `Invalid params: ${parsed.error.message}` };
  }

  const { format, path: targetPath } = parsed.data;

  try {
    const basePath = resolve(process.cwd(), targetPath);

    if (!existsSync(basePath)) {
      return { success: false, error: `Directory not found: ${basePath}` };
    }

    const stat = statSync(basePath);
    if (!stat.isDirectory()) {
      return { success: false, error: `Not a directory: ${basePath}` };
    }

    // Parse gitignore
    const gitignorePatterns = parseGitignore(basePath);

    // Collect results
    const results: ModuleInfo[] = [];

    // Check root directory
    const rootFileCount = countFiles(basePath);
    if (rootFileCount > 0) {
      results.push({
        depth: 0,
        path: '.',
        files: rootFileCount,
        types: getFileTypes(basePath),
        has_claude: existsSync(join(basePath, 'CLAUDE.md'))
      });
    }

    // Scan subdirectories
    scanDirectories(basePath, basePath, 0, gitignorePatterns, results);

    // Format output
    let output: string;
    switch (format) {
      case 'grouped':
        output = formatGrouped(results);
        break;
      case 'json':
        output = formatJson(results);
        break;
      case 'list':
      default:
        output = formatList(results);
        break;
    }

    return {
      success: true,
      result: {
        format,
        total_modules: results.length,
        max_depth: results.length > 0 ? Math.max(...results.map(r => r.depth)) : 0,
        output
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to scan modules: ${(error as Error).message}`
    };
  }
}
