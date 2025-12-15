// @ts-nocheck
/**
 * MCP Routes Module
 * Handles all MCP-related API endpoints
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import * as McpTemplatesDb from './mcp-templates-db.js';

// Claude config file path
const CLAUDE_CONFIG_PATH = join(homedir(), '.claude.json');

// Workspace root path for scanning .mcp.json files
let WORKSPACE_ROOT = process.cwd();

export interface RouteContext {
  pathname: string;
  url: URL;
  req: IncomingMessage;
  res: ServerResponse;
  initialPath: string;
  handlePostRequest: (req: IncomingMessage, res: ServerResponse, handler: (body: unknown) => Promise<any>) => void;
  broadcastToClients: (data: unknown) => void;
}

// ========================================
// Helper Functions
// ========================================

/**
 * Get enterprise managed MCP path (platform-specific)
 */
function getEnterpriseMcpPath(): string {
  const platform = process.platform;
  if (platform === 'darwin') {
    return '/Library/Application Support/ClaudeCode/managed-mcp.json';
  } else if (platform === 'win32') {
    return 'C:\\Program Files\\ClaudeCode\\managed-mcp.json';
  } else {
    // Linux and WSL
    return '/etc/claude-code/managed-mcp.json';
  }
}

/**
 * Safely read and parse JSON file
 */
