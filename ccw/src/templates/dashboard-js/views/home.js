// ==========================================
// HOME VIEW - Dashboard Homepage
// ==========================================

function renderDashboard() {
  // Show stats grid and search (may be hidden by MCP view)
  showStatsAndSearch();

  // Hide storage card (only shown in CLI Manager view)
  const storageCard = document.getElementById('storageCard');
  if (storageCard) storageCard.style.display = 'none';

  updateStats();
  updateBadges();
  updateCarousel();
  renderSessions();
  document.getElementById('generatedAt').textContent = workflowData.generatedAt || new Date().toISOString();
}

function showStatsAndSearch() {
  const statsGrid = document.getElementById('statsGrid');
  const searchInput = document.getElementById('searchInput');
  if (statsGrid) statsGrid.style.display = '';
  if (searchInput) searchInput.parentElement.style.display = '';
}

function hideStatsAndCarousel() {
  const statsGrid = document.getElementById('statsGrid');
  const searchInput = document.getElementById('searchInput');
  if (statsGrid) statsGrid.style.display = 'none';
  if (searchInput) searchInput.parentElement.style.display = 'none';
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

  // MCP badge - load async if needed
  if (typeof loadMcpConfig === 'function') {
    loadMcpConfig().then(() => {
      if (typeof updateMcpBadge === 'function') {
        updateMcpBadge();
      }
    }).catch(e => console.error('MCP badge update failed:', e));
  }
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
        <div class="empty-icon"><i data-lucide="inbox" class="w-12 h-12"></i></div>
        <div class="empty-title">${t('empty.noSessions')}</div>
        <div class="empty-text">${t('empty.noSessionsText')}</div>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  container.innerHTML = `<div class="sessions-grid">${sessions.map(session => renderSessionCard(session)).join('')}</div>`;
  
  // Initialize Lucide icons after rendering
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderSessionCard(session) {
  const tasks = session.tasks || [];
  const taskCount = session.taskCount || tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const progress = taskCount > 0 ? Math.round((completed / taskCount) * 100) : 0;

  // Use _isActive flag set during rendering, default to true
  const isActive = session._isActive !== false;
  const date = session.created_at;

  // Get session status from metadata (default to 'planning' for new sessions)
  // 3 states: planning → active → completed (archived)
  const sessionStatus = session.status || 'planning';
  const isPlanning = sessionStatus === 'planning';

  // Get session type badge
  const sessionType = session.type || 'workflow';
  const typeBadge = sessionType !== 'workflow' ? `<span class="session-type-badge ${sessionType}">${sessionType}</span>` : '';

  // Determine status badge class and text
  // Priority: archived location > planning status > active status
  let statusClass, statusText;
  if (!isActive) {
    // Archived sessions (completed) always show as ARCHIVED
    statusClass = 'archived';
    statusText = t('session.status.archived');
  } else if (isPlanning) {
    // Planning state - session created but not yet executed
    statusClass = 'planning';
    statusText = t('session.status.planning');
  } else {
    // Active state - session is being executed
    statusClass = 'active';
    statusText = t('session.status.active');
  }

  // Store session data for modal
  const sessionKey = `session-${session.session_id}`.replace(/[^a-zA-Z0-9-]/g, '-');
  sessionDataStore[sessionKey] = session;

  // Special rendering for review sessions
  if (sessionType === 'review') {
    return renderReviewSessionCard(session, sessionKey, typeBadge, isActive, isPlanning, date);
  }

  // Card class includes planning modifier for special styling (only for active sessions)
  const cardClass = isActive && isPlanning ? 'session-card planning' : 'session-card';

  return `
    <div class="${cardClass}" onclick="showSessionDetailPage('${sessionKey}')">
      <div class="session-header">
        <div class="session-title">${escapeHtml(session.session_id || 'Unknown')}</div>
        <div class="session-badges">
          ${typeBadge}
          <span class="session-status ${statusClass}">
            ${statusText}
          </span>
        </div>
      </div>
      <div class="session-body">
        <div class="session-meta">
          <span class="session-meta-item"><i data-lucide="calendar" class="w-3.5 h-3.5 inline mr-1"></i>${formatDate(date)}</span>
          <span class="session-meta-item"><i data-lucide="list-checks" class="w-3.5 h-3.5 inline mr-1"></i>${taskCount} ${t('session.tasks')}</span>
        </div>
        ${taskCount > 0 && !isPlanning ? `
          <div class="progress-container">
            <span class="progress-label">${t('session.progress')}</span>
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

// Special card rendering for review sessions
function renderReviewSessionCard(session, sessionKey, typeBadge, isActive, isPlanning, date) {
  // Calculate findings stats from reviewDimensions
  const dimensions = session.reviewDimensions || [];
  let totalFindings = 0;
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  dimensions.forEach(dim => {
    const findings = dim.findings || [];
    totalFindings += findings.length;
    criticalCount += findings.filter(f => f.severity === 'critical').length;
    highCount += findings.filter(f => f.severity === 'high').length;
    mediumCount += findings.filter(f => f.severity === 'medium').length;
    lowCount += findings.filter(f => f.severity === 'low').length;
  });

  // Determine status badge class and text
  // Priority: archived > planning > active
  let statusClass, statusText;
  if (!isActive) {
    statusClass = 'archived';
    statusText = t('session.status.archived');
  } else if (isPlanning) {
    statusClass = 'planning';
    statusText = t('session.status.planning');
  } else {
    statusClass = 'active';
    statusText = t('session.status.active');
  }

  // Card class includes planning modifier for special styling (only for active sessions)
  const cardClass = isActive && isPlanning ? 'session-card planning' : 'session-card';

  return `
    <div class="${cardClass}" onclick="showSessionDetailPage('${sessionKey}')">
      <div class="session-header">
        <div class="session-title">${escapeHtml(session.session_id || 'Unknown')}</div>
        <div class="session-badges">
          ${typeBadge}
          <span class="session-status ${statusClass}">
            ${statusText}
          </span>
        </div>
      </div>
      <div class="session-body">
        <div class="session-meta">
          <span class="session-meta-item"><i data-lucide="calendar" class="w-3.5 h-3.5 inline mr-1"></i>${formatDate(date)}</span>
          <span class="session-meta-item"><i data-lucide="search" class="w-3.5 h-3.5 inline mr-1"></i>${totalFindings} ${t('session.findings')}</span>
        </div>
        ${totalFindings > 0 ? `
          <div class="review-findings-summary">
            <div class="findings-severity-row">
              ${criticalCount > 0 ? `<span class="finding-count critical"><i data-lucide="alert-circle" class="w-3 h-3 inline"></i> ${criticalCount}</span>` : ''}
              ${highCount > 0 ? `<span class="finding-count high"><i data-lucide="alert-triangle" class="w-3 h-3 inline"></i> ${highCount}</span>` : ''}
              ${mediumCount > 0 ? `<span class="finding-count medium"><i data-lucide="info" class="w-3 h-3 inline"></i> ${mediumCount}</span>` : ''}
              ${lowCount > 0 ? `<span class="finding-count low"><i data-lucide="check-circle" class="w-3 h-3 inline"></i> ${lowCount}</span>` : ''}
            </div>
            <div class="dimensions-info">
              ${dimensions.length} ${t('session.dimensions')}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}
