/**
 * Session Path Resolver - Smart file path to content_type resolution
 * Eliminates need for --type parameter by inferring from filenames and paths
 */

import { basename, dirname, join } from 'path';

// Supported content types (from session-manager.ts)
type ContentType =
  | 'session' | 'plan' | 'task' | 'summary' | 'process' | 'chat' | 'brainstorm'
  | 'review-dim' | 'review-iter' | 'review-fix' | 'todo' | 'context'
  | 'lite-plan' | 'lite-fix-plan' | 'exploration' | 'explorations-manifest'
  | 'diagnosis' | 'diagnoses-manifest' | 'clarifications' | 'execution-context' | 'session-metadata';

export interface ResolverResult {
  contentType: ContentType;
  pathParams?: Record<string, string>;
  resolvedPath: string;  // Relative path within session directory
}

export interface ResolverContext {
  sessionPath: string;
  sessionLocation: 'active' | 'archived' | 'lite-plan' | 'lite-fix';
}

export class PathResolutionError extends Error {
  code: 'NOT_FOUND' | 'INVALID_PATH';
  suggestions: string[];

  constructor(code: 'NOT_FOUND' | 'INVALID_PATH', message: string, suggestions: string[] = []) {
    super(message);
    this.name = 'PathResolutionError';
    this.code = code;
    this.suggestions = suggestions;
  }
}

/**
 * Task ID patterns (IMPL-*, TEST-*, DOC-*, REFACTOR-*, TASK-*)
 */
const TASK_ID_PATTERNS = [
  /^(IMPL|TEST|DOC|REFACTOR|TASK)-\d+\.json$/i,
];

/**
 * Summary filename pattern (*-summary.md)
 */
const SUMMARY_PATTERN = /^(.+)-summary\.md$/i;

/**
 * Path prefix to content_type mapping
 */
const PATH_PREFIX_TO_CONTENT_TYPE: Record<string, ContentType> = {
  '.task/': 'task',
  '.summaries/': 'summary',
  '.process/': 'process',
  '.chat/': 'chat',
  '.brainstorming/': 'brainstorm',
  '.review/dimensions/': 'review-dim',
  '.review/iterations/': 'review-iter',
  '.review/fixes/': 'review-fix',
};

/**
 * Exact filename to content_type mapping
 */
const EXACT_FILENAME_TO_CONTENT_TYPE: Record<string, ContentType> = {
  'IMPL_PLAN.md': 'plan',
  'TODO_LIST.md': 'todo',
  'workflow-session.json': 'session',
  'context-package.json': 'context',
  'plan.json': 'lite-plan',           // Will be overridden by session location
  'fix-plan.json': 'lite-fix-plan',   // Specific to lite-fix sessions
  'session-metadata.json': 'session-metadata',
  'clarifications.json': 'clarifications',
  'execution-context.json': 'execution-context',
  'explorations-manifest.json': 'explorations-manifest',
  'diagnoses-manifest.json': 'diagnoses-manifest',
};

/**
 * Extract task ID from filename
 * Examples: IMPL-001.json → IMPL-001
 */
function extractTaskId(filename: string): string | null {
  const match = filename.match(/^([A-Z]+-\d+)\.json$/i);
  return match ? match[1] : null;
}

/**
 * Extract summary task ID from filename
 * Examples: IMPL-001-summary.md → IMPL-001
 */
function extractSummaryTaskId(filename: string): string | null {
  const match = filename.match(SUMMARY_PATTERN);
  return match ? match[1] : null;
}

/**
 * Extract review dimension from path
 * Examples: .review/dimensions/security.json → security
 */
function extractReviewDimension(filepath: string): string | null {
  const match = filepath.match(/\.review\/dimensions\/(.+)\.json$/);
  return match ? match[1] : null;
}

/**
 * Extract review iteration from path
 * Examples: .review/iterations/1.json → 1
 */
function extractReviewIteration(filepath: string): string | null {
  const match = filepath.match(/\.review\/iterations\/(\d+)\.json$/);
  return match ? match[1] : null;
}

/**
 * Extract filename from relative path within review fixes
 * Examples: .review/fixes/finding-001.json → finding-001.json
 */
