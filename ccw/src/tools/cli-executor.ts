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
  resume: z.union([z.boolean(), z.string()]).optional(), // true = last, string = single ID or comma-separated IDs
  id: z.string().optional(), // Custom execution ID (e.g., IMPL-001-step1)
});

type Params = z.infer<typeof ParamsSchema>;

interface ToolAvailability {
  available: boolean;
  path: string | null;
}

// Single turn in a conversation
interface ConversationTurn {
  turn: number;
  timestamp: string;
  prompt: string;
  duration_ms: number;
  status: 'success' | 'error' | 'timeout';
  exit_code: number | null;
  output: {
    stdout: string;
    stderr: string;
    truncated: boolean;
  };
}

// Multi-turn conversation record
interface ConversationRecord {
  id: string;
  created_at: string;
  updated_at: string;
  tool: string;
  model: string;
  mode: string;
  total_duration_ms: number;
  turn_count: number;
  latest_status: 'success' | 'error' | 'timeout';
  turns: ConversationTurn[];
}

// Legacy single execution record (for backward compatibility)
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
    timestamp: string;      // created_at for conversations
    updated_at?: string;    // last update time
    tool: string;
    status: string;
    duration_ms: number;
    turn_count?: number;    // number of turns in conversation
    prompt_preview: string;
  }[];
}

interface ExecutionOutput {
  success: boolean;
  execution: ExecutionRecord;
  conversation: ConversationRecord;  // Full conversation record
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
 * Save conversation to history (create new or append turn)
 */
function saveConversation(historyDir: string, conversation: ConversationRecord): void {
  // Create date-based subdirectory using created_at date
  const dateStr = conversation.created_at.split('T')[0];
  const dateDir = join(historyDir, dateStr);
  if (!existsSync(dateDir)) {
    mkdirSync(dateDir, { recursive: true });
  }

  // Save conversation record
  const filename = `${conversation.id}.json`;
  writeFileSync(join(dateDir, filename), JSON.stringify(conversation, null, 2), 'utf8');

  // Update index
  const index = loadHistoryIndex(historyDir);

  // Check if this conversation already exists in index
  const existingIdx = index.executions.findIndex(e => e.id === conversation.id);
  const latestTurn = conversation.turns[conversation.turns.length - 1];

  const indexEntry = {
    id: conversation.id,
    timestamp: conversation.created_at,
    updated_at: conversation.updated_at,
    tool: conversation.tool,
    status: conversation.latest_status,
    duration_ms: conversation.total_duration_ms,
    turn_count: conversation.turn_count,
    prompt_preview: latestTurn.prompt.substring(0, 100) + (latestTurn.prompt.length > 100 ? '...' : '')
  };

  if (existingIdx >= 0) {
    // Update existing entry and move to top
    index.executions.splice(existingIdx, 1);
    index.executions.unshift(indexEntry);
  } else {
    // Add new entry
    index.total_executions++;
    index.executions.unshift(indexEntry);
  }

  if (index.executions.length > 100) {
    index.executions = index.executions.slice(0, 100);
  }

  writeFileSync(join(historyDir, 'index.json'), JSON.stringify(index, null, 2), 'utf8');
}

/**
 * Load existing conversation by ID
 */
function loadConversation(historyDir: string, conversationId: string): ConversationRecord | null {
  // Search in all date directories
  if (existsSync(historyDir)) {
    const dateDirs = readdirSync(historyDir).filter(d => {
      const dirPath = join(historyDir, d);
      return statSync(dirPath).isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d);
    });

    // Search newest first
    for (const dateDir of dateDirs.sort().reverse()) {
      const filePath = join(historyDir, dateDir, `${conversationId}.json`);
      if (existsSync(filePath)) {
        try {
          const data = JSON.parse(readFileSync(filePath, 'utf8'));
          // Check if it's a conversation record (has turns array)
          if (data.turns && Array.isArray(data.turns)) {
            return data as ConversationRecord;
          }
          // Convert legacy ExecutionRecord to ConversationRecord
          return convertToConversation(data);
        } catch {
          continue;
        }
      }
    }
  }
  return null;
}

/**
 * Convert legacy ExecutionRecord to ConversationRecord
 */
function convertToConversation(record: ExecutionRecord): ConversationRecord {
  return {
    id: record.id,
    created_at: record.timestamp,
    updated_at: record.timestamp,
    tool: record.tool,
    model: record.model,
    mode: record.mode,
    total_duration_ms: record.duration_ms,
    turn_count: 1,
    latest_status: record.status,
    turns: [{
      turn: 1,
      timestamp: record.timestamp,
      prompt: record.prompt,
      duration_ms: record.duration_ms,
      status: record.status,
      exit_code: record.exit_code,
      output: record.output
    }]
  };
}

