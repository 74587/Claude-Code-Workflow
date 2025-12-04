// Data placeholder - will be replaced by generator
let workflowData = {{WORKFLOW_DATA}};
let projectPath = '{{PROJECT_PATH}}';
let recentPaths = {{RECENT_PATHS}};

// State
let currentFilter = 'all';
let currentLiteType = null;
let currentView = 'sessions'; // 'sessions' or 'liteTasks'
let currentSessionDetailKey = null; // For detail page view

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initSidebar();
  initPathSelector();
  initNavigation();
  initSearch();

  // Server mode: load data from API
  if (window.SERVER_MODE) {
    await switchToPath(window.INITIAL_PATH || projectPath);
  } else {
    renderDashboard();
  }
});

// Theme
function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);

  document.getElementById('themeToggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon(next);
  });
}

function updateThemeIcon(theme) {
  document.getElementById('themeToggle').textContent = theme === 'light' ? '🌙' : '☀️';
}

// Sidebar
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebarToggle');
  const menuToggle = document.getElementById('menuToggle');
  const overlay = document.getElementById('sidebarOverlay');

  // Restore collapsed state
  if (localStorage.getItem('sidebarCollapsed') === 'true') {
    sidebar.classList.add('collapsed');
  }

  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
  });

  // Mobile menu
  menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  });

  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });
}

// Path Selector
function initPathSelector() {
  const btn = document.getElementById('pathButton');
  const menu = document.getElementById('pathMenu');
  const recentContainer = document.getElementById('recentPaths');

  // Render recent paths
  if (recentPaths && recentPaths.length > 0) {
    recentPaths.forEach(path => {
      const item = document.createElement('div');
      item.className = 'path-item' + (path === projectPath ? ' active' : '');
      item.textContent = path;
      item.dataset.path = path;
      item.addEventListener('click', () => selectPath(path));
      recentContainer.appendChild(item);
    });
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    menu.classList.remove('open');
  });

  document.getElementById('browsePath').addEventListener('click', async () => {
    await browseForFolder();
  });
}

async function browseForFolder() {
  // Try modern File System Access API first
  if ('showDirectoryPicker' in window) {
    try {
      const dirHandle = await window.showDirectoryPicker({
        mode: 'read',
        startIn: 'documents'
      });
      // Get the directory name (we can't get full path for security reasons)
      const dirName = dirHandle.name;
      showPathSelectedModal(dirName, dirHandle);
      return;
    } catch (err) {
      if (err.name === 'AbortError') {
        // User cancelled
        return;
      }
      console.warn('Directory picker failed:', err);
    }
  }

  // Fallback: show input dialog
  showPathInputModal();
}

// SVG Icons
const icons = {
  folder: '<svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
  check: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
  terminal: '<svg viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>'
};

function showPathSelectedModal(dirName, dirHandle) {
  // Try to guess full path based on current project path
  const currentPath = projectPath || '';
  const basePath = currentPath.substring(0, currentPath.lastIndexOf('/')) || 'D:/projects';
  const suggestedPath = basePath + '/' + dirName;

  const modal = document.createElement('div');
  modal.className = 'path-modal-overlay';
  modal.innerHTML = `
    <div class="path-modal">
      <div class="path-modal-header">
        <span class="path-modal-icon">${icons.folder}</span>
        <h3>Folder Selected</h3>
      </div>
      <div class="path-modal-body">
        <div class="selected-folder">
          <strong>${dirName}</strong>
        </div>
        <p class="path-modal-note">
          Confirm or edit the full path:
        </p>
        <div class="path-input-group" style="margin-top: 12px;">
          <label>Full path:</label>
          <input type="text" id="fullPathInput" value="${suggestedPath}" />
          <button class="path-go-btn" id="pathGoBtn">Open</button>
        </div>
      </div>
      <div class="path-modal-footer">
        <button class="path-modal-close" id="pathCancelBtn">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Add event listeners (use arrow functions to ensure proper scope)
  document.getElementById('pathGoBtn').addEventListener('click', () => {
    console.log('Open button clicked');
    goToPath();
  });
  document.getElementById('pathCancelBtn').addEventListener('click', () => closePathModal());

  // Focus input, select all text, and add enter key listener
  setTimeout(() => {
    const input = document.getElementById('fullPathInput');
    input?.focus();
    input?.select();
    input?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') goToPath();
    });
  }, 100);
}

function showPathInputModal() {
  const modal = document.createElement('div');
  modal.className = 'path-modal-overlay';
  modal.innerHTML = `
    <div class="path-modal">
      <div class="path-modal-header">
        <span class="path-modal-icon">${icons.folder}</span>
        <h3>Open Project</h3>
      </div>
      <div class="path-modal-body">
        <div class="path-input-group" style="margin-top: 0;">
          <label>Project path:</label>
          <input type="text" id="fullPathInput" placeholder="D:/projects/my-project" />
          <button class="path-go-btn" id="pathGoBtn">Open</button>
        </div>
      </div>
      <div class="path-modal-footer">
        <button class="path-modal-close" id="pathCancelBtn">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Add event listeners (use arrow functions to ensure proper scope)
  document.getElementById('pathGoBtn').addEventListener('click', () => {
    console.log('Open button clicked');
    goToPath();
  });
  document.getElementById('pathCancelBtn').addEventListener('click', () => closePathModal());

  // Focus input and add enter key listener
  setTimeout(() => {
    const input = document.getElementById('fullPathInput');
    input?.focus();
    input?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') goToPath();
    });
  }, 100);
}

function goToPath() {
  const input = document.getElementById('fullPathInput');
  const path = input?.value?.trim();
  if (path) {
    closePathModal();
    selectPath(path);
  } else {
    // Show error - input is empty
    input.style.borderColor = 'var(--danger-color)';
    input.placeholder = 'Please enter a path';
    input.focus();
  }
}

function closePathModal() {
  const modal = document.querySelector('.path-modal-overlay');
  if (modal) {
    modal.remove();
  }
}

function copyCommand(btn, dirName) {
  const input = document.getElementById('fullPathInput');
  const path = input?.value?.trim() || `[full-path-to-${dirName}]`;
  const command = `ccw view -p "${path}"`;
  navigator.clipboard.writeText(command).then(() => {
    btn.innerHTML = icons.check + ' <span>Copied!</span>';
    setTimeout(() => { btn.innerHTML = icons.copy + ' <span>Copy</span>'; }, 2000);
  });
}

