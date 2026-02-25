/**
 * Claude Session Parser - Parses Claude Code CLI JSONL session files
 * Storage path: ~/.claude/projects/<projectHash>/<sessionId>.jsonl
 */

import { readFileSync, existsSync } from 'fs';
import { basename } from 'path';
import type { ParsedSession, ParsedTurn, ToolCallInfo, TokenInfo } from './session-content-parser.js';

/**
 * Claude JSONL line types
 * Each line is a JSON object with a type field indicating the content type
 */
export interface ClaudeJsonlLine {
  type: 'user' | 'assistant' | 'summary' | 'file-history-snapshot';
  uuid: string;
  parentUuid: string | null;
  timestamp: string;
  sessionId?: string;
  cwd?: string;
  version?: string;
  gitBranch?: string;
  isSidechain?: boolean;
  isMeta?: boolean;
}

/**
 * User message line in Claude JSONL
 * Content can be string or array of content blocks
 */
export interface ClaudeUserLine extends ClaudeJsonlLine {
  type: 'user';
  message: {
    role: 'user';
    content: string | ClaudeContentBlock[];
  };
  userType?: string;
}

/**
 * Assistant message line in Claude JSONL
 * Contains content blocks, tool calls, and usage info
 */
export interface ClaudeAssistantLine extends ClaudeJsonlLine {
  type: 'assistant';
  message: {
    role: 'assistant';
    content: ClaudeContentBlock[];
    model?: string;
    id?: string;
    stop_reason?: string | null;
    stop_sequence?: string | null;
  };
  usage?: ClaudeUsage;
  requestId?: string;
}

/**
 * Summary line in Claude JSONL (for compacted conversations)
 */
export interface ClaudeSummaryLine extends ClaudeJsonlLine {
  type: 'summary';
  summary: string;
  lemon?: string;
}

/**
 * File history snapshot (metadata, not conversation content)
 */
export interface ClaudeFileHistoryLine extends ClaudeJsonlLine {
  type: 'file-history-snapshot';
  messageId: string;
  snapshot: {
    messageId: string;
    trackedFileBackups: Record<string, unknown>;
    timestamp: string;
  };
  isSnapshotUpdate: boolean;
}

/**
 * Content block in Claude messages
 */
export interface ClaudeContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'image' | 'thinking';
  text?: string;
  name?: string;
  id?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
  source?: {
    type: string;
    media_type?: string;
    data?: string;
    path?: string;
  };
  thinking?: string;
}

/**
 * Token usage information in Claude messages
 */
export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  service_tier?: string;
}

/**
 * Parse Claude Code CLI session file (JSONL format)
 * @param filePath - Path to the Claude JSONL session file
 * @returns ParsedSession object with turns, tokens, and metadata
 */
export function parseClaudeSession(filePath: string): ParsedSession | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());

    // Extract session ID from filename (UUID format)
    const sessionId = extractSessionId(filePath);

    const turns: ParsedTurn[] = [];
    let workingDir = '';
    let startTime = '';
    let lastUpdated = '';
    let model: string | undefined;
    let totalTokens: TokenInfo = { input: 0, output: 0, total: 0 };

    // Track conversation structure using uuid/parentUuid
    const messageMap = new Map<string, ClaudeJsonlLine>();
    const rootUuids: string[] = [];

    // First pass: collect all messages and find roots
    for (const line of lines) {
      try {
        const entry: ClaudeJsonlLine = JSON.parse(line);

        // Skip non-conversation types
        if (entry.type === 'file-history-snapshot') {
          continue;
        }

        messageMap.set(entry.uuid, entry);

        // Track root messages (no parent)
        if (!entry.parentUuid) {
          rootUuids.push(entry.uuid);
        }

        // Extract metadata from first entry
        if (!startTime && entry.timestamp) {
          startTime = entry.timestamp;
        }
        if (!workingDir && entry.cwd) {
          workingDir = entry.cwd;
        }

        // Update last timestamp
        if (entry.timestamp) {
          lastUpdated = entry.timestamp;
        }
      } catch {
        // Skip invalid lines
      }
    }

    // Second pass: build conversation turns
    let turnNumber = 0;
    const processedUuids = new Set<string>();

    for (const rootUuid of rootUuids) {
      const turn = processConversationBranch(
        rootUuid,
        messageMap,
        processedUuids,
        ++turnNumber
      );

      if (turn) {
        turns.push(turn);

        // Accumulate tokens
        if (turn.tokens) {
          totalTokens.input = (totalTokens.input || 0) + (turn.tokens.input || 0);
          totalTokens.output = (totalTokens.output || 0) + (turn.tokens.output || 0);
          totalTokens.total = (totalTokens.total || 0) + (turn.tokens.total || 0);
        }

        // Track model
        if (!model && turn.tokens?.input) {
          // Model info is typically in assistant messages
        }
      }
    }

    // Extract model from assistant messages if not found
    if (!model) {
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.type === 'assistant' && entry.message?.model) {
            model = entry.message.model;
            break;
          }
        } catch {
          // Skip
        }
      }
    }

    // Calculate total tokens
    totalTokens.total = (totalTokens.input || 0) + (totalTokens.output || 0);

    return {
      sessionId,
      tool: 'claude',
      workingDir,
      startTime,
      lastUpdated,
      turns,
      totalTokens: totalTokens.total > 0 ? totalTokens : undefined,
      model
    };
  } catch (error) {
    console.error(`Failed to parse Claude session file ${filePath}:`, error);
    return null;
  }
}

