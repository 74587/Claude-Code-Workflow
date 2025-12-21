/**
 * CodexLens Tool - Bridge between CCW and CodexLens Python package
 * Provides code indexing and semantic search via spawned Python process
 *
 * Features:
 * - Automatic venv bootstrap at ~/.codexlens/venv
 * - JSON protocol communication
 * - Symbol extraction and semantic search
 * - FTS5 full-text search
 */

import { z } from 'zod';
import type { ToolSchema, ToolResult } from '../types/tool.js';
import { spawn, execSync, exec } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

// Get directory of this module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CodexLens configuration
const CODEXLENS_DATA_DIR = join(homedir(), '.codexlens');
const CODEXLENS_VENV = join(CODEXLENS_DATA_DIR, 'venv');
const VENV_PYTHON =
  process.platform === 'win32'
    ? join(CODEXLENS_VENV, 'Scripts', 'python.exe')
    : join(CODEXLENS_VENV, 'bin', 'python');

// Bootstrap status cache
let bootstrapChecked = false;
let bootstrapReady = false;

// Define Zod schema for validation
const ParamsSchema = z.object({
  action: z.enum([
    'init',
    'search',
    'search_files',
    'status',
    'symbol',
    'check',
    'update',
    'bootstrap',
  ]),
  path: z.string().optional(),
  query: z.string().optional(),
  mode: z.enum(['auto', 'text', 'semantic', 'exact', 'fuzzy', 'hybrid', 'vector', 'pure-vector']).default('auto'),
  format: z.enum(['json', 'text', 'pretty']).default('json'),
  languages: z.array(z.string()).optional(),
  limit: z.number().default(20),
  enrich: z.boolean().default(false),
  // Additional fields for internal functions
  file: z.string().optional(),
  key: z.string().optional(),
  value: z.string().optional(),
  newPath: z.string().optional(),
  all: z.boolean().optional(),
});

type Params = z.infer<typeof ParamsSchema>;

interface ReadyStatus {
  ready: boolean;
  error?: string;
  version?: string;
}

interface SemanticStatus {
  available: boolean;
  backend?: string;
  error?: string;
}

interface BootstrapResult {
  success: boolean;
  error?: string;
  message?: string;
}

interface ExecuteResult {
  success: boolean;
  output?: string;
  error?: string;
  message?: string;
  results?: unknown;
  files?: unknown;
  symbols?: unknown;
  status?: unknown;
  config?: unknown;
  cleanResult?: unknown;
  ready?: boolean;
  version?: string;
}

interface ExecuteOptions {
  timeout?: number;
  cwd?: string;
  onProgress?: (progress: ProgressInfo) => void;
}

interface ProgressInfo {
  stage: string;
  message: string;
  percent: number;
  filesProcessed?: number;
  totalFiles?: number;
}

/**
 * Detect available Python 3 executable
 * @returns Python executable command
 */
function getSystemPython(): string {
  const commands = process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python'];

  for (const cmd of commands) {
    try {
      const version = execSync(`${cmd} --version 2>&1`, { encoding: 'utf8' });
      if (version.includes('Python 3')) {
        return cmd;
      }
    } catch {
      // Try next command
    }
  }
  throw new Error('Python 3 not found. Please install Python 3 and ensure it is in PATH.');
}

/**
 * Check if CodexLens venv exists and has required packages
 * @returns Ready status
 */
async function checkVenvStatus(): Promise<ReadyStatus> {
  // Check venv exists
  if (!existsSync(CODEXLENS_VENV)) {
    return { ready: false, error: 'Venv not found' };
  }

  // Check python executable exists
  if (!existsSync(VENV_PYTHON)) {
    return { ready: false, error: 'Python executable not found in venv' };
  }

  // Check codexlens is importable
  return new Promise((resolve) => {
    const child = spawn(VENV_PYTHON, ['-c', 'import codexlens; print(codexlens.__version__)'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10000,
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
      if (code === 0) {
        resolve({ ready: true, version: stdout.trim() });
      } else {
        resolve({ ready: false, error: `CodexLens not installed: ${stderr}` });
      }
    });

    child.on('error', (err) => {
      resolve({ ready: false, error: `Failed to check venv: ${err.message}` });
    });
  });
}

