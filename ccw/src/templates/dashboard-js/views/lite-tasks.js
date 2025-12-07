// ============================================
// LITE TASKS VIEW
// ============================================
// Lite-plan and lite-fix task list and detail rendering

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

function renderLiteTaskCard(session) {
  const tasks = session.tasks || [];

  // Store session data for detail page
  const sessionKey = `lite-${session.type}-${session.id}`.replace(/[^a-zA-Z0-9-]/g, '-');
  liteTaskDataStore[sessionKey] = session;

  return `
    <div class="session-card lite-task-card" onclick="showLiteTaskDetailPage('${sessionKey}')" style="cursor: pointer;">
      <div class="session-header">
        <div class="session-title">${escapeHtml(session.id)}</div>
        <span class="session-status ${session.type}">
          ${session.type === 'lite-plan' ? '📝 PLAN' : '🔧 FIX'}
        </span>
      </div>
      <div class="session-body">
        <div class="session-meta">
          <span class="session-meta-item">📅 ${formatDate(session.createdAt)}</span>
          <span class="session-meta-item">📋 ${tasks.length} tasks</span>
        </div>
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
          <span class="info-value">${tasks.length} tasks</span>
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

  // Get preview info for lite tasks
  const action = rawTask.action || '';
  const scope = rawTask.scope || '';
  const modCount = rawTask.modification_points?.length || 0;
  const implCount = rawTask.implementation?.length || 0;
  const acceptCount = rawTask.acceptance?.length || 0;

  return `
    <div class="detail-task-item-full lite-task-item" onclick="openTaskDrawerForLite('${sessionId}', '${escapeHtml(task.id)}')" style="cursor: pointer;" title="Click to view details">
      <div class="task-item-header-lite">
        <span class="task-id-badge">${escapeHtml(task.id)}</span>
        <span class="task-title">${escapeHtml(task.title || 'Untitled')}</span>
        <button class="btn-view-json" onclick="event.stopPropagation(); showJsonModal('${taskJsonId}', '${escapeHtml(task.id)}')">{ } JSON</button>
      </div>
      <div class="task-item-meta-lite">
        ${action ? `<span class="meta-badge action">${escapeHtml(action)}</span>` : ''}
        ${scope ? `<span class="meta-badge scope">${escapeHtml(scope)}</span>` : ''}
        ${modCount > 0 ? `<span class="meta-badge mods">${modCount} mods</span>` : ''}
        ${implCount > 0 ? `<span class="meta-badge impl">${implCount} steps</span>` : ''}
        ${acceptCount > 0 ? `<span class="meta-badge accept">${acceptCount} acceptance</span>` : ''}
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

  // Set current drawer tasks and session context
  currentDrawerTasks = session.tasks || [];
  window._currentDrawerSession = session;

  document.getElementById('drawerTaskTitle').textContent = task.title || taskId;
  // Use dedicated lite task drawer renderer
  document.getElementById('drawerContent').innerHTML = renderLiteTaskDrawerContent(task, session);
  document.getElementById('taskDetailDrawer').classList.add('open');
  document.getElementById('drawerOverlay').classList.add('active');
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
