// ==========================================
// ISSUE MANAGER VIEW
// Manages issues, solutions, and execution queue
// ==========================================

// ========== Issue State ==========
var issueData = {
  issues: [],
  queue: { tasks: [], solutions: [], conflicts: [], execution_groups: [], grouped_items: {} },
  selectedIssue: null,
  selectedSolution: null,
  selectedSolutionIssueId: null,
  statusFilter: 'all',
  searchQuery: '',
  viewMode: 'issues' // 'issues' | 'queue'
};
var issueLoading = false;
var issueDragState = {
  dragging: null,
  groupId: null
};

// ========== Main Render Function ==========
async function renderIssueManager() {
  const container = document.getElementById('mainContent');
  if (!container) return;

  // Hide stats grid and search
  hideStatsAndCarousel();

  // Show loading state
  container.innerHTML = '<div class="issue-manager loading">' +
    '<div class="loading-spinner"><i data-lucide="loader-2" class="w-8 h-8 animate-spin"></i></div>' +
    '<p>' + t('common.loading') + '</p>' +
    '</div>';

  // Load data
  await Promise.all([loadIssueData(), loadQueueData()]);

  // Render the main view
  renderIssueView();
}

// ========== Data Loading ==========
async function loadIssueData() {
  issueLoading = true;
  try {
    const response = await fetch('/api/issues?path=' + encodeURIComponent(projectPath));
    if (!response.ok) throw new Error('Failed to load issues');
    const data = await response.json();
    issueData.issues = data.issues || [];
    updateIssueBadge();
  } catch (err) {
    console.error('Failed to load issues:', err);
    issueData.issues = [];
  } finally {
    issueLoading = false;
  }
}

async function loadQueueData() {
  try {
    const response = await fetch('/api/queue?path=' + encodeURIComponent(projectPath));
    if (!response.ok) throw new Error('Failed to load queue');
    issueData.queue = await response.json();
  } catch (err) {
    console.error('Failed to load queue:', err);
    issueData.queue = { tasks: [], solutions: [], conflicts: [], execution_groups: [], grouped_items: {} };
  }
}

async function loadIssueDetail(issueId) {
  try {
    const response = await fetch('/api/issues/' + encodeURIComponent(issueId) + '?path=' + encodeURIComponent(projectPath));
    if (!response.ok) throw new Error('Failed to load issue detail');
    return await response.json();
  } catch (err) {
    console.error('Failed to load issue detail:', err);
    return null;
  }
}

function updateIssueBadge() {
  const badge = document.getElementById('badgeIssues');
  if (badge) {
    badge.textContent = issueData.issues.length;
  }
}

// ========== Main View Render ==========
function renderIssueView() {
  const container = document.getElementById('mainContent');
  if (!container) return;

  const issues = issueData.issues || [];
  // Apply both status and search filters
  let filteredIssues = issueData.statusFilter === 'all'
    ? issues
    : issues.filter(i => i.status === issueData.statusFilter);

  if (issueData.searchQuery) {
    const query = issueData.searchQuery.toLowerCase();
    filteredIssues = filteredIssues.filter(i =>
      i.id.toLowerCase().includes(query) ||
      (i.title && i.title.toLowerCase().includes(query)) ||
      (i.context && i.context.toLowerCase().includes(query))
    );
  }

  container.innerHTML = `
    <div class="issue-manager">
      <!-- Header -->
      <div class="issue-header mb-6">
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <i data-lucide="clipboard-list" class="w-5 h-5 text-primary"></i>
            </div>
            <div>
              <h2 class="text-lg font-semibold text-foreground">${t('issues.title') || 'Issue Manager'}</h2>
              <p class="text-sm text-muted-foreground">${t('issues.description') || 'Manage issues, solutions, and execution queue'}</p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <!-- Create Button -->
            <button class="issue-create-btn" onclick="showCreateIssueModal()">
              <i data-lucide="plus" class="w-4 h-4"></i>
              <span>${t('issues.create') || 'Create'}</span>
            </button>

            <!-- View Toggle -->
            <div class="issue-view-toggle">
              <button class="${issueData.viewMode === 'issues' ? 'active' : ''}" onclick="switchIssueView('issues')">
                <i data-lucide="list" class="w-4 h-4 mr-1"></i>
                ${t('issues.viewIssues') || 'Issues'}
              </button>
              <button class="${issueData.viewMode === 'queue' ? 'active' : ''}" onclick="switchIssueView('queue')">
                <i data-lucide="git-branch" class="w-4 h-4 mr-1"></i>
                ${t('issues.viewQueue') || 'Queue'}
              </button>
            </div>
          </div>
        </div>
      </div>

      ${issueData.viewMode === 'issues' ? renderIssueListSection(filteredIssues) : renderQueueSection()}

      <!-- Detail Panel -->
      <div id="issueDetailPanel" class="issue-detail-panel hidden"></div>

      <!-- Solution Detail Modal -->
      <div id="solutionDetailModal" class="solution-modal hidden">
        <div class="solution-modal-backdrop" onclick="closeSolutionDetail()"></div>
        <div class="solution-modal-content">
          <div class="solution-modal-header">
            <div class="solution-modal-title">
              <span id="solutionDetailId" class="font-mono text-sm text-muted-foreground"></span>
              <h3 id="solutionDetailTitle">${t('issues.solutionDetail') || 'Solution Details'}</h3>
            </div>
            <div class="solution-modal-actions">
              <button id="solutionBindBtn" class="btn-secondary" onclick="toggleSolutionBind()">
                <i data-lucide="link" class="w-4 h-4"></i>
                <span>${t('issues.bind') || 'Bind'}</span>
              </button>
              <button class="btn-icon" onclick="closeSolutionDetail()">
                <i data-lucide="x" class="w-5 h-5"></i>
              </button>
            </div>
          </div>
          <div class="solution-modal-body" id="solutionDetailBody">
            <!-- Content will be rendered dynamically -->
          </div>
        </div>
      </div>

      <!-- Create Issue Modal -->
      <div id="createIssueModal" class="issue-modal hidden">
        <div class="issue-modal-backdrop" onclick="hideCreateIssueModal()"></div>
        <div class="issue-modal-content">
          <div class="issue-modal-header">
            <h3>${t('issues.createTitle') || 'Create New Issue'}</h3>
            <button class="btn-icon" onclick="hideCreateIssueModal()">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>
          <div class="issue-modal-body">
            <div class="form-group">
              <label>${t('issues.issueId') || 'Issue ID'}</label>
              <div class="input-with-action">
                <input type="text" id="newIssueId" placeholder="${t('issues.idAutoGenerated') || 'Auto-generated'}" />
                <button type="button" class="btn-icon" onclick="regenerateIssueId()" title="${t('issues.regenerateId') || 'Regenerate ID'}">
                  <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                </button>
              </div>
            </div>
            <div class="form-group">
              <label>${t('issues.issueTitle') || 'Title'}</label>
              <input type="text" id="newIssueTitle" placeholder="${t('issues.titlePlaceholder') || 'Brief description of the issue'}" />
            </div>
            <div class="form-group">
              <label>${t('issues.issueContext') || 'Context'} (${t('common.optional') || 'optional'})</label>
              <textarea id="newIssueContext" rows="4" placeholder="${t('issues.contextPlaceholder') || 'Detailed description, requirements, etc.'}"></textarea>
            </div>
            <div class="form-group">
              <label>${t('issues.issuePriority') || 'Priority'}</label>
              <select id="newIssuePriority">
                <option value="1">1 - ${t('issues.priorityLowest') || 'Lowest'}</option>
                <option value="2">2 - ${t('issues.priorityLow') || 'Low'}</option>
                <option value="3" selected>3 - ${t('issues.priorityMedium') || 'Medium'}</option>
                <option value="4">4 - ${t('issues.priorityHigh') || 'High'}</option>
                <option value="5">5 - ${t('issues.priorityCritical') || 'Critical'}</option>
              </select>
            </div>
          </div>
          <div class="issue-modal-footer">
            <button class="btn-secondary" onclick="hideCreateIssueModal()">${t('common.cancel') || 'Cancel'}</button>
            <button class="btn-primary" onclick="createIssue()">${t('issues.create') || 'Create'}</button>
          </div>
        </div>
      </div>
    </div>
  `;

  lucide.createIcons();

  // Initialize drag-drop if in queue view
  if (issueData.viewMode === 'queue') {
    initQueueDragDrop();
  }
}

