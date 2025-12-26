// CLI History View
// Standalone view for CLI execution history with batch delete support

// ========== Multi-Select State ==========
var selectedExecutions = new Set();
var isMultiSelectMode = false;

// ========== Rendering ==========
async function renderCliHistoryView() {
  var container = document.getElementById('mainContent');
  if (!container) return;

  // Hide stats grid and search for History view
  var statsGrid = document.getElementById('statsGrid');
  var searchInput = document.getElementById('searchInput');
  if (statsGrid) statsGrid.style.display = 'none';
  if (searchInput) searchInput.parentElement.style.display = 'none';

  // Load history data
  await loadCliHistory();

  // Filter by search query
  var filteredHistory = cliHistorySearch
    ? cliExecutionHistory.filter(function(exec) {
        return exec.prompt_preview.toLowerCase().includes(cliHistorySearch.toLowerCase()) ||
               exec.tool.toLowerCase().includes(cliHistorySearch.toLowerCase());
      })
    : cliExecutionHistory;

  var historyHtml = '';

  if (cliExecutionHistory.length === 0) {
    historyHtml = '<div class="history-empty-state">' +
      '<i data-lucide="terminal" class="w-12 h-12"></i>' +
      '<h3>No executions yet</h3>' +
      '<p>CLI execution history will appear here</p>' +
    '</div>';
  } else if (filteredHistory.length === 0) {
    historyHtml = '<div class="history-empty-state">' +
      '<i data-lucide="search-x" class="w-10 h-10"></i>' +
      '<h3>No matching results</h3>' +
      '<p>Try adjusting your search or filter</p>' +
    '</div>';
  } else {
    historyHtml = '<div class="history-list">';
    for (var i = 0; i < filteredHistory.length; i++) {
      var exec = filteredHistory[i];
      var statusIcon = exec.status === 'success' ? 'check-circle' :
                       exec.status === 'timeout' ? 'clock' : 'x-circle';
      var statusClass = exec.status === 'success' ? 'success' :
                        exec.status === 'timeout' ? 'warning' : 'error';
      var duration = formatDuration(exec.duration_ms);
      var timeAgo = getTimeAgo(new Date(exec.timestamp));
      var isSelected = selectedExecutions.has(exec.id);

      // Turn count badge for multi-turn conversations
      var turnBadge = exec.turn_count && exec.turn_count > 1
        ? '<span class="history-turn-badge"><i data-lucide="messages-square" class="w-3 h-3"></i> ' + exec.turn_count + '</span>'
        : '';

      var sourceDirHtml = exec.sourceDir && exec.sourceDir !== '.'
        ? '<span class="history-source-dir"><i data-lucide="folder" class="w-3 h-3"></i> ' + escapeHtml(exec.sourceDir) + '</span>'
        : '';

      // Multi-select checkbox
      var checkboxHtml = isMultiSelectMode
        ? '<div class="history-checkbox-wrapper" onclick="event.stopPropagation(); toggleExecutionSelection(\'' + exec.id + '\')">' +
            '<input type="checkbox" class="history-checkbox" ' + (isSelected ? 'checked' : '') + ' tabindex="-1">' +
          '</div>'
        : '';

      // Normalize sourceDir: convert backslashes to forward slashes for safe onclick handling
      var normalizedSourceDir = (exec.sourceDir || '').replace(/\\/g, '/');
      historyHtml += '<div class="history-item' + (isSelected ? ' history-item-selected' : '') + '" ' +
        'onclick="' + (isMultiSelectMode ? 'toggleExecutionSelection(\'' + exec.id + '\')' : 'showExecutionDetail(\'' + exec.id + '\', \'' + normalizedSourceDir.replace(/'/g, "\\'") + '\')') + '">' +
        checkboxHtml +
        '<div class="history-item-main">' +
          '<div class="history-item-header">' +
            '<span class="history-tool-tag tool-' + exec.tool + '">' + exec.tool + '</span>' +
            '<span class="history-mode-tag">' + (exec.mode || 'analysis') + '</span>' +
            turnBadge +
            sourceDirHtml +
            '<span class="history-status ' + statusClass + '">' +
              '<i data-lucide="' + statusIcon + '" class="w-3.5 h-3.5"></i>' +
              exec.status +
            '</span>' +
          '</div>' +
          '<div class="history-item-prompt">' + escapeHtml(exec.prompt_preview) + '</div>' +
          '<div class="history-item-meta">' +
            '<span class="history-time"><i data-lucide="clock" class="w-3 h-3"></i> ' + timeAgo + '</span>' +
            '<span class="history-duration"><i data-lucide="timer" class="w-3 h-3"></i> ' + duration + '</span>' +
            '<span class="history-id" title="' + exec.id + '"><i data-lucide="hash" class="w-3 h-3"></i> ' + exec.id.substring(0, 13) + '...' + exec.id.split('-').pop() + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="history-item-actions">' +
          '<button class="btn-icon" onclick="event.stopPropagation(); copyExecutionId(\'' + exec.id + '\')" title="Copy ID">' +
            '<i data-lucide="copy" class="w-4 h-4"></i>' +
          '</button>' +
          '<button class="btn-icon" onclick="event.stopPropagation(); showExecutionDetail(\'' + exec.id + '\', \'' + normalizedSourceDir.replace(/'/g, "\\'") + '\')" title="View Details">' +
            '<i data-lucide="eye" class="w-4 h-4"></i>' +
          '</button>' +
          '<button class="btn-icon btn-danger" onclick="event.stopPropagation(); confirmDeleteExecution(\'' + exec.id + '\', \'' + normalizedSourceDir.replace(/'/g, "\\'") + '\')" title="Delete">' +
            '<i data-lucide="trash-2" class="w-4 h-4"></i>' +
          '</button>' +
        '</div>' +
      '</div>';
    }
    historyHtml += '</div>';
  }

  // Build batch actions bar
  var batchActionsHtml = '';
  if (isMultiSelectMode) {
    batchActionsHtml = '<div class="history-batch-actions">' +
      '<span class="batch-select-count">' + selectedExecutions.size + ' selected</span>' +
      '<button class="btn btn-sm btn-outline" onclick="selectAllExecutions()">' +
        '<i data-lucide="check-square" class="w-3.5 h-3.5"></i> Select All' +
      '</button>' +
      '<button class="btn btn-sm btn-outline" onclick="clearExecutionSelection()">' +
        '<i data-lucide="square" class="w-3.5 h-3.5"></i> Clear' +
      '</button>' +
      '<button class="btn btn-sm btn-danger" onclick="confirmBatchDelete()" ' + (selectedExecutions.size === 0 ? 'disabled' : '') + '>' +
        '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Delete Selected' +
      '</button>' +
      '<button class="btn btn-sm btn-outline" onclick="exitMultiSelectMode()">' +
        '<i data-lucide="x" class="w-3.5 h-3.5"></i> Cancel' +
      '</button>' +
    '</div>';
  }

  container.innerHTML = '<div class="history-view">' +
    '<div class="history-header">' +
      '<div class="history-header-left">' +
        '<span class="history-count">' + cliExecutionHistory.length + ' execution' + (cliExecutionHistory.length !== 1 ? 's' : '') + '</span>' +
      '</div>' +
      '<div class="history-header-right">' +
        '<div class="history-search-wrapper">' +
          '<i data-lucide="search" class="w-4 h-4"></i>' +
          '<input type="text" class="history-search-input" placeholder="Search executions..." ' +
            'value="' + escapeHtml(cliHistorySearch) + '" ' +
            'onkeyup="searchCliHistoryView(this.value)" oninput="searchCliHistoryView(this.value)">' +
        '</div>' +
        '<select class="history-filter-select" onchange="filterCliHistoryView(this.value)">' +
          '<option value=""' + (cliHistoryFilter === null ? ' selected' : '') + '>All Tools</option>' +
          '<option value="gemini"' + (cliHistoryFilter === 'gemini' ? ' selected' : '') + '>Gemini</option>' +
          '<option value="qwen"' + (cliHistoryFilter === 'qwen' ? ' selected' : '') + '>Qwen</option>' +
          '<option value="codex"' + (cliHistoryFilter === 'codex' ? ' selected' : '') + '>Codex</option>' +
        '</select>' +
        // Batch delete dropdown
        '<div class="history-delete-dropdown">' +
          '<button class="btn-icon" onclick="toggleDeleteDropdown(event)" title="Delete Options">' +
            '<i data-lucide="trash" class="w-4 h-4"></i>' +
          '</button>' +
          '<div class="delete-dropdown-menu" id="deleteDropdownMenu">' +
            '<button onclick="enterMultiSelectMode()">' +
              '<i data-lucide="check-square" class="w-3.5 h-3.5"></i> Multi-select Delete' +
            '</button>' +
            '<button onclick="confirmDeleteByTool(\'gemini\')">' +
              '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Delete All Gemini' +
            '</button>' +
            '<button onclick="confirmDeleteByTool(\'qwen\')">' +
              '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Delete All Qwen' +
            '</button>' +
            '<button onclick="confirmDeleteByTool(\'codex\')">' +
              '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Delete All Codex' +
            '</button>' +
            '<div class="dropdown-divider"></div>' +
            '<button class="delete-all-btn" onclick="confirmDeleteAll()">' +
              '<i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i> Delete All History' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<button class="btn-icon" onclick="refreshCliHistoryView()" title="Refresh">' +
          '<i data-lucide="refresh-cw" class="w-4 h-4"></i>' +
        '</button>' +
      '</div>' +
    '</div>' +
    batchActionsHtml +
    historyHtml +
  '</div>';

  // Initialize Lucide icons
  if (window.lucide) lucide.createIcons();
}

// ========== Actions ==========
async function copyExecutionId(executionId) {
  try {
    await navigator.clipboard.writeText(executionId);
    showRefreshToast('ID copied: ' + executionId, 'success');
  } catch (err) {
    console.error('Failed to copy ID:', err);
    showRefreshToast('Failed to copy ID', 'error');
  }
}

async function filterCliHistoryView(tool) {
  cliHistoryFilter = tool || null;
  await loadCliHistory();
  renderCliHistoryView();
}

function searchCliHistoryView(query) {
  cliHistorySearch = query;
  renderCliHistoryView();
  // Preserve focus and cursor position
  var searchInput = document.querySelector('.history-search-input');
  if (searchInput) {
    searchInput.focus();
    searchInput.setSelectionRange(query.length, query.length);
  }
}

async function refreshCliHistoryView() {
  await loadCliHistory();
  renderCliHistoryView();
  showRefreshToast('History refreshed', 'success');
}

// ========== Multi-Select Functions ==========
function toggleDeleteDropdown(event) {
  event.stopPropagation();
  var menu = document.getElementById('deleteDropdownMenu');
  if (menu) {
    menu.classList.toggle('show');
    // Close on outside click
    if (menu.classList.contains('show')) {
      setTimeout(function() {
        document.addEventListener('click', closeDeleteDropdown);
      }, 0);
    }
  }
}

function closeDeleteDropdown() {
  var menu = document.getElementById('deleteDropdownMenu');
  if (menu) menu.classList.remove('show');
  document.removeEventListener('click', closeDeleteDropdown);
}

function enterMultiSelectMode() {
  closeDeleteDropdown();
  isMultiSelectMode = true;
  selectedExecutions.clear();
  renderCliHistoryView();
}

function exitMultiSelectMode() {
  isMultiSelectMode = false;
  selectedExecutions.clear();
  renderCliHistoryView();
}

function toggleExecutionSelection(executionId) {
  if (selectedExecutions.has(executionId)) {
    selectedExecutions.delete(executionId);
  } else {
    selectedExecutions.add(executionId);
  }
  renderCliHistoryView();
}

function selectAllExecutions() {
  var filteredHistory = cliHistorySearch
    ? cliExecutionHistory.filter(function(exec) {
        return exec.prompt_preview.toLowerCase().includes(cliHistorySearch.toLowerCase()) ||
               exec.tool.toLowerCase().includes(cliHistorySearch.toLowerCase());
      })
    : cliExecutionHistory;

  filteredHistory.forEach(function(exec) {
    selectedExecutions.add(exec.id);
  });
  renderCliHistoryView();
}

function clearExecutionSelection() {
  selectedExecutions.clear();
  renderCliHistoryView();
}

// ========== Batch Delete Functions ==========
function confirmBatchDelete() {
  var count = selectedExecutions.size;
  if (count === 0) return;

  if (confirm('Delete ' + count + ' selected execution' + (count > 1 ? 's' : '') + '? This action cannot be undone.')) {
    batchDeleteExecutions(Array.from(selectedExecutions));
  }
}

function confirmDeleteByTool(tool) {
  closeDeleteDropdown();
  var toolExecutions = cliExecutionHistory.filter(function(exec) { return exec.tool === tool; });
  var count = toolExecutions.length;

  if (count === 0) {
    showRefreshToast('No ' + tool + ' executions to delete', 'info');
    return;
  }

  if (confirm('Delete all ' + count + ' ' + tool + ' execution' + (count > 1 ? 's' : '') + '? This action cannot be undone.')) {
    var ids = toolExecutions.map(function(exec) { return exec.id; });
    batchDeleteExecutions(ids);
  }
}

function confirmDeleteAll() {
  closeDeleteDropdown();
  var count = cliExecutionHistory.length;

  if (count === 0) {
    showRefreshToast('No executions to delete', 'info');
    return;
  }

  if (confirm('Delete ALL ' + count + ' execution' + (count > 1 ? 's' : '') + '? This action cannot be undone.')) {
    var ids = cliExecutionHistory.map(function(exec) { return exec.id; });
    batchDeleteExecutions(ids);
  }
}

async function batchDeleteExecutions(ids) {
  showRefreshToast('Deleting ' + ids.length + ' executions...', 'info');

  try {
    var response = await fetch('/api/cli/batch-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: projectPath,
        ids: ids
      })
    });

    var result = await response.json();

    if (result.success) {
      showRefreshToast('Deleted ' + result.deleted + ' execution' + (result.deleted > 1 ? 's' : ''), 'success');
      // Exit multi-select mode and refresh
      isMultiSelectMode = false;
      selectedExecutions.clear();
      await loadCliHistory();
      renderCliHistoryView();
    } else {
      showRefreshToast('Delete failed: ' + (result.error || 'Unknown error'), 'error');
    }
  } catch (err) {
    console.error('Batch delete failed:', err);
    showRefreshToast('Delete failed: ' + err.message, 'error');
  }
}
