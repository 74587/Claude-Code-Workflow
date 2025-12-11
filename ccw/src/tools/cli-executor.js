/**
 * CLI Executor Tool - Unified execution for external CLI tools
 * Supports Gemini, Qwen, and Codex with streaming output
 */

import { spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

// CLI History storage path
const CLI_HISTORY_DIR = join(process.cwd(), '.workflow', '.cli-history');

/**
 * Check if a CLI tool is available
 * @param {string} tool - Tool name
 * @returns {Promise<{available: boolean, path: string|null}>}
 */
async function checkToolAvailability(tool) {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const command = isWindows ? 'where' : 'which';

    const child = spawn(command, [tool], {
      shell: isWindows,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    child.stdout.on('data', (data) => { stdout += data.toString(); });

    child.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        resolve({ available: true, path: stdout.trim().split('\n')[0] });
      } else {
        resolve({ available: false, path: null });
      }
    });

    child.on('error', () => {
      resolve({ available: false, path: null });
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      child.kill();
      resolve({ available: false, path: null });
    }, 5000);
  });
}

/**
 * Get status of all CLI tools
 * @returns {Promise<Object>}
 */
export async function getCliToolsStatus() {
  const tools = ['gemini', 'qwen', 'codex'];
  const results = {};

  await Promise.all(tools.map(async (tool) => {
    results[tool] = await checkToolAvailability(tool);
  }));

  return results;
}

/**
 * Build command arguments based on tool and options
 * @param {Object} params - Execution parameters
 * @returns {{command: string, args: string[]}}
 */
function buildCommand(params) {
  const { tool, prompt, mode = 'analysis', model, dir, include } = params;

  let command = tool;
  let args = [];

  switch (tool) {
    case 'gemini':
      // gemini "[prompt]" [-m model] [--approval-mode yolo] [--include-directories]
      // Note: Gemini CLI now uses positional prompt instead of -p flag
      args.push(prompt);
      if (model) {
        args.push('-m', model);
      }
      if (mode === 'write') {
        args.push('--approval-mode', 'yolo');
      }
      if (include) {
        args.push('--include-directories', include);
      }
      break;

    case 'qwen':
      // qwen "[prompt]" [-m model] [--approval-mode yolo]
      // Note: Qwen CLI now also uses positional prompt instead of -p flag
      args.push(prompt);
      if (model) {
        args.push('-m', model);
      }
      if (mode === 'write') {
        args.push('--approval-mode', 'yolo');
      }
      if (include) {
        args.push('--include-directories', include);
      }
      break;

    case 'codex':
      // codex exec [OPTIONS] "[prompt]"
      // Options: -C [dir], --full-auto, -s danger-full-access, --skip-git-repo-check, --add-dir
      args.push('exec');
      if (dir) {
        args.push('-C', dir);
      }
      args.push('--full-auto');
      if (mode === 'write' || mode === 'auto') {
        args.push('--skip-git-repo-check', '-s', 'danger-full-access');
      }
      if (model) {
        args.push('-m', model);
      }
      if (include) {
        // Codex uses --add-dir for additional directories
        // Support comma-separated or single directory
        const dirs = include.split(',').map(d => d.trim()).filter(d => d);
        for (const addDir of dirs) {
          args.push('--add-dir', addDir);
        }
      }
      // Prompt must be last (positional argument)
      args.push(prompt);
      break;

    default:
      throw new Error(`Unknown CLI tool: ${tool}`);
  }

  return { command, args };
}

/**
 * Ensure history directory exists
 * @param {string} baseDir - Base directory for history storage
 */
function ensureHistoryDir(baseDir) {
  const historyDir = join(baseDir, '.workflow', '.cli-history');
  if (!existsSync(historyDir)) {
    mkdirSync(historyDir, { recursive: true });
  }
  return historyDir;
}

/**
 * Load history index
 * @param {string} historyDir - History directory path
 * @returns {Object}
 */
