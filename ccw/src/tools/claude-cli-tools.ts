/**
 * Claude CLI Tools Configuration Manager
 * Manages .claude/cli-tools.json with fallback:
 * 1. Project workspace: {projectDir}/.claude/cli-tools.json (priority)
 * 2. Global: ~/.claude/cli-tools.json (fallback)
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ========== Types ==========

export interface ClaudeCliTool {
  enabled: boolean;
  isBuiltin: boolean;
  command: string;
  description: string;
}

export interface ClaudeCacheSettings {
  injectionMode: 'auto' | 'manual' | 'disabled';
  defaultPrefix: string;
  defaultSuffix: string;
}

export interface ClaudeCliToolsConfig {
  $schema?: string;
  version: string;
  tools: Record<string, ClaudeCliTool>;
  customEndpoints: Array<{
    id: string;
    name: string;
    enabled: boolean;
  }>;
  defaultTool: string;
  settings: {
    promptFormat: 'plain' | 'yaml' | 'json';
    smartContext: {
      enabled: boolean;
      maxFiles: number;
    };
    nativeResume: boolean;
    recursiveQuery: boolean;
    cache: ClaudeCacheSettings;
    codeIndexMcp: 'codexlens' | 'ace' | 'none';  // Code Index MCP provider
  };
}

// ========== Default Config ==========

const DEFAULT_CONFIG: ClaudeCliToolsConfig = {
  version: '1.0.0',
  tools: {
    gemini: {
      enabled: true,
      isBuiltin: true,
      command: 'gemini',
      description: 'Google AI for code analysis'
    },
    qwen: {
      enabled: true,
      isBuiltin: true,
      command: 'qwen',
      description: 'Alibaba AI assistant'
    },
    codex: {
      enabled: true,
      isBuiltin: true,
      command: 'codex',
      description: 'OpenAI code generation'
    },
    claude: {
      enabled: true,
      isBuiltin: true,
      command: 'claude',
      description: 'Anthropic AI assistant'
    }
  },
  customEndpoints: [],
  defaultTool: 'gemini',
  settings: {
    promptFormat: 'plain',
    smartContext: {
      enabled: false,
      maxFiles: 10
    },
    nativeResume: true,
    recursiveQuery: true,
    cache: {
      injectionMode: 'auto',
      defaultPrefix: '',
      defaultSuffix: ''
    },
    codeIndexMcp: 'codexlens'  // Default to CodexLens
  }
};

// ========== Helper Functions ==========

function getProjectConfigPath(projectDir: string): string {
  return path.join(projectDir, '.claude', 'cli-tools.json');
}

function getGlobalConfigPath(): string {
  return path.join(os.homedir(), '.claude', 'cli-tools.json');
}

/**
 * Resolve config path with fallback:
 * 1. Project: {projectDir}/.claude/cli-tools.json
 * 2. Global: ~/.claude/cli-tools.json
 * Returns { path, source } where source is 'project' | 'global' | 'default'
 */
function resolveConfigPath(projectDir: string): { path: string; source: 'project' | 'global' | 'default' } {
  const projectPath = getProjectConfigPath(projectDir);
  if (fs.existsSync(projectPath)) {
    return { path: projectPath, source: 'project' };
  }

  const globalPath = getGlobalConfigPath();
  if (fs.existsSync(globalPath)) {
    return { path: globalPath, source: 'global' };
  }

  return { path: projectPath, source: 'default' };
}

function ensureClaudeDir(projectDir: string): void {
  const claudeDir = path.join(projectDir, '.claude');
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }
}

// ========== Main Functions ==========

/**
 * Load CLI tools configuration with fallback:
 * 1. Project: {projectDir}/.claude/cli-tools.json
 * 2. Global: ~/.claude/cli-tools.json
 * 3. Default config
 */