function extractReviewFixFilename(filepath: string): string | null {
  const match = filepath.match(/\.review\/fixes\/(.+)$/);
  return match ? match[1] : null;
}

/**
 * Extract filename from process/chat/brainstorm paths
 * Examples: .process/archiving.json → archiving.json
 */
function extractProcessFilename(filepath: string, prefix: string): string | null {
  const pattern = new RegExp(`^${prefix.replace(/\//g, '\\/')}(.+)$`);
  const match = filepath.match(pattern);
  return match ? match[1] : null;
}

/**
 * Resolve relative path (contains '/') to content_type
 */
function resolveRelativePath(filepath: string): ResolverResult | null {
  // Security: Reject path traversal attempts
  if (filepath.includes('..') || filepath.startsWith('/')) {
    throw new PathResolutionError(
      'INVALID_PATH',
      'Path traversal and absolute paths are not allowed',
      ['Use relative paths within the session directory']
    );
  }

  // Check path prefix matches
  for (const [prefix, contentType] of Object.entries(PATH_PREFIX_TO_CONTENT_TYPE)) {
    if (filepath.startsWith(prefix)) {
      const pathParams: Record<string, string> = {};

      // Extract specific parameters based on content type
      if (contentType === 'task') {
        const taskId = extractTaskId(basename(filepath));
        if (taskId) {
          pathParams.task_id = taskId;
        }
      } else if (contentType === 'summary') {
        const taskId = extractSummaryTaskId(basename(filepath));
        if (taskId) {
          pathParams.task_id = taskId;
        }
      } else if (contentType === 'review-dim') {
        const dimension = extractReviewDimension(filepath);
        if (dimension) {
          pathParams.dimension = dimension;
        }
      } else if (contentType === 'review-iter') {
        const iteration = extractReviewIteration(filepath);
        if (iteration) {
          pathParams.iteration = iteration;
        }
      } else if (contentType === 'review-fix') {
        const filename = extractReviewFixFilename(filepath);
        if (filename) {
          pathParams.filename = filename;
        }
      } else if (contentType === 'process' || contentType === 'chat' || contentType === 'brainstorm') {
        const filename = extractProcessFilename(filepath, prefix);
        if (filename) {
          pathParams.filename = filename;
        }
      }

      return {
        contentType,
        pathParams: Object.keys(pathParams).length > 0 ? pathParams : undefined,
        resolvedPath: filepath,
      };
    }
  }

  return null;
}

/**
 * Resolve simple filename (no '/') to content_type
 */
function resolveFilename(
  filename: string,
  context: ResolverContext
): ResolverResult | null {
  // Check exact filename matches first
  if (EXACT_FILENAME_TO_CONTENT_TYPE[filename]) {
    let contentType = EXACT_FILENAME_TO_CONTENT_TYPE[filename];

    // Override plan.json based on session location
    if (filename === 'plan.json') {
      if (context.sessionLocation === 'lite-plan') {
        contentType = 'lite-plan';
      } else if (context.sessionLocation === 'lite-fix') {
        contentType = 'lite-fix-plan';
      }
    }

    return {
      contentType,
      resolvedPath: filename,
    };
  }

  // Check task ID patterns (IMPL-001.json, TEST-042.json, etc.)
  for (const pattern of TASK_ID_PATTERNS) {
    if (pattern.test(filename)) {
      const taskId = extractTaskId(filename);
      if (taskId) {
        return {
          contentType: 'task',
          pathParams: { task_id: taskId },
          resolvedPath: `.task/${filename}`,
        };
      }
    }
  }

  // Check summary pattern (*-summary.md)
  const summaryTaskId = extractSummaryTaskId(filename);
  if (summaryTaskId) {
    return {
      contentType: 'summary',
      pathParams: { task_id: summaryTaskId },
      resolvedPath: `.summaries/${filename}`,
    };
  }

  // Check exploration pattern (exploration-{angle}.json)
  const explorationMatch = filename.match(/^exploration-(.+)\.json$/);
  if (explorationMatch) {
    return {
      contentType: 'exploration',
      pathParams: { angle: explorationMatch[1] },
      resolvedPath: filename,
    };
  }

  // Check diagnosis pattern (diagnosis-{angle}.json)
  const diagnosisMatch = filename.match(/^diagnosis-(.+)\.json$/);
  if (diagnosisMatch) {
    return {
      contentType: 'diagnosis',
      pathParams: { angle: diagnosisMatch[1] },
      resolvedPath: filename,
    };
  }

  return null;
}

