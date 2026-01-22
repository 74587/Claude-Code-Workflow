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

/**
 * Get the CodexLens virtual environment path.
 *
 * @returns Path to CodexLens venv directory
 */
export function getCodexLensVenvDir(): string {
  return join(getCodexLensDataDir(), 'venv');
}

/**
 * Get the Python executable path in the CodexLens venv.
 *
 * @returns Path to python executable
 */
export function getCodexLensPython(): string {
  const venvDir = getCodexLensVenvDir();
  return process.platform === 'win32'
    ? join(venvDir, 'Scripts', 'python.exe')
    : join(venvDir, 'bin', 'python');
}

/**
 * Get the pip executable path in the CodexLens venv.
 *
 * @returns Path to pip executable
 */
export function getCodexLensPip(): string {
  const venvDir = getCodexLensVenvDir();
  return process.platform === 'win32'
    ? join(venvDir, 'Scripts', 'pip.exe')
    : join(venvDir, 'bin', 'pip');
}
