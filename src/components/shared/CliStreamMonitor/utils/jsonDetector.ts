/**
 * JSON Detection Result
 */
export interface JsonDetectionResult {
  isJson: boolean;
  parsed?: Record<string, unknown>;
  error?: string;
}

/**
 * Detect if a line contains JSON data
 * Supports multiple formats:
 * - Direct JSON: {...} or [...]
 * - Tool Call: [Tool] toolName({...})
 * - Tool Result: [Tool Result] status: {...}
 * - Embedded JSON: trailing JSON object
 * - Code block JSON: ```json ... ```
 *
 * @param content - The content line to detect JSON in
 * @returns Detection result with parsed data if valid JSON found
 */
export function detectJsonInLine(content: string): JsonDetectionResult {
  const trimmed = content.trim();

  // 1. Direct JSON object or array
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return { isJson: true, parsed: parsed as Record<string, unknown> };
    } catch {
      // Continue to other patterns
    }
  }

  // 2. Tool Call format: [Tool] toolName({...})
  const toolCallMatch = trimmed.match(/^\[Tool\]\s+(\w+)\((.*)\)$/);
  if (toolCallMatch) {
    const [, toolName, paramsStr] = toolCallMatch;
    let parameters: unknown;

    try {
      parameters = paramsStr ? JSON.parse(paramsStr) : {};
    } catch {
      parameters = paramsStr || null;
    }

    return {
      isJson: true,
      parsed: {
        action: 'invoke',
        toolName,
        parameters,
      } as Record<string, unknown>,
    };
  }

  // 3. Tool Result format: [Tool Result] status: output
  const toolResultMatch = trimmed.match(/^\[Tool Result\]\s+(.+?)\s*:\s*(.+)$/);
  if (toolResultMatch) {
    const [, status, outputStr] = toolResultMatch;
    let output: unknown;

    try {
      output = outputStr.startsWith('{') ? JSON.parse(outputStr) : outputStr;
    } catch {
      output = outputStr;
    }

    return {
      isJson: true,
      parsed: {
        action: 'result',
        status,
        output,
      } as Record<string, unknown>,
    };
  }

  // 4. Embedded JSON at end of line
  const embeddedJsonMatch = trimmed.match(/\{.*\}$/);
  if (embeddedJsonMatch) {
    try {
      const parsed = JSON.parse(embeddedJsonMatch[0]);
      return { isJson: true, parsed: parsed as Record<string, unknown> };
    } catch {
      // Not valid JSON
    }
  }

  // 5. Code block JSON
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1]);
      return { isJson: true, parsed: parsed as Record<string, unknown> };
    } catch {
      return { isJson: false, error: 'Invalid JSON in code block' };
    }
  }

  return { isJson: false };
}
