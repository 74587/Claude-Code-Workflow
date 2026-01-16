// CLI Manager View
// Main view combining CLI status and CCW installations panels (two-column layout)

// ========== CLI Manager State ==========
var currentCliExecution = null;
var cliExecutionOutput = '';
var ccwInstallations = [];
var ccwEndpointTools = [];
var cliWrapperEndpoints = [];  // CLI封装 endpoints from /api/cli/settings
var cliToolConfig = null;  // Store loaded CLI config
var predefinedModels = {}; // Store predefined models per tool

// ========== Cache Key Mapping ==========
// 缓存键映射（旧键名 -> 新键名）
var CLI_CACHE_KEY_MAP = {
  toolConfig: 'cli-config',
  toolStatus: 'cli-status',
  installations: 'cli-installations',
  endpointTools: 'cli-endpoint-tools',
  litellmEndpoints: 'cli-litellm-endpoints',
  customEndpoints: 'cli-custom-endpoints',
  wrapperEndpoints: 'cli-wrapper-endpoints'
};

// ========== CLI Cache Bridge ==========

/**
 * 获取 CLI 缓存数据
 * @param {string} key - 缓存键
 * @returns {*} 缓存的数据或 null
 */
function getCliCachedData(key) {
  if (!window.cacheManager) return null;
  var newKey = CLI_CACHE_KEY_MAP[key] || key;
  return window.cacheManager.get(newKey);
}

/**
 * 设置 CLI 缓存数据
 * @param {string} key - 缓存键
 * @param {*} data - 要缓存的数据
 * @param {number} ttl - 缓存 TTL（毫秒），默认 5 分钟
 */
function setCliCacheData(key, data, ttl) {
  if (!window.cacheManager) return;
  ttl = ttl || 300000;
  var newKey = CLI_CACHE_KEY_MAP[key] || key;
  window.cacheManager.set(newKey, data, ttl);
}

/**
 * 注册 CLI 相关数据源到预加载服务
 * 仅在数据源尚未注册时添加
 */
function registerCliDataSources() {
  if (!window.preloadService) return;

  var sources = [
    { key: 'cli-installations', url: '/api/ccw/installations', priority: false, ttl: 300000 },
    { key: 'cli-endpoint-tools', url: '/api/ccw/tools', priority: false, ttl: 300000 },
    { key: 'cli-litellm-endpoints', url: '/api/litellm-api/config', priority: false, ttl: 300000 },
    { key: 'cli-custom-endpoints', url: '/api/cli/endpoints', priority: false, ttl: 300000 },
    { key: 'cli-wrapper-endpoints', url: '/api/cli/settings', priority: false, ttl: 300000 }
  ];

  sources.forEach(function(src) {
    if (!window.preloadService.sources.has(src.key)) {
      window.preloadService.register(src.key,
        function() { return fetch(src.url).then(function(r) { return r.ok ? r.json() : Promise.reject(r); }); },
        { isHighPriority: src.priority, ttl: src.ttl }
      );
    }
  });
}

// ========== CSRF Token Management ==========
var csrfToken = null;  // Store CSRF token for state-changing requests

/**
 * Fetch wrapper that handles CSRF token management
 * Captures new token from response and includes token in requests
 */
async function csrfFetch(url, options) {
  options = options || {};
  options.headers = options.headers || {};

  // Add CSRF token header for state-changing methods
  var method = (options.method || 'GET').toUpperCase();

  // Auto-initialize CSRF token for state-changing requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].indexOf(method) !== -1) {
    await initCsrfToken();
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].indexOf(method) !== -1 && csrfToken) {
    options.headers['X-CSRF-Token'] = csrfToken;
  }

  var response = await fetch(url, options);

  // Capture new CSRF token from response
  var newToken = response.headers.get('X-CSRF-Token');
  if (newToken) {
    csrfToken = newToken;
  }

  return response;
}

/**
 * Initialize CSRF token by fetching from server
 * Should be called before any state-changing requests
 */
async function initCsrfToken() {
  if (csrfToken) return; // Already initialized

  try {
    var response = await fetch('/api/csrf-token');
    if (response.ok) {
      var data = await response.json();
      csrfToken = data.csrfToken || response.headers.get('X-CSRF-Token');
    }
  } catch (err) {
    console.warn('[CLI Manager] Failed to fetch CSRF token:', err);
  }
}

// ========== Active Execution Sync ==========

/**
 * Sync active CLI executions from server
 * Called when view is opened to restore running execution state
 */
async function syncActiveExecutions() {
  try {
    var response = await fetch('/api/cli/active');
    if (!response.ok) return;

    var data = await response.json();
    if (!data.executions || data.executions.length === 0) return;

    // Restore the first active execution
    var active = data.executions[0];

    // Restore execution state
    currentCliExecution = {
      executionId: active.id,
      tool: active.tool,
      mode: active.mode,
      startTime: active.startTime
    };
    cliExecutionOutput = active.output || '';

    // Update UI if output panel exists
    var outputPanel = document.getElementById('cli-output-panel');
    var outputContent = document.getElementById('cli-output-content');

    if (outputPanel && outputContent) {
      outputPanel.style.display = 'block';
      outputContent.textContent = cliExecutionOutput;
      outputContent.scrollTop = outputContent.scrollHeight;

      // Update status indicator
      var statusIndicator = outputPanel.querySelector('.cli-status-indicator');
      if (statusIndicator) {
        statusIndicator.className = 'cli-status-indicator running';
        statusIndicator.textContent = t('cli.running') || 'Running...';
      }
    }

    console.log('[CLI Manager] Restored active execution:', active.id);
  } catch (err) {
    console.warn('[CLI Manager] Failed to sync active executions:', err);
  }
}

// ========== Navigation Helpers ==========

/**
 * Navigate to CodexLens Manager page
 */
function navigateToCodexLensManager() {
  var navItem = document.querySelector('.nav-item[data-view="codexlens-manager"]');
  if (navItem) {
    navItem.click();
  } else {
    // Fallback: try to render directly
    if (typeof renderCodexLensManager === 'function') {
      currentView = 'codexlens-manager';
      renderCodexLensManager();
    } else {
      showRefreshToast(t('common.error') + ': CodexLens Manager not available', 'error');
    }
  }
}

// ========== CCW Installations ==========
async function loadCcwInstallations() {
  try {
    var response = await fetch('/api/ccw/installations');
    if (!response.ok) throw new Error('Failed to load CCW installations');
    var data = await response.json();
    ccwInstallations = data.installations || [];
    return ccwInstallations;
  } catch (err) {
    console.error('Failed to load CCW installations:', err);
    ccwInstallations = [];
    return [];
  }
}

// ========== CCW Endpoint Tools ==========
async function loadCcwEndpointTools() {
  try {
    var response = await fetch('/api/ccw/tools');
    if (!response.ok) throw new Error('Failed to load CCW endpoint tools');
    var data = await response.json();
    ccwEndpointTools = data.tools || [];
    return ccwEndpointTools;
  } catch (err) {
    console.error('Failed to load CCW endpoint tools:', err);
    ccwEndpointTools = [];
    return [];
  }
}

// ========== LiteLLM API Endpoints ==========
var litellmApiEndpoints = [];
var cliCustomEndpoints = [];

async function loadLitellmApiEndpoints() {
  try {
    var response = await fetch('/api/litellm-api/config');
    if (!response.ok) throw new Error('Failed to load LiteLLM endpoints');
    var data = await response.json();
    litellmApiEndpoints = data.endpoints || [];
    window.litellmApiConfig = data;
    return litellmApiEndpoints;
  } catch (err) {
    console.error('Failed to load LiteLLM endpoints:', err);
    litellmApiEndpoints = [];
    return [];
  }
}

async function loadCliCustomEndpoints() {
  try {
    var response = await fetch('/api/cli/endpoints');
    if (!response.ok) throw new Error('Failed to load CLI custom endpoints');
    var data = await response.json();
    cliCustomEndpoints = data.endpoints || [];
    return cliCustomEndpoints;
  } catch (err) {
    console.error('Failed to load CLI custom endpoints:', err);
    cliCustomEndpoints = [];
    return [];
  }
}

// ========== CLI Wrapper Endpoints (CLI封装) ==========
async function loadCliWrapperEndpoints() {
  try {
    var response = await fetch('/api/cli/settings');
    if (!response.ok) throw new Error('Failed to load CLI wrapper endpoints');
    var data = await response.json();
    cliWrapperEndpoints = data.endpoints || [];
    return cliWrapperEndpoints;
  } catch (err) {
    console.error('Failed to load CLI wrapper endpoints:', err);
    cliWrapperEndpoints = [];
    return [];
  }
}

async function toggleCliWrapperEnabled(endpointId, enabled) {
  try {
    await initCsrfToken();
    var response = await csrfFetch('/api/cli/settings/' + endpointId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: enabled })
    });
    if (!response.ok) throw new Error('Failed to update CLI wrapper endpoint');
    var data = await response.json();
    if (data.success) {
      // Update local state
      var idx = cliWrapperEndpoints.findIndex(function(e) { return e.id === endpointId; });
      if (idx >= 0) {
        cliWrapperEndpoints[idx].enabled = enabled;
      }
      showRefreshToast((enabled ? t('cli.enabled') || 'Enabled' : t('cli.disabled') || 'Disabled') + ': ' + endpointId, 'success');
    }
    return data;
  } catch (err) {
    showRefreshToast((t('cli.updateFailed') || 'Failed to update') + ': ' + err.message, 'error');
    throw err;
  }
}

async function toggleEndpointEnabled(endpointId, enabled) {
  try {
    await initCsrfToken();
    var response = await csrfFetch('/api/cli/endpoints/' + endpointId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: enabled })
    });
    if (!response.ok) throw new Error('Failed to update endpoint');
    var data = await response.json();
    if (data.success) {
      // Update local state
      var idx = cliCustomEndpoints.findIndex(function(e) { return e.id === endpointId; });
      if (idx >= 0) {
        cliCustomEndpoints[idx].enabled = enabled;
      }
      showRefreshToast((enabled ? 'Enabled' : 'Disabled') + ' endpoint: ' + endpointId, 'success');
    }
    return data;
  } catch (err) {
    showRefreshToast('Failed to update endpoint: ' + err.message, 'error');
    throw err;
  }
}

async function syncEndpointToCliTools(endpoint) {
  try {
    await initCsrfToken();
    var response = await csrfFetch('/api/cli/endpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: endpoint.id,
        name: endpoint.name,
        enabled: true
      })
    });
    if (!response.ok) throw new Error('Failed to sync endpoint');
    var data = await response.json();
    if (data.success) {
      cliCustomEndpoints = data.endpoints;
      showRefreshToast('Endpoint synced to CLI tools: ' + endpoint.id, 'success');
      renderToolsSection();
    }
    return data;
  } catch (err) {
    showRefreshToast('Failed to sync endpoint: ' + err.message, 'error');
    throw err;
  }
}

window.toggleEndpointEnabled = toggleEndpointEnabled;
window.syncEndpointToCliTools = syncEndpointToCliTools;

// ========== CLI Tool Configuration ==========
async function loadCliToolConfig() {
  // 尝试从缓存获取
  var cached = getCliCachedData('toolConfig');
  if (cached) {
    cliToolConfig = cached.config || null;
    predefinedModels = cached.predefinedModels || {};
    return cached;
  }

  try {
    var response = await fetch('/api/cli/config');
    if (!response.ok) throw new Error('Failed to load CLI config');
    var data = await response.json();
    cliToolConfig = data.config || null;
    predefinedModels = data.predefinedModels || {};

    // 缓存结果
    setCliCacheData('toolConfig', data);
    return data;
  } catch (err) {
    console.error('Failed to load CLI config:', err);
    cliToolConfig = null;
    predefinedModels = {};
    return null;
  }
}

async function updateCliToolConfig(tool, updates) {
  try {
    // Ensure CSRF token is initialized before making state-changing request
    await initCsrfToken();

    var response = await csrfFetch('/api/cli/config/' + tool, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    var data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to update CLI config');
    }
    if (data.success && cliToolConfig && cliToolConfig.tools) {
      cliToolConfig.tools[tool] = data.config;
      // Invalidate cache to ensure fresh data on page refresh
      if (window.cacheManager) {
        window.cacheManager.invalidate('cli-config');
        window.cacheManager.invalidate('cli-tools-config');
      }
    }
    return data;
  } catch (err) {
    console.error('Failed to update CLI config:', err);
    throw err;
  }
}

// ========== Tool Configuration Modal ==========
async function showToolConfigModal(toolName) {
  // Load config if not already loaded
  if (!cliToolConfig) {
    await loadCliToolConfig();
  }

  var toolConfig = cliToolConfig && cliToolConfig.tools ? cliToolConfig.tools[toolName] : null;
  var models = predefinedModels[toolName] || [];
  var status = cliToolStatus[toolName] || {};

  if (!toolConfig) {
    toolConfig = { enabled: true, primaryModel: '', secondaryModel: '' };
  }

  var content = buildToolConfigModalContent(toolName, toolConfig, models, status);
  showModal('Configure ' + toolName.charAt(0).toUpperCase() + toolName.slice(1), content, { size: 'md' });

  // Initialize event handlers after modal is shown
  setTimeout(function() {
    initToolConfigModalEvents(toolName, toolConfig, models);
  }, 100);
}