export function loadClaudeCliTools(projectDir: string): ClaudeCliToolsConfig & { _source?: string } {
  const resolved = resolveConfigPath(projectDir);

  try {
    if (resolved.source === 'default') {
      // No config file found, return defaults
      return { ...DEFAULT_CONFIG, _source: 'default' };
    }

    const content = fs.readFileSync(resolved.path, 'utf-8');
    const parsed = JSON.parse(content) as Partial<ClaudeCliToolsConfig>;

    // Merge with defaults
    const config = {
      ...DEFAULT_CONFIG,
      ...parsed,
      tools: { ...DEFAULT_CONFIG.tools, ...(parsed.tools || {}) },
      settings: {
        ...DEFAULT_CONFIG.settings,
        ...(parsed.settings || {}),
        smartContext: {
          ...DEFAULT_CONFIG.settings.smartContext,
          ...(parsed.settings?.smartContext || {})
        },
        cache: {
          ...DEFAULT_CONFIG.settings.cache,
          ...(parsed.settings?.cache || {})
        }
      },
      _source: resolved.source
    };

    console.log(`[claude-cli-tools] Loaded config from ${resolved.source}: ${resolved.path}`);
    return config;
  } catch (err) {
    console.error('[claude-cli-tools] Error loading config:', err);
    return { ...DEFAULT_CONFIG, _source: 'default' };
  }
}

/**
 * Save CLI tools configuration to project .claude/cli-tools.json
 * Always saves to project directory (not global)
 */
export function saveClaudeCliTools(projectDir: string, config: ClaudeCliToolsConfig & { _source?: string }): void {
  ensureClaudeDir(projectDir);
  const configPath = getProjectConfigPath(projectDir);

  // Remove internal _source field before saving
  const { _source, ...configToSave } = config;

  try {
    fs.writeFileSync(configPath, JSON.stringify(configToSave, null, 2), 'utf-8');
    console.log(`[claude-cli-tools] Saved config to project: ${configPath}`);
  } catch (err) {
    console.error('[claude-cli-tools] Error saving config:', err);
    throw new Error(`Failed to save CLI tools config: ${err}`);
  }
}

/**
 * Update enabled status for a specific tool
 */
export function updateClaudeToolEnabled(
  projectDir: string,
  toolName: string,
  enabled: boolean
): ClaudeCliToolsConfig {
  const config = loadClaudeCliTools(projectDir);

  if (config.tools[toolName]) {
    config.tools[toolName].enabled = enabled;
    saveClaudeCliTools(projectDir, config);
  }

  return config;
}

/**
 * Update cache settings
 */
export function updateClaudeCacheSettings(
  projectDir: string,
  cacheSettings: Partial<ClaudeCacheSettings>
): ClaudeCliToolsConfig {
  const config = loadClaudeCliTools(projectDir);

  config.settings.cache = {
    ...config.settings.cache,
    ...cacheSettings
  };

  saveClaudeCliTools(projectDir, config);
  return config;
}

/**
 * Update default tool
 */
export function updateClaudeDefaultTool(
  projectDir: string,
  defaultTool: string
): ClaudeCliToolsConfig {
  const config = loadClaudeCliTools(projectDir);
  config.defaultTool = defaultTool;
  saveClaudeCliTools(projectDir, config);
  return config;
}

/**
 * Add custom endpoint
 */
export function addClaudeCustomEndpoint(
  projectDir: string,
  endpoint: { id: string; name: string; enabled: boolean }
): ClaudeCliToolsConfig {
  const config = loadClaudeCliTools(projectDir);

  // Check if endpoint already exists
  const existingIndex = config.customEndpoints.findIndex(e => e.id === endpoint.id);
  if (existingIndex >= 0) {
    config.customEndpoints[existingIndex] = endpoint;
  } else {
    config.customEndpoints.push(endpoint);
  }

  saveClaudeCliTools(projectDir, config);
  return config;
}

/**
 * Remove custom endpoint
 */
export function removeClaudeCustomEndpoint(
  projectDir: string,
  endpointId: string
): ClaudeCliToolsConfig {
  const config = loadClaudeCliTools(projectDir);
  config.customEndpoints = config.customEndpoints.filter(e => e.id !== endpointId);
  saveClaudeCliTools(projectDir, config);
  return config;
}

