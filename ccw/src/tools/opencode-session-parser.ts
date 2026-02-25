/**
 * OpenCode Session Parser - Parses OpenCode multi-file session structure
 *
 * Storage Structure:
 *   session/<projectHash>/<sessionId>.json  - Session metadata
 *   message/<sessionId>/<messageId>.json    - Message content
 *   part/<messageId>/<partId>.json          - Message parts (text, tool, reasoning, step-start)
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import type { ParsedSession, ParsedTurn, ToolCallInfo, TokenInfo } from './session-content-parser.js';

// ============================================================
// OpenCode Raw Interfaces (mirrors JSON file structure)
// ============================================================

export interface OpenCodeSession {
  id: string;
  version: string;
  projectID: string;
  directory: string;
  title: string;
  time: {
    created: number;
    updated: number;
  };
  summary?: {
    additions?: number;
    deletions?: number;
    files?: number;
  };
}

export interface OpenCodeMessage {
  id: string;
  sessionID: string;
  role: 'user' | 'assistant';
  time: {
    created: number;
    completed?: number;
  };
  parentID?: string;
  modelID?: string;
  providerID?: string;
  mode?: string;
  agent?: string;
  path?: {
    cwd?: string;
    root?: string;
  };
  tokens?: {
    input: number;
    output: number;
    reasoning?: number;
    cache?: {
      read: number;
      write: number;
    };
  };
  finish?: string;
  summary?: {
    title?: string;
    diffs?: unknown[];
  };
  model?: {
    providerID?: string;
    modelID?: string;
  };
}

export interface OpenCodePart {
  id: string;
  sessionID: string;
  messageID: string;
  type: 'text' | 'tool' | 'reasoning' | 'step-start' | 'step-end';
  // For text/reasoning parts
  text?: string;
  // For tool parts
  callID?: string;
  tool?: string;
  state?: {
    status: string;
    input?: Record<string, unknown>;
    output?: string;
    time?: {
      start: number;
      end?: number;
    };
  };
  // For step-start/step-end
  snapshot?: string;
  // Timing for reasoning
  time?: {
    start: number;
    end?: number;
  };
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Get OpenCode storage base path
 */
export function getOpenCodeStoragePath(): string {
  // OpenCode uses ~/.local/share/opencode/storage on all platforms
  const homePath = process.env.USERPROFILE || process.env.HOME || '';
  return join(homePath, '.local', 'share', 'opencode', 'storage');
}

/**
 * Read JSON file safely
 */
