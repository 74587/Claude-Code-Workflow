/**
 * Smart Search Tool - Unified intelligent search with CodexLens integration
 *
 * Features:
 * - Intent classification with automatic mode selection
 * - CodexLens integration (init, hybrid, vector, semantic)
 * - Ripgrep fallback for exact mode
 * - Index status checking and warnings
 * - Multi-backend search routing with RRF ranking
 *
 * Actions:
 * - init: Initialize CodexLens index
 * - search: Intelligent search with auto mode selection
 * - status: Check index status
 */

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';
import { spawn, execSync } from 'child_process';
import {
  ensureReady as ensureCodexLensReady,
  executeCodexLens,
} from './codex-lens.js';
import type { ProgressInfo } from './codex-lens.js';

// Define Zod schema for validation
const ParamsSchema = z.object({
  action: z.enum(['init', 'search', 'search_files', 'status']).default('search'),
  query: z.string().optional(),
  mode: z.enum(['auto', 'hybrid', 'exact', 'ripgrep', 'priority']).default('auto'),
  output_mode: z.enum(['full', 'files_only', 'count']).default('full'),
  path: z.string().optional(),
  paths: z.array(z.string()).default([]),
  contextLines: z.number().default(0),
  maxResults: z.number().default(10),
  includeHidden: z.boolean().default(false),
  languages: z.array(z.string()).optional(),
  limit: z.number().default(10),
  enrich: z.boolean().default(false),
});

type Params = z.infer<typeof ParamsSchema>;

// Search mode constants
const SEARCH_MODES = ['auto', 'hybrid', 'exact', 'ripgrep', 'priority'] as const;

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

interface RelationshipInfo {
  type: string;           // 'calls', 'imports', 'called_by', 'imported_by'
  direction: 'outgoing' | 'incoming';
  target?: string;        // Target symbol name (for outgoing)
  source?: string;        // Source symbol name (for incoming)
  file: string;           // File path
  line?: number;          // Line number
}

interface SemanticMatch {
  file: string;
  score: number;
  content: string;
  symbol: string | null;
  relationships?: RelationshipInfo[];
}

interface GraphMatch {
  file: string;
  symbols: unknown;
  relationships: unknown[];
}

interface SearchMetadata {
  mode?: string;
  backend?: string;
  count?: number;
  query?: string;
  classified_as?: string;
  confidence?: number;
  reasoning?: string;
  embeddings_coverage_percent?: number;
  warning?: string;
  note?: string;
  index_status?: 'indexed' | 'not_indexed' | 'partial';
  fallback_history?: string[];
  // Init action specific
  action?: string;
  path?: string;
  progress?: {
    stage: string;
    message: string;
    percent: number;
    filesProcessed?: number;
    totalFiles?: number;
  };
  progressHistory?: ProgressInfo[];
}

interface SearchResult {
  success: boolean;
  results?: ExactMatch[] | SemanticMatch[] | GraphMatch[] | unknown;
  output?: string;
  metadata?: SearchMetadata;
  error?: string;
  status?: unknown;
  message?: string;
}

interface IndexStatus {
  indexed: boolean;
  has_embeddings: boolean;
  file_count?: number;
  embeddings_coverage_percent?: number;
  warning?: string;
}

/**
 * Strip ANSI color codes from string (for JSON parsing)
 */
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Check if CodexLens index exists for current directory
 * @param path - Directory path to check
 * @returns Index status
 */
