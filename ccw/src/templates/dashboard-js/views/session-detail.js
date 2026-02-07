// ============================================
// SESSION DETAIL VIEW
// ============================================
// Standard workflow session detail page rendering

function showSessionDetailPage(sessionKey) {
  const session = sessionDataStore[sessionKey];
  if (!session) return;

  currentView = 'sessionDetail';
  currentSessionDetailKey = sessionKey;
  updateContentTitle();

  // Hide stats grid and carousel on detail pages
  hideStatsAndCarousel();

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
          <span>${t('detail.backToSessions')}</span>
        </button>
        <div class="detail-title-row">
          <h2 class="detail-session-id">${escapeHtml(session.session_id)}</h2>
          <div class="detail-badges">
            <span class="session-type-badge ${session.type || 'workflow'}">${session.type || 'workflow'}</span>
            <span class="session-status ${isActive ? 'active' : 'archived'}">
              ${isActive ? t('session.status.active') : t('session.status.archived')}
            </span>
          </div>
        </div>
      </div>

      <!-- Session Info Bar -->
      <div class="detail-info-bar">
        <div class="info-item">
          <span class="info-label">${t('detail.created')}</span>
          <span class="info-value">${formatDate(session.created_at)}</span>
        </div>
        ${session.archived_at ? `
          <div class="info-item">
            <span class="info-label">${t('detail.archived')}</span>
            <span class="info-value">${formatDate(session.archived_at)}</span>
          </div>
        ` : ''}
        <div class="info-item">
          <span class="info-label">${t('detail.project')}</span>
          <span class="info-value">${escapeHtml(session.project || '-')}</span>
        </div>
        <div class="info-item">
          <span class="info-label">${t('detail.tasks')}</span>
          <span class="info-value">${completed}/${tasks.length} ${t('detail.completed')}</span>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="detail-tabs">
        <button class="detail-tab active" data-tab="tasks" onclick="switchDetailTab('tasks')">
          <span class="tab-icon"><i data-lucide="list-checks" class="w-4 h-4"></i></span>
          <span class="tab-text">${t('tab.tasks')}</span>
          <span class="tab-count">${tasks.length}</span>
        </button>
        <button class="detail-tab" data-tab="context" onclick="switchDetailTab('context')">
          <span class="tab-icon"><i data-lucide="package" class="w-4 h-4"></i></span>
          <span class="tab-text">${t('tab.context')}</span>
        </button>
        <button class="detail-tab" data-tab="summary" onclick="switchDetailTab('summary')">
          <span class="tab-icon"><i data-lucide="file-text" class="w-4 h-4"></i></span>
          <span class="tab-text">${t('tab.summary')}</span>
        </button>
        <button class="detail-tab" data-tab="impl-plan" onclick="switchDetailTab('impl-plan')">
          <span class="tab-icon"><i data-lucide="ruler" class="w-4 h-4"></i></span>
          <span class="tab-text">${t('tab.implPlan')}</span>
        </button>
<button class="detail-tab" data-tab="conflict" onclick="switchDetailTab('conflict')">          <span class="tab-icon"><i data-lucide="scale" class="w-4 h-4"></i></span>          <span class="tab-text">${t('tab.conflict')}</span>        </button>
        ${session.hasReview ? `
          <button class="detail-tab" data-tab="review" onclick="switchDetailTab('review')">
            <span class="tab-icon"><i data-lucide="search" class="w-4 h-4"></i></span>
            <span class="tab-text">${t('tab.review')}</span>
          </button>
        ` : ''}
      </div>

      <!-- Tab Content -->
      <div class="detail-tab-content active" id="detailTabContent">
        ${renderTasksTab(session, tasks, completed, inProgress, pending)}
      </div>
    </div>
  `;
  
  // Initialize Lucide icons
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function goBackToSessions() {
  currentView = 'sessions';
  currentSessionDetailKey = null;
  updateContentTitle();
  showStatsAndSearch();
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
case 'conflict':      loadAndRenderConflictTab(session, contentArea);      break;
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
      <!-- Combined Stats & Actions Bar -->
      <div class="task-toolbar">
        <div class="task-stats-bar">
          <span class="task-stat completed"><i data-lucide="check-circle" class="w-4 h-4 inline mr-1"></i>${completed} ${t('task.completed')}</span>
          <span class="task-stat in-progress"><i data-lucide="loader-2" class="w-4 h-4 inline mr-1"></i>${inProgress} ${t('task.inProgress')}</span>
          <span class="task-stat pending"><i data-lucide="circle" class="w-4 h-4 inline mr-1"></i>${pending} ${t('task.pending')}</span>
        </div>
        <div class="toolbar-divider"></div>
        <div class="task-bulk-actions">
          <span class="bulk-label">${t('task.quickActions')}</span>
          <button class="bulk-action-btn" onclick="bulkSetAllStatus('pending')" title="${t('task.allPending')}">
            <span class="bulk-icon"><i data-lucide="circle" class="w-4 h-4"></i></span> ${t('task.allPending')}
          </button>
          <button class="bulk-action-btn" onclick="bulkSetAllStatus('in_progress')" title="${t('task.allInProgress')}">
            <span class="bulk-icon"><i data-lucide="loader-2" class="w-4 h-4"></i></span> ${t('task.allInProgress')}
          </button>
          <button class="bulk-action-btn completed" onclick="bulkSetAllStatus('completed')" title="${t('task.allCompleted')}">
            <span class="bulk-icon"><i data-lucide="check-circle" class="w-4 h-4"></i></span> ${t('task.allCompleted')}
          </button>
        </div>
      </div>

      <div class="tasks-list" id="tasksListContent">
        ${showLoading ? `
          <div class="tab-loading">${t('common.loading')}</div>
        ` : (tasks.length === 0 ? `
          <div class="tab-empty-state">
            <div class="empty-icon"><i data-lucide="clipboard-list" class="w-12 h-12"></i></div>
            <div class="empty-title">${t('empty.noTasks')}</div>
            <div class="empty-text">${t('empty.noTasksText')}</div>
          </div>
        ` : tasks.map(task => renderDetailTaskItem(task)).join(''))}
      </div>
    </div>
  `;
}

