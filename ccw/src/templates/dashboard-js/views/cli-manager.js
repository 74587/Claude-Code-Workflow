// CLI Manager View
// Main view combining CLI status and CCW installations panels (two-column layout)

// ========== CLI Manager State ==========
var currentCliExecution = null;
var cliExecutionOutput = '';
var ccwInstallations = [];
var ccwEndpointTools = [];

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

// ========== Rendering ==========
async function renderCliManager() {
  var container = document.getElementById('mainContent');
  if (!container) return;

  // Hide stats grid and search for CLI view
  var statsGrid = document.getElementById('statsGrid');
  var searchInput = document.getElementById('searchInput');
  if (statsGrid) statsGrid.style.display = 'none';
  if (searchInput) searchInput.parentElement.style.display = 'none';

  // Load data (including CodexLens status for tools section)
  await Promise.all([
    loadCliToolStatus(),
    loadCodexLensStatus(),
    loadCcwInstallations(),
    loadCcwEndpointTools()
  ]);

  container.innerHTML = '<div class="status-manager">' +
    '<div class="status-two-column">' +
    '<div class="cli-section" id="tools-section"></div>' +
    '<div class="cli-section" id="ccw-section"></div>' +
    '</div>' +
    '<div class="cli-settings-section" id="cli-settings-section" style="margin-top: 1.5rem;"></div>' +
    '<div class="cli-section" id="ccw-endpoint-tools-section" style="margin-top: 1.5rem;"></div>' +
    '</div>';

  // Render sub-panels
  renderToolsSection();
  renderCcwSection();
  renderCliSettingsSection();
  renderCcwEndpointToolsSection();

  // Initialize Lucide icons
  if (window.lucide) lucide.createIcons();
}

// ========== Tools Section (Left Column) ==========
function renderToolsSection() {
  var container = document.getElementById('tools-section');
  if (!container) return;

  var toolDescriptions = {
    gemini: t('cli.geminiDesc'),
    qwen: t('cli.qwenDesc'),
    codex: t('cli.codexDesc')
  };

  var tools = ['gemini', 'qwen', 'codex'];
  var available = Object.values(cliToolStatus).filter(function(t) { return t.available; }).length;

  var toolsHtml = tools.map(function(tool) {
    var status = cliToolStatus[tool] || {};
    var isAvailable = status.available;
    var isDefault = defaultCliTool === tool;

    return '<div class="tool-item ' + (isAvailable ? 'available' : 'unavailable') + '">' +
      '<div class="tool-item-left">' +
        '<span class="tool-status-dot ' + (isAvailable ? 'status-available' : 'status-unavailable') + '"></span>' +
        '<div class="tool-item-info">' +
          '<div class="tool-item-name">' + tool.charAt(0).toUpperCase() + tool.slice(1) +
            (isDefault ? '<span class="tool-default-badge">' + t('cli.default') + '</span>' : '') +
          '</div>' +
          '<div class="tool-item-desc">' + toolDescriptions[tool] + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="tool-item-right">' +
        (isAvailable
          ? '<span class="tool-status-text success"><i data-lucide="check-circle" class="w-3.5 h-3.5"></i> ' + t('cli.ready') + '</span>'
          : '<span class="tool-status-text muted"><i data-lucide="circle-dashed" class="w-3.5 h-3.5"></i> ' + t('cli.notInstalled') + '</span>') +
        (isAvailable && !isDefault
          ? '<button class="btn-sm btn-outline" onclick="setDefaultCliTool(\'' + tool + '\')"><i data-lucide="star" class="w-3 h-3"></i> ' + t('cli.setDefault') + '</button>'
          : '') +
      '</div>' +
    '</div>';
  }).join('');

  // CodexLens item
  var codexLensHtml = '<div class="tool-item ' + (codexLensStatus.ready ? 'available' : 'unavailable') + '">' +
    '<div class="tool-item-left">' +
      '<span class="tool-status-dot ' + (codexLensStatus.ready ? 'status-available' : 'status-unavailable') + '"></span>' +
      '<div class="tool-item-info">' +
        '<div class="tool-item-name">CodexLens <span class="tool-type-badge">Index</span></div>' +
        '<div class="tool-item-desc">' + (codexLensStatus.ready ? t('cli.codexLensDesc') : t('cli.codexLensDescFull')) + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="tool-item-right">' +
      (codexLensStatus.ready
        ? '<span class="tool-status-text success"><i data-lucide="check-circle" class="w-3.5 h-3.5"></i> v' + (codexLensStatus.version || 'installed') + '</span>' +
          '<button class="btn-sm btn-outline" onclick="initCodexLensIndex()"><i data-lucide="database" class="w-3 h-3"></i> ' + t('cli.initIndex') + '</button>'
        : '<span class="tool-status-text muted"><i data-lucide="circle-dashed" class="w-3.5 h-3.5"></i> ' + t('cli.notInstalled') + '</span>' +
          '<button class="btn-sm btn-primary" onclick="installCodexLens()"><i data-lucide="download" class="w-3 h-3"></i> ' + t('cli.install') + '</button>') +
    '</div>' +
  '</div>';

  // Semantic Search item (only show if CodexLens is installed)
  var semanticHtml = '';
  if (codexLensStatus.ready) {
    semanticHtml = '<div class="tool-item ' + (semanticStatus.available ? 'available' : 'unavailable') + '">' +
      '<div class="tool-item-left">' +
        '<span class="tool-status-dot ' + (semanticStatus.available ? 'status-available' : 'status-unavailable') + '"></span>' +
        '<div class="tool-item-info">' +
          '<div class="tool-item-name">Semantic Search <span class="tool-type-badge ai">AI</span></div>' +
          '<div class="tool-item-desc">' + (semanticStatus.available ? 'AI-powered code understanding' : 'Natural language code search') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="tool-item-right">' +
        (semanticStatus.available
          ? '<span class="tool-status-text success"><i data-lucide="sparkles" class="w-3.5 h-3.5"></i> ' + (semanticStatus.backend || 'Ready') + '</span>'
          : '<span class="tool-status-text muted"><i data-lucide="circle-dashed" class="w-3.5 h-3.5"></i> Not Installed</span>' +
            '<button class="btn-sm btn-primary" onclick="openSemanticInstallWizard()"><i data-lucide="brain" class="w-3 h-3"></i> Install</button>') +
      '</div>' +
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
      codexLensHtml +
      semanticHtml +
    '</div>';

  if (window.lucide) lucide.createIcons();
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
