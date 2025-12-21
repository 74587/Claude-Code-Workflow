/**
 * Centralized Path Validation Utility
 *
 * Provides secure path validation and resolution for MCP tools.
 * Prevents path traversal attacks and ensures operations stay within allowed directories.
 *
 * Inspired by MCP filesystem server's security model.
 */

import { resolve, isAbsolute, normalize, relative } from 'path';
import { realpath, access } from 'fs/promises';
import { constants } from 'fs';

// Environment variable configuration
const ENV_PROJECT_ROOT = 'CCW_PROJECT_ROOT';
const ENV_ALLOWED_DIRS = 'CCW_ALLOWED_DIRS';

/**
 * Get project root directory
 * Priority: CCW_PROJECT_ROOT > process.cwd()
 */
export function getProjectRoot(): string {
  return process.env[ENV_PROJECT_ROOT] || process.cwd();
}

/**
 * Get allowed directories list
 * Priority: CCW_ALLOWED_DIRS > [getProjectRoot()]
 */
export function getAllowedDirectories(): string[] {
  const envDirs = process.env[ENV_ALLOWED_DIRS];
  if (envDirs) {
    return envDirs.split(',').map(d => d.trim()).filter(Boolean);
  }
  return [getProjectRoot()];
}

/**
 * Normalize path (unify separators to forward slash)
 */
export function normalizePath(p: string): string {
  return normalize(p).replace(/\\/g, '/');
}

/**
 * Check if path is within allowed directories
 */
export function isPathWithinAllowedDirectories(
  targetPath: string,
  allowedDirectories: string[]
): boolean {
  const normalizedTarget = normalizePath(targetPath);
  return allowedDirectories.some(dir => {
    const normalizedDir = normalizePath(dir);
    // Check if path equals or starts with allowed directory
    return normalizedTarget === normalizedDir ||
           normalizedTarget.startsWith(normalizedDir + '/');
  });
}

/**
 * Validate and resolve path (core function)
 *
 * Security model:
 * 1. Resolve to absolute path
 * 2. Check against allowed directories
 * 3. Resolve symlinks and re-verify
 *
 * @param filePath - Path to validate
 * @param options - Validation options
 * @returns Validated absolute path
 * @throws Error if path is outside allowed directories or validation fails
 */
export async function validatePath(
  filePath: string,
  options: {
    allowedDirectories?: string[];
    mustExist?: boolean;
  } = {}
): Promise<string> {
  const allowedDirs = options.allowedDirectories || getAllowedDirectories();

  // 1. Resolve to absolute path
  const absolutePath = isAbsolute(filePath)
    ? filePath
    : resolve(getProjectRoot(), filePath);
  const normalizedPath = normalizePath(absolutePath);

  // 2. Initial sandbox check
  if (!isPathWithinAllowedDirectories(normalizedPath, allowedDirs)) {
    throw new Error(
      `Access denied: path "${normalizedPath}" is outside allowed directories. ` +
      `Allowed: [${allowedDirs.join(', ')}]`
    );
  }

  // 3. Try to resolve symlinks and re-verify
  try {
    const realPath = await realpath(absolutePath);
    const normalizedReal = normalizePath(realPath);

    if (!isPathWithinAllowedDirectories(normalizedReal, allowedDirs)) {
      throw new Error(
        `Access denied: symlink target "${normalizedReal}" is outside allowed directories`
      );
    }

    return normalizedReal;
  } catch (error: any) {
    // File doesn't exist - validate parent directory
    if (error.code === 'ENOENT') {
      if (options.mustExist) {
        throw new Error(`File not found: ${absolutePath}`);
      }

      // Validate parent directory's real path
      const parentDir = resolve(absolutePath, '..');
      try {
        const realParent = await realpath(parentDir);
        const normalizedParent = normalizePath(realParent);

        if (!isPathWithinAllowedDirectories(normalizedParent, allowedDirs)) {
          throw new Error(
            `Access denied: parent directory "${normalizedParent}" is outside allowed directories`
          );
        }
      } catch (parentError: any) {
        if (parentError.code === 'ENOENT') {
          // Parent directory doesn't exist either - return original absolute path
          // Let the caller create it if needed
          return absolutePath;
        }
        throw parentError;
      }

      return absolutePath;
    }

    // Re-throw access denied errors
    if (error.message?.includes('Access denied')) {
      throw error;
    }
    throw error;
  }
}

/**
 * Resolve project-relative path (simplified, no strict validation)
 * Use for cases where strict security validation is not needed
 */
export function resolveProjectPath(...pathSegments: string[]): string {
  return resolve(getProjectRoot(), ...pathSegments);
}