function buildToolConfigModalContent(tool, config, models, status) {
  var isAvailable = status.available;
  var isEnabled = config.enabled;

  // Check if model is custom (not in predefined list or empty)
  var isPrimaryCustom = !config.primaryModel || models.indexOf(config.primaryModel) === -1;
  var isSecondaryCustom = !config.secondaryModel || models.indexOf(config.secondaryModel) === -1;

  var modelsOptionsHtml = function(selected, isCustom) {
    var html = '';
    for (var i = 0; i < models.length; i++) {
      var m = models[i];
      html += '<option value="' + escapeHtml(m) + '"' + (m === selected && !isCustom ? ' selected' : '') + '>' + escapeHtml(m) + '</option>';
    }
    html += '<option value="__custom__"' + (isCustom ? ' selected' : '') + '>Custom...</option>';
    return html;
  };

  return '<div class="tool-config-modal">' +
    // Status Section
    '<div class="tool-config-section">' +
      '<h4>Status</h4>' +
      '<div class="tool-config-badges">' +
        '<span class="badge ' + (isAvailable ? 'badge-success' : 'badge-muted') + '">' +
          '<i data-lucide="' + (isAvailable ? 'check-circle' : 'circle-dashed') + '" class="w-3 h-3"></i> ' +
          (isAvailable ? 'Installed' : 'Not Installed') +
        '</span>' +
        '<span class="badge ' + (isEnabled ? 'badge-primary' : 'badge-muted') + '">' +
          '<i data-lucide="' + (isEnabled ? 'toggle-right' : 'toggle-left') + '" class="w-3 h-3"></i> ' +
          (isEnabled ? 'Enabled' : 'Disabled') +
        '</span>' +
      '</div>' +
    '</div>' +

    // Actions Section
    '<div class="tool-config-section">' +
      '<h4>Actions</h4>' +
      '<div class="tool-config-actions">' +
        '<button class="btn-sm ' + (isEnabled ? 'btn-outline' : 'btn-primary') + '" id="toggleEnableBtn" ' + (!isAvailable ? 'disabled' : '') + '>' +
          '<i data-lucide="' + (isEnabled ? 'toggle-left' : 'toggle-right') + '" class="w-3 h-3"></i> ' +
          (isEnabled ? 'Disable' : 'Enable') +
        '</button>' +
        '<button class="btn-sm ' + (isAvailable ? 'btn-outline btn-danger-outline' : 'btn-primary') + '" id="installBtn">' +
          '<i data-lucide="' + (isAvailable ? 'trash-2' : 'download') + '" class="w-3 h-3"></i> ' +
          (isAvailable ? 'Uninstall' : 'Install') +
        '</button>' +
      '</div>' +
    '</div>' +

    // Primary Model Section
    '<div class="tool-config-section">' +
      '<h4>Primary Model <span class="text-muted">(CLI endpoint calls)</span></h4>' +
      '<div class="model-select-group">' +
        '<select id="primaryModelSelect" class="tool-config-select">' +
          modelsOptionsHtml(config.primaryModel, isPrimaryCustom) +
        '</select>' +
        '<input type="text" id="primaryModelCustom" class="tool-config-input" ' +
          'style="display: ' + (isPrimaryCustom ? 'block' : 'none') + ';" ' +
          'placeholder="Enter model name (e.g., gemini-2.5-pro)" ' +
          'value="' + (isPrimaryCustom && config.primaryModel ? escapeHtml(config.primaryModel) : '') + '" />' +
      '</div>' +
    '</div>' +

    // Secondary Model Section
    '<div class="tool-config-section">' +
      '<h4>Secondary Model <span class="text-muted">(internal tools)</span></h4>' +
      '<div class="model-select-group">' +
        '<select id="secondaryModelSelect" class="tool-config-select">' +
          modelsOptionsHtml(config.secondaryModel, isSecondaryCustom) +
        '</select>' +
        '<input type="text" id="secondaryModelCustom" class="tool-config-input" ' +
          'style="display: ' + (isSecondaryCustom ? 'block' : 'none') + ';" ' +
          'placeholder="Enter model name (e.g., gemini-2.5-flash)" ' +
          'value="' + (isSecondaryCustom && config.secondaryModel ? escapeHtml(config.secondaryModel) : '') + '" />' +
      '</div>' +
    '</div>' +

    // Tags Section - Unified input with inline tags
    '<div class="tool-config-section">' +
      '<h4>Tags <span class="text-muted">(optional labels)</span></h4>' +
      '<div class="tags-unified-input" id="tagsUnifiedInput">' +
        (config.tags || []).map(function(tag) {
          return '<span class="tag-item tag-' + escapeHtml(tag) + '">' + escapeHtml(tag) + '<button type="button" class="tag-remove" data-tag="' + escapeHtml(tag) + '">&times;</button></span>';
        }).join('') +
        '<input type="text" id="tagInput" class="tag-inline-input" placeholder="输入标签按 Enter 添加" />' +
      '</div>' +
      '<div class="predefined-tags-row">' +
        '<button type="button" class="predefined-tag-btn" data-tag="分析"><i data-lucide="search" class="w-3 h-3"></i> 分析</button>' +
        '<button type="button" class="predefined-tag-btn" data-tag="编码"><i data-lucide="code" class="w-3 h-3"></i> 编码</button>' +
        '<button type="button" class="predefined-tag-btn" data-tag="Debug"><i data-lucide="bug" class="w-3 h-3"></i> Debug</button>' +
        '<button type="button" class="predefined-tag-btn" data-tag="重构"><i data-lucide="refresh-cw" class="w-3 h-3"></i> 重构</button>' +
        '<button type="button" class="predefined-tag-btn" data-tag="测试"><i data-lucide="check-square" class="w-3 h-3"></i> 测试</button>' +
        '<button type="button" class="predefined-tag-btn" data-tag="文档"><i data-lucide="file-text" class="w-3 h-3"></i> 文档</button>' +
      '</div>' +
    '</div>' +

    // Environment File Section (only for builtin tools: gemini, qwen)
    (tool === 'gemini' || tool === 'qwen' ? (
    '<div class="tool-config-section">' +
      '<h4><i data-lucide="file-key" class="w-3.5 h-3.5"></i> ' + t('cli.envFile') + ' <span class="text-muted">' + t('cli.envFileOptional') + '</span></h4>' +
      '<div class="env-file-input-group">' +
        '<div class="env-file-input-row">' +
          '<input type="text" id="envFileInput" class="tool-config-input" ' +
            'placeholder="' + t('cli.envFilePlaceholder') + '" ' +
            'value="' + (config.envFile ? escapeHtml(config.envFile) : '') + '" />' +
          '<button type="button" class="btn-sm btn-outline" id="envFileBrowseBtn">' +
            '<i data-lucide="folder-open" class="w-3.5 h-3.5"></i> ' + t('cli.envFileBrowse') +
          '</button>' +
        '</div>' +
        '<p class="env-file-hint">' +
          '<i data-lucide="info" class="w-3 h-3"></i> ' +
          t('cli.envFileHint') +
        '</p>' +
      '</div>' +
    '</div>'
    ) : '') +

    // Footer
    '<div class="tool-config-footer">' +
      '<button class="btn btn-outline" onclick="closeModal()">' + t('common.cancel') + '</button>' +
      '<button class="btn btn-primary" id="saveConfigBtn">' +
        '<i data-lucide="save" class="w-3.5 h-3.5"></i> ' + t('common.save') +
      '</button>' +
    '</div>' +
  '</div>';
}

// ========== File Browser Modal ==========

var fileBrowserState = {
  currentPath: '',
  showHidden: false,
  onSelect: null
};

function showFileBrowserModal(onSelect) {
  fileBrowserState.onSelect = onSelect;
  fileBrowserState.showHidden = false;
  
  // Create modal overlay
  var overlay = document.createElement('div');
  overlay.id = 'fileBrowserOverlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = buildFileBrowserModalContent();
  document.body.appendChild(overlay);
  
  // Load initial directory (home)
  loadFileBrowserDirectory('');
  
  // Initialize events
  initFileBrowserEvents();
  
  // Initialize icons
  if (window.lucide) lucide.createIcons();
}

function buildFileBrowserModalContent() {
  // Detect if Windows
  var isWindows = navigator.platform.indexOf('Win') > -1;
  var driveButtons = '';
  if (isWindows) {
    driveButtons = '<div class="file-browser-drives">' +
      '<button class="btn-xs btn-outline drive-btn" data-drive="C:/">C:</button>' +
      '<button class="btn-xs btn-outline drive-btn" data-drive="D:/">D:</button>' +
      '<button class="btn-xs btn-outline drive-btn" data-drive="E:/">E:</button>' +
    '</div>';
  }
  
  return '<div class="modal-content file-browser-modal">' +
    '<div class="modal-header">' +
      '<h3><i data-lucide="folder-open" class="w-4 h-4"></i> ' + t('cli.fileBrowser') + '</h3>' +
      '<button class="modal-close" id="fileBrowserCloseBtn">&times;</button>' +
    '</div>' +
    '<div class="modal-body">' +
      '<div class="file-browser-toolbar">' +
        '<button class="btn-sm btn-outline" id="fileBrowserUpBtn" title="' + t('cli.fileBrowserUp') + '">' +
          '<i data-lucide="arrow-up" class="w-3.5 h-3.5"></i>' +
        '</button>' +
        '<button class="btn-sm btn-outline" id="fileBrowserHomeBtn" title="' + t('cli.fileBrowserHome') + '">' +
          '<i data-lucide="home" class="w-3.5 h-3.5"></i>' +
        '</button>' +
        driveButtons +
        '<input type="text" id="fileBrowserPathInput" class="file-browser-path" placeholder="Enter path and press Enter" />' +
        '<label class="file-browser-hidden-toggle">' +
          '<input type="checkbox" id="fileBrowserShowHidden" checked />' +
          '<span>' + t('cli.fileBrowserShowHidden') + '</span>' +
        '</label>' +
      '</div>' +
      '<div class="file-browser-list" id="fileBrowserList">' +
        '<div class="file-browser-loading"><i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i></div>' +
      '</div>' +
    '</div>' +
    '<div class="modal-footer">' +
      '<button class="btn btn-outline" id="fileBrowserCancelBtn">' + t('cli.fileBrowserCancel') + '</button>' +
      '<button class="btn btn-primary" id="fileBrowserSelectBtn" disabled>' +
        '<i data-lucide="check" class="w-3.5 h-3.5"></i> ' + t('cli.fileBrowserSelect') +
      '</button>' +
    '</div>' +
  '</div>';
}

async function loadFileBrowserDirectory(path) {
  var listContainer = document.getElementById('fileBrowserList');
  var pathInput = document.getElementById('fileBrowserPathInput');
  
  if (listContainer) {
    listContainer.innerHTML = '<div class="file-browser-loading"><i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i></div>';
    if (window.lucide) lucide.createIcons();
  }
  
  try {
    var response = await fetch('/api/dialog/browse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: path, showHidden: fileBrowserState.showHidden })
    });
    
    if (!response.ok) {
      throw new Error('Failed to load directory');
    }
    
    var data = await response.json();
    fileBrowserState.currentPath = data.currentPath;
    
    if (pathInput) {
      pathInput.value = data.currentPath;
    }
    
    renderFileBrowserItems(data.items);
  } catch (err) {
    console.error('Failed to load directory:', err);
    if (listContainer) {
      listContainer.innerHTML = '<div class="file-browser-error">' +
        '<p>' + t('cli.fileBrowserApiError') + '</p>' +
        '<p class="file-browser-hint">' + t('cli.fileBrowserManualHint') + '</p>' +
      '</div>';
    }
    // Enable manual path entry mode - enable select button when path is typed
    var selectBtn = document.getElementById('fileBrowserSelectBtn');
    var pathInput = document.getElementById('fileBrowserPathInput');
    if (selectBtn && pathInput) {
      selectBtn.disabled = false;
      pathInput.focus();
    }
  }
}

function renderFileBrowserItems(items) {
  var listContainer = document.getElementById('fileBrowserList');
  if (!listContainer) return;
  
  if (!items || items.length === 0) {
    listContainer.innerHTML = '<div class="file-browser-empty">Empty directory</div>';
    return;
  }
  
  var html = items.map(function(item) {
    var icon = item.isDirectory ? 'folder' : 'file';
    var itemClass = 'file-browser-item' + (item.isDirectory ? ' is-directory' : ' is-file');
    return '<div class="' + itemClass + '" data-path="' + escapeHtml(item.path) + '" data-is-dir="' + item.isDirectory + '">' +
      '<i data-lucide="' + icon + '" class="w-4 h-4"></i>' +
      '<span class="file-browser-item-name">' + escapeHtml(item.name) + '</span>' +
    '</div>';
  }).join('');
  
  listContainer.innerHTML = html;
  
  // Initialize icons
  if (window.lucide) lucide.createIcons();
  
  // Add click handlers
  listContainer.querySelectorAll('.file-browser-item').forEach(function(el) {
    el.onclick = function() {
      var isDir = el.getAttribute('data-is-dir') === 'true';
      var path = el.getAttribute('data-path');
      
      if (isDir) {
        // Navigate into directory
        loadFileBrowserDirectory(path);
      } else {
        // Select file
        listContainer.querySelectorAll('.file-browser-item').forEach(function(item) {
          item.classList.remove('selected');
        });
        el.classList.add('selected');
        
        // Enable select button
        var selectBtn = document.getElementById('fileBrowserSelectBtn');
        if (selectBtn) {
          selectBtn.disabled = false;
          selectBtn.setAttribute('data-selected-path', path);
        }
      }
    };
    
    // Double-click to select file or enter directory
    el.ondblclick = function() {
      var isDir = el.getAttribute('data-is-dir') === 'true';
      var path = el.getAttribute('data-path');
      
      if (isDir) {
        loadFileBrowserDirectory(path);
      } else {
        // Select and close
        closeFileBrowserModal(path);
      }
    };
  });
}

function initFileBrowserEvents() {
  // Close button
  var closeBtn = document.getElementById('fileBrowserCloseBtn');
  if (closeBtn) {
    closeBtn.onclick = function() { closeFileBrowserModal(null); };
  }
  
  // Cancel button
  var cancelBtn = document.getElementById('fileBrowserCancelBtn');
  if (cancelBtn) {
    cancelBtn.onclick = function() { closeFileBrowserModal(null); };
  }
  
  // Select button
  var selectBtn = document.getElementById('fileBrowserSelectBtn');
  if (selectBtn) {
    selectBtn.onclick = function() {
      // First try selected path from list, then fall back to path input
      var path = selectBtn.getAttribute('data-selected-path');
      if (!path) {
        var pathInput = document.getElementById('fileBrowserPathInput');
        if (pathInput && pathInput.value.trim()) {
          path = pathInput.value.trim();
        }
      }
      if (path) {
        closeFileBrowserModal(path);
      }
    };
  }
  
  // Up button
  var upBtn = document.getElementById('fileBrowserUpBtn');
  if (upBtn) {
    upBtn.onclick = function() {
      // Get parent path
      var currentPath = fileBrowserState.currentPath;
      var parentPath = currentPath.replace(/[/\\][^/\\]+$/, '') || '/';
      loadFileBrowserDirectory(parentPath);
    };
  }
  
  // Home button
  var homeBtn = document.getElementById('fileBrowserHomeBtn');
  if (homeBtn) {
    homeBtn.onclick = function() {
      loadFileBrowserDirectory('');
    };
  }
  
  // Drive buttons (Windows)
  document.querySelectorAll('.drive-btn').forEach(function(btn) {
    btn.onclick = function() {
      var drive = btn.getAttribute('data-drive');
      if (drive) {
        loadFileBrowserDirectory(drive);
      }
    };
  });
  
  // Path input - allow manual entry
  var pathInput = document.getElementById('fileBrowserPathInput');
  if (pathInput) {
    pathInput.onkeydown = function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var path = pathInput.value.trim();
        if (path) {
          loadFileBrowserDirectory(path);
        }
      }
    };
  }
  
  // Show hidden checkbox
  var showHiddenCheckbox = document.getElementById('fileBrowserShowHidden');
  if (showHiddenCheckbox) {
    showHiddenCheckbox.checked = true; // Default to show hidden
    fileBrowserState.showHidden = true;
    showHiddenCheckbox.onchange = function() {
      fileBrowserState.showHidden = showHiddenCheckbox.checked;
      loadFileBrowserDirectory(fileBrowserState.currentPath);
    };
  }
  
  // Click outside to close
  var overlay = document.getElementById('fileBrowserOverlay');
  if (overlay) {
    overlay.onclick = function(e) {
      if (e.target === overlay) {
        closeFileBrowserModal(null);
      }
    };
  }
}

function closeFileBrowserModal(selectedPath) {
  var overlay = document.getElementById('fileBrowserOverlay');
  if (overlay) {
    overlay.remove();
  }
  
  if (fileBrowserState.onSelect && selectedPath) {
    fileBrowserState.onSelect(selectedPath);
  }
  
  fileBrowserState.onSelect = null;
}