/**
 * Main resolver function - resolves filename/path to content_type
 *
 * @param filename - Filename or relative path
 * @param context - Session context (path and location)
 * @returns Resolver result with content type, path params, and resolved path
 * @throws PathResolutionError if path is invalid or cannot be resolved
 *
 * @example
 * // Filename examples
 * resolveFilePath('IMPL-001.json', context)
 * // → { contentType: 'task', pathParams: {task_id: 'IMPL-001'}, resolvedPath: '.task/IMPL-001.json' }
 *
 * resolveFilePath('IMPL_PLAN.md', context)
 * // → { contentType: 'plan', resolvedPath: 'IMPL_PLAN.md' }
 *
 * // Relative path examples
 * resolveFilePath('.task/IMPL-001.json', context)
 * // → { contentType: 'task', pathParams: {task_id: 'IMPL-001'}, resolvedPath: '.task/IMPL-001.json' }
 *
 * resolveFilePath('.review/dimensions/security.json', context)
 * // → { contentType: 'review-dim', pathParams: {dimension: 'security'}, resolvedPath: '...' }
 */
export function resolveFilePath(
  filename: string,
  context: ResolverContext
): ResolverResult {
  if (!filename) {
    throw new PathResolutionError(
      'INVALID_PATH',
      'Filename is required',
      ['Usage: ccw session <session-id> read <filename|path>']
    );
  }

  // Normalize path separators (handle Windows paths)
  const normalizedFilename = filename.replace(/\\/g, '/');

  // Security: Validate filename
  if (normalizedFilename.includes('\0') || normalizedFilename.trim() === '') {
    throw new PathResolutionError(
      'INVALID_PATH',
      'Invalid filename or path',
      ['Use valid filename or relative path']
    );
  }

  // RULE 1: Relative path (contains '/')
  if (normalizedFilename.includes('/')) {
    const result = resolveRelativePath(normalizedFilename);
    if (result) {
      return result;
    }

    throw new PathResolutionError(
      'NOT_FOUND',
      `Unknown path pattern: ${normalizedFilename}`,
      [
        'Supported paths:',
        '  .task/*.json (tasks)',
        '  .summaries/*.md (summaries)',
        '  .process/* (process files)',
        '  .chat/* (chat files)',
        '  .brainstorming/* (brainstorm files)',
        '  .review/dimensions/*.json (review dimensions)',
        '  .review/iterations/*.json (review iterations)',
        '  .review/fixes/* (review fixes)',
      ]
    );
  }

  // RULE 2: Simple filename
  const result = resolveFilename(normalizedFilename, context);
  if (result) {
    return result;
  }

  // Resolution failed
  throw new PathResolutionError(
    'NOT_FOUND',
    `Unknown file: ${normalizedFilename}`,
    [
      'Supported filenames:',
      '  IMPL-*.json, TEST-*.json, DOC-*.json, REFACTOR-*.json, TASK-*.json (tasks)',
      '  IMPL_PLAN.md (plan)',
      '  TODO_LIST.md (todo)',
      '  workflow-session.json (session metadata)',
      '  context-package.json (context)',
      '  session-metadata.json (session metadata for lite sessions)',
      '  plan.json (lite-plan or lite-fix-plan, depending on session location)',
      '  fix-plan.json (lite-fix-plan)',
      '  *-summary.md (summaries)',
      '  exploration-{angle}.json (explorations)',
      '  diagnosis-{angle}.json (diagnoses)',
      '  explorations-manifest.json (exploration manifest)',
      '  diagnoses-manifest.json (diagnosis manifest)',
      '  clarifications.json (clarifications)',
      '  execution-context.json (execution context)',
      'Or use a relative path: .task/IMPL-001.json',
    ]
  );
}
