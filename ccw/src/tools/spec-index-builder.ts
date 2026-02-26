/**
 * Spec Index Builder
 *
 * Scans .workflow/{dimension}/*.md files, parses YAML frontmatter via
 * gray-matter, and writes .spec-index/{dimension}.index.json cache files.
 *
 * Supports 4 dimensions: specs, roadmap, changelog, personal
 *
 * YAML Frontmatter Schema:
 * ---
 * title: "Document Title"
 * dimension: "specs"
 * keywords: ["auth", "security"]
 * readMode: "required"       # required | optional
 * priority: "high"           # critical | high | medium | low
 * ---
 */

import matter from 'gray-matter';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, basename, extname, relative } from 'path';

// ============================================================================
// Types
// ============================================================================

/**
 * YAML frontmatter schema for spec MD files.
 */
export interface SpecFrontmatter {
  title: string;
  dimension: string;
  keywords: string[];
  readMode: 'required' | 'optional';
  priority: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Single entry in the dimension index cache.
 */
export interface SpecIndexEntry {
  /** Document title from frontmatter */
  title: string;
  /** Relative file path from project root */
  file: string;
  /** Dimension this spec belongs to */
  dimension: string;
  /** Keywords for matching against user prompts */
  keywords: string[];
  /** Whether this spec is required or optional */
  readMode: 'required' | 'optional';
  /** Priority level for ordering */
  priority: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Complete index for one dimension.
 */
export interface DimensionIndex {
  /** Dimension name */
  dimension: string;
  /** All spec entries in this dimension */
  entries: SpecIndexEntry[];
  /** ISO timestamp when this index was built */
  built_at: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * The 4 supported spec dimensions.
 */
export const SPEC_DIMENSIONS = ['specs', 'roadmap', 'changelog', 'personal'] as const;

export type SpecDimension = typeof SPEC_DIMENSIONS[number];

/**
 * Valid readMode values.
 */
const VALID_READ_MODES = ['required', 'optional'] as const;

/**
 * Valid priority values.
 */
const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;

/**
 * Directory name for spec index cache files.
 */
const SPEC_INDEX_DIR = '.spec-index';

// ============================================================================
// Public API
// ============================================================================

/**
 * Get the path to the index JSON file for a given dimension.
 *
 * @param projectPath - Project root directory
 * @param dimension - The dimension name
 * @returns Absolute path to .spec-index/{dimension}.index.json
 */
export function getIndexPath(projectPath: string, dimension: string): string {
  return join(projectPath, SPEC_INDEX_DIR, `${dimension}.index.json`);
}

/**
 * Get the path to the .workflow/{dimension} directory.
 *
 * @param projectPath - Project root directory
 * @param dimension - The dimension name
 * @returns Absolute path to .workflow/{dimension}/
 */
export function getDimensionDir(projectPath: string, dimension: string): string {
  return join(projectPath, '.workflow', dimension);
}

/**
 * Build the index for a single dimension.
 *
 * Scans .workflow/{dimension}/*.md files, parses YAML frontmatter,
 * extracts the 5 required fields, and returns a DimensionIndex.
 *
 * Files with malformed or missing frontmatter are skipped gracefully.
 *
 * @param projectPath - Project root directory
 * @param dimension - The dimension to index (e.g., 'specs')
 * @returns DimensionIndex with all valid entries
 */
export async function buildDimensionIndex(
  projectPath: string,
  dimension: string
): Promise<DimensionIndex> {
  const dimensionDir = getDimensionDir(projectPath, dimension);
  const entries: SpecIndexEntry[] = [];

  // If directory doesn't exist, return empty index
  if (!existsSync(dimensionDir)) {
    return {
      dimension,
      entries: [],
      built_at: new Date().toISOString(),
    };
  }

  // Scan for .md files
  let files: string[];
  try {
    files = readdirSync(dimensionDir).filter(
      f => extname(f).toLowerCase() === '.md'
    );
  } catch {
    // Directory read error - return empty index
    return {
      dimension,
      entries: [],
      built_at: new Date().toISOString(),
    };
  }

  for (const file of files) {
    const filePath = join(dimensionDir, file);
    const entry = parseSpecFile(filePath, dimension, projectPath);
    if (entry) {
      entries.push(entry);
    }
  }

  return {
    dimension,
    entries,
    built_at: new Date().toISOString(),
  };
}

/**
 * Build indices for all 4 dimensions and write to .spec-index/.
 *
 * Creates .spec-index/ directory if it doesn't exist.
 * Writes {dimension}.index.json for each dimension.
 *
 * @param projectPath - Project root directory
 */
export async function buildAllIndices(projectPath: string): Promise<void> {
  const indexDir = join(projectPath, SPEC_INDEX_DIR);

  // Ensure .spec-index directory exists
  if (!existsSync(indexDir)) {
    mkdirSync(indexDir, { recursive: true });
  }

  for (const dimension of SPEC_DIMENSIONS) {
    const index = await buildDimensionIndex(projectPath, dimension);
    const indexPath = getIndexPath(projectPath, dimension);

    try {
      writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
    } catch (err) {
      // Log but continue with other dimensions
      console.error(
        `[spec-index-builder] Failed to write index for ${dimension}: ${(err as Error).message}`
      );
    }
  }
}

/**
 * Read a cached dimension index from disk.
 *
 * @param projectPath - Project root directory
 * @param dimension - The dimension to read
 * @returns DimensionIndex if cache exists and is valid, null otherwise
 */
export function readCachedIndex(
  projectPath: string,
  dimension: string
): DimensionIndex | null {
  const indexPath = getIndexPath(projectPath, dimension);

  if (!existsSync(indexPath)) {
    return null;
  }

  try {
    const content = readFileSync(indexPath, 'utf-8');
    const parsed = JSON.parse(content) as DimensionIndex;

    // Basic validation
    if (
      parsed &&
      typeof parsed.dimension === 'string' &&
      Array.isArray(parsed.entries) &&
      typeof parsed.built_at === 'string'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get the dimension index, using cache if available, otherwise building fresh.
 *
 * @param projectPath - Project root directory
 * @param dimension - The dimension to get
 * @param forceRebuild - Skip cache and rebuild from source files
 * @returns DimensionIndex
 */
export async function getDimensionIndex(
  projectPath: string,
  dimension: string,
  forceRebuild = false
): Promise<DimensionIndex> {
  if (!forceRebuild) {
    const cached = readCachedIndex(projectPath, dimension);
    if (cached) {
      return cached;
    }
  }

  // Build fresh and cache
  const index = await buildDimensionIndex(projectPath, dimension);

  const indexDir = join(projectPath, SPEC_INDEX_DIR);
  if (!existsSync(indexDir)) {
    mkdirSync(indexDir, { recursive: true });
  }

  const indexPath = getIndexPath(projectPath, dimension);
  try {
    writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  } catch {
    // Cache write failure is non-fatal
  }

  return index;
}

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Parse a single spec MD file and extract its frontmatter into a SpecIndexEntry.
 *
 * @param filePath - Absolute path to the MD file
 * @param dimension - The dimension this file belongs to
 * @param projectPath - Project root for computing relative paths
 * @returns SpecIndexEntry if frontmatter is valid, null if malformed/missing
 */
function parseSpecFile(
  filePath: string,
  dimension: string,
  projectPath: string
): SpecIndexEntry | null {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  // Parse frontmatter
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(content);
  } catch {
    // Malformed frontmatter - skip
    return null;
  }

  const data = parsed.data as Record<string, unknown>;

  // Extract and validate frontmatter fields
  const title = extractString(data, 'title');
  if (!title) {
    // Title is required - use filename as fallback
    const fallbackTitle = basename(filePath, extname(filePath));
    return buildEntry(fallbackTitle, filePath, dimension, projectPath, data);
  }

  return buildEntry(title, filePath, dimension, projectPath, data);
}

/**
 * Build a SpecIndexEntry from parsed frontmatter data.
 */
function buildEntry(
  title: string,
  filePath: string,
  dimension: string,
  projectPath: string,
  data: Record<string, unknown>
): SpecIndexEntry {
  // Compute relative file path from project root using path.relative
  // Normalize to forward slashes for cross-platform consistency
  const relativePath = relative(projectPath, filePath).replace(/\\/g, '/');

  // Extract keywords - accept string[] or single string
  const keywords = extractStringArray(data, 'keywords');

  // Extract readMode with validation
  const rawReadMode = extractString(data, 'readMode');
  const readMode = isValidReadMode(rawReadMode) ? rawReadMode : 'optional';

  // Extract priority with validation
  const rawPriority = extractString(data, 'priority');
  const priority = isValidPriority(rawPriority) ? rawPriority : 'medium';

  return {
    title,
    file: relativePath,
    dimension,
    keywords,
    readMode,
    priority,
  };
}

/**
 * Extract a string value from parsed YAML data.
 */
function extractString(
  data: Record<string, unknown>,
  key: string
): string | null {
  const value = data[key];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

/**
 * Extract a string array from parsed YAML data.
 * Handles both array format and comma-separated string format.
 */
function extractStringArray(
  data: Record<string, unknown>,
  key: string
): string[] {
  const value = data[key];

  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  return [];
}

/**
 * Type guard for valid readMode values.
 */
function isValidReadMode(value: string | null): value is 'required' | 'optional' {
  return value !== null && (VALID_READ_MODES as readonly string[]).includes(value);
}

/**
 * Type guard for valid priority values.
 */
function isValidPriority(value: string | null): value is 'critical' | 'high' | 'medium' | 'low' {
  return value !== null && (VALID_PRIORITIES as readonly string[]).includes(value);
}