async function loadFullTaskDetails() {
  const session = sessionDataStore[currentSessionDetailKey];
  if (!session || !window.SERVER_MODE || !session.path) return;

  const tasksContainer = document.getElementById('tasksListContent');
  tasksContainer.innerHTML = `<div class="tab-loading">${t('common.loading')}</div>`;

  try {
    const response = await fetch(`/api/session-detail?path=${encodeURIComponent(session.path)}&type=tasks`);
    if (response.ok) {
      const data = await response.json();
      if (data.tasks && data.tasks.length > 0) {
        // Populate drawer tasks for click-to-open functionality
        currentDrawerTasks = data.tasks;
        tasksContainer.innerHTML = data.tasks.map(task => renderDetailTaskItem(task)).join('');
      } else {
        tasksContainer.innerHTML = `
          <div class="tab-empty-state">
            <div class="empty-icon"><i data-lucide="clipboard-list" class="w-12 h-12"></i></div>
            <div class="empty-title">${t('empty.noTaskFiles')}</div>
            <div class="empty-text">${t('empty.noTaskFilesText')}</div>
          </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }
    }
  } catch (err) {
    tasksContainer.innerHTML = `<div class="tab-error">${t('context.loadError', { error: err.message })}</div>`;
  }
}

function renderDetailTaskItem(task) {
  const taskId = task.task_id || task.id || 'Unknown';
  const status = task.status || 'pending';

  // Status options for dropdown
  const statusOptions = ['pending', 'in_progress', 'completed'];

  return `
    <div class="detail-task-item ${status} status-${status}" data-task-id="${escapeHtml(taskId)}">
      <div class="task-item-header">
        <span class="task-id-badge">${escapeHtml(taskId)}</span>
        <span class="task-title" onclick="openTaskDrawer('${escapeHtml(taskId)}')" style="cursor: pointer; flex: 1;">
          ${escapeHtml(task.title || task.meta?.title || 'Untitled')}
        </span>
        <div class="task-status-control" onclick="event.stopPropagation()">
          <select class="task-status-select ${status}" onchange="updateSingleTaskStatus('${escapeHtml(taskId)}', this.value)" data-current="${status}">
            ${statusOptions.map(opt => `
              <option value="${opt}" ${opt === status ? 'selected' : ''}>${formatStatusLabel(opt)}</option>
            `).join('')}
          </select>
        </div>
      </div>
    </div>
  `;
}

function formatStatusLabel(status) {
  const labels = {
    'pending': `<i data-lucide="circle" class="w-3 h-3 inline mr-1"></i>${t('task.status.pending')}`,
    'in_progress': `<i data-lucide="loader-2" class="w-3 h-3 inline mr-1"></i>${t('task.status.inProgress')}`,
    'completed': `<i data-lucide="check-circle" class="w-3 h-3 inline mr-1"></i>${t('task.status.completed')}`
  };
  return labels[status] || status;
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
    // Try to load context data from server (includes context, explorations, conflictResolution)
    if (window.SERVER_MODE && session.path) {
      const response = await fetch(`/api/session-detail?path=${encodeURIComponent(session.path)}&type=context`);
      if (response.ok) {
        const data = await response.json();
        contentArea.innerHTML = renderSessionContextContent(data.context, data.explorations, data.conflictResolution);

        // Initialize collapsible sections for explorations
        initCollapsibleSections(contentArea);
        return;
      }
    }
    // Fallback: show placeholder
    contentArea.innerHTML = `
      <div class="tab-empty-state">
        <div class="empty-icon"><i data-lucide="package" class="w-12 h-12"></i></div>
        <div class="empty-title">Context Data</div>
        <div class="empty-text">Context data will be loaded from context-package.json</div>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (err) {
    contentArea.innerHTML = `<div class="tab-error">Failed to load context: ${err.message}</div>`;
  }
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
        <div class="empty-icon"><i data-lucide="file-text" class="w-12 h-12"></i></div>
        <div class="empty-title">Summaries</div>
        <div class="empty-text">Session summaries will be loaded from .summaries/</div>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (err) {
    contentArea.innerHTML = `<div class="tab-error">Failed to load summaries: ${err.message}</div>`;
  }
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
        <div class="empty-icon"><i data-lucide="ruler" class="w-12 h-12"></i></div>
        <div class="empty-title">IMPL Plan</div>
        <div class="empty-text">IMPL plan will be loaded from IMPL_PLAN.md</div>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (err) {
    contentArea.innerHTML = `<div class="tab-error">Failed to load IMPL plan: ${err.message}</div>`;
  }
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
        <div class="empty-icon"><i data-lucide="search" class="w-12 h-12"></i></div>
        <div class="empty-title">Review Data</div>
        <div class="empty-text">Review data will be loaded from review files</div>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (err) {
    contentArea.innerHTML = `<div class="tab-error">Failed to load review: ${err.message}</div>`;
  }
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
        <button class="json-modal-copy" onclick="copyJsonToClipboard(this)">Copy to Clipboard</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeJsonModal();
  });
}

// ==========================================
// TASK STATUS MANAGEMENT
// ==========================================

async function updateSingleTaskStatus(taskId, newStatus) {
  const session = sessionDataStore[currentSessionDetailKey];
  if (!session || !window.SERVER_MODE || !session.path) {
    showToast(t('toast.statusUpdateRequires'), 'error');
    return;
  }

  try {
    const response = await csrfFetch('/api/update-task-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionPath: session.path,
        taskId: taskId,
        newStatus: newStatus
      })
    });

    const result = await response.json();
    if (result.success) {
      // Update UI
      updateTaskItemUI(taskId, newStatus);
      updateTaskStatsBar();
      showToast(t('task.statusUpdated', { id: taskId }), 'success');
    } else {
      showToast(result.error || t('toast.failedToUpdate'), 'error');
      // Revert select
      revertTaskSelect(taskId);
    }
  } catch (error) {
    showToast(t('toast.errorUpdating', { error: error.message }), 'error');
    revertTaskSelect(taskId);
  }
}

