/**
 * CLI Executor Tool - Unified execution for external CLI tools
 * Supports Gemini, Qwen, and Codex with streaming output
 */

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';
import { spawn, ChildProcess } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

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
    child.stdout!.on('data', (data) => { stdout += data.toString(); });

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
}): { command: string; args: string[]; useStdin: boolean } {
  const { tool, prompt, mode = 'analysis', model, dir, include } = params;

  let command = tool;
  let args: string[] = [];
  // Default to stdin for all tools to avoid escaping issues on Windows
  let useStdin = true;

  switch (tool) {
    case 'gemini':
      // gemini reads from stdin when no positional prompt is provided
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
      // qwen reads from stdin when no positional prompt is provided
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
      // codex reads from stdin for prompt
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
      // Prompt passed via stdin (default)
      break;

    default:
      throw new Error(`Unknown CLI tool: ${tool}`);
  }

  return { command, args, useStdin };
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
  const { command, args, useStdin } = buildCommand({
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
      stdio: [useStdin ? 'pipe' : 'ignore', 'pipe', 'pipe']
    });

    // Write prompt to stdin if using stdin mode (for gemini/qwen)
    if (useStdin && child.stdin) {
      child.stdin.write(prompt);
      child.stdin.end();
    }

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Handle stdout
    child.stdout!.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      if (onOutput) {
        onOutput({ type: 'stdout', data: text });
      }
    });

    // Handle stderr
    child.stderr!.on('data', (data) => {
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
 * Find all CLI history directories in a directory tree (max depth 3)
 */
function findCliHistoryDirs(baseDir: string, maxDepth: number = 3): string[] {
  const historyDirs: string[] = [];
  const ignoreDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'venv', '.venv']);

  function scanDir(dir: string, depth: number) {
    if (depth > maxDepth) return;

    // Check if this directory has CLI history
    const historyDir = join(dir, '.workflow', '.cli-history');
    if (existsSync(join(historyDir, 'index.json'))) {
      historyDirs.push(historyDir);
    }

    // Scan subdirectories
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && !ignoreDirs.has(entry.name)) {
          scanDir(join(dir, entry.name), depth + 1);
        }
      }
    } catch {
      // Ignore permission errors
    }
  }

  scanDir(baseDir, 0);
  return historyDirs;
}

/**
 * Get execution history
 */
