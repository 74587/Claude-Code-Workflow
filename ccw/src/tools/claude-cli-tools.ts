/**
 * Claude CLI Tools Configuration Manager
 * Manages .claude/cli-tools.json (tools) and .claude/cli-settings.json (settings)
 * with fallback:
 * 1. Project workspace: {projectDir}/.claude/ (priority)
 * 2. Global: ~/.claude/ (fallback)
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
  primaryModel?: string;
  tags: string[];
}

export interface ClaudeCustomEndpoint {
  id: string;
  name: string;
  enabled: boolean;
  tags: string[];
}

export interface ClaudeCacheSettings {
  injectionMode: 'auto' | 'manual' | 'disabled';
  defaultPrefix: string;
  defaultSuffix: string;
}

// New: Tools-only config (cli-tools.json)
export interface ClaudeCliToolsConfig {
  $schema?: string;
  version: string;
  tools: Record<string, ClaudeCliTool>;
  customEndpoints: ClaudeCustomEndpoint[];
}

// New: Settings-only config (cli-settings.json)
export interface ClaudeCliSettingsConfig {
  $schema?: string;
  version: string;
  defaultTool: string;
  promptFormat: 'plain' | 'yaml' | 'json';
  smartContext: {
    enabled: boolean;
    maxFiles: number;
  };
  nativeResume: boolean;
  recursiveQuery: boolean;
  cache: ClaudeCacheSettings;
  codeIndexMcp: 'codexlens' | 'ace' | 'none';
}

// Legacy combined config (for backward compatibility)
export interface ClaudeCliCombinedConfig extends ClaudeCliToolsConfig {
  defaultTool?: string;
  settings?: {
    promptFormat?: 'plain' | 'yaml' | 'json';
    smartContext?: {
      enabled?: boolean;
      maxFiles?: number;
    };
    nativeResume?: boolean;
    recursiveQuery?: boolean;
    cache?: Partial<ClaudeCacheSettings>;
    codeIndexMcp?: 'codexlens' | 'ace' | 'none';
  };
}

// ========== Default Config ==========

const DEFAULT_TOOLS_CONFIG: ClaudeCliToolsConfig = {
  version: '2.0.0',
  tools: {
    gemini: {
      enabled: true,
      isBuiltin: true,
      command: 'gemini',
      description: 'Google AI for code analysis',
      tags: []
    },
    qwen: {
      enabled: true,
      isBuiltin: true,
      command: 'qwen',
      description: 'Alibaba AI assistant',
      tags: []
    },
    codex: {
      enabled: true,
      isBuiltin: true,
      command: 'codex',
      description: 'OpenAI code generation',
      tags: []
    },
    claude: {
      enabled: true,
      isBuiltin: true,
      command: 'claude',
      description: 'Anthropic AI assistant',
      tags: []
    },
    opencode: {
      enabled: true,
      isBuiltin: true,
      command: 'opencode',
      description: 'OpenCode AI assistant',
      primaryModel: 'opencode/glm-4.7-free',
      tags: []
    }
  },
  customEndpoints: []
};

const DEFAULT_SETTINGS_CONFIG: ClaudeCliSettingsConfig = {
  version: '1.0.0',
  defaultTool: 'gemini',
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
  codeIndexMcp: 'ace'
};

// ========== Helper Functions ==========

function getProjectConfigPath(projectDir: string): string {
  return path.join(projectDir, '.claude', 'cli-tools.json');
}

function getProjectSettingsPath(projectDir: string): string {
  return path.join(projectDir, '.claude', 'cli-settings.json');
}

function getGlobalConfigPath(): string {
  return path.join(os.homedir(), '.claude', 'cli-tools.json');
}

function getGlobalSettingsPath(): string {
  return path.join(os.homedir(), '.claude', 'cli-settings.json');
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

/**
 * Resolve settings path with fallback:
 * 1. Project: {projectDir}/.claude/cli-settings.json
 * 2. Global: ~/.claude/cli-settings.json
 */
function resolveSettingsPath(projectDir: string): { path: string; source: 'project' | 'global' | 'default' } {
  const projectPath = getProjectSettingsPath(projectDir);
  if (fs.existsSync(projectPath)) {
    return { path: projectPath, source: 'project' };
  }

  const globalPath = getGlobalSettingsPath();
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
 * Ensure tool has tags field (for backward compatibility)
 */
function ensureToolTags(tool: Partial<ClaudeCliTool>): ClaudeCliTool {
  return {
    enabled: tool.enabled ?? true,
    isBuiltin: tool.isBuiltin ?? false,
    command: tool.command ?? '',
    description: tool.description ?? '',
    primaryModel: tool.primaryModel,
    tags: tool.tags ?? []
  };
}

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
      return { ...DEFAULT_TOOLS_CONFIG, _source: 'default' };
    }

    const content = fs.readFileSync(resolved.path, 'utf-8');
    const parsed = JSON.parse(content) as Partial<ClaudeCliCombinedConfig>;

    // Merge tools with defaults and ensure tags exist
    const mergedTools: Record<string, ClaudeCliTool> = {};
    for (const [key, tool] of Object.entries({ ...DEFAULT_TOOLS_CONFIG.tools, ...(parsed.tools || {}) })) {
      mergedTools[key] = ensureToolTags(tool);
    }

    // Ensure customEndpoints have tags
    const mergedEndpoints = (parsed.customEndpoints || []).map(ep => ({
      ...ep,
      tags: ep.tags ?? []
    }));

    const config: ClaudeCliToolsConfig & { _source?: string } = {
      version: parsed.version || DEFAULT_TOOLS_CONFIG.version,
      tools: mergedTools,
      customEndpoints: mergedEndpoints,
      $schema: parsed.$schema,
      _source: resolved.source
    };

    console.log(`[claude-cli-tools] Loaded tools config from ${resolved.source}: ${resolved.path}`);
    return config;
  } catch (err) {
    console.error('[claude-cli-tools] Error loading tools config:', err);
    return { ...DEFAULT_TOOLS_CONFIG, _source: 'default' };
  }
}

