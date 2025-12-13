/**
 * Smart Search Tool - Unified search with mode-based execution
 * Modes: auto, exact, fuzzy, semantic, graph
 *
 * Features:
 * - Intent classification (auto mode)
 * - Multi-backend search routing
 * - Result fusion with RRF ranking
 * - Configurable search parameters
 */

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';
import { spawn, execSync } from 'child_process';
import {
  ensureReady as ensureCodexLensReady,
  executeCodexLens,
} from './codex-lens.js';

// Define Zod schema for validation
const ParamsSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  mode: z.enum(['auto', 'exact', 'fuzzy', 'semantic', 'graph']).default('auto'),
  paths: z.array(z.string()).default([]),
  contextLines: z.number().default(0),
  maxResults: z.number().default(100),
  includeHidden: z.boolean().default(false),
});

type Params = z.infer<typeof ParamsSchema>;

// Search mode constants
const SEARCH_MODES = ['auto', 'exact', 'fuzzy', 'semantic', 'graph'] as const;

// Classification confidence threshold
const CONFIDENCE_THRESHOLD = 0.7;

interface Classification {
  mode: string;
  confidence: number;
  reasoning: string;
}

interface ExactMatch {
  file: string;
  line: number;
  column: number;
  content: string;
}

interface SemanticMatch {
  file: string;
  score: number;
  content: string;
  symbol: string | null;
}

interface GraphMatch {
  file: string;
  symbols: unknown;
  relationships: unknown[];
}

interface SearchMetadata {
  mode: string;
  backend: string;
  count: number;
  query: string;
  classified_as?: string;
  confidence?: number;
  reasoning?: string;
  warning?: string;
  note?: string;
}

interface SearchResult {
  success: boolean;
  results?: ExactMatch[] | SemanticMatch[] | GraphMatch[];
  output?: string;
  metadata?: SearchMetadata;
  error?: string;
}

/**
 * Detection heuristics for intent classification
 */

/**
 * Detect literal string query (simple alphanumeric or quoted strings)
 */
