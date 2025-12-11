/**
 * Write File Tool - Create or overwrite files
 *
 * Features:
 * - Create new files or overwrite existing
 * - Auto-create parent directories
 * - Support for text content with proper encoding
 * - Optional backup before overwrite
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, renameSync } from 'fs';
import { resolve, isAbsolute, dirname, basename } from 'path';

/**
 * Ensure parent directory exists
 * @param {string} filePath - Path to file
 */
function ensureDir(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Create backup of existing file
 * @param {string} filePath - Path to file
 * @returns {string|null} - Backup path or null if no backup created
 */
function createBackup(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  const dir = dirname(filePath);
  const name = basename(filePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = resolve(dir, `.${name}.${timestamp}.bak`);

  try {
    const content = readFileSync(filePath);
    writeFileSync(backupPath, content);
    return backupPath;
  } catch (error) {
    throw new Error(`Failed to create backup: ${error.message}`);
  }
}

/**
 * Execute write file operation
 * @param {Object} params - Parameters
 * @returns {Promise<Object>} - Result
 */
async function execute(params) {
  const {
    path: filePath,
    content,
    createDirectories = true,
    backup = false,
    encoding = 'utf8'
  } = params;

  if (!filePath) {
    throw new Error('Parameter "path" is required');
  }

  if (content === undefined) {
    throw new Error('Parameter "content" is required');
  }

  // Resolve path
  const resolvedPath = isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath);
  const fileExists = existsSync(resolvedPath);

  // Create parent directories if needed
  if (createDirectories) {
    ensureDir(resolvedPath);
  } else if (!existsSync(dirname(resolvedPath))) {
    throw new Error(`Parent directory does not exist: ${dirname(resolvedPath)}`);
  }

  // Create backup if requested and file exists
  let backupPath = null;
  if (backup && fileExists) {
    backupPath = createBackup(resolvedPath);
  }

  // Write file
  try {
    writeFileSync(resolvedPath, content, { encoding });

    return {
      success: true,
      path: resolvedPath,
      created: !fileExists,
      overwritten: fileExists,
      backupPath,
      bytes: Buffer.byteLength(content, encoding),
      message: fileExists
        ? `Successfully overwrote ${filePath}${backupPath ? ` (backup: ${backupPath})` : ''}`
        : `Successfully created ${filePath}`
    };
  } catch (error) {
    throw new Error(`Failed to write file: ${error.message}`);
  }
}

/**
 * Write File Tool Definition
 */
export const writeFileTool = {
  name: 'write_file',
  description: `Create a new file or overwrite an existing file with content.

Features:
- Creates parent directories automatically (configurable)
- Optional backup before overwrite
- Supports text content with proper encoding

Use with caution as it will overwrite existing files without warning unless backup is enabled.`,
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to create or overwrite'
      },
      content: {
        type: 'string',
        description: 'Content to write to the file'
      },
      createDirectories: {
        type: 'boolean',
        description: 'Create parent directories if they do not exist (default: true)',
        default: true
      },
      backup: {
        type: 'boolean',
        description: 'Create backup of existing file before overwriting (default: false)',
        default: false
      },
      encoding: {
        type: 'string',
        description: 'File encoding (default: utf8)',
        default: 'utf8',
        enum: ['utf8', 'utf-8', 'ascii', 'latin1', 'binary', 'hex', 'base64']
      }
    },
    required: ['path', 'content']
  },
  execute
};