/**
 * Save CLI tools configuration to project .claude/cli-tools.json
 */
export function saveClaudeCliTools(projectDir: string, config: ClaudeCliToolsConfig & { _source?: string }): void {
  ensureClaudeDir(projectDir);
  const configPath = getProjectConfigPath(projectDir);

  const { _source, ...configToSave } = config;

  try {
    fs.writeFileSync(configPath, JSON.stringify(configToSave, null, 2), 'utf-8');
    console.log(`[claude-cli-tools] Saved tools config to: ${configPath}`);
  } catch (err) {
    console.error('[claude-cli-tools] Error saving tools config:', err);
    throw new Error(`Failed to save CLI tools config: ${err}`);
  }
}

/**
 * Load CLI settings configuration with fallback:
 * 1. Project: {projectDir}/.claude/cli-settings.json
 * 2. Global: ~/.claude/cli-settings.json
 * 3. Default settings
 */
export function loadClaudeCliSettings(projectDir: string): ClaudeCliSettingsConfig & { _source?: string } {
  const resolved = resolveSettingsPath(projectDir);

  try {
    if (resolved.source === 'default') {
      return { ...DEFAULT_SETTINGS_CONFIG, _source: 'default' };
    }

    const content = fs.readFileSync(resolved.path, 'utf-8');
    const parsed = JSON.parse(content) as Partial<ClaudeCliSettingsConfig>;

    const config: ClaudeCliSettingsConfig & { _source?: string } = {
      ...DEFAULT_SETTINGS_CONFIG,
      ...parsed,
      smartContext: {
        ...DEFAULT_SETTINGS_CONFIG.smartContext,
        ...(parsed.smartContext || {})
      },
      cache: {
        ...DEFAULT_SETTINGS_CONFIG.cache,
        ...(parsed.cache || {})
      },
      _source: resolved.source
    };

    console.log(`[claude-cli-tools] Loaded settings from ${resolved.source}: ${resolved.path}`);
    return config;
  } catch (err) {
    console.error('[claude-cli-tools] Error loading settings:', err);
    return { ...DEFAULT_SETTINGS_CONFIG, _source: 'default' };
  }
}

/**
 * Save CLI settings configuration to project .claude/cli-settings.json
 */
export function saveClaudeCliSettings(projectDir: string, config: ClaudeCliSettingsConfig & { _source?: string }): void {
  ensureClaudeDir(projectDir);
  const settingsPath = getProjectSettingsPath(projectDir);

  const { _source, ...configToSave } = config;

  try {
    fs.writeFileSync(settingsPath, JSON.stringify(configToSave, null, 2), 'utf-8');
    console.log(`[claude-cli-tools] Saved settings to: ${settingsPath}`);
  } catch (err) {
    console.error('[claude-cli-tools] Error saving settings:', err);
    throw new Error(`Failed to save CLI settings: ${err}`);
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
): ClaudeCliSettingsConfig {
  const settings = loadClaudeCliSettings(projectDir);

  settings.cache = {
    ...settings.cache,
    ...cacheSettings
  };

  saveClaudeCliSettings(projectDir, settings);
  return settings;
}

/**
 * Update default tool
 */
export function updateClaudeDefaultTool(
  projectDir: string,
  defaultTool: string
): ClaudeCliSettingsConfig {
  const settings = loadClaudeCliSettings(projectDir);
  settings.defaultTool = defaultTool;
  saveClaudeCliSettings(projectDir, settings);
  return settings;
}

/**
 * Add custom endpoint
 */
export function addClaudeCustomEndpoint(
  projectDir: string,
  endpoint: { id: string; name: string; enabled: boolean; tags?: string[] }
): ClaudeCliToolsConfig {
  const config = loadClaudeCliTools(projectDir);

  const newEndpoint: ClaudeCustomEndpoint = {
    id: endpoint.id,
    name: endpoint.name,
    enabled: endpoint.enabled,
    tags: endpoint.tags || []
  };

  // Check if endpoint already exists
  const existingIndex = config.customEndpoints.findIndex(e => e.id === endpoint.id);
  if (existingIndex >= 0) {
    config.customEndpoints[existingIndex] = newEndpoint;
  } else {
    config.customEndpoints.push(newEndpoint);
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
): { success: boolean; error?: string; settings?: ClaudeCliSettingsConfig } {
  try {
    // Update settings config
    const settings = loadClaudeCliSettings(projectDir);
    settings.codeIndexMcp = provider;
    saveClaudeCliSettings(projectDir, settings);

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

    return { success: true, settings };
  } catch (err) {
    console.error('[claude-cli-tools] Error updating Code Index MCP:', err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Get current Code Index MCP provider
 */
export function getCodeIndexMcp(projectDir: string): 'codexlens' | 'ace' | 'none' {
  const settings = loadClaudeCliSettings(projectDir);
  return settings.codeIndexMcp || 'ace';
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