function detectLiteral(query: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(query) || /^["'].*["']$/.test(query);
}

/**
 * Detect regex pattern (contains regex metacharacters)
 */
function detectRegex(query: string): boolean {
  return /[.*+?^${}()|[\]\\]/.test(query);
}

/**
 * Detect natural language query (sentence structure, questions, multi-word phrases)
 */
function detectNaturalLanguage(query: string): boolean {
  return query.split(/\s+/).length >= 3 || /\?$/.test(query);
}

/**
 * Detect file path query (path separators, file extensions)
 */
function detectFilePath(query: string): boolean {
  return /[/\\]/.test(query) || /\.[a-z]{2,4}$/i.test(query);
}

/**
 * Detect relationship query (import, export, dependency keywords)
 */
function detectRelationship(query: string): boolean {
  return /(import|export|uses?|depends?|calls?|extends?)\s/i.test(query);
}

/**
 * Classify query intent and recommend search mode
 * @param query - Search query string
 * @returns Classification result
 */
function classifyIntent(query: string): Classification {
  // Initialize mode scores
  const scores: Record<string, number> = {
    exact: 0,
    fuzzy: 0,
    semantic: 0,
    graph: 0,
  };

  // Apply detection heuristics with weighted scoring
  if (detectLiteral(query)) {
    scores.exact += 0.8;
  }

  if (detectRegex(query)) {
    scores.fuzzy += 0.7;
  }

  if (detectNaturalLanguage(query)) {
    scores.semantic += 0.9;
  }

  if (detectFilePath(query)) {
    scores.exact += 0.6;
  }

  if (detectRelationship(query)) {
    scores.graph += 0.85;
  }

  // Find mode with highest confidence score
  const mode = Object.keys(scores).reduce((a, b) => (scores[a] > scores[b] ? a : b));
  const confidence = scores[mode];

  // Build reasoning string
  const detectedPatterns: string[] = [];
  if (detectLiteral(query)) detectedPatterns.push('literal');
  if (detectRegex(query)) detectedPatterns.push('regex');
  if (detectNaturalLanguage(query)) detectedPatterns.push('natural language');
  if (detectFilePath(query)) detectedPatterns.push('file path');
  if (detectRelationship(query)) detectedPatterns.push('relationship');

  const reasoning = `Query classified as ${mode} (confidence: ${confidence.toFixed(2)}, detected: ${detectedPatterns.join(', ')})`;

  return { mode, confidence, reasoning };
}

/**
 * Check if a tool is available in PATH
 * @param toolName - Tool executable name
 * @returns True if available
 */
function checkToolAvailability(toolName: string): boolean {
  try {
    const isWindows = process.platform === 'win32';
    const command = isWindows ? 'where' : 'which';
    execSync(`${command} ${toolName}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Build ripgrep command arguments
 * @param params - Search parameters
 * @returns Command and arguments
 */
function buildRipgrepCommand(params: {
  query: string;
  paths: string[];
  contextLines: number;
  maxResults: number;
  includeHidden: boolean;
}): { command: string; args: string[] } {
  const { query, paths = ['.'], contextLines = 0, maxResults = 100, includeHidden = false } = params;

  const args = [
    '-n', // Show line numbers
    '--color=never', // Disable color output
    '--json', // Output in JSON format
  ];

  // Add context lines if specified
  if (contextLines > 0) {
    args.push('-C', contextLines.toString());
  }

  // Add max results limit
  if (maxResults > 0) {
    args.push('--max-count', maxResults.toString());
  }

  // Include hidden files if specified
  if (includeHidden) {
    args.push('--hidden');
  }

  // Use literal/fixed string matching for exact mode
  args.push('-F', query);

  // Add search paths
  args.push(...paths);

  return { command: 'rg', args };
}

/**
 * Mode: auto - Intent classification and mode selection
 * Analyzes query to determine optimal search mode
 */
async function executeAutoMode(params: Params): Promise<SearchResult> {
  const { query } = params;

  // Classify intent
  const classification = classifyIntent(query);

  // Route to appropriate mode based on classification
  switch (classification.mode) {
    case 'exact': {
      const exactResult = await executeExactMode(params);
      return {
        ...exactResult,
        metadata: {
          ...exactResult.metadata!,
          classified_as: classification.mode,
          confidence: classification.confidence,
          reasoning: classification.reasoning,
        },
      };
    }

    case 'fuzzy':
      return {
        success: false,
        error: 'Fuzzy mode not yet implemented',
        metadata: {
          mode: 'fuzzy',
          backend: '',
          count: 0,
          query,
          classified_as: classification.mode,
          confidence: classification.confidence,
          reasoning: classification.reasoning,
        },
      };

    case 'semantic': {
      const semanticResult = await executeSemanticMode(params);
      return {
        ...semanticResult,
        metadata: {
          ...semanticResult.metadata!,
          classified_as: classification.mode,
          confidence: classification.confidence,
          reasoning: classification.reasoning,
        },
      };
    }

    case 'graph': {
      const graphResult = await executeGraphMode(params);
      return {
        ...graphResult,
        metadata: {
          ...graphResult.metadata!,
          classified_as: classification.mode,
          confidence: classification.confidence,
          reasoning: classification.reasoning,
        },
      };
    }

    default: {
      const fallbackResult = await executeExactMode(params);
      return {
        ...fallbackResult,
        metadata: {
          ...fallbackResult.metadata!,
          classified_as: 'exact',
          confidence: 0.5,
          reasoning: 'Fallback to exact mode due to unknown classification',
        },
      };
    }
  }
}

/**
 * Mode: exact - Precise file path and content matching
 * Uses ripgrep for literal string matching
 */
async function executeExactMode(params: Params): Promise<SearchResult> {
  const { query, paths = [], contextLines = 0, maxResults = 100, includeHidden = false } = params;

  // Check ripgrep availability
  if (!checkToolAvailability('rg')) {
    return {
      success: false,
      error: 'ripgrep not available - please install ripgrep (rg) to use exact search mode',
    };
  }

  // Build ripgrep command
  const { command, args } = buildRipgrepCommand({
    query,
    paths: paths.length > 0 ? paths : ['.'],
    contextLines,
    maxResults,
    includeHidden,
  });

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      const results: ExactMatch[] = [];

      if (code === 0 || (code === 1 && stdout.trim())) {
        const lines = stdout.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          try {
            const item = JSON.parse(line);

            if (item.type === 'match') {
              const match: ExactMatch = {
                file: item.data.path.text,
                line: item.data.line_number,
                column:
                  item.data.submatches && item.data.submatches[0]
                    ? item.data.submatches[0].start + 1
                    : 1,
                content: item.data.lines.text.trim(),
              };
              results.push(match);
            }
          } catch {
            continue;
          }
        }

        resolve({
          success: true,
          results,
          metadata: {
            mode: 'exact',
            backend: 'ripgrep',
            count: results.length,
            query,
          },
        });
      } else {
        resolve({
          success: false,
          error: `ripgrep execution failed with code ${code}: ${stderr}`,
          results: [],
        });
      }
    });

    child.on('error', (error) => {
      resolve({
        success: false,
        error: `Failed to spawn ripgrep: ${error.message}`,
        results: [],
      });
    });
  });
}

/**
 * Mode: fuzzy - Approximate matching with tolerance
 * Uses fuzzy matching algorithms for typo-tolerant search
 */
async function executeFuzzyMode(params: Params): Promise<SearchResult> {
  return {
    success: false,
    error: 'Fuzzy mode not implemented - fuzzy matching engine pending',
  };
}

/**
 * Mode: semantic - Natural language understanding search
 * Uses CodexLens embeddings for semantic similarity
 */
async function executeSemanticMode(params: Params): Promise<SearchResult> {
  const { query, paths = [], maxResults = 100 } = params;

  // Check CodexLens availability
  const readyStatus = await ensureCodexLensReady();
  if (!readyStatus.ready) {
    return {
      success: false,
      error: `CodexLens not available: ${readyStatus.error}. Run 'ccw tool exec codex_lens {"action":"bootstrap"}' to install.`,
    };
  }

  // Determine search path
  const searchPath = paths.length > 0 ? paths[0] : '.';

  // Execute CodexLens semantic search
  const result = await executeCodexLens(['search', query, '--limit', maxResults.toString(), '--json'], {
    cwd: searchPath,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      metadata: {
        mode: 'semantic',
        backend: 'codexlens',
        count: 0,
        query,
      },
    };
  }

  // Parse and transform results
  let results: SemanticMatch[] = [];
  try {
    const cleanOutput = result.output!.replace(/\r\n/g, '\n');
    const parsed = JSON.parse(cleanOutput);
    const data = parsed.result || parsed;
    results = (data.results || []).map((item: any) => ({
      file: item.path || item.file,
      score: item.score || 0,
      content: item.excerpt || item.content || '',
      symbol: item.symbol || null,
    }));
  } catch {
    return {
      success: true,
      results: [],
      output: result.output,
      metadata: {
        mode: 'semantic',
        backend: 'codexlens',
        count: 0,
        query,
        warning: 'Failed to parse JSON output',
      },
    };
  }

  return {
    success: true,
    results,
    metadata: {
      mode: 'semantic',
      backend: 'codexlens',
      count: results.length,
      query,
    },
  };
}

/**
 * Mode: graph - Dependency and relationship traversal
 * Uses CodexLens symbol extraction for code analysis
 */
async function executeGraphMode(params: Params): Promise<SearchResult> {
  const { query, paths = [], maxResults = 100 } = params;

  // Check CodexLens availability
  const readyStatus = await ensureCodexLensReady();
  if (!readyStatus.ready) {
    return {
      success: false,
      error: `CodexLens not available: ${readyStatus.error}. Run 'ccw tool exec codex_lens {"action":"bootstrap"}' to install.`,
    };
  }

  // First, search for relevant files using text search
  const searchPath = paths.length > 0 ? paths[0] : '.';

  const textResult = await executeCodexLens(['search', query, '--limit', maxResults.toString(), '--json'], {
    cwd: searchPath,
  });

  if (!textResult.success) {
    return {
      success: false,
      error: textResult.error,
      metadata: {
        mode: 'graph',
        backend: 'codexlens',
        count: 0,
        query,
      },
    };
  }

  // Parse results and extract symbols from top files
  let results: GraphMatch[] = [];
  try {
    const parsed = JSON.parse(textResult.output!);
    const files = [...new Set((parsed.results || parsed).map((item: any) => item.path || item.file))].slice(
      0,
      10
    );

    // Extract symbols from files in parallel
    const symbolPromises = files.map((file) =>
      executeCodexLens(['symbol', file as string, '--json'], { cwd: searchPath }).then((result) => ({
        file,
        result,
      }))
    );

    const symbolResults = await Promise.all(symbolPromises);

    for (const { file, result } of symbolResults) {
      if (result.success) {
        try {
          const symbols = JSON.parse(result.output!);
          results.push({
            file: file as string,
            symbols: symbols.symbols || symbols,
            relationships: [],
          });
        } catch {
          // Skip files with parse errors
        }
      }
    }
  } catch {
    return {
      success: false,
      error: 'Failed to parse search results',
      metadata: {
        mode: 'graph',
        backend: 'codexlens',
        count: 0,
        query,
      },
    };
  }

  return {
    success: true,
    results,
    metadata: {
      mode: 'graph',
      backend: 'codexlens',
      count: results.length,
      query,
      note: 'Graph mode provides symbol extraction; full dependency graph analysis pending',
    },
  };
}

// Tool schema for MCP
export const schema: ToolSchema = {
  name: 'smart_search',
  description: `Intelligent code search with multiple modes.

Usage:
  smart_search(query="function main", path=".")           # Auto-select mode
  smart_search(query="def init", mode="exact")            # Exact match
  smart_search(query="authentication logic", mode="semantic")  # NL search

Modes: auto (default), exact, fuzzy, semantic, graph`,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (file pattern, text content, or natural language)',
      },
      mode: {
        type: 'string',
        enum: SEARCH_MODES,
        description: 'Search mode (default: auto)',
        default: 'auto',
      },
      paths: {
        type: 'array',
        description: 'Paths to search within (default: current directory)',
        items: {
          type: 'string',
        },
        default: [],
      },
      contextLines: {
        type: 'number',
        description: 'Number of context lines around matches (default: 0)',
        default: 0,
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 100)',
        default: 100,
      },
      includeHidden: {
        type: 'boolean',
        description: 'Include hidden files/directories (default: false)',
        default: false,
      },
    },
    required: ['query'],
  },
};

// Handler function
export async function handler(params: Record<string, unknown>): Promise<ToolResult<SearchResult>> {
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return { success: false, error: `Invalid params: ${parsed.error.message}` };
  }

  const { mode } = parsed.data;

  try {
    let result: SearchResult;

    switch (mode) {
      case 'auto':
        result = await executeAutoMode(parsed.data);
        break;
      case 'exact':
        result = await executeExactMode(parsed.data);
        break;
      case 'fuzzy':
        result = await executeFuzzyMode(parsed.data);
        break;
      case 'semantic':
        result = await executeSemanticMode(parsed.data);
        break;
      case 'graph':
        result = await executeGraphMode(parsed.data);
        break;
      default:
        throw new Error(`Unsupported mode: ${mode}`);
    }

    return result.success ? { success: true, result } : { success: false, error: result.error };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