function switchIssueView(mode) {
  issueData.viewMode = mode;
  renderIssueView();
}

// ========== Issue List Section ==========
function renderIssueListSection(issues) {
  const statuses = ['all', 'registered', 'planning', 'planned', 'queued', 'executing', 'completed', 'failed'];
  const totalIssues = issueData.issues?.length || 0;

  return `
    <!-- Toolbar: Search + Filters -->
    <div class="issue-toolbar mb-4">
      <div class="issue-search">
        <i data-lucide="search" class="w-4 h-4"></i>
        <input type="text"
               id="issueSearchInput"
               placeholder="${t('issues.searchPlaceholder') || 'Search issues...'}"
               value="${issueData.searchQuery}"
               oninput="handleIssueSearch(this.value)" />
        ${issueData.searchQuery ? `
          <button class="issue-search-clear" onclick="clearIssueSearch()">
            <i data-lucide="x" class="w-3 h-3"></i>
          </button>
        ` : ''}
      </div>

      <div class="issue-filters">
        <span class="text-sm text-muted-foreground">${t('issues.filterStatus') || 'Status'}:</span>
        ${statuses.map(status => `
          <button class="issue-filter-btn ${issueData.statusFilter === status ? 'active' : ''}"
                  onclick="filterIssuesByStatus('${status}')">
            ${status === 'all' ? (t('issues.filterAll') || 'All') : status}
          </button>
        `).join('')}
      </div>
    </div>

    <!-- Issues Stats -->
    <div class="issue-stats mb-4">
      <span class="text-sm text-muted-foreground">
        ${t('issues.showing') || 'Showing'} <strong>${issues.length}</strong> ${t('issues.of') || 'of'} <strong>${totalIssues}</strong> ${t('issues.issues') || 'issues'}
      </span>
    </div>

    <!-- Issues Grid -->
    <div class="issues-grid">
      ${issues.length === 0 ? `
        <div class="issue-empty-container">
          <div class="issue-empty">
            <i data-lucide="inbox" class="w-16 h-16"></i>
            <p class="issue-empty-title">${t('issues.noIssues') || 'No issues found'}</p>
            <p class="issue-empty-hint">${issueData.searchQuery || issueData.statusFilter !== 'all'
              ? (t('issues.tryDifferentFilter') || 'Try adjusting your search or filters')
              : (t('issues.createHint') || 'Click "Create" to add your first issue')}</p>
            ${!issueData.searchQuery && issueData.statusFilter === 'all' ? `
              <button class="issue-empty-btn" onclick="showCreateIssueModal()">
                <i data-lucide="plus" class="w-4 h-4"></i>
                ${t('issues.createFirst') || 'Create First Issue'}
              </button>
            ` : ''}
          </div>
        </div>
      ` : issues.map(issue => renderIssueCard(issue)).join('')}
    </div>
  `;
}

function renderIssueCard(issue) {
  const statusColors = {
    registered: 'registered',
    planning: 'planning',
    planned: 'planned',
    queued: 'queued',
    executing: 'executing',
    completed: 'completed',
    failed: 'failed'
  };

  return `
    <div class="issue-card" onclick="openIssueDetail('${issue.id}')">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="issue-id font-mono text-sm">${issue.id}</span>
          <span class="issue-status ${statusColors[issue.status] || ''}">${issue.status || 'unknown'}</span>
        </div>
        <span class="issue-priority" title="${t('issues.priority') || 'Priority'}: ${issue.priority || 3}">
          ${renderPriorityStars(issue.priority || 3)}
        </span>
      </div>

      <h3 class="issue-title text-foreground font-medium mb-2">${issue.title || issue.id}</h3>

      <div class="issue-meta flex items-center gap-4 text-sm text-muted-foreground">
        <span class="flex items-center gap-1">
          <i data-lucide="file-text" class="w-3.5 h-3.5"></i>
          ${issue.task_count || 0} ${t('issues.tasks') || 'tasks'}
        </span>
        <span class="flex items-center gap-1">
          <i data-lucide="lightbulb" class="w-3.5 h-3.5"></i>
          ${issue.solution_count || 0} ${t('issues.solutions') || 'solutions'}
        </span>
        ${issue.bound_solution_id ? `
          <span class="flex items-center gap-1 text-primary">
            <i data-lucide="link" class="w-3.5 h-3.5"></i>
            ${t('issues.boundSolution') || 'Bound'}
          </span>
        ` : ''}
        ${issue.github_url ? `
          <a href="${issue.github_url}" target="_blank" rel="noopener noreferrer"
             class="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
             onclick="event.stopPropagation()" title="View on GitHub">
            <i data-lucide="github" class="w-3.5 h-3.5"></i>
            ${issue.github_number ? `#${issue.github_number}` : 'GitHub'}
          </a>
        ` : ''}
      </div>
    </div>
  `;
}

function renderPriorityStars(priority) {
  const maxStars = 5;
  let stars = '';
  for (let i = 1; i <= maxStars; i++) {
    stars += `<i data-lucide="star" class="w-3 h-3 ${i <= priority ? 'text-warning fill-warning' : 'text-muted'}"></i>`;
  }
  return stars;
}

function filterIssuesByStatus(status) {
  issueData.statusFilter = status;
  renderIssueView();
}

