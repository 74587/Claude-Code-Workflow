/**
 * Context Cache Store - In-memory cache with TTL and LRU eviction
 * Stores packed file contents with session-based lifecycle management
 */

/** Cache entry metadata */
export interface CacheMetadata {
  files: string[];           // Source file paths
  patterns: string[];        // Original @patterns
  total_bytes: number;       // Total content bytes
  file_count: number;        // Number of files packed
}

/** Cache entry structure */
export interface CacheEntry {
  session_id: string;
  created_at: number;        // Timestamp ms
  accessed_at: number;       // Last access timestamp
  ttl: number;               // TTL in ms
  content: string;           // Packed file content
  metadata: CacheMetadata;
}

/** Paginated read result */
export interface PagedReadResult {
  content: string;           // Current page content
  offset: number;            // Current byte offset
  limit: number;             // Requested bytes
  total_bytes: number;       // Total content bytes
  has_more: boolean;         // Has more content
  next_offset: number | null; // Next page offset (null if no more)
}

/** Cache status info */
export interface CacheStatus {
  entries: number;           // Total cache entries
  total_bytes: number;       // Total bytes cached
  oldest_session: string | null;
  newest_session: string | null;
}

/** Session status info */
export interface SessionStatus {
  session_id: string;
  exists: boolean;
  files?: string[];
  file_count?: number;
  total_bytes?: number;
  created_at?: string;
  expires_at?: string;
  accessed_at?: string;
  ttl_remaining_ms?: number;
}

/** Default configuration */
const DEFAULT_MAX_ENTRIES = 100;
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_PAGE_SIZE = 65536; // 64KB

/**
 * Context Cache Store singleton
 * Manages in-memory cache with TTL expiration and LRU eviction
 */
