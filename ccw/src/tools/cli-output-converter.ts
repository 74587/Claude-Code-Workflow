/**
 * CLI Output Converter
 * Converts raw CLI tool output into structured Intermediate Representation (IR)
 *
 * Purpose: Decouple output parsing from consumption scenarios (View, Storage, Resume)
 * Supports: Plain text, JSON Lines, and other structured formats
 */

// ========== Type Definitions ==========

/**
 * Unified output unit types for the intermediate representation layer
 */
export type CliOutputUnitType =
  | 'stdout'         // Standard output text
  | 'stderr'         // Standard error text
  | 'thought'        // AI reasoning/thinking
  | 'code'           // Code block content
  | 'file_diff'      // File modification diff
  | 'progress'       // Progress updates
  | 'metadata'       // Session/execution metadata
  | 'system';        // System events/messages

/**
 * Intermediate Representation unit
 * Common structure for all CLI output chunks
 */
export interface CliOutputUnit<T = any> {
  type: CliOutputUnitType;
  content: T;
  timestamp: string;  // ISO 8601 format
}

// ========== Parser Interface ==========

/**
 * Parser interface for converting raw output into IR
 */
export interface IOutputParser {
  /**
   * Parse a chunk of data from stdout/stderr stream
   * @param chunk - Raw buffer from stream
   * @param streamType - Source stream (stdout or stderr)
   * @returns Array of parsed output units
   */
  parse(chunk: Buffer, streamType: 'stdout' | 'stderr'): CliOutputUnit[];

  /**
   * Flush any remaining buffered data
   * Called when stream ends to ensure no data is lost
   * @returns Array of remaining output units
   */
  flush(): CliOutputUnit[];
}

// ========== Plain Text Parser ==========

/**
 * PlainTextParser - Converts plain text output to IR
 * Simply wraps text in appropriate type envelope
 */
export class PlainTextParser implements IOutputParser {
  parse(chunk: Buffer, streamType: 'stdout' | 'stderr'): CliOutputUnit[] {
    const text = chunk.toString('utf8');

    if (!text) {
      return [];
    }

    return [{
      type: streamType,
      content: text,
      timestamp: new Date().toISOString()
    }];
  }

  /**
   * Flush any remaining buffered data
   * Called when stream ends to ensure no data is lost
   *
   * Note: PlainTextParser does not buffer data internally, so this method
   * always returns an empty array. Other parsers (e.g., JsonLinesParser)
   * may have buffered incomplete lines that need to be flushed.
   *
   * @returns Array of remaining output units (always empty for PlainTextParser)
   */
  flush(): CliOutputUnit[] {
    // Plain text parser has no internal buffer
    return [];
  }
}

// ========== JSON Lines Parser ==========

/**
 * JsonLinesParser - Parses newline-delimited JSON output
 *
 * Features:
 * - Handles incomplete lines across chunks
 * - Maps JSON events to appropriate IR types
 * - Falls back to stdout for unparseable lines
 * - Robust error handling for malformed JSON
 */
export class JsonLinesParser implements IOutputParser {
  private buffer: string = '';