async function checkIndexStatus(path: string = '.'): Promise<IndexStatus> {
  try {
    const result = await executeCodexLens(['status', '--json'], { cwd: path });

    if (!result.success) {
      return {
        indexed: false,
        has_embeddings: false,
        warning: 'No CodexLens index found. Run smart_search(action="init") to create index for better search results.',
      };
    }

    // Parse status output
    try {
      // Strip ANSI color codes from JSON output
      const cleanOutput = stripAnsi(result.output || '{}');
      const parsed = JSON.parse(cleanOutput);
      // Handle both direct and nested response formats (status returns {success, result: {...}})
      const status = parsed.result || parsed;
      const indexed = status.projects_count > 0 || status.total_files > 0;

      // Get embeddings coverage from comprehensive status
      const embeddingsData = status.embeddings || {};
      const embeddingsCoverage = embeddingsData.coverage_percent || 0;
      const has_embeddings = embeddingsCoverage >= 50; // Threshold: 50%

      let warning: string | undefined;
      if (!indexed) {
        warning = 'No CodexLens index found. Run smart_search(action="init") to create index for better search results.';
      } else if (embeddingsCoverage === 0) {
        warning = 'Index exists but no embeddings generated. Run: codexlens embeddings-generate --recursive';
      } else if (embeddingsCoverage < 50) {
        warning = `Embeddings coverage is ${embeddingsCoverage.toFixed(1)}% (below 50%). Hybrid search will use exact mode. Run: codexlens embeddings-generate --recursive`;
      }

      return {
        indexed,
        has_embeddings,
        file_count: status.total_files,
        embeddings_coverage_percent: embeddingsCoverage,
        warning,
      };
    } catch {
      return {
        indexed: false,
        has_embeddings: false,
        warning: 'Failed to parse index status',
      };
    }
  } catch {
    return {
      indexed: false,
      has_embeddings: false,
      warning: 'CodexLens not available',
    };
  }
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
 * Simple mapping: hybrid (NL + index + embeddings) | exact (index or insufficient embeddings) | ripgrep (no index)
 * @param query - Search query string
 * @param hasIndex - Whether CodexLens index exists
 * @param hasSufficientEmbeddings - Whether embeddings coverage >= 50%
 * @returns Classification result
 */
function classifyIntent(query: string, hasIndex: boolean = false, hasSufficientEmbeddings: boolean = false): Classification {
  // Detect query patterns
  const isNaturalLanguage = detectNaturalLanguage(query);

  // Simple decision tree
  let mode: string;
  let confidence: number;

  if (!hasIndex) {
    // No index: use ripgrep
    mode = 'ripgrep';
    confidence = 1.0;
  } else if (isNaturalLanguage && hasSufficientEmbeddings) {
    // Natural language + sufficient embeddings: use hybrid
    mode = 'hybrid';
    confidence = 0.9;
  } else {
    // Simple query OR insufficient embeddings: use exact
    mode = 'exact';
    confidence = 0.8;
  }

  // Build reasoning string
  const detectedPatterns: string[] = [];
  if (detectLiteral(query)) detectedPatterns.push('literal');
  if (detectRegex(query)) detectedPatterns.push('regex');
  if (detectNaturalLanguage(query)) detectedPatterns.push('natural language');
  if (detectFilePath(query)) detectedPatterns.push('file path');
  if (detectRelationship(query)) detectedPatterns.push('relationship');

  const reasoning = `Query classified as ${mode} (confidence: ${confidence.toFixed(2)}, detected: ${detectedPatterns.join(', ')}, index: ${hasIndex ? 'available' : 'not available'}, embeddings: ${hasSufficientEmbeddings ? 'sufficient' : 'insufficient'})`;

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
  const { query, paths = ['.'], contextLines = 0, maxResults = 10, includeHidden = false } = params;

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
 * Action: init - Initialize CodexLens index (FTS only, no embeddings)
 * For semantic/vector search, use ccw view dashboard or codexlens CLI directly
 */
async function executeInitAction(params: Params): Promise<SearchResult> {
  const { path = '.', languages } = params;

  // Check CodexLens availability
  const readyStatus = await ensureCodexLensReady();
  if (!readyStatus.ready) {
    return {
      success: false,
      error: `CodexLens not available: ${readyStatus.error}. CodexLens will be auto-installed on first use.`,
    };
  }

  // Build args with --no-embeddings for FTS-only index (faster)
  const args = ['init', path, '--no-embeddings'];
  if (languages && languages.length > 0) {
    args.push('--languages', languages.join(','));
  }

  // Track progress updates
  const progressUpdates: ProgressInfo[] = [];
  let lastProgress: ProgressInfo | null = null;

  const result = await executeCodexLens(args, {
    cwd: path,
    timeout: 1800000, // 30 minutes for large codebases
    onProgress: (progress: ProgressInfo) => {
      progressUpdates.push(progress);
      lastProgress = progress;
    },
  });

  // Build metadata with progress info
  const metadata: SearchMetadata = {
    action: 'init',
    path,
  };

  if (lastProgress !== null) {
    const p = lastProgress as ProgressInfo;
    metadata.progress = {
      stage: p.stage,
      message: p.message,
      percent: p.percent,
      filesProcessed: p.filesProcessed,
      totalFiles: p.totalFiles,
    };
  }

  if (progressUpdates.length > 0) {
    metadata.progressHistory = progressUpdates.slice(-5); // Keep last 5 progress updates
  }

  const successMessage = result.success
    ? `FTS index created for ${path}. Note: For semantic/vector search, create vector index via "ccw view" dashboard or run "codexlens init ${path}" (without --no-embeddings).`
    : undefined;

  return {
    success: result.success,
    error: result.error,
    message: successMessage,
    metadata,
  };
}

/**
 * Action: status - Check CodexLens index status
 */
async function executeStatusAction(params: Params): Promise<SearchResult> {
  const { path = '.' } = params;

  const indexStatus = await checkIndexStatus(path);

  return {
    success: true,
    status: indexStatus,
    message: indexStatus.warning || `Index status: ${indexStatus.indexed ? 'indexed' : 'not indexed'}, embeddings: ${indexStatus.has_embeddings ? 'available' : 'not available'}`,
  };
}

/**
 * Mode: auto - Intent classification and mode selection
 * Routes to: hybrid (NL + index) | exact (index) | ripgrep (no index)
 */
async function executeAutoMode(params: Params): Promise<SearchResult> {
  const { query, path = '.' } = params;

  if (!query) {
    return {
      success: false,
      error: 'Query is required for search action',
    };
  }

  // Check index status
  const indexStatus = await checkIndexStatus(path);

  // Classify intent with index and embeddings awareness
  const classification = classifyIntent(
    query, 
    indexStatus.indexed, 
    indexStatus.has_embeddings  // This now considers 50% threshold
  );

  // Route to appropriate mode based on classification
  let result: SearchResult;

  switch (classification.mode) {
    case 'hybrid':
      result = await executeHybridMode(params);
      break;

    case 'exact':
      result = await executeCodexLensExactMode(params);
      break;

    case 'ripgrep':
      result = await executeRipgrepMode(params);
      break;

    default:
      // Fallback to ripgrep
      result = await executeRipgrepMode(params);
      break;
  }

  // Add classification metadata
  if (result.metadata) {
    result.metadata.classified_as = classification.mode;
    result.metadata.confidence = classification.confidence;
    result.metadata.reasoning = classification.reasoning;
    result.metadata.embeddings_coverage_percent = indexStatus.embeddings_coverage_percent;
    result.metadata.index_status = indexStatus.indexed
      ? (indexStatus.has_embeddings ? 'indexed' : 'partial')
      : 'not_indexed';

    // Add warning if needed
    if (indexStatus.warning) {
      result.metadata.warning = indexStatus.warning;
    }
  }

  return result;
}

/**
 * Mode: ripgrep - Fast literal string matching using ripgrep
 * No index required, fallback to CodexLens if ripgrep unavailable
 */
async function executeRipgrepMode(params: Params): Promise<SearchResult> {
  const { query, paths = [], contextLines = 0, maxResults = 10, includeHidden = false, path = '.' } = params;

  if (!query) {
    return {
      success: false,
      error: 'Query is required for search',
    };
  }

  // Check if ripgrep is available
  const hasRipgrep = checkToolAvailability('rg');

  // If ripgrep not available, fall back to CodexLens exact mode
  if (!hasRipgrep) {
    const readyStatus = await ensureCodexLensReady();
    if (!readyStatus.ready) {
      return {
        success: false,
        error: 'Neither ripgrep nor CodexLens available. Install ripgrep (rg) or CodexLens for search functionality.',
      };
    }

    // Use CodexLens exact mode as fallback
    const args = ['search', query, '--limit', maxResults.toString(), '--mode', 'exact', '--json'];
    const result = await executeCodexLens(args, { cwd: path });

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        metadata: {
          mode: 'ripgrep',
          backend: 'codexlens-fallback',
          count: 0,
          query,
        },
      };
    }

    // Parse results
    let results: SemanticMatch[] = [];
    try {
      const parsed = JSON.parse(stripAnsi(result.output || '{}'));
      const data = parsed.result?.results || parsed.results || parsed;
      results = (Array.isArray(data) ? data : []).map((item: any) => ({
        file: item.path || item.file,
        score: item.score || 0,
        content: item.excerpt || item.content || '',
        symbol: item.symbol || null,
      }));
    } catch {
      // Keep empty results
    }

    return {
      success: true,
      results,
      metadata: {
        mode: 'ripgrep',
        backend: 'codexlens-fallback',
        count: results.length,
        query,
        note: 'Using CodexLens exact mode (ripgrep not available)',
      },
    };
  }

  // Use ripgrep
  const { command, args } = buildRipgrepCommand({
    query,
    paths: paths.length > 0 ? paths : [path],
    contextLines,
    maxResults,
    includeHidden,
  });

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: path || process.cwd(),
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
            mode: 'ripgrep',
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
 * Mode: exact - CodexLens exact/FTS search
 * Requires index
 */
async function executeCodexLensExactMode(params: Params): Promise<SearchResult> {
  const { query, path = '.', maxResults = 10, enrich = false } = params;

  if (!query) {
    return {
      success: false,
      error: 'Query is required for search',
    };
  }

  // Check CodexLens availability
  const readyStatus = await ensureCodexLensReady();
  if (!readyStatus.ready) {
    return {
      success: false,
      error: `CodexLens not available: ${readyStatus.error}`,
    };
  }

  // Check index status
  const indexStatus = await checkIndexStatus(path);

  const args = ['search', query, '--limit', maxResults.toString(), '--mode', 'exact', '--json'];
  if (enrich) {
    args.push('--enrich');
  }
  const result = await executeCodexLens(args, { cwd: path });

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      metadata: {
        mode: 'exact',
        backend: 'codexlens',
        count: 0,
        query,
        warning: indexStatus.warning,
      },
    };
  }

  // Parse results
  let results: SemanticMatch[] = [];
  try {
    const parsed = JSON.parse(stripAnsi(result.output || '{}'));
    const data = parsed.result?.results || parsed.results || parsed;
    results = (Array.isArray(data) ? data : []).map((item: any) => ({
      file: item.path || item.file,
      score: item.score || 0,
      content: item.excerpt || item.content || '',
      symbol: item.symbol || null,
    }));
  } catch {
    // Keep empty results
  }

  return {
    success: true,
    results,
    metadata: {
      mode: 'exact',
      backend: 'codexlens',
      count: results.length,
      query,
      warning: indexStatus.warning,
    },
  };
}

