// ==========================================
// NOTIFICATIONS COMPONENT
// ==========================================
// Real-time silent refresh (no notification bubbles)

/**
 * Format JSON object for display in notifications
 * @param {Object} obj - Object to format
 * @param {number} maxLen - Max string length
 * @returns {string} Formatted string
 */
function formatJsonDetails(obj, maxLen = 150) {
  if (!obj || typeof obj !== 'object') return String(obj);

  // Try pretty format first
  try {
    const formatted = JSON.stringify(obj, null, 2);
    if (formatted.length <= maxLen) {
      return formatted;
    }

    // For longer content, show key-value pairs on separate lines
    const entries = Object.entries(obj);
    if (entries.length === 0) return '{}';

    const lines = entries.slice(0, 5).map(([key, val]) => {
      let valStr = typeof val === 'object' ? JSON.stringify(val) : String(val);
      if (valStr.length > 50) valStr = valStr.substring(0, 47) + '...';
      return `${key}: ${valStr}`;
    });

    if (entries.length > 5) {
      lines.push(`... +${entries.length - 5} more`);
    }

    return lines.join('\n');
  } catch (e) {
    return JSON.stringify(obj).substring(0, maxLen) + '...';
  }
}

let wsConnection = null;
let autoRefreshInterval = null;
let lastDataHash = null;
const AUTO_REFRESH_INTERVAL_MS = 30000; // 30 seconds

// ========== WebSocket Connection ==========
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  try {
    wsConnection = new WebSocket(wsUrl);

    wsConnection.onopen = () => {
      console.log('[WS] Connected');
    };

    wsConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleNotification(data);
      } catch (e) {
        console.error('[WS] Failed to parse message:', e);
      }
    };

    wsConnection.onclose = () => {
      console.log('[WS] Disconnected, reconnecting in 5s...');
      setTimeout(initWebSocket, 5000);
    };

    wsConnection.onerror = (error) => {
      console.error('[WS] Error:', error);
    };
  } catch (e) {
    console.log('[WS] WebSocket not available, using polling');
  }
}

// ========== Notification Handler ==========
function handleNotification(data) {
  const { type, payload } = data;

  // Silent refresh - no notification bubbles
  switch (type) {
    case 'session_updated':
    case 'summary_written':
    case 'task_completed':
    case 'new_session':
      // Just refresh data silently
      refreshIfNeeded();
      // Optionally highlight in carousel if it's the current session
      if (payload.sessionId && typeof carouselGoTo === 'function') {
        carouselGoTo(payload.sessionId);
      }
      break;

    case 'SESSION_CREATED':
    case 'SESSION_ARCHIVED':
    case 'TASK_UPDATED':
    case 'SESSION_UPDATED':
    case 'TASK_CREATED':
    case 'SUMMARY_WRITTEN':
    case 'PLAN_UPDATED':
    case 'REVIEW_UPDATED':
    case 'CONTENT_WRITTEN':
    case 'FILE_DELETED':
    case 'DIRECTORY_CREATED':
      // Route to state reducer for granular updates
      if (typeof handleWorkflowEvent === 'function') {
        handleWorkflowEvent({ type, ...payload });
      } else {
        // Fallback to full refresh if reducer not available
        refreshIfNeeded();
      }
      break;

    case 'tool_execution':
      // Handle tool execution notifications from CLI
      handleToolExecutionNotification(payload);
      break;

    // CLI Tool Execution Events
    case 'CLI_EXECUTION_STARTED':
      if (typeof handleCliExecutionStarted === 'function') {
        handleCliExecutionStarted(payload);
      }
      break;

    case 'CLI_OUTPUT':
      if (typeof handleCliOutput === 'function') {
        handleCliOutput(payload);
      }
      break;

    case 'CLI_EXECUTION_COMPLETED':
      if (typeof handleCliExecutionCompleted === 'function') {
        handleCliExecutionCompleted(payload);
      }
      break;

    case 'CLI_EXECUTION_ERROR':
      if (typeof handleCliExecutionError === 'function') {
        handleCliExecutionError(payload);
      }
      break;

    default:
      console.log('[WS] Unknown notification type:', type);
  }
}

/**
 * Handle tool execution notifications from CLI
 * @param {Object} payload - Tool execution payload
 */
