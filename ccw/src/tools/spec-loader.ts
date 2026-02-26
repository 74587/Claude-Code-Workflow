/**
 * Spec Loader
 *
 * Core loading logic for the spec system. Reads index caches, filters specs
 * by readMode and keyword match, loads MD content, merges by dimension
 * priority, and formats output for CLI or Hook consumption.
 *
 * Single entry point: loadSpecs(options) -> SpecLoadResult
 *
 * Data flow:
 *   Keywords -> IndexCache -> Filter(required + keyword-matched) ->
 *   MDLoader -> PriorityMerger -> OutputFormatter
 */

import matter from 'gray-matter';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

import {
  getDimensionIndex,
  SpecIndexEntry,
  DimensionIndex,
  SPEC_DIMENSIONS,
  type SpecDimension,
} from './spec-index-builder.js';

import {
  extractKeywords,
  calculateMatchScore,
} from './spec-keyword-extractor.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Input options for loadSpecs().
 */
export interface SpecLoadOptions {
  /** Absolute path to the project root */
  projectPath: string;
  /** Specific dimension to load (loads all if omitted) */
  dimension?: SpecDimension;
  /** Pre-extracted keywords (skips extraction if provided) */
  keywords?: string[];
  /** Output format: 'cli' for markdown, 'hook' for JSON */
  outputFormat: 'cli' | 'hook';
  /** Raw stdin data from Claude Code hook (used to extract user_prompt) */
  stdinData?: { user_prompt?: string; prompt?: string; [key: string]: unknown };
  /** Enable debug logging to stderr */
  debug?: boolean;
}

/**
 * Output from loadSpecs().
 */
export interface SpecLoadResult {
  /** Formatted content string (markdown or JSON) */
  content: string;
  /** Output format that was used */
  format: 'markdown' | 'json';
  /** List of spec titles that were matched and loaded */
  matchedSpecs: string[];
  /** Total number of spec files loaded */
  totalLoaded: number;
}

/**
 * Internal representation of a loaded spec's content.
 */