// ========== Queue Section ==========
function renderQueueSection() {
  const queue = issueData.queue;
  // Support both solution-level and task-level queues
  const queueItems = queue.solutions || queue.tasks || [];
  const isSolutionLevel = !!(queue.solutions && queue.solutions.length > 0);
  const metadata = queue._metadata || {};

  // Check if queue is empty
  if (queueItems.length === 0) {
    return `
      <div class="queue-empty-container">
        <div class="queue-empty-toolbar">
          <button class="btn-secondary" onclick="showQueueHistoryModal()" title="${t('issues.queueHistory') || 'Queue History'}">
            <i data-lucide="history" class="w-4 h-4"></i>
            <span>${t('issues.history') || 'History'}</span>
          </button>
        </div>
        <div class="queue-empty">
          <i data-lucide="git-branch" class="w-16 h-16"></i>
          <p class="queue-empty-title">${t('issues.queueEmpty') || 'Queue is empty'}</p>
          <p class="queue-empty-hint">${t('issues.queueEmptyHint') || 'Generate execution queue from bound solutions'}</p>
          <button class="queue-create-btn" onclick="createExecutionQueue()">
            <i data-lucide="play" class="w-4 h-4"></i>
            <span>${t('issues.createQueue') || 'Create Queue'}</span>
          </button>
        </div>
      </div>
    `;
  }

  // Group items by execution_group or treat all as single group
  const groups = queue.execution_groups || [];
  let groupedItems = queue.grouped_items || {};

  // If no execution_groups, create a default grouping from queue items
  if (groups.length === 0 && queueItems.length > 0) {
    const groupMap = {};
    queueItems.forEach(item => {
      const groupId = item.execution_group || 'default';
      if (!groupMap[groupId]) {
        groupMap[groupId] = [];
      }
      groupMap[groupId].push(item);
    });

    // Create synthetic groups
    const syntheticGroups = Object.keys(groupMap).map(groupId => ({
      id: groupId,
      type: 'sequential',
      task_count: groupMap[groupId].length
    }));

    return `
      <!-- Queue Header -->
      <div class="queue-toolbar mb-4">
        <div class="queue-stats">
          <div class="queue-info-card">
            <span class="queue-info-label">${t('issues.queueId') || 'Queue ID'}</span>
            <span class="queue-info-value font-mono text-sm">${queue.id || 'N/A'}</span>
          </div>
          <div class="queue-info-card">
            <span class="queue-info-label">${t('issues.status') || 'Status'}</span>
            <span class="queue-status-badge ${queue.status || ''}">${queue.status || 'unknown'}</span>
          </div>
          <div class="queue-info-card">
            <span class="queue-info-label">${t('issues.issues') || 'Issues'}</span>
            <span class="queue-info-value">${(queue.issue_ids || []).join(', ') || 'N/A'}</span>
          </div>
        </div>
        <div class="queue-actions">
          <button class="btn-secondary" onclick="refreshQueue()" title="${t('issues.refreshQueue') || 'Refresh'}">
            <i data-lucide="refresh-cw" class="w-4 h-4"></i>
          </button>
          <button class="btn-secondary" onclick="showQueueHistoryModal()" title="${t('issues.queueHistory') || 'Queue History'}">
            <i data-lucide="history" class="w-4 h-4"></i>
            <span>${t('issues.history') || 'History'}</span>
          </button>
          <button class="btn-secondary" onclick="createExecutionQueue()" title="${t('issues.regenerateQueue') || 'Regenerate Queue'}">
            <i data-lucide="rotate-cw" class="w-4 h-4"></i>
            <span>${t('issues.regenerate') || 'Regenerate'}</span>
          </button>
        </div>
      </div>

      <!-- Queue Stats -->
      <div class="queue-stats-grid mb-4">
        <div class="queue-stat-card">
          <span class="queue-stat-value">${isSolutionLevel ? (metadata.total_solutions || queueItems.length) : (metadata.total_tasks || queueItems.length)}</span>
          <span class="queue-stat-label">${isSolutionLevel ? (t('issues.totalSolutions') || 'Solutions') : (t('issues.totalTasks') || 'Total')}</span>
        </div>
        <div class="queue-stat-card pending">
          <span class="queue-stat-value">${metadata.pending_count || queueItems.filter(i => i.status === 'pending').length}</span>
          <span class="queue-stat-label">${t('issues.pending') || 'Pending'}</span>
        </div>
        <div class="queue-stat-card executing">
          <span class="queue-stat-value">${metadata.executing_count || queueItems.filter(i => i.status === 'executing').length}</span>
          <span class="queue-stat-label">${t('issues.executing') || 'Executing'}</span>
        </div>
        <div class="queue-stat-card completed">
          <span class="queue-stat-value">${metadata.completed_count || queueItems.filter(i => i.status === 'completed').length}</span>
          <span class="queue-stat-label">${t('issues.completed') || 'Completed'}</span>
        </div>
        <div class="queue-stat-card failed">
          <span class="queue-stat-value">${metadata.failed_count || queueItems.filter(i => i.status === 'failed').length}</span>
          <span class="queue-stat-label">${t('issues.failed') || 'Failed'}</span>
        </div>
      </div>

      <!-- Queue Items -->
      <div class="queue-timeline">
        ${syntheticGroups.map(group => renderQueueGroup(group, groupMap[group.id] || [])).join('')}
      </div>

      ${queue.conflicts && queue.conflicts.length > 0 ? renderConflictsSection(queue.conflicts) : ''}
    `;
  }

  return `
    <!-- Queue Toolbar -->
    <div class="queue-toolbar mb-4">
      <div class="queue-stats">
        <span class="text-sm text-muted-foreground">
          ${groups.length} ${t('issues.executionGroups') || 'groups'} ·
          ${queueItems.length} ${t('issues.totalItems') || 'items'}
        </span>
      </div>
      <div class="queue-actions">
        <button class="btn-secondary" onclick="refreshQueue()" title="${t('issues.refreshQueue') || 'Refresh'}">
          <i data-lucide="refresh-cw" class="w-4 h-4"></i>
        </button>
        <button class="btn-secondary" onclick="createExecutionQueue()" title="${t('issues.regenerateQueue') || 'Regenerate Queue'}">
          <i data-lucide="rotate-cw" class="w-4 h-4"></i>
          <span>${t('issues.regenerate') || 'Regenerate'}</span>
        </button>
      </div>
    </div>

    <div class="queue-info mb-4">
      <p class="text-sm text-muted-foreground">
        <i data-lucide="info" class="w-4 h-4 inline mr-1"></i>
        ${t('issues.reorderHint') || 'Drag items within a group to reorder'}
      </p>
    </div>

    <div class="queue-timeline">
      ${groups.map(group => renderQueueGroup(group, groupedItems[group.id] || [])).join('')}
    </div>

    ${queue.conflicts && queue.conflicts.length > 0 ? renderConflictsSection(queue.conflicts) : ''}
  `;
}

function renderQueueGroup(group, items) {
  const isParallel = group.type === 'parallel';
  // Support both solution-level (solution_count) and task-level (task_count)
  const itemCount = group.solution_count || group.task_count || items.length;
  const itemLabel = group.solution_count ? 'solutions' : 'tasks';

  return `
    <div class="queue-group" data-group-id="${group.id}">
      <div class="queue-group-header">
        <div class="queue-group-type ${isParallel ? 'parallel' : 'sequential'}">
          <i data-lucide="${isParallel ? 'git-merge' : 'arrow-right'}" class="w-4 h-4"></i>
          ${group.id} (${isParallel ? t('issues.parallelGroup') || 'Parallel' : t('issues.sequentialGroup') || 'Sequential'})
        </div>
        <span class="text-sm text-muted-foreground">${itemCount} ${itemLabel}</span>
      </div>
      <div class="queue-items ${isParallel ? 'parallel' : 'sequential'}">
        ${items.map((item, idx) => renderQueueItem(item, idx, items.length)).join('')}
      </div>
    </div>
  `;
}

function renderQueueItem(item, index, total) {
  const statusColors = {
    pending: '',
    ready: 'ready',
    executing: 'executing',
    completed: 'completed',
    failed: 'failed',
    blocked: 'blocked'
  };

  // Check if this is a solution-level item (has task_count) or task-level (has task_id)
  const isSolutionItem = item.task_count !== undefined;

  return `
    <div class="queue-item ${statusColors[item.status] || ''}"
         draggable="true"
         data-item-id="${item.item_id}"
         data-group-id="${item.execution_group}"
         onclick="openQueueItemDetail('${item.item_id}')">
      <span class="queue-item-id font-mono text-xs">${item.item_id}</span>
      <span class="queue-item-issue text-xs text-muted-foreground">${item.issue_id}</span>
      ${isSolutionItem ? `
        <span class="queue-item-solution text-sm" title="${item.solution_id || ''}">
          <i data-lucide="package" class="w-3 h-3 inline mr-1"></i>
          ${item.task_count} ${t('issues.tasks') || 'tasks'}
        </span>
        ${item.files_touched && item.files_touched.length > 0 ? `
          <span class="queue-item-files text-xs text-muted-foreground" title="${item.files_touched.join(', ')}">
            <i data-lucide="file" class="w-3 h-3"></i>
            ${item.files_touched.length}
          </span>
        ` : ''}
      ` : `
        <span class="queue-item-task text-sm">${item.task_id || '-'}</span>
      `}
      <span class="queue-item-priority" style="opacity: ${item.semantic_priority || 0.5}">
        <i data-lucide="arrow-up" class="w-3 h-3"></i>
      </span>
      ${item.depends_on && item.depends_on.length > 0 ? `
        <span class="queue-item-deps text-xs text-muted-foreground" title="${t('issues.dependsOn') || 'Depends on'}: ${item.depends_on.join(', ')}">
          <i data-lucide="link" class="w-3 h-3"></i>
        </span>
      ` : ''}
    </div>
  `;
}

