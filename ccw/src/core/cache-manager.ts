import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, unlinkSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { StoragePaths, ensureStorageDir } from '../config/storage-paths.js';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  fileHashes: Map<string, number>; // file path -> mtime
  ttl?: number;
}

interface CacheOptions {
  ttl?: number; // Time-to-live in milliseconds (default: 5 minutes)
  cacheDir?: string; // Cache directory (default: .ccw-cache)
}

/**
 * CacheManager class for storing and retrieving dashboard data
 * Tracks file modification times to detect changes and invalidate cache
 */
export class CacheManager<T> {
  private cacheFile: string;
  private ttl: number;
  private cacheDir: string;

  /**
   * Create a new CacheManager instance
   * @param cacheKey - Unique identifier for this cache (e.g., 'dashboard-data')
   * @param options - Cache configuration options
   */
  constructor(cacheKey: string, options: CacheOptions = {}) {
    if (!options.cacheDir) {
      throw new Error('CacheManager requires cacheDir option. Use StoragePaths.project(path).cache');
    }
    this.ttl = options.ttl || 5 * 60 * 1000; // Default: 5 minutes
    this.cacheDir = options.cacheDir;
    this.cacheFile = join(this.cacheDir, `${cacheKey}.json`);
  }

  /**
   * Get cached data if valid, otherwise return null
   * @param watchPaths - Array of file/directory paths to check for modifications
   * @returns Cached data or null if invalid/expired
   */
  get(watchPaths: string[] = []): T | null {
    if (!existsSync(this.cacheFile)) {
      return null;
    }

    try {
      const content = readFileSync(this.cacheFile, 'utf8');
      const entry: CacheEntry<T> = JSON.parse(content, (key, value) => {
        // Revive Map objects from JSON
        if (key === 'fileHashes' && value && typeof value === 'object') {
          return new Map(Object.entries(value));
        }
        return value;
      });

      // Check TTL expiration
      if (this.ttl > 0) {
        const age = Date.now() - entry.timestamp;
        if (age > this.ttl) {
          return null;
        }
      }

      // Check if any watched files have changed
      if (watchPaths.length > 0) {
        const currentHashes = this.computeFileHashes(watchPaths);
        if (!this.hashesMatch(entry.fileHashes, currentHashes)) {
          return null;
        }
      }

      return entry.data;
    } catch (err) {
      // If cache file is corrupted or unreadable, treat as invalid
      console.warn(`Cache read error for ${this.cacheFile}:`, (err as Error).message);
      return null;
    }
  }

