// ==========================================
// HOME VIEW - Dashboard Homepage
// ==========================================

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