export function getExecutionHistory(baseDir: string, options: {
  limit?: number;
  tool?: string | null;
  status?: string | null;
  recursive?: boolean;
} = {}): {
  total: number;
  count: number;
  executions: (HistoryIndex['executions'][0] & { sourceDir?: string })[];
} {
  const { limit = 50, tool = null, status = null, recursive = false } = options;

  let allExecutions: (HistoryIndex['executions'][0] & { sourceDir?: string })[] = [];
  let totalCount = 0;

  if (recursive) {
    // Find all CLI history directories in subdirectories
    const historyDirs = findCliHistoryDirs(baseDir);

    for (const historyDir of historyDirs) {
      const index = loadHistoryIndex(historyDir);
      totalCount += index.total_executions;

      // Add source directory info to each execution
      const sourceDir = historyDir.replace(/[\\\/]\.workflow[\\\/]\.cli-history$/, '');
      const relativeSource = relative(baseDir, sourceDir) || '.';

      for (const exec of index.executions) {
        allExecutions.push({ ...exec, sourceDir: relativeSource });
      }
    }

    // Sort by timestamp (newest first)
    allExecutions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } else {
    // Original behavior - single directory
    const historyDir = join(baseDir, '.workflow', '.cli-history');
    const index = loadHistoryIndex(historyDir);
    totalCount = index.total_executions;
    allExecutions = index.executions;
  }

  // Filter by tool
  if (tool) {
    allExecutions = allExecutions.filter(e => e.tool === tool);
  }

  // Filter by status
  if (status) {
    allExecutions = allExecutions.filter(e => e.status === status);
  }

  // Limit results
  const executions = allExecutions.slice(0, limit);

  return {
    total: totalCount,
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

/**
 * Resume a CLI session
 * - Codex: Uses native `codex resume` command
 * - Gemini/Qwen: Loads previous conversation and continues
 */
export async function resumeCliSession(
  baseDir: string,
  options: {
    tool?: string;
    executionId?: string;
    last?: boolean;
    prompt?: string;
  },
  onOutput?: ((data: { type: string; data: string }) => void) | null
): Promise<ExecutionOutput> {
  const { tool, executionId, last = false, prompt } = options;

  // For Codex, use native resume
  if (tool === 'codex' || (!tool && !executionId)) {
    return resumeCodexSession(baseDir, { last }, onOutput);
  }

  // For Gemini/Qwen, load previous session and continue
  let previousExecution: ExecutionRecord | null = null;

  if (executionId) {
    previousExecution = getExecutionDetail(baseDir, executionId);
  } else if (last) {
    // Get the most recent execution for the specified tool (or any tool)
    const history = getExecutionHistory(baseDir, { limit: 1, tool: tool || null });
    if (history.executions.length > 0) {
      previousExecution = getExecutionDetail(baseDir, history.executions[0].id);
    }
  }

  if (!previousExecution) {
    throw new Error('No previous session found to resume');
  }

  // Build continuation prompt with previous context
  const continuationPrompt = buildContinuationPrompt(previousExecution, prompt);

  // Execute with the continuation prompt
  return executeCliTool({
    tool: previousExecution.tool,
    prompt: continuationPrompt,
    mode: previousExecution.mode,
    model: previousExecution.model !== 'default' ? previousExecution.model : undefined
  }, onOutput);
}

/**
 * Resume Codex session using native command
 */
async function resumeCodexSession(
  baseDir: string,
  options: { last?: boolean },
  onOutput?: ((data: { type: string; data: string }) => void) | null
): Promise<ExecutionOutput> {
  const { last = false } = options;

  // Check codex availability
  const toolStatus = await checkToolAvailability('codex');
  if (!toolStatus.available) {
    throw new Error('Codex CLI not available. Please ensure it is installed and in PATH.');
  }

  const args = ['resume'];
  if (last) {
    args.push('--last');
  }

  const isWindows = process.platform === 'win32';
  const startTime = Date.now();
  const executionId = `${Date.now()}-codex-resume`;

  return new Promise((resolve, reject) => {
    const child = spawn('codex', args, {
      cwd: baseDir,
      shell: isWindows,
      stdio: ['inherit', 'pipe', 'pipe'] // inherit stdin for interactive picker
    });

    let stdout = '';
    let stderr = '';

    child.stdout!.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      if (onOutput) {
        onOutput({ type: 'stdout', data: text });
      }
    });

    child.stderr!.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      if (onOutput) {
        onOutput({ type: 'stderr', data: text });
      }
    });

    child.on('close', (code) => {
      const duration = Date.now() - startTime;
      const status: 'success' | 'error' = code === 0 ? 'success' : 'error';

      const execution: ExecutionRecord = {
        id: executionId,
        timestamp: new Date(startTime).toISOString(),
        tool: 'codex',
        model: 'default',
        mode: 'auto',
        prompt: `[Resume session${last ? ' --last' : ''}]`,
        status,
        exit_code: code,
        duration_ms: duration,
        output: {
          stdout: stdout.substring(0, 10240),
          stderr: stderr.substring(0, 2048),
          truncated: stdout.length > 10240 || stderr.length > 2048
        }
      };

      resolve({
        success: status === 'success',
        execution,
        stdout,
        stderr
      });
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to resume codex session: ${error.message}`));
    });
  });
}

/**
 * Build continuation prompt with previous conversation context
 */
function buildContinuationPrompt(previous: ExecutionRecord, additionalPrompt?: string): string {
  const parts: string[] = [];

  // Add previous conversation context
  parts.push('=== PREVIOUS CONVERSATION ===');
  parts.push('');
  parts.push('USER PROMPT:');
  parts.push(previous.prompt);
  parts.push('');
  parts.push('ASSISTANT RESPONSE:');
  parts.push(previous.output.stdout || '[No output recorded]');
  parts.push('');
  parts.push('=== CONTINUATION ===');
  parts.push('');

  if (additionalPrompt) {
    parts.push(additionalPrompt);
  } else {
    parts.push('Continue from where we left off. What should we do next?');
  }

  return parts.join('\n');
}

/**
 * Get latest execution for a specific tool
 */
export function getLatestExecution(baseDir: string, tool?: string): ExecutionRecord | null {
  const history = getExecutionHistory(baseDir, { limit: 1, tool: tool || null });
  if (history.executions.length === 0) {
    return null;
  }
  return getExecutionDetail(baseDir, history.executions[0].id);
}

// Export utility functions and tool definition for backward compatibility
export { executeCliTool, checkToolAvailability };

// Export tool definition (for legacy imports) - This allows direct calls to execute with onOutput
export const cliExecutorTool = {
  schema,
  execute: executeCliTool // Use executeCliTool directly which supports onOutput callback
};
