/**
 * Session Command - Workflow session lifecycle management
 * Adapter for session_manager tool providing direct CLI access
 */

import chalk from 'chalk';
import http from 'http';
import { executeTool } from '../tools/index.js';
import { resolveFilePath, PathResolutionError, type ResolverContext } from './session-path-resolver.js';

// Handle EPIPE errors gracefully (occurs when piping to head/jq that closes early)
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') {
    process.exit(0);
  }
  throw err;
});

interface ListOptions {
  location?: string;
  metadata?: boolean;
}

interface InitOptions {
  type?: string;
  content?: string;  // JSON string for custom metadata
  location?: string; // Session location: active | lite-plan | lite-fix
}

interface ReadOptions {
  type?: string;
  taskId?: string;
  filename?: string;
  dimension?: string;
  iteration?: string;
  raw?: boolean;
}

interface WriteOptions {
  type?: string;
  content?: string;
  taskId?: string;
  filename?: string;
  dimension?: string;
  iteration?: string;
}

interface UpdateOptions {
  type?: string;
  content?: string;
  taskId?: string;
}

interface ArchiveOptions {
  updateStatus?: boolean;
}

interface MkdirOptions {
  subdir?: string;
}

interface StatsOptions {}

/**
 * Notify dashboard of granular events (fire and forget)
 * @param {Object} data - Event data
 */
