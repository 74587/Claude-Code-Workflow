// ========================================
// Node Components Barrel Export
// ========================================

export { ModuleNode } from './ModuleNode';
export { ClassNode } from './ClassNode';
export { FunctionNode } from './FunctionNode';
export { VariableNode } from './VariableNode';

import { ModuleNode } from './ModuleNode';
import { ClassNode } from './ClassNode';
import { FunctionNode } from './FunctionNode';
import { VariableNode } from './VariableNode';

// Node types map for React Flow registration
export const nodeTypes = {
  module: ModuleNode,
  class: ClassNode,
  function: FunctionNode,
  variable: VariableNode,
  component: ModuleNode,  // Reuse ModuleNode for components
  interface: ClassNode,    // Reuse ClassNode for interfaces
  file: ModuleNode,        // Reuse ModuleNode for files
  folder: ModuleNode,      // Reuse ModuleNode for folders
  dependency: ModuleNode,  // Reuse ModuleNode for dependencies
  api: ModuleNode,         // Reuse ModuleNode for APIs
  database: ModuleNode,    // Reuse ModuleNode for databases
  service: ModuleNode,     // Reuse ModuleNode for services
  hook: FunctionNode,      // Reuse FunctionNode for hooks
  utility: FunctionNode,   // Reuse FunctionNode for utilities
  unknown: ModuleNode,     // Reuse ModuleNode for unknown types
};
