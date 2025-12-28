// CodexLens Manager - Configuration, Model Management, and Semantic Dependencies
// Extracted from cli-manager.js for better maintainability

// ============================================================
// CODEXLENS CONFIGURATION MODAL
// ============================================================

/**
 * Show CodexLens configuration modal
 */
async function showCodexLensConfigModal() {
  try {
    showRefreshToast(t('codexlens.loadingConfig'), 'info');

    // Fetch current config
    const response = await fetch('/api/codexlens/config');
    const config = await response.json();

    const modalHtml = buildCodexLensConfigContent(config);

    // Create and show modal
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = modalHtml;
    const modal = tempContainer.firstElementChild;
    document.body.appendChild(modal);

    // Initialize icons
    if (window.lucide) lucide.createIcons();

    // Initialize event handlers
    initCodexLensConfigEvents(config);
  } catch (err) {
    showRefreshToast(t('common.error') + ': ' + err.message, 'error');
  }
}

/**
 * Build CodexLens configuration modal content
 */
function buildCodexLensConfigContent(config) {
  const indexDir = config.index_dir || '~/.codexlens/indexes';
  const indexCount = config.index_count || 0;
  const isInstalled = window.cliToolsStatus?.codexlens?.installed || false;

  return '<div class="modal-backdrop" id="codexlensConfigModal">' +
    '<div class="modal-container">' +
    '<div class="modal-header">' +
      '<div class="flex items-center gap-3">' +
        '<div class="modal-icon">' +
          '<i data-lucide="database" class="w-5 h-5"></i>' +
        '</div>' +
        '<div>' +
          '<h2 class="text-lg font-bold">' + t('codexlens.config') + '</h2>' +
          '<p class="text-xs text-muted-foreground">' + t('codexlens.whereIndexesStored') + '</p>' +
        '</div>' +
      '</div>' +
      '<button onclick="closeModal()" class="text-muted-foreground hover:text-foreground">' +
        '<i data-lucide="x" class="w-5 h-5"></i>' +
      '</button>' +
    '</div>' +

    '<div class="modal-body">' +
      // Status Section
      '<div class="tool-config-section">' +
        '<h4>' + t('codexlens.status') + '</h4>' +
        '<div class="flex items-center gap-4 text-sm">' +
          '<div class="flex items-center gap-2">' +
            '<span class="text-muted-foreground">' + t('codexlens.currentWorkspace') + ':</span>' +
            (isInstalled
              ? '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20">' +
                  '<i data-lucide="check-circle" class="w-3.5 h-3.5"></i>' +
                  t('codexlens.installed') +
                '</span>'
              : '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">' +
                  '<i data-lucide="circle" class="w-3.5 h-3.5"></i>' +
                  t('codexlens.notInstalled') +
                '</span>') +
          '</div>' +
          '<div class="flex items-center gap-2">' +
            '<span class="text-muted-foreground">' + t('codexlens.indexes') + ':</span>' +
            '<span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary border border-primary/20">' +
              indexCount +
            '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // Index Storage Path Section
      '<div class="tool-config-section">' +
        '<h4>' + t('codexlens.indexStoragePath') + '</h4>' +
        '<div class="space-y-3">' +
          '<div>' +
            '<label class="block text-sm font-medium mb-1.5">' + t('codexlens.currentPath') + '</label>' +
            '<div class="text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 font-mono">' +
              indexDir +
            '</div>' +
          '</div>' +
          '<div>' +
            '<label class="block text-sm font-medium mb-1.5">' + t('codexlens.newStoragePath') + '</label>' +
            '<input type="text" id="indexDirInput" value="' + indexDir + '" ' +
                   'placeholder="' + t('codexlens.pathPlaceholder') + '" ' +
                   'class="tool-config-input w-full" />' +
            '<p class="text-xs text-muted-foreground mt-1">' + t('codexlens.pathInfo') + '</p>' +
          '</div>' +
          '<div class="flex items-start gap-2 bg-warning/10 border border-warning/30 rounded-lg p-3">' +
            '<i data-lucide="alert-triangle" class="w-4 h-4 text-warning mt-0.5"></i>' +
            '<div class="text-sm">' +
              '<p class="font-medium text-warning">' + t('codexlens.migrationRequired') + '</p>' +
              '<p class="text-muted-foreground mt-1">' + t('codexlens.migrationWarning') + '</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // Actions Section
      '<div class="tool-config-section">' +
        '<h4>' + t('codexlens.actions') + '</h4>' +
        '<div class="tool-config-actions">' +
          (isInstalled
            ? '<button class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors" onclick="initCodexLensIndex()">' +
                '<i data-lucide="database" class="w-3.5 h-3.5"></i> ' + t('codexlens.initializeIndex') +
              '</button>' +
              '<button class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-background hover:bg-muted/50 transition-colors" onclick="cleanCurrentWorkspaceIndex()">' +
                '<i data-lucide="folder-x" class="w-3.5 h-3.5"></i> ' + t('codexlens.cleanCurrentWorkspace') +
              '</button>' +
              '<button class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-background hover:bg-muted/50 transition-colors" onclick="cleanCodexLensIndexes()">' +
                '<i data-lucide="trash" class="w-3.5 h-3.5"></i> ' + t('codexlens.cleanAllIndexes') +
              '</button>' +
              '<button class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10 transition-colors" onclick="uninstallCodexLensFromManager()">' +
                '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i> ' + t('cli.uninstall') +
              '</button>'
            : '<button class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors" onclick="installCodexLensFromManager()">' +
                '<i data-lucide="download" class="w-3.5 h-3.5"></i> ' + t('codexlens.installCodexLens') +
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
                '<div>' +
                  '<div class="flex items-center justify-between">' +
                    '<p class="text-sm font-medium">' + t('codexlens.results') + ':</p>' +
                    '<span id="searchResultCount" class="text-xs text-muted-foreground"></span>' +
                  '</div>' +
                  '<pre id="searchResultContent"></pre>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>'
        : '') +
    '</div>' +

    // Footer
    '<div class="tool-config-footer">' +
      '<button class="btn btn-outline" onclick="closeModal()">' + t('common.cancel') + '</button>' +
      '<button class="btn btn-primary" id="saveCodexLensConfigBtn">' +
        '<i data-lucide="save" class="w-3.5 h-3.5"></i> ' + t('codexlens.saveConfig') +
      '</button>' +
    '</div>' +
  '</div>';
}

/**
 * Initialize CodexLens config modal event handlers
 */
