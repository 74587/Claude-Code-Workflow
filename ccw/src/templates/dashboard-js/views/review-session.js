// ==========================================
// REVIEW SESSION DETAIL PAGE
// ==========================================
// Enhanced with multi-select, filters, split preview panel, and export fix JSON

// Review session state
let reviewSessionState = {
  allFindings: [],
  filteredFindings: [],
  selectedFindings: new Set(),
  currentFilters: {
    dimension: 'all',
    severities: new Set(),
    search: ''
  },
  sortConfig: {
    field: 'severity',
    order: 'desc'
  },
  previewFinding: null,
  dimensions: [],
  session: null
};

function renderReviewSessionDetailPage(session) {
  const isActive = session._isActive !== false;
  const dimensions = session.reviewDimensions || [];

  // Store session and dimensions
  reviewSessionState.session = session;
  reviewSessionState.dimensions = dimensions;

  // Build flat findings array with dimension info
  const allFindings = [];
  let findingIndex = 0;
  dimensions.forEach(dim => {
    (dim.findings || []).forEach(f => {
      allFindings.push({
        id: f.id || `finding-${findingIndex++}`,
        title: f.title || 'Finding',
        description: f.description || '',
        severity: (f.severity || 'medium').toLowerCase(),
        dimension: dim.name || 'unknown',
        category: f.category || '',
        file: f.file || '',
        line: f.line || '',
        code_context: f.code_context || f.snippet || '',
        recommendations: f.recommendations || (f.recommendation ? [f.recommendation] : []),
        root_cause: f.root_cause || '',
        impact: f.impact || '',
        references: f.references || [],
        metadata: f.metadata || {},
        fix_status: f.fix_status || null
      });
    });
  });

  reviewSessionState.allFindings = allFindings;
  reviewSessionState.filteredFindings = [...allFindings];
  reviewSessionState.selectedFindings.clear();
  reviewSessionState.previewFinding = null;

  // Calculate statistics
  const totalFindings = allFindings.length;
  const severityCounts = {
    critical: allFindings.filter(f => f.severity === 'critical').length,
    high: allFindings.filter(f => f.severity === 'high').length,
    medium: allFindings.filter(f => f.severity === 'medium').length,
    low: allFindings.filter(f => f.severity === 'low').length
  };

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
          <span class="phase-badge ${session.phase || 'in-progress'}">${(session.phase || 'In Progress').toUpperCase()}</span>
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
            <div class="summary-value">${severityCounts.critical}</div>
            <div class="summary-label">Critical</div>
          </div>
          <div class="summary-card high">
            <div class="summary-icon">🟠</div>
            <div class="summary-value">${severityCounts.high}</div>
            <div class="summary-label">High</div>
          </div>
          <div class="summary-card">
            <div class="summary-icon">📋</div>
            <div class="summary-value">${dimensions.length}</div>
            <div class="summary-label">Dimensions</div>
          </div>
        </div>

      </div>

      <!-- Fix Progress Section (dynamically populated) -->
      <div id="fixProgressSection" class="fix-progress-section-container"></div>

      <!-- Enhanced Findings Section -->
      <div class="review-enhanced-container">
        <!-- Header with Stats & Controls -->
        <div class="review-header-bar">
          <div class="review-severity-stats">
            <span class="severity-stat critical" onclick="toggleReviewSessionSeverity('critical')" title="Filter Critical">
              🔴 ${severityCounts.critical}
            </span>
            <span class="severity-stat high" onclick="toggleReviewSessionSeverity('high')" title="Filter High">
              🟠 ${severityCounts.high}
            </span>
            <span class="severity-stat medium" onclick="toggleReviewSessionSeverity('medium')" title="Filter Medium">
              🟡 ${severityCounts.medium}
            </span>
            <span class="severity-stat low" onclick="toggleReviewSessionSeverity('low')" title="Filter Low">
              🟢 ${severityCounts.low}
            </span>
          </div>

          <div class="review-search-box">
            <input type="text"
                   id="reviewSessionSearchInput"
                   placeholder="Search findings..."
                   oninput="onReviewSessionSearch(this.value)">
          </div>

          <div class="review-selection-controls">
            <span class="selection-counter" id="reviewSessionSelectionCounter">0 selected</span>
            <button class="btn-mini" onclick="selectAllReviewSessionFindings()">Select All</button>
            <button class="btn-mini" onclick="selectVisibleReviewSessionFindings()">Visible</button>
            <button class="btn-mini" onclick="selectReviewSessionBySeverity('critical')">Critical</button>
            <button class="btn-mini" onclick="clearReviewSessionSelection()">Clear</button>
          </div>

          <button class="btn-export-fix" id="reviewSessionExportBtn" onclick="exportReviewSessionFixJson()" disabled>
            🔧 Export Fix JSON
          </button>
        </div>

        <!-- Filter Bar -->
        <div class="review-filter-bar">
          <div class="filter-group">
            <span class="filter-label">Severity:</span>
            <div class="filter-chips">
              <label class="filter-chip" id="rs-filter-critical">
                <input type="checkbox" onchange="toggleReviewSessionSeverity('critical')">
                <span>Critical</span>
              </label>
              <label class="filter-chip" id="rs-filter-high">
                <input type="checkbox" onchange="toggleReviewSessionSeverity('high')">
                <span>High</span>
              </label>
              <label class="filter-chip" id="rs-filter-medium">
                <input type="checkbox" onchange="toggleReviewSessionSeverity('medium')">
                <span>Medium</span>
              </label>
              <label class="filter-chip" id="rs-filter-low">
                <input type="checkbox" onchange="toggleReviewSessionSeverity('low')">
                <span>Low</span>
              </label>
            </div>
          </div>

          <div class="filter-group">
            <span class="filter-label">Sort:</span>
            <select id="reviewSessionSortSelect" class="sort-select" onchange="sortReviewSessionFindings()">
              <option value="severity">By Severity</option>
              <option value="dimension">By Dimension</option>
              <option value="file">By File</option>
            </select>
            <button class="btn-sort-order" id="reviewSessionSortOrderBtn" onclick="toggleReviewSessionSortOrder()">
              <span id="reviewSessionSortOrderIcon">↓</span>
            </button>
          </div>

          <button class="btn-mini" onclick="resetReviewSessionFilters()">Reset</button>
        </div>

        <!-- Dimension Tabs -->
        <div class="review-dimension-tabs">
          <button class="dim-tab active" data-dimension="all" onclick="filterReviewSessionByDimension('all')">
            All (${totalFindings})
          </button>
          ${dimensions.map(dim => `
            <button class="dim-tab" data-dimension="${dim.name}" onclick="filterReviewSessionByDimension('${dim.name}')">
              ${escapeHtml(dim.name)} (${dim.findings?.length || 0})
            </button>
          `).join('')}
        </div>

        <!-- Split Panel: List + Preview -->
        <div class="review-split-panel">
          <!-- Left: Findings List -->
          <div class="review-findings-panel">
            <div class="findings-list-header">
              <span id="reviewSessionFindingsCount">${totalFindings} findings</span>
            </div>
            <div class="review-findings-list" id="reviewSessionFindingsList">
              ${renderReviewSessionFindingsList(allFindings)}
            </div>
          </div>

          <!-- Right: Preview Panel -->
          <div class="review-preview-panel" id="reviewSessionPreviewPanel">
            <div class="preview-empty-state">
              <div class="preview-icon">👆</div>
              <div class="preview-text">Click on a finding to preview details</div>
            </div>
          </div>
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

// ==========================================
// Findings List Rendering
// ==========================================

function renderReviewSessionFindingsList(findings) {
  if (findings.length === 0) {
    return `
      <div class="findings-empty">
        <span class="empty-icon">✨</span>
        <span>No findings match your filters</span>
      </div>
    `;
  }

  return findings.map(finding => `
    <div class="review-finding-item ${finding.severity} ${reviewSessionState.selectedFindings.has(finding.id) ? 'selected' : ''}"
         data-finding-id="${finding.id}"
         onclick="previewReviewSessionFinding('${finding.id}')">
      <input type="checkbox"
             class="finding-checkbox"
             ${reviewSessionState.selectedFindings.has(finding.id) ? 'checked' : ''}
             onclick="toggleReviewSessionFindingSelection('${finding.id}', event)">
      <div class="finding-content">
        <div class="finding-top-row">
          <span class="severity-badge ${finding.severity}">${finding.severity}</span>
          <span class="dimension-badge">${escapeHtml(finding.dimension)}</span>
          ${finding.fix_status ? `<span class="fix-status-mini status-${finding.fix_status}">${finding.fix_status}</span>` : ''}
        </div>
        <div class="finding-title">${escapeHtml(finding.title)}</div>
        ${finding.file ? `<div class="finding-file">📄 ${escapeHtml(finding.file)}${finding.line ? ':' + finding.line : ''}</div>` : ''}
      </div>
    </div>
  `).join('');
}

// ==========================================
// Preview Panel
// ==========================================

function previewReviewSessionFinding(findingId) {
  const finding = reviewSessionState.allFindings.find(f => f.id === findingId);
  if (!finding) return;

  reviewSessionState.previewFinding = finding;

  // Update active state in list
  document.querySelectorAll('.review-finding-item').forEach(item => {
    item.classList.toggle('previewing', item.dataset.findingId === findingId);
  });

  const previewPanel = document.getElementById('reviewSessionPreviewPanel');
  if (!previewPanel) return;

  previewPanel.innerHTML = `
    <div class="preview-content">
      <div class="preview-header">
        <div class="preview-badges">
          <span class="severity-badge ${finding.severity}">${finding.severity}</span>
          <span class="dimension-badge">${escapeHtml(finding.dimension)}</span>
          ${finding.category ? `<span class="category-badge">${escapeHtml(finding.category)}</span>` : ''}
          ${finding.fix_status ? `<span class="fix-status-badge status-${finding.fix_status}">${finding.fix_status}</span>` : ''}
        </div>
        <button class="btn-select-finding ${reviewSessionState.selectedFindings.has(finding.id) ? 'selected' : ''}"
                onclick="toggleReviewSessionFindingSelection('${finding.id}', event)">
          ${reviewSessionState.selectedFindings.has(finding.id) ? '✓ Selected' : '+ Select for Fix'}
        </button>
      </div>

      <h3 class="preview-title">${escapeHtml(finding.title)}</h3>

      ${finding.file ? `
        <div class="preview-section">
          <div class="preview-section-title">📄 Location</div>
          <div class="preview-location">
            <code>${escapeHtml(finding.file)}${finding.line ? ':' + finding.line : ''}</code>
          </div>
        </div>
      ` : ''}

      <div class="preview-section">
        <div class="preview-section-title">📝 Description</div>
        <div class="preview-description">${escapeHtml(finding.description)}</div>
      </div>

      ${finding.code_context ? `
        <div class="preview-section">
          <div class="preview-section-title">💻 Code Context</div>
          <pre class="preview-code">${escapeHtml(finding.code_context)}</pre>
        </div>
      ` : ''}

      ${finding.recommendations && finding.recommendations.length > 0 ? `
        <div class="preview-section">
          <div class="preview-section-title">✅ Recommendations</div>
          <ul class="preview-recommendations">
            ${finding.recommendations.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      ${finding.root_cause ? `
        <div class="preview-section">
          <div class="preview-section-title">🔍 Root Cause</div>
          <div class="preview-root-cause">${escapeHtml(finding.root_cause)}</div>
        </div>
      ` : ''}

      ${finding.impact ? `
        <div class="preview-section">
          <div class="preview-section-title">⚠️ Impact</div>
          <div class="preview-impact">${escapeHtml(finding.impact)}</div>
        </div>
      ` : ''}

      ${finding.references && finding.references.length > 0 ? `
        <div class="preview-section">
          <div class="preview-section-title">🔗 References</div>
          <ul class="preview-references">
            ${finding.references.map(ref => {
              const isUrl = ref.startsWith('http');
              return `<li>${isUrl ? `<a href="${ref}" target="_blank">${ref}</a>` : ref}</li>`;
            }).join('')}
          </ul>
        </div>
      ` : ''}

      ${finding.metadata && Object.keys(finding.metadata).length > 0 ? `
        <div class="preview-section">
          <div class="preview-section-title">ℹ️ Metadata</div>
          <div class="preview-metadata">
            ${Object.entries(finding.metadata).map(([key, value]) => `
              <div class="metadata-item">
                <span class="meta-key">${escapeHtml(key)}:</span>
                <span class="meta-value">${escapeHtml(String(value))}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// ==========================================
// Selection Management
// ==========================================

function toggleReviewSessionFindingSelection(findingId, event) {
  if (event) {
    event.stopPropagation();
  }

  if (reviewSessionState.selectedFindings.has(findingId)) {
    reviewSessionState.selectedFindings.delete(findingId);
  } else {
    reviewSessionState.selectedFindings.add(findingId);
  }

  updateReviewSessionSelectionUI();

  // Update preview panel button if this finding is being previewed
  if (reviewSessionState.previewFinding && reviewSessionState.previewFinding.id === findingId) {
    previewReviewSessionFinding(findingId);
  }
}

function selectAllReviewSessionFindings() {
  reviewSessionState.allFindings.forEach(f => reviewSessionState.selectedFindings.add(f.id));
  updateReviewSessionSelectionUI();
}

function selectVisibleReviewSessionFindings() {
  reviewSessionState.filteredFindings.forEach(f => reviewSessionState.selectedFindings.add(f.id));
  updateReviewSessionSelectionUI();
}

function selectReviewSessionBySeverity(severity) {
  reviewSessionState.allFindings
    .filter(f => f.severity === severity)
    .forEach(f => reviewSessionState.selectedFindings.add(f.id));
  updateReviewSessionSelectionUI();
}

function clearReviewSessionSelection() {
  reviewSessionState.selectedFindings.clear();
  updateReviewSessionSelectionUI();
}

function updateReviewSessionSelectionUI() {
  // Update counter
  const counter = document.getElementById('reviewSessionSelectionCounter');
  if (counter) {
    counter.textContent = `${reviewSessionState.selectedFindings.size} selected`;
  }

  // Update export button
  const exportBtn = document.getElementById('reviewSessionExportBtn');
  if (exportBtn) {
    exportBtn.disabled = reviewSessionState.selectedFindings.size === 0;
  }

  // Update checkbox states in list
  document.querySelectorAll('.review-finding-item').forEach(item => {
    const findingId = item.dataset.findingId;
    const isSelected = reviewSessionState.selectedFindings.has(findingId);
    item.classList.toggle('selected', isSelected);
    const checkbox = item.querySelector('.finding-checkbox');
    if (checkbox) {
      checkbox.checked = isSelected;
    }
  });
}

// ==========================================
// Filtering & Sorting
// ==========================================

function filterReviewSessionByDimension(dimension) {
  reviewSessionState.currentFilters.dimension = dimension;

  // Update tab active state
  document.querySelectorAll('.dim-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.dimension === dimension);
  });

  // Update dimension timeline highlight
  document.querySelectorAll('.dimension-item').forEach(item => {
    item.classList.toggle('active', dimension === 'all' || item.dataset.dimension === dimension);
  });

  applyReviewSessionFilters();
}

function toggleReviewSessionSeverity(severity) {
  if (reviewSessionState.currentFilters.severities.has(severity)) {
    reviewSessionState.currentFilters.severities.delete(severity);
  } else {
    reviewSessionState.currentFilters.severities.add(severity);
  }

  // Update filter chip UI
  const filterChip = document.getElementById(`rs-filter-${severity}`);
  if (filterChip) {
    filterChip.classList.toggle('active', reviewSessionState.currentFilters.severities.has(severity));
    const checkbox = filterChip.querySelector('input[type="checkbox"]');
    if (checkbox) {
      checkbox.checked = reviewSessionState.currentFilters.severities.has(severity);
    }
  }

  applyReviewSessionFilters();
}

function onReviewSessionSearch(searchText) {
  reviewSessionState.currentFilters.search = searchText.toLowerCase();
  applyReviewSessionFilters();
}

function applyReviewSessionFilters() {
  reviewSessionState.filteredFindings = reviewSessionState.allFindings.filter(finding => {
    // Dimension filter
    if (reviewSessionState.currentFilters.dimension !== 'all') {
      if (finding.dimension !== reviewSessionState.currentFilters.dimension) {
        return false;
      }
    }

    // Severity filter (multi-select)
    if (reviewSessionState.currentFilters.severities.size > 0) {
      if (!reviewSessionState.currentFilters.severities.has(finding.severity)) {
        return false;
      }
    }

    // Search filter
    if (reviewSessionState.currentFilters.search) {
      const searchText = `${finding.title} ${finding.description} ${finding.file} ${finding.category}`.toLowerCase();
      if (!searchText.includes(reviewSessionState.currentFilters.search)) {
        return false;
      }
    }

    return true;
  });

  sortReviewSessionFindings();
}

function sortReviewSessionFindings() {
  const sortBy = document.getElementById('reviewSessionSortSelect')?.value || 'severity';
  reviewSessionState.sortConfig.field = sortBy;

  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

  reviewSessionState.filteredFindings.sort((a, b) => {
    let comparison = 0;

    if (sortBy === 'severity') {
      comparison = severityOrder[a.severity] - severityOrder[b.severity];
    } else if (sortBy === 'dimension') {
      comparison = a.dimension.localeCompare(b.dimension);
    } else if (sortBy === 'file') {
      comparison = (a.file || '').localeCompare(b.file || '');
    }

    return reviewSessionState.sortConfig.order === 'asc' ? comparison : -comparison;
  });

  renderFilteredReviewSessionFindings();
}

function toggleReviewSessionSortOrder() {
  reviewSessionState.sortConfig.order = reviewSessionState.sortConfig.order === 'asc' ? 'desc' : 'asc';

  const icon = document.getElementById('reviewSessionSortOrderIcon');
  if (icon) {
    icon.textContent = reviewSessionState.sortConfig.order === 'asc' ? '↑' : '↓';
  }

  sortReviewSessionFindings();
}

function resetReviewSessionFilters() {
  // Reset state
  reviewSessionState.currentFilters.dimension = 'all';
  reviewSessionState.currentFilters.severities.clear();
  reviewSessionState.currentFilters.search = '';
  reviewSessionState.sortConfig.field = 'severity';
  reviewSessionState.sortConfig.order = 'desc';

  // Reset UI
  document.querySelectorAll('.dim-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.dimension === 'all');
  });

  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.classList.remove('active');
    const checkbox = chip.querySelector('input[type="checkbox"]');
    if (checkbox) checkbox.checked = false;
  });

  document.querySelectorAll('.dimension-item').forEach(item => {
    item.classList.remove('active');
  });

  const searchInput = document.getElementById('reviewSessionSearchInput');
  if (searchInput) searchInput.value = '';

  const sortSelect = document.getElementById('reviewSessionSortSelect');
  if (sortSelect) sortSelect.value = 'severity';

  const sortIcon = document.getElementById('reviewSessionSortOrderIcon');
  if (sortIcon) sortIcon.textContent = '↓';

  // Re-apply filters
  reviewSessionState.filteredFindings = [...reviewSessionState.allFindings];
  sortReviewSessionFindings();
}

