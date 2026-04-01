/**
 * Chain Loader Tool - Progressive skill chain execution with step-by-step
 * content delivery and LLM-driven decision routing.
 *
 * Commands: list, start, next, done, status, content, complete
 */

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';
import type {
  SkillChain, ChainNode, ChainSession,
  StepNode, DecisionNode, DelegateNode,
  ChainFrame, NodeStatus, LoadedEntry,
} from '../types/chain-types.js';
import {
  readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync,
} from 'fs';
import { resolve, join, dirname } from 'path';
import { homedir } from 'os';

// ─── Params ──────────────────────────────────────────────────

const ParamsSchema = z.object({
  cmd: z.enum(['list', 'start', 'next', 'done', 'status', 'content', 'complete']),
  skill: z.string().optional(),
  chain: z.string().optional(),
  session_id: z.string().optional(),
  choice: z.number().optional(),
});

type Params = z.infer<typeof ParamsSchema>;

// ─── Tool Schema ─────────────────────────────────────────────

export const schema: ToolSchema = {
  name: 'chain_loader',
  description: `Progressive skill chain loader. Auto-detects skill from cwd (cd to skill dir first) or pass skill explicitly.
  list: List chains. Params: skill? (string, auto-detect from cwd)
  start: Start chain session. Params: chain (string), skill? (string, auto-detect from cwd)
  next: Read current node (idempotent if active, advance if completed). Params: session_id (string)
  done: Complete current node and advance. Params: session_id (string), choice? (number, 1-based for decisions)
  status: Query session state. Params: session_id (string)
  content: Get all loaded content. Params: session_id (string)
  complete: Mark session completed. Params: session_id (string)`,
  inputSchema: {
    type: 'object',
    properties: {
      cmd: { type: 'string', description: 'Command: list|start|next|done|status|content|complete' },
      skill: { type: 'string', description: 'Skill name (optional, auto-detected from cwd if omitted)' },
      chain: { type: 'string', description: 'Chain name (for start)' },
      session_id: { type: 'string', description: 'Session ID (for next/done/status/content/complete)' },
      choice: { type: 'number', description: 'Decision choice index (1-based, for done on decision nodes)' },
    },
    required: ['cmd'],
  },
};

// ─── Constants ───────────────────────────────────────────────

const SESSIONS_BASE = '.workflow/.chain-sessions';

// ─── Handler ─────────────────────────────────────────────────

export async function handler(params: Record<string, unknown>): Promise<ToolResult> {
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return { success: false, error: `Invalid params: ${parsed.error.message}` };
  }

  const p = parsed.data;
  try {
    switch (p.cmd) {
      case 'list':     return cmdList(p);
      case 'start':    return cmdStart(p);
      case 'next':     return cmdNext(p);
      case 'done':     return cmdDone(p);
      case 'status':   return cmdStatus(p);
      case 'content':  return cmdContent(p);
      case 'complete': return cmdComplete(p);
      default:
        return { success: false, error: `Unknown command: ${p.cmd}` };
    }
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ─── list ────────────────────────────────────────────────────

function cmdList(p: Params): ToolResult {
  // If no skill given, try cwd auto-detect first; fall back to scanning all
  const cwdSkill = !p.skill ? detectSkillFromCwd() : null;
  const skillDirs = cwdSkill ? [cwdSkill] : discoverSkillDirs(p.skill);
  const results: Array<{
    skill: string;
    chain_id: string;
    name: string;
    description: string;
    node_count: number;
  }> = [];

  for (const { skillName, skillPath } of skillDirs) {
    const chainsDir = join(skillPath, 'chains');
    if (!existsSync(chainsDir)) continue;

    const files = readdirSync(chainsDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const chain = loadChainJson(join(chainsDir, file));
        results.push({
          skill: skillName,
          chain_id: chain.chain_id,
          name: chain.name,
          description: chain.description,
          node_count: Object.keys(chain.nodes).length,
        });
      } catch { /* skip invalid chain files */ }
    }
  }

  return { success: true, result: { chains: results, total: results.length } };
}

// ─── start ───────────────────────────────────────────────────