function initCodexLensConfigEvents(currentConfig) {
  // Save button
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
      var searchLimit = document.getElementById('searchLimitInput')?.value || '5';
      var contentLength = document.getElementById('contentLengthInput')?.value || '200';
      var extraFiles = document.getElementById('extraFilesInput')?.value || '10';
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
        var params = new URLSearchParams({
          query: query,
          limit: searchLimit,
          max_content_length: contentLength,
          extra_files_count: extraFiles
        });
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

// ============================================================
// SEMANTIC DEPENDENCIES MANAGEMENT
// ============================================================

// Store detected GPU info
var detectedGpuInfo = null;
// Store available GPU devices
var availableGpuDevices = null;

/**
 * Detect GPU support
 */
async function detectGpuSupport() {
  try {
    var response = await fetch('/api/codexlens/gpu/detect');
    var result = await response.json();
    if (result.success) {
      detectedGpuInfo = result;
      return result;
    }
  } catch (err) {
    console.error('GPU detection failed:', err);
  }
  return { mode: 'cpu', available: ['cpu'], info: 'CPU only' };
}

/**
 * Load semantic dependencies status
 */
async function loadSemanticDepsStatus() {
  var container = document.getElementById('semanticDepsStatus');
  if (!container) return;

  try {
    // Detect GPU support and load GPU devices in parallel
    var gpuPromise = detectGpuSupport();
    var gpuDevicesPromise = loadGpuDevices();
    var response = await fetch('/api/codexlens/semantic/status');
    var result = await response.json();
    var gpuInfo = await gpuPromise;
    var gpuDevices = await gpuDevicesPromise;

    if (result.available) {
      // Build accelerator badge
      var accelerator = result.accelerator || 'CPU';
      var acceleratorIcon = 'cpu';
      var acceleratorClass = 'bg-muted text-muted-foreground';

      if (accelerator === 'CUDA') {
        acceleratorIcon = 'zap';
        acceleratorClass = 'bg-green-500/20 text-green-600';
      } else if (accelerator === 'DirectML') {
        acceleratorIcon = 'cpu';
        acceleratorClass = 'bg-blue-500/20 text-blue-600';
      } else if (accelerator === 'ROCm') {
        acceleratorIcon = 'flame';
        acceleratorClass = 'bg-red-500/20 text-red-600';
      }

      // Build GPU device selector if multiple GPUs available
      var gpuDeviceSelector = buildGpuDeviceSelector(gpuDevices);

      container.innerHTML =
        '<div class="space-y-2">' +
          '<div class="flex items-center gap-2 text-sm">' +
            '<i data-lucide="check-circle" class="w-4 h-4 text-success"></i>' +
            '<span>' + t('codexlens.semanticInstalled') + '</span>' +
            '<span class="text-muted-foreground">(' + (result.backend || 'fastembed') + ')</span>' +
          '</div>' +
          '<div class="flex items-center gap-2">' +
            '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ' + acceleratorClass + '">' +
              '<i data-lucide="' + acceleratorIcon + '" class="w-3 h-3"></i>' +
              accelerator +
            '</span>' +
            (result.providers && result.providers.length > 0
              ? '<span class="text-xs text-muted-foreground">' + result.providers.join(', ') + '</span>'
              : '') +
          '</div>' +
          gpuDeviceSelector +
        '</div>';
    } else {
      // Build GPU mode options
      var gpuOptions = buildGpuModeSelector(gpuInfo);

      container.innerHTML =
        '<div class="space-y-3">' +
          '<div class="flex items-center gap-2 text-sm text-muted-foreground">' +
            '<i data-lucide="alert-circle" class="w-4 h-4"></i>' +
            '<span>' + t('codexlens.semanticNotInstalled') + '</span>' +
          '</div>' +
          gpuOptions +
          '<button class="btn-sm btn-primary w-full" onclick="installSemanticDepsWithGpu()">' +
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

/**
 * Build GPU mode selector HTML
 */
function buildGpuModeSelector(gpuInfo) {
  // Check if DirectML is unavailable due to Python environment
  var directmlUnavailableReason = null;
  if (!gpuInfo.available.includes('directml') && gpuInfo.pythonEnv && gpuInfo.pythonEnv.error) {
    directmlUnavailableReason = gpuInfo.pythonEnv.error;
  }

  var modes = [
    {
      id: 'cpu',
      label: 'CPU',
      desc: t('codexlens.cpuModeDesc') || 'Standard CPU processing',
      icon: 'cpu',
      available: true
    },
    {
      id: 'directml',
      label: 'DirectML',
      desc: directmlUnavailableReason
        ? directmlUnavailableReason
        : (t('codexlens.directmlModeDesc') || 'Windows GPU (NVIDIA/AMD/Intel)'),
      icon: 'cpu',
      available: gpuInfo.available.includes('directml'),
      recommended: gpuInfo.mode === 'directml',
      warning: directmlUnavailableReason
    },
    {
      id: 'cuda',
      label: 'CUDA',
      desc: t('codexlens.cudaModeDesc') || 'NVIDIA GPU (requires CUDA Toolkit)',
      icon: 'zap',
      available: gpuInfo.available.includes('cuda'),
      recommended: gpuInfo.mode === 'cuda'
    }
  ];

  var html =
    '<div class="space-y-2">' +
      '<div class="text-xs font-medium text-muted-foreground flex items-center gap-1">' +
        '<i data-lucide="settings" class="w-3 h-3"></i>' +
        (t('codexlens.selectGpuMode') || 'Select acceleration mode') +
      '</div>' +
      '<div class="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">' +
        '<i data-lucide="info" class="w-3 h-3 inline"></i> ' + gpuInfo.info +
      '</div>' +
      '<div class="space-y-1">';

  modes.forEach(function(mode) {
    var isDisabled = !mode.available;
    var isRecommended = mode.recommended;
    var isDefault = mode.id === gpuInfo.mode;
    var hasWarning = mode.warning;

    html +=
      '<label class="flex items-center gap-3 p-2 rounded border cursor-pointer hover:bg-muted/50 transition-colors ' +
        (isDisabled ? 'opacity-50 cursor-not-allowed' : '') + '">' +
        '<input type="radio" name="gpuMode" value="' + mode.id + '" ' +
          (isDefault ? 'checked' : '') +
          (isDisabled ? ' disabled' : '') +
          ' class="accent-primary">' +
        '<div class="flex-1">' +
          '<div class="flex items-center gap-2">' +
            '<i data-lucide="' + mode.icon + '" class="w-4 h-4"></i>' +
            '<span class="font-medium text-sm">' + mode.label + '</span>' +
            (isRecommended ? '<span class="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">' + (t('common.recommended') || 'Recommended') + '</span>' : '') +
            (isDisabled ? '<span class="text-xs text-muted-foreground">(' + (t('common.unavailable') || 'Unavailable') + ')</span>' : '') +
          '</div>' +
          '<div class="text-xs ' + (hasWarning ? 'text-warning' : 'text-muted-foreground') + '">' + mode.desc + '</div>' +
        '</div>' +
      '</label>';
  });

  html +=
      '</div>' +
    '</div>';

  return html;
}

/**
 * Get selected GPU mode
 */
function getSelectedGpuMode() {
  var selected = document.querySelector('input[name="gpuMode"]:checked');
  return selected ? selected.value : 'cpu';
}

/**
 * Load available GPU devices
 */
async function loadGpuDevices() {
  try {
    var response = await fetch('/api/codexlens/gpu/list');
    var result = await response.json();
    if (result.success && result.result) {
      availableGpuDevices = result.result;
      return result.result;
    }
  } catch (err) {
    console.error('GPU devices load failed:', err);
  }
  return { devices: [], selected_device_id: null };
}

/**
 * Build GPU device selector HTML
 */
function buildGpuDeviceSelector(gpuDevices) {
  if (!gpuDevices || !gpuDevices.devices || gpuDevices.devices.length === 0) {
    return '';
  }

  // Only show selector if there are multiple GPUs
  if (gpuDevices.devices.length < 2) {
    return '';
  }

  var html =
    '<div class="mt-3 p-3 bg-muted/30 rounded-lg border border-border">' +
      '<div class="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-2">' +
        '<i data-lucide="cpu" class="w-3 h-3"></i>' +
        (t('codexlens.selectGpuDevice') || 'Select GPU Device') +
      '</div>' +
      '<div class="space-y-1">';

  gpuDevices.devices.forEach(function(device) {
    var isSelected = device.is_selected;
    var vendorIcon = device.vendor === 'nvidia' ? 'zap' : (device.vendor === 'amd' ? 'flame' : 'cpu');
    var vendorColor = device.vendor === 'nvidia' ? 'text-green-500' : (device.vendor === 'amd' ? 'text-red-500' : 'text-blue-500');
    var typeLabel = device.is_discrete ? (t('codexlens.discrete') || 'Discrete') : (t('codexlens.integrated') || 'Integrated');

    html +=
      '<label class="flex items-center gap-3 p-2 rounded border cursor-pointer hover:bg-muted/50 transition-colors ' +
        (isSelected ? 'border-primary bg-primary/5' : 'border-transparent') + '">' +
        '<input type="radio" name="gpuDevice" value="' + device.device_id + '" ' +
          (isSelected ? 'checked' : '') +
          ' class="accent-primary" onchange="selectGpuDevice(' + device.device_id + ')">' +
        '<div class="flex-1">' +
          '<div class="flex items-center gap-2">' +
            '<i data-lucide="' + vendorIcon + '" class="w-4 h-4 ' + vendorColor + '"></i>' +
            '<span class="font-medium text-sm">' + device.name + '</span>' +
          '</div>' +
          '<div class="flex items-center gap-2 mt-0.5">' +
            '<span class="text-xs text-muted-foreground">' + device.vendor.toUpperCase() + '</span>' +
            '<span class="text-xs px-1.5 py-0.5 rounded ' +
              (device.is_discrete ? 'bg-green-500/20 text-green-600' : 'bg-muted text-muted-foreground') + '">' +
              typeLabel +
            '</span>' +
            (device.is_preferred ? '<span class="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">' + (t('common.auto') || 'Auto') + '</span>' : '') +
          '</div>' +
        '</div>' +
      '</label>';
  });

  html +=
      '</div>' +
      '<button class="btn-xs text-muted-foreground hover:text-foreground mt-2" onclick="resetGpuDevice()">' +
        '<i data-lucide="rotate-ccw" class="w-3 h-3"></i> ' + (t('codexlens.resetToAuto') || 'Reset to Auto') +
      '</button>' +
    '</div>';

  return html;
}

/**
 * Select a GPU device
 */
async function selectGpuDevice(deviceId) {
  try {
    showRefreshToast(t('codexlens.selectingGpu') || 'Selecting GPU...', 'info');

    var response = await fetch('/api/codexlens/gpu/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId })
    });

    var result = await response.json();
    if (result.success) {
      showRefreshToast(t('codexlens.gpuSelected') || 'GPU selected', 'success');
      // Reload semantic status to reflect change
      loadSemanticDepsStatus();
    } else {
      showRefreshToast(result.error || 'Failed to select GPU', 'error');
    }
  } catch (err) {
    showRefreshToast(err.message, 'error');
  }
}

/**
 * Reset GPU device selection to auto
 */
async function resetGpuDevice() {
  try {
    showRefreshToast(t('codexlens.resettingGpu') || 'Resetting GPU selection...', 'info');

    var response = await fetch('/api/codexlens/gpu/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    var result = await response.json();
    if (result.success) {
      showRefreshToast(t('codexlens.gpuReset') || 'GPU selection reset to auto', 'success');
      // Reload semantic status to reflect change
      loadSemanticDepsStatus();
    } else {
      showRefreshToast(result.error || 'Failed to reset GPU', 'error');
    }
  } catch (err) {
    showRefreshToast(err.message, 'error');
  }
}

/**
 * Install semantic dependencies with GPU mode
 */
async function installSemanticDepsWithGpu() {
  var container = document.getElementById('semanticDepsStatus');
  if (!container) return;

  var gpuMode = getSelectedGpuMode();
  var modeLabels = {
    cpu: 'CPU',
    cuda: 'NVIDIA CUDA',
    directml: 'DirectML'
  };

  container.innerHTML =
    '<div class="space-y-2">' +
      '<div class="flex items-center gap-2 text-sm text-muted-foreground">' +
        '<div class="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></div>' +
        '<span>' + t('codexlens.installingDeps') + '</span>' +
      '</div>' +
      '<div class="text-xs text-muted-foreground">' +
        (t('codexlens.installingMode') || 'Installing with') + ': ' + modeLabels[gpuMode] +
      '</div>' +
    '</div>';

  try {
    var response = await fetch('/api/codexlens/semantic/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gpuMode: gpuMode })
    });
    var result = await response.json();

    if (result.success) {
      showRefreshToast(t('codexlens.depsInstalled') + ' (' + modeLabels[gpuMode] + ')', 'success');
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

/**
 * Install semantic dependencies (legacy, defaults to CPU)
 */
async function installSemanticDeps() {
  await installSemanticDepsWithGpu();
}

// ============================================================
// MODEL MANAGEMENT
// ============================================================

/**
 * Build manual download guide HTML
 */
function buildManualDownloadGuide() {
  var modelData = [
    { profile: 'code', name: 'jinaai/jina-embeddings-v2-base-code', size: '~150 MB' },
    { profile: 'fast', name: 'BAAI/bge-small-en-v1.5', size: '~80 MB' }
  ];

  var html =
    '<div class="mt-4 border-t pt-4">' +
      '<button class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full" onclick="toggleManualDownloadGuide()" id="manualDownloadToggle">' +
        '<i data-lucide="chevron-right" class="w-4 h-4 transition-transform" id="manualDownloadChevron"></i>' +
        '<i data-lucide="terminal" class="w-4 h-4"></i>' +
        '<span>' + (t('codexlens.manualDownloadGuide') || 'Manual Download Guide') + '</span>' +
      '</button>' +
      '<div id="manualDownloadContent" class="hidden mt-3 space-y-3">' +
        // Method 1: CLI
        '<div class="bg-muted/50 rounded-lg p-3 space-y-2">' +
          '<div class="flex items-center gap-2 text-sm font-medium">' +
            '<span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-xs">1</span>' +
            '<span>' + (t('codexlens.cliMethod') || 'Command Line (Recommended)') + '</span>' +
          '</div>' +
          '<div class="text-xs text-muted-foreground mb-2">' +
            (t('codexlens.cliMethodDesc') || 'Run in terminal with progress display:') +
          '</div>' +
          '<div class="space-y-1">';

  modelData.forEach(function(m) {
    html +=
          '<div class="flex items-center justify-between bg-background rounded px-2 py-1.5">' +
            '<code class="text-xs font-mono">codexlens model-download ' + m.profile + '</code>' +
            '<button class="text-xs text-primary hover:underline" onclick="copyToClipboard(\'codexlens model-download ' + m.profile + '\')">' +
              '<i data-lucide="copy" class="w-3 h-3"></i>' +
            '</button>' +
          '</div>';
  });

  html +=
          '</div>' +
        '</div>' +

        // Method 2: Python
        '<div class="bg-muted/50 rounded-lg p-3 space-y-2">' +
          '<div class="flex items-center gap-2 text-sm font-medium">' +
            '<span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-xs">2</span>' +
            '<span>' + (t('codexlens.pythonMethod') || 'Python Script') + '</span>' +
          '</div>' +
          '<div class="text-xs text-muted-foreground mb-2">' +
            (t('codexlens.pythonMethodDesc') || 'Pre-download model using Python:') +
          '</div>' +
          '<div class="bg-background rounded p-2">' +
            '<pre class="text-xs font-mono whitespace-pre-wrap">' +
'# Install fastembed first\n' +
'pip install fastembed\n\n' +
'# Download model (choose one)\n' +
'from fastembed import TextEmbedding\n\n' +
'# Code model (recommended for code search)\n' +
'model = TextEmbedding("jinaai/jina-embeddings-v2-base-code")\n\n' +
'# Fast model (lightweight)\n' +
'# model = TextEmbedding("BAAI/bge-small-en-v1.5")' +
            '</pre>' +
          '</div>' +
        '</div>' +

        // Method 3: Hugging Face Hub
        '<div class="bg-muted/50 rounded-lg p-3 space-y-2">' +
          '<div class="flex items-center gap-2 text-sm font-medium">' +
            '<span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-xs">3</span>' +
            '<span>' + (t('codexlens.hfHubMethod') || 'Hugging Face Hub CLI') + '</span>' +
          '</div>' +
          '<div class="text-xs text-muted-foreground mb-2">' +
            (t('codexlens.hfHubMethodDesc') || 'Download using huggingface-cli with resume support:') +
          '</div>' +
          '<div class="bg-background rounded p-2 space-y-2">' +
            '<pre class="text-xs font-mono whitespace-pre-wrap">' +
'# Install huggingface_hub\n' +
'pip install huggingface_hub\n\n' +
'# Download model (supports resume on failure)\n' +
'huggingface-cli download jinaai/jina-embeddings-v2-base-code' +
            '</pre>' +
          '</div>' +
        '</div>' +

        // Model Links
        '<div class="bg-muted/50 rounded-lg p-3 space-y-2">' +
          '<div class="flex items-center gap-2 text-sm font-medium">' +
            '<i data-lucide="external-link" class="w-4 h-4"></i>' +
            '<span>' + (t('codexlens.modelLinks') || 'Direct Model Links') + '</span>' +
          '</div>' +
          '<div class="grid grid-cols-2 gap-2">';

  modelData.forEach(function(m) {
    html +=
            '<a href="https://huggingface.co/' + m.name + '" target="_blank" class="flex items-center justify-between bg-background rounded px-2 py-1.5 hover:bg-muted transition-colors">' +
              '<span class="text-xs font-medium">' + m.profile + '</span>' +
              '<span class="text-xs text-muted-foreground">' + m.size + '</span>' +
            '</a>';
  });

  html +=
          '</div>' +
        '</div>' +

        // Cache location info
        '<div class="text-xs text-muted-foreground bg-muted/30 rounded p-2">' +
          '<div class="flex items-start gap-1.5">' +
            '<i data-lucide="info" class="w-3.5 h-3.5 mt-0.5 flex-shrink-0"></i>' +
            '<div>' +
              '<strong>' + (t('codexlens.cacheLocation') || 'Cache Location') + ':</strong><br>' +
              '<code class="text-xs">Default: ~/.cache/huggingface</code><br>' +
              '<code class="text-xs text-muted-foreground">(Check HF_HOME env var if set)</code>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  return html;
}

/**
 * Toggle manual download guide visibility
 */
function toggleManualDownloadGuide() {
  var content = document.getElementById('manualDownloadContent');
  var chevron = document.getElementById('manualDownloadChevron');

  if (content && chevron) {
    content.classList.toggle('hidden');
    chevron.style.transform = content.classList.contains('hidden') ? '' : 'rotate(90deg)';
  }
}

/**
 * Copy text to clipboard
 */
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(function() {
    showRefreshToast(t('common.copied') || 'Copied to clipboard', 'success');
  }).catch(function(err) {
    console.error('Failed to copy:', err);
  });
}

/**
 * Load model list
 */
async function loadModelList() {
  var container = document.getElementById('modelListContainer');
  if (!container) return;

  try {
    var response = await fetch('/api/codexlens/models');
    var result = await response.json();

    if (!result.success) {
      // Check if the error is specifically about fastembed not being installed
      var errorMsg = result.error || '';
      if (errorMsg.includes('fastembed not installed') || errorMsg.includes('Semantic')) {
        container.innerHTML =
          '<div class="text-sm text-muted-foreground">' + t('codexlens.semanticNotInstalled') + '</div>';
      } else {
        // Show actual error message for other failures
        container.innerHTML =
          '<div class="text-sm text-error">' + t('codexlens.modelListError') + ': ' + (errorMsg || t('common.unknownError')) + '</div>';
      }
      return;
    }

    if (!result.result || !result.result.models) {
      container.innerHTML =
        '<div class="text-sm text-muted-foreground">' + t('codexlens.noModelsAvailable') + '</div>';
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

    // Add manual download guide section
    html += buildManualDownloadGuide();

    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    container.innerHTML =
      '<div class="text-sm text-error">' + t('common.error') + ': ' + err.message + '</div>';
  }
}

/**
 * Download model with progress simulation and manual download info
 */
async function downloadModel(profile) {
  var modelCard = document.getElementById('model-' + profile);
  if (!modelCard) return;

  var originalHTML = modelCard.innerHTML;

  // Get model info for size estimation
  var modelSizes = {
    'fast': { size: 80, time: '1-2' },
    'code': { size: 150, time: '2-5' }
  };

  var modelInfo = modelSizes[profile] || { size: 100, time: '2-5' };

  // Show detailed download UI with progress simulation
  modelCard.innerHTML =
    '<div class="p-3 space-y-3">' +
      '<div class="flex items-center gap-2">' +
        '<div class="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full flex-shrink-0"></div>' +
        '<span class="text-sm font-medium">' + (t('codexlens.downloadingModel') || 'Downloading') + ' ' + profile + '</span>' +
      '</div>' +
      '<div class="space-y-1">' +
        '<div class="h-2 bg-muted rounded-full overflow-hidden">' +
          '<div id="model-progress-' + profile + '" class="h-full bg-primary transition-all duration-1000 ease-out model-download-progress" style="width: 0%"></div>' +
        '</div>' +
        '<div class="flex justify-between text-xs text-muted-foreground">' +
          '<span id="model-status-' + profile + '">' + (t('codexlens.connectingToHuggingFace') || 'Connecting to Hugging Face...') + '</span>' +
          '<span>~' + modelInfo.size + ' MB</span>' +
        '</div>' +
      '</div>' +
      '<div class="text-xs text-muted-foreground bg-muted/50 rounded p-2 space-y-1">' +
        '<div class="flex items-start gap-1">' +
          '<i data-lucide="info" class="w-3 h-3 mt-0.5 flex-shrink-0"></i>' +
          '<span>' + (t('codexlens.downloadTimeEstimate') || 'Estimated time') + ': ' + modelInfo.time + ' ' + (t('common.minutes') || 'minutes') + '</span>' +
        '</div>' +
        '<div class="flex items-start gap-1">' +
          '<i data-lucide="terminal" class="w-3 h-3 mt-0.5 flex-shrink-0"></i>' +
          '<span>' + (t('codexlens.manualDownloadHint') || 'Manual download') + ': <code class="bg-background px-1 rounded">codexlens model-download ' + profile + '</code></span>' +
        '</div>' +
      '</div>' +
      '<button class="text-xs text-muted-foreground hover:text-foreground underline" onclick="cancelModelDownload(\'' + profile + '\')">' +
        (t('common.cancel') || 'Cancel') +
      '</button>' +
    '</div>';

  if (window.lucide) lucide.createIcons();

  // Start progress simulation
  var progressBar = document.getElementById('model-progress-' + profile);
  var statusText = document.getElementById('model-status-' + profile);
  var simulatedProgress = 0;
  var progressInterval = null;
  var downloadAborted = false;

  // Store abort controller for cancellation
  window['modelDownloadAbort_' + profile] = function() {
    downloadAborted = true;
    if (progressInterval) clearInterval(progressInterval);
  };

  // Simulate progress based on model size
  var progressStages = [
    { percent: 10, msg: t('codexlens.downloadingModelFiles') || 'Downloading model files...' },
    { percent: 30, msg: t('codexlens.downloadingWeights') || 'Downloading model weights...' },
    { percent: 60, msg: t('codexlens.downloadingTokenizer') || 'Downloading tokenizer...' },
    { percent: 80, msg: t('codexlens.verifyingModel') || 'Verifying model...' },
    { percent: 95, msg: t('codexlens.finalizingDownload') || 'Finalizing...' }
  ];

  var stageIndex = 0;
  var baseInterval = Math.max(2000, modelInfo.size * 30); // Slower for larger models

  progressInterval = setInterval(function() {
    if (downloadAborted) return;

    if (stageIndex < progressStages.length) {
      var stage = progressStages[stageIndex];
      simulatedProgress = stage.percent;
      if (progressBar) progressBar.style.width = simulatedProgress + '%';
      if (statusText) statusText.textContent = stage.msg;
      stageIndex++;
    }
  }, baseInterval);

  try {
    var response = await fetch('/api/codexlens/models/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: profile })
    });

    // Clear simulation
    if (progressInterval) clearInterval(progressInterval);

    if (downloadAborted) {
      modelCard.innerHTML = originalHTML;
      if (window.lucide) lucide.createIcons();
      return;
    }

    var result = await response.json();

    if (result.success) {
      // Show completion
      if (progressBar) progressBar.style.width = '100%';
      if (statusText) statusText.textContent = t('codexlens.downloadComplete') || 'Download complete!';

      showRefreshToast(t('codexlens.modelDownloaded') + ': ' + profile, 'success');

      // Refresh model list after short delay
      setTimeout(function() {
        loadModelList();
      }, 500);
    } else {
      showRefreshToast(t('codexlens.modelDownloadFailed') + ': ' + result.error, 'error');
      showModelDownloadError(modelCard, profile, result.error, originalHTML);
    }
  } catch (err) {
    if (progressInterval) clearInterval(progressInterval);
    showRefreshToast(t('common.error') + ': ' + err.message, 'error');
    showModelDownloadError(modelCard, profile, err.message, originalHTML);
  }

  // Cleanup abort function
  delete window['modelDownloadAbort_' + profile];
}

/**
 * Show model download error with manual download instructions
 */
function showModelDownloadError(modelCard, profile, error, originalHTML) {
  var modelNames = {
    'fast': 'BAAI/bge-small-en-v1.5',
    'code': 'jinaai/jina-embeddings-v2-base-code'
  };

  var modelName = modelNames[profile] || profile;
  var hfUrl = 'https://huggingface.co/' + modelName;

  modelCard.innerHTML =
    '<div class="p-3 space-y-3">' +
      '<div class="flex items-start gap-2 text-destructive">' +
        '<i data-lucide="alert-circle" class="w-4 h-4 mt-0.5 flex-shrink-0"></i>' +
        '<div class="text-sm">' +
          '<div class="font-medium">' + (t('codexlens.downloadFailed') || 'Download failed') + '</div>' +
          '<div class="text-xs text-muted-foreground mt-1">' + error + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="bg-muted/50 rounded p-2 space-y-2 text-xs">' +
        '<div class="font-medium">' + (t('codexlens.manualDownloadOptions') || 'Manual download options') + ':</div>' +
        '<div class="space-y-1.5">' +
          '<div class="flex items-start gap-1">' +
            '<span class="text-muted-foreground">1.</span>' +
            '<span>' + (t('codexlens.cliDownload') || 'CLI') + ': <code class="bg-background px-1 rounded">codexlens model-download ' + profile + '</code></span>' +
          '</div>' +
          '<div class="flex items-start gap-1">' +
            '<span class="text-muted-foreground">2.</span>' +
            '<span>' + (t('codexlens.huggingfaceDownload') || 'Hugging Face') + ': <a href="' + hfUrl + '" target="_blank" class="text-primary hover:underline">' + modelName + '</a></span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="flex gap-2">' +
        '<button class="btn-sm btn-outline flex-1" onclick="loadModelList()">' +
          '<i data-lucide="refresh-cw" class="w-3 h-3"></i> ' + (t('common.refresh') || 'Refresh') +
        '</button>' +
        '<button class="btn-sm btn-primary flex-1" onclick="downloadModel(\'' + profile + '\')">' +
          '<i data-lucide="download" class="w-3 h-3"></i> ' + (t('common.retry') || 'Retry') +
        '</button>' +
      '</div>' +
    '</div>';

  if (window.lucide) lucide.createIcons();
}

/**
 * Cancel model download
 */
function cancelModelDownload(profile) {
  if (window['modelDownloadAbort_' + profile]) {
    window['modelDownloadAbort_' + profile]();
    showRefreshToast(t('codexlens.downloadCanceled') || 'Download canceled', 'info');
    loadModelList();
  }
}

/**
 * Delete model
 */
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

// ============================================================
// CODEXLENS ACTIONS
// ============================================================

/**
 * Initialize CodexLens index with bottom floating progress bar
 * @param {string} indexType - 'vector' (with embeddings), 'normal' (FTS only), or 'full' (FTS + Vector)
 * @param {string} embeddingModel - Model profile: 'code', 'fast'
 * @param {string} embeddingBackend - Backend: 'fastembed' (local) or 'litellm' (API)
 * @param {number} maxWorkers - Max concurrent API calls for embedding generation (default: 1)
 */
async function initCodexLensIndex(indexType, embeddingModel, embeddingBackend, maxWorkers) {
  indexType = indexType || 'vector';
  embeddingModel = embeddingModel || 'code';
  embeddingBackend = embeddingBackend || 'fastembed';
  maxWorkers = maxWorkers || 1;

  // For vector/full index with local backend, check if semantic dependencies are available
  // LiteLLM backend uses remote embeddings and does not require fastembed/ONNX deps.
  if ((indexType === 'vector' || indexType === 'full') && embeddingBackend !== 'litellm') {
    try {
      var semanticResponse = await fetch('/api/codexlens/semantic/status');
      var semanticStatus = await semanticResponse.json();

      if (!semanticStatus.available) {
        // Semantic deps not installed - show confirmation dialog
        var installDeps = confirm(
          (t('codexlens.semanticNotInstalled') || 'Semantic search dependencies are not installed.') + '\n\n' +
          (t('codexlens.installDepsPrompt') || 'Would you like to install them now? (This may take a few minutes)\n\nClick "Cancel" to create FTS index only.')
        );

        if (installDeps) {
          // Install semantic dependencies first
          showRefreshToast(t('codexlens.installingDeps') || 'Installing semantic dependencies...', 'info');
          try {
            var installResponse = await fetch('/api/codexlens/semantic/install', { method: 'POST' });
            var installResult = await installResponse.json();

            if (!installResult.success) {
              showRefreshToast((t('codexlens.depsInstallFailed') || 'Failed to install dependencies') + ': ' + installResult.error, 'error');
              // Fall back to FTS only
              indexType = 'normal';
            } else {
              showRefreshToast(t('codexlens.depsInstalled') || 'Dependencies installed successfully', 'success');
            }
          } catch (err) {
            showRefreshToast((t('common.error') || 'Error') + ': ' + err.message, 'error');
            indexType = 'normal';
          }
        } else {
          // User chose to skip - create FTS only
          indexType = 'normal';
        }
      }
    } catch (err) {
      console.warn('[CodexLens] Could not check semantic status:', err);
      // Continue with requested type, backend will handle fallback
    }
  }

  // Remove existing progress bar if any
  closeCodexLensIndexModal();

  // Create bottom floating progress bar
  var progressBar = document.createElement('div');
  progressBar.id = 'codexlensIndexFloating';
  progressBar.className = 'fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-lg transform transition-transform duration-300';

  // Determine display label
  var indexTypeLabel;
  if (indexType === 'full') {
    indexTypeLabel = 'FTS + Vector';
  } else if (indexType === 'vector') {
    indexTypeLabel = 'Vector';
  } else {
    indexTypeLabel = 'FTS';
  }

  // Add model info for vector indexes
  var modelLabel = '';
  if (indexType !== 'normal') {
    var modelNames = { code: 'Code', fast: 'Fast' };
    var backendLabel = embeddingBackend === 'litellm' ? 'API: ' : '';
    modelLabel = ' [' + backendLabel + (modelNames[embeddingModel] || embeddingModel) + ']';
  }

  progressBar.innerHTML =
    '<div class="max-w-4xl mx-auto px-4 py-3">' +
      '<div class="flex items-center justify-between gap-4">' +
        '<div class="flex items-center gap-3 flex-1 min-w-0">' +
          '<div class="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full flex-shrink-0" id="codexlensIndexSpinner"></div>' +
          '<div class="flex-1 min-w-0">' +
            '<div class="flex items-center gap-2">' +
              '<span class="font-medium text-sm">' + t('codexlens.indexing') + ' (' + indexTypeLabel + modelLabel + ')</span>' +
              '<span class="text-xs text-muted-foreground" id="codexlensIndexPercent">0%</span>' +
            '</div>' +
            '<div class="text-xs text-muted-foreground truncate" id="codexlensIndexStatus">' + t('codexlens.preparingIndex') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="flex-1 max-w-xs hidden sm:block">' +
          '<div class="h-2 bg-muted rounded-full overflow-hidden">' +
            '<div id="codexlensIndexProgressBar" class="h-full bg-primary transition-all duration-300 ease-out" style="width: 0%"></div>' +
          '</div>' +
        '</div>' +
        '<button id="codexlensIndexCancelBtn" class="px-2 py-1 text-xs bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-md transition-colors flex-shrink-0" onclick="cancelCodexLensIndexing()" title="' + t('common.cancel') + '">' +
          t('common.cancel') +
        '</button>' +
        '<button class="p-1.5 hover:bg-muted rounded-md transition-colors flex-shrink-0" onclick="closeCodexLensIndexModal()" title="' + t('common.close') + '">' +
          '<i data-lucide="x" class="w-4 h-4"></i>' +
        '</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(progressBar);
  if (window.lucide) lucide.createIcons();

  // For 'full' type, use 'vector' in the API (it creates FTS + embeddings)
  var apiIndexType = (indexType === 'full') ? 'vector' : indexType;

  // Start indexing with specified type and model
  startCodexLensIndexing(apiIndexType, embeddingModel, embeddingBackend, maxWorkers);
}

/**
 * Start the indexing process
 * @param {string} indexType - 'vector' or 'normal'
 * @param {string} embeddingModel - Model profile: 'code', 'fast'
 * @param {string} embeddingBackend - Backend: 'fastembed' (local) or 'litellm' (API)
 * @param {number} maxWorkers - Max concurrent API calls for embedding generation (default: 1)
 */
async function startCodexLensIndexing(indexType, embeddingModel, embeddingBackend, maxWorkers) {
  indexType = indexType || 'vector';
  embeddingModel = embeddingModel || 'code';
  embeddingBackend = embeddingBackend || 'fastembed';
  maxWorkers = maxWorkers || 1;
  var statusText = document.getElementById('codexlensIndexStatus');
  var progressBar = document.getElementById('codexlensIndexProgressBar');
  var percentText = document.getElementById('codexlensIndexPercent');
  var spinner = document.getElementById('codexlensIndexSpinner');

  // Setup WebSocket listener for progress events
  window.codexlensIndexProgressHandler = function(data) {
    var payload = data.payload || data;
    console.log('[CodexLens] Progress event received:', payload);

    if (statusText) statusText.textContent = payload.message || t('codexlens.indexing');
    if (progressBar) progressBar.style.width = (payload.percent || 0) + '%';
    if (percentText) percentText.textContent = (payload.percent || 0) + '%';

    // Handle completion
    if (payload.stage === 'complete') {
      handleIndexComplete(true, payload.message);
    } else if (payload.stage === 'error') {
      handleIndexComplete(false, payload.message);
    }
  };

  // Register with notification system
  if (typeof registerWsEventHandler === 'function') {
    registerWsEventHandler('CODEXLENS_INDEX_PROGRESS', window.codexlensIndexProgressHandler);
    console.log('[CodexLens] Registered WebSocket progress handler');
  } else {
    console.warn('[CodexLens] registerWsEventHandler not available');
  }

  try {
    console.log('[CodexLens] Starting index for:', projectPath, 'type:', indexType, 'model:', embeddingModel, 'backend:', embeddingBackend, 'maxWorkers:', maxWorkers);
    var response = await fetch('/api/codexlens/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: projectPath, indexType: indexType, embeddingModel: embeddingModel, embeddingBackend: embeddingBackend, maxWorkers: maxWorkers })
    });

    var result = await response.json();
    console.log('[CodexLens] Init result:', result);

    // Check if completed successfully (WebSocket might have already reported)
    if (result.success) {
      // For vector index, check if embeddings were actually generated
      var embeddingsResult = result.result && result.result.embeddings;
      if (indexType === 'vector' && embeddingsResult && !embeddingsResult.generated) {
        // FTS succeeded but embeddings failed - show partial success
        var errorMsg = embeddingsResult.error || t('codexlens.embeddingsFailed');
        handleIndexComplete(false, t('codexlens.ftsSuccessEmbeddingsFailed') || 'FTS index created, but embeddings failed: ' + errorMsg);
      } else {
        handleIndexComplete(true, t('codexlens.indexComplete'));
      }
    } else if (!result.success) {
      handleIndexComplete(false, result.error || t('common.unknownError'));
    }
  } catch (err) {
    console.error('[CodexLens] Init error:', err);
    handleIndexComplete(false, err.message);
  }
}

/**
 * Handle index completion
 */
function handleIndexComplete(success, message) {
  var statusText = document.getElementById('codexlensIndexStatus');
  var progressBar = document.getElementById('codexlensIndexProgressBar');
  var percentText = document.getElementById('codexlensIndexPercent');
  var spinner = document.getElementById('codexlensIndexSpinner');
  var floatingBar = document.getElementById('codexlensIndexFloating');

  // Unregister WebSocket handler
  if (typeof unregisterWsEventHandler === 'function' && window.codexlensIndexProgressHandler) {
    unregisterWsEventHandler('CODEXLENS_INDEX_PROGRESS', window.codexlensIndexProgressHandler);
  }

  if (success) {
    if (progressBar) progressBar.style.width = '100%';
    if (percentText) percentText.textContent = '100%';
    if (statusText) statusText.textContent = t('codexlens.indexComplete');
    if (spinner) {
      spinner.classList.remove('animate-spin', 'border-primary');
      spinner.classList.add('border-green-500');
      spinner.innerHTML = '<i data-lucide="check" class="w-5 h-5 text-green-500"></i>';
      if (window.lucide) lucide.createIcons();
    }
    if (floatingBar) {
      floatingBar.classList.add('bg-green-500/10');
    }

    showRefreshToast(t('codexlens.indexSuccess'), 'success');

    // Auto-close after 3 seconds
    setTimeout(function() {
      closeCodexLensIndexModal();
      // Refresh status
      if (typeof loadCodexLensStatus === 'function') {
        loadCodexLensStatus().then(function() {
          renderToolsSection();
          if (window.lucide) lucide.createIcons();
        });
      }
    }, 3000);
  } else {
    if (progressBar) {
      progressBar.classList.remove('bg-primary');
      progressBar.classList.add('bg-destructive');
    }
    if (statusText) statusText.textContent = message || t('codexlens.indexFailed');
    if (spinner) {
      spinner.classList.remove('animate-spin', 'border-primary');
      spinner.innerHTML = '<i data-lucide="alert-circle" class="w-5 h-5 text-destructive"></i>';
      if (window.lucide) lucide.createIcons();
    }
    if (floatingBar) {
      floatingBar.classList.add('bg-destructive/10');
    }

    showRefreshToast(t('codexlens.indexFailed') + ': ' + message, 'error');
  }
}

/**
 * Close floating progress bar
 */
function closeCodexLensIndexModal() {
  var floatingBar = document.getElementById('codexlensIndexFloating');
  if (floatingBar) {
    floatingBar.classList.add('translate-y-full');
    setTimeout(function() {
      floatingBar.remove();
    }, 300);
  }

  // Unregister WebSocket handler
  if (typeof unregisterWsEventHandler === 'function' && window.codexlensIndexProgressHandler) {
    unregisterWsEventHandler('CODEXLENS_INDEX_PROGRESS', window.codexlensIndexProgressHandler);
  }
}

/**
 * Cancel the running indexing process
 */
async function cancelCodexLensIndexing() {
  var cancelBtn = document.getElementById('codexlensIndexCancelBtn');
  var statusText = document.getElementById('codexlensIndexStatus');

  // Disable button to prevent double-click
  if (cancelBtn) {
    cancelBtn.disabled = true;
    cancelBtn.textContent = t('common.canceling') || 'Canceling...';
  }

  try {
    var response = await fetch('/api/codexlens/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    var result = await response.json();

    if (result.success) {
      if (statusText) statusText.textContent = t('codexlens.indexCanceled') || 'Indexing canceled';
      showRefreshToast(t('codexlens.indexCanceled') || 'Indexing canceled', 'info');

      // Close the modal after a short delay
      setTimeout(function() {
        closeCodexLensIndexModal();
        // Refresh status
        if (typeof loadCodexLensStatus === 'function') {
          loadCodexLensStatus().then(function() {
            renderToolsSection();
            if (window.lucide) lucide.createIcons();
          });
        }
      }, 1000);
    } else {
      showRefreshToast(t('codexlens.cancelFailed') + ': ' + result.error, 'error');
      // Re-enable button on failure
      if (cancelBtn) {
        cancelBtn.disabled = false;
        cancelBtn.textContent = t('common.cancel');
      }
    }
  } catch (err) {
    console.error('[CodexLens] Cancel error:', err);
    showRefreshToast(t('common.error') + ': ' + err.message, 'error');
    // Re-enable button on error
    if (cancelBtn) {
      cancelBtn.disabled = false;
      cancelBtn.textContent = t('common.cancel');
    }
  }
}

/**
 * Install CodexLens
 * Note: Uses CodexLens-specific install wizard from cli-status.js
 * which calls /api/codexlens/bootstrap (Python venv), not the generic
 * CLI install that uses npm install -g (NPM packages)
 */
function installCodexLensFromManager() {
  // Use the CodexLens-specific install wizard from cli-status.js
  if (typeof openCodexLensInstallWizard === 'function') {
    openCodexLensInstallWizard();
  } else {
    // Fallback: inline install wizard if cli-status.js not loaded
    showCodexLensInstallDialog();
  }
}

/**
 * Fallback install dialog when cli-status.js is not loaded
 */
function showCodexLensInstallDialog() {
  var modal = document.createElement('div');
  modal.id = 'codexlensInstallModalFallback';
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
  modal.innerHTML =
    '<div class="bg-card rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">' +
      '<div class="p-6">' +
        '<div class="flex items-center gap-3 mb-4">' +
          '<div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">' +
            '<i data-lucide="database" class="w-5 h-5 text-primary"></i>' +
          '</div>' +
          '<div>' +
            '<h3 class="text-lg font-semibold">' + t('codexlens.installCodexLens') + '</h3>' +
            '<p class="text-sm text-muted-foreground">' + t('codexlens.installDesc') + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="space-y-4">' +
          '<div class="bg-muted/50 rounded-lg p-4">' +
            '<h4 class="font-medium mb-2">' + t('codexlens.whatWillBeInstalled') + '</h4>' +
            '<ul class="text-sm space-y-2 text-muted-foreground">' +
              '<li class="flex items-start gap-2">' +
                '<i data-lucide="check" class="w-4 h-4 text-success mt-0.5"></i>' +
                '<span><strong>' + t('codexlens.pythonVenv') + '</strong> - ' + t('codexlens.pythonVenvDesc') + '</span>' +
              '</li>' +
              '<li class="flex items-start gap-2">' +
                '<i data-lucide="check" class="w-4 h-4 text-success mt-0.5"></i>' +
                '<span><strong>' + t('codexlens.codexlensPackage') + '</strong> - ' + t('codexlens.codexlensPackageDesc') + '</span>' +
              '</li>' +
              '<li class="flex items-start gap-2">' +
                '<i data-lucide="check" class="w-4 h-4 text-success mt-0.5"></i>' +
                '<span><strong>SQLite FTS5</strong> - ' + t('codexlens.sqliteFtsDesc') + '</span>' +
              '</li>' +
            '</ul>' +
          '</div>' +
          '<div class="bg-primary/5 border border-primary/20 rounded-lg p-3">' +
            '<div class="flex items-start gap-2">' +
              '<i data-lucide="info" class="w-4 h-4 text-primary mt-0.5"></i>' +
              '<div class="text-sm text-muted-foreground">' +
                '<p class="font-medium text-foreground">' + t('codexlens.installLocation') + '</p>' +
                '<p class="mt-1"><code class="bg-muted px-1 rounded">~/.codexlens/venv</code></p>' +
                '<p class="mt-1">' + t('codexlens.installTime') + '</p>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div id="codexlensInstallProgressFallback" class="hidden">' +
            '<div class="flex items-center gap-3">' +
              '<div class="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full"></div>' +
              '<span class="text-sm" id="codexlensInstallStatusFallback">' + t('codexlens.startingInstall') + '</span>' +
            '</div>' +
            '<div class="mt-2 h-2 bg-muted rounded-full overflow-hidden">' +
              '<div id="codexlensInstallProgressBarFallback" class="h-full bg-primary transition-all duration-300" style="width: 0%"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="border-t border-border p-4 flex justify-end gap-3 bg-muted/30">' +
        '<button class="btn-outline px-4 py-2" onclick="closeCodexLensInstallDialogFallback()">' + t('common.cancel') + '</button>' +
        '<button id="codexlensInstallBtnFallback" class="btn-primary px-4 py-2" onclick="startCodexLensInstallFallback()">' +
          '<i data-lucide="download" class="w-4 h-4 mr-2"></i>' +
          t('codexlens.installNow') +
        '</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);
  if (window.lucide) lucide.createIcons();
}

function closeCodexLensInstallDialogFallback() {
  var modal = document.getElementById('codexlensInstallModalFallback');
  if (modal) modal.remove();
}

async function startCodexLensInstallFallback() {
  var progressDiv = document.getElementById('codexlensInstallProgressFallback');
  var installBtn = document.getElementById('codexlensInstallBtnFallback');
  var statusText = document.getElementById('codexlensInstallStatusFallback');
  var progressBar = document.getElementById('codexlensInstallProgressBarFallback');

  progressDiv.classList.remove('hidden');
  installBtn.disabled = true;
  installBtn.innerHTML = '<span class="animate-pulse">' + t('codexlens.installing') + '</span>';

  var stages = [
    { progress: 10, text: t('codexlens.creatingVenv') },
    { progress: 30, text: t('codexlens.installingPip') },
    { progress: 50, text: t('codexlens.installingPackage') },
    { progress: 70, text: t('codexlens.settingUpDeps') },
    { progress: 90, text: t('codexlens.finalizing') }
  ];

  var currentStage = 0;
  var progressInterval = setInterval(function() {
    if (currentStage < stages.length) {
      statusText.textContent = stages[currentStage].text;
      progressBar.style.width = stages[currentStage].progress + '%';
      currentStage++;
    }
  }, 1500);

  try {
    var response = await fetch('/api/codexlens/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    clearInterval(progressInterval);
    var result = await response.json();

    if (result.success) {
      progressBar.style.width = '100%';
      statusText.textContent = t('codexlens.installComplete');

      setTimeout(function() {
        closeCodexLensInstallDialogFallback();
        showRefreshToast(t('codexlens.installSuccess'), 'success');
        // Refresh the page to update status
        if (typeof loadCodexLensStatus === 'function') {
          loadCodexLensStatus().then(function() {
            if (typeof renderCodexLensManager === 'function') renderCodexLensManager();
          });
        } else {
          location.reload();
        }
      }, 1000);
    } else {
      statusText.textContent = t('common.error') + ': ' + result.error;
      progressBar.classList.add('bg-destructive');
      installBtn.disabled = false;
      installBtn.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4 mr-2"></i> ' + t('common.retry');
      if (window.lucide) lucide.createIcons();
    }
  } catch (err) {
    clearInterval(progressInterval);
    statusText.textContent = t('common.error') + ': ' + err.message;
    progressBar.classList.add('bg-destructive');
    installBtn.disabled = false;
    installBtn.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4 mr-2"></i> ' + t('common.retry');
    if (window.lucide) lucide.createIcons();
  }
}

/**
 * Uninstall CodexLens
 * Note: Uses CodexLens-specific uninstall wizard from cli-status.js
 * which calls /api/codexlens/uninstall (Python venv), not the generic
 * CLI uninstall that uses /api/cli/uninstall (NPM packages)
 */
function uninstallCodexLensFromManager() {
  // Use the CodexLens-specific uninstall wizard from cli-status.js
  if (typeof openCodexLensUninstallWizard === 'function') {
    openCodexLensUninstallWizard();
  } else {
    // Fallback: inline uninstall wizard if cli-status.js not loaded
    showCodexLensUninstallDialog();
  }
}

/**
 * Fallback uninstall dialog when cli-status.js is not loaded
 */
function showCodexLensUninstallDialog() {
  var modal = document.createElement('div');
  modal.id = 'codexlensUninstallModalFallback';
  modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
  modal.innerHTML =
    '<div class="bg-card rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">' +
      '<div class="p-6">' +
        '<div class="flex items-center gap-3 mb-4">' +
          '<div class="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">' +
            '<i data-lucide="trash-2" class="w-5 h-5 text-destructive"></i>' +
          '</div>' +
          '<div>' +
            '<h3 class="text-lg font-semibold">' + t('codexlens.uninstall') + '</h3>' +
            '<p class="text-sm text-muted-foreground">' + t('codexlens.uninstallDesc') + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="space-y-4">' +
          '<div class="bg-destructive/5 border border-destructive/20 rounded-lg p-4">' +
            '<h4 class="font-medium text-destructive mb-2">' + t('codexlens.whatWillBeRemoved') + '</h4>' +
            '<ul class="text-sm space-y-2 text-muted-foreground">' +
              '<li class="flex items-start gap-2">' +
                '<i data-lucide="x" class="w-4 h-4 text-destructive mt-0.5"></i>' +
                '<span>' + t('codexlens.removeVenv') + '</span>' +
              '</li>' +
              '<li class="flex items-start gap-2">' +
                '<i data-lucide="x" class="w-4 h-4 text-destructive mt-0.5"></i>' +
                '<span>' + t('codexlens.removeData') + '</span>' +
              '</li>' +
              '<li class="flex items-start gap-2">' +
                '<i data-lucide="x" class="w-4 h-4 text-destructive mt-0.5"></i>' +
                '<span>' + t('codexlens.removeConfig') + '</span>' +
              '</li>' +
            '</ul>' +
          '</div>' +
          '<div id="codexlensUninstallProgressFallback" class="hidden">' +
            '<div class="flex items-center gap-3">' +
              '<div class="animate-spin w-5 h-5 border-2 border-destructive border-t-transparent rounded-full"></div>' +
              '<span class="text-sm" id="codexlensUninstallStatusFallback">' + t('codexlens.removing') + '</span>' +
            '</div>' +
            '<div class="mt-2 h-2 bg-muted rounded-full overflow-hidden">' +
              '<div id="codexlensUninstallProgressBarFallback" class="h-full bg-destructive transition-all duration-300" style="width: 0%"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="border-t border-border p-4 flex justify-end gap-3 bg-muted/30">' +
        '<button class="btn-outline px-4 py-2" onclick="closeCodexLensUninstallDialogFallback()">' + t('common.cancel') + '</button>' +
        '<button id="codexlensUninstallBtnFallback" class="btn-destructive px-4 py-2" onclick="startCodexLensUninstallFallback()">' +
          '<i data-lucide="trash-2" class="w-4 h-4 mr-2"></i>' +
          t('codexlens.uninstall') +
        '</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);
  if (window.lucide) lucide.createIcons();
}

function closeCodexLensUninstallDialogFallback() {
  var modal = document.getElementById('codexlensUninstallModalFallback');
  if (modal) modal.remove();
}

async function startCodexLensUninstallFallback() {
  var progressDiv = document.getElementById('codexlensUninstallProgressFallback');
  var uninstallBtn = document.getElementById('codexlensUninstallBtnFallback');
  var statusText = document.getElementById('codexlensUninstallStatusFallback');
  var progressBar = document.getElementById('codexlensUninstallProgressBarFallback');

  progressDiv.classList.remove('hidden');
  uninstallBtn.disabled = true;
  uninstallBtn.innerHTML = '<span class="animate-pulse">' + t('codexlens.uninstalling') + '</span>';

  var stages = [
    { progress: 25, text: t('codexlens.removingVenv') },
    { progress: 50, text: t('codexlens.removingData') },
    { progress: 75, text: t('codexlens.removingConfig') },
    { progress: 90, text: t('codexlens.finalizing') }
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
    var response = await fetch('/api/codexlens/uninstall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    clearInterval(progressInterval);
    var result = await response.json();

    if (result.success) {
      progressBar.style.width = '100%';
      statusText.textContent = t('codexlens.uninstallComplete');

      setTimeout(function() {
        closeCodexLensUninstallDialogFallback();
        showRefreshToast(t('codexlens.uninstallSuccess'), 'success');
        // Refresh the page to update status
        if (typeof loadCodexLensStatus === 'function') {
          loadCodexLensStatus().then(function() {
            if (typeof renderCodexLensManager === 'function') renderCodexLensManager();
          });
        } else {
          location.reload();
        }
      }, 1000);
    } else {
      statusText.textContent = t('common.error') + ': ' + result.error;
      progressBar.classList.add('bg-destructive');
      uninstallBtn.disabled = false;
      uninstallBtn.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4 mr-2"></i> ' + t('common.retry');
      if (window.lucide) lucide.createIcons();
    }
  } catch (err) {
    clearInterval(progressInterval);
    statusText.textContent = t('common.error') + ': ' + err.message;
    progressBar.classList.add('bg-destructive');
    uninstallBtn.disabled = false;
    uninstallBtn.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4 mr-2"></i> ' + t('common.retry');
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

// ============================================================
// CODEXLENS MANAGER PAGE (Independent View)
// ============================================================

/**
 * Render CodexLens Manager as an independent page view
 */
async function renderCodexLensManager() {
  var container = document.getElementById('mainContent');
  if (!container) return;

  // Hide stats grid and search
  var statsGrid = document.getElementById('statsGrid');
  var searchContainer = document.querySelector('.search-container');
  if (statsGrid) statsGrid.style.display = 'none';
  if (searchContainer) searchContainer.style.display = 'none';

  container.innerHTML = '<div class="flex items-center justify-center py-12"><div class="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div><span class="ml-3">' + t('common.loading') + '</span></div>';

  try {
    // Use aggregated endpoint for faster page load (single API call)
    var dashboardData = null;
    var config = { index_dir: '~/.codexlens/indexes', index_count: 0 };

    if (typeof loadCodexLensDashboardInit === 'function') {
      console.log('[CodexLens] Using aggregated dashboard-init endpoint...');
      dashboardData = await loadCodexLensDashboardInit();
      if (dashboardData && dashboardData.config) {
        config = dashboardData.config;
        console.log('[CodexLens] Dashboard init loaded, config:', config);
      }
    } else if (typeof loadCodexLensStatus === 'function') {
      // Fallback to legacy individual calls
      console.log('[CodexLens] Fallback to legacy loadCodexLensStatus...');
      await loadCodexLensStatus();
      var response = await fetch('/api/codexlens/config');
      config = await response.json();
    }

    // Load LiteLLM API config for embedding backend options (parallel with page render)
    var litellmPromise = (async () => {
      try {
        console.log('[CodexLens] Loading LiteLLM config...');
        var litellmResponse = await fetch('/api/litellm-api/config');
        if (litellmResponse.ok) {
          window.litellmApiConfig = await litellmResponse.json();
          console.log('[CodexLens] LiteLLM config loaded, providers:', window.litellmApiConfig?.providers?.length || 0);
        }
      } catch (e) {
        console.warn('[CodexLens] Could not load LiteLLM config:', e);
      }
    })();

    container.innerHTML = buildCodexLensManagerPage(config);
    if (window.lucide) lucide.createIcons();
    initCodexLensManagerPageEvents(config);

    // Load additional data in parallel (non-blocking)
    var isInstalled = window.cliToolsStatus?.codexlens?.installed || dashboardData?.installed;

    // Wait for LiteLLM config before loading semantic deps (it may need provider info)
    await litellmPromise;

    // Always load semantic deps status - it needs GPU detection and device list
    // which are not included in the aggregated endpoint
    loadSemanticDepsStatus();

    loadModelList();

    // Load index stats for the Index Manager section
    if (isInstalled) {
      loadIndexStatsForPage();
    }
  } catch (err) {
    container.innerHTML = '<div class="text-center py-12 text-destructive"><i data-lucide="alert-circle" class="w-8 h-8 mx-auto mb-2"></i><p>' + t('common.error') + ': ' + err.message + '</p></div>';
    if (window.lucide) lucide.createIcons();
  }
}

/**
 * Build CodexLens Manager page content
 */
function buildCodexLensManagerPage(config) {
  var indexDir = config.index_dir || '~/.codexlens/indexes';
  var indexCount = config.index_count || 0;
  var isInstalled = window.cliToolsStatus?.codexlens?.installed || false;

  // Build model options for vector indexing
  var modelOptions = buildModelSelectOptionsForPage();

  return '<div class="codexlens-manager-page space-y-6">' +
    // Header with status
    '<div class="bg-card border border-border rounded-lg p-6">' +
      '<div class="flex items-center justify-between flex-wrap gap-4">' +
        '<div class="flex items-center gap-4">' +
          '<div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">' +
            '<i data-lucide="database" class="w-6 h-6 text-primary"></i>' +
          '</div>' +
          '<div>' +
            '<h2 class="text-xl font-bold">' + t('codexlens.config') + '</h2>' +
            '<p class="text-sm text-muted-foreground">' + t('codexlens.configDesc') + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="flex items-center gap-4">' +
          (isInstalled
            ? '<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-success/10 text-success border border-success/20"><i data-lucide="check-circle" class="w-4 h-4"></i> ' + t('codexlens.installed') + '</span>'
            : '<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-muted text-muted-foreground border border-border"><i data-lucide="circle" class="w-4 h-4"></i> ' + t('codexlens.notInstalled') + '</span>') +
          '<div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/20">' +
            '<span class="text-sm text-muted-foreground">' + t('codexlens.indexes') + ':</span>' +
            '<span class="text-lg font-bold text-primary">' + indexCount + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +

    (isInstalled
      ? // Installed: Show full management UI
        '<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">' +
          // Left Column
          '<div class="space-y-6">' +
            // Create Index Section
            '<div class="bg-card border border-border rounded-lg p-5">' +
              '<h4 class="text-lg font-semibold mb-4 flex items-center gap-2"><i data-lucide="layers" class="w-5 h-5 text-primary"></i> ' + t('codexlens.createIndex') + '</h4>' +
              '<div class="space-y-4">' +
                // Backend selector (fastembed local or litellm API)
                '<div class="mb-4">' +
                  '<label class="block text-sm font-medium mb-1.5">' + (t('codexlens.embeddingBackend') || 'Embedding Backend') + '</label>' +
                  '<select id="pageBackendSelect" class="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm" onchange="onEmbeddingBackendChange()">' +
                    '<option value="fastembed">' + (t('codexlens.localFastembed') || 'Local (FastEmbed)') + '</option>' +
                    '<option value="litellm">' + (t('codexlens.apiLitellm') || 'API (LiteLLM)') + '</option>' +
                  '</select>' +
                  '<p class="text-xs text-muted-foreground mt-1">' + (t('codexlens.backendHint') || 'Select local model or remote API endpoint') + '</p>' +
                '</div>' +
                // Model selector
                '<div>' +
                  '<label class="block text-sm font-medium mb-1.5">' + t('codexlens.embeddingModel') + '</label>' +
                  '<select id="pageModelSelect" class="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm">' +
                    modelOptions +
                  '</select>' +
                  '<p class="text-xs text-muted-foreground mt-1">' + t('codexlens.modelHint') + '</p>' +
                '</div>' +
                // Concurrency selector (only for LiteLLM backend)
                '<div id="concurrencySelector" class="hidden">' +
                  '<label class="block text-sm font-medium mb-1.5">' + t('codexlens.concurrency') + '</label>' +
                  '<div class="flex items-center gap-2">' +
                    '<input type="number" id="pageConcurrencyInput" min="1" value="4" ' +
                      'class="w-24 px-3 py-2 border border-border rounded-lg bg-background text-sm" ' +
                      'onchange="validateConcurrencyInput(this)" />' +
                    '<span class="text-sm text-muted-foreground">workers</span>' +
                    '<span class="text-xs text-primary ml-2">(4 = recommended)</span>' +
                  '</div>' +
                  '<p class="text-xs text-muted-foreground mt-1">' + t('codexlens.concurrencyHint') + '</p>' +
                '</div>' +
                // Multi-Provider Rotation (only for LiteLLM backend) - Simplified, config in API Settings
                '<div id="rotationSection" class="hidden">' +
                  '<div class="border border-border rounded-lg p-3 bg-muted/30">' +
                    '<div class="flex items-center justify-between mb-2">' +
                      '<div class="flex items-center gap-2">' +
                        '<i data-lucide="rotate-cw" class="w-4 h-4 text-primary"></i>' +
                        '<span class="text-sm font-medium">' + t('codexlens.rotation') + '</span>' +
                      '</div>' +
                      '<div id="rotationStatusBadge" class="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">' +
                        t('common.disabled') +
                      '</div>' +
                    '</div>' +
                    '<p class="text-xs text-muted-foreground mb-2">' + t('codexlens.rotationDesc') + '</p>' +
                    '<div id="rotationDetails" class="text-xs text-muted-foreground mb-3 hidden">' +
                      '<span id="rotationModelName"></span> · <span id="rotationEndpointCount"></span>' +
                    '</div>' +
                    '<div class="flex items-center gap-2">' +
                      '<a href="#" class="btn-sm btn-outline flex items-center gap-1.5" onclick="navigateToApiSettingsEmbeddingPool(); return false;">' +
                        '<i data-lucide="external-link" class="w-3.5 h-3.5"></i>' +
                        t('codexlens.configureInApiSettings') +
                      '</a>' +
                    '</div>' +
                  '</div>' +
                '</div>' +
                // Index buttons - two modes: full (FTS + Vector) or FTS only
                '<div class="grid grid-cols-2 gap-3">' +
                  '<button class="btn btn-primary flex items-center justify-center gap-2 py-3" onclick="initCodexLensIndexFromPage(\'full\')" title="' + t('codexlens.fullIndexDesc') + '">' +
                    '<i data-lucide="layers" class="w-4 h-4"></i>' +
                    '<span>' + t('codexlens.fullIndex') + '</span>' +
                  '</button>' +
                  '<button class="btn btn-outline flex items-center justify-center gap-2 py-3" onclick="initCodexLensIndexFromPage(\'normal\')" title="' + t('codexlens.ftsIndexDesc') + '">' +
                    '<i data-lucide="file-text" class="w-4 h-4"></i>' +
                    '<span>' + t('codexlens.ftsIndex') + '</span>' +
                  '</button>' +
                '</div>' +
                '<p class="text-xs text-muted-foreground">' + t('codexlens.indexTypeHint') + '</p>' +
              '</div>' +
            '</div>' +
            // Storage Path Section
            '<div class="bg-card border border-border rounded-lg p-5">' +
              '<h4 class="text-lg font-semibold mb-4 flex items-center gap-2"><i data-lucide="folder" class="w-5 h-5 text-primary"></i> ' + t('codexlens.indexStoragePath') + '</h4>' +
              '<div class="space-y-3">' +
                '<div>' +
                  '<label class="block text-sm font-medium mb-1.5">' + t('codexlens.currentPath') + '</label>' +
                  '<div class="text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 font-mono border border-border truncate" title="' + indexDir + '">' + indexDir + '</div>' +
                '</div>' +
                '<div>' +
                  '<label class="block text-sm font-medium mb-1.5">' + t('codexlens.newStoragePath') + '</label>' +
                  '<div class="flex gap-2">' +
                    '<input type="text" id="indexDirInput" value="' + indexDir + '" class="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm" />' +
                    '<button class="btn-sm btn-primary" id="saveIndexPathBtn"><i data-lucide="save" class="w-3.5 h-3.5"></i></button>' +
                  '</div>' +
                  '<p class="text-xs text-muted-foreground mt-1">' + t('codexlens.pathInfo') + '</p>' +
                '</div>' +
              '</div>' +
            '</div>' +
            // Maintenance Section
            '<div class="bg-card border border-border rounded-lg p-5">' +
              '<h4 class="text-lg font-semibold mb-4 flex items-center gap-2"><i data-lucide="settings" class="w-5 h-5 text-primary"></i> ' + t('codexlens.maintenance') + '</h4>' +
              '<div class="flex flex-wrap gap-2">' +
                '<button class="btn-sm btn-outline" onclick="cleanCurrentWorkspaceIndex()"><i data-lucide="folder-x" class="w-3.5 h-3.5"></i> ' + t('codexlens.cleanCurrentWorkspace') + '</button>' +
                '<button class="btn-sm btn-outline" onclick="cleanCodexLensIndexes()"><i data-lucide="trash" class="w-3.5 h-3.5"></i> ' + t('codexlens.cleanAllIndexes') + '</button>' +
                '<button class="btn-sm btn-destructive" onclick="uninstallCodexLensFromManager()"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i> ' + t('cli.uninstall') + '</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          // Right Column
          '<div class="space-y-6">' +
            // Semantic Dependencies
            '<div class="bg-card border border-border rounded-lg p-5">' +
              '<h4 class="text-lg font-semibold mb-4 flex items-center gap-2"><i data-lucide="cpu" class="w-5 h-5 text-primary"></i> ' + t('codexlens.semanticDeps') + '</h4>' +
              '<div id="semanticDepsStatus" class="space-y-3">' +
                '<div class="flex items-center gap-2 text-sm text-muted-foreground">' +
                  '<div class="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></div> ' + t('codexlens.checkingDeps') +
                '</div>' +
              '</div>' +
            '</div>' +
            // Model Management
            '<div class="bg-card border border-border rounded-lg p-5">' +
              '<h4 class="text-lg font-semibold mb-4 flex items-center gap-2"><i data-lucide="box" class="w-5 h-5 text-primary"></i> ' + t('codexlens.modelManagement') + '</h4>' +
              '<div id="modelListContainer" class="space-y-3">' +
                '<div class="flex items-center gap-2 text-sm text-muted-foreground">' +
                  '<div class="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></div> ' + t('codexlens.loadingModels') +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        // Index Manager Section
        '<div class="bg-card border border-border rounded-lg overflow-hidden" id="indexManagerSection">' +
          '<div class="bg-muted/30 border-b border-border px-4 py-3 flex items-center justify-between">' +
            '<div class="flex items-center gap-2">' +
              '<i data-lucide="database" class="w-4 h-4 text-primary"></i>' +
              '<span class="font-medium text-foreground">' + t('index.manager') + '</span>' +
              '<span class="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground" id="indexTotalSize">-</span>' +
            '</div>' +
            '<div class="flex items-center gap-2">' +
              '<button onclick="loadIndexStatsForPage()" class="text-xs px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors" title="' + t('common.refresh') + '">' +
                '<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>' +
              '</button>' +
            '</div>' +
          '</div>' +
          '<div class="p-4">' +
            '<div class="flex items-center gap-2 mb-3 text-xs text-muted-foreground">' +
              '<i data-lucide="folder" class="w-3.5 h-3.5"></i>' +
              '<span class="font-mono truncate" id="indexDirDisplay" title="' + indexDir + '">' + indexDir + '</span>' +
            '</div>' +
            '<div class="grid grid-cols-4 gap-3 mb-4">' +
              '<div class="bg-muted/30 rounded-lg p-3 text-center">' +
                '<div class="text-lg font-semibold text-foreground" id="indexProjectCount">-</div>' +
                '<div class="text-xs text-muted-foreground">' + t('index.projects') + '</div>' +
              '</div>' +
              '<div class="bg-muted/30 rounded-lg p-3 text-center">' +
                '<div class="text-lg font-semibold text-foreground" id="indexTotalSizeVal">-</div>' +
                '<div class="text-xs text-muted-foreground">' + t('index.totalSize') + '</div>' +
              '</div>' +
              '<div class="bg-muted/30 rounded-lg p-3 text-center">' +
                '<div class="text-lg font-semibold text-foreground" id="indexVectorCount">-</div>' +
                '<div class="text-xs text-muted-foreground">' + t('index.vectorIndexes') + '</div>' +
              '</div>' +
              '<div class="bg-muted/30 rounded-lg p-3 text-center">' +
                '<div class="text-lg font-semibold text-foreground" id="indexFtsCount">-</div>' +
                '<div class="text-xs text-muted-foreground">' + t('index.ftsIndexes') + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="border border-border rounded-lg overflow-hidden">' +
              '<table class="w-full text-sm">' +
                '<thead class="bg-muted/50">' +
                  '<tr class="text-xs text-muted-foreground">' +
                    '<th class="py-2 px-2 text-left font-medium">' + t('index.projectId') + '</th>' +
                    '<th class="py-2 px-2 text-right font-medium">' + t('index.size') + '</th>' +
                    '<th class="py-2 px-2 text-center font-medium">' + t('index.type') + '</th>' +
                    '<th class="py-2 px-2 text-right font-medium">' + t('index.lastModified') + '</th>' +
                    '<th class="py-2 px-1 w-8"></th>' +
                  '</tr>' +
                '</thead>' +
                '<tbody id="indexTableBody">' +
                  '<tr><td colspan="5" class="py-4 text-center text-muted-foreground text-sm">' + t('common.loading') + '</td></tr>' +
                '</tbody>' +
              '</table>' +
            '</div>' +
            '<div class="mt-4 flex justify-end">' +
              '<button onclick="cleanAllIndexesFromPage()" class="text-xs px-3 py-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded transition-colors flex items-center gap-1.5">' +
                '<i data-lucide="trash" class="w-3.5 h-3.5"></i>' +
                t('index.cleanAll') +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        // Test Search Section
        '<div class="bg-card border border-border rounded-lg p-5">' +
          '<h4 class="text-lg font-semibold mb-4 flex items-center gap-2"><i data-lucide="search" class="w-5 h-5 text-primary"></i> ' + t('codexlens.testSearch') + '</h4>' +
          '<div class="space-y-4">' +
            '<div class="flex gap-3">' +
              '<select id="searchTypeSelect" class="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-sm">' +
                '<option value="search">' + t('codexlens.textSearch') + '</option>' +
                '<option value="search_files">' + t('codexlens.fileSearch') + '</option>' +
                '<option value="symbol">' + t('codexlens.symbolSearch') + '</option>' +
              '</select>' +
              '<select id="searchModeSelect" class="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-sm">' +
                '<option value="exact">' + t('codexlens.exactMode') + '</option>' +
                '<option value="fuzzy">' + t('codexlens.fuzzyMode') + '</option>' +
                '<option value="hybrid">' + t('codexlens.hybridMode') + '</option>' +
                '<option value="vector">' + t('codexlens.vectorMode') + '</option>' +
              '</select>' +
            '</div>' +
            '<div class="flex gap-3 items-center">' +
              '<div class="flex items-center gap-2">' +
                '<label class="text-xs text-muted-foreground whitespace-nowrap">' + t('codexlens.resultLimit') + '</label>' +
                '<input type="number" id="searchLimitInput" class="w-16 px-2 py-1.5 border border-border rounded-lg bg-background text-sm text-center" value="5" min="1" max="50" />' +
              '</div>' +
              '<div class="flex items-center gap-2">' +
                '<label class="text-xs text-muted-foreground whitespace-nowrap">' + t('codexlens.contentLength') + '</label>' +
                '<input type="number" id="contentLengthInput" class="w-20 px-2 py-1.5 border border-border rounded-lg bg-background text-sm text-center" value="200" min="50" max="2000" />' +
              '</div>' +
              '<div class="flex items-center gap-2">' +
                '<label class="text-xs text-muted-foreground whitespace-nowrap">' + t('codexlens.extraFiles') + '</label>' +
                '<input type="number" id="extraFilesInput" class="w-16 px-2 py-1.5 border border-border rounded-lg bg-background text-sm text-center" value="10" min="0" max="50" />' +
              '</div>' +
            '</div>' +
            '<div class="flex gap-3">' +
              '<input type="text" id="searchQueryInput" class="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-sm" placeholder="' + t('codexlens.searchPlaceholder') + '" />' +
              '<button class="btn-sm btn-primary" id="runSearchBtn"><i data-lucide="search" class="w-3.5 h-3.5"></i> ' + t('codexlens.runSearch') + '</button>' +
            '</div>' +
            '<div id="searchResults" class="hidden">' +
              '<div class="flex items-center justify-between mb-2">' +
                '<span class="text-sm font-medium">' + t('codexlens.results') + ':</span>' +
                '<span id="searchResultCount" class="text-xs text-muted-foreground"></span>' +
              '</div>' +
              '<pre id="searchResultContent" class="bg-muted/50 border border-border p-3 rounded-lg text-xs overflow-auto max-h-64 font-mono"></pre>' +
            '</div>' +
          '</div>' +
        '</div>'

      : // Not installed: Show install prompt
        '<div class="bg-card border border-border rounded-lg p-8">' +
          '<div class="text-center max-w-md mx-auto">' +
            '<div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">' +
              '<i data-lucide="database" class="w-8 h-8 text-primary"></i>' +
            '</div>' +
            '<h3 class="text-lg font-semibold mb-2">' + t('codexlens.installCodexLens') + '</h3>' +
            '<p class="text-sm text-muted-foreground mb-6">' + t('codexlens.installFirst') + '</p>' +
            '<button class="btn btn-primary" onclick="installCodexLensFromManager()">' +
              '<i data-lucide="download" class="w-4 h-4"></i> ' + t('codexlens.installCodexLens') +
            '</button>' +
          '</div>' +
        '</div>'
    ) +
  '</div>';
}

/**
 * Build model select options for the page
 */
function buildModelSelectOptionsForPage() {
  var installedModels = window.cliToolsStatus?.codexlens?.installedModels || [];
  var allModels = window.cliToolsStatus?.codexlens?.allModels || [];

  if (allModels.length === 0) {
    // Fallback to default models if not loaded
    return '<option value="code">code (default)</option>' +
           '<option value="fast">fast</option>';
  }

  var options = '';
  allModels.forEach(function(model) {
    var isInstalled = model.installed || installedModels.includes(model.profile);
    var label = model.profile + (isInstalled ? ' ✓' : '');
    var selected = model.profile === 'code' ? ' selected' : '';
    options += '<option value="' + model.profile + '"' + selected + '>' + label + '</option>';
  });
  return options;
}

/**
 * Validate concurrency input value (min 1, no max limit)
 */
function validateConcurrencyInput(input) {
  var value = parseInt(input.value, 10);
  if (isNaN(value) || value < 1) {
    input.value = 1;
  }
}

/**
 * Handle embedding backend change
 */
function onEmbeddingBackendChange() {
  var backendSelect = document.getElementById('pageBackendSelect');
  var modelSelect = document.getElementById('pageModelSelect');
  var concurrencySelector = document.getElementById('concurrencySelector');
  var rotationSection = document.getElementById('rotationSection');
  if (!backendSelect || !modelSelect) {
    console.warn('[CodexLens] Backend or model select not found');
    return;
  }

  var backend = backendSelect.value;
  console.log('[CodexLens] Backend changed to:', backend);
  console.log('[CodexLens] Current litellmApiConfig:', window.litellmApiConfig);

  if (backend === 'litellm') {
    // Load LiteLLM embedding models
    console.log('[CodexLens] Building LiteLLM model options...');
    var options = buildLiteLLMModelOptions();
    console.log('[CodexLens] Built options HTML:', options);
    modelSelect.innerHTML = options;
    // Show concurrency selector for API backend
    if (concurrencySelector) {
      concurrencySelector.classList.remove('hidden');
    }
    // Show rotation section and load status
    if (rotationSection) {
      rotationSection.classList.remove('hidden');
      loadRotationStatus();
    }
  } else {
    // Load local fastembed models
    modelSelect.innerHTML = buildModelSelectOptionsForPage();
    // Hide concurrency selector for local backend
    if (concurrencySelector) {
      concurrencySelector.classList.add('hidden');
    }
    // Hide rotation section for local backend
    if (rotationSection) {
      rotationSection.classList.add('hidden');
    }
  }
}

/**
 * Build LiteLLM model options from config
 */
function buildLiteLLMModelOptions() {
  var litellmConfig = window.litellmApiConfig || {};
  console.log('[CodexLens] litellmApiConfig:', litellmConfig);

  var providers = litellmConfig.providers || [];
  console.log('[CodexLens] providers count:', providers.length);

  var options = '';

  providers.forEach(function(provider) {
    console.log('[CodexLens] Processing provider:', provider.id, 'enabled:', provider.enabled);
    if (!provider.enabled) return;

    // Check embeddingModels array (config structure)
    var models = provider.embeddingModels || provider.models || [];
    console.log('[CodexLens] Provider', provider.id, 'embeddingModels:', models.length, models);

    models.forEach(function(model) {
      console.log('[CodexLens] Processing model:', model.id, 'type:', model.type, 'enabled:', model.enabled);
      // Accept embedding type or models from embeddingModels array
      if (model.type && model.type !== 'embedding') return;
      if (!model.enabled) return;
      var label = model.name || model.id;
      var providerName = provider.name || provider.id;
      var selected = options === '' ? ' selected' : '';
      options += '<option value="' + model.id + '"' + selected + '>' + label + ' (' + providerName + ')</option>';
      console.log('[CodexLens] Added option:', label, 'from', providerName);
    });
  });

  if (options === '') {
    console.warn('[CodexLens] No embedding models found in LiteLLM config');
    options = '<option value="" disabled selected>' + (t('codexlens.noApiModels') || 'No API embedding models configured') + '</option>';
  }

  return options;
}

// Make functions globally accessible
window.onEmbeddingBackendChange = onEmbeddingBackendChange;

/**
 * Initialize index from page with selected model
 */
function initCodexLensIndexFromPage(indexType) {
  var backendSelect = document.getElementById('pageBackendSelect');
  var modelSelect = document.getElementById('pageModelSelect');
  var concurrencyInput = document.getElementById('pageConcurrencyInput');
  var selectedBackend = backendSelect ? backendSelect.value : 'fastembed';
  var selectedModel = modelSelect ? modelSelect.value : 'code';
  var selectedConcurrency = concurrencyInput ? Math.max(1, parseInt(concurrencyInput.value, 10) || 4) : 4;

  // For FTS-only index, model is not needed
  if (indexType === 'normal') {
    initCodexLensIndex(indexType);
  } else {
    // Pass concurrency only for litellm backend
    var maxWorkers = selectedBackend === 'litellm' ? selectedConcurrency : 1;
    initCodexLensIndex(indexType, selectedModel, selectedBackend, maxWorkers);
  }
}

/**
 * Initialize CodexLens Manager page event handlers
 */
function initCodexLensManagerPageEvents(currentConfig) {
  var saveBtn = document.getElementById('saveIndexPathBtn');
  if (saveBtn) {
    saveBtn.onclick = async function() {
      var indexDirInput = document.getElementById('indexDirInput');
      var newIndexDir = indexDirInput ? indexDirInput.value.trim() : '';
      if (!newIndexDir) { showRefreshToast(t('codexlens.pathEmpty'), 'error'); return; }
      if (newIndexDir === currentConfig.index_dir) { showRefreshToast(t('codexlens.pathUnchanged'), 'info'); return; }
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="animate-pulse">' + t('common.saving') + '</span>';
      try {
        var response = await fetch('/api/codexlens/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ index_dir: newIndexDir }) });
        var result = await response.json();
        if (result.success) { showRefreshToast(t('codexlens.configSaved'), 'success'); renderCodexLensManager(); }
        else { showRefreshToast(t('common.saveFailed') + ': ' + result.error, 'error'); }
      } catch (err) { showRefreshToast(t('common.error') + ': ' + err.message, 'error'); }
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i data-lucide="save" class="w-3.5 h-3.5"></i> ' + t('codexlens.saveConfig');
      if (window.lucide) lucide.createIcons();
    };
  }

  var runSearchBtn = document.getElementById('runSearchBtn');
  if (runSearchBtn) {
    runSearchBtn.onclick = async function() {
      var searchType = document.getElementById('searchTypeSelect').value;
      var searchMode = document.getElementById('searchModeSelect').value;
      var query = document.getElementById('searchQueryInput').value.trim();
      var resultsDiv = document.getElementById('searchResults');
      var resultCount = document.getElementById('searchResultCount');
      var resultContent = document.getElementById('searchResultContent');
      if (!query) { showRefreshToast(t('codexlens.enterQuery'), 'warning'); return; }
      runSearchBtn.disabled = true;
      runSearchBtn.innerHTML = '<span class="animate-pulse">' + t('codexlens.searching') + '</span>';
      resultsDiv.classList.add('hidden');
      try {
        var endpoint = '/api/codexlens/' + searchType;
        var params = new URLSearchParams({ query: query, limit: '20' });
        if (searchType === 'search' || searchType === 'search_files') { params.append('mode', searchMode); }
        var response = await fetch(endpoint + '?' + params.toString());
        var result = await response.json();
        if (result.success) {
          var results = result.results || result.files || [];
          resultCount.textContent = results.length + ' ' + t('codexlens.resultsCount');
          resultContent.textContent = JSON.stringify(results, null, 2);
          resultsDiv.classList.remove('hidden');
        } else {
          resultContent.textContent = t('common.error') + ': ' + (result.error || t('common.unknownError'));
          resultsDiv.classList.remove('hidden');
        }
      } catch (err) {
        resultContent.textContent = t('common.exception') + ': ' + err.message;
        resultsDiv.classList.remove('hidden');
      }
      runSearchBtn.disabled = false;
      runSearchBtn.innerHTML = '<i data-lucide="search" class="w-3.5 h-3.5"></i> ' + t('codexlens.runSearch');
      if (window.lucide) lucide.createIcons();
    };
  }

  var searchInput = document.getElementById('searchQueryInput');
  if (searchInput) { searchInput.onkeypress = function(e) { if (e.key === 'Enter' && runSearchBtn) { runSearchBtn.click(); } }; }
}

/**
 * Show index initialization modal
 */
function showIndexInitModal() {
  // Use initCodexLensIndex with default settings
  initCodexLensIndex('vector', 'code');
}

/**
 * Load index stats for the CodexLens Manager page
 */
async function loadIndexStatsForPage() {
  try {
    var response = await fetch('/api/codexlens/indexes');
    if (!response.ok) throw new Error('Failed to load index stats');
    var data = await response.json();
    renderIndexStatsForPage(data);
  } catch (err) {
    console.error('[CodexLens] Failed to load index stats:', err);
    var tbody = document.getElementById('indexTableBody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-destructive text-sm">' + err.message + '</td></tr>';
    }
  }
}

/**
 * Render index stats in the CodexLens Manager page
 */
function renderIndexStatsForPage(data) {
  var summary = data.summary || {};
  var indexes = data.indexes || [];
  var indexDir = data.indexDir || '';

  // Update summary stats
  var totalSizeEl = document.getElementById('indexTotalSize');
  var projectCountEl = document.getElementById('indexProjectCount');
  var totalSizeValEl = document.getElementById('indexTotalSizeVal');
  var vectorCountEl = document.getElementById('indexVectorCount');
  var ftsCountEl = document.getElementById('indexFtsCount');
  var indexDirEl = document.getElementById('indexDirDisplay');

  if (totalSizeEl) totalSizeEl.textContent = summary.totalSizeFormatted || '0 B';
  if (projectCountEl) projectCountEl.textContent = summary.totalProjects || 0;
  if (totalSizeValEl) totalSizeValEl.textContent = summary.totalSizeFormatted || '0 B';
  if (vectorCountEl) vectorCountEl.textContent = summary.vectorIndexCount || 0;
  if (ftsCountEl) ftsCountEl.textContent = summary.normalIndexCount || 0;
  if (indexDirEl && indexDir) {
    indexDirEl.textContent = indexDir;
    indexDirEl.title = indexDir;
  }

  // Render table rows
  var tbody = document.getElementById('indexTableBody');
  if (!tbody) return;

  if (indexes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-muted-foreground text-sm">' + (t('index.noIndexes') || 'No indexes yet') + '</td></tr>';
    return;
  }

  var rows = '';
  indexes.forEach(function(idx) {
    var vectorBadge = idx.hasVectorIndex
      ? '<span class="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded">' + (t('index.vector') || 'Vector') + '</span>'
      : '';
    var normalBadge = idx.hasNormalIndex
      ? '<span class="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded">' + (t('index.fts') || 'FTS') + '</span>'
      : '';

    rows += '<tr class="border-t border-border hover:bg-muted/30 transition-colors">' +
      '<td class="py-2 px-2 text-foreground">' +
        '<span class="font-mono text-xs truncate max-w-[250px] inline-block" title="' + escapeHtml(idx.id) + '">' + escapeHtml(idx.id) + '</span>' +
      '</td>' +
      '<td class="py-2 px-2 text-right text-muted-foreground">' + (idx.sizeFormatted || '-') + '</td>' +
      '<td class="py-2 px-2 text-center"><div class="flex items-center justify-center gap-1">' + vectorBadge + normalBadge + '</div></td>' +
      '<td class="py-2 px-2 text-right text-muted-foreground">' + formatTimeAgoSimple(idx.lastModified) + '</td>' +
      '<td class="py-2 px-1 text-center">' +
        '<button onclick="cleanIndexProjectFromPage(\'' + escapeHtml(idx.id) + '\')" ' +
          'class="text-destructive/70 hover:text-destructive p-1 rounded hover:bg-destructive/10 transition-colors" ' +
          'title="' + (t('index.cleanProject') || 'Clean Index') + '">' +
          '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i>' +
        '</button>' +
      '</td>' +
    '</tr>';
  });

  tbody.innerHTML = rows;
  if (window.lucide) lucide.createIcons();
}

/**
 * Simple time ago formatter
 */
function formatTimeAgoSimple(isoString) {
  if (!isoString) return t('common.never') || 'Never';
  var date = new Date(isoString);
  var now = new Date();
  var diffMs = now - date;
  var diffMins = Math.floor(diffMs / 60000);
  var diffHours = Math.floor(diffMins / 60);
  var diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return t('common.justNow') || 'Just now';
  if (diffMins < 60) return diffMins + 'm ' + (t('common.ago') || 'ago');
  if (diffHours < 24) return diffHours + 'h ' + (t('common.ago') || 'ago');
  if (diffDays < 30) return diffDays + 'd ' + (t('common.ago') || 'ago');
  return date.toLocaleDateString();
}

/**
 * Clean a specific project's index from the page
 */
async function cleanIndexProjectFromPage(projectId) {
  if (!confirm((t('index.cleanProjectConfirm') || 'Clean index for') + ' ' + projectId + '?')) {
    return;
  }

  try {
    showRefreshToast(t('index.cleaning') || 'Cleaning index...', 'info');

    var response = await fetch('/api/codexlens/clean', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: projectId })
    });

    var result = await response.json();

    if (result.success) {
      showRefreshToast(t('index.cleanSuccess') || 'Index cleaned successfully', 'success');
      await loadIndexStatsForPage();
    } else {
      showRefreshToast((t('index.cleanFailed') || 'Clean failed') + ': ' + result.error, 'error');
    }
  } catch (err) {
    showRefreshToast((t('common.error') || 'Error') + ': ' + err.message, 'error');
  }
}

/**
 * Clean all indexes from the page
 */
async function cleanAllIndexesFromPage() {
  if (!confirm(t('index.cleanAllConfirm') || 'Are you sure you want to clean ALL indexes? This cannot be undone.')) {
    return;
  }

  try {
    showRefreshToast(t('index.cleaning') || 'Cleaning indexes...', 'info');

    var response = await fetch('/api/codexlens/clean', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true })
    });

    var result = await response.json();

    if (result.success) {
      showRefreshToast(t('index.cleanAllSuccess') || 'All indexes cleaned', 'success');
      await loadIndexStatsForPage();
    } else {
      showRefreshToast((t('index.cleanFailed') || 'Clean failed') + ': ' + result.error, 'error');
    }
  } catch (err) {
    showRefreshToast((t('common.error') || 'Error') + ': ' + err.message, 'error');
  }
}

// ============================================================
// MULTI-PROVIDER ROTATION CONFIGURATION
// ============================================================

/**
 * Load and display rotation status in the page
 */
async function loadRotationStatus() {
  try {
    // Load from unified embedding-pool API (handles both new and legacy config)
    var response = await fetch('/api/litellm-api/embedding-pool');
    if (!response.ok) {
      console.warn('[CodexLens] Failed to load embedding pool config:', response.status);
      return;
    }
    var data = await response.json();
    window.embeddingPoolConfig = data.poolConfig;
    window.embeddingPoolAvailableModels = data.availableModels || [];

    // Also get endpoint count
    var endpointsResponse = await fetch('/api/litellm-api/codexlens/rotation/endpoints');
    var endpointsData = endpointsResponse.ok ? await endpointsResponse.json() : { count: 0 };

    updateRotationStatusDisplay(data.poolConfig, endpointsData.count);
  } catch (err) {
    console.error('[CodexLens] Error loading rotation status:', err);
  }
}

/**
 * Update the rotation status display in the page
 * @param {Object} poolConfig - The embedding pool configuration
 * @param {number} endpointCount - Number of active endpoints
 */
function updateRotationStatusDisplay(poolConfig, endpointCount) {
  var badge = document.getElementById('rotationStatusBadge');
  var detailsEl = document.getElementById('rotationDetails');
  var modelNameEl = document.getElementById('rotationModelName');
  var countEl = document.getElementById('rotationEndpointCount');

  if (!badge) return;

  if (poolConfig && poolConfig.enabled) {
    badge.textContent = t('common.enabled');
    badge.className = 'text-xs px-2 py-0.5 rounded-full bg-success/10 text-success';

    // Show details
    if (detailsEl) {
      detailsEl.classList.remove('hidden');
      if (modelNameEl) modelNameEl.textContent = poolConfig.targetModel || '';
      if (countEl) countEl.textContent = (endpointCount || 0) + ' ' + t('codexlens.totalEndpoints').toLowerCase();
    }
  } else {
    badge.textContent = t('common.disabled');
    badge.className = 'text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground';
    if (detailsEl) detailsEl.classList.add('hidden');
  }
}

/**
 * Navigate to API Settings Embedding Pool tab
 */
function navigateToApiSettingsEmbeddingPool() {
  // Navigate to API Settings page with embedding-pool tab
  if (typeof switchView === 'function') {
    switchView('api-settings');
    // Give time for page to render, then switch to embedding-pool tab
    setTimeout(function() {
      if (typeof switchSidebarTab === 'function') {
        switchSidebarTab('embedding-pool');
      }
    }, 100);
  }
}

/**
 * Show the rotation configuration modal
 */
async function showRotationConfigModal() {
  try {
    // Load current config if not already loaded
    if (!window.rotationConfig) {
      await loadRotationStatus();
    }

    var rotationConfig = window.rotationConfig || {
      enabled: false,
      strategy: 'round_robin',
      defaultCooldown: 60,
      targetModel: 'qwen3-embedding',
      providers: []
    };
    var availableProviders = window.availableRotationProviders || [];

    var modalHtml = buildRotationConfigModal(rotationConfig, availableProviders);

    var tempContainer = document.createElement('div');
    tempContainer.innerHTML = modalHtml;
    var modal = tempContainer.firstElementChild;
    document.body.appendChild(modal);

    if (window.lucide) lucide.createIcons();
    initRotationConfigEvents(rotationConfig, availableProviders);
  } catch (err) {
    showRefreshToast(t('common.error') + ': ' + err.message, 'error');
  }
}

/**
 * Build the rotation configuration modal HTML
 */
function buildRotationConfigModal(rotationConfig, availableProviders) {
  var isEnabled = rotationConfig.enabled || false;
  var strategy = rotationConfig.strategy || 'round_robin';
  var cooldown = rotationConfig.defaultCooldown || 60;
  var targetModel = rotationConfig.targetModel || 'qwen3-embedding';
  var configuredProviders = rotationConfig.providers || [];

  // Build provider list HTML
  var providerListHtml = '';
  if (availableProviders.length === 0) {
    providerListHtml = '<div class="text-sm text-muted-foreground py-4 text-center">' + t('codexlens.noRotationProviders') + '</div>';
  } else {
    availableProviders.forEach(function(provider, index) {
      // Find if this provider is already configured
      var configured = configuredProviders.find(function(p) { return p.providerId === provider.providerId; });
      var isProviderEnabled = configured ? configured.enabled : false;
      var weight = configured ? configured.weight : 1;
      var maxConcurrent = configured ? configured.maxConcurrentPerKey : 4;
      var useAllKeys = configured ? configured.useAllKeys : true;

      // Get model options
      var modelOptions = provider.embeddingModels.map(function(m) {
        var selected = configured && configured.modelId === m.modelId ? 'selected' : '';
        return '<option value="' + m.modelId + '" ' + selected + '>' + m.modelName + ' (' + m.dimensions + 'd)</option>';
      }).join('');

      // Get key count
      var keyCount = provider.apiKeys.filter(function(k) { return k.enabled; }).length;

      providerListHtml +=
        '<div class="border border-border rounded-lg p-3 ' + (isProviderEnabled ? 'bg-success/5 border-success/30' : 'bg-muted/30') + '" data-provider-id="' + provider.providerId + '">' +
          '<div class="flex items-center justify-between mb-2">' +
            '<div class="flex items-center gap-2">' +
              '<input type="checkbox" id="rotationProvider_' + index + '" ' + (isProviderEnabled ? 'checked' : '') +
                ' class="rotation-provider-toggle" data-provider-id="' + provider.providerId + '" />' +
              '<label for="rotationProvider_' + index + '" class="font-medium text-sm">' + provider.providerName + '</label>' +
              '<span class="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground">' + keyCount + ' keys</span>' +
            '</div>' +
          '</div>' +
          '<div class="grid grid-cols-2 gap-2 text-xs">' +
            '<div>' +
              '<label class="text-muted-foreground">Model</label>' +
              '<select class="w-full px-2 py-1 border border-border rounded bg-background text-sm rotation-model-select" data-provider-id="' + provider.providerId + '">' +
                modelOptions +
              '</select>' +
            '</div>' +
            '<div>' +
              '<label class="text-muted-foreground">' + t('codexlens.providerWeight') + '</label>' +
              '<input type="number" min="0.1" max="10" step="0.1" value="' + weight + '" ' +
                'class="w-full px-2 py-1 border border-border rounded bg-background text-sm rotation-weight-input" data-provider-id="' + provider.providerId + '" />' +
            '</div>' +
            '<div>' +
              '<label class="text-muted-foreground">' + t('codexlens.maxConcurrentPerKey') + '</label>' +
              '<input type="number" min="1" max="16" value="' + maxConcurrent + '" ' +
                'class="w-full px-2 py-1 border border-border rounded bg-background text-sm rotation-concurrent-input" data-provider-id="' + provider.providerId + '" />' +
            '</div>' +
            '<div class="flex items-center gap-1">' +
              '<input type="checkbox" id="useAllKeys_' + index + '" ' + (useAllKeys ? 'checked' : '') +
                ' class="rotation-use-all-keys" data-provider-id="' + provider.providerId + '" />' +
              '<label for="useAllKeys_' + index + '" class="text-muted-foreground">' + t('codexlens.useAllKeys') + '</label>' +
            '</div>' +
          '</div>' +
        '</div>';
    });
  }

  return '<div class="modal-backdrop" id="rotationConfigModal">' +
    '<div class="modal-container max-w-2xl">' +
      '<div class="modal-header">' +
        '<div class="flex items-center gap-3">' +
          '<div class="modal-icon">' +
            '<i data-lucide="rotate-cw" class="w-5 h-5"></i>' +
          '</div>' +
          '<div>' +
            '<h2 class="text-lg font-bold">' + t('codexlens.rotation') + '</h2>' +
            '<p class="text-xs text-muted-foreground">' + t('codexlens.rotationDesc') + '</p>' +
          '</div>' +
        '</div>' +
        '<button onclick="closeRotationModal()" class="text-muted-foreground hover:text-foreground">' +
          '<i data-lucide="x" class="w-5 h-5"></i>' +
        '</button>' +
      '</div>' +
      '<div class="modal-body space-y-4">' +
        // Enable toggle
        '<div class="flex items-center justify-between p-3 bg-muted/30 rounded-lg">' +
          '<div class="flex items-center gap-2">' +
            '<i data-lucide="power" class="w-4 h-4 text-primary"></i>' +
            '<span class="font-medium">' + t('codexlens.rotationEnabled') + '</span>' +
          '</div>' +
          '<label class="relative inline-flex items-center cursor-pointer">' +
            '<input type="checkbox" id="rotationEnabledToggle" ' + (isEnabled ? 'checked' : '') + ' class="sr-only peer" />' +
            '<div class="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>' +
          '</label>' +
        '</div>' +
        // Strategy and settings
        '<div class="grid grid-cols-2 gap-4">' +
          '<div>' +
            '<label class="block text-sm font-medium mb-1.5">' + t('codexlens.rotationStrategy') + '</label>' +
            '<select id="rotationStrategy" class="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm">' +
              '<option value="round_robin" ' + (strategy === 'round_robin' ? 'selected' : '') + '>' + t('codexlens.strategyRoundRobin') + '</option>' +
              '<option value="latency_aware" ' + (strategy === 'latency_aware' ? 'selected' : '') + '>' + t('codexlens.strategyLatencyAware') + '</option>' +
              '<option value="weighted_random" ' + (strategy === 'weighted_random' ? 'selected' : '') + '>' + t('codexlens.strategyWeightedRandom') + '</option>' +
            '</select>' +
          '</div>' +
          '<div>' +
            '<label class="block text-sm font-medium mb-1.5">' + t('codexlens.cooldownSeconds') + '</label>' +
            '<input type="number" id="rotationCooldown" min="1" max="300" value="' + cooldown + '" ' +
              'class="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm" />' +
            '<p class="text-xs text-muted-foreground mt-1">' + t('codexlens.cooldownHint') + '</p>' +
          '</div>' +
        '</div>' +
        // Target model
        '<div>' +
          '<label class="block text-sm font-medium mb-1.5">' + t('codexlens.targetModel') + '</label>' +
          '<input type="text" id="rotationTargetModel" value="' + targetModel + '" ' +
            'class="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm" placeholder="qwen3-embedding" />' +
          '<p class="text-xs text-muted-foreground mt-1">' + t('codexlens.targetModelHint') + '</p>' +
        '</div>' +
        // Provider list
        '<div>' +
          '<label class="block text-sm font-medium mb-1.5">' + t('codexlens.rotationProviders') + '</label>' +
          '<div class="space-y-2 max-h-64 overflow-y-auto" id="rotationProviderList">' +
            providerListHtml +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button onclick="closeRotationModal()" class="btn btn-outline">' + t('common.cancel') + '</button>' +
        '<button onclick="saveRotationConfig()" class="btn btn-primary">' +
          '<i data-lucide="save" class="w-4 h-4"></i> ' + t('common.save') +
        '</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

/**
 * Initialize rotation config modal events
 */
function initRotationConfigEvents(rotationConfig, availableProviders) {
  // Store in window for save function
  window._rotationAvailableProviders = availableProviders;
}

/**
 * Close the rotation config modal
 */
function closeRotationModal() {
  var modal = document.getElementById('rotationConfigModal');
  if (modal) modal.remove();
}

/**
 * Save the rotation configuration
 */
async function saveRotationConfig() {
  try {
    var enabledToggle = document.getElementById('rotationEnabledToggle');
    var strategySelect = document.getElementById('rotationStrategy');
    var cooldownInput = document.getElementById('rotationCooldown');
    var targetModelInput = document.getElementById('rotationTargetModel');

    var enabled = enabledToggle ? enabledToggle.checked : false;
    var strategy = strategySelect ? strategySelect.value : 'round_robin';
    var cooldown = cooldownInput ? parseInt(cooldownInput.value, 10) : 60;
    var targetModel = targetModelInput ? targetModelInput.value.trim() : 'qwen3-embedding';

    // Collect provider configurations
    var providers = [];
    var providerToggles = document.querySelectorAll('.rotation-provider-toggle');
    providerToggles.forEach(function(toggle) {
      var providerId = toggle.getAttribute('data-provider-id');
      var isEnabled = toggle.checked;

      var modelSelect = document.querySelector('.rotation-model-select[data-provider-id="' + providerId + '"]');
      var weightInput = document.querySelector('.rotation-weight-input[data-provider-id="' + providerId + '"]');
      var concurrentInput = document.querySelector('.rotation-concurrent-input[data-provider-id="' + providerId + '"]');
      var useAllKeysToggle = document.querySelector('.rotation-use-all-keys[data-provider-id="' + providerId + '"]');

      providers.push({
        providerId: providerId,
        modelId: modelSelect ? modelSelect.value : '',
        weight: weightInput ? parseFloat(weightInput.value) || 1 : 1,
        maxConcurrentPerKey: concurrentInput ? parseInt(concurrentInput.value, 10) || 4 : 4,
        useAllKeys: useAllKeysToggle ? useAllKeysToggle.checked : true,
        enabled: isEnabled
      });
    });

    var rotationConfig = {
      enabled: enabled,
      strategy: strategy,
      defaultCooldown: cooldown,
      targetModel: targetModel,
      providers: providers
    };

    var response = await fetch('/api/litellm-api/codexlens/rotation', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rotationConfig)
    });

    var result = await response.json();

    if (result.success) {
      // Show sync result in toast
      var syncMsg = '';
      if (result.syncResult) {
        if (result.syncResult.success) {
          syncMsg = ' (' + result.syncResult.endpointCount + ' ' + t('codexlens.endpointsSynced') + ')';
        } else {
          syncMsg = ' (' + t('codexlens.syncFailed') + ': ' + result.syncResult.message + ')';
        }
      }
      showRefreshToast(t('codexlens.rotationSaved') + syncMsg, 'success');
      window.rotationConfig = rotationConfig;
      updateRotationStatusDisplay(rotationConfig);
      closeRotationModal();
    } else {
      showRefreshToast(t('common.saveFailed') + ': ' + result.error, 'error');
    }
  } catch (err) {
    showRefreshToast(t('common.error') + ': ' + err.message, 'error');
  }
}
