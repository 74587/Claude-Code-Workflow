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
  // Claude-only advanced fields (empty string for codex)
  tools: string;
  disallowedTools: string;
  permissionMode: string;
  maxTurns: string;
  skills: string;
  mcpServers: string;
  hooks: string;
  memory: string;
  background: string;
  color: string;
  isolation: string;
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
    tools: '',
    disallowedTools: '',
    permissionMode: '',
    maxTurns: '',
    skills: '',
    mcpServers: '',
    hooks: '',
    memory: '',
    background: '',
    color: '',
    isolation: '',
  };
}

function extractSimpleField(fm: string, field: string): string {
  const match = fm.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
  return match?.[1].trim() ?? '';
}

function extractYamlBlock(fm: string, field: string): string {
  const regex = new RegExp(`^${field}:(.*)$`, 'm');
  const match = fm.match(regex);
  if (!match) return '';

  const startIdx = fm.indexOf(match[0]);
  const afterField = fm.slice(startIdx + match[0].length);
  const lines = afterField.split(/\r?\n/);
  const blockLines: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Stop at next top-level field (non-indented, non-empty line with "key:")
    if (line.length > 0 && !line.startsWith(' ') && !line.startsWith('\t') && /^\S+:/.test(line)) break;
    // Also stop at empty line followed by non-indented content (but include blank lines within the block)
    blockLines.push(line);
  }

  // Trim trailing empty lines
  while (blockLines.length > 0 && blockLines[blockLines.length - 1].trim() === '') blockLines.pop();

  if (blockLines.length === 0) {
    // Inline value only (e.g. "mcpServers: foo")
    return match[1].trim();
  }

  return `${field}:${match[1]}\n${blockLines.join('\n')}`;
}

function parseClaudeMd(content: string, filePath: string, installationPath: string): AgentDefinition | null {
  // Extract YAML frontmatter between --- delimiters
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return null;

  const fm = fmMatch[1];
  const nameMatch = fm.match(/^name:\s*(.+)$/m);
  // description can be multi-line with |, just grab first line
  const descMatch = fm.match(/^description:\s*\|?\s*\n?\s*(.+)$/m);

  if (!nameMatch) return null;

  return {
    name: nameMatch[1].trim(),
    type: 'claude',
    filePath,
    installationPath,
    model: extractSimpleField(fm, 'model'),
    effort: extractSimpleField(fm, 'effort'),
    description: descMatch?.[1].trim() ?? '',
    tools: extractSimpleField(fm, 'tools'),
    disallowedTools: extractSimpleField(fm, 'disallowedTools'),
    permissionMode: extractSimpleField(fm, 'permissionMode'),
    maxTurns: extractSimpleField(fm, 'maxTurns'),
    skills: extractSimpleField(fm, 'skills'),
    memory: extractSimpleField(fm, 'memory'),
    background: extractSimpleField(fm, 'background'),
    color: extractSimpleField(fm, 'color'),
    isolation: extractSimpleField(fm, 'isolation'),
    mcpServers: extractYamlBlock(fm, 'mcpServers'),
    hooks: extractYamlBlock(fm, 'hooks'),
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

function removeClaudeMdField(content: string, field: string): string {
  const fmMatch = content.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);
  if (!fmMatch) return content;

  let fm = fmMatch[2];
  // Remove simple field line
  const fieldRegex = new RegExp(`^${field}:\\s*.*$\\n?`, 'm');
  fm = fm.replace(fieldRegex, '');

  return fmMatch[1] + fm + fmMatch[3] + content.slice(fmMatch[0].length);
}

function updateClaudeMdComplexField(content: string, field: string, value: string): string {
  const fmMatch = content.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);
  if (!fmMatch) return content;

  let fm = fmMatch[2];

  // Find existing block: field line + all indented lines after it
  const blockStartRegex = new RegExp(`^${field}:(.*)$`, 'm');
  const blockMatch = fm.match(blockStartRegex);

  if (blockMatch) {
    // Find the full block extent
    const startIdx = fm.indexOf(blockMatch[0]);
    const before = fm.slice(0, startIdx);
    const afterStart = fm.slice(startIdx + blockMatch[0].length);
    const lines = afterStart.split(/\r?\n/);
    let endOffset = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 0 && !line.startsWith(' ') && !line.startsWith('\t') && /^\S+:/.test(line)) break;
      endOffset = i;
    }

    // Reconstruct: keep lines after the block
    const remainingLines = lines.slice(endOffset + 1);
    const after = remainingLines.length > 0 ? '\n' + remainingLines.join('\n') : '';

    if (!value) {
      // Remove the block entirely
      fm = before.replace(/\n$/, '') + after;
    } else {
      fm = before + value + after;
    }
  } else if (value) {
    // Insert before end of frontmatter
    fm = fm.trimEnd() + '\n' + value;
  }

  return fmMatch[1] + fm + fmMatch[3] + content.slice(fmMatch[0].length);
}