  /**
   * Store data in cache with current timestamp and file hashes
   * @param data - Data to cache
   * @param watchPaths - Array of file/directory paths to track
   */
  set(data: T, watchPaths: string[] = []): void {
    try {
      // Ensure cache directory exists
      if (!existsSync(this.cacheDir)) {
        mkdirSync(this.cacheDir, { recursive: true });
      }

      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        fileHashes: this.computeFileHashes(watchPaths),
        ttl: this.ttl
      };

      // Convert Map to plain object for JSON serialization
      const serializable = {
        ...entry,
        fileHashes: Object.fromEntries(entry.fileHashes)
      };

      writeFileSync(this.cacheFile, JSON.stringify(serializable, null, 2), 'utf8');
    } catch (err) {
      console.warn(`Cache write error for ${this.cacheFile}:`, (err as Error).message);
    }
  }

  /**
   * Invalidate (delete) the cache
   */
  invalidate(): void {
    try {
      if (existsSync(this.cacheFile)) {
        unlinkSync(this.cacheFile);
      }
    } catch (err) {
      console.warn(`Cache invalidation error for ${this.cacheFile}:`, (err as Error).message);
    }
  }

  /**
   * Check if cache is valid without retrieving data
   * @param watchPaths - Array of file/directory paths to check
   * @returns True if cache exists and is valid
   */
  isValid(watchPaths: string[] = []): boolean {
    return this.get(watchPaths) !== null;
  }

  /**
   * Compute file modification times for all watched paths
   * @param watchPaths - Array of file/directory paths
   * @returns Map of path to mtime
   */
  private computeFileHashes(watchPaths: string[]): Map<string, number> {
    const hashes = new Map<string, number>();

    for (const path of watchPaths) {
      try {
        if (!existsSync(path)) {
          continue;
        }

        const stats = statSync(path);

        if (stats.isDirectory()) {
          // For directories, use directory mtime (detects file additions/deletions)
          hashes.set(path, stats.mtimeMs);

          // Also recursively scan for workflow session files
          this.scanDirectory(path, hashes);
        } else {
          // For files, use file mtime
          hashes.set(path, stats.mtimeMs);
        }
      } catch (err) {
        // Skip paths that can't be accessed
        console.warn(`Cannot access path ${path}:`, (err as Error).message);
      }
    }

    return hashes;
  }

  /**
   * Recursively scan directory for important files
   * @param dirPath - Directory to scan
   * @param hashes - Map to store file hashes
   * @param depth - Current recursion depth (max 3)
   */
  private scanDirectory(dirPath: string, hashes: Map<string, number>, depth: number = 0): void {
    if (depth > 3) return; // Limit recursion depth

    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Track important directories
          if (entry.name === '.task' || entry.name === '.review' || entry.name === '.summaries') {
            const stats = statSync(fullPath);
            hashes.set(fullPath, stats.mtimeMs);
            this.scanDirectory(fullPath, hashes, depth + 1);
          } else if (entry.name.startsWith('WFS-')) {
            // Scan WFS session directories
            const stats = statSync(fullPath);
            hashes.set(fullPath, stats.mtimeMs);
            this.scanDirectory(fullPath, hashes, depth + 1);
          }
        } else if (entry.isFile()) {
          // Track important files
          if (
            entry.name.endsWith('.json') ||
            entry.name === 'IMPL_PLAN.md' ||
            entry.name === 'TODO_LIST.md' ||
            entry.name === 'workflow-session.json'
          ) {
            const stats = statSync(fullPath);
            hashes.set(fullPath, stats.mtimeMs);
          }
        }
      }
    } catch (err) {
      // Skip directories that can't be read
      console.warn(`Cannot scan directory ${dirPath}:`, (err as Error).message);
    }
  }

  /**
   * Compare two file hash maps
   * @param oldHashes - Previous hashes
   * @param newHashes - Current hashes
   * @returns True if hashes match (no changes)
   */
  private hashesMatch(oldHashes: Map<string, number>, newHashes: Map<string, number>): boolean {
    // Check if any files were added or removed
    if (oldHashes.size !== newHashes.size) {
      return false;
    }

    // Check if any file mtimes changed
    const entries = Array.from(oldHashes.entries());
    for (let i = 0; i < entries.length; i++) {
      const path = entries[i][0];
      const oldMtime = entries[i][1];
      const newMtime = newHashes.get(path);
      if (newMtime === undefined || newMtime !== oldMtime) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get cache statistics
   * @returns Cache info object
   */
  getStats(): { exists: boolean; age?: number; fileCount?: number; size?: number } {
    if (!existsSync(this.cacheFile)) {
      return { exists: false };
    }

    try {
      const stats = statSync(this.cacheFile);
      const content = readFileSync(this.cacheFile, 'utf8');
      const entry = JSON.parse(content);

      return {
        exists: true,
        age: Date.now() - entry.timestamp,
        fileCount: Object.keys(entry.fileHashes || {}).length,
        size: stats.size
      };
    } catch {
      return { exists: false };
    }
  }
}

/**
 * Extract project path from workflow directory
 * @param workflowDir - Path to .workflow directory (e.g., /project/.workflow)
 * @returns Project root path
 */
function extractProjectPath(workflowDir: string): string {
  // workflowDir is typically {projectPath}/.workflow
  return workflowDir.replace(/[\/\\]\.workflow$/, '') || workflowDir;
}

/**
 * Create a cache manager for dashboard data
 * @param workflowDir - Path to .workflow directory
 * @param ttl - Optional TTL in milliseconds
 * @returns CacheManager instance
 */
export function createDashboardCache(workflowDir: string, ttl?: number): CacheManager<any> {
  // Use centralized storage path
  const projectPath = extractProjectPath(workflowDir);
  const cacheDir = StoragePaths.project(projectPath).cache;
  ensureStorageDir(cacheDir);
  return new CacheManager('dashboard-data', { cacheDir, ttl });
}
