// ==========================================
// TASK QUEUE SIDEBAR - Right Sidebar
// ==========================================
// Right-side slide-out toolbar for task queue and CLI execution management

let isTaskQueueSidebarVisible = false;
let taskQueueData = [];
let cliQueueData = [];
let currentQueueTab = 'tasks'; // 'tasks' | 'cli'
let cliCategoryFilter = 'all'; // 'all' | 'user' | 'internal' | 'insight'

// Update task queue data (for CLAUDE.md updates from explorer)
let sidebarUpdateTasks = [];
let isSidebarTaskRunning = {}; // Track running tasks by id

/**
 * Initialize task queue sidebar
 */
function initTaskQueueSidebar() {
  // Create sidebar if not exists - check for container to handle partial creation
  var existingContainer = document.getElementById('taskQueueContainer');
  if (existingContainer) {
    existingContainer.remove();
  }
  if (!document.getElementById('taskQueueSidebar')) {
    const sidebarHtml = `
      <div class="task-queue-sidebar" id="taskQueueSidebar">
        <div class="task-queue-header">
          <div class="task-queue-title">
            <span class="task-queue-title-icon">📋</span>
            <span>Execution Queue</span>
            <span class="task-queue-count-badge" id="taskQueueCountBadge">0</span>
          </div>
          <button class="task-queue-close" onclick="toggleTaskQueueSidebar()" title="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="task-queue-tabs">
          <button class="task-queue-tab active" data-tab="tasks" onclick="switchQueueTab('tasks')">
            📋 Tasks <span class="tab-badge" id="tasksTabBadge">0</span>
          </button>
          <button class="task-queue-tab" data-tab="cli" onclick="switchQueueTab('cli')">
            ⚡ CLI <span class="tab-badge" id="cliTabBadge">0</span>
          </button>
        </div>

        <div class="task-queue-filters" id="taskQueueFilters">
          <button class="task-filter-btn active" data-filter="all" onclick="filterTaskQueue('all')">All</button>
          <button class="task-filter-btn" data-filter="in_progress" onclick="filterTaskQueue('in_progress')">In Progress</button>
          <button class="task-filter-btn" data-filter="pending" onclick="filterTaskQueue('pending')">Pending</button>
        </div>

        <div class="task-queue-filters" id="cliQueueFilters" style="display: none;">
          <button class="cli-filter-btn active" data-filter="all" onclick="filterCliQueue('all')">All</button>
          <button class="cli-filter-btn" data-filter="user" onclick="filterCliQueue('user')">🔵 User</button>
          <button class="cli-filter-btn" data-filter="insight" onclick="filterCliQueue('insight')">🟣 Insight</button>
          <button class="cli-filter-btn" data-filter="internal" onclick="filterCliQueue('internal')">🟢 Internal</button>
        </div>

        <div class="task-queue-content" id="taskQueueContent">
          <div class="task-queue-empty-state">
            <div class="task-queue-empty-icon">📋</div>
            <div class="task-queue-empty-text">No tasks in queue</div>
            <div class="task-queue-empty-hint">Active workflow tasks will appear here</div>
          </div>
        </div>

        <div class="task-queue-content" id="cliQueueContent" style="display: none;">
          <!-- Update Tasks Section -->
          <div class="update-tasks-section" id="updateTasksSection">
            <div class="update-tasks-header">
              <span class="update-tasks-title">📝 ${t('taskQueue.title')}</span>
              <button class="update-tasks-clear-btn" onclick="clearCompletedUpdateTasks()" title="${t('taskQueue.clearCompleted')}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                </svg>
              </button>
            </div>
            <div class="update-tasks-list" id="updateTasksList">
              <div class="update-tasks-empty">
                <span>${t('taskQueue.noTasks')}</span>
                <p>${t('taskQueue.noTasksHint')}</p>
              </div>
            </div>
          </div>

          <!-- CLI History Section -->
          <div class="cli-history-section" id="cliHistorySection">
            <div class="cli-history-header">
              <span class="cli-history-title">⚡ ${t('title.cliHistory')}</span>
            </div>
            <div class="cli-history-list" id="cliHistoryList">
              <div class="task-queue-empty-state">
                <div class="task-queue-empty-icon">⚡</div>
                <div class="task-queue-empty-text">No internal executions</div>
                <div class="task-queue-empty-hint">CLI tool executions will appear here</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="task-queue-toggle" id="taskQueueToggle" onclick="toggleTaskQueueSidebar()" title="Execution Queue">
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
  updateCliQueueData();
  renderTaskQueueSidebar();
  renderCliQueue();
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
      renderTaskQueueSidebar();
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

  // Safety check for global state
  if (typeof workflowData === 'undefined' || !workflowData) {
    console.warn('[TaskQueue] workflowData not initialized');
    return;
  }

  // Collect tasks from active sessions
  var activeSessions = workflowData.activeSessions || [];

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
  if (typeof liteTaskDataStore === 'undefined' || !liteTaskDataStore) {
    return;
  }
  Object.keys(liteTaskDataStore).forEach(function(key) {
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
 * Render task queue list in sidebar
 * Note: Named renderTaskQueueSidebar to avoid conflict with explorer.js renderTaskQueue
 */
function renderTaskQueueSidebar(filter) {
  filter = filter || 'all';
  var contentEl = document.getElementById('taskQueueContent');
  if (!contentEl) {
    console.warn('[TaskQueue] taskQueueContent element not found');
    return;
  }

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
  renderTaskQueueSidebar(filter);
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
  updateCliQueueData();
  renderTaskQueueSidebar();
  renderCliQueue();
  updateTaskQueueBadge();
}

/**
 * Switch between Tasks and CLI tabs
 */
function switchQueueTab(tab) {
  currentQueueTab = tab;

  // Update tab button states
  document.querySelectorAll('.task-queue-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  // Show/hide filters and content
  const taskFilters = document.getElementById('taskQueueFilters');
  const cliFilters = document.getElementById('cliQueueFilters');
  const taskContent = document.getElementById('taskQueueContent');
  const cliContent = document.getElementById('cliQueueContent');

  if (tab === 'tasks') {
    if (taskFilters) taskFilters.style.display = 'flex';
    if (cliFilters) cliFilters.style.display = 'none';
    if (taskContent) taskContent.style.display = 'block';
    if (cliContent) cliContent.style.display = 'none';
  } else {
    if (taskFilters) taskFilters.style.display = 'none';
    if (cliFilters) cliFilters.style.display = 'flex';
    if (taskContent) taskContent.style.display = 'none';
    if (cliContent) cliContent.style.display = 'block';
    // Refresh CLI data when switching to CLI tab
    updateCliQueueData();
    renderCliQueue();
  }
}

/**
 * Update CLI queue data from API
 */
async function updateCliQueueData() {
  try {
    // Fetch recent CLI executions with category info
    const response = await fetch(`/api/cli/history-native?path=${encodeURIComponent(projectPath)}&limit=20`);
    if (!response.ok) return;
    const data = await response.json();
    cliQueueData = data.executions || [];
  } catch (err) {
    console.warn('[TaskQueue] Failed to load CLI queue:', err);
    cliQueueData = [];
  }
}

/**
 * Render CLI queue list
 */
function renderCliQueue() {
  const contentEl = document.getElementById('cliHistoryList');
  if (!contentEl) return;

  // Filter by category
  let filtered = cliQueueData;
  if (cliCategoryFilter !== 'all') {
    filtered = cliQueueData.filter(exec => (exec.category || 'user') === cliCategoryFilter);
  }

  // Update tab badge
  const cliTabBadge = document.getElementById('cliTabBadge');
  if (cliTabBadge) {
    cliTabBadge.textContent = cliQueueData.length;
    cliTabBadge.style.display = cliQueueData.length > 0 ? 'inline' : 'none';
  }

  if (filtered.length === 0) {
    const emptyText = cliCategoryFilter === 'all'
      ? 'No CLI executions'
      : `No ${cliCategoryFilter} executions`;
    contentEl.innerHTML = `
      <div class="task-queue-empty-state">
        <div class="task-queue-empty-icon">⚡</div>
        <div class="task-queue-empty-text">${emptyText}</div>
        <div class="task-queue-empty-hint">CLI tool executions will appear here</div>
      </div>
    `;
    return;
  }

  contentEl.innerHTML = filtered.map(exec => {
    const category = exec.category || 'user';
    const categoryIcon = { user: '🔵', internal: '🟢', insight: '🟣' }[category] || '⚪';
    const statusIcon = exec.status === 'success' ? '✅' : exec.status === 'timeout' ? '⏰' : '❌';
    const timeAgo = getCliTimeAgo(new Date(exec.updated_at || exec.timestamp));
    const promptPreview = (exec.prompt_preview || '').substring(0, 60);

    return `
      <div class="cli-queue-item category-${category}" onclick="showCliExecutionFromQueue('${escapeHtml(exec.id)}')">
        <div class="cli-queue-item-header">
          <span class="cli-queue-category-icon">${categoryIcon}</span>
          <span class="cli-queue-tool-tag cli-tool-${exec.tool}">${exec.tool.toUpperCase()}</span>
          <span class="cli-queue-status">${statusIcon}</span>
          <span class="cli-queue-time">${timeAgo}</span>
        </div>
        <div class="cli-queue-prompt">${escapeHtml(promptPreview)}${promptPreview.length >= 60 ? '...' : ''}</div>
        <div class="cli-queue-meta">
          <span class="cli-queue-id">#${exec.id.split('-')[0]}</span>
          ${exec.turn_count > 1 ? `<span class="cli-queue-turns">${exec.turn_count} turns</span>` : ''}
          ${exec.hasNativeSession ? '<span class="cli-queue-native">📎</span>' : ''}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Filter CLI queue by category
 */
function filterCliQueue(category) {
  cliCategoryFilter = category;

  // Update filter button states
  document.querySelectorAll('.cli-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === category);
  });

  renderCliQueue();
}

/**
 * Show CLI execution detail from queue
 */
function showCliExecutionFromQueue(executionId) {
  toggleTaskQueueSidebar();

  // Use the showExecutionDetail function from cli-history.js if available
  if (typeof showExecutionDetail === 'function') {
    showExecutionDetail(executionId);
  } else {
    console.warn('[TaskQueue] showExecutionDetail not available');
  }
}

/**
 * Helper to format time ago
 */
function getCliTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

// ==========================================
// UPDATE TASK QUEUE - For CLAUDE.md Updates
// ==========================================

/**
 * Add update task to sidebar queue (called from explorer)
 */
function addUpdateTaskToSidebar(path, tool = 'gemini', strategy = 'single-layer') {
  const task = {
    id: Date.now(),
    path,
    tool,
    strategy,
    status: 'pending', // pending, running, completed, failed
    message: '',
    addedAt: new Date().toISOString()
  };

  sidebarUpdateTasks.push(task);
  renderSidebarUpdateTasks();
  updateCliTabBadge();

  // Open sidebar and switch to CLI tab if not visible
  if (!isTaskQueueSidebarVisible) {
    toggleTaskQueueSidebar();
  }
  switchQueueTab('cli');
}

/**
 * Remove update task from queue
 */
function removeUpdateTask(taskId) {
  sidebarUpdateTasks = sidebarUpdateTasks.filter(t => t.id !== taskId);
  renderSidebarUpdateTasks();
  updateCliTabBadge();
}

/**
 * Clear completed/failed update tasks
 */
function clearCompletedUpdateTasks() {
  sidebarUpdateTasks = sidebarUpdateTasks.filter(t => t.status === 'pending' || t.status === 'running');
  renderSidebarUpdateTasks();
  updateCliTabBadge();
}

/**
 * Update CLI tool for a specific task
 */
function updateSidebarTaskCliTool(taskId, tool) {
  const task = sidebarUpdateTasks.find(t => t.id === taskId);
  if (task && task.status === 'pending') {
    task.tool = tool;
  }
}

/**
 * Execute a single update task
 */
async function executeSidebarUpdateTask(taskId) {
  const task = sidebarUpdateTasks.find(t => t.id === taskId);
  if (!task || task.status !== 'pending') return;

  const folderName = task.path.split('/').pop() || task.path;

  // Update status to running
  task.status = 'running';
  task.message = t('taskQueue.processing');
  isSidebarTaskRunning[taskId] = true;
  renderSidebarUpdateTasks();

  if (typeof addGlobalNotification === 'function') {
    addGlobalNotification('info', `Processing: ${folderName}`, `Strategy: ${task.strategy}, Tool: ${task.tool}`, 'Explorer');
  }

  try {
    const response = await csrfFetch('/api/update-claude-md', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: task.path,
        tool: task.tool,
        strategy: task.strategy
      })
    });

    const result = await response.json();

    if (result.success) {
      task.status = 'completed';
      task.message = t('taskQueue.updated');
      if (typeof addGlobalNotification === 'function') {
        addGlobalNotification('success', `Completed: ${folderName}`, result.message, 'Explorer');
      }
    } else {
      task.status = 'failed';
      task.message = result.error || t('taskQueue.failed');
      if (typeof addGlobalNotification === 'function') {
        addGlobalNotification('error', `Failed: ${folderName}`, result.error || 'Unknown error', 'Explorer');
      }
    }
  } catch (error) {
    task.status = 'failed';
    task.message = error.message;
    if (typeof addGlobalNotification === 'function') {
      addGlobalNotification('error', `Error: ${folderName}`, error.message, 'Explorer');
    }
  } finally {
    delete isSidebarTaskRunning[taskId];
    renderSidebarUpdateTasks();
    updateCliTabBadge();

    // Refresh tree to show updated CLAUDE.md files
    if (typeof loadExplorerTree === 'function' && typeof explorerCurrentPath !== 'undefined') {
      loadExplorerTree(explorerCurrentPath);
    }
  }
}

