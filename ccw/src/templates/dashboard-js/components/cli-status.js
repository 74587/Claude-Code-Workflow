// CLI Status Component
// Displays CLI tool availability status and allows setting default tool

// ========== CLI State ==========
let cliToolStatus = { gemini: {}, qwen: {}, codex: {} };
let codexLensStatus = { ready: false };
let semanticStatus = { available: false };
let defaultCliTool = 'gemini';
let promptConcatFormat = localStorage.getItem('ccw-prompt-format') || 'plain'; // plain, yaml, json

// Smart Context settings
let smartContextEnabled = localStorage.getItem('ccw-smart-context') === 'true';
let smartContextMaxFiles = parseInt(localStorage.getItem('ccw-smart-context-max-files') || '10', 10);

// ========== Initialization ==========
function initCliStatus() {
  // Load CLI status on init
  loadCliToolStatus();
  loadCodexLensStatus();
}

// ========== Data Loading ==========
async function loadCliToolStatus() {
  try {
    const response = await fetch('/api/cli/status');
    if (!response.ok) throw new Error('Failed to load CLI status');
    const data = await response.json();
    cliToolStatus = data;

    // Update badge
    updateCliBadge();

    return data;
  } catch (err) {
    console.error('Failed to load CLI status:', err);
    return null;
  }
}

async function loadCodexLensStatus() {
  try {
    const response = await fetch('/api/codexlens/status');
    if (!response.ok) throw new Error('Failed to load CodexLens status');
    const data = await response.json();
    codexLensStatus = data;

    // Update CodexLens badge
    updateCodexLensBadge();

    // If CodexLens is ready, also check semantic status
    if (data.ready) {
      await loadSemanticStatus();
    }

    return data;
  } catch (err) {
    console.error('Failed to load CodexLens status:', err);
    return null;
  }
}

async function loadSemanticStatus() {
  try {
    const response = await fetch('/api/codexlens/semantic/status');
    if (!response.ok) throw new Error('Failed to load semantic status');
    const data = await response.json();
    semanticStatus = data;
    return data;
  } catch (err) {
    console.error('Failed to load semantic status:', err);
    return null;
  }
}

// ========== Badge Update ==========
function updateCliBadge() {
  const badge = document.getElementById('badgeCliTools');
  if (badge) {
    const available = Object.values(cliToolStatus).filter(t => t.available).length;
    const total = Object.keys(cliToolStatus).length;
    badge.textContent = `${available}/${total}`;
    badge.classList.toggle('text-success', available === total);
    badge.classList.toggle('text-warning', available > 0 && available < total);
    badge.classList.toggle('text-destructive', available === 0);
  }
}

function updateCodexLensBadge() {
  const badge = document.getElementById('badgeCodexLens');
  if (badge) {
    badge.textContent = codexLensStatus.ready ? 'Ready' : 'Not Installed';
    badge.classList.toggle('text-success', codexLensStatus.ready);
    badge.classList.toggle('text-muted-foreground', !codexLensStatus.ready);
  }
}

