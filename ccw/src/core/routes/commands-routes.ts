/**
 * Commands Routes Module
 * Handles all Commands-related API endpoints
 *
 * API Endpoints:
 * - GET /api/commands - List all commands with groups
 * - POST /api/commands/:name/toggle - Enable/disable single command
 * - POST /api/commands/group/:groupName/toggle - Batch toggle commands by group
 */
import { existsSync, readdirSync, readFileSync, mkdirSync, cpSync, rmSync, renameSync, statSync } from 'fs';
import { join, relative, dirname, basename } from 'path';
import { homedir } from 'os';
import { validatePath as validateAllowedPath } from '../../utils/path-validator.js';
import type { RouteContext } from './types.js';

// ========== Types ==========

type CommandLocation = 'project' | 'user';

interface CommandMetadata {
  name: string;
  description: string;
  group: string;
  argumentHint?: string;
  allowedTools?: string[];
}

interface CommandInfo {
  name: string;
  description: string;
  group: string;
  enabled: boolean;
  location: CommandLocation;
  path: string;
  relativePath: string;  // Path relative to commands root (e.g., 'workflow/plan.md')
  argumentHint?: string;
  allowedTools?: string[];
}

interface CommandsConfig {
  projectCommands: CommandInfo[];
  userCommands: CommandInfo[];
  groups: string[];
}

interface CommandOperationResult {
  success: boolean;
  message: string;
  commandName?: string;
  location?: CommandLocation;
  status?: number;
}

// ========== Helper Functions ==========

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Get commands directory path
 */
function getCommandsDir(location: CommandLocation, projectPath: string): string {
  if (location === 'project') {
    return join(projectPath, '.claude', 'commands');
  }
  return join(homedir(), '.claude', 'commands');
}

/**
 * Get disabled commands directory path
 */
function getDisabledCommandsDir(location: CommandLocation, projectPath: string): string {
  if (location === 'project') {
    return join(projectPath, '.claude', 'commands', '_disabled');
  }
  return join(homedir(), '.claude', 'commands', '_disabled');
}

/**
 * Parse YAML frontmatter from command file
 */
function parseCommandFrontmatter(content: string): CommandMetadata {
  const result: CommandMetadata = {
    name: '',
    description: '',
    group: 'other'  // Default group
  };

  // Check for YAML frontmatter
  if (content.startsWith('---')) {
    const endIndex = content.indexOf('---', 3);
    if (endIndex > 0) {
      const frontmatter = content.substring(3, endIndex).trim();

      // Parse frontmatter lines
      const lines = frontmatter.split(/[\r\n]+/);
      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim().toLowerCase();
          const value = line.substring(colonIndex + 1).trim().replace(/^["']|["']$/g, '');

          if (key === 'name') {
            result.name = value;
          } else if (key === 'description') {
            result.description = value;
          } else if (key === 'group') {
            result.group = value || 'other';
          } else if (key === 'argument-hint') {
            result.argumentHint = value;
          } else if (key === 'allowed-tools') {
            result.allowedTools = value
              .replace(/^\[|\]$/g, '')
              .split(',')
              .map(t => t.trim())
              .filter(Boolean);
          }
        }
      }
    }
  }

  return result;
}

/**
 * Infer group from command path if not specified in frontmatter
 */
function inferGroupFromPath(relativePath: string, metadata: CommandMetadata): string {
  // If group is specified in frontmatter, use it
  if (metadata.group && metadata.group !== 'other') {
    return metadata.group;
  }

  // Infer from directory structure
  const parts = relativePath.split(/[/\\]/);
  if (parts.length > 1) {
    // Use first directory as group (e.g., 'workflow', 'issue', 'memory')
    return parts[0];
  }

  return 'other';
}

/**
 * Recursively scan directory for command files
 */
function scanCommandsRecursive(
  baseDir: string,
  currentDir: string,
  location: CommandLocation,
  enabled: boolean
): CommandInfo[] {
  const results: CommandInfo[] = [];

  if (!existsSync(currentDir)) {
    return results;
  }

  try {
    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      const relativePath = relative(baseDir, fullPath);

      if (entry.isDirectory()) {
        // Skip _disabled directory when scanning enabled commands
        if (entry.name === '_disabled') continue;
        
        // Recursively scan subdirectories
        results.push(...scanCommandsRecursive(baseDir, fullPath, location, enabled));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const content = readFileSync(fullPath, 'utf8');
          const metadata = parseCommandFrontmatter(content);
          const group = inferGroupFromPath(relativePath, metadata);

          results.push({
            name: metadata.name || basename(entry.name, '.md'),
            description: metadata.description,
            group,
            enabled,
            location,
            path: fullPath,
            relativePath,
            argumentHint: metadata.argumentHint,
            allowedTools: metadata.allowedTools
          });
        } catch (err) {
          // Skip files that fail to read
          console.error(`[Commands] Failed to read ${fullPath}:`, err);
        }
      }
    }
  } catch (err) {
    console.error(`[Commands] Failed to scan directory ${currentDir}:`, err);
  }

  return results;
}