function initToolConfigModalEvents(tool, currentConfig, models) {
  // Local tags state (copy from config)
  var currentTags = (currentConfig.tags || []).slice();

  // Helper to render tags inline with input
  function renderTags() {
    var container = document.getElementById('tagsUnifiedInput');
    var input = document.getElementById('tagInput');
    if (!container) return;

    // Remove existing tag items but keep the input
    container.querySelectorAll('.tag-item').forEach(function(el) { el.remove(); });

    // Insert tags before the input
    currentTags.forEach(function(tag) {
      var tagEl = document.createElement('span');
      tagEl.className = 'tag-item tag-' + escapeHtml(tag);
      tagEl.innerHTML = escapeHtml(tag) + '<button type="button" class="tag-remove" data-tag="' + escapeHtml(tag) + '">&times;</button>';
      container.insertBefore(tagEl, input);
    });

    // Re-attach remove handlers
    container.querySelectorAll('.tag-remove').forEach(function(btn) {
      btn.onclick = function(e) {
        e.stopPropagation();
        var tagToRemove = this.getAttribute('data-tag');
        currentTags = currentTags.filter(function(t) { return t !== tagToRemove; });
        renderTags();
      };
    });

    // Update predefined tag buttons state
    document.querySelectorAll('.predefined-tag-btn').forEach(function(btn) {
      var tag = btn.getAttribute('data-tag');
      if (currentTags.indexOf(tag) !== -1) {
        btn.classList.add('selected');
        btn.disabled = true;
      } else {
        btn.classList.remove('selected');
        btn.disabled = false;
      }
    });
  }

  // Click on unified input container focuses the input
  var unifiedInput = document.getElementById('tagsUnifiedInput');
  if (unifiedInput) {
    unifiedInput.onclick = function(e) {
      if (e.target === this) {
        document.getElementById('tagInput').focus();
      }
    };
  }

  // Tag input handler
  var tagInput = document.getElementById('tagInput');
  if (tagInput) {
    tagInput.onkeydown = function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var newTag = this.value.trim();
        if (newTag && currentTags.indexOf(newTag) === -1) {
          currentTags.push(newTag);
          renderTags();
        }
        this.value = '';
      }
    };
  }

  // Predefined tag click handlers
  document.querySelectorAll('.predefined-tag-btn').forEach(function(btn) {
    btn.onclick = function() {
      var tag = this.getAttribute('data-tag');
      if (tag && currentTags.indexOf(tag) === -1) {
        currentTags.push(tag);
        renderTags();
      }
    };
  });

  // Initialize tags display
  renderTags();
  // Initialize lucide icons for predefined buttons
  if (window.lucide) lucide.createIcons();

  // Toggle Enable/Disable
  var toggleBtn = document.getElementById('toggleEnableBtn');
  if (toggleBtn) {
    toggleBtn.onclick = async function() {
      var newEnabled = !currentConfig.enabled;
      try {
        await updateCliToolConfig(tool, { enabled: newEnabled });
        showRefreshToast(tool + ' ' + (newEnabled ? 'enabled' : 'disabled'), 'success');
        closeModal();
        renderToolsSection();
        if (window.lucide) lucide.createIcons();
      } catch (err) {
        showRefreshToast('Failed to update: ' + err.message, 'error');
      }
    };
  }

  // Install/Uninstall
  var installBtn = document.getElementById('installBtn');
  if (installBtn) {
    installBtn.onclick = function() {
      var status = cliToolStatus[tool] || {};
      closeModal();

      if (status.available) {
        openCliUninstallWizard(tool);
      } else {
        openCliInstallWizard(tool);
      }
    };
  }

  // Model select handlers
  var primarySelect = document.getElementById('primaryModelSelect');
  var primaryCustom = document.getElementById('primaryModelCustom');
  var secondarySelect = document.getElementById('secondaryModelSelect');
  var secondaryCustom = document.getElementById('secondaryModelCustom');

  if (primarySelect && primaryCustom) {
    primarySelect.onchange = function() {
      if (this.value === '__custom__') {
        primaryCustom.style.display = 'block';
        primaryCustom.focus();
      } else {
        primaryCustom.style.display = 'none';
        primaryCustom.value = '';
      }
    };
  }

  if (secondarySelect && secondaryCustom) {
    secondarySelect.onchange = function() {
      if (this.value === '__custom__') {
        secondaryCustom.style.display = 'block';
        secondaryCustom.focus();
      } else {
        secondaryCustom.style.display = 'none';
        secondaryCustom.value = '';
      }
    };
  }

  // Save button
  var saveBtn = document.getElementById('saveConfigBtn');
  if (saveBtn) {
    saveBtn.onclick = async function() {
      var primaryModel = primarySelect.value === '__custom__'
        ? primaryCustom.value.trim()
        : primarySelect.value;
      var secondaryModel = secondarySelect.value === '__custom__'
        ? secondaryCustom.value.trim()
        : secondarySelect.value;

      if (!primaryModel) {
        showRefreshToast('Primary model is required', 'error');
        return;
      }
      if (!secondaryModel) {
        showRefreshToast('Secondary model is required', 'error');
        return;
      }

      // Get envFile value (only for gemini/qwen)
      var envFileInput = document.getElementById('envFileInput');
      var envFile = envFileInput ? envFileInput.value.trim() : '';

      try {
        var updateData = {
          primaryModel: primaryModel,
          secondaryModel: secondaryModel,
          tags: currentTags
        };

        // Only include envFile for gemini/qwen tools
        if (tool === 'gemini' || tool === 'qwen') {
          updateData.envFile = envFile || null;
        }

        await updateCliToolConfig(tool, updateData);
        // Reload config to reflect changes
        await loadCliToolConfig();
        showRefreshToast('Configuration saved', 'success');
        closeModal();
        renderToolsSection();
        if (window.lucide) lucide.createIcons();
      } catch (err) {
        showRefreshToast('Failed to save: ' + err.message, 'error');
      }
    };
  }

  // Environment file browse button (only for gemini/qwen)
  var envFileBrowseBtn = document.getElementById('envFileBrowseBtn');
  if (envFileBrowseBtn) {
    envFileBrowseBtn.onclick = function() {
      showFileBrowserModal(function(selectedPath) {
        var envFileInput = document.getElementById('envFileInput');
        if (envFileInput && selectedPath) {
          envFileInput.value = selectedPath;
          envFileInput.focus();
        }
      });
    };
  }

  // Initialize lucide icons in modal
  if (window.lucide) lucide.createIcons();
}

// ========== Rendering ==========

/**
 * 构建 CLI Manager 骨架屏
 * @returns {string} HTML 字符串
 */