/**
 * Check if semantic search dependencies are installed
 * @returns Semantic status
 */
async function checkSemanticStatus(): Promise<SemanticStatus> {
  // First check if CodexLens is installed
  const venvStatus = await checkVenvStatus();
  if (!venvStatus.ready) {
    return { available: false, error: 'CodexLens not installed' };
  }

  // Check semantic module availability
  return new Promise((resolve) => {
    const checkCode = `
import sys
try:
    from codexlens.semantic import SEMANTIC_AVAILABLE, SEMANTIC_BACKEND
    if SEMANTIC_AVAILABLE:
        print(f"available:{SEMANTIC_BACKEND}")
    else:
        print("unavailable")
except Exception as e:
    print(f"error:{e}")
`;
    const child = spawn(VENV_PYTHON, ['-c', checkCode], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15000,
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
      const output = stdout.trim();
      if (output.startsWith('available:')) {
        const backend = output.split(':')[1];
        resolve({ available: true, backend });
      } else if (output === 'unavailable') {
        resolve({ available: false, error: 'Semantic dependencies not installed' });
      } else {
        resolve({ available: false, error: output || stderr || 'Unknown error' });
      }
    });

    child.on('error', (err) => {
      resolve({ available: false, error: `Check failed: ${err.message}` });
    });
  });
}

/**
 * Install semantic search dependencies (fastembed, ONNX-based, ~200MB)
 * @returns Bootstrap result
 */
async function installSemantic(): Promise<BootstrapResult> {
  // First ensure CodexLens is installed
  const venvStatus = await checkVenvStatus();
  if (!venvStatus.ready) {
    return { success: false, error: 'CodexLens not installed. Install CodexLens first.' };
  }

  const pipPath =
    process.platform === 'win32'
      ? join(CODEXLENS_VENV, 'Scripts', 'pip.exe')
      : join(CODEXLENS_VENV, 'bin', 'pip');

  return new Promise((resolve) => {
    console.log('[CodexLens] Installing semantic search dependencies (fastembed)...');
    console.log('[CodexLens] Using ONNX-based fastembed backend (~200MB)');

    const child = spawn(pipPath, ['install', 'numpy>=1.24', 'fastembed>=0.2'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 600000, // 10 minutes for potential model download
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      // Log progress
      const line = data.toString().trim();
      if (line.includes('Downloading') || line.includes('Installing') || line.includes('Collecting')) {
        console.log(`[CodexLens] ${line}`);
      }
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log('[CodexLens] Semantic dependencies installed successfully');
        resolve({ success: true });
      } else {
        resolve({ success: false, error: `Installation failed: ${stderr || stdout}` });
      }
    });

    child.on('error', (err) => {
      resolve({ success: false, error: `Failed to run pip: ${err.message}` });
    });
  });
}

/**
 * Bootstrap CodexLens venv with required packages
 * @returns Bootstrap result
 */