function renderFilteredReviewSessionFindings() {
  const listContainer = document.getElementById('reviewSessionFindingsList');
  const countEl = document.getElementById('reviewSessionFindingsCount');

  if (listContainer) {
    listContainer.innerHTML = renderReviewSessionFindingsList(reviewSessionState.filteredFindings);
  }

  if (countEl) {
    countEl.textContent = `${reviewSessionState.filteredFindings.length} findings`;
  }
}

// ==========================================
// Export Fix JSON
// ==========================================

function exportReviewSessionFixJson() {
  if (reviewSessionState.selectedFindings.size === 0) {
    showToast('Please select at least one finding to export', 'error');
    return;
  }

  const selectedFindingsData = reviewSessionState.allFindings.filter(f =>
    reviewSessionState.selectedFindings.has(f.id)
  );

  const session = reviewSessionState.session;
  const sessionId = session?.session_id || 'unknown';
  const exportId = `fix-${Date.now()}`;

  const exportData = {
    export_id: exportId,
    export_timestamp: new Date().toISOString(),
    review_id: `review-${sessionId}`,
    session_id: sessionId,
    findings_count: selectedFindingsData.length,
    findings: selectedFindingsData.map(f => ({
      id: f.id,
      title: f.title,
      description: f.description,
      severity: f.severity,
      dimension: f.dimension,
      category: f.category || 'uncategorized',
      file: f.file,
      line: f.line,
      code_context: f.code_context || null,
      recommendations: f.recommendations || [],
      root_cause: f.root_cause || null
    }))
  };

  // Convert to JSON and download
  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const filename = `fix-export-${exportId}.json`;
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // Show success notification
  const severityCounts = {
    critical: selectedFindingsData.filter(f => f.severity === 'critical').length,
    high: selectedFindingsData.filter(f => f.severity === 'high').length,
    medium: selectedFindingsData.filter(f => f.severity === 'medium').length,
    low: selectedFindingsData.filter(f => f.severity === 'low').length
  };

  showToast(`Exported ${selectedFindingsData.length} findings (Critical: ${severityCounts.critical}, High: ${severityCounts.high}, Medium: ${severityCounts.medium}, Low: ${severityCounts.low})`, 'success');
}