function buildCliManagerSkeleton() {
  return '<div class="space-y-6">' +
    '<div class="flex items-center justify-between mb-4">' +
      '<h2 class="text-lg font-semibold">' + (t('title.cliTools') || 'CLI Tools & CCW') + '</h2>' +
    '</div>' +
    '<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">' +
      // 左侧 Tools 区域骨架
      '<div class="card p-4">' +
        '<div class="animate-pulse space-y-4">' +
          '<div class="h-4 bg-muted rounded w-1/3"></div>' +
          '<div class="h-16 bg-muted rounded"></div>' +
          '<div class="h-16 bg-muted rounded"></div>' +
          '<div class="h-16 bg-muted rounded"></div>' +
        '</div>' +
      '</div>' +
      // 右侧 CCW 区域骨架
      '<div class="card p-4">' +
        '<div class="animate-pulse space-y-4">' +
          '<div class="h-4 bg-muted rounded w-1/3"></div>' +
          '<div class="h-20 bg-muted rounded"></div>' +
          '<div class="h-20 bg-muted rounded"></div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    // 底部区域骨架
    '<div class="card p-4">' +
      '<div class="animate-pulse space-y-4">' +
        '<div class="h-4 bg-muted rounded w-1/4"></div>' +
        '<div class="h-12 bg-muted rounded"></div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

/**
 * 渲染 CLI Manager 实际内容（内部容器结构 + 各子面板）
 * @param {HTMLElement} container - 主容器元素
 */
function renderCliManagerContent(container) {
  container.innerHTML = '<div class="status-manager">' +
    '<div class="status-two-column">' +
    '<div class="cli-section" id="tools-section"></div>' +
    '<div class="cli-section" id="ccw-section"></div>' +
    '</div>' +
    '<div class="cli-section" id="language-settings-section" style="margin-top: 1.5rem;"></div>' +
    '<div class="cli-settings-section" id="cli-settings-section" style="margin-top: 1.5rem;"></div>' +
    '<div class="cli-section" id="ccw-endpoint-tools-section" style="margin-top: 1.5rem;"></div>' +
    '</div>' +
    '<section id="storageCard" class="mb-6"></section>';

  // 渲染子面板
  renderToolsSection();
  renderCcwSection();
  renderLanguageSettingsSection();
  renderCliSettingsSection();
  renderCcwEndpointToolsSection();

  // 初始化存储管理器卡片
  if (typeof initStorageManager === 'function') {
    initStorageManager();
  }

  // 初始化 Lucide 图标
  if (window.lucide) lucide.createIcons();
}

async function renderCliManager() {
  var container = document.getElementById('mainContent');
  if (!container) return;

  // 隐藏统计网格和搜索框
  var statsGrid = document.getElementById('statsGrid');
  var searchInput = document.getElementById('searchInput');
  if (statsGrid) statsGrid.style.display = 'none';
  if (searchInput) searchInput.parentElement.style.display = 'none';

  // 注册数据源（如果尚未注册）
  registerCliDataSources();

  // 1. 立即显示骨架屏
  container.innerHTML = buildCliManagerSkeleton();
  if (window.lucide) lucide.createIcons();

  // 2. 尝试从缓存渲染（快速展示）
  var cachedConfig = getCliCachedData('toolConfig');
  var cachedStatus = getCliCachedData('toolStatus');
  var hasCachedData = cachedConfig && cachedStatus;

  if (hasCachedData) {
    // 应用缓存数据
    cliToolConfig = cachedConfig.config;
    predefinedModels = cachedConfig.predefinedModels || {};
    // 立即渲染缓存数据
    renderCliManagerContent(container);
    console.log('[CLI Manager] Rendered from cache');
  }

  // 3. 后台加载最新数据
  try {
    await Promise.all([
      loadCliToolsConfig(),
      loadCliToolStatus(),
      loadCodexLensStatus(),
      loadCcwInstallations(),
      loadCcwEndpointTools(),
      loadLitellmApiEndpoints(),
      loadCliCustomEndpoints(),
      loadCliWrapperEndpoints()
    ]);

    // 4. 用最新数据更新 UI（如果之前未渲染或数据有变化）
    renderCliManagerContent(container);
    console.log('[CLI Manager] Rendered with fresh data');
  } catch (err) {
    console.error('[CLI Manager] Failed to load data:', err);
    // 如果没有缓存数据且加载失败，显示错误提示
    if (!hasCachedData) {
      container.innerHTML = '<div class="card p-4 text-center">' +
        '<i data-lucide="alert-circle" class="w-8 h-8 text-muted-foreground mx-auto mb-2"></i>' +
        '<p class="text-muted-foreground">' + (t('common.loadFailed') || 'Failed to load data') + '</p>' +
        '<button class="btn btn-sm mt-2" onclick="renderCliManager()">' +
          '<i data-lucide="refresh-cw" class="w-3 h-3 mr-1"></i>' +
          (t('common.retry') || 'Retry') +
        '</button>' +
      '</div>';
      if (window.lucide) lucide.createIcons();
    }
  }

  // 同步活动执行
  syncActiveExecutions();
}

// ========== Helper Functions ==========

/**
 * Get selected embedding model from dropdown
 * @returns {string} Selected model profile (code, fast, multilingual, balanced)
 */
function getSelectedModel() {
  var select = document.getElementById('codexlensModelSelect');
  return select ? select.value : 'code';
}

/**
 * Build model select options HTML, showing only installed models
 * @returns {string} HTML string for select options
 */
function buildModelSelectOptions() {
  var installedModels = window.cliToolsStatus?.codexlens?.installedModels || [];
  var allModels = window.cliToolsStatus?.codexlens?.allModels || [];
  
  // Model display configuration
  var modelConfig = {
    'code': { label: t('index.modelCode') || 'Code (768d)', star: true },
    'base': { label: t('index.modelBase') || 'Base (768d)', star: false },
    'fast': { label: t('index.modelFast') || 'Fast (384d)', star: false },
    'minilm': { label: t('index.modelMinilm') || 'MiniLM (384d)', star: false },
    'multilingual': { label: t('index.modelMultilingual') || 'Multilingual (1024d)', warn: true },
    'balanced': { label: t('index.modelBalanced') || 'Balanced (1024d)', warn: true }
  };
  
  // If no models installed, show placeholder
  if (installedModels.length === 0) {
    return '<option value="" disabled selected>' + (t('index.noModelsInstalled') || 'No models installed') + '</option>';
  }
  
  // Build options for installed models only
  var options = '';
  var firstInstalled = null;
  
  // Preferred order: code, fast, minilm, base, multilingual, balanced
  var preferredOrder = ['code', 'fast', 'minilm', 'base', 'multilingual', 'balanced'];
  
  preferredOrder.forEach(function(profile) {
    if (installedModels.includes(profile) && modelConfig[profile]) {
      var config = modelConfig[profile];
      var style = config.warn ? ' style="color: var(--muted-foreground)"' : '';
      var suffix = config.star ? ' ⭐' : (config.warn ? ' ⚠️' : '');
      var selected = !firstInstalled ? ' selected' : '';
      if (!firstInstalled) firstInstalled = profile;
      options += '<option value="' + profile + '"' + style + selected + '>' + config.label + suffix + '</option>';
    }
  });
  
  return options;
}

// ========== Tools Section (Left Column) ==========
function renderToolsSection() {
  var container = document.getElementById('tools-section');
  if (!container) return;

  var toolDescriptions = {
    gemini: t('cli.geminiDesc'),
    qwen: t('cli.qwenDesc'),
    codex: t('cli.codexDesc'),
    claude: t('cli.claudeDesc') || 'Anthropic Claude Code CLI for AI-assisted development',
    opencode: t('cli.opencodeDesc') || 'OpenCode CLI - Multi-provider AI coding assistant'
  };

  var tools = ['gemini', 'qwen', 'codex', 'claude', 'opencode'];
  var available = Object.values(cliToolStatus).filter(function(t) { return t.available; }).length;

  var toolsHtml = tools.map(function(tool) {
    var status = cliToolStatus[tool] || {};
    var isAvailable = status.available;
    var toolConfig = cliToolConfig && cliToolConfig.tools ? cliToolConfig.tools[tool] : null;
    var tags = toolConfig && toolConfig.tags ? toolConfig.tags : [];

    // Build tags HTML with color classes
    var tagsHtml = tags.length > 0
      ? '<div class="tool-tags">' + tags.map(function(tag) {
          return '<span class="tool-tag tag-' + escapeHtml(tag) + '">' + escapeHtml(tag) + '</span>';
        }).join('') + '</div>'
      : '';

    return '<div class="tool-item clickable ' + (isAvailable ? 'available' : 'unavailable') + '" onclick="showToolConfigModal(\'' + tool + '\')">' +
      '<div class="tool-item-left">' +
        '<span class="tool-status-dot ' + (isAvailable ? 'status-available' : 'status-unavailable') + '"></span>' +
        '<div class="tool-item-info">' +
          '<div class="tool-item-name">' + tool.charAt(0).toUpperCase() + tool.slice(1) +
            '<i data-lucide="settings" class="w-3 h-3 tool-config-icon"></i>' +
          '</div>' +
          '<div class="tool-item-desc">' + toolDescriptions[tool] + '</div>' +
          tagsHtml +
        '</div>' +
      '</div>' +
      '<div class="tool-item-right">' +
        (isAvailable
          ? '<span class="tool-status-text success"><i data-lucide="check-circle" class="w-3.5 h-3.5"></i> ' + t('cli.ready') + '</span>'
          : '<span class="tool-status-text muted"><i data-lucide="circle-dashed" class="w-3.5 h-3.5"></i> ' + t('cli.notInstalled') + '</span>') +
      '</div>' +
    '</div>';
  }).join('');

  // CodexLens and Semantic Search removed from this list
  // They are managed in the dedicated CodexLens Manager page (left menu)

  // API Endpoints section
  var apiEndpointsHtml = '';
  if (litellmApiEndpoints.length > 0) {
    var endpointItems = litellmApiEndpoints.map(function(endpoint) {
      // Check if endpoint is synced to CLI tools
      var cliEndpoint = cliCustomEndpoints.find(function(e) { return e.id === endpoint.id; });
      var isSynced = !!cliEndpoint;
      var isEnabled = cliEndpoint ? cliEndpoint.enabled : false;

      // Find provider info
      var provider = (window.litellmApiConfig?.providers || []).find(function(p) { return p.id === endpoint.providerId; });
      var providerName = provider ? provider.name : endpoint.providerId;

      return '<div class="tool-item ' + (isSynced && isEnabled ? 'available' : 'unavailable') + '">' +
        '<div class="tool-item-left">' +
          '<span class="tool-status-dot ' + (isSynced && isEnabled ? 'status-available' : 'status-unavailable') + '"></span>' +
          '<div class="tool-item-info">' +
            '<div class="tool-item-name">' + endpoint.id + ' <span class="tool-type-badge">API</span></div>' +
            '<div class="tool-item-desc">' + endpoint.model + ' (' + providerName + ')</div>' +
          '</div>' +
        '</div>' +
        '<div class="tool-item-right">' +
          (isSynced
            ? '<label class="toggle-switch" onclick="event.stopPropagation()">' +
                '<input type="checkbox" ' + (isEnabled ? 'checked' : '') + ' onchange="toggleEndpointEnabled(\'' + endpoint.id + '\', this.checked); renderToolsSection();">' +
                '<span class="toggle-slider"></span>' +
              '</label>'
            : '<button class="btn-sm btn-primary" onclick="event.stopPropagation(); syncEndpointToCliTools({id: \'' + endpoint.id + '\', name: \'' + endpoint.name + '\'})">' +
                '<i data-lucide="plus" class="w-3 h-3"></i> ' + (t('cli.addToCli') || 'Add to CLI') +
              '</button>') +
        '</div>' +
      '</div>';
    }).join('');

    apiEndpointsHtml = '<div class="tools-subsection" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border);">' +
      '<div class="section-header-left" style="margin-bottom: 0.5rem;">' +
        '<h4 style="font-size: 0.875rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">' +
          '<i data-lucide="cloud" class="w-4 h-4"></i> ' + (t('cli.apiEndpoints') || 'API Endpoints') +
        '</h4>' +
        '<span class="section-count">' + litellmApiEndpoints.length + ' ' + (t('cli.configured') || 'configured') + '</span>' +
      '</div>' +
      '<div class="tools-list">' + endpointItems + '</div>' +
    '</div>';
  }

  // CLI Wrapper (CLI封装) section
  var cliWrapperHtml = '';
  if (cliWrapperEndpoints.length > 0) {
    var wrapperItems = cliWrapperEndpoints.map(function(endpoint) {
      var isEnabled = endpoint.enabled !== false;
      var desc = endpoint.description || (t('cli.customClaudeSettings') || 'Custom Claude CLI settings');
      // Show command hint with name for easy copying
      var commandHint = 'ccw cli --tool ' + endpoint.name;

      return '<div class="tool-item clickable ' + (isEnabled ? 'available' : 'unavailable') + '" onclick="navigateToApiSettings(\'' + endpoint.id + '\')">' +
        '<div class="tool-item-left">' +
          '<span class="tool-status-dot ' + (isEnabled ? 'status-available' : 'status-unavailable') + '"></span>' +
          '<div class="tool-item-info">' +
            '<div class="tool-item-name">' + escapeHtml(endpoint.name) + ' <span class="tool-type-badge" style="background: var(--primary); color: white;">' + (t('cli.wrapper') || 'Wrapper') + '</span></div>' +
            '<div class="tool-item-desc">' + escapeHtml(desc) + '</div>' +
            '<div class="tool-item-command" style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--muted-foreground); margin-top: 0.25rem;">' + escapeHtml(commandHint) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="tool-item-right">' +
          '<label class="toggle-switch" onclick="event.stopPropagation()">' +
            '<input type="checkbox" ' + (isEnabled ? 'checked' : '') + ' onchange="toggleCliWrapperEnabled(\'' + endpoint.id + '\', this.checked); renderToolsSection();">' +
            '<span class="toggle-slider"></span>' +
          '</label>' +
        '</div>' +
      '</div>';
    }).join('');

    var enabledCount = cliWrapperEndpoints.filter(function(e) { return e.enabled !== false; }).length;
    cliWrapperHtml = '<div class="tools-subsection" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border);">' +
      '<div class="section-header-left" style="margin-bottom: 0.5rem;">' +
        '<h4 style="font-size: 0.875rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">' +
          '<i data-lucide="package-2" class="w-4 h-4"></i> ' + (t('cli.cliWrapper') || 'CLI Wrapper') +
        '</h4>' +
        '<span class="section-count">' + enabledCount + '/' + cliWrapperEndpoints.length + ' ' + (t('cli.enabled') || 'enabled') + '</span>' +
      '</div>' +
      '<div class="tools-list">' + wrapperItems + '</div>' +
    '</div>';
  }

  container.innerHTML = '<div class="section-header">' +
      '<div class="section-header-left">' +
        '<h3><i data-lucide="terminal" class="w-4 h-4"></i> ' + t('cli.tools') + '</h3>' +
        '<span class="section-count">' + available + '/' + tools.length + ' ' + t('cli.available') + '</span>' +
      '</div>' +
      '<button class="btn-icon" onclick="refreshAllCliStatus()" title="' + t('cli.refreshStatus') + '">' +
        '<i data-lucide="refresh-cw" class="w-4 h-4"></i>' +
      '</button>' +
    '</div>' +
    '<div class="tools-list">' +
      toolsHtml +
    '</div>' +
    apiEndpointsHtml +
    cliWrapperHtml;

  if (window.lucide) lucide.createIcons();
}

/**
 * Navigate to API Settings page and open the CLI wrapper endpoint for editing
 */
function navigateToApiSettings(endpointId) {
  // Store the endpoint ID to edit after navigation
  window.pendingCliWrapperEdit = endpointId;

  var navItem = document.querySelector('.nav-item[data-view="api-settings"]');
  if (navItem) {
    navItem.click();
  } else {
    // Fallback: try to render directly
    if (typeof renderApiSettings === 'function') {
      currentView = 'api-settings';
      renderApiSettings();
    } else {
      showRefreshToast(t('common.error') + ': API Settings not available', 'error');
    }
  }
}

// ========== CCW Section (Right Column) ==========
function renderCcwSection() {
  var container = document.getElementById('ccw-section');
  if (!container) return;

  var installationsHtml = '';

  if (ccwInstallations.length === 0) {
    installationsHtml = '<div class="ccw-empty-state">' +
      '<i data-lucide="package-x" class="w-8 h-8"></i>' +
      '<p>' + t('ccw.noInstallations') + '</p>' +
      '<button class="btn btn-sm btn-primary" onclick="showCcwInstallModal()">' +
      '<i data-lucide="download" class="w-3 h-3"></i> ' + t('ccw.installCcw') + '</button>' +
    '</div>';
  } else {
    installationsHtml = '<div class="ccw-list">';
    for (var i = 0; i < ccwInstallations.length; i++) {
      var inst = ccwInstallations[i];
      var isGlobal = inst.installation_mode === 'Global';
      var modeIcon = isGlobal ? 'home' : 'folder';
      var version = inst.application_version || 'unknown';
      var installDate = new Date(inst.installation_date).toLocaleDateString();

      installationsHtml += '<div class="ccw-item">' +
        '<div class="ccw-item-left">' +
          '<div class="ccw-item-mode ' + (isGlobal ? 'global' : 'path') + '">' +
            '<i data-lucide="' + modeIcon + '" class="w-4 h-4"></i>' +
          '</div>' +
          '<div class="ccw-item-info">' +
            '<div class="ccw-item-header">' +
              '<span class="ccw-item-name">' + inst.installation_mode + '</span>' +
              '<span class="ccw-version-tag">v' + version + '</span>' +
            '</div>' +
            '<div class="ccw-item-path" title="' + inst.installation_path + '">' + escapeHtml(inst.installation_path) + '</div>' +
            '<div class="ccw-item-meta">' +
              '<span><i data-lucide="calendar" class="w-3 h-3"></i> ' + installDate + '</span>' +
              '<span><i data-lucide="file" class="w-3 h-3"></i> ' + (inst.files_count || 0) + ' files</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="ccw-item-actions">' +
          '<button class="btn-icon btn-icon-sm" onclick="runCcwUpgrade()" title="Upgrade">' +
            '<i data-lucide="arrow-up-circle" class="w-4 h-4"></i>' +
          '</button>' +
          '<button class="btn-icon btn-icon-sm btn-danger" onclick="confirmCcwUninstall(\'' + escapeHtml(inst.installation_path) + '\')" title="Uninstall">' +
            '<i data-lucide="trash-2" class="w-4 h-4"></i>' +
          '</button>' +
        '</div>' +
      '</div>';
    }
    installationsHtml += '</div>';
  }

  container.innerHTML = '<div class="section-header">' +
      '<div class="section-header-left">' +
        '<h3><i data-lucide="package" class="w-4 h-4"></i> ' + t('ccw.install') + '</h3>' +
        '<span class="section-count">' + ccwInstallations.length + ' ' + (ccwInstallations.length !== 1 ? t('ccw.installationsPlural') : t('ccw.installations')) + '</span>' +
      '</div>' +
      '<div class="section-header-actions">' +
        '<button class="btn-icon" onclick="showCcwInstallModal()" title="Add Installation">' +
          '<i data-lucide="plus" class="w-4 h-4"></i>' +
        '</button>' +
        '<button class="btn-icon" onclick="loadCcwInstallations().then(function() { renderCcwSection(); if (window.lucide) lucide.createIcons(); })" title="Refresh">' +
          '<i data-lucide="refresh-cw" class="w-4 h-4"></i>' +
        '</button>' +
      '</div>' +
    '</div>' +
    installationsHtml;

  if (window.lucide) lucide.createIcons();
}

// ========== Language Settings State ==========
var chineseResponseEnabled = false;
var chineseResponseLoading = false;
var codexChineseResponseEnabled = false;
var codexChineseResponseLoading = false;
var windowsPlatformEnabled = false;
var windowsPlatformLoading = false;

// ========== Language Settings Section ==========
async function loadLanguageSettings() {
  try {
    var response = await fetch('/api/language/chinese-response');
    if (!response.ok) throw new Error('Failed to load language settings');
    var data = await response.json();
    chineseResponseEnabled = data.claudeEnabled || data.enabled || false;
    codexChineseResponseEnabled = data.codexEnabled || false;
    return data;
  } catch (err) {
    console.error('Failed to load language settings:', err);
    chineseResponseEnabled = false;
    codexChineseResponseEnabled = false;
    return { claudeEnabled: false, codexEnabled: false, guidelinesExists: false };
  }
}

async function loadWindowsPlatformSettings() {
  try {
    var response = await fetch('/api/language/windows-platform');
    if (!response.ok) throw new Error('Failed to load Windows platform settings');
    var data = await response.json();
    windowsPlatformEnabled = data.enabled || false;
    return data;
  } catch (err) {
    console.error('Failed to load Windows platform settings:', err);
    windowsPlatformEnabled = false;
    return { enabled: false, guidelinesExists: false };
  }
}

async function toggleChineseResponse(enabled, target) {
  // target: 'claude' (default) or 'codex'
  target = target || 'claude';
  var isCodex = target === 'codex';
  var loadingVar = isCodex ? 'codexChineseResponseLoading' : 'chineseResponseLoading';

  if (isCodex ? codexChineseResponseLoading : chineseResponseLoading) return;

  // Pre-check: verify CCW workflows are installed (only when enabling)
  if (enabled && typeof ccwInstallStatus !== 'undefined' && !ccwInstallStatus.installed) {
    var missingFile = ccwInstallStatus.missingFiles.find(function(f) { return f === 'chinese-response.md'; });
    if (missingFile) {
      showRefreshToast(t('lang.installRequired'), 'warning');
      return;
    }
  }

  if (isCodex) {
    codexChineseResponseLoading = true;
  } else {
    chineseResponseLoading = true;
  }

  try {
    var response = await fetch('/api/language/chinese-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: enabled, target: target })
    });

    if (!response.ok) {
      var errData = await response.json();
      // Show specific error message from backend
      var errorMsg = errData.error || 'Failed to update setting';
      if (errorMsg.includes('not found')) {
        showRefreshToast(t('lang.installRequired'), 'warning');
      } else {
        showRefreshToast((enabled ? t('lang.enableFailed') : t('lang.disableFailed')) + ': ' + errorMsg, 'error');
      }
      throw new Error(errorMsg);
    }

    var data = await response.json();
    if (isCodex) {
      codexChineseResponseEnabled = data.enabled;
    } else {
      chineseResponseEnabled = data.enabled;
    }

    // Update UI
    renderLanguageSettingsSection();

    // Show toast
    var toolName = isCodex ? 'Codex' : 'Claude';
    showRefreshToast(toolName + ': ' + (enabled ? t('lang.enableSuccess') : t('lang.disableSuccess')), 'success');
  } catch (err) {
    console.error('Failed to toggle Chinese response:', err);
    // Error already shown in the !response.ok block
  } finally {
    if (isCodex) {
      codexChineseResponseLoading = false;
    } else {
      chineseResponseLoading = false;
    }
  }
}

async function toggleWindowsPlatform(enabled) {
  if (windowsPlatformLoading) return;

  // Pre-check: verify CCW workflows are installed (only when enabling)
  if (enabled && typeof ccwInstallStatus !== 'undefined' && !ccwInstallStatus.installed) {
    var missingFile = ccwInstallStatus.missingFiles.find(function(f) { return f === 'windows-platform.md'; });
    if (missingFile) {
      showRefreshToast(t('lang.installRequired'), 'warning');
      return;
    }
  }

  windowsPlatformLoading = true;

  try {
    var response = await fetch('/api/language/windows-platform', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: enabled })
    });

    if (!response.ok) {
      var errData = await response.json();
      // Show specific error message from backend
      var errorMsg = errData.error || 'Failed to update setting';
      if (errorMsg.includes('not found')) {
        showRefreshToast(t('lang.installRequired'), 'warning');
      } else {
        showRefreshToast((enabled ? t('lang.windowsEnableFailed') : t('lang.windowsDisableFailed')) + ': ' + errorMsg, 'error');
      }
      throw new Error(errorMsg);
    }

    var data = await response.json();
    windowsPlatformEnabled = data.enabled;

    // Update UI
    renderLanguageSettingsSection();

    // Show toast
    showRefreshToast(enabled ? t('lang.windowsEnableSuccess') : t('lang.windowsDisableSuccess'), 'success');
  } catch (err) {
    console.error('Failed to toggle Windows platform:', err);
    // Error already shown in the !response.ok block
  } finally {
    windowsPlatformLoading = false;
  }
}

async function renderLanguageSettingsSection() {
  var container = document.getElementById('language-settings-section');
  if (!container) return;

  // Load current state if not loaded
  if (!chineseResponseEnabled && !codexChineseResponseEnabled && !chineseResponseLoading) {
    await loadLanguageSettings();
  }
  if (!windowsPlatformEnabled && !windowsPlatformLoading) {
    await loadWindowsPlatformSettings();
  }

  var settingsHtml = '<div class="section-header">' +
      '<div class="section-header-left">' +
        '<h3><i data-lucide="languages" class="w-4 h-4"></i> ' + t('lang.settings') + '</h3>' +
      '</div>' +
    '</div>' +
    '<div class="cli-settings-grid" style="grid-template-columns: 1fr 1fr;">' +
      // Chinese Response - Claude
      '<div class="cli-setting-item">' +
        '<label class="cli-setting-label">' +
          '<i data-lucide="message-square-text" class="w-3 h-3"></i>' +
          t('lang.chinese') + ' <span class="badge badge-sm badge-primary">Claude</span>' +
        '</label>' +
        '<div class="cli-setting-control">' +
          '<label class="cli-toggle">' +
            '<input type="checkbox"' + (chineseResponseEnabled ? ' checked' : '') + ' onchange="toggleChineseResponse(this.checked, \'claude\')"' + (chineseResponseLoading ? ' disabled' : '') + '>' +
            '<span class="cli-toggle-slider"></span>' +
          '</label>' +
          '<span class="cli-setting-status ' + (chineseResponseEnabled ? 'enabled' : 'disabled') + '">' +
            (chineseResponseEnabled ? t('lang.enabled') : t('lang.disabled')) +
          '</span>' +
        '</div>' +
        '<p class="cli-setting-desc">' + t('lang.chineseDescClaude') + '</p>' +
      '</div>' +
      // Chinese Response - Codex
      '<div class="cli-setting-item">' +
        '<label class="cli-setting-label">' +
          '<i data-lucide="message-square-text" class="w-3 h-3"></i>' +
          t('lang.chinese') + ' <span class="badge badge-sm badge-secondary">Codex</span>' +
        '</label>' +
        '<div class="cli-setting-control">' +
          '<label class="cli-toggle">' +
            '<input type="checkbox"' + (codexChineseResponseEnabled ? ' checked' : '') + ' onchange="toggleChineseResponse(this.checked, \'codex\')"' + (codexChineseResponseLoading ? ' disabled' : '') + '>' +
            '<span class="cli-toggle-slider"></span>' +
          '</label>' +
          '<span class="cli-setting-status ' + (codexChineseResponseEnabled ? 'enabled' : 'disabled') + '">' +
            (codexChineseResponseEnabled ? t('lang.enabled') : t('lang.disabled')) +
          '</span>' +
        '</div>' +
        '<p class="cli-setting-desc">' + t('lang.chineseDescCodex') + '</p>' +
      '</div>' +
      // Windows Platform
      '<div class="cli-setting-item">' +
        '<label class="cli-setting-label">' +
          '<i data-lucide="monitor" class="w-3 h-3"></i>' +
          t('lang.windows') +
        '</label>' +
        '<div class="cli-setting-control">' +
          '<label class="cli-toggle">' +
            '<input type="checkbox"' + (windowsPlatformEnabled ? ' checked' : '') + ' onchange="toggleWindowsPlatform(this.checked)"' + (windowsPlatformLoading ? ' disabled' : '') + '>' +
            '<span class="cli-toggle-slider"></span>' +
          '</label>' +
          '<span class="cli-setting-status ' + (windowsPlatformEnabled ? 'enabled' : 'disabled') + '">' +
            (windowsPlatformEnabled ? t('lang.enabled') : t('lang.disabled')) +
          '</span>' +
        '</div>' +
        '<p class="cli-setting-desc">' + t('lang.windowsDesc') + '</p>' +
      '</div>' +
    '</div>';

  container.innerHTML = settingsHtml;
  if (window.lucide) lucide.createIcons();
}

