/**
 * Session Manager Tool - Workflow session lifecycle management
 * Operations: init, list, read, write, update, archive, mkdir
 * Content routing via content_type + path_params
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, renameSync, rmSync, copyFileSync, statSync } from 'fs';
import { resolve, join, dirname, basename } from 'path';

// Base paths for session storage
const WORKFLOW_BASE = '.workflow';
const ACTIVE_BASE = '.workflow/active';
const ARCHIVE_BASE = '.workflow/archives';
const LITE_PLAN_BASE = '.workflow/.lite-plan';
const LITE_FIX_BASE = '.workflow/.lite-fix';

// Session ID validation pattern (alphanumeric, hyphen, underscore)
const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

// Cached workflow root (computed once per execution)
let cachedWorkflowRoot = null;

/**
 * Find project root by traversing up looking for .workflow directory
 * Falls back to cwd if not found
 */
function findWorkflowRoot() {
  if (cachedWorkflowRoot) return cachedWorkflowRoot;

  let dir = process.cwd();
  const root = dirname(dir) === dir ? dir : null; // filesystem root

  while (dir && dir !== root) {
    if (existsSync(join(dir, WORKFLOW_BASE))) {
      cachedWorkflowRoot = dir;
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }

  // Fallback to cwd (for init operation)
  cachedWorkflowRoot = process.cwd();
  return cachedWorkflowRoot;
}

/**
 * Validate session ID format
 */
function validateSessionId(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('session_id must be a non-empty string');
  }
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    throw new Error(`Invalid session_id format: "${sessionId}". Only alphanumeric, hyphen, and underscore allowed.`);
  }
  if (sessionId.length > 100) {
    throw new Error('session_id must be 100 characters or less');
  }
}

/**
 * Validate path params to prevent path traversal
 */
function validatePathParams(pathParams) {
  for (const [key, value] of Object.entries(pathParams)) {
    if (typeof value !== 'string') continue;
    if (value.includes('..') || value.includes('/') || value.includes('\\')) {
      throw new Error(`Invalid path_params.${key}: path traversal characters not allowed`);
    }
  }
}

/**
 * Content type to file path routing
 * {base} is replaced with session base path
 * Dynamic params: {task_id}, {filename}, {dimension}, {iteration}
 */
const PATH_ROUTES = {
  'session':      '{base}/workflow-session.json',
  'plan':         '{base}/IMPL_PLAN.md',
  'task':         '{base}/.task/{task_id}.json',
  'summary':      '{base}/.summaries/{task_id}-summary.md',
  'process':      '{base}/.process/{filename}',
  'chat':         '{base}/.chat/{filename}',
  'brainstorm':   '{base}/.brainstorming/{filename}',
  'review-dim':   '{base}/.review/dimensions/{dimension}.json',
  'review-iter':  '{base}/.review/iterations/{iteration}.json',
  'review-fix':   '{base}/.review/fixes/{filename}',
  'todo':         '{base}/TODO_LIST.md',
  'context':      '{base}/context-package.json'
};

/**
 * Resolve path with base and parameters
 */
function resolvePath(base, contentType, pathParams = {}) {
  const template = PATH_ROUTES[contentType];
  if (!template) {
    throw new Error(`Unknown content_type: ${contentType}. Valid types: ${Object.keys(PATH_ROUTES).join(', ')}`);
  }

  let path = template.replace('{base}', base);

  // Replace dynamic parameters
  for (const [key, value] of Object.entries(pathParams)) {
    path = path.replace(`{${key}}`, value);
  }

  // Check for unreplaced placeholders
  const unreplaced = path.match(/\{[^}]+\}/g);
  if (unreplaced) {
    throw new Error(`Missing path_params: ${unreplaced.join(', ')} for content_type "${contentType}"`);
  }

  return resolve(findWorkflowRoot(), path);
}

/**
 * Get session base path for init (always active)
 */
function getSessionBase(sessionId) {
  return resolve(findWorkflowRoot(), ACTIVE_BASE, sessionId);
}

/**
 * Auto-detect session location by searching all known paths
 * Search order: active, archives, lite-plan, lite-fix
 */
