// ==========================================
// TASK QUEUE SIDEBAR - Right Sidebar
// ==========================================
// Right-side slide-out toolbar for task queue management

let isTaskQueueSidebarVisible = false;
let taskQueueData = [];

/**
 * Initialize task queue sidebar
 */
function initTaskQueueSidebar() {
  // Create sidebar if not exists
  if (!document.getElementById('taskQueueSidebar')) {
    const sidebarHtml = `
      <div class="task-queue-sidebar" id="taskQueueSidebar">
        <div class="task-queue-header">
          <div class="task-queue-title">
            <span class="task-queue-title-icon">📋</span>
            <span>Task Queue</span>
            <span class="task-queue-count-badge" id="taskQueueCountBadge">0</span>
          </div>
          <button class="task-queue-close" onclick="toggleTaskQueueSidebar()" title="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="task-queue-filters">
          <button class="task-filter-btn active" data-filter="all" onclick="filterTaskQueue('all')">All</button>
          <button class="task-filter-btn" data-filter="in_progress" onclick="filterTaskQueue('in_progress')">In Progress</button>
          <button class="task-filter-btn" data-filter="pending" onclick="filterTaskQueue('pending')">Pending</button>
        </div>

        <div class="task-queue-content" id="taskQueueContent">
          <div class="task-queue-empty-state">
            <div class="task-queue-empty-icon">📋</div>
            <div class="task-queue-empty-text">No tasks in queue</div>
            <div class="task-queue-empty-hint">Active workflow tasks will appear here</div>
          </div>
        </div>
      </div>

      <div class="task-queue-toggle" id="taskQueueToggle" onclick="toggleTaskQueueSidebar()" title="Task Queue">
        <span class="toggle-icon">📋</span>
        <span class="toggle-badge" id="taskQueueToggleBadge"></span>
      </div>

      <div class="task-queue-overlay" id="taskQueueOverlay" onclick="toggleTaskQueueSidebar()"></div>
    `;

    const container = document.createElement('div');
    container.id = 'taskQueueContainer';
    container.innerHTML = sidebarHtml;
    document.body.appendChild(container);
  }

  updateTaskQueueData();
  renderTaskQueue();
  updateTaskQueueBadge();
}

/**
 * Toggle task queue sidebar visibility
 */
function toggleTaskQueueSidebar() {
  isTaskQueueSidebarVisible = !isTaskQueueSidebarVisible;
  const sidebar = document.getElementById('taskQueueSidebar');
  const overlay = document.getElementById('taskQueueOverlay');
  const toggle = document.getElementById('taskQueueToggle');

  if (sidebar && overlay && toggle) {
    if (isTaskQueueSidebarVisible) {
      // Close notification sidebar if open
      if (isNotificationPanelVisible && typeof toggleNotifSidebar === 'function') {
        toggleNotifSidebar();
      }
      sidebar.classList.add('open');
      overlay.classList.add('show');
      toggle.classList.add('hidden');
      // Refresh data when opened
      updateTaskQueueData();
      renderTaskQueue();
    } else {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
      toggle.classList.remove('hidden');
    }
  }
}

/**
 * Update task queue data from workflow data
 */
function updateTaskQueueData() {
  taskQueueData = [];

  // Collect tasks from active sessions
  const activeSessions = workflowData.activeSessions || [];

  activeSessions.forEach(session => {
    const sessionKey = `session-${session.session_id}`.replace(/[^a-zA-Z0-9-]/g, '-');
    const sessionData = sessionDataStore[sessionKey] || session;
    const tasks = sessionData.tasks || [];

    tasks.forEach(task => {
      taskQueueData.push({
        ...task,
        session_id: session.session_id,
        session_type: session.type || 'workflow',
        session_description: session.description || session.session_id
      });
    });
  });

  // Also check lite task sessions
  Object.keys(liteTaskDataStore).forEach(key => {
    const liteSession = liteTaskDataStore[key];
    if (liteSession && liteSession.tasks) {
      liteSession.tasks.forEach(task => {
        taskQueueData.push({
          ...task,
          session_id: liteSession.session_id || key,
          session_type: liteSession.type || 'lite',
          session_description: liteSession.description || key
        });
      });
    }
  });

  // Sort: in_progress first, then pending, then by timestamp
  taskQueueData.sort((a, b) => {
    const statusOrder = { 'in_progress': 0, 'pending': 1, 'completed': 2, 'skipped': 3 };
    const aOrder = statusOrder[a.status] ?? 99;
    const bOrder = statusOrder[b.status] ?? 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return 0;
  });
}

