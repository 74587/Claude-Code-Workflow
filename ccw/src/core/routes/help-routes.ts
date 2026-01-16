/**
 * Help Routes Module
 * Handles all Help-related API endpoints for command guide and CodexLens docs
 */
import { readFileSync, existsSync, watch } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { RouteContext } from './types.js';

/**
 * Get the ccw-help command.json file path (pure function)
 * Priority: project path (.claude/skills/ccw-help/command.json) > user path (~/.claude/skills/ccw-help/command.json)
 * @param projectPath - The project path to check first
 */
function getCommandFilePath(projectPath: string | null): string | null {
  // Try project path first
  if (projectPath) {
    const projectFilePath = join(projectPath, '.claude', 'skills', 'ccw-help', 'command.json');
    if (existsSync(projectFilePath)) {
      return projectFilePath;
    }
  }

  // Fall back to user path
  const userFilePath = join(homedir(), '.claude', 'skills', 'ccw-help', 'command.json');
  if (existsSync(userFilePath)) {
    return userFilePath;
  }

  return null;
}

// ========== In-Memory Cache ==========
interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 300000; // 5 minutes

/**
 * Get cached data or load from file
 */
function getCachedData(key: string, filePath: string): any {
  const now = Date.now();
  const cached = cache.get(key);

  // Return cached data if valid
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  // Load fresh data
  try {
    if (!existsSync(filePath)) {
      console.error(`Help data file not found: ${filePath}`);
      return null;
    }

    const content = readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);

    // Update cache
    cache.set(key, { data, timestamp: now });

    return data;
  } catch (error) {
    console.error(`Failed to load help data from ${filePath}:`, error);
    return null;
  }
}

/**
 * Invalidate cache for a specific key
 */
function invalidateCache(key: string): void {
  cache.delete(key);
  console.log(`Cache invalidated: ${key}`);
}

// ========== File Watchers ==========
let watchersInitialized = false;

/**
 * Initialize file watcher for command.json
 * @param projectPath - The project path to resolve command file
 */
function initializeFileWatchers(projectPath: string | null): void {
  if (watchersInitialized) return;

  const commandFilePath = getCommandFilePath(projectPath);

  if (!commandFilePath) {
    console.warn(`ccw-help command.json not found in project or user paths`);
    return;
  }

  try {
    // Watch the command.json file
    const watcher = watch(commandFilePath, (eventType) => {
      console.log(`File change detected: command.json (${eventType})`);

      // Invalidate all cache entries when command.json changes
      invalidateCache('command-data');
    });

    watchersInitialized = true;
    (watcher as any).unref?.();
    console.log(`File watcher initialized for: ${commandFilePath}`);
  } catch (error) {
    console.error('Failed to initialize file watcher:', error);
  }
}

// ========== Helper Functions ==========

/**
 * Get command data from command.json (with caching)
 */
function getCommandData(projectPath: string | null): any {
  const filePath = getCommandFilePath(projectPath);
  if (!filePath) return null;

  return getCachedData('command-data', filePath);
}

/**
 * Filter commands by search query
 */