function loadHistoryIndex(historyDir) {
  const indexPath = join(historyDir, 'index.json');
  if (existsSync(indexPath)) {
    try {
      return JSON.parse(readFileSync(indexPath, 'utf8'));
    } catch {
      return { version: 1, total_executions: 0, executions: [] };
    }
  }
  return { version: 1, total_executions: 0, executions: [] };
}

/**
 * Save execution to history
 * @param {string} historyDir - History directory path
 * @param {Object} execution - Execution record
 */
function saveExecution(historyDir, execution) {
  // Create date-based subdirectory
  const dateStr = new Date().toISOString().split('T')[0];
  const dateDir = join(historyDir, dateStr);
  if (!existsSync(dateDir)) {
    mkdirSync(dateDir, { recursive: true });
  }

  // Save execution record
  const filename = `${execution.id}.json`;
  writeFileSync(join(dateDir, filename), JSON.stringify(execution, null, 2), 'utf8');

  // Update index
  const index = loadHistoryIndex(historyDir);
  index.total_executions++;

  // Add to executions (keep last 100 in index)
  index.executions.unshift({
    id: execution.id,
    timestamp: execution.timestamp,
    tool: execution.tool,
    status: execution.status,
    duration_ms: execution.duration_ms,
    prompt_preview: execution.prompt.substring(0, 100) + (execution.prompt.length > 100 ? '...' : '')
  });

  if (index.executions.length > 100) {
    index.executions = index.executions.slice(0, 100);
  }

  writeFileSync(join(historyDir, 'index.json'), JSON.stringify(index, null, 2), 'utf8');
}

/**
 * Execute CLI tool with streaming output
 * @param {Object} params - Execution parameters
 * @param {Function} onOutput - Callback for output data
 * @returns {Promise<Object>}
 */
async function executeCliTool(params, onOutput = null) {
  const { tool, prompt, mode = 'analysis', model, cd, dir, includeDirs, include, timeout = 300000, stream = true } = params;

  // Support both parameter naming conventions (cd/includeDirs from CLI, dir/include from internal)
  const workDir = cd || dir;
  const includePaths = includeDirs || include;

  // Validate tool
  if (!['gemini', 'qwen', 'codex'].includes(tool)) {
    throw new Error(`Invalid tool: ${tool}. Must be gemini, qwen, or codex`);
  }

  // Validate prompt
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Prompt is required and must be a string');
  }

  // Check tool availability
  const toolStatus = await checkToolAvailability(tool);
  if (!toolStatus.available) {
    throw new Error(`CLI tool not available: ${tool}. Please ensure it is installed and in PATH.`);
  }

  // Build command with resolved parameters
  const { command, args } = buildCommand({
    tool,
    prompt,
    mode,
    model,
    dir: workDir,
    include: includePaths
  });

  // Determine working directory
  const workingDir = workDir || process.cwd();

  // Create execution record
  const executionId = `${Date.now()}-${tool}`;
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';

    // On Windows with shell:true, we need to properly quote args containing spaces
    // Build the full command string for shell execution
    let spawnCommand = command;
    let spawnArgs = args;
    let useShell = isWindows;

    if (isWindows) {
      // Quote arguments containing spaces for cmd.exe
      spawnArgs = args.map(arg => {
        if (arg.includes(' ') || arg.includes('"')) {
          // Escape existing quotes and wrap in quotes
          return `"${arg.replace(/"/g, '\\"')}"`;
        }
        return arg;
      });
    }

    const child = spawn(spawnCommand, spawnArgs, {
      cwd: workingDir,
      shell: useShell,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Handle stdout
    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      if (stream && onOutput) {
        onOutput({ type: 'stdout', data: text });
      }
    });

    // Handle stderr
    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      if (stream && onOutput) {
        onOutput({ type: 'stderr', data: text });
      }
    });

    // Handle completion
    child.on('close', (code) => {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Determine status
      let status = 'success';
      if (timedOut) {
        status = 'timeout';
      } else if (code !== 0) {
        // Check if HTTP 429 but results exist (Gemini quirk)
        if (stderr.includes('429') && stdout.trim()) {
          status = 'success';
        } else {
          status = 'error';
        }
      }

      // Create execution record
      const execution = {
        id: executionId,
        timestamp: new Date(startTime).toISOString(),
        tool,
        model: model || 'default',
        mode,
        prompt,
        status,
        exit_code: code,
        duration_ms: duration,
        output: {
          stdout: stdout.substring(0, 10240), // Truncate to 10KB
          stderr: stderr.substring(0, 2048),  // Truncate to 2KB
          truncated: stdout.length > 10240 || stderr.length > 2048
        }
      };

      // Try to save to history
      try {
        const historyDir = ensureHistoryDir(workingDir);
        saveExecution(historyDir, execution);
      } catch (err) {
        // Non-fatal: continue even if history save fails
        console.error('[CLI Executor] Failed to save history:', err.message);
      }

      resolve({
        success: status === 'success',
        execution,
        stdout,
        stderr
      });
    });

    // Handle errors
    child.on('error', (error) => {
      reject(new Error(`Failed to spawn ${tool}: ${error.message}`));
    });

    // Timeout handling
    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 5000);
    }, timeout);

    child.on('close', () => {
      clearTimeout(timeoutId);
    });
  });
}