function renderConflictsSection(conflicts) {
  return `
    <div class="conflicts-section mt-6">
      <h3 class="text-sm font-semibold text-foreground mb-3">
        <i data-lucide="alert-triangle" class="w-4 h-4 inline text-warning mr-1"></i>
        Conflicts (${conflicts.length})
      </h3>
      <div class="conflicts-list">
        ${conflicts.map(c => `
          <div class="conflict-item">
            <span class="conflict-file font-mono text-xs">${c.file}</span>
            <span class="conflict-items text-xs text-muted-foreground">${(c.solutions || c.tasks || []).join(' → ')}</span>
            ${c.rationale ? `<span class="conflict-rationale text-xs text-muted-foreground" title="${c.rationale}">
              <i data-lucide="info" class="w-3 h-3"></i>
            </span>` : ''}
            <span class="conflict-status ${c.resolved || c.resolution ? 'resolved' : 'pending'}">
              ${c.resolved || c.resolution ? 'Resolved' : 'Pending'}
            </span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ========== Drag-Drop for Queue ==========
function initQueueDragDrop() {
  const items = document.querySelectorAll('.queue-item[draggable="true"]');

  items.forEach(item => {
    item.addEventListener('dragstart', handleIssueDragStart);
    item.addEventListener('dragend', handleIssueDragEnd);
    item.addEventListener('dragover', handleIssueDragOver);
    item.addEventListener('drop', handleIssueDrop);
  });
}

function handleIssueDragStart(e) {
  const item = e.target.closest('.queue-item');
  if (!item) return;

  issueDragState.dragging = item.dataset.itemId;
  issueDragState.groupId = item.dataset.groupId;

  item.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', item.dataset.itemId);
}

function handleIssueDragEnd(e) {
  const item = e.target.closest('.queue-item');
  if (item) {
    item.classList.remove('dragging');
  }
  issueDragState.dragging = null;
  issueDragState.groupId = null;

  // Remove all placeholders
  document.querySelectorAll('.queue-drop-placeholder').forEach(p => p.remove());
}

function handleIssueDragOver(e) {
  e.preventDefault();

  const target = e.target.closest('.queue-item');
  if (!target || target.dataset.itemId === issueDragState.dragging) return;

  // Only allow drag within same group
  if (target.dataset.groupId !== issueDragState.groupId) {
    e.dataTransfer.dropEffect = 'none';
    return;
  }

  e.dataTransfer.dropEffect = 'move';
}

function handleIssueDrop(e) {
  e.preventDefault();

  const target = e.target.closest('.queue-item');
  if (!target || !issueDragState.dragging) return;

  // Only allow drop within same group
  if (target.dataset.groupId !== issueDragState.groupId) return;

  const container = target.closest('.queue-items');
  if (!container) return;

  // Get new order
  const items = Array.from(container.querySelectorAll('.queue-item'));
  const draggedItem = items.find(i => i.dataset.itemId === issueDragState.dragging);
  const targetIndex = items.indexOf(target);
  const draggedIndex = items.indexOf(draggedItem);

  if (draggedIndex === targetIndex) return;

  // Reorder in DOM
  if (draggedIndex < targetIndex) {
    target.after(draggedItem);
  } else {
    target.before(draggedItem);
  }

  // Get new order and save
  const newOrder = Array.from(container.querySelectorAll('.queue-item')).map(i => i.dataset.itemId);
  saveQueueOrder(issueDragState.groupId, newOrder);
}

async function saveQueueOrder(groupId, newOrder) {
  try {
    const response = await fetch('/api/queue/reorder?path=' + encodeURIComponent(projectPath), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, newOrder })
    });

    if (!response.ok) {
      throw new Error('Failed to save queue order');
    }

    const result = await response.json();
    if (result.error) {
      showNotification(result.error, 'error');
    } else {
      showNotification('Queue reordered', 'success');
      // Reload queue data
      await loadQueueData();
    }
  } catch (err) {
    console.error('Failed to save queue order:', err);
    showNotification('Failed to save queue order', 'error');
    // Reload to restore original order
    await loadQueueData();
    renderIssueView();
  }
}

// ========== Detail Panel ==========
async function openIssueDetail(issueId) {
  const panel = document.getElementById('issueDetailPanel');
  if (!panel) return;

  panel.innerHTML = '<div class="p-8 text-center"><i data-lucide="loader-2" class="w-8 h-8 animate-spin mx-auto"></i></div>';
  panel.classList.remove('hidden');
  lucide.createIcons();

  const detail = await loadIssueDetail(issueId);
  if (!detail) {
    panel.innerHTML = '<div class="p-8 text-center text-destructive">Failed to load issue</div>';
    return;
  }

  issueData.selectedIssue = detail;
  renderIssueDetailPanel(detail);
}

function renderIssueDetailPanel(issue) {
  const panel = document.getElementById('issueDetailPanel');
  if (!panel) return;

  const boundSolution = issue.solutions?.find(s => s.is_bound);

  panel.innerHTML = `
    <div class="issue-detail-header">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold">${issue.id}</h3>
        <button class="btn-icon" onclick="closeIssueDetail()">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      <span class="issue-status ${issue.status || ''}">${issue.status || 'unknown'}</span>
    </div>

    <div class="issue-detail-content">
      <!-- Title (editable) -->
      <div class="detail-section">
        <label class="detail-label">Title</label>
        <div class="detail-editable" id="issueTitle">
          <span class="detail-value">${issue.title || issue.id}</span>
          <button class="btn-edit" onclick="startEditField('${issue.id}', 'title', '${(issue.title || issue.id).replace(/'/g, "\\'")}')">
            <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>

      <!-- Context (editable) -->
      <div class="detail-section">
        <label class="detail-label">Context</label>
        <div class="detail-context" id="issueContext">
          <pre class="detail-pre">${issue.context || 'No context'}</pre>
          <button class="btn-edit" onclick="startEditContext('${issue.id}')">
            <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>

      <!-- Solutions -->
      <div class="detail-section">
        <label class="detail-label">${t('issues.solutions') || 'Solutions'} (${issue.solutions?.length || 0})</label>
        <div class="solutions-list">
          ${(issue.solutions || []).length > 0 ? (issue.solutions || []).map(sol => `
            <div class="solution-item ${sol.is_bound ? 'bound' : ''}" onclick="openSolutionDetail('${issue.id}', '${sol.id}')">
              <div class="solution-header">
                <span class="solution-id font-mono text-xs">${sol.id}</span>
                ${sol.is_bound ? '<span class="solution-bound-badge">' + (t('issues.bound') || 'Bound') + '</span>' : ''}
                <span class="solution-tasks text-xs">${sol.tasks?.length || 0} ${t('issues.tasks') || 'tasks'}</span>
                <i data-lucide="chevron-right" class="w-4 h-4 ml-auto text-muted-foreground"></i>
              </div>
            </div>
          `).join('') : '<p class="text-sm text-muted-foreground">' + (t('issues.noSolutions') || 'No solutions') + '</p>'}
        </div>
      </div>

      <!-- Tasks (from tasks.jsonl) -->
      <div class="detail-section">
        <label class="detail-label">${t('issues.tasks') || 'Tasks'} (${issue.tasks?.length || 0})</label>
        <div class="tasks-list">
          ${(issue.tasks || []).length > 0 ? (issue.tasks || []).map(task => `
            <div class="task-item-detail">
              <div class="flex items-center justify-between">
                <span class="font-mono text-sm">${task.id}</span>
                <select class="task-status-select" onchange="updateTaskStatus('${issue.id}', '${task.id}', this.value)">
                  ${['pending', 'ready', 'executing', 'completed', 'failed', 'blocked', 'paused', 'skipped'].map(s =>
                    `<option value="${s}" ${task.status === s ? 'selected' : ''}>${s}</option>`
                  ).join('')}
                </select>
              </div>
              <p class="task-title-detail">${task.title || task.description || ''}</p>
            </div>
          `).join('') : '<p class="text-sm text-muted-foreground">' + (t('issues.noTasks') || 'No tasks') + '</p>'}
        </div>
      </div>
    </div>
  `;

  lucide.createIcons();
}

function closeIssueDetail() {
  const panel = document.getElementById('issueDetailPanel');
  if (panel) {
    panel.classList.add('hidden');
  }
  issueData.selectedIssue = null;
}

function toggleSolutionExpand(solId) {
  const el = document.getElementById('solution-' + solId);
  if (el) {
    el.classList.toggle('hidden');
  }
}