/**
 * Mode: hybrid - Best quality search with RRF fusion
 * Uses CodexLens hybrid mode (exact + fuzzy + vector)
 * Requires index with embeddings
 */
async function executeHybridMode(params: Params): Promise<SearchResult> {
  const { query, path = '.', maxResults = 10, enrich = false } = params;

  if (!query) {
    return {
      success: false,
      error: 'Query is required for search',
    };
  }

  // Check CodexLens availability
  const readyStatus = await ensureCodexLensReady();
  if (!readyStatus.ready) {
    return {
      success: false,
      error: `CodexLens not available: ${readyStatus.error}`,
    };
  }

  // Check index status
  const indexStatus = await checkIndexStatus(path);

  const args = ['search', query, '--limit', maxResults.toString(), '--mode', 'hybrid', '--json'];
  if (enrich) {
    args.push('--enrich');
  }
  const result = await executeCodexLens(args, { cwd: path });

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      metadata: {
        mode: 'hybrid',
        backend: 'codexlens',
        count: 0,
        query,
        warning: indexStatus.warning,
      },
    };
  }

  // Parse results
  let results: SemanticMatch[] = [];
  try {
    const parsed = JSON.parse(stripAnsi(result.output || '{}'));
    const data = parsed.result?.results || parsed.results || parsed;
    results = (Array.isArray(data) ? data : []).map((item: any) => ({
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
        mode: 'hybrid',
        backend: 'codexlens',
        count: 0,
        query,
        warning: indexStatus.warning || 'Failed to parse JSON output',
      },
    };
  }

  return {
    success: true,
    results,
    metadata: {
      mode: 'hybrid',
      backend: 'codexlens',
      count: results.length,
      query,
      note: 'Hybrid mode uses RRF fusion (exact + fuzzy + vector) for best results',
      warning: indexStatus.warning,
    },
  };
}

