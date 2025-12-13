/**
 * Tool Command - Execute and manage CCW tools
 */

import chalk from 'chalk';
import { listTools, executeTool, getTool, getAllToolSchemas } from '../tools/index.js';

/**
 * List all available tools
 */
async function listAction() {
  const tools = listTools();

  if (tools.length === 0) {
    console.log(chalk.yellow('No tools registered'));
    return;
  }

  console.log(chalk.bold.cyan('\nAvailable Tools:\n'));

  for (const tool of tools) {
    console.log(chalk.bold.white(`  ${tool.name}`));
    console.log(chalk.gray(`    ${tool.description}`));

    if (tool.parameters?.properties) {
      const props = tool.parameters.properties;
      const required = tool.parameters.required || [];

      console.log(chalk.gray('    Parameters:'));
      for (const [name, schema] of Object.entries(props)) {
        const req = required.includes(name) ? chalk.red('*') : '';
        const defaultVal = schema.default !== undefined ? chalk.gray(` (default: ${schema.default})`) : '';
        console.log(chalk.gray(`      - ${name}${req}: ${schema.description}${defaultVal}`));
      }
    }
    console.log();
  }
}

/**
 * Show tool schema in MCP-compatible JSON format
 */
async function schemaAction(options) {
  const { name } = options;

  if (name) {
    const tool = getTool(name);
    if (!tool) {
      console.error(chalk.red(`Tool not found: ${name}`));
      process.exit(1);
    }

    const schema = {
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: 'object',
        properties: tool.parameters?.properties || {},
        required: tool.parameters?.required || []
      }
    };
    console.log(JSON.stringify(schema, null, 2));
  } else {
    const schemas = getAllToolSchemas();
    console.log(JSON.stringify({ tools: schemas }, null, 2));
  }
}

/**
 * Execute a tool with given parameters
 * @param {string} toolName - Tool name
 * @param {string|undefined} jsonParams - JSON string of parameters
 * @param {Object} options - CLI options
 */
async function execAction(toolName, jsonParams, options) {
  if (!toolName) {
    console.error(chalk.red('Tool name is required'));
    console.error(chalk.gray('Usage: ccw tool exec <tool_name> \'{"param": "value"}\''));
    console.error(chalk.gray('       ccw tool exec edit_file --path file.txt --old "old" --new "new"'));
    console.error(chalk.gray('       ccw tool exec codex_lens --action search --query "pattern"'));
    process.exit(1);
  }

  const tool = getTool(toolName);
  if (!tool) {
    console.error(chalk.red(`Tool not found: ${toolName}`));
    console.error(chalk.gray('Use "ccw tool list" to see available tools'));
    process.exit(1);
  }

  // Build params from CLI options or JSON
  let params = {};

  // Check if JSON params provided
  if (jsonParams && jsonParams.trim().startsWith('{')) {
    try {
      params = JSON.parse(jsonParams);
    } catch (e) {
      console.error(chalk.red('Invalid JSON parameters'));
      console.error(chalk.gray(`Parse error: ${e.message}`));
      process.exit(1);
    }
  } else if (toolName === 'edit_file') {
    // Parameter mode for edit_file
    if (!options.path || !options.old || !options.new) {
      console.error(chalk.red('edit_file requires --path, --old, and --new parameters'));
      console.error(chalk.gray('Usage: ccw tool exec edit_file --path file.txt --old "old text" --new "new text"'));
      process.exit(1);
    }
    params.path = options.path;
    params.oldText = options.old;
    params.newText = options.new;
  } else if (toolName === 'codex_lens') {
    // Parameter mode for codex_lens
    if (!options.action) {
      console.error(chalk.red('codex_lens requires --action parameter'));
      console.error(chalk.gray('Usage: ccw tool exec codex_lens --action search --query "pattern" --path .'));
      console.error(chalk.gray('Actions: init, search, search_files, symbol, status, update, bootstrap, check'));
      process.exit(1);
    }
    params.action = options.action;
    if (options.path) params.path = options.path;
    if (options.query) params.query = options.query;
    if (options.limit) params.limit = parseInt(options.limit, 10);
    if (options.file) params.file = options.file;
    if (options.files) params.files = options.files.split(',').map(f => f.trim());
    if (options.languages) params.languages = options.languages.split(',').map(l => l.trim());
  } else if (jsonParams) {
    // Non-JSON string provided but not for supported tools
    console.error(chalk.red('Parameters must be valid JSON'));
    console.error(chalk.gray(`Usage: ccw tool exec ${toolName} '{"param": "value"}'`));
    process.exit(1);
  }
  // If no params provided, use empty object (tool may have defaults)

  // Execute tool
  const result = await executeTool(toolName, params);

  // Always output JSON
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Tool command entry point
 * @param {string} subcommand - Subcommand (list, schema, exec)
 * @param {string[]} args - Arguments array [toolName, jsonParams, ...]
 * @param {Object} options - CLI options
 */
export async function toolCommand(subcommand, args, options) {
  // args is now an array due to [args...] in cli.js
  const argsArray = Array.isArray(args) ? args : (args ? [args] : []);

  // Handle subcommands
  switch (subcommand) {
    case 'list':
      await listAction();
      break;
    case 'schema':
      await schemaAction({ name: argsArray[0] });
      break;
    case 'exec':
      await execAction(argsArray[0], argsArray[1], options);
      break;
    default:
      console.log(chalk.bold.cyan('\nCCW Tool System\n'));
      console.log('Subcommands:');
      console.log(chalk.gray('  list              List all available tools'));
      console.log(chalk.gray('  schema [name]     Show tool schema (JSON)'));
      console.log(chalk.gray('  exec <name>       Execute a tool'));
      console.log();
      console.log('Usage:');
      console.log(chalk.gray('  ccw tool list'));
      console.log(chalk.gray('  ccw tool schema edit_file'));
      console.log(chalk.gray('  ccw tool exec <tool_name> \'{"param": "value"}\''));
      console.log(chalk.gray('  ccw tool exec edit_file --path file.txt --old "old text" --new "new text"'));
      console.log(chalk.gray('  ccw tool exec codex_lens --action search --query "def main" --path .'));
  }
}
