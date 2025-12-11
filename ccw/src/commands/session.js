/**
 * Session Command - Workflow session lifecycle management
 * Adapter for session_manager tool providing direct CLI access
 */

import chalk from 'chalk';
import http from 'http';
import { executeTool } from '../tools/index.js';

// Handle EPIPE errors gracefully (occurs when piping to head/jq that closes early)
process.stdout.on('error', (err) => {
  if (err.code === 'EPIPE') {
    process.exit(0);
  }
  throw err;
});

/**
 * Notify dashboard of granular events (fire and forget)
 * @param {Object} data - Event data
 */
function notifyDashboard(data) {
  const DASHBOARD_PORT = process.env.CCW_PORT || 3456;
  const payload = JSON.stringify({
    ...data,
    timestamp: new Date().toISOString()
  });

  const req = http.request({
    hostname: 'localhost',
    port: DASHBOARD_PORT,
    path: '/api/hook',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  });

  // Fire and forget - log errors only in debug mode
  req.on('error', (err) => {
    if (process.env.DEBUG) console.error('[Dashboard] Notification failed:', err.message);
  });
  req.write(payload);
  req.end();
}

/**
 * List sessions
 * @param {Object} options - CLI options
 */
async function listAction(options) {
  const params = {
    operation: 'list',
    location: options.location || 'both',
    include_metadata: options.metadata !== false
  };

  const result = await executeTool('session_manager', params);

  if (!result.success) {
    console.error(chalk.red(`Error: ${result.error}`));
    process.exit(1);
  }

  const { active = [], archived = [], total } = result.result;

  console.log(chalk.bold.cyan('\nWorkflow Sessions\n'));

  if (active.length > 0) {
    console.log(chalk.bold.white('Active Sessions:'));
    for (const session of active) {
      const meta = session.metadata || {};
      console.log(chalk.green(`  [ACTIVE] ${session.session_id}`));
      if (meta.description) console.log(chalk.gray(`           ${meta.description}`));
      if (meta.status) console.log(chalk.gray(`           Status: ${meta.status}`));
    }
    console.log();
  }

  if (archived.length > 0) {
    console.log(chalk.bold.white('Archived Sessions:'));
    for (const session of archived) {
      const meta = session.metadata || {};
      console.log(chalk.blue(`  [ARCHIVED] ${session.session_id}`));
      if (meta.description) console.log(chalk.gray(`             ${meta.description}`));
    }
    console.log();
  }

  if (total === 0) {
    console.log(chalk.yellow('No sessions found'));
  } else {
    console.log(chalk.gray(`Total: ${total} session(s)`));
  }
}

/**
 * Initialize a new session
 * @param {string} sessionId - Session ID
 * @param {Object} options - CLI options
 */
async function initAction(sessionId, options) {
  if (!sessionId) {
    console.error(chalk.red('Session ID is required'));
    console.error(chalk.gray('Usage: ccw session init <session_id> [--type <type>]'));
    process.exit(1);
  }

  const params = {
    operation: 'init',
    session_id: sessionId,
    session_type: options.type || 'workflow'
  };

  const result = await executeTool('session_manager', params);

  if (!result.success) {
    console.error(chalk.red(`Error: ${result.error}`));
    process.exit(1);
  }

  // Emit SESSION_CREATED event
  notifyDashboard({
    type: 'SESSION_CREATED',
    sessionId: sessionId,
    payload: result.result
  });

  console.log(chalk.green(`✓ Session "${sessionId}" initialized`));
  console.log(chalk.gray(`  Location: ${result.result.path}`));
}

/**
 * Read session content
 * @param {string} sessionId - Session ID
 * @param {Object} options - CLI options
 */