async function bootstrapVenv(): Promise<BootstrapResult> {
  // Ensure data directory exists
  if (!existsSync(CODEXLENS_DATA_DIR)) {
    mkdirSync(CODEXLENS_DATA_DIR, { recursive: true });
  }

  // Create venv if not exists
  if (!existsSync(CODEXLENS_VENV)) {
    try {
      console.log('[CodexLens] Creating virtual environment...');
      const pythonCmd = getSystemPython();
      execSync(`${pythonCmd} -m venv "${CODEXLENS_VENV}"`, { stdio: 'inherit' });
    } catch (err) {
      return { success: false, error: `Failed to create venv: ${(err as Error).message}` };
    }
  }

  // Install codexlens with semantic extras
  try {
    console.log('[CodexLens] Installing codexlens package...');
    const pipPath =
      process.platform === 'win32'
        ? join(CODEXLENS_VENV, 'Scripts', 'pip.exe')
        : join(CODEXLENS_VENV, 'bin', 'pip');

    // Try multiple local paths, then fall back to PyPI
    const possiblePaths = [
      join(process.cwd(), 'codex-lens'),
      join(__dirname, '..', '..', '..', 'codex-lens'), // ccw/src/tools -> project root
      join(homedir(), 'codex-lens'),
    ];

    let installed = false;
    for (const localPath of possiblePaths) {
      if (existsSync(join(localPath, 'pyproject.toml'))) {
        console.log(`[CodexLens] Installing from local path: ${localPath}`);
        execSync(`"${pipPath}" install -e "${localPath}"`, { stdio: 'inherit' });
        installed = true;
        break;
      }
    }

    if (!installed) {
      console.log('[CodexLens] Installing from PyPI...');
      execSync(`"${pipPath}" install codexlens`, { stdio: 'inherit' });
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: `Failed to install codexlens: ${(err as Error).message}` };
  }
}

/**
 * Ensure CodexLens is ready to use
 * @returns Ready status
 */
async function ensureReady(): Promise<ReadyStatus> {
  // Use cached result if already checked
  if (bootstrapChecked && bootstrapReady) {
    return { ready: true };
  }

  // Check current status
  const status = await checkVenvStatus();
  if (status.ready) {
    bootstrapChecked = true;
    bootstrapReady = true;
    return { ready: true, version: status.version };
  }

  // Attempt bootstrap
  const bootstrap = await bootstrapVenv();
  if (!bootstrap.success) {
    return { ready: false, error: bootstrap.error };
  }

  // Verify after bootstrap
  const recheck = await checkVenvStatus();
  bootstrapChecked = true;
  bootstrapReady = recheck.ready;

  return recheck;
}

/**
 * Parse progress info from CodexLens output
 * @param line - Output line to parse
 * @returns Progress info or null
 */
function parseProgressLine(line: string): ProgressInfo | null {
  // Parse file processing progress: "Processing file X/Y: path"
  const fileMatch = line.match(/Processing file (\d+)\/(\d+):\s*(.+)/i);
  if (fileMatch) {
    const current = parseInt(fileMatch[1], 10);
    const total = parseInt(fileMatch[2], 10);
    return {
      stage: 'indexing',
      message: `Processing ${fileMatch[3]}`,
      percent: Math.round((current / total) * 80) + 10, // 10-90%
      filesProcessed: current,
      totalFiles: total,
    };
  }

  // Parse stage messages
  if (line.includes('Discovering files')) {
    return { stage: 'discover', message: 'Discovering files...', percent: 5 };
  }
  if (line.includes('Building index')) {
    return { stage: 'build', message: 'Building index...', percent: 10 };
  }
  if (line.includes('Extracting symbols')) {
    return { stage: 'symbols', message: 'Extracting symbols...', percent: 50 };
  }
  if (line.includes('Generating embeddings') || line.includes('Creating embeddings')) {
    return { stage: 'embeddings', message: 'Generating embeddings...', percent: 70 };
  }
  if (line.includes('Finalizing') || line.includes('Complete')) {
    return { stage: 'complete', message: 'Finalizing...', percent: 95 };
  }

  // Parse indexed count: "Indexed X files" - FTS complete, but embeddings may follow
  const indexedMatch = line.match(/Indexed (\d+) files/i);
  if (indexedMatch) {
    return {
      stage: 'fts_complete',  // Not 'complete' - embeddings generation may still be pending
      message: `Indexed ${indexedMatch[1]} files, generating embeddings...`,
      percent: 60,  // FTS done, embeddings starting
      filesProcessed: parseInt(indexedMatch[1], 10),
    };
  }

  // Parse embedding batch progress: "Batch X: N files, M chunks"
  const batchMatch = line.match(/Batch (\d+):\s*(\d+) files,\s*(\d+) chunks/i);
  if (batchMatch) {
    return {
      stage: 'embeddings',
      message: `Embedding batch ${batchMatch[1]}: ${batchMatch[3]} chunks`,
      percent: 70,  // Stay at 70% during embedding batches
    };
  }

  // Parse embedding progress with file count
  const embedProgressMatch = line.match(/Processing (\d+) files/i);
  if (embedProgressMatch && line.toLowerCase().includes('embed')) {
    return {
      stage: 'embeddings',
      message: `Processing ${embedProgressMatch[1]} files for embeddings`,
      percent: 75,
    };
  }

  // Parse finalizing ANN index
  if (line.includes('Finalizing index') || line.includes('Building ANN')) {
    return { stage: 'finalizing', message: 'Finalizing vector index...', percent: 90 };
  }

  return null;
}

