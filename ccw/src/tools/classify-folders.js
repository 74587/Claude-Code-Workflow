/**
 * Classify Folders Tool
 * Categorize folders by type for documentation generation
 * Types: code (API.md + README.md), navigation (README.md only), skip (empty)
 */

import { readdirSync, statSync, existsSync } from 'fs';
import { join, resolve, extname } from 'path';

// Code file extensions
const CODE_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx',
  '.py', '.go', '.java', '.rs',
  '.c', '.cpp', '.cs', '.rb',
  '.php', '.swift', '.kt'
];

/**
 * Count code files in a directory (non-recursive)
 */
function countCodeFiles(dirPath) {
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    return entries.filter(e => {
      if (!e.isFile()) return false;
      const ext = extname(e.name).toLowerCase();
      return CODE_EXTENSIONS.includes(ext);
    }).length;
  } catch (e) {
    return 0;
  }
}

/**
 * Count subdirectories in a directory
 */
function countSubdirs(dirPath) {
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    return entries.filter(e => e.isDirectory() && !e.name.startsWith('.')).length;
  } catch (e) {
    return 0;
  }
}

/**
 * Determine folder type
 */
function classifyFolder(dirPath) {
  const codeFiles = countCodeFiles(dirPath);
  const subdirs = countSubdirs(dirPath);

  if (codeFiles > 0) {
    return { type: 'code', codeFiles, subdirs }; // Generates API.md + README.md
  } else if (subdirs > 0) {
    return { type: 'navigation', codeFiles, subdirs }; // README.md only
  } else {
    return { type: 'skip', codeFiles, subdirs }; // Empty or no relevant content
  }
}

/**
 * Parse input from get_modules_by_depth format
 * Format: depth:N|path:./path|files:N|types:[ext,ext]|has_claude:yes/no
 */
function parseModuleInput(line) {
  const parts = {};
  line.split('|').forEach(part => {
    const [key, value] = part.split(':');
    if (key && value !== undefined) {
      parts[key] = value;
    }
  });
  return parts;
}

/**
 * Main execute function
 */
async function execute(params) {
  const { input, path: targetPath } = params;

  const results = [];

  // Mode 1: Process piped input from get_modules_by_depth
  if (input) {
    let lines;

    // Check if input is JSON (from ccw tool exec output)
    if (typeof input === 'string' && input.trim().startsWith('{')) {
      try {
        const jsonInput = JSON.parse(input);
        // Handle output from get_modules_by_depth tool (wrapped in result)
        const output = jsonInput.result?.output || jsonInput.output;
        if (output) {
          lines = output.split('\n');
        } else {
          lines = [input];
        }
      } catch {
        // Not JSON, treat as line-delimited text
        lines = input.split('\n');
      }
    } else if (Array.isArray(input)) {
      lines = input;
    } else {
      lines = input.split('\n');
    }

    for (const line of lines) {
      if (!line.trim()) continue;

      const parsed = parseModuleInput(line);
      const folderPath = parsed.path;

      if (!folderPath) continue;

      const basePath = targetPath ? resolve(process.cwd(), targetPath) : process.cwd();
      const fullPath = resolve(basePath, folderPath);

      if (!existsSync(fullPath) || !statSync(fullPath).isDirectory()) {
        continue;
      }

      const classification = classifyFolder(fullPath);

      results.push({
        path: folderPath,
        type: classification.type,
        code_files: classification.codeFiles,
        subdirs: classification.subdirs
      });
    }
  }
  // Mode 2: Classify a single directory
  else if (targetPath) {
    const fullPath = resolve(process.cwd(), targetPath);

    if (!existsSync(fullPath)) {
      throw new Error(`Directory not found: ${fullPath}`);
    }

    if (!statSync(fullPath).isDirectory()) {
      throw new Error(`Not a directory: ${fullPath}`);
    }

    const classification = classifyFolder(fullPath);

    results.push({
      path: targetPath,
      type: classification.type,
      code_files: classification.codeFiles,
      subdirs: classification.subdirs
    });
  }
  else {
    throw new Error('Either "input" or "path" parameter is required');
  }

  // Format output
  const output = results.map(r =>
    `${r.path}|${r.type}|code:${r.code_files}|dirs:${r.subdirs}`
  ).join('\n');

  return {
    total: results.length,
    by_type: {
      code: results.filter(r => r.type === 'code').length,
      navigation: results.filter(r => r.type === 'navigation').length,
      skip: results.filter(r => r.type === 'skip').length
    },
    results,
    output
  };
}

/**
 * Tool Definition
 */
export const classifyFoldersTool = {
  name: 'classify_folders',
  description: `Classify folders by type for documentation generation.
Types:
- code: Contains code files (generates API.md + README.md)
- navigation: Contains subdirectories only (generates README.md only)
- skip: Empty or no relevant content

Input: Either piped output from get_modules_by_depth or a single directory path.`,
  parameters: {
    type: 'object',
    properties: {
      input: {
        type: 'string',
        description: 'Piped input from get_modules_by_depth (one module per line)'
      },
      path: {
        type: 'string',
        description: 'Single directory path to classify'
      }
    },
    required: []
  },
  execute
};