// ========== CLI Settings Section (Full Width) ==========
function renderCliSettingsSection() {
  var container = document.getElementById('cli-settings-section');
  if (!container) return;

  var settingsHtml = '<div class="section-header">' +
      '<div class="section-header-left">' +
        '<h3><i data-lucide="settings" class="w-4 h-4"></i> ' + t('cli.settings') + '</h3>' +
      '</div>' +
    '</div>' +
    '<div class="cli-settings-grid">' +
      '<div class="cli-setting-item">' +
        '<label class="cli-setting-label">' +
          '<i data-lucide="layers" class="w-3 h-3"></i>' +
          t('cli.promptFormat') +
        '</label>' +
        '<div class="cli-setting-control">' +
          '<select class="cli-setting-select" onchange="setPromptFormat(this.value)">' +
            '<option value="plain"' + (promptConcatFormat === 'plain' ? ' selected' : '') + '>Plain Text</option>' +
            '<option value="yaml"' + (promptConcatFormat === 'yaml' ? ' selected' : '') + '>YAML</option>' +
            '<option value="json"' + (promptConcatFormat === 'json' ? ' selected' : '') + '>JSON</option>' +
          '</select>' +
        '</div>' +
        '<p class="cli-setting-desc">' + t('cli.promptFormatDesc') + '</p>' +
      '</div>' +
      '<div class="cli-setting-item">' +
        '<label class="cli-setting-label">' +
          '<i data-lucide="database" class="w-3 h-3"></i>' +
          t('cli.storageBackend') +
        '</label>' +
        '<div class="cli-setting-control">' +
          '<span class="cli-setting-value">SQLite</span>' +
        '</div>' +
        '<p class="cli-setting-desc">' + t('cli.storageBackendDesc') + '</p>' +
      '</div>' +
      '<div class="cli-setting-item">' +
        '<label class="cli-setting-label">' +
          '<i data-lucide="sparkles" class="w-3 h-3"></i>' +
          t('cli.smartContext') +
        '</label>' +
        '<div class="cli-setting-control">' +
          '<label class="cli-toggle">' +
            '<input type="checkbox"' + (smartContextEnabled ? ' checked' : '') + ' onchange="setSmartContextEnabled(this.checked)">' +
            '<span class="cli-toggle-slider"></span>' +
          '</label>' +
        '</div>' +
        '<p class="cli-setting-desc">' + t('cli.smartContextDesc') + '</p>' +
      '</div>' +
      '<div class="cli-setting-item">' +
        '<label class="cli-setting-label">' +
          '<i data-lucide="refresh-cw" class="w-3 h-3"></i>' +
          t('cli.nativeResume') +
        '</label>' +
        '<div class="cli-setting-control">' +
          '<label class="cli-toggle">' +
            '<input type="checkbox"' + (nativeResumeEnabled ? ' checked' : '') + ' onchange="setNativeResumeEnabled(this.checked)">' +
            '<span class="cli-toggle-slider"></span>' +
          '</label>' +
        '</div>' +
        '<p class="cli-setting-desc">' + t('cli.nativeResumeDesc') + '</p>' +
      '</div>' +
      '<div class="cli-setting-item">' +
        '<label class="cli-setting-label">' +
          '<i data-lucide="git-branch" class="w-3 h-3"></i>' +
          t('cli.recursiveQuery') +
        '</label>' +
        '<div class="cli-setting-control">' +
          '<label class="cli-toggle">' +
            '<input type="checkbox"' + (recursiveQueryEnabled ? ' checked' : '') + ' onchange="setRecursiveQueryEnabled(this.checked)">' +
            '<span class="cli-toggle-slider"></span>' +
          '</label>' +
        '</div>' +
        '<p class="cli-setting-desc">' + t('cli.recursiveQueryDesc') + '</p>' +
      '</div>' +
      '<div class="cli-setting-item' + (!smartContextEnabled ? ' disabled' : '') + '">' +
        '<label class="cli-setting-label">' +
          '<i data-lucide="files" class="w-3 h-3"></i>' +
          t('cli.maxContextFiles') +
        '</label>' +
        '<div class="cli-setting-control">' +
          '<select class="cli-setting-select" onchange="setSmartContextMaxFiles(this.value)"' + (!smartContextEnabled ? ' disabled' : '') + '>' +
            '<option value="5"' + (smartContextMaxFiles === 5 ? ' selected' : '') + '>5 files</option>' +
            '<option value="10"' + (smartContextMaxFiles === 10 ? ' selected' : '') + '>10 files</option>' +
            '<option value="20"' + (smartContextMaxFiles === 20 ? ' selected' : '') + '>20 files</option>' +
          '</select>' +
        '</div>' +
        '<p class="cli-setting-desc">' + t('cli.maxContextFilesDesc') + '</p>' +
      '</div>' +
    '</div>';

  container.innerHTML = settingsHtml;
  if (window.lucide) lucide.createIcons();
}

