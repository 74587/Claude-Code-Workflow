/**
 * Generate DDD Docs Tool
 * Generate DDD documentation from doc-index.json with deterministic output paths.
 * Supports 5 strategies: component (L3), feature (L2), index, overview, schema
 */

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';
import { existsSync, readFileSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { getSecondaryModel } from './cli-config-manager.js';

// Default doc-index path relative to project root
const DEFAULT_DOC_INDEX_PATH = '.workflow/.doc-index/doc-index.json';

// Define Zod schema for validation
const ParamsSchema = z.object({
  strategy: z.enum(['component', 'feature', 'index', 'overview', 'schema']),
  entityId: z.string().optional(),
  docIndexPath: z.string().default(DEFAULT_DOC_INDEX_PATH),
  tool: z.enum(['gemini', 'qwen', 'codex']).default('gemini'),
  model: z.string().optional(),
});

type Params = z.infer<typeof ParamsSchema>;

interface ToolOutput {
  success: boolean;
  strategy: string;
  entity_id?: string;
  output_path: string;
  tool: string;
  model?: string;
  duration_seconds?: number;
  message?: string;
  error?: string;
}

// --- doc-index.json type definitions ---

interface CodeLocation {
  path: string;
  symbols?: string[];
  lineRange?: [number, number];
}

interface TechnicalComponent {
  id: string;
  name: string;
  type: string;
  responsibility?: string;
  adrId?: string | null;
  docPath?: string;
  codeLocations?: CodeLocation[];
  dependsOn?: string[];
  featureIds?: string[];
  actionIds?: string[];
}

interface Feature {
  id: string;
  name: string;
  epicId?: string | null;
  status?: string;
  docPath?: string;
  requirementIds?: string[];
  techComponentIds?: string[];
  tags?: string[];
}

interface DocIndex {
  version?: string;
  schema_version?: string;
  project?: string;
  build_path?: string;
  last_updated?: string;
  features?: Feature[];
  technicalComponents?: TechnicalComponent[];
  requirements?: Array<{ id: string; title?: string; priority?: string }>;
  architectureDecisions?: Array<{ id: string; title?: string; componentIds?: string[] }>;
  actions?: Array<{ id: string; description?: string; type?: string; timestamp?: string; affectedComponents?: string[]; affectedFeatures?: string[] }>;
  glossary?: Array<{ id: string; term: string; definition?: string }>;
  [key: string]: unknown;
}

// --- Core functions ---

/**
 * Load and parse doc-index.json
 */
function loadDocIndex(indexPath: string): DocIndex {
  const absPath = resolve(process.cwd(), indexPath);
  if (!existsSync(absPath)) {
    throw new Error(`doc-index.json not found at: ${absPath}. Run /ddd:scan or /ddd:index-build first.`);
  }
  const raw = readFileSync(absPath, 'utf8');
  return JSON.parse(raw) as DocIndex;
}

/**
 * Calculate deterministic output path based on strategy and entityId.
 * All paths are relative to the doc-index directory.
 */
function calculateDddOutputPath(
  strategy: string,
  entityId: string | undefined,
  docIndexDir: string
): string {
  switch (strategy) {
    case 'component': {
      if (!entityId) throw new Error('entityId is required for component strategy');
      // tech-{slug} -> {slug}.md
      const slug = entityId.replace(/^tech-/, '');
      return join(docIndexDir, 'tech-registry', `${slug}.md`);
    }
    case 'feature': {
      if (!entityId) throw new Error('entityId is required for feature strategy');
      // feat-{slug} -> {slug}.md
      const slug = entityId.replace(/^feat-/, '');
      return join(docIndexDir, 'feature-maps', `${slug}.md`);
    }
    case 'index':
      // Generate _index.md files - entityId determines which subdirectory
      if (entityId) {
        return join(docIndexDir, entityId, '_index.md');
      }
      // Default: generate all index files (return the doc-index dir itself)
      return docIndexDir;
    case 'overview':
      if (entityId === 'architecture') {
        return join(docIndexDir, 'ARCHITECTURE.md');
      }
      return join(docIndexDir, 'README.md');
    case 'schema':
      return join(docIndexDir, 'SCHEMA.md');
    default:
      throw new Error(`Unknown strategy: ${strategy}`);
  }
}

/**
 * Build YAML frontmatter string from entity metadata
 */
function buildFrontmatter(
  strategy: string,
  entity: TechnicalComponent | Feature | null,
  docIndex: DocIndex
): string {
  const now = new Date().toISOString();

  switch (strategy) {
    case 'component': {
      const comp = entity as TechnicalComponent;
      if (!comp) return '';
      const featureIds = comp.featureIds || [];
      const codeLocations = (comp.codeLocations || []).map(loc => {
        const symbolsStr = loc.symbols && loc.symbols.length > 0
          ? `\n    symbols: [${loc.symbols.join(', ')}]`
          : '';
        return `  - path: ${loc.path}${symbolsStr}`;
      }).join('\n');

      return [
        '---',
        'layer: 3',
        `component_id: ${comp.id}`,
        `name: ${comp.name}`,
        `type: ${comp.type || 'unknown'}`,
        `features: [${featureIds.join(', ')}]`,
        codeLocations ? `code_locations:\n${codeLocations}` : 'code_locations: []',
        `generated_at: ${now}`,
        '---',
      ].join('\n');
    }

    case 'feature': {
      const feat = entity as Feature;
      if (!feat) return '';
      const reqIds = feat.requirementIds || [];
      const techIds = feat.techComponentIds || [];
      const tags = feat.tags || [];

      return [
        '---',
        'layer: 2',
        `feature_id: ${feat.id}`,
        `name: ${feat.name}`,
        `epic_id: ${feat.epicId || 'null'}`,
        `status: ${feat.status || 'planned'}`,
        `requirements: [${reqIds.join(', ')}]`,
        `components: [${techIds.join(', ')}]`,
        `depends_on_layer3: [${techIds.join(', ')}]`,
        `tags: [${tags.join(', ')}]`,
        `generated_at: ${now}`,
        '---',
      ].join('\n');
    }

    case 'index':
    case 'overview': {
      const featureIds = (docIndex.features || []).map(f => f.id);
      return [
        '---',
        'layer: 1',
        `depends_on_layer2: [${featureIds.join(', ')}]`,
        `generated_at: ${now}`,
        '---',
      ].join('\n');
    }

    case 'schema':
      return [
        '---',
        `schema_version: ${docIndex.schema_version || docIndex.version || '1.0'}`,
        `generated_at: ${now}`,
        '---',
      ].join('\n');

    default:
      return '';
  }
}

/**
 * Build CLI prompt combining frontmatter, content instructions, and code context
 */
function buildDddPrompt(
  strategy: string,
  entity: TechnicalComponent | Feature | null,
  frontmatter: string,
  docIndex: DocIndex,
  outputPath: string
): string {
  const absOutputPath = resolve(process.cwd(), outputPath);

  switch (strategy) {
    case 'component': {
      const comp = entity as TechnicalComponent;
      const contextPaths = (comp.codeLocations || []).map(loc => `@${loc.path}`).join(' ');
      // Build change history from actions
      const compActions = (docIndex.actions || [])
        .filter(a => (a.affectedComponents || []).includes(comp.id))
        .map(a => `- ${a.timestamp?.split('T')[0] || 'unknown'} | ${a.type || 'change'} | ${a.description || a.id}`)
        .join('\n');
      const changeHistoryBlock = compActions
        ? `\n\nChange History (include as "## Change History" section):\n${compActions}`
        : '';
      return `PURPOSE: Generate component documentation for ${comp.name}
TASK:
- Document component purpose and responsibility
- List exported symbols (classes, functions, types)
- Document dependencies (internal and external)
- Include code examples for key APIs
- Document integration points with other components
- Include change history timeline
MODE: write
CONTEXT: ${contextPaths || '@**/*'}
EXPECTED: Markdown file with: Overview, API Reference, Dependencies, Usage Examples, Change History
CONSTRAINTS: Focus on public API | Include type signatures

OUTPUT FILE: ${absOutputPath}

The file MUST start with this exact frontmatter:

${frontmatter}

Sections to include after frontmatter:
- Responsibility
- Code Locations
- Related Requirements
- Architecture Decisions
- Dependencies (in/out)
- Change History${changeHistoryBlock}`;
    }

    case 'feature': {
      const feat = entity as Feature;
      const techIds = feat.techComponentIds || [];
      const componentDocs = techIds
        .map(id => {
          const slug = id.replace(/^tech-/, '');
          return `@.workflow/.doc-index/tech-registry/${slug}.md`;
        })
        .join(' ');
      // Build change history from actions
      const featActions = (docIndex.actions || [])
        .filter(a => (a.affectedFeatures || []).includes(feat.id))
        .map(a => `- ${a.timestamp?.split('T')[0] || 'unknown'} | ${a.type || 'change'} | ${a.description || a.id}`)
        .join('\n');
      const featChangeHistoryBlock = featActions
        ? `\n\nChange History (include as "## Change History" section):\n${featActions}`
        : '';
      return `PURPOSE: Generate feature documentation for ${feat.name}
TASK:
- Describe feature purpose and business value
- List requirements (from requirementIds)
- Document components involved (from techComponentIds)
- Include architecture decisions (from adrIds)
- Provide integration guide
- Include change history timeline
MODE: write
CONTEXT: ${componentDocs || '@.workflow/.doc-index/tech-registry/*.md'}
EXPECTED: Markdown file with: Overview, Requirements, Components, Architecture, Integration, Change History
CONSTRAINTS: Reference Layer 3 component docs | Business-focused language

OUTPUT FILE: ${absOutputPath}

The file MUST start with this exact frontmatter:

${frontmatter}

Sections to include after frontmatter:
- Overview
- Requirements (with mapping status)
- Technical Components
- Architecture Decisions
- Change History${featChangeHistoryBlock}`;
    }

    case 'index': {
      const docIndexDir = dirname(resolve(process.cwd(), outputPath));
      const parentDir = dirname(docIndexDir);
      return `PURPOSE: Generate index document for ${docIndexDir}
TASK:
- List all entries in this directory with brief descriptions
- Create a navigable catalog with links to each document
- Include status/type columns where applicable
MODE: write
CONTEXT: @${parentDir}/doc-index.json
EXPECTED: Markdown index file with: table of entries, descriptions, links
CONSTRAINTS: Catalog format | Link to sibling documents

OUTPUT FILE: ${absOutputPath}

The file MUST start with this exact frontmatter:

${frontmatter}`;
    }

    case 'overview': {
      const isArchitecture = outputPath.endsWith('ARCHITECTURE.md');
      if (isArchitecture) {
        return `PURPOSE: Generate architecture overview document
TASK:
- System design overview
- Component relationships and dependencies
- Key architecture decisions (from ADRs)
- Technology stack
MODE: write
CONTEXT: @.workflow/.doc-index/doc-index.json @.workflow/.doc-index/tech-registry/*.md
EXPECTED: ARCHITECTURE.md with: System Design, Component Diagram, ADRs, Tech Stack
CONSTRAINTS: Architecture-focused | Reference component docs for details

OUTPUT FILE: ${absOutputPath}

The file MUST start with this exact frontmatter:

${frontmatter}`;
      }
      return `PURPOSE: Generate project README with overview and navigation
TASK:
- Project summary and purpose
- Quick start guide
- Navigation to features, components, and architecture
- Link to doc-index.json
MODE: write
CONTEXT: @.workflow/.doc-index/doc-index.json @.workflow/.doc-index/feature-maps/_index.md
EXPECTED: README.md with: Overview, Quick Start, Navigation, Links
CONSTRAINTS: High-level only | Entry point for new developers

OUTPUT FILE: ${absOutputPath}

The file MUST start with this exact frontmatter:

${frontmatter}`;
    }

    case 'schema': {
      return `PURPOSE: Document doc-index.json schema structure and versioning
TASK:
- Document current schema structure (all fields)
- Define versioning policy (semver: major.minor)
- Document migration protocol for version upgrades
- Provide examples for each schema section
MODE: write
CONTEXT: @.workflow/.doc-index/doc-index.json
EXPECTED: SCHEMA.md with: Schema Structure, Versioning Policy, Migration Protocol, Examples
CONSTRAINTS: Complete field documentation | Clear migration steps

OUTPUT FILE: ${absOutputPath}

The file MUST start with this exact frontmatter:

${frontmatter}`;
    }

    default:
      throw new Error(`Unknown strategy: ${strategy}`);
  }
}

/**
 * Create temporary prompt file and return path
 */
function createPromptFile(prompt: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const promptFile = join(tmpdir(), `ddd-docs-prompt-${timestamp}-${randomSuffix}.txt`);
  writeFileSync(promptFile, prompt, 'utf8');
  return promptFile;
}

/**
 * Build CLI command using stdin piping
 */
function buildCliCommand(tool: string, promptFile: string, model: string): string {
  const normalizedPath = promptFile.replace(/\\/g, '/');
  const isWindows = process.platform === 'win32';

  const catCmd = isWindows ? `Get-Content -Raw "${normalizedPath}" | ` : `cat "${normalizedPath}" | `;
  const modelFlag = model ? ` -m "${model}"` : '';

  switch (tool) {
    case 'qwen':
      return `${catCmd}qwen${modelFlag} --yolo`;
    case 'codex':
      if (isWindows) {
        return `codex --full-auto exec (Get-Content -Raw "${normalizedPath}")${modelFlag} --skip-git-repo-check -s danger-full-access`;
      }
      return `codex --full-auto exec "$(cat "${normalizedPath}")"${modelFlag} --skip-git-repo-check -s danger-full-access`;
    case 'gemini':
    default:
      return `${catCmd}gemini${modelFlag} --yolo`;
  }
}

/**
 * Resolve entity from doc-index based on strategy and entityId
 */
function resolveEntity(
  strategy: string,
  entityId: string | undefined,
  docIndex: DocIndex
): TechnicalComponent | Feature | null {
  if (strategy === 'component') {
    if (!entityId) throw new Error('entityId is required for component strategy');
    const comp = (docIndex.technicalComponents || []).find(c => c.id === entityId);
    if (!comp) throw new Error(`Component not found in doc-index: ${entityId}`);
    return comp;
  }

  if (strategy === 'feature') {
    if (!entityId) throw new Error('entityId is required for feature strategy');
    const feat = (docIndex.features || []).find(f => f.id === entityId);
    if (!feat) throw new Error(`Feature not found in doc-index: ${entityId}`);
    return feat;
  }

  // index, overview, schema do not require a specific entity
  return null;
}

/**
 * For the index strategy, generate _index.md for multiple directories
 */
function getIndexTargets(entityId: string | undefined): string[] {
  if (entityId) {
    return [entityId];
  }
  // Default: all standard subdirectories
  return ['feature-maps', 'tech-registry', 'action-logs', 'planning'];
}

// Tool schema for MCP
export const schema: ToolSchema = {
  name: 'generate_ddd_docs',
  description: `Generate DDD documentation from doc-index.json with deterministic output paths.

Strategies:
- component: Layer 3 technical component doc (tech-registry/{slug}.md)
- feature: Layer 2 feature map doc (feature-maps/{slug}.md)
- index: Layer 1 _index.md catalog files for subdirectories
- overview: Layer 1 README.md or ARCHITECTURE.md
- schema: SCHEMA.md documenting doc-index.json structure

Requires doc-index.json from /ddd:scan or /ddd:index-build.
Output: .workflow/.doc-index/...`,
  inputSchema: {
    type: 'object',
    properties: {
      strategy: {
        type: 'string',
        enum: ['component', 'feature', 'index', 'overview', 'schema'],
        description: 'Document generation strategy: component (L3), feature (L2), index, overview, schema (L1)'
      },
      entityId: {
        type: 'string',
        description: 'Entity ID from doc-index.json (required for component/feature, optional for index/overview). For overview: "architecture" to generate ARCHITECTURE.md, omit for README.md. For index: subdirectory name or omit for all.'
      },
      docIndexPath: {
        type: 'string',
        description: 'Path to doc-index.json (default: .workflow/.doc-index/doc-index.json)',
        default: '.workflow/.doc-index/doc-index.json'
      },
      tool: {
        type: 'string',
        enum: ['gemini', 'qwen', 'codex'],
        description: 'CLI tool to use (default: gemini)',
        default: 'gemini'
      },
      model: {
        type: 'string',
        description: 'Model name (optional, uses tool defaults)'
      }
    },
    required: ['strategy']
  }
};

// Handler function
export async function handler(params: Record<string, unknown>): Promise<ToolResult<ToolOutput>> {
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return { success: false, error: `Invalid params: ${parsed.error.message}` };
  }

  const { strategy, entityId, docIndexPath, tool, model } = parsed.data;

  try {
    // Load doc-index.json
    const docIndex = loadDocIndex(docIndexPath);
    const docIndexDir = dirname(resolve(process.cwd(), docIndexPath));

    // Resolve model
    let actualModel = model || '';
    if (!actualModel) {
      try {
        actualModel = getSecondaryModel(process.cwd(), tool);
      } catch {
        actualModel = '';
      }
    }

    // Handle index strategy separately (may generate multiple files)
    if (strategy === 'index') {
      const targets = getIndexTargets(entityId);
      const results: string[] = [];

      for (const target of targets) {
        const outputPath = join(docIndexDir, target, '_index.md');
        const absOutputDir = dirname(resolve(process.cwd(), outputPath));

        // Ensure directory exists
        mkdirSync(absOutputDir, { recursive: true });

        const frontmatter = buildFrontmatter('index', null, docIndex);
        const prompt = buildDddPrompt('index', null, frontmatter, docIndex, outputPath);
        const promptFile = createPromptFile(prompt);
        const command = buildCliCommand(tool, promptFile, actualModel);

        console.log(`[DDD] Generating index: ${target}/_index.md`);

        try {
          const startTime = Date.now();
          execSync(command, {
            cwd: docIndexDir,
            encoding: 'utf8',
            stdio: 'inherit',
            timeout: 600000,
            shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
          });
          const duration = Math.round((Date.now() - startTime) / 1000);
          results.push(`${target}/_index.md (${duration}s)`);
        } finally {
          try { unlinkSync(promptFile); } catch { /* ignore */ }
        }
      }

      return {
        success: true,
        result: {
          success: true,
          strategy,
          entity_id: entityId,
          output_path: docIndexDir,
          tool,
          model: actualModel,
          message: `Generated index files: ${results.join(', ')}`
        }
      };
    }

    // Single-file strategies: component, feature, overview, schema
    const entity = resolveEntity(strategy, entityId, docIndex);
    const outputPath = calculateDddOutputPath(strategy, entityId, docIndexDir);
    const absOutputDir = dirname(resolve(process.cwd(), outputPath));

    // Ensure output directory exists
    mkdirSync(absOutputDir, { recursive: true });

    // Build frontmatter and prompt
    const frontmatter = buildFrontmatter(strategy, entity, docIndex);
    const prompt = buildDddPrompt(strategy, entity, frontmatter, docIndex, outputPath);

    // Create temp prompt file
    const promptFile = createPromptFile(prompt);

    // Build CLI command
    const command = buildCliCommand(tool, promptFile, actualModel);

    console.log(`[DDD] Generating ${strategy}: ${outputPath}`);
    console.log(`[DDD] Tool: ${tool} | Model: ${actualModel || 'default'}`);

    try {
      const startTime = Date.now();

      execSync(command, {
        cwd: docIndexDir,
        encoding: 'utf8',
        stdio: 'inherit',
        timeout: 600000,
        shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
      });

      const duration = Math.round((Date.now() - startTime) / 1000);

      // Cleanup
      try { unlinkSync(promptFile); } catch { /* ignore */ }

      console.log(`[DDD] Completed in ${duration}s: ${outputPath}`);

      return {
        success: true,
        result: {
          success: true,
          strategy,
          entity_id: entityId,
          output_path: outputPath,
          tool,
          model: actualModel,
          duration_seconds: duration,
          message: `Documentation generated successfully in ${duration}s`
        }
      };
    } catch (error) {
      // Cleanup on error
      try { unlinkSync(promptFile); } catch { /* ignore */ }

      // Tool fallback: gemini -> qwen -> codex
      const fallbackChain = ['gemini', 'qwen', 'codex'];
      const currentIdx = fallbackChain.indexOf(tool);
      if (currentIdx >= 0 && currentIdx < fallbackChain.length - 1) {
        const nextTool = fallbackChain[currentIdx + 1];
        console.log(`[DDD] ${tool} failed, falling back to ${nextTool}`);
        return handler({ ...params, tool: nextTool });
      }

      return {
        success: false,
        error: `Documentation generation failed: ${(error as Error).message}`
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Tool execution failed: ${(error as Error).message}`
    };
  }
}
