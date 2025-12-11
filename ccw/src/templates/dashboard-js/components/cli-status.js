// CLI Status Component
// Displays CLI tool availability status and allows setting default tool

// ========== CLI State ==========
let cliToolStatus = { gemini: {}, qwen: {}, codex: {} };
let defaultCliTool = 'gemini';

// ========== Initialization ==========
function initCliStatus() {
  // Load CLI status on init
  loadCliToolStatus();
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

  container.innerHTML = `
    <div class="cli-status-header">
      <h3><i data-lucide="terminal" class="w-4 h-4"></i> CLI Tools</h3>
      <button class="btn-icon" onclick="loadCliToolStatus()" title="Refresh">
        <i data-lucide="refresh-cw" class="w-4 h-4"></i>
      </button>
    </div>
    <div class="cli-tools-grid">
      ${toolsHtml}
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
