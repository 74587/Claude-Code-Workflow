// ==========================================
// ISSUE MANAGER VIEW
// Manages issues, solutions, and execution queue
// ==========================================

// ========== Issue State ==========
var issueData = {
  issues: [],
  queue: { queue: [], conflicts: [], execution_groups: [], grouped_items: {} },
  selectedIssue: null,
  selectedSolution: null,
  statusFilter: 'all',
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
    issueData.queue = { queue: [], conflicts: [], execution_groups: [], grouped_items: {} };
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
  const filteredIssues = issueData.statusFilter === 'all'
    ? issues
    : issues.filter(i => i.status === issueData.statusFilter);

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

      ${issueData.viewMode === 'issues' ? renderIssueListSection(filteredIssues) : renderQueueSection()}

      <!-- Detail Panel -->
      <div id="issueDetailPanel" class="issue-detail-panel hidden"></div>
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

  return `
    <!-- Filters -->
    <div class="issue-filters mb-4">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-sm text-muted-foreground">${t('issues.filterStatus') || 'Status'}:</span>
        ${statuses.map(status => `
          <button class="issue-filter-btn ${issueData.statusFilter === status ? 'active' : ''}"
                  onclick="filterIssuesByStatus('${status}')">
            ${status === 'all' ? (t('issues.filterAll') || 'All') : status}
          </button>
        `).join('')}
      </div>
    </div>

    <!-- Issues Grid -->
    <div class="issues-grid">
      ${issues.length === 0 ? `
        <div class="issue-empty">
          <i data-lucide="inbox" class="w-12 h-12 text-muted-foreground mb-4"></i>
          <p class="text-muted-foreground">${t('issues.noIssues') || 'No issues found'}</p>
          <p class="text-sm text-muted-foreground mt-2">${t('issues.createHint') || 'Create issues using: ccw issue init <id>'}</p>
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
  const groups = queue.execution_groups || [];
  const groupedItems = queue.grouped_items || {};

  if (groups.length === 0 && (!queue.queue || queue.queue.length === 0)) {
    return `
      <div class="queue-empty">
        <i data-lucide="git-branch" class="w-12 h-12 text-muted-foreground mb-4"></i>
        <p class="text-muted-foreground">${t('issues.queueEmpty') || 'Queue is empty'}</p>
        <p class="text-sm text-muted-foreground mt-2">Run /issue:queue to form execution queue</p>
      </div>
    `;
  }

  return `
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

  return `
    <div class="queue-group" data-group-id="${group.id}">
      <div class="queue-group-header">
        <div class="queue-group-type ${isParallel ? 'parallel' : 'sequential'}">
          <i data-lucide="${isParallel ? 'git-merge' : 'arrow-right'}" class="w-4 h-4"></i>
          ${group.id} (${isParallel ? t('issues.parallelGroup') || 'Parallel' : t('issues.sequentialGroup') || 'Sequential'})
        </div>
        <span class="text-sm text-muted-foreground">${group.task_count} tasks</span>
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

  return `
    <div class="queue-item ${statusColors[item.status] || ''}"
         draggable="true"
         data-queue-id="${item.queue_id}"
         data-group-id="${item.execution_group}"
         onclick="openQueueItemDetail('${item.queue_id}')">
      <span class="queue-item-id font-mono text-xs">${item.queue_id}</span>
      <span class="queue-item-issue text-xs text-muted-foreground">${item.issue_id}</span>
      <span class="queue-item-task text-sm">${item.task_id}</span>
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
            <span class="conflict-tasks text-xs text-muted-foreground">${c.tasks.join(' → ')}</span>
            <span class="conflict-status ${c.resolved ? 'resolved' : 'pending'}">
              ${c.resolved ? 'Resolved' : 'Pending'}
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

  issueDragState.dragging = item.dataset.queueId;
  issueDragState.groupId = item.dataset.groupId;

  item.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', item.dataset.queueId);
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
  if (!target || target.dataset.queueId === issueDragState.dragging) return;

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
  const draggedItem = items.find(i => i.dataset.queueId === issueDragState.dragging);
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
  const newOrder = Array.from(container.querySelectorAll('.queue-item')).map(i => i.dataset.queueId);
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
          ${(issue.solutions || []).map(sol => `
            <div class="solution-item ${sol.is_bound ? 'bound' : ''}" onclick="toggleSolutionExpand('${sol.id}')">
              <div class="solution-header">
                <span class="solution-id font-mono text-xs">${sol.id}</span>
                ${sol.is_bound ? '<span class="solution-bound-badge">Bound</span>' : ''}
                <span class="solution-tasks text-xs">${sol.tasks?.length || 0} tasks</span>
              </div>
              <div class="solution-tasks-list hidden" id="solution-${sol.id}">
                ${(sol.tasks || []).map(task => `
                  <div class="task-item">
                    <span class="task-id font-mono">${task.id}</span>
                    <span class="task-action ${task.action?.toLowerCase() || ''}">${task.action || 'Unknown'}</span>
                    <span class="task-title">${task.title || ''}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('') || '<p class="text-sm text-muted-foreground">No solutions</p>'}
        </div>
      </div>

      <!-- Tasks (from tasks.jsonl) -->
      <div class="detail-section">
        <label class="detail-label">${t('issues.tasks') || 'Tasks'} (${issue.tasks?.length || 0})</label>
        <div class="tasks-list">
          ${(issue.tasks || []).map(task => `
            <div class="task-item-detail">
              <div class="flex items-center justify-between">
                <span class="font-mono text-sm">${task.id}</span>
                <select class="task-status-select" onchange="updateTaskStatus('${issue.id}', '${task.id}', this.value)">
                  ${['pending', 'ready', 'in_progress', 'completed', 'failed', 'paused', 'skipped'].map(s =>
                    `<option value="${s}" ${task.status === s ? 'selected' : ''}>${s}</option>`
                  ).join('')}
                </select>
              </div>
              <p class="task-title-detail">${task.title || task.description || ''}</p>
            </div>
          `).join('') || '<p class="text-sm text-muted-foreground">No tasks</p>'}
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

function openQueueItemDetail(queueId) {
  const item = issueData.queue.queue?.find(q => q.queue_id === queueId);
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
