/**
 * CodexLens Path Utilities
 *
 * Provides centralized path resolution for CodexLens data directory,
 * respecting the CODEXLENS_DATA_DIR environment variable.
 *
 * Priority order (matching Python implementation):
 * 1. CODEXLENS_DATA_DIR environment variable
 * 2. Default: ~/.codexlens
 */

import { join } from 'path';
import { homedir } from 'os';

/**
 * Get the CodexLens data directory.
 * Respects CODEXLENS_DATA_DIR environment variable.
 *
 * @returns Path to CodexLens data directory
 */
export function getCodexLensDataDir(): string {
  const envOverride = process.env.CODEXLENS_DATA_DIR;
  if (envOverride) {
    return envOverride;
  }
  return join(homedir(), '.codexlens');
}
