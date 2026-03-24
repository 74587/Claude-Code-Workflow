/**
 * Agent Definitions Routes Module
 * Handles discovery, viewing, and editing of Codex (.toml) and Claude (.md) agent definitions
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, basename } from 'path';

import type { RouteContext } from './types.js';
import { getAllManifests } from '../manifest.js';

// ========== Types ==========

interface AgentDefinition {
  name: string;
  type: 'codex' | 'claude';
  filePath: string;
  installationPath: string;
  model: string;
  effort: string;
  description: string;
}

// ========== Parsing helpers ==========

function parseCodexToml(content: string, filePath: string, installationPath: string): AgentDefinition | null {
  const nameMatch = content.match(/^name\s*=\s*"([^"]+)"/m);
  const modelMatch = content.match(/^model\s*=\s*"([^"]+)"/m);
  const effortMatch = content.match(/^model_reasoning_effort\s*=\s*"([^"]+)"/m);
  const descMatch = content.match(/^description\s*=\s*"([^"]+)"/m);

  if (!nameMatch) return null;

  return {
    name: nameMatch[1],
    type: 'codex',
    filePath,
    installationPath,
    model: modelMatch?.[1] ?? '',
    effort: effortMatch?.[1] ?? '',
    description: descMatch?.[1] ?? '',
  };
}

function parseClaudeMd(content: string, filePath: string, installationPath: string): AgentDefinition | null {
  // Extract YAML frontmatter between --- delimiters
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return null;

  const fm = fmMatch[1];
  const nameMatch = fm.match(/^name:\s*(.+)$/m);
  const modelMatch = fm.match(/^model:\s*(.+)$/m);
  const effortMatch = fm.match(/^effort:\s*(.+)$/m);
  // description can be multi-line with |, just grab first line
  const descMatch = fm.match(/^description:\s*\|?\s*\n?\s*(.+)$/m);

  if (!nameMatch) return null;

  return {
    name: nameMatch[1].trim(),
    type: 'claude',
    filePath,
    installationPath,
    model: modelMatch?.[1].trim() ?? '',
    effort: effortMatch?.[1].trim() ?? '',
    description: descMatch?.[1].trim() ?? '',
  };
}

// ========== Discovery ==========

function scanAgentsInPath(instPath: string, agents: AgentDefinition[]): void {
  // Scan .codex/agents/*.toml
  const codexDir = join(instPath, '.codex', 'agents');
  if (existsSync(codexDir)) {
    try {
      const files = readdirSync(codexDir).filter(f => f.endsWith('.toml'));
      for (const file of files) {
        const filePath = join(codexDir, file);
        try {
          const content = readFileSync(filePath, 'utf-8');
          const agent = parseCodexToml(content, filePath, instPath);
          if (agent) agents.push(agent);
        } catch { /* skip unreadable */ }
      }
    } catch { /* skip unreadable dir */ }
  }

  // Scan .claude/agents/*.md
  const claudeDir = join(instPath, '.claude', 'agents');
  if (existsSync(claudeDir)) {
    try {
      const files = readdirSync(claudeDir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const filePath = join(claudeDir, file);
        try {
          const content = readFileSync(filePath, 'utf-8');
          const agent = parseClaudeMd(content, filePath, instPath);
          if (agent) agents.push(agent);
        } catch { /* skip unreadable */ }
      }
    } catch { /* skip unreadable dir */ }
  }
}

function discoverAgents(initialPath: string): AgentDefinition[] {
  const manifests = getAllManifests();
  const agents: AgentDefinition[] = [];
  const scannedPaths = new Set<string>();

  // Scan manifest installation paths
  for (const manifest of manifests) {
    const normalized = manifest.installation_path.toLowerCase().replace(/[\\/]+$/, '');
    if (!scannedPaths.has(normalized)) {
      scannedPaths.add(normalized);
      scanAgentsInPath(manifest.installation_path, agents);
    }
  }

  // Also scan initialPath (server CWD / project root) if not already covered
  const normalizedInitial = initialPath.toLowerCase().replace(/[\\/]+$/, '');
  if (!scannedPaths.has(normalizedInitial)) {
    scannedPaths.add(normalizedInitial);
    scanAgentsInPath(initialPath, agents);
  }

  return agents;
}

// ========== File update helpers (surgical regex) ==========

function updateCodexTomlField(content: string, field: string, value: string): string {
  const regex = new RegExp(`^${field}\\s*=\\s*"[^"]*"`, 'm');
  if (regex.test(content)) {
    return content.replace(regex, `${field} = "${value}"`);
  }
  // Insert after description line if exists, otherwise after first line
  const descRegex = /^description\s*=\s*"[^"]*"/m;
  if (descRegex.test(content)) {
    return content.replace(descRegex, (match) => `${match}\n${field} = "${value}"`);
  }
  // Fallback: append after first non-empty line
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().length > 0) {
      lines.splice(i + 1, 0, `${field} = "${value}"`);
      break;
    }
  }
  return lines.join('\n');
}