function safeReadJson(filePath) {
  try {
    if (!existsSync(filePath)) return null;
    const content = readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Get MCP servers from a JSON file (expects mcpServers key at top level)
 * @param {string} filePath
 * @returns {Object} mcpServers object or empty object
 */
function getMcpServersFromFile(filePath) {
  const config = safeReadJson(filePath);
  if (!config) return {};
  return config.mcpServers || {};
}

/**
 * Add or update MCP server in project's .mcp.json file
 * @param {string} projectPath - Project directory path
 * @param {string} serverName - MCP server name
 * @param {Object} serverConfig - MCP server configuration
 * @returns {Object} Result with success/error
 */
function addMcpServerToMcpJson(projectPath, serverName, serverConfig) {
  try {
    const normalizedPath = normalizePathForFileSystem(projectPath);
    const mcpJsonPath = join(normalizedPath, '.mcp.json');
    
    // Read existing .mcp.json or create new structure
    let mcpJson = safeReadJson(mcpJsonPath) || { mcpServers: {} };
    
    // Ensure mcpServers exists
    if (!mcpJson.mcpServers) {
      mcpJson.mcpServers = {};
    }
    
    // Add or update the server
    mcpJson.mcpServers[serverName] = serverConfig;
    
    // Write back to .mcp.json
    writeFileSync(mcpJsonPath, JSON.stringify(mcpJson, null, 2), 'utf8');
    
    return {
      success: true,
      serverName,
      serverConfig,
      scope: 'project-mcp-json',
      path: mcpJsonPath
    };
  } catch (error: unknown) {
    console.error('Error adding MCP server to .mcp.json:', error);
    return { error: (error as Error).message };
  }
}

/**
 * Remove MCP server from project's .mcp.json file
 * @param {string} projectPath - Project directory path
 * @param {string} serverName - MCP server name
 * @returns {Object} Result with success/error
 */
function removeMcpServerFromMcpJson(projectPath, serverName) {
  try {
    const normalizedPath = normalizePathForFileSystem(projectPath);
    const mcpJsonPath = join(normalizedPath, '.mcp.json');
    
    if (!existsSync(mcpJsonPath)) {
      return { error: '.mcp.json not found' };
    }
    
    const mcpJson = safeReadJson(mcpJsonPath);
    if (!mcpJson || !mcpJson.mcpServers || !mcpJson.mcpServers[serverName]) {
      return { error: `Server not found: ${serverName}` };
    }
    
    // Remove the server
    delete mcpJson.mcpServers[serverName];
    
    // Write back to .mcp.json
    writeFileSync(mcpJsonPath, JSON.stringify(mcpJson, null, 2), 'utf8');
    
    return {
      success: true,
      serverName,
      removed: true,
      scope: 'project-mcp-json'
    };
  } catch (error: unknown) {
    console.error('Error removing MCP server from .mcp.json:', error);
    return { error: (error as Error).message };
  }
}

/**
 * Get MCP configuration from multiple sources (per official Claude Code docs):
 *
 * Priority (highest to lowest):
 * 1. Enterprise managed-mcp.json (cannot be overridden)
 * 2. Local scope (project-specific private in ~/.claude.json)
 * 3. Project scope (.mcp.json in project root)
 * 4. User scope (mcpServers in ~/.claude.json)
 *
 * Note: ~/.claude/settings.json is for MCP PERMISSIONS, NOT definitions!
 *
 * @returns {Object}
 */
function getMcpConfig() {
  try {
    const result = {
      projects: {},
      userServers: {},        // User-level servers from ~/.claude.json mcpServers
      enterpriseServers: {},  // Enterprise managed servers (highest priority)
      configSources: []       // Track where configs came from for debugging
    };

    // 1. Read Enterprise managed MCP servers (highest priority)
    const enterprisePath = getEnterpriseMcpPath();
    if (existsSync(enterprisePath)) {
      const enterpriseConfig = safeReadJson(enterprisePath);
      if (enterpriseConfig?.mcpServers) {
        result.enterpriseServers = enterpriseConfig.mcpServers;
        result.configSources.push({ type: 'enterprise', path: enterprisePath, count: Object.keys(enterpriseConfig.mcpServers).length });
      }
    }

    // 2. Read from ~/.claude.json
    if (existsSync(CLAUDE_CONFIG_PATH)) {
      const claudeConfig = safeReadJson(CLAUDE_CONFIG_PATH);
      if (claudeConfig) {
        // 2a. User-level mcpServers (top-level mcpServers key)
        if (claudeConfig.mcpServers) {
          result.userServers = claudeConfig.mcpServers;
          result.configSources.push({ type: 'user', path: CLAUDE_CONFIG_PATH, count: Object.keys(claudeConfig.mcpServers).length });
        }

        // 2b. Project-specific configurations (projects[path].mcpServers)
        if (claudeConfig.projects) {
          result.projects = claudeConfig.projects;
        }
      }
    }

    // 3. For each known project, check for .mcp.json (project-level config)
    // .mcp.json is now the PRIMARY source for project-level MCP servers
    const projectPaths = Object.keys(result.projects);
    for (const projectPath of projectPaths) {
      const mcpJsonPath = join(projectPath, '.mcp.json');
      if (existsSync(mcpJsonPath)) {
        const mcpJsonConfig = safeReadJson(mcpJsonPath);
        if (mcpJsonConfig?.mcpServers) {
          // Merge .mcp.json servers into project config
          // .mcp.json has HIGHER priority than ~/.claude.json projects[path].mcpServers
          const existingServers = result.projects[projectPath]?.mcpServers || {};
          result.projects[projectPath] = {
            ...result.projects[projectPath],
            mcpServers: {
              ...existingServers,             // ~/.claude.json projects[path] (lower priority, legacy)
              ...mcpJsonConfig.mcpServers     // .mcp.json (higher priority, new default)
            },
            mcpJsonPath: mcpJsonPath,  // Track source for debugging
            hasMcpJson: true
          };
          result.configSources.push({ 
            type: 'project-mcp-json', 
            path: mcpJsonPath, 
            count: Object.keys(mcpJsonConfig.mcpServers).length 
          });
        }
      }
    }

    // Build globalServers by merging user and enterprise servers
    // Enterprise servers override user servers
    result.globalServers = {
      ...result.userServers,
      ...result.enterpriseServers
    };

    return result;
  } catch (error: unknown) {
    console.error('Error reading MCP config:', error);
    return { projects: {}, globalServers: {}, userServers: {}, enterpriseServers: {}, configSources: [], error: (error as Error).message };
  }
}

/**
 * Normalize path to filesystem format (for accessing .mcp.json files)
 * Always uses forward slashes for cross-platform compatibility
 * @param {string} path
 * @returns {string}
 */
function normalizePathForFileSystem(path) {
  let normalized = path.replace(/\\/g, '/');
  
  // Handle /d/path format -> D:/path
  if (normalized.match(/^\/[a-zA-Z]\//)) {
    normalized = normalized.charAt(1).toUpperCase() + ':' + normalized.slice(2);
  }
  
  return normalized;
}

/**
 * Normalize project path to match existing format in .claude.json
 * Checks both forward slash and backslash formats to find existing entry
 * @param {string} path
 * @param {Object} claudeConfig - Optional existing config to check format
 * @returns {string}
 */
function normalizeProjectPathForConfig(path, claudeConfig = null) {
  // IMPORTANT: Always normalize to forward slashes to prevent duplicate entries
  // (e.g., prevents both "D:/Claude_dms3" and "D:\\Claude_dms3")
  let normalizedForward = path.replace(/\\/g, '/');

  // Handle /d/path format -> D:/path
  if (normalizedForward.match(/^\/[a-zA-Z]\//)) {
    normalizedForward = normalizedForward.charAt(1).toUpperCase() + ':' + normalizedForward.slice(2);
  }

  // ALWAYS return forward slash format to prevent duplicates
  return normalizedForward;
}

/**
 * Toggle MCP server enabled/disabled
 * @param {string} projectPath
 * @param {string} serverName
 * @param {boolean} enable
 * @returns {Object}
 */
function toggleMcpServerEnabled(projectPath, serverName, enable) {
  try {
    if (!existsSync(CLAUDE_CONFIG_PATH)) {
      return { error: '.claude.json not found' };
    }

    const content = readFileSync(CLAUDE_CONFIG_PATH, 'utf8');
    const config = JSON.parse(content);

    const normalizedPath = normalizeProjectPathForConfig(projectPath, config);

    if (!config.projects || !config.projects[normalizedPath]) {
      return { error: `Project not found: ${normalizedPath}` };
    }

    const projectConfig = config.projects[normalizedPath];

    // Ensure disabledMcpServers array exists
    if (!projectConfig.disabledMcpServers) {
      projectConfig.disabledMcpServers = [];
    }

    if (enable) {
      // Remove from disabled list
      projectConfig.disabledMcpServers = projectConfig.disabledMcpServers.filter(s => s !== serverName);
    } else {
      // Add to disabled list if not already there
      if (!projectConfig.disabledMcpServers.includes(serverName)) {
        projectConfig.disabledMcpServers.push(serverName);
      }
    }

    // Write back to file
    writeFileSync(CLAUDE_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');

    return {
      success: true,
      serverName,
      enabled: enable,
      disabledMcpServers: projectConfig.disabledMcpServers
    };
  } catch (error: unknown) {
    console.error('Error toggling MCP server:', error);
    return { error: (error as Error).message };
  }
}

/**
 * Add MCP server to project
 * Now defaults to using .mcp.json instead of .claude.json
 * @param {string} projectPath
 * @param {string} serverName
 * @param {Object} serverConfig
 * @param {boolean} useLegacyConfig - If true, use .claude.json instead of .mcp.json
 * @returns {Object}
 */
function addMcpServerToProject(projectPath, serverName, serverConfig, useLegacyConfig = false) {
  try {
    // Default: Use .mcp.json for project-level MCP servers
    if (!useLegacyConfig) {
      return addMcpServerToMcpJson(projectPath, serverName, serverConfig);
    }

    // Legacy: Use .claude.json (kept for backward compatibility)
    if (!existsSync(CLAUDE_CONFIG_PATH)) {
      return { error: '.claude.json not found' };
    }

    const content = readFileSync(CLAUDE_CONFIG_PATH, 'utf8');
    const config = JSON.parse(content);

    const normalizedPath = normalizeProjectPathForConfig(projectPath, config);

    // Create project entry if it doesn't exist
    if (!config.projects) {
      config.projects = {};
    }

    if (!config.projects[normalizedPath]) {
      config.projects[normalizedPath] = {
        allowedTools: [],
        mcpContextUris: [],
        mcpServers: {},
        enabledMcpjsonServers: [],
        disabledMcpjsonServers: [],
        hasTrustDialogAccepted: false,
        projectOnboardingSeenCount: 0,
        hasClaudeMdExternalIncludesApproved: false,
        hasClaudeMdExternalIncludesWarningShown: false
      };
    }

    const projectConfig = config.projects[normalizedPath];

    // Ensure mcpServers exists
    if (!projectConfig.mcpServers) {
      projectConfig.mcpServers = {};
    }

    // Add the server
    projectConfig.mcpServers[serverName] = serverConfig;

    // Write back to file
    writeFileSync(CLAUDE_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');

    return {
      success: true,
      serverName,
      serverConfig,
      scope: 'project-legacy'
    };
  } catch (error: unknown) {
    console.error('Error adding MCP server:', error);
    return { error: (error as Error).message };
  }
}

/**
 * Remove MCP server from project
 * Checks both .mcp.json and .claude.json
 * @param {string} projectPath
 * @param {string} serverName
 * @returns {Object}
 */
function removeMcpServerFromProject(projectPath, serverName) {
  try {
    const normalizedPathForFile = normalizePathForFileSystem(projectPath);
    const mcpJsonPath = join(normalizedPathForFile, '.mcp.json');
    
    let removedFromMcpJson = false;
    let removedFromClaudeJson = false;
    
    // Try to remove from .mcp.json first (new default)
    if (existsSync(mcpJsonPath)) {
      const mcpJson = safeReadJson(mcpJsonPath);
      if (mcpJson?.mcpServers?.[serverName]) {
        const result = removeMcpServerFromMcpJson(projectPath, serverName);
        if (result.success) {
          removedFromMcpJson = true;
        }
      }
    }

    // Also try to remove from .claude.json (legacy - may coexist)
    if (existsSync(CLAUDE_CONFIG_PATH)) {
      const content = readFileSync(CLAUDE_CONFIG_PATH, 'utf8');
      const config = JSON.parse(content);

      // Get normalized path that matches existing config format
      const normalizedPath = normalizeProjectPathForConfig(projectPath, config);

      if (config.projects && config.projects[normalizedPath]) {
        const projectConfig = config.projects[normalizedPath];

        if (projectConfig.mcpServers && projectConfig.mcpServers[serverName]) {
          // Remove the server
          delete projectConfig.mcpServers[serverName];

          // Also remove from disabled list if present
          if (projectConfig.disabledMcpServers) {
            projectConfig.disabledMcpServers = projectConfig.disabledMcpServers.filter(s => s !== serverName);
          }

          // Write back to file
          writeFileSync(CLAUDE_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
          removedFromClaudeJson = true;
        }
      }
    }

    // Return success if removed from either location
    if (removedFromMcpJson || removedFromClaudeJson) {
      return {
        success: true,
        serverName,
        removed: true,
        scope: removedFromMcpJson ? 'project-mcp-json' : 'project-legacy',
        removedFrom: removedFromMcpJson && removedFromClaudeJson ? 'both' : 
                     removedFromMcpJson ? '.mcp.json' : '.claude.json'
      };
    }

    return { error: `Server not found: ${serverName}` };
  } catch (error: unknown) {
    console.error('Error removing MCP server:', error);
    return { error: (error as Error).message };
  }
}

/**
 * Add MCP server to global/user scope (top-level mcpServers in ~/.claude.json)
 * @param {string} serverName
 * @param {Object} serverConfig
 * @returns {Object}
 */
function addGlobalMcpServer(serverName, serverConfig) {
  try {
    if (!existsSync(CLAUDE_CONFIG_PATH)) {
      return { error: '.claude.json not found' };
    }

    const content = readFileSync(CLAUDE_CONFIG_PATH, 'utf8');
    const config = JSON.parse(content);

    // Ensure top-level mcpServers exists
    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    // Add the server to top-level mcpServers
    config.mcpServers[serverName] = serverConfig;

    // Write back to file
    writeFileSync(CLAUDE_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');

    return {
      success: true,
      serverName,
      serverConfig,
      scope: 'global'
    };
  } catch (error: unknown) {
    console.error('Error adding global MCP server:', error);
    return { error: (error as Error).message };
  }
}

/**
 * Remove MCP server from global/user scope (top-level mcpServers)
 * @param {string} serverName
 * @returns {Object}
 */
function removeGlobalMcpServer(serverName) {
  try {
    if (!existsSync(CLAUDE_CONFIG_PATH)) {
      return { error: '.claude.json not found' };
    }

    const content = readFileSync(CLAUDE_CONFIG_PATH, 'utf8');
    const config = JSON.parse(content);

    if (!config.mcpServers || !config.mcpServers[serverName]) {
      return { error: `Global server not found: ${serverName}` };
    }

    // Remove the server from top-level mcpServers
    delete config.mcpServers[serverName];

    // Write back to file
    writeFileSync(CLAUDE_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');

    return {
      success: true,
      serverName,
      removed: true,
      scope: 'global'
    };
  } catch (error: unknown) {
    console.error('Error removing global MCP server:', error);
    return { error: (error as Error).message };
  }
}

/**
 * Read settings file safely
 * @param {string} filePath
 * @returns {Object}
 */
function readSettingsFile(filePath) {
  try {
    if (!existsSync(filePath)) {
      return {};
    }
    const content = readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error: unknown) {
    console.error(`Error reading settings file ${filePath}:`, error);
    return {};
  }
}

/**
 * Write settings file safely
 * @param {string} filePath
 * @param {Object} settings
 */
function writeSettingsFile(filePath, settings) {
  const dirPath = dirname(filePath);
  // Ensure directory exists
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8');
}

/**
 * Get project settings path
 * @param {string} projectPath
 * @returns {string}
 */
function getProjectSettingsPath(projectPath) {
  const normalizedPath = projectPath.replace(/\//g, '\\').replace(/^\\([a-zA-Z])\\/, '$1:\\');
  return join(normalizedPath, '.claude', 'settings.json');
}

// ========================================
// Route Handlers
// ========================================

/**
 * Handle MCP routes
 * @returns true if route was handled, false otherwise
 */
export async function handleMcpRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, url, req, res, initialPath, handlePostRequest, broadcastToClients } = ctx;

  // API: Get MCP configuration
  if (pathname === '/api/mcp-config') {
    const mcpData = getMcpConfig();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mcpData));
    return true;
  }

  // API: Toggle MCP server enabled/disabled
  if (pathname === '/api/mcp-toggle' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { projectPath, serverName, enable } = body;
      if (!projectPath || !serverName) {
        return { error: 'projectPath and serverName are required', status: 400 };
      }
      return toggleMcpServerEnabled(projectPath, serverName, enable);
    });
    return true;
  }

  // API: Copy MCP server to project
  if (pathname === '/api/mcp-copy-server' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { projectPath, serverName, serverConfig, configType } = body;
      if (!projectPath || !serverName || !serverConfig) {
        return { error: 'projectPath, serverName, and serverConfig are required', status: 400 };
      }
      // configType: 'mcp' = use .mcp.json (default), 'claude' = use .claude.json
      const useLegacyConfig = configType === 'claude';
      return addMcpServerToProject(projectPath, serverName, serverConfig, useLegacyConfig);
    });
    return true;
  }

  // API: Install CCW MCP server to project
  if (pathname === '/api/mcp-install-ccw' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { projectPath } = body;
      if (!projectPath) {
        return { error: 'projectPath is required', status: 400 };
      }

      // Generate CCW MCP server config
      const ccwMcpConfig = {
        command: "ccw-mcp",
        args: []
      };

      // Use existing addMcpServerToProject to install CCW MCP
      return addMcpServerToProject(projectPath, 'ccw-mcp', ccwMcpConfig);
    });
    return true;
  }

  // API: Remove MCP server from project
  if (pathname === '/api/mcp-remove-server' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { projectPath, serverName } = body;
      if (!projectPath || !serverName) {
        return { error: 'projectPath and serverName are required', status: 400 };
      }
      return removeMcpServerFromProject(projectPath, serverName);
    });
    return true;
  }

  // API: Add MCP server to global scope (top-level mcpServers in ~/.claude.json)
  if (pathname === '/api/mcp-add-global-server' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { serverName, serverConfig } = body;
      if (!serverName || !serverConfig) {
        return { error: 'serverName and serverConfig are required', status: 400 };
      }
      return addGlobalMcpServer(serverName, serverConfig);
    });
    return true;
  }

  // API: Remove MCP server from global scope
  if (pathname === '/api/mcp-remove-global-server' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { serverName } = body;
      if (!serverName) {
        return { error: 'serverName is required', status: 400 };
      }
      return removeGlobalMcpServer(serverName);
    });
    return true;
  }

  // ========================================
  // MCP Templates API
  // ========================================

  // API: Get all MCP templates
  if (pathname === '/api/mcp-templates' && req.method === 'GET') {
    const templates = McpTemplatesDb.getAllTemplates();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, templates }));
    return true;
  }

  // API: Save MCP template
  if (pathname === '/api/mcp-templates' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { name, description, serverConfig, tags, category } = body;
      if (!name || !serverConfig) {
        return { error: 'name and serverConfig are required', status: 400 };
      }
      return McpTemplatesDb.saveTemplate({
        name,
        description,
        serverConfig,
        tags,
        category
      });
    });
    return true;
  }

  // API: Get template by name
  if (pathname.startsWith('/api/mcp-templates/') && req.method === 'GET') {
    const templateName = decodeURIComponent(pathname.split('/api/mcp-templates/')[1]);
    const template = McpTemplatesDb.getTemplateByName(templateName);
    if (template) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, template }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Template not found' }));
    }
    return true;
  }

  // API: Delete MCP template
  if (pathname.startsWith('/api/mcp-templates/') && req.method === 'DELETE') {
    const templateName = decodeURIComponent(pathname.split('/api/mcp-templates/')[1]);
    const result = McpTemplatesDb.deleteTemplate(templateName);
    res.writeHead(result.success ? 200 : 404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return true;
  }

  // API: Search MCP templates
  if (pathname === '/api/mcp-templates/search' && req.method === 'GET') {
    const keyword = url.searchParams.get('q') || '';
    const templates = McpTemplatesDb.searchTemplates(keyword);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, templates }));
    return true;
  }

  // API: Get all categories
  if (pathname === '/api/mcp-templates/categories' && req.method === 'GET') {
    const categories = McpTemplatesDb.getAllCategories();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, categories }));
    return true;
  }

  // API: Get templates by category
  if (pathname.startsWith('/api/mcp-templates/category/') && req.method === 'GET') {
    const category = decodeURIComponent(pathname.split('/api/mcp-templates/category/')[1]);
    const templates = McpTemplatesDb.getTemplatesByCategory(category);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, templates }));
    return true;
  }

  // API: Install template to project or global
  if (pathname === '/api/mcp-templates/install' && req.method === 'POST') {
    handlePostRequest(req, res, async (body) => {
      const { templateName, projectPath, scope } = body;
      if (!templateName) {
        return { error: 'templateName is required', status: 400 };
      }

      const template = McpTemplatesDb.getTemplateByName(templateName);
      if (!template) {
        return { error: 'Template not found', status: 404 };
      }

      // Install to global or project
      if (scope === 'global') {
        return addGlobalMcpServer(templateName, template.serverConfig);
      } else {
        if (!projectPath) {
          return { error: 'projectPath is required for project scope', status: 400 };
        }
        return addMcpServerToProject(projectPath, templateName, template.serverConfig);
      }
    });
    return true;
  }

  return false;
}