// ==========================================
// Page Initialization
// ==========================================

function initReviewSessionPage(session) {
  // Reset state when page loads
  reviewSessionState.session = session;
  // Event handlers are inline onclick - no additional setup needed

  // Start fix progress polling if in server mode
  if (window.SERVER_MODE && session?.session_id) {
    startFixProgressPolling(session.session_id);
  }
}

// Legacy filter function for compatibility
function filterReviewFindings(severity) {
  if (severity === 'all') {
    reviewSessionState.currentFilters.severities.clear();
  } else {
    reviewSessionState.currentFilters.severities.clear();
    reviewSessionState.currentFilters.severities.add(severity);
  }
  applyReviewSessionFilters();
}

// ==========================================
// FIX PROGRESS TRACKING
// ==========================================

// Fix progress state
let fixProgressState = {
  fixPlan: null,
  progressData: null,
  pollInterval: null,
  currentSlide: 0
};

/**
 * Discover and load fix-plan.json for the current review session
 * Searches in: .review/fixes/{fix-session-id}/fix-plan.json
 */
async function loadFixProgress(sessionId) {
  if (!window.SERVER_MODE) {
    return null;
  }

  try {
    // First, discover active fix session
    const activeFixResponse = await fetch(`/api/file?path=${encodeURIComponent(projectPath + '/.review/fixes/active-fix-session.json')}`);
    if (!activeFixResponse.ok) {
      return null;
    }
    const activeFixSession = await activeFixResponse.json();
    const fixSessionId = activeFixSession.fix_session_id;

    // Load fix-plan.json
    const planPath = `${projectPath}/.review/fixes/${fixSessionId}/fix-plan.json`;
    const planResponse = await fetch(`/api/file?path=${encodeURIComponent(planPath)}`);
    if (!planResponse.ok) {
      return null;
    }
    const fixPlan = await planResponse.json();

    // Load progress files for each group
    const progressPromises = (fixPlan.groups || []).map(async (group) => {
      const progressPath = `${projectPath}/.review/fixes/${fixSessionId}/${group.progress_file}`;
      try {
        const response = await fetch(`/api/file?path=${encodeURIComponent(progressPath)}`);
        return response.ok ? await response.json() : null;
      } catch {
        return null;
      }
    });
    const progressDataArray = await Promise.all(progressPromises);

    // Aggregate progress data
    const aggregated = aggregateFixProgress(fixPlan, progressDataArray.filter(d => d !== null));

    fixProgressState.fixPlan = fixPlan;
    fixProgressState.progressData = aggregated;

    return aggregated;
  } catch (err) {
    console.error('Failed to load fix progress:', err);
    return null;
  }
}

