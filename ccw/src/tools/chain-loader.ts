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
  PreloadEntry, PreloadedContent, ChainVariable,
} from '../types/chain-types.js';
import { renderChainTopology, renderChainProgress } from '../utils/chain-visualizer.js';
import {
  readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync,
} from 'fs';
import { resolve, join, dirname } from 'path';
import { homedir } from 'os';

// ─── Params ──────────────────────────────────────────────────

const ParamsSchema = z.object({
  cmd: z.enum(['list', 'start', 'next', 'done', 'status', 'content', 'complete', 'inspect', 'visualize']),
  skill: z.string().optional(),
  chain: z.string().optional(),
  session_id: z.string().optional(),
  choice: z.number().optional(),
  node: z.string().optional(),         // start from specific node
  entry_name: z.string().optional(),   // select named entry
});

type Params = z.infer<typeof ParamsSchema>;

// ─── Tool Schema ─────────────────────────────────────────────

export const schema: ToolSchema = {
  name: 'chain_loader',
  description: `Progressive skill chain loader. Auto-detects skill from cwd (cd to skill dir first) or pass skill explicitly.
  list: List chains with triggers/entries. Params: skill? (string)
  inspect: Show chain node graph with topology. Params: chain (string), skill? (string)
  start: Start chain session (resolves preload, initializes variables). Params: chain (string), skill? (string), node? (string), entry_name? (string)
  next: Read current node (idempotent if active, advance if completed). Params: session_id (string)
  done: Complete current node and advance. Params: session_id (string), choice? (number, 1-based for decisions)
  status: Query session state with variables and preload info. Params: session_id (string)
  content: Get all loaded content. Params: session_id (string)
  complete: Mark session completed. Params: session_id (string)
  visualize: Show live execution progress with chain nesting. Params: session_id (string)`,
  inputSchema: {
    type: 'object',
    properties: {
      cmd: { type: 'string', description: 'Command: list|inspect|start|next|done|status|content|complete|visualize' },
      skill: { type: 'string', description: 'Skill name (optional, auto-detected from cwd if omitted)' },
      chain: { type: 'string', description: 'Chain name (for start/inspect)' },
      session_id: { type: 'string', description: 'Session ID (for next/done/status/content/complete)' },
      choice: { type: 'number', description: 'Decision choice index (1-based, for done on decision nodes)' },
      node: { type: 'string', description: 'Start from specific node ID (for start, bypasses entry)' },
      entry_name: { type: 'string', description: 'Named entry point (for start, looks up in chain entries)' },
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
      case 'inspect':  return cmdInspect(p);
      case 'start':    return cmdStart(p);
      case 'next':     return cmdNext(p);
      case 'done':     return cmdDone(p);
      case 'status':   return cmdStatus(p);
      case 'content':  return cmdContent(p);
      case 'complete': return cmdComplete(p);
      case 'visualize': return cmdVisualize(p);
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
    triggers?: { task_types?: string[]; keywords?: string[]; scope?: string };
    entries?: Array<{ name: string; node: string; description: string }>;
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
          ...(chain.triggers ? { triggers: chain.triggers } : {}),
          ...(chain.entries ? { entries: chain.entries } : {}),
        });
      } catch { /* skip invalid chain files */ }
    }
  }

  return { success: true, result: { chains: results, total: results.length } };
}

// ─── inspect ────────────────────────────────────────────────

