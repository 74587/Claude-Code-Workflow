// CLI History Component
// Displays execution history with filtering, search, and delete

// ========== CLI History State ==========
let cliExecutionHistory = [];
let cliHistoryFilter = null; // Filter by tool
let cliHistorySearch = ''; // Search query
let cliHistoryLimit = 50;

// ========== Data Loading ==========
async function loadCliHistory(options = {}) {
  try {
    const { limit = cliHistoryLimit, tool = cliHistoryFilter, status = null } = options;

    let url = `/api/cli/history?path=${encodeURIComponent(projectPath)}&limit=${limit}`;
    if (tool) url += `&tool=${tool}`;
    if (status) url += `&status=${status}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to load CLI history');
    const data = await response.json();
    cliExecutionHistory = data.executions || [];

    return data;
  } catch (err) {
    console.error('Failed to load CLI history:', err);
    return { executions: [], total: 0, count: 0 };
  }
}

async function loadExecutionDetail(executionId) {
  try {
    const url = `/api/cli/execution?path=${encodeURIComponent(projectPath)}&id=${encodeURIComponent(executionId)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Execution not found');
    return await response.json();
  } catch (err) {
    console.error('Failed to load execution detail:', err);
    return null;
  }
}

// ========== Rendering ==========
function renderCliHistory() {
  const container = document.getElementById('cli-history-panel');
  if (!container) return;

  // Filter by search query
  const filteredHistory = cliHistorySearch
    ? cliExecutionHistory.filter(exec =>
        exec.prompt_preview.toLowerCase().includes(cliHistorySearch.toLowerCase()) ||
        exec.tool.toLowerCase().includes(cliHistorySearch.toLowerCase())
      )
    : cliExecutionHistory;

  if (cliExecutionHistory.length === 0) {
    container.innerHTML = `
      <div class="cli-history-header">
        <h3>Execution History</h3>
        <div class="cli-history-controls">
          ${renderHistorySearch()}
          ${renderToolFilter()}
          <button class="btn-icon" onclick="refreshCliHistory()" title="Refresh">
            <i data-lucide="refresh-cw" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
      <div class="empty-state">
        <i data-lucide="terminal" class="w-8 h-8"></i>
        <p>No executions yet</p>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    return;
  }

  const historyHtml = filteredHistory.length === 0
    ? `<div class="empty-state">
        <i data-lucide="search-x" class="w-6 h-6"></i>
        <p>No matching results</p>
      </div>`
    : filteredHistory.map(exec => {
        const statusIcon = exec.status === 'success' ? 'check-circle' :
                           exec.status === 'timeout' ? 'clock' : 'x-circle';
        const statusClass = exec.status === 'success' ? 'text-success' :
                            exec.status === 'timeout' ? 'text-warning' : 'text-destructive';
        const duration = formatDuration(exec.duration_ms);
        const timeAgo = getTimeAgo(new Date(exec.timestamp));

        return `
          <div class="cli-history-item">
            <div class="cli-history-item-content" onclick="showExecutionDetail('${exec.id}')">
              <div class="cli-history-item-header">
                <span class="cli-tool-tag cli-tool-${exec.tool}">${exec.tool}</span>
                <span class="cli-history-time">${timeAgo}</span>
                <i data-lucide="${statusIcon}" class="w-3.5 h-3.5 ${statusClass}"></i>
              </div>
              <div class="cli-history-prompt">${escapeHtml(exec.prompt_preview)}</div>
              <div class="cli-history-meta">
                <span>${duration}</span>
                <span>${exec.mode || 'analysis'}</span>
              </div>
            </div>
            <div class="cli-history-actions">
              <button class="btn-icon" onclick="event.stopPropagation(); showExecutionDetail('${exec.id}')" title="View Details">
                <i data-lucide="eye" class="w-3.5 h-3.5"></i>
              </button>
              <button class="btn-icon btn-danger" onclick="event.stopPropagation(); confirmDeleteExecution('${exec.id}')" title="Delete">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');

  container.innerHTML = `
    <div class="cli-history-header">
      <h3>Execution History</h3>
      <div class="cli-history-controls">
        ${renderHistorySearch()}
        ${renderToolFilter()}
        <button class="btn-icon" onclick="refreshCliHistory()" title="Refresh">
          <i data-lucide="refresh-cw" class="w-4 h-4"></i>
        </button>
      </div>
    </div>
    <div class="cli-history-list">
      ${historyHtml}
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

function renderHistorySearch() {
  return `
    <input type="text"
           class="cli-history-search"
           placeholder="Search history..."
           value="${escapeHtml(cliHistorySearch)}"
           onkeyup="searchCliHistory(this.value)"
           oninput="searchCliHistory(this.value)">
  `;
}

function renderToolFilter() {
  const tools = ['all', 'gemini', 'qwen', 'codex'];
  return `
    <select class="cli-tool-filter" onchange="filterCliHistory(this.value)">
      ${tools.map(tool => `
        <option value="${tool === 'all' ? '' : tool}" ${cliHistoryFilter === (tool === 'all' ? null : tool) ? 'selected' : ''}>
          ${tool === 'all' ? 'All Tools' : tool.charAt(0).toUpperCase() + tool.slice(1)}
        </option>
      `).join('')}
    </select>
  `;
}

// ========== Execution Detail Modal ==========
async function showExecutionDetail(executionId) {
  const detail = await loadExecutionDetail(executionId);
  if (!detail) {
    showRefreshToast('Execution not found', 'error');
    return;
  }

  const modalContent = `
    <div class="cli-detail-header">
      <div class="cli-detail-info">
        <span class="cli-tool-tag cli-tool-${detail.tool}">${detail.tool}</span>
        <span class="cli-detail-status status-${detail.status}">${detail.status}</span>
        <span class="text-muted-foreground">${formatDuration(detail.duration_ms)}</span>
      </div>
      <div class="cli-detail-meta">
        <span><i data-lucide="cpu" class="w-3 h-3"></i> ${detail.model || 'default'}</span>
        <span><i data-lucide="toggle-right" class="w-3 h-3"></i> ${detail.mode}</span>
        <span><i data-lucide="calendar" class="w-3 h-3"></i> ${new Date(detail.timestamp).toLocaleString()}</span>
      </div>
    </div>
    <div class="cli-detail-section">
      <h4><i data-lucide="message-square"></i> Prompt</h4>
      <pre class="cli-detail-prompt">${escapeHtml(detail.prompt)}</pre>
    </div>
    ${detail.output.stdout ? `
      <div class="cli-detail-section">
        <h4><i data-lucide="terminal"></i> Output</h4>
        <pre class="cli-detail-output">${escapeHtml(detail.output.stdout)}</pre>
      </div>
    ` : ''}
    ${detail.output.stderr ? `
      <div class="cli-detail-section">
        <h4><i data-lucide="alert-triangle"></i> Errors</h4>
        <pre class="cli-detail-error">${escapeHtml(detail.output.stderr)}</pre>
      </div>
    ` : ''}
    ${detail.output.truncated ? `
      <p class="text-warning" style="font-size: 0.75rem; margin-top: 0.5rem;">
        <i data-lucide="info" class="w-3 h-3" style="display: inline;"></i>
        Output was truncated due to size.
      </p>
    ` : ''}
    <div class="cli-detail-actions">
      <button class="btn btn-sm btn-outline" onclick="copyExecutionPrompt('${executionId}')">
        <i data-lucide="copy" class="w-3.5 h-3.5"></i> Copy Prompt
      </button>
      <button class="btn btn-sm btn-outline btn-danger" onclick="confirmDeleteExecution('${executionId}'); closeModal();">
        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Delete
      </button>
    </div>
  `;

  showModal('Execution Detail', modalContent);
}

// ========== Actions ==========
async function filterCliHistory(tool) {
  cliHistoryFilter = tool || null;
  await loadCliHistory();
  renderCliHistory();
}

function searchCliHistory(query) {
  cliHistorySearch = query;
  renderCliHistory();
  // Preserve focus and cursor position
  const searchInput = document.querySelector('.cli-history-search');
  if (searchInput) {
    searchInput.focus();
    searchInput.setSelectionRange(query.length, query.length);
  }
}

async function refreshCliHistory() {
  await loadCliHistory();
  renderCliHistory();
  showRefreshToast('History refreshed', 'success');
}

// ========== Delete Execution ==========
function confirmDeleteExecution(executionId) {
  if (confirm('Delete this execution record? This action cannot be undone.')) {
    deleteExecution(executionId);
  }
}

async function deleteExecution(executionId) {
  try {
    const response = await fetch(`/api/cli/execution?path=${encodeURIComponent(projectPath)}&id=${encodeURIComponent(executionId)}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete');
    }

    // Remove from local state
    cliExecutionHistory = cliExecutionHistory.filter(exec => exec.id !== executionId);
    renderCliHistory();
    showRefreshToast('Execution deleted', 'success');
  } catch (err) {
    console.error('Failed to delete execution:', err);
    showRefreshToast('Delete failed: ' + err.message, 'error');
  }
}

// ========== Copy Prompt ==========
async function copyExecutionPrompt(executionId) {
  const detail = await loadExecutionDetail(executionId);
  if (!detail) {
    showRefreshToast('Execution not found', 'error');
    return;
  }

  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(detail.prompt);
      showRefreshToast('Prompt copied to clipboard', 'success');
    } catch (err) {
      showRefreshToast('Failed to copy', 'error');
    }
  }
}

// ========== Helpers ==========
function formatDuration(ms) {
  if (ms >= 60000) {
    const mins = Math.floor(ms / 60000);
    const secs = Math.round((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  } else if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${ms}ms`;
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}
