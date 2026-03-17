/**
 * Unified Vector Index - STUB (v1 Python bridge removed)
 *
 * The Python unified_memory_embedder.py bridge has been removed. This module
 * provides no-op stubs so that existing consumers compile without errors.
 */

const V1_REMOVED = 'Unified vector index Python bridge has been removed (v1 cleanup).';

// ---------------------------------------------------------------------------
// Types (kept for backward compatibility)
// ---------------------------------------------------------------------------

export type SourceType = 'core_memory' | 'workflow' | 'cli_history';

export type VectorCategory = 'core_memory' | 'cli_history' | 'workflow' | 'entity' | 'pattern';

export interface ChunkMetadata {
  source_id: string;
  source_type: SourceType;
  category: VectorCategory;
  chunk_index?: number;
  [key: string]: unknown;
}

export interface VectorChunk {
  content: string;
  source_id: string;
  source_type: SourceType;
  category: VectorCategory;
  chunk_index: number;
  metadata?: Record<string, unknown>;
}

export interface EmbedResult {
  success: boolean;
  chunks_processed: number;
  chunks_failed: number;
  elapsed_time: number;
  error?: string;
}

export interface VectorSearchMatch {
  content: string;
  score: number;
  source_id: string;
  source_type: string;
  chunk_index: number;
  category: string;
  metadata: Record<string, unknown>;
}

export interface VectorSearchResult {
  success: boolean;
  matches: VectorSearchMatch[];
  elapsed_time?: number;
  total_searched?: number;
  error?: string;
}

export interface VectorSearchOptions {
  topK?: number;
  minScore?: number;
  category?: VectorCategory;
}

export interface VectorIndexStatus {
  success: boolean;
  total_chunks: number;
  hnsw_available: boolean;
  hnsw_count: number;
  dimension: number;
  categories?: Record<string, number>;
  model_config?: {
    backend: string;
    profile: string;
    dimension: number;
    max_tokens: number;
  };
  error?: string;
}

export interface ReindexResult {
  success: boolean;
  hnsw_count?: number;
  elapsed_time?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// No-op implementations
// ---------------------------------------------------------------------------

export function isUnifiedEmbedderAvailable(): boolean {
  return false;
}

export function chunkContent(content: string): string[] {
  // Minimal chunking for backward compat - just return the content as-is
  if (!content.trim()) return [];
  return [content];
}

export class UnifiedVectorIndex {
  constructor(_projectPath: string) {}

  async indexContent(
    _content: string,
    _metadata: ChunkMetadata
  ): Promise<EmbedResult> {
    return {
      success: false,
      chunks_processed: 0,
      chunks_failed: 0,
      elapsed_time: 0,
      error: V1_REMOVED,
    };
  }

  async search(
    _query: string,
    _options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult> {
    return {
      success: false,
      matches: [],
      error: V1_REMOVED,
    };
  }

  async searchByVector(
    _vector: number[],
    _options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult> {
    return {
      success: false,
      matches: [],
      error: V1_REMOVED,
    };
  }

  async reindexAll(): Promise<ReindexResult> {
    return {
      success: false,
      error: V1_REMOVED,
    };
  }

  async getStatus(): Promise<VectorIndexStatus> {
    return {
      success: false,
      total_chunks: 0,
      hnsw_available: false,
      hnsw_count: 0,
      dimension: 0,
      error: V1_REMOVED,
    };
  }
}
