/**
 * VSCode LSP Tool - Provides LSP-like code intelligence via VSCode Bridge Extension
 *
 * Features:
 * - get_definition: Find symbol definition
 * - get_references: Find all symbol references
 * - get_hover: Get hover information for symbols
 * - get_document_symbols: List all symbols in file
 *
 * Requirements:
 * - ccw-vscode-bridge extension must be running in VSCode
 * - File must be open/accessible in VSCode workspace
 */

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';

// VSCode Bridge configuration
const BRIDGE_URL = 'http://127.0.0.1:3457';
const REQUEST_TIMEOUT = 10000; // 10 seconds

// Define Zod schema for validation
const ParamsSchema = z.object({
  action: z.enum(['get_definition', 'get_references', 'get_hover', 'get_document_symbols']),
  file_path: z.string().describe('Absolute path to the file'),
  line: z.number().optional().describe('Line number (1-based)'),
  character: z.number().optional().describe('Character position (1-based)'),
});

type Params = z.infer<typeof ParamsSchema>;

/**
 * Result types from VSCode LSP
 */
interface Position {
  line: number;
  character: number;
}

interface Range {
  start: Position;
  end: Position;
}

interface Location {
  uri: string;
  range: Range;
}

interface HoverContent {
  contents: string[];
  range?: Range;
}

interface DocumentSymbol {
  name: string;
  kind: string;
  range: Range;
  selectionRange: Range;
  detail?: string;
  parent?: string;
}

type LSPResult = {
  success: boolean;
  result?: Location | Location[] | HoverContent[] | DocumentSymbol[];
  error?: string;
  action: string;
};

/**
 * Execute HTTP request to VSCode Bridge
 */
async function callVSCodeBridge(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<LSPResult> {
  const url = `${BRIDGE_URL}${endpoint}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.json();
      return {
        success: false,
        error: errorBody.error || `HTTP ${response.status}: ${response.statusText}`,
        action: endpoint,
      };
    }

    const data = await response.json();
    return {
      success: data.success !== false,
      result: data.result,
      action: endpoint,
    };
  } catch (err) {
    const error = err as Error;

    if (error.name === 'AbortError') {
      return {
        success: false,
        error: `Request timed out after ${REQUEST_TIMEOUT}ms`,
        action: endpoint,
      };
    }

    if ((error as any).code === 'ECONNREFUSED') {
      return {
        success: false,
        error: `Could not connect to VSCode Bridge at ${BRIDGE_URL}. Is the ccw-vscode-bridge extension running in VSCode?`,
        action: endpoint,
      };
    }

    return {
      success: false,
      error: `Request failed: ${error.message}`,
      action: endpoint,
    };
  }
}

/**
 * Handler: get_definition
 */
async function handleGetDefinition(params: Params): Promise<LSPResult> {
  if (params.line === undefined || params.character === undefined) {
    return {
      success: false,
      error: 'line and character are required for get_definition',
      action: 'get_definition',
    };
  }

  return callVSCodeBridge('/get_definition', {
    file_path: params.file_path,
    line: params.line,
    character: params.character,
  });
}

/**
 * Handler: get_references
 */
async function handleGetReferences(params: Params): Promise<LSPResult> {
  if (params.line === undefined || params.character === undefined) {
    return {
      success: false,
      error: 'line and character are required for get_references',
      action: 'get_references',
    };
  }

  return callVSCodeBridge('/get_references', {
    file_path: params.file_path,
    line: params.line,
    character: params.character,
  });
}

/**
 * Handler: get_hover
 */
async function handleGetHover(params: Params): Promise<LSPResult> {
  if (params.line === undefined || params.character === undefined) {
    return {
      success: false,
      error: 'line and character are required for get_hover',
      action: 'get_hover',
    };
  }

  return callVSCodeBridge('/get_hover', {
    file_path: params.file_path,
    line: params.line,
    character: params.character,
  });
}

/**
 * Handler: get_document_symbols
 */
async function handleGetDocumentSymbols(params: Params): Promise<LSPResult> {
  return callVSCodeBridge('/get_document_symbols', {
    file_path: params.file_path,
  });
}

/**
 * Main handler function
 */
export async function handler(params: Record<string, unknown>): Promise<ToolResult<LSPResult>> {
  try {
    // Validate parameters
    const validatedParams = ParamsSchema.parse(params);

    // Route to appropriate handler based on action
    let result: LSPResult;
    switch (validatedParams.action) {
      case 'get_definition':
        result = await handleGetDefinition(validatedParams);
        break;
      case 'get_references':
        result = await handleGetReferences(validatedParams);
        break;
      case 'get_hover':
        result = await handleGetHover(validatedParams);
        break;
      case 'get_document_symbols':
        result = await handleGetDocumentSymbols(validatedParams);
        break;
      default:
        return {
          success: false,
          error: `Unknown action: ${(validatedParams as any).action}`,
          result: null as any,
        };
    }

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Unknown error',
        result: null as any,
      };
    }

    return {
      success: true,
      result,
    };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return {
        success: false,
        error: `Parameter validation failed: ${err.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        result: null as any,
      };
    }

    return {
      success: false,
      error: `Execution failed: ${(err as Error).message}`,
      result: null as any,
    };
  }
}

/**
 * Tool schema for MCP
 */
export const schema: ToolSchema = {
  name: 'vscode_lsp',
  description: `Access live VSCode LSP features via ccw-vscode-bridge extension.

**Actions:**
- get_definition: Find the definition of a symbol at a given position
- get_references: Find all references to a symbol at a given position
- get_hover: Get hover information for a symbol at a given position
- get_document_symbols: List all symbols in a given file

**Usage Examples:**

Find definition:
  vscode_lsp(action="get_definition", file_path="/path/to/file.ts", line=10, character=5)

Find references:
  vscode_lsp(action="get_references", file_path="/path/to/file.py", line=42, character=15)

Get hover info:
  vscode_lsp(action="get_hover", file_path="/path/to/file.go", line=100, character=20)

List document symbols:
  vscode_lsp(action="get_document_symbols", file_path="/path/to/file.rs")

**Requirements:**
- ccw-vscode-bridge extension must be installed and active in VSCode
- File must be part of the VSCode workspace
- VSCode Bridge HTTP server running on http://127.0.0.1:3457`,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['get_definition', 'get_references', 'get_hover', 'get_document_symbols'],
        description: 'LSP action to perform',
      },
      file_path: {
        type: 'string',
        description: 'Absolute path to the file (required)',
      },
      line: {
        type: 'number',
        description: 'Line number (1-based, required for definition/references/hover)',
      },
      character: {
        type: 'number',
        description: 'Character position (1-based, required for definition/references/hover)',
      },
    },
    required: ['action', 'file_path'],
  },
};