/**
 * Execute CodexLens CLI command with real-time progress updates
 * @param args - CLI arguments
 * @param options - Execution options
 * @returns Execution result
 */
async function executeCodexLens(args: string[], options: ExecuteOptions = {}): Promise<ExecuteResult> {
  const { timeout = 300000, cwd = process.cwd(), onProgress } = options; // Default 5 min

  // Ensure ready
  const readyStatus = await ensureReady();
  if (!readyStatus.ready) {
    return { success: false, error: readyStatus.error };
  }

  return new Promise((resolve) => {
    // Build command string - quote paths for shell execution
    const quotedPython = `"${VENV_PYTHON}"`;
    const cmdArgs = args.map(arg => {
      // Quote arguments that contain spaces or special characters
      if (arg.includes(' ') || arg.includes('\\')) {
        return `"${arg}"`;
      }
      return arg;
    });

    // Build full command - on Windows, prepend cd to handle different drives
    let fullCmd: string;
    if (process.platform === 'win32' && cwd) {
      // Use cd /d to change drive and directory, then run command
      fullCmd = `cd /d "${cwd}" && ${quotedPython} -m codexlens ${cmdArgs.join(' ')}`;
    } else {
      fullCmd = `${quotedPython} -m codexlens ${cmdArgs.join(' ')}`;
    }

    // Use spawn with shell for real-time progress updates
    // spawn streams output in real-time, unlike exec which buffers until completion
    const child = spawn(fullCmd, [], {
      cwd: process.platform === 'win32' ? undefined : cwd,
      shell: process.platform === 'win32' ? process.env.ComSpec || true : true,
      timeout,
    });

    let stdout = '';
    let stderr = '';
    let stdoutLineBuffer = '';
    let stderrLineBuffer = '';
    let timeoutHandle: NodeJS.Timeout | null = null;
    let resolved = false;

    // Helper to safely resolve only once
    const safeResolve = (result: ExecuteResult) => {
      if (resolved) return;
      resolved = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      resolve(result);
    };

    // Set up timeout handler
    if (timeout > 0) {
      timeoutHandle = setTimeout(() => {
        if (!resolved) {
          child.kill('SIGTERM');
          // Give it a moment to die gracefully, then force kill
          setTimeout(() => {
            if (!resolved) {
              child.kill('SIGKILL');
            }
          }, 5000);
          safeResolve({ success: false, error: 'Command timed out' });
        }
      }, timeout);
    }

    // Process stdout line by line for real-time progress
    child.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdoutLineBuffer += chunk;
      stdout += chunk;

      // Process complete lines
      const lines = stdoutLineBuffer.split('\n');
      stdoutLineBuffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && onProgress) {
          const progress = parseProgressLine(trimmedLine);
          if (progress) {
            onProgress(progress);
          }
        }
      }
    });

    // Collect stderr
    child.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderrLineBuffer += chunk;
      stderr += chunk;

      // Also check stderr for progress (some tools output progress to stderr)
      const lines = stderrLineBuffer.split('\n');
      stderrLineBuffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && onProgress) {
          const progress = parseProgressLine(trimmedLine);
          if (progress) {
            onProgress(progress);
          }
        }
      }
    });

    // Handle process errors (spawn failure)
    child.on('error', (err) => {
      safeResolve({ success: false, error: `Failed to start process: ${err.message}` });
    });

    // Handle process completion
    child.on('close', (code) => {
      // Process any remaining buffered content
      if (stdoutLineBuffer.trim() && onProgress) {
        const progress = parseProgressLine(stdoutLineBuffer.trim());
        if (progress) {
          onProgress(progress);
        }
      }

      if (code === 0) {
        safeResolve({ success: true, output: stdout.trim() });
      } else {
        safeResolve({ success: false, error: stderr.trim() || `Process exited with code ${code}` });
      }
    });
  });
}

