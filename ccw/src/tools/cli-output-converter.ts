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
        units.push({
          type: streamType,
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
   * Handles various JSON event formats from different CLI tools
   */
  private mapJsonToIR(json: any, fallbackStreamType: 'stdout' | 'stderr'): CliOutputUnit | null {
    const timestamp = json.timestamp || new Date().toISOString();

    // Detect type from JSON structure
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

    // Check for Codex JSONL format
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

    // Check for Gemini/Qwen message format
    if (json.role === 'user' || json.role === 'assistant') {
      return {
        type: 'stdout',
        content: json.content || json.text || '',
        timestamp
      };
    }

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
