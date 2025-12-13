/**
 * Smart Context Generator
 * Extracts keywords from prompts and finds relevant files via CodexLens
 * Auto-generates contextual file references for CLI execution
 */

import { executeCodexLens, ensureReady as ensureCodexLensReady } from './codex-lens.js';

// Options for smart context generation
export interface SmartContextOptions {
  enabled: boolean;
  maxFiles: number; // Default: 10
  searchMode: 'semantic' | 'text'; // Default: 'text'
}

// Result of smart context generation
export interface SmartContextResult {
  files: string[];
  keywords: string[];
  searchQuery: string;
  searchMode: string;
}

// Common stopwords to filter out
const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of',
  'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
  'during', 'before', 'after', 'above', 'below', 'between', 'under',
  'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where',
  'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
  'very', 'just', 'and', 'but', 'or', 'if', 'because', 'until', 'while',
  'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her',
  'its', 'our', 'their', 'me', 'him', 'us', 'them',
  'please', 'help', 'want', 'like', 'make', 'use', 'file', 'code', 'add',
  'create', 'update', 'delete', 'remove', 'change', 'modify', 'fix', 'find',
  'get', 'set', 'show', 'display', 'list', 'new', 'now', 'also', 'any',
]);

/**
 * Extract meaningful keywords from prompt
 * Uses simple NLP: remove stopwords, extract technical terms
 */
export function extractKeywords(prompt: string): string[] {
  // Split into words, convert to lowercase, filter stopwords
  const words = prompt
    .toLowerCase()
    .replace(/[^\w\s\-_./]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  // Extract potential technical terms (camelCase, snake_case, paths)
  const camelCaseMatches = prompt.match(/[a-z][a-z0-9]*[A-Z][a-zA-Z0-9]*/g) || [];
  const snakeCaseMatches = prompt.match(/[a-z]+_[a-z_]+/g) || [];
  const pathMatches = prompt.match(/[\w\-./]+\.(ts|js|tsx|jsx|py|go|rs|java|cpp|c|h)/g) || [];
  const quotedMatches = prompt.match(/"([^"]+)"|'([^']+)'/g) || [];

  const technicalTerms = [
    ...camelCaseMatches.map((t) => t.toLowerCase()),
    ...snakeCaseMatches,
    ...pathMatches,
    ...quotedMatches.map((t) => t.replace(/['"]/g, '')),
  ];

  // Combine and deduplicate, prioritize longer terms
  const allKeywords = [...new Set([...technicalTerms, ...words])];

  // Sort by length (longer terms are more specific) and take top 5
  return allKeywords
    .sort((a, b) => b.length - a.length)
    .slice(0, 5);
}

/**
 * Build search query from keywords
 */
function buildSearchQuery(keywords: string[]): string {
  return keywords.join(' ');
}

/**
 * Extract file paths from various CodexLens result formats
 * Handles nested structures like {files: {result: {files: [...]}}}
 */
function extractFilesFromResult(parsed: unknown): string[] {
  if (!parsed || typeof parsed !== 'object') {
    return [];
  }

  const obj = parsed as Record<string, unknown>;

  // Direct array of strings
  if (Array.isArray(parsed)) {
    return parsed
      .map((item) => (typeof item === 'string' ? item : (item as Record<string, string>)?.file || (item as Record<string, string>)?.path || ''))
      .filter((f) => f && f.length > 0);
  }

  // {files: [...]} format
  if (Array.isArray(obj.files)) {
    return extractFilesFromResult(obj.files);
  }

  // {files: {result: {files: [...]}}} nested format
  if (obj.files && typeof obj.files === 'object') {
    const filesObj = obj.files as Record<string, unknown>;
    if (filesObj.result && typeof filesObj.result === 'object') {
      const resultObj = filesObj.result as Record<string, unknown>;
      if (Array.isArray(resultObj.files)) {
        return resultObj.files.filter((f): f is string => typeof f === 'string' && f.length > 0);
      }
    }
    // {files: {files: [...]}}
    if (Array.isArray(filesObj.files)) {
      return extractFilesFromResult(filesObj.files);
    }
  }

  // {results: [...]} format
  if (Array.isArray(obj.results)) {
    return obj.results
      .map((r: Record<string, string>) => r?.file || r?.path || '')
      .filter((f) => f && f.length > 0);
  }

  // {result: {files: [...]}} format
  if (obj.result && typeof obj.result === 'object') {
    return extractFilesFromResult(obj.result);
  }

  return [];
}

/**
 * Generate smart context using CodexLens
 * Uses multi-keyword search strategy: search each keyword and merge results
 */
export async function generateSmartContext(
  prompt: string,
  options: SmartContextOptions,
  cwd: string
): Promise<SmartContextResult> {
  // Return empty result if disabled
  if (!options.enabled) {
    return { files: [], keywords: [], searchQuery: '', searchMode: '' };
  }

  // Extract keywords from prompt
  const keywords = extractKeywords(prompt);
  if (keywords.length === 0) {
    return { files: [], keywords: [], searchQuery: '', searchMode: '' };
  }

  const searchMode = options.searchMode || 'text';
  const searchQuery = buildSearchQuery(keywords);

  try {
    // Ensure CodexLens is ready
    await ensureCodexLensReady();

    // Search each keyword individually and collect unique files
    const allFiles = new Set<string>();
    const filesPerKeyword = Math.ceil(options.maxFiles / keywords.length);

    for (const keyword of keywords.slice(0, 3)) { // Limit to top 3 keywords
      const args = [
        'search',
        keyword,
        '--files-only',
        '--limit',
        filesPerKeyword.toString(),
        '--json',
      ];

      const result = await executeCodexLens(args, { cwd });

      if (result.success && result.output) {
        try {
          const parsed = JSON.parse(result.output);
          const files = extractFilesFromResult(parsed);
          files.forEach((f) => allFiles.add(f));
        } catch {
          // Skip if parse fails
        }
      }
    }

    // Convert to array and limit to maxFiles
    const files = Array.from(allFiles).slice(0, options.maxFiles);

    return { files, keywords, searchQuery, searchMode };
  } catch (err) {
    console.error('[Smart Context] Error:', err);
    return { files: [], keywords, searchQuery, searchMode };
  }
}

/**
 * Format smart context as prompt appendage
 */
export function formatSmartContext(result: SmartContextResult): string {
  if (result.files.length === 0) {
    return '';
  }

  const lines = [
    '',
    '--- SMART CONTEXT ---',
    `Relevant files (searched: "${result.searchQuery}"):`,
    ...result.files.map((f) => `- ${f}`),
    '--- END SMART CONTEXT ---',
    '',
  ];

  return lines.join('\n');
}

/**
 * Default options for smart context
 */
export const defaultSmartContextOptions: SmartContextOptions = {
  enabled: false,
  maxFiles: 10,
  searchMode: 'text',
};
