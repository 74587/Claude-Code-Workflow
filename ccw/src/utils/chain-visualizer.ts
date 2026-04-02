/**
 * Chain Visualizer - Terminal ASCII visualization for chain topology and progress.
 */

import chalk from 'chalk';
import type { SkillChain, ChainSession, ChainNode } from '../types/chain-types.js';

/**
 * Render static topology of a chain as ASCII graph.
 */
export function renderChainTopology(chain: SkillChain): string {
  const lines: string[] = [];
  const nodeCount = Object.keys(chain.nodes).length;
  lines.push(`${chain.chain_id} [${nodeCount} nodes]`);
  lines.push('='.repeat(48));

  if (chain.preload?.length) {
    lines.push(`Preload: ${chain.preload.map(p => p.key).join(', ')}`);
  }
  if (chain.variables) {
    const vars = Object.entries(chain.variables).map(([k, v]) => `${k}:${v.type}`);
    lines.push(`Variables: ${vars.join(', ')}`);
  }
  if (chain.preload?.length || chain.variables) lines.push('');

  for (const [id, node] of Object.entries(chain.nodes)) {
    const prefix = node.type === 'decision' ? `<${id}>` : `[${id}]`;
    const typeLabel = node.type;
    const edges = getNodeEdges(node);
    const isEnd = edges.length === 0 || (edges.length === 1 && edges[0] === null);

    lines.push(`${prefix} ${node.name} ${'·'.repeat(Math.max(1, 40 - prefix.length - node.name.length))} ${typeLabel}${isEnd ? '  [end]' : ''}`);

    if (node.type === 'decision') {
      for (const choice of node.choices) {
        lines.push(`  |-- ${choice.label} --> ${choice.next}`);
      }
    } else if (node.type === 'delegate') {
      lines.push(`  |>> delegate → ${node.chain}${node.entry_name ? `:${node.entry_name}` : ''}`);
      if (node.next) lines.push(`  |<< return → ${node.next}`);
    } else if (node.type === 'step' && node.next) {
      lines.push(`  |`);
    }
  }

  return lines.join('\n');
}

/**
 * Render live execution progress for a session.
 */
export function renderChainProgress(
  session: ChainSession,
  chains: Map<string, SkillChain>,
): string {
  const lines: string[] = [];
  const depth = session.chain_stack.length;

  lines.push(chalk.bold(`Chain Progress [${session.session_id}] depth: ${depth}`));
  lines.push('='.repeat(48));

  // Show variables if any
  const varKeys = Object.keys(session.variables);
  if (varKeys.length > 0) {
    const varStr = varKeys.map(k => `${k}=${JSON.stringify(session.variables[k]) ?? 'null'}`).join(', ');
    lines.push(chalk.dim(`vars: ${varStr}`));
    lines.push('');
  }

  // Build stack display: parent chains first, current chain last
  const stackDisplay: Array<{ chainId: string; indent: number }> = [];
  for (let i = 0; i < session.chain_stack.length; i++) {
    stackDisplay.push({ chainId: session.chain_stack[i].chain_id, indent: i });
  }
  stackDisplay.push({ chainId: session.current_chain, indent: session.chain_stack.length });

  for (const { chainId, indent } of stackDisplay) {
    const chain = chains.get(chainId);
    if (!chain) {
      lines.push(`${'  '.repeat(indent)}${chainId} (not loaded)`);
      continue;
    }

    const pad = '  '.repeat(indent);
    const isCurrent = chainId === session.current_chain;
    lines.push(`${pad}${isCurrent ? chalk.bold.cyan(chainId) : chalk.dim(chainId)}`);

    if (!isCurrent) {
      // For parent chains, show where they delegated
      const frame = session.chain_stack.find(f => f.chain_id === chainId);
      if (frame) {
        // Find completed nodes from history for this chain
        const chainHistory = session.history.filter(h => h.chain_id === chainId);
        for (const h of chainHistory) {
          const node = chain.nodes[h.node_id];
          if (!node) continue;
          const label = formatNodeLabel(h.node_id, node);
          if (h.node_status === 'completed') {
            lines.push(`${pad}  ${chalk.green('[done]')} ${label}${h.choice ? ` (choice: ${getChoiceLabel(node, h.choice)})` : ''}`);
          } else {
            lines.push(`${pad}  ${chalk.yellow('[....]')} ${label}`);
          }
        }
        lines.push(`${pad}    |`);
        lines.push(`${pad}    v delegate`);
      }
      continue;
    }

    // Current chain: show all nodes in execution order
    const visited = new Set(session.history.filter(h => h.chain_id === chainId).map(h => h.node_id));
    const completedNodes = new Set(
      session.history.filter(h => h.chain_id === chainId && h.node_status === 'completed').map(h => h.node_id),
    );

    for (const [nodeId, node] of Object.entries(chain.nodes)) {
      const label = formatNodeLabel(nodeId, node);

      if (nodeId === session.current_node && session.node_status === 'active') {
        lines.push(`${pad}  ${chalk.yellow.bold('[>>>>]')} ${chalk.yellow.bold(label)}    <-- current`);
      } else if (completedNodes.has(nodeId)) {
        const histEntry = session.history.find(h => h.chain_id === chainId && h.node_id === nodeId && h.node_status === 'completed');
        const choiceStr = histEntry?.choice ? ` (choice: ${getChoiceLabel(node, histEntry.choice)})` : '';
        lines.push(`${pad}  ${chalk.green('[done]')} ${label}${choiceStr}`);
      } else if (visited.has(nodeId)) {
        lines.push(`${pad}  ${chalk.yellow('[....]')} ${label}`);
      } else {
        lines.push(`${pad}  ${chalk.gray('[    ]')} ${chalk.gray(label)}`);
      }
    }
  }

  // Summary
  const completed = session.history.filter(h => h.node_status === 'completed').length;
  const total = getTotalNodes(session, chains);
  lines.push('');
  lines.push(chalk.dim(`Progress: ${completed}/${total} nodes completed`));

  return lines.join('\n');
}

function formatNodeLabel(nodeId: string, node: ChainNode): string {
  const prefix = node.type === 'decision' ? `<${nodeId}>` : `[${nodeId}]`;
  return `${prefix} ${node.name}`;
}

function getChoiceLabel(node: ChainNode, choice: number): string {
  if (node.type === 'decision' && choice >= 1 && choice <= node.choices.length) {
    return node.choices[choice - 1].label;
  }
  return String(choice);
}

function getNodeEdges(node: ChainNode): (string | null)[] {
  if (node.type === 'step') return [node.next];
  if (node.type === 'decision') return node.choices.map(c => c.next);
  if (node.type === 'delegate') return [node.next ?? null];
  return [];
}

function getTotalNodes(session: ChainSession, chains: Map<string, SkillChain>): number {
  let total = 0;
  const seen = new Set<string>();

  // Count current chain
  const current = chains.get(session.current_chain);
  if (current) {
    total += Object.keys(current.nodes).length;
    seen.add(session.current_chain);
  }

  // Count parent chains in stack
  for (const frame of session.chain_stack) {
    if (seen.has(frame.chain_id)) continue;
    seen.add(frame.chain_id);
    const chain = chains.get(frame.chain_id);
    if (chain) total += Object.keys(chain.nodes).length;
  }

  return total;
}
