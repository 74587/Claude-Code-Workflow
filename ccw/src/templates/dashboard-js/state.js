// ========================================
// State Management
// ========================================
// Global state variables and template placeholders
// This module must be loaded first as other modules depend on these variables

// ========== Data Placeholders ==========
// These placeholders are replaced by the dashboard generator at build time
let workflowData = {{WORKFLOW_DATA}};
let projectPath = '{{PROJECT_PATH}}';
let recentPaths = {{RECENT_PATHS}};

// ========== Application State ==========
// Current filter for session list view ('all', 'active', 'archived')
let currentFilter = 'all';

// Current lite task type ('lite-plan', 'lite-fix', or null)
let currentLiteType = null;

// Current view mode ('sessions', 'liteTasks', 'project-overview', 'sessionDetail', 'liteTaskDetail')
let currentView = 'sessions';

// Current session detail key (null when not in detail view)
let currentSessionDetailKey = null;

// ========== Data Stores ==========
// Store session data for modal/detail access
// Key: session key, Value: session data object
const sessionDataStore = {};

// Store lite task session data for detail page access
// Key: session key, Value: lite session data object
const liteTaskDataStore = {};

// Store task JSON data in a global map instead of inline script tags
// Key: unique task ID, Value: raw task JSON data
const taskJsonStore = {};

// ========== Global Notification Queue ==========
// Notification queue visible from any view (persisted to localStorage)
const NOTIFICATION_STORAGE_KEY = 'ccw_notifications';
const NOTIFICATION_MAX_STORED = 100;

// Load notifications from localStorage on init
let globalNotificationQueue = loadNotificationsFromStorage();
let isNotificationPanelVisible = false;

/**
 * Load notifications from localStorage
 * @returns {Array} Notification array
 */
function loadNotificationsFromStorage() {
  try {
    const stored = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Filter out notifications older than 7 days
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      return parsed.filter(n => new Date(n.timestamp).getTime() > sevenDaysAgo);
    }
  } catch (e) {
    console.error('[Notifications] Failed to load from storage:', e);
  }
  return [];
}

/**
 * Save notifications to localStorage
 */
function saveNotificationsToStorage() {
  try {
    // Keep only the last N notifications
    const toSave = globalNotificationQueue.slice(0, NOTIFICATION_MAX_STORED);
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error('[Notifications] Failed to save to storage:', e);
  }
}
// ========== Event Handler ==========
/**
 * Handle granular workflow events from CLI
 * @param {Object} event - Event object with type, sessionId, payload
 */
