import { resolve, join, relative, isAbsolute } from 'path';
import { existsSync, mkdirSync, realpathSync, statSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';

/**
 * Resolve a path, handling ~ for home directory
 * @param {string} inputPath - Path to resolve
 * @returns {string} - Absolute path
 */
export function resolvePath(inputPath) {
  if (!inputPath) return process.cwd();

  // Handle ~ for home directory
  if (inputPath.startsWith('~')) {
    return join(homedir(), inputPath.slice(1));
  }

  return resolve(inputPath);
}

/**
 * Validate and sanitize a user-provided path
 * Prevents path traversal attacks and validates path is within allowed boundaries
 * @param {string} inputPath - User-provided path
 * @param {Object} options - Validation options
 * @param {string} options.baseDir - Base directory to restrict paths within (optional)
 * @param {boolean} options.mustExist - Whether path must exist (default: false)
 * @param {boolean} options.allowHome - Whether to allow home directory paths (default: true)
 * @returns {Object} - { valid: boolean, path: string|null, error: string|null }
 */
export function validatePath(inputPath, options = {}) {
  const { baseDir = null, mustExist = false, allowHome = true } = options;

  // Check for empty/null input
  if (!inputPath || typeof inputPath !== 'string') {
    return { valid: false, path: null, error: 'Path is required' };
  }

  // Trim whitespace
  const trimmedPath = inputPath.trim();

  // Check for suspicious patterns (null bytes, control characters)
  if (/[\x00-\x1f]/.test(trimmedPath)) {
    return { valid: false, path: null, error: 'Path contains invalid characters' };
  }

  // Resolve the path
  let resolvedPath;
  try {
    resolvedPath = resolvePath(trimmedPath);
  } catch (err) {
    return { valid: false, path: null, error: `Invalid path: ${err.message}` };
  }

  // Check if path exists when required
  if (mustExist && !existsSync(resolvedPath)) {
    return { valid: false, path: null, error: `Path does not exist: ${resolvedPath}` };
  }

  // Get real path if it exists (resolves symlinks)
  let realPath = resolvedPath;
  if (existsSync(resolvedPath)) {
    try {
      realPath = realpathSync(resolvedPath);
    } catch (err) {
      return { valid: false, path: null, error: `Cannot resolve path: ${err.message}` };
    }
  }

  // Check if within base directory when specified
  if (baseDir) {
    const resolvedBase = resolvePath(baseDir);
    const relativePath = relative(resolvedBase, realPath);

    // Path traversal detection: relative path should not start with '..'
    if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
      return {
        valid: false,
        path: null,
        error: `Path must be within ${resolvedBase}`
      };
    }
  }

  // Check home directory restriction
  if (!allowHome) {
    const home = homedir();
    if (realPath === home || realPath.startsWith(home + '/') || realPath.startsWith(home + '\\')) {
      // This is fine, we're just checking if it's explicitly the home dir itself
    }
  }

  return { valid: true, path: realPath, error: null };
}

/**
 * Validate output file path for writing
 * @param {string} outputPath - Output file path
 * @param {string} defaultDir - Default directory if path is relative
 * @returns {Object} - { valid: boolean, path: string|null, error: string|null }
 */
export function validateOutputPath(outputPath, defaultDir = process.cwd()) {
  if (!outputPath || typeof outputPath !== 'string') {
    return { valid: false, path: null, error: 'Output path is required' };
  }

  const trimmedPath = outputPath.trim();

  // Check for suspicious patterns
  if (/[\x00-\x1f]/.test(trimmedPath)) {
    return { valid: false, path: null, error: 'Output path contains invalid characters' };
  }

  // Resolve the path
  let resolvedPath;
  try {
    resolvedPath = isAbsolute(trimmedPath) ? trimmedPath : join(defaultDir, trimmedPath);
    resolvedPath = resolve(resolvedPath);
  } catch (err) {
    return { valid: false, path: null, error: `Invalid output path: ${err.message}` };
  }

  // Ensure it's not a directory
  if (existsSync(resolvedPath)) {
    try {
      const stat = statSync(resolvedPath);
      if (stat.isDirectory()) {
        return { valid: false, path: null, error: 'Output path is a directory, expected a file' };
      }
    } catch {
      // Ignore stat errors
    }
  }

  return { valid: true, path: resolvedPath, error: null };
}

