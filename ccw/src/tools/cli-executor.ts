/**
 * CLI Executor Tool - Unified execution for external CLI tools
 * Supports Gemini, Qwen, and Codex with streaming output
 */

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';
import { spawn, ChildProcess } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

// CLI History storage path
const CLI_HISTORY_DIR = join(process.cwd(), '.workflow', '.cli-history');

// Define Zod schema for validation
const ParamsSchema = z.object({
  tool: z.enum(['gemini', 'qwen', 'codex']),
  prompt: z.string().min(1, 'Prompt is required'),
  mode: z.enum(['analysis', 'write', 'auto']).default('analysis'),
  model: z.string().optional(),
  cd: z.string().optional(),
  includeDirs: z.string().optional(),
  timeout: z.number().default(300000),
});

type Params = z.infer<typeof ParamsSchema>;

interface ToolAvailability {
  available: boolean;
  path: string | null;
}

interface ExecutionRecord {
  id: string;
  timestamp: string;
  tool: string;
  model: string;
  mode: string;
  prompt: string;
  status: 'success' | 'error' | 'timeout';
  exit_code: number | null;
  duration_ms: number;
  output: {
    stdout: string;
    stderr: string;
    truncated: boolean;
  };
}

interface HistoryIndex {
  version: number;
  total_executions: number;
  executions: {
    id: string;
    timestamp: string;
    tool: string;
    status: string;
    duration_ms: number;
    prompt_preview: string;
  }[];
}

interface ExecutionOutput {
  success: boolean;
  execution: ExecutionRecord;
  stdout: string;
  stderr: string;
}

/**
 * Check if a CLI tool is available
 */
async function checkToolAvailability(tool: string): Promise<ToolAvailability> {
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
 * Build command arguments based on tool and options
 */
function buildCommand(params: {
  tool: string;
  prompt: string;
  mode: string;
  model?: string;
  dir?: string;
  include?: string;
}): { command: string; args: string[] } {
  const { tool, prompt, mode = 'analysis', model, dir, include } = params;

  let command = tool;
  let args: string[] = [];

  switch (tool) {
    case 'gemini':
      // gemini "[prompt]" [-m model] [--approval-mode yolo] [--include-directories]
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
 */
function ensureHistoryDir(baseDir: string): string {
  const historyDir = join(baseDir, '.workflow', '.cli-history');
  if (!existsSync(historyDir)) {
    mkdirSync(historyDir, { recursive: true });
  }
  return historyDir;
}

/**
 * Load history index
 */
function loadHistoryIndex(historyDir: string): HistoryIndex {
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
 */
function saveExecution(historyDir: string, execution: ExecutionRecord): void {
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
 */
async function executeCliTool(
  params: Record<string, unknown>,
  onOutput?: ((data: { type: string; data: string }) => void) | null
): Promise<ExecutionOutput> {
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new Error(`Invalid params: ${parsed.error.message}`);
  }

  const { tool, prompt, mode, model, cd, includeDirs, timeout } = parsed.data;

  // Check tool availability
  const toolStatus = await checkToolAvailability(tool);
  if (!toolStatus.available) {
    throw new Error(`CLI tool not available: ${tool}. Please ensure it is installed and in PATH.`);
  }

  // Build command
  const { command, args } = buildCommand({
    tool,
    prompt,
    mode,
    model,
    dir: cd,
    include: includeDirs
  });

  // Determine working directory
  const workingDir = cd || process.cwd();

  // Create execution record
  const executionId = `${Date.now()}-${tool}`;
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';

    // On Windows with shell:true, we need to properly quote args containing spaces
    let spawnArgs = args;

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

    const child = spawn(command, spawnArgs, {
      cwd: workingDir,
      shell: isWindows,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Handle stdout
    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      if (onOutput) {
        onOutput({ type: 'stdout', data: text });
      }
    });

    // Handle stderr
    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      if (onOutput) {
        onOutput({ type: 'stderr', data: text });
      }
    });

    // Handle completion
    child.on('close', (code) => {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Determine status
      let status: 'success' | 'error' | 'timeout' = 'success';
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
      const execution: ExecutionRecord = {
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
        console.error('[CLI Executor] Failed to save history:', (err as Error).message);
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

// Tool schema for MCP
export const schema: ToolSchema = {
  name: 'cli_executor',
  description: `Execute external CLI tools (gemini/qwen/codex) with unified interface.
Modes:
- analysis: Read-only operations (default)
- write: File modifications allowed
- auto: Full autonomous operations (codex only)`,
  inputSchema: {
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
  }
};

// Handler function
export async function handler(params: Record<string, unknown>): Promise<ToolResult<ExecutionOutput>> {
  try {
    const result = await executeCliTool(params);
    return {
      success: result.success,
      result
    };
  } catch (error) {
    return {
      success: false,
      error: `CLI execution failed: ${(error as Error).message}`
    };
  }
}

/**
 * Get execution history
 */
export function getExecutionHistory(baseDir: string, options: {
  limit?: number;
  tool?: string | null;
  status?: string | null;
} = {}): {
  total: number;
  count: number;
  executions: HistoryIndex['executions'];
} {
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
 */
export function getExecutionDetail(baseDir: string, executionId: string): ExecutionRecord | null {
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
 * Delete execution by ID
 */
export function deleteExecution(baseDir: string, executionId: string): { success: boolean; error?: string } {
  const historyDir = join(baseDir, '.workflow', '.cli-history');

  // Parse date from execution ID
  const timestamp = parseInt(executionId.split('-')[0], 10);
  const date = new Date(timestamp);
  const dateStr = date.toISOString().split('T')[0];

  const filePath = join(historyDir, dateStr, `${executionId}.json`);

  // Delete the execution file
  if (existsSync(filePath)) {
    try {
      unlinkSync(filePath);
    } catch (err) {
      return { success: false, error: `Failed to delete file: ${(err as Error).message}` };
    }
  }

  // Update index
  try {
    const index = loadHistoryIndex(historyDir);
    index.executions = index.executions.filter(e => e.id !== executionId);
    index.total_executions = Math.max(0, index.total_executions - 1);
    writeFileSync(join(historyDir, 'index.json'), JSON.stringify(index, null, 2), 'utf8');
  } catch (err) {
    return { success: false, error: `Failed to update index: ${(err as Error).message}` };
  }

  return { success: true };
}

/**
 * Get status of all CLI tools
 */
export async function getCliToolsStatus(): Promise<Record<string, ToolAvailability>> {
  const tools = ['gemini', 'qwen', 'codex'];
  const results: Record<string, ToolAvailability> = {};

  await Promise.all(tools.map(async (tool) => {
    results[tool] = await checkToolAvailability(tool);
  }));

  return results;
}

// Export utility functions and tool definition for backward compatibility
export { executeCliTool, checkToolAvailability };

// Export tool definition (for legacy imports) - This allows direct calls to execute with onOutput
export const cliExecutorTool = {
  schema,
  execute: executeCliTool // Use executeCliTool directly which supports onOutput callback
};
