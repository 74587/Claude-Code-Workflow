/**
 * Edit File Tool - AI-focused file editing
 * Two complementary modes:
 * - update: Content-driven text replacement (AI primary use)
 * - line: Position-driven line operations (precise control)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, isAbsolute } from 'path';

/**
 * Resolve file path and read content
 * @param {string} filePath - Path to file
 * @returns {{resolvedPath: string, content: string}}
 */
function readFile(filePath) {
  const resolvedPath = isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  try {
    const content = readFileSync(resolvedPath, 'utf8');
    return { resolvedPath, content };
  } catch (error) {
    throw new Error(`Failed to read file: ${error.message}`);
  }
}

/**
 * Write content to file
 * @param {string} filePath - Path to file
 * @param {string} content - Content to write
 */
function writeFile(filePath, content) {
  try {
    writeFileSync(filePath, content, 'utf8');
  } catch (error) {
    throw new Error(`Failed to write file: ${error.message}`);
  }
}

/**
 * Mode: update - Simple text replacement
 * Auto-adapts line endings (CRLF/LF)
 */
function executeUpdateMode(content, params) {
  const { oldText, newText } = params;

  if (!oldText) throw new Error('Parameter "oldText" is required for update mode');
  if (newText === undefined) throw new Error('Parameter "newText" is required for update mode');

  // Detect original line ending
  const hasCRLF = content.includes('\r\n');

  // Normalize to LF for matching
  const normalize = (str) => str.replace(/\r\n/g, '\n');
  const normalizedContent = normalize(content);
  const normalizedOld = normalize(oldText);
  const normalizedNew = normalize(newText);

  let newContent = normalizedContent;
  let status = 'not found';

  if (newContent.includes(normalizedOld)) {
    newContent = newContent.replace(normalizedOld, normalizedNew);
    status = 'replaced';
  }

  // Restore original line ending
  if (hasCRLF) {
    newContent = newContent.replace(/\n/g, '\r\n');
  }

  return {
    content: newContent,
    modified: content !== newContent,
    status,
    message: status === 'replaced' ? 'Text replaced successfully' : 'oldText not found in file'
  };
}

/**
 * Mode: line - Line-based operations
 * Operations: insert_before, insert_after, replace, delete
 */
function executeLineMode(content, params) {
  const { operation, line, text, end_line } = params;

  if (!operation) throw new Error('Parameter "operation" is required for line mode');
  if (line === undefined) throw new Error('Parameter "line" is required for line mode');

  const lines = content.split('\n');
  const lineIndex = line - 1; // Convert to 0-based

  if (lineIndex < 0 || lineIndex >= lines.length) {
    throw new Error(`Line ${line} out of range (1-${lines.length})`);
  }

  let newLines = [...lines];
  let message = '';

  switch (operation) {
    case 'insert_before':
      if (text === undefined) throw new Error('Parameter "text" is required for insert_before');
      newLines.splice(lineIndex, 0, text);
      message = `Inserted before line ${line}`;
      break;

    case 'insert_after':
      if (text === undefined) throw new Error('Parameter "text" is required for insert_after');
      newLines.splice(lineIndex + 1, 0, text);
      message = `Inserted after line ${line}`;
      break;

    case 'replace':
      if (text === undefined) throw new Error('Parameter "text" is required for replace');
      const endIdx = end_line ? end_line - 1 : lineIndex;
      if (endIdx < lineIndex || endIdx >= lines.length) {
        throw new Error(`end_line ${end_line} is invalid`);
      }
      const deleteCount = endIdx - lineIndex + 1;
      newLines.splice(lineIndex, deleteCount, text);
      message = end_line ? `Replaced lines ${line}-${end_line}` : `Replaced line ${line}`;
      break;

    case 'delete':
      const endDelete = end_line ? end_line - 1 : lineIndex;
      if (endDelete < lineIndex || endDelete >= lines.length) {
        throw new Error(`end_line ${end_line} is invalid`);
      }
      const count = endDelete - lineIndex + 1;
      newLines.splice(lineIndex, count);
      message = end_line ? `Deleted lines ${line}-${end_line}` : `Deleted line ${line}`;
      break;

    default:
      throw new Error(`Unknown operation: ${operation}. Valid: insert_before, insert_after, replace, delete`);
  }

  const newContent = newLines.join('\n');

  return {
    content: newContent,
    modified: content !== newContent,
    operation,
    line,
    end_line,
    message
  };
}

/**
 * Main execute function - routes to appropriate mode
 */
async function execute(params) {
  const { path: filePath, mode = 'update' } = params;

  if (!filePath) throw new Error('Parameter "path" is required');

  const { resolvedPath, content } = readFile(filePath);

  let result;
  switch (mode) {
    case 'update':
      result = executeUpdateMode(content, params);
      break;
    case 'line':
      result = executeLineMode(content, params);
      break;
    default:
      throw new Error(`Unknown mode: ${mode}. Valid modes: update, line`);
  }

  // Write if modified
  if (result.modified) {
    writeFile(resolvedPath, result.content);
  }

  // Remove content from result (don't return file content)
  const { content: _, ...output } = result;
  return output;
}

/**
 * Edit File Tool Definition
 */
export const editFileTool = {
  name: 'edit_file',
  description: `Update file with two modes:
- update: Replace oldText with newText (default)
- line: Position-driven line operations`,
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to modify'
      },
      mode: {
        type: 'string',
        enum: ['update', 'line'],
        description: 'Edit mode (default: update)',
        default: 'update'
      },
      // Update mode params
      oldText: {
        type: 'string',
        description: '[update mode] Text to find and replace'
      },
      newText: {
        type: 'string',
        description: '[update mode] Replacement text'
      },
      // Line mode params
      operation: {
        type: 'string',
        enum: ['insert_before', 'insert_after', 'replace', 'delete'],
        description: '[line mode] Line operation type'
      },
      line: {
        type: 'number',
        description: '[line mode] Line number (1-based)'
      },
      end_line: {
        type: 'number',
        description: '[line mode] End line for range operations'
      },
      text: {
        type: 'string',
        description: '[line mode] Text for insert/replace operations'
      }
    },
    required: ['path']
  },
  execute
};