function filterCommands(commands: any[], query: string): any[] {
  if (!query) return commands;

  const lowerQuery = query.toLowerCase();
  return commands.filter(cmd =>
    cmd.name?.toLowerCase().includes(lowerQuery) ||
    cmd.command?.toLowerCase().includes(lowerQuery) ||
    cmd.description?.toLowerCase().includes(lowerQuery) ||
    cmd.category?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Category merge mapping for frontend compatibility
 * Merges additional categories into target category for display
 * Format: { targetCategory: [additionalCategoriesToMerge] }
 */
const CATEGORY_MERGES: Record<string, string[]> = {
  'cli': ['general'],  // CLI tab shows both 'cli' and 'general' commands
};

/**
 * Group commands by category with subcategories
 */
function groupCommandsByCategory(commands: any[]): any {
  const grouped: any = {};

  for (const cmd of commands) {
    const category = cmd.category || 'general';
    const subcategory = cmd.subcategory || null;

    if (!grouped[category]) {
      grouped[category] = {
        name: category,
        commands: [],
        subcategories: {}
      };
    }

    if (subcategory) {
      if (!grouped[category].subcategories[subcategory]) {
        grouped[category].subcategories[subcategory] = [];
      }
      grouped[category].subcategories[subcategory].push(cmd);
    } else {
      grouped[category].commands.push(cmd);
    }
  }

  // Apply category merges for frontend compatibility
  for (const [target, sources] of Object.entries(CATEGORY_MERGES)) {
    // Initialize target category if not exists
    if (!grouped[target]) {
      grouped[target] = {
        name: target,
        commands: [],
        subcategories: {}
      };
    }

    // Merge commands from source categories into target
    for (const source of sources) {
      if (grouped[source]) {
        // Merge direct commands
        grouped[target].commands = [
          ...grouped[target].commands,
          ...grouped[source].commands
        ];
        // Merge subcategories
        for (const [subcat, cmds] of Object.entries(grouped[source].subcategories)) {
          if (!grouped[target].subcategories[subcat]) {
            grouped[target].subcategories[subcat] = [];
          }
          grouped[target].subcategories[subcat] = [
            ...grouped[target].subcategories[subcat],
            ...(cmds as any[])
          ];
        }
      }
    }
  }

  return grouped;
}

/**
 * Build workflow relationships from command flow data
 */
function buildWorkflowRelationships(commands: any[]): any {
  const relationships: any = {
    workflows: [],
    dependencies: {},
    alternatives: {}
  };

  for (const cmd of commands) {
    if (!cmd.flow) continue;

    const cmdName = cmd.command;

    // Build next_steps relationships
    if (cmd.flow.next_steps) {
      if (!relationships.dependencies[cmdName]) {
        relationships.dependencies[cmdName] = { next: [], prev: [] };
      }
      relationships.dependencies[cmdName].next = cmd.flow.next_steps;

      // Add reverse relationship
      for (const nextCmd of cmd.flow.next_steps) {
        if (!relationships.dependencies[nextCmd]) {
          relationships.dependencies[nextCmd] = { next: [], prev: [] };
        }
        if (!relationships.dependencies[nextCmd].prev.includes(cmdName)) {
          relationships.dependencies[nextCmd].prev.push(cmdName);
        }
      }
    }

    // Build prerequisites relationships
    if (cmd.flow.prerequisites) {
      if (!relationships.dependencies[cmdName]) {
        relationships.dependencies[cmdName] = { next: [], prev: [] };
      }
      relationships.dependencies[cmdName].prev = [
        ...new Set([...relationships.dependencies[cmdName].prev, ...cmd.flow.prerequisites])
      ];
    }

    // Build alternatives
    if (cmd.flow.alternatives) {
      relationships.alternatives[cmdName] = cmd.flow.alternatives;
    }

    // Add to workflows list
    if (cmd.category === 'workflow') {
      relationships.workflows.push({
        name: cmd.name,
        command: cmd.command,
        description: cmd.description,
        flow: cmd.flow
      });
    }
  }

  return relationships;
}

// ========== API Routes ==========

/**
 * Handle Help routes
 * @returns true if route was handled, false otherwise
 */
export async function handleHelpRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, url, req, res, initialPath } = ctx;

  // Initialize file watchers on first request
  initializeFileWatchers(initialPath);

  // API: Get all commands with optional search
  if (pathname === '/api/help/commands') {
    const commandData = getCommandData(initialPath);
    if (!commandData) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'ccw-help command.json not found' }));
      return true;
    }

    const searchQuery = url.searchParams.get('q') || '';
    let commands = commandData.commands || [];

    // Filter by search query if provided
    if (searchQuery) {
      commands = filterCommands(commands, searchQuery);
    }

    // Group by category
    const grouped = groupCommandsByCategory(commands);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      commands: commands,
      grouped: grouped,
      total: commands.length,
      essential: commandData.essential_commands || [],
      metadata: commandData._metadata
    }));
    return true;
  }

  // API: Get workflow command relationships
  if (pathname === '/api/help/workflows') {
    const commandData = getCommandData(initialPath);
    if (!commandData) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'ccw-help command.json not found' }));
      return true;
    }

    const commands = commandData.commands || [];
    const relationships = buildWorkflowRelationships(commands);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(relationships));
    return true;
  }

  // API: Get commands by category
  if (pathname === '/api/help/commands/by-category') {
    const commandData = getCommandData(initialPath);
    if (!commandData) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'ccw-help command.json not found' }));
      return true;
    }

    const commands = commandData.commands || [];
    const byCategory = groupCommandsByCategory(commands);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      categories: commandData.categories || [],
      grouped: byCategory
    }));
    return true;
  }

  // API: Get agents list
  if (pathname === '/api/help/agents') {
    const commandData = getCommandData(initialPath);
    if (!commandData) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'ccw-help command.json not found' }));
      return true;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      agents: commandData.agents || [],
      total: (commandData.agents || []).length
    }));
    return true;
  }

  // API: Get CodexLens documentation metadata
  if (pathname === '/api/help/codexlens') {
    // Return CodexLens quick-start guide data
    const codexLensData = {
      title: 'CodexLens Quick Start',
      description: 'Fast code indexing and semantic search for large codebases',
      sections: [
        {
          title: 'Key Concepts',
          items: [
            {
              name: 'Indexing',
              description: 'CodexLens builds a semantic index of your codebase for fast retrieval',
              command: 'codex_lens(action="init", path=".")'
            },
            {
              name: 'Search Modes',
              description: 'Text search for exact matches, semantic search for concept-based queries',
              command: 'codex_lens(action="search", query="authentication logic", mode="semantic")'
            },
            {
              name: 'Symbol Navigation',
              description: 'Extract and navigate code symbols (functions, classes, interfaces)',
              command: 'codex_lens(action="symbol", file="path/to/file.py")'
            }
          ]
        },
        {
          title: 'Common Commands',
          items: [
            {
              name: 'Initialize Index',
              command: 'codex_lens(action="init", path=".")',
              description: 'Index the current directory'
            },
            {
              name: 'Text Search',
              command: 'codex_lens(action="search", query="function name", path=".")',
              description: 'Search for exact text matches'
            },
            {
              name: 'Semantic Search',
              command: 'codex_lens(action="search", query="user authentication", mode="semantic")',
              description: 'Search by concept or meaning'
            },
            {
              name: 'Check Status',
              command: 'codex_lens(action="status")',
              description: 'View indexing status for all projects'
            }
          ]
        },
        {
          title: 'Best Practices',
          items: [
            { description: 'Index large codebases (>500 files) for optimal performance' },
            { description: 'Use semantic search for exploratory tasks' },
            { description: 'Combine with smart_search for medium-sized projects' },
            { description: 'Re-index after major code changes'  }
          ]
        }
      ],
      links: [
        { text: 'Full Documentation', url: 'https://github.com/yourusername/codex-lens' },
        { text: 'Tool Selection Guide', url: '/.claude/rules/tool-selection.md' }
      ]
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(codexLensData));
    return true;
  }

  return false;
}
