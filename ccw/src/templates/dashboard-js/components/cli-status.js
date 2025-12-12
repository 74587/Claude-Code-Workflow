// CLI Status Component
// Displays CLI tool availability status and allows setting default tool

// ========== CLI State ==========
let cliToolStatus = { gemini: {}, qwen: {}, codex: {} };
let codexLensStatus = { ready: false };
let defaultCliTool = 'gemini';

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

    return data;
  } catch (err) {
    console.error('Failed to load CodexLens status:', err);
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
        <div class="cli-tool-info">
          ${isAvailable
            ? `<span class="text-success">Ready</span>`
            : `<span class="text-muted-foreground">Not Installed</span>`
          }
        </div>
        ${isAvailable && !isDefault
          ? `<button class="btn-sm btn-outline" onclick="setDefaultCliTool('${tool}')">Set Default</button>`
          : ''
        }
      </div>
    `;
  }).join('');

  // CodexLens card
  const codexLensHtml = `
    <div class="cli-tool-card tool-codexlens ${codexLensStatus.ready ? 'available' : 'unavailable'}">
      <div class="cli-tool-header">
        <span class="cli-tool-status ${codexLensStatus.ready ? 'status-available' : 'status-unavailable'}"></span>
        <span class="cli-tool-name">CodexLens</span>
        <span class="badge px-1.5 py-0.5 text-xs rounded bg-muted text-muted-foreground">Index</span>
      </div>
      <div class="cli-tool-info">
        ${codexLensStatus.ready
          ? `<span class="text-success">v${codexLensStatus.version || 'installed'}</span>`
          : `<span class="text-muted-foreground">Not Installed</span>`
        }
      </div>
      <div class="cli-tool-actions flex gap-2 mt-2">
        ${!codexLensStatus.ready
          ? `<button class="btn-sm btn-primary" onclick="installCodexLens()">Install</button>`
          : `<button class="btn-sm btn-outline" onclick="initCodexLensIndex()">Init Index</button>`
        }
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
    </div>
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
