// CLI Status Component
// Displays CLI tool availability status and allows setting default tool

// ========== CLI State ==========
let cliToolStatus = {}; // Dynamically populated from config
let codexLensStatus = { ready: false };
let semanticStatus = { available: false };
let ccwInstallStatus = { installed: true, workflowsInstalled: true, missingFiles: [], installPath: '' };
let defaultCliTool = 'gemini';
let promptConcatFormat = localStorage.getItem('ccw-prompt-format') || 'plain'; // plain, yaml, json
let cliToolsConfig = {}; // CLI tools enable/disable config
let apiEndpoints = []; // API endpoints from LiteLLM config
let cliSettingsEndpoints = []; // CLI Settings endpoints (for Claude wrapper)

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

    // Update all status data - merge with config tools to ensure all tools are tracked
    cliToolStatus = data.cli || {};
    codexLensStatus = data.codexLens || { ready: false };
    semanticStatus = data.semantic || { available: false };
    ccwInstallStatus = data.ccwInstall || { installed: true, workflowsInstalled: true, missingFiles: [], installPath: '' };

    // Load CLI tools config, API endpoints, and CLI Settings
    await Promise.all([
      loadCliToolsConfig(),
      loadApiEndpoints(),
      loadCliSettingsEndpoints()
    ]);

    // Update badges
    updateCliBadge();
    updateCodexLensBadge();
    updateCcwInstallBadge();

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
    loadCliToolsConfig(), // Ensure config is loaded (auto-creates if missing)
    loadCliToolStatus()
    // CodexLens status removed - managed in dedicated CodexLens Manager page
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
      version: data.version || null,
      installedModels: []  // Will be populated by loadSemanticStatus
    };

    // Update CodexLens badge
    updateCodexLensBadge();

    // If CodexLens is ready, also check semantic status and models
    if (data.ready) {
      await loadSemanticStatus();
      await loadInstalledModels();
    }

    return data;
  } catch (err) {
    console.error('Failed to load CodexLens status:', err);
    return null;
  }
}

/**
 * Load CodexLens dashboard data using aggregated endpoint (single API call)
 * This is optimized for the CodexLens Manager page initialization
 * @returns {Promise<object|null>} Dashboard init data or null on error
 */
async function loadCodexLensDashboardInit() {
  try {
    const response = await fetch('/api/codexlens/dashboard-init');
    if (!response.ok) throw new Error('Failed to load CodexLens dashboard init');
    const data = await response.json();

    // Update status variables from aggregated response
    codexLensStatus = data.status || { ready: false };
    semanticStatus = data.semantic || { available: false };

    // Expose to window for other modules
    if (!window.cliToolsStatus) {
      window.cliToolsStatus = {};
    }
    window.cliToolsStatus.codexlens = {
      installed: data.installed || false,
      version: data.status?.version || null,
      installedModels: [],
      config: data.config || {},
      semantic: data.semantic || {}
    };

    // Store config globally for easy access
    window.codexLensConfig = data.config || {};
    window.codexLensStatusData = data.statusData || {};

    // Update badges
    updateCodexLensBadge();

    console.log('[CLI Status] CodexLens dashboard init loaded:', {
      installed: data.installed,
      version: data.status?.version,
      semanticAvailable: data.semantic?.available
    });

    return data;
  } catch (err) {
    console.error('Failed to load CodexLens dashboard init:', err);
    // Fallback to individual calls
    return await loadCodexLensStatus();
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

/**
 * Load installed embedding models
 */
async function loadInstalledModels() {
  try {
    const response = await fetch('/api/codexlens/models');
    if (!response.ok) throw new Error('Failed to load models');
    const data = await response.json();
    
    if (data.success && data.result && data.result.models) {
      // Filter to only installed models
      const installedModels = data.result.models
        .filter(m => m.installed)
        .map(m => m.profile);
      
      // Update window.cliToolsStatus
      if (window.cliToolsStatus && window.cliToolsStatus.codexlens) {
        window.cliToolsStatus.codexlens.installedModels = installedModels;
        window.cliToolsStatus.codexlens.allModels = data.result.models;
      }
      
      console.log('[CLI Status] Installed models:', installedModels);
      return installedModels;
    }
    return [];
  } catch (err) {
    console.error('Failed to load installed models:', err);
    return [];
  }
}

/**
 * Load CLI tools config from .claude/cli-tools.json (project or global fallback)
 */
async function loadCliToolsConfig() {
  try {
    const response = await fetch('/api/cli/tools-config');
    if (!response.ok) return null;
    const data = await response.json();
    // Store full config and extract tools object (data.tools is full config, data.tools.tools is the actual tools)
    cliToolsConfig = data.tools?.tools || {};
    window.claudeCliToolsConfig = data; // Full config available globally

    // Load default tool from config
    if (data.defaultTool) {
      defaultCliTool = data.defaultTool;
    }

    console.log('[CLI Config] Loaded from:', data._configInfo?.source || 'unknown', '| Default:', data.defaultTool);
    return data;
  } catch (err) {
    console.error('Failed to load CLI tools config:', err);
    return null;
  }
}

/**
 * Update CLI tool enabled status
 */
async function updateCliToolEnabled(tool, enabled) {
  try {
    const response = await fetch('/api/cli/tools-config/' + tool, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: enabled })
    });
    if (!response.ok) throw new Error('Failed to update');
    showRefreshToast(tool + (enabled ? ' enabled' : ' disabled'), 'success');
    return await response.json();
  } catch (err) {
    console.error('Failed to update CLI tool:', err);
    showRefreshToast('Failed to update ' + tool, 'error');
    return null;
  }
}

