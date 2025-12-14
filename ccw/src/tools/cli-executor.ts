/**
 * CLI Executor Tool - Unified execution for external CLI tools
 * Supports Gemini, Qwen, and Codex with streaming output
 */

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';
import { spawn, ChildProcess } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

// Native resume support
import {
  trackNewSession,
  getNativeResumeArgs,
  supportsNativeResume,
  calculateProjectHash
} from './native-session-discovery.js';
import {
  determineResumeStrategy,
  buildContextPrefix,
  getResumeModeDescription,
  type ResumeDecision
} from './resume-strategy.js';

// CLI History storage path
const CLI_HISTORY_DIR = join(process.cwd(), '.workflow', '.cli-history');

// Lazy-loaded SQLite store module
let sqliteStoreModule: typeof import('./cli-history-store.js') | null = null;

/**
 * Get or initialize SQLite store (async)
 */
async function getSqliteStore(baseDir: string) {
  if (!sqliteStoreModule) {
    sqliteStoreModule = await import('./cli-history-store.js');
  }
  return sqliteStoreModule.getHistoryStore(baseDir);
}

/**
 * Get SQLite store (sync - uses cached module)
 */
function getSqliteStoreSync(baseDir: string) {
  if (!sqliteStoreModule) {
    throw new Error('SQLite store not initialized. Call an async function first.');
  }
  return sqliteStoreModule.getHistoryStore(baseDir);
}

// Define Zod schema for validation
const ParamsSchema = z.object({
  tool: z.enum(['gemini', 'qwen', 'codex']),
  prompt: z.string().min(1, 'Prompt is required'),
  mode: z.enum(['analysis', 'write', 'auto']).default('analysis'),
  format: z.enum(['plain', 'yaml', 'json']).default('plain'), // Multi-turn prompt concatenation format
  model: z.string().optional(),
  cd: z.string().optional(),
  includeDirs: z.string().optional(),
  timeout: z.number().default(300000),
  resume: z.union([z.boolean(), z.string()]).optional(), // true = last, string = single ID or comma-separated IDs
  id: z.string().optional(), // Custom execution ID (e.g., IMPL-001-step1)
  noNative: z.boolean().optional(), // Force prompt concatenation instead of native resume
  category: z.enum(['user', 'internal', 'insight']).default('user'), // Execution category for tracking
  parentExecutionId: z.string().optional(), // Parent execution ID for fork/retry scenarios
});

// Execution category types
export type ExecutionCategory = 'user' | 'internal' | 'insight';

type Params = z.infer<typeof ParamsSchema>;

// Prompt concatenation format types
type PromptFormat = 'plain' | 'yaml' | 'json';

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
  category: ExecutionCategory; // user | internal | insight
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

