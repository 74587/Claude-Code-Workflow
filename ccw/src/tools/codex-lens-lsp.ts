/**
 * CodexLens LSP Tool - Provides LSP-like code intelligence via CodexLens Python API
 *
 * Features:
 * - symbol_search: Search symbols across workspace
 * - find_definition: Go to symbol definition
 * - find_references: Find all symbol references
 * - get_hover: Get hover information for symbols
 */

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';
import { spawn } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';
import { getProjectRoot } from '../utils/path-validator.js';

// CodexLens venv configuration
const CODEXLENS_VENV =
  process.platform === 'win32'
    ? join(homedir(), '.codexlens', 'venv', 'Scripts', 'python.exe')
    : join(homedir(), '.codexlens', 'venv', 'bin', 'python');

// Define Zod schema for validation
const ParamsSchema = z.object({
  action: z.enum(['symbol_search', 'find_definition', 'find_references', 'get_hover']),
  project_root: z.string().optional().describe('Project root directory (auto-detected if not provided)'),
  symbol_name: z.string().describe('Symbol name to search/query'),
  symbol_kind: z.string().optional().describe('Symbol kind filter (class, function, method, etc.)'),
  file_context: z.string().optional().describe('Current file path for proximity ranking'),
  limit: z.number().default(50).describe('Maximum number of results to return'),
  kind_filter: z.array(z.string()).optional().describe('List of symbol kinds to filter (for symbol_search)'),
  file_pattern: z.string().optional().describe('Glob pattern to filter files (for symbol_search)'),
});

type Params = z.infer<typeof ParamsSchema>;

/**
 * Result types
 */
interface SymbolInfo {
  name: string;
  kind: string;
  file_path: string;
  range: {
    start_line: number;
    end_line: number;
  };
  score?: number;
}

interface DefinitionResult {
  name: string;
  kind: string;
  file_path: string;
  range: {
    start_line: number;
    end_line: number;
  };
}

interface ReferenceResult {
  file_path: string;
  line: number;
  column: number;
}

interface HoverInfo {
  name: string;
  kind: string;
  signature: string;
  file_path: string;
  start_line: number;
}

type LSPResult = {
  success: boolean;
  results?: SymbolInfo[] | DefinitionResult[] | ReferenceResult[] | HoverInfo;
  error?: string;
  action: string;
  metadata?: Record<string, unknown>;
};

/**
 * Execute CodexLens Python API call
 */
async function executeCodexLensAPI(
  apiFunction: string,
  args: Record<string, unknown>,
  timeout: number = 30000
): Promise<LSPResult> {
  return new Promise((resolve) => {
    // Build Python script to call API function
    const pythonScript = `
import json
import sys
from dataclasses import is_dataclass, asdict
from codexlens.api import ${apiFunction}

def to_serializable(obj):
    """Recursively convert dataclasses to dicts for JSON serialization."""
    if obj is None:
        return None
    if is_dataclass(obj) and not isinstance(obj, type):
        return asdict(obj)
    if isinstance(obj, list):
        return [to_serializable(item) for item in obj]
    if isinstance(obj, dict):
        return {key: to_serializable(value) for key, value in obj.items()}
    if isinstance(obj, tuple):
        return tuple(to_serializable(item) for item in obj)
    return obj

try:
    args = ${JSON.stringify(args)}
    result = ${apiFunction}(**args)

    # Convert result to JSON-serializable format
    output = to_serializable(result)

    print(json.dumps({"success": True, "result": output}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}), file=sys.stderr)
    sys.exit(1)
`;

    const child = spawn(CODEXLENS_VENV, ['-c', pythonScript], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        try {
          const errorData = JSON.parse(stderr);
          resolve({
            success: false,
            error: errorData.error || 'Unknown error',
            action: apiFunction,
          });
        } catch {
          resolve({
            success: false,
            error: stderr || `Process exited with code ${code}`,
            action: apiFunction,
          });
        }
        return;
      }

      try {
        const data = JSON.parse(stdout);
        resolve({
          success: data.success,
          results: data.result,
          action: apiFunction,
        });
      } catch (err) {
        resolve({
          success: false,
          error: `Failed to parse output: ${(err as Error).message}`,
          action: apiFunction,
        });
      }
    });

    child.on('error', (err) => {
      resolve({
        success: false,
        error: `Failed to execute: ${err.message}`,
        action: apiFunction,
      });
    });
  });
}