/**
 * TypeScript implementation of Reciprocal Rank Fusion
 * Reference: codex-lens/src/codexlens/search/ranking.py
 * Formula: score(d) = Σ weight_source / (k + rank_source(d))
 */
function applyRRFFusion(
  resultsMap: Map<string, any[]>,
  weights: Record<string, number>,
  limit: number,
  k: number = 60,
): any[] {
  const pathScores = new Map<string, { score: number; result: any; sources: string[] }>();

  resultsMap.forEach((results, source) => {
    const weight = weights[source] || 0;
    if (weight === 0 || !results) return;

    results.forEach((result, rank) => {
      const path = result.file || result.path;
      if (!path) return;

      const rrfContribution = weight / (k + rank + 1);

      if (!pathScores.has(path)) {
        pathScores.set(path, { score: 0, result, sources: [] });
      }
      const entry = pathScores.get(path)!;
      entry.score += rrfContribution;
      if (!entry.sources.includes(source)) {
        entry.sources.push(source);
      }
    });
  });

  // Sort by fusion score descending
  return Array.from(pathScores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => ({
      ...item.result,
      fusion_score: item.score,
      matched_backends: item.sources,
    }));
}

/**
 * Promise wrapper with timeout support
 * @param promise - The promise to wrap
 * @param ms - Timeout in milliseconds
 * @param modeName - Name of the mode for error message
 * @returns A new promise that rejects on timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number, modeName: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`'${modeName}' search timed out after ${ms}ms`));
    }, ms);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}

/**
 * Mode: priority - Fallback search strategy: hybrid -> exact -> ripgrep
 * Returns results from the first backend that succeeds and provides results.
 * More efficient than parallel mode - stops as soon as valid results are found.
 */