// ========== Validation ==========

const CODEX_EFFORTS = ['low', 'medium', 'high'];
const CLAUDE_EFFORTS = ['low', 'medium', 'high', 'max'];
const CLAUDE_MODEL_SHORTCUTS = ['sonnet', 'opus', 'haiku', 'inherit'];
const CLAUDE_PERMISSION_MODES = ['default', 'acceptEdits', 'dontAsk', 'bypassPermissions', 'plan'];
const CLAUDE_MEMORY_OPTIONS = ['user', 'project', 'local'];
const CLAUDE_ISOLATION_OPTIONS = ['worktree'];
const CLAUDE_COLOR_OPTIONS = ['purple', 'blue', 'yellow', 'green', 'red'];

// Simple fields that can be updated with updateClaudeMdField
const CLAUDE_SIMPLE_FIELDS = ['tools', 'disallowedTools', 'permissionMode', 'maxTurns', 'skills', 'memory', 'background', 'color', 'isolation'] as const;
// Complex fields that need updateClaudeMdComplexField
const CLAUDE_COMPLEX_FIELDS = ['mcpServers', 'hooks'] as const;

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
        const b = body as Record<string, string | undefined>;
        const filePath = b.filePath;
        const model = b.model;
        const effort = b.effort;

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

        // Validate enum fields for claude agents
        if (agentType === 'claude') {
          if (b.permissionMode && !CLAUDE_PERMISSION_MODES.includes(b.permissionMode)) {
            return { error: `Invalid permissionMode: ${b.permissionMode}. Valid: ${CLAUDE_PERMISSION_MODES.join(', ')}`, status: 400 };
          }
          if (b.memory && !CLAUDE_MEMORY_OPTIONS.includes(b.memory)) {
            return { error: `Invalid memory: ${b.memory}. Valid: ${CLAUDE_MEMORY_OPTIONS.join(', ')}`, status: 400 };
          }
          if (b.isolation && !CLAUDE_ISOLATION_OPTIONS.includes(b.isolation)) {
            return { error: `Invalid isolation: ${b.isolation}. Valid: ${CLAUDE_ISOLATION_OPTIONS.join(', ')}`, status: 400 };
          }
          if (b.maxTurns && isNaN(Number(b.maxTurns))) {
            return { error: `Invalid maxTurns: must be a number`, status: 400 };
          }
          if (b.background && b.background !== 'true' && b.background !== 'false') {
            return { error: `Invalid background: must be true or false`, status: 400 };
          }
        }

        let content = readFileSync(filePath, 'utf-8');

        if (agentType === 'codex') {
          if (model) content = updateCodexTomlField(content, 'model', model);
          if (effort) content = updateCodexTomlField(content, 'model_reasoning_effort', effort);
        } else {
          if (model) content = updateClaudeMdField(content, 'model', model);
          if (effort) content = updateClaudeMdField(content, 'effort', effort);

          // Handle simple fields: set or remove
          for (const field of CLAUDE_SIMPLE_FIELDS) {
            if (field in b) {
              const val = b[field];
              if (val) {
                content = updateClaudeMdField(content, field, val);
              } else {
                content = removeClaudeMdField(content, field);
              }
            }
          }

          // Handle complex fields (mcpServers, hooks): set or remove
          for (const field of CLAUDE_COMPLEX_FIELDS) {
            if (field in b) {
              const val = b[field];
              content = updateClaudeMdComplexField(content, field, val ?? '');
            }
          }
        }

        writeFileSync(filePath, content, 'utf-8');

        return { success: true, name: agentName, type: agentType };
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  return false;
}