function cmdInspect(p: Params): ToolResult {
  if (!p.chain) return { success: false, error: 'chain is required for inspect' };

  const resolved = resolveSkill(p.skill);
  if (!resolved) {
    return { success: false, error: p.skill
      ? `Skill not found: ${p.skill}`
      : 'Cannot auto-detect skill from cwd. Pass skill explicitly.' };
  }
  const { skillName, skillPath } = resolved;

  let chainPath = join(skillPath, 'chains', `${p.chain}.json`);
  if (!existsSync(chainPath)) {
    const crossPath = findChainAcrossSkills(p.chain);
    if (!crossPath) {
      return { success: false, error: `Chain not found: ${p.chain} in skill ${skillName}` };
    }
    chainPath = crossPath;
  }

  const chain = loadChainJson(chainPath);
  const nodeList = Object.entries(chain.nodes).map(([id, node]) => {
    const edges: string[] = [];
    if (node.type === 'step') {
      if (node.next) edges.push(node.next);
    } else if (node.type === 'decision') {
      for (const c of node.choices) edges.push(c.next);
    } else if (node.type === 'delegate') {
      if (node.next) edges.push(node.next);
      edges.push(`[delegate:${node.chain}]`);
    }
    return { id, type: node.type, name: node.name, next: edges };
  });

  return {
    success: true,
    result: {
      chain_id: chain.chain_id,
      name: chain.name,
      description: chain.description,
      ...(chain.triggers ? { triggers: chain.triggers } : {}),
      entries: chain.entries || (chain.entry ? [{ name: 'default', node: chain.entry, description: 'Default entry' }] : []),
      node_count: nodeList.length,
      nodes: nodeList,
      topology: renderChainTopology(chain),
    },
  };
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

  let chainPath = join(skillPath, 'chains', `${p.chain}.json`);
  if (!existsSync(chainPath)) {
    const crossPath = findChainAcrossSkills(p.chain);
    if (!crossPath) {
      return { success: false, error: `Chain not found: ${p.chain} in skill ${skillName}` };
    }
    chainPath = crossPath;
  }

  const chain = loadChainJson(chainPath);

  // Resolve entry point: explicit node > entry_name > entries[0] > entry
  const startNode = p.node
    || (p.entry_name && chain.entries?.find(e => e.name === p.entry_name)?.node)
    || (chain.entries?.[0]?.node)
    || chain.entry;

  if (!startNode) {
    return { success: false, error: 'No entry point found. Provide node, entry_name, or define entry/entries in chain.' };
  }
  if (!chain.nodes[startNode]) {
    return { success: false, error: `Node "${startNode}" not found in chain "${chain.chain_id}"` };
  }

  // Generate session ID
  const now = new Date();
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const sessionId = `CL-${skillName}-${timeStr}`;

  // Initialize variables from chain defaults
  const variables: Record<string, unknown> = {};
  if (chain.variables) {
    for (const [key, def] of Object.entries(chain.variables)) {
      if (def.default !== undefined) variables[key] = def.default;
    }
  }

  // Resolve preloads (normalize object format { key: source } to array format)
  const preloaded = resolvePreloads(normalizePreload(chain.preload), skillPath);

  // Create session
  const session: ChainSession = {
    session_id: sessionId,
    skill_name: skillName,
    skill_path: skillPath,
    status: 'active',
    current_chain: chain.chain_id,
    current_node: startNode,
    node_status: 'active',
    chain_stack: [],
    history: [],
    loaded_content: [],
    variables,
    preloaded,
    started_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  // Load entry node content
  const entryNode = chain.nodes[startNode];
  const nodeContent = loadNodeContent(entryNode, skillPath);

  // Record in history
  session.history.push({
    node_id: startNode,
    chain_id: chain.chain_id,
    node_type: entryNode.type,
    node_status: 'active',
    timestamp: now.toISOString(),
  });

  // Add to loaded content
  if (nodeContent) {
    session.loaded_content.push({
      node_id: startNode,
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
      current_node: startNode,
      node_status: 'active',
      preloaded_keys: preloaded.map(p => p.key),
      variables,
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

  // Count total nodes in current chain
  let currentChainTotalNodes = 0;
  try {
    const chain = loadChainFromSession(session);
    currentChainTotalNodes = Object.keys(chain.nodes).length;
  } catch { /* skip */ }

  return {
    success: true,
    result: {
      session_id: session.session_id,
      skill_name: session.skill_name,
      status: session.status,
      current_chain: session.current_chain,
      current_node: session.current_node,
      node_status: session.node_status,
      nesting_depth: session.chain_stack.length,
      current_chain_total_nodes: currentChainTotalNodes,
      chain_stack_depth: session.chain_stack.length,
      history_length: session.history.length,
      loaded_count: session.loaded_content.length,
      preloaded_keys: (session.preloaded || []).map(p => p.key),
      variables: session.variables || {},
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
    let subChainPath = join(session.skill_path, 'chains', `${subChainId}.json`);
    if (!existsSync(subChainPath)) {
      const crossPath = findChainAcrossSkills(subChainId);
      if (!crossPath) {
        return { success: false, error: `Delegate chain not found: ${subChainId}` };
      }
      subChainPath = crossPath;
    }

    const subChain = loadChainJson(subChainPath);

    // Snapshot parent variables and push frame
    const variablesSnapshot = { ...(session.variables || {}) };
    session.chain_stack.push({
      chain_id: session.current_chain,
      return_node: currentNode.next || null,
      variables_snapshot: variablesSnapshot,
    });

    // Pass variables to child scope
    const childVars: Record<string, unknown> = {};
    // Initialize from child chain defaults
    if (subChain.variables) {
      for (const [key, def] of Object.entries(subChain.variables)) {
        if (def.default !== undefined) childVars[key] = def.default;
      }
    }
    // Override with passed parent variables
    const keysToPass = currentNode.pass_variables || Object.keys(session.variables || {});
    for (const key of keysToPass) {
      if (key in (session.variables || {})) {
        childVars[key] = session.variables[key];
      }
    }
    session.variables = childVars;

    // Resolve entry: entry_name from delegate node > chain entries > chain entry
    let subEntry: string;
    if (currentNode.entry_name && subChain.entries) {
      const found = subChain.entries.find(e => e.name === currentNode.entry_name);
      subEntry = found?.node || resolveChainEntry(subChain);
    } else {
      subEntry = resolveChainEntry(subChain);
    }

    session.current_chain = subChain.chain_id;
    session.current_node = subEntry;
    session.node_status = 'active';
    session.updated_at = new Date().toISOString();

    const entryNode = subChain.nodes[subEntry];
    const content = loadNodeContent(entryNode, session.skill_path);

    session.history.push({
      node_id: subEntry,
      chain_id: subChain.chain_id,
      node_type: entryNode.type,
      node_status: 'active',
      timestamp: new Date().toISOString(),
    });

    if (content) {
      session.loaded_content.push({
        node_id: subEntry,
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
        variables: session.variables,
        ...formatNodeOutput(entryNode, content),
      },
    };
  }

  // Handle cross-chain routing (→chain-name)
  if (nextNodeId && nextNodeId.startsWith('→')) {
    const targetChainId = nextNodeId.slice(1);
    let targetChainPath = join(session.skill_path, 'chains', `${targetChainId}.json`);
    if (!existsSync(targetChainPath)) {
      const crossPath = findChainAcrossSkills(targetChainId);
      if (!crossPath) {
        return { success: false, error: `Cross-chain target not found: ${targetChainId}` };
      }
      targetChainPath = crossPath;
    }

    const targetChain = loadChainJson(targetChainPath);
    const targetEntry = resolveChainEntry(targetChain);
    session.current_chain = targetChain.chain_id;
    session.current_node = targetEntry;
    session.node_status = 'active';
    session.updated_at = new Date().toISOString();

    const entryNode = targetChain.nodes[targetEntry];
    const content = loadNodeContent(entryNode, session.skill_path);

    session.history.push({
      node_id: targetEntry,
      chain_id: targetChain.chain_id,
      node_type: entryNode.type,
      node_status: 'active',
      timestamp: new Date().toISOString(),
    });

    if (content) {
      session.loaded_content.push({
        node_id: targetEntry,
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
        let parentChainPath = join(session.skill_path, 'chains', `${frame.chain_id}.json`);
        if (!existsSync(parentChainPath)) {
          const crossPath = findChainAcrossSkills(frame.chain_id);
          if (crossPath) parentChainPath = crossPath;
        }
        const parentChain = loadChainJson(parentChainPath);

        // Receive variables from child back to parent
        const childVars = { ...(session.variables || {}) };
        const parentVars = { ...(frame.variables_snapshot || {}) };

        // Find the delegate node that spawned this child to get receive_variables
        const delegateNode = findDelegateNodeForChain(parentChain, session.current_chain);
        const receiveKeys = delegateNode?.receive_variables;

        if (receiveKeys) {
          for (const key of receiveKeys) {
            if (key in childVars) parentVars[key] = childVars[key];
          }
        }
        session.variables = parentVars;

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
            variables: session.variables,
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

// ─── Entry Resolver ─────────────────────────────────────────

function resolveChainEntry(chain: SkillChain): string {
  return chain.entries?.[0]?.node || chain.entry || Object.keys(chain.nodes)[0];
}

// ─── Node Helpers ────────────────────────────────────────────

function loadNodeContent(node: ChainNode, skillPath: string): string | null {
  if (node.type === 'step') {
    const parts: string[] = [];

    // 1. content_files: multiple file references, resolved in order
    if (node.content_files?.length) {
      for (const ref of node.content_files) {
        const content = resolveFileRef(ref, skillPath);
        if (content !== null) parts.push(content);
      }
    }

    // 2. content_ref: single file reference (backward compat)
    if (node.content_ref) {
      const content = resolveFileRef(node.content_ref, skillPath);
      if (content !== null) parts.push(content);
    }

    // 3. content_inline: direct text with embedded @ref expansion
    if (node.content_inline) {
      parts.push(resolveInlineRefs(node.content_inline, skillPath));
    }

    return parts.length > 0 ? parts.join('\n\n') : null;
  }

  if (node.type === 'decision') {
    return node.prompt;
  }

  if (node.type === 'delegate') {
    return `[Delegate to chain: ${node.chain}]`;
  }

  return null;
}

/**
 * Resolve a single @file reference to its content.
 * Supports: @path/file.md (skill-relative), @~/path/file.md (home-relative)
 */
function resolveFileRef(ref: string, skillPath: string): string | null {
  try {
    const raw = ref.replace(/^@/, '');
    if (raw.startsWith('~/')) {
      const fullPath = resolve(homedir(), raw.slice(2));
      if (existsSync(fullPath)) return readFileSync(fullPath, 'utf-8');
    } else if (raw.startsWith('skills/')) {
      // @skills/workflow-plan/phases/01.md → .claude/skills/workflow-plan/phases/01.md
      const relPath = raw.slice(7);
      const projectPath = resolve(process.cwd(), '.claude', 'skills', relPath);
      if (existsSync(projectPath)) return readFileSync(projectPath, 'utf-8');
      const userPath = resolve(homedir(), '.claude', 'skills', relPath);
      if (existsSync(userPath)) return readFileSync(userPath, 'utf-8');
    } else if (raw.startsWith('commands/')) {
      // @commands/workflow/analyze-with-file.md → .claude/commands/workflow/analyze-with-file.md
      const relPath = raw.slice(9);
      const projectPath = resolve(process.cwd(), '.claude', 'commands', relPath);
      if (existsSync(projectPath)) return readFileSync(projectPath, 'utf-8');
      const userPath = resolve(homedir(), '.claude', 'commands', relPath);
      if (existsSync(userPath)) return readFileSync(userPath, 'utf-8');
    } else {
      const fullPath = resolve(skillPath, raw);
      if (existsSync(fullPath)) return readFileSync(fullPath, 'utf-8');
    }
    return `[Content not found: ${ref}]`;
  } catch {
    return `[Error loading: ${ref}]`;
  }
}

/**
 * Expand embedded @file references in inline content.
 * Pattern: @path/to/file.md (must end with file extension)
 * Supports: @skill-relative/path.md, @~/home-relative/path.md
 * Skips @-references inside code blocks.
 */
function resolveInlineRefs(text: string, skillPath: string): string {
  // Match @skills/path.ext, @~/path/file.ext, or @path/file.ext — must have at least one / and end with .ext
  return text.replace(/@((?:skills|commands|~)?\/[\w./-]+\.\w+)/g, (match, refPath: string) => {
    try {
      let fullPath: string;
      if (refPath.startsWith('skills/')) {
        const relPath = refPath.slice(7);
        const projectPath = resolve(process.cwd(), '.claude', 'skills', relPath);
        if (existsSync(projectPath)) return readFileSync(projectPath, 'utf-8');
        const userPath = resolve(homedir(), '.claude', 'skills', relPath);
        if (existsSync(userPath)) return readFileSync(userPath, 'utf-8');
        return match;
      } else if (refPath.startsWith('commands/')) {
        const relPath = refPath.slice(9);
        const projectPath = resolve(process.cwd(), '.claude', 'commands', relPath);
        if (existsSync(projectPath)) return readFileSync(projectPath, 'utf-8');
        const userPath = resolve(homedir(), '.claude', 'commands', relPath);
        if (existsSync(userPath)) return readFileSync(userPath, 'utf-8');
        return match;
      } else if (refPath.startsWith('~/')) {
        fullPath = resolve(homedir(), refPath.slice(2));
      } else {
        fullPath = resolve(skillPath, refPath.startsWith('/') ? refPath.slice(1) : refPath);
      }
      if (existsSync(fullPath)) return readFileSync(fullPath, 'utf-8');
    } catch { /* fall through */ }
    return match; // leave unresolved references as-is
  });
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
  if (existsSync(chainPath)) return loadChainJson(chainPath);
  const crossPath = findChainAcrossSkills(session.current_chain);
  if (crossPath) return loadChainJson(crossPath);
  throw new Error(`Chain file not found: ${chainPath}`);
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
    join(process.cwd(), '.claude', 'workflow-skills'),
    join(homedir(), '.claude', 'skills'),
    join(homedir(), '.claude', 'workflow-skills'),
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

// ─── visualize ─────────────────────────────────────────────

function cmdVisualize(p: Params): ToolResult {
  if (!p.session_id) return { success: false, error: 'session_id is required for visualize' };

  const session = loadSession(p.session_id);
  if (!session) return { success: false, error: `Session not found: ${p.session_id}` };

  // Load all chains referenced in session (current + stack)
  const chains = new Map<string, SkillChain>();
  const chainIds = new Set<string>([session.current_chain]);
  for (const frame of session.chain_stack) chainIds.add(frame.chain_id);

  for (const chainId of chainIds) {
    try {
      const chainPath = join(session.skill_path, 'chains', `${chainId}.json`);
      if (existsSync(chainPath)) {
        chains.set(chainId, loadChainJson(chainPath));
      } else {
        const crossPath = findChainAcrossSkills(chainId);
        if (crossPath) chains.set(chainId, loadChainJson(crossPath));
      }
    } catch { /* skip unloadable */ }
  }

  const visualization = renderChainProgress(session, chains);
  const completed = session.history.filter(h => h.node_status === 'completed').length;
  let total = 0;
  for (const chain of chains.values()) total += Object.keys(chain.nodes).length;

  return {
    success: true,
    result: {
      visualization,
      nesting_depth: session.chain_stack.length,
      progress: { completed, total },
    },
  };
}

// ─── Preload Resolver ─────────────────────────────────────

/**
 * Normalize preload from either format:
 * - Array: [{ key, source, required? }]  (typed format)
 * - Object: { key: source }              (shorthand in chain JSON)
 */
function normalizePreload(preload: unknown): PreloadEntry[] {
  if (!preload) return [];
  if (Array.isArray(preload)) return preload;
  if (typeof preload === 'object') {
    return Object.entries(preload as Record<string, string>).map(([key, source]) => ({
      key,
      source: typeof source === 'string' ? source : String(source),
    }));
  }
  return [];
}

function resolvePreloads(entries: PreloadEntry[], skillPath: string): PreloadedContent[] {
  const results: PreloadedContent[] = [];
  for (const entry of entries) {
    const content = resolvePreloadSource(entry.source, skillPath);
    if (content !== null) {
      results.push({
        key: entry.key,
        content,
        source: entry.source,
        loaded_at: new Date().toISOString(),
      });
    } else if (entry.required !== false) {
      results.push({
        key: entry.key,
        content: `[WARN: Failed to load required preload: ${entry.source}]`,
        source: entry.source,
        loaded_at: new Date().toISOString(),
      });
    }
  }
  return results;
}

function resolvePreloadSource(source: string, skillPath: string): string | null {
  try {
    if (source.startsWith('$env:')) {
      const varName = source.slice(5);
      return process.env[varName] || null;
    }
    if (source.startsWith('memory:')) {
      const memFile = source.slice(7);
      const memPath = resolve(process.cwd(), 'memory', memFile);
      if (existsSync(memPath)) return readFileSync(memPath, 'utf-8');
      return null;
    }
    if (source.startsWith('@~/')) {
      const relPath = source.slice(3);
      const fullPath = resolve(homedir(), relPath);
      if (existsSync(fullPath)) return readFileSync(fullPath, 'utf-8');
      return null;
    }
    if (source.startsWith('@skills/')) {
      const relPath = source.slice(8);
      const projectPath = resolve(process.cwd(), '.claude', 'skills', relPath);
      if (existsSync(projectPath)) return readFileSync(projectPath, 'utf-8');
      const userPath = resolve(homedir(), '.claude', 'skills', relPath);
      if (existsSync(userPath)) return readFileSync(userPath, 'utf-8');
      return null;
    }
    if (source.startsWith('@')) {
      const relPath = source.slice(1);
      const fullPath = resolve(skillPath, relPath);
      if (existsSync(fullPath)) return readFileSync(fullPath, 'utf-8');
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Delegate Helper ─────────────────────────────────────

function findDelegateNodeForChain(parentChain: SkillChain, childChainId: string): DelegateNode | null {
  for (const node of Object.values(parentChain.nodes)) {
    if (node.type === 'delegate' && node.chain === childChainId) {
      return node;
    }
  }
  return null;
}

function findSkillPath(skillName: string): string | null {
  const searchLocations = [
    join(process.cwd(), '.claude', 'skills', skillName),
    join(process.cwd(), '.claude', 'workflow-skills', skillName),
    join(homedir(), '.claude', 'skills', skillName),
    join(homedir(), '.claude', 'workflow-skills', skillName),
  ];

  for (const path of searchLocations) {
    if (existsSync(path)) return path;
  }
  return null;
}

function findChainAcrossSkills(chainId: string): string | null {
  const bases = [
    join(process.cwd(), '.claude', 'workflow-skills'),
    join(process.cwd(), '.claude', 'skills'),
    join(homedir(), '.claude', 'workflow-skills'),
    join(homedir(), '.claude', 'skills'),
  ];
  for (const base of bases) {
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const path = join(base, entry.name, 'chains', `${chainId}.json`);
      if (existsSync(path)) return path;
    }
  }
  return null;
}