// ========== CCW Endpoint Tools Section (Full Width) ==========
function renderCcwEndpointToolsSection() {
  var container = document.getElementById('ccw-endpoint-tools-section');
  if (!container) return;

  var count = (ccwEndpointTools || []).length;
  var toolsHtml = '';

  if (!ccwEndpointTools || ccwEndpointTools.length === 0) {
    toolsHtml = '<div class="ccw-empty-state">' +
      '<i data-lucide="wrench" class="w-8 h-8"></i>' +
      '<p>' + t('ccw.noEndpointTools') + '</p>' +
      '<button class="btn btn-sm btn-primary" onclick="loadCcwEndpointTools().then(function() { renderCcwEndpointToolsSection(); if (window.lucide) lucide.createIcons(); })">' +
      '<i data-lucide="refresh-cw" class="w-3 h-3"></i> ' + t('common.refresh') + '</button>' +
      '</div>';
  } else {
    toolsHtml = '<div class="endpoint-tools-grid">' +
      ccwEndpointTools.map(function(t, idx) {
        var name = t && t.name ? String(t.name) : 'unknown';
        var desc = t && t.description ? String(t.description) : '';
        var requiredCount = (t && t.parameters && Array.isArray(t.parameters.required)) ? t.parameters.required.length : 0;
        var propsCount = (t && t.parameters && t.parameters.properties) ? Object.keys(t.parameters.properties).length : 0;
        var shortDesc = desc.length > 60 ? desc.substring(0, 60) + '...' : desc;

        return '<div class="endpoint-tool-card" onclick="showEndpointToolDetail(' + idx + ')">' +
          '<div class="endpoint-tool-header">' +
            '<span class="endpoint-tool-dot"></span>' +
            '<span class="endpoint-tool-name">' + escapeHtml(name) + '</span>' +
          '</div>' +
          '<div class="endpoint-tool-desc">' + escapeHtml(shortDesc || 'No description') + '</div>' +
          '<div class="endpoint-tool-meta">' +
            '<span class="endpoint-tool-params">' +
              '<i data-lucide="braces" class="w-3 h-3"></i> ' + propsCount +
            '</span>' +
            (requiredCount > 0 ? '<span class="endpoint-tool-required">' + requiredCount + ' required</span>' : '') +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  container.innerHTML = '<div class="section-header">' +
      '<div class="section-header-left">' +
        '<h3><i data-lucide="server" class="w-4 h-4"></i> ' + t('ccw.endpointTools') + '</h3>' +
        '<span class="section-count">' + count + ' ' + (count !== 1 ? t('ccw.tools') : t('ccw.tool')) + '</span>' +
      '</div>' +
      '<button class="btn-icon" onclick="loadCcwEndpointTools().then(function() { renderCcwEndpointToolsSection(); if (window.lucide) lucide.createIcons(); })" title="Refresh">' +
        '<i data-lucide="refresh-cw" class="w-4 h-4"></i>' +
      '</button>' +
    '</div>' +
    toolsHtml;

  if (window.lucide) lucide.createIcons();
}

// ========== Endpoint Tool Detail Modal ==========
function showEndpointToolDetail(toolIndex) {
  var tool = ccwEndpointTools[toolIndex];
  if (!tool) return;

  var name = tool.name || 'unknown';
  var desc = tool.description || 'No description available';
  var params = tool.parameters || {};
  var properties = params.properties || {};
  var required = params.required || [];

  // Build parameters table
  var paramsHtml = '';
  var propKeys = Object.keys(properties);

  if (propKeys.length > 0) {
    paramsHtml = '<div class="tool-detail-params">' +
      '<h4><i data-lucide="settings-2" class="w-4 h-4"></i> Parameters</h4>' +
      '<div class="tool-params-list">';

    for (var i = 0; i < propKeys.length; i++) {
      var key = propKeys[i];
      var prop = properties[key];
      var isRequired = required.indexOf(key) !== -1;
      var propType = prop.type || 'any';
      var propDesc = prop.description || '';
      var propDefault = prop.default !== undefined ? JSON.stringify(prop.default) : null;
      var propEnum = prop.enum ? prop.enum.join(', ') : null;

      paramsHtml += '<div class="tool-param-item">' +
        '<div class="tool-param-header">' +
          '<code class="tool-param-name">' + escapeHtml(key) + '</code>' +
          '<span class="tool-param-type">' + escapeHtml(propType) + '</span>' +
          (isRequired ? '<span class="tool-param-required">required</span>' : '<span class="tool-param-optional">optional</span>') +
        '</div>' +
        (propDesc ? '<div class="tool-param-desc">' + escapeHtml(propDesc) + '</div>' : '') +
        (propDefault ? '<div class="tool-param-default">Default: <code>' + escapeHtml(propDefault) + '</code></div>' : '') +
        (propEnum ? '<div class="tool-param-enum">Options: <code>' + escapeHtml(propEnum) + '</code></div>' : '') +
      '</div>';
    }

    paramsHtml += '</div></div>';
  } else {
    paramsHtml = '<div class="tool-detail-no-params">' +
      '<i data-lucide="info" class="w-4 h-4"></i>' +
      '<span>This tool has no parameters</span>' +
    '</div>';
  }

  // Usage example
  var usageExample = 'ccw tool exec ' + name;
  if (propKeys.length > 0) {
    var exampleParams = {};
    for (var j = 0; j < Math.min(propKeys.length, 2); j++) {
      var k = propKeys[j];
      var p = properties[k];
      if (p.type === 'string') exampleParams[k] = '<value>';
      else if (p.type === 'boolean') exampleParams[k] = true;
      else if (p.type === 'number') exampleParams[k] = 0;
      else exampleParams[k] = '<value>';
    }
    usageExample += " '" + JSON.stringify(exampleParams) + "'";
  }

  var modalContent = '<div class="tool-detail-modal">' +
    '<div class="tool-detail-header">' +
      '<div class="tool-detail-icon"><i data-lucide="terminal" class="w-6 h-6"></i></div>' +
      '<div class="tool-detail-title">' +
        '<h3>' + escapeHtml(name) + '</h3>' +
        '<span class="tool-detail-badge">endpoint tool</span>' +
      '</div>' +
    '</div>' +
    '<div class="tool-detail-desc">' + escapeHtml(desc) + '</div>' +
    paramsHtml +
    '<div class="tool-detail-usage">' +
      '<h4><i data-lucide="terminal-square" class="w-4 h-4"></i> Usage Example</h4>' +
      '<div class="tool-usage-code">' +
        '<code>' + escapeHtml(usageExample) + '</code>' +
        '<button class="tool-copy-btn" onclick="copyToolUsage(this, \'' + escapeHtml(usageExample.replace(/'/g, "\\'")) + '\')" title="Copy">' +
          '<i data-lucide="copy" class="w-3.5 h-3.5"></i>' +
        '</button>' +
      '</div>' +
    '</div>' +
  '</div>';

  showModal(name, modalContent, { size: 'lg' });
}

function copyToolUsage(btn, text) {
  navigator.clipboard.writeText(text).then(function() {
    var icon = btn.querySelector('i');
    if (icon) {
      icon.setAttribute('data-lucide', 'check');
      if (window.lucide) lucide.createIcons();
      setTimeout(function() {
        icon.setAttribute('data-lucide', 'copy');
        if (window.lucide) lucide.createIcons();
      }, 2000);
    }
  });
}

// CCW Install Carousel State
var ccwCarouselIndex = 0;

function renderCcwInstallPanel() {
  var container = document.getElementById('ccw-install-panel');
  if (!container) return;

  var html = '<div class="cli-status-header"><h3><i data-lucide="package" class="w-4 h-4"></i> CCW Installations</h3>' +
    '<div class="ccw-header-actions">' +
    '<button class="btn-icon" onclick="showCcwInstallModal()" title="Add Installation">' +
    '<i data-lucide="plus" class="w-4 h-4"></i></button>' +
    '<button class="btn-icon" onclick="loadCcwInstallations().then(function() { renderCcwInstallPanel(); })" title="Refresh">' +
    '<i data-lucide="refresh-cw" class="w-4 h-4"></i></button>' +
    '</div></div>' +
    '<div class="ccw-install-content">';

  if (ccwInstallations.length === 0) {
    html += '<div class="ccw-empty-state">' +
      '<i data-lucide="package-x" class="w-8 h-8"></i>' +
      '<p>No installations found</p>' +
      '<button class="btn btn-sm btn-primary" onclick="showCcwInstallModal()">' +
      '<i data-lucide="download" class="w-3 h-3"></i> Install CCW</button></div>';
  } else {
    // Carousel container
    html += '<div class="ccw-carousel-wrapper">';

    // Left arrow (show only if more than 1 installation)
    if (ccwInstallations.length > 1) {
      html += '<button class="ccw-carousel-btn ccw-carousel-prev" onclick="ccwCarouselPrev()" title="Previous">' +
        '<i data-lucide="chevron-left" class="w-4 h-4"></i></button>';
    }

    html += '<div class="ccw-carousel-track" id="ccwCarouselTrack">';

    for (var i = 0; i < ccwInstallations.length; i++) {
      var inst = ccwInstallations[i];
      var isGlobal = inst.installation_mode === 'Global';
      var modeIcon = isGlobal ? 'home' : 'folder';
      var version = inst.application_version || 'unknown';
      var installDate = new Date(inst.installation_date).toLocaleDateString();
      var activeClass = i === ccwCarouselIndex ? 'active' : '';

      html += '<div class="ccw-carousel-card ' + activeClass + '" data-index="' + i + '">' +
        '<div class="ccw-card-header">' +
        '<div class="ccw-card-mode ' + (isGlobal ? 'global' : 'path') + '">' +
        '<i data-lucide="' + modeIcon + '" class="w-4 h-4"></i>' +
        '<span>' + inst.installation_mode + '</span>' +
        '</div>' +
        '<div class="ccw-card-header-right">' +
        '<span class="ccw-version-tag">v' + version + '</span>' +
        '<button class="btn-icon btn-icon-sm" onclick="runCcwUpgrade()" title="Upgrade">' +
        '<i data-lucide="arrow-up-circle" class="w-3.5 h-3.5"></i></button>' +
        '<button class="btn-icon btn-icon-sm btn-danger" onclick="confirmCcwUninstall(\'' + escapeHtml(inst.installation_path) + '\')" title="Uninstall">' +
        '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>' +
        '</div>' +
        '</div>' +
        '<div class="ccw-card-path" title="' + inst.installation_path + '">' + escapeHtml(inst.installation_path) + '</div>' +
        '<div class="ccw-card-meta">' +
        '<span><i data-lucide="calendar" class="w-3 h-3"></i> ' + installDate + '</span>' +
        '<span><i data-lucide="file" class="w-3 h-3"></i> ' + (inst.files_count || 0) + ' files</span>' +
        '</div>' +
        '</div>';
    }

    html += '</div>';

    // Right arrow (show only if more than 1 installation)
    if (ccwInstallations.length > 1) {
      html += '<button class="ccw-carousel-btn ccw-carousel-next" onclick="ccwCarouselNext()" title="Next">' +
        '<i data-lucide="chevron-right" class="w-4 h-4"></i></button>';
    }

    html += '</div>';

    // Dots indicator (show only if more than 1 installation)
    if (ccwInstallations.length > 1) {
      html += '<div class="ccw-carousel-dots">';
      for (var j = 0; j < ccwInstallations.length; j++) {
        var dotActive = j === ccwCarouselIndex ? 'active' : '';
        html += '<button class="ccw-carousel-dot ' + dotActive + '" onclick="ccwCarouselGoTo(' + j + ')"></button>';
      }
      html += '</div>';
    }
  }

  html += '</div>';
  container.innerHTML = html;
  if (window.lucide) lucide.createIcons();

  // Update carousel position
  updateCcwCarouselPosition();
}

function ccwCarouselPrev() {
  if (ccwCarouselIndex > 0) {
    ccwCarouselIndex--;
    updateCcwCarouselPosition();
    updateCcwCarouselDots();
  }
}

function ccwCarouselNext() {
  if (ccwCarouselIndex < ccwInstallations.length - 1) {
    ccwCarouselIndex++;
    updateCcwCarouselPosition();
    updateCcwCarouselDots();
  }
}

function ccwCarouselGoTo(index) {
  ccwCarouselIndex = index;
  updateCcwCarouselPosition();
  updateCcwCarouselDots();
}

function updateCcwCarouselPosition() {
  var track = document.getElementById('ccwCarouselTrack');
  if (track) {
    track.style.transform = 'translateX(-' + (ccwCarouselIndex * 100) + '%)';
  }

  // Update card active states
  var cards = document.querySelectorAll('.ccw-carousel-card');
  cards.forEach(function(card, idx) {
    card.classList.toggle('active', idx === ccwCarouselIndex);
  });
}

function updateCcwCarouselDots() {
  var dots = document.querySelectorAll('.ccw-carousel-dot');
  dots.forEach(function(dot, idx) {
    dot.classList.toggle('active', idx === ccwCarouselIndex);
  });
}

// CCW Install Modal
function showCcwInstallModal() {
  var modalContent = '<div class="ccw-install-modal">' +
    '<div class="ccw-install-options">' +
    '<div class="ccw-install-option" onclick="selectCcwInstallMode(\'Global\')">' +
    '<div class="ccw-option-icon global"><i data-lucide="home" class="w-6 h-6"></i></div>' +
    '<div class="ccw-option-info">' +
    '<div class="ccw-option-title">Global Installation</div>' +
    '<div class="ccw-option-desc">Install to user home directory (~/.claude)</div>' +
    '</div>' +
    '<i data-lucide="chevron-right" class="w-4 h-4 text-muted-foreground"></i>' +
    '</div>' +
    '<div class="ccw-install-option" onclick="toggleCcwPathInput()">' +
    '<div class="ccw-option-icon path"><i data-lucide="folder" class="w-6 h-6"></i></div>' +
    '<div class="ccw-option-info">' +
    '<div class="ccw-option-title">Path Installation</div>' +
    '<div class="ccw-option-desc">Install to a specific project folder</div>' +
    '</div>' +
    '<i data-lucide="chevron-right" class="w-4 h-4 text-muted-foreground"></i>' +
    '</div>' +
    '</div>' +
    '<div class="ccw-path-input-section hidden" id="ccwPathInputSection">' +
    '<div class="ccw-path-input-group">' +
    '<label>Installation Path</label>' +
    '<input type="text" id="ccwInstallPath" class="cli-textarea" placeholder="D:/projects/my-project" value="' + (projectPath || '') + '">' +
    '</div>' +
    '<div class="ccw-install-action">' +
    '<button class="btn btn-primary" onclick="executeCcwInstall()">' +
    '<i data-lucide="download" class="w-4 h-4"></i> Install to Path</button>' +
    '</div>' +
    '</div>' +
    '</div>';

  showModal('Install CCW', modalContent);
}

function selectCcwInstallMode(mode) {
  if (mode === 'Global') {
    closeModal();
    runCcwInstall('Global');
  }
}

function toggleCcwPathInput() {
  var section = document.getElementById('ccwPathInputSection');
  if (section) {
    section.classList.toggle('hidden');
    if (!section.classList.contains('hidden')) {
      var input = document.getElementById('ccwInstallPath');
      if (input) input.focus();
    }
  }
}

function executeCcwInstall() {
  var input = document.getElementById('ccwInstallPath');
  var path = input ? input.value.trim() : '';

  if (!path) {
    showRefreshToast('Please enter a path', 'error');
    return;
  }

  closeModal();
  runCcwInstall('Path', path);
}

function truncatePath(path) {
  if (!path) return '';
  var maxLen = 35;
  if (path.length <= maxLen) return path;
  return '...' + path.slice(-maxLen + 3);
}

function renderCliExecutePanel() {
  var container = document.getElementById('cli-execute-panel');
  if (!container) return;

  var tools = ['gemini', 'qwen', 'codex'];
  var modes = ['analysis', 'write', 'auto'];

  var html = '<div class="cli-execute-header"><h3>Quick Execute</h3></div>' +
    '<div class="cli-execute-form"><div class="cli-execute-row">' +
    '<div class="cli-form-group"><label for="cli-exec-tool">Tool</label>' +
    '<select id="cli-exec-tool" class="cli-select">';
  for (var i = 0; i < tools.length; i++) {
    var tool = tools[i];
    var selected = tool === defaultCliTool ? 'selected' : '';
    html += '<option value="' + tool + '" ' + selected + '>' + tool.charAt(0).toUpperCase() + tool.slice(1) + '</option>';
  }
  html += '</select></div>' +
    '<div class="cli-form-group"><label for="cli-exec-mode">Mode</label>' +
    '<select id="cli-exec-mode" class="cli-select">';
  for (var j = 0; j < modes.length; j++) {
    var mode = modes[j];
    var sel = mode === 'analysis' ? 'selected' : '';
    html += '<option value="' + mode + '" ' + sel + '>' + mode.charAt(0).toUpperCase() + mode.slice(1) + '</option>';
  }
  html += '</select></div></div>' +
    '<div class="cli-form-group"><label for="cli-exec-prompt">Prompt</label>' +
    '<textarea id="cli-exec-prompt" class="cli-textarea" placeholder="Enter your prompt..."></textarea></div>' +
    '<div class="cli-execute-actions">' +
    '<button class="btn btn-primary" onclick="executeCliFromDashboard()" ' + (currentCliExecution ? 'disabled' : '') + '>' +
    '<i data-lucide="play" class="w-4 h-4"></i> Execute</button></div></div>';
  container.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

// ========== CCW Actions ==========
function runCcwInstall(mode, customPath) {
  var command;
  if (mode === 'Global') {
    command = 'ccw install --mode Global';
  } else {
    var installPath = customPath || projectPath;
    command = 'ccw install --mode Path --path "' + installPath + '"';
  }

  // Copy command to clipboard
  if (navigator.clipboard) {
    navigator.clipboard.writeText(command).then(function() {
      showRefreshToast('Command copied: ' + command, 'success');
    }).catch(function() {
      showRefreshToast('Run: ' + command, 'info');
    });
  } else {
    showRefreshToast('Run: ' + command, 'info');
  }
}

async function runCcwUpgrade() {
    showRefreshToast(t('ccw.upgradeStarting'), 'info');

  try {
    var response = await fetch('/api/ccw/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    var result = await response.json();

    if (result.success) {
      showRefreshToast(t('ccw.upgradeCompleted'), 'success');
      // Reload installations after upgrade
      setTimeout(function() {
        loadCcwInstallations().then(function() {
          renderCcwInstallPanel();
        });
      }, 1000);
    } else {
      showRefreshToast(t('ccw.upgradeFailed', { error: result.error || 'Unknown error' }), 'error');
    }
  } catch (err) {
    showRefreshToast(t('ccw.upgradeFailed', { error: err.message }), 'error');
  }
}

function confirmCcwUninstall(installPath) {
  if (confirm(t('ccw.uninstallConfirm') + '\n' + (installPath || 'Current installation'))) {
    var command = installPath
      ? 'ccw uninstall --path "' + installPath + '"'
      : 'ccw uninstall';

    if (navigator.clipboard) {
      navigator.clipboard.writeText(command).then(function() {
        showRefreshToast('Command copied: ' + command, 'success');
      }).catch(function() {
        showRefreshToast('Run: ' + command, 'info');
      });
    } else {
      showRefreshToast('Run: ' + command, 'info');
    }
  }
}

// ========== Execution ==========
async function executeCliFromDashboard() {
  var toolEl = document.getElementById('cli-exec-tool');
  var modeEl = document.getElementById('cli-exec-mode');
  var promptEl = document.getElementById('cli-exec-prompt');

  var tool = toolEl ? toolEl.value : 'gemini';
  var mode = modeEl ? modeEl.value : 'analysis';
  var prompt = promptEl ? promptEl.value.trim() : '';

  if (!prompt) {
    showRefreshToast(t('toast.enterPrompt'), 'error');
    return;
  }

  currentCliExecution = { tool: tool, mode: mode, prompt: prompt, startTime: Date.now() };
  cliExecutionOutput = '';

  var outputPanel = document.getElementById('cli-output-panel');
  var outputContent = document.getElementById('cli-output-content');
  var statusIndicator = document.getElementById('cli-output-status-indicator');
  var statusText = document.getElementById('cli-output-status-text');

  if (outputPanel) outputPanel.classList.remove('hidden');
  if (outputContent) outputContent.textContent = '';
  if (statusIndicator) statusIndicator.className = 'status-indicator running';
  if (statusText) statusText.textContent = 'Running...';

  var execBtn = document.querySelector('.cli-execute-actions .btn-primary');
  if (execBtn) execBtn.disabled = true;

  try {
    var response = await fetch('/api/cli/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: tool,
        mode: mode,
        prompt: prompt,
        dir: projectPath,
        format: promptConcatFormat,
        smartContext: {
          enabled: smartContextEnabled,
          maxFiles: smartContextMaxFiles
        }
      })
    });
    var result = await response.json();

    if (statusIndicator) statusIndicator.className = 'status-indicator ' + (result.success ? 'success' : 'error');
    if (statusText) {
      var duration = formatDuration(result.execution ? result.execution.duration_ms : (Date.now() - currentCliExecution.startTime));
      statusText.textContent = result.success ? 'Completed in ' + duration : 'Failed: ' + (result.error || 'Unknown');
    }

    await loadCliHistory();
    renderCliHistory();
    showRefreshToast(result.success ? t('toast.completed') : (result.error || t('toast.failed')), result.success ? 'success' : 'error');
  } catch (error) {
    if (statusIndicator) statusIndicator.className = 'status-indicator error';
    if (statusText) statusText.textContent = 'Error: ' + error.message;
    showRefreshToast(t('toast.error', { error: error.message }), 'error');
  }

  currentCliExecution = null;
  if (execBtn) execBtn.disabled = false;
}

// ========== WebSocket Event Handlers ==========
function handleCliExecutionStarted(payload) {
  currentCliExecution = {
    executionId: payload.executionId,
    tool: payload.tool,
    mode: payload.mode,
    startTime: new Date(payload.timestamp).getTime()
  };
  cliExecutionOutput = '';

  // Show toast notification
  if (typeof addGlobalNotification === 'function') {
    addGlobalNotification('info', 'CLI ' + payload.tool + ' started', payload.mode + ' mode', 'CLI');
  }

  if (currentView === 'cli-manager') {
    var outputPanel = document.getElementById('cli-output-panel');
    var outputContent = document.getElementById('cli-output-content');
    var statusIndicator = document.getElementById('cli-output-status-indicator');
    var statusText = document.getElementById('cli-output-status-text');

    if (outputPanel) outputPanel.classList.remove('hidden');
    if (outputContent) outputContent.textContent = '';
    if (statusIndicator) statusIndicator.className = 'status-indicator running';
    if (statusText) statusText.textContent = 'Running ' + payload.tool + ' (' + payload.mode + ')...';
  }
}

function handleCliOutput(payload) {
  cliExecutionOutput += payload.data;
  var outputContent = document.getElementById('cli-output-content');
  if (outputContent) {
    outputContent.textContent = cliExecutionOutput;
    outputContent.scrollTop = outputContent.scrollHeight;
  }
}

function handleCliExecutionCompleted(payload) {
  var statusIndicator = document.getElementById('cli-output-status-indicator');
  var statusText = document.getElementById('cli-output-status-text');

  if (statusIndicator) statusIndicator.className = 'status-indicator ' + (payload.success ? 'success' : 'error');
  if (statusText) statusText.textContent = payload.success ? 'Completed in ' + formatDuration(payload.duration_ms) : 'Failed: ' + payload.status;

  // Show toast notification
  if (typeof addGlobalNotification === 'function') {
    if (payload.success) {
      addGlobalNotification('success', 'CLI execution completed', formatDuration(payload.duration_ms), 'CLI');
    } else {
      addGlobalNotification('error', 'CLI execution failed', payload.status, 'CLI');
    }
  }

  currentCliExecution = null;
  if (currentView === 'cli-manager') {
    loadCliHistory().then(function() { renderCliHistory(); });
  }
}

function handleCliExecutionError(payload) {
  var statusIndicator = document.getElementById('cli-output-status-indicator');
  var statusText = document.getElementById('cli-output-status-text');

  if (statusIndicator) statusIndicator.className = 'status-indicator error';
  if (statusText) statusText.textContent = 'Error: ' + payload.error;

  // Show toast notification
  if (typeof addGlobalNotification === 'function') {
    addGlobalNotification('error', 'CLI execution error', payload.error, 'CLI');
  }

  currentCliExecution = null;
}

// ========== CLI Tool Install/Uninstall Wizards ==========
function openCliInstallWizard(toolName) {
  var toolDescriptions = {
    gemini: 'Google AI for code analysis and generation',
    qwen: 'Alibaba AI assistant for coding',
    codex: 'OpenAI code generation and understanding',
    claude: 'Anthropic AI assistant'
  };

  var toolPackages = {
    gemini: '@google/gemini-cli',
    qwen: '@qwen-code/qwen-code',
    codex: '@openai/codex',
    claude: '@anthropic-ai/claude-code'
  };

  var modal = document.createElement('div');
  modal.id = 'cliInstallModal';
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
  modal.innerHTML =
    '<div class="bg-card rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">' +
      '<div class="p-6">' +
        '<div class="flex items-center gap-3 mb-4">' +
          '<div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">' +
            '<i data-lucide="download" class="w-5 h-5 text-primary"></i>' +
          '</div>' +
          '<div>' +
            '<h3 class="text-lg font-semibold">Install ' + toolName.charAt(0).toUpperCase() + toolName.slice(1) + '</h3>' +
            '<p class="text-sm text-muted-foreground">' + (toolDescriptions[toolName] || 'CLI tool') + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="space-y-4">' +
          '<div class="bg-muted/50 rounded-lg p-4">' +
            '<h4 class="font-medium mb-2">What will be installed:</h4>' +
            '<ul class="text-sm space-y-2 text-muted-foreground">' +
              '<li class="flex items-start gap-2">' +
                '<i data-lucide="check" class="w-4 h-4 text-success mt-0.5"></i>' +
                '<span><strong>NPM Package:</strong> <code class="bg-muted px-1 rounded">' + (toolPackages[toolName] || toolName) + '</code></span>' +
              '</li>' +
              '<li class="flex items-start gap-2">' +
                '<i data-lucide="check" class="w-4 h-4 text-success mt-0.5"></i>' +
                '<span><strong>Global installation</strong> - Available system-wide</span>' +
              '</li>' +
              '<li class="flex items-start gap-2">' +
                '<i data-lucide="check" class="w-4 h-4 text-success mt-0.5"></i>' +
                '<span><strong>CLI commands</strong> - Accessible from terminal</span>' +
              '</li>' +
            '</ul>' +
          '</div>' +
          '<div class="bg-primary/5 border border-primary/20 rounded-lg p-3">' +
            '<div class="flex items-start gap-2">' +
              '<i data-lucide="info" class="w-4 h-4 text-primary mt-0.5"></i>' +
              '<div class="text-sm text-muted-foreground">' +
                '<p class="font-medium text-foreground">Installation Method</p>' +
                '<p class="mt-1">Uses <code class="bg-muted px-1 rounded">npm install -g</code></p>' +
                '<p class="mt-1">First installation may take 1-2 minutes depending on network speed.</p>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div id="cliInstallProgress" class="hidden">' +
            '<div class="flex items-center gap-3">' +
              '<div class="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full"></div>' +
              '<span class="text-sm" id="cliInstallStatus">Starting installation...</span>' +
            '</div>' +
            '<div class="mt-2 h-2 bg-muted rounded-full overflow-hidden">' +
              '<div id="cliInstallProgressBar" class="h-full bg-primary transition-all duration-300" style="width: 0%"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="border-t border-border p-4 flex justify-end gap-3 bg-muted/30">' +
        '<button class="btn-outline px-4 py-2" onclick="closeCliInstallWizard()">Cancel</button>' +
        '<button id="cliInstallBtn" class="btn-primary px-4 py-2" onclick="startCliInstall(\'' + toolName + '\')">' +
          '<i data-lucide="download" class="w-4 h-4 mr-2"></i>' +
          'Install Now' +
        '</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);

  if (window.lucide) {
    lucide.createIcons();
  }
}

function closeCliInstallWizard() {
  var modal = document.getElementById('cliInstallModal');
  if (modal) {
    modal.remove();
  }
}

async function startCliInstall(toolName) {
  var progressDiv = document.getElementById('cliInstallProgress');
  var installBtn = document.getElementById('cliInstallBtn');
  var statusText = document.getElementById('cliInstallStatus');
  var progressBar = document.getElementById('cliInstallProgressBar');

  progressDiv.classList.remove('hidden');
  installBtn.disabled = true;
  installBtn.innerHTML = '<span class="animate-pulse">Installing...</span>';

  var stages = [
    { progress: 20, text: 'Connecting to NPM registry...' },
    { progress: 40, text: 'Downloading package...' },
    { progress: 60, text: 'Installing dependencies...' },
    { progress: 80, text: 'Setting up CLI commands...' },
    { progress: 95, text: 'Finalizing installation...' }
  ];

  var currentStage = 0;
  var progressInterval = setInterval(function() {
    if (currentStage < stages.length) {
      statusText.textContent = stages[currentStage].text;
      progressBar.style.width = stages[currentStage].progress + '%';
      currentStage++;
    }
  }, 1000);

  try {
    var response = await fetch('/api/cli/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: toolName })
    });

    clearInterval(progressInterval);
    var result = await response.json();

    if (result.success) {
      progressBar.style.width = '100%';
      statusText.textContent = 'Installation complete!';

      setTimeout(function() {
        closeCliInstallWizard();
        showRefreshToast(toolName + ' installed successfully!', 'success');
        loadCliToolStatus().then(function() {
          renderToolsSection();
          if (window.lucide) lucide.createIcons();
        });
      }, 1000);
    } else {
      statusText.textContent = 'Error: ' + result.error;
      progressBar.classList.add('bg-destructive');
      installBtn.disabled = false;
      installBtn.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4 mr-2"></i> Retry';
      if (window.lucide) lucide.createIcons();
    }
  } catch (err) {
    clearInterval(progressInterval);
    statusText.textContent = 'Error: ' + err.message;
    progressBar.classList.add('bg-destructive');
    installBtn.disabled = false;
    installBtn.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4 mr-2"></i> Retry';
    if (window.lucide) lucide.createIcons();
  }
}

function openCliUninstallWizard(toolName) {
  var modal = document.createElement('div');
  modal.id = 'cliUninstallModal';
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
  modal.innerHTML =
    '<div class="bg-card rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">' +
      '<div class="p-6">' +
        '<div class="flex items-center gap-3 mb-4">' +
          '<div class="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">' +
            '<i data-lucide="trash-2" class="w-5 h-5 text-destructive"></i>' +
          '</div>' +
          '<div>' +
            '<h3 class="text-lg font-semibold">Uninstall ' + toolName.charAt(0).toUpperCase() + toolName.slice(1) + '</h3>' +
            '<p class="text-sm text-muted-foreground">Remove CLI tool from system</p>' +
          '</div>' +
        '</div>' +
        '<div class="space-y-4">' +
          '<div class="bg-destructive/5 border border-destructive/20 rounded-lg p-4">' +
            '<h4 class="font-medium text-destructive mb-2">What will be removed:</h4>' +
            '<ul class="text-sm space-y-2 text-muted-foreground">' +
              '<li class="flex items-start gap-2">' +
                '<i data-lucide="x" class="w-4 h-4 text-destructive mt-0.5"></i>' +
                '<span>Global NPM package</span>' +
              '</li>' +
              '<li class="flex items-start gap-2">' +
                '<i data-lucide="x" class="w-4 h-4 text-destructive mt-0.5"></i>' +
                '<span>CLI commands and executables</span>' +
              '</li>' +
              '<li class="flex items-start gap-2">' +
                '<i data-lucide="x" class="w-4 h-4 text-destructive mt-0.5"></i>' +
                '<span>Tool configuration (if any)</span>' +
              '</li>' +
            '</ul>' +
          '</div>' +
          '<div class="bg-warning/10 border border-warning/20 rounded-lg p-3">' +
            '<div class="flex items-start gap-2">' +
              '<i data-lucide="alert-triangle" class="w-4 h-4 text-warning mt-0.5"></i>' +
              '<div class="text-sm">' +
                '<p class="font-medium text-warning">Note</p>' +
                '<p class="text-muted-foreground">You can reinstall this tool anytime from the CLI Manager.</p>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div id="cliUninstallProgress" class="hidden">' +
            '<div class="flex items-center gap-3">' +
              '<div class="animate-spin w-5 h-5 border-2 border-destructive border-t-transparent rounded-full"></div>' +
              '<span class="text-sm" id="cliUninstallStatus">Removing package...</span>' +
            '</div>' +
            '<div class="mt-2 h-2 bg-muted rounded-full overflow-hidden">' +
              '<div id="cliUninstallProgressBar" class="h-full bg-destructive transition-all duration-300" style="width: 0%"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="border-t border-border p-4 flex justify-end gap-3 bg-muted/30">' +
        '<button class="btn-outline px-4 py-2" onclick="closeCliUninstallWizard()">Cancel</button>' +
        '<button id="cliUninstallBtn" class="btn-destructive px-4 py-2" onclick="startCliUninstall(\'' + toolName + '\')">' +
          '<i data-lucide="trash-2" class="w-4 h-4 mr-2"></i>' +
          'Uninstall' +
        '</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);

  if (window.lucide) {
    lucide.createIcons();
  }
}

function closeCliUninstallWizard() {
  var modal = document.getElementById('cliUninstallModal');
  if (modal) {
    modal.remove();
  }
}

async function startCliUninstall(toolName) {
  var progressDiv = document.getElementById('cliUninstallProgress');
  var uninstallBtn = document.getElementById('cliUninstallBtn');
  var statusText = document.getElementById('cliUninstallStatus');
  var progressBar = document.getElementById('cliUninstallProgressBar');

  progressDiv.classList.remove('hidden');
  uninstallBtn.disabled = true;
  uninstallBtn.innerHTML = '<span class="animate-pulse">Uninstalling...</span>';

  var stages = [
    { progress: 33, text: 'Removing package files...' },
    { progress: 66, text: 'Cleaning up dependencies...' },
    { progress: 90, text: 'Finalizing removal...' }
  ];

  var currentStage = 0;
  var progressInterval = setInterval(function() {
    if (currentStage < stages.length) {
      statusText.textContent = stages[currentStage].text;
      progressBar.style.width = stages[currentStage].progress + '%';
      currentStage++;
    }
  }, 500);

  try {
    var response = await fetch('/api/cli/uninstall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: toolName })
    });

    clearInterval(progressInterval);
    var result = await response.json();

    if (result.success) {
      progressBar.style.width = '100%';
      statusText.textContent = 'Uninstallation complete!';

      setTimeout(function() {
        closeCliUninstallWizard();
        showRefreshToast(toolName + ' uninstalled successfully!', 'success');
        loadCliToolStatus().then(function() {
          renderToolsSection();
          if (window.lucide) lucide.createIcons();
        });
      }, 1000);
    } else {
      statusText.textContent = 'Error: ' + result.error;
      progressBar.classList.remove('bg-destructive');
      progressBar.classList.add('bg-destructive');
      uninstallBtn.disabled = false;
      uninstallBtn.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4 mr-2"></i> Retry';
      if (window.lucide) lucide.createIcons();
    }
  } catch (err) {
    clearInterval(progressInterval);
    statusText.textContent = 'Error: ' + err.message;
    progressBar.classList.remove('bg-destructive');
    progressBar.classList.add('bg-destructive');
    uninstallBtn.disabled = false;
    uninstallBtn.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4 mr-2"></i> Retry';
    if (window.lucide) lucide.createIcons();
  }
}

// ========== CodexLens Configuration Modal ==========
async function showCodexLensConfigModal() {
  var loadingContent = '<div class="text-center py-8">' +
    '<div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>' +
    '<p class="text-muted-foreground">' + t('codexlens.loadingConfig') + '</p>' +
  '</div>';

  showModal(t('codexlens.config'), loadingContent, { size: 'md' });

  try {
    // Fetch current configuration
    var response = await fetch('/api/codexlens/config');
    var config = await response.json();

    var content = buildCodexLensConfigContent(config);
    showModal('CodexLens Configuration', content, { size: 'md' });

    setTimeout(function() {
      initCodexLensConfigEvents(config);
      if (window.lucide) lucide.createIcons();
    }, 100);
  } catch (err) {
    var errorContent = '<div class="bg-destructive/10 border border-destructive/20 rounded-lg p-4">' +
      '<div class="flex items-start gap-2">' +
        '<i data-lucide="alert-circle" class="w-5 h-5 text-destructive mt-0.5"></i>' +
        '<div>' +
          '<p class="font-medium text-destructive">Failed to load configuration</p>' +
          '<p class="text-sm text-muted-foreground mt-1">' + err.message + '</p>' +
        '</div>' +
      '</div>' +
    '</div>';
    showModal('CodexLens Configuration', errorContent, { size: 'md' });
  }
}

function buildCodexLensConfigContent(config) {
  var status = codexLensStatus || {};
  var isInstalled = status.ready;
  var indexDir = config.index_dir || '~/.codexlens/indexes';
  var currentWorkspace = config.current_workspace || 'None';
  var indexCount = config.index_count || 0;

  return '<div class="tool-config-modal">' +
    // Status Section
    '<div class="tool-config-section">' +
      '<h4>' + t('codexlens.status') + '</h4>' +
      '<div class="tool-config-badges">' +
        '<span class="badge ' + (isInstalled ? 'badge-success' : 'badge-muted') + '">' +
          '<i data-lucide="' + (isInstalled ? 'check-circle' : 'circle-dashed') + '" class="w-3 h-3"></i> ' +
          (isInstalled ? t('codexlens.installed') : t('codexlens.notInstalled')) +
        '</span>' +
        '<span class="badge badge-primary">' +
          '<i data-lucide="database" class="w-3 h-3"></i> ' + indexCount + ' ' + t('codexlens.indexes') +
        '</span>' +
      '</div>' +
      (currentWorkspace !== 'None'
        ? '<div class="mt-3 p-3 bg-muted/30 rounded-lg">' +
            '<p class="text-sm text-muted-foreground mb-1">' + t('codexlens.currentWorkspace') + ':</p>' +
            '<p class="text-sm font-mono break-all">' + escapeHtml(currentWorkspace) + '</p>' +
          '</div>'
        : '') +
    '</div>' +

    // Index Storage Path Section
    '<div class="tool-config-section">' +
      '<h4>' + t('codexlens.indexStoragePath') + ' <span class="text-muted">(' + t('codexlens.whereIndexesStored') + ')</span></h4>' +
      '<div class="space-y-3">' +
        '<div class="bg-muted/30 rounded-lg p-3">' +
          '<p class="text-sm text-muted-foreground mb-2">' + t('codexlens.currentPath') + ':</p>' +
          '<p class="text-sm font-mono break-all bg-background px-2 py-1 rounded border border-border">' +
            escapeHtml(indexDir) +
          '</p>' +
        '</div>' +
        '<div>' +
          '<label class="text-sm font-medium mb-2 block">' + t('codexlens.newStoragePath') + ':</label>' +
          '<input type="text" id="indexDirInput" class="tool-config-input w-full" ' +
            'placeholder="' + t('codexlens.pathPlaceholder') + '" ' +
            'value="' + escapeHtml(indexDir) + '" />' +
          '<p class="text-xs text-muted-foreground mt-2">' +
            '<i data-lucide="info" class="w-3 h-3 inline"></i> ' +
            t('codexlens.pathInfo') +
          '</p>' +
        '</div>' +
        '<div class="bg-warning/10 border border-warning/20 rounded-lg p-3">' +
          '<div class="flex items-start gap-2">' +
            '<i data-lucide="alert-triangle" class="w-4 h-4 text-warning mt-0.5"></i>' +
            '<div class="text-sm">' +
              '<p class="font-medium text-warning">' + t('codexlens.migrationRequired') + '</p>' +
              '<p class="text-muted-foreground mt-1">' + t('codexlens.migrationWarning') + '</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +

    // Actions Section
    '<div class="tool-config-section">' +
      '<h4>' + t('codexlens.actions') + '</h4>' +
      '<div class="tool-config-actions">' +
        (isInstalled
          ? '<button class="btn-sm btn-outline" onclick="event.stopPropagation(); initCodexLensIndex()">' +
              '<i data-lucide="database" class="w-3 h-3"></i> ' + t('codexlens.initializeIndex') +
            '</button>' +
            '<button class="btn-sm btn-outline" onclick="event.stopPropagation(); cleanCurrentWorkspaceIndex()">' +
              '<i data-lucide="folder-x" class="w-3 h-3"></i> ' + t('codexlens.cleanCurrentWorkspace') +
            '</button>' +
            '<button class="btn-sm btn-outline" onclick="event.stopPropagation(); cleanCodexLensIndexes()">' +
              '<i data-lucide="trash" class="w-3 h-3"></i> ' + t('codexlens.cleanAllIndexes') +
            '</button>' +
            '<button class="btn-sm btn-outline btn-danger" onclick="event.stopPropagation(); uninstallCodexLens()">' +
              '<i data-lucide="trash-2" class="w-3 h-3"></i> ' + t('cli.uninstall') +
            '</button>'
          : '<button class="btn-sm btn-primary" onclick="event.stopPropagation(); installCodexLens()">' +
              '<i data-lucide="download" class="w-3 h-3"></i> ' + t('codexlens.installCodexLens') +
            '</button>') +
      '</div>' +
    '</div>' +

    // Semantic Dependencies Section
    (isInstalled
      ? '<div class="tool-config-section">' +
          '<h4>' + t('codexlens.semanticDeps') + '</h4>' +
          '<div id="semanticDepsStatus" class="space-y-2">' +
            '<div class="text-sm text-muted-foreground">' + t('codexlens.checkingDeps') + '</div>' +
          '</div>' +
        '</div>'
      : '') +

    // Model Management Section
    (isInstalled
      ? '<div class="tool-config-section">' +
          '<h4>' + t('codexlens.modelManagement') + '</h4>' +
          '<div id="modelListContainer" class="space-y-2">' +
            '<div class="text-sm text-muted-foreground">' + t('codexlens.loadingModels') + '</div>' +
          '</div>' +
        '</div>'
      : '') +

    // Test Search Section
    (isInstalled
      ? '<div class="tool-config-section">' +
          '<h4>' + t('codexlens.testSearch') + ' <span class="text-muted">(' + t('codexlens.testFunctionality') + ')</span></h4>' +
          '<div class="space-y-3">' +
            '<div class="flex gap-2">' +
              '<select id="searchTypeSelect" class="tool-config-select flex-1">' +
                '<option value="search">' + t('codexlens.textSearch') + '</option>' +
                '<option value="search_files">' + t('codexlens.fileSearch') + '</option>' +
                '<option value="symbol">' + t('codexlens.symbolSearch') + '</option>' +
              '</select>' +
              '<select id="searchModeSelect" class="tool-config-select flex-1">' +
                '<option value="exact">' + t('codexlens.exactMode') + '</option>' +
                '<option value="fuzzy">' + t('codexlens.fuzzyMode') + '</option>' +
                '<option value="hybrid">' + t('codexlens.hybridMode') + '</option>' +
                '<option value="vector">' + t('codexlens.vectorMode') + '</option>' +
              '</select>' +
            '</div>' +
            '<div>' +
              '<input type="text" id="searchQueryInput" class="tool-config-input w-full" ' +
                'placeholder="' + t('codexlens.searchPlaceholder') + '" />' +
            '</div>' +
            '<div>' +
              '<button class="btn-sm btn-primary w-full" id="runSearchBtn">' +
                '<i data-lucide="search" class="w-3 h-3"></i> ' + t('codexlens.runSearch') +
              '</button>' +
            '</div>' +
            '<div id="searchResults" class="hidden">' +
              '<div class="bg-muted/30 rounded-lg p-3 max-h-64 overflow-y-auto">' +
                '<div class="flex items-center justify-between mb-2">' +
                  '<p class="text-sm font-medium">' + t('codexlens.results') + ':</p>' +
                  '<span id="searchResultCount" class="text-xs text-muted-foreground"></span>' +
                '</div>' +
                '<pre id="searchResultContent" class="text-xs font-mono whitespace-pre-wrap break-all"></pre>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>'
      : '') +

    // Footer
    '<div class="tool-config-footer">' +
      '<button class="btn btn-outline" onclick="closeModal()">' + t('common.cancel') + '</button>' +
      '<button class="btn btn-primary" id="saveCodexLensConfigBtn">' +
        '<i data-lucide="save" class="w-3.5 h-3.5"></i> ' + t('codexlens.saveConfig') +
      '</button>' +
    '</div>' +
  '</div>';
}

function initCodexLensConfigEvents(currentConfig) {
  var saveBtn = document.getElementById('saveCodexLensConfigBtn');
  if (saveBtn) {
    saveBtn.onclick = async function() {
      var indexDirInput = document.getElementById('indexDirInput');
      var newIndexDir = indexDirInput ? indexDirInput.value.trim() : '';

      if (!newIndexDir) {
        showRefreshToast(t('codexlens.pathEmpty'), 'error');
        return;
      }

      if (newIndexDir === currentConfig.index_dir) {
        closeModal();
        return;
      }

      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="animate-pulse">' + t('common.saving') + '</span>';

      try {
        var response = await fetch('/api/codexlens/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ index_dir: newIndexDir })
        });

        var result = await response.json();

        if (result.success) {
          showRefreshToast(t('codexlens.configSaved'), 'success');
          closeModal();

          // Refresh CodexLens status
          if (typeof loadCodexLensStatus === 'function') {
            await loadCodexLensStatus();
            renderToolsSection();
            if (window.lucide) lucide.createIcons();
          }
        } else {
          showRefreshToast(t('common.saveFailed') + ': ' + result.error, 'error');
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i data-lucide="save" class="w-3.5 h-3.5"></i> ' + t('codexlens.saveConfig');
          if (window.lucide) lucide.createIcons();
        }
      } catch (err) {
        showRefreshToast(t('common.error') + ': ' + err.message, 'error');
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i data-lucide="save" class="w-3.5 h-3.5"></i> ' + t('codexlens.saveConfig');
        if (window.lucide) lucide.createIcons();
      }
    };
  }

  // Test Search Button
  var runSearchBtn = document.getElementById('runSearchBtn');
  if (runSearchBtn) {
    runSearchBtn.onclick = async function() {
      var searchType = document.getElementById('searchTypeSelect').value;
      var searchMode = document.getElementById('searchModeSelect').value;
      var query = document.getElementById('searchQueryInput').value.trim();
      var resultsDiv = document.getElementById('searchResults');
      var resultCount = document.getElementById('searchResultCount');
      var resultContent = document.getElementById('searchResultContent');

      if (!query) {
        showRefreshToast(t('codexlens.enterQuery'), 'warning');
        return;
      }

      runSearchBtn.disabled = true;
      runSearchBtn.innerHTML = '<span class="animate-pulse">' + t('codexlens.searching') + '</span>';
      resultsDiv.classList.add('hidden');

      try {
        var endpoint = '/api/codexlens/' + searchType;
        var params = new URLSearchParams({ query: query, limit: '20' });
        // Add mode parameter for search and search_files (not for symbol search)
        if (searchType === 'search' || searchType === 'search_files') {
          params.append('mode', searchMode);
        }

        var response = await fetch(endpoint + '?' + params.toString());
        var result = await response.json();

        console.log('[CodexLens Test] Search result:', result);

        if (result.success) {
          var results = result.results || result.files || [];
          resultCount.textContent = results.length + ' ' + t('codexlens.resultsCount');
          resultContent.textContent = JSON.stringify(results, null, 2);
          resultsDiv.classList.remove('hidden');
          showRefreshToast(t('codexlens.searchCompleted') + ': ' + results.length + ' ' + t('codexlens.resultsCount'), 'success');
        } else {
          resultContent.textContent = t('common.error') + ': ' + (result.error || t('common.unknownError'));
          resultsDiv.classList.remove('hidden');
          showRefreshToast(t('codexlens.searchFailed') + ': ' + result.error, 'error');
        }

        runSearchBtn.disabled = false;
        runSearchBtn.innerHTML = '<i data-lucide="search" class="w-3 h-3"></i> ' + t('codexlens.runSearch');
        if (window.lucide) lucide.createIcons();
      } catch (err) {
        console.error('[CodexLens Test] Error:', err);
        resultContent.textContent = t('common.exception') + ': ' + err.message;
        resultsDiv.classList.remove('hidden');
        showRefreshToast(t('common.error') + ': ' + err.message, 'error');
        runSearchBtn.disabled = false;
        runSearchBtn.innerHTML = '<i data-lucide="search" class="w-3 h-3"></i> ' + t('codexlens.runSearch');
        if (window.lucide) lucide.createIcons();
      }
    };
  }

  // Load semantic dependencies status
  loadSemanticDepsStatus();

  // Load model list
  loadModelList();
}

// Load semantic dependencies status
async function loadSemanticDepsStatus() {
  var container = document.getElementById('semanticDepsStatus');
  if (!container) return;

  try {
    var response = await fetch('/api/codexlens/semantic/status');
    var result = await response.json();

    if (result.available) {
      container.innerHTML =
        '<div class="flex items-center gap-2 text-sm">' +
          '<i data-lucide="check-circle" class="w-4 h-4 text-success"></i>' +
          '<span>' + t('codexlens.semanticInstalled') + '</span>' +
          '<span class="text-muted-foreground">(' + (result.backend || 'fastembed') + ')</span>' +
        '</div>';
    } else {
      container.innerHTML =
        '<div class="space-y-2">' +
          '<div class="flex items-center gap-2 text-sm text-muted-foreground">' +
            '<i data-lucide="alert-circle" class="w-4 h-4"></i>' +
            '<span>' + t('codexlens.semanticNotInstalled') + '</span>' +
          '</div>' +
          '<button class="btn-sm btn-outline" onclick="installSemanticDeps()">' +
            '<i data-lucide="download" class="w-3 h-3"></i> ' + t('codexlens.installDeps') +
          '</button>' +
        '</div>';
    }
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    container.innerHTML =
      '<div class="text-sm text-error">' + t('common.error') + ': ' + err.message + '</div>';
  }
}

// Install semantic dependencies
async function installSemanticDeps() {
  var container = document.getElementById('semanticDepsStatus');
  if (!container) return;

  container.innerHTML =
    '<div class="text-sm text-muted-foreground animate-pulse">' + t('codexlens.installingDeps') + '</div>';

  try {
    var response = await csrfFetch('/api/codexlens/semantic/install', { method: 'POST' });
    var result = await response.json();

    if (result.success) {
      showRefreshToast(t('codexlens.depsInstalled'), 'success');
      await loadSemanticDepsStatus();
      await loadModelList();
    } else {
      showRefreshToast(t('codexlens.depsInstallFailed') + ': ' + result.error, 'error');
      await loadSemanticDepsStatus();
    }
  } catch (err) {
    showRefreshToast(t('common.error') + ': ' + err.message, 'error');
    await loadSemanticDepsStatus();
  }
}

// Load model list
async function loadModelList() {
  var container = document.getElementById('modelListContainer');
  if (!container) return;

  try {
    var response = await fetch('/api/codexlens/models');
    var result = await response.json();

    if (!result.success || !result.result || !result.result.models) {
      container.innerHTML =
        '<div class="text-sm text-muted-foreground">' + t('codexlens.semanticNotInstalled') + '</div>';
      return;
    }

    var models = result.result.models;
    var html = '<div class="space-y-2">';

    models.forEach(function(model) {
      var statusIcon = model.installed
        ? '<i data-lucide="check-circle" class="w-4 h-4 text-success"></i>'
        : '<i data-lucide="circle" class="w-4 h-4 text-muted"></i>';

      var sizeText = model.installed
        ? model.actual_size_mb.toFixed(1) + ' MB'
        : '~' + model.estimated_size_mb + ' MB';

      var actionBtn = model.installed
        ? '<button class="btn-sm btn-outline btn-danger" onclick="deleteModel(\'' + model.profile + '\')">' +
            '<i data-lucide="trash-2" class="w-3 h-3"></i> ' + t('codexlens.deleteModel') +
          '</button>'
        : '<button class="btn-sm btn-outline" onclick="downloadModel(\'' + model.profile + '\')">' +
            '<i data-lucide="download" class="w-3 h-3"></i> ' + t('codexlens.downloadModel') +
          '</button>';

      html +=
        '<div class="border rounded-lg p-3 space-y-2" id="model-' + model.profile + '">' +
          '<div class="flex items-start justify-between">' +
            '<div class="flex-1">' +
              '<div class="flex items-center gap-2 mb-1">' +
                statusIcon +
                '<span class="font-medium">' + model.profile + '</span>' +
                '<span class="text-xs text-muted-foreground">(' + model.dimensions + ' dims)</span>' +
              '</div>' +
              '<div class="text-xs text-muted-foreground mb-1">' + model.model_name + '</div>' +
              '<div class="text-xs text-muted-foreground">' + model.use_case + '</div>' +
            '</div>' +
            '<div class="text-right">' +
              '<div class="text-xs text-muted-foreground mb-2">' + sizeText + '</div>' +
              actionBtn +
            '</div>' +
          '</div>' +
        '</div>';
    });

    html += '</div>';
    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    container.innerHTML =
      '<div class="text-sm text-error">' + t('common.error') + ': ' + err.message + '</div>';
  }
}

// Download model
async function downloadModel(profile) {
  var modelCard = document.getElementById('model-' + profile);
  if (!modelCard) return;

  var originalHTML = modelCard.innerHTML;
  modelCard.innerHTML =
    '<div class="flex items-center justify-center p-3">' +
      '<span class="text-sm text-muted-foreground animate-pulse">' + t('codexlens.downloading') + '</span>' +
    '</div>';

  try {
    var response = await fetch('/api/codexlens/models/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: profile })
    });

    var result = await response.json();

    if (result.success) {
      showRefreshToast(t('codexlens.modelDownloaded') + ': ' + profile, 'success');
      await loadModelList();
    } else {
      showRefreshToast(t('codexlens.modelDownloadFailed') + ': ' + result.error, 'error');
      modelCard.innerHTML = originalHTML;
      if (window.lucide) lucide.createIcons();
    }
  } catch (err) {
    showRefreshToast(t('common.error') + ': ' + err.message, 'error');
    modelCard.innerHTML = originalHTML;
    if (window.lucide) lucide.createIcons();
  }
}

