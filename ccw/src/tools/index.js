/**
 * Tool Registry - MCP-like tool system for CCW
 * Provides tool discovery, validation, and execution
 */

import { editFileTool } from './edit-file.js';
import { getModulesByDepthTool } from './get-modules-by-depth.js';
import { classifyFoldersTool } from './classify-folders.js';
import { detectChangedModulesTool } from './detect-changed-modules.js';
import { discoverDesignFilesTool } from './discover-design-files.js';
import { generateModuleDocsTool } from './generate-module-docs.js';
import { uiGeneratePreviewTool } from './ui-generate-preview.js';
import { uiInstantiatePrototypesTool } from './ui-instantiate-prototypes.js';
import { updateModuleClaudeTool } from './update-module-claude.js';
import { convertTokensToCssTool } from './convert-tokens-to-css.js';

// Tool registry - add new tools here
const tools = new Map();

/**
 * Register a tool in the registry
 * @param {Object} tool - Tool definition
 */
function registerTool(tool) {
  if (!tool.name || !tool.execute) {
    throw new Error('Tool must have name and execute function');
  }
  tools.set(tool.name, tool);
}

/**
 * Get all registered tools
 * @returns {Array<Object>} - Array of tool definitions (without execute function)
 */
export function listTools() {
  return Array.from(tools.values()).map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }));
}

/**
 * Get a specific tool by name
 * @param {string} name - Tool name
 * @returns {Object|null} - Tool definition or null
 */
export function getTool(name) {
  return tools.get(name) || null;
}

/**
 * Validate parameters against tool schema
 * @param {Object} tool - Tool definition
 * @param {Object} params - Parameters to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateParams(tool, params) {
  const errors = [];
  const schema = tool.parameters;

  if (!schema || !schema.properties) {
    return { valid: true, errors: [] };
  }

  // Check required parameters
  const required = schema.required || [];
  for (const req of required) {
    if (params[req] === undefined || params[req] === null) {
      errors.push(`Missing required parameter: ${req}`);
    }
  }

  // Type validation
  for (const [key, value] of Object.entries(params)) {
    const propSchema = schema.properties[key];
    if (!propSchema) {
      continue; // Allow extra params
    }

    if (propSchema.type === 'string' && typeof value !== 'string') {
      errors.push(`Parameter '${key}' must be a string`);
    }
    if (propSchema.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`Parameter '${key}' must be a boolean`);
    }
    if (propSchema.type === 'number' && typeof value !== 'number') {
      errors.push(`Parameter '${key}' must be a number`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Execute a tool with given parameters
 * @param {string} name - Tool name
 * @param {Object} params - Tool parameters
 * @returns {Promise<{success: boolean, result?: any, error?: string}>}
 */
export async function executeTool(name, params = {}) {
  const tool = tools.get(name);

  if (!tool) {
    return {
      success: false,
      error: `Tool not found: ${name}`
    };
  }

  // Validate parameters
  const validation = validateParams(tool, params);
  if (!validation.valid) {
    return {
      success: false,
      error: `Parameter validation failed: ${validation.errors.join(', ')}`
    };
  }

  // Execute tool
  try {
    const result = await tool.execute(params);
    return {
      success: true,
      result
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Tool execution failed'
    };
  }
}

/**
 * Get tool schema in MCP-compatible format
 * @param {string} name - Tool name
 * @returns {Object|null} - Tool schema or null
 */
export function getToolSchema(name) {
  const tool = tools.get(name);
  if (!tool) return null;

  return {
    name: tool.name,
    description: tool.description,
    inputSchema: {
      type: 'object',
      properties: tool.parameters?.properties || {},
      required: tool.parameters?.required || []
    }
  };
}

/**
 * Get all tool schemas in MCP-compatible format
 * @returns {Array<Object>} - Array of tool schemas
 */
export function getAllToolSchemas() {
  return Array.from(tools.keys()).map(name => getToolSchema(name));
}

// Register built-in tools
registerTool(editFileTool);
registerTool(getModulesByDepthTool);
registerTool(classifyFoldersTool);
registerTool(detectChangedModulesTool);
registerTool(discoverDesignFilesTool);
registerTool(generateModuleDocsTool);
registerTool(uiGeneratePreviewTool);
registerTool(uiInstantiatePrototypesTool);
registerTool(updateModuleClaudeTool);
registerTool(convertTokensToCssTool);

// Export for external tool registration
export { registerTool };