/**
 * Initialize CodexLens index for a directory
 * @param params - Parameters
 * @returns Execution result
 */
async function initIndex(params: Params): Promise<ExecuteResult> {
  const { path = '.', languages } = params;

  const args = ['init', path];
  if (languages && languages.length > 0) {
    args.push('--languages', languages.join(','));
  }

  return executeCodexLens(args, { cwd: path });
}

/**
 * Search code using CodexLens
 * @param params - Search parameters
 * @returns Execution result
 */
async function searchCode(params: Params): Promise<ExecuteResult> {
  const { query, path = '.', limit = 20, mode = 'auto', enrich = false } = params;

  if (!query) {
    return { success: false, error: 'Query is required for search action' };
  }

  // Map MCP mode names to CLI mode names
  const modeMap: Record<string, string> = {
    'text': 'exact',
    'semantic': 'pure-vector',
    'auto': 'auto',
    'exact': 'exact',
    'fuzzy': 'fuzzy',
    'hybrid': 'hybrid',
    'vector': 'vector',
    'pure-vector': 'pure-vector',
  };

  const cliMode = modeMap[mode] || 'auto';
  const args = ['search', query, '--limit', limit.toString(), '--mode', cliMode, '--json'];

  if (enrich) {
    args.push('--enrich');
  }

  const result = await executeCodexLens(args, { cwd: path });

  if (result.success && result.output) {
    try {
      result.results = JSON.parse(result.output);
      delete result.output;
    } catch {
      // Keep raw output if JSON parse fails
    }
  }

  return result;
}

/**
 * Search code and return only file paths
 * @param params - Search parameters
 * @returns Execution result
 */
async function searchFiles(params: Params): Promise<ExecuteResult> {
  const { query, path = '.', limit = 20, mode = 'auto', enrich = false } = params;

  if (!query) {
    return { success: false, error: 'Query is required for search_files action' };
  }

  // Map MCP mode names to CLI mode names
  const modeMap: Record<string, string> = {
    'text': 'exact',
    'semantic': 'pure-vector',
    'auto': 'auto',
    'exact': 'exact',
    'fuzzy': 'fuzzy',
    'hybrid': 'hybrid',
    'vector': 'vector',
    'pure-vector': 'pure-vector',
  };

  const cliMode = modeMap[mode] || 'auto';
  const args = ['search', query, '--files-only', '--limit', limit.toString(), '--mode', cliMode, '--json'];

  if (enrich) {
    args.push('--enrich');
  }

  const result = await executeCodexLens(args, { cwd: path });

  if (result.success && result.output) {
    try {
      result.files = JSON.parse(result.output);
      delete result.output;
    } catch {
      // Keep raw output if JSON parse fails
    }
  }

  return result;
}

/**
 * Extract symbols from a file
 * @param params - Parameters
 * @returns Execution result
 */
async function extractSymbols(params: Params): Promise<ExecuteResult> {
  const { file } = params;

  if (!file) {
    return { success: false, error: 'File is required for symbol action' };
  }

  const args = ['symbol', file, '--json'];

  const result = await executeCodexLens(args);

  if (result.success && result.output) {
    try {
      result.symbols = JSON.parse(result.output);
      delete result.output;
    } catch {
      // Keep raw output if JSON parse fails
    }
  }

  return result;
}

/**
 * Get index status
 * @param params - Parameters
 * @returns Execution result
 */