/**
 * Get all commands configuration
 */
function getCommandsConfig(projectPath: string): CommandsConfig {
  const result: CommandsConfig = {
    projectCommands: [],
    userCommands: [],
    groups: []
  };

  const groupSet = new Set<string>();

  try {
    // Scan project commands
    const projectDir = getCommandsDir('project', projectPath);
    const projectDisabledDir = getDisabledCommandsDir('project', projectPath);
    
    // Enabled project commands
    const enabledProject = scanCommandsRecursive(projectDir, projectDir, 'project', true);
    result.projectCommands.push(...enabledProject);
    
    // Disabled project commands
    if (existsSync(projectDisabledDir)) {
      const disabledProject = scanCommandsRecursive(projectDisabledDir, projectDisabledDir, 'project', false);
      result.projectCommands.push(...disabledProject);
    }

    // Scan user commands
    const userDir = getCommandsDir('user', projectPath);
    const userDisabledDir = getDisabledCommandsDir('user', projectPath);
    
    // Enabled user commands
    const enabledUser = scanCommandsRecursive(userDir, userDir, 'user', true);
    result.userCommands.push(...enabledUser);
    
    // Disabled user commands
    if (existsSync(userDisabledDir)) {
      const disabledUser = scanCommandsRecursive(userDisabledDir, userDisabledDir, 'user', false);
      result.userCommands.push(...disabledUser);
    }

    // Collect all groups
    for (const cmd of [...result.projectCommands, ...result.userCommands]) {
      groupSet.add(cmd.group);
    }

    result.groups = Array.from(groupSet).sort();
  } catch (error) {
    console.error('[Commands] Error reading commands config:', error);
  }

  return result;
}

/**
 * Move directory with fallback to copy-delete and rollback on failure
 */
function moveDirectory(source: string, target: string): void {
  try {
    // Ensure target parent directory exists
    const targetParent = dirname(target);
    if (!existsSync(targetParent)) {
      mkdirSync(targetParent, { recursive: true });
    }

    // Try atomic rename first
    renameSync(source, target);
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    // If rename fails (cross-filesystem, permission issues), fallback to copy-delete
    if (err.code === 'EXDEV' || err.code === 'EPERM' || err.code === 'EBUSY') {
      cpSync(source, target, { recursive: true, force: true });
      try {
        rmSync(source, { recursive: true, force: true });
      } catch (rmError) {
        // Rollback: remove the copied target to avoid duplicates
        try {
          rmSync(target, { recursive: true, force: true });
        } catch {
          // Ignore rollback errors
        }
        throw new Error(`Failed to remove source after copy: ${(rmError as Error).message}`);
      }
    } else {
      throw error;
    }
  }
}

/**
 * Find command by name in commands list
 */
function findCommand(
  commands: CommandInfo[],
  commandName: string
): CommandInfo | undefined {
  // Try exact name match first
  let cmd = commands.find(c => c.name === commandName);
  if (cmd) return cmd;

  // Try matching by relative path (without extension)
  cmd = commands.find(c => {
    const pathWithoutExt = c.relativePath.replace(/\.md$/, '');
    return pathWithoutExt === commandName;
  });
  if (cmd) return cmd;

  // Try matching by filename (without extension)
  cmd = commands.find(c => {
    const filename = basename(c.relativePath, '.md');
    return filename === commandName;
  });

  return cmd;
}

/**
 * Toggle a command's enabled state
 */