async function executePriorityFallbackMode(params: Params): Promise<SearchResult> {
  const { query, path = '.' } = params;
  const fallbackHistory: string[] = [];

  if (!query) {
    return { success: false, error: 'Query is required for search' };
  }

  // Check index status first
  const indexStatus = await checkIndexStatus(path);

  // 1. Try Hybrid search (highest priority) - 90s timeout for large indexes
  if (indexStatus.indexed && indexStatus.has_embeddings) {
    try {
      const hybridResult = await withTimeout(executeHybridMode(params), 90000, 'hybrid');
      if (hybridResult.success && hybridResult.results && (hybridResult.results as any[]).length > 0) {
        fallbackHistory.push('hybrid: success');
        return {
          ...hybridResult,
          metadata: {
            ...hybridResult.metadata,
            mode: 'priority',
            note: 'Result from hybrid search (semantic + vector).',
            fallback_history: fallbackHistory,
          },
        };
      }
      fallbackHistory.push('hybrid: no results');
    } catch (error) {
      fallbackHistory.push(`hybrid: ${(error as Error).message}`);
    }
  } else {
    fallbackHistory.push(`hybrid: skipped (${!indexStatus.indexed ? 'no index' : 'no embeddings'})`);
  }

  // 2. Fallback to Exact search - 10s timeout
  if (indexStatus.indexed) {
    try {
      const exactResult = await withTimeout(executeCodexLensExactMode(params), 10000, 'exact');
      if (exactResult.success && exactResult.results && (exactResult.results as any[]).length > 0) {
        fallbackHistory.push('exact: success');
        return {
          ...exactResult,
          metadata: {
            ...exactResult.metadata,
            mode: 'priority',
            note: 'Result from exact/FTS search (fallback from hybrid).',
            fallback_history: fallbackHistory,
          },
        };
      }
      fallbackHistory.push('exact: no results');
    } catch (error) {
      fallbackHistory.push(`exact: ${(error as Error).message}`);
    }
  } else {
    fallbackHistory.push('exact: skipped (no index)');
  }

  // 3. Final fallback to Ripgrep - 5s timeout
  try {
    const ripgrepResult = await withTimeout(executeRipgrepMode(params), 5000, 'ripgrep');
    fallbackHistory.push(ripgrepResult.success ? 'ripgrep: success' : 'ripgrep: failed');
    return {
      ...ripgrepResult,
      metadata: {
        ...ripgrepResult.metadata,
        mode: 'priority',
        note: 'Result from ripgrep search (final fallback).',
        fallback_history: fallbackHistory,
      },
    };
  } catch (error) {
    fallbackHistory.push(`ripgrep: ${(error as Error).message}`);
  }

  // All modes failed
  return {
    success: false,
    error: 'All search backends in priority mode failed or returned no results.',
    metadata: {
      mode: 'priority',
      query,
      fallback_history: fallbackHistory,
    } as any,
  };
}