async function getStatus(params: Params): Promise<ExecuteResult> {
  const { path = '.' } = params;

  const args = ['status', '--json'];

  const result = await executeCodexLens(args, { cwd: path });

  if (result.success && result.output) {
    try {
      result.status = JSON.parse(result.output);
      delete result.output;
    } catch {
      // Keep raw output if JSON parse fails
    }
  }

  return result;
}

/**
 * Show configuration
 * @param params - Parameters
 * @returns Execution result
 */
async function configShow(): Promise<ExecuteResult> {
  const args = ['config', 'show', '--json'];
  const result = await executeCodexLens(args);

  if (result.success && result.output) {
    try {
      result.config = JSON.parse(result.output);
      delete result.output;
    } catch {
      // Keep raw output if JSON parse fails
    }
  }

  return result;
}

/**
 * Set configuration value
 * @param params - Parameters
 * @returns Execution result
 */
async function configSet(params: Params): Promise<ExecuteResult> {
  const { key, value } = params;

  if (!key) {
    return { success: false, error: 'key is required for config_set action' };
  }
  if (!value) {
    return { success: false, error: 'value is required for config_set action' };
  }

  const args = ['config', 'set', key, value, '--json'];
  const result = await executeCodexLens(args);

  if (result.success && result.output) {
    try {
      result.config = JSON.parse(result.output);
      delete result.output;
    } catch {
      // Keep raw output if JSON parse fails
    }
  }

  return result;
}

/**
 * Migrate indexes to new location
 * @param params - Parameters
 * @returns Execution result
 */
async function configMigrate(params: Params): Promise<ExecuteResult> {
  const { newPath } = params;

  if (!newPath) {
    return { success: false, error: 'newPath is required for config_migrate action' };
  }

  const args = ['config', 'migrate', newPath, '--json'];
  const result = await executeCodexLens(args, { timeout: 300000 }); // 5 min for migration

  if (result.success && result.output) {
    try {
      result.config = JSON.parse(result.output);
      delete result.output;
    } catch {
      // Keep raw output if JSON parse fails
    }
  }

  return result;
}

/**
 * Clean indexes
 * @param params - Parameters
 * @returns Execution result
 */
async function cleanIndexes(params: Params): Promise<ExecuteResult> {
  const { path, all } = params;

  const args = ['clean'];

  if (all) {
    args.push('--all');
  } else if (path) {
    args.push(path);
  }

  args.push('--json');
  const result = await executeCodexLens(args);

  if (result.success && result.output) {
    try {
      result.cleanResult = JSON.parse(result.output);
      delete result.output;
    } catch {
      // Keep raw output if JSON parse fails
    }
  }

  return result;
}

// Tool schema for MCP
export const schema: ToolSchema = {
  name: 'codex_lens',
  description: `CodexLens - Code indexing and semantic search.

Usage:
  codex_lens(action="init", path=".")           # Index directory (auto-generates embeddings if available)
  codex_lens(action="search", query="func")     # Search code (auto: hybrid if embeddings exist, else exact)
  codex_lens(action="search", query="func", mode="hybrid")  # Force hybrid search
  codex_lens(action="search_files", query="x")  # Search, return paths only

Graph Enrichment:
  codex_lens(action="search", query="func", enrich=true)  # Enrich results with code relationships

Search Modes:
  - auto: Auto-detect (hybrid if embeddings exist, exact otherwise) [default]
  - exact/text: Exact FTS for code identifiers
  - hybrid: Exact + Fuzzy + Vector fusion (best results, requires embeddings)
  - fuzzy: Typo-tolerant search
  - vector: Semantic + keyword
  - pure-vector/semantic: Pure semantic search

Note: For advanced operations (config, status, clean), use CLI directly: codexlens --help`,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: [
          'init',
          'search',
          'search_files',
          'status',
          'symbol',
          'check',
          'update',
          'bootstrap',
        ],
        description: 'Action to perform: init/update (index directory), search (search code), search_files (search files only), status (index status), symbol (extract symbols), check (check if ready), bootstrap (setup venv)',
      },
      path: {
        type: 'string',
        description: 'Target directory path (for init, search, search_files). Defaults to current directory.',
      },
      query: {
        type: 'string',
        description: 'Search query (required for search and search_files actions)',
      },
      mode: {
        type: 'string',
        enum: ['auto', 'text', 'semantic', 'exact', 'fuzzy', 'hybrid', 'vector', 'pure-vector'],
        description: 'Search mode: auto (default, hybrid if embeddings exist), text/exact (FTS), hybrid (best), fuzzy, vector, semantic/pure-vector',
        default: 'auto',
      },
      format: {
        type: 'string',
        enum: ['json', 'text', 'pretty'],
        description: 'Output format: json (default), text, pretty',
        default: 'json',
      },
      languages: {
        type: 'array',
        items: { type: 'string' },
        description: 'Languages to index (for init action). Example: ["javascript", "typescript", "python"]',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of search results (for search and search_files actions)',
        default: 20,
      },
      enrich: {
        type: 'boolean',
        description: 'Enrich search results with code graph relationships (calls, imports)',
        default: false,
      },
    },
    required: ['action'],
  },
};

