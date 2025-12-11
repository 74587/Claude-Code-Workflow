// CLI History Component
// Displays execution history with filtering and search

// ========== CLI History State ==========
let cliExecutionHistory = [];
let cliHistoryFilter = null; // Filter by tool
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

  if (cliExecutionHistory.length === 0) {
    container.innerHTML = `
      <div class="cli-history-header">
        <h3>Execution History</h3>
        <div class="cli-history-controls">
          ${renderToolFilter()}
          <button class="btn-icon" onclick="refreshCliHistory()" title="Refresh">
            <i data-lucide="refresh-cw"></i>
          </button>
        </div>
      </div>
      <div class="empty-state">
        <i data-lucide="terminal"></i>
        <p>No executions yet</p>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    return;
  }

  const historyHtml = cliExecutionHistory.map(exec => {
    const statusIcon = exec.status === 'success' ? 'check-circle' :
                       exec.status === 'timeout' ? 'clock' : 'x-circle';
    const statusClass = exec.status === 'success' ? 'text-success' :
                        exec.status === 'timeout' ? 'text-warning' : 'text-destructive';
    const duration = formatDuration(exec.duration_ms);
    const timeAgo = getTimeAgo(new Date(exec.timestamp));

    return `
      <div class="cli-history-item" onclick="showExecutionDetail('${exec.id}')">
        <div class="cli-history-item-header">
          <span class="cli-tool-tag cli-tool-${exec.tool}">${exec.tool}</span>
          <span class="cli-history-time">${timeAgo}</span>
          <i data-lucide="${statusIcon}" class="${statusClass}"></i>
        </div>
        <div class="cli-history-prompt">${escapeHtml(exec.prompt_preview)}</div>
        <div class="cli-history-meta">
          <span class="text-muted-foreground">${duration}</span>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="cli-history-header">
      <h3>Execution History</h3>
      <div class="cli-history-controls">
        ${renderToolFilter()}
        <button class="btn-icon" onclick="refreshCliHistory()" title="Refresh">
          <i data-lucide="refresh-cw"></i>
        </button>
      </div>
    </div>
    <div class="cli-history-list">
      ${historyHtml}
    </div>
  `;

  if (window.lucide) lucide.createIcons();
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
        <span class="text-muted-foreground">Model: ${detail.model || 'default'}</span>
        <span class="text-muted-foreground">Mode: ${detail.mode}</span>
        <span class="text-muted-foreground">${new Date(detail.timestamp).toLocaleString()}</span>
      </div>
    </div>
    <div class="cli-detail-section">
      <h4>Prompt</h4>
      <pre class="cli-detail-prompt">${escapeHtml(detail.prompt)}</pre>
    </div>
    ${detail.output.stdout ? `
      <div class="cli-detail-section">
        <h4>Output</h4>
        <pre class="cli-detail-output">${escapeHtml(detail.output.stdout)}</pre>
      </div>
    ` : ''}
    ${detail.output.stderr ? `
      <div class="cli-detail-section">
        <h4>Errors</h4>
        <pre class="cli-detail-error">${escapeHtml(detail.output.stderr)}</pre>
      </div>
    ` : ''}
    ${detail.output.truncated ? `
      <p class="text-warning">Output was truncated due to size.</p>
    ` : ''}
  `;

  showModal('Execution Detail', modalContent);
}

// ========== Actions ==========
async function filterCliHistory(tool) {
  cliHistoryFilter = tool || null;
  await loadCliHistory();
  renderCliHistory();
}

async function refreshCliHistory() {
  await loadCliHistory();
  renderCliHistory();
  showRefreshToast('History refreshed', 'success');
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
