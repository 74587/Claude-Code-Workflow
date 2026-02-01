// ========================================
// JSON Detection Utility
// ========================================
// Smart JSON detection for CLI output lines

/**
 * Result of JSON detection
 */
export interface JsonDetectionResult {
  isJson: boolean;
  parsed?: Record<string, unknown>;
  error?: string;
}

/**
 * Try to recover truncated JSON by completing brackets
 * This handles cases where JSON is split during streaming
 */
function tryRecoverTruncatedJson(content: string): Record<string, unknown> | null {
  const trimmed = content.trim();

  // Must start with { to be recoverable JSON
  if (!trimmed.startsWith('{')) {
    return null;
  }

  // Count opening vs closing braces
  let openBraces = 0;
  let closeBraces = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') openBraces++;
      if (char === '}') closeBraces++;
    }
  }

  // If we're missing closing braces, try to complete them
  if (openBraces > closeBraces) {
    const missingBraces = openBraces - closeBraces;
    const recovered = trimmed + '}'.repeat(missingBraces);

    // Also close any open quote
    let finalRecovered = recovered;
    if (inString) {
      finalRecovered = recovered + '"';
      // Add closing braces after the quote
      finalRecovered = finalRecovered + '}'.repeat(missingBraces);
    }

    try {
      return JSON.parse(finalRecovered) as Record<string, unknown>;
    } catch {
      // Recovery failed, try one more approach
    }
  }

  // Try parsing as-is first
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    // If still failing, try to close any hanging structures
    // Remove trailing incomplete key/value and try again
    const lastCommaIndex = trimmed.lastIndexOf(',');
    if (lastCommaIndex > 0) {
      const truncated = trimmed.substring(0, lastCommaIndex) + '}';
      try {
        return JSON.parse(truncated) as Record<string, unknown>;
      } catch {
        // Still failed
      }
    }
  }

  return null;
}

/**
 * Detect token usage stats pattern (common in CLI output)
 * Pattern: {"type":"result","status":"success","stats":{"total_tokens":...,"input_tokens":...,...}
 */
function detectTokenStats(content: string): Record<string, unknown> | null {
  // Check for common token stat patterns
  const patterns = [
    /"type"\s*:\s*"result"/,
    /"status"\s*:\s*"success"/,
    /"stats"\s*:\s*\{/,
    /"total_tokens"\s*:\s*\d+/,
  ];

  const matchCount = patterns.filter(p => p.test(content)).length;

  // If at least 3 patterns match, this is likely token stats
  if (matchCount >= 3) {
    const recovered = tryRecoverTruncatedJson(content);
    if (recovered) {
      return recovered;
    }
  }

  return null;
}

/**
 * Detect if a line contains JSON data
 * Supports multiple formats:
 * - Direct JSON: {...} or [...]
 * - Tool Call: [Tool] toolName({...})
 * - Tool Result: [Tool Result] status: {...}
 * - Embedded JSON: trailing JSON object
 * - Code block JSON: ```json ... ```
 * - Truncated JSON: handles streaming incomplete JSON
 */
export function detectJsonInLine(content: string): JsonDetectionResult {
  const trimmed = content.trim();

  // 1. Direct JSON object or array
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    // First try normal parse
    try {
      const parsed = JSON.parse(trimmed);
      return { isJson: true, parsed: parsed as Record<string, unknown> };
    } catch {
      // Normal parse failed, try recovery for truncated JSON
      const recovered = tryRecoverTruncatedJson(trimmed);
      if (recovered) {
        return { isJson: true, parsed: recovered };
      }

      // Check for token stats pattern specifically
      const tokenStats = detectTokenStats(trimmed);
      if (tokenStats) {
        return { isJson: true, parsed: tokenStats };
      }
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
      output = outputStr.trim().startsWith('{') ? JSON.parse(outputStr) : outputStr;
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