async function selectPath(path) {
  localStorage.setItem('selectedPath', path);

  // Server mode: load data dynamically
  if (window.SERVER_MODE) {
    await switchToPath(path);
    return;
  }

  // Static mode: show command to run
  const modal = document.createElement('div');
  modal.className = 'path-modal-overlay';
  modal.innerHTML = `
    <div class="path-modal">
      <div class="path-modal-header">
        <span class="path-modal-icon">${icons.terminal}</span>
        <h3>Run Command</h3>
      </div>
      <div class="path-modal-body">
        <p>To view the dashboard for this project, run:</p>
        <div class="path-modal-command">
          <code>ccw view -p "${path}"</code>
          <button class="copy-btn" id="copyCommandBtn">${icons.copy} <span>Copy</span></button>
        </div>
        <p class="path-modal-note" style="margin-top: 12px;">
          Or use <code>ccw serve</code> for live path switching.
        </p>
      </div>
      <div class="path-modal-footer">
        <button class="path-modal-close" onclick="this.closest('.path-modal-overlay').remove()">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Add copy handler
  document.getElementById('copyCommandBtn').addEventListener('click', function() {
    navigator.clipboard.writeText('ccw view -p "' + path + '"').then(() => {
      this.innerHTML = icons.check + ' <span>Copied!</span>';
      setTimeout(() => { this.innerHTML = icons.copy + ' <span>Copy</span>'; }, 2000);
    });
  });
}

// Switch to a new project path (server mode only)
async function switchToPath(path) {
  // Show loading state
  const container = document.getElementById('mainContent');
  container.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const data = await loadDashboardData(path);
    if (data) {
      // Update global data
      workflowData = data;
      projectPath = data.projectPath;
      recentPaths = data.recentPaths || [];

      // Update UI
      document.querySelector('.path-text').textContent = projectPath;
      renderDashboard();
      refreshRecentPaths();
    }
  } catch (err) {
    console.error('Failed to switch path:', err);
    container.innerHTML = '<div class="error">Failed to load project data</div>';
  }
}

// Refresh recent paths dropdown
function refreshRecentPaths() {
  const recentContainer = document.getElementById('recentPaths');
  recentContainer.innerHTML = '';

  recentPaths.forEach(path => {
    const item = document.createElement('div');
    item.className = 'path-item' + (path === projectPath ? ' active' : '');
    item.textContent = path;
    item.dataset.path = path;
    item.addEventListener('click', () => selectPath(path));
    recentContainer.appendChild(item);
  });
}

// Navigation
function initNavigation() {
  document.querySelectorAll('.nav-item[data-filter]').forEach(item => {
    item.addEventListener('click', () => {
      setActiveNavItem(item);
      currentFilter = item.dataset.filter;
      currentLiteType = null;
      currentView = 'sessions';
      currentSessionDetailKey = null;
      updateContentTitle();
      renderSessions();
    });
  });

  // Lite Tasks Navigation
  document.querySelectorAll('.nav-item[data-lite]').forEach(item => {
    item.addEventListener('click', () => {
      setActiveNavItem(item);
      currentLiteType = item.dataset.lite;
      currentFilter = null;
      currentView = 'liteTasks';
      currentSessionDetailKey = null;
      updateContentTitle();
      renderLiteTasks();
    });
  });
}

function setActiveNavItem(item) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  item.classList.add('active');
}

function updateContentTitle() {
  const titleEl = document.getElementById('contentTitle');
  if (currentView === 'liteTasks') {
    const names = { 'lite-plan': 'Lite Plan Sessions', 'lite-fix': 'Lite Fix Sessions' };
    titleEl.textContent = names[currentLiteType] || 'Lite Tasks';
  } else if (currentView === 'sessionDetail') {
    titleEl.textContent = 'Session Detail';
  } else if (currentView === 'liteTaskDetail') {
    titleEl.textContent = 'Lite Task Detail';
  } else {
    const names = { 'all': 'All Sessions', 'active': 'Active Sessions', 'archived': 'Archived Sessions' };
    titleEl.textContent = names[currentFilter] || 'Sessions';
  }
}

// Search
function initSearch() {
  const input = document.getElementById('searchInput');
  input.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    document.querySelectorAll('.session-card').forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(query) ? '' : 'none';
    });
  });
}

// Render Dashboard
function renderDashboard() {
  updateStats();
  updateBadges();
  renderSessions();
  document.getElementById('generatedAt').textContent = workflowData.generatedAt || new Date().toISOString();
}

function updateStats() {
  const stats = workflowData.statistics || {};
  document.getElementById('statTotalSessions').textContent = stats.totalSessions || 0;
  document.getElementById('statActiveSessions').textContent = stats.activeSessions || 0;
  document.getElementById('statTotalTasks').textContent = stats.totalTasks || 0;
  document.getElementById('statCompletedTasks').textContent = stats.completedTasks || 0;
}

function updateBadges() {
  const active = workflowData.activeSessions || [];
  const archived = workflowData.archivedSessions || [];

  document.getElementById('badgeAll').textContent = active.length + archived.length;
  document.getElementById('badgeActive').textContent = active.length;
  document.getElementById('badgeArchived').textContent = archived.length;

  // Lite Tasks badges
  const liteTasks = workflowData.liteTasks || {};
  document.getElementById('badgeLitePlan').textContent = liteTasks.litePlan?.length || 0;
  document.getElementById('badgeLiteFix').textContent = liteTasks.liteFix?.length || 0;
}

function renderSessions() {
  const container = document.getElementById('mainContent');

  let sessions = [];

  if (currentFilter === 'all' || currentFilter === 'active') {
    sessions = sessions.concat((workflowData.activeSessions || []).map(s => ({ ...s, _isActive: true })));
  }
  if (currentFilter === 'all' || currentFilter === 'archived') {
    sessions = sessions.concat((workflowData.archivedSessions || []).map(s => ({ ...s, _isActive: false })));
  }

  if (sessions.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <div class="empty-icon">📭</div>
        <div class="empty-title">No Sessions Found</div>
        <div class="empty-text">No workflow sessions match your current filter.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `<div class="sessions-grid">${sessions.map(session => renderSessionCard(session)).join('')}</div>`;
}

// Store session data for modal access
const sessionDataStore = {};

function renderSessionCard(session) {
  const tasks = session.tasks || [];
  const taskCount = session.taskCount || tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const progress = taskCount > 0 ? Math.round((completed / taskCount) * 100) : 0;

  // Use _isActive flag set during rendering, default to true
  const isActive = session._isActive !== false;
  const date = session.created_at;

  // Get session type badge
  const sessionType = session.type || 'workflow';
  const typeBadge = sessionType !== 'workflow' ? `<span class="session-type-badge ${sessionType}">${sessionType}</span>` : '';

  // Store session data for modal
  const sessionKey = `session-${session.session_id}`.replace(/[^a-zA-Z0-9-]/g, '-');
  sessionDataStore[sessionKey] = session;

  return `
    <div class="session-card" onclick="showSessionDetailPage('${sessionKey}')">
      <div class="session-header">
        <div class="session-title">${escapeHtml(session.session_id || 'Unknown')}</div>
        <div class="session-badges">
          ${typeBadge}
          <span class="session-status ${isActive ? 'active' : 'archived'}">
            ${isActive ? 'ACTIVE' : 'ARCHIVED'}
          </span>
        </div>
      </div>
      <div class="session-body">
        <div class="session-meta">
          <span class="session-meta-item">📅 ${formatDate(date)}</span>
          <span class="session-meta-item">📋 ${taskCount} tasks</span>
        </div>
        ${taskCount > 0 ? `
          <div class="progress-container">
            <span class="progress-label">Progress</span>
            <div class="progress-bar-wrapper">
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%"></div>
              </div>
              <span class="progress-text">${completed}/${taskCount} (${progress}%)</span>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

// Session Detail Page
function showSessionDetailPage(sessionKey) {
  const session = sessionDataStore[sessionKey];
  if (!session) return;

  currentView = 'sessionDetail';
  currentSessionDetailKey = sessionKey;
  updateContentTitle();

  const container = document.getElementById('mainContent');
  const sessionType = session.type || 'workflow';

  // Render specialized pages for review and test-fix sessions
  if (sessionType === 'review' || sessionType === 'review-cycle') {
    container.innerHTML = renderReviewSessionDetailPage(session);
    initReviewSessionPage(session);
    return;
  }

  if (sessionType === 'test-fix' || sessionType === 'fix') {
    container.innerHTML = renderFixSessionDetailPage(session);
    initFixSessionPage(session);
    return;
  }

  // Default workflow session detail page
  const tasks = session.tasks || [];
  const completed = tasks.filter(t => t.status === 'completed').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const pending = tasks.filter(t => t.status === 'pending').length;
  const isActive = session._isActive !== false;

  container.innerHTML = `
    <div class="session-detail-page">
      <!-- Header -->
      <div class="detail-header">
        <button class="btn-back" onclick="goBackToSessions()">
          <span class="back-icon">←</span>
          <span>Back to Sessions</span>
        </button>
        <div class="detail-title-row">
          <h2 class="detail-session-id">${escapeHtml(session.session_id)}</h2>
          <div class="detail-badges">
            <span class="session-type-badge ${session.type || 'workflow'}">${session.type || 'workflow'}</span>
            <span class="session-status ${isActive ? 'active' : 'archived'}">
              ${isActive ? 'ACTIVE' : 'ARCHIVED'}
            </span>
          </div>
        </div>
      </div>

      <!-- Session Info Bar -->
      <div class="detail-info-bar">
        <div class="info-item">
          <span class="info-label">Created:</span>
          <span class="info-value">${formatDate(session.created_at)}</span>
        </div>
        ${session.archived_at ? `
          <div class="info-item">
            <span class="info-label">Archived:</span>
            <span class="info-value">${formatDate(session.archived_at)}</span>
          </div>
        ` : ''}
        <div class="info-item">
          <span class="info-label">Project:</span>
          <span class="info-value">${escapeHtml(session.project || '-')}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Tasks:</span>
          <span class="info-value">${completed}/${tasks.length} completed</span>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="detail-tabs">
        <button class="detail-tab active" data-tab="tasks" onclick="switchDetailTab('tasks')">
          <span class="tab-icon">📋</span>
          <span class="tab-text">Tasks</span>
          <span class="tab-count">${tasks.length}</span>
        </button>
        <button class="detail-tab" data-tab="context" onclick="switchDetailTab('context')">
          <span class="tab-icon">📦</span>
          <span class="tab-text">Context</span>
        </button>
        <button class="detail-tab" data-tab="summary" onclick="switchDetailTab('summary')">
          <span class="tab-icon">📝</span>
          <span class="tab-text">Summary</span>
        </button>
        <button class="detail-tab" data-tab="impl-plan" onclick="switchDetailTab('impl-plan')">
          <span class="tab-icon">📐</span>
          <span class="tab-text">IMPL Plan</span>
        </button>
        ${session.hasReview ? `
          <button class="detail-tab" data-tab="review" onclick="switchDetailTab('review')">
            <span class="tab-icon">🔍</span>
            <span class="tab-text">Review</span>
          </button>
        ` : ''}
      </div>

      <!-- Tab Content -->
      <div class="detail-tab-content" id="detailTabContent">
        ${renderTasksTab(session, tasks, completed, inProgress, pending)}
      </div>
    </div>
  `;
}

function goBackToSessions() {
  currentView = 'sessions';
  currentSessionDetailKey = null;
  updateContentTitle();
  renderSessions();
}

function switchDetailTab(tabName) {
  // Update active tab
  document.querySelectorAll('.detail-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  const session = sessionDataStore[currentSessionDetailKey];
  if (!session) return;

  const contentArea = document.getElementById('detailTabContent');
  const tasks = session.tasks || [];
  const completed = tasks.filter(t => t.status === 'completed').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const pending = tasks.filter(t => t.status === 'pending').length;

  switch (tabName) {
    case 'tasks':
      contentArea.innerHTML = renderTasksTab(session, tasks, completed, inProgress, pending);
      break;
    case 'context':
      loadAndRenderContextTab(session, contentArea);
      break;
    case 'summary':
      loadAndRenderSummaryTab(session, contentArea);
      break;
    case 'impl-plan':
      loadAndRenderImplPlanTab(session, contentArea);
      break;
    case 'review':
      loadAndRenderReviewTab(session, contentArea);
      break;
  }
}

function renderTasksTab(session, tasks, completed, inProgress, pending) {
  // Populate drawer tasks for click-to-open functionality
  currentDrawerTasks = tasks;

  // Auto-load full task details in server mode
  if (window.SERVER_MODE && session.path) {
    // Schedule auto-load after DOM render
    setTimeout(() => loadFullTaskDetails(), 50);
  }

  // Show task list with loading state or basic list
  const showLoading = window.SERVER_MODE && session.path;

  return `
    <div class="tasks-tab-content">
      <div class="task-stats-bar">
        <span class="task-stat completed">✓ ${completed} completed</span>
        <span class="task-stat in-progress">⟳ ${inProgress} in progress</span>
        <span class="task-stat pending">○ ${pending} pending</span>
      </div>
      <div class="tasks-list" id="tasksListContent">
        ${showLoading ? `
          <div class="tab-loading">Loading task details...</div>
        ` : (tasks.length === 0 ? `
          <div class="tab-empty-state">
            <div class="empty-icon">📋</div>
            <div class="empty-title">No Tasks</div>
            <div class="empty-text">This session has no tasks defined.</div>
          </div>
        ` : tasks.map(task => renderDetailTaskItem(task, false)).join(''))}
      </div>
    </div>
  `;
}

async function loadFullTaskDetails() {
  const session = sessionDataStore[currentSessionDetailKey];
  if (!session || !window.SERVER_MODE || !session.path) return;

  const tasksContainer = document.getElementById('tasksListContent');
  tasksContainer.innerHTML = '<div class="tab-loading">Loading full task details...</div>';

  try {
    const response = await fetch(`/api/session-detail?path=${encodeURIComponent(session.path)}&type=tasks`);
    if (response.ok) {
      const data = await response.json();
      if (data.tasks && data.tasks.length > 0) {
        // Populate drawer tasks for click-to-open functionality
        currentDrawerTasks = data.tasks;
        tasksContainer.innerHTML = data.tasks.map(task => renderDetailTaskItem(task, true)).join('');
        // Initialize collapsible sections
        tasksContainer.querySelectorAll('.collapsible-header').forEach(header => {
          header.addEventListener('click', () => toggleSection(header));
        });
      } else {
        tasksContainer.innerHTML = `
          <div class="tab-empty-state">
            <div class="empty-icon">📋</div>
            <div class="empty-title">No Task Files</div>
            <div class="empty-text">No IMPL-*.json files found in .task/</div>
          </div>
        `;
      }
    }
  } catch (err) {
    tasksContainer.innerHTML = `<div class="tab-error">Failed to load tasks: ${err.message}</div>`;
  }
}

function renderDetailTaskItem(task, showFull = false) {
  const statusIcon = task.status === 'completed' ? '✓' : task.status === 'in_progress' ? '⟳' : '○';
  const taskId = task.task_id || task.id || 'Unknown';

  if (!showFull) {
    return `
      <div class="detail-task-item ${task.status}" onclick="openTaskDrawer('${escapeHtml(taskId)}')" style="cursor: pointer;">
        <div class="task-item-header">
          <span class="task-status-icon">${statusIcon}</span>
          <span class="task-id-badge">${escapeHtml(taskId)}</span>
          <span class="task-title">${escapeHtml(task.title || 'Untitled')}</span>
          <span class="task-status-badge ${task.status}">${task.status}</span>
        </div>
      </div>
    `;
  }

  // Full task view with collapsible sections
  return `
    <div class="detail-task-item-full ${task.status}">
      <div class="task-item-header-full" onclick="openTaskDrawer('${escapeHtml(taskId)}')" style="cursor: pointer;" title="Click to open task details">
        <span class="task-status-icon">${statusIcon}</span>
        <span class="task-id-badge">${escapeHtml(taskId)}</span>
        <span class="task-title">${escapeHtml(task.title || task.meta?.title || 'Untitled')}</span>
        <span class="task-status-badge ${task.status}">${task.status}</span>
      </div>

      <!-- Meta Section -->
      <div class="collapsible-section">
        <div class="collapsible-header">
          <span class="collapse-icon">▶</span>
          <span class="section-label">meta</span>
          <span class="section-preview">${escapeHtml(getMetaPreview(task))}</span>
        </div>
        <div class="collapsible-content collapsed">
          ${renderDynamicFields(task.meta || {}, ['type', 'action', 'agent', 'scope', 'module'])}
        </div>
      </div>

      <!-- Context Section -->
      <div class="collapsible-section">
        <div class="collapsible-header">
          <span class="collapse-icon">▶</span>
          <span class="section-label">context</span>
          <span class="section-preview">${escapeHtml(getTaskContextPreview(task))}</span>
        </div>
        <div class="collapsible-content collapsed">
          ${renderTaskContext(task)}
        </div>
      </div>

      <!-- Flow Control Section -->
      ${task.flow_control || task.implementation ? `
        <div class="collapsible-section">
          <div class="collapsible-header">
            <span class="collapse-icon">▶</span>
            <span class="section-label">flow_control</span>
            <span class="section-preview">${escapeHtml(getFlowPreview(task))}</span>
          </div>
          <div class="collapsible-content collapsed">
            ${renderFlowControl(task)}
          </div>
        </div>
      ` : ''}

      <!-- Raw JSON Section -->
      <div class="collapsible-section">
        <div class="collapsible-header">
          <span class="collapse-icon">▶</span>
          <span class="section-label">raw_json</span>
          <span class="section-preview">View full JSON</span>
        </div>
        <div class="collapsible-content collapsed">
          <pre class="json-content">${escapeHtml(JSON.stringify(task, null, 2))}</pre>
        </div>
      </div>
    </div>
  `;
}

function getMetaPreview(task) {
  const meta = task.meta || {};
  const parts = [];
  if (meta.type) parts.push(meta.type);
  if (meta.action) parts.push(meta.action);
  if (meta.scope) parts.push(meta.scope);
  return parts.join(' | ') || 'No meta';
}

function getTaskContextPreview(task) {
  const items = [];
  const ctx = task.context || {};
  if (ctx.requirements?.length) items.push(`${ctx.requirements.length} reqs`);
  if (ctx.focus_paths?.length) items.push(`${ctx.focus_paths.length} paths`);
  if (task.modification_points?.length) items.push(`${task.modification_points.length} mods`);
  if (task.description) items.push('desc');
  return items.join(' | ') || 'No context';
}

function getFlowPreview(task) {
  const steps = task.flow_control?.implementation_approach?.length || task.implementation?.length || 0;
  return steps > 0 ? `${steps} steps` : 'No steps';
}

function renderTaskContext(task) {
  const sections = [];
  const ctx = task.context || {};

  // Description
  if (task.description) {
    sections.push(`
      <div class="context-field">
        <label>description:</label>
        <p>${escapeHtml(task.description)}</p>
      </div>
    `);
  }

  // Requirements
  if (ctx.requirements?.length) {
    sections.push(`
      <div class="context-field">
        <label>requirements:</label>
        <ul>${ctx.requirements.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
      </div>
    `);
  }

  // Focus paths
  if (ctx.focus_paths?.length) {
    sections.push(`
      <div class="context-field">
        <label>focus_paths:</label>
        <div class="path-tags">${ctx.focus_paths.map(p => `<span class="path-tag">${escapeHtml(p)}</span>`).join('')}</div>
      </div>
    `);
  }

  // Modification points
  if (task.modification_points?.length) {
    sections.push(`
      <div class="context-field">
        <label>modification_points:</label>
        <div class="mod-points">
          ${task.modification_points.map(m => `
            <div class="mod-point">
              <span class="array-item path-item">${escapeHtml(m.file || m)}</span>
              ${m.target ? `<span class="mod-target">→ ${escapeHtml(m.target)}</span>` : ''}
              ${m.change ? `<p class="mod-change">${escapeHtml(m.change)}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `);
  }

  // Acceptance criteria
  const acceptance = ctx.acceptance || task.acceptance || [];
  if (acceptance.length) {
    sections.push(`
      <div class="context-field">
        <label>acceptance:</label>
        <ul>${acceptance.map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul>
      </div>
    `);
  }

  return sections.length > 0
    ? `<div class="context-fields">${sections.join('')}</div>`
    : '<div class="field-value json-value-null">No context data</div>';
}

function renderFlowControl(task) {
  const sections = [];
  const fc = task.flow_control || {};

  // Implementation approach
  const steps = fc.implementation_approach || task.implementation || [];
  if (steps.length) {
    sections.push(`
      <div class="context-field">
        <label>implementation_approach:</label>
        <ol class="impl-steps">
          ${steps.map(s => `<li>${escapeHtml(typeof s === 'string' ? s : s.step || s.action || JSON.stringify(s))}</li>`).join('')}
        </ol>
      </div>
    `);
  }

  // Pre-analysis
  const preAnalysis = fc.pre_analysis || task.pre_analysis || [];
  if (preAnalysis.length) {
    sections.push(`
      <div class="context-field">
        <label>pre_analysis:</label>
        <ul>${preAnalysis.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
      </div>
    `);
  }

  // Target files
  const targetFiles = fc.target_files || task.target_files || [];
  if (targetFiles.length) {
    sections.push(`
      <div class="context-field">
        <label>target_files:</label>
        <div class="path-tags">${targetFiles.map(f => `<span class="path-tag">${escapeHtml(f)}</span>`).join('')}</div>
      </div>
    `);
  }

  return sections.length > 0
    ? `<div class="context-fields">${sections.join('')}</div>`
    : '<div class="field-value json-value-null">No flow control data</div>';
}

async function loadAndRenderContextTab(session, contentArea) {
  contentArea.innerHTML = '<div class="tab-loading">Loading context data...</div>';

  try {
    // Try to load context-package.json from server
    if (window.SERVER_MODE && session.path) {
      const response = await fetch(`/api/session-detail?path=${encodeURIComponent(session.path)}&type=context`);
      if (response.ok) {
        const data = await response.json();
        contentArea.innerHTML = renderContextContent(data.context);
        return;
      }
    }
    // Fallback: show placeholder
    contentArea.innerHTML = `
      <div class="tab-empty-state">
        <div class="empty-icon">📦</div>
        <div class="empty-title">Context Data</div>
        <div class="empty-text">Context data will be loaded from context-package.json</div>
      </div>
    `;
  } catch (err) {
    contentArea.innerHTML = `<div class="tab-error">Failed to load context: ${err.message}</div>`;
  }
}

function renderContextContent(context) {
  if (!context) {
    return `
      <div class="tab-empty-state">
        <div class="empty-icon">📦</div>
        <div class="empty-title">No Context Data</div>
        <div class="empty-text">No context-package.json found for this session.</div>
      </div>
    `;
  }

  return `
    <div class="context-tab-content">
      <pre class="json-content">${escapeHtml(JSON.stringify(context, null, 2))}</pre>
    </div>
  `;
}

async function loadAndRenderSummaryTab(session, contentArea) {
  contentArea.innerHTML = '<div class="tab-loading">Loading summaries...</div>';

  try {
    if (window.SERVER_MODE && session.path) {
      const response = await fetch(`/api/session-detail?path=${encodeURIComponent(session.path)}&type=summary`);
      if (response.ok) {
        const data = await response.json();
        contentArea.innerHTML = renderSummaryContent(data.summaries);
        return;
      }
    }
    contentArea.innerHTML = `
      <div class="tab-empty-state">
        <div class="empty-icon">📝</div>
        <div class="empty-title">Summaries</div>
        <div class="empty-text">Session summaries will be loaded from .summaries/</div>
      </div>
    `;
  } catch (err) {
    contentArea.innerHTML = `<div class="tab-error">Failed to load summaries: ${err.message}</div>`;
  }
}

function renderSummaryContent(summaries) {
  if (!summaries || summaries.length === 0) {
    return `
      <div class="tab-empty-state">
        <div class="empty-icon">📝</div>
        <div class="empty-title">No Summaries</div>
        <div class="empty-text">No summaries found in .summaries/</div>
      </div>
    `;
  }

  // Add event listener initialization after render
  setTimeout(() => {
    document.querySelectorAll('.summary-collapsible-header').forEach(header => {
      header.addEventListener('click', () => {
        const content = header.nextElementSibling;
        const icon = header.querySelector('.collapse-icon');
        const isCollapsed = content.classList.contains('collapsed');
        content.classList.toggle('collapsed');
        header.classList.toggle('expanded');
        icon.textContent = isCollapsed ? '▼' : '▶';
      });
    });
  }, 0);

  return `
    <div class="summary-tab-content">
      ${summaries.map((s, idx) => {
        const preview = (s.content || '').substring(0, 100).replace(/\n/g, ' ') + (s.content?.length > 100 ? '...' : '');
        return `
          <div class="summary-item-collapsible">
            <div class="summary-collapsible-header ${idx === 0 ? 'expanded' : ''}">
              <span class="collapse-icon">${idx === 0 ? '▼' : '▶'}</span>
              <span class="summary-name">📄 ${escapeHtml(s.name || 'Summary')}</span>
              <span class="summary-preview">${escapeHtml(preview)}</span>
            </div>
            <div class="summary-collapsible-content ${idx === 0 ? '' : 'collapsed'}">
              <pre class="summary-content-pre">${escapeHtml(s.content || '')}</pre>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

async function loadAndRenderImplPlanTab(session, contentArea) {
  contentArea.innerHTML = '<div class="tab-loading">Loading IMPL plan...</div>';

  try {
    if (window.SERVER_MODE && session.path) {
      const response = await fetch(`/api/session-detail?path=${encodeURIComponent(session.path)}&type=impl-plan`);
      if (response.ok) {
        const data = await response.json();
        contentArea.innerHTML = renderImplPlanContent(data.implPlan);
        return;
      }
    }
    contentArea.innerHTML = `
      <div class="tab-empty-state">
        <div class="empty-icon">📐</div>
        <div class="empty-title">IMPL Plan</div>
        <div class="empty-text">IMPL plan will be loaded from IMPL_PLAN.md</div>
      </div>
    `;
  } catch (err) {
    contentArea.innerHTML = `<div class="tab-error">Failed to load IMPL plan: ${err.message}</div>`;
  }
}

function renderImplPlanContent(implPlan) {
  if (!implPlan) {
    return `
      <div class="tab-empty-state">
        <div class="empty-icon">📐</div>
        <div class="empty-title">No IMPL Plan</div>
        <div class="empty-text">No IMPL_PLAN.md found for this session.</div>
      </div>
    `;
  }

  return `
    <div class="impl-plan-tab-content">
      <pre class="markdown-content">${escapeHtml(implPlan)}</pre>
    </div>
  `;
}

async function loadAndRenderReviewTab(session, contentArea) {
  contentArea.innerHTML = '<div class="tab-loading">Loading review data...</div>';

  try {
    if (window.SERVER_MODE && session.path) {
      const response = await fetch(`/api/session-detail?path=${encodeURIComponent(session.path)}&type=review`);
      if (response.ok) {
        const data = await response.json();
        contentArea.innerHTML = renderReviewContent(data.review);
        return;
      }
    }
    contentArea.innerHTML = `
      <div class="tab-empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">Review Data</div>
        <div class="empty-text">Review findings will be loaded from .review/</div>
      </div>
    `;
  } catch (err) {
    contentArea.innerHTML = `<div class="tab-error">Failed to load review: ${err.message}</div>`;
  }
}

function renderReviewContent(review) {
  if (!review || !review.dimensions) {
    return `
      <div class="tab-empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">No Review Data</div>
        <div class="empty-text">No review findings in .review/</div>
      </div>
    `;
  }

  const dimensions = Object.entries(review.dimensions);
  if (dimensions.length === 0) {
    return `
      <div class="tab-empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">No Findings</div>
        <div class="empty-text">No review findings found.</div>
      </div>
    `;
  }

  return `
    <div class="review-tab-content">
      ${dimensions.map(([dim, rawFindings]) => {
        // Normalize findings to always be an array
        let findings = [];
        if (Array.isArray(rawFindings)) {
          findings = rawFindings;
        } else if (rawFindings && typeof rawFindings === 'object') {
          // If it's an object with a findings array, use that
          if (Array.isArray(rawFindings.findings)) {
            findings = rawFindings.findings;
          } else {
            // Wrap single object in array or show raw JSON
            findings = [{ title: dim, description: JSON.stringify(rawFindings, null, 2), severity: 'info' }];
          }
        }

        return `
        <div class="review-dimension-section">
          <div class="dimension-header">
            <span class="dimension-name">${escapeHtml(dim)}</span>
            <span class="dimension-count">${findings.length} finding${findings.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="dimension-findings">
            ${findings.map(f => `
              <div class="finding-item ${f.severity || 'medium'}">
                <div class="finding-header">
                  <span class="finding-severity ${f.severity || 'medium'}">${f.severity || 'medium'}</span>
                  <span class="finding-title">${escapeHtml(f.title || 'Finding')}</span>
                </div>
                <p class="finding-description">${escapeHtml(f.description || '')}</p>
                ${f.file ? `<div class="finding-file">📄 ${escapeHtml(f.file)}${f.line ? ':' + f.line : ''}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `}).join('')}
    </div>
  `;
}

// ==========================================
// REVIEW SESSION DETAIL PAGE
// ==========================================
function renderReviewSessionDetailPage(session) {
  const isActive = session._isActive !== false;
  const tasks = session.tasks || [];
  const dimensions = session.reviewDimensions || [];

  // Calculate review statistics
  const totalFindings = dimensions.reduce((sum, d) => sum + (d.findings?.length || 0), 0);
  const criticalCount = dimensions.reduce((sum, d) =>
    sum + (d.findings?.filter(f => f.severity === 'critical').length || 0), 0);
  const highCount = dimensions.reduce((sum, d) =>
    sum + (d.findings?.filter(f => f.severity === 'high').length || 0), 0);

  return `
    <div class="session-detail-page session-type-review">
      <!-- Header -->
      <div class="detail-header">
        <button class="btn-back" onclick="goBackToSessions()">
          <span class="back-icon">←</span>
          <span>Back to Sessions</span>
        </button>
        <div class="detail-title-row">
          <h2 class="detail-session-id">🔍 ${escapeHtml(session.session_id)}</h2>
          <div class="detail-badges">
            <span class="session-type-badge review">Review</span>
            <span class="session-status ${isActive ? 'active' : 'archived'}">
              ${isActive ? 'ACTIVE' : 'ARCHIVED'}
            </span>
          </div>
        </div>
      </div>

      <!-- Review Progress Section -->
      <div class="review-progress-section">
        <div class="review-progress-header">
          <h3>📊 Review Progress</h3>
          <span class="phase-badge ${session.phase || 'in-progress'}">${session.phase || 'In Progress'}</span>
        </div>

        <!-- Summary Cards -->
        <div class="review-summary-grid">
          <div class="summary-card">
            <div class="summary-icon">📊</div>
            <div class="summary-value">${totalFindings}</div>
            <div class="summary-label">Total Findings</div>
          </div>
          <div class="summary-card critical">
            <div class="summary-icon">🔴</div>
            <div class="summary-value">${criticalCount}</div>
            <div class="summary-label">Critical</div>
          </div>
          <div class="summary-card high">
            <div class="summary-icon">🟠</div>
            <div class="summary-value">${highCount}</div>
            <div class="summary-label">High</div>
          </div>
          <div class="summary-card">
            <div class="summary-icon">📋</div>
            <div class="summary-value">${dimensions.length}</div>
            <div class="summary-label">Dimensions</div>
          </div>
        </div>

        <!-- Dimension Timeline -->
        <div class="dimension-timeline" id="dimensionTimeline">
          ${dimensions.map((dim, idx) => `
            <div class="dimension-item ${dim.status || 'pending'}" data-dimension="${dim.name}">
              <div class="dimension-number">D${idx + 1}</div>
              <div class="dimension-name">${escapeHtml(dim.name || 'Unknown')}</div>
              <div class="dimension-stats">${dim.findings?.length || 0} findings</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Findings Grid -->
      <div class="review-findings-section">
        <div class="findings-header">
          <h3>🔍 Findings by Dimension</h3>
          <div class="findings-filters">
            <button class="filter-btn active" data-severity="all" onclick="filterReviewFindings('all')">All</button>
            <button class="filter-btn" data-severity="critical" onclick="filterReviewFindings('critical')">Critical</button>
            <button class="filter-btn" data-severity="high" onclick="filterReviewFindings('high')">High</button>
            <button class="filter-btn" data-severity="medium" onclick="filterReviewFindings('medium')">Medium</button>
          </div>
        </div>
        <div class="findings-grid" id="reviewFindingsGrid">
          ${renderReviewFindingsGrid(dimensions)}
        </div>
      </div>

      <!-- Session Info -->
      <div class="detail-info-bar">
        <div class="info-item">
          <span class="info-label">Created:</span>
          <span class="info-value">${formatDate(session.created_at)}</span>
        </div>
        ${session.archived_at ? `
          <div class="info-item">
            <span class="info-label">Archived:</span>
            <span class="info-value">${formatDate(session.archived_at)}</span>
          </div>
        ` : ''}
        <div class="info-item">
          <span class="info-label">Project:</span>
          <span class="info-value">${escapeHtml(session.project || '-')}</span>
        </div>
      </div>
    </div>
  `;
}

function renderReviewFindingsGrid(dimensions) {
  if (!dimensions || dimensions.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-text">No review dimensions found</div>
      </div>
    `;
  }

  let html = '';
  dimensions.forEach(dim => {
    const findings = dim.findings || [];
    if (findings.length === 0) return;

    html += `
      <div class="dimension-findings-group" data-dimension="${dim.name}">
        <div class="dimension-group-header">
          <span class="dimension-badge">${escapeHtml(dim.name)}</span>
          <span class="dimension-count">${findings.length} findings</span>
        </div>
        <div class="findings-cards">
          ${findings.map(f => `
            <div class="finding-card severity-${f.severity || 'medium'}" data-severity="${f.severity || 'medium'}">
              <div class="finding-card-header">
                <span class="severity-badge ${f.severity || 'medium'}">${f.severity || 'medium'}</span>
                ${f.fix_status ? `<span class="fix-status-badge status-${f.fix_status}">${f.fix_status}</span>` : ''}
              </div>
              <div class="finding-card-title">${escapeHtml(f.title || 'Finding')}</div>
              <div class="finding-card-desc">${escapeHtml((f.description || '').substring(0, 100))}${f.description?.length > 100 ? '...' : ''}</div>
              ${f.file ? `<div class="finding-card-file">📄 ${escapeHtml(f.file)}${f.line ? ':' + f.line : ''}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  });

  return html || '<div class="empty-state"><div class="empty-text">No findings</div></div>';
}

function initReviewSessionPage(session) {
  // Initialize event handlers for review session page
  // Filter handlers are inline onclick
}

function filterReviewFindings(severity) {
  // Update filter buttons
  document.querySelectorAll('.findings-filters .filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.severity === severity);
  });

  // Filter finding cards
  document.querySelectorAll('.finding-card').forEach(card => {
    if (severity === 'all' || card.dataset.severity === severity) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
}

// ==========================================
// FIX SESSION DETAIL PAGE
// ==========================================
function renderFixSessionDetailPage(session) {
  const isActive = session._isActive !== false;
  const tasks = session.tasks || [];

  // Calculate fix statistics
  const totalTasks = tasks.length;
  const fixedCount = tasks.filter(t => t.status === 'completed' && t.result === 'fixed').length;
  const failedCount = tasks.filter(t => t.status === 'completed' && t.result === 'failed').length;
  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const percentComplete = totalTasks > 0 ? ((fixedCount + failedCount) / totalTasks * 100) : 0;

  return `
    <div class="session-detail-page session-type-fix">
      <!-- Header -->
      <div class="detail-header">
        <button class="btn-back" onclick="goBackToSessions()">
          <span class="back-icon">←</span>
          <span>Back to Sessions</span>
        </button>
        <div class="detail-title-row">
          <h2 class="detail-session-id">🔧 ${escapeHtml(session.session_id)}</h2>
          <div class="detail-badges">
            <span class="session-type-badge test-fix">Fix</span>
            <span class="session-status ${isActive ? 'active' : 'archived'}">
              ${isActive ? 'ACTIVE' : 'ARCHIVED'}
            </span>
          </div>
        </div>
      </div>

      <!-- Fix Progress Section -->
      <div class="fix-progress-section">
        <div class="fix-progress-header">
          <h3>🔧 Fix Progress</h3>
          <span class="phase-badge ${session.phase || 'execution'}">${session.phase || 'Execution'}</span>
        </div>

        <!-- Progress Bar -->
        <div class="fix-progress-bar">
          <div class="fix-progress-bar-fill" style="width: ${percentComplete}%"></div>
        </div>
        <div class="progress-text">
          <strong>${fixedCount + failedCount}/${totalTasks}</strong> completed (${percentComplete.toFixed(1)}%)
        </div>

        <!-- Summary Cards -->
        <div class="fix-summary-grid">
          <div class="summary-card">
            <div class="summary-icon">📊</div>
            <div class="summary-value">${totalTasks}</div>
            <div class="summary-label">Total Tasks</div>
          </div>
          <div class="summary-card fixed">
            <div class="summary-icon">✅</div>
            <div class="summary-value">${fixedCount}</div>
            <div class="summary-label">Fixed</div>
          </div>
          <div class="summary-card failed">
            <div class="summary-icon">❌</div>
            <div class="summary-value">${failedCount}</div>
            <div class="summary-label">Failed</div>
          </div>
          <div class="summary-card pending">
            <div class="summary-icon">⏳</div>
            <div class="summary-value">${pendingCount}</div>
            <div class="summary-label">Pending</div>
          </div>
        </div>

        <!-- Stage Timeline (if available) -->
        ${session.stages && session.stages.length > 0 ? `
          <div class="stage-timeline">
            ${session.stages.map((stage, idx) => `
              <div class="stage-item ${stage.status || 'pending'}">
                <div class="stage-number">Stage ${idx + 1}</div>
                <div class="stage-mode">${stage.execution_mode === 'parallel' ? '⚡ Parallel' : '➡️ Serial'}</div>
                <div class="stage-groups">${stage.groups?.length || 0} groups</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>

      <!-- Fix Tasks Grid -->
      <div class="fix-tasks-section">
        <div class="tasks-header">
          <h3>📋 Fix Tasks</h3>
          <div class="task-filters">
            <button class="filter-btn active" data-status="all" onclick="filterFixTasks('all')">All</button>
            <button class="filter-btn" data-status="pending" onclick="filterFixTasks('pending')">Pending</button>
            <button class="filter-btn" data-status="in_progress" onclick="filterFixTasks('in_progress')">In Progress</button>
            <button class="filter-btn" data-status="fixed" onclick="filterFixTasks('fixed')">Fixed</button>
            <button class="filter-btn" data-status="failed" onclick="filterFixTasks('failed')">Failed</button>
          </div>
        </div>
        <div class="fix-tasks-grid" id="fixTasksGrid">
          ${renderFixTasksGrid(tasks)}
        </div>
      </div>

      <!-- Session Info -->
      <div class="detail-info-bar">
        <div class="info-item">
          <span class="info-label">Created:</span>
          <span class="info-value">${formatDate(session.created_at)}</span>
        </div>
        ${session.archived_at ? `
          <div class="info-item">
            <span class="info-label">Archived:</span>
            <span class="info-value">${formatDate(session.archived_at)}</span>
          </div>
        ` : ''}
        <div class="info-item">
          <span class="info-label">Project:</span>
          <span class="info-value">${escapeHtml(session.project || '-')}</span>
        </div>
      </div>
    </div>
  `;
}

function renderFixTasksGrid(tasks) {
  if (!tasks || tasks.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-text">No fix tasks found</div>
      </div>
    `;
  }

  return tasks.map(task => {
    const statusClass = task.status === 'completed' ? (task.result || 'completed') : task.status;
    const statusText = task.status === 'completed' ? (task.result || 'completed') : task.status;

    return `
      <div class="fix-task-card status-${statusClass}" data-status="${statusClass}">
        <div class="task-card-header">
          <span class="task-id-badge">${escapeHtml(task.task_id || task.id || 'N/A')}</span>
          <span class="task-status-badge ${statusClass}">${statusText}</span>
        </div>
        <div class="task-card-title">${escapeHtml(task.title || 'Untitled Task')}</div>
        ${task.finding_title ? `<div class="task-finding">${escapeHtml(task.finding_title)}</div>` : ''}
        ${task.file ? `<div class="task-file">📄 ${escapeHtml(task.file)}${task.line ? ':' + task.line : ''}</div>` : ''}
        <div class="task-card-meta">
          ${task.dimension ? `<span class="task-dimension">${escapeHtml(task.dimension)}</span>` : ''}
          ${task.attempts && task.attempts > 1 ? `<span class="task-attempts">🔄 ${task.attempts} attempts</span>` : ''}
          ${task.commit_hash ? `<span class="task-commit">💾 ${task.commit_hash.substring(0, 7)}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function initFixSessionPage(session) {
  // Initialize event handlers for fix session page
  // Filter handlers are inline onclick
}

function filterFixTasks(status) {
  // Update filter buttons
  document.querySelectorAll('.task-filters .filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.status === status);
  });

  // Filter task cards
  document.querySelectorAll('.fix-task-card').forEach(card => {
    if (status === 'all' || card.dataset.status === status) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
}

function showRawSessionJson(sessionKey) {
  const session = sessionDataStore[sessionKey];
  if (!session) return;

  // Close current modal
  const currentModal = document.querySelector('.session-modal-overlay');
  if (currentModal) currentModal.remove();

  // Show JSON modal
  const overlay = document.createElement('div');
  overlay.className = 'json-modal-overlay active';
  overlay.innerHTML = `
    <div class="json-modal">
      <div class="json-modal-header">
        <div class="json-modal-title">
          <span class="session-id-badge">${escapeHtml(session.session_id)}</span>
          <span>Session JSON</span>
        </div>
        <button class="json-modal-close" onclick="closeJsonModal(this)">&times;</button>
      </div>
      <div class="json-modal-body">
        <pre class="json-modal-content">${escapeHtml(JSON.stringify(session, null, 2))}</pre>
      </div>
      <div class="json-modal-footer">
        <button class="btn-copy-json" onclick="copyJsonToClipboard(this)">Copy JSON</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
}

// Render Lite Tasks
function renderLiteTasks() {
  const container = document.getElementById('mainContent');

  const liteTasks = workflowData.liteTasks || {};
  const sessions = currentLiteType === 'lite-plan'
    ? liteTasks.litePlan || []
    : liteTasks.liteFix || [];

  if (sessions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚡</div>
        <div class="empty-title">No ${currentLiteType} Sessions</div>
        <div class="empty-text">No sessions found in .workflow/.${currentLiteType}/</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `<div class="sessions-grid">${sessions.map(session => renderLiteTaskCard(session)).join('')}</div>`;

  // Initialize collapsible sections
  document.querySelectorAll('.collapsible-header').forEach(header => {
    header.addEventListener('click', () => toggleSection(header));
  });

  // Render flowcharts for expanded tasks
  sessions.forEach(session => {
    session.tasks?.forEach(task => {
      if (task.flow_control?.implementation_approach) {
        renderFlowchartForTask(session.id, task);
      }
    });
  });
}

// Store lite task session data for detail page access
const liteTaskDataStore = {};

function renderLiteTaskCard(session) {
  const progress = session.progress || { total: 0, completed: 0, percentage: 0 };
  const tasks = session.tasks || [];

  // Store session data for detail page
  const sessionKey = `lite-${session.type}-${session.id}`.replace(/[^a-zA-Z0-9-]/g, '-');
  liteTaskDataStore[sessionKey] = session;

  return `
    <div class="session-card lite-task-card" onclick="showLiteTaskDetailPage('${sessionKey}')" style="cursor: pointer;">
      <div class="session-header">
        <div class="session-title">${escapeHtml(session.id)}</div>
        <span class="session-status ${session.type}">
          ${session.type === 'lite-plan' ? '📝 Plan' : '🔧 Fix'}
        </span>
      </div>
      <div class="session-body">
        <div class="session-meta">
          <span class="session-meta-item">📅 ${formatDate(session.createdAt)}</span>
          <span class="session-meta-item">📋 ${progress.total} tasks</span>
        </div>
        ${progress.total > 0 ? `
          <div class="progress-container">
            <div class="progress-header">
              <span>Progress</span>
              <span>${progress.completed}/${progress.total} (${progress.percentage}%)</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${progress.percentage}%"></div>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

// Lite Task Detail Page
function showLiteTaskDetailPage(sessionKey) {
  const session = liteTaskDataStore[sessionKey];
  if (!session) return;

  currentView = 'liteTaskDetail';
  currentSessionDetailKey = sessionKey;

  // Also store in sessionDataStore for tab switching compatibility
  sessionDataStore[sessionKey] = {
    ...session,
    session_id: session.id,
    created_at: session.createdAt,
    path: session.path,
    type: session.type
  };

  const container = document.getElementById('mainContent');
  const tasks = session.tasks || [];
  const plan = session.plan || {};
  const progress = session.progress || { total: 0, completed: 0, percentage: 0 };

  const completed = tasks.filter(t => t.status === 'completed').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const pending = tasks.filter(t => t.status === 'pending').length;

  container.innerHTML = `
    <div class="session-detail-page lite-task-detail-page">
      <!-- Header -->
      <div class="detail-header">
        <button class="btn-back" onclick="goBackToLiteTasks()">
          <span class="back-icon">←</span>
          <span>Back to ${session.type === 'lite-plan' ? 'Lite Plan' : 'Lite Fix'}</span>
        </button>
        <div class="detail-title-row">
          <h2 class="detail-session-id">${session.type === 'lite-plan' ? '📝' : '🔧'} ${escapeHtml(session.id)}</h2>
          <div class="detail-badges">
            <span class="session-type-badge ${session.type}">${session.type}</span>
          </div>
        </div>
      </div>

      <!-- Session Info Bar -->
      <div class="detail-info-bar">
        <div class="info-item">
          <span class="info-label">Created:</span>
          <span class="info-value">${formatDate(session.createdAt)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Tasks:</span>
          <span class="info-value">${completed}/${tasks.length} completed</span>
        </div>
        <div class="info-item">
          <span class="info-label">Progress:</span>
          <span class="info-value">${progress.percentage}%</span>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="detail-tabs">
        <button class="detail-tab active" data-tab="tasks" onclick="switchLiteDetailTab('tasks')">
          <span class="tab-icon">📋</span>
          <span class="tab-text">Tasks</span>
          <span class="tab-count">${tasks.length}</span>
        </button>
        <button class="detail-tab" data-tab="plan" onclick="switchLiteDetailTab('plan')">
          <span class="tab-icon">📐</span>
          <span class="tab-text">Plan</span>
        </button>
        <button class="detail-tab" data-tab="context" onclick="switchLiteDetailTab('context')">
          <span class="tab-icon">📦</span>
          <span class="tab-text">Context</span>
        </button>
        <button class="detail-tab" data-tab="summary" onclick="switchLiteDetailTab('summary')">
          <span class="tab-icon">📝</span>
          <span class="tab-text">Summary</span>
        </button>
      </div>

      <!-- Tab Content -->
      <div class="detail-tab-content" id="liteDetailTabContent">
        ${renderLiteTasksTab(session, tasks, completed, inProgress, pending)}
      </div>
    </div>
  `;

  // Initialize collapsible sections
  setTimeout(() => {
    document.querySelectorAll('.collapsible-header').forEach(header => {
      header.addEventListener('click', () => toggleSection(header));
    });
  }, 50);
}

function goBackToLiteTasks() {
  currentView = 'liteTasks';
  currentSessionDetailKey = null;
  updateContentTitle();
  renderLiteTasks();
}

function switchLiteDetailTab(tabName) {
  // Update active tab
  document.querySelectorAll('.detail-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  const session = liteTaskDataStore[currentSessionDetailKey];
  if (!session) return;

  const contentArea = document.getElementById('liteDetailTabContent');
  const tasks = session.tasks || [];
  const completed = tasks.filter(t => t.status === 'completed').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const pending = tasks.filter(t => t.status === 'pending').length;

  switch (tabName) {
    case 'tasks':
      contentArea.innerHTML = renderLiteTasksTab(session, tasks, completed, inProgress, pending);
      // Re-initialize collapsible sections
      setTimeout(() => {
        document.querySelectorAll('.collapsible-header').forEach(header => {
          header.addEventListener('click', () => toggleSection(header));
        });
      }, 50);
      break;
    case 'plan':
      contentArea.innerHTML = renderLitePlanTab(session);
      break;
    case 'context':
      loadAndRenderLiteContextTab(session, contentArea);
      break;
    case 'summary':
      loadAndRenderLiteSummaryTab(session, contentArea);
      break;
  }
}

function renderLiteTasksTab(session, tasks, completed, inProgress, pending) {
  // Populate drawer tasks for click-to-open functionality
  currentDrawerTasks = tasks;

  if (tasks.length === 0) {
    return `
      <div class="tab-empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-title">No Tasks</div>
        <div class="empty-text">This session has no tasks defined.</div>
      </div>
    `;
  }

  return `
    <div class="tasks-tab-content">
      <div class="task-stats-bar">
        <span class="task-stat completed">✓ ${completed} completed</span>
        <span class="task-stat in-progress">⟳ ${inProgress} in progress</span>
        <span class="task-stat pending">○ ${pending} pending</span>
      </div>
      <div class="tasks-list" id="liteTasksListContent">
        ${tasks.map(task => renderLiteTaskDetailItem(session.id, task)).join('')}
      </div>
    </div>
  `;
}

function renderLiteTaskDetailItem(sessionId, task) {
  const rawTask = task._raw || task;
  const taskJsonId = `task-json-${sessionId}-${task.id}`.replace(/[^a-zA-Z0-9-]/g, '-');
  taskJsonStore[taskJsonId] = rawTask;

  const statusIcon = task.status === 'completed' ? '✓' : task.status === 'in_progress' ? '⟳' : '○';

  return `
    <div class="detail-task-item-full ${task.status}">
      <div class="task-item-header-full" onclick="openTaskDrawerForLite('${sessionId}', '${escapeHtml(task.id)}')" style="cursor: pointer;" title="Click to open task details">
        <span class="task-status-icon">${statusIcon}</span>
        <span class="task-id-badge">${escapeHtml(task.id)}</span>
        <span class="task-title">${escapeHtml(task.title || 'Untitled')}</span>
        <span class="task-status-badge ${task.status}">${task.status}</span>
        <button class="btn-view-json" onclick="event.stopPropagation(); showJsonModal('${taskJsonId}', '${escapeHtml(task.id)}')">{ } JSON</button>
      </div>

      <!-- Collapsible: Meta -->
      <div class="collapsible-section">
        <div class="collapsible-header">
          <span class="collapse-icon">▶</span>
          <span class="section-label">meta</span>
          <span class="section-preview">${escapeHtml(getMetaPreviewForLite(task, rawTask))}</span>
        </div>
        <div class="collapsible-content collapsed">
          ${renderDynamicFields(task.meta || rawTask, ['type', 'action', 'agent', 'scope', 'module'])}
        </div>
      </div>

      <!-- Collapsible: Context -->
      <div class="collapsible-section">
        <div class="collapsible-header">
          <span class="collapse-icon">▶</span>
          <span class="section-label">context</span>
          <span class="section-preview">${escapeHtml(getContextPreview(task.context, rawTask))}</span>
        </div>
        <div class="collapsible-content collapsed">
          ${renderContextFields(task.context, rawTask)}
        </div>
      </div>

      <!-- Collapsible: Flow Control (with Flowchart) -->
      <div class="collapsible-section">
        <div class="collapsible-header">
          <span class="collapse-icon">▶</span>
          <span class="section-label">flow_control</span>
          <span class="section-preview">${escapeHtml(getFlowControlPreview(task.flow_control, rawTask))}</span>
        </div>
        <div class="collapsible-content collapsed">
          <div class="flowchart-container" id="flowchart-${sessionId}-${task.id}"></div>
          ${renderFlowControlDetails(task.flow_control, rawTask)}
        </div>
      </div>
    </div>
  `;
}

function getMetaPreviewForLite(task, rawTask) {
  const meta = task.meta || {};
  const parts = [];
  if (meta.type || rawTask.action) parts.push(meta.type || rawTask.action);
  if (meta.scope || rawTask.scope) parts.push(meta.scope || rawTask.scope);
  return parts.join(' | ') || 'No meta';
}

function openTaskDrawerForLite(sessionId, taskId) {
  const session = liteTaskDataStore[currentSessionDetailKey];
  if (!session) return;

  const task = session.tasks?.find(t => t.id === taskId);
  if (!task) return;

  // Set current drawer tasks
  currentDrawerTasks = session.tasks || [];

  document.getElementById('drawerTaskTitle').textContent = task.title || taskId;
  document.getElementById('drawerContent').innerHTML = renderTaskDrawerContent(task);
  document.getElementById('taskDetailDrawer').classList.add('open');
  document.getElementById('drawerOverlay').classList.add('active');

  // Initialize flowchart after DOM is updated
  setTimeout(() => {
    renderFullFlowchart(task.flow_control || task._raw?.flow_control);
  }, 100);
}

function renderLitePlanTab(session) {
  const plan = session.plan;

  if (!plan) {
    return `
      <div class="tab-empty-state">
        <div class="empty-icon">📐</div>
        <div class="empty-title">No Plan Data</div>
        <div class="empty-text">No plan.json found for this session.</div>
      </div>
    `;
  }

  return `
    <div class="plan-tab-content">
      <!-- Summary -->
      ${plan.summary ? `
        <div class="plan-section">
          <h4 class="plan-section-title">📋 Summary</h4>
          <p class="plan-summary-text">${escapeHtml(plan.summary)}</p>
        </div>
      ` : ''}

      <!-- Approach -->
      ${plan.approach ? `
        <div class="plan-section">
          <h4 class="plan-section-title">🎯 Approach</h4>
          <p class="plan-approach-text">${escapeHtml(plan.approach)}</p>
        </div>
      ` : ''}

      <!-- Focus Paths -->
      ${plan.focus_paths?.length ? `
        <div class="plan-section">
          <h4 class="plan-section-title">📁 Focus Paths</h4>
          <div class="path-tags">
            ${plan.focus_paths.map(p => `<span class="path-tag">${escapeHtml(p)}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Metadata -->
      <div class="plan-section">
        <h4 class="plan-section-title">ℹ️ Metadata</h4>
        <div class="plan-meta-grid">
          ${plan.estimated_time ? `<div class="meta-item"><span class="meta-label">Estimated Time:</span> ${escapeHtml(plan.estimated_time)}</div>` : ''}
          ${plan.complexity ? `<div class="meta-item"><span class="meta-label">Complexity:</span> ${escapeHtml(plan.complexity)}</div>` : ''}
          ${plan.recommended_execution ? `<div class="meta-item"><span class="meta-label">Execution:</span> ${escapeHtml(plan.recommended_execution)}</div>` : ''}
        </div>
      </div>

      <!-- Raw JSON -->
      <div class="plan-section">
        <h4 class="plan-section-title">{ } Raw JSON</h4>
        <pre class="json-content">${escapeHtml(JSON.stringify(plan, null, 2))}</pre>
      </div>
    </div>
  `;
}

async function loadAndRenderLiteContextTab(session, contentArea) {
  contentArea.innerHTML = '<div class="tab-loading">Loading context data...</div>';

  try {
    if (window.SERVER_MODE && session.path) {
      const response = await fetch(`/api/session-detail?path=${encodeURIComponent(session.path)}&type=context`);
      if (response.ok) {
        const data = await response.json();
        contentArea.innerHTML = renderLiteContextContent(data.context, session);
        return;
      }
    }
    // Fallback: show plan context if available
    contentArea.innerHTML = renderLiteContextContent(null, session);
  } catch (err) {
    contentArea.innerHTML = `<div class="tab-error">Failed to load context: ${err.message}</div>`;
  }
}

function renderLiteContextContent(context, session) {
  const plan = session.plan || {};

  // If we have context from context-package.json
  if (context) {
    return `
      <div class="context-tab-content">
        <pre class="json-content">${escapeHtml(JSON.stringify(context, null, 2))}</pre>
      </div>
    `;
  }

  // Fallback: show context from plan
  if (plan.focus_paths?.length || plan.summary) {
    return `
      <div class="context-tab-content">
        ${plan.summary ? `
          <div class="context-section">
            <h4>Summary</h4>
            <p>${escapeHtml(plan.summary)}</p>
          </div>
        ` : ''}
        ${plan.focus_paths?.length ? `
          <div class="context-section">
            <h4>Focus Paths</h4>
            <div class="path-tags">
              ${plan.focus_paths.map(p => `<span class="path-tag">${escapeHtml(p)}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  return `
    <div class="tab-empty-state">
      <div class="empty-icon">📦</div>
      <div class="empty-title">No Context Data</div>
      <div class="empty-text">No context-package.json found for this session.</div>
    </div>
  `;
}

async function loadAndRenderLiteSummaryTab(session, contentArea) {
  contentArea.innerHTML = '<div class="tab-loading">Loading summaries...</div>';

  try {
    if (window.SERVER_MODE && session.path) {
      const response = await fetch(`/api/session-detail?path=${encodeURIComponent(session.path)}&type=summary`);
      if (response.ok) {
        const data = await response.json();
        contentArea.innerHTML = renderSummaryContent(data.summaries);
        return;
      }
    }
    // Fallback
    contentArea.innerHTML = `
      <div class="tab-empty-state">
        <div class="empty-icon">📝</div>
        <div class="empty-title">No Summaries</div>
        <div class="empty-text">No summaries found in .summaries/</div>
      </div>
    `;
  } catch (err) {
    contentArea.innerHTML = `<div class="tab-error">Failed to load summaries: ${err.message}</div>`;
  }
}

// Store task JSON data in a global map instead of inline script tags
const taskJsonStore = {};

function renderTaskDetail(sessionId, task) {
  // Get raw task data for JSON view
  const rawTask = task._raw || task;
  const taskJsonId = `task-json-${sessionId}-${task.id}`.replace(/[^a-zA-Z0-9-]/g, '-');

  // Store JSON in memory instead of inline script tag
  taskJsonStore[taskJsonId] = rawTask;

  return `
    <div class="task-detail" id="task-${sessionId}-${task.id}">
      <div class="task-detail-header">
        <span class="task-id-badge">${escapeHtml(task.id)}</span>
        <span class="task-title">${escapeHtml(task.title || 'Untitled')}</span>
        <span class="task-status-badge ${task.status}">${task.status}</span>
        <div class="task-header-actions">
          <button class="btn-view-json" onclick="showJsonModal('${taskJsonId}', '${escapeHtml(task.id)}')">{ } JSON</button>
        </div>
      </div>

      <!-- Collapsible: Meta -->
      <div class="collapsible-section">
        <div class="collapsible-header">
          <span class="collapse-icon">▶</span>
          <span class="section-label">meta</span>
          <span class="section-preview">${escapeHtml((task.meta?.type || task.meta?.action || '') + (task.meta?.scope ? ' | ' + task.meta.scope : ''))}</span>
        </div>
        <div class="collapsible-content collapsed">
          ${renderDynamicFields(task.meta || rawTask, ['type', 'action', 'agent', 'scope', 'module', 'execution_group'])}
        </div>
      </div>

      <!-- Collapsible: Context -->
      <div class="collapsible-section">
        <div class="collapsible-header">
          <span class="collapse-icon">▶</span>
          <span class="section-label">context</span>
          <span class="section-preview">${escapeHtml(getContextPreview(task.context, rawTask))}</span>
        </div>
        <div class="collapsible-content collapsed">
          ${renderContextFields(task.context, rawTask)}
        </div>
      </div>

      <!-- Collapsible: Flow Control (with Flowchart) -->
      <div class="collapsible-section">
        <div class="collapsible-header">
          <span class="collapse-icon">▶</span>
          <span class="section-label">flow_control</span>
          <span class="section-preview">${escapeHtml(getFlowControlPreview(task.flow_control, rawTask))}</span>
        </div>
        <div class="collapsible-content collapsed">
          <div class="flowchart-container" id="flowchart-${sessionId}-${task.id}"></div>
          ${renderFlowControlDetails(task.flow_control, rawTask)}
        </div>
      </div>
    </div>
  `;
}

function getContextPreview(context, rawTask) {
  const items = [];
  if (context?.requirements?.length) items.push(`${context.requirements.length} reqs`);
  if (context?.acceptance?.length) items.push(`${context.acceptance.length} acceptance`);
  if (context?.focus_paths?.length) items.push(`${context.focus_paths.length} paths`);
  if (rawTask?.modification_points?.length) items.push(`${rawTask.modification_points.length} mods`);
  return items.join(' | ') || 'No context';
}

function getFlowControlPreview(flowControl, rawTask) {
  const steps = flowControl?.implementation_approach?.length || rawTask?.implementation?.length || 0;
  return steps > 0 ? `${steps} steps` : 'No steps';
}

function renderDynamicFields(obj, priorityKeys = []) {
  if (!obj || typeof obj !== 'object') return '<div class="field-value json-value-null">null</div>';

  const entries = Object.entries(obj).filter(([k, v]) => v !== null && v !== undefined && k !== '_raw');
  if (entries.length === 0) return '<div class="field-value json-value-null">Empty</div>';

  // Sort: priority keys first, then alphabetically
  entries.sort(([a], [b]) => {
    const aIdx = priorityKeys.indexOf(a);
    const bIdx = priorityKeys.indexOf(b);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.localeCompare(b);
  });

  return `<div class="field-group">${entries.map(([key, value]) => renderFieldRow(key, value)).join('')}</div>`;
}

function renderFieldRow(key, value) {
  return `
    <div class="field-row">
      <span class="field-label">${escapeHtml(key)}:</span>
      <div class="field-value">${renderFieldValue(key, value)}</div>
    </div>
  `;
}

function renderFieldValue(key, value) {
  if (value === null || value === undefined) {
    return '<span class="json-value-null">null</span>';
  }

  if (typeof value === 'boolean') {
    return `<span class="json-value-boolean">${value}</span>`;
  }

  if (typeof value === 'number') {
    return `<span class="json-value-number">${value}</span>`;
  }

  if (typeof value === 'string') {
    // Check if it's a path
    if (key.includes('path') || key.includes('file') || value.includes('/') || value.includes('\\')) {
      return `<span class="array-item path-item">${escapeHtml(value)}</span>`;
    }
    return `<span class="json-value-string">${escapeHtml(value)}</span>`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '<span class="json-value-null">[]</span>';

    // Check if array contains objects or strings
    if (typeof value[0] === 'object') {
      return `<div class="nested-array">${value.map((item, i) => `
        <div class="array-object">
          <div class="array-object-header">[${i + 1}]</div>
          ${renderDynamicFields(item)}
        </div>
      `).join('')}</div>`;
    }

    // Array of strings/primitives
    const isPathArray = key.includes('path') || key.includes('file');
    return `<div class="array-value">${value.map(v =>
      `<span class="array-item ${isPathArray ? 'path-item' : ''}">${escapeHtml(String(v))}</span>`
    ).join('')}</div>`;
  }

  if (typeof value === 'object') {
    return renderDynamicFields(value);
  }

  return escapeHtml(String(value));
}

function renderContextFields(context, rawTask) {
  const sections = [];

  // Requirements / Description
  const requirements = context?.requirements || [];
  const description = rawTask?.description;
  if (requirements.length > 0 || description) {
    sections.push(`
      <div class="context-field">
        <label>requirements:</label>
        ${description ? `<p style="margin-bottom: 8px;">${escapeHtml(description)}</p>` : ''}
        ${requirements.length > 0 ? `<ul>${requirements.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>` : ''}
      </div>
    `);
  }

  // Focus paths / Modification points
  const focusPaths = context?.focus_paths || [];
  const modPoints = rawTask?.modification_points || [];
  if (focusPaths.length > 0 || modPoints.length > 0) {
    sections.push(`
      <div class="context-field">
        <label>${modPoints.length > 0 ? 'modification_points:' : 'focus_paths:'}</label>
        ${modPoints.length > 0 ? `
          <div class="mod-points">
            ${modPoints.map(m => `
              <div class="mod-point">
                <span class="array-item path-item">${escapeHtml(m.file || m)}</span>
                ${m.target ? `<span class="mod-target">→ ${escapeHtml(m.target)}</span>` : ''}
                ${m.change ? `<p class="mod-change">${escapeHtml(m.change)}</p>` : ''}
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="path-tags">${focusPaths.map(p => `<span class="path-tag">${escapeHtml(p)}</span>`).join('')}</div>
        `}
      </div>
    `);
  }

  // Acceptance criteria
  const acceptance = context?.acceptance || rawTask?.acceptance || [];
  if (acceptance.length > 0) {
    sections.push(`
      <div class="context-field">
        <label>acceptance:</label>
        <ul>${acceptance.map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul>
      </div>
    `);
  }

  // Dependencies
  const depends = context?.depends_on || rawTask?.depends_on || [];
  if (depends.length > 0) {
    sections.push(`
      <div class="context-field">
        <label>depends_on:</label>
        <div class="path-tags">${depends.map(d => `<span class="array-item depends-badge">${escapeHtml(d)}</span>`).join('')}</div>
      </div>
    `);
  }

  // Reference
  const reference = rawTask?.reference;
  if (reference) {
    sections.push(`
      <div class="context-field">
        <label>reference:</label>
        ${renderDynamicFields(reference)}
      </div>
    `);
  }

  return sections.length > 0
    ? `<div class="context-fields">${sections.join('')}</div>`
    : '<div class="field-value json-value-null">No context data</div>';
}

function renderFlowControlDetails(flowControl, rawTask) {
  const sections = [];

  // Pre-analysis
  const preAnalysis = flowControl?.pre_analysis || rawTask?.pre_analysis || [];
  if (preAnalysis.length > 0) {
    sections.push(`
      <div class="context-field" style="margin-top: 16px;">
        <label>pre_analysis:</label>
        <ul>${preAnalysis.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
      </div>
    `);
  }

  // Target files
  const targetFiles = flowControl?.target_files || rawTask?.target_files || [];
  if (targetFiles.length > 0) {
    sections.push(`
      <div class="context-field">
        <label>target_files:</label>
        <div class="path-tags">${targetFiles.map(f => `<span class="path-tag">${escapeHtml(f)}</span>`).join('')}</div>
      </div>
    `);
  }

  return sections.join('');
}

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showJsonModal(jsonId, taskId) {
  // Get JSON from memory store instead of DOM
  const rawTask = taskJsonStore[jsonId];
  if (!rawTask) return;

  const jsonContent = JSON.stringify(rawTask, null, 2);

  // Create modal
  const overlay = document.createElement('div');
  overlay.className = 'json-modal-overlay';
  overlay.innerHTML = `
    <div class="json-modal">
      <div class="json-modal-header">
        <div class="json-modal-title">
          <span class="task-id-badge">${escapeHtml(taskId)}</span>
          <span>Task JSON</span>
        </div>
        <button class="json-modal-close" onclick="closeJsonModal(this)">&times;</button>
      </div>
      <div class="json-modal-body">
        <pre class="json-modal-content">${escapeHtml(jsonContent)}</pre>
      </div>
      <div class="json-modal-footer">
        <button class="btn-copy-json" onclick="copyJsonToClipboard(this)">Copy JSON</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Trigger animation
  requestAnimationFrame(() => overlay.classList.add('active'));

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeJsonModal(overlay.querySelector('.json-modal-close'));
  });

  // Close on Escape key
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeJsonModal(overlay.querySelector('.json-modal-close'));
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

function closeJsonModal(btn) {
  const overlay = btn.closest('.json-modal-overlay');
  overlay.classList.remove('active');
  setTimeout(() => overlay.remove(), 200);
}

function copyJsonToClipboard(btn) {
  const content = btn.closest('.json-modal').querySelector('.json-modal-content').textContent;
  navigator.clipboard.writeText(content).then(() => {
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = original, 2000);
  });
}

function toggleSection(header) {
  const content = header.nextElementSibling;
  const icon = header.querySelector('.collapse-icon');
  const isCollapsed = content.classList.contains('collapsed');

  content.classList.toggle('collapsed');
  header.classList.toggle('expanded');
  icon.textContent = isCollapsed ? '▼' : '▶';

  // Render flowchart if expanding flow_control section
  if (isCollapsed && header.querySelector('.section-label')?.textContent === 'flow_control') {
    const container = content.querySelector('.flowchart-container');
    if (container && !container.dataset.rendered) {
      const taskId = container.id.replace('flowchart-', '');
      const parts = taskId.split('-');
      const implId = parts.pop();
      const sessionId = parts.join('-');

      // Try to find task from multiple sources
      let task = null;

      // 1. Try liteTaskDataStore (for lite task detail page)
      if (currentSessionDetailKey && liteTaskDataStore[currentSessionDetailKey]) {
        const session = liteTaskDataStore[currentSessionDetailKey];
        task = session?.tasks?.find(t => t.id === implId || t.id === 'IMPL-' + implId || t.id === 'T' + implId);
      }

      // 2. Try workflowData.liteTasks (for lite tasks list view)
      if (!task) {
        const session = [...(workflowData.liteTasks?.litePlan || []), ...(workflowData.liteTasks?.liteFix || [])]
          .find(s => s.id === sessionId);
        task = session?.tasks?.find(t => t.id === implId || t.id === 'IMPL-' + implId || t.id === 'T' + implId);
      }

      // 3. Try sessionDataStore (for regular session detail page)
      if (!task && currentSessionDetailKey && sessionDataStore[currentSessionDetailKey]) {
        const session = sessionDataStore[currentSessionDetailKey];
        task = session?.tasks?.find(t => (t.task_id || t.id) === implId || (t.task_id || t.id) === 'IMPL-' + implId);
      }

      // Render flowchart if task found
      if (task) {
        const flowSteps = task.flow_control?.implementation_approach ||
                          task._raw?.flow_control?.implementation_approach ||
                          task._raw?.implementation ||
                          task.implementation;
        if (flowSteps && flowSteps.length > 0) {
          renderFlowchart(container.id, flowSteps);
          container.dataset.rendered = 'true';
        }
      }
    }
  }
}

function renderFlowchartForTask(sessionId, task) {
  // Will render on section expand
}

function renderFlowchart(containerId, steps) {
  if (!steps || steps.length === 0) return;
  if (typeof d3 === 'undefined') {
    document.getElementById(containerId).innerHTML = '<div class="flowchart-fallback">D3.js not loaded</div>';
    return;
  }

  const container = document.getElementById(containerId);
  const width = container.clientWidth || 500;
  const nodeHeight = 50;
  const nodeWidth = Math.min(width - 40, 300);
  const padding = 15;
  const height = steps.length * (nodeHeight + padding) + padding * 2;

  // Clear existing content
  container.innerHTML = '';

  const svg = d3.select('#' + containerId)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('class', 'flowchart-svg');

  // Arrow marker
  svg.append('defs').append('marker')
    .attr('id', 'arrow-' + containerId)
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 8)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', 'hsl(var(--border))');

  // Draw arrows
  for (let i = 0; i < steps.length - 1; i++) {
    const y1 = padding + i * (nodeHeight + padding) + nodeHeight;
    const y2 = padding + (i + 1) * (nodeHeight + padding);

    svg.append('line')
      .attr('x1', width / 2)
      .attr('y1', y1)
      .attr('x2', width / 2)
      .attr('y2', y2)
      .attr('stroke', 'hsl(var(--border))')
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrow-' + containerId + ')');
  }

  // Draw nodes
  const nodes = svg.selectAll('.node')
    .data(steps)
    .enter()
    .append('g')
    .attr('class', 'flowchart-node')
    .attr('transform', (d, i) => `translate(${(width - nodeWidth) / 2}, ${padding + i * (nodeHeight + padding)})`);

  // Node rectangles
  nodes.append('rect')
    .attr('width', nodeWidth)
    .attr('height', nodeHeight)
    .attr('rx', 6)
    .attr('fill', (d, i) => i === 0 ? 'hsl(var(--primary))' : 'hsl(var(--card))')
    .attr('stroke', 'hsl(var(--border))')
    .attr('stroke-width', 1);

  // Step number circle
  nodes.append('circle')
    .attr('cx', 20)
    .attr('cy', nodeHeight / 2)
    .attr('r', 12)
    .attr('fill', (d, i) => i === 0 ? 'rgba(255,255,255,0.2)' : 'hsl(var(--muted))');

  nodes.append('text')
    .attr('x', 20)
    .attr('y', nodeHeight / 2)
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('font-size', '11px')
    .attr('fill', (d, i) => i === 0 ? 'white' : 'hsl(var(--muted-foreground))')
    .text((d, i) => i + 1);

  // Node text (step name)
  nodes.append('text')
    .attr('x', 45)
    .attr('y', nodeHeight / 2)
    .attr('dominant-baseline', 'central')
    .attr('fill', (d, i) => i === 0 ? 'white' : 'hsl(var(--foreground))')
    .attr('font-size', '12px')
    .text(d => {
      const text = d.step || d.action || 'Step';
      return text.length > 35 ? text.substring(0, 32) + '...' : text;
    });
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    // Check if date is valid
    if (isNaN(date.getTime())) return '-';
    // Format: YYYY/MM/DD HH:mm
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}`;
  } catch {
    return '-';
  }
}

// ==========================================
// TASK DETAIL DRAWER
// ==========================================
let currentDrawerTasks = [];

function openTaskDrawer(taskId) {
  const task = currentDrawerTasks.find(t => (t.task_id || t.id) === taskId);
  if (!task) {
    console.error('Task not found:', taskId);
    return;
  }

  document.getElementById('drawerTaskTitle').textContent = task.title || taskId;
  document.getElementById('drawerContent').innerHTML = renderTaskDrawerContent(task);
  document.getElementById('taskDetailDrawer').classList.add('open');
  document.getElementById('drawerOverlay').classList.add('active');

  // Initialize flowchart after DOM is updated
  setTimeout(() => {
    renderFullFlowchart(task.flow_control);
  }, 100);
}

function closeTaskDrawer() {
  document.getElementById('taskDetailDrawer').classList.remove('open');
  document.getElementById('drawerOverlay').classList.remove('active');
}

function switchDrawerTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.drawer-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  // Update tab panels
  document.querySelectorAll('.drawer-panel').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.tab === tabName);
  });

  // Render flowchart if switching to flowchart tab
  if (tabName === 'flowchart') {
    const taskId = document.getElementById('drawerTaskTitle').textContent;
    const task = currentDrawerTasks.find(t => t.title === taskId || t.task_id === taskId);
    if (task?.flow_control) {
      setTimeout(() => renderFullFlowchart(task.flow_control), 50);
    }
  }
}

function renderTaskDrawerContent(task) {
  const fc = task.flow_control || {};

  return `
    <!-- Task Header -->
    <div class="drawer-task-header">
      <span class="task-id-badge">${escapeHtml(task.task_id || task.id || 'N/A')}</span>
      <span class="task-status-badge ${task.status || 'pending'}">${task.status || 'pending'}</span>
    </div>

    <!-- Tab Navigation -->
    <div class="drawer-tabs">
      <button class="drawer-tab active" data-tab="overview" onclick="switchDrawerTab('overview')">Overview</button>
      <button class="drawer-tab" data-tab="flowchart" onclick="switchDrawerTab('flowchart')">Flowchart</button>
      <button class="drawer-tab" data-tab="files" onclick="switchDrawerTab('files')">Files</button>
      <button class="drawer-tab" data-tab="raw" onclick="switchDrawerTab('raw')">Raw JSON</button>
    </div>

    <!-- Tab Content -->
    <div class="drawer-tab-content">
      <!-- Overview Tab (default) -->
      <div class="drawer-panel active" data-tab="overview">
        ${renderPreAnalysisSteps(fc.pre_analysis)}
        ${renderImplementationStepsList(fc.implementation_approach)}
      </div>

      <!-- Flowchart Tab -->
      <div class="drawer-panel" data-tab="flowchart">
        <div id="flowchartContainer" class="flowchart-container"></div>
      </div>

      <!-- Files Tab -->
      <div class="drawer-panel" data-tab="files">
        ${renderTargetFiles(fc.target_files)}
        ${fc.test_commands ? renderTestCommands(fc.test_commands) : ''}
      </div>

      <!-- Raw JSON Tab -->
      <div class="drawer-panel" data-tab="raw">
        <pre class="json-view">${escapeHtml(JSON.stringify(task, null, 2))}</pre>
      </div>
    </div>
  `;
}

function renderPreAnalysisSteps(preAnalysis) {
  if (!Array.isArray(preAnalysis) || preAnalysis.length === 0) {
    return '<div class="empty-section">No pre-analysis steps</div>';
  }

  return `
    <div class="drawer-section">
      <h4 class="drawer-section-title">Pre-Analysis Steps</h4>
      <div class="steps-list">
        ${preAnalysis.map((item, idx) => `
          <div class="step-item">
            <div class="step-badge">${idx + 1}</div>
            <div class="step-content">
              <div class="step-name">${escapeHtml(item.step || item.action || 'Step ' + (idx + 1))}</div>
              ${item.action && item.action !== item.step ? `<div class="step-action">${escapeHtml(item.action)}</div>` : ''}
              ${item.commands?.length ? `
                <div class="step-commands">
                  ${item.commands.map(c => `<code>${escapeHtml(typeof c === 'string' ? c : JSON.stringify(c))}</code>`).join('')}
                </div>
              ` : ''}
              ${item.output_to ? `<div class="step-output">Output: <code>${escapeHtml(item.output_to)}</code></div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderImplementationStepsList(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return '<div class="empty-section">No implementation steps</div>';
  }

  return `
    <div class="drawer-section">
      <h4 class="drawer-section-title">Implementation Approach</h4>
      <div class="impl-steps-list">
        ${steps.map((step, idx) => {
          const hasMods = step.modification_points?.length;
          const hasFlow = step.logic_flow?.length;
          const hasColumns = hasMods || hasFlow;

          return `
          <div class="impl-step-item">
            <div class="impl-step-header">
              <span class="impl-step-number">Step ${step.step || idx + 1}</span>
              <span class="impl-step-title">${escapeHtml(step.title || 'Untitled Step')}</span>
            </div>
            ${step.description ? `<div class="impl-step-desc">${escapeHtml(step.description)}</div>` : ''}
            ${hasColumns ? `
              <div class="impl-step-columns">
                ${hasMods ? `
                  <div class="impl-step-mods">
                    <strong>Modifications</strong>
                    <ul>
                      ${step.modification_points.map(mp => `
                        <li>
                          ${typeof mp === 'string' ? escapeHtml(mp) : `
                            <code>${escapeHtml(mp.file || mp.path || '')}</code>
                            ${mp.changes ? ` - ${escapeHtml(mp.changes)}` : ''}
                          `}
                        </li>
                      `).join('')}
                    </ul>
                  </div>
                ` : '<div class="impl-step-mods"><strong>Modifications</strong><p>-</p></div>'}
                ${hasFlow ? `
                  <div class="impl-step-flow">
                    <strong>Logic Flow</strong>
                    <ol>
                      ${step.logic_flow.map(lf => `<li>${escapeHtml(typeof lf === 'string' ? lf : lf.action || JSON.stringify(lf))}</li>`).join('')}
                    </ol>
                  </div>
                ` : '<div class="impl-step-flow"><strong>Logic Flow</strong><p>-</p></div>'}
              </div>
            ` : ''}
            ${step.depends_on?.length ? `
              <div class="impl-step-deps">
                Depends on: ${step.depends_on.map(d => `<span class="dep-badge">${escapeHtml(d)}</span>`).join(' ')}
              </div>
            ` : ''}
          </div>
        `}).join('')}
      </div>
    </div>
  `;
}

function renderTargetFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return '<div class="empty-section">No target files</div>';
  }

  // Get current project path for building full paths
  const projectPath = window.currentProjectPath || '';

  return `
    <div class="drawer-section">
      <h4 class="drawer-section-title">Target Files</h4>
      <ul class="target-files-list">
        ${files.map(f => {
          const filePath = typeof f === 'string' ? f : (f.path || JSON.stringify(f));
          // Build full path for vscode link
          const fullPath = filePath.startsWith('/') || filePath.includes(':')
            ? filePath
            : (projectPath ? `${projectPath}/${filePath}` : filePath);
          const vscodeUri = `vscode://file/${fullPath.replace(/\\/g, '/')}`;

          return `
            <li class="file-item">
              <a href="${vscodeUri}" class="file-link" title="Open in VS Code: ${escapeHtml(fullPath)}">
                <span class="file-icon">📄</span>
                <code>${escapeHtml(filePath)}</code>
                <span class="file-action">↗</span>
              </a>
            </li>
          `;
        }).join('')}
      </ul>
    </div>
  `;
}

function renderTestCommands(testCommands) {
  if (!testCommands || typeof testCommands !== 'object') return '';

  return `
    <div class="drawer-section">
      <h4 class="drawer-section-title">Test Commands</h4>
      <div class="test-commands-list">
        ${Object.entries(testCommands).map(([key, val]) => `
          <div class="test-command-item">
            <strong>${escapeHtml(key)}:</strong>
            <code>${escapeHtml(typeof val === 'string' ? val : JSON.stringify(val))}</code>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function truncateText(text, maxLen) {
  if (!text) return '';
  return text.length > maxLen ? text.substring(0, maxLen - 3) + '...' : text;
}

// D3.js Full Flowchart combining pre_analysis and implementation_approach
function renderFullFlowchart(flowControl) {
  if (!flowControl) return;

  const container = document.getElementById('flowchartContainer');
  if (!container) return;

  const preAnalysis = Array.isArray(flowControl.pre_analysis) ? flowControl.pre_analysis : [];
  const implSteps = Array.isArray(flowControl.implementation_approach) ? flowControl.implementation_approach : [];

  if (preAnalysis.length === 0 && implSteps.length === 0) {
    container.innerHTML = '<div class="empty-section">No flowchart data available</div>';
    return;
  }

  const width = container.clientWidth || 500;
  const nodeHeight = 90;
  const nodeWidth = Math.min(width - 40, 420);
  const nodeGap = 45;
  const sectionGap = 30;

  // Calculate total nodes and height
  const totalPreNodes = preAnalysis.length;
  const totalImplNodes = implSteps.length;
  const hasBothSections = totalPreNodes > 0 && totalImplNodes > 0;
  const height = (totalPreNodes + totalImplNodes) * (nodeHeight + nodeGap) +
    (hasBothSections ? sectionGap + 60 : 0) + 60;

  // Clear existing
  d3.select('#flowchartContainer').selectAll('*').remove();

  const svg = d3.select('#flowchartContainer')
    .append('svg')
    .attr('width', '100%')
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`);

  // Add arrow markers
  const defs = svg.append('defs');

  defs.append('marker')
    .attr('id', 'arrowhead-pre')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 8)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#f59e0b');

  defs.append('marker')
    .attr('id', 'arrowhead-impl')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 8)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', 'hsl(var(--primary))');

  let currentY = 20;

  // Render Pre-Analysis section
  if (totalPreNodes > 0) {
    // Section label
    svg.append('text')
      .attr('x', 20)
      .attr('y', currentY)
      .attr('fill', '#f59e0b')
      .attr('font-weight', 'bold')
      .attr('font-size', '13px')
      .text('📋 Pre-Analysis Steps');

    currentY += 25;

    preAnalysis.forEach((step, idx) => {
      const x = (width - nodeWidth) / 2;

      // Connection line to next node
      if (idx < preAnalysis.length - 1) {
        svg.append('line')
          .attr('x1', width / 2)
          .attr('y1', currentY + nodeHeight)
          .attr('x2', width / 2)
          .attr('y2', currentY + nodeHeight + nodeGap - 10)
          .attr('stroke', '#f59e0b')
          .attr('stroke-width', 2)
          .attr('marker-end', 'url(#arrowhead-pre)');
      }

      // Node group
      const nodeG = svg.append('g')
        .attr('class', 'flowchart-node')
        .attr('transform', `translate(${x}, ${currentY})`);

      // Node rectangle (pre-analysis style - amber/orange)
      nodeG.append('rect')
        .attr('width', nodeWidth)
        .attr('height', nodeHeight)
        .attr('rx', 10)
        .attr('fill', 'hsl(var(--card))')
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,3');

      // Step badge
      nodeG.append('circle')
        .attr('cx', 25)
        .attr('cy', 25)
        .attr('r', 15)
        .attr('fill', '#f59e0b');

      nodeG.append('text')
        .attr('x', 25)
        .attr('y', 30)
        .attr('text-anchor', 'middle')
        .attr('fill', 'white')
        .attr('font-weight', 'bold')
        .attr('font-size', '11px')
        .text('P' + (idx + 1));

      // Step name
      const stepName = step.step || step.action || 'Pre-step ' + (idx + 1);
      nodeG.append('text')
        .attr('x', 50)
        .attr('y', 28)
        .attr('fill', 'hsl(var(--foreground))')
        .attr('font-weight', '600')
        .attr('font-size', '13px')
        .text(truncateText(stepName, 40));

      // Action description
      if (step.action && step.action !== stepName) {
        nodeG.append('text')
          .attr('x', 15)
          .attr('y', 52)
          .attr('fill', 'hsl(var(--muted-foreground))')
          .attr('font-size', '11px')
          .text(truncateText(step.action, 50));
      }

      // Output indicator
      if (step.output_to) {
        nodeG.append('text')
          .attr('x', 15)
          .attr('y', 75)
          .attr('fill', '#f59e0b')
          .attr('font-size', '10px')
          .text('→ ' + truncateText(step.output_to, 45));
      }

      currentY += nodeHeight + nodeGap;
    });
  }

  // Section divider if both sections exist
  if (hasBothSections) {
    currentY += 10;
    svg.append('line')
      .attr('x1', 40)
      .attr('y1', currentY)
      .attr('x2', width - 40)
      .attr('y2', currentY)
      .attr('stroke', 'hsl(var(--border))')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4');

    // Connecting arrow from pre-analysis to implementation
    svg.append('line')
      .attr('x1', width / 2)
      .attr('y1', currentY - nodeGap + 5)
      .attr('x2', width / 2)
      .attr('y2', currentY + sectionGap - 5)
      .attr('stroke', 'hsl(var(--primary))')
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrowhead-impl)');

    currentY += sectionGap;
  }

  // Render Implementation section
  if (totalImplNodes > 0) {
    // Section label
    svg.append('text')
      .attr('x', 20)
      .attr('y', currentY)
      .attr('fill', 'hsl(var(--primary))')
      .attr('font-weight', 'bold')
      .attr('font-size', '13px')
      .text('🔧 Implementation Steps');

    currentY += 25;

    implSteps.forEach((step, idx) => {
      const x = (width - nodeWidth) / 2;

      // Connection line to next node
      if (idx < implSteps.length - 1) {
        svg.append('line')
          .attr('x1', width / 2)
          .attr('y1', currentY + nodeHeight)
          .attr('x2', width / 2)
          .attr('y2', currentY + nodeHeight + nodeGap - 10)
          .attr('stroke', 'hsl(var(--primary))')
          .attr('stroke-width', 2)
          .attr('marker-end', 'url(#arrowhead-impl)');
      }

      // Node group
      const nodeG = svg.append('g')
        .attr('class', 'flowchart-node')
        .attr('transform', `translate(${x}, ${currentY})`);

      // Node rectangle (implementation style - blue)
      nodeG.append('rect')
        .attr('width', nodeWidth)
        .attr('height', nodeHeight)
        .attr('rx', 10)
        .attr('fill', 'hsl(var(--card))')
        .attr('stroke', 'hsl(var(--primary))')
        .attr('stroke-width', 2);

      // Step badge
      nodeG.append('circle')
        .attr('cx', 25)
        .attr('cy', 25)
        .attr('r', 15)
        .attr('fill', 'hsl(var(--primary))');

      nodeG.append('text')
        .attr('x', 25)
        .attr('y', 30)
        .attr('text-anchor', 'middle')
        .attr('fill', 'white')
        .attr('font-weight', 'bold')
        .attr('font-size', '12px')
        .text(step.step || idx + 1);

      // Step title
      nodeG.append('text')
        .attr('x', 50)
        .attr('y', 28)
        .attr('fill', 'hsl(var(--foreground))')
        .attr('font-weight', '600')
        .attr('font-size', '13px')
        .text(truncateText(step.title || 'Step ' + (idx + 1), 40));

      // Description
      if (step.description) {
        nodeG.append('text')
          .attr('x', 15)
          .attr('y', 52)
          .attr('fill', 'hsl(var(--muted-foreground))')
          .attr('font-size', '11px')
          .text(truncateText(step.description, 50));
      }

      // Output/depends indicator
      if (step.depends_on?.length) {
        nodeG.append('text')
          .attr('x', 15)
          .attr('y', 75)
          .attr('fill', 'var(--warning-color)')
          .attr('font-size', '10px')
          .text('← Depends: ' + step.depends_on.join(', '));
      }

      currentY += nodeHeight + nodeGap;
    });
  }
}

// D3.js Vertical Flowchart for Implementation Approach (legacy)
function renderImplementationFlowchart(steps) {
  if (!Array.isArray(steps) || steps.length === 0) return;

  const container = document.getElementById('flowchartContainer');
  if (!container) return;

  const width = container.clientWidth || 500;
  const nodeHeight = 100;
  const nodeWidth = Math.min(width - 40, 400);
  const nodeGap = 50;
  const height = steps.length * (nodeHeight + nodeGap) + 40;

  // Clear existing
  d3.select('#flowchartContainer').selectAll('*').remove();

  const svg = d3.select('#flowchartContainer')
    .append('svg')
    .attr('width', '100%')
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`);

  // Add arrow marker
  svg.append('defs').append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 8)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', 'hsl(var(--primary))');

  // Draw nodes and connections
  steps.forEach((step, idx) => {
    const y = idx * (nodeHeight + nodeGap) + 20;
    const x = (width - nodeWidth) / 2;

    // Connection line to next node
    if (idx < steps.length - 1) {
      svg.append('line')
        .attr('x1', width / 2)
        .attr('y1', y + nodeHeight)
        .attr('x2', width / 2)
        .attr('y2', y + nodeHeight + nodeGap - 10)
        .attr('stroke', 'hsl(var(--primary))')
        .attr('stroke-width', 2)
        .attr('marker-end', 'url(#arrowhead)');
    }

    // Node group
    const nodeG = svg.append('g')
      .attr('class', 'flowchart-node')
      .attr('transform', `translate(${x}, ${y})`);

    // Node rectangle with gradient
    nodeG.append('rect')
      .attr('width', nodeWidth)
      .attr('height', nodeHeight)
      .attr('rx', 10)
      .attr('fill', 'hsl(var(--card))')
      .attr('stroke', 'hsl(var(--primary))')
      .attr('stroke-width', 2)
      .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))');

    // Step number badge
    nodeG.append('circle')
      .attr('cx', 25)
      .attr('cy', 25)
      .attr('r', 15)
      .attr('fill', 'hsl(var(--primary))');

    nodeG.append('text')
      .attr('x', 25)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-weight', 'bold')
      .attr('font-size', '12px')
      .text(step.step || idx + 1);

    // Step title
    nodeG.append('text')
      .attr('x', 50)
      .attr('y', 30)
      .attr('fill', 'hsl(var(--foreground))')
      .attr('font-weight', '600')
      .attr('font-size', '14px')
      .text(truncateText(step.title || 'Step ' + (idx + 1), 35));

    // Step description (if available)
    if (step.description) {
      nodeG.append('text')
        .attr('x', 15)
        .attr('y', 55)
        .attr('fill', 'hsl(var(--muted-foreground))')
        .attr('font-size', '12px')
        .text(truncateText(step.description, 45));
    }

    // Output indicator
    if (step.output) {
      nodeG.append('text')
        .attr('x', 15)
        .attr('y', 80)
        .attr('fill', 'var(--success-color)')
        .attr('font-size', '11px')
        .text('→ ' + truncateText(step.output, 40));
    }
  });
}
