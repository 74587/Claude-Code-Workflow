// ==========================================
// NOTIFICATIONS COMPONENT
// ==========================================
// Real-time silent refresh (no notification bubbles)

/**
 * Format JSON object for display in notifications
 * Parses JSON strings and formats objects into readable key-value pairs
 * @param {Object|string} obj - Object or JSON string to format
 * @param {number} maxLen - Max string length (unused, kept for compatibility)
 * @returns {string} Formatted string with key: value pairs
 */
function formatJsonDetails(obj, maxLen = 150) {
  // Handle null/undefined
  if (obj === null || obj === undefined) return '';

  // If it is a string, try to parse as JSON
  if (typeof obj === 'string') {
    // Check if it looks like JSON
    const trimmed = obj.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        obj = JSON.parse(trimmed);
      } catch (e) {
        // Not valid JSON, return as-is
        return obj;
      }
    } else {
      // Plain string, return as-is
      return obj;
    }
  }

  // Handle non-objects (numbers, booleans, etc.)
  if (typeof obj !== 'object') return String(obj);

  // Handle arrays
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '(empty array)';
    return obj.slice(0, 5).map((item, i) => {
      const itemStr = typeof item === 'object' ? JSON.stringify(item) : String(item);
      return `[${i}] ${itemStr.length > 50 ? itemStr.substring(0, 47) + '...' : itemStr}`;
    }).join('\n') + (obj.length > 5 ? `\n... +${obj.length - 5} more` : '');
  }

  // Handle objects - format as readable key: value pairs
  try {
    const entries = Object.entries(obj);
    if (entries.length === 0) return '(empty object)';

    // Format each entry with proper value display
    const lines = entries.slice(0, 8).map(([key, val]) => {
      let valStr;
      if (val === null) {
        valStr = 'null';
      } else if (val === undefined) {
        valStr = 'undefined';
      } else if (typeof val === 'boolean') {
        valStr = val ? 'true' : 'false';
      } else if (typeof val === 'number') {
        valStr = String(val);
      } else if (typeof val === 'object') {
        valStr = JSON.stringify(val);
        if (valStr.length > 40) valStr = valStr.substring(0, 37) + '...';
      } else {
        valStr = String(val);
        if (valStr.length > 50) valStr = valStr.substring(0, 47) + '...';
      }
      return `${key}: ${valStr}`;
    });

    if (entries.length > 8) {
      lines.push(`... +${entries.length - 8} more fields`);
    }

    return lines.join('\n');
  } catch (e) {
    // Fallback to stringified version
    const str = JSON.stringify(obj);
    return str.length > 200 ? str.substring(0, 197) + '...' : str;
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
      // Handle tool execution notifications from MCP tools
      handleToolExecutionNotification(payload);
      break;

    case 'cli_execution':
      // Handle CLI command notifications (ccw cli exec)
      handleCliCommandNotification(payload);
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
 * Handle tool execution notifications from MCP tools
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
      // Pass raw object for HTML formatting
      if (params) {
        details = params;
      }
      break;

    case 'completed':
      notifType = 'success';
      message = `${toolName} completed`;
      // Pass raw object for HTML formatting
      if (result) {
        if (result._truncated) {
          details = result.preview;
        } else {
          details = result;
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

  // Add to global notifications - pass objects directly for HTML formatting
  if (typeof addGlobalNotification === 'function') {
    addGlobalNotification(notifType, message, details, 'MCP');
  }

  // Log to console
  console.log(`[MCP] ${status}: ${toolName}`, payload);
}

/**
 * Handle CLI command notifications (ccw cli exec)
 * @param {Object} payload - CLI execution payload
 */
function handleCliCommandNotification(payload) {
  const { event, tool, mode, prompt_preview, execution_id, success, duration_ms, status, error, turn_count, custom_id } = payload;

  let notifType = 'info';
  let message = '';
  let details = null;

  switch (event) {
    case 'started':
      notifType = 'info';
      message = `CLI ${tool} started`;
      // Pass structured object for rich display
      details = {
        mode: mode,
        prompt: prompt_preview
      };
      if (custom_id) {
        details.id = custom_id;
      }
      break;

    case 'completed':
      if (success) {
        notifType = 'success';
        const turnStr = turn_count > 1 ? ` (turn ${turn_count})` : '';
        message = `CLI ${tool} completed${turnStr}`;
        // Pass structured object for rich display
        details = {
          duration: duration_ms ? `${(duration_ms / 1000).toFixed(1)}s` : '-',
          execution_id: execution_id
        };
        if (turn_count > 1) {
          details.turns = turn_count;
        }
      } else {
        notifType = 'error';
        message = `CLI ${tool} failed`;
        details = {
          status: status || 'Unknown error',
          execution_id: execution_id
        };
      }
      break;

    case 'error':
      notifType = 'error';
      message = `CLI ${tool} error`;
      details = error || 'Unknown error';
      break;

    default:
      notifType = 'info';
      message = `CLI ${tool}: ${event}`;
  }

  // Add to global notifications - pass objects for HTML formatting
  if (typeof addGlobalNotification === 'function') {
    addGlobalNotification(notifType, message, details, 'CLI');
  }

  // Refresh CLI history if on history view
  if (event === 'completed' && typeof currentView !== 'undefined' && 
      (currentView === 'history' || currentView === 'cli-history')) {
    if (typeof loadCliHistory === 'function' && typeof renderCliHistoryView === 'function') {
      loadCliHistory().then(() => renderCliHistoryView());
    }
  }

  // Log to console
  console.log(`[CLI Command] ${event}: ${tool}`, payload);
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
