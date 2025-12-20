/**
 * Example: Using Memory Embedder from TypeScript
 *
 * This shows how to integrate the Python memory embedder script
 * into CCW's TypeScript codebase.
 */

import { execSync } from 'child_process';
import { join } from 'path';

interface EmbedResult {
  success: boolean;
  chunks_processed: number;
  chunks_failed: number;
  elapsed_time: number;
}

interface SearchMatch {
  source_id: string;
  source_type: 'core_memory' | 'workflow' | 'cli_history';
  chunk_index: number;
  content: string;
  score: number;
  restore_command: string;
}

interface SearchResult {
  success: boolean;
  matches: SearchMatch[];
  error?: string;
}

interface StatusResult {
  total_chunks: number;
  embedded_chunks: number;
  pending_chunks: number;
  by_type: Record<string, { total: number; embedded: number; pending: number }>;
}

/**
 * Get path to memory embedder script
 */
function getEmbedderScript(): string {
  return join(__dirname, 'memory_embedder.py');
}

/**
 * Execute memory embedder command
 */
function execEmbedder(args: string[]): string {
  const script = getEmbedderScript();
  const command = `python "${script}" ${args.join(' ')}`;

  try {
    return execSync(command, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
  } catch (error: any) {
    // Try to parse error output as JSON
    if (error.stdout) {
      return error.stdout;
    }
    throw new Error(`Embedder failed: ${error.message}`);
  }
}

/**
 * Generate embeddings for memory chunks
 */
export function embedChunks(
  dbPath: string,
  options: {
    sourceId?: string;
    batchSize?: number;
    force?: boolean;
  } = {}
): EmbedResult {
  const args = ['embed', `"${dbPath}"`];

  if (options.sourceId) {
    args.push('--source-id', options.sourceId);
  }
  if (options.batchSize) {
    args.push('--batch-size', String(options.batchSize));
  }
  if (options.force) {
    args.push('--force');
  }

  const output = execEmbedder(args);
  return JSON.parse(output);
}

/**
 * Search memory chunks semantically
 */
export function searchMemory(
  dbPath: string,
  query: string,
  options: {
    topK?: number;
    minScore?: number;
    sourceType?: 'core_memory' | 'workflow' | 'cli_history';
  } = {}
): SearchResult {
  const args = ['search', `"${dbPath}"`, `"${query}"`];

  if (options.topK) {
    args.push('--top-k', String(options.topK));
  }
  if (options.minScore !== undefined) {
    args.push('--min-score', String(options.minScore));
  }
  if (options.sourceType) {
    args.push('--type', options.sourceType);
  }

  const output = execEmbedder(args);
  return JSON.parse(output);
}

/**
 * Get embedding status
 */
export function getEmbeddingStatus(dbPath: string): StatusResult {
  const args = ['status', `"${dbPath}"`];
  const output = execEmbedder(args);
  return JSON.parse(output);
}

// ============================================================================
// Example Usage
// ============================================================================

async function exampleUsage() {
  const dbPath = join(process.env.HOME || '', '.ccw/projects/myproject/core-memory/core_memory.db');

  // 1. Check status
  console.log('Checking embedding status...');
  const status = getEmbeddingStatus(dbPath);
  console.log(`Total chunks: ${status.total_chunks}`);
  console.log(`Embedded: ${status.embedded_chunks}`);
  console.log(`Pending: ${status.pending_chunks}`);

  // 2. Generate embeddings if needed
  if (status.pending_chunks > 0) {
    console.log('\nGenerating embeddings...');
    const embedResult = embedChunks(dbPath, { batchSize: 16 });
    console.log(`Processed: ${embedResult.chunks_processed}`);
    console.log(`Time: ${embedResult.elapsed_time}s`);
  }

  // 3. Search for relevant memories
  console.log('\nSearching for authentication-related memories...');
  const searchResult = searchMemory(dbPath, 'authentication flow', {
    topK: 5,
    minScore: 0.5
  });

  if (searchResult.success) {
    console.log(`Found ${searchResult.matches.length} matches:`);
    for (const match of searchResult.matches) {
      console.log(`\n- ${match.source_id} (score: ${match.score})`);
      console.log(`  Type: ${match.source_type}`);
      console.log(`  Restore: ${match.restore_command}`);
      console.log(`  Content: ${match.content.substring(0, 100)}...`);
    }
  }

  // 4. Search specific source type
  console.log('\nSearching workflows only...');
  const workflowSearch = searchMemory(dbPath, 'API implementation', {
    sourceType: 'workflow',
    topK: 3
  });

  console.log(`Found ${workflowSearch.matches.length} workflow matches`);
}

// Run example if executed directly
if (require.main === module) {
  exampleUsage().catch(console.error);
}