  /**
   * Classify non-JSON content to determine appropriate output type
   * Helps distinguish real errors from normal progress/output sent to stderr
   * (Some CLI tools like Codex send all progress info to stderr)
   */
  private classifyNonJsonContent(content: string, originalType: 'stdout' | 'stderr'): 'stdout' | 'stderr' {
    // If it came from stdout, keep it as stdout
    if (originalType === 'stdout') {
      return 'stdout';
    }

    // Check if content looks like an actual error
    const errorPatterns = [
      /^error:/i,
      /^fatal:/i,
      /^failed:/i,
      /^exception:/i,
      /\bERROR\b/,
      /\bFATAL\b/,
      /\bFAILED\b/,
      /\bpanic:/i,
      /traceback \(most recent/i,
      /syntaxerror:/i,
      /typeerror:/i,
      /referenceerror:/i,
      /\bstack trace\b/i,
      /\bat line \d+\b/i,
      /permission denied/i,
      /access denied/i,
      /authentication failed/i,
      /connection refused/i,
      /network error/i,
      /unable to connect/i,
    ];

    for (const pattern of errorPatterns) {
      if (pattern.test(content)) {
        return 'stderr';
      }
    }

    // Check for common CLI progress/info patterns that are NOT errors
    const progressPatterns = [
      /^[-=]+$/,                    // Separators: ----, ====
      /^\s*\d+\s*$/,               // Just numbers
      /tokens?\s*(used|count)/i,   // Token counts
      /model:/i,                   // Model info
      /session\s*id:/i,            // Session info
      /workdir:/i,                 // Working directory
      /provider:/i,                // Provider info
      /^(user|assistant|codex|claude|gemini)$/i,  // Role labels
      /^mcp:/i,                    // MCP status
      /^[-\s]*$/,                  // Empty or whitespace/dashes
    ];

    for (const pattern of progressPatterns) {
      if (pattern.test(content)) {
        return 'stdout';  // Treat as normal output, not error
      }
    }

    // Default: if stderr but doesn't look like an error, treat as stdout
    // This handles CLI tools that send everything to stderr (like Codex)
    return 'stdout';
  }

  parse(chunk: Buffer, streamType: 'stdout' | 'stderr'): CliOutputUnit[] {
    const text = chunk.toString('utf8');
    this.buffer += text;

    const units: CliOutputUnit[] = [];
    const lines = this.buffer.split('\n');

    // Keep the last incomplete line in buffer
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      // Try to parse as JSON
      let parsed: any;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        // Not valid JSON, treat as plain text
        // For stderr content, check if it's actually an error or just normal output
        // (Some CLI tools like Codex send all progress info to stderr)
        const effectiveType = this.classifyNonJsonContent(line, streamType);
        units.push({
          type: effectiveType,
          content: line,
          timestamp: new Date().toISOString()
        });
        continue;
      }

      // Map JSON structure to IR type
      const unit = this.mapJsonToIR(parsed, streamType);
      if (unit) {
        units.push(unit);
      }
    }

