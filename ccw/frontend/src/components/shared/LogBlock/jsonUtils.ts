// ========================================
// LogBlock JSON Utilities
// ========================================
// JSON content detection and formatting utilities

/**
 * JSON content type detection result
 */
export interface JsonDetectionResult {
  isJson: boolean;
  parsed?: unknown;
  error?: string;
  format: 'object' | 'array' | 'primitive' | 'invalid';
}

/**
 * Display mode for JSON content
 */
export type JsonDisplayMode = 'text' | 'card' | 'inline';

/**
 * Detect if content is valid JSON
 *
 * @param content - Content string to check
 * @returns Detection result with parsed data if valid
 */
export function detectJson(content: string): JsonDetectionResult {
  const trimmed = content.trim();

  // Quick check for JSON patterns
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return { isJson: false, format: 'invalid' };
  }

  try {
    const parsed = JSON.parse(trimmed);

    // Determine format type
    let format: JsonDetectionResult['format'] = 'primitive';
    if (Array.isArray(parsed)) {
      format = 'array';
    } else if (parsed !== null && typeof parsed === 'object') {
      format = 'object';
    }

    return { isJson: true, parsed, format };
  } catch (error) {
    return {
      isJson: false,
      format: 'invalid',
      error: error instanceof Error ? error.message : 'Unknown parse error'
    };
  }
}

/**
 * Extract JSON from mixed content
 * Handles cases where JSON is embedded in text output
 *
 * @param content - Content that may contain JSON
 * @returns Extracted JSON string or null if not found
 */
export function extractJson(content: string): string | null {
  const trimmed = content.trim();

  // Direct JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    // Find the matching bracket
    let depth = 0;
    let inString = false;
    let escape = false;
    let end = -1;

    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (char === '\\') {
        escape = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{' || char === '[') {
          depth++;
        } else if (char === '}' || char === ']') {
          depth--;
          if (depth === 0) {
            end = i + 1;
            break;
          }
        }
      }
    }

    if (end > 0) {
      return trimmed.substring(0, end);
    }
  }

  // Try to find JSON in code blocks
  const codeBlockMatch = content.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  return null;
}

/**
 * Detect if content should be displayed as JSON
 * Combines extraction and validation
 *
 * @param content - Content to check
 * @returns Detection result
 */
export function detectJsonContent(content: string): JsonDetectionResult & { extracted: string | null } {
  const extracted = extractJson(content);

  if (!extracted) {
    return { isJson: false, format: 'invalid', extracted: null };
  }

  const result = detectJson(extracted);
  return { ...result, extracted };
}

/**
 * Format JSON for display
 *
 * @param data - Parsed JSON data
 * @param indent - Indentation spaces (default: 2)
 * @returns Formatted JSON string
 */
export function formatJson(data: unknown, indent: number = 2): string {
  return JSON.stringify(data, null, indent);
}

/**
 * Get a summary string for JSON data
 *
 * @param data - Parsed JSON data
 * @returns Summary description
 */
export function getJsonSummary(data: unknown): string {
  if (data === null) return 'null';
  if (typeof data === 'boolean') return data ? 'true' : 'false';
  if (typeof data === 'number') return String(data);
  if (typeof data === 'string') return `"${data.length > 30 ? data.substring(0, 30) + '...' : data}"`;

  if (Array.isArray(data)) {
    const length = data.length;
    return `Array[${length}]${length > 0 ? ` (${getJsonSummary(data[0])}, ...)` : ''}`;
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data);
    return `Object{${keys.length}}${keys.length > 0 ? ` (${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', ...' : ''})` : ''}`;
  }

  return String(data);
}

/**
 * Get color class for JSON value type
 *
 * @param value - JSON value
 * @returns Tailwind color class
 */
export function getJsonValueTypeColor(value: unknown): string {
  if (value === null) return 'text-muted-foreground';
  if (typeof value === 'boolean') return 'text-purple-400';
  if (typeof value === 'number') return 'text-orange-400';
  if (typeof value === 'string') return 'text-green-400';
  if (Array.isArray(value)) return 'text-blue-400';
  if (typeof value === 'object') return 'text-yellow-400';
  return 'text-foreground';
}
