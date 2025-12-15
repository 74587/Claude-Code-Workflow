/**
 * Storage Manager - Centralized storage management for CCW
 * Provides info, cleanup, and configuration for ~/.ccw/ storage
 */

import { existsSync, readdirSync, statSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { createRequire } from 'module';
import { StoragePaths, CCW_HOME, getProjectId } from '../config/storage-paths.js';

// Create require for loading CJS modules in ESM context
const require = createRequire(import.meta.url);

/**
 * Storage statistics for a single project
 */
export interface ProjectStorageStats {
  projectId: string;
  totalSize: number;
  cliHistory: { exists: boolean; size: number; recordCount?: number };
  memory: { exists: boolean; size: number };
  cache: { exists: boolean; size: number };
  config: { exists: boolean; size: number };
  lastModified: Date | null;
}

/**
 * Global storage statistics
 */
export interface StorageStats {
  rootPath: string;
  totalSize: number;
  globalDb: { exists: boolean; size: number };
  projects: ProjectStorageStats[];
  projectCount: number;
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  dataDir: string;
  isCustom: boolean;
  envVar: string | undefined;
}

/**
 * Calculate directory size recursively
 */
function getDirSize(dirPath: string): number {
  if (!existsSync(dirPath)) return 0;

  let totalSize = 0;
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        totalSize += getDirSize(fullPath);
      } else {
        try {
          totalSize += statSync(fullPath).size;
        } catch {
          // Skip files we can't read
        }
      }
    }
  } catch {
    // Skip directories we can't read
  }
  return totalSize;
}

/**
 * Get file size safely
 */
function getFileSize(filePath: string): number {
  try {
    return existsSync(filePath) ? statSync(filePath).size : 0;
  } catch {
    return 0;
  }
}

/**
 * Get latest modification time in a directory
 */
function getLatestModTime(dirPath: string): Date | null {
  if (!existsSync(dirPath)) return null;

  let latest: Date | null = null;
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      try {
        const stat = statSync(fullPath);
        const mtime = stat.mtime;
        if (!latest || mtime > latest) {
          latest = mtime;
        }
        if (entry.isDirectory()) {
          const subLatest = getLatestModTime(fullPath);
          if (subLatest && (!latest || subLatest > latest)) {
            latest = subLatest;
          }
        }
      } catch {
        // Skip files we can't read
      }
    }
  } catch {
    // Skip directories we can't read
  }
  return latest;
}

/**
 * Get record count from SQLite database
 */
