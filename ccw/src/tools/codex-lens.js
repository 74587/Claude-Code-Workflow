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

import { spawn, execSync } from 'child_process';
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
const VENV_PYTHON = process.platform === 'win32'
  ? join(CODEXLENS_VENV, 'Scripts', 'python.exe')
  : join(CODEXLENS_VENV, 'bin', 'python');

// Bootstrap status cache
let bootstrapChecked = false;
let bootstrapReady = false;

/**
 * Detect available Python 3 executable
 * @returns {string} - Python executable command
 */
function getSystemPython() {
  const commands = process.platform === 'win32'
    ? ['python', 'py', 'python3']
    : ['python3', 'python'];

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
 * @returns {Promise<{ready: boolean, error?: string}>}
 */
async function checkVenvStatus() {
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
      timeout: 10000
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

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
 * @returns {Promise<{available: boolean, backend?: string, error?: string}>}
 */
async function checkSemanticStatus() {
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
      timeout: 15000
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

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
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function installSemantic() {
  // First ensure CodexLens is installed
  const venvStatus = await checkVenvStatus();
  if (!venvStatus.ready) {
    return { success: false, error: 'CodexLens not installed. Install CodexLens first.' };
  }

  const pipPath = process.platform === 'win32'
    ? join(CODEXLENS_VENV, 'Scripts', 'pip.exe')
    : join(CODEXLENS_VENV, 'bin', 'pip');

  return new Promise((resolve) => {
    console.log('[CodexLens] Installing semantic search dependencies (fastembed)...');
    console.log('[CodexLens] Using ONNX-based fastembed backend (~200MB)');

    const child = spawn(pipPath, ['install', 'numpy>=1.24', 'fastembed>=0.2'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 600000 // 10 minutes for potential model download
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

    child.stderr.on('data', (data) => { stderr += data.toString(); });

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
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function bootstrapVenv() {
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
      return { success: false, error: `Failed to create venv: ${err.message}` };
    }
  }

  // Install codexlens with semantic extras
  try {
    console.log('[CodexLens] Installing codexlens package...');
    const pipPath = process.platform === 'win32'
      ? join(CODEXLENS_VENV, 'Scripts', 'pip.exe')
      : join(CODEXLENS_VENV, 'bin', 'pip');

    // Try multiple local paths, then fall back to PyPI
    const possiblePaths = [
      join(process.cwd(), 'codex-lens'),
      join(__dirname, '..', '..', '..', 'codex-lens'),  // ccw/src/tools -> project root
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
    return { success: false, error: `Failed to install codexlens: ${err.message}` };
  }
}

/**
 * Ensure CodexLens is ready to use
 * @returns {Promise<{ready: boolean, error?: string}>}
 */
async function ensureReady() {
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
 * Execute CodexLens CLI command
 * @param {string[]} args - CLI arguments
 * @param {Object} options - Execution options
 * @returns {Promise<{success: boolean, output?: string, error?: string}>}
 */
async function executeCodexLens(args, options = {}) {
  const { timeout = 60000, cwd = process.cwd() } = options;

  // Ensure ready
  const readyStatus = await ensureReady();
  if (!readyStatus.ready) {
    return { success: false, error: readyStatus.error };
  }

  return new Promise((resolve) => {
    const child = spawn(VENV_PYTHON, ['-m', 'codexlens', ...args], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timeoutId);

      if (timedOut) {
        resolve({ success: false, error: 'Command timed out' });
      } else if (code === 0) {
        resolve({ success: true, output: stdout.trim() });
      } else {
        resolve({ success: false, error: stderr || `Exit code: ${code}` });
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeoutId);
      resolve({ success: false, error: `Spawn failed: ${err.message}` });
    });
  });
}

/**
 * Initialize CodexLens index for a directory
 * @param {Object} params - Parameters
 * @returns {Promise<Object>}
 */
async function initIndex(params) {
  const { path = '.', languages } = params;

  const args = ['init', path];
  if (languages && languages.length > 0) {
    args.push('--languages', languages.join(','));
  }

  return executeCodexLens(args, { cwd: path });
}

/**
 * Search code using CodexLens
 * @param {Object} params - Search parameters
 * @returns {Promise<Object>}
 */
async function searchCode(params) {
  const { query, path = '.', mode = 'text', limit = 20 } = params;

  const args = ['search', query, '--limit', limit.toString(), '--json'];

  // Note: semantic mode requires semantic extras to be installed
  // Currently not exposed via CLI flag, uses standard FTS search

  const result = await executeCodexLens(args, { cwd: path });

  if (result.success) {
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
 * Extract symbols from a file
 * @param {Object} params - Parameters
 * @returns {Promise<Object>}
 */
async function extractSymbols(params) {
  const { file } = params;

  const args = ['symbol', file, '--json'];

  const result = await executeCodexLens(args);

  if (result.success) {
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
 * @param {Object} params - Parameters
 * @returns {Promise<Object>}
 */
async function getStatus(params) {
  const { path = '.' } = params;

  const args = ['status', '--json'];

  const result = await executeCodexLens(args, { cwd: path });

  if (result.success) {
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
 * Update specific files in the index
 * @param {Object} params - Parameters
 * @returns {Promise<Object>}
 */
async function updateFiles(params) {
  const { files, path = '.' } = params;

  if (!files || !Array.isArray(files) || files.length === 0) {
    return { success: false, error: 'files parameter is required and must be a non-empty array' };
  }

  const args = ['update', ...files, '--json'];

  const result = await executeCodexLens(args, { cwd: path });

  if (result.success) {
    try {
      result.updateResult = JSON.parse(result.output);
      delete result.output;
    } catch {
      // Keep raw output if JSON parse fails
    }
  }

  return result;
}

/**
 * Main execute function - routes to appropriate handler
 * @param {Object} params - Execution parameters
 * @returns {Promise<Object>}
 */
async function execute(params) {
  const { action, ...rest } = params;

  switch (action) {
    case 'init':
      return initIndex(rest);

    case 'search':
      return searchCode(rest);

    case 'symbol':
      return extractSymbols(rest);

    case 'status':
      return getStatus(rest);

    case 'update':
      return updateFiles(rest);

    case 'bootstrap':
      // Force re-bootstrap
      bootstrapChecked = false;
      bootstrapReady = false;
      const bootstrapResult = await bootstrapVenv();
      return bootstrapResult.success
        ? { success: true, message: 'CodexLens bootstrapped successfully' }
        : { success: false, error: bootstrapResult.error };

    case 'check':
      // Check venv status
      return checkVenvStatus();

    default:
      throw new Error(`Unknown action: ${action}. Valid actions: init, search, symbol, status, update, bootstrap, check`);
  }
}

/**
 * CodexLens Tool Definition
 */
export const codexLensTool = {
  name: 'codex_lens',
  description: `Code indexing and semantic search via CodexLens Python package.

Actions:
- init: Initialize index for a directory
- search: Search code (text or semantic mode)
- symbol: Extract symbols from a file
- status: Get index status
- update: Incrementally update specific files (add/modify/remove)
- bootstrap: Force re-install CodexLens venv
- check: Check venv readiness

Features:
- Automatic venv bootstrap at ~/.codexlens/venv
- SQLite FTS5 full-text search
- Tree-sitter symbol extraction
- Incremental updates for changed files
- Optional semantic search with embeddings`,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['init', 'search', 'symbol', 'status', 'update', 'bootstrap', 'check'],
        description: 'Action to perform'
      },
      path: {
        type: 'string',
        description: 'Target path (for init, search, status, update)'
      },
      query: {
        type: 'string',
        description: 'Search query (for search action)'
      },
      mode: {
        type: 'string',
        enum: ['text', 'semantic'],
        description: 'Search mode (default: text)',
        default: 'text'
      },
      file: {
        type: 'string',
        description: 'File path (for symbol action)'
      },
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'File paths to update (for update action)'
      },
      languages: {
        type: 'array',
        items: { type: 'string' },
        description: 'Languages to index (for init action)'
      },
      limit: {
        type: 'number',
        description: 'Maximum results (for search action)',
        default: 20
      },
      format: {
        type: 'string',
        enum: ['json', 'table', 'plain'],
        description: 'Output format',
        default: 'json'
      }
    },
    required: ['action']
  },
  execute
};

// Export for direct usage
export { ensureReady, executeCodexLens, checkVenvStatus, bootstrapVenv, checkSemanticStatus, installSemantic };
