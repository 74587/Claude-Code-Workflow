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