async function toggleCommand(
  commandName: string,
  location: CommandLocation,
  projectPath: string,
  initialPath: string
): Promise<CommandOperationResult> {
  try {
    // Validate command name
    if (commandName.includes('..')) {
      return { success: false, message: 'Invalid command name', status: 400 };
    }

    const config = getCommandsConfig(projectPath);
    const commands = location === 'project' ? config.projectCommands : config.userCommands;
    const command = findCommand(commands, commandName);

    if (!command) {
      return { success: false, message: 'Command not found', status: 404 };
    }

    const commandsDir = getCommandsDir(location, projectPath);
    const disabledDir = getDisabledCommandsDir(location, projectPath);

    if (command.enabled) {
      // Disable: move from commands to _disabled
      const targetPath = join(disabledDir, command.relativePath);
      
      // Check if target already exists
      if (existsSync(targetPath)) {
        return { success: false, message: 'Command already exists in disabled directory', status: 409 };
      }

      moveDirectory(command.path, targetPath);
      return { 
        success: true, 
        message: 'Command disabled', 
        commandName: command.name, 
        location 
      };
    } else {
      // Enable: move from _disabled back to commands
      // Calculate target path in enabled directory
      const targetPath = join(commandsDir, command.relativePath);

      // Check if target already exists
      if (existsSync(targetPath)) {
        return { success: false, message: 'Command already exists in commands directory', status: 409 };
      }

      moveDirectory(command.path, targetPath);
      return { 
        success: true, 
        message: 'Command enabled', 
        commandName: command.name, 
        location 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      message: (error as Error).message, 
      status: 500 
    };
  }
}

/**
 * Toggle all commands in a group
 */
async function toggleGroup(
  groupName: string,
  location: CommandLocation,
  enable: boolean,
  projectPath: string,
  initialPath: string
): Promise<{ success: boolean; results: CommandOperationResult[]; message: string }> {
  const config = getCommandsConfig(projectPath);
  const commands = location === 'project' ? config.projectCommands : config.userCommands;
  
  // Filter commands by group and current state
  const targetCommands = commands.filter(cmd => 
    cmd.group === groupName && cmd.enabled !== enable
  );

  if (targetCommands.length === 0) {
    return {
      success: true,
      results: [],
      message: `No commands to ${enable ? 'enable' : 'disable'} in group '${groupName}'`
    };
  }

  const results: CommandOperationResult[] = [];

  for (const cmd of targetCommands) {
    const result = await toggleCommand(cmd.name, location, projectPath, initialPath);
    results.push(result);
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return {
    success: failCount === 0,
    results,
    message: `${enable ? 'Enabled' : 'Disabled'} ${successCount} commands${failCount > 0 ? `, ${failCount} failed` : ''}`
  };
}

// ========== Route Handler ==========

/**
 * Handle Commands routes
 * @returns true if route was handled, false otherwise
 */
export async function handleCommandsRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, url, req, res, initialPath, handlePostRequest } = ctx;

  // GET /api/commands - List all commands
  if (pathname === '/api/commands' && req.method === 'GET') {
    const projectPathParam = url.searchParams.get('path') || initialPath;

    try {
      const validatedProjectPath = await validateAllowedPath(projectPathParam, { 
        mustExist: true, 
        allowedDirectories: [initialPath] 
      });
      
      const config = getCommandsConfig(validatedProjectPath);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(config));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes('Access denied') ? 403 : 400;
      console.error(`[Commands] Project path validation failed: ${message}`);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: status === 403 ? 'Access denied' : 'Invalid path', 
        projectCommands: [], 
        userCommands: [],
        groups: []
      }));
    }
    return true;
  }

  // POST /api/commands/:name/toggle - Toggle single command
  if (pathname.match(/^\/api\/commands\/[^/]+\/toggle$/) && req.method === 'POST') {
    const pathParts = pathname.split('/');
    const commandName = decodeURIComponent(pathParts[3]);

    handlePostRequest(req, res, async (body) => {
      if (!isRecord(body)) {
        return { error: 'Invalid request body', status: 400 };
      }

      const locationValue = body.location;
      const projectPathParam = typeof body.projectPath === 'string' ? body.projectPath : undefined;

      if (locationValue !== 'project' && locationValue !== 'user') {
        return { error: 'Location is required (project or user)' };
      }

      const projectPath = projectPathParam || initialPath;
      return toggleCommand(commandName, locationValue, projectPath, initialPath);
    });
    return true;
  }

  // POST /api/commands/group/:groupName/toggle - Toggle all commands in group
  if (pathname.match(/^\/api\/commands\/group\/[^/]+\/toggle$/) && req.method === 'POST') {
    const pathParts = pathname.split('/');
    const groupName = decodeURIComponent(pathParts[4]);

    handlePostRequest(req, res, async (body) => {
      if (!isRecord(body)) {
        return { error: 'Invalid request body', status: 400 };
      }

      const locationValue = body.location;
      const enable = body.enable === true;
      const projectPathParam = typeof body.projectPath === 'string' ? body.projectPath : undefined;

      if (locationValue !== 'project' && locationValue !== 'user') {
        return { error: 'Location is required (project or user)' };
      }

      const projectPath = projectPathParam || initialPath;
      return toggleGroup(groupName, locationValue, enable, projectPath, initialPath);
    });
    return true;
  }

  return false;
}
