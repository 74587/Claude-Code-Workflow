// CLI Status Component
// Displays CLI tool availability status and allows setting default tool

// ========== CLI State ==========
let cliToolStatus = { gemini: {}, qwen: {}, codex: {}, claude: {} };
let codexLensStatus = { ready: false };
let semanticStatus = { available: false };
let defaultCliTool = 'gemini';
let promptConcatFormat = localStorage.getItem('ccw-prompt-format') || 'plain'; // plain, yaml, json

// Smart Context settings
let smartContextEnabled = localStorage.getItem('ccw-smart-context') === 'true';
let smartContextMaxFiles = parseInt(localStorage.getItem('ccw-smart-context-max-files') || '10', 10);

// Native Resume settings
let nativeResumeEnabled = localStorage.getItem('ccw-native-resume') !== 'false'; // default true

// Recursive Query settings (for hierarchical storage aggregation)
let recursiveQueryEnabled = localStorage.getItem('ccw-recursive-query') !== 'false'; // default true

// ========== Initialization ==========
function initCliStatus() {
  // Load all statuses in one call using aggregated endpoint
  loadAllStatuses();
}

// ========== Data Loading ==========
/**
 * Load all statuses using aggregated endpoint (single API call)
 */
async function loadAllStatuses() {
  try {
    const response = await fetch('/api/status/all');
    if (!response.ok) throw new Error('Failed to load status');
    const data = await response.json();

    // Update all status data
    cliToolStatus = data.cli || { gemini: {}, qwen: {}, codex: {}, claude: {} };
    codexLensStatus = data.codexLens || { ready: false };
    semanticStatus = data.semantic || { available: false };

    // Update badges
    updateCliBadge();
    updateCodexLensBadge();

    return data;
  } catch (err) {
    console.error('Failed to load aggregated status:', err);
    // Fallback to individual calls if aggregated endpoint fails
    return await loadAllStatusesFallback();
  }
}

/**
 * Fallback: Load statuses individually if aggregated endpoint fails
 */
async function loadAllStatusesFallback() {
  console.warn('[CLI Status] Using fallback individual API calls');
  await Promise.all([
    loadCliToolStatus(),
    loadCodexLensStatus()
  ]);
}

/**
 * Legacy: Load CLI tool status individually
 */
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

/**
 * Legacy: Load CodexLens status individually
 */
