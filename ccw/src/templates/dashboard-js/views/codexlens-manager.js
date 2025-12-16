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
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);

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
            '<span class="font-medium">' + (isInstalled ? t('codexlens.installed') : t('codexlens.notInstalled')) + '</span>' +
          '</div>' +
          '<div class="flex items-center gap-2">' +
            '<span class="text-muted-foreground">' + t('codexlens.indexes') + ':</span>' +
            '<span class="font-medium">' + indexCount + '</span>' +
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
            ? '<button class="btn-sm btn-outline" onclick="initCodexLensIndex()">' +
                '<i data-lucide="database" class="w-3 h-3"></i> ' + t('codexlens.initializeIndex') +
              '</button>' +
              '<button class="btn-sm btn-outline" onclick="cleanCodexLensIndexes()">' +
                '<i data-lucide="trash" class="w-3 h-3"></i> ' + t('codexlens.cleanAllIndexes') +
              '</button>' +
              '<button class="btn-sm btn-outline btn-danger" onclick="uninstallCodexLens()">' +
                '<i data-lucide="trash-2" class="w-3 h-3"></i> ' + t('cli.uninstall') +
              '</button>'
            : '<button class="btn-sm btn-primary" onclick="installCodexLens()">' +
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

// ============================================================
// SEMANTIC DEPENDENCIES MANAGEMENT
// ============================================================

/**
 * Load semantic dependencies status
 */
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

/**
 * Install semantic dependencies
 */
async function installSemanticDeps() {
  var container = document.getElementById('semanticDepsStatus');
  if (!container) return;

  container.innerHTML =
    '<div class="text-sm text-muted-foreground animate-pulse">' + t('codexlens.installingDeps') + '</div>';

  try {
    var response = await fetch('/api/codexlens/semantic/install', { method: 'POST' });
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

// ============================================================
// MODEL MANAGEMENT
// ============================================================

/**
 * Load model list
 */
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

/**
 * Download model
 */
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
 * Initialize CodexLens index
 */
function initCodexLensIndex() {
  openCliInstallWizard('codexlens');
}

/**
 * Install CodexLens
 */
function installCodexLens() {
  openCliInstallWizard('codexlens');
}

/**
 * Uninstall CodexLens
 */
function uninstallCodexLens() {
  openCliUninstallWizard('codexlens');
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
