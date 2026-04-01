/**
 * Chain Loader Types - Progressive skill chain execution with LLM-driven decisions.
 */

// ─── Chain JSON Structure ────────────────────────────────────

export interface SkillChain {
  chain_id: string;
  name: string;
  description: string;
  version: string;
  entry: string;
  nodes: Record<string, ChainNode>;
}

export type ChainNode = StepNode | DecisionNode | DelegateNode;

export interface StepNode {
  type: 'step';
  name: string;
  content_ref?: string;    // @phases/01-xxx.md → resolve relative to skill dir
  content_inline?: string; // direct text
  next: string | null;
}

export interface DecisionNode {
  type: 'decision';
  name: string;
  prompt: string;
  choices: DecisionChoice[];
  default: string;
}

export interface DecisionChoice {
  label: string;
  description: string;
  next: string; // node ID or "→chain_id" for cross-chain routing
}

export interface DelegateNode {
  type: 'delegate';
  name: string;
  chain: string;         // chain JSON filename (without .json) in same skill
  next?: string | null;  // return node after sub-chain completes
}

// ─── Session State ───────────────────────────────────────────

export type SessionStatus = 'active' | 'completed';
export type NodeStatus = 'pending' | 'active' | 'completed';

export interface ChainSession {
  session_id: string;
  skill_name: string;
  skill_path: string;
  status: SessionStatus;
  current_chain: string;
  current_node: string;
  node_status: NodeStatus;
  chain_stack: ChainFrame[];
  history: StepRecord[];
  loaded_content: LoadedEntry[];
  started_at: string;
  updated_at: string;
}

export interface ChainFrame {
  chain_id: string;
  return_node: string | null;
}

export interface StepRecord {
  node_id: string;
  chain_id: string;
  node_type: 'step' | 'decision' | 'delegate';
  node_status: NodeStatus;
  timestamp: string;
  choice?: number;
}

export interface LoadedEntry {
  node_id: string;
  chain_id: string;
  content: string;
  loaded_at: string;
}