// Handler function
export async function handler(params: Record<string, unknown>): Promise<ToolResult<ExecuteResult>> {
  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return { success: false, error: `Invalid params: ${parsed.error.message}` };
  }

  const { action } = parsed.data;

  try {
    let result: ExecuteResult;

    switch (action) {
      case 'init':
        result = await initIndex(parsed.data);
        break;

      case 'search':
        result = await searchCode(parsed.data);
        break;

      case 'search_files':
        result = await searchFiles(parsed.data);
        break;

      case 'status':
        result = await getStatus(parsed.data);
        break;

      case 'symbol':
        result = await extractSymbols(parsed.data);
        break;

      case 'check':
        const checkStatus = await ensureReady();
        result = {
          success: checkStatus.ready,
          ready: checkStatus.ready,
          version: checkStatus.version,
          error: checkStatus.error,
        };
        break;

      case 'update':
        // Update is an alias for init (incremental update)
        result = await initIndex(parsed.data);
        break;

      case 'bootstrap':
        const bootstrapResult = await bootstrapVenv();
        result = {
          success: bootstrapResult.success,
          message: bootstrapResult.message,
          error: bootstrapResult.error,
        };
        break;

      default:
        throw new Error(
          `Unknown action: ${action}. Valid actions: init, search, search_files, status, symbol, check, update, bootstrap`
        );
    }

    return result.success ? { success: true, result } : { success: false, error: result.error };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Uninstall CodexLens by removing the venv directory
 * @returns Uninstall result
 */
async function uninstallCodexLens(): Promise<BootstrapResult> {
  try {
    // Check if venv exists
    if (!existsSync(CODEXLENS_VENV)) {
      return { success: false, error: 'CodexLens not installed (venv not found)' };
    }

    console.log('[CodexLens] Uninstalling CodexLens...');
    console.log(`[CodexLens] Removing directory: ${CODEXLENS_DATA_DIR}`);

    // Remove the entire .codexlens directory
    const fs = await import('fs');
    fs.rmSync(CODEXLENS_DATA_DIR, { recursive: true, force: true });

    // Reset bootstrap cache
    bootstrapChecked = false;
    bootstrapReady = false;

    console.log('[CodexLens] CodexLens uninstalled successfully');
    return { success: true, message: 'CodexLens uninstalled successfully' };
  } catch (err) {
    return { success: false, error: `Failed to uninstall CodexLens: ${(err as Error).message}` };
  }
}

// Export types
export type { ProgressInfo, ExecuteOptions };

// Export for direct usage
export { ensureReady, executeCodexLens, checkVenvStatus, bootstrapVenv, checkSemanticStatus, installSemantic, uninstallCodexLens };

// Backward-compatible export for tests
export const codexLensTool = {
  name: schema.name,
  description: schema.description,
  parameters: schema.inputSchema,
  execute: async (params: Record<string, unknown>) => {
    const result = await handler(params);
    // Return the result directly - tests expect {success: boolean, ...} format
    return result.success ? result.result : { success: false, error: result.error };
  }
};