interface LoadedSpec {
  title: string;
  dimension: string;
  priority: string;
  content: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Dimension priority for merge ordering.
 * Lower number = loaded first (lower priority, gets overridden).
 * Higher number = loaded last (higher priority, overrides).
 */
const DIMENSION_PRIORITY: Record<string, number> = {
  personal: 1,
  changelog: 2,
  roadmap: 3,
  specs: 4,
};

/**
 * Priority weight for ordering specs within a dimension.
 */
const SPEC_PRIORITY_WEIGHT: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Load specs based on options.
 *
 * Pipeline:
 *   1. Extract keywords from options.keywords, stdinData, or empty
 *   2. For each dimension: read index cache (fallback to on-the-fly build)
 *   3. Filter: all required specs + optional specs with keyword match
 *   4. Load MD file content (strip frontmatter)
 *   5. Merge by dimension priority
 *   6. Format for CLI (markdown) or Hook (JSON)
 *
 * @param options - Loading configuration
 * @returns SpecLoadResult with formatted content
 */
export async function loadSpecs(options: SpecLoadOptions): Promise<SpecLoadResult> {
  const { projectPath, outputFormat, debug } = options;

  // Step 1: Resolve keywords
  const keywords = resolveKeywords(options);

  if (debug) {
    debugLog(`Extracted ${keywords.length} keywords: [${keywords.join(', ')}]`);
  }

  // Step 2: Determine which dimensions to process
  const dimensions = options.dimension
    ? [options.dimension]
    : [...SPEC_DIMENSIONS];

  // Step 3: For each dimension, read index and filter specs
  const allLoadedSpecs: LoadedSpec[] = [];
  let totalScanned = 0;

  for (const dim of dimensions) {
    const index = await getDimensionIndex(projectPath, dim);
    totalScanned += index.entries.length;

    const { required, matched } = filterSpecs(index, keywords);

    if (debug) {
      debugLog(
        `[${dim}] scanned=${index.entries.length} required=${required.length} matched=${matched.length}`
      );
    }

    // Step 4: Load content for filtered entries
    const entriesToLoad = [...required, ...matched];
    const loaded = loadSpecContent(projectPath, entriesToLoad);
    allLoadedSpecs.push(...loaded);
  }

  if (debug) {
    debugLog(
      `Total: scanned=${totalScanned} loaded=${allLoadedSpecs.length}`
    );
  }

  // Step 5: Merge by dimension priority
  const mergedContent = mergeByPriority(allLoadedSpecs);

  // Step 6: Format output
  const matchedTitles = allLoadedSpecs.map(s => s.title);
  const content = formatOutput(mergedContent, matchedTitles, outputFormat);
  const format = outputFormat === 'cli' ? 'markdown' : 'json';

  return {
    content,
    format,
    matchedSpecs: matchedTitles,
    totalLoaded: allLoadedSpecs.length,
  };
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Filter specs by readMode and keyword match.
 *
 * - required: all entries with readMode === 'required'
 * - matched: entries with readMode === 'optional' that have keyword intersection
 *
 * @param index - The dimension index to filter
 * @param keywords - Extracted prompt keywords
 * @returns Separated required and matched entries (deduplicated)
 */
export function filterSpecs(
  index: DimensionIndex,
  keywords: string[]
): { required: SpecIndexEntry[]; matched: SpecIndexEntry[] } {
  const required: SpecIndexEntry[] = [];
  const matched: SpecIndexEntry[] = [];

  for (const entry of index.entries) {
    if (entry.readMode === 'required') {
      required.push(entry);
      continue;
    }

    // Optional entries: check keyword intersection
    if (keywords.length > 0 && entry.keywords.length > 0) {
      const score = calculateMatchScore(keywords, entry.keywords);
      if (score > 0) {
        matched.push(entry);
      }
    }
  }

  return { required, matched };
}

/**
 * Merge loaded spec content by dimension priority.
 *
 * Dimension priority order: personal(1) < changelog(2) < roadmap(3) < specs(4).
 * Within a dimension, specs are ordered by priority weight (critical > high > medium > low).
 *
 * @param specs - All loaded specs
 * @returns Merged content string ordered by priority
 */
export function mergeByPriority(specs: LoadedSpec[]): string {
  if (specs.length === 0) {
    return '';
  }

  // Sort by dimension priority (ascending), then by spec priority weight (descending)
  const sorted = [...specs].sort((a, b) => {
    const dimA = DIMENSION_PRIORITY[a.dimension] ?? 0;
    const dimB = DIMENSION_PRIORITY[b.dimension] ?? 0;
    if (dimA !== dimB) {
      return dimA - dimB;
    }
    const priA = SPEC_PRIORITY_WEIGHT[a.priority] ?? 0;
    const priB = SPEC_PRIORITY_WEIGHT[b.priority] ?? 0;
    return priB - priA;
  });

  // Concatenate content with separators
  const sections: string[] = [];
  for (const spec of sorted) {
    sections.push(`## ${spec.title}\n\n${spec.content.trim()}`);
  }

  return sections.join('\n\n---\n\n');
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Resolve keywords from options.
 *
 * Priority:
 *   1. options.keywords (pre-extracted)
 *   2. options.stdinData.user_prompt or options.stdinData.prompt (extract from text)
 *   3. empty array (only required specs will load)
 */
function resolveKeywords(options: SpecLoadOptions): string[] {
  if (options.keywords && options.keywords.length > 0) {
    return options.keywords;
  }

  const prompt = options.stdinData?.user_prompt || options.stdinData?.prompt;
  if (prompt && typeof prompt === 'string') {
    return extractKeywords(prompt);
  }

  return [];
}

/**
 * Load MD file content for a list of spec entries.
 *
 * Reads each file, strips YAML frontmatter via gray-matter, returns body content.
 * Silently skips files that cannot be read.
 *
 * @param projectPath - Project root directory
 * @param entries - Spec index entries to load
 * @returns Array of loaded specs with content
 */
function loadSpecContent(
  projectPath: string,
  entries: SpecIndexEntry[]
): LoadedSpec[] {
  const loaded: LoadedSpec[] = [];

  for (const entry of entries) {
    const filePath = join(projectPath, entry.file);

    if (!existsSync(filePath)) {
      continue;
    }

    let raw: string;
    try {
      raw = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    // Strip frontmatter using gray-matter
    let body: string;
    try {
      const parsed = matter(raw);
      body = parsed.content;
    } catch {
      // Fallback: use raw content if frontmatter parsing fails
      body = raw;
    }

    // Skip empty content
    if (!body.trim()) {
      continue;
    }

    loaded.push({
      title: entry.title,
      dimension: entry.dimension,
      priority: entry.priority,
      content: body,
    });
  }

  return loaded;
}

/**
 * Format the merged content for output.
 *
 * CLI format: markdown with --- separators and section titles.
 * Hook format: JSON { continue: true, systemMessage: '<project-specs>...</project-specs>' }
 *
 * @param mergedContent - Priority-merged spec content
 * @param matchedTitles - List of matched spec titles
 * @param format - Output format ('cli' or 'hook')
 * @returns Formatted string
 */
function formatOutput(
  mergedContent: string,
  matchedTitles: string[],
  format: 'cli' | 'hook'
): string {
  if (!mergedContent) {
    if (format === 'hook') {
      return JSON.stringify({ continue: true });
    }
    return '(No matching specs found)';
  }

  if (format === 'cli') {
    // CLI: markdown with header
    const header = `# Project Specs (${matchedTitles.length} loaded)`;
    return `${header}\n\n${mergedContent}`;
  }

  // Hook: JSON with systemMessage wrapped in <project-specs> tags
  const wrappedContent = `<project-specs>\n${mergedContent}\n</project-specs>`;
  return JSON.stringify({
    continue: true,
    systemMessage: wrappedContent,
  });
}

/**
 * Write a debug log message to stderr (avoids polluting stdout for hooks).
 */
function debugLog(message: string): void {
  process.stderr.write(`[spec-loader] ${message}\n`);
}
