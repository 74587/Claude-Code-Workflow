// @ts-nocheck
/**
 * Rules Routes Module
 * Handles all Rules-related API endpoints
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { readFileSync, existsSync, readdirSync, unlinkSync } from 'fs';
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

/**
 * Parse rule frontmatter
 * @param {string} content
 * @returns {Object}
 */
function parseRuleFrontmatter(content) {
  const result = {
    paths: [],
    content: content
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

          if (key === 'paths') {
            // Parse as comma-separated or YAML array
            result.paths = value.replace(/^\[|\]$/g, '').split(',').map(t => t.trim()).filter(Boolean);
          }
        }
      }
    }
  }

  return result;
}

/**
 * Recursively scan rules directory for .md files
 * @param {string} dirPath
 * @param {string} location
 * @param {string} subdirectory
 * @returns {Object[]}
 */
function scanRulesDirectory(dirPath, location, subdirectory) {
  const rules = [];

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isFile() && entry.name.endsWith('.md')) {
        const content = readFileSync(fullPath, 'utf8');
        const parsed = parseRuleFrontmatter(content);

        rules.push({
          name: entry.name,
          paths: parsed.paths,
          content: parsed.content,
          location,
          path: fullPath,
          subdirectory: subdirectory || null
        });
      } else if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subRules = scanRulesDirectory(fullPath, location, subdirectory ? `${subdirectory}/${entry.name}` : entry.name);
        rules.push(...subRules);
      }
    }
  } catch (e) {
    // Ignore errors
  }

  return rules;
}

/**
 * Get rules configuration from project and user directories
 * @param {string} projectPath
 * @returns {Object}
 */
function getRulesConfig(projectPath) {
  const result = {
    projectRules: [],
    userRules: []
  };

  try {
    // Project rules: .claude/rules/
    const projectRulesDir = join(projectPath, '.claude', 'rules');
    if (existsSync(projectRulesDir)) {
      const rules = scanRulesDirectory(projectRulesDir, 'project', '');
      result.projectRules = rules;
    }

    // User rules: ~/.claude/rules/
    const userRulesDir = join(homedir(), '.claude', 'rules');
    if (existsSync(userRulesDir)) {
      const rules = scanRulesDirectory(userRulesDir, 'user', '');
      result.userRules = rules;
    }
  } catch (error) {
    console.error('Error reading rules config:', error);
  }

  return result;
}

/**
 * Find rule file in directory (including subdirectories)
 * @param {string} baseDir
 * @param {string} ruleName
 * @returns {string|null}
 */
function findRuleFile(baseDir, ruleName) {
  try {
    // Direct path
    const directPath = join(baseDir, ruleName);
    if (existsSync(directPath)) {
      return directPath;
    }

    // Search in subdirectories
    const entries = readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subPath = findRuleFile(join(baseDir, entry.name), ruleName);
        if (subPath) return subPath;
      }
    }
  } catch (e) {
    // Ignore errors
  }
  return null;
}

/**
 * Get single rule detail
 * @param {string} ruleName
 * @param {string} location - 'project' or 'user'
 * @param {string} projectPath
 * @returns {Object}
 */
function getRuleDetail(ruleName, location, projectPath) {
  try {
    const baseDir = location === 'project'
      ? join(projectPath, '.claude', 'rules')
      : join(homedir(), '.claude', 'rules');

    // Find the rule file (could be in subdirectory)
    const rulePath = findRuleFile(baseDir, ruleName);

    if (!rulePath) {
      return { error: 'Rule not found' };
    }

    const content = readFileSync(rulePath, 'utf8');
    const parsed = parseRuleFrontmatter(content);

    return {
      rule: {
        name: ruleName,
        paths: parsed.paths,
        content: parsed.content,
        location,
        path: rulePath
      }
    };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

/**
 * Delete a rule
 * @param {string} ruleName
 * @param {string} location
 * @param {string} projectPath
 * @returns {Object}
 */
function deleteRule(ruleName, location, projectPath) {
  try {
    const baseDir = location === 'project'
      ? join(projectPath, '.claude', 'rules')
      : join(homedir(), '.claude', 'rules');

    const rulePath = findRuleFile(baseDir, ruleName);

    if (!rulePath) {
      return { error: 'Rule not found' };
    }

    unlinkSync(rulePath);

    return { success: true, ruleName, location };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

/**
 * Handle Rules routes
 * @returns true if route was handled, false otherwise
 */
export async function handleRulesRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, url, req, res, initialPath, handlePostRequest } = ctx;

  // API: Get all rules
  if (pathname === '/api/rules') {
    const projectPathParam = url.searchParams.get('path') || initialPath;
    const rulesData = getRulesConfig(projectPathParam);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rulesData));
    return true;
  }

  // API: Get single rule detail
  if (pathname.startsWith('/api/rules/') && req.method === 'GET' && !pathname.endsWith('/rules/')) {
    const ruleName = decodeURIComponent(pathname.replace('/api/rules/', ''));
    const location = url.searchParams.get('location') || 'project';
    const projectPathParam = url.searchParams.get('path') || initialPath;
    const ruleDetail = getRuleDetail(ruleName, location, projectPathParam);
    if (ruleDetail.error) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(ruleDetail));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(ruleDetail));
    }
    return true;
  }

  // API: Delete rule
  if (pathname.startsWith('/api/rules/') && req.method === 'DELETE') {
    const ruleName = decodeURIComponent(pathname.replace('/api/rules/', ''));
    handlePostRequest(req, res, async (body) => {
      const { location, projectPath: projectPathParam } = body;
      return deleteRule(ruleName, location, projectPathParam || initialPath);
    });
    return true;
  }

  return false;
}