async function bulkSetAllStatus(newStatus) {
  const session = sessionDataStore[currentSessionDetailKey];
  if (!session || !window.SERVER_MODE || !session.path) {
    showToast(t('toast.bulkUpdateRequires'), 'error');
    return;
  }

  const taskIds = currentDrawerTasks.map(t => t.task_id || t.id);
  if (taskIds.length === 0) return;

  const statusLabel = t(`task.status.${newStatus === 'in_progress' ? 'inProgress' : newStatus}`);
  if (!confirm(t('task.setAllConfirm', { count: taskIds.length, status: statusLabel }))) {
    return;
  }

  try {
    const response = await csrfFetch('/api/bulk-update-task-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionPath: session.path,
        taskIds: taskIds,
        newStatus: newStatus
      })
    });

    const result = await response.json();
    if (result.success) {
      // Update all task UIs
      taskIds.forEach(id => updateTaskItemUI(id, newStatus));
      updateTaskStatsBar();
      showToast(t('task.tasksUpdated', { count: taskIds.length }), 'success');
    } else {
      showToast(result.error || t('toast.failedToBulkUpdate'), 'error');
    }
  } catch (error) {
    showToast(t('toast.errorInBulk', { error: error.message }), 'error');
  }
}

async function bulkSetPendingToInProgress() {
  const session = sessionDataStore[currentSessionDetailKey];
  if (!session || !window.SERVER_MODE || !session.path) {
    showToast('Bulk update requires server mode', 'error');
    return;
  }

  const pendingTaskIds = currentDrawerTasks
    .filter(t => (t.status || 'pending') === 'pending')
    .map(t => t.task_id || t.id);

  if (pendingTaskIds.length === 0) {
    showToast(t('task.noPendingTasks'), 'info');
    return;
  }

  try {
    const response = await csrfFetch('/api/bulk-update-task-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionPath: session.path,
        taskIds: pendingTaskIds,
        newStatus: 'in_progress'
      })
    });

    const result = await response.json();
    if (result.success) {
      pendingTaskIds.forEach(id => updateTaskItemUI(id, 'in_progress'));
      updateTaskStatsBar();
      showToast(t('task.movedToInProgress', { count: pendingTaskIds.length }), 'success');
    } else {
      showToast(result.error || t('toast.failedToUpdate'), 'error');
    }
  } catch (error) {
    showToast(t('toast.error', { error: error.message }), 'error');
  }
}