// ========== Solution Detail Modal ==========
function openSolutionDetail(issueId, solutionId) {
  const issue = issueData.selectedIssue || issueData.issues.find(i => i.id === issueId);
  if (!issue) return;

  const solution = issue.solutions?.find(s => s.id === solutionId);
  if (!solution) return;

  issueData.selectedSolution = solution;
  issueData.selectedSolutionIssueId = issueId;

  const modal = document.getElementById('solutionDetailModal');
  if (modal) {
    modal.classList.remove('hidden');
    renderSolutionDetail(solution);
    lucide.createIcons();
  }
}

function closeSolutionDetail() {
  const modal = document.getElementById('solutionDetailModal');
  if (modal) {
    modal.classList.add('hidden');
  }
  issueData.selectedSolution = null;
  issueData.selectedSolutionIssueId = null;
}

function renderSolutionDetail(solution) {
  const idEl = document.getElementById('solutionDetailId');
  const bodyEl = document.getElementById('solutionDetailBody');
  const bindBtn = document.getElementById('solutionBindBtn');

  if (idEl) {
    idEl.textContent = solution.id;
  }

  // Update bind button state
  if (bindBtn) {
    if (solution.is_bound) {
      bindBtn.innerHTML = `<i data-lucide="unlink" class="w-4 h-4"></i><span>${t('issues.unbind') || 'Unbind'}</span>`;
      bindBtn.classList.remove('btn-secondary');
      bindBtn.classList.add('btn-primary');
    } else {
      bindBtn.innerHTML = `<i data-lucide="link" class="w-4 h-4"></i><span>${t('issues.bind') || 'Bind'}</span>`;
      bindBtn.classList.remove('btn-primary');
      bindBtn.classList.add('btn-secondary');
    }
  }

  if (!bodyEl) return;

  const tasks = solution.tasks || [];

  bodyEl.innerHTML = `
    <!-- Solution Overview -->
    <div class="solution-detail-section">
      <div class="solution-overview">
        <div class="solution-stat">
          <span class="solution-stat-value">${tasks.length}</span>
          <span class="solution-stat-label">${t('issues.totalTasks') || 'Total Tasks'}</span>
        </div>
        <div class="solution-stat">
          <span class="solution-stat-value">${solution.is_bound ? '✓' : '—'}</span>
          <span class="solution-stat-label">${t('issues.bindStatus') || 'Bind Status'}</span>
        </div>
        <div class="solution-stat">
          <span class="solution-stat-value">${solution.created_at ? new Date(solution.created_at).toLocaleDateString() : '—'}</span>
          <span class="solution-stat-label">${t('issues.createdAt') || 'Created'}</span>
        </div>
      </div>
    </div>

    <!-- Tasks List -->
    <div class="solution-detail-section">
      <h4 class="solution-detail-section-title">
        <i data-lucide="list-checks" class="w-4 h-4"></i>
        ${t('issues.taskList') || 'Task List'}
      </h4>
      <div class="solution-tasks-detail">
        ${tasks.length === 0 ? `
          <p class="text-sm text-muted-foreground text-center py-4">${t('issues.noTasks') || 'No tasks in this solution'}</p>
        ` : tasks.map((task, index) => renderSolutionTask(task, index)).join('')}
      </div>
    </div>

    <!-- Raw JSON (collapsible) -->
    <div class="solution-detail-section">
      <button class="solution-json-toggle" onclick="toggleSolutionJson()">
        <i data-lucide="code" class="w-4 h-4"></i>
        <span>${t('issues.viewJson') || 'View Raw JSON'}</span>
        <i data-lucide="chevron-down" class="w-4 h-4 ml-auto"></i>
      </button>
      <div id="solutionJsonContent" class="solution-json-content hidden">
        <pre class="solution-json-pre">${escapeHtml(JSON.stringify(solution, null, 2))}</pre>
      </div>
    </div>
  `;

  lucide.createIcons();
}

