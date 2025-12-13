// CLI History View
// Standalone view for CLI execution history with resume support

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
      var isResume = exec.prompt_preview && exec.prompt_preview.includes('[Resume session');

      var sourceDirHtml = exec.sourceDir && exec.sourceDir !== '.'
        ? '<span class="history-source-dir"><i data-lucide="folder" class="w-3 h-3"></i> ' + escapeHtml(exec.sourceDir) + '</span>'
        : '';

      var resumeBadge = isResume ? '<span class="history-resume-badge"><i data-lucide="rotate-ccw" class="w-3 h-3"></i></span>' : '';

      historyHtml += '<div class="history-item' + (isResume ? ' history-item-resume' : '') + '" onclick="showExecutionDetail(\'' + exec.id + (exec.sourceDir ? '\',\'' + escapeHtml(exec.sourceDir) : '') + '\')">' +
        '<div class="history-item-main">' +
          '<div class="history-item-header">' +
            '<span class="history-tool-tag tool-' + exec.tool + '">' + exec.tool + '</span>' +
            '<span class="history-mode-tag">' + (exec.mode || 'analysis') + '</span>' +
            resumeBadge +
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
            '<span class="history-id"><i data-lucide="hash" class="w-3 h-3"></i> ' + exec.id.split('-')[0] + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="history-item-actions">' +
          '<button class="btn-icon btn-resume" onclick="event.stopPropagation(); promptResumeExecution(\'' + exec.id + '\', \'' + exec.tool + '\')" title="Resume">' +
            '<i data-lucide="play" class="w-4 h-4"></i>' +
          '</button>' +
          '<button class="btn-icon" onclick="event.stopPropagation(); showExecutionDetail(\'' + exec.id + '\')" title="View Details">' +
            '<i data-lucide="eye" class="w-4 h-4"></i>' +
          '</button>' +
          '<button class="btn-icon btn-danger" onclick="event.stopPropagation(); confirmDeleteExecution(\'' + exec.id + '\')" title="Delete">' +
            '<i data-lucide="trash-2" class="w-4 h-4"></i>' +
          '</button>' +
        '</div>' +
      '</div>';
    }
    historyHtml += '</div>';
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
        '<button class="btn-icon" onclick="refreshCliHistoryView()" title="Refresh">' +
          '<i data-lucide="refresh-cw" class="w-4 h-4"></i>' +
        '</button>' +
      '</div>' +
    '</div>' +
    historyHtml +
  '</div>';

  // Initialize Lucide icons
  if (window.lucide) lucide.createIcons();
}

// ========== Actions ==========
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

// ========== Resume Execution ==========
function promptResumeExecution(executionId, tool) {
  var modalContent = '<div class="resume-modal">' +
    '<p>Resume this ' + tool + ' session with an optional continuation prompt:</p>' +
    '<textarea id="resumePromptInput" class="resume-prompt-input" placeholder="Continue from where we left off... (optional)" rows="3"></textarea>' +
    '<div class="resume-modal-actions">' +
      '<button class="btn btn-outline" onclick="closeModal()">Cancel</button>' +
      '<button class="btn btn-primary" onclick="executeResume(\'' + executionId + '\', \'' + tool + '\')">' +
        '<i data-lucide="play" class="w-4 h-4"></i> Resume' +
      '</button>' +
    '</div>' +
  '</div>';

  showModal('Resume Session', modalContent);
}

async function executeResume(executionId, tool) {
  var promptInput = document.getElementById('resumePromptInput');
  var additionalPrompt = promptInput ? promptInput.value.trim() : '';

  closeModal();
  showRefreshToast('Resuming session...', 'info');

  try {
    var response = await fetch('/api/cli/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        executionId: executionId,
        tool: tool,
        prompt: additionalPrompt || undefined
      })
    });

    var result = await response.json();

    if (result.success) {
      showRefreshToast('Session resumed successfully', 'success');
      // Refresh history to show new execution
      await refreshCliHistoryView();
    } else {
      showRefreshToast('Resume failed: ' + (result.error || 'Unknown error'), 'error');
    }
  } catch (err) {
    console.error('Resume failed:', err);
    showRefreshToast('Resume failed: ' + err.message, 'error');
  }
}

async function resumeLastSession(tool) {
  showRefreshToast('Resuming last ' + (tool || '') + ' session...', 'info');

  try {
    var response = await fetch('/api/cli/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: tool || undefined,
        last: true
      })
    });

    var result = await response.json();

    if (result.success) {
      showRefreshToast('Session resumed successfully', 'success');
      await refreshCliHistoryView();
    } else {
      showRefreshToast('Resume failed: ' + (result.error || 'Unknown error'), 'error');
    }
  } catch (err) {
    console.error('Resume failed:', err);
    showRefreshToast('Resume failed: ' + err.message, 'error');
  }
}
