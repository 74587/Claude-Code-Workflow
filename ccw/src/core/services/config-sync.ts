/**
 * Config Sync Service
 * Downloads configuration files from GitHub using remote-first conflict resolution
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
  validateConfigDirs,
  validateGitHubParams,
  VALID_CONFIG_DIRS,
  type ValidConfigDir
} from '../../utils/security-validation.js';

/**
 * Default GitHub repository configuration for remote config sync
 */
const DEFAULT_GITHUB_CONFIG = {
  owner: 'dyw0830',
  repo: 'ccw',
  branch: 'main',
};

/**
 * Default config directories to sync
 * Uses whitelist from security-validation
 */
const DEFAULT_CONFIG_DIRS: ValidConfigDir[] = ['.claude'];

/**
 * Common configuration files to sync from each config directory
 */
const COMMON_CONFIG_FILES = [
  'settings.json',
  'config.json',
  'CLAUDE.md',
  'cli-tools.json',
  'guidelines.json',
  'prompts.json',
];

/**
 * Sync result interface
 */
export interface ConfigSyncResult {
  success: boolean;
  syncedFiles: string[];
  errors: string[];
  skippedFiles: string[];
}

/**
 * Config sync options interface
 */
export interface ConfigSyncOptions {
  /** GitHub repository owner (default: 'dyw0830') */
  owner?: string;
  /** GitHub repository name (default: 'ccw') */
  repo?: string;
  /** Git branch (default: 'main') */
  branch?: string;
  /** Config directories to sync (default: ['.claude']) */
  configDirs?: string[];
  /** Target base directory (default: ~/.ccw) */
  baseDir?: string;
  /** Remote-first: overwrite local files (default: true) */
  overwrite?: boolean;
}

/**
 * Config Sync Service
 * Downloads configuration files from GitHub with remote-first conflict resolution
 */
