// ==========================================
// ISSUE MANAGER VIEW
// Manages issues, solutions, and execution queue
// ==========================================

// ========== Issue State ==========
var issueData = {
  issues: [],
  historyIssues: [], // Archived/completed issues from history
  queue: { tasks: [], solutions: [], conflicts: [], execution_groups: [], grouped_items: {} },
  selectedIssue: null,
  selectedSolution: null,
  selectedSolutionIssueId: null,
  statusFilter: 'all',
  searchQuery: '',
  viewMode: 'issues', // 'issues' | 'queue'
  // Search suggestions state
  searchSuggestions: [],
  showSuggestions: false,
  selectedSuggestion: -1
};
var issueLoading = false;
var issueDragState = {
  dragging: null,
  groupId: null
};

// Multi-queue state
var queueData = {
  queues: [],           // All queue index entries
  activeQueueId: null,  // Currently active queue
  expandedQueueId: null // Queue showing execution groups
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
  await Promise.all([loadIssueData(), loadQueueData(), loadAllQueues()]);

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

async function loadIssueHistory() {
  try {
    const response = await fetch('/api/issues/history?path=' + encodeURIComponent(projectPath));
    if (!response.ok) throw new Error('Failed to load issue history');
    const data = await response.json();
    issueData.historyIssues = data.issues || [];
  } catch (err) {
    console.error('Failed to load issue history:', err);
    issueData.historyIssues = [];
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

async function loadAllQueues() {
  try {
    const response = await fetch('/api/queue/history?path=' + encodeURIComponent(projectPath));
    if (!response.ok) throw new Error('Failed to load queue history');
    const data = await response.json();
    queueData.queues = data.queues || [];
    queueData.activeQueueId = data.active_queue_id;
  } catch (err) {
    console.error('Failed to load all queues:', err);
    queueData.queues = [];
    queueData.activeQueueId = null;
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
  const historyIssues = issueData.historyIssues || [];

  // Apply both status and search filters
  let filteredIssues;
  if (issueData.statusFilter === 'all') {
    filteredIssues = issues;
  } else if (issueData.statusFilter === 'completed') {
    // For 'completed' filter, include both current completed issues and archived history issues
    const currentCompleted = issues.filter(i => i.status === 'completed');
    // Mark history issues as archived for visual distinction
    const archivedIssues = historyIssues.map(i => ({ ...i, _isArchived: true }));
    filteredIssues = [...currentCompleted, ...archivedIssues];
  } else {
    filteredIssues = issues.filter(i => i.status === issueData.statusFilter);
  }

  if (issueData.searchQuery) {
    const query = issueData.searchQuery.toLowerCase();
    filteredIssues = filteredIssues.filter(i => {
      // Basic field search
      const basicMatch =
        i.id.toLowerCase().includes(query) ||
        (i.title && i.title.toLowerCase().includes(query)) ||
        (i.context && i.context.toLowerCase().includes(query));

      if (basicMatch) return true;

      // Search in solutions
      if (i.solutions && i.solutions.length > 0) {
        return i.solutions.some(sol =>
          (sol.description && sol.description.toLowerCase().includes(query)) ||
          (sol.approach && sol.approach.toLowerCase().includes(query))
        );
      }
      return false;
    });
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
            <!-- Pull from GitHub Button -->
            <button class="issue-pull-btn" onclick="showPullIssuesModal()" title="Pull issues from GitHub repository">
              <svg class="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v 3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span>Pull from GitHub</span>
            </button>

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

      <!-- Pull Issues Modal -->
      <div id="pullIssuesModal" class="issue-modal hidden">
        <div class="issue-modal-backdrop" onclick="hidePullIssuesModal()"></div>
        <div class="issue-modal-content">
          <div class="issue-modal-header">
            <h3>
              <svg class="w-5 h-5 inline mr-2 -mt-1" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Pull Issues from GitHub
            </h3>
            <button class="btn-icon" onclick="hidePullIssuesModal()">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>
          <div class="issue-modal-body">
            <div class="form-group">
              <label>Issue State</label>
              <select id="pullIssueState">
                <option value="open" selected>Open</option>
                <option value="closed">Closed</option>
                <option value="all">All</option>
              </select>
            </div>
            <div class="form-group">
              <label>Maximum Issues</label>
              <input type="number" id="pullIssueLimit" value="20" min="1" max="100" />
            </div>
            <div class="form-group">
              <label>Labels (optional)</label>
              <input type="text" id="pullIssueLabels" placeholder="bug, enhancement (comma-separated)" />
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="pullDownloadImages" checked />
                <span>Download images to local</span>
              </label>
              <p class="form-hint text-xs text-muted-foreground mt-1">Images will be saved to .workflow/issues/images/ and links updated in issue context</p>
            </div>
            <div id="pullIssueResult" class="pull-result hidden mt-4 p-3 rounded-md bg-muted"></div>
          </div>
          <div class="issue-modal-footer">
            <button class="btn-secondary" onclick="hidePullIssuesModal()">Cancel</button>
            <button class="btn-primary" id="pullIssuesBtn" onclick="pullGitHubIssues()">
              <svg class="w-4 h-4 mr-1 inline" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Pull Issues
            </button>
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
               oninput="handleIssueSearch(this.value)"
               onkeydown="handleSearchKeydown(event)"
               onfocus="showSearchSuggestions()"
               autocomplete="off" />
        ${issueData.searchQuery ? `
          <button class="issue-search-clear" onclick="clearIssueSearch()">
            <i data-lucide="x" class="w-3 h-3"></i>
          </button>
        ` : ''}
        <div class="search-suggestions ${issueData.showSuggestions && issueData.searchSuggestions.length > 0 ? 'show' : ''}" id="searchSuggestions">
          ${renderSearchSuggestions()}
        </div>
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

  const isArchived = issue._isArchived;
  const archivedDate = issue.archived_at ? new Date(issue.archived_at).toLocaleDateString() : null;

  return `
    <div class="issue-card ${isArchived ? 'archived' : ''}" onclick="openIssueDetail('${issue.id}'${isArchived ? ', true' : ''})">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="issue-id font-mono text-sm">${highlightMatch(issue.id, issueData.searchQuery)}</span>
          <span class="issue-status ${statusColors[issue.status] || ''}">${issue.status || 'unknown'}</span>
          ${isArchived ? `
            <span class="issue-archived-badge" title="Archived on ${archivedDate || 'Unknown'}">
              <i data-lucide="archive" class="w-3 h-3"></i>
              <span>${t('issues.archived') || 'Archived'}</span>
            </span>
          ` : ''}
        </div>
        <span class="issue-priority" title="${t('issues.priority') || 'Priority'}: ${issue.priority || 3}">
          ${renderPriorityStars(issue.priority || 3)}
        </span>
      </div>

      <h3 class="issue-title text-foreground font-medium mb-2">${highlightMatch(issue.title || issue.id, issueData.searchQuery)}</h3>

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

      ${isArchived && archivedDate ? `
        <div class="issue-archived-footer">
          <i data-lucide="clock" class="w-3 h-3"></i>
          <span>Archived on ${archivedDate}</span>
        </div>
      ` : ''}
    </div>
  `;
}

// Render failure information for failed issues
function renderFailureInfo(issue) {
  // Check if issue has failure feedback
  if (!issue.feedback || issue.feedback.length === 0) {
    return '';
  }

  // Extract failure feedbacks
  const failures = issue.feedback.filter(f => f.type === 'failure' && f.stage === 'execute');
  if (failures.length === 0) {
    return '';
  }

  // Get latest failure
  const latestFailure = failures[failures.length - 1];
  let failureDetail;
  try {
    failureDetail = JSON.parse(latestFailure.content);
  } catch {
    return '';
  }

  const errorMessage = failureDetail.message || 'Unknown error';
  const errorType = failureDetail.error_type || 'error';
  const taskId = failureDetail.task_id;
  const failureCount = failures.length;

  return `
    <div class="issue-failure-info">
      <div class="failure-header">
        <i data-lucide="alert-circle" class="w-3.5 h-3.5"></i>
        <span class="failure-label">${failureCount > 1 ? `Failed ${failureCount} times` : 'Execution Failed'}</span>
        ${taskId ? `<span class="failure-task">${taskId}</span>` : ''}
      </div>
      <div class="failure-message">
        <span class="failure-type">${errorType}:</span>
        <span class="failure-text" title="${escapeHtml(errorMessage)}">${escapeHtml(truncateText(errorMessage, 80))}</span>
      </div>
    </div>
  `;
}

function renderFailureHistoryDetail(issue) {
  // Check if issue has failure feedback
  if (!issue.feedback || issue.feedback.length === 0) {
    return '';
  }

  // Extract failure feedbacks
  const failures = issue.feedback.filter(f => f.type === 'failure' && f.stage === 'execute');
  if (failures.length === 0) {
    return '';
  }

  return `
    <div class="detail-section">
      <label class="detail-label">${t('issues.failureHistory') || 'Failure History'} (${failures.length})</label>
      <div class="failure-history-list">
        ${failures.map((failure, index) => {
          let failureDetail;
          try {
            failureDetail = JSON.parse(failure.content);
          } catch {
            return '';
          }

          const errorMessage = failureDetail.message || 'Unknown error';
          const errorType = failureDetail.error_type || 'error';
          const taskId = failureDetail.task_id;
          const timestamp = failure.created_at ? new Date(failure.created_at).toLocaleString() : 'Unknown time';

          return `
            <div class="failure-history-item">
              <div class="failure-history-header">
                <i data-lucide="alert-circle" class="w-4 h-4"></i>
                <span class="failure-history-count">Failure ${index + 1}</span>
                <span class="failure-history-timestamp text-xs text-muted-foreground">${timestamp}</span>
              </div>
              <div class="failure-history-content">
                ${taskId ? `
                  <div class="failure-history-task">
                    <span class="detail-label-sm">Task:</span>
                    <span class="font-mono text-xs">${taskId}</span>
                  </div>
                ` : ''}
                <div class="failure-history-error">
                  <span class="detail-label-sm">Error Type:</span>
                  <span class="font-mono text-xs">${errorType}</span>
                </div>
                <div class="failure-history-message">
                  <span class="detail-label-sm">Message:</span>
                  <pre class="detail-pre text-xs">${escapeHtml(errorMessage)}</pre>
                </div>
                ${failureDetail.stack_trace ? `
                  <details class="failure-history-stacktrace">
                    <summary class="cursor-pointer text-xs text-muted-foreground">Show Stack Trace</summary>
                    <pre class="detail-pre text-xs mt-1 max-h-60 overflow-auto">${escapeHtml(failureDetail.stack_trace)}</pre>
                  </details>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// Helper: Truncate text to max length
function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function renderPriorityStars(priority) {
  const maxStars = 5;
  let stars = '';
  for (let i = 1; i <= maxStars; i++) {
    stars += `<i data-lucide="star" class="w-3 h-3 ${i <= priority ? 'text-warning fill-warning' : 'text-muted'}"></i>`;
  }
  return stars;
}

async function filterIssuesByStatus(status) {
  issueData.statusFilter = status;
  // Load history data when filtering by 'completed' status
  if (status === 'completed' && issueData.historyIssues.length === 0) {
    await loadIssueHistory();
  }
  renderIssueView();
}

// ========== Queue Section ==========
function renderQueueSection() {
  const queues = queueData.queues || [];
  const activeQueueId = queueData.activeQueueId;
  const expandedQueueId = queueData.expandedQueueId;

  // If a queue is expanded, show loading then load detail
  if (expandedQueueId) {
    // Show loading state first, then load async
    setTimeout(() => loadAndRenderExpandedQueue(expandedQueueId), 0);
    return `
      <div id="queueExpandedWrapper" class="queue-expanded-wrapper">
        <div class="queue-detail-header mb-4">
          <button class="btn-secondary" onclick="queueData.expandedQueueId = null; renderIssueView();">
            <i data-lucide="arrow-left" class="w-4 h-4"></i>
            <span>${t('common.back') || 'Back'}</span>
          </button>
          <div class="queue-detail-title">
            <h3 class="font-mono text-lg">${escapeHtml(expandedQueueId)}</h3>
          </div>
        </div>
        <div id="expandedQueueContent" class="flex items-center justify-center py-8">
          <i data-lucide="loader-2" class="w-6 h-6 animate-spin"></i>
          <span class="ml-2">${t('common.loading') || 'Loading...'}</span>
        </div>
      </div>
    `;
  }

  // Show multi-queue cards view
  return `
    <!-- Queue Cards Header -->
    <div class="queue-cards-header mb-4">
      <div class="flex items-center gap-3">
        <h3 class="text-lg font-semibold">${t('issues.executionQueues') || 'Execution Queues'}</h3>
        <span class="text-sm text-muted-foreground">${queues.length} ${t('issues.queues') || 'queues'}</span>
      </div>
      <div class="flex items-center gap-2">
        <button class="btn-secondary" onclick="loadAllQueues().then(() => renderIssueView())" title="${t('issues.refresh') || 'Refresh'}">
          <i data-lucide="refresh-cw" class="w-4 h-4"></i>
        </button>
        <button class="btn-primary" onclick="createExecutionQueue()">
          <i data-lucide="plus" class="w-4 h-4"></i>
          <span>${t('issues.createQueue') || 'Create Queue'}</span>
        </button>
      </div>
    </div>

    ${queues.length === 0 ? `
      <div class="queue-empty-container">
        <div class="queue-empty">
          <i data-lucide="git-branch" class="w-16 h-16"></i>
          <p class="queue-empty-title">${t('issues.noQueues') || 'No queues found'}</p>
          <p class="queue-empty-hint">${t('issues.queueEmptyHint') || 'Generate execution queue from bound solutions'}</p>
          <button class="queue-create-btn" onclick="createExecutionQueue()">
            <i data-lucide="play" class="w-4 h-4"></i>
            <span>${t('issues.createQueue') || 'Create Queue'}</span>
          </button>
        </div>
      </div>
    ` : `
      <!-- Queue Cards Grid -->
      <div class="queue-cards-grid">
        ${queues.map(q => renderQueueCard(q, q.id === activeQueueId)).join('')}
      </div>
    `}
  `;
}

function renderQueueCard(queue, isActive) {
  const itemCount = queue.total_solutions || queue.total_tasks || 0;
  const completedCount = queue.completed_solutions || queue.completed_tasks || 0;
  const progressPercent = itemCount > 0 ? Math.round((completedCount / itemCount) * 100) : 0;
  const issueCount = queue.issue_ids?.length || 0;
  const statusClass = queue.status || '';
  const safeQueueId = escapeHtml(queue.id || '');

  return `
    <div class="queue-card ${isActive ? 'active' : ''} ${statusClass}" onclick="toggleQueueExpand('${safeQueueId}')">
      <div class="queue-card-header">
        <span class="queue-card-id font-mono">${safeQueueId}</span>
        <div class="queue-card-badges">
          ${isActive ? '<span class="queue-active-badge">Active</span>' : ''}
          ${!isActive || queue.status !== 'active' ? `<span class="queue-status-badge ${statusClass}">${queue.status || 'unknown'}</span>` : ''}
        </div>
      </div>

      <div class="queue-card-stats">
        <div class="progress-bar">
          <div class="progress-fill ${queue.status === 'completed' ? 'completed' : ''}" style="width: ${progressPercent}%"></div>
        </div>
        <div class="queue-card-progress">
          <span>${completedCount}/${itemCount} ${queue.total_solutions ? 'solutions' : 'tasks'}</span>
          <span class="text-muted-foreground">${progressPercent}%</span>
        </div>
      </div>

      <div class="queue-card-meta">
        <span class="flex items-center gap-1">
          <i data-lucide="layers" class="w-3 h-3"></i>
          ${issueCount} issues
        </span>
        <span class="flex items-center gap-1">
          <i data-lucide="calendar" class="w-3 h-3"></i>
          ${queue.created_at ? new Date(queue.created_at).toLocaleDateString() : 'N/A'}
        </span>
      </div>

      <div class="queue-card-actions" onclick="event.stopPropagation()">
        <button class="btn-sm" onclick="toggleQueueExpand('${safeQueueId}')" title="View details">
          <i data-lucide="eye" class="w-3 h-3"></i>
        </button>
        ${!isActive && queue.status !== 'archived' ? `
          <button class="btn-sm btn-primary" onclick="activateQueue('${safeQueueId}')" title="Set as active">
            <i data-lucide="check-circle" class="w-3 h-3"></i>
          </button>
        ` : ''}
        ${queue.status !== 'archived' ? `
          <button class="btn-sm" onclick="showMergeQueueModal('${safeQueueId}')" title="Merge into another queue">
            <i data-lucide="git-merge" class="w-3 h-3"></i>
          </button>
        ` : ''}
        ${queue.status !== 'archived' && issueCount > 1 ? `
          <button class="btn-sm" onclick="showSplitQueueModal('${safeQueueId}')" title="Split queue into multiple queues">
            <i data-lucide="git-branch" class="w-3 h-3"></i>
          </button>
        ` : ''}
        <button class="btn-sm btn-danger" onclick="confirmDeleteQueue('${safeQueueId}')" title="${t('issues.deleteQueue') || 'Delete queue'}">
          <i data-lucide="trash-2" class="w-3 h-3"></i>
        </button>
      </div>
    </div>
  `;
}

function toggleQueueExpand(queueId) {
  if (queueData.expandedQueueId === queueId) {
    queueData.expandedQueueId = null;
  } else {
    queueData.expandedQueueId = queueId;
  }
  renderIssueView();
}

async function activateQueue(queueId) {
  try {
    const response = await fetch('/api/queue/switch?path=' + encodeURIComponent(projectPath), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueId })
    });
    const result = await response.json();
    if (result.success) {
      showNotification(t('issues.queueActivated') || 'Queue activated: ' + queueId, 'success');
      await Promise.all([loadQueueData(), loadAllQueues()]);
      renderIssueView();
    } else {
      showNotification(result.error || 'Failed to activate queue', 'error');
    }
  } catch (err) {
    console.error('Failed to activate queue:', err);
    showNotification('Failed to activate queue', 'error');
  }
}

async function deactivateQueue(queueId) {
  try {
    const response = await fetch('/api/queue/deactivate?path=' + encodeURIComponent(projectPath), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueId })
    });
    const result = await response.json();
    if (result.success) {
      showNotification(t('issues.queueDeactivated') || 'Queue deactivated', 'success');
      queueData.activeQueueId = null;
      await Promise.all([loadQueueData(), loadAllQueues()]);
      renderIssueView();
    } else {
      showNotification(result.error || 'Failed to deactivate queue', 'error');
    }
  } catch (err) {
    console.error('Failed to deactivate queue:', err);
    showNotification('Failed to deactivate queue', 'error');
  }
}

function confirmDeleteQueue(queueId) {
  const msg = t('issues.confirmDeleteQueue') || 'Are you sure you want to delete this queue? This action cannot be undone.';
  if (confirm(msg)) {
    deleteQueue(queueId);
  }
}

async function deleteQueue(queueId) {
  try {
    const response = await fetch('/api/queue/' + encodeURIComponent(queueId) + '?path=' + encodeURIComponent(projectPath), {
      method: 'DELETE'
    });
    const result = await response.json();
    if (result.success) {
      showNotification(t('issues.queueDeleted') || 'Queue deleted successfully', 'success');
      queueData.expandedQueueId = null;
      await Promise.all([loadQueueData(), loadAllQueues()]);
      renderIssueView();
    } else {
      showNotification(result.error || 'Failed to delete queue', 'error');
    }
  } catch (err) {
    console.error('Failed to delete queue:', err);
    showNotification('Failed to delete queue', 'error');
  }
}

async function renderExpandedQueueView(queueId) {
  const safeQueueId = escapeHtml(queueId || '');
  // Fetch queue detail
  let queue;
  try {
    const response = await fetch('/api/queue/' + encodeURIComponent(queueId) + '?path=' + encodeURIComponent(projectPath));
    queue = await response.json();
    if (queue.error) throw new Error(queue.error);
  } catch (err) {
    return `
      <div class="queue-error">
        <button class="btn-secondary mb-4" onclick="queueData.expandedQueueId = null; renderIssueView();">
          <i data-lucide="arrow-left" class="w-4 h-4"></i> Back
        </button>
        <p class="text-red-500">Failed to load queue: ${escapeHtml(err.message)}</p>
      </div>
    `;
  }

  const queueItems = queue.solutions || queue.tasks || [];
  const isSolutionLevel = !!(queue.solutions && queue.solutions.length > 0);
  const metadata = queue._metadata || {};
  const isActive = queueId === queueData.activeQueueId;

  // Group items by execution_group
  const groupMap = {};
  queueItems.forEach(item => {
    const groupId = item.execution_group || 'default';
    if (!groupMap[groupId]) groupMap[groupId] = [];
    groupMap[groupId].push(item);
  });

  const groups = queue.execution_groups || Object.keys(groupMap).map(groupId => ({
    id: groupId,
    type: groupId.startsWith('P') ? 'parallel' : 'sequential',
    solution_count: groupMap[groupId]?.length || 0
  }));
  const groupedItems = queue.grouped_items || groupMap;

  return `
    <!-- Back Button & Queue Header -->
    <div class="queue-detail-header mb-4">
      <button class="btn-secondary" onclick="queueData.expandedQueueId = null; renderIssueView();">
        <i data-lucide="arrow-left" class="w-4 h-4"></i>
        <span>${t('common.back') || 'Back'}</span>
      </button>
      <div class="queue-detail-title">
        <h3 class="font-mono text-lg">${escapeHtml(queue.id || queueId)}</h3>
        <div class="flex items-center gap-2">
          ${isActive ? '<span class="queue-active-badge">Active</span>' : ''}
          <span class="queue-status-badge ${escapeHtml(queue.status || '')}">${escapeHtml(queue.status || 'unknown')}</span>
        </div>
      </div>
      <div class="queue-detail-actions">
        ${!isActive && queue.status !== 'archived' ? `
          <button class="btn-primary" onclick="activateQueue('${safeQueueId}')">
            <i data-lucide="check-circle" class="w-4 h-4"></i>
            <span>${t('issues.activate') || 'Activate'}</span>
          </button>
        ` : ''}
        ${isActive ? `
          <button class="btn-secondary btn-warning" onclick="deactivateQueue('${safeQueueId}')">
            <i data-lucide="x-circle" class="w-4 h-4"></i>
            <span>${t('issues.deactivate') || 'Deactivate'}</span>
          </button>
        ` : ''}
        <button class="btn-secondary" onclick="refreshExpandedQueue('${safeQueueId}')">
          <i data-lucide="refresh-cw" class="w-4 h-4"></i>
        </button>
      </div>
    </div>

    <!-- Queue Stats -->
    <div class="queue-stats-grid mb-4">
      <div class="queue-stat-card">
        <span class="queue-stat-value">${isSolutionLevel ? (metadata.total_solutions || queueItems.length) : (metadata.total_tasks || queueItems.length)}</span>
        <span class="queue-stat-label">${isSolutionLevel ? 'Solutions' : 'Tasks'}</span>
      </div>
      <div class="queue-stat-card pending">
        <span class="queue-stat-value">${metadata.pending_count || queueItems.filter(i => i.status === 'pending').length}</span>
        <span class="queue-stat-label">Pending</span>
      </div>
      <div class="queue-stat-card executing">
        <span class="queue-stat-value">${metadata.executing_count || queueItems.filter(i => i.status === 'executing').length}</span>
        <span class="queue-stat-label">Executing</span>
      </div>
      <div class="queue-stat-card completed">
        <span class="queue-stat-value">${isSolutionLevel ? (metadata.completed_solutions || 0) : (metadata.completed_tasks || queueItems.filter(i => i.status === 'completed').length)}</span>
        <span class="queue-stat-label">Completed</span>
      </div>
      <div class="queue-stat-card failed">
        <span class="queue-stat-value">${metadata.failed_count || queueItems.filter(i => i.status === 'failed').length}</span>
        <span class="queue-stat-label">Failed</span>
      </div>
    </div>

    <div class="queue-info mb-4">
      <p class="text-sm text-muted-foreground">
        <i data-lucide="info" class="w-4 h-4 inline mr-1"></i>
        ${t('issues.reorderHint') || 'Drag items within a group to reorder. Click item to view details.'}
      </p>
    </div>

    <div class="queue-timeline">
      ${groups.map(group => renderQueueGroupWithDelete(group, groupedItems[group.id] || groupMap[group.id] || [], queueId)).join('')}
    </div>

    ${queue.conflicts && queue.conflicts.length > 0 ? renderConflictsSection(queue.conflicts) : ''}
  `;
}

// Async loader for expanded queue view - renders into DOM container
async function loadAndRenderExpandedQueue(queueId) {
  const wrapper = document.getElementById('queueExpandedWrapper');
  if (!wrapper) return;

  try {
    const html = await renderExpandedQueueView(queueId);
    wrapper.innerHTML = html;
    // Re-init icons and drag-drop after DOM update
    if (window.lucide) {
      window.lucide.createIcons();
    }
    // Initialize drag-drop for queue items
    initQueueDragDrop();
  } catch (err) {
    console.error('Failed to load expanded queue:', err);
    wrapper.innerHTML = `
      <div class="text-center py-8 text-red-500">
        <i data-lucide="alert-circle" class="w-8 h-8 mx-auto mb-2"></i>
        <p>Failed to load queue: ${escapeHtml(err.message || 'Unknown error')}</p>
        <button class="btn-secondary mt-4" onclick="queueData.expandedQueueId = null; renderIssueView();">
          <i data-lucide="arrow-left" class="w-4 h-4"></i> Back
        </button>
      </div>
    `;
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
}

function renderQueueGroupWithDelete(group, items, queueId) {
  const isParallel = group.type === 'parallel';
  const itemCount = group.solution_count || group.task_count || items.length;
  const itemLabel = group.solution_count ? 'solutions' : 'tasks';

  return `
    <div class="queue-group" data-group-id="${group.id}">
      <div class="queue-group-header">
        <div class="queue-group-type ${isParallel ? 'parallel' : 'sequential'}">
          <i data-lucide="${isParallel ? 'git-merge' : 'arrow-right'}" class="w-4 h-4"></i>
          ${group.id} (${isParallel ? 'Parallel' : 'Sequential'})
        </div>
        <span class="text-sm text-muted-foreground">${itemCount} ${itemLabel}</span>
      </div>
      <div class="queue-items ${isParallel ? 'parallel' : 'sequential'}">
        ${items.map((item, idx) => renderQueueItemWithDelete(item, idx, items.length, queueId)).join('')}
      </div>
    </div>
  `;
}

function renderQueueItemWithDelete(item, index, total, queueId) {
  const statusColors = {
    pending: '',
    ready: 'ready',
    executing: 'executing',
    completed: 'completed',
    failed: 'failed',
    blocked: 'blocked'
  };

  const isSolutionItem = item.task_count !== undefined;
  const safeItemId = escapeHtml(item.item_id || '');
  const safeIssueId = escapeHtml(item.issue_id || '');
  const safeQueueId = escapeHtml(queueId || '');
  const safeSolutionId = escapeHtml(item.solution_id || '');
  const safeTaskId = escapeHtml(item.task_id || '-');
  const safeFilesTouched = item.files_touched ? escapeHtml(item.files_touched.join(', ')) : '';
  const safeDependsOn = item.depends_on ? escapeHtml(item.depends_on.join(', ')) : '';

  return `
    <div class="queue-item ${statusColors[item.status] || ''}"
         draggable="true"
         data-item-id="${safeItemId}"
         data-group-id="${escapeHtml(item.execution_group || '')}"
         onclick="openQueueItemDetail('${safeItemId}')">
      <span class="queue-item-id font-mono text-xs">${safeItemId}</span>
      <span class="queue-item-issue text-xs text-muted-foreground">${safeIssueId}</span>
      ${isSolutionItem ? `
        <span class="queue-item-solution text-sm" title="${safeSolutionId}">
          <i data-lucide="package" class="w-3 h-3 inline mr-1"></i>
          ${item.task_count} tasks
        </span>
        ${item.files_touched && item.files_touched.length > 0 ? `
          <span class="queue-item-files text-xs text-muted-foreground" title="${safeFilesTouched}">
            <i data-lucide="file" class="w-3 h-3"></i>
            ${item.files_touched.length}
          </span>
        ` : ''}
      ` : `
        <span class="queue-item-task text-sm">${safeTaskId}</span>
      `}
      <span class="queue-item-priority" style="opacity: ${item.semantic_priority || 0.5}">
        <i data-lucide="arrow-up" class="w-3 h-3"></i>
      </span>
      ${item.depends_on && item.depends_on.length > 0 ? `
        <span class="queue-item-deps text-xs text-muted-foreground" title="Depends on: ${safeDependsOn}">
          <i data-lucide="link" class="w-3 h-3"></i>
        </span>
      ` : ''}
      ${renderQueueItemFailureInfo(item)}
      <button class="queue-item-delete btn-icon" onclick="event.stopPropagation(); deleteQueueItem('${safeQueueId}', '${safeItemId}')" title="Delete item">
        <i data-lucide="trash-2" class="w-3 h-3"></i>
      </button>
    </div>
  `;
}

// Render failure info for queue items
function renderQueueItemFailureInfo(item) {
  // Only show for failed items
  if (item.status !== 'failed') {
    return '';
  }

  // Check failure_details or failure_reason
  const failureDetails = item.failure_details;
  const failureReason = item.failure_reason;

  if (!failureDetails && !failureReason) {
    return '';
  }

  let errorType = 'error';
  let errorMessage = 'Unknown error';

  if (failureDetails) {
    errorType = failureDetails.error_type || 'error';
    errorMessage = failureDetails.message || 'Unknown error';
  } else if (failureReason) {
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(failureReason);
      errorType = parsed.error_type || 'error';
      errorMessage = parsed.message || failureReason;
    } catch {
      errorMessage = failureReason;
    }
  }

  return `
    <span class="queue-item-failure text-xs" title="${escapeHtml(errorMessage)}">
      <i data-lucide="alert-circle" class="w-3 h-3"></i>
      <span class="failure-type">${escapeHtml(errorType)}:</span>
      <span class="failure-msg">${escapeHtml(truncateText(errorMessage, 40))}</span>
    </span>
  `;
}

async function deleteQueueItem(queueId, itemId) {
  if (!confirm('Delete this item from queue?')) return;

  try {
    const response = await fetch('/api/queue/' + queueId + '/item/' + encodeURIComponent(itemId) + '?path=' + encodeURIComponent(projectPath), {
      method: 'DELETE'
    });
    const result = await response.json();

    if (result.success) {
      showNotification('Item deleted from queue', 'success');
      await Promise.all([loadQueueData(), loadAllQueues()]);
      renderIssueView();
    } else {
      showNotification(result.error || 'Failed to delete item', 'error');
    }
  } catch (err) {
    console.error('Failed to delete queue item:', err);
    showNotification('Failed to delete item', 'error');
  }
}

async function refreshExpandedQueue(queueId) {
  await Promise.all([loadQueueData(), loadAllQueues()]);
  renderIssueView();
}

// ========== Queue Merge Modal ==========
function showMergeQueueModal(sourceQueueId) {
  let modal = document.getElementById('mergeQueueModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'mergeQueueModal';
    modal.className = 'issue-modal';
    document.body.appendChild(modal);
  }

  const otherQueues = queueData.queues.filter(q =>
    q.id !== sourceQueueId && q.status !== 'archived'
  );

  const safeSourceId = escapeHtml(sourceQueueId || '');

  modal.innerHTML = `
    <div class="issue-modal-backdrop" onclick="hideMergeQueueModal()"></div>
    <div class="issue-modal-content" style="max-width: 500px;">
      <div class="issue-modal-header">
        <h3><i data-lucide="git-merge" class="w-5 h-5 inline mr-2"></i>Merge Queue</h3>
        <button class="btn-icon" onclick="hideMergeQueueModal()">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      <div class="issue-modal-body">
        <p class="mb-4">Merge <strong class="font-mono">${safeSourceId}</strong> into another queue:</p>
        ${otherQueues.length === 0 ? `
          <p class="text-muted-foreground text-center py-4">No other queues available for merging</p>
        ` : `
          <div class="form-group">
            <label>Target Queue</label>
            <select id="targetQueueSelect" class="w-full">
              ${otherQueues.map(q => `
                <option value="${escapeHtml(q.id)}">${escapeHtml(q.id)} (${q.total_solutions || q.total_tasks || 0} items)</option>
              `).join('')}
            </select>
          </div>
          <p class="text-sm text-muted-foreground mt-2">
            <i data-lucide="info" class="w-4 h-4 inline mr-1"></i>
            Items from source queue will be appended to target queue. Source queue will be archived.
          </p>
        `}
      </div>
      <div class="issue-modal-footer">
        <button class="btn-secondary" onclick="hideMergeQueueModal()">Cancel</button>
        ${otherQueues.length > 0 ? `
          <button class="btn-primary" onclick="executeQueueMerge('${safeSourceId}')">
            <i data-lucide="git-merge" class="w-4 h-4"></i>
            Merge
          </button>
        ` : ''}
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  lucide.createIcons();
}

function hideMergeQueueModal() {
  const modal = document.getElementById('mergeQueueModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

async function executeQueueMerge(sourceQueueId) {
  const targetQueueId = document.getElementById('targetQueueSelect')?.value;
  if (!targetQueueId) return;

  try {
    const response = await fetch('/api/queue/merge?path=' + encodeURIComponent(projectPath), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceQueueId, targetQueueId })
    });
    const result = await response.json();

    if (result.success) {
      showNotification('Merged ' + result.mergedItemCount + ' items into ' + targetQueueId, 'success');
      hideMergeQueueModal();
      queueData.expandedQueueId = null;
      await Promise.all([loadQueueData(), loadAllQueues()]);
      renderIssueView();
    } else {
      showNotification(result.error || 'Failed to merge queues', 'error');
    }
  } catch (err) {
    console.error('Failed to merge queues:', err);
    showNotification('Failed to merge queues', 'error');
  }
}

// ========== Queue Split Modal ==========
async function showSplitQueueModal(queueId) {
  let modal = document.getElementById('splitQueueModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'splitQueueModal';
    modal.className = 'issue-modal';
    document.body.appendChild(modal);
  }

  // Fetch queue details
  let queue;
  try {
    const response = await fetch('/api/queue/' + encodeURIComponent(queueId) + '?path=' + encodeURIComponent(projectPath));
    queue = await response.json();
    if (queue.error) throw new Error(queue.error);
  } catch (err) {
    showNotification('Failed to load queue details', 'error');
    return;
  }

  const safeQueueId = escapeHtml(queueId || '');
  const items = queue.solutions || queue.tasks || [];
  const isSolutionLevel = !!queue.solutions;

  // Group items by issue
  const issueGroups = {};
  items.forEach(item => {
    const issueId = item.issue_id || 'unknown';
    if (!issueGroups[issueId]) {
      issueGroups[issueId] = [];
    }
    issueGroups[issueId].push(item);
  });

  const issueIds = Object.keys(issueGroups);

  modal.innerHTML = `
    <div class="issue-modal-content split-queue-modal-content">
      <div class="issue-modal-header">
        <h3><i data-lucide="git-branch" class="w-5 h-5"></i> Split Queue: ${safeQueueId}</h3>
        <button class="issue-modal-close" onclick="hideSplitQueueModal()">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <div class="issue-modal-body">
        <p class="text-sm text-muted-foreground mb-4">
          Select issues and their solutions to split into a new queue. The remaining items will stay in the current queue.
        </p>

        ${issueIds.length === 0 ? `
          <p class="text-center text-muted-foreground py-4">No items to split</p>
        ` : `
          <div class="split-queue-controls mb-3">
            <button class="btn-sm btn-secondary" onclick="selectAllIssues()">
              <i data-lucide="check-square" class="w-3 h-3"></i> Select All
            </button>
            <button class="btn-sm btn-secondary" onclick="deselectAllIssues()">
              <i data-lucide="square" class="w-3 h-3"></i> Deselect All
            </button>
          </div>

          <div class="split-queue-issues">
            ${issueIds.map(issueId => {
              const issueItems = issueGroups[issueId];
              const safeIssueId = escapeHtml(issueId);
              return `
                <div class="split-queue-issue-group" data-issue-id="${safeIssueId}">
                  <div class="split-queue-issue-header">
                    <label class="flex items-center gap-2">
                      <input type="checkbox"
                             class="issue-checkbox"
                             data-issue-id="${safeIssueId}"
                             onchange="toggleIssueSelection('${safeIssueId}')">
                      <span class="font-medium">${safeIssueId}</span>
                      <span class="text-xs text-muted-foreground">(${issueItems.length} ${isSolutionLevel ? 'solution' : 'task'}${issueItems.length > 1 ? 's' : ''})</span>
                    </label>
                  </div>
                  <div class="split-queue-solutions ml-6">
                    ${issueItems.map(item => {
                      const itemId = item.item_id || item.solution_id || item.task_id || '';
                      const safeItemId = escapeHtml(itemId);
                      const displayName = isSolutionLevel
                        ? (item.solution_id || itemId)
                        : (item.task_id || itemId);
                      return `
                        <label class="flex items-center gap-2 py-1">
                          <input type="checkbox"
                                 class="solution-checkbox"
                                 data-issue-id="${safeIssueId}"
                                 data-item-id="${safeItemId}"
                                 value="${safeItemId}">
                          <span class="text-sm font-mono">${escapeHtml(displayName)}</span>
                          ${item.task_count ? `<span class="text-xs text-muted-foreground">(${item.task_count} tasks)</span>` : ''}
                        </label>
                      `;
                    }).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

      <div class="issue-modal-footer">
        <button class="btn-secondary" onclick="hideSplitQueueModal()">Cancel</button>
        ${issueIds.length > 0 ? `
          <button class="btn-primary" onclick="executeQueueSplit('${safeQueueId}')">
            <i data-lucide="git-branch" class="w-4 h-4"></i>
            <span>Split Queue</span>
          </button>
        ` : ''}
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  lucide.createIcons();
}

function hideSplitQueueModal() {
  const modal = document.getElementById('splitQueueModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function toggleIssueSelection(issueId) {
  const issueCheckbox = document.querySelector(`.issue-checkbox[data-issue-id="${issueId}"]`);
  const solutionCheckboxes = document.querySelectorAll(`.solution-checkbox[data-issue-id="${issueId}"]`);

  if (issueCheckbox && solutionCheckboxes) {
    solutionCheckboxes.forEach(cb => {
      cb.checked = issueCheckbox.checked;
    });
  }
}

function selectAllIssues() {
  const allCheckboxes = document.querySelectorAll('.split-queue-modal-content input[type="checkbox"]');
  allCheckboxes.forEach(cb => cb.checked = true);
}

function deselectAllIssues() {
  const allCheckboxes = document.querySelectorAll('.split-queue-modal-content input[type="checkbox"]');
  allCheckboxes.forEach(cb => cb.checked = false);
}

async function executeQueueSplit(sourceQueueId) {
  const selectedCheckboxes = document.querySelectorAll('.solution-checkbox:checked');
  const selectedItemIds = Array.from(selectedCheckboxes).map(cb => cb.value);

  if (selectedItemIds.length === 0) {
    showNotification('Please select at least one item to split', 'warning');
    return;
  }

  try {
    const response = await fetch('/api/queue/split?path=' + encodeURIComponent(projectPath), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceQueueId, itemIds: selectedItemIds })
    });
    const result = await response.json();

    if (result.success) {
      showNotification(`Split ${result.splitItemCount} items into new queue ${result.newQueueId}`, 'success');
      hideSplitQueueModal();
      queueData.expandedQueueId = null;
      await Promise.all([loadQueueData(), loadAllQueues()]);
      renderIssueView();
    } else {
      showNotification(result.error || 'Failed to split queue', 'error');
    }
  } catch (err) {
    console.error('Failed to split queue:', err);
    showNotification('Failed to split queue', 'error');
  }
}

// ========== Legacy Queue Render (for backward compatibility) ==========
function renderLegacyQueueSection() {
  const queue = issueData.queue;
  const queueItems = queue.solutions || queue.tasks || [];
  const isSolutionLevel = !!(queue.solutions && queue.solutions.length > 0);
  const metadata = queue._metadata || {};

  if (queueItems.length === 0) {
    return `<div class="queue-empty"><p>Queue is empty</p></div>`;
  }

  const groups = queue.execution_groups || [];
  let groupedItems = queue.grouped_items || {};

  if (groups.length === 0 && queueItems.length > 0) {
    const groupMap = {};
    queueItems.forEach(item => {
      const groupId = item.execution_group || 'default';
      if (!groupMap[groupId]) {
        groupMap[groupId] = [];
      }
      groupMap[groupId].push(item);
    });

    const syntheticGroups = Object.keys(groupMap).map(groupId => ({
      id: groupId,
      type: 'sequential',
      task_count: groupMap[groupId].length
    }));

    return `
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
async function openIssueDetail(issueId, isArchived = false) {
  const panel = document.getElementById('issueDetailPanel');
  if (!panel) return;

  panel.innerHTML = '<div class="p-8 text-center"><i data-lucide="loader-2" class="w-8 h-8 animate-spin mx-auto"></i></div>';
  panel.classList.remove('hidden');
  lucide.createIcons();

  let detail;
  if (isArchived) {
    // For archived issues, get detail from historyIssues (already loaded)
    const historyIssue = issueData.historyIssues.find(i => i.id === issueId);
    if (historyIssue) {
      // Mark as archived and provide minimal detail structure
      detail = {
        ...historyIssue,
        _isArchived: true,
        solutions: historyIssue.solutions || [],
        tasks: historyIssue.tasks || []
      };
    }
  } else {
    detail = await loadIssueDetail(issueId);
  }

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

      <!-- Failure History -->
      ${renderFailureHistoryDetail(issue)}

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

      <!-- Actions -->
      <div class="detail-section issue-detail-actions">
        <label class="detail-label">${t('issues.actions') || 'Actions'}</label>
        <div class="flex gap-2 flex-wrap">
          ${!issue._isArchived ? `
            <button class="btn-secondary btn-sm" onclick="confirmArchiveIssue('${issue.id}')">
              <i data-lucide="archive" class="w-4 h-4"></i>
              ${t('issues.archive') || 'Archive'}
            </button>
          ` : ''}
          <button class="btn-secondary btn-sm btn-danger" onclick="confirmDeleteIssue('${issue.id}', ${issue._isArchived || false})">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
            ${t('issues.delete') || 'Delete'}
          </button>
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

// ========== Issue Delete & Archive ==========
function confirmDeleteIssue(issueId, isArchived) {
  const msg = t('issues.confirmDeleteIssue') || 'Are you sure you want to delete this issue? This action cannot be undone.';
  if (confirm(msg)) {
    deleteIssue(issueId, isArchived);
  }
}

async function deleteIssue(issueId, isArchived) {
  try {
    const response = await fetch('/api/issues/' + encodeURIComponent(issueId) + '?path=' + encodeURIComponent(projectPath), {
      method: 'DELETE'
    });
    const result = await response.json();
    if (result.success) {
      showNotification(t('issues.issueDeleted') || 'Issue deleted successfully', 'success');
      closeIssueDetail();
      if (isArchived) {
        issueData.historyIssues = issueData.historyIssues.filter(i => i.id !== issueId);
      } else {
        issueData.issues = issueData.issues.filter(i => i.id !== issueId);
      }
      renderIssueView();
      updateIssueBadge();
    } else {
      showNotification(result.error || 'Failed to delete issue', 'error');
    }
  } catch (err) {
    console.error('Failed to delete issue:', err);
    showNotification('Failed to delete issue', 'error');
  }
}

function confirmArchiveIssue(issueId) {
  const msg = t('issues.confirmArchiveIssue') || 'Archive this issue? It will be moved to history.';
  if (confirm(msg)) {
    archiveIssue(issueId);
  }
}

async function archiveIssue(issueId) {
  try {
    const response = await fetch('/api/issues/' + encodeURIComponent(issueId) + '/archive?path=' + encodeURIComponent(projectPath), {
      method: 'POST'
    });
    const result = await response.json();
    if (result.success) {
      showNotification(t('issues.issueArchived') || 'Issue archived successfully', 'success');
      closeIssueDetail();
      await loadIssueData();
      renderIssueView();
      updateIssueBadge();
    } else {
      showNotification(result.error || 'Failed to archive issue', 'error');
    }
  } catch (err) {
    console.error('Failed to archive issue:', err);
    showNotification('Failed to archive issue', 'error');
  }
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

// Helper: escape regex special characters
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper: highlight matching text in search results
function highlightMatch(text, query) {
  if (!text || !query) return escapeHtml(text || '');
  const escaped = escapeHtml(text);
  const escapedQuery = escapeRegex(escapeHtml(query));
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
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
var searchDebounceTimer = null;

function handleIssueSearch(value) {
  issueData.searchQuery = value;

  // Update suggestions immediately (no debounce for dropdown)
  updateSearchSuggestions(value);
  issueData.showSuggestions = value.length > 0;
  issueData.selectedSuggestion = -1;
  updateSuggestionsDropdown();

  // Clear previous timer
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }

  // 300ms debounce for full re-render to prevent freeze on rapid input
  searchDebounceTimer = setTimeout(() => {
    renderIssueView();
    // Restore input focus and cursor position
    const input = document.getElementById('issueSearchInput');
    if (input) {
      input.focus();
      input.setSelectionRange(value.length, value.length);
    }
  }, 300);
}

function clearIssueSearch() {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }
  issueData.searchQuery = '';
  issueData.showSuggestions = false;
  issueData.searchSuggestions = [];
  issueData.selectedSuggestion = -1;
  renderIssueView();
}

// Update search suggestions based on query
function updateSearchSuggestions(query) {
  if (!query || query.length < 1) {
    issueData.searchSuggestions = [];
    return;
  }

  const q = query.toLowerCase();
  const allIssues = [...issueData.issues, ...issueData.historyIssues];

  // Find matching issues (max 6)
  issueData.searchSuggestions = allIssues
    .filter(issue => {
      const idMatch = issue.id.toLowerCase().includes(q);
      const titleMatch = issue.title && issue.title.toLowerCase().includes(q);
      const contextMatch = issue.context && issue.context.toLowerCase().includes(q);
      const solutionMatch = issue.solutions && issue.solutions.some(sol =>
        (sol.description && sol.description.toLowerCase().includes(q)) ||
        (sol.approach && sol.approach.toLowerCase().includes(q))
      );
      return idMatch || titleMatch || contextMatch || solutionMatch;
    })
    .slice(0, 6);
}

// Render search suggestions dropdown
function renderSearchSuggestions() {
  if (!issueData.searchSuggestions || issueData.searchSuggestions.length === 0) {
    return '';
  }

  return issueData.searchSuggestions.map((issue, index) => `
    <div class="search-suggestion-item ${index === issueData.selectedSuggestion ? 'selected' : ''}"
         onclick="selectSuggestion(${index})"
         onmouseenter="issueData.selectedSuggestion = ${index}">
      <div class="suggestion-id">${highlightMatch(issue.id, issueData.searchQuery)}</div>
      <div class="suggestion-title">${highlightMatch(issue.title || issue.id, issueData.searchQuery)}</div>
    </div>
  `).join('');
}

// Show search suggestions
function showSearchSuggestions() {
  if (issueData.searchQuery) {
    updateSearchSuggestions(issueData.searchQuery);
    issueData.showSuggestions = true;
    updateSuggestionsDropdown();
  }
}

// Hide search suggestions
function hideSearchSuggestions() {
  issueData.showSuggestions = false;
  issueData.selectedSuggestion = -1;
  const dropdown = document.getElementById('searchSuggestions');
  if (dropdown) {
    dropdown.classList.remove('show');
  }
}

// Update suggestions dropdown without full re-render
function updateSuggestionsDropdown() {
  const dropdown = document.getElementById('searchSuggestions');
  if (dropdown) {
    dropdown.innerHTML = renderSearchSuggestions();
    if (issueData.showSuggestions && issueData.searchSuggestions.length > 0) {
      dropdown.classList.add('show');
    } else {
      dropdown.classList.remove('show');
    }
  }
}

// Select a suggestion
function selectSuggestion(index) {
  const issue = issueData.searchSuggestions[index];
  if (issue) {
    hideSearchSuggestions();
    openIssueDetail(issue.id, issue._isArchived);
  }
}

// Handle keyboard navigation in search
function handleSearchKeydown(event) {
  const suggestions = issueData.searchSuggestions || [];

  if (!issueData.showSuggestions || suggestions.length === 0) {
    // If Enter and no suggestions, just search
    if (event.key === 'Enter') {
      hideSearchSuggestions();
    }
    return;
  }

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      issueData.selectedSuggestion = Math.min(
        issueData.selectedSuggestion + 1,
        suggestions.length - 1
      );
      updateSuggestionsDropdown();
      break;

    case 'ArrowUp':
      event.preventDefault();
      issueData.selectedSuggestion = Math.max(issueData.selectedSuggestion - 1, -1);
      updateSuggestionsDropdown();
      break;

    case 'Enter':
      event.preventDefault();
      if (issueData.selectedSuggestion >= 0) {
        selectSuggestion(issueData.selectedSuggestion);
      } else {
        hideSearchSuggestions();
      }
      break;

    case 'Escape':
      hideSearchSuggestions();
      break;
  }
}

// Close suggestions when clicking outside
document.addEventListener('click', function(event) {
  const searchContainer = document.querySelector('.issue-search');
  if (searchContainer && !searchContainer.contains(event.target)) {
    hideSearchSuggestions();
  }
});

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

// ========== Pull Issues Modal ==========
function showPullIssuesModal() {
  const modal = document.getElementById('pullIssuesModal');
  if (modal) {
    modal.classList.remove('hidden');
    // Reset result area
    const resultDiv = document.getElementById('pullIssueResult');
    if (resultDiv) {
      resultDiv.classList.add('hidden');
      resultDiv.innerHTML = '';
    }
    lucide.createIcons();
  }
}

function hidePullIssuesModal() {
  const modal = document.getElementById('pullIssuesModal');
  if (modal) {
    modal.classList.add('hidden');
    // Clear form
    const stateSelect = document.getElementById('pullIssueState');
    const limitInput = document.getElementById('pullIssueLimit');
    const labelsInput = document.getElementById('pullIssueLabels');
    const downloadImagesCheck = document.getElementById('pullDownloadImages');
    if (stateSelect) stateSelect.value = 'open';
    if (limitInput) limitInput.value = '20';
    if (labelsInput) labelsInput.value = '';
    if (downloadImagesCheck) downloadImagesCheck.checked = true;
  }
}

async function pullGitHubIssues() {
  const stateSelect = document.getElementById('pullIssueState');
  const limitInput = document.getElementById('pullIssueLimit');
  const labelsInput = document.getElementById('pullIssueLabels');
  const downloadImagesCheck = document.getElementById('pullDownloadImages');
  const resultDiv = document.getElementById('pullIssueResult');
  const pullBtn = document.getElementById('pullIssuesBtn');

  const state = stateSelect?.value || 'open';
  const limit = parseInt(limitInput?.value || '20');
  const labels = labelsInput?.value?.trim();
  const downloadImages = downloadImagesCheck?.checked || false;

  // Disable button and show loading
  if (pullBtn) {
    pullBtn.disabled = true;
    pullBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 mr-1 animate-spin"></i>' + (t('common.loading') || 'Loading...');
    lucide.createIcons();
  }

  try {
    const params = new URLSearchParams({
      path: projectPath,
      state: state,
      limit: limit.toString(),
      downloadImages: downloadImages.toString()
    });
    if (labels) params.set('labels', labels);

    const response = await fetch('/api/issues/pull?' + params.toString(), {
      method: 'POST'
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      showNotification(result.error || 'Failed to pull issues', 'error');
      if (resultDiv) {
        resultDiv.classList.remove('hidden');
        resultDiv.innerHTML = `<p class="text-destructive">${result.error || 'Failed to pull issues'}</p>`;
      }
      return;
    }

    // Show results
    if (resultDiv) {
      resultDiv.classList.remove('hidden');
      resultDiv.innerHTML = `
        <div class="flex items-start gap-2">
          <i data-lucide="check-circle" class="w-5 h-5 text-success mt-0.5"></i>
          <div class="flex-1">
            <p class="font-medium mb-2">${t('issues.pullSuccess') || 'GitHub Issues Pulled Successfully'}</p>
            <div class="text-sm text-muted-foreground space-y-1">
              <p>✓ Imported: <strong>${result.imported || 0}</strong> new issues</p>
              <p>✓ Updated: <strong>${result.updated || 0}</strong> existing issues</p>
              <p>✓ Skipped: <strong>${result.skipped || 0}</strong> unchanged issues</p>
              ${result.images_downloaded > 0 ? `<p>✓ Downloaded: <strong>${result.images_downloaded}</strong> images</p>` : ''}
            </div>
          </div>
        </div>
      `;
      lucide.createIcons();
    }

    showNotification(`Pulled ${result.imported + result.updated} issues from GitHub`, 'success');

    // Reload data after 1 second
    setTimeout(async () => {
      await loadIssueData();
      renderIssueView();
      hidePullIssuesModal();
    }, 1500);

  } catch (err) {
    console.error('Failed to pull issues:', err);
    showNotification('Failed to pull issues', 'error');
    if (resultDiv) {
      resultDiv.classList.remove('hidden');
      resultDiv.innerHTML = `<p class="text-destructive">${err.message || 'Unknown error occurred'}</p>`;
    }
  } finally {
    // Re-enable button
    if (pullBtn) {
      pullBtn.disabled = false;
      pullBtn.innerHTML = '<i data-lucide="download" class="w-4 h-4 mr-1"></i>' + (t('issues.pull') || 'Pull');
      lucide.createIcons();
    }
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