// ========== Rendering ==========
function renderCliStatus() {
  const container = document.getElementById('cli-status-panel');
  if (!container) return;

  const toolDescriptions = {
    gemini: 'Google AI for code analysis',
    qwen: 'Alibaba AI assistant',
    codex: 'OpenAI code generation'
  };

  const toolIcons = {
    gemini: 'sparkle',
    qwen: 'bot',
    codex: 'code-2'
  };

  const tools = ['gemini', 'qwen', 'codex'];

  const toolsHtml = tools.map(tool => {
    const status = cliToolStatus[tool] || {};
    const isAvailable = status.available;
    const isDefault = defaultCliTool === tool;

    return `
      <div class="cli-tool-card tool-${tool} ${isAvailable ? 'available' : 'unavailable'}">
        <div class="cli-tool-header">
          <span class="cli-tool-status ${isAvailable ? 'status-available' : 'status-unavailable'}"></span>
          <span class="cli-tool-name">${tool.charAt(0).toUpperCase() + tool.slice(1)}</span>
          ${isDefault ? '<span class="cli-tool-badge">Default</span>' : ''}
        </div>
        <div class="cli-tool-desc text-xs text-muted-foreground mt-1">
          ${toolDescriptions[tool]}
        </div>
        <div class="cli-tool-info mt-2">
          ${isAvailable
            ? `<span class="text-success flex items-center gap-1"><i data-lucide="check-circle" class="w-3 h-3"></i> Ready</span>`
            : `<span class="text-muted-foreground flex items-center gap-1"><i data-lucide="circle-dashed" class="w-3 h-3"></i> Not Installed</span>`
          }
        </div>
        <div class="cli-tool-actions mt-3">
          ${isAvailable && !isDefault
            ? `<button class="btn-sm btn-outline flex items-center gap-1" onclick="setDefaultCliTool('${tool}')">
                <i data-lucide="star" class="w-3 h-3"></i> Set Default
              </button>`
            : ''
          }
        </div>
      </div>
    `;
  }).join('');

  // CodexLens card with semantic search info
  const codexLensHtml = `
    <div class="cli-tool-card tool-codexlens ${codexLensStatus.ready ? 'available' : 'unavailable'}">
      <div class="cli-tool-header">
        <span class="cli-tool-status ${codexLensStatus.ready ? 'status-available' : 'status-unavailable'}"></span>
        <span class="cli-tool-name">CodexLens</span>
        <span class="badge px-1.5 py-0.5 text-xs rounded bg-muted text-muted-foreground">Index</span>
      </div>
      <div class="cli-tool-desc text-xs text-muted-foreground mt-1">
        ${codexLensStatus.ready ? 'Code indexing & FTS search' : 'Full-text code search engine'}
      </div>
      <div class="cli-tool-info mt-2">
        ${codexLensStatus.ready
          ? `<span class="text-success flex items-center gap-1"><i data-lucide="check-circle" class="w-3 h-3"></i> v${codexLensStatus.version || 'installed'}</span>`
          : `<span class="text-muted-foreground flex items-center gap-1"><i data-lucide="circle-dashed" class="w-3 h-3"></i> Not Installed</span>`
        }
      </div>
      <div class="cli-tool-actions flex gap-2 mt-3">
        ${!codexLensStatus.ready
          ? `<button class="btn-sm btn-primary flex items-center gap-1" onclick="installCodexLens()">
              <i data-lucide="download" class="w-3 h-3"></i> Install
            </button>`
          : `<button class="btn-sm btn-outline flex items-center gap-1" onclick="initCodexLensIndex()">
              <i data-lucide="database" class="w-3 h-3"></i> Init Index
            </button>`
        }
      </div>
    </div>
  `;

  // Semantic Search card (only show if CodexLens is installed)
  const semanticHtml = codexLensStatus.ready ? `
    <div class="cli-tool-card tool-semantic ${semanticStatus.available ? 'available' : 'unavailable'}">
      <div class="cli-tool-header">
        <span class="cli-tool-status ${semanticStatus.available ? 'status-available' : 'status-unavailable'}"></span>
        <span class="cli-tool-name">Semantic Search</span>
        <span class="badge px-1.5 py-0.5 text-xs rounded ${semanticStatus.available ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}">AI</span>
      </div>
      <div class="cli-tool-desc text-xs text-muted-foreground mt-1">
        ${semanticStatus.available ? 'AI-powered code understanding' : 'Natural language code search'}
      </div>
      <div class="cli-tool-info mt-2">
        ${semanticStatus.available
          ? `<span class="text-success flex items-center gap-1"><i data-lucide="sparkles" class="w-3 h-3"></i> ${semanticStatus.backend || 'Ready'}</span>`
          : `<span class="text-muted-foreground flex items-center gap-1"><i data-lucide="circle-dashed" class="w-3 h-3"></i> Not Installed</span>`
        }
      </div>
      <div class="cli-tool-actions flex flex-col gap-2 mt-3">
        ${!semanticStatus.available ? `
          <button class="btn-sm btn-primary w-full flex items-center justify-center gap-1" onclick="openSemanticInstallWizard()">
            <i data-lucide="brain" class="w-3 h-3"></i> Install AI Model
          </button>
          <div class="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <i data-lucide="hard-drive" class="w-3 h-3"></i>
            <span>~500MB download</span>
          </div>
        ` : `
          <div class="flex items-center gap-1 text-xs text-muted-foreground">
            <i data-lucide="cpu" class="w-3 h-3"></i>
            <span>bge-small-en-v1.5</span>
          </div>
        `}
      </div>
    </div>
  ` : '';

  // CLI Settings section
  const settingsHtml = `
    <div class="cli-settings-section">
      <div class="cli-settings-header">
        <h4><i data-lucide="settings" class="w-3.5 h-3.5"></i> Settings</h4>
      </div>
      <div class="cli-settings-grid">
        <div class="cli-setting-item">
          <label class="cli-setting-label">
            <i data-lucide="layers" class="w-3 h-3"></i>
            Prompt Format
          </label>
          <div class="cli-setting-control">
            <select class="cli-setting-select" onchange="setPromptFormat(this.value)">
              <option value="plain" ${promptConcatFormat === 'plain' ? 'selected' : ''}>Plain Text</option>
              <option value="yaml" ${promptConcatFormat === 'yaml' ? 'selected' : ''}>YAML</option>
              <option value="json" ${promptConcatFormat === 'json' ? 'selected' : ''}>JSON</option>
            </select>
          </div>
          <p class="cli-setting-desc">Format for multi-turn conversation concatenation</p>
        </div>
        <div class="cli-setting-item">
          <label class="cli-setting-label">
            <i data-lucide="database" class="w-3 h-3"></i>
            Storage Backend
          </label>
          <div class="cli-setting-control">
            <span class="cli-setting-value">SQLite</span>
          </div>
          <p class="cli-setting-desc">CLI history stored in SQLite with FTS search</p>
        </div>
        <div class="cli-setting-item">
          <label class="cli-setting-label">
            <i data-lucide="sparkles" class="w-3 h-3"></i>
            Smart Context
          </label>
          <div class="cli-setting-control">
            <label class="cli-toggle">
              <input type="checkbox" ${smartContextEnabled ? 'checked' : ''} onchange="setSmartContextEnabled(this.checked)">
              <span class="cli-toggle-slider"></span>
            </label>
          </div>
          <p class="cli-setting-desc">Auto-analyze prompt and add relevant file paths</p>
        </div>
        <div class="cli-setting-item ${!smartContextEnabled ? 'disabled' : ''}">
          <label class="cli-setting-label">
            <i data-lucide="files" class="w-3 h-3"></i>
            Max Context Files
          </label>
          <div class="cli-setting-control">
            <select class="cli-setting-select" onchange="setSmartContextMaxFiles(this.value)" ${!smartContextEnabled ? 'disabled' : ''}>
              <option value="5" ${smartContextMaxFiles === 5 ? 'selected' : ''}>5 files</option>
              <option value="10" ${smartContextMaxFiles === 10 ? 'selected' : ''}>10 files</option>
              <option value="20" ${smartContextMaxFiles === 20 ? 'selected' : ''}>20 files</option>
            </select>
          </div>
          <p class="cli-setting-desc">Maximum files to include in smart context</p>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = `
    <div class="cli-status-header">
      <h3><i data-lucide="terminal" class="w-4 h-4"></i> CLI Tools</h3>
      <button class="btn-icon" onclick="refreshAllCliStatus()" title="Refresh">
        <i data-lucide="refresh-cw" class="w-4 h-4"></i>
      </button>
    </div>
    <div class="cli-tools-grid">
      ${toolsHtml}
      ${codexLensHtml}
      ${semanticHtml}
    </div>
    ${settingsHtml}
  `;

  // Initialize Lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }
}

// ========== Actions ==========
function setDefaultCliTool(tool) {
  defaultCliTool = tool;
  renderCliStatus();
  showRefreshToast(`Default CLI tool set to ${tool}`, 'success');
}

function setPromptFormat(format) {
  promptConcatFormat = format;
  localStorage.setItem('ccw-prompt-format', format);
  showRefreshToast(`Prompt format set to ${format.toUpperCase()}`, 'success');
}

function setSmartContextEnabled(enabled) {
  smartContextEnabled = enabled;
  localStorage.setItem('ccw-smart-context', enabled.toString());
  // Re-render the appropriate settings panel
  if (typeof renderCliSettingsSection === 'function') {
    renderCliSettingsSection();
  } else {
    renderCliStatus();
  }
  showRefreshToast(`Smart Context ${enabled ? 'enabled' : 'disabled'}`, 'success');
}

function setSmartContextMaxFiles(max) {
  smartContextMaxFiles = parseInt(max, 10);
  localStorage.setItem('ccw-smart-context-max-files', max);
  showRefreshToast(`Smart Context max files set to ${max}`, 'success');
}

async function refreshAllCliStatus() {
  await Promise.all([loadCliToolStatus(), loadCodexLensStatus()]);
  renderCliStatus();
}

async function installCodexLens() {
  showRefreshToast('Installing CodexLens...', 'info');

  try {
    const response = await fetch('/api/codexlens/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const result = await response.json();
    if (result.success) {
      showRefreshToast('CodexLens installed successfully!', 'success');
      await loadCodexLensStatus();
      renderCliStatus();
    } else {
      showRefreshToast(`Install failed: ${result.error}`, 'error');
    }
  } catch (err) {
    showRefreshToast(`Install error: ${err.message}`, 'error');
  }
}

async function initCodexLensIndex() {
  showRefreshToast('Initializing CodexLens index...', 'info');

  try {
    const response = await fetch('/api/codexlens/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: projectPath })
    });

    const result = await response.json();
    if (result.success) {
      const data = result.result?.result || result.result || result;
      const files = data.files_indexed || 0;
      const symbols = data.symbols_indexed || 0;
      showRefreshToast(`Index created: ${files} files, ${symbols} symbols`, 'success');
    } else {
      showRefreshToast(`Init failed: ${result.error}`, 'error');
    }
  } catch (err) {
    showRefreshToast(`Init error: ${err.message}`, 'error');
  }
}

// ========== Semantic Search Installation Wizard ==========
function openSemanticInstallWizard() {
  const modal = document.createElement('div');
  modal.id = 'semanticInstallModal';
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-card rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
      <div class="p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <i data-lucide="brain" class="w-5 h-5 text-primary"></i>
          </div>
          <div>
            <h3 class="text-lg font-semibold">Install Semantic Search</h3>
            <p class="text-sm text-muted-foreground">AI-powered code understanding</p>
          </div>
        </div>

        <div class="space-y-4">
          <div class="bg-muted/50 rounded-lg p-4">
            <h4 class="font-medium mb-2">What will be installed:</h4>
            <ul class="text-sm space-y-2 text-muted-foreground">
              <li class="flex items-start gap-2">
                <i data-lucide="check" class="w-4 h-4 text-success mt-0.5"></i>
                <span><strong>sentence-transformers</strong> - ML framework</span>
              </li>
              <li class="flex items-start gap-2">
                <i data-lucide="check" class="w-4 h-4 text-success mt-0.5"></i>
                <span><strong>bge-small-en-v1.5</strong> - Embedding model (~130MB)</span>
              </li>
              <li class="flex items-start gap-2">
                <i data-lucide="check" class="w-4 h-4 text-success mt-0.5"></i>
                <span><strong>PyTorch</strong> - Deep learning backend (~300MB)</span>
              </li>
            </ul>
          </div>

          <div class="bg-warning/10 border border-warning/20 rounded-lg p-3">
            <div class="flex items-start gap-2">
              <i data-lucide="alert-triangle" class="w-4 h-4 text-warning mt-0.5"></i>
              <div class="text-sm">
                <p class="font-medium text-warning">Large Download</p>
                <p class="text-muted-foreground">Total size: ~500MB. First-time model loading may take a few minutes.</p>
              </div>
            </div>
          </div>

          <div id="semanticInstallProgress" class="hidden">
            <div class="flex items-center gap-3">
              <div class="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full"></div>
              <span class="text-sm" id="semanticInstallStatus">Installing dependencies...</span>
            </div>
            <div class="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div id="semanticProgressBar" class="h-full bg-primary transition-all duration-300" style="width: 0%"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="border-t border-border p-4 flex justify-end gap-3 bg-muted/30">
        <button class="btn-outline px-4 py-2" onclick="closeSemanticInstallWizard()">Cancel</button>
        <button id="semanticInstallBtn" class="btn-primary px-4 py-2" onclick="startSemanticInstall()">
          <i data-lucide="download" class="w-4 h-4 mr-2"></i>
          Install Now
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Initialize Lucide icons in modal
  if (window.lucide) {
    lucide.createIcons();
  }
}

function closeSemanticInstallWizard() {
  const modal = document.getElementById('semanticInstallModal');
  if (modal) {
    modal.remove();
  }
}

async function startSemanticInstall() {
  const progressDiv = document.getElementById('semanticInstallProgress');
  const installBtn = document.getElementById('semanticInstallBtn');
  const statusText = document.getElementById('semanticInstallStatus');
  const progressBar = document.getElementById('semanticProgressBar');

  // Show progress, disable button
  progressDiv.classList.remove('hidden');
  installBtn.disabled = true;
  installBtn.innerHTML = '<span class="animate-pulse">Installing...</span>';

  // Simulate progress stages
  const stages = [
    { progress: 10, text: 'Installing numpy...' },
    { progress: 30, text: 'Installing sentence-transformers...' },
    { progress: 50, text: 'Installing PyTorch dependencies...' },
    { progress: 70, text: 'Downloading embedding model...' },
    { progress: 90, text: 'Finalizing installation...' }
  ];

  let currentStage = 0;
  const progressInterval = setInterval(() => {
    if (currentStage < stages.length) {
      statusText.textContent = stages[currentStage].text;
      progressBar.style.width = `${stages[currentStage].progress}%`;
      currentStage++;
    }
  }, 2000);

  try {
    const response = await fetch('/api/codexlens/semantic/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    clearInterval(progressInterval);
    const result = await response.json();

    if (result.success) {
      progressBar.style.width = '100%';
      statusText.textContent = 'Installation complete!';

      setTimeout(() => {
        closeSemanticInstallWizard();
        showRefreshToast('Semantic search installed successfully!', 'success');
        loadSemanticStatus().then(() => renderCliStatus());
      }, 1000);
    } else {
      statusText.textContent = `Error: ${result.error}`;
      progressBar.classList.add('bg-destructive');
      installBtn.disabled = false;
      installBtn.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4 mr-2"></i> Retry';
      if (window.lucide) lucide.createIcons();
    }
  } catch (err) {
    clearInterval(progressInterval);
    statusText.textContent = `Error: ${err.message}`;
    progressBar.classList.add('bg-destructive');
    installBtn.disabled = false;
    installBtn.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4 mr-2"></i> Retry';
    if (window.lucide) lucide.createIcons();
  }
}
