// ========================================
// Node Components Barrel Export
// ========================================
// Unified PromptTemplate node system

// Shared wrapper component
export { NodeWrapper } from './NodeWrapper';

// Unified prompt template node component
export { PromptTemplateNode } from './PromptTemplateNode';

// Node types map for React Flow registration
import { PromptTemplateNode } from './PromptTemplateNode';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const nodeTypes: Record<string, any> = {
  'prompt-template': PromptTemplateNode,
};
