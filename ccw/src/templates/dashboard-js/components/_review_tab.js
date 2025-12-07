// ==========================================
// Enhanced Review Tab with Multi-Select & Preview
// ==========================================

// Review tab state
let reviewTabState = {
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
  sessionPath: null,
  sessionId: null
};

// ==========================================
// Main Review Tab Render
// ==========================================

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

  // Convert dimensions object to flat findings array
  const findings = [];
  let findingIndex = 0;

  Object.entries(review.dimensions).forEach(([dim, rawFindings]) => {
    let dimFindings = [];
    if (Array.isArray(rawFindings)) {
      dimFindings = rawFindings;
    } else if (rawFindings && typeof rawFindings === 'object') {
      if (Array.isArray(rawFindings.findings)) {
        dimFindings = rawFindings.findings;
      }
    }

    dimFindings.forEach(f => {
      findings.push({
        id: f.id || `finding-${findingIndex++}`,
        title: f.title || 'Finding',
        description: f.description || '',
        severity: (f.severity || 'medium').toLowerCase(),
        dimension: dim,
        category: f.category || '',
        file: f.file || '',
        line: f.line || '',
        code_context: f.code_context || f.snippet || '',
        recommendations: f.recommendations || (f.recommendation ? [f.recommendation] : []),
        root_cause: f.root_cause || '',
        impact: f.impact || '',
        references: f.references || [],
        metadata: f.metadata || {}
      });
    });
  });

  if (findings.length === 0) {
    return `
      <div class="tab-empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">No Findings</div>
        <div class="empty-text">No review findings found.</div>
      </div>
    `;
  }

  // Store findings in state
  reviewTabState.allFindings = findings;
  reviewTabState.filteredFindings = [...findings];
  reviewTabState.selectedFindings.clear();
  reviewTabState.previewFinding = null;

  // Get dimensions for tabs
  const dimensions = [...new Set(findings.map(f => f.dimension))];

  // Count by severity
  const severityCounts = {
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length
  };

  return `
    <div class="review-enhanced-container">
      <!-- Header with Stats & Controls -->
      <div class="review-header-bar">
        <div class="review-severity-stats">
          <span class="severity-stat critical" onclick="filterReviewBySeverity('critical')" title="Filter Critical">
            🔴 ${severityCounts.critical}
          </span>
          <span class="severity-stat high" onclick="filterReviewBySeverity('high')" title="Filter High">
            🟠 ${severityCounts.high}
          </span>
          <span class="severity-stat medium" onclick="filterReviewBySeverity('medium')" title="Filter Medium">
            🟡 ${severityCounts.medium}
          </span>
          <span class="severity-stat low" onclick="filterReviewBySeverity('low')" title="Filter Low">
            🟢 ${severityCounts.low}
          </span>
        </div>

        <div class="review-search-box">
          <input type="text"
                 id="reviewSearchInput"
                 placeholder="Search findings..."
                 oninput="onReviewSearch(this.value)">
        </div>

        <div class="review-selection-controls">
          <span class="selection-counter" id="reviewSelectionCounter">0 selected</span>
          <button class="btn-mini" onclick="selectAllReviewFindings()">Select All</button>
          <button class="btn-mini" onclick="selectVisibleReviewFindings()">Select Visible</button>
          <button class="btn-mini" onclick="clearReviewSelection()">Clear</button>
        </div>

        <button class="btn-export-fix" id="exportFixBtn" onclick="exportReviewFixJson()" disabled>
          🔧 Export Fix JSON
        </button>
      </div>

      <!-- Filter Bar -->
      <div class="review-filter-bar">
        <div class="filter-group">
          <span class="filter-label">Severity:</span>
          <div class="filter-chips">
            <label class="filter-chip" id="filter-critical">
              <input type="checkbox" onchange="toggleReviewSeverityFilter('critical')">
              <span>Critical</span>
            </label>
            <label class="filter-chip" id="filter-high">
              <input type="checkbox" onchange="toggleReviewSeverityFilter('high')">
              <span>High</span>
            </label>
            <label class="filter-chip" id="filter-medium">
              <input type="checkbox" onchange="toggleReviewSeverityFilter('medium')">
              <span>Medium</span>
            </label>
            <label class="filter-chip" id="filter-low">
              <input type="checkbox" onchange="toggleReviewSeverityFilter('low')">
              <span>Low</span>
            </label>
          </div>
        </div>

        <div class="filter-group">
          <span class="filter-label">Sort:</span>
          <select id="reviewSortSelect" class="sort-select" onchange="sortReviewFindings()">
            <option value="severity">By Severity</option>
            <option value="dimension">By Dimension</option>
            <option value="file">By File</option>
          </select>
          <button class="btn-sort-order" id="reviewSortOrderBtn" onclick="toggleReviewSortOrder()">
            <span id="reviewSortOrderIcon">↓</span>
          </button>
        </div>

        <button class="btn-mini" onclick="resetReviewFilters()">Reset Filters</button>
      </div>

      <!-- Dimension Tabs -->
      <div class="review-dimension-tabs">
        <button class="dim-tab active" data-dimension="all" onclick="filterReviewByDimension('all')">
          All (${findings.length})
        </button>
        ${dimensions.map(dim => `
          <button class="dim-tab" data-dimension="${dim}" onclick="filterReviewByDimension('${dim}')">
            ${escapeHtml(dim)} (${findings.filter(f => f.dimension === dim).length})
          </button>
        `).join('')}
      </div>

      <!-- Split Panel: List + Preview -->
      <div class="review-split-panel">
        <!-- Left: Findings List -->
        <div class="review-findings-panel">
          <div class="findings-list-header">
            <span id="reviewFindingsCount">${findings.length} findings</span>
          </div>
          <div class="review-findings-list" id="reviewFindingsList">
            ${renderReviewFindingsList(findings)}
          </div>
        </div>

        <!-- Right: Preview Panel -->
        <div class="review-preview-panel" id="reviewPreviewPanel">
          <div class="preview-empty-state">
            <div class="preview-icon">👆</div>
            <div class="preview-text">Click on a finding to preview details</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// Findings List Rendering
// ==========================================

function renderReviewFindingsList(findings) {
  if (findings.length === 0) {
    return `
      <div class="findings-empty">
        <span class="empty-icon">✨</span>
        <span>No findings match your filters</span>
      </div>
    `;
  }

  return findings.map(finding => `
    <div class="review-finding-item ${finding.severity} ${reviewTabState.selectedFindings.has(finding.id) ? 'selected' : ''}"
         data-finding-id="${finding.id}"
         onclick="previewReviewFinding('${finding.id}')">
      <input type="checkbox"
             class="finding-checkbox"
             ${reviewTabState.selectedFindings.has(finding.id) ? 'checked' : ''}
             onclick="toggleReviewFindingSelection('${finding.id}', event)">
      <div class="finding-content">
        <div class="finding-top-row">
          <span class="severity-badge ${finding.severity}">${finding.severity}</span>
          <span class="dimension-badge">${escapeHtml(finding.dimension)}</span>
        </div>
        <div class="finding-title">${escapeHtml(finding.title)}</div>
        ${finding.file ? `<div class="finding-file">📄 ${escapeHtml(finding.file)}${finding.line ? ':' + finding.line : ''}</div>` : ''}
      </div>
    </div>
  `).join('');
}

// ==========================================
// Preview Panel Rendering
// ==========================================

function previewReviewFinding(findingId) {
  const finding = reviewTabState.allFindings.find(f => f.id === findingId);
  if (!finding) return;

  reviewTabState.previewFinding = finding;

  // Update active state in list
  document.querySelectorAll('.review-finding-item').forEach(item => {
    item.classList.toggle('previewing', item.dataset.findingId === findingId);
  });

  const previewPanel = document.getElementById('reviewPreviewPanel');
  if (!previewPanel) return;

  previewPanel.innerHTML = `
    <div class="preview-content">
      <div class="preview-header">
        <div class="preview-badges">
          <span class="severity-badge ${finding.severity}">${finding.severity}</span>
          <span class="dimension-badge">${escapeHtml(finding.dimension)}</span>
          ${finding.category ? `<span class="category-badge">${escapeHtml(finding.category)}</span>` : ''}
        </div>
        <button class="btn-select-finding ${reviewTabState.selectedFindings.has(finding.id) ? 'selected' : ''}"
                onclick="toggleReviewFindingSelection('${finding.id}', event)">
          ${reviewTabState.selectedFindings.has(finding.id) ? '✓ Selected' : '+ Select for Fix'}
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