function findSession(sessionId) {
  const root = findWorkflowRoot();
  const searchPaths = [
    { path: resolve(root, ACTIVE_BASE, sessionId), location: 'active' },
    { path: resolve(root, ARCHIVE_BASE, sessionId), location: 'archived' },
    { path: resolve(root, LITE_PLAN_BASE, sessionId), location: 'lite-plan' },
    { path: resolve(root, LITE_FIX_BASE, sessionId), location: 'lite-fix' }
  ];

  for (const { path, location } of searchPaths) {
    if (existsSync(path)) {
      return { path, location };
    }
  }
  return null;
}

/**
 * Ensure directory exists
 */
function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Read JSON file safely
 */
function readJsonFile(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  try {
    const content = readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
    }
    throw new Error(`Failed to read ${filePath}: ${error.message}`);
  }
}

/**
 * Write JSON file with formatting
 */
function writeJsonFile(filePath, data) {
  ensureDir(dirname(filePath));
  const content = JSON.stringify(data, null, 2);
  writeFileSync(filePath, content, 'utf8');
}

/**
 * Write text file
 */
function writeTextFile(filePath, content) {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, content, 'utf8');
}

// ============================================================
// Operation Handlers
// ============================================================

/**
 * Operation: init
 * Create new session with directory structure
 */
function executeInit(params) {
  const { session_id, metadata } = params;

  if (!session_id) {
    throw new Error('Parameter "session_id" is required for init');
  }

  // Validate session_id format
  validateSessionId(session_id);

  // Check if session already exists (auto-detect all locations)
  const existing = findSession(session_id);
  if (existing) {
    throw new Error(`Session "${session_id}" already exists in ${existing.location}`);
  }

  const sessionPath = getSessionBase(session_id);

  // Create session directory structure
  ensureDir(sessionPath);
  ensureDir(join(sessionPath, '.task'));
  ensureDir(join(sessionPath, '.summaries'));
  ensureDir(join(sessionPath, '.process'));

  // Create workflow-session.json if metadata provided
  let sessionMetadata = null;
  if (metadata) {
    const sessionFile = join(sessionPath, 'workflow-session.json');
    const sessionData = {
      session_id,
      status: 'planning',
      created_at: new Date().toISOString(),
      ...metadata
    };
    writeJsonFile(sessionFile, sessionData);
    sessionMetadata = sessionData;
  }

  return {
    operation: 'init',
    session_id,
    path: sessionPath,
    directories_created: ['.task', '.summaries', '.process'],
    metadata: sessionMetadata,
    message: `Session "${session_id}" initialized successfully`
  };
}

/**
 * Operation: list
 * List sessions (active, archived, or both)
 */
function executeList(params) {
  const { location = 'both', include_metadata = false } = params;

  const result = {
    operation: 'list',
    active: [],
    archived: [],
    total: 0
  };

  // List active sessions
  if (location === 'active' || location === 'both') {
    const activePath = resolve(findWorkflowRoot(), ACTIVE_BASE);
    if (existsSync(activePath)) {
      const entries = readdirSync(activePath, { withFileTypes: true });
      result.active = entries
        .filter(e => e.isDirectory() && e.name.startsWith('WFS-'))
        .map(e => {
          const sessionInfo = { session_id: e.name, location: 'active' };
          if (include_metadata) {
            const metaPath = join(activePath, e.name, 'workflow-session.json');
            if (existsSync(metaPath)) {
              try {
                sessionInfo.metadata = readJsonFile(metaPath);
              } catch {
                sessionInfo.metadata = null;
              }
            }
          }
          return sessionInfo;
        });
    }
  }

  // List archived sessions
  if (location === 'archived' || location === 'both') {
    const archivePath = resolve(findWorkflowRoot(), ARCHIVE_BASE);
    if (existsSync(archivePath)) {
      const entries = readdirSync(archivePath, { withFileTypes: true });
      result.archived = entries
        .filter(e => e.isDirectory() && e.name.startsWith('WFS-'))
        .map(e => {
          const sessionInfo = { session_id: e.name, location: 'archived' };
          if (include_metadata) {
            const metaPath = join(archivePath, e.name, 'workflow-session.json');
            if (existsSync(metaPath)) {
              try {
                sessionInfo.metadata = readJsonFile(metaPath);
              } catch {
                sessionInfo.metadata = null;
              }
            }
          }
          return sessionInfo;
        });
    }
  }

  result.total = result.active.length + result.archived.length;
  return result;
}