class ContextCacheStore {
  private cache: Map<string, CacheEntry> = new Map();
  private maxEntries: number;
  private defaultTTL: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: {
    maxEntries?: number;
    defaultTTL?: number;
    cleanupIntervalMs?: number;
  } = {}) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.defaultTTL = options.defaultTTL ?? DEFAULT_TTL_MS;

    // Start periodic cleanup
    const cleanupMs = options.cleanupIntervalMs ?? 60000; // 1 minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, cleanupMs);

    // Allow cleanup to not keep process alive
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Store packed content in cache
   */
  set(
    sessionId: string,
    content: string,
    metadata: CacheMetadata,
    ttl?: number
  ): CacheEntry {
    const now = Date.now();
    const entryTTL = ttl ?? this.defaultTTL;

    // Evict if at capacity
    if (this.cache.size >= this.maxEntries && !this.cache.has(sessionId)) {
      this.evictOldest();
    }

    const entry: CacheEntry = {
      session_id: sessionId,
      created_at: now,
      accessed_at: now,
      ttl: entryTTL,
      content,
      metadata,
    };

    this.cache.set(sessionId, entry);
    return entry;
  }

  /**
   * Get cache entry by session ID
   */
  get(sessionId: string): CacheEntry | null {
    const entry = this.cache.get(sessionId);

    if (!entry) {
      return null;
    }

    // Check TTL expiration
    if (this.isExpired(entry)) {
      this.cache.delete(sessionId);
      return null;
    }

    // Update access time (LRU)
    entry.accessed_at = Date.now();
    return entry;
  }

  /**
   * Read content with pagination
   */
  read(
    sessionId: string,
    offset: number = 0,
    limit: number = DEFAULT_PAGE_SIZE
  ): PagedReadResult | null {
    const entry = this.get(sessionId);

    if (!entry) {
      return null;
    }

    const content = entry.content;
    const totalBytes = Buffer.byteLength(content, 'utf-8');

    // Handle byte-based offset for UTF-8
    // For simplicity, we use character-based slicing
    // This is approximate but works for most use cases
    const charOffset = Math.min(offset, content.length);
    const charLimit = Math.min(limit, content.length - charOffset);

    const pageContent = content.slice(charOffset, charOffset + charLimit);
    const endOffset = charOffset + pageContent.length;
    const hasMore = endOffset < content.length;

    return {
      content: pageContent,
      offset: charOffset,
      limit: charLimit,
      total_bytes: totalBytes,
      has_more: hasMore,
      next_offset: hasMore ? endOffset : null,
    };
  }

  /**
   * Release (delete) cache entry
   */
  release(sessionId: string): { released: boolean; freed_bytes: number } {
    const entry = this.cache.get(sessionId);

    if (!entry) {
      return { released: false, freed_bytes: 0 };
    }

    const freedBytes = entry.metadata.total_bytes;
    this.cache.delete(sessionId);

    return { released: true, freed_bytes: freedBytes };
  }

  /**
   * Get session status
   */
  getSessionStatus(sessionId: string): SessionStatus {
    const entry = this.cache.get(sessionId);

    if (!entry) {
      return { session_id: sessionId, exists: false };
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.cache.delete(sessionId);
      return { session_id: sessionId, exists: false };
    }

    const now = Date.now();
    const expiresAt = entry.created_at + entry.ttl;
    const ttlRemaining = Math.max(0, expiresAt - now);

    return {
      session_id: sessionId,
      exists: true,
      files: entry.metadata.files,
      file_count: entry.metadata.file_count,
      total_bytes: entry.metadata.total_bytes,
      created_at: new Date(entry.created_at).toISOString(),
      expires_at: new Date(expiresAt).toISOString(),
      accessed_at: new Date(entry.accessed_at).toISOString(),
      ttl_remaining_ms: ttlRemaining,
    };
  }

  /**
   * Get overall cache status
   */
  getStatus(): CacheStatus {
    let totalBytes = 0;
    let oldest: CacheEntry | null = null;
    let newest: CacheEntry | null = null;

    for (const entry of this.cache.values()) {
      // Skip expired entries
      if (this.isExpired(entry)) {
        continue;
      }

      totalBytes += entry.metadata.total_bytes;

      if (!oldest || entry.created_at < oldest.created_at) {
        oldest = entry;
      }
      if (!newest || entry.created_at > newest.created_at) {
        newest = entry;
      }
    }

    return {
      entries: this.cache.size,
      total_bytes: totalBytes,
      oldest_session: oldest?.session_id ?? null,
      newest_session: newest?.session_id ?? null,
    };
  }

  /**
   * Cleanup expired entries
   */
  cleanupExpired(): { removed: number } {
    let removed = 0;
    const now = Date.now();

    for (const [sessionId, entry] of this.cache.entries()) {
      if (this.isExpired(entry, now)) {
        this.cache.delete(sessionId);
        removed++;
      }
    }

    return { removed };
  }

  /**
   * Clear all cache entries
   */
  clear(): { removed: number } {
    const count = this.cache.size;
    this.cache.clear();
    return { removed: count };
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry, now?: number): boolean {
    const currentTime = now ?? Date.now();
    return currentTime > entry.created_at + entry.ttl;
  }

  /**
   * Evict oldest entry (LRU)
   */
  private evictOldest(): void {
    let oldest: [string, CacheEntry] | null = null;

    for (const [sessionId, entry] of this.cache.entries()) {
      if (!oldest || entry.accessed_at < oldest[1].accessed_at) {
        oldest = [sessionId, entry];
      }
    }

    if (oldest) {
      this.cache.delete(oldest[0]);
    }
  }

  /**
   * Stop cleanup timer (for graceful shutdown)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * List all session IDs
   */
  listSessions(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Check if session exists and is valid
   */
  has(sessionId: string): boolean {
    const entry = this.cache.get(sessionId);
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.cache.delete(sessionId);
      return false;
    }
    return true;
  }
}

// Singleton instance
let cacheInstance: ContextCacheStore | null = null;

/**
 * Get the singleton cache instance
 */
export function getContextCacheStore(options?: {
  maxEntries?: number;
  defaultTTL?: number;
  cleanupIntervalMs?: number;
}): ContextCacheStore {
  if (!cacheInstance) {
    cacheInstance = new ContextCacheStore(options);
  }
  return cacheInstance;
}

/**
 * Reset the cache instance (for testing)
 */
export function resetContextCacheStore(): void {
  if (cacheInstance) {
    cacheInstance.destroy();
    cacheInstance = null;
  }
}

export { ContextCacheStore };
