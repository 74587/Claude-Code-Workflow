/**
 * Security utilities for input validation
 * Provides validation functions to prevent common security vulnerabilities
 */

/**
 * Valid config directory names (whitelist approach)
 */
export const VALID_CONFIG_DIRS = ['.claude', '.codex', '.gemini', '.qwen'] as const;

/**
 * Valid config directory name type
 */
export type ValidConfigDir = typeof VALID_CONFIG_DIRS[number];

/**
 * Check if a string is a valid config directory name
 * Uses whitelist approach for security
 */
export function isValidConfigDirName(name: string): boolean {
  // Type guard to ensure name is a string
  if (typeof name !== 'string') return false;

  // Must start with dot
  if (!name.startsWith('.')) return false;

  // Must be in whitelist
  return VALID_CONFIG_DIRS.includes(name as any);
}

/**
 * Check if a string is a valid backup name
 * Prevents path traversal attacks
 */
export function isValidBackupName(name: string): boolean {
  // Type guard
  if (typeof name !== 'string') return false;

  // Prevent path traversal
  if (name.includes('..')) return false;
  if (name.includes('/') || name.includes('\\')) return false;

  // Prevent null bytes
  if (name.includes('\0')) return false;

  // Only allow alphanumeric, hyphen, underscore, dot
  const regex = /^[a-zA-Z0-9._-]+$/;
  return regex.test(name) && name.length > 0 && name.length <= 100;
}

/**
 * Check if a string is a valid GitHub repository identifier
 * GitHub repo rules: max 100 chars, alphanumeric, hyphen, underscore, dot
 * Cannot start or end with hyphen
 */
export function isValidGitHubIdentifier(name: string): boolean {
  // Type guard
  if (typeof name !== 'string') return false;

  // Length limit
  if (name.length === 0 || name.length > 100) return false;

  // Cannot start or end with hyphen
  if (name.startsWith('-') || name.endsWith('-')) return false;

  // Only allowed characters
  const regex = /^[a-zA-Z0-9._-]+$/;
  return regex.test(name);
}

/**
 * Check if a string is a valid Git branch name
 * Git branch rules: cannot begin with a dot, cannot contain .. or ~, cannot end with .lock
 */
export function isValidBranchName(name: string): boolean {
  // Type guard
  if (typeof name !== 'string') return false;

  // Cannot be empty
  if (name.length === 0) return false;

  // Cannot begin with a dot
  if (name.startsWith('.')) return false;

  // Cannot contain .. or ~ or :
  if (name.includes('..') || name.includes('~') || name.includes(':')) return false;

  // Cannot end with .lock
  if (name.endsWith('.lock')) return false;

  // Only allow safe characters (alphanumeric, hyphen, underscore, dot, slash)
  const regex = /^[a-zA-Z0-9_./-]+$/;
  return regex.test(name);
}

/**
 * Validate an array of config directory names
 * Throws error if any invalid
 */
export function validateConfigDirs(dirs: string[]): void {
  if (!Array.isArray(dirs)) {
    throw new Error('configDirs must be an array');
  }

  for (const dir of dirs) {
    if (!isValidConfigDirName(dir)) {
      throw new Error(
        `Invalid config directory: "${dir}". ` +
        `Valid options are: ${VALID_CONFIG_DIRS.join(', ')}`
      );
    }
  }
}

/**
 * Validate GitHub sync parameters
 * Throws error if any invalid
 */
export function validateGitHubParams(params: {
  owner?: string;
  repo?: string;
  branch?: string;
}): void {
  const { owner, repo, branch } = params;

  if (owner !== undefined && !isValidGitHubIdentifier(owner)) {
    throw new Error(`Invalid GitHub owner identifier: "${owner}"`);
  }

  if (repo !== undefined && !isValidGitHubIdentifier(repo)) {
    throw new Error(`Invalid GitHub repository name: "${repo}"`);
  }

  if (branch !== undefined && !isValidBranchName(branch)) {
    throw new Error(`Invalid branch name: "${branch}"`);
  }
}