/**
 * Operation: read
 * Read file content by content_type
 */
function executeRead(params) {
  const { session_id, content_type, path_params = {} } = params;

  if (!session_id) {
    throw new Error('Parameter "session_id" is required for read');
  }
  if (!content_type) {
    throw new Error('Parameter "content_type" is required for read');
  }

  // Validate inputs
  validateSessionId(session_id);
  validatePathParams(path_params);

  const session = findSession(session_id);
  if (!session) {
    throw new Error(`Session "${session_id}" not found`);
  }

  const filePath = resolvePath(session.path, content_type, path_params);

  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Read content
  const rawContent = readFileSync(filePath, 'utf8');

  // Parse JSON for JSON content types
  const isJson = filePath.endsWith('.json');
  const content = isJson ? JSON.parse(rawContent) : rawContent;

  return {
    operation: 'read',
    session_id,
    content_type,
    path: filePath,
    location: session.location,
    content,
    is_json: isJson
  };
}

/**
 * Operation: write
 * Write content to file by content_type
 */
function executeWrite(params) {
  const { session_id, content_type, content, path_params = {} } = params;

  if (!session_id) {
    throw new Error('Parameter "session_id" is required for write');
  }
  if (!content_type) {
    throw new Error('Parameter "content_type" is required for write');
  }
  if (content === undefined) {
    throw new Error('Parameter "content" is required for write');
  }

  // Validate inputs
  validateSessionId(session_id);
  validatePathParams(path_params);

  const session = findSession(session_id);
  if (!session) {
    throw new Error(`Session "${session_id}" not found. Use init operation first.`);
  }

  const filePath = resolvePath(session.path, content_type, path_params);
  const isJson = filePath.endsWith('.json');

  // Write content
  if (isJson) {
    writeJsonFile(filePath, content);
  } else {
    writeTextFile(filePath, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }

  // Return written content for task/summary types
  const returnContent = (content_type === 'task' || content_type === 'summary') ? content : undefined;

  return {
    operation: 'write',
    session_id,
    content_type,
    written_content: returnContent,
    path: filePath,
    location: session.location,
    message: `File written successfully`
  };
}

/**
 * Operation: update
 * Update existing JSON file with shallow merge
 */
function executeUpdate(params) {
  const { session_id, content_type, content, path_params = {} } = params;

  if (!session_id) {
    throw new Error('Parameter "session_id" is required for update');
  }
  if (!content_type) {
    throw new Error('Parameter "content_type" is required for update');
  }
  if (!content || typeof content !== 'object') {
    throw new Error('Parameter "content" must be an object for update');
  }

  const session = findSession(session_id);
  if (!session) {
    throw new Error(`Session "${session_id}" not found`);
  }

  const filePath = resolvePath(session.path, content_type, path_params);

  if (!filePath.endsWith('.json')) {
    throw new Error('Update operation only supports JSON files');
  }

  // Read existing content or start with empty object
  let existing = {};
  if (existsSync(filePath)) {
    existing = readJsonFile(filePath);
  }

  // Shallow merge
  const merged = { ...existing, ...content };
  writeJsonFile(filePath, merged);

  return {
    operation: 'update',
    session_id,
    content_type,
    path: filePath,
    location: session.location,
    fields_updated: Object.keys(content),
    merged_data: merged,
    message: `File updated successfully`
  };
}

/**
 * Operation: archive
 * Move session from active to archives
 */
function executeArchive(params) {
  const { session_id, update_status = true } = params;

  if (!session_id) {
    throw new Error('Parameter "session_id" is required for archive');
  }

  const activePath = getSessionBase(session_id, false);
  const archivePath = getSessionBase(session_id, true);

  if (!existsSync(activePath)) {
    // Check if already archived
    if (existsSync(archivePath)) {
      return {
        operation: 'archive',
        session_id,
        status: 'already_archived',
        path: archivePath,
        message: `Session "${session_id}" is already archived`
      };
    }
    throw new Error(`Session "${session_id}" not found in active sessions`);
  }

  // Update status to completed before archiving
  if (update_status) {
    const sessionFile = join(activePath, 'workflow-session.json');
    if (existsSync(sessionFile)) {
      const sessionData = readJsonFile(sessionFile);
      sessionData.status = 'completed';
      sessionData.archived_at = new Date().toISOString();
      writeJsonFile(sessionFile, sessionData);
    }
  }

  // Ensure archive directory exists
  ensureDir(dirname(archivePath));

  // Move session directory
  renameSync(activePath, archivePath);

  // Read session metadata after archiving
  let sessionMetadata = null;
  const sessionFile = join(archivePath, 'workflow-session.json');
  if (existsSync(sessionFile)) {
    sessionMetadata = readJsonFile(sessionFile);
  }

  return {
    operation: 'archive',
    session_id,
    status: 'archived',
    source: activePath,
    destination: archivePath,
    metadata: sessionMetadata,
    message: `Session "${session_id}" archived successfully`
  };
}

/**
 * Operation: mkdir
 * Create directory structure within session
 */
function executeMkdir(params) {
  const { session_id, dirs } = params;

  if (!session_id) {
    throw new Error('Parameter "session_id" is required for mkdir');
  }
  if (!dirs || !Array.isArray(dirs) || dirs.length === 0) {
    throw new Error('Parameter "dirs" must be a non-empty array');
  }

  const session = findSession(session_id);
  if (!session) {
    throw new Error(`Session "${session_id}" not found`);
  }

  const created = [];
  for (const dir of dirs) {
    const dirPath = join(session.path, dir);
    ensureDir(dirPath);
    created.push(dir);
  }

  return {
    operation: 'mkdir',
    session_id,
    location: session.location,
    directories_created: created,
    message: `Created ${created.length} directories`
  };
}

/**
 * Operation: delete
 * Delete a file within session (security: path traversal prevention)
 */
function executeDelete(params) {
  const { session_id, file_path } = params;

  if (!session_id) {
    throw new Error('Parameter "session_id" is required for delete');
  }
  if (!file_path) {
    throw new Error('Parameter "file_path" is required for delete');
  }

  // Validate session exists
  const session = findSession(session_id);
  if (!session) {
    throw new Error(`Session "${session_id}" not found`);
  }

  // Security: Prevent path traversal
  if (file_path.includes('..') || file_path.includes('\\')) {
    throw new Error('Invalid file_path: path traversal characters not allowed');
  }

  // Construct absolute path
  const absolutePath = resolve(session.path, file_path);

  // Security: Verify path is within session directory
  if (!absolutePath.startsWith(session.path)) {
    throw new Error('Security error: file_path must be within session directory');
  }

  // Check file exists
  if (!existsSync(absolutePath)) {
    throw new Error(`File not found: ${file_path}`);
  }

  // Delete the file
  rmSync(absolutePath, { force: true });

  return {
    operation: 'delete',
    session_id,
    deleted: file_path,
    absolute_path: absolutePath,
    message: `File deleted successfully`
  };
}

/**
 * Operation: stats
 * Get session statistics (tasks, summaries, plan)
 */
function executeStats(params) {
  const { session_id } = params;

  if (!session_id) {
    throw new Error('Parameter "session_id" is required for stats');
  }

  // Validate session exists
  const session = findSession(session_id);
  if (!session) {
    throw new Error(`Session "${session_id}" not found`);
  }

  const taskDir = join(session.path, '.task');
  const summariesDir = join(session.path, '.summaries');
  const planFile = join(session.path, 'IMPL_PLAN.md');

  // Count tasks by status
  const taskStats = {
    total: 0,
    pending: 0,
    in_progress: 0,
    completed: 0,
    blocked: 0,
    cancelled: 0
  };

  if (existsSync(taskDir)) {
    const taskFiles = readdirSync(taskDir).filter(f => f.endsWith('.json'));
    taskStats.total = taskFiles.length;

    for (const taskFile of taskFiles) {
      try {
        const taskPath = join(taskDir, taskFile);
        const taskData = readJsonFile(taskPath);
        const status = taskData.status || 'unknown';
        if (status in taskStats) {
          taskStats[status]++;
        }
      } catch {
        // Skip invalid task files
      }
    }
  }

  // Count summaries
  let summariesCount = 0;
  if (existsSync(summariesDir)) {
    summariesCount = readdirSync(summariesDir).filter(f => f.endsWith('.md')).length;
  }

  // Check for plan
  const hasPlan = existsSync(planFile);

  return {
    operation: 'stats',
    session_id,
    location: session.location,
    tasks: taskStats,
    summaries: summariesCount,
    has_plan: hasPlan,
    message: `Session statistics retrieved`
  };
}

// ============================================================
// Main Execute Function
// ============================================================

/**
 * Route to appropriate operation handler
 */
async function execute(params) {
  const { operation } = params;

  if (!operation) {
    throw new Error('Parameter "operation" is required. Valid operations: init, list, read, write, update, archive, mkdir, delete, stats');
  }

  switch (operation) {
    case 'init':
      return executeInit(params);
    case 'list':
      return executeList(params);
    case 'read':
      return executeRead(params);
    case 'write':
      return executeWrite(params);
    case 'update':
      return executeUpdate(params);
    case 'archive':
      return executeArchive(params);
    case 'mkdir':
      return executeMkdir(params);
    case 'delete':
      return executeDelete(params);
    case 'stats':
      return executeStats(params);
    default:
      throw new Error(`Unknown operation: ${operation}. Valid operations: init, list, read, write, update, archive, mkdir, delete, stats`);
  }
}

// ============================================================
// Tool Definition
// ============================================================

export const sessionManagerTool = {
  name: 'session_manager',
  description: `Workflow session lifecycle management tool.

Operations:
- init: Create new session with directory structure
- list: List sessions (active, archived, or both)
- read: Read file content by content_type
- write: Write content to file by content_type
- update: Update existing JSON file (shallow merge)
- archive: Move session from active to archives
- mkdir: Create directories within session
- delete: Delete a file within session
- stats: Get session statistics (tasks, summaries, plan)

Content Types:
session, plan, task, summary, process, chat, brainstorm,
review-dim, review-iter, review-fix, todo, context

Usage:
ccw tool exec session_manager '{"operation":"list"}'
ccw tool exec session_manager '{"operation":"init","session_id":"WFS-test"}'
ccw tool exec session_manager '{"operation":"read","session_id":"WFS-test","content_type":"session"}'
ccw tool exec session_manager '{"operation":"stats","session_id":"WFS-test"}'`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['init', 'list', 'read', 'write', 'update', 'archive', 'mkdir', 'delete', 'stats'],
        description: 'Operation to perform'
      },
      session_id: {
        type: 'string',
        description: 'Session identifier (e.g., WFS-my-session). Required for all operations except list.'
      },
      content_type: {
        type: 'string',
        enum: ['session', 'plan', 'task', 'summary', 'process', 'chat', 'brainstorm', 'review-dim', 'review-iter', 'review-fix', 'todo', 'context'],
        description: 'Content type for read/write/update operations'
      },
      content: {
        type: 'object',
        description: 'Content for write/update operations (object for JSON, string for text)'
      },
      path_params: {
        type: 'object',
        description: 'Dynamic path parameters: task_id, filename, dimension, iteration'
      },
      metadata: {
        type: 'object',
        description: 'Session metadata for init operation (project, type, description, etc.)'
      },
      location: {
        type: 'string',
        enum: ['active', 'archived', 'both'],
        description: 'Session location filter for list operation (default: both)'
      },
      include_metadata: {
        type: 'boolean',
        description: 'Include session metadata in list results (default: false)'
      },
      dirs: {
        type: 'array',
        description: 'Directory paths to create for mkdir operation'
      },
      update_status: {
        type: 'boolean',
        description: 'Update session status to completed when archiving (default: true)'
      },
      file_path: {
        type: 'string',
        description: 'Relative file path within session for delete operation'
      }
    },
    required: ['operation']
  },
  execute
};