function renderSolutionTask(task, index) {
  const actionClass = (task.action || 'unknown').toLowerCase();
  const modPoints = task.modification_points || [];
  // Support both old and new field names
  const implSteps = task.implementation || task.implementation_steps || [];
  const acceptance = task.acceptance || task.acceptance_criteria || [];
  const testInfo = task.test || {};
  const regression = task.regression || [];
  const commitInfo = task.commit || {};
  const dependsOn = task.depends_on || task.dependencies || [];

  // Handle acceptance as object or array
  const acceptanceCriteria = Array.isArray(acceptance) ? acceptance : (acceptance.criteria || []);
  const acceptanceVerification = acceptance.verification || [];

  return `
    <div class="solution-task-card">
      <div class="solution-task-header" onclick="toggleTaskExpand(${index})">
        <div class="solution-task-info">
          <span class="solution-task-index">#${index + 1}</span>
          <span class="solution-task-id font-mono">${task.id || ''}</span>
          <span class="task-action-badge ${actionClass}">${task.action || 'Unknown'}</span>
        </div>
        <i data-lucide="chevron-down" class="w-4 h-4 task-expand-icon" id="taskExpandIcon${index}"></i>
      </div>
      <div class="solution-task-title">${task.title || task.description || 'No title'}</div>

      <div class="solution-task-details hidden" id="taskDetails${index}">
        ${task.scope ? `
          <div class="solution-task-scope">
            <span class="solution-task-scope-label">${t('issues.scope') || 'Scope'}:</span>
            <span class="font-mono text-sm">${task.scope}</span>
          </div>
        ` : ''}

        <!-- Phase 1: Implementation -->
        ${implSteps.length > 0 ? `
          <div class="solution-task-section">
            <h5 class="solution-task-subtitle">
              <i data-lucide="code" class="w-3.5 h-3.5"></i>
              <span class="phase-badge phase-1">1</span>
              ${t('issues.implementation') || 'Implementation'}
            </h5>
            <ol class="solution-impl-list">
              ${implSteps.map(step => `<li>${typeof step === 'string' ? step : step.description || JSON.stringify(step)}</li>`).join('')}
            </ol>
          </div>
        ` : ''}

        ${modPoints.length > 0 ? `
          <div class="solution-task-section">
            <h5 class="solution-task-subtitle">
              <i data-lucide="file-edit" class="w-3.5 h-3.5"></i>
              ${t('issues.modificationPoints') || 'Modification Points'}
            </h5>
            <ul class="solution-task-list">
              ${modPoints.map(mp => `
                <li class="solution-mod-point">
                  <span class="mod-point-file font-mono">${mp.file || mp}</span>
                  ${mp.target ? `<span class="mod-point-target">→ ${mp.target}</span>` : ''}
                  ${mp.change ? `<span class="mod-point-change">${mp.change}</span>` : ''}
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}

        <!-- Phase 2: Test -->
        ${(testInfo.unit?.length > 0 || testInfo.commands?.length > 0) ? `
          <div class="solution-task-section">
            <h5 class="solution-task-subtitle">
              <i data-lucide="flask-conical" class="w-3.5 h-3.5"></i>
              <span class="phase-badge phase-2">2</span>
              ${t('issues.test') || 'Test'}
              ${testInfo.coverage_target ? `<span class="coverage-target">(${testInfo.coverage_target}% coverage)</span>` : ''}
            </h5>
            ${testInfo.unit?.length > 0 ? `
              <div class="test-subsection">
                <span class="test-label">${t('issues.unitTests') || 'Unit Tests'}:</span>
                <ul class="test-list">
                  ${testInfo.unit.map(t => `<li>${t}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            ${testInfo.integration?.length > 0 ? `
              <div class="test-subsection">
                <span class="test-label">${t('issues.integrationTests') || 'Integration'}:</span>
                <ul class="test-list">
                  ${testInfo.integration.map(t => `<li>${t}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
            ${testInfo.commands?.length > 0 ? `
              <div class="test-subsection">
                <span class="test-label">${t('issues.commands') || 'Commands'}:</span>
                <div class="test-commands">
                  ${testInfo.commands.map(cmd => `<code class="test-command">${cmd}</code>`).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Phase 3: Regression -->
        ${regression.length > 0 ? `
          <div class="solution-task-section">
            <h5 class="solution-task-subtitle">
              <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
              <span class="phase-badge phase-3">3</span>
              ${t('issues.regression') || 'Regression'}
            </h5>
            <div class="test-commands">
              ${regression.map(cmd => `<code class="test-command">${cmd}</code>`).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Phase 4: Acceptance -->
        ${acceptanceCriteria.length > 0 ? `
          <div class="solution-task-section">
            <h5 class="solution-task-subtitle">
              <i data-lucide="check-circle" class="w-3.5 h-3.5"></i>
              <span class="phase-badge phase-4">4</span>
              ${t('issues.acceptance') || 'Acceptance'}
            </h5>
            <div class="acceptance-subsection">
              <span class="acceptance-label">${t('issues.criteria') || 'Criteria'}:</span>
              <ul class="solution-acceptance-list">
                ${acceptanceCriteria.map(ac => `<li>${typeof ac === 'string' ? ac : ac.description || JSON.stringify(ac)}</li>`).join('')}
              </ul>
            </div>
            ${acceptanceVerification.length > 0 ? `
              <div class="acceptance-subsection">
                <span class="acceptance-label">${t('issues.verification') || 'Verification'}:</span>
                <div class="verification-commands">
                  ${acceptanceVerification.map(v => `<code class="verification-command">${v}</code>`).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Phase 5: Commit -->
        ${commitInfo.type ? `
          <div class="solution-task-section">
            <h5 class="solution-task-subtitle">
              <i data-lucide="git-commit" class="w-3.5 h-3.5"></i>
              <span class="phase-badge phase-5">5</span>
              ${t('issues.commit') || 'Commit'}
            </h5>
            <div class="commit-info">
              <div class="commit-type">
                <span class="commit-type-badge ${commitInfo.type}">${commitInfo.type}</span>
                <span class="commit-scope">(${commitInfo.scope || 'core'})</span>
                ${commitInfo.breaking ? '<span class="commit-breaking">BREAKING</span>' : ''}
              </div>
              ${commitInfo.message_template ? `
                <pre class="commit-message">${commitInfo.message_template}</pre>
              ` : ''}
            </div>
          </div>
        ` : ''}

        <!-- Dependencies -->
        ${dependsOn.length > 0 ? `
          <div class="solution-task-section">
            <h5 class="solution-task-subtitle">
              <i data-lucide="git-branch" class="w-3.5 h-3.5"></i>
              ${t('issues.dependencies') || 'Dependencies'}
            </h5>
            <div class="solution-deps-list">
              ${dependsOn.map(dep => `<span class="solution-dep-tag font-mono">${dep}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function toggleTaskExpand(index) {
  const details = document.getElementById('taskDetails' + index);
  const icon = document.getElementById('taskExpandIcon' + index);
  if (details) {
    details.classList.toggle('hidden');
  }
  if (icon) {
    icon.style.transform = details?.classList.contains('hidden') ? '' : 'rotate(180deg)';
  }
}

function toggleSolutionJson() {
  const content = document.getElementById('solutionJsonContent');
  if (content) {
    content.classList.toggle('hidden');
  }
}

async function toggleSolutionBind() {
  const solution = issueData.selectedSolution;
  const issueId = issueData.selectedSolutionIssueId;
  if (!solution || !issueId) return;

  const action = solution.is_bound ? 'unbind' : 'bind';

  try {
    const response = await fetch('/api/issues/' + encodeURIComponent(issueId) + '?path=' + encodeURIComponent(projectPath), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bound_solution_id: action === 'bind' ? solution.id : null
      })
    });

    if (!response.ok) throw new Error('Failed to ' + action);

    showNotification(action === 'bind' ? (t('issues.solutionBound') || 'Solution bound') : (t('issues.solutionUnbound') || 'Solution unbound'), 'success');

    // Refresh data
    await loadIssueData();
    const detail = await loadIssueDetail(issueId);
    if (detail) {
      issueData.selectedIssue = detail;
      // Update solution reference
      const updatedSolution = detail.solutions?.find(s => s.id === solution.id);
      if (updatedSolution) {
        issueData.selectedSolution = updatedSolution;
        renderSolutionDetail(updatedSolution);
      }
      renderIssueDetailPanel(detail);
    }
  } catch (err) {
    console.error('Failed to ' + action + ' solution:', err);
    showNotification('Failed to ' + action + ' solution', 'error');
  }
}

// Helper: escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function openQueueItemDetail(itemId) {
  // Support both solution-level and task-level queues
  const items = issueData.queue.solutions || issueData.queue.tasks || [];
  const item = items.find(q => q.item_id === itemId);
  if (item) {
    openIssueDetail(item.issue_id);
  }
}

// ========== Edit Functions ==========
function startEditField(issueId, field, currentValue) {
  const container = document.getElementById('issueTitle');
  if (!container) return;

  container.innerHTML = `
    <input type="text" class="edit-input" id="editField" value="${currentValue}" />
    <div class="edit-actions">
      <button class="btn-save" onclick="saveFieldEdit('${issueId}', '${field}')">
        <i data-lucide="check" class="w-4 h-4"></i>
      </button>
      <button class="btn-cancel" onclick="cancelEdit()">
        <i data-lucide="x" class="w-4 h-4"></i>
      </button>
    </div>
  `;
  lucide.createIcons();
  document.getElementById('editField')?.focus();
}

function startEditContext(issueId) {
  const container = document.getElementById('issueContext');
  const currentValue = issueData.selectedIssue?.context || '';
  if (!container) return;

  container.innerHTML = `
    <textarea class="edit-textarea" id="editContext" rows="8">${currentValue}</textarea>
    <div class="edit-actions">
      <button class="btn-save" onclick="saveContextEdit('${issueId}')">
        <i data-lucide="check" class="w-4 h-4"></i>
      </button>
      <button class="btn-cancel" onclick="cancelEdit()">
        <i data-lucide="x" class="w-4 h-4"></i>
      </button>
    </div>
  `;
  lucide.createIcons();
  document.getElementById('editContext')?.focus();
}

async function saveFieldEdit(issueId, field) {
  const input = document.getElementById('editField');
  if (!input) return;

  const value = input.value.trim();
  if (!value) return;

  try {
    const response = await fetch('/api/issues/' + encodeURIComponent(issueId) + '?path=' + encodeURIComponent(projectPath), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value })
    });

    if (!response.ok) throw new Error('Failed to update');

    showNotification('Updated ' + field, 'success');

    // Refresh data
    await loadIssueData();
    const detail = await loadIssueDetail(issueId);
    if (detail) {
      issueData.selectedIssue = detail;
      renderIssueDetailPanel(detail);
    }
  } catch (err) {
    showNotification('Failed to update', 'error');
    cancelEdit();
  }
}

async function saveContextEdit(issueId) {
  const textarea = document.getElementById('editContext');
  if (!textarea) return;

  const value = textarea.value;

  try {
    const response = await fetch('/api/issues/' + encodeURIComponent(issueId) + '?path=' + encodeURIComponent(projectPath), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: value })
    });

    if (!response.ok) throw new Error('Failed to update');

    showNotification('Context updated', 'success');

    // Refresh detail
    const detail = await loadIssueDetail(issueId);
    if (detail) {
      issueData.selectedIssue = detail;
      renderIssueDetailPanel(detail);
    }
  } catch (err) {
    showNotification('Failed to update context', 'error');
    cancelEdit();
  }
}

function cancelEdit() {
  if (issueData.selectedIssue) {
    renderIssueDetailPanel(issueData.selectedIssue);
  }
}

async function updateTaskStatus(issueId, taskId, status) {
  try {
    const response = await fetch('/api/issues/' + encodeURIComponent(issueId) + '/tasks/' + encodeURIComponent(taskId) + '?path=' + encodeURIComponent(projectPath), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });

    if (!response.ok) throw new Error('Failed to update task');

    showNotification('Task status updated', 'success');
  } catch (err) {
    showNotification('Failed to update task status', 'error');
  }
}

// ========== Search Functions ==========
function handleIssueSearch(value) {
  issueData.searchQuery = value;
  renderIssueView();
}

function clearIssueSearch() {
  issueData.searchQuery = '';
  renderIssueView();
}