/**
 * Load API endpoints from LiteLLM config
 */
async function loadApiEndpoints() {
  try {
    const response = await fetch('/api/litellm-api/endpoints');
    if (!response.ok) return [];
    const data = await response.json();
    apiEndpoints = data.endpoints || [];
    return apiEndpoints;
  } catch (err) {
    console.error('Failed to load API endpoints:', err);
    return [];
  }
}

/**
 * Load CLI Settings endpoints (Claude wrapper configurations)
 */
async function loadCliSettingsEndpoints() {
  try {
    const response = await fetch('/api/cli/settings');
    if (!response.ok) return [];
    const data = await response.json();
    cliSettingsEndpoints = data.endpoints || [];
    return cliSettingsEndpoints;
  } catch (err) {
    console.error('Failed to load CLI settings endpoints:', err);
    return [];
  }
}

// ========== Badge Update ==========
function updateCliBadge() {
  const badge = document.getElementById('badgeCliTools');
  if (badge) {
    // Only count builtin and cli-wrapper tools (exclude api-endpoint tools)
    const cliTools = Object.keys(cliToolsConfig).filter(t => {
      if (!t || t === '_configInfo') return false;
      const config = cliToolsConfig[t];
      // Include if: no type (legacy builtin), type is builtin, or type is cli-wrapper
      return !config?.type || config.type === 'builtin' || config.type === 'cli-wrapper';
    });

    // Count available and enabled CLI tools only
    let available = 0;
    cliTools.forEach(tool => {
      const status = cliToolStatus[tool] || {};
      const config = cliToolsConfig[tool] || { enabled: true };
      if (status.available && config.enabled !== false) {
        available++;
      }
    });

    // CLI tools badge shows only CLI tools count
    const total = cliTools.length;
    badge.textContent = `${available}/${total}`;
    badge.classList.toggle('text-success', available === total && total > 0);
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

function updateCcwInstallBadge() {
  const badge = document.getElementById('badgeCcwInstall');
  if (badge) {
    if (ccwInstallStatus.installed) {
      badge.textContent = t('status.installed');
      badge.classList.add('text-success');
      badge.classList.remove('text-warning', 'text-destructive');
    } else if (ccwInstallStatus.workflowsInstalled === false) {
      badge.textContent = t('status.incomplete');
      badge.classList.add('text-warning');
      badge.classList.remove('text-success', 'text-destructive');
    } else {
      badge.textContent = t('status.notInstalled');
      badge.classList.add('text-destructive');
      badge.classList.remove('text-success', 'text-warning');
    }
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
    claude: 'Anthropic AI assistant',
    opencode: 'OpenCode multi-model API'
  };

  const toolIcons = {
    gemini: 'sparkle',
    qwen: 'bot',
    codex: 'code-2',
    claude: 'brain',
    opencode: 'globe'  // Default icon for new tools
  };

  // Helper to get description for any tool (with fallback)
  const getToolDescription = (tool) => {
    return toolDescriptions[tool] || `${tool.charAt(0).toUpperCase() + tool.slice(1)} CLI tool`;
  };

  // Helper to get icon for any tool (with fallback)
  const getToolIcon = (tool) => {
    return toolIcons[tool] || 'terminal';
  };

  // Get tools dynamically from config, merging with status for complete list
  // Only show builtin and cli-wrapper tools in the tools grid (api-endpoint tools show in API Endpoints section)
  const tools = [...new Set([
    ...Object.keys(cliToolsConfig),
    ...Object.keys(cliToolStatus)
  ])].filter(t => {
    if (!t || t === '_configInfo') return false;
    const config = cliToolsConfig[t];
    // Include if: no type (legacy builtin), type is builtin, or type is cli-wrapper
    return !config?.type || config.type === 'builtin' || config.type === 'cli-wrapper';
  });

  const toolsHtml = tools.map(tool => {
    const status = cliToolStatus[tool] || {};
    const isAvailable = status.available;
    const isDefault = defaultCliTool === tool;
    const config = cliToolsConfig[tool] || { enabled: true };
    const isEnabled = config.enabled !== false;
    const canSetDefault = isAvailable && isEnabled && !isDefault;

    // Special handling for Claude: show CLI Settings info
    const isClaude = tool === 'claude';
    const enabledCliSettings = isClaude ? cliSettingsEndpoints.filter(ep => ep.enabled) : [];
    const hasCliSettings = enabledCliSettings.length > 0;

    // Build CLI Settings badge for Claude
    let cliSettingsBadge = '';
    if (isClaude && hasCliSettings) {
      cliSettingsBadge = `<span class="cli-tool-badge cli-settings-badge" title="${enabledCliSettings.length} endpoint(s) configured">${enabledCliSettings.length} Endpoint${enabledCliSettings.length > 1 ? 's' : ''}</span>`;
    }

    // Build CLI Settings info for Claude
    let cliSettingsInfo = '';
    if (isClaude) {
      if (hasCliSettings) {
        const epNames = enabledCliSettings.slice(0, 2).map(ep => ep.name).join(', ');
        const moreCount = enabledCliSettings.length > 2 ? ` +${enabledCliSettings.length - 2}` : '';
        cliSettingsInfo = `
          <div class="cli-settings-info mt-2 p-2 rounded bg-muted/50 text-xs">
            <div class="flex items-center gap-1 text-muted-foreground mb-1">
              <i data-lucide="settings-2" class="w-3 h-3"></i>
              <span>CLI Wrapper Endpoints:</span>
            </div>
            <div class="text-foreground font-medium">${epNames}${moreCount}</div>
            <a href="#" onclick="navigateToApiSettings('cli-settings'); return false;" class="text-primary hover:underline mt-1 inline-flex items-center gap-1">
              <i data-lucide="external-link" class="w-3 h-3"></i>
              Configure
            </a>
          </div>
        `;
      } else {
        cliSettingsInfo = `
          <div class="cli-settings-info mt-2 p-2 rounded bg-muted/30 text-xs">
            <div class="flex items-center gap-1 text-muted-foreground">
              <i data-lucide="info" class="w-3 h-3"></i>
              <span>No CLI wrapper configured</span>
            </div>
            <a href="#" onclick="navigateToApiSettings('cli-settings'); return false;" class="text-primary hover:underline mt-1 inline-flex items-center gap-1">
              <i data-lucide="plus" class="w-3 h-3"></i>
              Add Endpoint
            </a>
          </div>
        `;
      }
    }

    return `
      <div class="cli-tool-card tool-${tool} ${isAvailable ? 'available' : 'unavailable'} ${!isEnabled ? 'disabled' : ''}">
        <div class="cli-tool-header">
          <span class="cli-tool-status ${isAvailable && isEnabled ? 'status-available' : 'status-unavailable'}"></span>
          <span class="cli-tool-name">${tool.charAt(0).toUpperCase() + tool.slice(1)}</span>
          ${isDefault ? '<span class="cli-tool-badge">Default</span>' : ''}
          ${!isEnabled && isAvailable ? '<span class="cli-tool-badge-disabled">Disabled</span>' : ''}
          ${cliSettingsBadge}
        </div>
        <div class="cli-tool-desc text-xs text-muted-foreground mt-1">
          ${getToolDescription(tool)}
        </div>
        <div class="cli-tool-info mt-2 flex items-center justify-between">
          <div>
            ${isAvailable
              ? (isEnabled
                  ? `<span class="text-success flex items-center gap-1"><i data-lucide="check-circle" class="w-3 h-3"></i> Ready</span>`
                  : `<span class="text-warning flex items-center gap-1"><i data-lucide="pause-circle" class="w-3 h-3"></i> Disabled</span>`)
              : `<span class="text-muted-foreground flex items-center gap-1"><i data-lucide="circle-dashed" class="w-3 h-3"></i> Not Installed</span>`
            }
          </div>
        </div>
        ${cliSettingsInfo}
        <div class="cli-tool-actions mt-3 flex gap-2">
          ${isAvailable ? (isEnabled
            ? `<button class="btn-sm btn-outline-warning flex items-center gap-1" onclick="toggleCliTool('${tool}', false)">
                <i data-lucide="pause" class="w-3 h-3"></i> Disable
              </button>`
            : `<button class="btn-sm btn-outline-success flex items-center gap-1" onclick="toggleCliTool('${tool}', true)">
                <i data-lucide="play" class="w-3 h-3"></i> Enable
              </button>`
          ) : ''}
          ${canSetDefault
            ? `<button class="btn-sm btn-outline flex items-center gap-1" onclick="setDefaultCliTool('${tool}')">
                <i data-lucide="star" class="w-3 h-3"></i> Set Default
              </button>`
            : ''
          }
        </div>
      </div>
    `;
  }).join('');

  // CodexLens and Semantic Search removed from CLI status panel
  // They are managed in the dedicated CodexLens Manager page

  // CCW Installation Status card (show warning if not fully installed)
  const ccwInstallHtml = !ccwInstallStatus.installed ? `
    <div class="cli-tool-card tool-ccw-install unavailable" style="border: 1px solid var(--warning); background: rgba(var(--warning-rgb), 0.05);">
      <div class="cli-tool-header">
        <span class="cli-tool-status status-unavailable" style="background: var(--warning);"></span>
        <span class="cli-tool-name">${t('status.ccwInstall')}</span>
        <span class="badge px-1.5 py-0.5 text-xs rounded bg-warning/20 text-warning">${t('status.required')}</span>
      </div>
      <div class="cli-tool-desc text-xs text-muted-foreground mt-1">
        ${t('status.ccwInstallDesc')}
      </div>
      <div class="cli-tool-info mt-2">
        <span class="text-warning flex items-center gap-1">
          <i data-lucide="alert-triangle" class="w-3 h-3"></i>
          ${ccwInstallStatus.missingFiles.length} ${t('status.filesMissing')}
        </span>
      </div>
      <div class="cli-tool-actions flex flex-col gap-2 mt-3">
        <div class="text-xs text-muted-foreground">
          <p class="mb-1">${t('status.missingFiles')}:</p>
          <ul class="list-disc list-inside text-xs opacity-70">
            ${ccwInstallStatus.missingFiles.slice(0, 3).map(f => `<li>${f}</li>`).join('')}
            ${ccwInstallStatus.missingFiles.length > 3 ? `<li>+${ccwInstallStatus.missingFiles.length - 3} more...</li>` : ''}
          </ul>
        </div>
        <div class="bg-muted/50 rounded p-2 mt-2">
          <p class="text-xs font-medium mb-1">${t('status.runToFix')}:</p>
          <code class="text-xs bg-background px-2 py-1 rounded block">ccw install</code>
        </div>
      </div>
    </div>
  ` : '';

  // API Endpoints section
  const apiEndpointsHtml = apiEndpoints.length > 0 ? `
    <div class="cli-api-endpoints-section" style="margin-top: 1.5rem;">
      <div class="cli-section-header" style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
        <h4 style="display: flex; align-items: center; gap: 0.5rem; font-weight: 600; margin: 0;">
          <i data-lucide="link" class="w-4 h-4"></i> API Endpoints
        </h4>
        <span class="badge" style="padding: 0.125rem 0.5rem; font-size: 0.75rem; border-radius: 0.25rem; background: var(--muted); color: var(--muted-foreground);">${apiEndpoints.length}</span>
      </div>
      <div class="cli-endpoints-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 0.75rem;">
        ${apiEndpoints.map(ep => `
          <div class="cli-endpoint-card ${ep.enabled ? 'available' : 'unavailable'}" style="padding: 0.75rem; border: 1px solid var(--border); border-radius: 0.5rem; background: var(--card);">
            <div class="cli-endpoint-header" style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
              <span class="cli-tool-status ${ep.enabled ? 'status-available' : 'status-unavailable'}" style="width: 8px; height: 8px; border-radius: 50%; background: ${ep.enabled ? 'var(--success)' : 'var(--muted-foreground)'}; flex-shrink: 0;"></span>
              <span class="cli-endpoint-id" style="font-weight: 500; font-size: 0.875rem;">${ep.id}</span>
            </div>
            <div class="cli-endpoint-info" style="margin-top: 0.25rem;">
              <span class="text-xs text-muted-foreground" style="font-size: 0.75rem; color: var(--muted-foreground);">${ep.model}</span>
            </div>
            <div class="cli-endpoint-usage" style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border);">
              <code style="font-size: 0.65rem; color: var(--muted-foreground); word-break: break-all;">--tool custom --model ${ep.id}</code>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  // Config source info
  const configInfo = window.claudeCliToolsConfig?._configInfo || {};
  const configSourceLabel = configInfo.source === 'project' ? 'Project' : configInfo.source === 'global' ? 'Global' : 'Default';
  const configSourceClass = configInfo.source === 'project' ? 'text-success' : configInfo.source === 'global' ? 'text-primary' : 'text-muted-foreground';

  // CLI Settings section
  const settingsHtml = `
    <div class="cli-settings-section">
      <div class="cli-settings-header">
        <h4><i data-lucide="settings" class="w-3.5 h-3.5"></i> Settings</h4>
        <span class="badge text-xs ${configSourceClass}" title="${configInfo.activePath || ''}">${configSourceLabel}</span>
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
        <div class="cli-setting-item">
          <label class="cli-setting-label">
            <i data-lucide="hard-drive" class="w-3 h-3"></i>
            Cache Injection
          </label>
          <div class="cli-setting-control">
            <select class="cli-setting-select" onchange="setCacheInjectionMode(this.value)">
              <option value="auto" ${getCacheInjectionMode() === 'auto' ? 'selected' : ''}>Auto</option>
              <option value="manual" ${getCacheInjectionMode() === 'manual' ? 'selected' : ''}>Manual</option>
              <option value="disabled" ${getCacheInjectionMode() === 'disabled' ? 'selected' : ''}>Disabled</option>
            </select>
          </div>
          <p class="cli-setting-desc">Cache prefix/suffix injection mode for prompts</p>
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
    ${ccwInstallHtml}
    <div class="cli-tools-grid">
      ${toolsHtml}
    </div>
    ${apiEndpointsHtml}
    ${settingsHtml}
  `;

  // Initialize Lucide icons
  if (window.lucide) {
    lucide.createIcons();
  }
}

// ========== Actions ==========
function setDefaultCliTool(tool) {
  // Validate: tool must be available and enabled
  const status = cliToolStatus[tool] || {};
  const config = cliToolsConfig[tool] || { enabled: true };

  if (!status.available) {
    showRefreshToast(`Cannot set ${tool} as default: not installed`, 'error');
    return;
  }

  if (config.enabled === false) {
    showRefreshToast(`Cannot set ${tool} as default: tool is disabled`, 'error');
    return;
  }

  defaultCliTool = tool;
  // Save to config
  if (window.claudeCliToolsConfig) {
    window.claudeCliToolsConfig.defaultTool = tool;
    fetch('/api/cli/tools-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultTool: tool })
    }).catch(err => console.error('Failed to save default tool:', err));
  }
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

function getCacheInjectionMode() {
  if (window.claudeCliToolsConfig && window.claudeCliToolsConfig.settings) {
    return window.claudeCliToolsConfig.settings.cache?.injectionMode || 'auto';
  }
  return localStorage.getItem('ccw-cache-injection-mode') || 'auto';
}

async function setCacheInjectionMode(mode) {
  try {
    const response = await fetch('/api/cli/tools-config/cache', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ injectionMode: mode })
    });
    if (response.ok) {
      localStorage.setItem('ccw-cache-injection-mode', mode);
      if (window.claudeCliToolsConfig) {
        window.claudeCliToolsConfig.settings.cache.injectionMode = mode;
      }
      showRefreshToast(`Cache injection mode set to ${mode}`, 'success');
    } else {
      showRefreshToast('Failed to update cache settings', 'error');
    }
  } catch (err) {
    console.error('Failed to update cache settings:', err);
    showRefreshToast('Failed to update cache settings', 'error');
  }
}

