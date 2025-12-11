// CLI Manager View
// Main view combining CLI status and history panels

// ========== CLI Manager State ==========
let currentCliExecution = null;
let cliExecutionOutput = '';

// ========== Initialization ==========
function initCliManager() {
  // Initialize CLI navigation
  document.querySelectorAll('.nav-item[data-view="cli-manager"]').forEach(item => {
    item.addEventListener('click', () => {
      setActiveNavItem(item);
      currentView = 'cli-manager';
      currentFilter = null;
      currentLiteType = null;
      currentSessionDetailKey = null;
      updateContentTitle();
      renderCliManager();
    });
  });
}

// ========== Rendering ==========
async function renderCliManager() {
  const mainContent = document.querySelector('.main-content');
  if (!mainContent) return;

  // Load data
  await Promise.all([
    loadCliToolStatus(),
    loadCliHistory()
  ]);

  mainContent.innerHTML = `
    <div class="cli-manager-container">
      <div class="cli-manager-grid">
        <!-- Status Panel -->
        <div class="cli-panel">
          <div id="cli-status-panel"></div>
        </div>

        <!-- Quick Execute Panel -->
        <div class="cli-panel">
          <div id="cli-execute-panel"></div>
        </div>
      </div>

      <!-- History Panel -->
      <div class="cli-panel cli-panel-full">
        <div id="cli-history-panel"></div>
      </div>

      <!-- Live Output Panel (shown during execution) -->
      <div class="cli-panel cli-panel-full ${currentCliExecution ? '' : 'hidden'}" id="cli-output-panel">
        <div class="cli-output-header">
          <h3>Execution Output</h3>
          <div class="cli-output-status">
            <span id="cli-output-status-indicator" class="status-indicator running"></span>
            <span id="cli-output-status-text">Running...</span>
          </div>
        </div>
        <pre class="cli-output-content" id="cli-output-content"></pre>
      </div>
    </div>
  `;

  // Render sub-panels
  renderCliStatus();
  renderCliExecutePanel();
  renderCliHistory();

  // Initialize Lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }
}