/**
 * Aggregate progress from multiple group progress files
 */
function aggregateFixProgress(fixPlan, progressDataArray) {
  let totalFindings = 0;
  let fixedCount = 0;
  let failedCount = 0;
  let inProgressCount = 0;
  let pendingCount = 0;
  const activeAgents = [];

  progressDataArray.forEach(progress => {
    if (progress.findings) {
      progress.findings.forEach(f => {
        totalFindings++;
        if (f.result === 'fixed') fixedCount++;
        else if (f.result === 'failed') failedCount++;
        else if (f.status === 'in-progress') inProgressCount++;
        else pendingCount++;
      });
    }
    if (progress.assigned_agent && progress.status === 'in-progress') {
      activeAgents.push({
        agent_id: progress.assigned_agent,
        group_id: progress.group_id,
        current_finding: progress.current_finding
      });
    }
  });

  // Determine phase
  let phase = 'planning';
  if (fixPlan.metadata?.status === 'executing' || inProgressCount > 0 || fixedCount > 0 || failedCount > 0) {
    phase = 'execution';
  }
  if (totalFindings > 0 && pendingCount === 0 && inProgressCount === 0) {
    phase = 'completion';
  }

  // Calculate stage progress
  const stages = (fixPlan.timeline?.stages || []).map(stage => {
    const groupStatuses = stage.groups.map(groupId => {
      const progress = progressDataArray.find(p => p.group_id === groupId);
      return progress ? progress.status : 'pending';
    });
    let status = 'pending';
    if (groupStatuses.every(s => s === 'completed' || s === 'failed')) status = 'completed';
    else if (groupStatuses.some(s => s === 'in-progress')) status = 'in-progress';
    return { stage: stage.stage, status, groups: stage.groups };
  });

  const currentStage = stages.findIndex(s => s.status === 'in-progress' || s.status === 'pending') + 1 || stages.length;
  const percentComplete = totalFindings > 0 ? ((fixedCount + failedCount) / totalFindings) * 100 : 0;

  return {
    fix_session_id: fixPlan.metadata?.fix_session_id,
    phase,
    total_findings: totalFindings,
    fixed_count: fixedCount,
    failed_count: failedCount,
    in_progress_count: inProgressCount,
    pending_count: pendingCount,
    percent_complete: percentComplete,
    current_stage: currentStage,
    total_stages: stages.length,
    stages,
    active_agents: activeAgents
  };
}

