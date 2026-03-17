/**
 * Smart Search Tool - Unified intelligent search powered by codexlens-search v2
 *
 * Features:
 * - Semantic search: 2-stage vector (binary coarse + ANN fine) + FTS5 + RRF fusion + reranking
 * - Ripgrep fallback for fast exact/regex matching
 * - File discovery via glob patterns
 * - Incremental indexing with Mark-and-Filter strategy
 * - File watcher for automatic index updates
 *
 * Actions:
 * - search: Semantic search via v2 bridge with ripgrep fallback
 * - init: Initialize v2 index and sync files
 * - status: Check v2 index statistics
 * - update: Incremental sync for changed files
 * - watch: Start file watcher for automatic updates
 * - find_files: Glob-based file path matching
 */

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';
import { spawn, spawnSync, type SpawnOptions } from 'child_process';
import { existsSync, readFileSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';
import {
  ensureReady as ensureCodexLensReady,
  checkSemanticStatus,
  ensureLiteLLMEmbedderReady,
  executeCodexLens,
  getVenvPythonPath,
} from './codex-lens.js';
import { execFile } from 'child_process';
import type { ProgressInfo } from './codex-lens.js';
import { getProjectRoot } from '../utils/path-validator.js';
import { getCodexLensDataDir } from '../utils/codexlens-path.js';
import { EXEC_TIMEOUTS } from '../utils/exec-constants.js';
import { generateRotationEndpoints } from '../config/litellm-api-config-manager.js';
import type { RotationEndpointConfig } from '../config/litellm-api-config-manager.js';

// Timing utilities for performance analysis
const TIMING_ENABLED = process.env.SMART_SEARCH_TIMING === '1' || process.env.DEBUG?.includes('timing');
const SEARCH_OUTPUT_MODES = ['full', 'files_only', 'count', 'ace'] as const;
type SearchOutputMode = typeof SEARCH_OUTPUT_MODES[number];

interface TimingData {
  [key: string]: number;
}

function createTimer(): { mark: (name: string) => void; getTimings: () => TimingData; log: () => void } {
  const startTime = performance.now();
  const marks: { name: string; time: number }[] = [];
  let lastMark = startTime;

  return {
    mark(name: string) {
      const now = performance.now();
      marks.push({ name, time: now - lastMark });
      lastMark = now;
    },
    getTimings(): TimingData {
      const timings: TimingData = {};
      marks.forEach(m => { timings[m.name] = Math.round(m.time * 100) / 100; });
      timings['_total'] = Math.round((performance.now() - startTime) * 100) / 100;
      return timings;
    },
    log() {
      if (TIMING_ENABLED) {
        const timings = this.getTimings();
        console.error(`[TIMING] smart-search: ${JSON.stringify(timings)}`);
      }
    }
  };
}

// Define Zod schema for validation
const ParamsSchema = z.object({
  // Action: search (content), find_files (path/name pattern), init, status, update (incremental sync), watch
  // Note: search_files is deprecated, use search with output_mode='files_only'
  action: z.enum(['init', 'search', 'search_files', 'find_files', 'status', 'update', 'watch']).default('search'),
  query: z.string().optional().describe('Content search query (for action="search")'),
  pattern: z.string().optional().describe('Glob pattern for path matching (for action="find_files")'),
  mode: z.enum(['fuzzy', 'semantic']).default('fuzzy'),
  output_mode: z.enum(SEARCH_OUTPUT_MODES).default('ace'),
  path: z.string().optional(),
  paths: z.array(z.string()).default([]),
  contextLines: z.number().default(0),
  maxResults: z.number().default(5),  // Default 5 with full content
  includeHidden: z.boolean().default(false),
  force: z.boolean().default(false).describe('Force full rebuild for action="init".'),
  limit: z.number().default(5),  // Default 5 with full content
  extraFilesCount: z.number().default(10),  // Additional file-only results
  maxContentLength: z.number().default(200),  // Max content length for truncation (50-2000)
  offset: z.number().default(0),  // NEW: Pagination offset (start_index)
  // Search modifiers for ripgrep mode
  regex: z.boolean().default(true),            // Use regex pattern matching (default: enabled)
  caseSensitive: z.boolean().default(true),    // Case sensitivity (default: case-sensitive)
  tokenize: z.boolean().default(true),         // Tokenize multi-word queries for OR matching (default: enabled)
  // File type filtering (default: code only)
  excludeExtensions: z.array(z.string()).optional().describe('File extensions to exclude from results (e.g., ["md", "txt"])'),
  codeOnly: z.boolean().default(true).describe('Only return code files (excludes md, txt, json, yaml, xml, etc.). Default: true'),
  withDoc: z.boolean().default(false).describe('Include documentation files (md, txt, rst, etc.). Overrides codeOnly when true'),
  // Watcher options
  debounce: z.number().default(1000).describe('Debounce interval in ms for watch action'),
  // Fuzzy matching is implicit in hybrid mode (RRF fusion)
});

type Params = z.infer<typeof ParamsSchema>;

// Search mode constants
const SEARCH_MODES = ['fuzzy', 'semantic'] as const;

// Classification confidence threshold
const CONFIDENCE_THRESHOLD = 0.7;

// File filtering configuration (ported from code-index)
const FILTER_CONFIG = {
  exclude_directories: new Set([
    '.git', '.svn', '.hg', '.bzr',
    'node_modules', '__pycache__', '.venv', 'venv', 'vendor', 'bower_components',
    'dist', 'build', 'target', 'out', 'bin', 'obj',
    '.idea', '.vscode', '.vs', '.sublime-workspace',
    '.pytest_cache', '.coverage', '.tox', '.nyc_output', 'coverage', 'htmlcov',
    '.next', '.nuxt', '.cache', '.parcel-cache',
    '.DS_Store', 'Thumbs.db',
  ]),
  exclude_files: new Set([
    '*.tmp', '*.temp', '*.swp', '*.swo', '*.bak', '*~', '*.orig', '*.log',
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Pipfile.lock',
  ]),
  // Windows device files - must use **/ pattern to match in any directory
  // These cause "os error 1" on Windows when accessed
  windows_device_files: new Set([
    'nul', 'con', 'aux', 'prn',
    'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
    'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9',
  ]),
};

function buildExcludeArgs(): string[] {
  const args: string[] = [];
  for (const dir of FILTER_CONFIG.exclude_directories) {
    args.push('--glob', `!**/${dir}/**`);
  }
  for (const pattern of FILTER_CONFIG.exclude_files) {
    args.push('--glob', `!${pattern}`);
  }
  // Windows device files need case-insensitive matching in any directory
  for (const device of FILTER_CONFIG.windows_device_files) {
    args.push('--glob', `!**/${device}`);
    args.push('--glob', `!**/${device.toUpperCase()}`);
  }
  return args;
}

/**
 * Tokenize query for multi-word OR matching
 * Splits on whitespace and common delimiters, filters stop words and short tokens
 * @param query - The search query
 * @returns Array of tokens
 */
function tokenizeQuery(query: string): string[] {
  // Stop words for filtering (common English + programming keywords)
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'can', 'to', 'of', 'in', 'for', 'on',
    'with', 'at', 'by', 'from', 'as', 'into', 'through', 'and', 'but', 'if',
    'or', 'not', 'this', 'that', 'these', 'those', 'it', 'its', 'how', 'what',
    'where', 'when', 'why', 'which', 'who', 'whom',
  ]);

  // Split on whitespace and common delimiters, keep meaningful tokens
  const tokens = query
    .split(/[\s,;:]+/)
    .map(token => token.trim())
    .filter(token => {
      // Keep tokens that are:
      // - At least 2 characters long
      // - Not a stop word (case-insensitive)
      // - Or look like identifiers (contain underscore/camelCase)
      if (token.length < 2) return false;
      if (stopWords.has(token.toLowerCase()) && !token.includes('_') && !/[A-Z]/.test(token)) {
        return false;
      }
      return true;
    });

  return tokens;
}

/**
 * Score results based on token match count for ranking
 * @param results - Search results
 * @param tokens - Query tokens
 * @returns Results with match scores
 */
function scoreByTokenMatch(results: ExactMatch[], tokens: string[]): ExactMatch[] {
  if (tokens.length <= 1) return results;

  // Create case-insensitive patterns for each token
  const tokenPatterns = tokens.map(t => {
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, 'i');
  });

  return results.map(r => {
    const content = r.content || '';
    const file = r.file || '';
    const searchText = `${file} ${content}`;

    // Count how many tokens match
    let matchCount = 0;
    for (const pattern of tokenPatterns) {
      if (pattern.test(searchText)) {
        matchCount++;
      }
    }

    // Calculate match ratio (0 to 1)
    const matchRatio = matchCount / tokens.length;

    return {
      ...r,
      matchScore: matchRatio,
      matchCount,
    };
  }).sort((a, b) => {
    // Sort by match ratio (descending), then by line number
    if (b.matchScore !== a.matchScore) {
      return b.matchScore - a.matchScore;
    }
    return (a.line || 0) - (b.line || 0);
  });
}

interface Classification {
  mode: string;
  confidence: number;
  reasoning: string;
}

interface ChunkLine {
  line: number;
  text: string;
  isMatch: boolean;
}

