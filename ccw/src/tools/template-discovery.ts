/**
 * Template Discovery Module
 *
 * Provides auto-discovery and loading of CLI templates from
 * ~/.claude/workflows/cli-templates/
 *
 * Features:
 * - Scan prompts/ directory (flat structure with category-function.txt naming)
 * - Match template names (e.g., "analysis-review-architecture" or just "review-architecture")
 * - Load protocol files based on mode (analysis/write)
 * - Cache template content for performance
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';
import { homedir } from 'os';

// ============================================================================
// Types
// ============================================================================

export interface TemplateMeta {
  name: string;           // Full filename without extension (e.g., "analysis-review-architecture")
  path: string;           // Full absolute path
  category: string;       // Category from filename (e.g., "analysis")
  shortName: string;      // Name without category prefix (e.g., "review-architecture")
}

export interface TemplateIndex {
  templates: Map<string, TemplateMeta>;  // name -> meta (full name match)
  byShortName: Map<string, TemplateMeta>; // shortName -> meta (for fuzzy match)
  categories: Map<string, string[]>;     // category -> template names
  lastScan: number;
}

// ============================================================================
// Constants
// ============================================================================

const TEMPLATES_BASE_DIR = join(homedir(), '.claude', 'workflows', 'cli-templates');
const PROMPTS_DIR = join(TEMPLATES_BASE_DIR, 'prompts');
const PROTOCOLS_DIR = join(TEMPLATES_BASE_DIR, 'protocols');

const PROTOCOL_FILES: Record<string, string> = {
  analysis: 'analysis-protocol.md',
  write: 'write-protocol.md',
};

// Cache
let templateIndex: TemplateIndex | null = null;
const contentCache: Map<string, string> = new Map();

// ============================================================================
// Public API
// ============================================================================

/**
 * Get the base templates directory path
 */
export function getTemplatesDir(): string {
  return TEMPLATES_BASE_DIR;
}

/**
 * Get the prompts directory path
 */
export function getPromptsDir(): string {
  return PROMPTS_DIR;
}

/**
 * Get the protocols directory path
 */
export function getProtocolsDir(): string {
  return PROTOCOLS_DIR;
}

/**
 * Scan templates directory and build index
 * Flat structure: prompts/category-function.txt
 * Results are cached for performance
 */
export function scanTemplates(forceRescan = false): TemplateIndex {
  if (templateIndex && !forceRescan) {
    return templateIndex;
  }

  const templates = new Map<string, TemplateMeta>();
  const byShortName = new Map<string, TemplateMeta>();
  const categories = new Map<string, string[]>();

  if (!existsSync(PROMPTS_DIR)) {
    console.warn(`[template-discovery] Prompts directory not found: ${PROMPTS_DIR}`);
    templateIndex = { templates, byShortName, categories, lastScan: Date.now() };
    return templateIndex;
  }

  // Scan all files directly in prompts/ (flat structure)
  const files = readdirSync(PROMPTS_DIR).filter(file => {
    const ext = extname(file).toLowerCase();
    return ext === '.txt' || ext === '.md';
  });

  for (const file of files) {
    const name = basename(file, extname(file));  // e.g., "analysis-review-architecture"
    const fullPath = join(PROMPTS_DIR, file);

    // Extract category from filename (first segment before -)
    const dashIndex = name.indexOf('-');
    const category = dashIndex > 0 ? name.substring(0, dashIndex) : 'other';
    const shortName = dashIndex > 0 ? name.substring(dashIndex + 1) : name;

    const meta: TemplateMeta = {
      name,
      path: fullPath,
      category,
      shortName,
    };

    // Index by full name
    templates.set(name, meta);

    // Index by short name (for fuzzy match)
    // If duplicate shortName exists, prefer keeping first one
    if (!byShortName.has(shortName)) {
      byShortName.set(shortName, meta);
    }

    // Group by category
    if (!categories.has(category)) {
      categories.set(category, []);
    }
    categories.get(category)!.push(name);
  }

  templateIndex = { templates, byShortName, categories, lastScan: Date.now() };
  return templateIndex;
}

/**
 * Find a template by name
 *
 * @param nameOrShort - Full template name (e.g., "analysis-review-architecture")
 *                      or short name (e.g., "review-architecture")
 * @returns Full path to template file, or null if not found
 */