/**
 * Handler: symbol_search
 */
async function handleSymbolSearch(params: Params): Promise<LSPResult> {
  const projectRoot = params.project_root || getProjectRoot();

  const args: Record<string, unknown> = {
    project_root: projectRoot,
    query: params.symbol_name,
    limit: params.limit,
  };

  if (params.kind_filter) {
    args.kind_filter = params.kind_filter;
  }

  if (params.file_pattern) {
    args.file_pattern = params.file_pattern;
  }

  return executeCodexLensAPI('workspace_symbols', args);
}

/**
 * Handler: find_definition
 */
async function handleFindDefinition(params: Params): Promise<LSPResult> {
  const projectRoot = params.project_root || getProjectRoot();

  const args: Record<string, unknown> = {
    project_root: projectRoot,
    symbol_name: params.symbol_name,
    limit: params.limit,
  };

  if (params.symbol_kind) {
    args.symbol_kind = params.symbol_kind;
  }

  if (params.file_context) {
    args.file_context = params.file_context;
  }

  return executeCodexLensAPI('find_definition', args);
}

/**
 * Handler: find_references
 */
async function handleFindReferences(params: Params): Promise<LSPResult> {
  const projectRoot = params.project_root || getProjectRoot();

  const args: Record<string, unknown> = {
    project_root: projectRoot,
    symbol_name: params.symbol_name,
    limit: params.limit,
  };

  if (params.symbol_kind) {
    args.symbol_kind = params.symbol_kind;
  }

  return executeCodexLensAPI('find_references', args);
}

/**
 * Handler: get_hover
 */
async function handleGetHover(params: Params): Promise<LSPResult> {
  const projectRoot = params.project_root || getProjectRoot();

  const args: Record<string, unknown> = {
    project_root: projectRoot,
    symbol_name: params.symbol_name,
  };

  if (params.file_context) {
    args.file_path = params.file_context;
  }

  return executeCodexLensAPI('get_hover', args);
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
      case 'symbol_search':
        result = await handleSymbolSearch(validatedParams);
        break;
      case 'find_definition':
        result = await handleFindDefinition(validatedParams);
        break;
      case 'find_references':
        result = await handleFindReferences(validatedParams);
        break;
      case 'get_hover':
        result = await handleGetHover(validatedParams);
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
  name: 'codex_lens_lsp',
  description: `LSP-like code intelligence tool powered by CodexLens indexing.

**Actions:**
- symbol_search: Search for symbols across the workspace
- find_definition: Find the definition of a symbol
- find_references: Find all references to a symbol
- get_hover: Get hover information for a symbol

**Usage Examples:**

Search symbols:
  codex_lens_lsp(action="symbol_search", symbol_name="MyClass")
  codex_lens_lsp(action="symbol_search", symbol_name="auth", kind_filter=["function", "method"])
  codex_lens_lsp(action="symbol_search", symbol_name="User", file_pattern="*.py")

Find definition:
  codex_lens_lsp(action="find_definition", symbol_name="authenticate")
  codex_lens_lsp(action="find_definition", symbol_name="User", symbol_kind="class")

Find references:
  codex_lens_lsp(action="find_references", symbol_name="login")

Get hover info:
  codex_lens_lsp(action="get_hover", symbol_name="processPayment")

**Requirements:**
- CodexLens must be installed and indexed: run smart_search(action="init") first
- Python environment with codex-lens package available`,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['symbol_search', 'find_definition', 'find_references', 'get_hover'],
        description: 'LSP action to perform',
      },
      symbol_name: {
        type: 'string',
        description: 'Symbol name to search/query (required)',
      },
      project_root: {
        type: 'string',
        description: 'Project root directory (auto-detected if not provided)',
      },
      symbol_kind: {
        type: 'string',
        description: 'Symbol kind filter: class, function, method, variable, etc. (optional)',
      },
      file_context: {
        type: 'string',
        description: 'Current file path for proximity ranking (optional)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 50)',
        default: 50,
      },
      kind_filter: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of symbol kinds to include (for symbol_search)',
      },
      file_pattern: {
        type: 'string',
        description: 'Glob pattern to filter files (for symbol_search)',
      },
    },
    required: ['action', 'symbol_name'],
  },
};