async function loadCodexLensStatus() {
  try {
    const response = await fetch('/api/codexlens/status');
    if (!response.ok) throw new Error('Failed to load CodexLens status');
    const data = await response.json();
    codexLensStatus = data;

    // Expose to window for other modules (e.g., codexlens-manager.js)
    if (!window.cliToolsStatus) {
      window.cliToolsStatus = {};
    }
    window.cliToolsStatus.codexlens = {
      installed: data.ready || false,
      version: data.version || null
    };

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

/**
 * Legacy: Load semantic status individually
 */
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
    codex: 'OpenAI code generation',
    claude: 'Anthropic AI assistant'
  };

  const toolIcons = {
    gemini: 'sparkle',
    qwen: 'bot',
    codex: 'code-2',
    claude: 'brain'
  };

  const tools = ['gemini', 'qwen', 'codex', 'claude'];

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
            </button>
            <button class="btn-sm btn-outline flex items-center gap-1" onclick="uninstallCodexLens()">
              <i data-lucide="trash-2" class="w-3 h-3"></i> Uninstall
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
          <div class="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <i data-lucide="hard-drive" class="w-3 h-3"></i>
            <span>~130MB</span>
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
        <div class="cli-setting-item">
          <label class="cli-setting-label">
            <i data-lucide="refresh-cw" class="w-3 h-3"></i>
            Native Resume
          </label>
          <div class="cli-setting-control">
            <label class="cli-toggle">
              <input type="checkbox" ${nativeResumeEnabled ? 'checked' : ''} onchange="setNativeResumeEnabled(this.checked)">
              <span class="cli-toggle-slider"></span>
            </label>
          </div>
          <p class="cli-setting-desc">Use native tool resume (gemini -r, qwen --resume, codex resume, claude --resume)</p>
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

function setNativeResumeEnabled(enabled) {
  nativeResumeEnabled = enabled;
  localStorage.setItem('ccw-native-resume', enabled.toString());
  showRefreshToast(`Native Resume ${enabled ? 'enabled' : 'disabled'}`, 'success');
}

function setRecursiveQueryEnabled(enabled) {
  recursiveQueryEnabled = enabled;
  localStorage.setItem('ccw-recursive-query', enabled.toString());
  showRefreshToast(`Recursive Query ${enabled ? 'enabled' : 'disabled'}`, 'success');
}

async function refreshAllCliStatus() {
  await loadAllStatuses();
  renderCliStatus();
}

function installCodexLens() {
  openCodexLensInstallWizard();
}

function openCodexLensInstallWizard() {
  const modal = document.createElement('div');
  modal.id = 'codexlensInstallModal';
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-card rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
      <div class="p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <i data-lucide="database" class="w-5 h-5 text-primary"></i>
          </div>
          <div>
            <h3 class="text-lg font-semibold">Install CodexLens</h3>
            <p class="text-sm text-muted-foreground">Python-based code indexing engine</p>
          </div>
        </div>

        <div class="space-y-4">
          <div class="bg-muted/50 rounded-lg p-4">
            <h4 class="font-medium mb-2">What will be installed:</h4>
            <ul class="text-sm space-y-2 text-muted-foreground">
              <li class="flex items-start gap-2">
                <i data-lucide="check" class="w-4 h-4 text-success mt-0.5"></i>
                <span><strong>Python virtual environment</strong> - Isolated Python environment</span>
              </li>
              <li class="flex items-start gap-2">
                <i data-lucide="check" class="w-4 h-4 text-success mt-0.5"></i>
                <span><strong>CodexLens package</strong> - Code indexing and search engine</span>
              </li>
              <li class="flex items-start gap-2">
                <i data-lucide="check" class="w-4 h-4 text-success mt-0.5"></i>
                <span><strong>SQLite FTS5</strong> - Full-text search database</span>
              </li>
            </ul>
          </div>

          <div class="bg-primary/5 border border-primary/20 rounded-lg p-3">
            <div class="flex items-start gap-2">
              <i data-lucide="info" class="w-4 h-4 text-primary mt-0.5"></i>
              <div class="text-sm text-muted-foreground">
                <p class="font-medium text-foreground">Installation Location</p>
                <p class="mt-1"><code class="bg-muted px-1 rounded">~/.codexlens/venv</code></p>
                <p class="mt-1">First installation may take 2-3 minutes to download and setup Python packages.</p>
              </div>
            </div>
          </div>

          <div id="codexlensInstallProgress" class="hidden">
            <div class="flex items-center gap-3">
              <div class="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full"></div>
              <span class="text-sm" id="codexlensInstallStatus">Starting installation...</span>
            </div>
            <div class="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div id="codexlensProgressBar" class="h-full bg-primary transition-all duration-300" style="width: 0%"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="border-t border-border p-4 flex justify-end gap-3 bg-muted/30">
        <button class="btn-outline px-4 py-2" onclick="closeCodexLensInstallWizard()">Cancel</button>
        <button id="codexlensInstallBtn" class="btn-primary px-4 py-2" onclick="startCodexLensInstall()">
          <i data-lucide="download" class="w-4 h-4 mr-2"></i>
          Install Now
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  if (window.lucide) {
    lucide.createIcons();
  }
}

function closeCodexLensInstallWizard() {
  const modal = document.getElementById('codexlensInstallModal');
  if (modal) {
    modal.remove();
  }
}

async function startCodexLensInstall() {
  const progressDiv = document.getElementById('codexlensInstallProgress');
  const installBtn = document.getElementById('codexlensInstallBtn');
  const statusText = document.getElementById('codexlensInstallStatus');
  const progressBar = document.getElementById('codexlensProgressBar');

  // Show progress, disable button
  progressDiv.classList.remove('hidden');
  installBtn.disabled = true;
  installBtn.innerHTML = '<span class="animate-pulse">Installing...</span>';

  // Simulate progress stages
  const stages = [
    { progress: 10, text: 'Creating virtual environment...' },
    { progress: 30, text: 'Installing pip packages...' },
    { progress: 50, text: 'Installing CodexLens package...' },
    { progress: 70, text: 'Setting up Python dependencies...' },
    { progress: 90, text: 'Finalizing installation...' }
  ];

  let currentStage = 0;
  const progressInterval = setInterval(() => {
    if (currentStage < stages.length) {
      statusText.textContent = stages[currentStage].text;
      progressBar.style.width = `${stages[currentStage].progress}%`;
      currentStage++;
    }
  }, 1500);

  try {
    const response = await fetch('/api/codexlens/bootstrap', {
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
        closeCodexLensInstallWizard();
        showRefreshToast('CodexLens installed successfully!', 'success');
        loadCodexLensStatus().then(() => renderCliStatus());
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

function uninstallCodexLens() {
  openCodexLensUninstallWizard();
}

function openCodexLensUninstallWizard() {
  const modal = document.createElement('div');
  modal.id = 'codexlensUninstallModal';
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-card rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
      <div class="p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
            <i data-lucide="trash-2" class="w-5 h-5 text-destructive"></i>
          </div>
          <div>
            <h3 class="text-lg font-semibold">Uninstall CodexLens</h3>
            <p class="text-sm text-muted-foreground">Remove CodexLens and all data</p>
          </div>
        </div>

        <div class="space-y-4">
          <div class="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
            <h4 class="font-medium text-destructive mb-2">What will be removed:</h4>
            <ul class="text-sm space-y-2 text-muted-foreground">
              <li class="flex items-start gap-2">
                <i data-lucide="x" class="w-4 h-4 text-destructive mt-0.5"></i>
                <span>Virtual environment at <code class="bg-muted px-1 rounded">~/.codexlens/venv</code></span>
              </li>
              <li class="flex items-start gap-2">
                <i data-lucide="x" class="w-4 h-4 text-destructive mt-0.5"></i>
                <span>All CodexLens indexed data and databases</span>
              </li>
              <li class="flex items-start gap-2">
                <i data-lucide="x" class="w-4 h-4 text-destructive mt-0.5"></i>
                <span>Configuration and semantic search models</span>
              </li>
            </ul>
          </div>

          <div class="bg-warning/10 border border-warning/20 rounded-lg p-3">
            <div class="flex items-start gap-2">
              <i data-lucide="alert-triangle" class="w-4 h-4 text-warning mt-0.5"></i>
              <div class="text-sm">
                <p class="font-medium text-warning">Warning</p>
                <p class="text-muted-foreground">This action cannot be undone. All indexed code data will be permanently deleted.</p>
              </div>
            </div>
          </div>

          <div id="codexlensUninstallProgress" class="hidden">
            <div class="flex items-center gap-3">
              <div class="animate-spin w-5 h-5 border-2 border-destructive border-t-transparent rounded-full"></div>
              <span class="text-sm" id="codexlensUninstallStatus">Removing files...</span>
            </div>
            <div class="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div id="codexlensUninstallProgressBar" class="h-full bg-destructive transition-all duration-300" style="width: 0%"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="border-t border-border p-4 flex justify-end gap-3 bg-muted/30">
        <button class="btn-outline px-4 py-2" onclick="closeCodexLensUninstallWizard()">Cancel</button>
        <button id="codexlensUninstallBtn" class="btn-destructive px-4 py-2" onclick="startCodexLensUninstall()">
          <i data-lucide="trash-2" class="w-4 h-4 mr-2"></i>
          Uninstall
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  if (window.lucide) {
    lucide.createIcons();
  }
}

function closeCodexLensUninstallWizard() {
  const modal = document.getElementById('codexlensUninstallModal');
  if (modal) {
    modal.remove();
  }
}

async function startCodexLensUninstall() {
  const progressDiv = document.getElementById('codexlensUninstallProgress');
  const uninstallBtn = document.getElementById('codexlensUninstallBtn');
  const statusText = document.getElementById('codexlensUninstallStatus');
  const progressBar = document.getElementById('codexlensUninstallProgressBar');

  // Show progress, disable button
  progressDiv.classList.remove('hidden');
  uninstallBtn.disabled = true;
  uninstallBtn.innerHTML = '<span class="animate-pulse">Uninstalling...</span>';

  // Simulate progress stages
  const stages = [
    { progress: 25, text: 'Removing virtual environment...' },
    { progress: 50, text: 'Deleting indexed data...' },
    { progress: 75, text: 'Cleaning up configuration...' },
    { progress: 90, text: 'Finalizing removal...' }
  ];

  let currentStage = 0;
  const progressInterval = setInterval(() => {
    if (currentStage < stages.length) {
      statusText.textContent = stages[currentStage].text;
      progressBar.style.width = `${stages[currentStage].progress}%`;
      currentStage++;
    }
  }, 500);

  try {
    const response = await fetch('/api/codexlens/uninstall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    clearInterval(progressInterval);
    const result = await response.json();

    if (result.success) {
      progressBar.style.width = '100%';
      statusText.textContent = 'Uninstallation complete!';

      setTimeout(() => {
        closeCodexLensUninstallWizard();
        showRefreshToast('CodexLens uninstalled successfully!', 'success');
        loadCodexLensStatus().then(() => renderCliStatus());
      }, 1000);
    } else {
      statusText.textContent = `Error: ${result.error}`;
      progressBar.classList.remove('bg-destructive');
      progressBar.classList.add('bg-destructive');
      uninstallBtn.disabled = false;
      uninstallBtn.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4 mr-2"></i> Retry';
      if (window.lucide) lucide.createIcons();
    }
  } catch (err) {
    clearInterval(progressInterval);
    statusText.textContent = `Error: ${err.message}`;
    progressBar.classList.remove('bg-destructive');
    progressBar.classList.add('bg-destructive');
    uninstallBtn.disabled = false;
    uninstallBtn.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4 mr-2"></i> Retry';
    if (window.lucide) lucide.createIcons();
  }
}

async function initCodexLensIndex() {
  // Get current workspace path from multiple sources
  let targetPath = null;

  // Helper function to check if path is valid
  const isValidPath = (path) => {
    return path && typeof path === 'string' && path.length > 0 &&
           (path.includes('/') || path.includes('\\')) &&
           !path.startsWith('{{') && !path.endsWith('}}');
  };

  console.log('[CodexLens] Attempting to get project path...');

  // Try 1: Global projectPath variable
  if (isValidPath(projectPath)) {
    targetPath = projectPath;
    console.log('[CodexLens] ✓ Using global projectPath:', targetPath);
  }

  // Try 2: Get from workflowData
  if (!targetPath && typeof workflowData !== 'undefined' && workflowData && isValidPath(workflowData.projectPath)) {
    targetPath = workflowData.projectPath;
    console.log('[CodexLens] ✓ Using workflowData.projectPath:', targetPath);
  }

  // Try 3: Get from current path display element
  if (!targetPath) {
    const currentPathEl = document.getElementById('currentPath');
    if (currentPathEl && currentPathEl.textContent) {
      const pathText = currentPathEl.textContent.trim();
      if (isValidPath(pathText)) {
        targetPath = pathText;
        console.log('[CodexLens] ✓ Using currentPath element text:', targetPath);
      }
    }
  }

  // Final validation
  if (!targetPath) {
    showRefreshToast('Error: No workspace loaded. Please open a workspace first.', 'error');
    console.error('[CodexLens] No valid project path available');
    console.error('[CodexLens] Attempted sources: projectPath:', projectPath, 'workflowData:', workflowData);
    return;
  }

  showRefreshToast('Initializing CodexLens index...', 'info');
  console.log('[CodexLens] Initializing index for path:', targetPath);

  try {
    const response = await fetch('/api/codexlens/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: targetPath })
    });

    const result = await response.json();
    console.log('[CodexLens] Init result:', result);

    if (result.success) {
      let data = null;

      // Try to parse nested JSON in output field
      if (result.output && typeof result.output === 'string') {
        try {
          // Extract JSON from output (it may contain other text before the JSON)
          const jsonMatch = result.output.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            data = parsed.result || parsed;
            console.log('[CodexLens] Parsed from output:', data);
          }
        } catch (e) {
          console.warn('[CodexLens] Failed to parse output as JSON:', e);
        }
      }

      // Fallback to direct result field
      if (!data) {
        data = result.result?.result || result.result || result;
      }

      const files = data.files_indexed || 0;
      const dirs = data.dirs_indexed || 0;
      const symbols = data.symbols_indexed || 0;

      console.log('[CodexLens] Parsed data:', { files, dirs, symbols });

      if (files === 0 && dirs === 0) {
        showRefreshToast(`Warning: No files indexed. Path: ${targetPath}`, 'warning');
        console.warn('[CodexLens] No files indexed. Full data:', data);
      } else {
        showRefreshToast(`Index created: ${files} files, ${dirs} directories`, 'success');
        console.log('[CodexLens] Index created successfully');

        // Reload CodexLens status and refresh the view
        loadCodexLensStatus().then(() => renderCliStatus());
      }
    } else {
      showRefreshToast(`Init failed: ${result.error}`, 'error');
      console.error('[CodexLens] Init error:', result.error);
    }
  } catch (err) {
    showRefreshToast(`Init error: ${err.message}`, 'error');
    console.error('[CodexLens] Exception:', err);
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
            </ul>
          </div>

          <div class="bg-primary/10 border border-primary/20 rounded-lg p-3">
            <div class="flex items-start gap-2">
              <i data-lucide="info" class="w-4 h-4 text-primary mt-0.5"></i>
              <div class="text-sm">
                <p class="font-medium text-primary">Download Size</p>
                <p class="text-muted-foreground">Total size: ~130MB. First-time model loading may take a few minutes.</p>
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
    { progress: 20, text: 'Installing sentence-transformers...' },
    { progress: 50, text: 'Downloading embedding model...' },
    { progress: 80, text: 'Setting up model cache...' },
    { progress: 95, text: 'Finalizing installation...' }
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