/**
 * Extract session ID from file path
 * Claude session files are named <uuid>.jsonl
 */
function extractSessionId(filePath: string): string {
  const filename = basename(filePath);
  // Remove .jsonl extension
  const nameWithoutExt = filename.replace(/\.jsonl$/i, '');
  // Check if it's a UUID format
  const uuidMatch = nameWithoutExt.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  return uuidMatch ? uuidMatch[1] : nameWithoutExt;
}

/**
 * Process a conversation branch starting from a root UUID
 * Returns a combined turn with user and assistant messages
 */
function processConversationBranch(
  rootUuid: string,
  messageMap: Map<string, ClaudeJsonlLine>,
  processedUuids: Set<string>,
  turnNumber: number
): ParsedTurn | null {
  const rootEntry = messageMap.get(rootUuid);
  if (!rootEntry || processedUuids.has(rootUuid)) {
    return null;
  }

  // Find the user message at this root
  let userContent = '';
  let userTimestamp = '';
  let assistantContent = '';
  let assistantTimestamp = '';
  let toolCalls: ToolCallInfo[] = [];
  let tokens: TokenInfo | undefined;
  let thoughts: string[] = [];

  // Process this entry if it's a user message
  if (rootEntry.type === 'user') {
    const userEntry = rootEntry as ClaudeUserLine;
    processedUuids.add(rootEntry.uuid);

    // Skip meta messages (command messages, etc.)
    if (userEntry.isMeta) {
      return null;
    }

    userContent = extractUserContent(userEntry);
    userTimestamp = rootEntry.timestamp;

    // Find child assistant message
    for (const [uuid, entry] of messageMap) {
      if (entry.parentUuid === rootEntry.uuid && entry.type === 'assistant') {
        const assistantEntry = entry as ClaudeAssistantLine;
        processedUuids.add(uuid);

        const extracted = extractAssistantContent(assistantEntry);
        assistantContent = extracted.content;
        assistantTimestamp = entry.timestamp;
        toolCalls = extracted.toolCalls;
        thoughts = extracted.thoughts;

        if (assistantEntry.usage) {
          tokens = {
            input: assistantEntry.usage.input_tokens,
            output: assistantEntry.usage.output_tokens,
            total: assistantEntry.usage.input_tokens + assistantEntry.usage.output_tokens,
            cached: (assistantEntry.usage.cache_read_input_tokens || 0) +
                    (assistantEntry.usage.cache_creation_input_tokens || 0)
          };
        }
        break;
      }
    }

    // Handle tool result messages (follow-up user messages)
    for (const [uuid, entry] of messageMap) {
      if (entry.parentUuid === rootEntry.uuid && entry.type === 'user') {
        const followUpUser = entry as ClaudeUserLine;
        if (!followUpUser.isMeta && processedUuids.has(uuid)) {
          continue;
        }
        // Check if this is a tool result message
        if (followUpUser.message?.content && Array.isArray(followUpUser.message.content)) {
          const hasToolResult = followUpUser.message.content.some(
            block => block.type === 'tool_result'
          );
          if (hasToolResult) {
            processedUuids.add(uuid);
            // Tool results are typically not displayed as separate turns
          }
        }
      }
    }

    if (userContent) {
      return {
        turnNumber,
        timestamp: userTimestamp,
        role: 'user',
        content: userContent
      };
    }
  }

  // If no user content but we have assistant content (edge case)
  if (assistantContent) {
    return {
      turnNumber,
      timestamp: assistantTimestamp,
      role: 'assistant',
      content: assistantContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      thoughts: thoughts.length > 0 ? thoughts : undefined,
      tokens
    };
  }

  return null;
}

