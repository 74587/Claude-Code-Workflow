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

async function loadExecutionDetail(executionId, sourceDir) {
  try {
    // If sourceDir provided, use it to build the correct path
    const basePath = sourceDir && sourceDir !== '.' 
      ? projectPath + '/' + sourceDir 
      : projectPath;
    const url = `/api/cli/execution?path=${encodeURIComponent(basePath)}&id=${encodeURIComponent(executionId)}`;
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
        <h3><i data-lucide="history" class="w-4 h-4"></i> Execution History</h3>
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
        const timeAgo = getTimeAgo(new Date(exec.updated_at || exec.timestamp));
        const turnBadge = exec.turn_count && exec.turn_count > 1
          ? `<span class="cli-turn-badge">${exec.turn_count} turns</span>`
          : '';

        return `
          <div class="cli-history-item">
            <div class="cli-history-item-content" onclick="showExecutionDetail('${exec.id}')">
              <div class="cli-history-item-header">
                <span class="cli-tool-tag cli-tool-${exec.tool}">${exec.tool}</span>
                ${turnBadge}
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
      <h3><i data-lucide="history" class="w-4 h-4"></i> Execution History</h3>
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
async function showExecutionDetail(executionId, sourceDir) {
  const conversation = await loadExecutionDetail(executionId, sourceDir);
  if (!conversation) {
    showRefreshToast('Conversation not found', 'error');
    return;
  }

  // Handle both old (single execution) and new (conversation) formats
  const isConversation = conversation.turns && Array.isArray(conversation.turns);
  const turnCount = isConversation ? conversation.turn_count : 1;
  const totalDuration = isConversation ? conversation.total_duration_ms : conversation.duration_ms;
  const latestStatus = isConversation ? conversation.latest_status : conversation.status;
  const createdAt = isConversation ? conversation.created_at : conversation.timestamp;

  // Build turns HTML with improved multi-turn display
  let turnsHtml = '';
  if (isConversation && conversation.turns.length > 0) {
    turnsHtml = conversation.turns.map((turn, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === conversation.turns.length - 1;
      const turnTime = new Date(turn.timestamp).toLocaleTimeString();
      const statusIcon = turn.status === 'success' ? 'check-circle' :
                         turn.status === 'timeout' ? 'clock' : 'x-circle';

      return `
        <div class="cli-turn-section ${isLast ? 'cli-turn-latest' : ''}">
          <div class="cli-turn-header">
            <div class="cli-turn-marker">
              <span class="cli-turn-number">${isFirst ? '▶' : '↳'} Turn ${turn.turn}</span>
              ${isLast ? '<span class="cli-turn-latest-badge">Latest</span>' : ''}
            </div>
            <div class="cli-turn-meta">
              <span class="cli-turn-time"><i data-lucide="clock" class="w-3 h-3"></i> ${turnTime}</span>
              <span class="cli-turn-status status-${turn.status}">
                <i data-lucide="${statusIcon}" class="w-3 h-3"></i> ${turn.status}
              </span>
              <span class="cli-turn-duration">${formatDuration(turn.duration_ms)}</span>
            </div>
          </div>
          <div class="cli-turn-body">
            <div class="cli-detail-section cli-prompt-section">
              <h4><i data-lucide="user" class="w-3.5 h-3.5"></i> User Prompt</h4>
              <pre class="cli-detail-prompt">${escapeHtml(turn.prompt)}</pre>
            </div>
            ${turn.output.stdout ? `
              <div class="cli-detail-section cli-output-section">
                <h4><i data-lucide="bot" class="w-3.5 h-3.5"></i> Assistant Response</h4>
                <pre class="cli-detail-output">${escapeHtml(turn.output.stdout)}</pre>
              </div>
            ` : ''}
            ${turn.output.stderr ? `
              <div class="cli-detail-section cli-detail-error-section">
                <h4><i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i> Errors</h4>
                <pre class="cli-detail-error">${escapeHtml(turn.output.stderr)}</pre>
              </div>
            ` : ''}
            ${turn.output.truncated ? `
              <p class="cli-truncated-notice">
                <i data-lucide="info" class="w-3 h-3"></i>
                Output was truncated due to size.
              </p>
            ` : ''}
          </div>
        </div>
      `;
    }).join('<div class="cli-turn-connector"><div class="cli-turn-line"></div></div>');
  } else {
    // Legacy single execution format
    const detail = conversation;
    turnsHtml = `
      <div class="cli-turn-section">
        <div class="cli-turn-body">
          <div class="cli-detail-section cli-prompt-section">
            <h4><i data-lucide="user" class="w-3.5 h-3.5"></i> User Prompt</h4>
            <pre class="cli-detail-prompt">${escapeHtml(detail.prompt)}</pre>
          </div>
          ${detail.output.stdout ? `
            <div class="cli-detail-section cli-output-section">
              <h4><i data-lucide="bot" class="w-3.5 h-3.5"></i> Assistant Response</h4>
              <pre class="cli-detail-output">${escapeHtml(detail.output.stdout)}</pre>
            </div>
          ` : ''}
          ${detail.output.stderr ? `
            <div class="cli-detail-section cli-detail-error-section">
              <h4><i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i> Errors</h4>
              <pre class="cli-detail-error">${escapeHtml(detail.output.stderr)}</pre>
            </div>
          ` : ''}
          ${detail.output.truncated ? `
            <p class="cli-truncated-notice">
              <i data-lucide="info" class="w-3 h-3"></i>
              Output was truncated due to size.
            </p>
          ` : ''}
        </div>
      </div>
    `;
  }

  // Build concatenated prompt view (for multi-turn conversations)
  let concatenatedPromptHtml = '';
  if (isConversation && conversation.turns.length > 1) {
    concatenatedPromptHtml = `
      <div class="cli-concat-section" id="concatPromptSection" style="display: none;">
        <div class="cli-detail-section">
          <h4><i data-lucide="layers" class="w-3.5 h-3.5"></i> Concatenated Prompt (sent to CLI)</h4>
          <div class="cli-concat-format-selector">
            <button class="btn btn-xs ${true ? 'btn-primary' : 'btn-outline'}" onclick="switchConcatFormat('plain', '${executionId}')">Plain</button>
            <button class="btn btn-xs btn-outline" onclick="switchConcatFormat('yaml', '${executionId}')">YAML</button>
            <button class="btn btn-xs btn-outline" onclick="switchConcatFormat('json', '${executionId}')">JSON</button>
          </div>
          <pre class="cli-detail-output cli-concat-output" id="concatPromptOutput">${escapeHtml(buildConcatenatedPrompt(conversation, 'plain'))}</pre>
        </div>
      </div>
    `;
  }

  const modalContent = `
    <div class="cli-detail-header">
      <div class="cli-detail-info">
        <span class="cli-tool-tag cli-tool-${conversation.tool}">${conversation.tool}</span>
        ${turnCount > 1 ? `<span class="cli-turn-badge"><i data-lucide="messages-square" class="w-3 h-3"></i> ${turnCount} turns</span>` : ''}
        <span class="cli-detail-status status-${latestStatus}">${latestStatus}</span>
        <span class="text-muted-foreground">${formatDuration(totalDuration)}</span>
      </div>
      <div class="cli-detail-meta">
        <span><i data-lucide="cpu" class="w-3 h-3"></i> ${conversation.model || 'default'}</span>
        <span><i data-lucide="toggle-right" class="w-3 h-3"></i> ${conversation.mode}</span>
        <span><i data-lucide="calendar" class="w-3 h-3"></i> ${new Date(createdAt).toLocaleString()}</span>
        <span><i data-lucide="hash" class="w-3 h-3"></i> ${executionId.split('-')[0]}</span>
      </div>
    </div>
    ${turnCount > 1 ? `
      <div class="cli-view-toggle">
        <button class="btn btn-sm btn-outline active" onclick="toggleConversationView('turns')">
          <i data-lucide="list" class="w-3.5 h-3.5"></i> Per-Turn View
        </button>
        <button class="btn btn-sm btn-outline" onclick="toggleConversationView('concat')">
          <i data-lucide="layers" class="w-3.5 h-3.5"></i> Concatenated View
        </button>
      </div>
    ` : ''}
    <div class="cli-turns-container" id="turnsContainer">
      ${turnsHtml}
    </div>
    ${concatenatedPromptHtml}
    <div class="cli-detail-actions">
      <button class="btn btn-sm btn-outline" onclick="copyConversationId('${executionId}')">
        <i data-lucide="copy" class="w-3.5 h-3.5"></i> Copy ID
      </button>
      ${turnCount > 1 ? `
        <button class="btn btn-sm btn-outline" onclick="copyConcatenatedPrompt('${executionId}')">
          <i data-lucide="clipboard-copy" class="w-3.5 h-3.5"></i> Copy Full Prompt
        </button>
      ` : ''}
      <button class="btn btn-sm btn-outline btn-danger" onclick="confirmDeleteExecution('${executionId}'); closeModal();">
        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Delete
      </button>
    </div>
  `;

  // Store conversation data for format switching
  window._currentConversation = conversation;

  showModal('Conversation Detail', modalContent);
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
function confirmDeleteExecution(executionId, sourceDir) {
  if (confirm('Delete this execution record? This action cannot be undone.')) {
    deleteExecution(executionId, sourceDir);
  }
}

async function deleteExecution(executionId, sourceDir) {
  try {
    // Build correct path - use sourceDir if provided for recursive items
    const basePath = sourceDir && sourceDir !== '.' 
      ? projectPath + '/' + sourceDir 
      : projectPath;
    
    const response = await fetch(`/api/cli/execution?path=${encodeURIComponent(basePath)}&id=${encodeURIComponent(executionId)}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete');
    }

    // Reload fresh data from server and re-render
    await loadCliHistory();
    
    // Render appropriate view based on current view
    if (typeof currentView !== 'undefined' && (currentView === 'history' || currentView === 'cli-history')) {
      renderCliHistoryView();
    } else {
      renderCliHistory();
    }
    showRefreshToast('Execution deleted', 'success');
  } catch (err) {
    console.error('Failed to delete execution:', err);
    showRefreshToast('Delete failed: ' + err.message, 'error');
  }
}

