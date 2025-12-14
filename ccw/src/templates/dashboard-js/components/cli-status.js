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

// LLM Enhancement settings for Semantic Search
let llmEnhancementSettings = {
  enabled: localStorage.getItem('ccw-llm-enhancement-enabled') === 'true',
  tool: localStorage.getItem('ccw-llm-enhancement-tool') || 'gemini',
  fallbackTool: localStorage.getItem('ccw-llm-enhancement-fallback') || 'qwen',
  batchSize: parseInt(localStorage.getItem('ccw-llm-enhancement-batch-size') || '5', 10),
  timeoutMs: parseInt(localStorage.getItem('ccw-llm-enhancement-timeout') || '300000', 10)
};

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
            </button>`
        }
      </div>
    </div>
  `;

  // Semantic Search card (only show if CodexLens is installed)
  const llmStatusBadge = llmEnhancementSettings.enabled 
    ? `<span class="badge px-1.5 py-0.5 text-xs rounded bg-success/20 text-success">LLM</span>`
    : '';
  const semanticHtml = codexLensStatus.ready ? `
    <div class="cli-tool-card tool-semantic clickable ${semanticStatus.available ? 'available' : 'unavailable'}"
         onclick="openSemanticSettingsModal()">
      <div class="cli-tool-header">
        <span class="cli-tool-status ${semanticStatus.available ? 'status-available' : 'status-unavailable'}"></span>
        <span class="cli-tool-name">Semantic Search</span>
        <span class="badge px-1.5 py-0.5 text-xs rounded ${semanticStatus.available ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}">AI</span>
        ${llmStatusBadge}
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
          <button class="btn-sm btn-primary w-full flex items-center justify-center gap-1" onclick="event.stopPropagation(); openSemanticInstallWizard()">
            <i data-lucide="brain" class="w-3 h-3"></i> Install AI Model
          </button>
          <div class="flex items-center justify-between w-full mt-1">
            <div class="flex items-center gap-1 text-xs text-muted-foreground">
              <i data-lucide="hard-drive" class="w-3 h-3"></i>
              <span>~500MB</span>
            </div>
            <button class="btn-sm btn-outline flex items-center gap-1" onclick="event.stopPropagation(); openSemanticSettingsModal()">
              <i data-lucide="settings" class="w-3 h-3"></i>
            </button>
          </div>
        ` : `
          <div class="flex items-center justify-between w-full">
            <div class="flex items-center gap-1 text-xs text-muted-foreground">
              <i data-lucide="cpu" class="w-3 h-3"></i>
              <span>bge-small-en-v1.5</span>
            </div>
            <button class="btn-sm btn-outline flex items-center gap-1" onclick="event.stopPropagation(); openSemanticSettingsModal()">
              <i data-lucide="settings" class="w-3 h-3"></i>
            </button>
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

// ========== Semantic Search Settings Modal ==========
function openSemanticSettingsModal() {
  const availableTools = Object.entries(cliToolStatus)
    .filter(function(entry) { return entry[1].available; })
    .map(function(entry) { return entry[0]; });

  const modal = document.createElement('div');
  modal.id = 'semanticSettingsModal';
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
  modal.onclick = function(e) { if (e.target === modal) closeSemanticSettingsModal(); };

  const toolOptions = availableTools.map(function(tool) {
    return '<option value="' + tool + '"' + (llmEnhancementSettings.tool === tool ? ' selected' : '') + '>' +
      tool.charAt(0).toUpperCase() + tool.slice(1) + '</option>';
  }).join('');

  const fallbackOptions = '<option value="">None</option>' + availableTools.map(function(tool) {
    return '<option value="' + tool + '"' + (llmEnhancementSettings.fallbackTool === tool ? ' selected' : '') + '>' +
      tool.charAt(0).toUpperCase() + tool.slice(1) + '</option>';
  }).join('');

  const disabled = !llmEnhancementSettings.enabled ? 'disabled' : '';
  const opacityClass = !llmEnhancementSettings.enabled ? 'opacity-50' : '';

  modal.innerHTML =
    '<div class="bg-card rounded-lg shadow-xl w-full max-w-lg mx-4 overflow-hidden" onclick="event.stopPropagation()">' +
      '<div class="p-6">' +
        '<div class="flex items-center gap-3 mb-4">' +
          '<div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">' +
            '<i data-lucide="sparkles" class="w-5 h-5 text-primary"></i>' +
          '</div>' +
          '<div>' +
            '<h3 class="text-lg font-semibold">Semantic Search Settings</h3>' +
            '<p class="text-sm text-muted-foreground">Configure LLM enhancement for semantic indexing</p>' +
          '</div>' +
        '</div>' +
        '<div class="space-y-4">' +
          '<div class="flex items-center justify-between p-4 bg-muted/50 rounded-lg">' +
            '<div>' +
              '<h4 class="font-medium flex items-center gap-2">' +
                '<i data-lucide="brain" class="w-4 h-4"></i>LLM Enhancement</h4>' +
              '<p class="text-sm text-muted-foreground mt-1">Use LLM to generate code summaries for better semantic search</p>' +
            '</div>' +
            '<label class="cli-toggle">' +
              '<input type="checkbox" id="llmEnhancementToggle" ' + (llmEnhancementSettings.enabled ? 'checked' : '') +
              ' onchange="toggleLlmEnhancement(this.checked)">' +
              '<span class="cli-toggle-slider"></span>' +
            '</label>' +
          '</div>' +
          '<div class="p-4 bg-muted/30 rounded-lg space-y-4 ' + opacityClass + '" id="llmSettingsSection">' +
            '<div class="grid grid-cols-2 gap-4">' +
              '<div>' +
                '<label class="block text-sm font-medium mb-2">' +
                  '<i data-lucide="cpu" class="w-3 h-3 inline mr-1"></i>Primary LLM Tool</label>' +
                '<select class="cli-setting-select w-full" id="llmToolSelect" onchange="updateLlmTool(this.value)" ' + disabled + '>' + toolOptions + '</select>' +
              '</div>' +
              '<div>' +
                '<label class="block text-sm font-medium mb-2">' +
                  '<i data-lucide="refresh-cw" class="w-3 h-3 inline mr-1"></i>Fallback Tool</label>' +
                '<select class="cli-setting-select w-full" id="llmFallbackSelect" onchange="updateLlmFallback(this.value)" ' + disabled + '>' + fallbackOptions + '</select>' +
              '</div>' +
            '</div>' +
            '<div class="grid grid-cols-2 gap-4">' +
              '<div>' +
                '<label class="block text-sm font-medium mb-2">' +
                  '<i data-lucide="layers" class="w-3 h-3 inline mr-1"></i>Batch Size</label>' +
                '<select class="cli-setting-select w-full" id="llmBatchSelect" onchange="updateLlmBatchSize(this.value)" ' + disabled + '>' +
                  '<option value="1"' + (llmEnhancementSettings.batchSize === 1 ? ' selected' : '') + '>1 file</option>' +
                  '<option value="3"' + (llmEnhancementSettings.batchSize === 3 ? ' selected' : '') + '>3 files</option>' +
                  '<option value="5"' + (llmEnhancementSettings.batchSize === 5 ? ' selected' : '') + '>5 files</option>' +
                  '<option value="10"' + (llmEnhancementSettings.batchSize === 10 ? ' selected' : '') + '>10 files</option>' +
                '</select>' +
              '</div>' +
              '<div>' +
                '<label class="block text-sm font-medium mb-2">' +
                  '<i data-lucide="clock" class="w-3 h-3 inline mr-1"></i>Timeout</label>' +
                '<select class="cli-setting-select w-full" id="llmTimeoutSelect" onchange="updateLlmTimeout(this.value)" ' + disabled + '>' +
                  '<option value="60000"' + (llmEnhancementSettings.timeoutMs === 60000 ? ' selected' : '') + '>1 min</option>' +
                  '<option value="180000"' + (llmEnhancementSettings.timeoutMs === 180000 ? ' selected' : '') + '>3 min</option>' +
                  '<option value="300000"' + (llmEnhancementSettings.timeoutMs === 300000 ? ' selected' : '') + '>5 min</option>' +
                  '<option value="600000"' + (llmEnhancementSettings.timeoutMs === 600000 ? ' selected' : '') + '>10 min</option>' +
                '</select>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="bg-primary/5 border border-primary/20 rounded-lg p-3">' +
            '<div class="flex items-start gap-2">' +
              '<i data-lucide="info" class="w-4 h-4 text-primary mt-0.5"></i>' +
              '<div class="text-sm text-muted-foreground">' +
                '<p>LLM enhancement generates code summaries and keywords for each file, improving semantic search accuracy.</p>' +
                '<p class="mt-1">Run <code class="bg-muted px-1 rounded">codex-lens enhance</code> after enabling to process existing files.</p>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="flex gap-2 pt-2">' +
            '<button class="btn-sm btn-outline flex items-center gap-1 flex-1" onclick="runEnhanceCommand()" ' + disabled + '>' +
              '<i data-lucide="zap" class="w-3 h-3"></i>Run Enhance Now</button>' +
            '<button class="btn-sm btn-outline flex items-center gap-1 flex-1" onclick="viewEnhanceStatus()">' +
              '<i data-lucide="bar-chart-2" class="w-3 h-3"></i>View Status</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="border-t border-border p-4 flex justify-end gap-3 bg-muted/30">' +
        '<button class="btn-outline px-4 py-2" onclick="closeSemanticSettingsModal()">Close</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);

  var handleEscape = function(e) {
    if (e.key === 'Escape') {
      closeSemanticSettingsModal();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);

  if (window.lucide) {
    lucide.createIcons();
  }
}

function closeSemanticSettingsModal() {
  var modal = document.getElementById('semanticSettingsModal');
  if (modal) modal.remove();
}

function toggleLlmEnhancement(enabled) {
  llmEnhancementSettings.enabled = enabled;
  localStorage.setItem('ccw-llm-enhancement-enabled', enabled.toString());

  var settingsSection = document.getElementById('llmSettingsSection');
  if (settingsSection) {
    settingsSection.classList.toggle('opacity-50', !enabled);
    settingsSection.querySelectorAll('select').forEach(function(el) { el.disabled = !enabled; });
  }

  renderCliStatus();
  showRefreshToast('LLM Enhancement ' + (enabled ? 'enabled' : 'disabled'), 'success');
}

function updateLlmTool(tool) {
  llmEnhancementSettings.tool = tool;
  localStorage.setItem('ccw-llm-enhancement-tool', tool);
  showRefreshToast('Primary LLM tool set to ' + tool, 'success');
}

function updateLlmFallback(tool) {
  llmEnhancementSettings.fallbackTool = tool;
  localStorage.setItem('ccw-llm-enhancement-fallback', tool);
  showRefreshToast('Fallback tool set to ' + (tool || 'none'), 'success');
}

function updateLlmBatchSize(size) {
  llmEnhancementSettings.batchSize = parseInt(size, 10);
  localStorage.setItem('ccw-llm-enhancement-batch-size', size);
  showRefreshToast('Batch size set to ' + size + ' files', 'success');
}

function updateLlmTimeout(ms) {
  llmEnhancementSettings.timeoutMs = parseInt(ms, 10);
  localStorage.setItem('ccw-llm-enhancement-timeout', ms);
  var mins = parseInt(ms, 10) / 60000;
  showRefreshToast('Timeout set to ' + mins + ' minute' + (mins > 1 ? 's' : ''), 'success');
}

async function runEnhanceCommand() {
  if (!llmEnhancementSettings.enabled) {
    showRefreshToast('Please enable LLM Enhancement first', 'warning');
    return;
  }

  showRefreshToast('Starting LLM enhancement...', 'info');
  closeSemanticSettingsModal();

  try {
    var response = await fetch('/api/codexlens/enhance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: projectPath,
        tool: llmEnhancementSettings.tool,
        batchSize: llmEnhancementSettings.batchSize,
        timeoutMs: llmEnhancementSettings.timeoutMs
      })
    });

    var result = await response.json();
    if (result.success) {
      var enhanced = result.result?.enhanced || 0;
      showRefreshToast('Enhanced ' + enhanced + ' files with LLM', 'success');
    } else {
      showRefreshToast('Enhance failed: ' + result.error, 'error');
    }
  } catch (err) {
    showRefreshToast('Enhance error: ' + err.message, 'error');
  }
}

function viewEnhanceStatus() {
  openSemanticMetadataViewer();
}

// ========== Semantic Metadata Viewer ==========
var semanticMetadataCache = {
  entries: [],
  total: 0,
  offset: 0,
  limit: 50,
  loading: false
};

async function openSemanticMetadataViewer() {
  closeSemanticSettingsModal();

  var modal = document.createElement('div');
  modal.id = 'semanticMetadataModal';
  modal.className = 'generic-modal-overlay';
  modal.onclick = function(e) { if (e.target === modal) closeSemanticMetadataViewer(); };

  modal.innerHTML =
    '<div class="generic-modal large" onclick="event.stopPropagation()">' +
      '<div class="generic-modal-header">' +
        '<div class="flex items-center gap-3">' +
          '<i data-lucide="database" class="w-5 h-5 text-primary"></i>' +
          '<h3 class="generic-modal-title">Semantic Metadata Browser</h3>' +
          '<span id="semanticMetadataCount" class="badge bg-muted text-muted-foreground px-2 py-0.5 text-xs rounded">Loading...</span>' +
        '</div>' +
        '<button class="generic-modal-close" onclick="closeSemanticMetadataViewer()">' +
          '<i data-lucide="x" class="w-4 h-4"></i>' +
        '</button>' +
      '</div>' +
      '<div class="generic-modal-body p-0">' +
        '<div class="semantic-viewer-toolbar">' +
          '<div class="flex items-center gap-3">' +
            '<select id="semanticToolFilter" class="cli-setting-select" onchange="filterSemanticByTool(this.value)">' +
              '<option value="">All Tools</option>' +
              '<option value="gemini">Gemini</option>' +
              '<option value="qwen">Qwen</option>' +
            '</select>' +
            '<button class="btn-sm btn-outline flex items-center gap-1" onclick="refreshSemanticMetadata()">' +
              '<i data-lucide="refresh-cw" class="w-3 h-3"></i> Refresh' +
            '</button>' +
          '</div>' +
          '<div class="flex items-center gap-2 text-sm text-muted-foreground">' +
            '<span id="semanticPaginationInfo">-</span>' +
          '</div>' +
        '</div>' +
        '<div id="semanticMetadataTableContainer" class="semantic-table-container">' +
          '<div class="semantic-loading">' +
            '<div class="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>' +
            '<span>Loading metadata...</span>' +
          '</div>' +
        '</div>' +
        '<div class="semantic-viewer-footer">' +
          '<button id="semanticPrevBtn" class="btn-sm btn-outline" onclick="semanticPrevPage()" disabled>' +
            '<i data-lucide="chevron-left" class="w-4 h-4"></i> Previous' +
          '</button>' +
          '<div class="flex items-center gap-2">' +
            '<span class="text-sm text-muted-foreground">Page</span>' +
            '<select id="semanticPageSelect" class="cli-setting-select" onchange="semanticGoToPage(this.value)">' +
              '<option value="0">1</option>' +
            '</select>' +
          '</div>' +
          '<button id="semanticNextBtn" class="btn-sm btn-outline" onclick="semanticNextPage()" disabled>' +
            'Next <i data-lucide="chevron-right" class="w-4 h-4"></i>' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);

  requestAnimationFrame(function() {
    modal.classList.add('active');
  });

  var handleEscape = function(e) {
    if (e.key === 'Escape') {
      closeSemanticMetadataViewer();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);

  if (window.lucide) {
    lucide.createIcons();
  }

  await loadSemanticMetadata();
}

function closeSemanticMetadataViewer() {
  var modal = document.getElementById('semanticMetadataModal');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(function() { modal.remove(); }, 200);
  }
}

async function loadSemanticMetadata(offset, toolFilter) {
  offset = typeof offset === 'number' ? offset : semanticMetadataCache.offset;
  toolFilter = toolFilter !== undefined ? toolFilter : (document.getElementById('semanticToolFilter')?.value || '');

  semanticMetadataCache.loading = true;

  var container = document.getElementById('semanticMetadataTableContainer');
  if (container) {
    container.innerHTML =
      '<div class="semantic-loading">' +
        '<div class="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>' +
        '<span>Loading metadata...</span>' +
      '</div>';
  }

  try {
    var url = '/api/codexlens/semantic/metadata?offset=' + offset + '&limit=' + semanticMetadataCache.limit;
    if (toolFilter) {
      url += '&tool=' + encodeURIComponent(toolFilter);
    }

    var response = await fetch(url);
    var data = await response.json();

    if (data.success && data.result) {
      semanticMetadataCache.entries = data.result.entries || [];
      semanticMetadataCache.total = data.result.total || 0;
      semanticMetadataCache.offset = offset;

      renderSemanticMetadataTable();
      updateSemanticPagination();
    } else {
      container.innerHTML =
        '<div class="semantic-empty">' +
          '<i data-lucide="alert-circle" class="w-8 h-8 text-muted-foreground"></i>' +
          '<p>Error loading metadata: ' + (data.error || 'Unknown error') + '</p>' +
        '</div>';
      if (window.lucide) lucide.createIcons();
    }
  } catch (err) {
    container.innerHTML =
      '<div class="semantic-empty">' +
        '<i data-lucide="alert-circle" class="w-8 h-8 text-muted-foreground"></i>' +
        '<p>Error: ' + err.message + '</p>' +
      '</div>';
    if (window.lucide) lucide.createIcons();
  }

  semanticMetadataCache.loading = false;
}

function escapeHtmlSemantic(text) {
  if (!text) return '';
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderSemanticMetadataTable() {
  var container = document.getElementById('semanticMetadataTableContainer');
  if (!container) return;

  var entries = semanticMetadataCache.entries;

  if (!entries.length) {
    container.innerHTML =
      '<div class="semantic-empty">' +
        '<i data-lucide="database" class="w-12 h-12 text-muted-foreground mb-3"></i>' +
        '<p class="text-lg font-medium">No semantic metadata found</p>' +
        '<p class="text-sm text-muted-foreground mt-1">Run \'codex-lens enhance\' to generate metadata for indexed files.</p>' +
        '<button class="btn-sm btn-primary mt-4" onclick="closeSemanticMetadataViewer(); runEnhanceCommand();">' +
          '<i data-lucide="zap" class="w-3 h-3 mr-1"></i> Run Enhance' +
        '</button>' +
      '</div>';
    if (window.lucide) lucide.createIcons();
    return;
  }

  var rows = entries.map(function(entry, idx) {
    var keywordsHtml = (entry.keywords || []).slice(0, 4).map(function(k) {
      return '<span class="semantic-keyword">' + escapeHtmlSemantic(k) + '</span>';
    }).join('');
    if ((entry.keywords || []).length > 4) {
      keywordsHtml += '<span class="semantic-keyword-more">+' + (entry.keywords.length - 4) + '</span>';
    }

    var date = entry.generated_at ? new Date(entry.generated_at * 1000).toLocaleDateString() : '-';

    return (
      '<tr class="semantic-row" onclick="toggleSemanticDetail(' + idx + ')">' +
        '<td class="semantic-cell-file">' +
          '<div class="flex items-center gap-2">' +
            '<i data-lucide="file-code" class="w-4 h-4 text-muted-foreground"></i>' +
            '<span class="font-medium">' + escapeHtmlSemantic(entry.file_name || '-') + '</span>' +
          '</div>' +
          '<div class="text-xs text-muted-foreground truncate" title="' + escapeHtmlSemantic(entry.full_path || '') + '">' +
            escapeHtmlSemantic(entry.full_path || '-') +
          '</div>' +
        '</td>' +
        '<td class="semantic-cell-lang">' + escapeHtmlSemantic(entry.language || '-') + '</td>' +
        '<td class="semantic-cell-purpose">' + escapeHtmlSemantic((entry.purpose || '-').substring(0, 50)) +
          ((entry.purpose || '').length > 50 ? '...' : '') + '</td>' +
        '<td class="semantic-cell-keywords">' + (keywordsHtml || '-') + '</td>' +
        '<td class="semantic-cell-tool">' +
          '<span class="tool-badge tool-' + (entry.llm_tool || 'unknown') + '">' +
            escapeHtmlSemantic(entry.llm_tool || '-') +
          '</span>' +
        '</td>' +
        '<td class="semantic-cell-date">' + date + '</td>' +
      '</tr>' +
      '<tr id="semanticDetail' + idx + '" class="semantic-detail-row hidden">' +
        '<td colspan="6">' +
          '<div class="semantic-detail-content">' +
            '<div class="semantic-detail-section">' +
              '<h4><i data-lucide="file-text" class="w-3 h-3"></i> Summary</h4>' +
              '<p>' + escapeHtmlSemantic(entry.summary || 'No summary available') + '</p>' +
            '</div>' +
            '<div class="semantic-detail-section">' +
              '<h4><i data-lucide="tag" class="w-3 h-3"></i> All Keywords</h4>' +
              '<div class="semantic-keywords-full">' +
                (entry.keywords || []).map(function(k) {
                  return '<span class="semantic-keyword">' + escapeHtmlSemantic(k) + '</span>';
                }).join('') +
              '</div>' +
            '</div>' +
            '<div class="semantic-detail-meta">' +
              '<span><i data-lucide="hash" class="w-3 h-3"></i> ' + (entry.line_count || 0) + ' lines</span>' +
              '<span><i data-lucide="cpu" class="w-3 h-3"></i> ' + escapeHtmlSemantic(entry.llm_tool || 'Unknown') + '</span>' +
              '<span><i data-lucide="calendar" class="w-3 h-3"></i> ' + date + '</span>' +
            '</div>' +
          '</div>' +
        '</td>' +
      '</tr>'
    );
  }).join('');

  container.innerHTML =
    '<table class="semantic-table">' +
      '<thead>' +
        '<tr>' +
          '<th>File</th>' +
          '<th>Language</th>' +
          '<th>Purpose</th>' +
          '<th>Keywords</th>' +
          '<th>Tool</th>' +
          '<th>Date</th>' +
        '</tr>' +
      '</thead>' +
      '<tbody>' + rows + '</tbody>' +
    '</table>';

  if (window.lucide) lucide.createIcons();
}

function toggleSemanticDetail(idx) {
  var detailRow = document.getElementById('semanticDetail' + idx);
  if (detailRow) {
    detailRow.classList.toggle('hidden');
    if (window.lucide) lucide.createIcons();
  }
}

function updateSemanticPagination() {
  var total = semanticMetadataCache.total;
  var offset = semanticMetadataCache.offset;
  var limit = semanticMetadataCache.limit;
  var entries = semanticMetadataCache.entries;

  var countBadge = document.getElementById('semanticMetadataCount');
  if (countBadge) {
    countBadge.textContent = total + ' entries';
  }

  var paginationInfo = document.getElementById('semanticPaginationInfo');
  if (paginationInfo) {
    if (total > 0) {
      paginationInfo.textContent = (offset + 1) + '-' + (offset + entries.length) + ' of ' + total;
    } else {
      paginationInfo.textContent = 'No entries';
    }
  }

  var pageSelect = document.getElementById('semanticPageSelect');
  if (pageSelect) {
    var totalPages = Math.ceil(total / limit) || 1;
    var currentPage = Math.floor(offset / limit);

    pageSelect.innerHTML = '';
    for (var i = 0; i < totalPages; i++) {
      var opt = document.createElement('option');
      opt.value = i;
      opt.textContent = i + 1;
      if (i === currentPage) opt.selected = true;
      pageSelect.appendChild(opt);
    }
  }

  var prevBtn = document.getElementById('semanticPrevBtn');
  var nextBtn = document.getElementById('semanticNextBtn');
  if (prevBtn) prevBtn.disabled = offset === 0;
  if (nextBtn) nextBtn.disabled = offset + limit >= total;
}

function semanticPrevPage() {
  if (semanticMetadataCache.offset > 0) {
    loadSemanticMetadata(Math.max(0, semanticMetadataCache.offset - semanticMetadataCache.limit));
  }
}

function semanticNextPage() {
  if (semanticMetadataCache.offset + semanticMetadataCache.limit < semanticMetadataCache.total) {
    loadSemanticMetadata(semanticMetadataCache.offset + semanticMetadataCache.limit);
  }
}

function semanticGoToPage(pageIndex) {
  var offset = parseInt(pageIndex, 10) * semanticMetadataCache.limit;
  loadSemanticMetadata(offset);
}

function filterSemanticByTool(tool) {
  loadSemanticMetadata(0, tool);
}

function refreshSemanticMetadata() {
  loadSemanticMetadata(semanticMetadataCache.offset);
}

function getLlmEnhancementSettings() {
  return Object.assign({}, llmEnhancementSettings);
}
