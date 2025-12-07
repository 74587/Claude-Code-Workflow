// ============================================
// FIX SESSION VIEW
// ============================================
// Fix session detail page rendering

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