// Tool schema for MCP
export const schema: ToolSchema = {
  name: 'smart_search',
  description: `Intelligent code search with five modes. Use "auto" mode (default) for intelligent routing.

**Usage:**
  smart_search(query="authentication logic")        # auto mode - routes to best backend
  smart_search(query="MyClass", mode="exact")       # exact mode - precise FTS matching
  smart_search(query="auth", mode="ripgrep")        # ripgrep mode - fast literal search (no index)
  smart_search(query="how to auth", mode="hybrid")  # hybrid mode - semantic search (requires index)

**Index Management:**
  smart_search(action="init")                       # Create FTS index for current directory
  smart_search(action="status")                     # Check index and embedding status

**Graph Enrichment:**
  smart_search(query="func", enrich=true)           # Enrich results with code relationships (calls, imports, called_by, imported_by)

**Modes:** auto (intelligent routing), hybrid (semantic, needs index), exact (FTS), ripgrep (fast, no index), priority (fallback: hybrid→exact→ripgrep)`,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['init', 'search', 'search_files', 'status'],
        description: 'Action to perform: init (create FTS index, no embeddings), search (default), search_files (paths only), status (check index)',
        default: 'search',
      },
      query: {
        type: 'string',
        description: 'Search query (required for search/search_files actions)',
      },
      mode: {
        type: 'string',
        enum: SEARCH_MODES,
        description: 'Search mode: auto (default), hybrid (best quality), exact (CodexLens FTS), ripgrep (fast, no index), priority (fallback: hybrid->exact->ripgrep)',
        default: 'auto',
      },
      output_mode: {
        type: 'string',
        enum: ['full', 'files_only', 'count'],
        description: 'Output format: full (default), files_only (paths only), count (per-file counts)',
        default: 'full',
      },
      path: {
        type: 'string',
        description: 'Directory path for init/search actions (default: current directory)',
      },
      paths: {
        type: 'array',
        description: 'Multiple paths to search within (for search action)',
        items: {
          type: 'string',
        },
        default: [],
      },
      contextLines: {
        type: 'number',
        description: 'Number of context lines around matches (exact mode only)',
        default: 0,
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results (default: 10)',
        default: 10,
      },
      limit: {
        type: 'number',
        description: 'Alias for maxResults',
        default: 10,
      },
      includeHidden: {
        type: 'boolean',
        description: 'Include hidden files/directories',
        default: false,
      },
      languages: {
        type: 'array',
        items: { type: 'string' },
        description: 'Languages to index (for init action). Example: ["javascript", "typescript"]',
      },
      enrich: {
        type: 'boolean',
        description: 'Enrich search results with code graph relationships (calls, imports, called_by, imported_by).',
        default: false,
      },
    },
    required: [],
  },
};

/**
 * Transform results based on output_mode
 */
function transformOutput(
  results: ExactMatch[] | SemanticMatch[] | GraphMatch[] | unknown[],
  outputMode: 'full' | 'files_only' | 'count'
): unknown {
  if (!Array.isArray(results)) {
    return results;
  }

  switch (outputMode) {
    case 'files_only': {
      // Extract unique file paths
      const files = [...new Set(results.map((r: any) => r.file))].filter(Boolean);
      return { files, count: files.length };
    }
    case 'count': {
      // Count matches per file
      const counts: Record<string, number> = {};
      for (const r of results) {
        const file = (r as any).file;
        if (file) {
          counts[file] = (counts[file] || 0) + 1;
        }
      }
      return {
        files: Object.entries(counts).map(([file, count]) => ({ file, count })),
        total: results.length,
      };
    }
    case 'full':
    default:
      return results;
  }
}