function cmdStart(p: Params): ToolResult {
  if (!p.chain) return { success: false, error: 'chain is required for start' };

  // Resolve skill: explicit param → cwd auto-detect → error
  const resolved = resolveSkill(p.skill);
  if (!resolved) {
    return { success: false, error: p.skill
      ? `Skill not found: ${p.skill}`
      : 'Cannot auto-detect skill from cwd. Pass skill explicitly or cd to a skill directory (must contain chains/ dir).' };
  }
  const { skillName, skillPath } = resolved;

  const chainPath = join(skillPath, 'chains', `${p.chain}.json`);
  if (!existsSync(chainPath)) {
    return { success: false, error: `Chain not found: ${p.chain} in skill ${skillName}` };
  }

  const chain = loadChainJson(chainPath);
  if (!chain.nodes[chain.entry]) {
    return { success: false, error: `Entry node "${chain.entry}" not found in chain` };
  }

  // Generate session ID
  const now = new Date();
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const sessionId = `CL-${skillName}-${timeStr}`;

  // Create session
  const session: ChainSession = {
    session_id: sessionId,
    skill_name: skillName,
    skill_path: skillPath,
    status: 'active',
    current_chain: chain.chain_id,
    current_node: chain.entry,
    node_status: 'active',
    chain_stack: [],
    history: [],
    loaded_content: [],
    started_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  // Load entry node content
  const entryNode = chain.nodes[chain.entry];
  const nodeContent = loadNodeContent(entryNode, skillPath);

  // Record in history
  session.history.push({
    node_id: chain.entry,
    chain_id: chain.chain_id,
    node_type: entryNode.type,
    node_status: 'active',
    timestamp: now.toISOString(),
  });

  // Add to loaded content
  if (nodeContent) {
    session.loaded_content.push({
      node_id: chain.entry,
      chain_id: chain.chain_id,
      content: nodeContent,
      loaded_at: now.toISOString(),
    });
  }

  saveSession(session);

  return {
    success: true,
    result: {
      session_id: sessionId,
      current_chain: chain.chain_id,
      current_node: chain.entry,
      node_status: 'active',
      ...formatNodeOutput(entryNode, nodeContent),
    },
  };
}

// ─── next ────────────────────────────────────────────────────

function cmdNext(p: Params): ToolResult {
  if (!p.session_id) return { success: false, error: 'session_id is required for next' };

  const session = loadSession(p.session_id);
  if (!session) return { success: false, error: `Session not found: ${p.session_id}` };
  if (session.status === 'completed') {
    return { success: true, result: { status: 'completed', message: 'Session already completed.' } };
  }

  // If current node is active → return current content (idempotent)
  if (session.node_status === 'active') {
    const chain = loadChainFromSession(session);
    const node = chain.nodes[session.current_node];
    const content = getLastLoadedContent(session, session.current_node);
    return {
      success: true,
      result: {
        session_id: session.session_id,
        current_chain: session.current_chain,
        current_node: session.current_node,
        node_status: 'active',
        ...formatNodeOutput(node, content),
      },
    };
  }

  // If current node is completed → auto-advance (same as done without choice)
  return advanceToNext(session, undefined);
}

// ─── done ────────────────────────────────────────────────────

function cmdDone(p: Params): ToolResult {
  if (!p.session_id) return { success: false, error: 'session_id is required for done' };

  const session = loadSession(p.session_id);
  if (!session) return { success: false, error: `Session not found: ${p.session_id}` };
  if (session.status === 'completed') {
    return { success: true, result: { status: 'completed', message: 'Session already completed.' } };
  }

  // Mark current node as completed
  session.node_status = 'completed';
  session.history.push({
    node_id: session.current_node,
    chain_id: session.current_chain,
    node_type: getNodeType(session),
    node_status: 'completed',
    timestamp: new Date().toISOString(),
    choice: p.choice,
  });

  return advanceToNext(session, p.choice);
}

// ─── status ──────────────────────────────────────────────────

function cmdStatus(p: Params): ToolResult {
  if (!p.session_id) return { success: false, error: 'session_id is required for status' };

  const session = loadSession(p.session_id);
  if (!session) return { success: false, error: `Session not found: ${p.session_id}` };

  return {
    success: true,
    result: {
      session_id: session.session_id,
      skill_name: session.skill_name,
      status: session.status,
      current_chain: session.current_chain,
      current_node: session.current_node,
      node_status: session.node_status,
      chain_stack_depth: session.chain_stack.length,
      history_length: session.history.length,
      loaded_count: session.loaded_content.length,
      started_at: session.started_at,
      updated_at: session.updated_at,
    },
  };
}

// ─── content ─────────────────────────────────────────────────

function cmdContent(p: Params): ToolResult {
  if (!p.session_id) return { success: false, error: 'session_id is required for content' };

  const session = loadSession(p.session_id);
  if (!session) return { success: false, error: `Session not found: ${p.session_id}` };

  return {
    success: true,
    result: {
      session_id: session.session_id,
      entries: session.loaded_content,
      total: session.loaded_content.length,
    },
  };
}

// ─── complete ────────────────────────────────────────────────

function cmdComplete(p: Params): ToolResult {
  if (!p.session_id) return { success: false, error: 'session_id is required for complete' };

  const session = loadSession(p.session_id);
  if (!session) return { success: false, error: `Session not found: ${p.session_id}` };

  session.status = 'completed';
  session.updated_at = new Date().toISOString();
  saveSession(session);

  const stepCount = session.history.filter(h => h.node_type === 'step' && h.node_status === 'completed').length;
  const decisionCount = session.history.filter(h => h.node_type === 'decision' && h.node_status === 'completed').length;

  return {
    success: true,
    result: {
      status: 'completed',
      session_id: session.session_id,
      summary: `Chain completed. ${stepCount} steps, ${decisionCount} decisions.`,
      loaded_content_count: session.loaded_content.length,
    },
  };
}

// ─── Core Logic ──────────────────────────────────────────────

function advanceToNext(session: ChainSession, choice: number | undefined): ToolResult {
  const chain = loadChainFromSession(session);
  const currentNode = chain.nodes[session.current_node];

  if (!currentNode) {
    return { success: false, error: `Node "${session.current_node}" not found in chain "${session.current_chain}"` };
  }

  // Determine next node ID
  let nextNodeId: string | null = null;

  if (currentNode.type === 'step') {
    nextNodeId = currentNode.next;
  } else if (currentNode.type === 'decision') {
    if (choice !== undefined && choice >= 1 && choice <= currentNode.choices.length) {
      nextNodeId = currentNode.choices[choice - 1].next;
    } else {
      nextNodeId = currentNode.default;
    }
  } else if (currentNode.type === 'delegate') {
    // Push current chain onto stack and switch to sub-chain
    const subChainId = currentNode.chain;
    const subChainPath = join(session.skill_path, 'chains', `${subChainId}.json`);
    if (!existsSync(subChainPath)) {
      return { success: false, error: `Delegate chain not found: ${subChainId}` };
    }

    const subChain = loadChainJson(subChainPath);

    // Push frame
    session.chain_stack.push({
      chain_id: session.current_chain,
      return_node: currentNode.next || null,
    });

    // Switch to sub-chain
    session.current_chain = subChain.chain_id;
    session.current_node = subChain.entry;
    session.node_status = 'active';
    session.updated_at = new Date().toISOString();

    const entryNode = subChain.nodes[subChain.entry];
    const content = loadNodeContent(entryNode, session.skill_path);

    session.history.push({
      node_id: subChain.entry,
      chain_id: subChain.chain_id,
      node_type: entryNode.type,
      node_status: 'active',
      timestamp: new Date().toISOString(),
    });

    if (content) {
      session.loaded_content.push({
        node_id: subChain.entry,
        chain_id: subChain.chain_id,
        content,
        loaded_at: new Date().toISOString(),
      });
    }

    saveSession(session);

    return {
      success: true,
      result: {
        session_id: session.session_id,
        current_chain: session.current_chain,
        current_node: session.current_node,
        node_status: 'active',
        delegate_depth: session.chain_stack.length,
        ...formatNodeOutput(entryNode, content),
      },
    };
  }

  // Handle cross-chain routing (→chain-name)
  if (nextNodeId && nextNodeId.startsWith('→')) {
    const targetChainId = nextNodeId.slice(1);
    const targetChainPath = join(session.skill_path, 'chains', `${targetChainId}.json`);
    if (!existsSync(targetChainPath)) {
      return { success: false, error: `Cross-chain target not found: ${targetChainId}` };
    }

    const targetChain = loadChainJson(targetChainPath);
    session.current_chain = targetChain.chain_id;
    session.current_node = targetChain.entry;
    session.node_status = 'active';
    session.updated_at = new Date().toISOString();

    const entryNode = targetChain.nodes[targetChain.entry];
    const content = loadNodeContent(entryNode, session.skill_path);

    session.history.push({
      node_id: targetChain.entry,
      chain_id: targetChain.chain_id,
      node_type: entryNode.type,
      node_status: 'active',
      timestamp: new Date().toISOString(),
    });

    if (content) {
      session.loaded_content.push({
        node_id: targetChain.entry,
        chain_id: targetChain.chain_id,
        content,
        loaded_at: new Date().toISOString(),
      });
    }

    saveSession(session);

    return {
      success: true,
      result: {
        session_id: session.session_id,
        current_chain: session.current_chain,
        current_node: session.current_node,
        node_status: 'active',
        routed_from: chain.chain_id,
        ...formatNodeOutput(entryNode, content),
      },
    };
  }

  // next is null → check chain stack for return
  if (nextNodeId === null || nextNodeId === undefined) {
    if (session.chain_stack.length > 0) {
      const frame = session.chain_stack.pop()!;
      if (frame.return_node) {
        // Return to parent chain's return node
        const parentChainPath = join(session.skill_path, 'chains', `${frame.chain_id}.json`);
        const parentChain = loadChainJson(parentChainPath);

        session.current_chain = frame.chain_id;
        session.current_node = frame.return_node;
        session.node_status = 'active';
        session.updated_at = new Date().toISOString();

        const returnNode = parentChain.nodes[frame.return_node];
        const content = loadNodeContent(returnNode, session.skill_path);

        session.history.push({
          node_id: frame.return_node,
          chain_id: frame.chain_id,
          node_type: returnNode.type,
          node_status: 'active',
          timestamp: new Date().toISOString(),
        });

        if (content) {
          session.loaded_content.push({
            node_id: frame.return_node,
            chain_id: frame.chain_id,
            content,
            loaded_at: new Date().toISOString(),
          });
        }

        saveSession(session);

        return {
          success: true,
          result: {
            session_id: session.session_id,
            current_chain: session.current_chain,
            current_node: session.current_node,
            node_status: 'active',
            returned_from_delegate: true,
            ...formatNodeOutput(returnNode, content),
          },
        };
      }
    }

    // No more nodes, no more stack → session completed
    session.status = 'completed';
    session.updated_at = new Date().toISOString();
    saveSession(session);

    const stepCount = session.history.filter(h => h.node_type === 'step' && h.node_status === 'completed').length;
    const decisionCount = session.history.filter(h => h.node_type === 'decision' && h.node_status === 'completed').length;

    return {
      success: true,
      result: {
        status: 'completed',
        session_id: session.session_id,
        summary: `Chain ${session.current_chain} completed. ${stepCount} steps, ${decisionCount} decisions.`,
      },
    };
  }

  // Advance to next node in current chain
  const nextNode = chain.nodes[nextNodeId];
  if (!nextNode) {
    return { success: false, error: `Next node "${nextNodeId}" not found in chain "${session.current_chain}"` };
  }

  session.current_node = nextNodeId;
  session.node_status = 'active';
  session.updated_at = new Date().toISOString();

  const content = loadNodeContent(nextNode, session.skill_path);

  session.history.push({
    node_id: nextNodeId,
    chain_id: session.current_chain,
    node_type: nextNode.type,
    node_status: 'active',
    timestamp: new Date().toISOString(),
  });

  if (content) {
    session.loaded_content.push({
      node_id: nextNodeId,
      chain_id: session.current_chain,
      content,
      loaded_at: new Date().toISOString(),
    });
  }

  saveSession(session);

  return {
    success: true,
    result: {
      session_id: session.session_id,
      current_chain: session.current_chain,
      current_node: nextNodeId,
      node_status: 'active',
      ...formatNodeOutput(nextNode, content),
    },
  };
}

// ─── Node Helpers ────────────────────────────────────────────

function loadNodeContent(node: ChainNode, skillPath: string): string | null {
  if (node.type === 'step') {
    if (node.content_ref) {
      // Resolve @path relative to skill directory
      const refPath = node.content_ref.replace(/^@/, '');
      const fullPath = resolve(skillPath, refPath);
      if (existsSync(fullPath)) {
        return readFileSync(fullPath, 'utf-8');
      }
      return `[Content not found: ${fullPath}]`;
    }
    if (node.content_inline) {
      return node.content_inline;
    }
    return null;
  }

  if (node.type === 'decision') {
    // Return prompt as content
    return node.prompt;
  }

  if (node.type === 'delegate') {
    return `[Delegate to chain: ${node.chain}]`;
  }

  return null;
}

function formatNodeOutput(node: ChainNode, content: string | null): Record<string, unknown> {
  const output: Record<string, unknown> = {
    type: node.type,
    name: node.name,
  };

  if (node.type === 'step') {
    output.content = content;
  } else if (node.type === 'decision') {
    output.prompt = node.prompt;
    output.choices = node.choices.map((c, i) => ({
      index: i + 1,
      label: c.label,
      description: c.description,
      next: c.next,
    }));
    output.default = node.default;
  } else if (node.type === 'delegate') {
    output.chain = node.chain;
    output.content = content;
  }

  return output;
}

function getNodeType(session: ChainSession): 'step' | 'decision' | 'delegate' {
  try {
    const chain = loadChainFromSession(session);
    const node = chain.nodes[session.current_node];
    return node?.type || 'step';
  } catch {
    return 'step';
  }
}

function getLastLoadedContent(session: ChainSession, nodeId: string): string | null {
  for (let i = session.loaded_content.length - 1; i >= 0; i--) {
    if (session.loaded_content[i].node_id === nodeId) {
      return session.loaded_content[i].content;
    }
  }
  return null;
}

// ─── Chain/Session I/O ───────────────────────────────────────

function loadChainJson(filePath: string): SkillChain {
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as SkillChain;
}

function loadChainFromSession(session: ChainSession): SkillChain {
  const chainPath = join(session.skill_path, 'chains', `${session.current_chain}.json`);
  if (!existsSync(chainPath)) {
    throw new Error(`Chain file not found: ${chainPath}`);
  }
  return loadChainJson(chainPath);
}

function getSessionDir(sessionId: string): string {
  return resolve(process.cwd(), SESSIONS_BASE, sessionId);
}

function saveSession(session: ChainSession): void {
  const dir = getSessionDir(session.session_id);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(join(dir, 'state.json'), JSON.stringify(session, null, 2), 'utf-8');
}

function loadSession(sessionId: string): ChainSession | null {
  const statePath = join(getSessionDir(sessionId), 'state.json');
  if (!existsSync(statePath)) return null;
  return JSON.parse(readFileSync(statePath, 'utf-8')) as ChainSession;
}

// ─── Skill Discovery ────────────────────────────────────────

interface SkillDir {
  skillName: string;
  skillPath: string;
}

/**
 * Auto-detect skill from cwd.
 * Checks if cwd (or a parent up to 3 levels) has a chains/ subdirectory.
 * e.g. cwd = .claude/skills/investigate → detect "investigate"
 */
function detectSkillFromCwd(): SkillDir | null {
  let dir = process.cwd();

  for (let i = 0; i < 4; i++) {
    if (existsSync(join(dir, 'chains'))) {
      const name = dir.replace(/[\\/]+$/, '').split(/[\\/]/).pop()!;
      return { skillName: name, skillPath: dir };
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

/**
 * Resolve skill: explicit name → cwd auto-detect → null
 */
function resolveSkill(skillName?: string): SkillDir | null {
  if (skillName) {
    const path = findSkillPath(skillName);
    return path ? { skillName, skillPath: path } : null;
  }
  return detectSkillFromCwd();
}

function discoverSkillDirs(filterSkill?: string): SkillDir[] {
  const results: SkillDir[] = [];
  const searchLocations = [
    join(process.cwd(), '.claude', 'skills'),
    join(homedir(), '.claude', 'skills'),
  ];

  for (const base of searchLocations) {
    if (!existsSync(base)) continue;
    const entries = readdirSync(base, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (filterSkill && entry.name !== filterSkill) continue;
      const chainsDir = join(base, entry.name, 'chains');
      if (existsSync(chainsDir)) {
        results.push({ skillName: entry.name, skillPath: join(base, entry.name) });
      }
    }
  }

  return results;
}

function findSkillPath(skillName: string): string | null {
  const searchLocations = [
    join(process.cwd(), '.claude', 'skills', skillName),
    join(homedir(), '.claude', 'skills', skillName),
  ];

  for (const path of searchLocations) {
    if (existsSync(path)) return path;
  }
  return null;
}