interface ExactMatch {
  file: string;
  line: number;
  column: number;
  content: string;
  endLine?: number;
  chunkLines?: ChunkLine[];
  matchScore?: number;  // Token match ratio (0-1) for multi-word queries
  matchCount?: number;  // Number of tokens matched
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
  line?: number;
  column?: number;
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

// File match for find_files action (path-based search)
interface FileMatch {
  path: string;
  type: 'file' | 'directory';
  name: string;       // Filename only
  extension?: string; // File extension (without dot)
}

interface PaginationInfo {
  offset: number;     // Starting index of returned results
  limit: number;      // Number of results requested
  total: number;      // Total number of results found
  has_more: boolean;  // True if more results are available
}

interface SearchSuggestion {
  title: string;
  command: string;
  reason: string;
}

interface SearchMetadata {
  mode?: string;
  backend?: string;
  count?: number;
  query?: string;
  pattern?: string;  // For find_files action
  classified_as?: string;
  confidence?: number;
  reasoning?: string;
  embeddings_coverage_percent?: number;
  warning?: string;
  note?: string;
  index_status?: 'indexed' | 'not_indexed' | 'partial';
  fallback?: string;  // Fallback mode used (e.g., 'fuzzy')
  fallback_history?: string[];
  suggested_weights?: Record<string, number>;
  // Tokenization metadata (ripgrep mode)
  tokens?: string[];   // Query tokens used for multi-word search
  tokenized?: boolean; // Whether tokenization was applied
  suggestions?: SearchSuggestion[];
  // Pagination metadata
  pagination?: PaginationInfo;
  // Performance timing data (when SMART_SEARCH_TIMING=1 or DEBUG includes 'timing')
  timing?: TimingData;
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
  api_max_workers?: number;
  endpoint_count?: number;
  use_gpu?: boolean;
  reranker_enabled?: boolean;
  reranker_backend?: string;
  reranker_model?: string;
  cascade_strategy?: string;
  staged_stage2_mode?: string;
  static_graph_enabled?: boolean;
  preset?: string;
}

interface SearchResult {
  success: boolean;
  results?: ExactMatch[] | SemanticMatch[] | GraphMatch[] | FileMatch[] | AceLikeOutput | unknown;
  extra_files?: string[];  // Additional file paths without content
  output?: string;
  metadata?: SearchMetadata;
  error?: string;
  status?: unknown;
  message?: string;
}

interface AceLikeSection {
  path: string;
  line?: number;
  endLine?: number;
  column?: number;
  score?: number;
  symbol?: string | null;
  snippet: string;
  lines?: ChunkLine[];
}

interface AceLikeGroup {
  path: string;
  sections: AceLikeSection[];
  total_matches: number;
}

interface AceLikeOutput {
  format: 'ace';
  text: string;
  groups: AceLikeGroup[];
  sections: AceLikeSection[];
  total: number;
}

interface ModelInfo {
  model_profile?: string;
  model_name?: string;
  embedding_dim?: number;
  backend?: string;
  created_at?: string;
  updated_at?: string;
}

interface CodexLensConfig {
  config_file?: string;
  index_dir?: string;
  embedding_backend?: string;  // 'fastembed' (local) or 'litellm' (api)
  embedding_model?: string;
  embedding_auto_embed_missing?: boolean;
  reranker_enabled?: boolean;
  reranker_backend?: string;   // 'onnx' (local) or 'api'
  reranker_model?: string;
  reranker_top_k?: number;
  api_max_workers?: number;
  api_batch_size?: number;
  cascade_strategy?: string;
  staged_stage2_mode?: string;
  static_graph_enabled?: boolean;
}

interface IndexStatus {
  indexed: boolean;
  has_embeddings: boolean;
  file_count?: number;
  embeddings_coverage_percent?: number;
  total_chunks?: number;
  model_info?: ModelInfo | null;
  config?: CodexLensConfig | null;
  warning?: string;
}

function readCodexLensSettingsSnapshot(): Partial<CodexLensConfig> {
  const settingsPath = join(getCodexLensDataDir(), 'settings.json');
  if (!existsSync(settingsPath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(readFileSync(settingsPath, 'utf-8')) as Record<string, any>;
    const embedding = (parsed.embedding ?? {}) as Record<string, any>;
    const reranker = (parsed.reranker ?? {}) as Record<string, any>;
    const api = (parsed.api ?? {}) as Record<string, any>;
    const cascade = (parsed.cascade ?? {}) as Record<string, any>;
    const staged = (parsed.staged ?? {}) as Record<string, any>;
    const indexing = (parsed.indexing ?? {}) as Record<string, any>;

    return {
      embedding_backend: normalizeEmbeddingBackend(typeof embedding.backend === 'string' ? embedding.backend : undefined),
      embedding_model: typeof embedding.model === 'string' ? embedding.model : undefined,
      embedding_auto_embed_missing: typeof embedding.auto_embed_missing === 'boolean' ? embedding.auto_embed_missing : undefined,
      reranker_enabled: typeof reranker.enabled === 'boolean' ? reranker.enabled : undefined,
      reranker_backend: typeof reranker.backend === 'string' ? reranker.backend : undefined,
      reranker_model: typeof reranker.model === 'string' ? reranker.model : undefined,
      reranker_top_k: typeof reranker.top_k === 'number' ? reranker.top_k : undefined,
      api_max_workers: typeof api.max_workers === 'number' ? api.max_workers : undefined,
      api_batch_size: typeof api.batch_size === 'number' ? api.batch_size : undefined,
      cascade_strategy: typeof cascade.strategy === 'string' ? cascade.strategy : undefined,
      staged_stage2_mode: typeof staged.stage2_mode === 'string' ? staged.stage2_mode : undefined,
      static_graph_enabled: typeof indexing.static_graph_enabled === 'boolean' ? indexing.static_graph_enabled : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Strip ANSI color codes from string (for JSON parsing)
 */
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/** Default maximum content length to return (avoid excessive output) */
const DEFAULT_MAX_CONTENT_LENGTH = 200;
const CODEX_LENS_FTS_COMPATIBILITY_PATTERNS = [
  /UsageError:\s*Got unexpected extra arguments?/i,
  /Option ['"]--method['"] does not take a value/i,
  /TyperArgument\.make_metavar\(\) takes 1 positional argument but 2 were given/i,
];

let codexLensFtsBackendBroken = false;
const autoInitJobs = new Map<string, { startedAt: number; languages?: string[] }>();
const autoEmbedJobs = new Map<string, { startedAt: number; backend?: string; model?: string }>();

type SmartSearchRuntimeOverrides = {
  checkSemanticStatus?: typeof checkSemanticStatus;
  getVenvPythonPath?: typeof getVenvPythonPath;
  spawnProcess?: typeof spawn;
  now?: () => number;
};

const runtimeOverrides: SmartSearchRuntimeOverrides = {};

function getSemanticStatusRuntime(): typeof checkSemanticStatus {
  return runtimeOverrides.checkSemanticStatus ?? checkSemanticStatus;
}

function getVenvPythonPathRuntime(): typeof getVenvPythonPath {
  return runtimeOverrides.getVenvPythonPath ?? getVenvPythonPath;
}

function getSpawnRuntime(): typeof spawn {
  return runtimeOverrides.spawnProcess ?? spawn;
}

function getNowRuntime(): number {
  return (runtimeOverrides.now ?? Date.now)();
}

function buildSmartSearchSpawnOptions(cwd: string, overrides: SpawnOptions = {}): SpawnOptions {
  const { env, ...rest } = overrides;
  return {
    cwd,
    shell: false,
    windowsHide: true,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', ...env },
    ...rest,
  };
}

function shouldDetachBackgroundSmartSearchProcess(): boolean {
  // On Windows, detached Python children can still create a transient console
  // window even when windowsHide is set. Background warmup only needs to outlive
  // the current request, not the MCP server process.
  return process.platform !== 'win32';
}

/**
 * Truncate content to specified length with ellipsis
 * @param content - The content to truncate
 * @param maxLength - Maximum length (default: 200)
 */
function truncateContent(content: string | null | undefined, maxLength: number = DEFAULT_MAX_CONTENT_LENGTH): string {
  if (!content) return '';
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength) + '...';
}

/**
 * Split results into full content results and extra file-only results
 * Generic function supporting both SemanticMatch and ExactMatch types
 * @param allResults - All search results (must have 'file' property)
 * @param fullContentLimit - Number of results with full content (default: 5)
 * @param extraFilesCount - Number of additional file-only results (default: 10)
 */
function splitResultsWithExtraFiles<T extends { file: string }>(
  allResults: T[],
  fullContentLimit: number = 5,
  extraFilesCount: number = 10
): { results: T[]; extra_files: string[] } {
  // First N results with full content
  const results = allResults.slice(0, fullContentLimit);

  // Next M results as file paths only (deduplicated)
  const extraResults = allResults.slice(fullContentLimit, fullContentLimit + extraFilesCount);
  const extra_files = [...new Set(extraResults.map(r => r.file))];

  return { results, extra_files };
}

interface SearchScope {
  workingDirectory: string;
  searchPaths: string[];
  targetFile?: string;
}

interface RipgrepQueryModeResolution {
  regex: boolean;
  tokenize: boolean;
  tokens: string[];
  literalFallback: boolean;
  warning?: string;
}

const GENERATED_QUERY_RE = /(?<!\w)(dist|build|out|coverage|htmlcov|generated|bundle|compiled|artifact|artifacts|\.workflow)(?!\w)/i;
const ENV_STYLE_QUERY_RE = /\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/;
const TOPIC_TOKEN_RE = /[A-Za-z][A-Za-z0-9]*/g;
const LEXICAL_PRIORITY_SURFACE_TOKENS = new Set([
  'config',
  'configs',
  'configuration',
  'configurations',
  'setting',
  'settings',
  'backend',
  'backends',
  'environment',
  'env',
  'variable',
  'variables',
  'factory',
  'factories',
  'override',
  'overrides',
  'option',
  'options',
  'flag',
  'flags',
  'mode',
  'modes',
]);
const LEXICAL_PRIORITY_FOCUS_TOKENS = new Set([
  'embedding',
  'embeddings',
  'reranker',
  'rerankers',
  'onnx',
  'api',
  'litellm',
  'fastembed',
  'local',
  'legacy',
  'stage',
  'stage2',
  'stage3',
  'stage4',
  'precomputed',
  'realtime',
  'static',
  'global',
  'graph',
  'selection',
  'model',
  'models',
]);

function sanitizeSearchQuery(query: string | undefined): string | undefined {
  if (!query) {
    return query;
  }

  return query.replace(/\r?\n\s*/g, ' ').trim();
}

function sanitizeSearchPath(pathValue: string | undefined): string | undefined {
  if (!pathValue) {
    return pathValue;
  }

  return pathValue.replace(/\r?\n\s*/g, '').trim();
}

function resolveSearchScope(pathValue: string = '.', paths: string[] = []): SearchScope {
  const normalizedPath = sanitizeSearchPath(pathValue) || '.';
  const normalizedPaths = paths.map((item) => sanitizeSearchPath(item) || item);
  const fallbackPath = normalizedPath || getProjectRoot();

  try {
    const resolvedPath = resolve(fallbackPath);
    const stats = statSync(resolvedPath);

    if (stats.isFile()) {
      return {
        workingDirectory: dirname(resolvedPath),
        searchPaths: normalizedPaths.length > 0 ? normalizedPaths : [resolvedPath],
        targetFile: resolvedPath,
      };
    }

    return {
      workingDirectory: resolvedPath,
      searchPaths: normalizedPaths.length > 0 ? normalizedPaths : ['.'],
    };
  } catch {
    return {
      workingDirectory: fallbackPath,
      searchPaths: normalizedPaths.length > 0 ? normalizedPaths : [normalizedPath || '.'],
    };
  }
}

function normalizeResultFilePath(filePath: string, workingDirectory: string): string {
  return resolve(workingDirectory, filePath).replace(/\\/g, '/');
}

function filterResultsToTargetFile<T extends { file: string }>(results: T[], scope: SearchScope): T[] {
  if (!scope.targetFile) {
    return results;
  }

  const normalizedTarget = scope.targetFile.replace(/\\/g, '/');
  return results.filter((result) => normalizeResultFilePath(result.file, scope.workingDirectory) === normalizedTarget);
}

function parseCodexLensJsonOutput(output: string | undefined): any | null {
  const cleanOutput = stripAnsi(output || '').trim();
  if (!cleanOutput) {
    return null;
  }

  const candidates = [
    cleanOutput,
    ...cleanOutput.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith('{') || line.startsWith('[')),
  ];

  const firstBrace = cleanOutput.indexOf('{');
  const lastBrace = cleanOutput.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(cleanOutput.slice(firstBrace, lastBrace + 1));
  }

  const firstBracket = cleanOutput.indexOf('[');
  const lastBracket = cleanOutput.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    candidates.push(cleanOutput.slice(firstBracket, lastBracket + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      continue;
    }
  }

  return null;
}

function isValidRegexPattern(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

function resolveRipgrepQueryMode(query: string, regex: boolean = true, tokenize: boolean = true): RipgrepQueryModeResolution {
  const tokens = tokenize ? tokenizeQuery(query) : [query];

  if (!regex) {
    return {
      regex: false,
      tokenize,
      tokens,
      literalFallback: false,
    };
  }

  const invalidTokens = tokens.filter((token) => token.length > 0 && !isValidRegexPattern(token));
  if (invalidTokens.length === 0) {
    return {
      regex: true,
      tokenize,
      tokens,
      literalFallback: false,
    };
  }

  const preview = truncateContent(invalidTokens[0], 40);
  return {
    regex: false,
    tokenize,
    tokens,
    literalFallback: true,
    warning: invalidTokens.length === 1
      ? `Query token "${preview}" is not a valid regular expression. Falling back to literal ripgrep matching.`
      : 'Query contains invalid regular expression tokens. Falling back to literal ripgrep matching.',
  };
}

function isCodexLensCliCompatibilityError(error: string | undefined): boolean {
  if (!error) {
    return false;
  }

  const cleanError = stripAnsi(error);
  return CODEX_LENS_FTS_COMPATIBILITY_PATTERNS.some((pattern) => pattern.test(cleanError));
}

function noteCodexLensFtsCompatibility(error: string | undefined): boolean {
  if (!isCodexLensCliCompatibilityError(error)) {
    return false;
  }

  codexLensFtsBackendBroken = true;
  return true;
}

function shouldSurfaceCodexLensFtsCompatibilityWarning(options: {
  compatibilityTriggeredThisQuery: boolean;
  skipExactDueToCompatibility: boolean;
  ripgrepResultCount: number;
}): boolean {
  if (options.ripgrepResultCount > 0) {
    return false;
  }

  return options.compatibilityTriggeredThisQuery || options.skipExactDueToCompatibility;
}

function summarizeBackendError(error: string | undefined): string {
  const cleanError = stripAnsi(error || '').trim();
  if (!cleanError) {
    return 'unknown error';
  }

  if (isCodexLensCliCompatibilityError(cleanError)) {
    return 'CodexLens exact search CLI is incompatible with the current Typer/Click runtime';
  }

  const regexSummary = cleanError.match(/error:\s*([^\r\n]+)/i);
  if (/regex parse error/i.test(cleanError) && regexSummary?.[1]) {
    return `invalid regular expression (${regexSummary[1].trim()})`;
  }

  const usageSummary = cleanError.match(/UsageError:\s*([^\r\n]+)/i);
  if (usageSummary?.[1]) {
    return usageSummary[1].trim();
  }

  const firstMeaningfulLine = cleanError
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('│') && !line.startsWith('┌') && !line.startsWith('└'));

  return truncateContent(firstMeaningfulLine || cleanError, 180);
}

function mapCodexLensSemanticMatches(data: any[], scope: SearchScope, maxContentLength: number): SemanticMatch[] {
  return filterResultsToTargetFile(data.map((item: any) => {
    const rawScore = item.score || 0;
    const similarityScore = rawScore > 0 ? 1 / (1 + rawScore) : 1;
    return {
      file: item.path || item.file,
      line: typeof item.line === 'number' ? item.line : undefined,
      column: typeof item.column === 'number' ? item.column : undefined,
      score: similarityScore,
      content: truncateContent(item.content || item.excerpt, maxContentLength),
      symbol: item.symbol || null,
    };
  }), scope);
}

function parsePlainTextFileMatches(output: string | undefined, scope: SearchScope): SemanticMatch[] {
  const lines = stripAnsi(output || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const fileLines = lines.filter((line) => {
    if (line.includes('RuntimeWarning:') || line.startsWith('warn(') || line.startsWith('Warning:')) {
      return false;
    }

    const resolvedPath = /^[a-zA-Z]:[\\/]|^\//.test(line)
      ? line
      : resolve(scope.workingDirectory, line);

    try {
      return statSync(resolvedPath).isFile();
    } catch {
      return false;
    }
  });

  return filterResultsToTargetFile(
    [...new Set(fileLines)].map((file, index) => ({
      file,
      score: Math.max(0.1, 1 - index * 0.05),
      content: '',
      symbol: null,
    })),
    scope,
  );
}

function hasCentralizedVectorArtifacts(indexRoot: unknown): boolean {
  if (typeof indexRoot !== 'string' || !indexRoot.trim()) {
    return false;
  }

  const resolvedRoot = resolve(indexRoot);
  return [
    join(resolvedRoot, '_vectors.hnsw'),
    join(resolvedRoot, '_vectors_meta.db'),
    join(resolvedRoot, '_binary_vectors.mmap'),
  ].every((artifactPath) => existsSync(artifactPath));
}

function asObjectRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function extractEmbeddingsStatusSummary(embeddingsData: unknown): {
  coveragePercent: number;
  totalChunks: number;
  hasEmbeddings: boolean;
} {
  const embeddings = asObjectRecord(embeddingsData) ?? {};
  const root = asObjectRecord(embeddings.root) ?? embeddings;
  const centralized = asObjectRecord(embeddings.centralized);

  const totalIndexes = asFiniteNumber(root.total_indexes)
    ?? asFiniteNumber(embeddings.total_indexes)
    ?? 0;
  const indexesWithEmbeddings = asFiniteNumber(root.indexes_with_embeddings)
    ?? asFiniteNumber(embeddings.indexes_with_embeddings)
    ?? 0;
  const totalChunks = asFiniteNumber(root.total_chunks)
    ?? asFiniteNumber(embeddings.total_chunks)
    ?? 0;
  const coveragePercent = asFiniteNumber(root.coverage_percent)
    ?? asFiniteNumber(embeddings.coverage_percent)
    ?? (totalIndexes > 0 ? (indexesWithEmbeddings / totalIndexes) * 100 : 0);
  const hasEmbeddings = asBoolean(root.has_embeddings)
    ?? asBoolean(centralized?.usable)
    ?? (totalChunks > 0 || indexesWithEmbeddings > 0 || coveragePercent > 0);

  return {
    coveragePercent,
    totalChunks,
    hasEmbeddings,
  };
}

function selectEmbeddingsStatusPayload(statusData: unknown): Record<string, unknown> {
  const status = asObjectRecord(statusData) ?? {};
  return asObjectRecord(status.embeddings_status) ?? asObjectRecord(status.embeddings) ?? {};
}

function collectBackendError(
  errors: string[],
  backendName: string,
  backendResult: PromiseSettledResult<SearchResult>,
): void {
  if (backendResult.status === 'rejected') {
    errors.push(`${backendName}: ${summarizeBackendError(String(backendResult.reason))}`);
    return;
  }

  if (!backendResult.value.success) {
    errors.push(`${backendName}: ${summarizeBackendError(backendResult.value.error)}`);
  }
}

function mergeWarnings(...warnings: Array<string | undefined>): string | undefined {
  const merged = [...new Set(
    warnings
      .filter((warning): warning is string => typeof warning === 'string' && warning.trim().length > 0)
      .map((warning) => warning.trim())
  )];
  return merged.length > 0 ? merged.join(' | ') : undefined;
}

function mergeNotes(...notes: Array<string | undefined>): string | undefined {
  const merged = [...new Set(
    notes
      .filter((note): note is string => typeof note === 'string' && note.trim().length > 0)
      .map((note) => note.trim())
  )];
  return merged.length > 0 ? merged.join(' | ') : undefined;
}

function mergeSuggestions(...groups: Array<SearchSuggestion[] | undefined>): SearchSuggestion[] | undefined {
  const merged = new Map<string, SearchSuggestion>();
  for (const group of groups) {
    for (const suggestion of group ?? []) {
      if (!merged.has(suggestion.command)) {
        merged.set(suggestion.command, suggestion);
      }
    }
  }

  return merged.size > 0 ? [...merged.values()] : undefined;
}

function formatSmartSearchCommand(action: string, pathValue: string, extraParams: Record<string, unknown> = {}): string {
  const normalizedPath = pathValue.replace(/\\/g, '/');
  const args = [`action=${JSON.stringify(action)}`, `path=${JSON.stringify(normalizedPath)}`];

  for (const [key, value] of Object.entries(extraParams)) {
    if (value === undefined) {
      continue;
    }
    args.push(`${key}=${JSON.stringify(value)}`);
  }

  return `smart_search(${args.join(', ')})`;
}

function parseOptionalBooleanEnv(raw: string | undefined): boolean | undefined {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (['1', 'true', 'on', 'yes'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'off', 'no'].includes(normalized)) {
    return false;
  }

  return undefined;
}

function isAutoEmbedMissingEnabled(config: CodexLensConfig | null | undefined): boolean {
  const envOverride = parseOptionalBooleanEnv(process.env.CODEXLENS_AUTO_EMBED_MISSING);
  if (envOverride !== undefined) {
    return envOverride;
  }

  if (process.platform === 'win32') {
    return false;
  }

  if (typeof config?.embedding_auto_embed_missing === 'boolean') {
    return config.embedding_auto_embed_missing;
  }

  return true;
}

function isAutoInitMissingEnabled(): boolean {
  const envOverride = parseOptionalBooleanEnv(process.env.CODEXLENS_AUTO_INIT_MISSING);
  if (envOverride !== undefined) {
    return envOverride;
  }

  return process.platform !== 'win32';
}

function getAutoEmbedMissingDisabledReason(config: CodexLensConfig | null | undefined): string {
  const envOverride = parseOptionalBooleanEnv(process.env.CODEXLENS_AUTO_EMBED_MISSING);
  if (envOverride === false) {
    return 'Automatic embedding warmup is disabled by CODEXLENS_AUTO_EMBED_MISSING=false.';
  }

  if (config?.embedding_auto_embed_missing === false) {
    return 'Automatic embedding warmup is disabled by embedding.auto_embed_missing=false.';
  }

  if (process.platform === 'win32') {
    return 'Automatic embedding warmup is disabled by default on Windows even if CodexLens config resolves auto_embed_missing=true. Set CODEXLENS_AUTO_EMBED_MISSING=true to opt in.';
  }

  return 'Automatic embedding warmup is disabled.';
}

function getAutoInitMissingDisabledReason(): string {
  const envOverride = parseOptionalBooleanEnv(process.env.CODEXLENS_AUTO_INIT_MISSING);
  if (envOverride === false) {
    return 'Automatic static index warmup is disabled by CODEXLENS_AUTO_INIT_MISSING=false.';
  }

  if (process.platform === 'win32') {
    return 'Automatic static index warmup is disabled by default on Windows. Set CODEXLENS_AUTO_INIT_MISSING=true to opt in.';
  }

  return 'Automatic static index warmup is disabled.';
}

function buildIndexSuggestions(indexStatus: IndexStatus, scope: SearchScope): SearchSuggestion[] | undefined {
  const suggestions: SearchSuggestion[] = [];

  if (!indexStatus.indexed) {
    suggestions.push({
      title: 'Initialize index',
      command: formatSmartSearchCommand('init', scope.workingDirectory),
      reason: 'No CodexLens index exists for this path yet.',
    });
    suggestions.push({
      title: 'Check index status',
      command: formatSmartSearchCommand('status', scope.workingDirectory),
      reason: 'Verify whether the target path is mapped to the expected CodexLens project root.',
    });
    return suggestions;
  }

  if (!indexStatus.has_embeddings) {
    suggestions.push({
      title: 'Generate embeddings',
      command: formatSmartSearchCommand('embed', scope.workingDirectory),
      reason: 'The index exists, but semantic/vector retrieval is unavailable until embeddings are generated.',
    });
  } else if ((indexStatus.embeddings_coverage_percent ?? 0) < 50) {
    suggestions.push({
      title: 'Rebuild embeddings',
      command: formatSmartSearchCommand('embed', scope.workingDirectory, { force: true }),
      reason: `Embedding coverage is only ${(indexStatus.embeddings_coverage_percent ?? 0).toFixed(1)}%, so semantic search quality is degraded.`,
    });
  }

  if (indexStatus.warning?.includes('Failed to parse index status')) {
    suggestions.push({
      title: 'Re-check status',
      command: formatSmartSearchCommand('status', scope.workingDirectory),
      reason: 'The index health payload could not be parsed cleanly.',
    });
  }

  return suggestions.length > 0 ? suggestions : undefined;
}

/**
 * Check if CodexLens index exists for current directory
 * @param path - Directory path to check
 * @returns Index status
 */
async function checkIndexStatus(path: string = '.'): Promise<IndexStatus> {
  const scope = resolveSearchScope(path);
  try {
    // Fetch both status and config in parallel
    const [statusResult, configResult] = await Promise.all([
      executeCodexLens(['index', 'status', scope.workingDirectory], { cwd: scope.workingDirectory }),
      executeCodexLens(['config', '--json'], { cwd: scope.workingDirectory }),
    ]);

    // Parse config
    const settingsConfig = readCodexLensSettingsSnapshot();
    let config: CodexLensConfig | null = Object.keys(settingsConfig).length > 0 ? { ...settingsConfig } : null;
    if (configResult.success && configResult.output) {
      try {
        const cleanConfigOutput = stripAnsi(configResult.output);
        const parsedConfig = JSON.parse(cleanConfigOutput);
        const configData = parsedConfig.result || parsedConfig;
        config = {
          ...settingsConfig,
          config_file: configData.config_file,
          index_dir: configData.index_dir,
          embedding_backend: normalizeEmbeddingBackend(configData.embedding_backend) ?? settingsConfig.embedding_backend,
          embedding_model: typeof configData.embedding_model === 'string' ? configData.embedding_model : settingsConfig.embedding_model,
          embedding_auto_embed_missing: typeof configData.embedding_auto_embed_missing === 'boolean'
            ? configData.embedding_auto_embed_missing
            : settingsConfig.embedding_auto_embed_missing,
          reranker_enabled: typeof configData.reranker_enabled === 'boolean' ? configData.reranker_enabled : settingsConfig.reranker_enabled,
          reranker_backend: typeof configData.reranker_backend === 'string' ? configData.reranker_backend : settingsConfig.reranker_backend,
          reranker_model: typeof configData.reranker_model === 'string' ? configData.reranker_model : settingsConfig.reranker_model,
          reranker_top_k: typeof configData.reranker_top_k === 'number' ? configData.reranker_top_k : settingsConfig.reranker_top_k,
        };
      } catch {
        // Config parse failed, continue without it
      }
    }

    if (!statusResult.success) {
      return {
        indexed: false,
        has_embeddings: false,
        config,
        warning: 'No CodexLens index found. Run smart_search(action="init") to create index for better search results.',
      };
    }

    // Parse status output
    try {
      // Strip ANSI color codes from JSON output
      const cleanOutput = stripAnsi(statusResult.output || '{}');
      const parsed = JSON.parse(cleanOutput);
      // Handle both direct and nested response formats (status returns {success, result: {...}})
      const status = parsed.result || parsed;

      // Get embeddings coverage from comprehensive status
      const embeddingsData = selectEmbeddingsStatusPayload(status);
      const legacyEmbeddingsData = asObjectRecord(status.embeddings) ?? {};
      const embeddingsSummary = extractEmbeddingsStatusSummary(embeddingsData);
      const totalIndexes = Number(legacyEmbeddingsData.total_indexes || asObjectRecord(embeddingsData)?.total_indexes || 0);
      const embeddingsCoverage = embeddingsSummary.coveragePercent;
      const totalChunks = embeddingsSummary.totalChunks;
      const indexed = Boolean(status.projects_count > 0 || status.total_files > 0 || status.index_root || totalIndexes > 0 || totalChunks > 0);
      const has_embeddings = embeddingsSummary.hasEmbeddings;

      // Extract model info if available
      const modelInfoData = asObjectRecord(embeddingsData.model_info);
      const modelInfo: ModelInfo | undefined = modelInfoData ? {
        model_profile: typeof modelInfoData.model_profile === 'string' ? modelInfoData.model_profile : undefined,
        model_name: typeof modelInfoData.model_name === 'string' ? modelInfoData.model_name : undefined,
        embedding_dim: typeof modelInfoData.embedding_dim === 'number' ? modelInfoData.embedding_dim : undefined,
        backend: typeof modelInfoData.backend === 'string' ? modelInfoData.backend : undefined,
        created_at: typeof modelInfoData.created_at === 'string' ? modelInfoData.created_at : undefined,
        updated_at: typeof modelInfoData.updated_at === 'string' ? modelInfoData.updated_at : undefined,
      } : undefined;

      let warning: string | undefined;
      if (!indexed) {
        warning = 'No CodexLens index found. Run smart_search(action="init") to create index for better search results.';
      } else if (embeddingsCoverage === 0) {
        warning = 'Index exists but no embeddings generated. Run smart_search(action="embed") to build the vector index.';
      } else if (embeddingsCoverage < 50) {
        warning = `Embeddings coverage is ${embeddingsCoverage.toFixed(1)}% (below 50%). Hybrid search will degrade. Run smart_search(action="embed") to improve vector coverage.`;
      }

      return {
        indexed,
        has_embeddings,
        file_count: status.total_files,
        embeddings_coverage_percent: embeddingsCoverage,
        total_chunks: totalChunks,
        // Ensure model_info is null instead of undefined so it's included in JSON
        model_info: modelInfo ?? null,
        config,
        warning,
      };
    } catch {
      return {
        indexed: false,
        has_embeddings: false,
        config,
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

function looksLikeCodeQuery(query: string): boolean {
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(query)) return true;
  if (/[:.<>\-=(){}[\]]/.test(query) && query.split(/\s+/).length <= 2) return true;
  if (/\.\*|\\\(|\\\[|\\s/.test(query)) return true;
  if (/^[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*$/.test(query)) return true;
  return false;
}

function queryTargetsGeneratedFiles(query: string): boolean {
  return GENERATED_QUERY_RE.test(query.trim());
}

function prefersLexicalPriorityQuery(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  if (ENV_STYLE_QUERY_RE.test(trimmed)) return true;

  const tokens = new Set((trimmed.match(TOPIC_TOKEN_RE) ?? []).map((token) => token.toLowerCase()));
  if (tokens.size === 0) return false;
  if (tokens.has('factory') || tokens.has('factories')) return true;
  if ((tokens.has('environment') || tokens.has('env')) && (tokens.has('variable') || tokens.has('variables'))) {
    return true;
  }
  if (
    tokens.has('backend') &&
    ['embedding', 'embeddings', 'reranker', 'rerankers', 'onnx', 'api', 'litellm', 'fastembed', 'local', 'legacy']
      .some((token) => tokens.has(token))
  ) {
    return true;
  }

  let surfaceHit = false;
  let focusHit = false;
  for (const token of tokens) {
    if (LEXICAL_PRIORITY_SURFACE_TOKENS.has(token)) surfaceHit = true;
    if (LEXICAL_PRIORITY_FOCUS_TOKENS.has(token)) focusHit = true;
    if (surfaceHit && focusHit) return true;
  }
  return false;
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
  const isNaturalLanguage = detectNaturalLanguage(query);
  const isCodeQuery = looksLikeCodeQuery(query);
  const isRegexPattern = detectRegex(query);
  const targetsGeneratedFiles = queryTargetsGeneratedFiles(query);
  const prefersLexicalPriority = prefersLexicalPriorityQuery(query);

  let mode: string;
  let confidence: number;

  if (!hasIndex) {
    mode = 'ripgrep';
    confidence = 1.0;
  } else if (targetsGeneratedFiles || prefersLexicalPriority || isCodeQuery || isRegexPattern) {
    mode = 'exact';
    confidence = targetsGeneratedFiles ? 0.97 : prefersLexicalPriority ? 0.93 : 0.95;
  } else if (isNaturalLanguage && hasSufficientEmbeddings) {
    mode = 'hybrid';
    confidence = 0.9;
  } else {
    mode = 'exact';
    confidence = 0.8;
  }

  const detectedPatterns: string[] = [];
  if (detectLiteral(query)) detectedPatterns.push('literal');
  if (detectRegex(query)) detectedPatterns.push('regex');
  if (detectNaturalLanguage(query)) detectedPatterns.push('natural language');
  if (detectFilePath(query)) detectedPatterns.push('file path');
  if (detectRelationship(query)) detectedPatterns.push('relationship');
  if (targetsGeneratedFiles) detectedPatterns.push('generated artifact');
  if (prefersLexicalPriority) detectedPatterns.push('lexical priority');
  if (isCodeQuery) detectedPatterns.push('code identifier');

  const reasoning = `Query classified as ${mode} (confidence: ${confidence.toFixed(2)}, detected: ${detectedPatterns.join(', ')}, index: ${hasIndex ? 'available' : 'not available'}, embeddings: ${hasSufficientEmbeddings ? 'sufficient' : 'insufficient'})`;

  return { mode, confidence, reasoning };
}

/**
 * Check if a tool is available in PATH
 * @param toolName - Tool executable name
 * @returns True if available
 */
function checkToolAvailability(
  toolName: string,
  lookupRuntime: typeof spawnSync = spawnSync,
): boolean {
  try {
    const isWindows = process.platform === 'win32';
    const command = isWindows ? 'where' : 'which';
    const result = lookupRuntime(command, [toolName], {
      shell: false,
      windowsHide: true,
      stdio: 'ignore',
      timeout: EXEC_TIMEOUTS.SYSTEM_INFO,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    return !result.error && result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Build ripgrep command arguments
 * Supports tokenized multi-word queries with OR matching
 * @param params - Search parameters
 * @returns Command, arguments, and tokens used
 */
function buildRipgrepCommand(params: {
  query: string;
  paths: string[];
  contextLines: number;
  maxResults: number;
  includeHidden: boolean;
  regex?: boolean;
  caseSensitive?: boolean;
  tokenize?: boolean;
}): { command: string; args: string[]; tokens: string[]; warning?: string; literalFallback: boolean; regex: boolean } {
  const { query, paths = ['.'], contextLines = 0, maxResults = 10, includeHidden = false, regex = false, caseSensitive = true, tokenize = true } = params;
  const queryMode = resolveRipgrepQueryMode(query, regex, tokenize);

  const args = [
    '-n',
    '--color=never',
    '--json',
  ];

  // Add file filtering (unless includeHidden is true)
  if (!includeHidden) {
    args.push(...buildExcludeArgs());
  }

  // Case sensitivity
  if (!caseSensitive) {
    args.push('--ignore-case');
  }

  if (contextLines > 0) {
    args.push('-C', contextLines.toString());
  }

  if (maxResults > 0) {
    args.push('--max-count', maxResults.toString());
  }

  if (includeHidden) {
    args.push('--hidden');
  }

  const { tokens } = queryMode;

  if (tokens.length > 1) {
    // Multi-token: use multiple -e patterns (OR matching)
    // Each token is escaped for regex safety unless regex mode is enabled
    for (const token of tokens) {
      if (queryMode.regex) {
        args.push('-e', token);
      } else {
        // Escape regex special chars for literal matching
        const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        args.push('-e', escaped);
      }
    }
  } else {
    // Single token or no tokenization: use original behavior
    if (queryMode.regex) {
      args.push('-e', query);
    } else {
      args.push('-F', query);
    }
  }

  args.push(...paths);

  return {
    command: 'rg',
    args,
    tokens,
    warning: queryMode.warning,
    literalFallback: queryMode.literalFallback,
    regex: queryMode.regex,
  };
}

interface RipgrepChunkAccumulator {
  file: string;
  chunkLines: ChunkLine[];
  firstMatchLine?: number;
  firstMatchColumn?: number;
  lastLine?: number;
  matchCount: number;
}

function finalizeRipgrepChunk(accumulator: RipgrepChunkAccumulator | undefined): ExactMatch | null {
  if (!accumulator || accumulator.matchCount === 0 || accumulator.chunkLines.length === 0) {
    return null;
  }

  const firstLine = accumulator.chunkLines[0]?.line ?? accumulator.firstMatchLine ?? 1;
  const lastLine = accumulator.chunkLines[accumulator.chunkLines.length - 1]?.line ?? accumulator.firstMatchLine ?? firstLine;

  return {
    file: accumulator.file,
    line: accumulator.firstMatchLine ?? firstLine,
    endLine: lastLine,
    column: accumulator.firstMatchColumn ?? 1,
    content: accumulator.chunkLines.map((line) => line.text).join('\n').trim(),
    chunkLines: [...accumulator.chunkLines],
  };
}

function parseRipgrepJsonResults(stdout: string, effectiveLimit: number): { results: ExactMatch[]; resultLimitReached: boolean } {
  const allResults: ExactMatch[] = [];
  const activeChunks = new Map<string, RipgrepChunkAccumulator>();
  const lines = stdout.split('\n').filter((line) => line.trim());
  let resultLimitReached = false;

  const flushChunk = (file: string) => {
    const finalized = finalizeRipgrepChunk(activeChunks.get(file));
    activeChunks.delete(file);
    if (!finalized) {
      return;
    }
    allResults.push(finalized);
    if (allResults.length >= effectiveLimit) {
      resultLimitReached = true;
    }
  };

  for (const line of lines) {
    if (resultLimitReached) {
      break;
    }

    try {
      const item = JSON.parse(line);
      if (item.type !== 'match' && item.type !== 'context' && item.type !== 'end') {
        continue;
      }

      const file = item.data?.path?.text as string | undefined;
      if (!file) {
        continue;
      }

      if (item.type === 'end') {
        flushChunk(file);
        continue;
      }

      const lineNumber = typeof item.data?.line_number === 'number' ? item.data.line_number : undefined;
      const rawText = typeof item.data?.lines?.text === 'string'
        ? item.data.lines.text.replace(/\r?\n$/, '')
        : '';

      if (lineNumber === undefined) {
        continue;
      }

      let current = activeChunks.get(file);
      const isContiguous = current && current.lastLine !== undefined && lineNumber <= current.lastLine + 1;
      if (!current || !isContiguous) {
        if (current) {
          flushChunk(file);
          if (resultLimitReached) {
            break;
          }
        }
        current = {
          file,
          chunkLines: [],
          matchCount: 0,
        };
        activeChunks.set(file, current);
      }

      const previousLine = current.chunkLines[current.chunkLines.length - 1];
      const duplicateLine = previousLine && previousLine.line === lineNumber && previousLine.text === rawText;
      if (!duplicateLine) {
        current.chunkLines.push({
          line: lineNumber,
          text: rawText,
          isMatch: item.type === 'match',
        });
      } else if (item.type === 'match') {
        previousLine.isMatch = true;
      }

      if (item.type === 'match') {
        current.matchCount += 1;
        if (current.firstMatchLine === undefined) {
          current.firstMatchLine = lineNumber;
          current.firstMatchColumn =
            item.data.submatches && item.data.submatches[0]
              ? item.data.submatches[0].start + 1
              : 1;
        }
      }
      current.lastLine = lineNumber;
    } catch {
      continue;
    }
  }

  if (!resultLimitReached) {
    for (const file of [...activeChunks.keys()]) {
      flushChunk(file);
      if (resultLimitReached) {
        break;
      }
    }
  }

  return { results: allResults.slice(0, effectiveLimit), resultLimitReached };
}

function normalizeEmbeddingBackend(backend?: string): string | undefined {
  if (!backend) {
    return undefined;
  }

  const normalized = backend.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized === 'api') {
    return 'litellm';
  }
  if (normalized === 'local') {
    return 'fastembed';
  }
  return normalized;
}

function buildIndexInitArgs(projectPath: string, options: { force?: boolean; languages?: string[]; noEmbeddings?: boolean } = {}): string[] {
  const { force = false, languages, noEmbeddings = true } = options;
  const args = ['index', 'init', projectPath];

  if (noEmbeddings) {
    args.push('--no-embeddings');
  }
  if (force) {
    args.push('--force');
  }
  if (languages && languages.length > 0) {
    args.push(...languages.flatMap((language) => ['--language', language]));
  }

  return args;
}

function resolveEmbeddingSelection(
  requestedBackend: string | undefined,
  requestedModel: string | undefined,
  config: CodexLensConfig | null | undefined,
): { backend?: string; model?: string; preset: 'explicit' | 'config' | 'bulk-local-fast'; note?: string } {
  const normalizedRequestedBackend = normalizeEmbeddingBackend(requestedBackend);
  const normalizedRequestedModel = requestedModel?.trim() || undefined;

  if (normalizedRequestedBackend) {
    return {
      backend: normalizedRequestedBackend,
      model: normalizedRequestedModel || config?.embedding_model,
      preset: 'explicit',
    };
  }

  if (normalizedRequestedModel) {
    const inferredBackend = config?.embedding_backend
      || (['fast', 'code'].includes(normalizedRequestedModel) ? 'fastembed' : undefined);
    return {
      backend: inferredBackend,
      model: normalizedRequestedModel,
      preset: inferredBackend ? 'config' : 'explicit',
    };
  }

  return {
    backend: 'fastembed',
    model: 'fast',
    preset: 'bulk-local-fast',
    note: config?.embedding_backend && config.embedding_backend !== 'fastembed'
      ? `Using recommended bulk indexing preset: local-fast instead of configured ${config.embedding_backend}. Pass embeddingBackend="api" to force remote API embeddings.`
      : 'Using recommended bulk indexing preset: local-fast. Pass embeddingBackend="api" to force remote API embeddings.',
  };
}

const EMBED_PROGRESS_PREFIX = '__CCW_EMBED_PROGRESS__';

function resolveEmbeddingEndpoints(backend?: string): RotationEndpointConfig[] {
  if (backend !== 'litellm') {
    return [];
  }

  try {
    return generateRotationEndpoints(getProjectRoot()).filter((endpoint) => {
      const apiKey = endpoint.api_key?.trim() ?? '';
      return Boolean(
        apiKey &&
        apiKey.length > 8 &&
        !/^\*+$/.test(apiKey) &&
        endpoint.api_base?.trim() &&
        endpoint.model?.trim()
      );
    });
  } catch {
    return [];
  }
}

function resolveApiWorkerCount(
  requestedWorkers: number | undefined,
  backend: string | undefined,
  endpoints: RotationEndpointConfig[]
): number | undefined {
  if (backend !== 'litellm') {
    return undefined;
  }

  if (typeof requestedWorkers === 'number' && Number.isFinite(requestedWorkers)) {
    return Math.max(1, Math.floor(requestedWorkers));
  }

  if (endpoints.length <= 1) {
    return 4;
  }

  return Math.min(16, Math.max(4, endpoints.length * 2));
}

function extractEmbedJsonLine(stdout: string): string | undefined {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith(EMBED_PROGRESS_PREFIX));

  return [...lines].reverse().find((line) => line.startsWith('{') && line.endsWith('}'));
}

function buildEmbeddingPythonCode(params: {
  projectPath: string;
  backend?: string;
  model?: string;
  force: boolean;
  maxWorkers?: number;
  endpoints?: RotationEndpointConfig[];
}): string {
  const { projectPath, backend, model, force, maxWorkers, endpoints = [] } = params;
  return `
import json
import sys
from pathlib import Path
from codexlens.storage.path_mapper import PathMapper
from codexlens.storage.registry import RegistryStore
from codexlens.cli.embedding_manager import generate_dense_embeddings_centralized

target_path = Path(r"__PROJECT_PATH__").expanduser().resolve()
backend = __BACKEND__
model = __MODEL__
force = __FORCE__
max_workers = __MAX_WORKERS__
endpoints = json.loads(r'''__ENDPOINTS_JSON__''')

def progress_update(message: str):
    print("__CCW_EMBED_PROGRESS__" + str(message), flush=True)

registry = RegistryStore()
registry.initialize()
try:
    project = registry.get_project(target_path)
    index_root = None
    if project is not None:
        index_root = Path(project.index_root)
    else:
        mapper = PathMapper()
        index_db = mapper.source_to_index_db(target_path)
        if index_db.exists():
            index_root = index_db.parent
        else:
            nearest = registry.find_nearest_index(target_path)
            if nearest is not None:
                index_root = Path(nearest.index_path).parent

    if index_root is None:
        print(json.dumps({"success": False, "error": f"No index found for: {target_path}"}), flush=True)
        sys.exit(1)

    result = generate_dense_embeddings_centralized(
        index_root,
        embedding_backend=backend,
        model_profile=model,
        force=force,
        use_gpu=True,
        max_workers=max_workers,
        endpoints=endpoints if endpoints else None,
        progress_callback=progress_update,
    )

    print(json.dumps(result), flush=True)
    if not result.get("success"):
        sys.exit(1)
finally:
    registry.close()
`
    .replace('__PROJECT_PATH__', projectPath.replace(/\\/g, '\\\\'))
    .replace('__BACKEND__', backend ? JSON.stringify(backend) : 'None')
    .replace('__MODEL__', model ? JSON.stringify(model) : 'None')
    .replace('__FORCE__', force ? 'True' : 'False')
    .replace('__MAX_WORKERS__', typeof maxWorkers === 'number' ? String(Math.max(1, Math.floor(maxWorkers))) : 'None')
    .replace('__ENDPOINTS_JSON__', JSON.stringify(endpoints).replace(/\\/g, '\\\\').replace(/'''/g, "\\'\\'\\'"));
}

function spawnBackgroundEmbeddingsViaPython(params: {
  projectPath: string;
  backend?: string;
  model?: string;
  force: boolean;
  maxWorkers?: number;
  endpoints?: RotationEndpointConfig[];
}): { success: boolean; error?: string } {
  const { projectPath, backend, model } = params;
  try {
    const child = getSpawnRuntime()(
      getVenvPythonPathRuntime()(),
      ['-c', buildEmbeddingPythonCode(params)],
      buildSmartSearchSpawnOptions(projectPath, {
        detached: shouldDetachBackgroundSmartSearchProcess(),
        stdio: 'ignore',
      }),
    );

    autoEmbedJobs.set(projectPath, {
      startedAt: getNowRuntime(),
      backend,
      model,
    });

    const cleanup = () => {
      autoEmbedJobs.delete(projectPath);
    };
    child.on('error', cleanup);
    child.on('close', cleanup);
    child.unref();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function spawnBackgroundIndexInit(params: {
  projectPath: string;
  languages?: string[];
}): { success: boolean; error?: string } {
  const { projectPath, languages } = params;
  try {
    const pythonPath = getVenvPythonPathRuntime()();
    if (!existsSync(pythonPath)) {
      return {
        success: false,
        error: 'CodexLens Python environment is not ready yet.',
      };
    }

    const child = getSpawnRuntime()(
      pythonPath,
      ['-m', 'codexlens', ...buildIndexInitArgs(projectPath, { languages })],
      buildSmartSearchSpawnOptions(projectPath, {
        detached: shouldDetachBackgroundSmartSearchProcess(),
        stdio: 'ignore',
      }),
    );

    autoInitJobs.set(projectPath, {
      startedAt: getNowRuntime(),
      languages,
    });

    const cleanup = () => {
      autoInitJobs.delete(projectPath);
    };
    child.on('error', cleanup);
    child.on('close', cleanup);
    child.unref();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function maybeStartBackgroundAutoInit(
  scope: SearchScope,
  indexStatus: IndexStatus,
): Promise<{ note?: string; warning?: string }> {
  if (indexStatus.indexed) {
    return {};
  }

  if (!isAutoInitMissingEnabled()) {
    return {
      note: getAutoInitMissingDisabledReason(),
    };
  }

  if (autoInitJobs.has(scope.workingDirectory)) {
    return {
      note: 'Background static index build is already running for this path.',
    };
  }

  const spawned = spawnBackgroundIndexInit({
    projectPath: scope.workingDirectory,
  });

  if (!spawned.success) {
    return {
      warning: `Automatic static index warmup could not start: ${spawned.error}`,
    };
  }

  return {
    note: 'Background static index build started for this path. Re-run search shortly for indexed FTS results.',
  };
}

async function maybeStartBackgroundAutoEmbed(
  scope: SearchScope,
  indexStatus: IndexStatus,
): Promise<{ note?: string; warning?: string }> {
  if (!indexStatus.indexed || indexStatus.has_embeddings) {
    return {};
  }

  if (!isAutoEmbedMissingEnabled(indexStatus.config)) {
    return {
      note: getAutoEmbedMissingDisabledReason(indexStatus.config),
    };
  }

  if (autoEmbedJobs.has(scope.workingDirectory)) {
    return {
      note: 'Background embedding build is already running for this path.',
    };
  }

  const backend = normalizeEmbeddingBackend(indexStatus.config?.embedding_backend) ?? 'fastembed';
  const model = indexStatus.config?.embedding_model?.trim() || undefined;
  const semanticStatus = await getSemanticStatusRuntime()();
  if (!semanticStatus.available) {
    return {
      warning: 'Automatic embedding warmup skipped because semantic dependencies are not ready.',
    };
  }

  if (backend === 'litellm' && !semanticStatus.litellmAvailable) {
    return {
      warning: 'Automatic embedding warmup skipped because the LiteLLM embedder is not ready.',
    };
  }

  const endpoints = resolveEmbeddingEndpoints(backend);
  const configuredApiMaxWorkers = indexStatus.config?.api_max_workers;
  const effectiveApiMaxWorkers = typeof configuredApiMaxWorkers === 'number'
    ? Math.max(1, Math.floor(configuredApiMaxWorkers))
    : resolveApiWorkerCount(undefined, backend, endpoints);
  const spawned = spawnBackgroundEmbeddingsViaPython({
    projectPath: scope.workingDirectory,
    backend,
    model,
    force: false,
    maxWorkers: effectiveApiMaxWorkers,
    endpoints,
  });

  if (!spawned.success) {
    return {
      warning: `Automatic embedding warmup could not start: ${spawned.error}`,
    };
  }

  return {
    note: 'Background embedding build started for this path. Re-run semantic search shortly for vector results.',
  };
}

// v1 executeEmbeddingsViaPython removed — v2 uses built-in fastembed models

// v1 executeInitAction removed — replaced by executeInitActionV2

// v1 executeEmbedAction removed — v2 auto-embeds during sync

// v1 executeStatusAction removed — replaced by executeStatusActionV2

// v1 executeUpdateAction and executeWatchAction removed — replaced by V2 versions

// v1 executeFuzzyMode and executeAutoMode removed — v2 bridge handles all search

/**
 * Mode: ripgrep - Fast literal string matching using ripgrep
 * No index required, fallback to CodexLens if ripgrep unavailable
 * Supports tokenized multi-word queries with OR matching and result ranking
 */
async function executeRipgrepMode(params: Params): Promise<SearchResult> {
  const { query, paths = [], contextLines = 0, maxResults = 5, extraFilesCount = 10, maxContentLength = 200, includeHidden = false, path = '.', regex = true, caseSensitive = true, tokenize = true, codeOnly = true, withDoc = false, excludeExtensions } = params;
  const scope = resolveSearchScope(path, paths);
  // withDoc overrides codeOnly
  const effectiveCodeOnly = withDoc ? false : codeOnly;

  if (!query) {
    return {
      success: false,
      error: 'Query is required for search',
    };
  }

  // Check if ripgrep is available
  const hasRipgrep = checkToolAvailability('rg');

  // Calculate total to fetch for split (full content + extra files)
  const totalToFetch = maxResults + extraFilesCount;

  // If ripgrep not available, fall back to CodexLens exact mode
  if (!hasRipgrep) {
    const readyStatus = await ensureCodexLensReady();
    if (!readyStatus.ready) {
      return {
        success: false,
        error: 'Neither ripgrep nor CodexLens available. Install ripgrep (rg) or CodexLens for search functionality.',
      };
    }

    // Use CodexLens fts mode as fallback
    const args = ['search', query, '--limit', totalToFetch.toString(), '--method', 'fts', '--json'];
    const result = await executeCodexLens(args, { cwd: scope.workingDirectory });

    if (!result.success) {
      noteCodexLensFtsCompatibility(result.error);
      return {
        success: false,
        error: summarizeBackendError(result.error),
        metadata: {
          mode: 'ripgrep',
          backend: 'codexlens-fallback',
          count: 0,
          query,
        },
      };
    }

    // Parse results
    let allResults: SemanticMatch[] = [];
    try {
      const parsed = JSON.parse(stripAnsi(result.output || '{}'));
      const data = parsed.result?.results || parsed.results || parsed;
      allResults = (Array.isArray(data) ? data : []).map((item: any) => ({
        file: item.path || item.file,
        score: item.score || 0,
        content: truncateContent(item.content || item.excerpt, maxContentLength),
        symbol: item.symbol || null,
      }));
    } catch {
      // Keep empty results
    }

    const scopedResults = filterResultsToTargetFile(allResults, scope);

    // Split results: first N with full content, rest as file paths only
    const { results, extra_files } = splitResultsWithExtraFiles(scopedResults, maxResults, extraFilesCount);

    return {
      success: true,
      results,
      extra_files: extra_files.length > 0 ? extra_files : undefined,
      metadata: {
        mode: 'ripgrep',
        backend: 'codexlens-fallback',
        count: results.length,
        query,
        note: 'Using CodexLens exact mode (ripgrep not available)',
      },
    };
  }

  // Use ripgrep - request more results to support split
  const { command, args, tokens, warning: queryModeWarning } = buildRipgrepCommand({
    query,
    paths: scope.searchPaths,
    contextLines,
    maxResults: totalToFetch,  // Fetch more to support split
    includeHidden,
    regex,
    caseSensitive,
    tokenize,
  });

  return new Promise((resolve) => {
    const child = getSpawnRuntime()(
      command,
      args,
      buildSmartSearchSpawnOptions(scope.workingDirectory || getProjectRoot(), {
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    );

    let stdout = '';
    let stderr = '';
    let resultLimitReached = false;

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      // Limit total results to prevent memory overflow (--max-count only limits per-file)
      const effectiveLimit = totalToFetch > 0 ? totalToFetch : 500;
      const parsedResults = parseRipgrepJsonResults(stdout, effectiveLimit);
      const allResults = parsedResults.results;
      resultLimitReached = parsedResults.resultLimitReached;

      // Handle Windows device file errors gracefully (os error 1)
      // If we have results despite the error, return them as partial success
      const isWindowsDeviceError = stderr.includes('os error 1') || stderr.includes('函数不正确');

      // Apply token-based scoring and sorting for multi-word queries
      // Results matching more tokens are ranked higher (exact matches first)
      const scoredResults = tokens.length > 1 ? scoreByTokenMatch(allResults, tokens) : allResults;

      // Apply code-only and extension filtering
      const filteredResults = filterNoisyFiles(scoredResults as any[], { codeOnly: effectiveCodeOnly, excludeExtensions });

      if (code === 0 || code === 1 || (isWindowsDeviceError && filteredResults.length > 0)) {
        // Split results: first N with full content, rest as file paths only
        const { results, extra_files } = splitResultsWithExtraFiles(filteredResults, maxResults, extraFilesCount);

        // Build warning message for various conditions
        const warnings: string[] = [];
        if (queryModeWarning) {
          warnings.push(queryModeWarning);
        }
        if (resultLimitReached) {
          warnings.push(`Result limit reached (${effectiveLimit}). Use a more specific query or increase limit.`);
        }
        if (isWindowsDeviceError) {
          warnings.push('Some Windows device files were skipped');
        }

        resolve({
          success: true,
          results,
          extra_files: extra_files.length > 0 ? extra_files : undefined,
          metadata: {
            mode: 'ripgrep',
            backend: 'ripgrep',
            count: results.length,
            query,
            tokens: tokens.length > 1 ? tokens : undefined,  // Include tokens in metadata for debugging
            tokenized: tokens.length > 1,
            ...(warnings.length > 0 && { warning: warnings.join('; ') }),
          },
        });
      } else if (isWindowsDeviceError && allResults.length === 0) {
        // Windows device error but no results - might be the only issue
        resolve({
          success: true,
          results: [],
          metadata: {
            mode: 'ripgrep',
            backend: 'ripgrep',
            count: 0,
            query,
            warning: 'No matches found (some Windows device files were skipped)',
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

// ========================================
// codexlens-search v2 bridge integration
// ========================================

/**
 * Execute search via codexlens-search (v2) bridge CLI.
 * Spawns 'codexlens-search search --query X --top-k Y --db-path Z' and parses JSON output.
 *
 * @param query - Search query string
 * @param topK - Number of results to return
 * @param dbPath - Path to the v2 index database directory
 * @returns Parsed search results as SemanticMatch array
 */
async function executeCodexLensV2Bridge(
  query: string,
  topK: number,
  dbPath: string,
): Promise<SearchResult> {
  return new Promise((resolve) => {
    const args = [
      '--db-path', dbPath,
      'search',
      '--query', query,
      '--top-k', String(topK),
    ];

    execFile('codexlens-search', args, {
      encoding: 'utf-8',
      timeout: EXEC_TIMEOUTS.PROCESS_SPAWN,
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    }, (error, stdout, stderr) => {
      if (error) {
        console.warn(`[CodexLens-v2] Bridge search failed: ${error.message}`);
        resolve({
          success: false,
          error: `codexlens-search v2 bridge failed: ${error.message}`,
        });
        return;
      }

      try {
        const parsed = JSON.parse(stdout.trim());

        // Bridge outputs {"error": string} on failure
        if (parsed && typeof parsed === 'object' && 'error' in parsed) {
          resolve({
            success: false,
            error: `codexlens-search v2: ${parsed.error}`,
          });
          return;
        }

        // Bridge outputs array of {path, score, line, end_line, snippet, content}
        const raw: Array<{
          path?: string; score?: number; line?: number;
          end_line?: number; snippet?: string; content?: string;
        }> = Array.isArray(parsed) ? parsed : [];

        // Build AceLike sections and group by file
        const sections: AceLikeSection[] = raw.map(r => ({
          path: r.path || '',
          line: r.line || undefined,
          endLine: r.end_line || undefined,
          score: r.score || 0,
          symbol: null,
          snippet: r.content || r.snippet || '',
        }));

        const groupMap = new Map<string, AceLikeSection[]>();
        for (const s of sections) {
          const arr = groupMap.get(s.path) || [];
          arr.push(s);
          groupMap.set(s.path, arr);
        }
        const groups: AceLikeGroup[] = Array.from(groupMap.entries()).map(
          ([path, secs]) => ({ path, sections: secs, total_matches: secs.length })
        );

        // Render text view with line numbers
        const textParts: string[] = [];
        for (const s of sections) {
          const lineInfo = s.line ? `:${s.line}${s.endLine ? `-${s.endLine}` : ''}` : '';
          textParts.push(`Path: ${s.path}${lineInfo}\n${s.snippet}\n`);
        }

        const aceLikeOutput: AceLikeOutput = {
          format: 'ace',
          text: textParts.join('\n'),
          groups,
          sections,
          total: sections.length,
        };

        resolve({
          success: true,
          results: aceLikeOutput,
          metadata: {
            mode: 'semantic' as any,
            backend: 'codexlens-v2',
            count: sections.length,
            query,
            note: 'Using codexlens-search v2 bridge (2-stage vector + reranking)',
          },
        });
      } catch (parseErr) {
        console.warn(`[CodexLens-v2] Failed to parse bridge output: ${(parseErr as Error).message}`);
        resolve({
          success: false,
          error: `Failed to parse codexlens-search v2 output: ${(parseErr as Error).message}`,
          output: stdout,
        });
      }
    });
  });
}

/**
 * Load env vars from ~/.codexlens/.env file so they're passed to bridge subprocess.
 */
function loadCodexLensEnvFile(): Record<string, string> {
  const envVars: Record<string, string> = {};
  try {
    const envPath = join(getCodexLensDataDir(), '.env');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = trimmed.substring(0, eqIdx).trim();
      let value = trimmed.substring(eqIdx + 1).trim();
      // Strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      envVars[key] = value;
    }
  } catch {
    // File doesn't exist — no env overrides
  }
  return envVars;
}

/**
 * Execute a generic codexlens-search v2 bridge subcommand (init, status, sync, watch, etc.).
 * Returns parsed JSON output from the bridge CLI.
 */
async function executeV2BridgeCommand(
  subcommand: string,
  args: string[],
  options?: { timeout?: number; dbPath?: string },
): Promise<SearchResult> {
  return new Promise((resolve) => {
    // --db-path is a global arg and must come BEFORE the subcommand
    const globalArgs = options?.dbPath ? ['--db-path', options.dbPath] : [];
    const fullArgs = [...globalArgs, subcommand, ...args];
    // Merge process.env with .env file settings (file values override process.env)
    const codexlensEnv = loadCodexLensEnvFile();
    execFile('codexlens-search', fullArgs, {
      encoding: 'utf-8',
      timeout: options?.timeout ?? EXEC_TIMEOUTS.PROCESS_SPAWN,
      windowsHide: true,
      env: { ...process.env, ...codexlensEnv, PYTHONIOENCODING: 'utf-8' },
    }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          error: `codexlens-search ${subcommand} failed: ${error.message}`,
        });
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed && typeof parsed === 'object' && 'error' in parsed) {
          resolve({ success: false, error: `codexlens-search: ${parsed.error}` });
          return;
        }
        resolve({ success: true, status: parsed, message: parsed.status || `${subcommand} completed`, metadata: { action: subcommand } });
      } catch {
        resolve({ success: false, error: `Failed to parse codexlens-search ${subcommand} output`, output: stdout });
      }
    });
  });
}

/**
 * List known models via v2 bridge (list-models subcommand).
 * Returns JSON array of {name, type, installed, cache_path}.
 */
export async function executeV2ListModels(): Promise<SearchResult> {
  return executeV2BridgeCommand('list-models', []);
}

/**
 * Download a single model by name via v2 bridge (download-model subcommand).
 */
export async function executeV2DownloadModel(modelName: string): Promise<SearchResult> {
  return executeV2BridgeCommand('download-model', [modelName], { timeout: 600000 });
}

/**
 * Delete a model from cache via v2 bridge (delete-model subcommand).
 */
export async function executeV2DeleteModel(modelName: string): Promise<SearchResult> {
  return executeV2BridgeCommand('delete-model', [modelName]);
}

/**
 * Action: init (v2) - Initialize index and sync files.
 */
async function executeInitActionV2(params: Params): Promise<SearchResult> {
  const { path = '.' } = params;
  const scope = resolveSearchScope(path);
  const dbPath = join(scope.workingDirectory, '.codexlens');

  // Step 1: init empty index
  const initResult = await executeV2BridgeCommand('init', [], { dbPath });
  if (!initResult.success) return initResult;

  // Step 2: sync all files
  const syncResult = await executeV2BridgeCommand('sync', [
    '--root', scope.workingDirectory,
  ], { timeout: 1800000, dbPath }); // 30 min for large codebases

  return {
    success: syncResult.success,
    error: syncResult.error,
    message: syncResult.success
      ? `Index initialized and synced for ${scope.workingDirectory}`
      : undefined,
    metadata: { action: 'init', path: scope.workingDirectory },
    status: syncResult.status,
  };
}

/**
 * Action: status (v2) - Report index statistics.
 */
async function executeStatusActionV2(params: Params): Promise<SearchResult> {
  const { path = '.' } = params;
  const scope = resolveSearchScope(path);
  const dbPath = join(scope.workingDirectory, '.codexlens');

  return executeV2BridgeCommand('status', [], { dbPath });
}

/**
 * Action: update (v2) - Incremental sync (re-sync changed files).
 */
async function executeUpdateActionV2(params: Params): Promise<SearchResult> {
  const { path = '.' } = params;
  const scope = resolveSearchScope(path);
  const dbPath = join(scope.workingDirectory, '.codexlens');

  return executeV2BridgeCommand('sync', [
    '--root', scope.workingDirectory,
  ], { timeout: 600000, dbPath }); // 10 min
}

/**
 * Action: watch (v2) - Start file watcher for auto-updates.
 */
async function executeWatchActionV2(params: Params): Promise<SearchResult> {
  const { path = '.', debounce = 1000 } = params;
  const scope = resolveSearchScope(path);
  const dbPath = join(scope.workingDirectory, '.codexlens');

  // Watch runs indefinitely — start it with a short initial timeout to confirm startup
  const result = await executeV2BridgeCommand('watch', [
    '--root', scope.workingDirectory,
    '--debounce-ms', debounce.toString(),
  ], { timeout: 5000, dbPath });

  return {
    success: true,
    message: `File watcher started for ${scope.workingDirectory}. Changes are indexed automatically.`,
    metadata: { action: 'watch', path: scope.workingDirectory },
    status: result.status,
  };
}

// v1 executeCodexLensExactMode removed — v2 bridge handles search

// v1 executeHybridMode removed — v2 bridge handles semantic search
// v1 executeHybridMode removed — v2 bridge handles semantic search

/**
 * Query intent used to adapt RRF weights (Python parity).
 *
 * Keep this logic aligned with CodexLens Python hybrid search:
 * `codex-lens/src/codexlens/search/hybrid_search.py`
 */
export type QueryIntent = 'keyword' | 'semantic' | 'mixed';

// Python default: vector 60%, exact 30%, fuzzy 10%
const DEFAULT_RRF_WEIGHTS = {
  exact: 0.3,
  fuzzy: 0.1,
  vector: 0.6,
} as const;

function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const sum = Object.values(weights).reduce((acc, v) => acc + v, 0);
  if (!Number.isFinite(sum) || sum <= 0) return { ...weights };
  return Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, v / sum]));
}

/**
 * Detect query intent using the same heuristic signals as Python:
 * - Code patterns: `.`, `::`, `->`, CamelCase, snake_case, common code keywords
 * - Natural language patterns: >5 words, question marks, interrogatives, common verbs
 */
export function detectQueryIntent(query: string): QueryIntent {
  const trimmed = query.trim();
  if (!trimmed) return 'mixed';

  const lower = trimmed.toLowerCase();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  const hasCodeSignals =
    /(::|->|\.)/.test(trimmed) ||
    /[A-Z][a-z]+[A-Z]/.test(trimmed) ||
    /\b\w+_\w+\b/.test(trimmed) ||
    /\b(def|class|function|const|let|var|import|from|return|async|await|interface|type)\b/i.test(lower);

  const hasNaturalSignals =
    wordCount > 5 ||
    /\?/.test(trimmed) ||
    /\b(how|what|why|when|where)\b/i.test(trimmed) ||
    /\b(handle|explain|fix|implement|create|build|use|find|search|convert|parse|generate|support)\b/i.test(trimmed);

  if (hasCodeSignals && hasNaturalSignals) return 'mixed';
  if (hasCodeSignals) return 'keyword';
  if (hasNaturalSignals) return 'semantic';
  return 'mixed';
}

/**
 * Intent → weights mapping (Python parity).
 * - keyword: exact-heavy
 * - semantic: vector-heavy
 * - mixed: keep defaults
 */
export function adjustWeightsByIntent(
  intent: QueryIntent,
  baseWeights: Record<string, number>,
): Record<string, number> {
  if (intent === 'keyword') return normalizeWeights({ exact: 0.5, fuzzy: 0.1, vector: 0.4 });
  if (intent === 'semantic') return normalizeWeights({ exact: 0.2, fuzzy: 0.1, vector: 0.7 });
  return normalizeWeights({ ...baseWeights });
}

export function getRRFWeights(
  query: string,
  baseWeights: Record<string, number> = DEFAULT_RRF_WEIGHTS,
): Record<string, number> {
  return adjustWeightsByIntent(detectQueryIntent(query), baseWeights);
}

/**
 * Post-processing: Filter noisy files from semantic search results
 * Uses FILTER_CONFIG patterns to remove irrelevant files.
 * Optimized: pre-compiled regexes, accurate path segment matching.
 */
// Pre-compile file exclusion regexes once (avoid recompilation in loop)
const FILE_EXCLUDE_REGEXES = [...FILTER_CONFIG.exclude_files].map(pattern =>
  new RegExp('^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*') + '$')
);

// Non-code file extensions (for codeOnly filter)
const NON_CODE_EXTENSIONS = new Set([
  'md', 'txt', 'json', 'yaml', 'yml', 'xml', 'csv', 'log',
  'ini', 'cfg', 'conf', 'toml', 'env', 'properties',
  'html', 'htm', 'svg', 'png', 'jpg', 'jpeg', 'gif', 'ico', 'webp',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'lock', 'sum', 'mod',
]);

interface FilterOptions {
  excludeExtensions?: string[];
  codeOnly?: boolean;
}

function filterNoisyFiles(results: SemanticMatch[], options: FilterOptions = {}): SemanticMatch[] {
  const { excludeExtensions = [], codeOnly = false } = options;

  // Build extension filter set
  const excludedExtSet = new Set(excludeExtensions.map(ext => ext.toLowerCase().replace(/^\./, '')));
  if (codeOnly) {
    NON_CODE_EXTENSIONS.forEach(ext => excludedExtSet.add(ext));
  }

  return results.filter(r => {
    // Support both 'file' and 'path' field names (different backends use different names)
    const filePath = r.file || (r as any).path || '';
    if (!filePath) return true;

    const segments: string[] = filePath.split(/[/\\]/);

    // Accurate directory check: segment must exactly match excluded directory
    if (segments.some((segment: string) => FILTER_CONFIG.exclude_directories.has(segment))) {
      return false;
    }

    // Accurate file check: pattern matches filename only (not full path)
    const filename = segments.pop() || '';
    if (FILE_EXCLUDE_REGEXES.some(regex => regex.test(filename))) {
      return false;
    }

    // Extension filter check
    if (excludedExtSet.size > 0) {
      const ext = filename.split('.').pop()?.toLowerCase() || '';
      if (excludedExtSet.has(ext)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Post-processing: Boost results containing query keywords
 * Extracts keywords from query and boosts matching results.
 * Optimized: uses whole-word matching with regex for accuracy.
 */
// Helper to escape regex special characters
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyKeywordBoosting(results: SemanticMatch[], query: string): SemanticMatch[] {
  // Extract meaningful keywords (ignore common words)
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'although', 'though', 'after', 'before', 'when', 'whenever', 'where', 'wherever', 'whether', 'which', 'who', 'whom', 'whose', 'what', 'whatever', 'whichever', 'whoever', 'whomever', 'this', 'that', 'these', 'those', 'it', 'its']);

  const keywords = query
    .toLowerCase()
    .split(/[\s,.;:()"{}[\]-]+/)  // More robust splitting on punctuation
    .filter(word => word.length > 2 && !stopWords.has(word));

  if (keywords.length === 0) return results;

  // Create case-insensitive regexes for whole-word matching
  const keywordRegexes = keywords.map(kw => new RegExp(`\\b${escapeRegExp(kw)}\\b`, 'i'));

  return results.map(r => {
    const content = r.content || '';
    const file = r.file || '';

    // Count keyword matches using whole-word regex
    let matchCount = 0;
    for (const regex of keywordRegexes) {
      if (regex.test(content) || regex.test(file)) {
        matchCount++;
      }
    }

    // Apply boost only if there are matches
    if (matchCount > 0) {
      const matchRatio = matchCount / keywords.length;
      const boost = 1 + (matchRatio * 0.3); // Up to 30% boost for full match
      return {
        ...r,
        score: r.score * boost,
      };
    }

    return r;
  });
}

/**
 * Post-processing: Enforce score diversity
 * Penalizes results with identical scores (indicates undifferentiated matching)
 */
function enforceScoreDiversity(results: SemanticMatch[]): SemanticMatch[] {
  if (results.length < 2) return results;

  // Count occurrences of each score (rounded to 3 decimal places for comparison)
  const scoreCounts = new Map<number, number>();
  for (const r of results) {
    const roundedScore = Math.round(r.score * 1000) / 1000;
    scoreCounts.set(roundedScore, (scoreCounts.get(roundedScore) || 0) + 1);
  }

  // Apply penalty to scores that appear more than twice
  return results.map(r => {
    const roundedScore = Math.round(r.score * 1000) / 1000;
    const count = scoreCounts.get(roundedScore) || 1;

    if (count > 2) {
      // Progressive penalty: more duplicates = bigger penalty
      const penalty = Math.max(0.7, 1 - (count * 0.05));
      return { ...r, score: r.score * penalty };
    }
    return r;
  });
}

/**
 * Post-processing: Filter results with dominant baseline score (hot spot detection)
 * When backend returns default "hot spot" files with identical high scores,
 * this function detects and removes them.
 *
 * Detection criteria:
 * - A single score appears in >50% of results
 * - That score is suspiciously high (>0.9)
 * - This indicates fallback mechanism returned placeholder results
 */
function filterDominantBaselineScores(
  results: SemanticMatch[]
): { filteredResults: SemanticMatch[]; baselineInfo: { score: number; count: number } | null } {
  if (results.length < 4) {
    return { filteredResults: results, baselineInfo: null };
  }

  // Count occurrences of each score (rounded to 4 decimal places)
  const scoreCounts = new Map<number, number>();
  results.forEach(r => {
    const rounded = Math.round(r.score * 10000) / 10000;
    scoreCounts.set(rounded, (scoreCounts.get(rounded) || 0) + 1);
  });

  // Find the most dominant score
  let dominantScore: number | null = null;
  let dominantCount = 0;
  scoreCounts.forEach((count, score) => {
    if (count > dominantCount) {
      dominantCount = count;
      dominantScore = score;
    }
  });

  // If a single score is present in >50% of results and is high (>0.9),
  // treat it as a suspicious baseline score and filter it out
  const BASELINE_THRESHOLD = 0.5;  // >50% of results have same score
  const HIGH_SCORE_THRESHOLD = 0.9; // Score above 0.9 is suspiciously high

  if (
    dominantScore !== null &&
    dominantCount > results.length * BASELINE_THRESHOLD &&
    dominantScore > HIGH_SCORE_THRESHOLD
  ) {
    const filteredResults = results.filter(r => {
      const rounded = Math.round(r.score * 10000) / 10000;
      return rounded !== dominantScore;
    });

    return {
      filteredResults,
      baselineInfo: { score: dominantScore, count: dominantCount },
    };
  }

  return { filteredResults: results, baselineInfo: null };
}

/**
 * TypeScript implementation of Reciprocal Rank Fusion
 * Reference: codex-lens/src/codexlens/search/ranking.py
 * Formula: score(d) = Σ weight_source / (k + rank_source(d))
 */
function normalizeFusionSnippet(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, 240) : undefined;
}

function buildFusionIdentity(result: any): string | null {
  const path = typeof result?.file === 'string'
    ? result.file
    : typeof result?.path === 'string'
      ? result.path
      : undefined;

  if (!path) {
    return null;
  }

  const line = typeof result?.line === 'number' && Number.isFinite(result.line)
    ? result.line
    : undefined;
  const endLine = typeof result?.endLine === 'number' && Number.isFinite(result.endLine)
    ? result.endLine
    : line;
  const column = typeof result?.column === 'number' && Number.isFinite(result.column)
    ? result.column
    : undefined;

  if (line !== undefined) {
    return `${path}#L${line}-${endLine ?? line}:C${column ?? 0}`;
  }

  const symbol = typeof result?.symbol === 'string' && result.symbol.trim()
    ? result.symbol.trim()
    : undefined;
  const snippet = normalizeFusionSnippet(result?.content);

  if (symbol && snippet) {
    return `${path}::${symbol}::${snippet}`;
  }
  if (snippet) {
    return `${path}::${snippet}`;
  }
  if (symbol) {
    return `${path}::${symbol}`;
  }

  return path;
}

function scoreFusionRepresentative(result: any): number {
  let score = 0;

  if (typeof result?.line === 'number' && Number.isFinite(result.line)) {
    score += 1000;
  }
  if (typeof result?.endLine === 'number' && Number.isFinite(result.endLine)) {
    score += 250;
  }
  if (typeof result?.column === 'number' && Number.isFinite(result.column)) {
    score += 50;
  }
  if (Array.isArray(result?.chunkLines) && result.chunkLines.length > 0) {
    score += 500 + result.chunkLines.length;
  }
  if (typeof result?.symbol === 'string' && result.symbol.trim()) {
    score += 50;
  }
  if (typeof result?.content === 'string') {
    score += Math.min(result.content.length, 200);
  }

  return score;
}

function applyRRFFusion(
  resultsMap: Map<string, any[]>,
  weightsOrQuery: Record<string, number> | string,
  limit: number,
  k: number = 60,
): any[] {
  const weights = typeof weightsOrQuery === 'string' ? getRRFWeights(weightsOrQuery) : weightsOrQuery;
  const fusedScores = new Map<string, { score: number; result: any; sources: string[]; representativeScore: number }>();

  resultsMap.forEach((results, source) => {
    const weight = weights[source] || 0;
    if (weight === 0 || !results) return;

    results.forEach((result, rank) => {
      const identity = buildFusionIdentity(result);
      if (!identity) return;

      const rrfContribution = weight / (k + rank + 1);
      const representativeScore = scoreFusionRepresentative(result);

      if (!fusedScores.has(identity)) {
        fusedScores.set(identity, { score: 0, result, sources: [], representativeScore });
      }
      const entry = fusedScores.get(identity)!;
      entry.score += rrfContribution;
      if (representativeScore > entry.representativeScore) {
        entry.result = result;
        entry.representativeScore = representativeScore;
      }
      if (!entry.sources.includes(source)) {
        entry.sources.push(source);
      }
    });
  });

  // Sort by fusion score descending
  return Array.from(fusedScores.values())
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

// v1 executePriorityFallbackMode removed — v2 bridge + ripgrep fallback handles all search

// Tool schema for MCP
export const schema: ToolSchema = {
  name: 'smart_search',
  description: `Unified code search tool powered by codexlens-search v2 (2-stage vector + FTS5 + reranking).

Recommended flow: use **action=\"search\"** for lookups, **action=\"init\"** to build the semantic index, and **action=\"update\"** when files change.

**Actions & Required Parameters:**

*   **search** (default): Semantic code search with ripgrep fallback.
    *   **query** (string, **REQUIRED**): Content to search for.
    *   *limit* (number): Max results (default: 5).
    *   *path* (string): Directory or single file to search (default: current directory).
    *   *contextLines* (number): Context lines around matches (default: 0).
    *   *regex* (boolean): Use regex matching in ripgrep fallback (default: true).
    *   *caseSensitive* (boolean): Case-sensitive search (default: true).

*   **find_files**: Find files by path/name pattern.
    *   **pattern** (string, **REQUIRED**): Glob pattern (e.g., "*.ts", "src/**/*.js").
    *   *limit* (number): Max results (default: 20).
    *   *offset* (number): Pagination offset (default: 0).
    *   *includeHidden* (boolean): Include hidden files (default: false).

*   **init**: Initialize v2 semantic index and sync all files.
    *   *path* (string): Directory to index (default: current).

*   **status**: Check v2 index statistics. (No required params)

*   **update**: Incremental sync for changed files.
    *   *path* (string): Directory to update (default: current).

*   **watch**: Start file watcher for auto-updates.
    *   *path* (string): Directory to watch (default: current).

**Examples:**
  smart_search(query="authentication logic")                    # Semantic search (default)
  smart_search(action="init", path="/project")                  # Build v2 index
  smart_search(action="update", path="/project")                # Sync changed files
  smart_search(query="auth", limit=10, offset=0)                # Paginated search`,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['init', 'search', 'find_files', 'status', 'update', 'watch', 'search_files'],
        description: 'Action: search (semantic search, default), find_files (path pattern matching), init (build v2 index), status (check index), update (incremental sync), watch (auto-update watcher). Note: search_files is deprecated.',
        default: 'search',
      },
      query: {
        type: 'string',
        description: 'Content search query (for action="search").',
      },
      pattern: {
        type: 'string',
        description: 'Glob pattern for file discovery (for action="find_files"). Examples: "*.ts", "src/**/*.js", "test_*.py"',
      },
      mode: {
        type: 'string',
        enum: SEARCH_MODES,
        description: 'Search mode: fuzzy (v2 semantic + ripgrep fallback, default) or semantic (v2 semantic search only).',
        default: 'fuzzy',
      },
      output_mode: {
        type: 'string',
        enum: [...SEARCH_OUTPUT_MODES],
        description: 'Output format: ace (default, ACE-style grouped code sections + rendered text), full (raw matches), files_only (paths only), count (per-file counts)',
        default: 'ace',
      },
      path: {
        type: 'string',
        description: 'Directory path for init/search actions (default: current directory). For action=search, a single file path is also accepted and results are automatically scoped back to that file.',
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
        description: 'Maximum number of full-content results (default: 5)',
        default: 5,
      },
      limit: {
        type: 'number',
        description: 'Alias for maxResults (default: 5)',
        default: 5,
      },
      extraFilesCount: {
        type: 'number',
        description: 'Number of additional file-only results (paths without content)',
        default: 10,
      },
      maxContentLength: {
        type: 'number',
        description: 'Maximum content length for truncation (50-2000)',
        default: 200,
      },
      offset: {
        type: 'number',
        description: 'Pagination offset - skip first N results (default: 0)',
        default: 0,
      },
      includeHidden: {
        type: 'boolean',
        description: 'Include hidden files/directories',
        default: false,
      },
      force: {
        type: 'boolean',
        description: 'Force full rebuild for action="init".',
        default: false,
      },
      regex: {
        type: 'boolean',
        description: 'Use regex pattern matching instead of literal string (ripgrep mode only). Default: enabled. Example: smart_search(query="class.*Builder")',
        default: true,
      },
      caseSensitive: {
        type: 'boolean',
        description: 'Case-sensitive search (default: true). Set to false for case-insensitive matching.',
        default: true,
      },
      tokenize: {
        type: 'boolean',
        description: 'Tokenize multi-word queries for OR matching (ripgrep mode). Default: true. Results are ranked by token match count (exact matches first).',
        default: true,
      },
    },
    required: [],
  },
};

/**
 * Action: find_files - Find files by path/name pattern (glob matching)
 * Unlike search which looks inside file content, find_files matches file paths
 */
async function executeFindFilesAction(params: Params): Promise<SearchResult> {
  const { pattern, path = '.', limit = 20, offset = 0, includeHidden = false, caseSensitive = true } = params;
  const scope = resolveSearchScope(path);

  if (!pattern) {
    return {
      success: false,
      error: 'Pattern is required for find_files action. Use glob patterns like "*.ts", "src/**/*.js", or "test_*.py"',
    };
  }

  // Use ripgrep with --files flag for fast file listing with glob pattern
  const hasRipgrep = checkToolAvailability('rg');

  if (!hasRipgrep) {
    // Fallback to CodexLens file listing if available
    const readyStatus = await ensureCodexLensReady();
    if (!readyStatus.ready) {
      return {
        success: false,
        error: 'Neither ripgrep nor CodexLens available for file discovery.',
      };
    }

    // Try CodexLens file list command
    const args = ['list-files', '--json'];
    const result = await executeCodexLens(args, { cwd: scope.workingDirectory });

    if (!result.success) {
      return {
        success: false,
        error: `Failed to list files: ${result.error}`,
      };
    }

    // Parse and filter results by pattern
    let files: string[] = [];
    try {
      const parsed = JSON.parse(stripAnsi(result.output || '[]'));
      files = Array.isArray(parsed) ? parsed : (parsed.files || []);
    } catch {
      return {
        success: false,
        error: 'Failed to parse file list from CodexLens',
      };
    }

    // Apply glob pattern matching using minimatch-style regex
    const globRegex = globToRegex(pattern, caseSensitive);
    const matchedFiles = files.filter(f => globRegex.test(f));

    // Apply pagination
    const total = matchedFiles.length;
    const paginatedFiles = matchedFiles.slice(offset, offset + limit);

    const results: FileMatch[] = paginatedFiles.map(filePath => {
      const parts = filePath.split(/[/\\]/);
      const name = parts[parts.length - 1] || '';
      const ext = name.includes('.') ? name.split('.').pop() : undefined;
      return {
        path: filePath,
        type: 'file' as const,
        name,
        extension: ext,
      };
    });

    return {
      success: true,
      results,
      metadata: {
        pattern,
        backend: 'codexlens',
        count: results.length,
        pagination: {
          offset,
          limit,
          total,
          has_more: offset + limit < total,
        },
      },
    };
  }

  // Use ripgrep --files with glob pattern for fast file discovery
  return new Promise((resolve) => {
    const args = ['--files'];

    // Add exclude patterns
    if (!includeHidden) {
      args.push(...buildExcludeArgs());
    } else {
      args.push('--hidden');
    }

    // Add glob pattern
    args.push('--glob', pattern);

    // Case sensitivity for glob matching
    if (!caseSensitive) {
      args.push('--iglob', pattern);
      // Remove the case-sensitive glob and use iglob instead
      const globIndex = args.indexOf('--glob');
      if (globIndex !== -1) {
        args.splice(globIndex, 2);
      }
    }

    const child = getSpawnRuntime()(
      'rg',
      args,
      buildSmartSearchSpawnOptions(scope.workingDirectory || getProjectRoot(), {
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    );

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      // ripgrep returns 1 when no matches found, which is not an error
      if (code !== 0 && code !== 1 && !stderr.includes('os error 1')) {
        resolve({
          success: false,
          error: `ripgrep file search failed: ${stderr}`,
        });
        return;
      }

      const allFiles = stdout.split('\n').filter(line => line.trim());
      const total = allFiles.length;

      // Apply pagination
      const paginatedFiles = allFiles.slice(offset, offset + limit);

      const results: FileMatch[] = paginatedFiles.map(filePath => {
        const normalizedPath = filePath.replace(/\\/g, '/');
        const parts = normalizedPath.split('/');
        const name = parts[parts.length - 1] || '';
        const ext = name.includes('.') ? name.split('.').pop() : undefined;
        return {
          path: normalizedPath,
          type: 'file' as const,
          name,
          extension: ext,
        };
      });

      resolve({
        success: true,
        results,
        metadata: {
          pattern,
          backend: 'ripgrep',
          count: results.length,
          pagination: {
            offset,
            limit,
            total,
            has_more: offset + limit < total,
          },
        },
      });
    });

    child.on('error', (error) => {
      resolve({
        success: false,
        error: `Failed to spawn ripgrep: ${error.message}`,
      });
    });
  });
}

/**
 * Convert glob pattern to regex for file matching
 * Supports: *, **, ?, [abc], [!abc]
 */
function globToRegex(pattern: string, caseSensitive: boolean = true): RegExp {
  let i = 0;
  const out: string[] = [];
  const special = '.^$+{}|()';

  while (i < pattern.length) {
    const c = pattern[i];

    if (c === '*') {
      if (i + 1 < pattern.length && pattern[i + 1] === '*') {
        // ** matches any path including /
        out.push('.*');
        i += 2;
        // Skip following / if present
        if (pattern[i] === '/') {
          i++;
        }
        continue;
      } else {
        // * matches any character except /
        out.push('[^/]*');
      }
    } else if (c === '?') {
      out.push('[^/]');
    } else if (c === '[') {
      // Character class
      let j = i + 1;
      let negated = false;
      if (pattern[j] === '!' || pattern[j] === '^') {
        negated = true;
        j++;
      }
      let classContent = '';
      while (j < pattern.length && pattern[j] !== ']') {
        classContent += pattern[j];
        j++;
      }
      if (negated) {
        out.push(`[^${classContent}]`);
      } else {
        out.push(`[${classContent}]`);
      }
      i = j;
    } else if (special.includes(c)) {
      out.push('\\' + c);
    } else {
      out.push(c);
    }
    i++;
  }

  const flags = caseSensitive ? '' : 'i';
  return new RegExp('^' + out.join('') + '$', flags);
}

/**
 * Apply pagination to search results and add pagination metadata
 */
function applyPagination<T>(
  results: T[],
  offset: number,
  limit: number
): { paginatedResults: T[]; pagination: PaginationInfo } {
  const total = results.length;
  const paginatedResults = results.slice(offset, offset + limit);

  return {
    paginatedResults,
    pagination: {
      offset,
      limit,
      total,
      has_more: offset + limit < total,
    },
  };
}

function formatChunkRange(section: AceLikeSection): string {
  if (section.lines && section.lines.length > 0) {
    const start = section.lines[0]?.line;
    const end = section.lines[section.lines.length - 1]?.line;
    if (typeof start === 'number' && typeof end === 'number' && end > start) {
      return `${start}-${end}`;
    }
    if (typeof start === 'number') {
      return String(start);
    }
  }
  if (section.line && section.endLine && section.endLine > section.line) {
    return `${section.line}-${section.endLine}`;
  }
  if (section.line) {
    return String(section.line);
  }
  return '?';
}

function renderAceSnippet(section: AceLikeSection): string[] {
  if (section.lines && section.lines.length > 0) {
    return section.lines.map((line) => {
      const marker = line.isMatch ? '>' : ' ';
      return `${marker} ${String(line.line).padStart(4, ' ')} | ${line.text}`;
    });
  }

  return section.snippet.split(/\r?\n/).map((line) => `  ${line}`);
}

function formatAceLikeOutput(
  results: ExactMatch[] | SemanticMatch[] | GraphMatch[] | FileMatch[] | unknown[],
): AceLikeOutput {
  const sections: AceLikeSection[] = [];

  for (const result of results) {
    const candidate = result as Record<string, unknown>;
    const path = typeof candidate.file === 'string'
      ? candidate.file
      : typeof candidate.path === 'string'
        ? candidate.path
        : undefined;

    if (!path) {
      continue;
    }

    const line = typeof candidate.line === 'number' && candidate.line > 0 ? candidate.line : undefined;
    const column = typeof candidate.column === 'number' && candidate.column > 0 ? candidate.column : undefined;
    const score = typeof candidate.score === 'number' ? candidate.score : undefined;
    const symbol = typeof candidate.symbol === 'string' ? candidate.symbol : null;
    const rawSnippet = typeof candidate.content === 'string'
      ? candidate.content
      : typeof candidate.name === 'string'
        ? candidate.name
        : typeof candidate.type === 'string'
          ? `[${candidate.type}]`
          : '';

    sections.push({
      path,
      line,
      endLine: typeof candidate.endLine === 'number' && candidate.endLine >= (line ?? 0) ? candidate.endLine : line,
      column,
      score,
      symbol,
      snippet: rawSnippet || '[no snippet available]',
      lines: Array.isArray(candidate.chunkLines) ? candidate.chunkLines as ChunkLine[] : undefined,
    });
  }

  const groupsMap = new Map<string, AceLikeGroup>();
  for (const section of sections) {
    if (!groupsMap.has(section.path)) {
      groupsMap.set(section.path, {
        path: section.path,
        sections: [],
        total_matches: 0,
      });
    }
    const group = groupsMap.get(section.path)!;
    group.sections.push(section);
    group.total_matches += 1;
  }
  const groups = [...groupsMap.values()];

  const textParts = ['The following code sections were retrieved:'];
  for (const group of groups) {
    textParts.push('');
    textParts.push(`Path: ${group.path}`);
    group.sections.forEach((section, index) => {
      const chunkLabel = group.sections.length > 1 ? `Chunk ${index + 1}` : 'Chunk';
      textParts.push(`${chunkLabel}: lines ${formatChunkRange(section)}${section.score !== undefined ? ` | score=${section.score.toFixed(4)}` : ''}`);
      if (section.symbol) {
        textParts.push(`Symbol: ${section.symbol}`);
      }
      for (const snippetLine of renderAceSnippet(section)) {
        textParts.push(snippetLine);
      }
      if (index < group.sections.length - 1) {
        textParts.push('');
      }
    });
  }

  return {
    format: 'ace',
    text: textParts.join('\n'),
    groups,
    sections,
    total: sections.length,
  };
}

/**
 * Transform results based on output_mode
 */
function transformOutput(
  results: ExactMatch[] | SemanticMatch[] | GraphMatch[] | unknown[],
  outputMode: SearchOutputMode
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
    case 'ace':
      return formatAceLikeOutput(results);
    case 'full':
    default:
      return results;
  }
}

function enrichMetadataWithIndexStatus(
  metadata: SearchMetadata | undefined,
  indexStatus: IndexStatus,
  scope: SearchScope,
): SearchMetadata {
  const nextMetadata: SearchMetadata = { ...(metadata ?? {}) };
  nextMetadata.embeddings_coverage_percent = indexStatus.embeddings_coverage_percent;
  nextMetadata.index_status = indexStatus.indexed
    ? (indexStatus.has_embeddings ? 'indexed' : 'partial')
    : 'not_indexed';
  nextMetadata.reranker_enabled = indexStatus.config?.reranker_enabled;
  nextMetadata.reranker_backend = indexStatus.config?.reranker_backend;
  nextMetadata.reranker_model = indexStatus.config?.reranker_model;
  nextMetadata.cascade_strategy = indexStatus.config?.cascade_strategy;
  nextMetadata.staged_stage2_mode = indexStatus.config?.staged_stage2_mode;
  nextMetadata.static_graph_enabled = indexStatus.config?.static_graph_enabled;
  nextMetadata.warning = mergeWarnings(nextMetadata.warning, indexStatus.warning);
  nextMetadata.suggestions = mergeSuggestions(nextMetadata.suggestions, buildIndexSuggestions(indexStatus, scope));
  return nextMetadata;
}

// Handler function
export async function handler(params: Record<string, unknown>): Promise<ToolResult<SearchResult>> {
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return { success: false, error: `Invalid params: ${parsed.error.message}` };
  }

  parsed.data.query = sanitizeSearchQuery(parsed.data.query);
  parsed.data.pattern = sanitizeSearchPath(parsed.data.pattern);
  parsed.data.path = sanitizeSearchPath(parsed.data.path);
  parsed.data.paths = parsed.data.paths.map((item) => sanitizeSearchPath(item) || item);

  const { action, mode, output_mode, offset = 0 } = parsed.data;

  // Sync limit and maxResults while preserving explicit small values.
  // If both are provided, use the larger one. If only one is provided, honor it.
  const rawLimit = typeof params.limit === 'number' ? params.limit : undefined;
  const rawMaxResults = typeof params.maxResults === 'number' ? params.maxResults : undefined;
  const effectiveLimit = rawLimit !== undefined && rawMaxResults !== undefined
    ? Math.max(rawLimit, rawMaxResults)
    : rawMaxResults ?? rawLimit ?? parsed.data.maxResults ?? parsed.data.limit ?? 5;
  parsed.data.maxResults = effectiveLimit;
  parsed.data.limit = effectiveLimit;

  // Track if search_files was used (deprecated)
  let deprecationWarning: string | undefined;

  try {
    let result: SearchResult;

    // Handle actions — all routed through codexlens-search v2 bridge
    switch (action) {
      case 'init':
        result = await executeInitActionV2(parsed.data);
        break;

      case 'status':
        result = await executeStatusActionV2(parsed.data);
        break;

      case 'find_files':
        result = await executeFindFilesAction(parsed.data);
        break;

      case 'update':
        result = await executeUpdateActionV2(parsed.data);
        break;

      case 'watch':
        result = await executeWatchActionV2(parsed.data);
        break;

      case 'search_files':
        // DEPRECATED: Redirect to search with files_only output
        deprecationWarning = 'action="search_files" is deprecated. Use action="search" with output_mode="files_only" for content-to-files search, or action="find_files" for path pattern matching.';
        parsed.data.output_mode = 'files_only';
        // Fall through to search

      case 'search':
      default: {
        // v2 bridge for semantic search
        const scope = resolveSearchScope(parsed.data.path ?? '.');
        const dbPath = join(scope.workingDirectory, '.codexlens');
        const topK = (parsed.data.maxResults || 5) + (parsed.data.extraFilesCount || 10);
        const v2Result = await executeCodexLensV2Bridge(parsed.data.query || '', topK, dbPath);
        if (v2Result.success) {
          result = v2Result;
          break;
        }
        // v2 failed — fall back to ripgrep-only search
        console.warn(`[CodexLens-v2] Bridge failed, falling back to ripgrep: ${v2Result.error}`);
        result = await executeRipgrepMode(parsed.data);
        break;
      }
    }

    let backgroundNote: string | undefined;

    // Transform output based on output_mode (for search actions only)
    if (action === 'search' || action === 'search_files') {

      // Add pagination metadata for search results if not already present
      if (result.success && result.results && Array.isArray(result.results)) {
        const totalResults = (result.results as any[]).length;
        if (!result.metadata) {
          result.metadata = {};
        }
        if (!result.metadata.pagination) {
          result.metadata.pagination = {
            offset: 0,
            limit: effectiveLimit,
            total: totalResults,
            has_more: false,  // Already limited by backend
          };
        }
      }

      if (result.success && result.results && output_mode !== 'full') {
        result.results = transformOutput(result.results as any[], output_mode);
        if (
          output_mode === 'ace'
          && result.results
          && typeof result.results === 'object'
          && 'format' in result.results
          && result.results.format === 'ace'
        ) {
          const advisoryLines: string[] = [];
          if (result.metadata?.warning) {
            advisoryLines.push('', 'Warnings:', `- ${result.metadata.warning}`);
          }
          if (backgroundNote) {
            advisoryLines.push('', 'Notes:', `- ${backgroundNote}`);
          }
          if (result.metadata?.suggestions && result.metadata.suggestions.length > 0) {
            advisoryLines.push('', 'Suggestions:');
            for (const suggestion of result.metadata.suggestions) {
              advisoryLines.push(`- ${suggestion.title}: ${suggestion.command}`);
              advisoryLines.push(`  ${suggestion.reason}`);
            }
          }
          const aceResults = result.results as AceLikeOutput;
          if (advisoryLines.length > 0) {
            aceResults.text += `\n${advisoryLines.join('\n')}`;
          }
        }
      }
    }

    // Add deprecation warning if applicable
    if (deprecationWarning && result.metadata) {
      result.metadata.warning = deprecationWarning;
    }

    return result.success ? { success: true, result } : { success: false, error: result.error };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Execute init action with external progress callback
 * Used by MCP server for streaming progress
 * @param params - Search parameters (path, languages, force)
 * @param onProgress - Optional callback for progress updates
 */
export const __testables = {
  isCodexLensCliCompatibilityError,
  shouldSurfaceCodexLensFtsCompatibilityWarning,
  buildSmartSearchSpawnOptions,
  shouldDetachBackgroundSmartSearchProcess,
  checkToolAvailability,
  parseCodexLensJsonOutput,
  parsePlainTextFileMatches,
  hasCentralizedVectorArtifacts,
  extractEmbeddingsStatusSummary,
  selectEmbeddingsStatusPayload,
  resolveRipgrepQueryMode,
  queryTargetsGeneratedFiles,
  prefersLexicalPriorityQuery,
  classifyIntent,
  resolveEmbeddingSelection,
  parseOptionalBooleanEnv,
  isAutoInitMissingEnabled,
  isAutoEmbedMissingEnabled,
  getAutoInitMissingDisabledReason,
  getAutoEmbedMissingDisabledReason,
  buildIndexSuggestions,
  maybeStartBackgroundAutoInit,
  maybeStartBackgroundAutoEmbed,
  __setRuntimeOverrides(overrides: Partial<SmartSearchRuntimeOverrides>) {
    Object.assign(runtimeOverrides, overrides);
  },
  __resetRuntimeOverrides() {
    for (const key of Object.keys(runtimeOverrides) as Array<keyof SmartSearchRuntimeOverrides>) {
      delete runtimeOverrides[key];
    }
  },
  __resetBackgroundJobs() {
    autoInitJobs.clear();
    autoEmbedJobs.clear();
  },
};

export async function executeInitWithProgress(
  params: Record<string, unknown>,
  onProgress?: (progress: ProgressInfo) => void
): Promise<SearchResult> {
  const path = (params.path as string) || '.';
  const scope = resolveSearchScope(path);
  const dbPath = join(scope.workingDirectory, '.codexlens');

  // Notify progress start
  if (onProgress) {
    onProgress({ stage: 'init', message: 'Initializing v2 index...', percent: 0 } as ProgressInfo);
  }

  // Step 1: init empty index
  const initResult = await executeV2BridgeCommand('init', [], { dbPath });
  if (!initResult.success) return initResult;

  if (onProgress) {
    onProgress({ stage: 'sync', message: 'Syncing files...', percent: 10 } as ProgressInfo);
  }

  // Step 2: sync all files
  const syncResult = await executeV2BridgeCommand('sync', [
    '--root', scope.workingDirectory,
  ], { timeout: 1800000, dbPath });

  if (onProgress) {
    onProgress({ stage: 'complete', message: 'Index build complete', percent: 100 } as ProgressInfo);
  }

  return {
    success: syncResult.success,
    error: syncResult.error,
    message: syncResult.success
      ? `v2 index created and synced for ${scope.workingDirectory}`
      : undefined,
    metadata: { action: 'init', path: scope.workingDirectory },
    status: syncResult.status,
  };
}