/**
 * Render fix progress tracking card (carousel style)
 */
function renderFixProgressCard(progressData) {
  if (!progressData) {
    return '';
  }

  const { phase, total_findings, fixed_count, failed_count, in_progress_count, pending_count, percent_complete, current_stage, total_stages, stages, active_agents, fix_session_id } = progressData;

  // Phase badge class
  const phaseClass = phase === 'planning' ? 'phase-planning' : phase === 'execution' ? 'phase-execution' : 'phase-completion';
  const phaseIcon = phase === 'planning' ? '📝' : phase === 'execution' ? '⚡' : '✅';

  // Build stage dots
  const stageDots = stages.map((s, i) => {
    const dotClass = s.status === 'completed' ? 'completed' : s.status === 'in-progress' ? 'active' : '';
    return `<span class="fix-stage-dot ${dotClass}" title="Stage ${i + 1}: ${s.status}"></span>`;
  }).join('');

  // Build carousel slides
  const slides = [];

  // Slide 1: Overview
  slides.push(`
    <div class="fix-carousel-slide">
      <div class="fix-slide-header">
        <span class="fix-phase-badge ${phaseClass}">${phaseIcon} ${phase.toUpperCase()}</span>
        <span class="fix-session-id">${fix_session_id || 'Fix Session'}</span>
      </div>
      <div class="fix-progress-bar-mini">
        <div class="fix-progress-fill" style="width: ${percent_complete}%"></div>
      </div>
      <div class="fix-progress-text">${percent_complete.toFixed(0)}% Complete · Stage ${current_stage}/${total_stages}</div>
    </div>
  `);

  // Slide 2: Stats
  slides.push(`
    <div class="fix-carousel-slide">
      <div class="fix-stats-row">
        <div class="fix-stat">
          <span class="fix-stat-value">${total_findings}</span>
          <span class="fix-stat-label">Total</span>
        </div>
        <div class="fix-stat fixed">
          <span class="fix-stat-value">${fixed_count}</span>
          <span class="fix-stat-label">Fixed</span>
        </div>
        <div class="fix-stat failed">
          <span class="fix-stat-value">${failed_count}</span>
          <span class="fix-stat-label">Failed</span>
        </div>
        <div class="fix-stat pending">
          <span class="fix-stat-value">${pending_count + in_progress_count}</span>
          <span class="fix-stat-label">Pending</span>
        </div>
      </div>
    </div>
  `);

  // Slide 3: Active agents (if any)
  if (active_agents.length > 0) {
    const agentItems = active_agents.slice(0, 2).map(a => `
      <div class="fix-agent-item">
        <span class="fix-agent-icon">🤖</span>
        <span class="fix-agent-info">${a.current_finding?.finding_title || 'Working...'}</span>
      </div>
    `).join('');
    slides.push(`
      <div class="fix-carousel-slide">
        <div class="fix-agents-header">${active_agents.length} Active Agent${active_agents.length > 1 ? 's' : ''}</div>
        ${agentItems}
      </div>
    `);
  }

  // Build carousel navigation
  const navDots = slides.map((_, i) => `
    <span class="fix-nav-dot ${i === 0 ? 'active' : ''}" onclick="navigateFixCarousel(${i})"></span>
  `).join('');

  return `
    <div class="fix-progress-card" id="fixProgressCard">
      <div class="fix-card-header">
        <span class="fix-card-title">🔧 Fix Progress</span>
        <div class="fix-stage-dots">${stageDots}</div>
      </div>
      <div class="fix-carousel-container">
        <div class="fix-carousel-track" id="fixCarouselTrack">
          ${slides.join('')}
        </div>
      </div>
      <div class="fix-carousel-nav">
        <button class="fix-nav-btn prev" onclick="navigateFixCarousel('prev')">‹</button>
        <div class="fix-nav-dots">${navDots}</div>
        <button class="fix-nav-btn next" onclick="navigateFixCarousel('next')">›</button>
      </div>
    </div>
  `;
}