/**
 * Stop/cancel a running update task (if possible)
 */
function stopSidebarUpdateTask(taskId) {
  // Currently just removes the task - actual cancellation would need AbortController
  const task = sidebarUpdateTasks.find(t => t.id === taskId);
  if (task && task.status === 'running') {
    task.status = 'failed';
    task.message = 'Cancelled';
    delete isSidebarTaskRunning[taskId];
    renderSidebarUpdateTasks();
    updateCliTabBadge();
  }
}

/**
 * Render update task queue list
 */
function renderSidebarUpdateTasks() {
  const listEl = document.getElementById('updateTasksList');
  if (!listEl) return;

  if (sidebarUpdateTasks.length === 0) {
    listEl.innerHTML = `
      <div class="update-tasks-empty">
        <span>${t('taskQueue.noTasks')}</span>
        <p>${t('taskQueue.noTasksHint')}</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = sidebarUpdateTasks.map(task => {
    const folderName = task.path.split('/').pop() || task.path;
    const strategyIcon = task.strategy === 'multi-layer' ? '📂' : '📄';
    const strategyLabel = task.strategy === 'multi-layer'
      ? t('taskQueue.withSubdirs')
      : t('taskQueue.currentOnly');

    const statusIcon = {
      'pending': '⏳',
      'running': '🔄',
      'completed': '✅',
      'failed': '❌'
    }[task.status];

    const isPending = task.status === 'pending';
    const isRunning = task.status === 'running';

    return `
      <div class="update-task-item status-${task.status}" data-task-id="${task.id}">
        <div class="update-task-header">
          <span class="update-task-status">${statusIcon}</span>
          <span class="update-task-name" title="${escapeHtml(task.path)}">${escapeHtml(folderName)}</span>
          <span class="update-task-strategy" title="${strategyLabel}">${strategyIcon}</span>
        </div>
        <div class="update-task-controls">
          <select class="update-task-cli-select"
                  onchange="updateSidebarTaskCliTool(${task.id}, this.value)"
                  ${!isPending ? 'disabled' : ''}>
            <option value="gemini" ${task.tool === 'gemini' ? 'selected' : ''}>Gemini</option>
            <option value="qwen" ${task.tool === 'qwen' ? 'selected' : ''}>Qwen</option>
            <option value="codex" ${task.tool === 'codex' ? 'selected' : ''}>Codex</option>
            <option value="claude" ${task.tool === 'claude' ? 'selected' : ''}>Claude</option>
          </select>
          ${isPending ? `
            <button class="update-task-btn update-task-start" onclick="executeSidebarUpdateTask(${task.id})" title="${t('taskQueue.startAll')}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </button>
            <button class="update-task-btn update-task-remove" onclick="removeUpdateTask(${task.id})" title="Remove">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          ` : ''}
          ${isRunning ? `
            <button class="update-task-btn update-task-stop" onclick="stopSidebarUpdateTask(${task.id})" title="Stop">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12"/>
              </svg>
            </button>
          ` : ''}
        </div>
        ${task.message ? `<div class="update-task-message">${escapeHtml(task.message)}</div>` : ''}
      </div>
    `;
  }).join('');
}

/**
 * Update CLI tab badge with pending update tasks count
 */
function updateCliTabBadge() {
  const pendingCount = sidebarUpdateTasks.filter(t => t.status === 'pending' || t.status === 'running').length;
  const cliTabBadge = document.getElementById('cliTabBadge');
  if (cliTabBadge) {
    const totalCount = pendingCount + cliQueueData.length;
    cliTabBadge.textContent = totalCount;
    cliTabBadge.style.display = totalCount > 0 ? 'inline' : 'none';
  }
}