export class ConfigSyncService {
  /**
   * Sync configuration files from GitHub
   * @param options - Sync options
   * @returns Sync result with status, files synced, and any errors
   */
  async syncConfig(options: ConfigSyncOptions = {}): Promise<ConfigSyncResult> {
    const {
      owner = DEFAULT_GITHUB_CONFIG.owner,
      repo = DEFAULT_GITHUB_CONFIG.repo,
      branch = DEFAULT_GITHUB_CONFIG.branch,
      configDirs = DEFAULT_CONFIG_DIRS,
      baseDir = join(homedir(), '.ccw'),
      overwrite = true,
    } = options;

    // SECURITY: Validate all inputs before processing
    try {
      // Validate GitHub parameters (SSRF protection)
      validateGitHubParams({ owner, repo, branch });

      // Validate config directories (path traversal protection)
      validateConfigDirs(configDirs);
    } catch (error) {
      return {
        success: false,
        syncedFiles: [],
        errors: [error instanceof Error ? error.message : String(error)],
        skippedFiles: [],
      };
    }

    const results: ConfigSyncResult = {
      success: true,
      syncedFiles: [],
      errors: [],
      skippedFiles: [],
    };

    for (const configDir of configDirs) {
      try {
        const dirResult = await this.syncConfigDirectory(configDir, {
          owner,
          repo,
          branch,
          baseDir,
          overwrite,
        });

        results.syncedFiles.push(...dirResult.syncedFiles);
        results.errors.push(...dirResult.errors);
        results.skippedFiles.push(...dirResult.skippedFiles);

        if (!dirResult.success) {
          results.success = false;
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        results.errors.push(`${configDir}: ${message}`);
        results.success = false;
      }
    }

    return results;
  }

  /**
   * Sync a single config directory
   */
  private async syncConfigDirectory(
    configDir: string,
    options: {
      owner: string;
      repo: string;
      branch: string;
      baseDir: string;
      overwrite: boolean;
    }
  ): Promise<ConfigSyncResult> {
    const { owner, repo, branch, baseDir, overwrite } = options;
    const result: ConfigSyncResult = {
      success: true,
      syncedFiles: [],
      errors: [],
      skippedFiles: [],
    };

    const localPath = join(baseDir, configDir);
    const baseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${configDir}`;

    // Ensure local directory exists
    await fs.mkdir(localPath, { recursive: true });

    // Try to sync each common config file
    for (const file of COMMON_CONFIG_FILES) {
      const fileUrl = `${baseUrl}/${file}`;
      const localFilePath = join(localPath, file);

      try {
        // Check if remote file exists
        const response = await fetch(fileUrl);
        if (!response.ok) {
          // File doesn't exist on remote, skip
          continue;
        }

        const content = await response.text();

        // Check if local file exists
        const localExists = await this.fileExists(localFilePath);

        if (localExists && !overwrite) {
          result.skippedFiles.push(localFilePath);
          continue;
        }

        // Write remote content to local file (remote-first)
        await fs.writeFile(localFilePath, content, 'utf-8');
        result.syncedFiles.push(localFilePath);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`${file}: ${message}`);
        result.success = false;
      }
    }

    return result;
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List available config files from remote directory
   * @param configDir - Config directory name
   * @param options - GitHub options
   * @returns List of available files
   */
  async listRemoteFiles(
    configDir: string,
    options: Partial<Pick<ConfigSyncOptions, 'owner' | 'repo' | 'branch'>> = {}
  ): Promise<string[]> {
    const {
      owner = DEFAULT_GITHUB_CONFIG.owner,
      repo = DEFAULT_GITHUB_CONFIG.repo,
      branch = DEFAULT_GITHUB_CONFIG.branch,
    } = options;

    const baseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${configDir}`;
    const availableFiles: string[] = [];

    for (const file of COMMON_CONFIG_FILES) {
      try {
        const response = await fetch(`${baseUrl}/${file}`);
        if (response.ok) {
          availableFiles.push(file);
        }
      } catch {
        // File doesn't exist or network error, skip
      }
    }

    return availableFiles;
  }

  /**
   * Get sync status - compare local and remote files
   * @param options - Sync options
   * @returns Status comparison result
   */
  async getSyncStatus(options: ConfigSyncOptions = {}): Promise<{
    localOnly: string[];
    remoteOnly: string[];
    synced: string[];
  }> {
    const {
      owner = DEFAULT_GITHUB_CONFIG.owner,
      repo = DEFAULT_GITHUB_CONFIG.repo,
      branch = DEFAULT_GITHUB_CONFIG.branch,
      configDirs = DEFAULT_CONFIG_DIRS,
      baseDir = join(homedir(), '.ccw'),
    } = options;

    // SECURITY: Validate inputs
    try {
      validateGitHubParams({ owner, repo, branch });
      validateConfigDirs(configDirs);
    } catch (error) {
      throw error; // Re-throw validation errors
    }

    const status = {
      localOnly: [] as string[],
      remoteOnly: [] as string[],
      synced: [] as string[],
    };

    for (const configDir of configDirs) {
      const localPath = join(baseDir, configDir);
      const baseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${configDir}`;

      const remoteFiles = await this.listRemoteFiles(configDir, { owner, repo, branch });
      const localFiles = await this.listLocalFiles(localPath);

      for (const file of remoteFiles) {
        const localFilePath = join(localPath, file);
        if (localFiles.includes(file)) {
          status.synced.push(localFilePath);
        } else {
          status.remoteOnly.push(localFilePath);
        }
      }

      for (const file of localFiles) {
        if (!remoteFiles.includes(file)) {
          status.localOnly.push(join(localPath, file));
        }
      }
    }

    return status;
  }

  /**
   * List files in a local directory
   */
  private async listLocalFiles(dirPath: string): Promise<string[]> {
    try {
      const files = await fs.readdir(dirPath);
      return files.filter(file => COMMON_CONFIG_FILES.includes(file));
    } catch {
      return [];
    }
  }
}

/**
 * Get singleton instance of ConfigSyncService
 */
let configSyncServiceInstance: ConfigSyncService | null = null;

export function getConfigSyncService(): ConfigSyncService {
  if (!configSyncServiceInstance) {
    configSyncServiceInstance = new ConfigSyncService();
  }
  return configSyncServiceInstance;
}