function notifyDashboard(data: any): void {
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
async function listAction(options: ListOptions): Promise<void> {
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

  const { active = [], archived = [], total } = (result.result as any);

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
async function initAction(sessionId: string | undefined, options: InitOptions): Promise<void> {
  if (!sessionId) {
    console.error(chalk.red('Session ID is required'));
    console.error(chalk.gray('Usage: ccw session init <session_id> [--location <location>] [--type <type>] [--content <json>]'));
    process.exit(1);
  }

  // Auto-infer location from type if not explicitly provided
  // When type is 'lite-plan' or 'lite-fix', default location should match the type
  const sessionLocation = options.location || 
    (options.type === 'lite-plan' ? 'lite-plan' :
     options.type === 'lite-fix' ? 'lite-fix' :
     'active');
  
  // Infer type from location if not explicitly provided
  const sessionType = options.type || (sessionLocation === 'active' ? 'workflow' : sessionLocation);

  // Parse custom metadata from --content if provided
  let customMetadata: any = {};
  if (options.content) {
    try {
      customMetadata = JSON.parse(options.content);
    } catch (e) {
      const error = e as Error;
      console.error(chalk.red('Invalid JSON in --content parameter'));
      console.error(chalk.gray(`Parse error: ${error.message}`));
      process.exit(1);
    }
  }

  // Filter custom metadata: only allow safe fields, block system-critical fields
  const blockedFields = ['session_id', 'type', 'status', 'created_at', 'updated_at', 'archived_at'];
  const filteredCustomMetadata: any = {};
  for (const key in customMetadata) {
    if (!blockedFields.includes(key)) {
      filteredCustomMetadata[key] = customMetadata[key];
    } else {
      console.warn(chalk.yellow(`⚠  WARNING: Field '${key}' in --content is reserved and will be ignored`));
    }
  }

  // Merge metadata: defaults < custom (filtered) < required fields
  const metadata: any = Object.assign(
    {
      session_id: sessionId,
      type: sessionType,
      status: 'planning',
      created_at: new Date().toISOString()
    },
    filteredCustomMetadata,  // User custom fields (filtered)
    {
      session_id: sessionId,  // Force override - always use CLI param
      type: sessionType       // Force override - always use --type or default
    }
  );

  const params: any = {
    operation: 'init',
    session_id: sessionId,
    metadata: metadata,
    location: sessionLocation  // Always pass location to session_manager
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

  // Lite sessions (lite-plan, lite-fix) use session-metadata.json, others use workflow-session.json
  const metadataFile = sessionLocation.startsWith('lite-') ? 'session-metadata.json' : 'workflow-session.json';

  console.log(chalk.green(`✓ Session "${sessionId}" initialized`));
  console.log(chalk.gray(`  Location: ${(result.result as any).path}`));
  console.log(chalk.gray(`  Metadata: ${metadataFile} created`));
}

/**
 * Get session information (location and path)
 * Helper function for path resolution
 */
async function getSessionInfo(sessionId: string): Promise<{ path: string; location: 'active' | 'archived' | 'lite-plan' | 'lite-fix' }> {
  // Use session_manager to find the session
  const findParams = {
    operation: 'list',
    location: 'all',
    include_metadata: false
  };

  const result = await executeTool('session_manager', findParams);

  if (!result.success) {
    throw new Error(`Failed to list sessions: ${result.error}`);
  }

  const resultData = result.result as any;
  const allSessions = [
    ...(resultData.active || []).map((s: any) => ({ ...s, location: 'active' as const })),
    ...(resultData.archived || []).map((s: any) => ({ ...s, location: 'archived' as const })),
    ...(resultData.litePlan || []).map((s: any) => ({ ...s, location: 'lite-plan' as const })),
    ...(resultData.liteFix || []).map((s: any) => ({ ...s, location: 'lite-fix' as const })),
  ];

  const session = allSessions.find((s: any) => s.session_id === sessionId || s.id === sessionId);

  if (!session) {
    throw new Error(`Session "${sessionId}" not found in active, archived, lite-plan, or lite-fix locations`);
  }

  // Return actual session path from the session object
  return {
    path: session.path || '',
    location: session.location
  };
}

/**
 * Read session content (NEW - with path resolution)
 * @param {string} sessionId - Session ID
 * @param {string} filename - Filename or relative path
 * @param {Object} options - CLI options
 */
async function readAction(
  sessionId: string | undefined,
  filename: string | undefined,
  options: ReadOptions
): Promise<void> {
  if (!sessionId) {
    console.error(chalk.red('Session ID is required'));
    console.error(chalk.gray('Usage: ccw session <session-id> read <filename|path>'));
    process.exit(1);
  }

  // Backward compatibility: if --type is provided, use legacy implementation
  if (options.type) {
    console.warn(chalk.yellow('⚠  WARNING: --type parameter is deprecated'));
    console.warn(chalk.gray('   Old: ccw session read WFS-001 --type task --task-id IMPL-001'));
    console.warn(chalk.gray('   New: ccw session WFS-001 read IMPL-001.json'));
    console.log();
    return readActionLegacy(sessionId, options);
  }

  if (!filename) {
    console.error(chalk.red('Filename is required'));
    console.error(chalk.gray('Usage: ccw session <session-id> read <filename|path>'));
    console.error(chalk.gray(''));
    console.error(chalk.gray('Examples:'));
    console.error(chalk.gray('  ccw session WFS-001 read IMPL-001.json'));
    console.error(chalk.gray('  ccw session WFS-001 read IMPL_PLAN.md'));
    console.error(chalk.gray('  ccw session WFS-001 read .task/IMPL-001.json'));
    process.exit(1);
  }

  try {
    // Get session context
    const session = await getSessionInfo(sessionId);
    const context: ResolverContext = {
      sessionPath: session.path,
      sessionLocation: session.location
    };

    // Resolve filename to content_type
    const resolved = resolveFilePath(filename, context);

    // Call session_manager tool
    const params: any = {
      operation: 'read',
      session_id: sessionId,
      content_type: resolved.contentType,
    };

    if (resolved.pathParams) {
      params.path_params = resolved.pathParams;
    }

    const result = await executeTool('session_manager', params);

    if (!result.success) {
      console.error(chalk.red(`Error: ${result.error}`));
      process.exit(1);
    }

    // Output raw content for piping
    if (options.raw) {
      console.log(typeof (result.result as any).content === 'string'
        ? (result.result as any).content
        : JSON.stringify((result.result as any).content, null, 2));
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error: any) {
    if (error instanceof PathResolutionError) {
      console.error(chalk.red(`Error: ${error.message}`));
      if (error.suggestions.length > 0) {
        console.log(chalk.yellow('\nSuggestions:'));
        error.suggestions.forEach(s => console.log(chalk.gray(`  ${s}`)));
      }
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Read session content (LEGACY - with --type parameter)
 * @param {string} sessionId - Session ID
 * @param {Object} options - CLI options
 */
async function readActionLegacy(sessionId: string | undefined, options: ReadOptions): Promise<void> {
  if (!sessionId) {
    console.error(chalk.red('Session ID is required'));
    console.error(chalk.gray('Usage: ccw session read <session_id> --type <content_type>'));
    process.exit(1);
  }

  const params: any = {
    operation: 'read',
    session_id: sessionId,
    content_type: options.type || 'session'
  };

  // Add path_params if provided
  if (options.taskId) params.path_params = { ...(params.path_params || {}), task_id: options.taskId };
  if (options.filename) params.path_params = { ...(params.path_params || {}), filename: options.filename };
  if (options.dimension) params.path_params = { ...(params.path_params || {}), dimension: options.dimension };
  if (options.iteration) params.path_params = { ...(params.path_params || {}), iteration: options.iteration };

  const result = await executeTool('session_manager', params);

  if (!result.success) {
    console.error(chalk.red(`Error: ${result.error}`));
    process.exit(1);
  }

  // Output raw content for piping
  if (options.raw) {
    console.log(typeof (result.result as any).content === 'string'
      ? (result.result as any).content
      : JSON.stringify((result.result as any).content, null, 2));
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

/**
 * Write session content (NEW - with path resolution)
 * @param {string} sessionId - Session ID
 * @param {string} filename - Filename or relative path
 * @param {string} contentString - Content to write
 * @param {Object} options - CLI options
 */
async function writeAction(
  sessionId: string | undefined,
  filename: string | undefined,
  contentString: string | undefined,
  options: WriteOptions
): Promise<void> {
  if (!sessionId) {
    console.error(chalk.red('Session ID is required'));
    console.error(chalk.gray('Usage: ccw session <session-id> write <filename|path> <content>'));
    process.exit(1);
  }

  // Backward compatibility: if --type is provided, use legacy implementation
  if (options.type) {
    console.warn(chalk.yellow('⚠  WARNING: --type parameter is deprecated'));
    console.warn(chalk.gray('   Old: ccw session write WFS-001 --type plan --content "# Plan"'));
    console.warn(chalk.gray('   New: ccw session WFS-001 write IMPL_PLAN.md "# Plan"'));
    console.log();
    return writeActionLegacy(sessionId, options);
  }

  if (!filename || !contentString) {
    console.error(chalk.red('Filename and content are required'));
    console.error(chalk.gray('Usage: ccw session <session-id> write <filename|path> <content>'));
    console.error(chalk.gray(''));
    console.error(chalk.gray('Examples:'));
    console.error(chalk.gray('  ccw session WFS-001 write IMPL_PLAN.md "# Implementation Plan"'));
    console.error(chalk.gray('  ccw session WFS-001 write IMPL-001.json \'{"id":"IMPL-001","status":"pending"}\''));
    console.error(chalk.gray('  ccw session WFS-001 write .task/IMPL-001.json \'{"status":"completed"}\''));
    process.exit(1);
  }

  try {
    // Get session context
    const session = await getSessionInfo(sessionId);
    const context: ResolverContext = {
      sessionPath: session.path,
      sessionLocation: session.location
    };

    // Resolve filename to content_type
    const resolved = resolveFilePath(filename, context);

    // Parse content (try JSON first, fallback to string)
    let content: any;
    try {
      content = JSON.parse(contentString);
    } catch {
      content = contentString;
    }

    // Call session_manager tool
    const params: any = {
      operation: 'write',
      session_id: sessionId,
      content_type: resolved.contentType,
      content,
    };

    if (resolved.pathParams) {
      params.path_params = resolved.pathParams;
    }

    const result = await executeTool('session_manager', params);

    if (!result.success) {
      console.error(chalk.red(`Error: ${result.error}`));
      process.exit(1);
    }

    // Emit granular event based on content_type
    const contentType = resolved.contentType;
    let eventType = 'CONTENT_WRITTEN';
    let entityId = null;

    switch (contentType) {
      case 'task':
        eventType = 'TASK_CREATED';
        entityId = resolved.pathParams?.task_id || content.task_id;
        break;
      case 'summary':
        eventType = 'SUMMARY_WRITTEN';
        entityId = resolved.pathParams?.task_id;
        break;
      case 'plan':
        eventType = 'PLAN_UPDATED';
        break;
      case 'review-dim':
        eventType = 'REVIEW_UPDATED';
        entityId = resolved.pathParams?.dimension;
        break;
      case 'review-iter':
        eventType = 'REVIEW_UPDATED';
        entityId = resolved.pathParams?.iteration;
        break;
      case 'review-fix':
        eventType = 'REVIEW_UPDATED';
        entityId = resolved.pathParams?.filename;
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
      payload: (result.result as any).written_content || content
    });

    console.log(chalk.green(`✓ Content written to ${resolved.resolvedPath}`));
  } catch (error: any) {
    if (error instanceof PathResolutionError) {
      console.error(chalk.red(`Error: ${error.message}`));
      if (error.suggestions.length > 0) {
        console.log(chalk.yellow('\nSuggestions:'));
        error.suggestions.forEach(s => console.log(chalk.gray(`  ${s}`)));
      }
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Write session content (LEGACY - with --type parameter)
 * @param {string} sessionId - Session ID
 * @param {Object} options - CLI options
 */
async function writeActionLegacy(sessionId: string | undefined, options: WriteOptions): Promise<void> {
  if (!sessionId) {
    console.error(chalk.red('Session ID is required'));
    console.error(chalk.gray('Usage: ccw session write <session_id> --type <content_type> --content <json>'));
    process.exit(1);
  }

  if (!options.content) {
    console.error(chalk.red('Content is required (--content)'));
    process.exit(1);
  }

  let content: any;
  try {
    content = JSON.parse(options.content);
  } catch {
    // If not JSON, treat as string content
    content = options.content;
  }

  const params: any = {
    operation: 'write',
    session_id: sessionId,
    content_type: options.type || 'session',
    content
  };

  // Add path_params if provided
  if (options.taskId) params.path_params = { ...(params.path_params || {}), task_id: options.taskId };
  if (options.filename) params.path_params = { ...(params.path_params || {}), filename: options.filename };

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
    payload: (result.result as any).written_content || content
  });

  console.log(chalk.green(`✓ Content written to ${(result.result as any).path}`));
}

/**
 * Update session content (merge)
 * @param {string} sessionId - Session ID
 * @param {Object} options - CLI options
 */
async function updateAction(sessionId: string | undefined, options: UpdateOptions): Promise<void> {
  if (!sessionId) {
    console.error(chalk.red('Session ID is required'));
    console.error(chalk.gray('Usage: ccw session update <session_id> --content <json>'));
    process.exit(1);
  }

  if (!options.content) {
    console.error(chalk.red('Content is required (--content)'));
    process.exit(1);
  }

  let content: any;
  try {
    content = JSON.parse(options.content);
  } catch (e) {
    const error = e as Error;
    console.error(chalk.red('Content must be valid JSON for update operation'));
    console.error(chalk.gray(`Parse error: ${error.message}`));
    process.exit(1);
  }

  const params: any = {
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
    payload: (result.result as any).merged_data || content
  });

  console.log(chalk.green(`✓ Session "${sessionId}" updated`));
}

/**
 * Archive a session
 * @param {string} sessionId - Session ID
 * @param {Object} options - CLI options
 */
async function archiveAction(sessionId: string | undefined, options: ArchiveOptions): Promise<void> {
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
  console.log(chalk.gray(`  Location: ${(result.result as any).destination}`));
}

/**
 * Update session status (shortcut)
 * @param {string} sessionId - Session ID
 * @param {string} newStatus - New status value
 */
async function statusAction(sessionId: string | undefined, newStatus: string | undefined): Promise<void> {
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
async function taskAction(
  sessionId: string | undefined,
  taskId: string | undefined,
  newStatus: string | undefined
): Promise<void> {
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

  let currentTask: any = {};
  let oldStatus = 'unknown';

  if (readResult.success) {
    currentTask = (readResult.result as any).content || {};
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
async function mkdirAction(sessionId: string | undefined, options: MkdirOptions): Promise<void> {
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

  // Emit DIRECTORY_CREATED event
  notifyDashboard({
    type: 'DIRECTORY_CREATED',
    sessionId: sessionId,
    payload: { directories: (result.result as any).directories_created }
  });

  console.log(chalk.green(`✓ Directory created: ${(result.result as any).directories_created.join(', ')}`));
}

/**
 * Delete file within session
 * @param {string} sessionId - Session ID
 * @param {string} filePath - Relative file path
 */
async function deleteAction(sessionId: string | undefined, filePath: string | undefined): Promise<void> {
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

  console.log(chalk.green(`✓ File deleted: ${(result.result as any).deleted}`));
}

/**
 * Get session statistics
 * @param {string} sessionId - Session ID
 */
async function statsAction(sessionId: string | undefined, options: StatsOptions = {}): Promise<void> {
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

  const { tasks, summaries, has_plan, location } = (result.result as any);

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

async function execAction(jsonParams: string | undefined): Promise<void> {
  if (!jsonParams) {
    console.error(chalk.red('JSON parameters required'));
    console.error(chalk.gray('Usage: ccw session exec \'{"operation":"list","location":"active"}\''));
    process.exit(1);
  }

  let params: any;
  try {
    params = JSON.parse(jsonParams);
  } catch (e) {
    const error = e as Error;
    console.error(chalk.red('Invalid JSON'));
    console.error(chalk.gray(`Parse error: ${error.message}`));
    process.exit(1);
  }

  const result = await executeTool('session_manager', params);

  // Emit notification for write operations
  if (result.success && params.operation) {
    const writeOps = ['init', 'write', 'update', 'archive', 'mkdir', 'delete'];
    if (writeOps.includes(params.operation)) {
      const eventMap: Record<string, string> = {
        init: 'SESSION_CREATED',
        write: 'CONTENT_WRITTEN',
        update: 'SESSION_UPDATED',
        archive: 'SESSION_ARCHIVED',
        mkdir: 'DIRECTORY_CREATED',
        delete: 'FILE_DELETED'
      };
      notifyDashboard({
        type: eventMap[params.operation] || 'SESSION_UPDATED',
        sessionId: params.session_id,
        operation: params.operation,
        payload: result.result
      });
    }
  }

  console.log(JSON.stringify(result, null, 2));
}

/**
 * Session command entry point
 * @param {string} subcommand - Subcommand
 * @param {string[]} args - Arguments
 * @param {Object} options - CLI options
 */
export async function sessionCommand(
  subcommand: string,
  args: string | string[],
  options: any
): Promise<void> {
  let argsArray = Array.isArray(args) ? args : (args ? [args] : []);

  // Detect new format: ccw session WFS-xxx <operation> <args>
  // If subcommand looks like a session ID, rearrange parameters
  // Exception: 'init' should always use traditional format (ccw session init WFS-xxx)
  const isSessionId = subcommand && (
    subcommand.startsWith('WFS-') ||
    subcommand === 'manifest' ||
    subcommand === 'project' ||
    /^[A-Z][A-Z0-9]*-[A-Z0-9]+/.test(subcommand)  // Generic session ID pattern (uppercase prefix + dash + alphanumeric)
  );

  if (isSessionId && argsArray.length > 0) {
    const operation = argsArray[0];

    // Reject new format for init operation (semantic error)
    if (operation === 'init') {
      console.error(chalk.red('Error: Invalid format for init operation'));
      console.error(chalk.gray('Correct: ccw session init <session-id>'));
      console.error(chalk.gray(`Wrong:   ccw session <session-id> init`));
      console.error(chalk.yellow('\nReason: Session must be initialized before it can be referenced'));
      process.exit(1);
    }

    // New format detected: session-id comes first
    const sessionId = subcommand;
    const operationArgs = argsArray.slice(1);

    // Rearrange: operation becomes subcommand, session-id goes into args
    subcommand = operation;
    argsArray = [sessionId, ...operationArgs];
  }

  switch (subcommand) {
    case 'list':
      await listAction(options);
      break;
    case 'init':
      await initAction(argsArray[0], options);
      break;
    case 'read':
      // args[0] = session-id, args[1] = filename (optional for backward compat)
      await readAction(argsArray[0], argsArray[1], options);
      break;
    case 'write':
      // args[0] = session-id, args[1] = filename, args[2] = content
      await writeAction(argsArray[0], argsArray[1], argsArray[2], options);
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
      console.log(chalk.gray('  list                                      List all sessions'));
      console.log(chalk.gray('  <session-id> init [metadata]              Initialize new session'));
      console.log(chalk.gray('  <session-id> read <filename|path>         Read session content'));
      console.log(chalk.gray('  <session-id> write <filename> <content>   Write session content'));
      console.log(chalk.gray('  <session-id> stats                        Get session statistics'));
      console.log(chalk.gray('  <session-id> archive                      Archive session'));
      console.log(chalk.gray('  <session-id> status <status>              Update session status'));
      console.log(chalk.gray('  <session-id> task <task-id> <status>      Update task status'));
      console.log(chalk.gray('  <session-id> delete <file-path>           Delete file within session'));
      console.log(chalk.gray('  <session-id> update                       Update session (merge)'));
      console.log(chalk.gray('  <session-id> mkdir                        Create subdirectory'));
      console.log(chalk.gray('  exec <json>                               Execute raw operation'));
      console.log();
      console.log('Filename/Path Examples:');
      console.log(chalk.gray('  IMPL-001.json                      Task file (auto: .task/)'));
      console.log(chalk.gray('  .task/IMPL-001.json                Task file (explicit path)'));
      console.log(chalk.gray('  IMPL_PLAN.md                       Implementation plan'));
      console.log(chalk.gray('  TODO_LIST.md                       TODO list'));
      console.log(chalk.gray('  workflow-session.json              Session metadata'));
      console.log(chalk.gray('  .review/dimensions/security.json   Review dimension'));
      console.log();
      console.log('Status Values:');
      console.log(chalk.gray('  Session: planning, active, implementing, reviewing, completed, paused'));
      console.log(chalk.gray('  Task:    pending, in_progress, completed, blocked, cancelled'));
      console.log();
      console.log('Examples:');
      console.log(chalk.gray('  ccw session list'));
      console.log(chalk.gray('  ccw session WFS-001 init'));
      console.log(chalk.gray('  ccw session WFS-001 read IMPL_PLAN.md'));
      console.log(chalk.gray('  ccw session WFS-001 read IMPL-001.json'));
      console.log(chalk.gray('  ccw session WFS-001 write IMPL_PLAN.md "# Plan"'));
      console.log(chalk.gray('  ccw session WFS-001 write IMPL-001.json \'{"status":"pending"}\''));
      console.log(chalk.gray('  ccw session WFS-001 stats'));
      console.log(chalk.gray('  ccw session WFS-001 archive'));
  }
}