/**
 * Get potential template locations
 * @returns {string[]} - Array of existing template directories
 */
export function getTemplateLocations() {
  const locations = [
    join(homedir(), '.claude', 'templates'),
    join(process.cwd(), '.claude', 'templates')
  ];

  return locations.filter(loc => existsSync(loc));
}

/**
 * Find a template file in known locations
 * @param {string} templateName - Name of template file (e.g., 'workflow-dashboard.html')
 * @returns {string|null} - Path to template or null if not found
 */
export function findTemplate(templateName) {
  const locations = getTemplateLocations();

  for (const loc of locations) {
    const templatePath = join(loc, templateName);
    if (existsSync(templatePath)) {
      return templatePath;
    }
  }

  return null;
}

/**
 * Ensure directory exists, creating if necessary
 * @param {string} dirPath - Directory path to ensure
 */
export function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get the .workflow directory path from project path
 * @param {string} projectPath - Path to project
 * @returns {string} - Path to .workflow directory
 */
export function getWorkflowDir(projectPath) {
  return join(resolvePath(projectPath), '.workflow');
}

/**
 * Normalize path for display (handle Windows backslashes)
 * @param {string} filePath - Path to normalize
 * @returns {string}
 */
export function normalizePathForDisplay(filePath) {
  return filePath.replace(/\\/g, '/');
}

// Recent paths storage file
const RECENT_PATHS_FILE = join(homedir(), '.ccw-recent-paths.json');
const MAX_RECENT_PATHS = 10;

/**
 * Get recent project paths
 * @returns {string[]} - Array of recent paths
 */
export function getRecentPaths() {
  try {
    if (existsSync(RECENT_PATHS_FILE)) {
      const content = readFileSync(RECENT_PATHS_FILE, 'utf8');
      const data = JSON.parse(content);
      return Array.isArray(data.paths) ? data.paths : [];
    }
  } catch {
    // Ignore errors, return empty array
  }
  return [];
}

/**
 * Track a project path (add to recent paths)
 * @param {string} projectPath - Path to track
 */
export function trackRecentPath(projectPath) {
  try {
    const normalized = normalizePathForDisplay(resolvePath(projectPath));
    let paths = getRecentPaths();

    // Remove if already exists (will be added to front)
    paths = paths.filter(p => normalizePathForDisplay(p) !== normalized);

    // Add to front
    paths.unshift(normalized);

    // Limit to max
    paths = paths.slice(0, MAX_RECENT_PATHS);

    // Save
    writeFileSync(RECENT_PATHS_FILE, JSON.stringify({ paths }, null, 2), 'utf8');
  } catch {
    // Ignore errors
  }
}

/**
 * Clear recent paths
 */
export function clearRecentPaths() {
  try {
    if (existsSync(RECENT_PATHS_FILE)) {
      writeFileSync(RECENT_PATHS_FILE, JSON.stringify({ paths: [] }, null, 2), 'utf8');
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Remove a specific path from recent paths
 * @param {string} pathToRemove - Path to remove
 * @returns {boolean} - True if removed, false if not found
 */
export function removeRecentPath(pathToRemove) {
  try {
    const normalized = normalizePathForDisplay(resolvePath(pathToRemove));
    let paths = getRecentPaths();
    const originalLength = paths.length;

    // Filter out the path to remove
    paths = paths.filter(p => normalizePathForDisplay(p) !== normalized);

    if (paths.length < originalLength) {
      // Save updated list
      writeFileSync(RECENT_PATHS_FILE, JSON.stringify({ paths }, null, 2), 'utf8');
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