// Delete model
async function deleteModel(profile) {
  if (!confirm(t('codexlens.deleteModelConfirm') + ' ' + profile + '?')) {
    return;
  }

  var modelCard = document.getElementById('model-' + profile);
  if (!modelCard) return;

  var originalHTML = modelCard.innerHTML;
  modelCard.innerHTML =
    '<div class="flex items-center justify-center p-3">' +
      '<span class="text-sm text-muted-foreground animate-pulse">' + t('codexlens.deleting') + '</span>' +
    '</div>';

  try {
    var response = await fetch('/api/codexlens/models/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: profile })
    });

    var result = await response.json();

    if (result.success) {
      showRefreshToast(t('codexlens.modelDeleted') + ': ' + profile, 'success');
      await loadModelList();
    } else {
      showRefreshToast(t('codexlens.modelDeleteFailed') + ': ' + result.error, 'error');
      modelCard.innerHTML = originalHTML;
      if (window.lucide) lucide.createIcons();
    }
  } catch (err) {
    showRefreshToast(t('common.error') + ': ' + err.message, 'error');
    modelCard.innerHTML = originalHTML;
    if (window.lucide) lucide.createIcons();
  }
}
/**
 * Clean current workspace index
 */
async function cleanCurrentWorkspaceIndex() {
  if (!confirm(t('codexlens.cleanCurrentWorkspaceConfirm'))) {
    return;
  }

  try {
    showRefreshToast(t('codexlens.cleaning'), 'info');

    // Get current workspace path (projectPath is a global variable from state.js)
    var workspacePath = projectPath;

    var response = await fetch('/api/codexlens/clean', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: workspacePath })
    });

    var result = await response.json();

    if (result.success) {
      showRefreshToast(t('codexlens.cleanCurrentWorkspaceSuccess'), 'success');

      // Refresh status
      if (typeof loadCodexLensStatus === 'function') {
        await loadCodexLensStatus();
        renderToolsSection();
        if (window.lucide) lucide.createIcons();
      }
    } else {
      showRefreshToast(t('codexlens.cleanFailed') + ': ' + result.error, 'error');
    }
  } catch (err) {
    showRefreshToast(t('common.error') + ': ' + err.message, 'error');
  }
}

/**
 * Clean all CodexLens indexes
 */
async function cleanCodexLensIndexes() {
  if (!confirm(t('codexlens.cleanConfirm'))) {
    return;
  }

  try {
    showRefreshToast(t('codexlens.cleaning'), 'info');

    var response = await fetch('/api/codexlens/clean', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true })
    });

    var result = await response.json();

    if (result.success) {
      showRefreshToast(t('codexlens.cleanSuccess'), 'success');

      // Refresh status
      if (typeof loadCodexLensStatus === 'function') {
        await loadCodexLensStatus();
        renderToolsSection();
        if (window.lucide) lucide.createIcons();
      }
    } else {
      showRefreshToast(t('codexlens.cleanFailed') + ': ' + result.error, 'error');
    }
  } catch (err) {
    showRefreshToast(t('common.error') + ': ' + err.message, 'error');
  }
}