function handleToolExecutionNotification(payload) {
  const { toolName, status, params, result, error, timestamp } = payload;

  // Determine notification type and message
  let notifType = 'info';
  let message = `Tool: ${toolName}`;
  let details = null;

  switch (status) {
    case 'started':
      notifType = 'info';
      message = `Executing ${toolName}...`;
      if (params) {
        details = formatJsonDetails(params, 150);
      }
      break;

    case 'completed':
      notifType = 'success';
      message = `${toolName} completed`;
      if (result) {
        if (result._truncated) {
          details = result.preview;
        } else {
          details = formatJsonDetails(result, 200);
        }
      }
      break;

    case 'failed':
      notifType = 'error';
      message = `${toolName} failed`;
      details = error || 'Unknown error';
      break;

    default:
      notifType = 'info';
      message = `${toolName}: ${status}`;
  }

  // Add to global notifications
  if (typeof addGlobalNotification === 'function') {
    addGlobalNotification(notifType, message, details, 'CLI');
  }

  // Log to console
  console.log(`[CLI] ${status}: ${toolName}`, payload);
}

// ========== Auto Refresh ==========
function initAutoRefresh() {
  // Calculate initial hash
  lastDataHash = calculateDataHash();

  // Start polling interval
  autoRefreshInterval = setInterval(checkForChanges, AUTO_REFRESH_INTERVAL_MS);
}

function calculateDataHash() {
  if (!workflowData) return null;

  // Simple hash based on key data points
  const hashData = {
    activeSessions: (workflowData.activeSessions || []).length,
    archivedSessions: (workflowData.archivedSessions || []).length,
    totalTasks: workflowData.statistics?.totalTasks || 0,
    completedTasks: workflowData.statistics?.completedTasks || 0,
    generatedAt: workflowData.generatedAt
  };

  return JSON.stringify(hashData);
}

async function checkForChanges() {
  if (!window.SERVER_MODE) return;

  try {
    const response = await fetch(`/api/data?path=${encodeURIComponent(projectPath)}`);
    if (!response.ok) return;

    const newData = await response.json();
    const newHash = JSON.stringify({
      activeSessions: (newData.activeSessions || []).length,
      archivedSessions: (newData.archivedSessions || []).length,
      totalTasks: newData.statistics?.totalTasks || 0,
      completedTasks: newData.statistics?.completedTasks || 0,
      generatedAt: newData.generatedAt
    });

    if (newHash !== lastDataHash) {
      lastDataHash = newHash;
      // Silent refresh - no notification
      await refreshWorkspaceData(newData);
    }
  } catch (e) {
    console.error('[AutoRefresh] Check failed:', e);
  }
}

async function refreshIfNeeded() {
  if (!window.SERVER_MODE) return;

  try {
    const response = await fetch(`/api/data?path=${encodeURIComponent(projectPath)}`);
    if (!response.ok) return;

    const newData = await response.json();
    await refreshWorkspaceData(newData);
  } catch (e) {
    console.error('[Refresh] Failed:', e);
  }
}

async function refreshWorkspaceData(newData) {
  // Update global data
  window.workflowData = newData;

  // Clear and repopulate stores
  Object.keys(sessionDataStore).forEach(k => delete sessionDataStore[k]);
  Object.keys(liteTaskDataStore).forEach(k => delete liteTaskDataStore[k]);

  [...(newData.activeSessions || []), ...(newData.archivedSessions || [])].forEach(s => {
    const key = `session-${s.session_id}`.replace(/[^a-zA-Z0-9-]/g, '-');
    sessionDataStore[key] = s;
  });

  [...(newData.liteTasks?.litePlan || []), ...(newData.liteTasks?.liteFix || [])].forEach(s => {
    const key = `lite-${s.session_id}`.replace(/[^a-zA-Z0-9-]/g, '-');
    liteTaskDataStore[key] = s;
  });

  // Update UI silently
  updateStats();
  updateBadges();
  updateCarousel();

  // Re-render current view if needed
  if (currentView === 'sessions') {
    renderSessions();
  } else if (currentView === 'liteTasks') {
    renderLiteTasks();
  }

  lastDataHash = calculateDataHash();
}

// ========== Cleanup ==========
function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
}

function closeWebSocket() {
  if (wsConnection) {
    wsConnection.close();
    wsConnection = null;
  }
}

// ========== Navigation Helper ==========
function goToSession(sessionId) {
  // Find session in carousel and navigate
  const sessionKey = `session-${sessionId}`.replace(/[^a-zA-Z0-9-]/g, '-');

  // Jump to session in carousel if visible
  if (typeof carouselGoTo === 'function') {
    carouselGoTo(sessionId);
  }

  // Navigate to session detail
  if (sessionDataStore[sessionKey]) {
    showSessionDetailPage(sessionKey);
  }
}