// ========== Copy Functions ==========
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

async function copyConversationId(conversationId) {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(conversationId);
      showRefreshToast('ID copied to clipboard', 'success');
    } catch (err) {
      showRefreshToast('Failed to copy', 'error');
    }
  }
}

// ========== Concatenated Prompt Functions ==========

/**
 * Build concatenated prompt from conversation turns
 * Formats: plain, yaml, json
 */
function buildConcatenatedPrompt(conversation, format) {
  if (!conversation || !conversation.turns || conversation.turns.length === 0) {
    return '';
  }

  const turns = conversation.turns;

  switch (format) {
    case 'yaml':
      return buildYamlPrompt(conversation);
    case 'json':
      return buildJsonPrompt(conversation);
    case 'plain':
    default:
      return buildPlainPrompt(conversation);
  }
}

function buildPlainPrompt(conversation) {
  const parts = [];
  parts.push('=== CONVERSATION HISTORY ===');
  parts.push('');

  for (const turn of conversation.turns) {
    parts.push('--- Turn ' + turn.turn + ' ---');
    parts.push('USER:');
    parts.push(turn.prompt);
    parts.push('');
    parts.push('ASSISTANT:');
    parts.push(turn.output.stdout || '[No output]');
    parts.push('');
  }

  parts.push('=== NEW REQUEST ===');
  parts.push('');
  parts.push('[Your next prompt here]');

  return parts.join('\n');
}

