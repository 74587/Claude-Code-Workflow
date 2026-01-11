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
  primaryModel?: string;
  secondaryModel?: string;
  tags: string[];
}

export type CliToolName = 'gemini' | 'qwen' | 'codex' | 'claude' | 'opencode';

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
  models?: Record<string, string[]>;  // PREDEFINED_MODELS
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

// Predefined models for each tool
const PREDEFINED_MODELS: Record<CliToolName, string[]> = {
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  qwen: ['coder-model', 'vision-model', 'qwen2.5-coder-32b'],
  codex: ['gpt-5.2', 'gpt-4.1', 'o4-mini', 'o3'],
  claude: ['sonnet', 'opus', 'haiku', 'claude-sonnet-4-5-20250929', 'claude-opus-4-5-20251101'],
  opencode: [
    'opencode/glm-4.7-free',
    'opencode/gpt-5-nano',
    'opencode/grok-code',
    'opencode/minimax-m2.1-free',
    'anthropic/claude-sonnet-4-20250514',
    'anthropic/claude-opus-4-20250514',
    'openai/gpt-4.1',
    'openai/o3',
    'google/gemini-2.5-pro',
    'google/gemini-2.5-flash'
  ]
};

const DEFAULT_TOOLS_CONFIG: ClaudeCliToolsConfig = {
  version: '3.0.0',
  models: { ...PREDEFINED_MODELS },
  tools: {
    gemini: {
      enabled: true,
      primaryModel: 'gemini-2.5-pro',
      secondaryModel: 'gemini-2.5-flash',
      tags: []
    },
    qwen: {
      enabled: true,
      primaryModel: 'coder-model',
      secondaryModel: 'coder-model',
      tags: []
    },
    codex: {
      enabled: true,
      primaryModel: 'gpt-5.2',
      secondaryModel: 'gpt-5.2',
      tags: []
    },
    claude: {
      enabled: true,
      primaryModel: 'sonnet',
      secondaryModel: 'haiku',
      tags: []
    },
    opencode: {
      enabled: true,
      primaryModel: 'opencode/glm-4.7-free',
      secondaryModel: 'opencode/glm-4.7-free',
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
 * Ensure tool has required fields (for backward compatibility)
 */
function ensureToolTags(tool: Partial<ClaudeCliTool>): ClaudeCliTool {
  return {
    enabled: tool.enabled ?? true,
    primaryModel: tool.primaryModel,
    secondaryModel: tool.secondaryModel,
    tags: tool.tags ?? []
  };
}

/**
 * Migrate config from older versions to v3.0.0
 */
function migrateConfig(config: any, projectDir: string): ClaudeCliToolsConfig {
  const version = parseFloat(config.version || '1.0');

  // Already v3.x, no migration needed
  if (version >= 3.0) {
    return config as ClaudeCliToolsConfig;
  }

  console.log(`[claude-cli-tools] Migrating config from v${config.version || '1.0'} to v3.0.0`);

  // Try to load legacy cli-config.json for model data
  let legacyCliConfig: any = null;
  try {
    const { StoragePaths } = require('../config/storage-paths.js');
    const legacyPath = StoragePaths.project(projectDir).cliConfig;
    const fs = require('fs');
    if (fs.existsSync(legacyPath)) {
      legacyCliConfig = JSON.parse(fs.readFileSync(legacyPath, 'utf-8'));
      console.log(`[claude-cli-tools] Found legacy cli-config.json, merging model data`);
    }
  } catch {
    // Ignore errors loading legacy config
  }

  const migratedTools: Record<string, ClaudeCliTool> = {};

  for (const [key, tool] of Object.entries(config.tools || {})) {
    const t = tool as any;
    const legacyTool = legacyCliConfig?.tools?.[key];

    migratedTools[key] = {
      enabled: t.enabled ?? legacyTool?.enabled ?? true,
      primaryModel: t.primaryModel ?? legacyTool?.primaryModel ?? DEFAULT_TOOLS_CONFIG.tools[key]?.primaryModel,
      secondaryModel: t.secondaryModel ?? legacyTool?.secondaryModel ?? DEFAULT_TOOLS_CONFIG.tools[key]?.secondaryModel,
      tags: t.tags ?? legacyTool?.tags ?? []
    };
  }

  // Add any missing default tools
  for (const [key, defaultTool] of Object.entries(DEFAULT_TOOLS_CONFIG.tools)) {
    if (!migratedTools[key]) {
      const legacyTool = legacyCliConfig?.tools?.[key];
      migratedTools[key] = {
        enabled: legacyTool?.enabled ?? defaultTool.enabled,
        primaryModel: legacyTool?.primaryModel ?? defaultTool.primaryModel,
        secondaryModel: legacyTool?.secondaryModel ?? defaultTool.secondaryModel,
        tags: legacyTool?.tags ?? defaultTool.tags
      };
    }
  }

  return {
    version: '3.0.0',
    models: { ...PREDEFINED_MODELS },
    tools: migratedTools,
    customEndpoints: config.customEndpoints || [],
    $schema: config.$schema
  };
}

/**
 * Ensure CLI tools configuration file exists
 * Creates default config if missing (auto-rebuild feature)
 * @param projectDir - Project directory path
 * @param createInProject - If true, create in project dir; if false, create in global dir
 * @returns The config that was created/exists
 */
export function ensureClaudeCliTools(projectDir: string, createInProject: boolean = true): ClaudeCliToolsConfig & { _source?: string } {
  const resolved = resolveConfigPath(projectDir);

  if (resolved.source !== 'default') {
    // Config exists, load and return it
    return loadClaudeCliTools(projectDir);
  }

  // Config doesn't exist - create default
  console.log('[claude-cli-tools] Config not found, creating default cli-tools.json');

  const defaultConfig: ClaudeCliToolsConfig = { ...DEFAULT_TOOLS_CONFIG };

  if (createInProject) {
    // Create in project directory
    ensureClaudeDir(projectDir);
    const projectPath = getProjectConfigPath(projectDir);
    try {
      fs.writeFileSync(projectPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
      console.log(`[claude-cli-tools] Created default config at: ${projectPath}`);
      return { ...defaultConfig, _source: 'project' };
    } catch (err) {
      console.error('[claude-cli-tools] Failed to create project config:', err);
    }
  }

  // Fallback: create in global directory
  const globalDir = path.join(os.homedir(), '.claude');
  if (!fs.existsSync(globalDir)) {
    fs.mkdirSync(globalDir, { recursive: true });
  }
  const globalPath = getGlobalConfigPath();
  try {
    fs.writeFileSync(globalPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    console.log(`[claude-cli-tools] Created default config at: ${globalPath}`);
    return { ...defaultConfig, _source: 'global' };
  } catch (err) {
    console.error('[claude-cli-tools] Failed to create global config:', err);
    return { ...defaultConfig, _source: 'default' };
  }
}

/**
 * Load CLI tools configuration with fallback:
 * 1. Project: {projectDir}/.claude/cli-tools.json
 * 2. Global: ~/.claude/cli-tools.json
 * 3. Default config
 *
 * Automatically migrates older config versions to v3.0.0
 */
export function loadClaudeCliTools(projectDir: string): ClaudeCliToolsConfig & { _source?: string } {
  const resolved = resolveConfigPath(projectDir);

  try {
    if (resolved.source === 'default') {
      return { ...DEFAULT_TOOLS_CONFIG, _source: 'default' };
    }

    const content = fs.readFileSync(resolved.path, 'utf-8');
    const parsed = JSON.parse(content) as Partial<ClaudeCliCombinedConfig>;

    // Migrate older versions to v3.0.0
    const migrated = migrateConfig(parsed, projectDir);
    const needsSave = migrated.version !== parsed.version;

    // Merge tools with defaults and ensure required fields exist
    const mergedTools: Record<string, ClaudeCliTool> = {};
    for (const [key, tool] of Object.entries({ ...DEFAULT_TOOLS_CONFIG.tools, ...(migrated.tools || {}) })) {
      mergedTools[key] = ensureToolTags(tool);
    }

    // Ensure customEndpoints have tags
    const mergedEndpoints = (migrated.customEndpoints || []).map(ep => ({
      ...ep,
      tags: ep.tags ?? []
    }));

    const config: ClaudeCliToolsConfig & { _source?: string } = {
      version: migrated.version || DEFAULT_TOOLS_CONFIG.version,
      models: migrated.models || DEFAULT_TOOLS_CONFIG.models,
      tools: mergedTools,
      customEndpoints: mergedEndpoints,
      $schema: migrated.$schema,
      _source: resolved.source
    };

    // Save migrated config if version changed
    if (needsSave) {
      try {
        saveClaudeCliTools(projectDir, config);
        console.log(`[claude-cli-tools] Saved migrated config to: ${resolved.path}`);
      } catch (err) {
        console.warn('[claude-cli-tools] Failed to save migrated config:', err);
      }
    }

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

// ========== Model Configuration Functions ==========

/**
 * Get predefined models for a specific tool
 */
export function getPredefinedModels(tool: string): string[] {
  const toolName = tool as CliToolName;
  return PREDEFINED_MODELS[toolName] ? [...PREDEFINED_MODELS[toolName]] : [];
}

/**
 * Get all predefined models
 */
export function getAllPredefinedModels(): Record<string, string[]> {
  return { ...PREDEFINED_MODELS };
}

/**
 * Get tool configuration (compatible with cli-config-manager interface)
 */
export function getToolConfig(projectDir: string, tool: string): {
  enabled: boolean;
  primaryModel: string;
  secondaryModel: string;
  tags?: string[];
} {
  const config = loadClaudeCliTools(projectDir);
  const toolConfig = config.tools[tool];

  if (!toolConfig) {
    const defaultTool = DEFAULT_TOOLS_CONFIG.tools[tool];
    return {
      enabled: defaultTool?.enabled ?? true,
      primaryModel: defaultTool?.primaryModel ?? '',
      secondaryModel: defaultTool?.secondaryModel ?? '',
      tags: defaultTool?.tags ?? []
    };
  }

  return {
    enabled: toolConfig.enabled,
    primaryModel: toolConfig.primaryModel ?? '',
    secondaryModel: toolConfig.secondaryModel ?? '',
    tags: toolConfig.tags
  };
}

/**
 * Update tool configuration
 */
export function updateToolConfig(
  projectDir: string,
  tool: string,
  updates: Partial<{
    enabled: boolean;
    primaryModel: string;
    secondaryModel: string;
    tags: string[];
  }>
): ClaudeCliToolsConfig {
  const config = loadClaudeCliTools(projectDir);

  if (config.tools[tool]) {
    if (updates.enabled !== undefined) {
      config.tools[tool].enabled = updates.enabled;
    }
    if (updates.primaryModel !== undefined) {
      config.tools[tool].primaryModel = updates.primaryModel;
    }
    if (updates.secondaryModel !== undefined) {
      config.tools[tool].secondaryModel = updates.secondaryModel;
    }
    if (updates.tags !== undefined) {
      config.tools[tool].tags = updates.tags;
    }
    saveClaudeCliTools(projectDir, config);
  }

  return config;
}

/**
 * Get primary model for a tool
 */
export function getPrimaryModel(projectDir: string, tool: string): string {
  const toolConfig = getToolConfig(projectDir, tool);
  return toolConfig.primaryModel;
}

/**
 * Get secondary model for a tool
 */
export function getSecondaryModel(projectDir: string, tool: string): string {
  const toolConfig = getToolConfig(projectDir, tool);
  return toolConfig.secondaryModel;
}

/**
 * Check if a tool is enabled
 */
export function isToolEnabled(projectDir: string, tool: string): boolean {
  const toolConfig = getToolConfig(projectDir, tool);
  return toolConfig.enabled;
}

/**
 * Get full config response for API (includes predefined models)
 */
export function getFullConfigResponse(projectDir: string): {
  config: ClaudeCliToolsConfig;
  predefinedModels: Record<string, string[]>;
} {
  const config = loadClaudeCliTools(projectDir);
  return {
    config,
    predefinedModels: { ...PREDEFINED_MODELS }
  };
}
