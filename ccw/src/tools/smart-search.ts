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
  mode: z.enum(['auto', 'hybrid', 'exact', 'ripgrep', 'parallel']).default('auto'),
  output_mode: z.enum(['full', 'files_only', 'count']).default('full'),
  path: z.string().optional(),
  paths: z.array(z.string()).default([]),
  contextLines: z.number().default(0),
  maxResults: z.number().default(100),
  includeHidden: z.boolean().default(false),
  languages: z.array(z.string()).optional(),
  limit: z.number().default(100),
  parallelWeights: z.object({
    hybrid: z.number().default(0.5),
    exact: z.number().default(0.3),
    ripgrep: z.number().default(0.2),
  }).optional(),
});

type Params = z.infer<typeof ParamsSchema>;

// Search mode constants
const SEARCH_MODES = ['auto', 'hybrid', 'exact', 'ripgrep', 'parallel'] as const;

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
      const cleanOutput = (result.output || '{}').replace(/\x1b\[[0-9;]*m/g, '');
      const status = JSON.parse(cleanOutput);
      const indexed = status.indexed === true || status.file_count > 0;
      
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
        file_count: status.file_count,
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
 * Action: init - Initialize CodexLens index
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

  const args = ['init', path];
  if (languages && languages.length > 0) {
    args.push('--languages', languages.join(','));
  }

  // Track progress updates
  const progressUpdates: ProgressInfo[] = [];
  let lastProgress: ProgressInfo | null = null;

  const result = await executeCodexLens(args, {
    cwd: path,
    timeout: 300000,
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

  return {
    success: result.success,
    error: result.error,
    message: result.success
      ? `CodexLens index created successfully for ${path}`
      : undefined,
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
  const { query, paths = [], contextLines = 0, maxResults = 100, includeHidden = false, path = '.' } = params;

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
      const parsed = JSON.parse(result.output || '{}');
      const data = parsed.results || parsed;
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
  const { query, path = '.', limit = 100 } = params;

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

  const args = ['search', query, '--limit', limit.toString(), '--mode', 'exact', '--json'];
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
    const parsed = JSON.parse(result.output || '{}');
    const data = parsed.results || parsed;
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
  const { query, path = '.', limit = 100 } = params;

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

  const args = ['search', query, '--limit', limit.toString(), '--mode', 'hybrid', '--json'];
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
    const parsed = JSON.parse(result.output || '{}');
    const data = parsed.results || parsed;
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
 * Mode: parallel - Run all backends simultaneously with RRF fusion
 * Returns best results from hybrid + exact + ripgrep combined
 */
async function executeParallelMode(params: Params): Promise<SearchResult> {
  const { query, path = '.', limit = 100, parallelWeights } = params;

  if (!query) {
    return {
      success: false,
      error: 'Query is required for search',
    };
  }

  // Default weights if not provided
  const weights = parallelWeights || {
    hybrid: 0.5,
    exact: 0.3,
    ripgrep: 0.2,
  };

  // Run all backends in parallel
  const [hybridResult, exactResult, ripgrepResult] = await Promise.allSettled([
    executeHybridMode(params),
    executeCodexLensExactMode(params),
    executeRipgrepMode(params),
  ]);

  // Collect successful results
  const resultsMap = new Map<string, any[]>();
  const backendStatus: Record<string, string> = {};

  if (hybridResult.status === 'fulfilled' && hybridResult.value.success) {
    resultsMap.set('hybrid', hybridResult.value.results as any[]);
    backendStatus.hybrid = 'success';
  } else {
    backendStatus.hybrid = hybridResult.status === 'rejected'
      ? `error: ${hybridResult.reason}`
      : `failed: ${(hybridResult as PromiseFulfilledResult<SearchResult>).value.error}`;
  }

  if (exactResult.status === 'fulfilled' && exactResult.value.success) {
    resultsMap.set('exact', exactResult.value.results as any[]);
    backendStatus.exact = 'success';
  } else {
    backendStatus.exact = exactResult.status === 'rejected'
      ? `error: ${exactResult.reason}`
      : `failed: ${(exactResult as PromiseFulfilledResult<SearchResult>).value.error}`;
  }

  if (ripgrepResult.status === 'fulfilled' && ripgrepResult.value.success) {
    resultsMap.set('ripgrep', ripgrepResult.value.results as any[]);
    backendStatus.ripgrep = 'success';
  } else {
    backendStatus.ripgrep = ripgrepResult.status === 'rejected'
      ? `error: ${ripgrepResult.reason}`
      : `failed: ${(ripgrepResult as PromiseFulfilledResult<SearchResult>).value.error}`;
  }

  // If no results from any backend
  if (resultsMap.size === 0) {
    return {
      success: false,
      error: 'All search backends failed',
      metadata: {
        mode: 'parallel',
        backend: 'multi-backend',
        count: 0,
        query,
        backend_status: backendStatus,
      } as any,
    };
  }

  // Apply RRF fusion
  const fusedResults = applyRRFFusion(resultsMap, weights, limit);

  return {
    success: true,
    results: fusedResults,
    metadata: {
      mode: 'parallel',
      backend: 'multi-backend',
      count: fusedResults.length,
      query,
      backends_used: Array.from(resultsMap.keys()),
      backend_status: backendStatus,
      weights,
      note: 'Parallel mode runs hybrid + exact + ripgrep simultaneously with RRF fusion',
    } as any,
  };
}

// Tool schema for MCP
export const schema: ToolSchema = {
  name: 'smart_search',
  description: `Intelligent code search with five modes: auto, hybrid, exact, ripgrep, parallel.

**Quick Start:**
  smart_search(query="authentication logic")           # Auto mode (intelligent routing)
  smart_search(action="init", path=".")                # Initialize index (required for hybrid)
  smart_search(action="status")                        # Check index status

**Five Modes:**
  1. auto (default): Intelligent routing based on query and index
     - Natural language + index → hybrid
     - Simple query + index → exact
     - No index → ripgrep

  2. hybrid: CodexLens RRF fusion (exact + fuzzy + vector)
     - Best quality, semantic understanding
     - Requires index with embeddings

  3. exact: CodexLens FTS (full-text search)
     - Precise keyword matching
     - Requires index

  4. ripgrep: Direct ripgrep execution
     - Fast, no index required
     - Literal string matching

  5. parallel: Run all backends simultaneously
     - Highest recall, runs hybrid + exact + ripgrep in parallel
     - Results merged using RRF fusion with configurable weights

**Actions:**
  - search (default): Intelligent search with auto routing
  - init: Create CodexLens index (required for hybrid/exact)
  - status: Check index and embedding availability
  - search_files: Return file paths only

**Workflow:**
  1. Run action="init" to create index
  2. Use auto mode - it routes to hybrid for NL queries, exact for simple queries
  3. Use ripgrep mode for fast searches without index`,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['init', 'search', 'search_files', 'status'],
        description: 'Action to perform: init (create index), search (default), search_files (paths only), status (check index)',
        default: 'search',
      },
      query: {
        type: 'string',
        description: 'Search query (required for search/search_files actions)',
      },
      mode: {
        type: 'string',
        enum: SEARCH_MODES,
        description: 'Search mode: auto (default), hybrid (best quality), exact (CodexLens FTS), ripgrep (fast, no index), parallel (all backends with RRF fusion)',
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
        description: 'Maximum number of results (default: 100)',
        default: 100,
      },
      limit: {
        type: 'number',
        description: 'Alias for maxResults',
        default: 100,
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
      parallelWeights: {
        type: 'object',
        properties: {
          hybrid: { type: 'number', default: 0.5 },
          exact: { type: 'number', default: 0.3 },
          ripgrep: { type: 'number', default: 0.2 },
        },
        description: 'RRF weights for parallel mode. Weights should sum to 1.0. Default: {hybrid: 0.5, exact: 0.3, ripgrep: 0.2}',
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

  const { action, mode, output_mode, limit, maxResults } = parsed.data;

  // Use limit if maxResults not provided
  if (limit && !maxResults) {
    parsed.data.maxResults = limit;
  }

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
        // Handle search modes: auto | hybrid | exact | ripgrep | parallel
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
          case 'parallel':
            result = await executeParallelMode(parsed.data);
            break;
          default:
            throw new Error(`Unsupported mode: ${mode}. Use: auto, hybrid, exact, ripgrep, or parallel`);
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