function readJsonFile<T>(filePath: string): T | null {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    const content = readFileSync(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Get all JSON files in a directory sorted by name (which includes timestamp)
 */
function getJsonFilesInDir(dirPath: string): string[] {
  if (!existsSync(dirPath)) {
    return [];
  }
  try {
    return readdirSync(dirPath)
      .filter(f => f.endsWith('.json'))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Format timestamp (milliseconds) to ISO string
 */
function formatTimestamp(ms: number): string {
  return new Date(ms).toISOString();
}

// ============================================================
// Main Parser Function
// ============================================================

/**
 * Parse OpenCode session from session file path
 *
 * @param sessionPath - Path to session JSON file
 * @param storageBasePath - Optional base path to storage (auto-detected if not provided)
 * @returns ParsedSession with aggregated turns from messages and parts
 */
export function parseOpenCodeSession(
  sessionPath: string,
  storageBasePath?: string
): ParsedSession | null {
  // Read session file
  const session = readJsonFile<OpenCodeSession>(sessionPath);
  if (!session) {
    return null;
  }

  // Determine storage base path
  const basePath = storageBasePath || getOpenCodeStoragePath();
  const sessionId = session.id;

  // Read all messages for this session
  const messageDir = join(basePath, 'message', sessionId);
  const messageFiles = getJsonFilesInDir(messageDir);

  if (messageFiles.length === 0) {
    // Return session with no turns
    return {
      sessionId: session.id,
      tool: 'opencode',
      projectHash: session.projectID,
      workingDir: session.directory,
      startTime: formatTimestamp(session.time.created),
      lastUpdated: formatTimestamp(session.time.updated),
      turns: [],
      model: undefined,
      totalTokens: { input: 0, output: 0, total: 0 }
    };
  }

  // Eager loading: Read all messages and their parts
  const messages: Array<{
    message: OpenCodeMessage;
    parts: OpenCodePart[];
  }> = [];

  for (const msgFile of messageFiles) {
    const message = readJsonFile<OpenCodeMessage>(join(messageDir, msgFile));
    if (!message) continue;

    // Read all parts for this message
    const partDir = join(basePath, 'part', message.id);
    const partFiles = getJsonFilesInDir(partDir);
    const parts: OpenCodePart[] = [];

    for (const partFile of partFiles) {
      const part = readJsonFile<OpenCodePart>(join(partDir, partFile));
      if (part) {
        parts.push(part);
      }
    }

    messages.push({ message, parts });
  }

  // Sort messages by creation time
  messages.sort((a, b) => a.message.time.created - b.message.time.created);

  // Build turns
  const turns: ParsedTurn[] = buildTurns(messages);

  // Calculate total tokens
  const totalTokens: TokenInfo = { input: 0, output: 0, total: 0 };
  let model: string | undefined;

  for (const { message } of messages) {
    if (message.role === 'assistant' && message.tokens) {
      totalTokens.input = (totalTokens.input || 0) + message.tokens.input;
      totalTokens.output = (totalTokens.output || 0) + message.tokens.output;
      totalTokens.total = (totalTokens.total || 0) + message.tokens.input + message.tokens.output;
    }
    if (message.modelID && !model) {
      model = message.modelID;
    }
  }

  return {
    sessionId: session.id,
    tool: 'opencode',
    projectHash: session.projectID,
    workingDir: session.directory,
    startTime: formatTimestamp(session.time.created),
    lastUpdated: formatTimestamp(session.time.updated),
    turns,
    totalTokens,
    model
  };
}

/**
 * Build turns from messages and parts
 *
 * OpenCode structure:
 * - User messages have role='user' and text parts
 * - Assistant messages have role='assistant' and may have:
 *   - step-start parts (snapshot info)
 *   - reasoning parts (thoughts)
 *   - tool parts (tool calls with input/output)
 *   - text parts (final response content)
 */
function buildTurns(messages: Array<{ message: OpenCodeMessage; parts: OpenCodePart[] }>): ParsedTurn[] {
  const turns: ParsedTurn[] = [];
  let currentTurn = 0;
  let pendingUserTurn: ParsedTurn | null = null;

  for (const { message, parts } of messages) {
    if (message.role === 'user') {
      // Start new turn
      currentTurn++;

      // Extract content from text parts
      const textParts = parts.filter(p => p.type === 'text' && p.text);
      const content = textParts.map(p => p.text || '').join('\n');

      pendingUserTurn = {
        turnNumber: currentTurn,
        timestamp: formatTimestamp(message.time.created),
        role: 'user',
        content
      };
      turns.push(pendingUserTurn);
    } else if (message.role === 'assistant') {
      // Extract thoughts from reasoning parts
      const reasoningParts = parts.filter(p => p.type === 'reasoning' && p.text);
      const thoughts = reasoningParts.map(p => p.text || '').filter(t => t);

      // Extract tool calls from tool parts
      const toolParts = parts.filter(p => p.type === 'tool');
      const toolCalls: ToolCallInfo[] = toolParts.map(p => ({
        name: p.tool || 'unknown',
        arguments: p.state?.input ? JSON.stringify(p.state.input) : undefined,
        output: p.state?.output
      }));

      // Extract content from text parts (final response)
      const textParts = parts.filter(p => p.type === 'text' && p.text);
      const content = textParts.map(p => p.text || '').join('\n');

      // Build token info
      const tokens: TokenInfo | undefined = message.tokens ? {
        input: message.tokens.input,
        output: message.tokens.output,
        cached: message.tokens.cache?.read,
        total: message.tokens.input + message.tokens.output
      } : undefined;

      const assistantTurn: ParsedTurn = {
        turnNumber: currentTurn,
        timestamp: formatTimestamp(message.time.created),
        role: 'assistant',
        content: content || (toolCalls.length > 0 ? '[Tool execution completed]' : ''),
        thoughts: thoughts.length > 0 ? thoughts : undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        tokens
      };
      turns.push(assistantTurn);

      pendingUserTurn = null;
    }
  }

  return turns;
}

/**
 * Parse OpenCode session from session ID
 *
 * @param sessionId - OpenCode session ID (e.g., 'ses_xxx')
 * @param projectHash - Optional project hash (will search all projects if not provided)
 * @returns ParsedSession or null if not found
 */
export function parseOpenCodeSessionById(
  sessionId: string,
  projectHash?: string
): ParsedSession | null {
  const basePath = getOpenCodeStoragePath();
  const sessionDir = join(basePath, 'session');

  if (!existsSync(sessionDir)) {
    return null;
  }

  // If project hash provided, look in that directory
  if (projectHash) {
    const sessionPath = join(sessionDir, projectHash, `${sessionId}.json`);
    return parseOpenCodeSession(sessionPath, basePath);
  }

  // Search all project directories
  try {
    const projectDirs = readdirSync(sessionDir).filter(d => {
      const fullPath = join(sessionDir, d);
      return statSync(fullPath).isDirectory();
    });

    for (const projHash of projectDirs) {
      const sessionPath = join(sessionDir, projHash, `${sessionId}.json`);
      if (existsSync(sessionPath)) {
        return parseOpenCodeSession(sessionPath, basePath);
      }
    }
  } catch {
    // Ignore errors
  }

  return null;
}

/**
 * Get all OpenCode sessions for a project
 *
 * @param projectHash - Project hash to filter by
 * @returns Array of session info (not full parsed sessions)
 */
export function getOpenCodeSessions(projectHash?: string): Array<{
  sessionId: string;
  projectHash: string;
  filePath: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
}> {
  const basePath = getOpenCodeStoragePath();
  const sessionDir = join(basePath, 'session');
  const sessions: Array<{
    sessionId: string;
    projectHash: string;
    filePath: string;
    title?: string;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  if (!existsSync(sessionDir)) {
    return sessions;
  }

  try {
    const projectDirs = projectHash
      ? [projectHash]
      : readdirSync(sessionDir).filter(d => {
          const fullPath = join(sessionDir, d);
          return statSync(fullPath).isDirectory();
        });

    for (const projHash of projectDirs) {
      const projDir = join(sessionDir, projHash);
      if (!existsSync(projDir)) continue;

      const sessionFiles = getJsonFilesInDir(projDir);

      for (const sessionFile of sessionFiles) {
        const filePath = join(projDir, sessionFile);
        const session = readJsonFile<OpenCodeSession>(filePath);

        if (session) {
          sessions.push({
            sessionId: session.id,
            projectHash: session.projectID,
            filePath,
            title: session.title,
            createdAt: new Date(session.time.created),
            updatedAt: new Date(session.time.updated)
          });
        }
      }
    }
  } catch {
    // Ignore errors
  }

  // Sort by updated time descending
  sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return sessions;
}

export default parseOpenCodeSession;
