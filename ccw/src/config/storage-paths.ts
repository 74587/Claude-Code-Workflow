/**
 * Centralized Storage Paths Configuration
 * Single source of truth for all CCW storage locations
 *
 * All data is stored under ~/.ccw/ with project isolation via SHA256 hash
 */

import { homedir } from 'os';
import { join, resolve } from 'path';
import { createHash } from 'crypto';
import { existsSync, mkdirSync } from 'fs';

// Environment variable override for custom storage location
const CCW_DATA_DIR = process.env.CCW_DATA_DIR;

// Base CCW home directory
export const CCW_HOME = CCW_DATA_DIR || join(homedir(), '.ccw');

/**
 * Calculate project identifier from project path
 * Uses SHA256 hash truncated to 16 chars for uniqueness + readability
 * @param projectPath - Absolute or relative project path
 * @returns 16-character hex string project ID
 */
export function getProjectId(projectPath: string): string {
  const absolutePath = resolve(projectPath);
  const hash = createHash('sha256').update(absolutePath).digest('hex');
  return hash.substring(0, 16);
}

/**
 * Ensure a directory exists, creating it if necessary
 * @param dirPath - Directory path to ensure
 */
export function ensureStorageDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Global storage paths (not project-specific)
 */
export const GlobalPaths = {
  /** Root CCW home directory */
  root: () => CCW_HOME,

  /** Config directory */
  config: () => join(CCW_HOME, 'config'),

  /** Global settings file */
  settings: () => join(CCW_HOME, 'config', 'settings.json'),

  /** Recent project paths file */
  recentPaths: () => join(CCW_HOME, 'config', 'recent-paths.json'),

  /** Databases directory */
  databases: () => join(CCW_HOME, 'db'),

  /** MCP templates database */
  mcpTemplates: () => join(CCW_HOME, 'db', 'mcp-templates.db'),

  /** Logs directory */
  logs: () => join(CCW_HOME, 'logs'),
};

/**
 * Project-specific storage paths
 */
export interface ProjectPaths {
  /** Project root in CCW storage */
  root: string;
  /** CLI history directory */
  cliHistory: string;
  /** CLI history database file */
  historyDb: string;
  /** Memory store directory */
  memory: string;
  /** Memory store database file */
  memoryDb: string;
  /** Cache directory */
  cache: string;
  /** Dashboard cache file */
  dashboardCache: string;
  /** Config directory */
  config: string;
  /** CLI config file */
  cliConfig: string;
}

/**
 * Get storage paths for a specific project
 * @param projectPath - Project root path
 * @returns Object with all project-specific paths
 */
export function getProjectPaths(projectPath: string): ProjectPaths {
  const projectId = getProjectId(projectPath);
  const projectDir = join(CCW_HOME, 'projects', projectId);

  return {
    root: projectDir,
    cliHistory: join(projectDir, 'cli-history'),
    historyDb: join(projectDir, 'cli-history', 'history.db'),
    memory: join(projectDir, 'memory'),
    memoryDb: join(projectDir, 'memory', 'memory.db'),
    cache: join(projectDir, 'cache'),
    dashboardCache: join(projectDir, 'cache', 'dashboard-data.json'),
    config: join(projectDir, 'config'),
    cliConfig: join(projectDir, 'config', 'cli-config.json'),
  };
}

/**
 * Unified StoragePaths object combining global and project paths
 */
export const StoragePaths = {
  global: GlobalPaths,
  project: getProjectPaths,
};

/**
 * Legacy storage paths (for backward compatibility detection)
 */
export const LegacyPaths = {
  /** Old recent paths file location */
  recentPaths: () => join(homedir(), '.ccw-recent-paths.json'),

  /** Old project-local CLI history */
  cliHistory: (projectPath: string) => join(projectPath, '.workflow', '.cli-history'),

  /** Old project-local memory store */
  memory: (projectPath: string) => join(projectPath, '.workflow', '.memory'),

  /** Old project-local cache */
  cache: (projectPath: string) => join(projectPath, '.workflow', '.ccw-cache'),

  /** Old project-local CLI config */
  cliConfig: (projectPath: string) => join(projectPath, '.workflow', 'cli-config.json'),
};

/**
 * Check if legacy storage exists for a project
 * Useful for migration warnings or detection
 * @param projectPath - Project root path
 * @returns true if any legacy storage is present
 */
export function isLegacyStoragePresent(projectPath: string): boolean {
  return (
    existsSync(LegacyPaths.cliHistory(projectPath)) ||
    existsSync(LegacyPaths.memory(projectPath)) ||
    existsSync(LegacyPaths.cache(projectPath)) ||
    existsSync(LegacyPaths.cliConfig(projectPath))
  );
}

/**
 * Get CCW home directory (for external use)
 */
export function getCcwHome(): string {
  return CCW_HOME;
}

/**
 * Initialize global storage directories
 * Creates the base directory structure if not present
 */
export function initializeGlobalStorage(): void {
  ensureStorageDir(GlobalPaths.config());
  ensureStorageDir(GlobalPaths.databases());
  ensureStorageDir(GlobalPaths.logs());
}

/**
 * Initialize project storage directories
 * @param projectPath - Project root path
 */
export function initializeProjectStorage(projectPath: string): void {
  const paths = getProjectPaths(projectPath);
  ensureStorageDir(paths.cliHistory);
  ensureStorageDir(paths.memory);
  ensureStorageDir(paths.cache);
  ensureStorageDir(paths.config);
}