// ========== Create Issue Modal ==========
function generateIssueId() {
  // Generate unique ID: ISSUE-YYYYMMDD-XXX format
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');

  // Find existing IDs with same date prefix
  const prefix = 'ISSUE-' + dateStr + '-';
  const existingIds = (issueData.issues || [])
    .map(i => i.id)
    .filter(id => id.startsWith(prefix));

  // Get next sequence number
  let maxSeq = 0;
  existingIds.forEach(id => {
    const seqStr = id.replace(prefix, '');
    const seq = parseInt(seqStr, 10);
    if (!isNaN(seq) && seq > maxSeq) {
      maxSeq = seq;
    }
  });

  return prefix + String(maxSeq + 1).padStart(3, '0');
}

function showCreateIssueModal() {
  const modal = document.getElementById('createIssueModal');
  if (modal) {
    modal.classList.remove('hidden');

    // Auto-generate issue ID
    const idInput = document.getElementById('newIssueId');
    if (idInput) {
      idInput.value = generateIssueId();
    }

    lucide.createIcons();
    // Focus on title input instead of ID
    setTimeout(() => {
      document.getElementById('newIssueTitle')?.focus();
    }, 100);
  }
}

function regenerateIssueId() {
  const idInput = document.getElementById('newIssueId');
  if (idInput) {
    idInput.value = generateIssueId();
  }
}

function hideCreateIssueModal() {
  const modal = document.getElementById('createIssueModal');
  if (modal) {
    modal.classList.add('hidden');
    // Clear form
    const idInput = document.getElementById('newIssueId');
    const titleInput = document.getElementById('newIssueTitle');
    const contextInput = document.getElementById('newIssueContext');
    const prioritySelect = document.getElementById('newIssuePriority');
    if (idInput) idInput.value = '';
    if (titleInput) titleInput.value = '';
    if (contextInput) contextInput.value = '';
    if (prioritySelect) prioritySelect.value = '3';
  }
}

async function createIssue() {
  const idInput = document.getElementById('newIssueId');
  const titleInput = document.getElementById('newIssueTitle');
  const contextInput = document.getElementById('newIssueContext');
  const prioritySelect = document.getElementById('newIssuePriority');

  const issueId = idInput?.value?.trim();
  const title = titleInput?.value?.trim();
  const context = contextInput?.value?.trim();
  const priority = parseInt(prioritySelect?.value || '3');

  if (!issueId) {
    showNotification(t('issues.idRequired') || 'Issue ID is required', 'error');
    idInput?.focus();
    return;
  }

  if (!title) {
    showNotification(t('issues.titleRequired') || 'Title is required', 'error');
    titleInput?.focus();
    return;
  }

  try {
    const response = await fetch('/api/issues?path=' + encodeURIComponent(projectPath), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: issueId,
        title: title,
        context: context,
        priority: priority,
        source: 'dashboard'
      })
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      showNotification(result.error || 'Failed to create issue', 'error');
      return;
    }

    showNotification(t('issues.created') || 'Issue created successfully', 'success');
    hideCreateIssueModal();

    // Reload data and refresh view
    await loadIssueData();
    renderIssueView();
  } catch (err) {
    console.error('Failed to create issue:', err);
    showNotification('Failed to create issue', 'error');
  }
}

// ========== Delete Issue ==========
async function deleteIssue(issueId) {
  if (!confirm(t('issues.confirmDelete') || 'Are you sure you want to delete this issue?')) {
    return;
  }

  try {
    const response = await fetch('/api/issues/' + encodeURIComponent(issueId) + '?path=' + encodeURIComponent(projectPath), {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('Failed to delete');

    showNotification(t('issues.deleted') || 'Issue deleted', 'success');
    closeIssueDetail();

    // Reload data and refresh view
    await loadIssueData();
    renderIssueView();
  } catch (err) {
    showNotification('Failed to delete issue', 'error');
  }
}

// ========== Queue Operations ==========
async function refreshQueue() {
  try {
    await loadQueueData();
    renderIssueView();
    showNotification(t('issues.queueRefreshed') || 'Queue refreshed', 'success');
  } catch (err) {
    showNotification('Failed to refresh queue', 'error');
  }
}

function createExecutionQueue() {
  showQueueCommandModal();
}

function showQueueCommandModal() {
  // Create modal if not exists
  let modal = document.getElementById('queueCommandModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'queueCommandModal';
    modal.className = 'issue-modal';
    document.body.appendChild(modal);
  }

  const command = 'claude /issue:queue';
  const altCommand = 'ccw issue queue';

  modal.innerHTML = `
    <div class="issue-modal-backdrop" onclick="hideQueueCommandModal()"></div>
    <div class="issue-modal-content" style="max-width: 560px;">
      <div class="issue-modal-header">
        <h3>${t('issues.createQueue') || 'Create Execution Queue'}</h3>
        <button class="btn-icon" onclick="hideQueueCommandModal()">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      <div class="issue-modal-body">
        <p class="text-sm text-muted-foreground mb-4">
          ${t('issues.queueCommandHint') || 'Run one of the following commands in your terminal to generate the execution queue from bound solutions:'}
        </p>

        <div class="command-option mb-3">
          <label class="text-xs font-medium text-muted-foreground mb-1 block">
            <i data-lucide="terminal" class="w-3 h-3 inline mr-1"></i>
            Claude Code CLI
          </label>
          <div class="command-box">
            <code class="command-text">${command}</code>
            <button class="btn-icon" onclick="copyCommand('${command}')" title="${t('common.copy') || 'Copy'}">
              <i data-lucide="copy" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <div class="command-option">
          <label class="text-xs font-medium text-muted-foreground mb-1 block">
            <i data-lucide="terminal" class="w-3 h-3 inline mr-1"></i>
            CCW CLI (${t('issues.alternative') || 'Alternative'})
          </label>
          <div class="command-box">
            <code class="command-text">${altCommand}</code>
            <button class="btn-icon" onclick="copyCommand('${altCommand}')" title="${t('common.copy') || 'Copy'}">
              <i data-lucide="copy" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <div class="command-info mt-4">
          <p class="text-xs text-muted-foreground">
            <i data-lucide="info" class="w-3 h-3 inline mr-1"></i>
            ${t('issues.queueCommandInfo') || 'After running the command, click "Refresh" to see the updated queue.'}
          </p>
        </div>
      </div>
      <div class="issue-modal-footer">
        <button class="btn-secondary" onclick="hideQueueCommandModal()">${t('common.close') || 'Close'}</button>
        <button class="btn-primary" onclick="hideQueueCommandModal(); refreshQueue();">
          <i data-lucide="refresh-cw" class="w-4 h-4"></i>
          ${t('issues.refreshAfter') || 'Refresh Queue'}
        </button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  lucide.createIcons();
}

function hideQueueCommandModal() {
  const modal = document.getElementById('queueCommandModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// ========== Queue History Modal ==========
async function showQueueHistoryModal() {
  // Create modal if not exists
  let modal = document.getElementById('queueHistoryModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'queueHistoryModal';
    modal.className = 'issue-modal';
    document.body.appendChild(modal);
  }

  // Show loading state
  modal.innerHTML = `
    <div class="issue-modal-backdrop" onclick="hideQueueHistoryModal()"></div>
    <div class="issue-modal-content" style="max-width: 700px; max-height: 80vh;">
      <div class="issue-modal-header">
        <h3><i data-lucide="history" class="w-5 h-5 inline mr-2"></i>Queue History</h3>
        <button class="btn-icon" onclick="hideQueueHistoryModal()">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      <div class="issue-modal-body" style="overflow-y: auto; max-height: calc(80vh - 120px);">
        <div class="flex items-center justify-center py-8">
          <i data-lucide="loader-2" class="w-6 h-6 animate-spin"></i>
          <span class="ml-2">Loading...</span>
        </div>
      </div>
    </div>
  `;
  modal.classList.remove('hidden');
  lucide.createIcons();

  // Fetch queue history
  try {
    const response = await fetch(`/api/queue/history?path=${encodeURIComponent(projectPath)}`);
    const data = await response.json();

    const queues = data.queues || [];
    const activeQueueId = data.active_queue_id;

    // Render queue list
    const queueListHtml = queues.length === 0
      ? `<div class="text-center py-8 text-muted-foreground">
           <i data-lucide="inbox" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
           <p>No queue history found</p>
         </div>`
      : `<div class="queue-history-list">
           ${queues.map(q => `
             <div class="queue-history-item ${q.id === activeQueueId ? 'active' : ''}" onclick="viewQueueDetail('${q.id}')">
               <div class="queue-history-header">
                 <span class="queue-history-id font-mono">${q.id}</span>
                 ${q.id === activeQueueId ? '<span class="queue-active-badge">Active</span>' : ''}
                 <span class="queue-history-status ${q.status || ''}">${q.status || 'unknown'}</span>
               </div>
               <div class="queue-history-meta">
                 <span class="text-xs text-muted-foreground">
                   <i data-lucide="layers" class="w-3 h-3 inline"></i>
                   ${q.issue_ids?.length || 0} issues
                 </span>
                 <span class="text-xs text-muted-foreground">
                   <i data-lucide="check-circle" class="w-3 h-3 inline"></i>
                   ${q.completed_solutions || q.completed_tasks || 0}/${q.total_solutions || q.total_tasks || 0} ${q.total_solutions ? 'solutions' : 'tasks'}
                 </span>
                 <span class="text-xs text-muted-foreground">
                   <i data-lucide="calendar" class="w-3 h-3 inline"></i>
                   ${q.created_at ? new Date(q.created_at).toLocaleDateString() : 'N/A'}
                 </span>
               </div>
               <div class="queue-history-actions">
                 ${q.id !== activeQueueId ? `
                   <button class="btn-sm btn-primary" onclick="event.stopPropagation(); switchToQueue('${q.id}')">
                     <i data-lucide="arrow-right-circle" class="w-3 h-3"></i>
                     Switch
                   </button>
                 ` : ''}
                 <button class="btn-sm btn-secondary" onclick="event.stopPropagation(); viewQueueDetail('${q.id}')">
                   <i data-lucide="eye" class="w-3 h-3"></i>
                   View
                 </button>
               </div>
             </div>
           `).join('')}
         </div>`;

    modal.querySelector('.issue-modal-body').innerHTML = queueListHtml;
    lucide.createIcons();

  } catch (err) {
    console.error('Failed to load queue history:', err);
    modal.querySelector('.issue-modal-body').innerHTML = `
      <div class="text-center py-8 text-red-500">
        <i data-lucide="alert-circle" class="w-8 h-8 mx-auto mb-2"></i>
        <p>Failed to load queue history</p>
      </div>
    `;
    lucide.createIcons();
  }
}

function hideQueueHistoryModal() {
  const modal = document.getElementById('queueHistoryModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

async function switchToQueue(queueId) {
  try {
    const response = await fetch(`/api/queue/switch?path=${encodeURIComponent(projectPath)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueId })
    });

    const result = await response.json();
    if (result.success) {
      showNotification(t('issues.queueSwitched') || 'Switched to queue: ' + queueId, 'success');
      hideQueueHistoryModal();
      await loadQueueData();
      renderIssueView();
    } else {
      showNotification(result.error || 'Failed to switch queue', 'error');
    }
  } catch (err) {
    console.error('Failed to switch queue:', err);
    showNotification('Failed to switch queue', 'error');
  }
}