/**
 * Navigate fix progress carousel
 */
function navigateFixCarousel(direction) {
  const track = document.getElementById('fixCarouselTrack');
  if (!track) return;

  const slides = track.querySelectorAll('.fix-carousel-slide');
  const totalSlides = slides.length;

  if (typeof direction === 'number') {
    fixProgressState.currentSlide = direction;
  } else if (direction === 'next') {
    fixProgressState.currentSlide = (fixProgressState.currentSlide + 1) % totalSlides;
  } else if (direction === 'prev') {
    fixProgressState.currentSlide = (fixProgressState.currentSlide - 1 + totalSlides) % totalSlides;
  }

  track.style.transform = `translateX(-${fixProgressState.currentSlide * 100}%)`;

  // Update nav dots
  document.querySelectorAll('.fix-nav-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === fixProgressState.currentSlide);
  });
}

/**
 * Start polling for fix progress updates
 */
function startFixProgressPolling(sessionId) {
  if (fixProgressState.pollInterval) {
    clearInterval(fixProgressState.pollInterval);
  }

  // Initial load
  loadFixProgress(sessionId).then(data => {
    if (data) {
      updateFixProgressUI(data);
    }
  });

  // Poll every 5 seconds
  fixProgressState.pollInterval = setInterval(async () => {
    const data = await loadFixProgress(sessionId);
    if (data) {
      updateFixProgressUI(data);
      // Stop polling if completed
      if (data.phase === 'completion') {
        clearInterval(fixProgressState.pollInterval);
        fixProgressState.pollInterval = null;
      }
    }
  }, 5000);
}

/**
 * Update fix progress UI
 */
function updateFixProgressUI(progressData) {
  const container = document.getElementById('fixProgressSection');
  if (!container) return;

  container.innerHTML = renderFixProgressCard(progressData);
  fixProgressState.currentSlide = 0;
}

/**
 * Stop fix progress polling
 */
function stopFixProgressPolling() {
  if (fixProgressState.pollInterval) {
    clearInterval(fixProgressState.pollInterval);
    fixProgressState.pollInterval = null;
  }
}
