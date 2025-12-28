// ==========================================
// ISSUE DISCOVERY VIEW
// Manages discovery sessions and findings
// ==========================================

// ========== Discovery State ==========
var discoveryData = {
  discoveries: [],
  selectedDiscovery: null,
  selectedFinding: null,
  findings: [],
  perspectiveFilter: 'all',
  priorityFilter: 'all',
  searchQuery: '',
  selectedFindings: new Set(),
  viewMode: 'list' // 'list' | 'detail'
};
var discoveryLoading = false;
var discoveryPollingInterval = null;

// ========== Helper Functions ==========
function getFilteredFindings() {
  const findings = discoveryData.findings || [];
  let filtered = findings;

  if (discoveryData.perspectiveFilter !== 'all') {
    filtered = filtered.filter(f => f.perspective === discoveryData.perspectiveFilter);
  }
  if (discoveryData.priorityFilter !== 'all') {
    filtered = filtered.filter(f => f.priority === discoveryData.priorityFilter);
  }
  if (discoveryData.searchQuery) {
    const q = discoveryData.searchQuery.toLowerCase();
    filtered = filtered.filter(f =>
      (f.title && f.title.toLowerCase().includes(q)) ||
      (f.file && f.file.toLowerCase().includes(q)) ||
      (f.description && f.description.toLowerCase().includes(q))
    );
  }
  return filtered;
}

// ========== Main Render Function ==========
async function renderIssueDiscovery() {
  const container = document.getElementById('mainContent');
  if (!container) return;

  // Hide stats grid and carousel
  hideStatsAndCarousel();

  // Show loading state
  container.innerHTML = '<div class="discovery-manager loading">' +
    '<div class="loading-spinner"><i data-lucide="loader-2" class="w-8 h-8 animate-spin"></i></div>' +
    '<p>' + t('common.loading') + '</p>' +
    '</div>';
  lucide.createIcons();

  // Load data
  await loadDiscoveryData();

  // Render the main view
  renderDiscoveryView();
}

// ========== Data Loading ==========
async function loadDiscoveryData() {
  discoveryLoading = true;
  try {
    const response = await fetch('/api/discoveries?path=' + encodeURIComponent(projectPath));
    if (!response.ok) throw new Error('Failed to load discoveries');
    const data = await response.json();
    discoveryData.discoveries = data.discoveries || [];
    updateDiscoveryBadge();
  } catch (err) {
    console.error('Failed to load discoveries:', err);
    discoveryData.discoveries = [];
  } finally {
    discoveryLoading = false;
  }
}

async function loadDiscoveryDetail(discoveryId) {
  try {
    const response = await fetch('/api/discoveries/' + encodeURIComponent(discoveryId) + '?path=' + encodeURIComponent(projectPath));
    if (!response.ok) throw new Error('Failed to load discovery detail');
    return await response.json();
  } catch (err) {
    console.error('Failed to load discovery detail:', err);
    return null;
  }
}

