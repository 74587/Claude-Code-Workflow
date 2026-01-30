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

// Node types map for React Flow registration
import { SlashCommandNode } from './SlashCommandNode';
import { FileOperationNode } from './FileOperationNode';
import { ConditionalNode } from './ConditionalNode';
import { ParallelNode } from './ParallelNode';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const nodeTypes: Record<string, any> = {
  'slash-command': SlashCommandNode,
  'file-operation': FileOperationNode,
  conditional: ConditionalNode,
  parallel: ParallelNode,
};
