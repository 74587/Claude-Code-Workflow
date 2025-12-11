/**
 * Smart Search Tool - Unified search with mode-based execution
 * Modes: auto, exact, fuzzy, semantic, graph
 *
 * Features:
 * - Intent classification (auto mode)
 * - Multi-backend search routing
 * - Result fusion with RRF ranking
 * - Configurable search parameters
 */

import { spawn, execSync } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
import { join, resolve, isAbsolute } from 'path';

// Search mode constants
const SEARCH_MODES = ['auto', 'exact', 'fuzzy', 'semantic', 'graph'];

// Classification confidence threshold
const CONFIDENCE_THRESHOLD = 0.7;

/**
 * Detection heuristics for intent classification
 */

/**
 * Detect literal string query (simple alphanumeric or quoted strings)
 */
function detectLiteral(query) {
  return /^[a-zA-Z0-9_-]+$/.test(query) || /^["'].*["']$/.test(query);
}

/**
 * Detect regex pattern (contains regex metacharacters)
 */
function detectRegex(query) {
  return /[.*+?^${}()|[\]\]/.test(query);
}

/**
 * Detect natural language query (sentence structure, questions, multi-word phrases)
 */
function detectNaturalLanguage(query) {
  return query.split(/\s+/).length >= 3 || /\?$/.test(query);
}

/**
 * Detect file path query (path separators, file extensions)
 */
function detectFilePath(query) {
  return /[/\]/.test(query) || /\.[a-z]{2,4}$/i.test(query);
}

/**
 * Detect relationship query (import, export, dependency keywords)
 */
function detectRelationship(query) {
  return /(import|export|uses?|depends?|calls?|extends?)\s/i.test(query);
}

/**
 * Classify query intent and recommend search mode
 * @param {string} query - Search query string
 * @returns {{mode: string, confidence: number, reasoning: string}}
 */
function classifyIntent(query) {
  // Initialize mode scores
  const scores = {
    exact: 0,
    fuzzy: 0,
    semantic: 0,
    graph: 0
  };

  // Apply detection heuristics with weighted scoring
  if (detectLiteral(query)) {
    scores.exact += 0.8;
  }

  if (detectRegex(query)) {
    scores.fuzzy += 0.7;
  }

  if (detectNaturalLanguage(query)) {
    scores.semantic += 0.9;
  }

  if (detectFilePath(query)) {
    scores.exact += 0.6;
  }

  if (detectRelationship(query)) {
    scores.graph += 0.85;
  }

  // Find mode with highest confidence score
  const mode = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
  const confidence = scores[mode];

  // Build reasoning string
  const detectedPatterns = [];
  if (detectLiteral(query)) detectedPatterns.push('literal');
  if (detectRegex(query)) detectedPatterns.push('regex');
  if (detectNaturalLanguage(query)) detectedPatterns.push('natural language');
  if (detectFilePath(query)) detectedPatterns.push('file path');
  if (detectRelationship(query)) detectedPatterns.push('relationship');

  const reasoning = `Query classified as ${mode} (confidence: ${confidence.toFixed(2)}, detected: ${detectedPatterns.join(', ')})`;

  return { mode, confidence, reasoning };
}


n// Classification confidence threshold
const CONFIDENCE_THRESHOLD = 0.7;

/**
/**
 * Check if a tool is available in PATH
 * @param {string} toolName - Tool executable name
 * @returns {boolean}
 */
function checkToolAvailability(toolName) {
  try {
    const isWindows = process.platform === 'win32';
    const command = isWindows ? 'where' : 'which';
    execSync(`${command} ${toolName}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Build ripgrep command arguments
 * @param {Object} params - Search parameters
 * @returns {{command: string, args: string[]}}
 */
function buildRipgrepCommand(params) {
  const { query, paths = ['.'], contextLines = 0, maxResults = 100, includeHidden = false } = params;

  const args = [
    '-n',              // Show line numbers
    '--color=never',   // Disable color output
    '--json'           // Output in JSON format
  ];

  // Add context lines if specified
  if (contextLines > 0) {
    args.push('-C', contextLines.toString());
  }

  // Add max results limit
  if (maxResults > 0) {
    args.push('--max-count', maxResults.toString());
  }

  // Include hidden files if specified
  if (includeHidden) {
    args.push('--hidden');
  }

  // Use literal/fixed string matching for exact mode
  args.push('-F', query);

  // Add search paths
  args.push(...paths);

  return { command: 'rg', args };
}

/**
 * Mode: auto - Intent classification and mode selection
 * Analyzes query to determine optimal search mode
 */
/**
 * Mode: auto - Intent classification and mode selection
 * Analyzes query to determine optimal search mode
 */
async function executeAutoMode(params) {
  const { query } = params;

  // Classify intent
  const classification = classifyIntent(query);

  // Route to appropriate mode based on classification
  switch (classification.mode) {
    case 'exact':
      // Execute exact mode and enrich result with classification metadata
      const exactResult = await executeExactMode(params);
      return {
        ...exactResult,
        metadata: {
          ...exactResult.metadata,
          classified_as: classification.mode,
          confidence: classification.confidence,
          reasoning: classification.reasoning
        }
      };

    case 'fuzzy':
    case 'semantic':
    case 'graph':
      // These modes not yet implemented
      return {
        success: false,
        error: `${classification.mode} mode not yet implemented`,
        metadata: {
          classified_as: classification.mode,
          confidence: classification.confidence,
          reasoning: classification.reasoning
        }
      };

    default:
      // Fallback to exact mode with warning
      const fallbackResult = await executeExactMode(params);
      return {
        ...fallbackResult,
        metadata: {
          ...fallbackResult.metadata,
          classified_as: 'exact',
          confidence: 0.5,
          reasoning: 'Fallback to exact mode due to unknown classification'
        }
      };
  }
}
/**
 * Mode: exact - Precise file path and content matching
 * Uses ripgrep for literal string matching
 */
async function executeExactMode(params) {
  const { query, paths = [], contextLines = 0, maxResults = 100, includeHidden = false } = params;

  // Check ripgrep availability
  if (!checkToolAvailability('rg')) {
    return {
      success: false,
      error: 'ripgrep not available - please install ripgrep (rg) to use exact search mode'
    };
  }

  // Build ripgrep command
  const { command, args } = buildRipgrepCommand({
    query,
    paths: paths.length > 0 ? paths : ['.'],
    contextLines,
    maxResults,
    includeHidden
  });

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    // Collect stdout
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    // Collect stderr
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Handle completion
    child.on('close', (code) => {
      // Parse ripgrep JSON output
      const results = [];

      if (code === 0 || (code === 1 && stdout.trim())) {
        // Code 0: matches found, Code 1: no matches (but may have output)
        const lines = stdout.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const item = JSON.parse(line);

            // Only process match type items
            if (item.type === 'match') {
              const match = {
                file: item.data.path.text,
                line: item.data.line_number,
                column: item.data.submatches && item.data.submatches[0] ? item.data.submatches[0].start + 1 : 1,
                content: item.data.lines.text.trim()
              };
              results.push(match);
            }
          } catch (err) {
            // Skip malformed JSON lines
            continue;
          }
        }

        resolve({
          success: true,
          results,
          metadata: {
            mode: 'exact',
            backend: 'ripgrep',
            count: results.length,
            query
          }
        });
      } else {
        // Error occurred
        resolve({
          success: false,
          error: `ripgrep execution failed with code ${code}: ${stderr}`,
          results: []
        });
      }
    });

    // Handle spawn errors
    child.on('error', (error) => {
      resolve({
        success: false,
        error: `Failed to spawn ripgrep: ${error.message}`,
        results: []
      });
    });
  });
}

/**
 * Mode: fuzzy - Approximate matching with tolerance
 * Uses fuzzy matching algorithms for typo-tolerant search
 */
async function executeFuzzyMode(params) {
  const { query, paths = [], maxResults = 100 } = params;

  // TODO: Implement fuzzy search
  // - Use fuse.js for content fuzzy matching
  // - Support approximate file path matching
  // - Configure similarity threshold
  // - Return ranked results

  return {
    success: false,
    error: 'Fuzzy mode not implemented - fuzzy matching engine pending'
  };
}

/**
 * Mode: semantic - Natural language understanding search
 * Uses LLM or embeddings for semantic similarity
 */
async function executeSemanticMode(params) {
  const { query, paths = [], maxResults = 100 } = params;

  // TODO: Implement semantic search
  // - Option 1: Use Gemini CLI via cli-executor.js
  // - Option 2: Use local embeddings (transformers.js)
  // - Generate query embedding
  // - Compare with code embeddings
  // - Return semantically similar results

  return {
    success: false,
    error: 'Semantic mode not implemented - LLM/embedding integration pending'
  };
}

/**
 * Mode: graph - Dependency and relationship traversal
 * Analyzes code relationships (imports, exports, dependencies)
 */
async function executeGraphMode(params) {
  const { query, paths = [], maxResults = 100 } = params;

  // TODO: Implement graph search
  // - Parse import/export statements
  // - Build dependency graph
  // - Traverse relationships
  // - Find related modules
  // - Return graph results

  return {
    success: false,
    error: 'Graph mode not implemented - dependency analysis pending'
  };
}

/**
 * Main execute function - routes to appropriate mode handler
 */
async function execute(params) {
  const { query, mode = 'auto', paths = [], contextLines = 0, maxResults = 100, includeHidden = false } = params;

  // Validate required parameters
  if (!query || typeof query !== 'string') {
    throw new Error('Parameter "query" is required and must be a string');
  }

  // Validate mode
  if (!SEARCH_MODES.includes(mode)) {
    throw new Error(`Invalid mode: ${mode}. Valid modes: ${SEARCH_MODES.join(', ')}`);
  }

  // Route to mode-specific handler
  switch (mode) {
    case 'auto':
      return executeAutoMode(params);

    case 'exact':
      return executeExactMode(params);

    case 'fuzzy':
      return executeFuzzyMode(params);

    case 'semantic':
      return executeSemanticMode(params);

    case 'graph':
      return executeGraphMode(params);

    default:
      throw new Error(`Unsupported mode: ${mode}`);
  }
}

/**
 * Smart Search Tool Definition
 */
export const smartSearchTool = {
  name: 'smart_search',
  description: `Unified search with intelligent mode selection.

Modes:
- auto: Classify intent and recommend optimal search mode (default)
- exact: Precise literal matching via ripgrep
- fuzzy: Approximate matching with typo tolerance
- semantic: Natural language understanding via LLM/embeddings
- graph: Dependency relationship traversal

Features:
- Multi-backend search coordination
- Result fusion with RRF ranking
- Configurable result limits and context`,
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (file pattern, text content, or natural language)'
      },
      mode: {
        type: 'string',
        enum: SEARCH_MODES,
        description: 'Search mode (default: auto)',
        default: 'auto'
      },
      paths: {
        type: 'array',
        description: 'Paths to search within (default: current directory)',
        items: {
          type: 'string'
        },
        default: []
      },
      contextLines: {
        type: 'number',
        description: 'Number of context lines around matches (default: 0)',
        default: 0
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 100)',
        default: 100
      },
      includeHidden: {
        type: 'boolean',
        description: 'Include hidden files/directories (default: false)',
        default: false
      }
    },
    required: ['query']
  },
  execute
};