async function loadDiscoveryFindings(discoveryId) {
  try {
    let url = '/api/discoveries/' + encodeURIComponent(discoveryId) + '/findings?path=' + encodeURIComponent(projectPath);
    if (discoveryData.perspectiveFilter !== 'all') {
      url += '&perspective=' + encodeURIComponent(discoveryData.perspectiveFilter);
    }
    if (discoveryData.priorityFilter !== 'all') {
      url += '&priority=' + encodeURIComponent(discoveryData.priorityFilter);
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to load findings');
    const data = await response.json();
    return data.findings || [];
  } catch (err) {
    console.error('Failed to load findings:', err);
    return [];
  }
}

async function loadDiscoveryProgress(discoveryId) {
  try {
    const response = await fetch('/api/discoveries/' + encodeURIComponent(discoveryId) + '/progress?path=' + encodeURIComponent(projectPath));
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    return null;
  }
}

function updateDiscoveryBadge() {
  const badge = document.getElementById('badgeDiscovery');
  if (badge) {
    badge.textContent = discoveryData.discoveries.length;
  }
}

// ========== Main View Render ==========
function renderDiscoveryView() {
  const container = document.getElementById('mainContent');
  if (!container) return;

  container.innerHTML = `
    <div class="discovery-manager">
      <!-- Header -->
      <div class="discovery-header mb-6">
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <i data-lucide="search-code" class="w-5 h-5 text-primary"></i>
            </div>
            <div>
              <h2 class="text-lg font-semibold text-foreground">${t('discovery.title') || 'Issue Discovery'}</h2>
              <p class="text-sm text-muted-foreground">${t('discovery.description') || 'Discover potential issues from multiple perspectives'}</p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            ${discoveryData.viewMode === 'detail' ? `
              <button class="discovery-back-btn" onclick="backToDiscoveryList()">
                <i data-lucide="arrow-left" class="w-4 h-4"></i>
                <span>${t('common.back') || 'Back'}</span>
              </button>
            ` : ''}
          </div>
        </div>
      </div>

      ${discoveryData.viewMode === 'list' ? renderDiscoveryListSection() : renderDiscoveryDetailSection()}
    </div>
  `;

  lucide.createIcons();
}

// ========== Discovery List Section ==========
function renderDiscoveryListSection() {
  const discoveries = discoveryData.discoveries || [];

  if (discoveries.length === 0) {
    return `
      <div class="discovery-empty">
        <div class="empty-icon">
          <i data-lucide="search-x" class="w-12 h-12 text-muted-foreground"></i>
        </div>
        <h3 class="text-lg font-medium text-foreground mt-4">${t('discovery.noDiscoveries') || 'No discoveries yet'}</h3>
        <p class="text-sm text-muted-foreground mt-2">${t('discovery.runCommand') || 'Run /issue:discover to start discovering issues'}</p>
        <div class="mt-4 p-3 bg-muted/50 rounded-lg">
          <code class="text-sm text-primary">/issue:discover src/auth/**</code>
        </div>
      </div>
    `;
  }

  return `
    <div class="discovery-list-container">
      ${discoveries.map(d => renderDiscoveryCard(d)).join('')}
    </div>
  `;
}

function renderDiscoveryCard(discovery) {
  const { discovery_id, target_pattern, perspectives, phase, total_findings, issues_generated, priority_distribution, progress } = discovery;

  const isComplete = phase === 'complete';
  const isRunning = phase && phase !== 'complete' && phase !== 'failed';

  // Calculate progress percentage
  let progressPercent = 0;
  if (progress && progress.perspective_analysis) {
    progressPercent = progress.perspective_analysis.percent_complete || 0;
  } else if (isComplete) {
    progressPercent = 100;
  }

  // Priority distribution bar
  const critical = priority_distribution?.critical || 0;
  const high = priority_distribution?.high || 0;
  const medium = priority_distribution?.medium || 0;
  const low = priority_distribution?.low || 0;
  const total = critical + high + medium + low || 1;

  return `
    <div class="discovery-card ${isComplete ? 'complete' : ''} ${isRunning ? 'running' : ''}" onclick="viewDiscoveryDetail('${discovery_id}')">
      <div class="discovery-card-header">
        <div class="discovery-id">
          <i data-lucide="search" class="w-4 h-4"></i>
          <span>${discovery_id}</span>
        </div>
        <span class="discovery-phase ${phase}">${phase || 'unknown'}</span>
      </div>

      <div class="discovery-card-body">
        <div class="discovery-target">
          <i data-lucide="folder" class="w-4 h-4 text-muted-foreground"></i>
          <span class="text-sm text-foreground">${target_pattern || 'N/A'}</span>
        </div>

        ${perspectives && perspectives.length > 0 ? `
          <div class="discovery-perspectives">
            ${perspectives.slice(0, 5).map(p => `<span class="perspective-badge ${p}">${p}</span>`).join('')}
            ${perspectives.length > 5 ? `<span class="perspective-badge more">+${perspectives.length - 5}</span>` : ''}
          </div>
        ` : ''}

        ${isRunning ? `
          <div class="discovery-progress-bar">
            <div class="progress-fill" style="width: ${progressPercent}%"></div>
          </div>
          <div class="text-xs text-muted-foreground mt-1">${progressPercent}% complete</div>
        ` : ''}

        <div class="discovery-stats">
          <div class="stat">
            <span class="stat-value">${total_findings || 0}</span>
            <span class="stat-label">${t('discovery.findings') || 'Findings'}</span>
          </div>
          <div class="stat">
            <span class="stat-value">${issues_generated || 0}</span>
            <span class="stat-label">${t('discovery.exported') || 'Exported'}</span>
          </div>
        </div>

        ${total_findings > 0 ? `
          <div class="discovery-priority-bar">
            <div class="priority-segment critical" style="width: ${(critical / total) * 100}%" title="Critical: ${critical}"></div>
            <div class="priority-segment high" style="width: ${(high / total) * 100}%" title="High: ${high}"></div>
            <div class="priority-segment medium" style="width: ${(medium / total) * 100}%" title="Medium: ${medium}"></div>
            <div class="priority-segment low" style="width: ${(low / total) * 100}%" title="Low: ${low}"></div>
          </div>
        ` : ''}
      </div>

      <div class="discovery-card-footer">
        <button class="discovery-action-btn" onclick="event.stopPropagation(); deleteDiscovery('${discovery_id}')">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    </div>
  `;
}

// ========== Discovery Detail Section ==========
function renderDiscoveryDetailSection() {
  const discovery = discoveryData.selectedDiscovery;
  if (!discovery) {
    return '<div class="loading-spinner"><i data-lucide="loader-2" class="w-8 h-8 animate-spin"></i></div>';
  }

  const findings = discoveryData.findings || [];
  const perspectives = [...new Set(findings.map(f => f.perspective))];
  const filteredFindings = getFilteredFindings();

  return `
    <div class="discovery-detail-container">
      <!-- Left Panel: Findings List -->
      <div class="discovery-findings-panel">
        <!-- Toolbar -->
        <div class="discovery-toolbar">
          <div class="toolbar-filters">
            <select class="filter-select" onchange="filterDiscoveryByPerspective(this.value)">
              <option value="all" ${discoveryData.perspectiveFilter === 'all' ? 'selected' : ''}>${t('discovery.allPerspectives') || 'All Perspectives'}</option>
              ${perspectives.map(p => `<option value="${p}" ${discoveryData.perspectiveFilter === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
            <select class="filter-select" onchange="filterDiscoveryByPriority(this.value)">
              <option value="all" ${discoveryData.priorityFilter === 'all' ? 'selected' : ''}>${t('discovery.allPriorities') || 'All Priorities'}</option>
              <option value="critical" ${discoveryData.priorityFilter === 'critical' ? 'selected' : ''}>Critical</option>
              <option value="high" ${discoveryData.priorityFilter === 'high' ? 'selected' : ''}>High</option>
              <option value="medium" ${discoveryData.priorityFilter === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="low" ${discoveryData.priorityFilter === 'low' ? 'selected' : ''}>Low</option>
            </select>
          </div>
          <div class="toolbar-search">
            <i data-lucide="search" class="w-4 h-4"></i>
            <input type="text" placeholder="${t('common.search') || 'Search...'}"
                   value="${discoveryData.searchQuery}"
                   oninput="searchDiscoveryFindings(this.value)">
          </div>
        </div>

        <!-- Findings Count -->
        <div class="findings-count">
          <div class="findings-count-left">
            <span>${filteredFindings.length} ${t('discovery.findings') || 'findings'}</span>
            ${discoveryData.selectedFindings.size > 0 ? `
              <span class="selected-count">(${discoveryData.selectedFindings.size} selected)</span>
            ` : ''}
          </div>
          <div class="findings-count-actions">
            <button class="select-action-btn" onclick="selectAllFindings()">
              <i data-lucide="check-square" class="w-3 h-3"></i>
              <span>${t('discovery.selectAll') || 'Select All'}</span>
            </button>
            <button class="select-action-btn" onclick="deselectAllFindings()">
              <i data-lucide="square" class="w-3 h-3"></i>
              <span>${t('discovery.deselectAll') || 'Deselect All'}</span>
            </button>
          </div>
        </div>

        <!-- Findings List -->
        <div class="findings-list">
          ${filteredFindings.length === 0 ? `
            <div class="findings-empty">
              <i data-lucide="inbox" class="w-8 h-8 text-muted-foreground"></i>
              <p>${t('discovery.noFindings') || 'No findings match your filters'}</p>
            </div>
          ` : filteredFindings.map(f => renderFindingItem(f)).join('')}
        </div>

        <!-- Bulk Actions -->
        ${discoveryData.selectedFindings.size > 0 ? `
          <div class="bulk-actions">
            <span class="bulk-count">${discoveryData.selectedFindings.size} selected</span>
            <button class="bulk-action-btn export" onclick="exportSelectedFindings()">
              <i data-lucide="upload" class="w-4 h-4"></i>
              <span>${t('discovery.exportAsIssues') || 'Export as Issues'}</span>
            </button>
            <button class="bulk-action-btn dismiss" onclick="dismissSelectedFindings()">
              <i data-lucide="x" class="w-4 h-4"></i>
              <span>${t('discovery.dismiss') || 'Dismiss'}</span>
            </button>
          </div>
        ` : ''}
      </div>

      <!-- Right Panel: Finding Preview -->
      <div class="discovery-preview-panel">
        ${discoveryData.selectedFinding ? renderFindingPreview(discoveryData.selectedFinding) : `
          <div class="preview-empty">
            <i data-lucide="mouse-pointer-click" class="w-12 h-12 text-muted-foreground"></i>
            <p>${t('discovery.selectFinding') || 'Select a finding to preview'}</p>
          </div>
        `}
      </div>
    </div>
  `;
}

function renderFindingItem(finding) {
  const isSelected = discoveryData.selectedFindings.has(finding.id);
  const isActive = discoveryData.selectedFinding?.id === finding.id;
  const isExported = finding.exported === true;

  return `
    <div class="finding-item ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''} ${finding.dismissed ? 'dismissed' : ''} ${isExported ? 'exported' : ''}"
         onclick="selectFinding('${finding.id}')">
      <div class="finding-checkbox" onclick="event.stopPropagation(); toggleFindingSelection('${finding.id}')">
        <input type="checkbox" ${isSelected ? 'checked' : ''} ${isExported ? 'disabled' : ''}>
      </div>
      <div class="finding-content">
        <div class="finding-header">
          <span class="perspective-badge ${finding.perspective}">${finding.perspective}</span>
          <span class="priority-badge ${finding.priority}">${finding.priority}</span>
          ${isExported ? '<span class="exported-badge">' + (t('discovery.exported') || 'Exported') + '</span>' : ''}
        </div>
        <div class="finding-title">${finding.title || 'Untitled'}</div>
        <div class="finding-location">
          <i data-lucide="file" class="w-3 h-3"></i>
          <span>${finding.file || 'Unknown'}${finding.line ? ':' + finding.line : ''}</span>
        </div>
      </div>
    </div>
  `;
}

function renderFindingPreview(finding) {
  return `
    <div class="finding-preview">
      <div class="preview-header">
        <div class="preview-badges">
          <span class="perspective-badge ${finding.perspective}">${finding.perspective}</span>
          <span class="priority-badge ${finding.priority}">${finding.priority}</span>
          ${finding.confidence ? `<span class="confidence-badge">${Math.round(finding.confidence * 100)}% confidence</span>` : ''}
        </div>
        <h3 class="preview-title">${finding.title || 'Untitled'}</h3>
      </div>

      <div class="preview-section">
        <h4><i data-lucide="file-code" class="w-4 h-4"></i> ${t('discovery.location') || 'Location'}</h4>
        <div class="preview-location">
          <code>${finding.file || 'Unknown'}${finding.line ? ':' + finding.line : ''}</code>
        </div>
      </div>

      ${finding.snippet ? `
        <div class="preview-section">
          <h4><i data-lucide="code" class="w-4 h-4"></i> ${t('discovery.code') || 'Code'}</h4>
          <pre class="preview-snippet"><code>${escapeHtml(finding.snippet)}</code></pre>
        </div>
      ` : ''}

      <div class="preview-section">
        <h4><i data-lucide="info" class="w-4 h-4"></i> ${t('discovery.description') || 'Description'}</h4>
        <p class="preview-description">${finding.description || 'No description'}</p>
      </div>

      ${finding.impact ? `
        <div class="preview-section">
          <h4><i data-lucide="alert-triangle" class="w-4 h-4"></i> ${t('discovery.impact') || 'Impact'}</h4>
          <p class="preview-impact">${finding.impact}</p>
        </div>
      ` : ''}

      ${finding.recommendation ? `
        <div class="preview-section">
          <h4><i data-lucide="lightbulb" class="w-4 h-4"></i> ${t('discovery.recommendation') || 'Recommendation'}</h4>
          <p class="preview-recommendation">${finding.recommendation}</p>
        </div>
      ` : ''}

      ${finding.suggested_issue ? `
        <div class="preview-section suggested-issue">
          <h4><i data-lucide="clipboard-list" class="w-4 h-4"></i> ${t('discovery.suggestedIssue') || 'Suggested Issue'}</h4>
          <div class="suggested-issue-content">
            <div class="issue-title">${finding.suggested_issue.title || finding.title}</div>
            <div class="issue-meta">
              <span class="issue-type">${finding.suggested_issue.type || 'bug'}</span>
              <span class="issue-priority">P${finding.suggested_issue.priority || 3}</span>
              ${finding.suggested_issue.labels ? finding.suggested_issue.labels.map(l => `<span class="issue-label">${l}</span>`).join('') : ''}
            </div>
          </div>
        </div>
      ` : ''}

      <div class="preview-actions">
        <button class="preview-action-btn primary" onclick="exportSingleFinding('${finding.id}')">
          <i data-lucide="upload" class="w-4 h-4"></i>
          <span>${t('discovery.exportAsIssue') || 'Export as Issue'}</span>
        </button>
        <button class="preview-action-btn secondary" onclick="dismissFinding('${finding.id}')">
          <i data-lucide="x" class="w-4 h-4"></i>
          <span>${t('discovery.dismiss') || 'Dismiss'}</span>
        </button>
      </div>
    </div>
  `;
}

// ========== Actions ==========
async function viewDiscoveryDetail(discoveryId) {
  discoveryData.viewMode = 'detail';
  discoveryData.selectedFinding = null;
  discoveryData.selectedFindings.clear();
  discoveryData.perspectiveFilter = 'all';
  discoveryData.priorityFilter = 'all';
  discoveryData.searchQuery = '';

  // Show loading
  renderDiscoveryView();

  // Load detail
  const detail = await loadDiscoveryDetail(discoveryId);
  if (detail) {
    discoveryData.selectedDiscovery = detail;
    // Flatten findings from perspectives
    const allFindings = [];
    if (detail.perspectives) {
      for (const p of detail.perspectives) {
        if (p.findings) {
          allFindings.push(...p.findings);
        }
      }
    }
    discoveryData.findings = allFindings;
  }

  // Start polling if running
  if (detail && detail.phase && detail.phase !== 'complete' && detail.phase !== 'failed') {
    startDiscoveryPolling(discoveryId);
  }

  renderDiscoveryView();
}

function backToDiscoveryList() {
  stopDiscoveryPolling();
  discoveryData.viewMode = 'list';
  discoveryData.selectedDiscovery = null;
  discoveryData.selectedFinding = null;
  discoveryData.findings = [];
  discoveryData.selectedFindings.clear();
  renderDiscoveryView();
}

function selectFinding(findingId) {
  const finding = discoveryData.findings.find(f => f.id === findingId);
  discoveryData.selectedFinding = finding || null;
  renderDiscoveryView();
}

function toggleFindingSelection(findingId) {
  if (discoveryData.selectedFindings.has(findingId)) {
    discoveryData.selectedFindings.delete(findingId);
  } else {
    discoveryData.selectedFindings.add(findingId);
  }
  renderDiscoveryView();
}

function selectAllFindings() {
  // Get filtered findings (respecting current filters)
  const filteredFindings = getFilteredFindings();
  // Select only non-exported findings
  for (const finding of filteredFindings) {
    if (!finding.exported) {
      discoveryData.selectedFindings.add(finding.id);
    }
  }
  renderDiscoveryView();
}

function deselectAllFindings() {
  discoveryData.selectedFindings.clear();
  renderDiscoveryView();
}

function filterDiscoveryByPerspective(perspective) {
  discoveryData.perspectiveFilter = perspective;
  renderDiscoveryView();
}

function filterDiscoveryByPriority(priority) {
  discoveryData.priorityFilter = priority;
  renderDiscoveryView();
}

function searchDiscoveryFindings(query) {
  discoveryData.searchQuery = query;
  renderDiscoveryView();
}

async function exportSelectedFindings() {
  if (discoveryData.selectedFindings.size === 0) return;

  const discoveryId = discoveryData.selectedDiscovery?.discovery_id;
  if (!discoveryId) return;

  try {
    const response = await fetch('/api/discoveries/' + encodeURIComponent(discoveryId) + '/export?path=' + encodeURIComponent(projectPath), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ finding_ids: Array.from(discoveryData.selectedFindings) })
    });

    const result = await response.json();
    if (result.success) {
      // Show detailed message if duplicates were skipped
      const msg = result.skipped_count > 0
        ? `Exported ${result.exported_count} issues, skipped ${result.skipped_count} duplicates`
        : `Exported ${result.exported_count} issues`;
      showNotification('success', msg);
      discoveryData.selectedFindings.clear();
      // Reload discovery data to reflect exported status
      await loadDiscoveryData();
      if (discoveryData.selectedDiscovery) {
        await viewDiscoveryDetail(discoveryData.selectedDiscovery.discovery_id);
      } else {
        renderDiscoveryView();
      }
    } else {
      showNotification('error', result.error || 'Export failed');
    }
  } catch (err) {
    console.error('Export failed:', err);
    showNotification('error', 'Export failed');
  }
}

async function exportSingleFinding(findingId) {
  const discoveryId = discoveryData.selectedDiscovery?.discovery_id;
  if (!discoveryId) return;

  try {
    const response = await fetch('/api/discoveries/' + encodeURIComponent(discoveryId) + '/export?path=' + encodeURIComponent(projectPath), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ finding_ids: [findingId] })
    });

    const result = await response.json();
    if (result.success) {
      showNotification('success', 'Exported 1 issue');
      // Reload discovery data
      await loadDiscoveryData();
      renderDiscoveryView();
    } else {
      showNotification('error', result.error || 'Export failed');
    }
  } catch (err) {
    console.error('Export failed:', err);
    showNotification('error', 'Export failed');
  }
}

async function dismissFinding(findingId) {
  const discoveryId = discoveryData.selectedDiscovery?.discovery_id;
  if (!discoveryId) return;

  try {
    const response = await fetch('/api/discoveries/' + encodeURIComponent(discoveryId) + '/findings/' + encodeURIComponent(findingId) + '?path=' + encodeURIComponent(projectPath), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dismissed: true })
    });

    const result = await response.json();
    if (result.success) {
      // Update local state
      const finding = discoveryData.findings.find(f => f.id === findingId);
      if (finding) {
        finding.dismissed = true;
      }
      if (discoveryData.selectedFinding?.id === findingId) {
        discoveryData.selectedFinding = null;
      }
      renderDiscoveryView();
    }
  } catch (err) {
    console.error('Dismiss failed:', err);
  }
}

async function dismissSelectedFindings() {
  for (const findingId of discoveryData.selectedFindings) {
    await dismissFinding(findingId);
  }
  discoveryData.selectedFindings.clear();
  renderDiscoveryView();
}

async function deleteDiscovery(discoveryId) {
  if (!confirm(`Delete discovery ${discoveryId}? This cannot be undone.`)) return;

  try {
    const response = await fetch('/api/discoveries/' + encodeURIComponent(discoveryId) + '?path=' + encodeURIComponent(projectPath), {
      method: 'DELETE'
    });

    const result = await response.json();
    if (result.success) {
      showNotification('success', 'Discovery deleted');
      await loadDiscoveryData();
      renderDiscoveryView();
    } else {
      showNotification('error', result.error || 'Delete failed');
    }
  } catch (err) {
    console.error('Delete failed:', err);
    showNotification('error', 'Delete failed');
  }
}

// ========== Progress Polling ==========
function startDiscoveryPolling(discoveryId) {
  stopDiscoveryPolling();

  discoveryPollingInterval = setInterval(async () => {
    const progress = await loadDiscoveryProgress(discoveryId);
    if (progress) {
      // Update progress in UI
      if (discoveryData.selectedDiscovery) {
        discoveryData.selectedDiscovery.progress = progress.progress;
        discoveryData.selectedDiscovery.phase = progress.phase;
      }

      // Stop polling if complete
      if (progress.phase === 'complete' || progress.phase === 'failed') {
        stopDiscoveryPolling();
        // Reload full detail
        viewDiscoveryDetail(discoveryId);
      }
    }
  }, 3000); // Poll every 3 seconds
}

function stopDiscoveryPolling() {
  if (discoveryPollingInterval) {
    clearInterval(discoveryPollingInterval);
    discoveryPollingInterval = null;
  }
}

// ========== Utilities ==========
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ========== Cleanup ==========
function cleanupDiscoveryView() {
  stopDiscoveryPolling();
  discoveryData.selectedDiscovery = null;
  discoveryData.selectedFinding = null;
  discoveryData.findings = [];
  discoveryData.selectedFindings.clear();
  discoveryData.viewMode = 'list';
}
