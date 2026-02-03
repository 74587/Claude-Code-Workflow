// ========================================
// Node Components Barrel Export
// ========================================

// Shared wrapper component
export { NodeWrapper } from './NodeWrapper';

// Custom node components
export { SlashCommandNode } from './SlashCommandNode';
export { FileOperationNode } from './FileOperationNode';
export { ConditionalNode } from './ConditionalNode';
export { ParallelNode } from './ParallelNode';
export { CliCommandNode } from './CliCommandNode';
export { PromptNode } from './PromptNode';

// Node types map for React Flow registration
import { SlashCommandNode } from './SlashCommandNode';
import { FileOperationNode } from './FileOperationNode';
import { ConditionalNode } from './ConditionalNode';
import { ParallelNode } from './ParallelNode';
import { CliCommandNode } from './CliCommandNode';
import { PromptNode } from './PromptNode';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const nodeTypes: Record<string, any> = {
  'slash-command': SlashCommandNode,
  'file-operation': FileOperationNode,
  conditional: ConditionalNode,
  parallel: ParallelNode,
  'cli-command': CliCommandNode,
  prompt: PromptNode,
};
