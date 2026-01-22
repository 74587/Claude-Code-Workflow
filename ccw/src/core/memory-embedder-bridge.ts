/**
 * Memory Embedder Bridge - TypeScript interface to Python memory embedder
 *
 * This module provides a TypeScript bridge to the Python memory_embedder.py script,
 * which generates and searches embeddings for memory chunks using CodexLens's embedder.
 *
 * Features:
 * - Reuses CodexLens venv at ~/.codexlens/venv
 * - JSON protocol communication
 * - Three commands: embed, search, status
 * - Automatic availability checking
 */

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { getCodexLensPython } from '../utils/codexlens-path.js';

// Get directory of this module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Venv paths (reuse CodexLens venv)
const VENV_PYTHON = getCodexLensPython();

// Script path
const EMBEDDER_SCRIPT = join(__dirname, '..', '..', 'scripts', 'memory_embedder.py');

// Types
export interface EmbedResult {
  success: boolean;
  chunks_processed: number;
  chunks_failed: number;
  elapsed_time: number;
  error?: string;
}

export interface SearchMatch {
  source_id: string;
  source_type: 'core_memory' | 'workflow' | 'cli_history';
  chunk_index: number;
  content: string;
  score: number;
  restore_command: string;
}

export interface SearchResult {
  success: boolean;
  matches: SearchMatch[];
  query?: string;
  elapsed_time?: number;
  error?: string;
}

export interface EmbeddingStatus {
  success?: boolean;
  total_chunks: number;
  embedded_chunks: number;
  pending_chunks: number;
  by_type: Record<string, { total: number; embedded: number; pending: number }>;
  error?: string;
}

export interface EmbedOptions {
  sourceId?: string;
  batchSize?: number;
  force?: boolean;
}

export interface SearchOptions {
  topK?: number;
  minScore?: number;
  sourceType?: 'core_memory' | 'workflow' | 'cli_history';
}

/**
 * Check if embedder is available (venv and script exist)
 * @returns True if embedder is available
 */
export function isEmbedderAvailable(): boolean {
  // Check venv python exists
  if (!existsSync(VENV_PYTHON)) {
    return false;
  }

  // Check script exists
  if (!existsSync(EMBEDDER_SCRIPT)) {
    return false;
  }

  return true;
}

/**
 * Run Python script with arguments
 * @param args - Command line arguments
 * @param timeout - Timeout in milliseconds
 * @returns JSON output from script
 */
function runPython(args: string[], timeout: number = 300000): Promise<string> {
  return new Promise((resolve, reject) => {
    // Check availability
    if (!isEmbedderAvailable()) {
      reject(
        new Error(
          'Memory embedder not available. Ensure CodexLens venv exists at ~/.codexlens/venv'
        )
      );
      return;
    }

    // Spawn Python process
    const child = spawn(VENV_PYTHON, [EMBEDDER_SCRIPT, ...args], {
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
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Python script failed (exit code ${code}): ${stderr || stdout}`));
      }
    });

    child.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
        reject(new Error('Python script timed out'));
      } else {
        reject(new Error(`Failed to spawn Python: ${err.message}`));
      }
    });
  });
}

/**
 * Generate embeddings for memory chunks
 * @param dbPath - Path to SQLite database
 * @param options - Embedding options
 * @returns Embedding result
 */
export async function generateEmbeddings(
  dbPath: string,
  options: EmbedOptions = {}
): Promise<EmbedResult> {
  const { sourceId, batchSize = 8, force = false } = options;

  // Build arguments
  const args = ['embed', dbPath];

  if (sourceId) {
    args.push('--source-id', sourceId);
  }

  if (batchSize !== 8) {
    args.push('--batch-size', batchSize.toString());
  }

  if (force) {
    args.push('--force');
  }

  try {
    // Default timeout: 5 minutes
    const output = await runPython(args, 300000);
    const result = JSON.parse(output) as EmbedResult;
    return result;
  } catch (err) {
    return {
      success: false,
      chunks_processed: 0,
      chunks_failed: 0,
      elapsed_time: 0,
      error: (err as Error).message,
    };
  }
}

/**
 * Search memory chunks using semantic search
 * @param dbPath - Path to SQLite database
 * @param query - Search query text
 * @param options - Search options
 * @returns Search results
 */
export async function searchMemories(
  dbPath: string,
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult> {
  const { topK = 10, minScore = 0.3, sourceType } = options;

  // Build arguments
  const args = ['search', dbPath, query];

  if (topK !== 10) {
    args.push('--top-k', topK.toString());
  }

  if (minScore !== 0.3) {
    args.push('--min-score', minScore.toString());
  }

  if (sourceType) {
    args.push('--type', sourceType);
  }

  try {
    // Default timeout: 30 seconds
    const output = await runPython(args, 30000);
    const result = JSON.parse(output) as SearchResult;
    return result;
  } catch (err) {
    return {
      success: false,
      matches: [],
      error: (err as Error).message,
    };
  }
}

/**
 * Get embedding status statistics
 * @param dbPath - Path to SQLite database
 * @returns Embedding status
 */
export async function getEmbeddingStatus(dbPath: string): Promise<EmbeddingStatus> {
  // Build arguments
  const args = ['status', dbPath];

  try {
    // Default timeout: 30 seconds
    const output = await runPython(args, 30000);
    const result = JSON.parse(output) as EmbeddingStatus;
    return { ...result, success: true };
  } catch (err) {
    return {
      success: false,
      total_chunks: 0,
      embedded_chunks: 0,
      pending_chunks: 0,
      by_type: {},
      error: (err as Error).message,
    };
  }
}