    return units;
  }

  flush(): CliOutputUnit[] {
    const units: CliOutputUnit[] = [];

    if (this.buffer.trim()) {
      // Try to parse remaining buffer
      try {
        const parsed = JSON.parse(this.buffer.trim());
        const unit = this.mapJsonToIR(parsed, 'stdout');
        if (unit) {
          units.push(unit);
        }
      } catch {
        // Not valid JSON, return as plain text
        units.push({
          type: 'stdout',
          content: this.buffer,
          timestamp: new Date().toISOString()
        });
      }
    }

    this.buffer = '';
    return units;
  }

  /**
   * Map parsed JSON object to appropriate IR type
   * Handles various JSON event formats from different CLI tools:
   * - Gemini CLI: stream-json format (init, message, result)
   * - Codex CLI: --json format (thread.started, item.completed, turn.completed)
   * - Claude CLI: stream-json format (system, assistant, result)
   * - OpenCode CLI: --format json (step_start, text, step_finish)
   */
  private mapJsonToIR(json: any, fallbackStreamType: 'stdout' | 'stderr'): CliOutputUnit | null {
    // Handle numeric timestamp (milliseconds) from OpenCode
    const timestamp = typeof json.timestamp === 'number'
      ? new Date(json.timestamp).toISOString()
      : (json.timestamp || new Date().toISOString());

    // ========== Gemini CLI stream-json format ==========
    // {"type":"init","timestamp":"...","session_id":"...","model":"..."}
    // {"type":"message","timestamp":"...","role":"assistant","content":"...","delta":true}
    // {"type":"result","timestamp":"...","status":"success","stats":{...}}
    if (json.type === 'init' && json.session_id) {
      return {
        type: 'metadata',
        content: {
          tool: 'gemini',
          sessionId: json.session_id,
          model: json.model,
          raw: json
        },
        timestamp
      };
    }

    if (json.type === 'message' && json.role) {
      // Gemini assistant/user message
      if (json.role === 'assistant') {
        return {
          type: 'stdout',
          content: json.content || '',
          timestamp
        };
      }
      // Skip user messages in output (they're echo of input)
      return null;
    }

    if (json.type === 'result' && json.stats) {
      return {
        type: 'metadata',
        content: {
          tool: 'gemini',
          status: json.status,
          stats: json.stats,
          raw: json
        },
        timestamp
      };
    }

    // ========== Codex CLI --json format ==========
    // {"type":"thread.started","thread_id":"..."}
    // {"type":"turn.started"}
    // {"type":"item.started","item":{"id":"...","type":"command_execution","status":"in_progress"}}
    // {"type":"item.completed","item":{"id":"...","type":"reasoning","text":"..."}}
    // {"type":"item.completed","item":{"id":"...","type":"agent_message","text":"..."}}
    // {"type":"item.completed","item":{"id":"...","type":"command_execution","aggregated_output":"..."}}
    // {"type":"turn.completed","usage":{"input_tokens":...,"output_tokens":...}}
    if (json.type === 'thread.started' && json.thread_id) {
      return {
        type: 'metadata',
        content: {
          tool: 'codex',
          threadId: json.thread_id,
          raw: json
        },
        timestamp
      };
    }

    if (json.type === 'turn.started') {
      return {
        type: 'progress',
        content: {
          message: 'Turn started',
          tool: 'codex'
        },
        timestamp
      };
    }

    // Handle item.started - command execution in progress
    if (json.type === 'item.started' && json.item) {
      const item = json.item;
      if (item.type === 'command_execution') {
        return {
          type: 'progress',
          content: {
            message: `Executing: ${item.command || 'command'}`,
            tool: 'codex',
            status: item.status || 'in_progress'
          },
          timestamp
        };
      }
      // Other item.started types
      return {
        type: 'progress',
        content: {
          message: `Starting: ${item.type}`,
          tool: 'codex'
        },
        timestamp
      };
    }

    if (json.type === 'item.completed' && json.item) {
      const item = json.item;

      if (item.type === 'reasoning') {
        return {
          type: 'thought',
          content: item.text || item.summary || '',
          timestamp
        };
      }

      if (item.type === 'agent_message') {
        return {
          type: 'stdout',
          content: item.text || '',
          timestamp
        };
      }

      // Handle command_execution output
      if (item.type === 'command_execution') {
        // Show command output as code block
        const output = item.aggregated_output || '';
        return {
          type: 'code',
          content: {
            command: item.command,
            output: output,
            exitCode: item.exit_code,
            status: item.status
          },
          timestamp
        };
      }

      // Other item types (function_call, etc.)
      return {
        type: 'system',
        content: {
          itemType: item.type,
          itemId: item.id,
          raw: item
        },
        timestamp
      };
    }

    if (json.type === 'turn.completed' && json.usage) {
      return {
        type: 'metadata',
        content: {
          tool: 'codex',
          usage: json.usage,
          raw: json
        },
        timestamp
      };
    }

    // ========== Claude CLI stream-json format ==========
    // {"type":"system","subtype":"init","cwd":"...","session_id":"...","tools":[...],"model":"..."}
    // {"type":"assistant","message":{...},"session_id":"..."}
    // {"type":"result","subtype":"success","duration_ms":...,"result":"...","total_cost_usd":...}
    if (json.type === 'system' && json.subtype === 'init') {
      return {
        type: 'metadata',
        content: {
          tool: 'claude',
          sessionId: json.session_id,
          model: json.model,
          cwd: json.cwd,
          tools: json.tools,
          mcpServers: json.mcp_servers,
          raw: json
        },
        timestamp
      };
    }

    if (json.type === 'assistant' && json.message) {
      // Extract text content from Claude message
      const message = json.message;
      const textContent = message.content
        ?.filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('\n') || '';

      return {
        type: 'stdout',
        content: textContent,
        timestamp
      };
    }

    if (json.type === 'result' && json.subtype) {
      return {
        type: 'metadata',
        content: {
          tool: 'claude',
          status: json.subtype,
          result: json.result,
          durationMs: json.duration_ms,
          totalCostUsd: json.total_cost_usd,
          usage: json.usage,
          modelUsage: json.modelUsage,
          raw: json
        },
        timestamp
      };
    }

    // ========== OpenCode CLI --format json ==========
    // {"type":"step_start","timestamp":...,"sessionID":"...","part":{...}}
    // {"type":"text","timestamp":...,"sessionID":"...","part":{"type":"text","text":"..."}}
    // {"type":"step_finish","timestamp":...,"part":{"tokens":{...}}}
    if (json.type === 'step_start' && json.sessionID) {
      return {
        type: 'progress',
        content: {
          message: 'Step started',
          tool: 'opencode',
          sessionId: json.sessionID,
          raw: json.part
        },
        timestamp
      };
    }

    if (json.type === 'text' && json.part) {
      return {
        type: 'stdout',
        content: json.part.text || '',
        timestamp
      };
    }

    if (json.type === 'step_finish' && json.part) {
      return {
        type: 'metadata',
        content: {
          tool: 'opencode',
          reason: json.part.reason,
          tokens: json.part.tokens,
          cost: json.part.cost,
          raw: json.part
        },
        timestamp
      };
    }

    // ========== Legacy/Generic formats ==========
    // Check for generic type field patterns
    if (json.type) {
      switch (json.type) {
        case 'thought':
        case 'thinking':
        case 'reasoning':
          return {
            type: 'thought',
            content: json.content || json.text || json.message,
            timestamp
          };

        case 'code':
        case 'code_block':
          return {
            type: 'code',
            content: json.content || json.code,
            timestamp
          };

        case 'diff':
        case 'file_diff':
        case 'file_change':
          return {
            type: 'file_diff',
            content: {
              path: json.path || json.file,
              diff: json.diff || json.content,
              action: json.action || 'modify'
            },
            timestamp
          };

        case 'progress':
        case 'status':
          return {
            type: 'progress',
            content: {
              message: json.message || json.content,
              progress: json.progress,
              total: json.total
            },
            timestamp
          };

        case 'metadata':
        case 'session_meta':
          return {
            type: 'metadata',
            content: json.payload || json.data || json,
            timestamp
          };

        case 'system':
        case 'event':
          return {
            type: 'system',
            content: json.message || json.content || json,
            timestamp
          };
      }
    }

    // Check for legacy Codex JSONL format (response_item)
    if (json.type === 'response_item' && json.payload) {
      const payloadType = json.payload.type;

      if (payloadType === 'message') {
        // User or assistant message
        const content = json.payload.content
          ?.map((c: any) => c.text || '')
          .filter((t: string) => t)
          .join('\n') || '';

        return {
          type: 'stdout',
          content,
          timestamp
        };
      }

      if (payloadType === 'reasoning') {
        return {
          type: 'thought',
          content: json.payload.summary || json.payload.content,
          timestamp
        };
      }

      if (payloadType === 'function_call' || payloadType === 'function_call_output') {
        return {
          type: 'system',
          content: json.payload,
          timestamp
        };
      }
    }

    // Check for Gemini/Qwen message format (role-based)
    if (json.role === 'user' || json.role === 'assistant') {
      return {
        type: 'stdout',
        content: json.content || json.text || '',
        timestamp
      };
    }

    // Check for thoughts array
    if (json.thoughts && Array.isArray(json.thoughts)) {
      return {
        type: 'thought',
        content: json.thoughts.map((t: any) =>
          typeof t === 'string' ? t : `${t.subject}: ${t.description}`
        ).join('\n'),
        timestamp
      };
    }

    // Default: treat as stdout/stderr based on fallback
    if (json.content || json.message || json.text) {
      return {
        type: fallbackStreamType,
        content: json.content || json.message || json.text,
        timestamp
      };
    }

    // Unrecognized structure, return as metadata
    return {
      type: 'metadata',
      content: json,
      timestamp
    };
  }
}

