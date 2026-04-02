/**
 * Chain Loader Types - Progressive skill chain execution with LLM-driven decisions.
 */

// ─── Preload & Variables ─────────────────────────────────────

/** Content loaded once at chain start, available to all nodes */
export interface PreloadEntry {
  key: string;           // lookup key (e.g. "memory", "coding-philosophy")
  source: string;        // @path/file.md | @~/path | memory:MEMORY.md | $env:VAR
  required?: boolean;    // default true; false = missing is warning not error
}

/** Typed variable with default, passed across delegation */
export interface ChainVariable {
  type: 'string' | 'number' | 'boolean';
  default?: unknown;
  description?: string;
}

/** Runtime preloaded content */
export interface PreloadedContent {
  key: string;
  content: string;
  source: string;
  loaded_at: string;
}

// ─── Chain JSON Structure ────────────────────────────────────

export interface ChainTriggers {
  task_types?: string[];   // e.g. ["bugfix", "bugfix-hotfix"]
  keywords?: string[];     // regex patterns: ["fix|bug|error"]
  scope?: string;          // "Level 2: rapid, bugfix, hotfix, docs"
}

export interface ChainEntry {
  name: string;            // e.g. "default", "skip-analysis"
  node: string;            // node ID
  description: string;     // when to use this entry
}

export interface SkillChain {
  chain_id: string;
  name: string;
  description: string;
  version: string;
  entry?: string;              // single entry (backward compat)
  entries?: ChainEntry[];      // multiple named entry points
  triggers?: ChainTriggers;    // self-describing trigger conditions
  preload?: PreloadEntry[];    // content loaded at chain start
  variables?: Record<string, ChainVariable>;  // typed variables with defaults
  nodes: Record<string, ChainNode>;
}

export type ChainNode = StepNode | DecisionNode | DelegateNode;

export interface StepNode {
  type: 'step';
  name: string;
  content_ref?: string;      // @phases/01-xxx.md → resolve relative to skill dir
  content_inline?: string;   // direct text; supports embedded @path/file.md references (auto-expanded)
  content_files?: string[];  // multiple @file paths, each resolved and concatenated as content
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
  entry_name?: string;   // target named entry in sub-chain
  pass_variables?: string[];    // variable keys to pass to child
  receive_variables?: string[]; // variable keys to receive back from child
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
  variables: Record<string, unknown>;
  preloaded: PreloadedContent[];
  started_at: string;
  updated_at: string;
}

export interface ChainFrame {
  chain_id: string;
  return_node: string | null;
  variables_snapshot?: Record<string, unknown>;
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
