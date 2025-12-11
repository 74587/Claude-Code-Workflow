/**
 * Edit File Tool - AI-focused file editing
 * Two complementary modes:
 * - update: Content-driven text replacement (AI primary use)
 * - line: Position-driven line operations (precise control)
 *
 * Features:
 * - dryRun mode for previewing changes
 * - Git-style diff output
 * - Multi-edit support in update mode
 * - Auto line-ending adaptation (CRLF/LF)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, isAbsolute, dirname } from 'path';

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
 * Write content to file with optional parent directory creation
 * @param {string} filePath - Path to file
 * @param {string} content - Content to write
 * @param {boolean} createDirs - Create parent directories if needed
 */
function writeFile(filePath, content, createDirs = false) {
  try {
    if (createDirs) {
      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
    writeFileSync(filePath, content, 'utf8');
  } catch (error) {
    throw new Error(`Failed to write file: ${error.message}`);
  }
}

/**
 * Normalize line endings to LF
 * @param {string} text - Input text
 * @returns {string} - Text with LF line endings
 */
function normalizeLineEndings(text) {
  return text.replace(/\r\n/g, '\n');
}

/**
 * Create unified diff between two strings
 * @param {string} original - Original content
 * @param {string} modified - Modified content
 * @param {string} filePath - File path for diff header
 * @returns {string} - Unified diff string
 */
function createUnifiedDiff(original, modified, filePath) {
  const origLines = normalizeLineEndings(original).split('\n');
  const modLines = normalizeLineEndings(modified).split('\n');

  const diffLines = [
    `--- a/${filePath}`,
    `+++ b/${filePath}`
  ];

  // Simple diff algorithm - find changes
  let i = 0, j = 0;
  let hunk = [];
  let hunkStart = 0;
  let origStart = 0;
  let modStart = 0;

  while (i < origLines.length || j < modLines.length) {
    if (i < origLines.length && j < modLines.length && origLines[i] === modLines[j]) {
      // Context line
      if (hunk.length > 0) {
        hunk.push(` ${origLines[i]}`);
      }
      i++;
      j++;
    } else {
      // Start or continue hunk
      if (hunk.length === 0) {
        origStart = i + 1;
        modStart = j + 1;
        // Add context before
        const contextStart = Math.max(0, i - 3);
        for (let c = contextStart; c < i; c++) {
          hunk.push(` ${origLines[c]}`);
        }
        origStart = contextStart + 1;
        modStart = contextStart + 1;
      }

      // Find where lines match again
      let foundMatch = false;
      for (let lookAhead = 1; lookAhead <= 10; lookAhead++) {
        if (i + lookAhead < origLines.length && j < modLines.length &&
            origLines[i + lookAhead] === modLines[j]) {
          // Remove lines from original
          for (let r = 0; r < lookAhead; r++) {
            hunk.push(`-${origLines[i + r]}`);
          }
          i += lookAhead;
          foundMatch = true;
          break;
        }
        if (j + lookAhead < modLines.length && i < origLines.length &&
            modLines[j + lookAhead] === origLines[i]) {
          // Add lines to modified
          for (let a = 0; a < lookAhead; a++) {
            hunk.push(`+${modLines[j + a]}`);
          }
          j += lookAhead;
          foundMatch = true;
          break;
        }
      }

      if (!foundMatch) {
        // Replace line
        if (i < origLines.length) {
          hunk.push(`-${origLines[i]}`);
          i++;
        }
        if (j < modLines.length) {
          hunk.push(`+${modLines[j]}`);
          j++;
        }
      }
    }

    // Flush hunk if we've had 3 context lines after changes
    const lastChangeIdx = hunk.findLastIndex(l => l.startsWith('+') || l.startsWith('-'));
    if (lastChangeIdx >= 0 && hunk.length - lastChangeIdx > 3) {
      const origCount = hunk.filter(l => !l.startsWith('+')).length;
      const modCount = hunk.filter(l => !l.startsWith('-')).length;
      diffLines.push(`@@ -${origStart},${origCount} +${modStart},${modCount} @@`);
      diffLines.push(...hunk);
      hunk = [];
    }
  }

  // Flush remaining hunk
  if (hunk.length > 0) {
    const origCount = hunk.filter(l => !l.startsWith('+')).length;
    const modCount = hunk.filter(l => !l.startsWith('-')).length;
    diffLines.push(`@@ -${origStart},${origCount} +${modStart},${modCount} @@`);
    diffLines.push(...hunk);
  }

  return diffLines.length > 2 ? diffLines.join('\n') : '';
}

/**
 * Mode: update - Simple text replacement
 * Auto-adapts line endings (CRLF/LF)
 * Supports multiple edits via 'edits' array
 */
function executeUpdateMode(content, params, filePath) {
  const { oldText, newText, replaceAll, edits, dryRun = false } = params;

  // Detect original line ending
  const hasCRLF = content.includes('\r\n');
  const normalizedContent = normalizeLineEndings(content);
  const originalContent = normalizedContent;

  let newContent = normalizedContent;
  let status = 'not found';
  let replacements = 0;
  const editResults = [];

  // Support multiple edits via 'edits' array (like reference impl)
  const editOperations = edits || (oldText !== undefined ? [{ oldText, newText }] : []);

  if (editOperations.length === 0) {
    throw new Error('Either "oldText/newText" or "edits" array is required for update mode');
  }

  for (const edit of editOperations) {
    const normalizedOld = normalizeLineEndings(edit.oldText || '');
    const normalizedNew = normalizeLineEndings(edit.newText || '');

    if (!normalizedOld) {
      editResults.push({ status: 'error', message: 'Empty oldText' });
      continue;
    }

    if (newContent.includes(normalizedOld)) {
      if (replaceAll) {
        const parts = newContent.split(normalizedOld);
        const count = parts.length - 1;
        newContent = parts.join(normalizedNew);
        replacements += count;
        editResults.push({ status: 'replaced_all', count });
      } else {
        newContent = newContent.replace(normalizedOld, normalizedNew);
        replacements += 1;
        editResults.push({ status: 'replaced', count: 1 });
      }
      status = 'replaced';
    } else {
      // Try fuzzy match (trimmed whitespace)
      const lines = newContent.split('\n');
      const oldLines = normalizedOld.split('\n');
      let matchFound = false;

      for (let i = 0; i <= lines.length - oldLines.length; i++) {
        const potentialMatch = lines.slice(i, i + oldLines.length);
        const isMatch = oldLines.every((oldLine, j) =>
          oldLine.trim() === potentialMatch[j].trim()
        );

        if (isMatch) {
          // Preserve indentation of first line
          const indent = lines[i].match(/^\s*/)?.[0] || '';
          const newLines = normalizedNew.split('\n').map((line, j) => {
            if (j === 0) return indent + line.trimStart();
            return line;
          });
          lines.splice(i, oldLines.length, ...newLines);
          newContent = lines.join('\n');
          replacements += 1;
          editResults.push({ status: 'replaced_fuzzy', count: 1 });
          matchFound = true;
          status = 'replaced';
          break;
        }
      }

      if (!matchFound) {
        editResults.push({ status: 'not_found', oldText: normalizedOld.substring(0, 50) });
      }
    }
  }

  // Restore original line ending
  if (hasCRLF) {
    newContent = newContent.replace(/\n/g, '\r\n');
  }

  // Generate diff if content changed
  let diff = '';
  if (originalContent !== normalizeLineEndings(newContent)) {
    diff = createUnifiedDiff(originalContent, normalizeLineEndings(newContent), filePath);
  }

  return {
    content: newContent,
    modified: content !== newContent,
    status: replacements > 0 ? 'replaced' : 'not found',
    replacements,
    editResults,
    diff,
    dryRun,
    message: replacements > 0
      ? `${replacements} replacement(s) made${dryRun ? ' (dry run)' : ''}`
      : 'No matches found'
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

  // Detect original line ending and normalize for processing
  const hasCRLF = content.includes('\r\n');
  const normalizedContent = hasCRLF ? content.replace(/\r\n/g, '\n') : content;

  const lines = normalizedContent.split('\n');
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

  let newContent = newLines.join('\n');

  // Restore original line endings
  if (hasCRLF) {
    newContent = newContent.replace(/\n/g, '\r\n');
  }

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
  const { path: filePath, mode = 'update', dryRun = false } = params;

  if (!filePath) throw new Error('Parameter "path" is required');

  const { resolvedPath, content } = readFile(filePath);

  let result;
  switch (mode) {
    case 'update':
      result = executeUpdateMode(content, params, filePath);
      break;
    case 'line':
      result = executeLineMode(content, params);
      break;
    default:
      throw new Error(`Unknown mode: ${mode}. Valid modes: update, line`);
  }

  // Write if modified and not dry run
  if (result.modified && !dryRun) {
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
  description: `Edit file with two modes:
- update: Replace oldText with newText (default). Supports multiple edits via 'edits' array.
- line: Position-driven line operations (insert_before, insert_after, replace, delete)

Features:
- dryRun: Preview changes without modifying file (returns diff)
- Auto line ending adaptation (CRLF/LF)
- Fuzzy matching for whitespace differences`,
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
      dryRun: {
        type: 'boolean',
        description: 'Preview changes using git-style diff without modifying file (default: false)',
        default: false
      },
      // Update mode params
      oldText: {
        type: 'string',
        description: '[update mode] Text to find and replace (use oldText/newText OR edits array)'
      },
      newText: {
        type: 'string',
        description: '[update mode] Replacement text'
      },
      edits: {
        type: 'array',
        description: '[update mode] Array of {oldText, newText} for multiple replacements',
        items: {
          type: 'object',
          properties: {
            oldText: { type: 'string', description: 'Text to search for - must match exactly' },
            newText: { type: 'string', description: 'Text to replace with' }
          },
          required: ['oldText', 'newText']
        }
      },
      replaceAll: {
        type: 'boolean',
        description: '[update mode] Replace all occurrences of oldText (default: false)'
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