/**
 * Extract text content from user message
 * Handles both string and array content formats
 */
function extractUserContent(entry: ClaudeUserLine): string {
  const content = entry.message?.content;
  if (!content) return '';

  // Simple string content
  if (typeof content === 'string') {
    // Skip command messages
    if (content.startsWith('<command-') || content.includes('<local-command')) {
      return '';
    }
    // Skip meta messages
    if (content.includes('<local-command-caveat>')) {
      return '';
    }
    return content;
  }

  // Array content - extract text blocks
  if (Array.isArray(content)) {
    const textParts: string[] = [];
    for (const block of content) {
      if (block.type === 'text' && block.text) {
        textParts.push(block.text);
      }
      // Note: tool_result blocks contain tool outputs, not user text
    }
    return textParts.join('\n');
  }

  return '';
}

/**
 * Extract content, tool calls, and thoughts from assistant message
 */
function extractAssistantContent(entry: ClaudeAssistantLine): {
  content: string;
  toolCalls: ToolCallInfo[];
  thoughts: string[];
} {
  const result: { content: string; toolCalls: ToolCallInfo[]; thoughts: string[] } = {
    content: '',
    toolCalls: [],
    thoughts: []
  };

  const content = entry.message?.content;
  if (!content || !Array.isArray(content)) {
    return result;
  }

  const textParts: string[] = [];

  for (const block of content) {
    switch (block.type) {
      case 'text':
        if (block.text) {
          textParts.push(block.text);
        }
        break;

      case 'thinking':
        if (block.thinking) {
          result.thoughts.push(block.thinking);
        }
        break;

      case 'tool_use':
        result.toolCalls.push({
          name: block.name || 'unknown',
          arguments: block.input ? JSON.stringify(block.input) : undefined
        });
        break;
    }
  }

  result.content = textParts.join('\n');
  return result;
}

/**
 * Parse Claude session content from string (for in-memory parsing)
 * @param content - The JSONL content as string
 * @param filePath - Optional file path for session ID extraction
 * @returns ParsedSession object
 */
export function parseClaudeSessionContent(content: string, filePath?: string): ParsedSession | null {
  const sessionId = filePath ? extractSessionId(filePath) : 'unknown';

  const lines = content.split('\n').filter(l => l.trim());
  const turns: ParsedTurn[] = [];
  let workingDir = '';
  let startTime = '';
  let lastUpdated = '';
  let model: string | undefined;
  let totalTokens: TokenInfo = { input: 0, output: 0, total: 0 };

  // Track conversation structure
  const messageMap = new Map<string, ClaudeJsonlLine>();
  const rootUuids: string[] = [];

  for (const line of lines) {
    try {
      const entry: ClaudeJsonlLine = JSON.parse(line);

      if (entry.type === 'file-history-snapshot') {
        continue;
      }

      messageMap.set(entry.uuid, entry);

      if (!entry.parentUuid) {
        rootUuids.push(entry.uuid);
      }

      if (!startTime && entry.timestamp) {
        startTime = entry.timestamp;
      }
      if (!workingDir && entry.cwd) {
        workingDir = entry.cwd;
      }
      if (entry.timestamp) {
        lastUpdated = entry.timestamp;
      }
    } catch {
      // Skip invalid lines
    }
  }

  let turnNumber = 0;
  const processedUuids = new Set<string>();

  for (const rootUuid of rootUuids) {
    const turn = processConversationBranch(
      rootUuid,
      messageMap,
      processedUuids,
      ++turnNumber
    );

    if (turn) {
      turns.push(turn);

      if (turn.tokens) {
        totalTokens.input = (totalTokens.input || 0) + (turn.tokens.input || 0);
        totalTokens.output = (totalTokens.output || 0) + (turn.tokens.output || 0);
      }
    }
  }

  // Extract model
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type === 'assistant' && entry.message?.model) {
        model = entry.message.model;
        break;
      }
    } catch {
      // Skip
    }
  }

  totalTokens.total = (totalTokens.input || 0) + (totalTokens.output || 0);

  return {
    sessionId,
    tool: 'claude',
    workingDir,
    startTime,
    lastUpdated,
    turns,
    totalTokens: totalTokens.total > 0 ? totalTokens : undefined,
    model
  };
}