function buildYamlPrompt(conversation) {
  const lines = [];
  lines.push('context:');
  lines.push('  tool: ' + conversation.tool);
  lines.push('  model: ' + (conversation.model || 'default'));
  lines.push('  mode: ' + conversation.mode);
  lines.push('');
  lines.push('conversation:');

  for (const turn of conversation.turns) {
    lines.push('  - turn: ' + turn.turn);
    lines.push('    timestamp: ' + turn.timestamp);
    lines.push('    status: ' + turn.status);
    lines.push('    user: |');
    turn.prompt.split('\n').forEach(function(line) {
      lines.push('      ' + line);
    });
    lines.push('    assistant: |');
    (turn.output.stdout || '[No output]').split('\n').forEach(function(line) {
      lines.push('      ' + line);
    });
    lines.push('');
  }

  lines.push('new_request: |');
  lines.push('  [Your next prompt here]');

  return lines.join('\n');
}

function buildJsonPrompt(conversation) {
  const data = {
    context: {
      tool: conversation.tool,
      model: conversation.model || 'default',
      mode: conversation.mode
    },
    conversation: conversation.turns.map(function(turn) {
      return {
        turn: turn.turn,
        timestamp: turn.timestamp,
        status: turn.status,
        user: turn.prompt,
        assistant: turn.output.stdout || '[No output]'
      };
    }),
    new_request: '[Your next prompt here]'
  };
  return JSON.stringify(data, null, 2);
}

/**
 * Toggle between per-turn and concatenated views
 */
function toggleConversationView(view) {
  var turnsContainer = document.getElementById('turnsContainer');
  var concatSection = document.getElementById('concatPromptSection');
  var buttons = document.querySelectorAll('.cli-view-toggle button');

  if (view === 'concat') {
    if (turnsContainer) turnsContainer.style.display = 'none';
    if (concatSection) concatSection.style.display = 'block';
    buttons.forEach(function(btn, idx) {
      btn.classList.toggle('active', idx === 1);
    });
  } else {
    if (turnsContainer) turnsContainer.style.display = 'block';
    if (concatSection) concatSection.style.display = 'none';
    buttons.forEach(function(btn, idx) {
      btn.classList.toggle('active', idx === 0);
    });
  }

  if (window.lucide) lucide.createIcons();
}

/**
 * Switch concatenation format (plain/yaml/json)
 */
function switchConcatFormat(format, executionId) {
  var conversation = window._currentConversation;
  if (!conversation) return;

  var output = document.getElementById('concatPromptOutput');
  if (output) {
    output.textContent = buildConcatenatedPrompt(conversation, format);
  }

  // Update button states
  var buttons = document.querySelectorAll('.cli-concat-format-selector button');
  buttons.forEach(function(btn) {
    var btnFormat = btn.textContent.toLowerCase();
    btn.className = 'btn btn-xs ' + (btnFormat === format ? 'btn-primary' : 'btn-outline');
  });
}

/**
 * Copy concatenated prompt to clipboard
 */
async function copyConcatenatedPrompt(executionId) {
  var conversation = window._currentConversation;
  if (!conversation) {
    showRefreshToast('Conversation not found', 'error');
    return;
  }

  var prompt = buildConcatenatedPrompt(conversation, 'plain');
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(prompt);
      showRefreshToast('Full prompt copied to clipboard', 'success');
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