function renderCliExecutePanel() {
  const container = document.getElementById('cli-execute-panel');
  if (!container) return;

  const tools = ['gemini', 'qwen', 'codex'];
  const modes = ['analysis', 'write', 'auto'];

  container.innerHTML = `
    <div class="cli-execute-header">
      <h3>Quick Execute</h3>
    </div>
    <div class="cli-execute-form">
      <div class="cli-execute-row">
        <div class="cli-form-group">
          <label for="cli-exec-tool">Tool</label>
          <select id="cli-exec-tool" class="cli-select">
            ${tools.map(tool => `
              <option value="${tool}" ${tool === defaultCliTool ? 'selected' : ''}>
                ${tool.charAt(0).toUpperCase() + tool.slice(1)}
              </option>
            `).join('')}
          </select>
        </div>
        <div class="cli-form-group">
          <label for="cli-exec-mode">Mode</label>
          <select id="cli-exec-mode" class="cli-select">
            ${modes.map(mode => `
              <option value="${mode}" ${mode === 'analysis' ? 'selected' : ''}>
                ${mode.charAt(0).toUpperCase() + mode.slice(1)}
              </option>
            `).join('')}
          </select>
        </div>
      </div>
      <div class="cli-form-group">
        <label for="cli-exec-prompt">Prompt</label>
        <textarea id="cli-exec-prompt" class="cli-textarea" placeholder="Enter your prompt..."></textarea>
      </div>
      <div class="cli-execute-actions">
        <button class="btn btn-primary" onclick="executeCliFromDashboard()" ${currentCliExecution ? 'disabled' : ''}>
          <i data-lucide="play"></i>
          Execute
        </button>
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

// ========== Execution ==========
async function executeCliFromDashboard() {
  const tool = document.getElementById('cli-exec-tool').value;
  const mode = document.getElementById('cli-exec-mode').value;
  const prompt = document.getElementById('cli-exec-prompt').value.trim();

  if (!prompt) {
    showRefreshToast('Please enter a prompt', 'error');
    return;
  }

  // Show output panel
  currentCliExecution = { tool, mode, prompt, startTime: Date.now() };
  cliExecutionOutput = '';

  const outputPanel = document.getElementById('cli-output-panel');
  const outputContent = document.getElementById('cli-output-content');
  const statusIndicator = document.getElementById('cli-output-status-indicator');
  const statusText = document.getElementById('cli-output-status-text');

  if (outputPanel) outputPanel.classList.remove('hidden');
  if (outputContent) outputContent.textContent = '';
  if (statusIndicator) {
    statusIndicator.className = 'status-indicator running';
  }
  if (statusText) statusText.textContent = 'Running...';

  // Disable execute button
  const execBtn = document.querySelector('.cli-execute-actions .btn-primary');
  if (execBtn) execBtn.disabled = true;

  try {
    const response = await fetch('/api/cli/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool,
        mode,
        prompt,
        dir: projectPath
      })
    });

    const result = await response.json();

    // Update status
    if (statusIndicator) {
      statusIndicator.className = `status-indicator ${result.success ? 'success' : 'error'}`;
    }
    if (statusText) {
      const duration = formatDuration(result.execution?.duration_ms || (Date.now() - currentCliExecution.startTime));
      statusText.textContent = result.success
        ? `Completed in ${duration}`
        : `Failed: ${result.error || 'Unknown error'}`;
    }

    // Refresh history
    await loadCliHistory();
    renderCliHistory();

    if (result.success) {
      showRefreshToast('Execution completed', 'success');
    } else {
      showRefreshToast(result.error || 'Execution failed', 'error');
    }

  } catch (error) {
    if (statusIndicator) {
      statusIndicator.className = 'status-indicator error';
    }
    if (statusText) {
      statusText.textContent = `Error: ${error.message}`;
    }
    showRefreshToast(`Execution error: ${error.message}`, 'error');
  }

  currentCliExecution = null;

  // Re-enable execute button
  if (execBtn) execBtn.disabled = false;
}

// ========== WebSocket Event Handlers ==========
function handleCliExecutionStarted(payload) {
  const { executionId, tool, mode, timestamp } = payload;
  currentCliExecution = { executionId, tool, mode, startTime: new Date(timestamp).getTime() };
  cliExecutionOutput = '';

  // Show output panel if in CLI manager view
  if (currentView === 'cli-manager') {
    const outputPanel = document.getElementById('cli-output-panel');
    const outputContent = document.getElementById('cli-output-content');
    const statusIndicator = document.getElementById('cli-output-status-indicator');
    const statusText = document.getElementById('cli-output-status-text');

    if (outputPanel) outputPanel.classList.remove('hidden');
    if (outputContent) outputContent.textContent = '';
    if (statusIndicator) statusIndicator.className = 'status-indicator running';
    if (statusText) statusText.textContent = `Running ${tool} (${mode})...`;
  }
}

function handleCliOutput(payload) {
  const { data } = payload;
  cliExecutionOutput += data;

  // Update output panel if visible
  const outputContent = document.getElementById('cli-output-content');
  if (outputContent) {
    outputContent.textContent = cliExecutionOutput;
    // Auto-scroll to bottom
    outputContent.scrollTop = outputContent.scrollHeight;
  }
}

function handleCliExecutionCompleted(payload) {
  const { executionId, success, status, duration_ms } = payload;

  // Update status
  const statusIndicator = document.getElementById('cli-output-status-indicator');
  const statusText = document.getElementById('cli-output-status-text');

  if (statusIndicator) {
    statusIndicator.className = `status-indicator ${success ? 'success' : 'error'}`;
  }
  if (statusText) {
    statusText.textContent = success
      ? `Completed in ${formatDuration(duration_ms)}`
      : `Failed: ${status}`;
  }

  currentCliExecution = null;

  // Refresh history
  if (currentView === 'cli-manager') {
    loadCliHistory().then(() => renderCliHistory());
  }
}

function handleCliExecutionError(payload) {
  const { executionId, error } = payload;

  const statusIndicator = document.getElementById('cli-output-status-indicator');
  const statusText = document.getElementById('cli-output-status-text');

  if (statusIndicator) {
    statusIndicator.className = 'status-indicator error';
  }
  if (statusText) {
    statusText.textContent = `Error: ${error}`;
  }

  currentCliExecution = null;
}