function handleWorkflowEvent(event) {
  const { type, payload, sessionId, entityId } = event;

  switch(type) {
    case 'SESSION_CREATED':
      // Add to activeSessions array
      if (payload) {
        const sessionData = {
          session_id: sessionId,
          ...(payload.metadata || { status: 'planning', created_at: new Date().toISOString() }),
          location: 'active'
        };

        // Add to store
        const key = `session-${sessionId}`.replace(/[^a-zA-Z0-9-]/g, '-');
        sessionDataStore[key] = sessionData;

        // Add to workflowData
        if (!workflowData.activeSessions) workflowData.activeSessions = [];
        workflowData.activeSessions.push(sessionData);
      }
      break;

    case 'SESSION_ARCHIVED':
      // Move from active to archived
      if (!workflowData.activeSessions) workflowData.activeSessions = [];
      if (!workflowData.archivedSessions) workflowData.archivedSessions = [];

      const activeIndex = workflowData.activeSessions.findIndex(s => s.session_id === sessionId);
      if (activeIndex !== -1) {
        const session = workflowData.activeSessions.splice(activeIndex, 1)[0];
        session.location = 'archived';
        if (payload && payload.metadata) {
          Object.assign(session, payload.metadata);
        }
        workflowData.archivedSessions.push(session);

        // Update store
        const key = `session-${sessionId}`.replace(/[^a-zA-Z0-9-]/g, '-');
        sessionDataStore[key] = session;
      }
      break;

    case 'TASK_UPDATED':
      // Find task in session and merge payload
      const taskSessionKey = `session-${sessionId}`.replace(/[^a-zA-Z0-9-]/g, '-');
      const taskSession = sessionDataStore[taskSessionKey];
      if (taskSession && taskSession.tasks) {
        const task = taskSession.tasks.find(t => t.task_id === entityId);
        if (task && payload) {
          Object.assign(task, payload);
        }
      }
      break;

    case 'SESSION_UPDATED':
      // Update session metadata
      const sessionKey = `session-${sessionId}`.replace(/[^a-zA-Z0-9-]/g, '-');
      const session = sessionDataStore[sessionKey];
      if (session && payload) {
        Object.assign(session, payload);

        // Update in workflowData arrays
        const activeSession = workflowData.activeSessions?.find(s => s.session_id === sessionId);
        const archivedSession = workflowData.archivedSessions?.find(s => s.session_id === sessionId);
        if (activeSession) Object.assign(activeSession, payload);
        if (archivedSession) Object.assign(archivedSession, payload);
      }
      break;

    case 'TASK_CREATED':
      // Add new task to session
      const tcSessionKey = `session-${sessionId}`.replace(/[^a-zA-Z0-9-]/g, '-');
      const tcSession = sessionDataStore[tcSessionKey];
      if (tcSession) {
        if (!tcSession.tasks) tcSession.tasks = [];
        // Check if task already exists (by entityId or task_id in payload)
        const taskId = entityId || (payload && payload.task_id);
        const existingTask = tcSession.tasks.find(t => t.task_id === taskId);
        if (!existingTask && payload) {
          tcSession.tasks.push(payload);
        }
      }
      break;

    case 'SUMMARY_WRITTEN':
      // Update session summary count or mark task as having summary
      const swSessionKey = `session-${sessionId}`.replace(/[^a-zA-Z0-9-]/g, '-');
      const swSession = sessionDataStore[swSessionKey];
      if (swSession) {
        if (!swSession.summaries) swSession.summaries = [];
        swSession.summaries.push({ task_id: entityId, content: payload });
        // Update task status if found
        if (swSession.tasks && entityId) {
          const task = swSession.tasks.find(t => t.task_id === entityId);
          if (task) task.has_summary = true;
        }
      }
      break;

    case 'PLAN_UPDATED':
      // Update session plan reference
      const puSessionKey = `session-${sessionId}`.replace(/[^a-zA-Z0-9-]/g, '-');
      const puSession = sessionDataStore[puSessionKey];
      if (puSession) {
        puSession.has_plan = true;
        puSession.plan_updated_at = new Date().toISOString();
      }
      break;

    case 'REVIEW_UPDATED':
      // Update session review data
      const ruSessionKey = `session-${sessionId}`.replace(/[^a-zA-Z0-9-]/g, '-');
      const ruSession = sessionDataStore[ruSessionKey];
      if (ruSession) {
        if (!ruSession.review) ruSession.review = { dimensions: [], iterations: [], fixes: [] };
        // Track review updates by type based on entityId pattern (prevent duplicates)
        if (event.contentType === 'review-dim') {
          if (!ruSession.review.dimensions.includes(entityId)) ruSession.review.dimensions.push(entityId);
        } else if (event.contentType === 'review-iter') {
          if (!ruSession.review.iterations.includes(entityId)) ruSession.review.iterations.push(entityId);
        } else if (event.contentType === 'review-fix') {
          if (!ruSession.review.fixes.includes(entityId)) ruSession.review.fixes.push(entityId);
        }
        ruSession.has_review = true;
      }
      break;

    case 'CONTENT_WRITTEN':
      // Generic content write - just log for debugging
      console.log(`[State] Content written: ${event.contentType} for ${sessionId}`);
      break;

    case 'FILE_DELETED':
      // File deleted from session - log and trigger refresh
      console.log(`[State] File deleted: ${payload?.file_path || payload?.deleted} from ${sessionId}`);
      break;

    case 'DIRECTORY_CREATED':
      // Directory created in session - log and trigger refresh
      console.log(`[State] Directory created: ${payload?.directories?.join(', ') || 'unknown'} in ${sessionId}`);
      break;
  }

  // Trigger UI updates
  if (typeof updateStats === 'function') updateStats();
  if (typeof updateBadges === 'function') updateBadges();
  if (typeof updateCarousel === 'function') updateCarousel();
  if (typeof refreshTaskQueue === 'function') refreshTaskQueue();

  // Re-render current view if needed
  if (currentView === 'sessions' && typeof renderSessions === 'function') {
    renderSessions();
  }
}
