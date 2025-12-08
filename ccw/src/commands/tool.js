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
 * Read from stdin if available
 */
async function readStdin() {
  // Check if stdin is a TTY (interactive terminal)
  if (process.stdin.isTTY) {
    return null;
  }

  return new Promise((resolve, reject) => {
    let data = '';

    process.stdin.setEncoding('utf8');

    process.stdin.on('readable', () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        data += chunk;
      }
    });

    process.stdin.on('end', () => {
      resolve(data.trim() || null);
    });

    process.stdin.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Execute a tool with given parameters
 */
async function execAction(toolName, jsonInput, options) {
  if (!toolName) {
    console.error(chalk.red('Tool name is required'));
    console.error(chalk.gray('Usage: ccw tool exec <tool-name> \'{"param": "value"}\''));
    process.exit(1);
  }

  const tool = getTool(toolName);
  if (!tool) {
    console.error(chalk.red(`Tool not found: ${toolName}`));
    console.error(chalk.gray('Use "ccw tool list" to see available tools'));
    process.exit(1);
  }

  // Parse JSON input (default format)
  let params = {};

  if (jsonInput) {
    try {
      params = JSON.parse(jsonInput);
    } catch (error) {
      console.error(chalk.red(`Invalid JSON: ${error.message}`));
      process.exit(1);
    }
  }

  // Check for stdin input (for piped commands)
  const stdinData = await readStdin();
  if (stdinData) {
    // If tool has an 'input' parameter, use it
    // Otherwise, try to parse stdin as JSON and merge with params
    if (tool.parameters?.properties?.input) {
      params.input = stdinData;
    } else {
      try {
        const stdinJson = JSON.parse(stdinData);
        params = { ...stdinJson, ...params };
      } catch {
        // If not JSON, store as 'input' anyway
        params.input = stdinData;
      }
    }
  }

  // Execute tool
  const result = await executeTool(toolName, params);

  // Always output JSON
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Tool command entry point
 */
export async function toolCommand(subcommand, args, options) {
  // Handle subcommands
  switch (subcommand) {
    case 'list':
      await listAction();
      break;
    case 'schema':
      await schemaAction({ name: args });
      break;
    case 'exec':
      await execAction(args, options.json, options);
      break;
    default:
      console.log(chalk.bold.cyan('\nCCW Tool System\n'));
      console.log('Subcommands:');
      console.log(chalk.gray('  list              List all available tools'));
      console.log(chalk.gray('  schema [name]     Show tool schema (JSON)'));
      console.log(chalk.gray('  exec <name>       Execute a tool'));
      console.log();
      console.log('Examples:');
      console.log(chalk.gray('  ccw tool list'));
      console.log(chalk.gray('  ccw tool schema edit_file'));
      console.log(chalk.gray('  ccw tool exec edit_file \'{"path":"file.txt","oldText":"old","newText":"new"}\''));
  }
}