/**
 * Get config source info
 */
export function getClaudeCliToolsInfo(projectDir: string): {
  projectPath: string;
  globalPath: string;
  activePath: string;
  source: 'project' | 'global' | 'default';
} {
  const resolved = resolveConfigPath(projectDir);
  return {
    projectPath: getProjectConfigPath(projectDir),
    globalPath: getGlobalConfigPath(),
    activePath: resolved.path,
    source: resolved.source
  };
}

/**
 * Update Code Index MCP provider and switch CLAUDE.md reference
 * Strategy: Only modify global user-level CLAUDE.md (~/.claude/CLAUDE.md)
 * This is consistent with Chinese response and Windows platform settings
 */
export function updateCodeIndexMcp(
  projectDir: string,
  provider: 'codexlens' | 'ace' | 'none'
): { success: boolean; error?: string; config?: ClaudeCliToolsConfig } {
  try {
    // Update config
    const config = loadClaudeCliTools(projectDir);
    config.settings.codeIndexMcp = provider;
    saveClaudeCliTools(projectDir, config);

    // Only update global CLAUDE.md (consistent with Chinese response / Windows platform)
    const globalClaudeMdPath = path.join(os.homedir(), '.claude', 'CLAUDE.md');

    // Define patterns for all formats
    const codexlensPattern = /@~\/\.claude\/workflows\/context-tools\.md/g;
    const acePattern = /@~\/\.claude\/workflows\/context-tools-ace\.md/g;
    const nonePattern = /@~\/\.claude\/workflows\/context-tools-none\.md/g;

    // Determine target file based on provider
    const targetFile = provider === 'ace'
      ? '@~/.claude/workflows/context-tools-ace.md'
      : provider === 'none'
        ? '@~/.claude/workflows/context-tools-none.md'
        : '@~/.claude/workflows/context-tools.md';

    if (!fs.existsSync(globalClaudeMdPath)) {
      // If global CLAUDE.md doesn't exist, check project-level
      const projectClaudeMdPath = path.join(projectDir, '.claude', 'CLAUDE.md');
      if (fs.existsSync(projectClaudeMdPath)) {
        let content = fs.readFileSync(projectClaudeMdPath, 'utf-8');

        // Replace any existing pattern with the target
        content = content.replace(codexlensPattern, targetFile);
        content = content.replace(acePattern, targetFile);
        content = content.replace(nonePattern, targetFile);

        fs.writeFileSync(projectClaudeMdPath, content, 'utf-8');
        console.log(`[claude-cli-tools] Updated project CLAUDE.md to use ${provider} (no global CLAUDE.md found)`);
      }
    } else {
      // Update global CLAUDE.md (primary target)
      let content = fs.readFileSync(globalClaudeMdPath, 'utf-8');

      // Replace any existing pattern with the target
      content = content.replace(codexlensPattern, targetFile);
      content = content.replace(acePattern, targetFile);
      content = content.replace(nonePattern, targetFile);

      fs.writeFileSync(globalClaudeMdPath, content, 'utf-8');
      console.log(`[claude-cli-tools] Updated global CLAUDE.md to use ${provider}`);
    }

    return { success: true, config };
  } catch (err) {
    console.error('[claude-cli-tools] Error updating Code Index MCP:', err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Get current Code Index MCP provider
 */
export function getCodeIndexMcp(projectDir: string): 'codexlens' | 'ace' | 'none' {
  const config = loadClaudeCliTools(projectDir);
  return config.settings.codeIndexMcp || 'codexlens';
}

/**
 * Get the context-tools file path based on provider
 */
export function getContextToolsPath(provider: 'codexlens' | 'ace' | 'none'): string {
  switch (provider) {
    case 'ace':
      return 'context-tools-ace.md';
    case 'none':
      return 'context-tools-none.md';
    default:
      return 'context-tools.md';
  }
}