function getDbRecordCount(dbPath: string, tableName: string): number {
  if (!existsSync(dbPath)) return 0;
  try {
    // Dynamic import to handle ESM module
    const Database = require('better-sqlite3');
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const stmt = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`);
    const result = stmt.get() as { count: number };
    db.close();
    return result?.count ?? 0;
  } catch (err) {
    // Debug: enable to see actual error
    if (process.env.DEBUG) console.error(`[Storage] Failed to get record count from ${dbPath}: ${err}`);
    return 0;
  }
}

/**
 * Check if a directory is a project data directory
 * A project data directory contains at least one of: cli-history, memory, cache, config
 */
function isProjectDataDirectory(dirPath: string): boolean {
  const dataMarkers = ['cli-history', 'memory', 'cache', 'config'];
  return dataMarkers.some(marker => existsSync(join(dirPath, marker)));
}

/**
 * Get storage statistics for a specific project by path
 * @param projectId - Project ID (can be hierarchical like "parent/child")
 * @param projectDir - Actual directory path in storage
 */
function getProjectStats(projectId: string, projectDir: string): ProjectStorageStats {
  const cliHistoryDir = join(projectDir, 'cli-history');
  const memoryDir = join(projectDir, 'memory');
  const cacheDir = join(projectDir, 'cache');
  const configDir = join(projectDir, 'config');

  const cliHistorySize = getDirSize(cliHistoryDir);
  const memorySize = getDirSize(memoryDir);
  const cacheSize = getDirSize(cacheDir);
  const configSize = getDirSize(configDir);

  let recordCount: number | undefined;
  const historyDb = join(cliHistoryDir, 'history.db');
  if (existsSync(historyDb)) {
    recordCount = getDbRecordCount(historyDb, 'conversations');
  }

  return {
    projectId,
    totalSize: cliHistorySize + memorySize + cacheSize + configSize,
    cliHistory: {
      exists: existsSync(cliHistoryDir),
      size: cliHistorySize,
      recordCount
    },
    memory: {
      exists: existsSync(memoryDir),
      size: memorySize
    },
    cache: {
      exists: existsSync(cacheDir),
      size: cacheSize
    },
    config: {
      exists: existsSync(configDir),
      size: configSize
    },
    lastModified: getLatestModTime(projectDir)
  };
}

/**
 * Get storage statistics for a specific project by ID (legacy)
 */
export function getProjectStorageStats(projectId: string): ProjectStorageStats {
  const paths = StoragePaths.projectById(projectId);
  return getProjectStats(projectId, paths.root);
}

/**
 * Recursively scan project directory for hierarchical structure
 * @param basePath - Base directory to scan
 * @param relativePath - Relative path from projects root
 * @param results - Array to accumulate results
 */
function scanProjectDirectory(
  basePath: string,
  relativePath: string,
  results: ProjectStorageStats[]
): void {
  if (!existsSync(basePath)) return;

  try {
    const entries = readdirSync(basePath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const fullPath = join(basePath, entry.name);
      const currentRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      // Check if this is a project data directory
      if (isProjectDataDirectory(fullPath)) {
        const projectId = currentRelPath;
        const stats = getProjectStats(projectId, fullPath);
        results.push(stats);
      }

      // Recursively scan subdirectories (excluding data directories)
      const dataDirs = ['cli-history', 'memory', 'cache', 'config'];
      if (!dataDirs.includes(entry.name)) {
        scanProjectDirectory(fullPath, currentRelPath, results);
      }
    }
  } catch (err) {
    // Ignore read errors
    if (process.env.DEBUG) console.error(`[Storage] Failed to scan ${basePath}: ${err}`);
  }
}

/**
 * Get all storage statistics
 * Supports hierarchical project structure
 */
export function getStorageStats(): StorageStats {
  const rootPath = CCW_HOME;
  const projectsDir = join(rootPath, 'projects');

  // Global database
  const mcpTemplatesPath = StoragePaths.global.mcpTemplates();
  const globalDbSize = getFileSize(mcpTemplatesPath);

  // Projects - use recursive scanning for hierarchical structure
  const projects: ProjectStorageStats[] = [];
  if (existsSync(projectsDir)) {
    scanProjectDirectory(projectsDir, '', projects);
  }

  // Sort by last modified (most recent first)
  projects.sort((a, b) => {
    if (!a.lastModified && !b.lastModified) return 0;
    if (!a.lastModified) return 1;
    if (!b.lastModified) return -1;
    return b.lastModified.getTime() - a.lastModified.getTime();
  });

  const totalProjectSize = projects.reduce((sum, p) => sum + p.totalSize, 0);

  return {
    rootPath,
    totalSize: globalDbSize + totalProjectSize,
    globalDb: {
      exists: existsSync(mcpTemplatesPath),
      size: globalDbSize
    },
    projects,
    projectCount: projects.length
  };
}

/**
 * Get current storage configuration
 */
export function getStorageConfig(): StorageConfig {
  const envVar = process.env.CCW_DATA_DIR;
  return {
    dataDir: CCW_HOME,
    isCustom: !!envVar,
    envVar
  };
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format date to relative time
 */
export function formatTimeAgo(date: Date | null): string {
  if (!date) return 'Never';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Clean storage for a specific project
 */
export function cleanProjectStorage(projectId: string, options: {
  cliHistory?: boolean;
  memory?: boolean;
  cache?: boolean;
  config?: boolean;
  all?: boolean;
} = { all: true }): { success: boolean; freedBytes: number; errors: string[] } {
  const paths = StoragePaths.projectById(projectId);
  let freedBytes = 0;
  const errors: string[] = [];

  const shouldClean = (type: keyof typeof options) => options.all || options[type];

  const cleanDir = (dirPath: string, name: string) => {
    if (existsSync(dirPath)) {
      try {
        const size = getDirSize(dirPath);
        rmSync(dirPath, { recursive: true, force: true });
        freedBytes += size;
      } catch (err) {
        errors.push(`Failed to clean ${name}: ${err}`);
      }
    }
  };

  if (shouldClean('cliHistory')) cleanDir(paths.cliHistory, 'CLI history');
  if (shouldClean('memory')) cleanDir(paths.memory, 'Memory store');
  if (shouldClean('cache')) cleanDir(paths.cache, 'Cache');
  if (shouldClean('config')) cleanDir(paths.config, 'Config');

  // Remove project directory if empty
  if (existsSync(paths.root)) {
    try {
      const remaining = readdirSync(paths.root);
      if (remaining.length === 0) {
        rmSync(paths.root, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  return { success: errors.length === 0, freedBytes, errors };
}

/**
 * Clean all storage
 */
export function cleanAllStorage(options: {
  cliHistory?: boolean;
  memory?: boolean;
  cache?: boolean;
  config?: boolean;
  globalDb?: boolean;
  all?: boolean;
} = { all: true }): { success: boolean; freedBytes: number; projectsCleaned: number; errors: string[] } {
  const stats = getStorageStats();
  let freedBytes = 0;
  let projectsCleaned = 0;
  const errors: string[] = [];

  // Clean projects
  for (const project of stats.projects) {
    const result = cleanProjectStorage(project.projectId, options);
    freedBytes += result.freedBytes;
    if (result.errors.length === 0) {
      projectsCleaned++;
    }
    errors.push(...result.errors);
  }

  // Clean global database if requested
  if (options.all || options.globalDb) {
    const mcpPath = StoragePaths.global.mcpTemplates();
    if (existsSync(mcpPath)) {
      try {
        const size = getFileSize(mcpPath);
        rmSync(mcpPath, { force: true });
        freedBytes += size;
      } catch (err) {
        errors.push(`Failed to clean global database: ${err}`);
      }
    }
  }

  return { success: errors.length === 0, freedBytes, projectsCleaned, errors };
}

/**
 * Get project ID from project path
 */
export function resolveProjectId(projectPath: string): string {
  return getProjectId(resolve(projectPath));
}

/**
 * Check if a project ID exists in storage
 */
export function projectExists(projectId: string): boolean {
  const paths = StoragePaths.projectById(projectId);
  return existsSync(paths.root);
}

/**
 * Get storage location instructions for changing it
 */
export function getStorageLocationInstructions(): string {
  return `
To change the CCW storage location, set the CCW_DATA_DIR environment variable:

  Windows (PowerShell):
    $env:CCW_DATA_DIR = "D:\\custom\\ccw-data"

  Windows (Command Prompt):
    set CCW_DATA_DIR=D:\\custom\\ccw-data

  Linux/macOS:
    export CCW_DATA_DIR="/custom/ccw-data"

  Permanent (add to shell profile):
    echo 'export CCW_DATA_DIR="/custom/ccw-data"' >> ~/.bashrc

Note: Existing data will NOT be migrated automatically.
To migrate, manually copy the contents of the old directory to the new location.

Current location: ${CCW_HOME}
`;
}