async function viewQueueDetail(queueId) {
  const modal = document.getElementById('queueHistoryModal');
  if (!modal) return;

  // Show loading
  modal.querySelector('.issue-modal-body').innerHTML = `
    <div class="flex items-center justify-center py-8">
      <i data-lucide="loader-2" class="w-6 h-6 animate-spin"></i>
      <span class="ml-2">${t('common.loading') || 'Loading...'}</span>
    </div>
  `;
  lucide.createIcons();

  try {
    const response = await fetch(`/api/queue/${queueId}?path=${encodeURIComponent(projectPath)}`);
    const queue = await response.json();

    if (queue.error) {
      throw new Error(queue.error);
    }

    // Support both solution-level and task-level queues
    const items = queue.solutions || queue.queue || queue.tasks || [];
    const isSolutionLevel = !!(queue.solutions && queue.solutions.length > 0);
    const metadata = queue._metadata || {};

    // Group by execution_group
    const grouped = {};
    items.forEach(item => {
      const group = item.execution_group || 'ungrouped';
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(item);
    });

    const itemLabel = isSolutionLevel ? 'solutions' : 'tasks';

    const detailHtml = `
      <div class="queue-detail-view">
        <div class="queue-detail-header mb-4">
          <button class="btn-sm btn-secondary" onclick="showQueueHistoryModal()">
            <i data-lucide="arrow-left" class="w-3 h-3"></i>
            Back
          </button>
          <div class="ml-4">
            <h4 class="text-lg font-semibold">${queue.name || queue.id || queueId}</h4>
            ${queue.name ? `<span class="text-xs text-muted-foreground font-mono">${queue.id}</span>` : ''}
          </div>
        </div>

        <div class="queue-detail-stats mb-4">
          <div class="stat-item">
            <span class="stat-value">${items.length}</span>
            <span class="stat-label">${isSolutionLevel ? 'Solutions' : 'Total'}</span>
          </div>
          <div class="stat-item completed">
            <span class="stat-value">${items.filter(t => t.status === 'completed').length}</span>
            <span class="stat-label">Completed</span>
          </div>
          <div class="stat-item pending">
            <span class="stat-value">${items.filter(t => t.status === 'pending').length}</span>
            <span class="stat-label">Pending</span>
          </div>
          <div class="stat-item failed">
            <span class="stat-value">${items.filter(t => t.status === 'failed').length}</span>
            <span class="stat-label">Failed</span>
          </div>
        </div>

        <div class="queue-detail-groups">
          ${Object.entries(grouped).map(([groupId, groupItems]) => `
            <div class="queue-group-section">
              <div class="queue-group-header">
                <i data-lucide="folder" class="w-4 h-4"></i>
                <span>${groupId}</span>
                <span class="text-xs text-muted-foreground">(${groupItems.length} ${itemLabel})</span>
              </div>
              <div class="queue-group-items">
                ${groupItems.map(item => `
                  <div class="queue-detail-item ${item.status || ''}">
                    <div class="item-main">
                      <span class="item-id font-mono text-xs">${item.item_id || item.queue_id || item.task_id || 'N/A'}</span>
                      <span class="item-title text-sm">${isSolutionLevel ? (item.task_count + ' tasks') : (item.title || item.action || 'Untitled')}</span>
                    </div>
                    <div class="item-meta">
                      <span class="item-issue text-xs">${item.issue_id || ''}</span>
                      ${isSolutionLevel && item.files_touched ? `<span class="item-files text-xs">${item.files_touched.length} files</span>` : ''}
                      <span class="item-status ${item.status || ''}">${item.status || 'unknown'}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    modal.querySelector('.issue-modal-body').innerHTML = detailHtml;
    lucide.createIcons();

  } catch (err) {
    console.error('Failed to load queue detail:', err);
    modal.querySelector('.issue-modal-body').innerHTML = `
      <div class="text-center py-8">
        <button class="btn-sm btn-secondary mb-4" onclick="showQueueHistoryModal()">
          <i data-lucide="arrow-left" class="w-3 h-3"></i>
          Back
        </button>
        <div class="text-red-500">
          <i data-lucide="alert-circle" class="w-8 h-8 mx-auto mb-2"></i>
          <p>Failed to load queue detail</p>
        </div>
      </div>
    `;
    lucide.createIcons();
  }
}

function copyCommand(command) {
  navigator.clipboard.writeText(command).then(() => {
    showNotification(t('common.copied') || 'Copied to clipboard', 'success');
  }).catch(err => {
    console.error('Failed to copy:', err);
    // Fallback: select text
    const textArea = document.createElement('textarea');
    textArea.value = command;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showNotification(t('common.copied') || 'Copied to clipboard', 'success');
  });
}
