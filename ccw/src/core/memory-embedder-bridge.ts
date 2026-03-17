/**
 * Memory Embedder Bridge - STUB (v1 Python bridge removed)
 *
 * The Python memory_embedder.py bridge has been removed. This module provides
 * no-op stubs so that existing consumers compile without errors.
 */

const V1_REMOVED = 'Memory embedder Python bridge has been removed (v1 cleanup).';

// Types (kept for backward compatibility)
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

export interface Stage1EmbedResult {
  success: boolean;
  chunksCreated: number;
  chunksEmbedded: number;
  error?: string;
}

export function isEmbedderAvailable(): boolean {
  return false;
}

export async function generateEmbeddings(
  _dbPath: string,
  _options: EmbedOptions = {}
): Promise<EmbedResult> {
  return {
    success: false,
    chunks_processed: 0,
    chunks_failed: 0,
    elapsed_time: 0,
    error: V1_REMOVED,
  };
}

export async function searchMemories(
  _dbPath: string,
  _query: string,
  _options: SearchOptions = {}
): Promise<SearchResult> {
  return {
    success: false,
    matches: [],
    error: V1_REMOVED,
  };
}

export async function getEmbeddingStatus(_dbPath: string): Promise<EmbeddingStatus> {
  return {
    success: false,
    total_chunks: 0,
    embedded_chunks: 0,
    pending_chunks: 0,
    by_type: {},
    error: V1_REMOVED,
  };
}

export async function embedStage1Outputs(
  _projectPath: string,
  _force: boolean = false
): Promise<Stage1EmbedResult> {
  return {
    success: false,
    chunksCreated: 0,
    chunksEmbedded: 0,
    error: V1_REMOVED,
  };
}