/**
 * Get execution history
 * @param {string} baseDir - Base directory
 * @param {Object} options - Query options
 * @returns {Object}
 */
export function getExecutionHistory(baseDir, options = {}) {
  const { limit = 50, tool = null, status = null } = options;

  const historyDir = join(baseDir, '.workflow', '.cli-history');
  const index = loadHistoryIndex(historyDir);

  let executions = index.executions;

  // Filter by tool
  if (tool) {
    executions = executions.filter(e => e.tool === tool);
  }

  // Filter by status
  if (status) {
    executions = executions.filter(e => e.status === status);
  }

  // Limit results
  executions = executions.slice(0, limit);

  return {
    total: index.total_executions,
    count: executions.length,
    executions
  };
}

/**
 * Get execution detail by ID
 * @param {string} baseDir - Base directory
 * @param {string} executionId - Execution ID
 * @returns {Object|null}
 */
export function getExecutionDetail(baseDir, executionId) {
  const historyDir = join(baseDir, '.workflow', '.cli-history');

  // Parse date from execution ID
  const timestamp = parseInt(executionId.split('-')[0], 10);
  const date = new Date(timestamp);
  const dateStr = date.toISOString().split('T')[0];

  const filePath = join(historyDir, dateStr, `${executionId}.json`);

  if (existsSync(filePath)) {
    try {
      return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * CLI Executor Tool Definition
 */
export const cliExecutorTool = {
  name: 'cli_executor',
  description: `Execute external CLI tools (gemini/qwen/codex) with unified interface.
Modes:
- analysis: Read-only operations (default)
- write: File modifications allowed
- auto: Full autonomous operations (codex only)`,
  parameters: {
    type: 'object',
    properties: {
      tool: {
        type: 'string',
        enum: ['gemini', 'qwen', 'codex'],
        description: 'CLI tool to execute'
      },
      prompt: {
        type: 'string',
        description: 'Prompt to send to the CLI tool'
      },
      mode: {
        type: 'string',
        enum: ['analysis', 'write', 'auto'],
        description: 'Execution mode (default: analysis)',
        default: 'analysis'
      },
      model: {
        type: 'string',
        description: 'Model override (tool-specific)'
      },
      cd: {
        type: 'string',
        description: 'Working directory for execution (-C for codex)'
      },
      includeDirs: {
        type: 'string',
        description: 'Additional directories (comma-separated). Maps to --include-directories for gemini/qwen, --add-dir for codex'
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (default: 300000 = 5 minutes)',
        default: 300000
      }
    },
    required: ['tool', 'prompt']
  },
  execute: executeCliTool
};

// Export for direct usage
export { executeCliTool, checkToolAvailability };