/**
 * Render task queue list
 */
function renderTaskQueue(filter = 'all') {
  const contentEl = document.getElementById('taskQueueContent');
  if (!contentEl) return;

  let filteredTasks = taskQueueData;
  if (filter !== 'all') {
    filteredTasks = taskQueueData.filter(t => t.status === filter);
  }

  if (filteredTasks.length === 0) {
    contentEl.innerHTML = `
      <div class="task-queue-empty-state">
        <div class="task-queue-empty-icon">📋</div>
        <div class="task-queue-empty-text">${filter === 'all' ? 'No tasks in queue' : `No ${filter.replace('_', ' ')} tasks`}</div>
        <div class="task-queue-empty-hint">Active workflow tasks will appear here</div>
      </div>
    `;
    return;
  }

  contentEl.innerHTML = filteredTasks.map(task => {
    const statusIcon = {
      'in_progress': '🔄',
      'pending': '⏳',
      'completed': '✅',
      'skipped': '⏭️'
    }[task.status] || '📋';

    const statusClass = task.status || 'pending';
    const taskId = task.task_id || task.id || 'N/A';
    const title = task.title || task.description || taskId;

    return `
      <div class="task-queue-item status-${statusClass}" data-task-id="${escapeHtml(taskId)}" onclick="openTaskFromQueue('${escapeHtml(task.session_id)}', '${escapeHtml(taskId)}')">
        <div class="task-queue-item-header">
          <span class="task-queue-status-icon">${statusIcon}</span>
          <div class="task-queue-item-info">
            <span class="task-queue-item-title">${escapeHtml(title)}</span>
            <span class="task-queue-item-id">${escapeHtml(taskId)}</span>
          </div>
        </div>
        <div class="task-queue-item-meta">
          <span class="task-queue-session-tag" title="${escapeHtml(task.session_description)}">
            ${escapeHtml(task.session_id)}
          </span>
          <span class="task-queue-type-badge type-${task.session_type}">${escapeHtml(task.session_type)}</span>
        </div>
        ${task.scope ? `<div class="task-queue-item-scope"><code>${escapeHtml(task.scope)}</code></div>` : ''}
      </div>
    `;
  }).join('');
}

/**
 * Filter task queue
 */
function filterTaskQueue(filter) {
  // Update active filter button
  document.querySelectorAll('.task-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderTaskQueue(filter);
}

/**
 * Open task from queue (navigate to task detail)
 */
function openTaskFromQueue(sessionId, taskId) {
  // Close sidebar
  toggleTaskQueueSidebar();

  // Try to find and open the task
  const sessionKey = `session-${sessionId}`.replace(/[^a-zA-Z0-9-]/g, '-');

  // Check if it's a lite task session
  if (liteTaskDataStore[sessionKey]) {
    if (typeof openTaskDrawerForLite === 'function') {
      currentSessionDetailKey = sessionKey;
      openTaskDrawerForLite(sessionId, taskId);
    }
  } else {
    // Regular workflow task
    if (typeof openTaskDrawer === 'function') {
      currentDrawerTasks = sessionDataStore[sessionKey]?.tasks || [];
      openTaskDrawer(taskId);
    }
  }
}

/**
 * Update task queue badge counts
 */
function updateTaskQueueBadge() {
  const inProgressCount = taskQueueData.filter(t => t.status === 'in_progress').length;
  const pendingCount = taskQueueData.filter(t => t.status === 'pending').length;
  const activeCount = inProgressCount + pendingCount;

  const countBadge = document.getElementById('taskQueueCountBadge');
  const toggleBadge = document.getElementById('taskQueueToggleBadge');

  if (countBadge) {
    countBadge.textContent = taskQueueData.length;
    countBadge.style.display = taskQueueData.length > 0 ? 'inline-flex' : 'none';
  }

  if (toggleBadge) {
    toggleBadge.textContent = activeCount;
    toggleBadge.style.display = activeCount > 0 ? 'flex' : 'none';
    // Highlight if there are in-progress tasks
    toggleBadge.classList.toggle('has-active', inProgressCount > 0);
  }
}

/**
 * Refresh task queue (called from external updates)
 */
function refreshTaskQueue() {
  updateTaskQueueData();
  renderTaskQueue();
  updateTaskQueueBadge();
}