// ========== Factory Function ==========

/**
 * Create an output parser instance based on format
 * @param format - Output format type
 * @returns Parser instance
 */
export function createOutputParser(format: 'text' | 'json-lines'): IOutputParser {
  switch (format) {
    case 'json-lines':
      return new JsonLinesParser();
    case 'text':
    default:
      return new PlainTextParser();
  }
}

// ========== Utility Functions ==========

/**
 * Flatten output units into plain text string
 * Useful for Resume scenario where we need concatenated context
 *
 * @param units - Array of output units to flatten
 * @param options - Filtering and formatting options
 * @returns Concatenated text content
 */
export function flattenOutputUnits(
  units: CliOutputUnit[],
  options?: {
    includeTypes?: CliOutputUnitType[];
    excludeTypes?: CliOutputUnitType[];
    includeTimestamps?: boolean;
    separator?: string;
  }
): string {
  const {
    includeTypes,
    excludeTypes,
    includeTimestamps = false,
    separator = '\n'
  } = options || {};

  // Filter units by type
  let filtered = units;
  if (includeTypes && includeTypes.length > 0) {
    filtered = filtered.filter(u => includeTypes.includes(u.type));
  }
  if (excludeTypes && excludeTypes.length > 0) {
    filtered = filtered.filter(u => !excludeTypes.includes(u.type));
  }

  // Convert to text
  const lines = filtered.map(unit => {
    let text = '';

    if (includeTimestamps) {
      text += `[${unit.timestamp}] `;
    }

    // Extract text content based on type
    if (typeof unit.content === 'string') {
      text += unit.content;
    } else if (typeof unit.content === 'object' && unit.content !== null) {
      // Handle structured content with type-specific formatting
      switch (unit.type) {
        case 'file_diff':
          // Format file diff with path and diff content
          text += `File: ${unit.content.path}\n\`\`\`diff\n${unit.content.diff}\n\`\`\``;
          break;

        case 'code':
          // Format code block with language
          const lang = unit.content.language || '';
          const code = unit.content.code || unit.content;
          text += `\`\`\`${lang}\n${typeof code === 'string' ? code : JSON.stringify(code)}\n\`\`\``;
          break;

        case 'thought':
          // Format thought/reasoning content
          text += `[Thought] ${typeof unit.content === 'string' ? unit.content : JSON.stringify(unit.content)}`;
          break;

        case 'progress':
          // Format progress updates
          if (unit.content.message) {
            text += unit.content.message;
            if (unit.content.progress !== undefined && unit.content.total !== undefined) {
              text += ` (${unit.content.progress}/${unit.content.total})`;
            }
          } else {
            text += JSON.stringify(unit.content);
          }
          break;

        case 'metadata':
        case 'system':
          // Metadata and system events are typically excluded from prompt context
          // Include minimal representation if they passed filtering
          text += JSON.stringify(unit.content);
          break;

        default:
          // Fallback for unknown structured types
          text += JSON.stringify(unit.content);
      }
    } else {
      text += String(unit.content);
    }

    return text;
  });

  return lines.join(separator);
}

/**
 * Extract specific content type from units
 * Convenience helper for common extraction patterns
 */
export function extractContent(
  units: CliOutputUnit[],
  type: CliOutputUnitType
): string[] {
  return units
    .filter(u => u.type === type)
    .map(u => typeof u.content === 'string' ? u.content : JSON.stringify(u.content));
}

/**
 * Get statistics about output units
 * Useful for debugging and analytics
 */
export function getOutputStats(units: CliOutputUnit[]): {
  total: number;
  byType: Record<CliOutputUnitType, number>;
  firstTimestamp?: string;
  lastTimestamp?: string;
} {
  const byType: Record<string, number> = {};
  let firstTimestamp: string | undefined;
  let lastTimestamp: string | undefined;

  for (const unit of units) {
    byType[unit.type] = (byType[unit.type] || 0) + 1;

    if (!firstTimestamp || unit.timestamp < firstTimestamp) {
      firstTimestamp = unit.timestamp;
    }
    if (!lastTimestamp || unit.timestamp > lastTimestamp) {
      lastTimestamp = unit.timestamp;
    }
  }

  return {
    total: units.length,
    byType: byType as Record<CliOutputUnitType, number>,
    firstTimestamp,
    lastTimestamp
  };
}