// Handler function
export async function handler(params: Record<string, unknown>): Promise<ToolResult<SearchResult>> {
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return { success: false, error: `Invalid params: ${parsed.error.message}` };
  }

  const { action, mode, output_mode } = parsed.data;

  // Sync limit and maxResults - use the larger of the two if both provided
  // This ensures user-provided values take precedence over defaults
  const effectiveLimit = Math.max(parsed.data.limit || 10, parsed.data.maxResults || 10);
  parsed.data.maxResults = effectiveLimit;
  parsed.data.limit = effectiveLimit;

  try {
    let result: SearchResult;

    // Handle actions
    switch (action) {
      case 'init':
        result = await executeInitAction(parsed.data);
        break;

      case 'status':
        result = await executeStatusAction(parsed.data);
        break;

      case 'search_files':
        // For search_files, use search mode but force files_only output
        parsed.data.output_mode = 'files_only';
        // Fall through to search

      case 'search':
      default:
        // Handle search modes: auto | hybrid | exact | ripgrep | priority
        switch (mode) {
          case 'auto':
            result = await executeAutoMode(parsed.data);
            break;
          case 'hybrid':
            result = await executeHybridMode(parsed.data);
            break;
          case 'exact':
            result = await executeCodexLensExactMode(parsed.data);
            break;
          case 'ripgrep':
            result = await executeRipgrepMode(parsed.data);
            break;
          case 'priority':
            result = await executePriorityFallbackMode(parsed.data);
            break;
          default:
            throw new Error(`Unsupported mode: ${mode}. Use: auto, hybrid, exact, ripgrep, or priority`);
        }
        break;
    }

    // Transform output based on output_mode (for search actions only)
    if (action === 'search' || action === 'search_files') {
      if (result.success && result.results && output_mode !== 'full') {
        result.results = transformOutput(result.results as any[], output_mode);
      }
    }

    return result.success ? { success: true, result } : { success: false, error: result.error };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Execute init action with external progress callback
 * Used by MCP server for streaming progress
 */
export async function executeInitWithProgress(
  params: Record<string, unknown>,
  onProgress?: (progress: ProgressInfo) => void
): Promise<SearchResult> {
  const path = (params.path as string) || '.';
  const languages = params.languages as string[] | undefined;

  // Check CodexLens availability
  const readyStatus = await ensureCodexLensReady();
  if (!readyStatus.ready) {
    return {
      success: false,
      error: `CodexLens not available: ${readyStatus.error}. CodexLens will be auto-installed on first use.`,
    };
  }

  const args = ['init', path];
  if (languages && languages.length > 0) {
    args.push('--languages', languages.join(','));
  }

  // Track progress updates
  const progressUpdates: ProgressInfo[] = [];
  let lastProgress: ProgressInfo | null = null;

  const result = await executeCodexLens(args, {
    cwd: path,
    timeout: 1800000, // 30 minutes for large codebases
    onProgress: (progress: ProgressInfo) => {
      progressUpdates.push(progress);
      lastProgress = progress;
      // Call external progress callback if provided
      if (onProgress) {
        onProgress(progress);
      }
    },
  });

  // Build metadata with progress info
  const metadata: SearchMetadata = {
    action: 'init',
    path,
  };

  if (lastProgress !== null) {
    const p = lastProgress as ProgressInfo;
    metadata.progress = {
      stage: p.stage,
      message: p.message,
      percent: p.percent,
      filesProcessed: p.filesProcessed,
      totalFiles: p.totalFiles,
    };
  }

  if (progressUpdates.length > 0) {
    metadata.progressHistory = progressUpdates.slice(-5);
  }

  return {
    success: result.success,
    error: result.error,
    message: result.success
      ? `CodexLens index created successfully for ${path}`
      : undefined,
    metadata,
  };
}