function toggleReviewFindingSelection(findingId, event) {
  if (event) {
    event.stopPropagation();
  }

  if (reviewTabState.selectedFindings.has(findingId)) {
    reviewTabState.selectedFindings.delete(findingId);
  } else {
    reviewTabState.selectedFindings.add(findingId);
  }

  updateReviewSelectionUI();

  // Update preview panel button if this finding is being previewed
  if (reviewTabState.previewFinding && reviewTabState.previewFinding.id === findingId) {
    previewReviewFinding(findingId);
  }
}

function selectAllReviewFindings() {
  reviewTabState.allFindings.forEach(f => reviewTabState.selectedFindings.add(f.id));
  updateReviewSelectionUI();
}

function selectVisibleReviewFindings() {
  reviewTabState.filteredFindings.forEach(f => reviewTabState.selectedFindings.add(f.id));
  updateReviewSelectionUI();
}

function selectReviewBySeverity(severity) {
  reviewTabState.allFindings
    .filter(f => f.severity === severity)
    .forEach(f => reviewTabState.selectedFindings.add(f.id));
  updateReviewSelectionUI();
}

function clearReviewSelection() {
  reviewTabState.selectedFindings.clear();
  updateReviewSelectionUI();
}

function updateReviewSelectionUI() {
  // Update counter
  const counter = document.getElementById('reviewSelectionCounter');
  if (counter) {
    counter.textContent = `${reviewTabState.selectedFindings.size} selected`;
  }

  // Update export button
  const exportBtn = document.getElementById('exportFixBtn');
  if (exportBtn) {
    exportBtn.disabled = reviewTabState.selectedFindings.size === 0;
  }

  // Update checkbox states in list
  document.querySelectorAll('.review-finding-item').forEach(item => {
    const findingId = item.dataset.findingId;
    const isSelected = reviewTabState.selectedFindings.has(findingId);
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

function filterReviewByDimension(dimension) {
  reviewTabState.currentFilters.dimension = dimension;

  // Update tab active state
  document.querySelectorAll('.dim-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.dimension === dimension);
  });

  applyReviewFilters();
}

function filterReviewBySeverity(severity) {
  // Toggle the severity filter
  if (reviewTabState.currentFilters.severities.has(severity)) {
    reviewTabState.currentFilters.severities.delete(severity);
  } else {
    reviewTabState.currentFilters.severities.add(severity);
  }

  // Update filter chip UI
  const filterChip = document.getElementById(`filter-${severity}`);
  if (filterChip) {
    filterChip.classList.toggle('active', reviewTabState.currentFilters.severities.has(severity));
    const checkbox = filterChip.querySelector('input[type="checkbox"]');
    if (checkbox) {
      checkbox.checked = reviewTabState.currentFilters.severities.has(severity);
    }
  }

  applyReviewFilters();
}

function toggleReviewSeverityFilter(severity) {
  filterReviewBySeverity(severity);
}

function onReviewSearch(searchText) {
  reviewTabState.currentFilters.search = searchText.toLowerCase();
  applyReviewFilters();
}

function applyReviewFilters() {
  reviewTabState.filteredFindings = reviewTabState.allFindings.filter(finding => {
    // Dimension filter
    if (reviewTabState.currentFilters.dimension !== 'all') {
      if (finding.dimension !== reviewTabState.currentFilters.dimension) {
        return false;
      }
    }

    // Severity filter (multi-select)
    if (reviewTabState.currentFilters.severities.size > 0) {
      if (!reviewTabState.currentFilters.severities.has(finding.severity)) {
        return false;
      }
    }

    // Search filter
    if (reviewTabState.currentFilters.search) {
      const searchText = `${finding.title} ${finding.description} ${finding.file} ${finding.category}`.toLowerCase();
      if (!searchText.includes(reviewTabState.currentFilters.search)) {
        return false;
      }
    }

    return true;
  });

  sortReviewFindings();
}

function sortReviewFindings() {
  const sortBy = document.getElementById('reviewSortSelect')?.value || 'severity';
  reviewTabState.sortConfig.field = sortBy;

  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

  reviewTabState.filteredFindings.sort((a, b) => {
    let comparison = 0;

    if (sortBy === 'severity') {
      comparison = severityOrder[a.severity] - severityOrder[b.severity];
    } else if (sortBy === 'dimension') {
      comparison = a.dimension.localeCompare(b.dimension);
    } else if (sortBy === 'file') {
      comparison = (a.file || '').localeCompare(b.file || '');
    }

    return reviewTabState.sortConfig.order === 'asc' ? comparison : -comparison;
  });

  renderFilteredReviewFindings();
}

function toggleReviewSortOrder() {
  reviewTabState.sortConfig.order = reviewTabState.sortConfig.order === 'asc' ? 'desc' : 'asc';

  const icon = document.getElementById('reviewSortOrderIcon');
  if (icon) {
    icon.textContent = reviewTabState.sortConfig.order === 'asc' ? '↑' : '↓';
  }

  sortReviewFindings();
}

function resetReviewFilters() {
  // Reset state
  reviewTabState.currentFilters.dimension = 'all';
  reviewTabState.currentFilters.severities.clear();
  reviewTabState.currentFilters.search = '';
  reviewTabState.sortConfig.field = 'severity';
  reviewTabState.sortConfig.order = 'desc';

  // Reset UI
  document.querySelectorAll('.dim-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.dimension === 'all');
  });

  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.classList.remove('active');
    const checkbox = chip.querySelector('input[type="checkbox"]');
    if (checkbox) checkbox.checked = false;
  });

  const searchInput = document.getElementById('reviewSearchInput');
  if (searchInput) searchInput.value = '';

  const sortSelect = document.getElementById('reviewSortSelect');
  if (sortSelect) sortSelect.value = 'severity';

  const sortIcon = document.getElementById('reviewSortOrderIcon');
  if (sortIcon) sortIcon.textContent = '↓';

  // Re-apply filters
  reviewTabState.filteredFindings = [...reviewTabState.allFindings];
  sortReviewFindings();
}

function renderFilteredReviewFindings() {
  const listContainer = document.getElementById('reviewFindingsList');
  const countEl = document.getElementById('reviewFindingsCount');

  if (listContainer) {
    listContainer.innerHTML = renderReviewFindingsList(reviewTabState.filteredFindings);
  }

  if (countEl) {
    countEl.textContent = `${reviewTabState.filteredFindings.length} findings`;
  }
}

// ==========================================
// Export Fix JSON
// ==========================================

function exportReviewFixJson() {
  if (reviewTabState.selectedFindings.size === 0) {
    showToast('Please select at least one finding to export', 'error');
    return;
  }

  const selectedFindingsData = reviewTabState.allFindings.filter(f =>
    reviewTabState.selectedFindings.has(f.id)
  );

  const session = sessionDataStore[currentSessionDetailKey];
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

  showToast(`Exported ${selectedFindingsData.length} findings for fixing (Critical: ${severityCounts.critical}, High: ${severityCounts.high}, Medium: ${severityCounts.medium}, Low: ${severityCounts.low})`, 'success');
}