function updateClaudeMdField(content: string, field: string, value: string): string {
  const fmMatch = content.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);
  if (!fmMatch) return content;

  let fm = fmMatch[2];
  const fieldRegex = new RegExp(`^${field}:\\s*.*$`, 'm');

  if (fieldRegex.test(fm)) {
    fm = fm.replace(fieldRegex, `${field}: ${value}`);
  } else {
    // Append before end of frontmatter
    fm = fm.trimEnd() + `\n${field}: ${value}`;
  }

  return fmMatch[1] + fm + fmMatch[3] + content.slice(fmMatch[0].length);
}

// ========== Validation ==========

const CODEX_EFFORTS = ['low', 'medium', 'high'];
const CLAUDE_EFFORTS = ['low', 'medium', 'high', 'max'];
const CLAUDE_MODEL_SHORTCUTS = ['sonnet', 'opus', 'haiku', 'inherit'];

function validateEffort(type: 'codex' | 'claude', effort: string): boolean {
  if (!effort) return true; // empty = no change
  return type === 'codex' ? CODEX_EFFORTS.includes(effort) : CLAUDE_EFFORTS.includes(effort);
}

function validateModel(type: 'codex' | 'claude', model: string): boolean {
  if (!model) return true; // empty = no change
  if (type === 'claude') {
    // Allow shortcuts or full model IDs (any non-empty string)
    return model.length > 0;
  }
  // Codex: any non-empty string
  return model.length > 0;
}

// ========== Route handler ==========

export async function handleAgentDefinitionsRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, req, res, handlePostRequest, initialPath } = ctx;

  // ========== GET /api/agent-definitions ==========
  if (pathname === '/api/agent-definitions' && req.method === 'GET') {
    try {
      const agents = discoverAgents(initialPath);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ agents }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // ========== PUT /api/agent-definitions/batch ==========
  if (pathname === '/api/agent-definitions/batch' && req.method === 'PUT') {
    handlePostRequest(req, res, async (body: unknown) => {
      try {
        const { targets, model, effort } = body as {
          targets: Array<{ filePath: string; type: 'codex' | 'claude' }>;
          model?: string;
          effort?: string;
        };

        if (!targets || !Array.isArray(targets) || targets.length === 0) {
          return { error: 'targets array is required', status: 400 };
        }

        const results: Array<{ filePath: string; success: boolean; error?: string }> = [];

        for (const target of targets) {
          try {
            if (!existsSync(target.filePath)) {
              results.push({ filePath: target.filePath, success: false, error: 'File not found' });
              continue;
            }

            if (effort && !validateEffort(target.type, effort)) {
              results.push({ filePath: target.filePath, success: false, error: `Invalid effort: ${effort}` });
              continue;
            }
            if (model && !validateModel(target.type, model)) {
              results.push({ filePath: target.filePath, success: false, error: `Invalid model: ${model}` });
              continue;
            }

            let content = readFileSync(target.filePath, 'utf-8');

            if (target.type === 'codex') {
              if (model) content = updateCodexTomlField(content, 'model', model);
              if (effort) content = updateCodexTomlField(content, 'model_reasoning_effort', effort);
            } else {
              if (model) content = updateClaudeMdField(content, 'model', model);
              if (effort) content = updateClaudeMdField(content, 'effort', effort);
            }

            writeFileSync(target.filePath, content, 'utf-8');
            results.push({ filePath: target.filePath, success: true });
          } catch (err) {
            results.push({ filePath: target.filePath, success: false, error: (err as Error).message });
          }
        }

        const successCount = results.filter(r => r.success).length;
        return { success: true, updated: successCount, total: targets.length, results };
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  // ========== PUT /api/agent-definitions/:type/:name ==========
  const putMatch = pathname.match(/^\/api\/agent-definitions\/(codex|claude)\/([^/]+)$/);
  if (putMatch && req.method === 'PUT') {
    const agentType = putMatch[1] as 'codex' | 'claude';
    const agentName = decodeURIComponent(putMatch[2]);

    handlePostRequest(req, res, async (body: unknown) => {
      try {
        const { filePath, model, effort } = body as {
          filePath: string;
          model?: string;
          effort?: string;
        };

        if (!filePath) {
          return { error: 'filePath is required', status: 400 };
        }
        if (!existsSync(filePath)) {
          return { error: 'File not found', status: 404 };
        }
        if (effort && !validateEffort(agentType, effort)) {
          return { error: `Invalid effort value: ${effort}. Valid: ${agentType === 'codex' ? CODEX_EFFORTS.join(', ') : CLAUDE_EFFORTS.join(', ')}`, status: 400 };
        }
        if (model && !validateModel(agentType, model)) {
          return { error: 'Invalid model value', status: 400 };
        }

        let content = readFileSync(filePath, 'utf-8');

        if (agentType === 'codex') {
          if (model) content = updateCodexTomlField(content, 'model', model);
          if (effort) content = updateCodexTomlField(content, 'model_reasoning_effort', effort);
        } else {
          if (model) content = updateClaudeMdField(content, 'model', model);
          if (effort) content = updateClaudeMdField(content, 'effort', effort);
        }

        writeFileSync(filePath, content, 'utf-8');

        return { success: true, name: agentName, type: agentType, model, effort };
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  return false;
}
