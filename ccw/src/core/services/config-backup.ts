/**
 * Config Backup Service
 * Handles backup of local configuration files (.claude, .codex, .gemini, .qwen)
 */

import { mkdir, readdir, stat, copyFile, rm, access } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

export interface BackupOptions {
  /** Configuration directories to backup (default: ['.claude']) */
  configDirs?: string[];
  /** Custom backup name (default: auto-generated timestamp) */
  backupName?: string;
}

export interface BackupResult {
  success: boolean;
  backupPath?: string;
  fileCount: number;
  error?: string;
}

export interface BackupInfo {
  name: string;
  path: string;
  createdAt: Date;
  fileCount: number;
}

export class ConfigBackupService {
  private ccwDir: string;
  private backupDir: string;

  constructor() {
    this.ccwDir = join(homedir(), '.ccw');
    this.backupDir = join(this.ccwDir, 'backups');
  }

  /**
   * Create a backup of configuration directories
   * @param options - Backup options
   * @returns Backup result with path and file count
   */
  async createBackup(options: BackupOptions = {}): Promise<BackupResult> {
    const { configDirs = ['.claude'], backupName } = options;

    try {
      // Create backup directory
      await mkdir(this.backupDir, { recursive: true });

      // Generate backup name
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const backupNameFinal = backupName || `backup-${timestamp}`;
      const backupPath = join(this.backupDir, backupNameFinal);

      await mkdir(backupPath, { recursive: true });

      let fileCount = 0;

      // Backup each config directory
      for (const configDir of configDirs) {
        const sourcePath = join(this.ccwDir, configDir);
        const targetPath = join(backupPath, configDir);

        // Check if source exists
        try {
          await access(sourcePath);
        } catch {
          continue; // Skip if doesn't exist
        }

        // Copy directory recursively
        await this.copyDirectory(sourcePath, targetPath);

        // Count files
        const files = await this.countFiles(targetPath);
        fileCount += files;
      }

      return {
        success: true,
        backupPath,
        fileCount
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: (error as Error).message,
        fileCount: 0
      };
    }
  }

  /**
   * List all available backups
   * @returns Array of backup information sorted by creation date (newest first)
   */
  async listBackups(): Promise<BackupInfo[]> {
    try {
      const entries = await readdir(this.backupDir, { withFileTypes: true });
      const backups: BackupInfo[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const backupPath = join(this.backupDir, entry.name);
          const stats = await stat(backupPath);
          const fileCount = await this.countFiles(backupPath);

          backups.push({
            name: entry.name,
            path: backupPath,
            createdAt: stats.mtime,
            fileCount
          });
        }
      }

      return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch {
      return [];
    }
  }

  /**
   * Delete a specific backup
   * @param backupName - Name of the backup to delete
   * @returns Success status
   */
  async deleteBackup(backupName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const backupPath = join(this.backupDir, backupName);
      await rm(backupPath, { recursive: true, force: true });
      return { success: true };
    } catch (error: unknown) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Restore a backup to the original location
   * @param backupName - Name of the backup to restore
   * @returns Success status
   */
  async restoreBackup(backupName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const backupPath = join(this.backupDir, backupName);
      const entries = await readdir(backupPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const sourcePath = join(backupPath, entry.name);
          const targetPath = join(this.ccwDir, entry.name);

          // Copy directory back to original location
          await this.copyDirectory(sourcePath, targetPath);
        }
      }

      return { success: true };
    } catch (error: unknown) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Copy directory recursively
   * @param src - Source directory path
   * @param dest - Destination directory path
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    await mkdir(dest, { recursive: true });
    const entries = await readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * Count files in a directory recursively
   * @param dir - Directory path
   * @returns Number of files
   */
  private async countFiles(dir: string): Promise<number> {
    let count = 0;
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        count += await this.countFiles(join(dir, entry.name));
      } else {
        count++;
      }
    }

    return count;
  }
}