// Native resume configuration
interface NativeResumeConfig {
  enabled: boolean;
  sessionId?: string;   // Native UUID
  isLatest?: boolean;   // Use latest/--last flag
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
  nativeResume?: NativeResumeConfig;
}): { command: string; args: string[]; useStdin: boolean } {
  const { tool, prompt, mode = 'analysis', model, dir, include, nativeResume } = params;

  let command = tool;
  let args: string[] = [];
  // Default to stdin for all tools to avoid escaping issues on Windows
  let useStdin = true;

  switch (tool) {
    case 'gemini':
      // Native resume: gemini -r <uuid> or -r latest
      if (nativeResume?.enabled) {
        if (nativeResume.isLatest) {
          args.push('-r', 'latest');
        } else if (nativeResume.sessionId) {
          args.push('-r', nativeResume.sessionId);
        }
      }
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
      // Native resume: qwen --continue (latest) or --resume <uuid>
      if (nativeResume?.enabled) {
        if (nativeResume.isLatest) {
          args.push('--continue');
        } else if (nativeResume.sessionId) {
          args.push('--resume', nativeResume.sessionId);
        }
      }
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
      // Native resume: codex resume <uuid> [prompt] or --last
      if (nativeResume?.enabled) {
        args.push('resume');
        if (nativeResume.isLatest) {
          args.push('--last');
        } else if (nativeResume.sessionId) {
          args.push(nativeResume.sessionId);
        }
        // Codex resume still supports additional flags
        if (dir) {
          args.push('-C', dir);
        }
        if (mode === 'write' || mode === 'auto') {
          args.push('--skip-git-repo-check', '-s', 'danger-full-access');
        }
        if (model) {
          args.push('-m', model);
        }
        if (include) {
          const dirs = include.split(',').map(d => d.trim()).filter(d => d);
          for (const addDir of dirs) {
            args.push('--add-dir', addDir);
          }
        }
      } else {
        // Standard exec mode
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
          const dirs = include.split(',').map(d => d.trim()).filter(d => d);
          for (const addDir of dirs) {
            args.push('--add-dir', addDir);
          }
        }
      }
      break;

    case 'claude':
      // Claude Code: claude -p "prompt" for non-interactive mode
      args.push('-p'); // Print mode (non-interactive)
      // Native resume: claude --resume <session-id> or --continue
      if (nativeResume?.enabled) {
        if (nativeResume.isLatest) {
          args.push('--continue');
        } else if (nativeResume.sessionId) {
          args.push('--resume', nativeResume.sessionId);
        }
      }
      if (model) {
        args.push('--model', model);
      }
      // Permission modes for write/auto
      if (mode === 'write' || mode === 'auto') {
        args.push('--dangerously-skip-permissions');
      }
      // Output format for better parsing
      args.push('--output-format', 'text');
      // Add directories
      if (include) {
        const dirs = include.split(',').map(d => d.trim()).filter(d => d);
        for (const addDir of dirs) {
          args.push('--add-dir', addDir);
        }
      }
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
 * Save conversation to SQLite
 */
async function saveConversationAsync(historyDir: string, conversation: ConversationRecord): Promise<void> {
  const baseDir = historyDir.replace(/[\\\/]\.workflow[\\\/]\.cli-history$/, '');
  const store = await getSqliteStore(baseDir);
  store.saveConversation(conversation);
}

/**
 * Sync wrapper for saveConversation (uses cached SQLite module)
 */
function saveConversation(historyDir: string, conversation: ConversationRecord): void {
  const baseDir = historyDir.replace(/[\\\/]\.workflow[\\\/]\.cli-history$/, '');
  try {
    const store = getSqliteStoreSync(baseDir);
    store.saveConversation(conversation);
  } catch {
    // If sync not available, queue for async save
    saveConversationAsync(historyDir, conversation).catch(err => {
      console.error('[CLI Executor] Failed to save conversation:', err.message);
    });
  }
}

/**
 * Load existing conversation by ID from SQLite
 */
async function loadConversationAsync(historyDir: string, conversationId: string): Promise<ConversationRecord | null> {
  const baseDir = historyDir.replace(/[\\\/]\.workflow[\\\/]\.cli-history$/, '');
  const store = await getSqliteStore(baseDir);
  return store.getConversation(conversationId);
}

/**
 * Sync wrapper for loadConversation (uses cached SQLite module)
 */
function loadConversation(historyDir: string, conversationId: string): ConversationRecord | null {
  const baseDir = historyDir.replace(/[\\\/]\.workflow[\\\/]\.cli-history$/, '');
  try {
    const store = getSqliteStoreSync(baseDir);
    return store.getConversation(conversationId);
  } catch {
    // SQLite not initialized yet, return null
    return null;
  }
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
    category: 'user', // Legacy records default to user category
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
function buildMergedPrompt(
  mergeResult: MergeResult,
  newPrompt: string,
  format: PromptFormat = 'plain'
): string {
  const concatenator = createPromptConcatenator({ format });

  // Set metadata for merged conversations
  concatenator.setMetadata(
    'merged_sources',
    mergeResult.sourceConversations.map(c => c.id).join(', ')
  );

  // Add all merged turns with source tracking
  for (const turn of mergeResult.mergedTurns) {
    concatenator.addFromConversationTurn(turn, turn.source_id);
  }

  return concatenator.build(newPrompt);
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

  const { tool, prompt, mode, format, model, cd, includeDirs, timeout, resume, id: customId, noNative, category } = parsed.data;

  // Determine working directory early (needed for conversation lookup)
  const workingDir = cd || process.cwd();
  const historyDir = ensureHistoryDir(workingDir);

  // Get SQLite store for native session lookup
  const store = await getSqliteStore(workingDir);

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

  // Determine resume strategy (native vs prompt-concat vs hybrid)
  let resumeDecision: ResumeDecision | null = null;
  let nativeResumeConfig: NativeResumeConfig | undefined;

  // resume=true (latest) - use native latest if supported
  if (resume === true && !noNative && supportsNativeResume(tool)) {
    resumeDecision = {
      strategy: 'native',
      isLatest: true,
      primaryConversationId: conversationId
    };
  }
  // Use strategy engine for complex scenarios
  else if (resumeIds.length > 0 && !noNative) {
    resumeDecision = determineResumeStrategy({
      tool,
      resumeIds,
      customId,
      forcePromptConcat: noNative,
      getNativeSessionId: (ccwId) => store.getNativeSessionId(ccwId),
      getConversation: (ccwId) => loadConversation(historyDir, ccwId),
      getConversationTool: (ccwId) => {
        const conv = loadConversation(historyDir, ccwId);
        return conv?.tool || null;
      }
    });
  }

  // Configure native resume if strategy decided to use it
  if (resumeDecision && (resumeDecision.strategy === 'native' || resumeDecision.strategy === 'hybrid')) {
    nativeResumeConfig = {
      enabled: true,
      sessionId: resumeDecision.nativeSessionId,
      isLatest: resumeDecision.isLatest
    };
  }

  // Build final prompt with conversation context
  // For native: minimal prompt (native tool handles context)
  // For hybrid: context prefix from other conversations + new prompt
  // For prompt-concat: full multi-turn prompt
  let finalPrompt = prompt;

  if (resumeDecision?.strategy === 'native') {
    // Native mode: just use the new prompt, tool handles context
    finalPrompt = prompt;
  } else if (resumeDecision?.strategy === 'hybrid' && resumeDecision.contextTurns?.length) {
    // Hybrid mode: add context prefix from other conversations
    const contextPrefix = buildContextPrefix(resumeDecision.contextTurns, format);
    finalPrompt = contextPrefix + prompt;
  } else if (mergeResult && mergeResult.mergedTurns.length > 0) {
    // Full merge: use merged prompt
    finalPrompt = buildMergedPrompt(mergeResult, prompt, format);
  } else {
    // Standard prompt-concat
    const conversationForContext = contextConversation || existingConversation;
    if (conversationForContext && conversationForContext.turns.length > 0) {
      finalPrompt = buildMultiTurnPrompt(conversationForContext, prompt, format);
    }
  }

  // Check tool availability
  const toolStatus = await checkToolAvailability(tool);
  if (!toolStatus.available) {
    throw new Error(`CLI tool not available: ${tool}. Please ensure it is installed and in PATH.`);
  }

  // Log resume mode for debugging
  if (resumeDecision) {
    const modeDesc = getResumeModeDescription(resumeDecision);
    if (onOutput) {
      onOutput({ type: 'stderr', data: `[Resume mode: ${modeDesc}]\n` });
    }
  }

  // Build command
  const { command, args, useStdin } = buildCommand({
    tool,
    prompt: finalPrompt,
    mode,
    model,
    dir: cd,
    include: includeDirs,
    nativeResume: nativeResumeConfig
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
              category,
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
              category,
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

      // Track native session after execution (async, non-blocking)
      trackNewSession(tool, new Date(startTime), workingDir)
        .then((nativeSession) => {
          if (nativeSession) {
            // Save native session mapping
            try {
              store.saveNativeSessionMapping({
                ccw_id: conversationId,
                tool,
                native_session_id: nativeSession.sessionId,
                native_session_path: nativeSession.filePath,
                project_hash: nativeSession.projectHash,
                created_at: new Date().toISOString()
              });
            } catch (err) {
              console.error('[CLI Executor] Failed to save native session mapping:', (err as Error).message);
            }
          }
        })
        .catch((err) => {
          console.error('[CLI Executor] Failed to track native session:', (err as Error).message);
        });

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

    // Check if this directory has CLI history (SQLite database)
    const historyDir = join(dir, '.workflow', '.cli-history');
    if (existsSync(join(historyDir, 'history.db'))) {
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
 * Get execution history from SQLite
 */
export async function getExecutionHistoryAsync(baseDir: string, options: {
  limit?: number;
  tool?: string | null;
  status?: string | null;
  category?: ExecutionCategory | null;
  search?: string | null;
  recursive?: boolean;
} = {}): Promise<{
  total: number;
  count: number;
  executions: (HistoryIndex['executions'][0] & { sourceDir?: string })[];
}> {
  const { limit = 50, tool = null, status = null, category = null, search = null, recursive = false } = options;

  if (recursive) {
    // For recursive, we need to check multiple directories
    const historyDirs = findCliHistoryDirs(baseDir);
    let allExecutions: (HistoryIndex['executions'][0] & { sourceDir?: string })[] = [];
    let totalCount = 0;

    for (const historyDir of historyDirs) {
      const dirBase = historyDir.replace(/[\\\/]\.workflow[\\\/]\.cli-history$/, '');
      const store = await getSqliteStore(dirBase);
      const result = store.getHistory({ limit: 100, tool, status, category, search });
      totalCount += result.total;

      const relativeSource = relative(baseDir, dirBase) || '.';
      for (const exec of result.executions) {
        allExecutions.push({ ...exec, sourceDir: relativeSource });
      }
    }

    // Sort by timestamp (newest first)
    allExecutions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      total: totalCount,
      count: Math.min(allExecutions.length, limit),
      executions: allExecutions.slice(0, limit)
    };
  }

  const store = await getSqliteStore(baseDir);
  return store.getHistory({ limit, tool, status, category, search });
}

/**
 * Get execution history (sync version - uses cached SQLite module)
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

  try {
    if (recursive) {
      const historyDirs = findCliHistoryDirs(baseDir);
      let allExecutions: (HistoryIndex['executions'][0] & { sourceDir?: string })[] = [];
      let totalCount = 0;

      for (const historyDir of historyDirs) {
        const dirBase = historyDir.replace(/[\\\/]\.workflow[\\\/]\.cli-history$/, '');
        const store = getSqliteStoreSync(dirBase);
        const result = store.getHistory({ limit: 100, tool, status });
        totalCount += result.total;

        const relativeSource = relative(baseDir, dirBase) || '.';
        for (const exec of result.executions) {
          allExecutions.push({ ...exec, sourceDir: relativeSource });
        }
      }

      allExecutions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return {
        total: totalCount,
        count: Math.min(allExecutions.length, limit),
        executions: allExecutions.slice(0, limit)
      };
    }

    const store = getSqliteStoreSync(baseDir);
    return store.getHistory({ limit, tool, status });
  } catch {
    // SQLite not initialized, return empty
    return { total: 0, count: 0, executions: [] };
  }
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
 * Delete execution by ID (async version)
 */
export async function deleteExecutionAsync(baseDir: string, executionId: string): Promise<{ success: boolean; error?: string }> {
  const store = await getSqliteStore(baseDir);
  return store.deleteConversation(executionId);
}

/**
 * Delete execution by ID (sync version - uses cached SQLite module)
 */
export function deleteExecution(baseDir: string, executionId: string): { success: boolean; error?: string } {
  try {
    const store = getSqliteStoreSync(baseDir);
    return store.deleteConversation(executionId);
  } catch {
    return { success: false, error: 'SQLite store not initialized' };
  }
}

/**
 * Batch delete executions (async)
 */
export async function batchDeleteExecutionsAsync(baseDir: string, ids: string[]): Promise<{
  success: boolean;
  deleted: number;
  total: number;
  errors?: string[];
}> {
  const store = await getSqliteStore(baseDir);
  const result = store.batchDelete(ids);
  return { ...result, total: ids.length };
}

/**
 * Get status of all CLI tools
 */
export async function getCliToolsStatus(): Promise<Record<string, ToolAvailability>> {
  const tools = ['gemini', 'qwen', 'codex', 'claude'];
  const results: Record<string, ToolAvailability> = {};

  await Promise.all(tools.map(async (tool) => {
    results[tool] = await checkToolAvailability(tool);
  }));

  return results;
}

// ========== Prompt Concatenation System ==========

/**
 * Turn data structure for concatenation
 */
interface TurnData {
  turn: number;
  timestamp?: string;
  role: 'user' | 'assistant';
  content: string;
  status?: string;
  duration_ms?: number;
  source_id?: string; // For merged conversations
}

/**
 * Prompt concatenation options
 */
interface ConcatOptions {
  format: PromptFormat;
  includeMetadata?: boolean;
  includeTurnMarkers?: boolean;
  maxOutputLength?: number; // Truncate output for context efficiency
}

/**
 * PromptConcatenator - Dedicated class for building multi-turn prompts
 * Supports multiple output formats: plain text, YAML, JSON
 */
class PromptConcatenator {
  private turns: TurnData[] = [];
  private options: ConcatOptions;
  private metadata: Record<string, unknown> = {};

  constructor(options: Partial<ConcatOptions> = {}) {
    this.options = {
      format: options.format || 'plain',
      includeMetadata: options.includeMetadata ?? true,
      includeTurnMarkers: options.includeTurnMarkers ?? true,
      maxOutputLength: options.maxOutputLength || 8192
    };
  }

  /**
   * Set metadata for the conversation
   */
  setMetadata(key: string, value: unknown): this {
    this.metadata[key] = value;
    return this;
  }

  /**
   * Add a user turn
   */
  addUserTurn(content: string, options: Partial<Omit<TurnData, 'role' | 'content'>> = {}): this {
    this.turns.push({
      turn: this.turns.length + 1,
      role: 'user',
      content,
      ...options
    });
    return this;
  }

  /**
   * Add an assistant turn
   */
  addAssistantTurn(content: string, options: Partial<Omit<TurnData, 'role' | 'content'>> = {}): this {
    // Truncate output if needed
    const truncatedContent = content.length > this.options.maxOutputLength!
      ? content.substring(0, this.options.maxOutputLength!) + '\n... [truncated]'
      : content;

    this.turns.push({
      turn: this.turns.length + 1,
      role: 'assistant',
      content: truncatedContent,
      ...options
    });
    return this;
  }

  /**
   * Add a conversation turn from ConversationTurn
   */
  addFromConversationTurn(turn: ConversationTurn, sourceId?: string): this {
    this.addUserTurn(turn.prompt, {
      turn: turn.turn * 2 - 1,
      timestamp: turn.timestamp,
      source_id: sourceId
    });
    this.addAssistantTurn(turn.output.stdout || '[No output]', {
      turn: turn.turn * 2,
      timestamp: turn.timestamp,
      status: turn.status,
      duration_ms: turn.duration_ms,
      source_id: sourceId
    });
    return this;
  }

  /**
   * Load turns from an existing conversation
   */
  loadConversation(conversation: ConversationRecord): this {
    for (const turn of conversation.turns) {
      this.addFromConversationTurn(turn);
    }
    return this;
  }

  /**
   * Build the final prompt in plain text format
   */
  private buildPlainText(newPrompt: string): string {
    const parts: string[] = [];

    // Metadata section
    if (this.options.includeMetadata && Object.keys(this.metadata).length > 0) {
      parts.push('=== CONTEXT ===');
      for (const [key, value] of Object.entries(this.metadata)) {
        parts.push(`${key}: ${String(value)}`);
      }
      parts.push('');
    }

    // Conversation history
    if (this.turns.length > 0) {
      parts.push('=== CONVERSATION HISTORY ===');
      parts.push('');

      let currentTurn = 0;
      for (let i = 0; i < this.turns.length; i += 2) {
        currentTurn++;
        const userTurn = this.turns[i];
        const assistantTurn = this.turns[i + 1];

        if (this.options.includeTurnMarkers) {
          const sourceMarker = userTurn.source_id ? ` [${userTurn.source_id}]` : '';
          parts.push(`--- Turn ${currentTurn}${sourceMarker} ---`);
        }

        parts.push('USER:');
        parts.push(userTurn.content);
        parts.push('');

        if (assistantTurn) {
          parts.push('ASSISTANT:');
          parts.push(assistantTurn.content);
          parts.push('');
        }
      }
    }

    // New request
    parts.push('=== NEW REQUEST ===');
    parts.push('');
    parts.push(newPrompt);

    return parts.join('\n');
  }

  /**
   * Build the final prompt in YAML format
   */
  private buildYaml(newPrompt: string): string {
    const yamlLines: string[] = [];

    // Metadata
    if (this.options.includeMetadata && Object.keys(this.metadata).length > 0) {
      yamlLines.push('context:');
      for (const [key, value] of Object.entries(this.metadata)) {
        yamlLines.push(`  ${key}: ${this.yamlValue(value)}`);
      }
      yamlLines.push('');
    }

    // Conversation history
    if (this.turns.length > 0) {
      yamlLines.push('conversation:');

      let currentTurn = 0;
      for (let i = 0; i < this.turns.length; i += 2) {
        currentTurn++;
        const userTurn = this.turns[i];
        const assistantTurn = this.turns[i + 1];

        yamlLines.push(`  - turn: ${currentTurn}`);
        if (userTurn.source_id) {
          yamlLines.push(`    source: ${userTurn.source_id}`);
        }
        if (userTurn.timestamp) {
          yamlLines.push(`    timestamp: ${userTurn.timestamp}`);
        }

        // User message
        yamlLines.push('    user: |');
        const userLines = userTurn.content.split('\n');
        for (const line of userLines) {
          yamlLines.push(`      ${line}`);
        }

        // Assistant message
        if (assistantTurn) {
          if (assistantTurn.status) {
            yamlLines.push(`    status: ${assistantTurn.status}`);
          }
          if (assistantTurn.duration_ms) {
            yamlLines.push(`    duration_ms: ${assistantTurn.duration_ms}`);
          }
          yamlLines.push('    assistant: |');
          const assistantLines = assistantTurn.content.split('\n');
          for (const line of assistantLines) {
            yamlLines.push(`      ${line}`);
          }
        }
        yamlLines.push('');
      }
    }

    // New request
    yamlLines.push('new_request: |');
    const requestLines = newPrompt.split('\n');
    for (const line of requestLines) {
      yamlLines.push(`  ${line}`);
    }

    return yamlLines.join('\n');
  }

  /**
   * Build the final prompt in JSON format
   */
  private buildJson(newPrompt: string): string {
    const data: Record<string, unknown> = {};

    // Metadata
    if (this.options.includeMetadata && Object.keys(this.metadata).length > 0) {
      data.context = this.metadata;
    }

    // Conversation history
    if (this.turns.length > 0) {
      const conversation: Array<{
        turn: number;
        source?: string;
        timestamp?: string;
        user: string;
        assistant?: string;
        status?: string;
        duration_ms?: number;
      }> = [];

      for (let i = 0; i < this.turns.length; i += 2) {
        const userTurn = this.turns[i];
        const assistantTurn = this.turns[i + 1];

        const turnData: typeof conversation[0] = {
          turn: Math.ceil((i + 1) / 2),
          user: userTurn.content
        };

        if (userTurn.source_id) turnData.source = userTurn.source_id;
        if (userTurn.timestamp) turnData.timestamp = userTurn.timestamp;
        if (assistantTurn) {
          turnData.assistant = assistantTurn.content;
          if (assistantTurn.status) turnData.status = assistantTurn.status;
          if (assistantTurn.duration_ms) turnData.duration_ms = assistantTurn.duration_ms;
        }

        conversation.push(turnData);
      }

      data.conversation = conversation;
    }

    data.new_request = newPrompt;

    return JSON.stringify(data, null, 2);
  }

  /**
   * Helper to format YAML values
   */
  private yamlValue(value: unknown): string {
    if (typeof value === 'string') {
      // Quote strings that might be interpreted as other types
      if (/[:\[\]{}#&*!|>'"@`]/.test(value) || value === '') {
        return `"${value.replace(/"/g, '\\"')}"`;
      }
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (value === null || value === undefined) {
      return 'null';
    }
    return JSON.stringify(value);
  }

  /**
   * Build the final prompt string
   */
  build(newPrompt: string): string {
    switch (this.options.format) {
      case 'yaml':
        return this.buildYaml(newPrompt);
      case 'json':
        return this.buildJson(newPrompt);
      case 'plain':
      default:
        return this.buildPlainText(newPrompt);
    }
  }

  /**
   * Reset the concatenator for reuse
   */
  reset(): this {
    this.turns = [];
    this.metadata = {};
    return this;
  }
}

/**
 * Create a prompt concatenator with specified options
 */
function createPromptConcatenator(options?: Partial<ConcatOptions>): PromptConcatenator {
  return new PromptConcatenator(options);
}

/**
 * Quick helper to build a multi-turn prompt in any format
 */
function buildPrompt(
  conversation: ConversationRecord,
  newPrompt: string,
  format: PromptFormat = 'plain'
): string {
  return createPromptConcatenator({ format })
    .loadConversation(conversation)
    .build(newPrompt);
}

/**
 * Build multi-turn prompt with full conversation history
 * Uses the PromptConcatenator with plain text format by default
 */
function buildMultiTurnPrompt(
  conversation: ConversationRecord,
  newPrompt: string,
  format: PromptFormat = 'plain'
): string {
  return buildPrompt(conversation, newPrompt, format);
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

// ========== Native Session Content Functions ==========

/**
 * Get native session content by CCW ID
 * Parses the native session file and returns full conversation data
 */
export async function getNativeSessionContent(baseDir: string, ccwId: string) {
  const store = await getSqliteStore(baseDir);
  return store.getNativeSessionContent(ccwId);
}

/**
 * Get formatted native conversation text
 */
export async function getFormattedNativeConversation(baseDir: string, ccwId: string, options?: {
  includeThoughts?: boolean;
  includeToolCalls?: boolean;
  includeTokens?: boolean;
  maxContentLength?: number;
}) {
  const store = await getSqliteStore(baseDir);
  return store.getFormattedNativeConversation(ccwId, options);
}

/**
 * Get conversation pairs from native session
 */
export async function getNativeConversationPairs(baseDir: string, ccwId: string) {
  const store = await getSqliteStore(baseDir);
  return store.getNativeConversationPairs(ccwId);
}

/**
 * Get enriched conversation (CCW + native session merged)
 */
export async function getEnrichedConversation(baseDir: string, ccwId: string) {
  const store = await getSqliteStore(baseDir);
  return store.getEnrichedConversation(ccwId);
}

/**
 * Get history with native session info
 */
export async function getHistoryWithNativeInfo(baseDir: string, options?: {
  limit?: number;
  offset?: number;
  tool?: string | null;
  status?: string | null;
  category?: ExecutionCategory | null;
  search?: string | null;
}) {
  const store = await getSqliteStore(baseDir);
  return store.getHistoryWithNativeInfo(options || {});
}

// Export types
export type { ConversationRecord, ConversationTurn, ExecutionRecord, PromptFormat, ConcatOptions };

// Export utility functions and tool definition for backward compatibility
export { executeCliTool, checkToolAvailability };

// Export prompt concatenation utilities
export { PromptConcatenator, createPromptConcatenator, buildPrompt, buildMultiTurnPrompt };

// Note: Async storage functions (getExecutionHistoryAsync, deleteExecutionAsync,
// batchDeleteExecutionsAsync) are exported at declaration site - SQLite storage only

// Export tool definition (for legacy imports) - This allows direct calls to execute with onOutput
export const cliExecutorTool = {
  schema,
  execute: executeCliTool // Use executeCliTool directly which supports onOutput callback
};