/**
 * Merge multiple conversations into a unified context
 * Returns merged turns sorted by timestamp with source tracking
 */
interface MergedTurn extends ConversationTurn {
  source_id: string;  // Original conversation ID
}

interface MergeResult {
  mergedTurns: MergedTurn[];
  sourceConversations: ConversationRecord[];
  totalDuration: number;
}

function mergeConversations(conversations: ConversationRecord[]): MergeResult {
  const mergedTurns: MergedTurn[] = [];

  // Collect all turns with source tracking
  for (const conv of conversations) {
    for (const turn of conv.turns) {
      mergedTurns.push({
        ...turn,
        source_id: conv.id
      });
    }
  }

  // Sort by timestamp
  mergedTurns.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Re-number turns
  mergedTurns.forEach((turn, idx) => {
    turn.turn = idx + 1;
  });

  // Calculate total duration
  const totalDuration = mergedTurns.reduce((sum, t) => sum + t.duration_ms, 0);

  return {
    mergedTurns,
    sourceConversations: conversations,
    totalDuration
  };
}

/**
 * Build prompt from merged conversations
 */
function buildMergedPrompt(mergeResult: MergeResult, newPrompt: string): string {
  const parts: string[] = [];

  parts.push('=== MERGED CONVERSATION HISTORY ===');
  parts.push(`(From ${mergeResult.sourceConversations.length} conversations: ${mergeResult.sourceConversations.map(c => c.id).join(', ')})`);
  parts.push('');

  // Add all merged turns with source tracking
  for (const turn of mergeResult.mergedTurns) {
    parts.push(`--- Turn ${turn.turn} [${turn.source_id}] ---`);
    parts.push('USER:');
    parts.push(turn.prompt);
    parts.push('');
    parts.push('ASSISTANT:');
    parts.push(turn.output.stdout || '[No output recorded]');
    parts.push('');
  }

  parts.push('=== NEW REQUEST ===');
  parts.push('');
  parts.push(newPrompt);

  return parts.join('\n');
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

  const { tool, prompt, mode, model, cd, includeDirs, timeout, resume, id: customId } = parsed.data;

  // Determine working directory early (needed for conversation lookup)
  const workingDir = cd || process.cwd();
  const historyDir = ensureHistoryDir(workingDir);

  // Determine conversation ID and load existing conversation
  // Logic:
  // - If --resume <id1,id2,...> (multiple IDs): merge conversations
  //   - With --id: create new merged conversation
  //   - Without --id: append to ALL source conversations
  // - If --resume <id> AND --id <newId>: fork - read context from resume ID, create new conversation with newId
  // - If --id provided (no resume): use that ID (create new or append)
  // - If --resume <id> without --id: use resume ID (append to existing)
  // - No params: create new with auto-generated ID
  let conversationId: string;
  let existingConversation: ConversationRecord | null = null;
  let contextConversation: ConversationRecord | null = null; // For fork scenario
  let mergeResult: MergeResult | null = null; // For merge scenario
  let sourceConversations: ConversationRecord[] = []; // All source conversations for merge

  // Parse resume IDs (can be comma-separated for merge)
  const resumeIds: string[] = resume
    ? (typeof resume === 'string' ? resume.split(',').map(id => id.trim()).filter(Boolean) : [])
    : [];
  const isMerge = resumeIds.length > 1;
  const resumeId = resumeIds.length === 1 ? resumeIds[0] : null;

  if (isMerge) {
    // Merge scenario: multiple resume IDs
    sourceConversations = resumeIds
      .map(id => loadConversation(historyDir, id))
      .filter((c): c is ConversationRecord => c !== null);

    if (sourceConversations.length === 0) {
      throw new Error('No valid conversations found for merge');
    }

    mergeResult = mergeConversations(sourceConversations);

    if (customId) {
      // Create new merged conversation with custom ID
      conversationId = customId;
      existingConversation = loadConversation(historyDir, customId);
    } else {
      // Will append to ALL source conversations (handled in save logic)
      // Use first source conversation ID as primary
      conversationId = sourceConversations[0].id;
      existingConversation = sourceConversations[0];
    }
  } else if (customId && resumeId) {
    // Fork: read context from resume ID, but create new conversation with custom ID
    conversationId = customId;
    contextConversation = loadConversation(historyDir, resumeId);
    existingConversation = loadConversation(historyDir, customId);
  } else if (customId) {
    // Use custom ID - may be new or existing
    conversationId = customId;
    existingConversation = loadConversation(historyDir, customId);
  } else if (resumeId) {
    // Resume single ID without new ID - append to existing conversation
    conversationId = resumeId;
    existingConversation = loadConversation(historyDir, resumeId);
  } else if (resume) {
    // resume=true: get last conversation for this tool
    const history = getExecutionHistory(workingDir, { limit: 1, tool });
    if (history.executions.length > 0) {
      conversationId = history.executions[0].id;
      existingConversation = loadConversation(historyDir, conversationId);
    } else {
      // No previous conversation, create new
      conversationId = `${Date.now()}-${tool}`;
    }
  } else {
    // New conversation with auto-generated ID
    conversationId = `${Date.now()}-${tool}`;
  }

  // Build final prompt with conversation context
  // For merge: use merged context from all source conversations
  // For fork: use contextConversation (from resume ID) for prompt context
  // For append: use existingConversation (from target ID)
  let finalPrompt = prompt;
  if (mergeResult && mergeResult.mergedTurns.length > 0) {
    finalPrompt = buildMergedPrompt(mergeResult, prompt);
  } else {
    const conversationForContext = contextConversation || existingConversation;
    if (conversationForContext && conversationForContext.turns.length > 0) {
      finalPrompt = buildMultiTurnPrompt(conversationForContext, prompt);
    }
  }

  // Check tool availability
  const toolStatus = await checkToolAvailability(tool);
  if (!toolStatus.available) {
    throw new Error(`CLI tool not available: ${tool}. Please ensure it is installed and in PATH.`);
  }

  // Build command
  const { command, args, useStdin } = buildCommand({
    tool,
    prompt: finalPrompt,
    mode,
    model,
    dir: cd,
    include: includeDirs
  });

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
      child.stdin.write(finalPrompt);
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

      // Create new turn
      const newTurnOutput = {
        stdout: stdout.substring(0, 10240), // Truncate to 10KB
        stderr: stderr.substring(0, 2048),  // Truncate to 2KB
        truncated: stdout.length > 10240 || stderr.length > 2048
      };

      // Determine base turn number for merge scenarios
      const baseTurnNumber = isMerge && mergeResult
        ? mergeResult.mergedTurns.length + 1
        : (existingConversation ? existingConversation.turns.length + 1 : 1);

      const newTurn: ConversationTurn = {
        turn: baseTurnNumber,
        timestamp: new Date(startTime).toISOString(),
        prompt,
        duration_ms: duration,
        status,
        exit_code: code,
        output: newTurnOutput
      };

      // Create or update conversation record
      let conversation: ConversationRecord;

      if (isMerge && mergeResult && !customId) {
        // Merge without --id: append to ALL source conversations
        // Save new turn to each source conversation
        const savedConversations: ConversationRecord[] = [];
        for (const srcConv of sourceConversations) {
          const turnForSrc: ConversationTurn = {
            ...newTurn,
            turn: srcConv.turns.length + 1 // Use each conversation's turn count
          };
          const updatedConv: ConversationRecord = {
            ...srcConv,
            updated_at: new Date().toISOString(),
            total_duration_ms: srcConv.total_duration_ms + duration,
            turn_count: srcConv.turns.length + 1,
            latest_status: status,
            turns: [...srcConv.turns, turnForSrc]
          };
          savedConversations.push(updatedConv);
        }
        // Use first conversation as primary
        conversation = savedConversations[0];
        // Save all source conversations
        try {
          for (const conv of savedConversations) {
            saveConversation(historyDir, conv);
          }
        } catch (err) {
          console.error('[CLI Executor] Failed to save merged histories:', (err as Error).message);
        }
      } else if (isMerge && mergeResult && customId) {
        // Merge with --id: create new conversation with merged turns + new turn
        // Convert merged turns to regular turns (without source_id)
        const mergedTurns: ConversationTurn[] = mergeResult.mergedTurns.map((mt, idx) => ({
          turn: idx + 1,
          timestamp: mt.timestamp,
          prompt: mt.prompt,
          duration_ms: mt.duration_ms,
          status: mt.status,
          exit_code: mt.exit_code,
          output: mt.output
        }));

        conversation = existingConversation
          ? {
              ...existingConversation,
              updated_at: new Date().toISOString(),
              total_duration_ms: existingConversation.total_duration_ms + duration,
              turn_count: existingConversation.turns.length + 1,
              latest_status: status,
              turns: [...existingConversation.turns, newTurn]
            }
          : {
              id: conversationId,
              created_at: new Date(startTime).toISOString(),
              updated_at: new Date().toISOString(),
              tool,
              model: model || 'default',
              mode,
              total_duration_ms: mergeResult.totalDuration + duration,
              turn_count: mergedTurns.length + 1,
              latest_status: status,
              turns: [...mergedTurns, newTurn]
            };
        // Save merged conversation
        try {
          saveConversation(historyDir, conversation);
        } catch (err) {
          console.error('[CLI Executor] Failed to save merged conversation:', (err as Error).message);
        }
      } else {
        // Normal scenario: single conversation
        conversation = existingConversation
          ? {
              ...existingConversation,
              updated_at: new Date().toISOString(),
              total_duration_ms: existingConversation.total_duration_ms + duration,
              turn_count: existingConversation.turns.length + 1,
              latest_status: status,
              turns: [...existingConversation.turns, newTurn]
            }
          : {
              id: conversationId,
              created_at: new Date(startTime).toISOString(),
              updated_at: new Date().toISOString(),
              tool,
              model: model || 'default',
              mode,
              total_duration_ms: duration,
              turn_count: 1,
              latest_status: status,
              turns: [newTurn]
            };
        // Try to save conversation to history
        try {
          saveConversation(historyDir, conversation);
        } catch (err) {
          // Non-fatal: continue even if history save fails
          console.error('[CLI Executor] Failed to save history:', (err as Error).message);
        }
      }

      // Create legacy execution record for backward compatibility
      const execution: ExecutionRecord = {
        id: conversationId,
        timestamp: new Date(startTime).toISOString(),
        tool,
        model: model || 'default',
        mode,
        prompt,
        status,
        exit_code: code,
        duration_ms: duration,
        output: newTurnOutput
      };

      resolve({
        success: status === 'success',
        execution,
        conversation,
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
 * Get conversation detail by ID (returns ConversationRecord)
 */
export function getConversationDetail(baseDir: string, conversationId: string): ConversationRecord | null {
  const historyDir = join(baseDir, '.workflow', '.cli-history');
  return loadConversation(historyDir, conversationId);
}

/**
 * Get execution detail by ID (legacy, returns ExecutionRecord for backward compatibility)
 */
export function getExecutionDetail(baseDir: string, executionId: string): ExecutionRecord | null {
  const conversation = getConversationDetail(baseDir, executionId);
  if (!conversation) return null;

  // Convert to legacy ExecutionRecord format (using latest turn)
  const latestTurn = conversation.turns[conversation.turns.length - 1];
  return {
    id: conversation.id,
    timestamp: conversation.created_at,
    tool: conversation.tool,
    model: conversation.model,
    mode: conversation.mode,
    prompt: latestTurn.prompt,
    status: conversation.latest_status,
    exit_code: latestTurn.exit_code,
    duration_ms: conversation.total_duration_ms,
    output: latestTurn.output
  };
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
 * Build multi-turn prompt with full conversation history
 */
function buildMultiTurnPrompt(conversation: ConversationRecord, newPrompt: string): string {
  const parts: string[] = [];

  parts.push('=== CONVERSATION HISTORY ===');
  parts.push('');

  // Add all previous turns
  for (const turn of conversation.turns) {
    parts.push(`--- Turn ${turn.turn} ---`);
    parts.push('USER:');
    parts.push(turn.prompt);
    parts.push('');
    parts.push('ASSISTANT:');
    parts.push(turn.output.stdout || '[No output recorded]');
    parts.push('');
  }

  parts.push('=== NEW REQUEST ===');
  parts.push('');
  parts.push(newPrompt);

  return parts.join('\n');
}

/**
 * Build continuation prompt with previous conversation context (legacy)
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
 * Get previous execution for resume
 * @param baseDir - Working directory
 * @param tool - Tool to filter by
 * @param resume - true for last, or execution ID string
 */
function getPreviousExecution(baseDir: string, tool: string, resume: boolean | string): ExecutionRecord | null {
  if (typeof resume === 'string') {
    // Resume specific execution by ID
    return getExecutionDetail(baseDir, resume);
  } else if (resume === true) {
    // Resume last execution for this tool
    const history = getExecutionHistory(baseDir, { limit: 1, tool });
    if (history.executions.length === 0) {
      return null;
    }
    return getExecutionDetail(baseDir, history.executions[0].id);
  }
  return null;
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

// Export types
export type { ConversationRecord, ConversationTurn, ExecutionRecord };

// Export utility functions and tool definition for backward compatibility
export { executeCliTool, checkToolAvailability };

// Export tool definition (for legacy imports) - This allows direct calls to execute with onOutput
export const cliExecutorTool = {
  schema,
  execute: executeCliTool // Use executeCliTool directly which supports onOutput callback
};
