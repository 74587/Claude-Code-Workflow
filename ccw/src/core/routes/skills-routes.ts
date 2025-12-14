// @ts-nocheck
/**
 * Skills Routes Module
 * Handles all Skills-related API endpoints
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { readFileSync, existsSync, readdirSync, statSync, unlinkSync, promises as fsPromises } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface RouteContext {
  pathname: string;
  url: URL;
  req: IncomingMessage;
  res: ServerResponse;
  initialPath: string;
  handlePostRequest: (req: IncomingMessage, res: ServerResponse, handler: (body: unknown) => Promise<any>) => void;
  broadcastToClients: (data: unknown) => void;
}

// ========== Skills Helper Functions ==========

/**
 * Parse skill frontmatter (YAML header)
 * @param {string} content - Skill file content
 * @returns {Object} Parsed frontmatter and content
 */
function parseSkillFrontmatter(content) {
  const result = {
    name: '',
    description: '',
    version: null,
    allowedTools: [],
    content: ''
  };

  // Check for YAML frontmatter
  if (content.startsWith('---')) {
    const endIndex = content.indexOf('---', 3);
    if (endIndex > 0) {
      const frontmatter = content.substring(3, endIndex).trim();
      result.content = content.substring(endIndex + 3).trim();

      // Parse frontmatter lines
      const lines = frontmatter.split('\n');
      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim().toLowerCase();
          const value = line.substring(colonIndex + 1).trim();

          if (key === 'name') {
            result.name = value.replace(/^["']|["']$/g, '');
          } else if (key === 'description') {
            result.description = value.replace(/^["']|["']$/g, '');
          } else if (key === 'version') {
            result.version = value.replace(/^["']|["']$/g, '');
          } else if (key === 'allowed-tools' || key === 'allowedtools') {
            // Parse as comma-separated or YAML array
            result.allowedTools = value.replace(/^\[|\]$/g, '').split(',').map(t => t.trim()).filter(Boolean);
          }
        }
      }
    }
  } else {
    result.content = content;
  }

  return result;
}

/**
 * Get list of supporting files for a skill
 * @param {string} skillDir
 * @returns {string[]}
 */
function getSupportingFiles(skillDir) {
  const files = [];
  try {
    const entries = readdirSync(skillDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name !== 'SKILL.md') {
        if (entry.isFile()) {
          files.push(entry.name);
        } else if (entry.isDirectory()) {
          files.push(entry.name + '/');
        }
      }
    }
  } catch (e) {
    // Ignore errors
  }
  return files;
}

/**
 * Get skills configuration from project and user directories
 * @param {string} projectPath
 * @returns {Object}
 */
function getSkillsConfig(projectPath) {
  const result = {
    projectSkills: [],
    userSkills: []
  };

  try {
    // Project skills: .claude/skills/
    const projectSkillsDir = join(projectPath, '.claude', 'skills');
    if (existsSync(projectSkillsDir)) {
      const skills = readdirSync(projectSkillsDir, { withFileTypes: true });
      for (const skill of skills) {
        if (skill.isDirectory()) {
          const skillMdPath = join(projectSkillsDir, skill.name, 'SKILL.md');
          if (existsSync(skillMdPath)) {
            const content = readFileSync(skillMdPath, 'utf8');
            const parsed = parseSkillFrontmatter(content);

            // Get supporting files
            const skillDir = join(projectSkillsDir, skill.name);
            const supportingFiles = getSupportingFiles(skillDir);

            result.projectSkills.push({
              name: parsed.name || skill.name,
              description: parsed.description,
              version: parsed.version,
              allowedTools: parsed.allowedTools,
              location: 'project',
              path: skillDir,
              supportingFiles
            });
          }
        }
      }
    }

    // User skills: ~/.claude/skills/
    const userSkillsDir = join(homedir(), '.claude', 'skills');
    if (existsSync(userSkillsDir)) {
      const skills = readdirSync(userSkillsDir, { withFileTypes: true });
      for (const skill of skills) {
        if (skill.isDirectory()) {
          const skillMdPath = join(userSkillsDir, skill.name, 'SKILL.md');
          if (existsSync(skillMdPath)) {
            const content = readFileSync(skillMdPath, 'utf8');
            const parsed = parseSkillFrontmatter(content);

            // Get supporting files
            const skillDir = join(userSkillsDir, skill.name);
            const supportingFiles = getSupportingFiles(skillDir);

            result.userSkills.push({
              name: parsed.name || skill.name,
              description: parsed.description,
              version: parsed.version,
              allowedTools: parsed.allowedTools,
              location: 'user',
              path: skillDir,
              supportingFiles
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Error reading skills config:', error);
  }

  return result;
}

/**
 * Get single skill detail
 * @param {string} skillName
 * @param {string} location - 'project' or 'user'
 * @param {string} projectPath
 * @returns {Object}
 */
function getSkillDetail(skillName, location, projectPath) {
  try {
    const baseDir = location === 'project'
      ? join(projectPath, '.claude', 'skills')
      : join(homedir(), '.claude', 'skills');

    const skillDir = join(baseDir, skillName);
    const skillMdPath = join(skillDir, 'SKILL.md');

    if (!existsSync(skillMdPath)) {
      return { error: 'Skill not found' };
    }

    const content = readFileSync(skillMdPath, 'utf8');
    const parsed = parseSkillFrontmatter(content);
    const supportingFiles = getSupportingFiles(skillDir);

    return {
      skill: {
        name: parsed.name || skillName,
        description: parsed.description,
        version: parsed.version,
        allowedTools: parsed.allowedTools,
        content: parsed.content,
        location,
        path: skillDir,
        supportingFiles
      }
    };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

/**
 * Delete a skill
 * @param {string} skillName
 * @param {string} location
 * @param {string} projectPath
 * @returns {Object}
 */
function deleteSkill(skillName, location, projectPath) {
  try {
    const baseDir = location === 'project'
      ? join(projectPath, '.claude', 'skills')
      : join(homedir(), '.claude', 'skills');

    const skillDir = join(baseDir, skillName);

    if (!existsSync(skillDir)) {
      return { error: 'Skill not found' };
    }

    // Recursively delete directory
    const deleteRecursive = (dirPath) => {
      if (existsSync(dirPath)) {
        readdirSync(dirPath).forEach((file) => {
          const curPath = join(dirPath, file);
          if (statSync(curPath).isDirectory()) {
            deleteRecursive(curPath);
          } else {
            unlinkSync(curPath);
          }
        });
        fsPromises.rmdir(dirPath);
      }
    };

    deleteRecursive(skillDir);

    return { success: true, skillName, location };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

// ========== Skills API Routes ==========

/**
 * Handle Skills routes
 * @returns true if route was handled, false otherwise
 */
export async function handleSkillsRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, url, req, res, initialPath, handlePostRequest } = ctx;

  // API: Get all skills (project and user)
  if (pathname === '/api/skills') {
    const projectPathParam = url.searchParams.get('path') || initialPath;
    const skillsData = getSkillsConfig(projectPathParam);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(skillsData));
    return true;
  }

  // API: Get single skill detail
  if (pathname.startsWith('/api/skills/') && req.method === 'GET' && !pathname.endsWith('/skills/')) {
    const skillName = decodeURIComponent(pathname.replace('/api/skills/', ''));
    const location = url.searchParams.get('location') || 'project';
    const projectPathParam = url.searchParams.get('path') || initialPath;
    const skillDetail = getSkillDetail(skillName, location, projectPathParam);
    if (skillDetail.error) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(skillDetail));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(skillDetail));
    }
    return true;
  }

  // API: Delete skill
  if (pathname.startsWith('/api/skills/') && req.method === 'DELETE') {
    const skillName = decodeURIComponent(pathname.replace('/api/skills/', ''));
    handlePostRequest(req, res, async (body) => {
      const { location, projectPath: projectPathParam } = body;
      return deleteSkill(skillName, location, projectPathParam || initialPath);
    });
    return true;
  }

  return false;
}