async function bulkSetInProgressToCompleted() {
  const session = sessionDataStore[currentSessionDetailKey];
  if (!session || !window.SERVER_MODE || !session.path) {
    showToast('Bulk update requires server mode', 'error');
    return;
  }

  const inProgressTaskIds = currentDrawerTasks
    .filter(t => t.status === 'in_progress')
    .map(t => t.task_id || t.id);

  if (inProgressTaskIds.length === 0) {
    showToast(t('task.noInProgressTasks'), 'info');
    return;
  }

  try {
    const response = await csrfFetch('/api/bulk-update-task-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionPath: session.path,
        taskIds: inProgressTaskIds,
        newStatus: 'completed'
      })
    });

    const result = await response.json();
    if (result.success) {
      inProgressTaskIds.forEach(id => updateTaskItemUI(id, 'completed'));
      updateTaskStatsBar();
      showToast(t('task.tasksCompleted', { count: inProgressTaskIds.length }), 'success');
    } else {
      showToast(result.error || t('toast.failedToUpdate'), 'error');
    }
  } catch (error) {
    showToast(t('toast.error', { error: error.message }), 'error');
  }
}

function updateTaskItemUI(taskId, newStatus) {
  const taskItem = document.querySelector(`.detail-task-item[data-task-id="${taskId}"]`);
  if (!taskItem) return;

  // Update classes
  taskItem.className = `detail-task-item ${newStatus} status-${newStatus}`;

  // Update select
  const select = taskItem.querySelector('.task-status-select');
  if (select) {
    select.value = newStatus;
    select.className = `task-status-select ${newStatus}`;
    select.dataset.current = newStatus;
  }

  // Update drawer tasks data
  const task = currentDrawerTasks.find(t => (t.task_id || t.id) === taskId);
  if (task) {
    task.status = newStatus;
  }
}

function updateTaskStatsBar() {
  const completed = currentDrawerTasks.filter(t => t.status === 'completed').length;
  const inProgress = currentDrawerTasks.filter(t => t.status === 'in_progress').length;
  const pending = currentDrawerTasks.filter(t => (t.status || 'pending') === 'pending').length;

  const statsBar = document.querySelector('.task-stats-bar');
  if (statsBar) {
    statsBar.innerHTML = `
      <span class="task-stat completed"><i data-lucide="check-circle" class="w-4 h-4 inline mr-1"></i>${completed} ${t('task.completed')}</span>
      <span class="task-stat in-progress"><i data-lucide="loader-2" class="w-4 h-4 inline mr-1"></i>${inProgress} ${t('task.inProgress')}</span>
      <span class="task-stat pending"><i data-lucide="circle" class="w-4 h-4 inline mr-1"></i>${pending} ${t('task.pending')}</span>
    `;
    // Reinitialize Lucide icons
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

function revertTaskSelect(taskId) {
  const taskItem = document.querySelector(`.detail-task-item[data-task-id="${taskId}"]`);
  if (!taskItem) return;

  const select = taskItem.querySelector('.task-status-select');
  if (select) {
    select.value = select.dataset.current;
  }
}

function showToast(message, type = 'info') {
  // Remove existing toast
  const existing = document.querySelector('.status-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `status-toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