async function refreshAllCliStatus() {
  await loadAllStatuses();
  renderCliStatus();
}

async function toggleCliTool(tool, enabled) {
  // If disabling the current default tool, switch to another available+enabled tool
  if (!enabled && defaultCliTool === tool) {
    // Get tools dynamically from config
    const tools = Object.keys(cliToolsConfig).filter(t => t && t !== '_configInfo');
    const newDefault = tools.find(t => {
      if (t === tool) return false;
      const status = cliToolStatus[t] || {};
      const config = cliToolsConfig[t] || { enabled: true };
      return status.available && config.enabled !== false;
    });

    if (newDefault) {
      defaultCliTool = newDefault;
      if (window.claudeCliToolsConfig) {
        window.claudeCliToolsConfig.defaultTool = newDefault;
      }
      showRefreshToast(`Default tool switched to ${newDefault}`, 'info');
    } else {
      showRefreshToast(`Warning: No other enabled tool available for default`, 'warning');
    }
  }

  await updateCliToolEnabled(tool, enabled);
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

// ========== Navigation ==========
/**
 * Navigate to API Settings page with optional section
 * @param {string} section - Target section: 'cli-settings', 'providers', 'endpoints'
 */
function navigateToApiSettings(section) {
  // Try to switch to API Settings view
  if (typeof switchView === 'function') {
    switchView('api-settings');
  } else if (window.switchView) {
    window.switchView('api-settings');
  }

  // After view switch, select the target section
  setTimeout(() => {
    if (section === 'cli-settings') {
      // Click CLI Settings tab if exists
      const cliSettingsTab = document.querySelector('[data-section="cli-settings"]');
      if (cliSettingsTab) {
        cliSettingsTab.click();
      } else {
        // Fallback: try to find and click by text content
        const tabs = document.querySelectorAll('.api-settings-sidebar .sidebar-item, .api-settings-tabs .tab-btn');
        tabs.forEach(tab => {
          if (tab.textContent.includes('CLI') || tab.textContent.includes('Wrapper')) {
            tab.click();
          }
        });
      }
    }
  }, 100);
}

// Export navigation function
window.navigateToApiSettings = navigateToApiSettings;