export function findTemplate(nameOrShort: string): string | null {
  const index = scanTemplates();

  // Try exact full name match first
  if (index.templates.has(nameOrShort)) {
    return index.templates.get(nameOrShort)!.path;
  }

  // Try with .txt extension removed
  const nameWithoutExt = nameOrShort.replace(/\.(txt|md)$/i, '');
  if (index.templates.has(nameWithoutExt)) {
    return index.templates.get(nameWithoutExt)!.path;
  }

  // Try short name match (without category prefix)
  if (index.byShortName.has(nameOrShort)) {
    return index.byShortName.get(nameOrShort)!.path;
  }

  // Try short name without extension
  if (index.byShortName.has(nameWithoutExt)) {
    return index.byShortName.get(nameWithoutExt)!.path;
  }

  return null;
}

/**
 * Load protocol content based on mode
 *
 * @param mode - Execution mode: "analysis" or "write"
 * @returns Protocol file content, or empty string if not found
 */
export function loadProtocol(mode: string): string {
  const protocolFile = PROTOCOL_FILES[mode];
  if (!protocolFile) {
    console.warn(`[template-discovery] No protocol defined for mode: ${mode}`);
    return '';
  }

  const protocolPath = join(PROTOCOLS_DIR, protocolFile);

  // Check cache
  if (contentCache.has(protocolPath)) {
    return contentCache.get(protocolPath)!;
  }

  if (!existsSync(protocolPath)) {
    console.warn(`[template-discovery] Protocol file not found: ${protocolPath}`);
    return '';
  }

  try {
    const content = readFileSync(protocolPath, 'utf8');
    contentCache.set(protocolPath, content);
    return content;
  } catch (error) {
    console.error(`[template-discovery] Failed to read protocol: ${protocolPath}`, error);
    return '';
  }
}

/**
 * Load template content by name or path
 *
 * @param nameOrPath - Template name or relative path
 * @returns Template file content
 * @throws Error if template not found
 */
export function loadTemplate(nameOrPath: string): string {
  const templatePath = findTemplate(nameOrPath);

  if (!templatePath) {
    // List available templates for helpful error message
    const index = scanTemplates();
    const available = Array.from(index.templates.keys()).slice(0, 10).join(', ');
    throw new Error(
      `Template not found: "${nameOrPath}"\n` +
      `Available templates (first 10): ${available}...\n` +
      `Use 'ccw cli templates' to list all available templates.`
    );
  }

  // Check cache
  if (contentCache.has(templatePath)) {
    return contentCache.get(templatePath)!;
  }

  try {
    const content = readFileSync(templatePath, 'utf8');
    contentCache.set(templatePath, content);
    return content;
  } catch (error) {
    throw new Error(`Failed to read template: ${templatePath}: ${error}`);
  }
}

/**
 * Build rules content from protocol and template
 *
 * @param mode - Execution mode for protocol selection
 * @param templateName - Template name or path (optional)
 * @param includeProtocol - Whether to include protocol (default: true)
 * @returns Combined rules content
 */
export function buildRulesContent(
  mode: string,
  templateName?: string,
  includeProtocol = true
): string {
  const parts: string[] = [];

  // Load protocol if requested
  if (includeProtocol) {
    const protocol = loadProtocol(mode);
    if (protocol) {
      parts.push(protocol);
    }
  }

  // Load template if specified
  if (templateName) {
    const template = loadTemplate(templateName);
    if (template) {
      parts.push(template);
    }
  }

  return parts.join('\n\n');
}

/**
 * List all available templates
 *
 * @returns Object with categories and their templates
 */
export function listTemplates(): Record<string, TemplateMeta[]> {
  const index = scanTemplates();
  const result: Record<string, TemplateMeta[]> = {};

  for (const [category, names] of index.categories) {
    result[category] = names.map(name => {
      const meta = index.templates.get(name);
      return meta || { name, path: '', category, shortName: '' };
    });
  }

  return result;
}

/**
 * Clear template cache (useful for testing or after template updates)
 */
export function clearCache(): void {
  templateIndex = null;
  contentCache.clear();
}