async function readAction(sessionId, options) {
  if (!sessionId) {
    console.error(chalk.red('Session ID is required'));
    console.error(chalk.gray('Usage: ccw session read <session_id> --type <content_type>'));
    process.exit(1);
  }

  const params = {
    operation: 'read',
    session_id: sessionId,
    content_type: options.type || 'session'
  };

  // Add path_params if provided
  if (options.taskId) params.path_params = { ...params.path_params, task_id: options.taskId };
  if (options.filename) params.path_params = { ...params.path_params, filename: options.filename };
  if (options.dimension) params.path_params = { ...params.path_params, dimension: options.dimension };
  if (options.iteration) params.path_params = { ...params.path_params, iteration: options.iteration };

  const result = await executeTool('session_manager', params);

  if (!result.success) {
    console.error(chalk.red(`Error: ${result.error}`));
    process.exit(1);
  }

  // Output raw content for piping
  if (options.raw) {
    console.log(typeof result.result.content === 'string'
      ? result.result.content
      : JSON.stringify(result.result.content, null, 2));
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

/**
 * Write session content
 * @param {string} sessionId - Session ID
 * @param {Object} options - CLI options
 */
async function writeAction(sessionId, options) {
  if (!sessionId) {
    console.error(chalk.red('Session ID is required'));
    console.error(chalk.gray('Usage: ccw session write <session_id> --type <content_type> --content <json>'));
    process.exit(1);
  }

  if (!options.content) {
    console.error(chalk.red('Content is required (--content)'));
    process.exit(1);
  }

  let content;
  try {
    content = JSON.parse(options.content);
  } catch {
    // If not JSON, treat as string content
    content = options.content;
  }

  const params = {
    operation: 'write',
    session_id: sessionId,
    content_type: options.type || 'session',
    content
  };

  // Add path_params if provided
  if (options.taskId) params.path_params = { ...params.path_params, task_id: options.taskId };
  if (options.filename) params.path_params = { ...params.path_params, filename: options.filename };

  const result = await executeTool('session_manager', params);

  if (!result.success) {
    console.error(chalk.red(`Error: ${result.error}`));
    process.exit(1);
  }

  // Emit granular event based on content_type
  const contentType = params.content_type;
  let eventType = 'CONTENT_WRITTEN';
  let entityId = null;

  switch (contentType) {
    case 'task':
      eventType = 'TASK_CREATED';
      entityId = options.taskId || content.task_id;
      break;
    case 'summary':
      eventType = 'SUMMARY_WRITTEN';
      entityId = options.taskId;
      break;
    case 'plan':
      eventType = 'PLAN_UPDATED';
      break;
    case 'review-dim':
      eventType = 'REVIEW_UPDATED';
      entityId = options.dimension;
      break;
    case 'review-iter':
      eventType = 'REVIEW_UPDATED';
      entityId = options.iteration;
      break;
    case 'review-fix':
      eventType = 'REVIEW_UPDATED';
      entityId = options.filename;
      break;
    case 'session':
      eventType = 'SESSION_UPDATED';
      break;
  }

  notifyDashboard({
    type: eventType,
    sessionId: sessionId,
    entityId: entityId,
    contentType: contentType,
    payload: result.result.written_content || content
  });

  console.log(chalk.green(`✓ Content written to ${result.result.path}`));
}

/**
 * Update session content (merge)
 * @param {string} sessionId - Session ID
 * @param {Object} options - CLI options
 */
async function updateAction(sessionId, options) {
  if (!sessionId) {
    console.error(chalk.red('Session ID is required'));
    console.error(chalk.gray('Usage: ccw session update <session_id> --content <json>'));
    process.exit(1);
  }

  if (!options.content) {
    console.error(chalk.red('Content is required (--content)'));
    process.exit(1);
  }

  let content;
  try {
    content = JSON.parse(options.content);
  } catch (e) {
    console.error(chalk.red('Content must be valid JSON for update operation'));
    console.error(chalk.gray(`Parse error: ${e.message}`));
    process.exit(1);
  }

  const params = {
    operation: 'update',
    session_id: sessionId,
    content_type: options.type || 'session',
    content
  };

  // Add path_params if task update
  if (options.taskId) params.path_params = { task_id: options.taskId };

  const result = await executeTool('session_manager', params);

  if (!result.success) {
    console.error(chalk.red(`Error: ${result.error}`));
    process.exit(1);
  }

  // Emit granular event based on content_type
  const eventType = params.content_type === 'task' ? 'TASK_UPDATED' : 'SESSION_UPDATED';
  notifyDashboard({
    type: eventType,
    sessionId: sessionId,
    entityId: options.taskId || null,
    payload: result.result.merged_data || content
  });

  console.log(chalk.green(`✓ Session "${sessionId}" updated`));
}

/**
 * Archive a session
 * @param {string} sessionId - Session ID
 * @param {Object} options - CLI options
 */
async function archiveAction(sessionId, options) {
  if (!sessionId) {
    console.error(chalk.red('Session ID is required'));
    console.error(chalk.gray('Usage: ccw session archive <session_id>'));
    process.exit(1);
  }

  const params = {
    operation: 'archive',
    session_id: sessionId,
    update_status: options.updateStatus !== false
  };

  const result = await executeTool('session_manager', params);

  if (!result.success) {
    console.error(chalk.red(`Error: ${result.error}`));
    process.exit(1);
  }

  // Emit SESSION_ARCHIVED event
  notifyDashboard({
    type: 'SESSION_ARCHIVED',
    sessionId: sessionId,
    payload: result.result
  });

  console.log(chalk.green(`✓ Session "${sessionId}" archived`));
  console.log(chalk.gray(`  Location: ${result.result.destination}`));
}

/**
 * Update session status (shortcut)
 * @param {string} sessionId - Session ID
 * @param {string} newStatus - New status value
 */
async function statusAction(sessionId, newStatus) {
  if (!sessionId) {
    console.error(chalk.red('Session ID is required'));
    console.error(chalk.gray('Usage: ccw session status <session_id> <status>'));
    process.exit(1);
  }

  if (!newStatus) {
    console.error(chalk.red('Status is required'));
    console.error(chalk.gray('Valid statuses: planning, active, implementing, reviewing, completed, paused'));
    process.exit(1);
  }

  const validStatuses = ['planning', 'active', 'implementing', 'reviewing', 'completed', 'paused'];
  if (!validStatuses.includes(newStatus)) {
    console.error(chalk.red(`Invalid status: ${newStatus}`));
    console.error(chalk.gray(`Valid statuses: ${validStatuses.join(', ')}`));
    process.exit(1);
  }

  const params = {
    operation: 'update',
    session_id: sessionId,
    content_type: 'session',
    content: { status: newStatus, updated_at: new Date().toISOString() }
  };

  const result = await executeTool('session_manager', params);

  if (!result.success) {
    console.error(chalk.red(`Error: ${result.error}`));
    process.exit(1);
  }

  // Emit SESSION_UPDATED event
  notifyDashboard({
    type: 'SESSION_UPDATED',
    sessionId: sessionId,
    payload: { status: newStatus }
  });

  console.log(chalk.green(`✓ Session "${sessionId}" status → ${newStatus}`));
}

/**
 * Update task status (shortcut)
 * @param {string} sessionId - Session ID
 * @param {string} taskId - Task ID
 * @param {string} newStatus - New status value
 */
async function taskAction(sessionId, taskId, newStatus) {
  if (!sessionId) {
    console.error(chalk.red('Session ID is required'));
    console.error(chalk.gray('Usage: ccw session task <session_id> <task_id> <status>'));
    process.exit(1);
  }

  if (!taskId) {
    console.error(chalk.red('Task ID is required'));
    console.error(chalk.gray('Usage: ccw session task <session_id> <task_id> <status>'));
    process.exit(1);
  }

  if (!newStatus) {
    console.error(chalk.red('Status is required'));
    console.error(chalk.gray('Valid statuses: pending, in_progress, completed, blocked, cancelled'));
    process.exit(1);
  }

  const validStatuses = ['pending', 'in_progress', 'completed', 'blocked', 'cancelled'];
  if (!validStatuses.includes(newStatus)) {
    console.error(chalk.red(`Invalid status: ${newStatus}`));
    console.error(chalk.gray(`Valid statuses: ${validStatuses.join(', ')}`));
    process.exit(1);
  }

  // First, read the current task to get existing status
  const readParams = {
    operation: 'read',
    session_id: sessionId,
    content_type: 'task',
    path_params: { task_id: taskId }
  };

  const readResult = await executeTool('session_manager', readParams);

  let currentTask = {};
  let oldStatus = 'unknown';

  if (readResult.success) {
    currentTask = readResult.result.content || {};
    oldStatus = currentTask.status || 'unknown';
  }

  // Build status history entry
  const historyEntry = {
    from: oldStatus,
    to: newStatus,
    changed_at: new Date().toISOString()
  };

  // Update task with new status and appended history
  const params = {
    operation: 'update',
    session_id: sessionId,
    content_type: 'task',
    path_params: { task_id: taskId },
    content: {
      status: newStatus,
      updated_at: new Date().toISOString(),
      status_history: [...(currentTask.status_history || []), historyEntry]
    }
  };

  const result = await executeTool('session_manager', params);

  if (!result.success) {
    console.error(chalk.red(`Error: ${result.error}`));
    process.exit(1);
  }

  // Emit TASK_UPDATED event
  notifyDashboard({
    type: 'TASK_UPDATED',
    sessionId: sessionId,
    entityId: taskId,
    payload: { status: newStatus }
  });

  console.log(chalk.green(`✓ Task "${taskId}" status → ${newStatus}`));
}

/**
 * Create directory within session
 * @param {string} sessionId - Session ID
 * @param {Object} options - CLI options
 */
async function mkdirAction(sessionId, options) {
  if (!sessionId) {
    console.error(chalk.red('Session ID is required'));
    console.error(chalk.gray('Usage: ccw session mkdir <session_id> --subdir <subdir>'));
    process.exit(1);
  }

  if (!options.subdir) {
    console.error(chalk.red('Subdirectory is required (--subdir)'));
    process.exit(1);
  }

  const params = {
    operation: 'mkdir',
    session_id: sessionId,
    dirs: [options.subdir]  // Convert single subdir to array
  };

  const result = await executeTool('session_manager', params);

  if (!result.success) {
    console.error(chalk.red(`Error: ${result.error}`));
    process.exit(1);
  }

  console.log(chalk.green(`✓ Directory created: ${result.result.directories_created.join(', ')}`));
}

/**
 * Execute raw operation (advanced)
 * @param {string} jsonParams - JSON parameters
 */

/**
 * Delete file within session
 * @param {string} sessionId - Session ID
 * @param {string} filePath - Relative file path
 */
async function deleteAction(sessionId, filePath) {
  if (!sessionId) {
    console.error(chalk.red('Session ID is required'));
    console.error(chalk.gray('Usage: ccw session delete <session_id> <file_path>'));
    process.exit(1);
  }

  if (!filePath) {
    console.error(chalk.red('File path is required'));
    console.error(chalk.gray('Usage: ccw session delete <session_id> <file_path>'));
    process.exit(1);
  }

  const params = {
    operation: 'delete',
    session_id: sessionId,
    file_path: filePath
  };

  const result = await executeTool('session_manager', params);

  if (!result.success) {
    console.error(chalk.red(`Error: ${result.error}`));
    process.exit(1);
  }

  // Emit FILE_DELETED event
  notifyDashboard({
    type: 'FILE_DELETED',
    sessionId: sessionId,
    payload: { file_path: filePath }
  });

  console.log(chalk.green(`✓ File deleted: ${result.result.deleted}`));
}

/**
 * Get session statistics
 * @param {string} sessionId - Session ID
 */
async function statsAction(sessionId, options = {}) {
  if (!sessionId) {
    console.error(chalk.red('Session ID is required'));
    console.error(chalk.gray('Usage: ccw session stats <session_id>'));
    process.exit(1);
  }

  const params = {
    operation: 'stats',
    session_id: sessionId
  };

  const result = await executeTool('session_manager', params);

  if (!result.success) {
    console.error(chalk.red(`Error: ${result.error}`));
    process.exit(1);
  }

  const { tasks, summaries, has_plan, location } = result.result;

  console.log(chalk.bold.cyan(`\nSession Statistics: ${sessionId}`));
  console.log(chalk.gray(`Location: ${location}\n`));

  console.log(chalk.bold.white('Tasks:'));
  console.log(chalk.gray(`  Total:        ${tasks.total}`));
  console.log(chalk.green(`  Completed:    ${tasks.completed}`));
  console.log(chalk.yellow(`  In Progress:  ${tasks.in_progress}`));
  console.log(chalk.blue(`  Pending:      ${tasks.pending}`));
  console.log(chalk.red(`  Blocked:      ${tasks.blocked}`));
  console.log(chalk.gray(`  Cancelled:    ${tasks.cancelled}\n`));

  console.log(chalk.bold.white('Documentation:'));
  console.log(chalk.gray(`  Summaries:    ${summaries}`));
  console.log(chalk.gray(`  Plan:         ${has_plan ? 'Yes' : 'No'}`));
}
async function execAction(jsonParams) {
  if (!jsonParams) {
    console.error(chalk.red('JSON parameters required'));
    console.error(chalk.gray('Usage: ccw session exec \'{"operation":"list","location":"active"}\''));
    process.exit(1);
  }

  let params;
  try {
    params = JSON.parse(jsonParams);
  } catch (e) {
    console.error(chalk.red('Invalid JSON'));
    console.error(chalk.gray(`Parse error: ${e.message}`));
    process.exit(1);
  }

  const result = await executeTool('session_manager', params);
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Session command entry point
 * @param {string} subcommand - Subcommand
 * @param {string[]} args - Arguments
 * @param {Object} options - CLI options
 */
export async function sessionCommand(subcommand, args, options) {
  const argsArray = Array.isArray(args) ? args : (args ? [args] : []);

  switch (subcommand) {
    case 'list':
      await listAction(options);
      break;
    case 'init':
      await initAction(argsArray[0], options);
      break;
    case 'read':
      await readAction(argsArray[0], options);
      break;
    case 'write':
      await writeAction(argsArray[0], options);
      break;
    case 'update':
      await updateAction(argsArray[0], options);
      break;
    case 'archive':
      await archiveAction(argsArray[0], options);
      break;
    case 'status':
      await statusAction(argsArray[0], argsArray[1]);
      break;
    case 'task':
      await taskAction(argsArray[0], argsArray[1], argsArray[2]);
      break;
    case 'mkdir':
      await mkdirAction(argsArray[0], options);
      break;
    case 'delete':
      await deleteAction(argsArray[0], argsArray[1]);
      break;
    case 'stats':
      await statsAction(argsArray[0], options);
      break;
    case 'exec':
      await execAction(argsArray[0]);
      break;
    default:
      console.log(chalk.bold.cyan('\nCCW Session Management\n'));
      console.log('Subcommands:');
      console.log(chalk.gray('  list                                    List all sessions'));
      console.log(chalk.gray('  init <session_id>                       Initialize new session'));
      console.log(chalk.gray('  status <session_id> <status>            Update session status'));
      console.log(chalk.gray('  task <session_id> <task_id> <status>    Update task status'));
      console.log(chalk.gray('  stats <session_id>                      Get session statistics'));
      console.log(chalk.gray('  delete <session_id> <file_path>         Delete file within session'));
      console.log(chalk.gray('  read <session_id>                       Read session content'));
      console.log(chalk.gray('  write <session_id>                      Write session content'));
      console.log(chalk.gray('  update <session_id>                     Update session (merge)'));
      console.log(chalk.gray('  archive <session_id>                    Archive session'));
      console.log(chalk.gray('  mkdir <session_id>                      Create subdirectory'));
      console.log(chalk.gray('  exec <json>                             Execute raw operation'));
      console.log();
      console.log('Status Values:');
      console.log(chalk.gray('  Session: planning, active, implementing, reviewing, completed, paused'));
      console.log(chalk.gray('  Task:    pending, in_progress, completed, blocked, cancelled'));
      console.log();
      console.log('Examples:');
      console.log(chalk.gray('  ccw session list'));
      console.log(chalk.gray('  ccw session init WFS-my-feature'));
      console.log(chalk.gray('  ccw session status WFS-my-feature active'));
      console.log(chalk.gray('  ccw session task WFS-my-feature IMPL-001 completed'));
      console.log(chalk.gray('  ccw session stats WFS-my-feature'));
      console.log(chalk.gray('  ccw session delete WFS-my-feature .archiving'));
      console.log(chalk.gray('  ccw session archive WFS-my-feature'));
  }
}
