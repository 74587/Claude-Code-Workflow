// API Settings View
// Manages LiteLLM API providers, custom endpoints, and cache settings

// ========== State Management ==========
var apiSettingsData = null;
var providerModels = {};
var currentModal = null;

// ========== Data Loading ==========

/**
 * Load API configuration
 */
async function loadApiSettings() {
  try {
    var response = await fetch('/api/litellm-api/config');
    if (!response.ok) throw new Error('Failed to load API settings');
    apiSettingsData = await response.json();
    return apiSettingsData;
  } catch (err) {
    console.error('Failed to load API settings:', err);
    showRefreshToast(t('common.error') + ': ' + err.message, 'error');
    return null;
  }
}

/**
 * Load available models for a provider type
 */
async function loadProviderModels(providerType) {
  try {
    var response = await fetch('/api/litellm-api/models/' + providerType);
    if (!response.ok) throw new Error('Failed to load models');
    var data = await response.json();
    providerModels[providerType] = data.models || [];
    return data.models;
  } catch (err) {
    console.error('Failed to load provider models:', err);
    return [];
  }
}

/**
 * Load cache statistics
 */
async function loadCacheStats() {
  try {
    var response = await fetch('/api/litellm-api/cache/stats');
    if (!response.ok) throw new Error('Failed to load cache stats');
    return await response.json();
  } catch (err) {
    console.error('Failed to load cache stats:', err);
    return { enabled: false, totalSize: 0, maxSize: 104857600, entries: 0 };
  }
}

// ========== Provider Management ==========

/**
 * Show add provider modal
 */
async function showAddProviderModal() {
  var modalHtml = '<div class="generic-modal-overlay active" id="providerModal">' +
    '<div class="generic-modal">' +
    '<div class="generic-modal-header">' +
    '<h3 class="generic-modal-title">' + t('apiSettings.addProvider') + '</h3>' +
    '<button class="generic-modal-close" onclick="closeProviderModal()">&times;</button>' +
    '</div>' +
    '<div class="generic-modal-body">' +
    '<form id="providerForm" class="api-settings-form">' +
    '<div class="form-group">' +
    '<label for="provider-type">' + t('apiSettings.providerType') + '</label>' +
    '<select id="provider-type" class="cli-input" required>' +
    '<option value="openai">OpenAI</option>' +
    '<option value="anthropic">Anthropic</option>' +
    '<option value="google">Google</option>' +
    '<option value="ollama">Ollama</option>' +
    '<option value="azure">Azure</option>' +
    '<option value="mistral">Mistral AI</option>' +
    '<option value="deepseek">DeepSeek</option>' +
    '<option value="custom">Custom</option>' +
    '</select>' +
    '</div>' +
    '<div class="form-group">' +
    '<label for="provider-name">' + t('apiSettings.displayName') + '</label>' +
    '<input type="text" id="provider-name" class="cli-input" placeholder="My OpenAI" required />' +
    '</div>' +
    '<div class="form-group">' +
    '<label for="provider-apikey">' + t('apiSettings.apiKey') + '</label>' +
    '<div class="api-key-input-group">' +
    '<input type="password" id="provider-apikey" class="cli-input" placeholder="sk-..." required />' +
    '<button type="button" class="btn-icon" onclick="toggleApiKeyVisibility(\'provider-apikey\')" title="' + t('apiSettings.toggleVisibility') + '">' +
    '<i data-lucide="eye"></i>' +
    '</button>' +
    '</div>' +
    '<label class="checkbox-label">' +
    '<input type="checkbox" id="use-env-var" onchange="toggleEnvVarInput()" /> ' +
    t('apiSettings.useEnvVar') +
    '</label>' +
    '<input type="text" id="env-var-name" class="cli-input" placeholder="OPENAI_API_KEY" style="display:none; margin-top: 0.5rem;" />' +
    '</div>' +
    '<div class="form-group">' +
    '<label for="provider-apibase">' + t('apiSettings.apiBaseUrl') + ' <span class="text-muted">(' + t('common.optional') + ')</span></label>' +
    '<input type="text" id="provider-apibase" class="cli-input" placeholder="https://api.openai.com/v1" />' +
    '</div>' +
    '<div class="form-group">' +
    '<label class="checkbox-label">' +
    '<input type="checkbox" id="provider-enabled" checked /> ' +
    t('apiSettings.enableProvider') +
    '</label>' +
    '</div>' +
    '<div class="modal-actions">' +
    '<button type="button" class="btn btn-secondary" onclick="testProviderConnection()">' +
    '<i data-lucide="wifi"></i> ' + t('apiSettings.testConnection') +
    '</button>' +
    '<button type="button" class="btn btn-secondary" onclick="closeProviderModal()">' + t('common.cancel') + '</button>' +
    '<button type="submit" class="btn btn-primary">' +
    '<i data-lucide="save"></i> ' + t('common.save') +
    '</button>' +
    '</div>' +
    '</form>' +
    '</div>' +
    '</div>' +
    '</div>';

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  document.getElementById('providerForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    await saveProvider();
  });

  if (window.lucide) lucide.createIcons();
}

/**
 * Show edit provider modal
 */
async function showEditProviderModal(providerId) {
  if (!apiSettingsData) return;

  var provider = apiSettingsData.providers?.find(function(p) { return p.id === providerId; });
  if (!provider) return;

  await showAddProviderModal();

  // Update modal title
  document.querySelector('#providerModal .generic-modal-title').textContent = t('apiSettings.editProvider');

  // Populate form
  document.getElementById('provider-type').value = provider.type;
  document.getElementById('provider-name').value = provider.name;
  document.getElementById('provider-apikey').value = provider.apiKey;
  if (provider.apiBase) {
    document.getElementById('provider-apibase').value = provider.apiBase;
  }
  document.getElementById('provider-enabled').checked = provider.enabled !== false;

  // Store provider ID for update
  document.getElementById('providerForm').dataset.providerId = providerId;
}

/**
 * Save provider (create or update)
 */
async function saveProvider() {
  var form = document.getElementById('providerForm');
  var providerId = form.dataset.providerId;

  var useEnvVar = document.getElementById('use-env-var').checked;
  var apiKey = useEnvVar
    ? '${' + document.getElementById('env-var-name').value + '}'
    : document.getElementById('provider-apikey').value;

  var providerData = {
    type: document.getElementById('provider-type').value,
    name: document.getElementById('provider-name').value,
    apiKey: apiKey,
    apiBase: document.getElementById('provider-apibase').value || undefined,
    enabled: document.getElementById('provider-enabled').checked
  };

  try {
    var url = providerId
      ? '/api/litellm-api/providers/' + providerId
      : '/api/litellm-api/providers';
    var method = providerId ? 'PUT' : 'POST';

    var response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(providerData)
    });

    if (!response.ok) throw new Error('Failed to save provider');

    var result = await response.json();
    showRefreshToast(t('apiSettings.providerSaved'), 'success');

    closeProviderModal();
    await renderApiSettings();
  } catch (err) {
    console.error('Failed to save provider:', err);
    showRefreshToast(t('common.error') + ': ' + err.message, 'error');
  }
}

/**
 * Delete provider
 */
async function deleteProvider(providerId) {
  if (!confirm(t('apiSettings.confirmDeleteProvider'))) return;

  try {
    var response = await fetch('/api/litellm-api/providers/' + providerId, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('Failed to delete provider');

    showRefreshToast(t('apiSettings.providerDeleted'), 'success');
    await renderApiSettings();
  } catch (err) {
    console.error('Failed to delete provider:', err);
    showRefreshToast(t('common.error') + ': ' + err.message, 'error');
  }
}

/**
 * Test provider connection
 */
async function testProviderConnection() {
  var form = document.getElementById('providerForm');
  var providerId = form.dataset.providerId;

  if (!providerId) {
    showRefreshToast(t('apiSettings.saveProviderFirst'), 'warning');
    return;
  }

  try {
    var response = await fetch('/api/litellm-api/providers/' + providerId + '/test', {
      method: 'POST'
    });

    if (!response.ok) throw new Error('Failed to test provider');

    var result = await response.json();

    if (result.success) {
      showRefreshToast(t('apiSettings.connectionSuccess'), 'success');
    } else {
      showRefreshToast(t('apiSettings.connectionFailed') + ': ' + (result.error || 'Unknown error'), 'error');
    }
  } catch (err) {
    console.error('Failed to test provider:', err);
    showRefreshToast(t('common.error') + ': ' + err.message, 'error');
  }
}

/**
 * Close provider modal
 */
function closeProviderModal() {
  var modal = document.getElementById('providerModal');
  if (modal) modal.remove();
}

/**
 * Toggle API key visibility
 */
function toggleApiKeyVisibility(inputId) {
  var input = document.getElementById(inputId);
  var icon = event.target.closest('button').querySelector('i');

  if (input.type === 'password') {
    input.type = 'text';
    icon.setAttribute('data-lucide', 'eye-off');
  } else {
    input.type = 'password';
    icon.setAttribute('data-lucide', 'eye');
  }

  if (window.lucide) lucide.createIcons();
}

/**
 * Toggle environment variable input
 */
function toggleEnvVarInput() {
  var useEnvVar = document.getElementById('use-env-var').checked;
  var apiKeyInput = document.getElementById('provider-apikey');
  var envVarInput = document.getElementById('env-var-name');

  if (useEnvVar) {
    apiKeyInput.style.display = 'none';
    apiKeyInput.required = false;
    envVarInput.style.display = 'block';
    envVarInput.required = true;
  } else {
    apiKeyInput.style.display = 'block';
    apiKeyInput.required = true;
    envVarInput.style.display = 'none';
    envVarInput.required = false;
  }
}

// ========== Endpoint Management ==========

/**
 * Show add endpoint modal
 */
async function showAddEndpointModal() {
  if (!apiSettingsData || !apiSettingsData.providers || apiSettingsData.providers.length === 0) {
    showRefreshToast(t('apiSettings.addProviderFirst'), 'warning');
    return;
  }

  var providerOptions = apiSettingsData.providers
    .filter(function(p) { return p.enabled !== false; })
    .map(function(p) {
      return '<option value="' + p.id + '">' + p.name + ' (' + p.type + ')</option>';
    })
    .join('');

  var modalHtml = '<div class="generic-modal-overlay active" id="endpointModal">' +
    '<div class="generic-modal">' +
    '<div class="generic-modal-header">' +
    '<h3 class="generic-modal-title">' + t('apiSettings.addEndpoint') + '</h3>' +
    '<button class="generic-modal-close" onclick="closeEndpointModal()">&times;</button>' +
    '</div>' +
    '<div class="generic-modal-body">' +
    '<form id="endpointForm" class="api-settings-form">' +
    '<div class="form-group">' +
    '<label for="endpoint-id">' + t('apiSettings.endpointId') + '</label>' +
    '<input type="text" id="endpoint-id" class="cli-input" placeholder="my-gpt4o" required />' +
    '<small class="form-hint">' + t('apiSettings.endpointIdHint') + '</small>' +
    '</div>' +
    '<div class="form-group">' +
    '<label for="endpoint-name">' + t('apiSettings.displayName') + '</label>' +
    '<input type="text" id="endpoint-name" class="cli-input" placeholder="GPT-4o for Code Review" required />' +
    '</div>' +
    '<div class="form-group">' +
    '<label for="endpoint-provider">' + t('apiSettings.provider') + '</label>' +
    '<select id="endpoint-provider" class="cli-input" onchange="loadModelsForProvider()" required>' +
    providerOptions +
    '</select>' +
    '</div>' +
    '<div class="form-group">' +
    '<label for="endpoint-model">' + t('apiSettings.model') + '</label>' +
    '<select id="endpoint-model" class="cli-input" required>' +
    '<option value="">' + t('apiSettings.selectModel') + '</option>' +
    '</select>' +
    '</div>' +
    '<fieldset class="form-fieldset">' +
    '<legend>' + t('apiSettings.cacheStrategy') + '</legend>' +
    '<label class="checkbox-label">' +
    '<input type="checkbox" id="cache-enabled" onchange="toggleCacheSettings()" /> ' +
    t('apiSettings.enableContextCaching') +
    '</label>' +
    '<div id="cache-settings" style="display:none;">' +
    '<div class="form-group">' +
    '<label for="cache-ttl">' + t('apiSettings.cacheTTL') + '</label>' +
    '<input type="number" id="cache-ttl" class="cli-input" value="60" min="1" />' +
    '</div>' +
    '<div class="form-group">' +
    '<label for="cache-maxsize">' + t('apiSettings.cacheMaxSize') + '</label>' +
    '<input type="number" id="cache-maxsize" class="cli-input" value="512" min="1" />' +
    '</div>' +
    '<div class="form-group">' +
    '<label for="cache-patterns">' + t('apiSettings.autoCachePatterns') + '</label>' +
    '<input type="text" id="cache-patterns" class="cli-input" placeholder="*.ts, *.md, CLAUDE.md" />' +
    '</div>' +
    '</div>' +
    '</fieldset>' +
    '<div class="modal-actions">' +
    '<button type="button" class="btn btn-secondary" onclick="closeEndpointModal()">' + t('common.cancel') + '</button>' +
    '<button type="submit" class="btn btn-primary">' +
    '<i data-lucide="save"></i> ' + t('common.save') +
    '</button>' +
    '</div>' +
    '</form>' +
    '</div>' +
    '</div>' +
    '</div>';

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  document.getElementById('endpointForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    await saveEndpoint();
  });

  // Load models for first provider
  await loadModelsForProvider();

  if (window.lucide) lucide.createIcons();
}

/**
 * Show edit endpoint modal
 */
async function showEditEndpointModal(endpointId) {
  if (!apiSettingsData) return;

  var endpoint = apiSettingsData.endpoints?.find(function(e) { return e.id === endpointId; });
  if (!endpoint) return;

  await showAddEndpointModal();

  // Update modal title
  document.querySelector('#endpointModal .generic-modal-title').textContent = t('apiSettings.editEndpoint');

  // Populate form
  document.getElementById('endpoint-id').value = endpoint.id;
  document.getElementById('endpoint-id').disabled = true;
  document.getElementById('endpoint-name').value = endpoint.name;
  document.getElementById('endpoint-provider').value = endpoint.providerId;

  await loadModelsForProvider();
  document.getElementById('endpoint-model').value = endpoint.model;

  if (endpoint.cacheStrategy) {
    document.getElementById('cache-enabled').checked = endpoint.cacheStrategy.enabled;
    if (endpoint.cacheStrategy.enabled) {
      toggleCacheSettings();
      document.getElementById('cache-ttl').value = endpoint.cacheStrategy.ttlMinutes || 60;
      document.getElementById('cache-maxsize').value = endpoint.cacheStrategy.maxSizeKB || 512;
      document.getElementById('cache-patterns').value = endpoint.cacheStrategy.autoCachePatterns?.join(', ') || '';
    }
  }

  // Store endpoint ID for update
  document.getElementById('endpointForm').dataset.endpointId = endpointId;
}

/**
 * Save endpoint (create or update)
 */
async function saveEndpoint() {
  var form = document.getElementById('endpointForm');
  var endpointId = form.dataset.endpointId || document.getElementById('endpoint-id').value;

  var cacheEnabled = document.getElementById('cache-enabled').checked;
  var cacheStrategy = cacheEnabled ? {
    enabled: true,
    ttlMinutes: parseInt(document.getElementById('cache-ttl').value) || 60,
    maxSizeKB: parseInt(document.getElementById('cache-maxsize').value) || 512,
    autoCachePatterns: document.getElementById('cache-patterns').value
      .split(',')
      .map(function(p) { return p.trim(); })
      .filter(function(p) { return p; })
  } : { enabled: false };

  var endpointData = {
    id: endpointId,
    name: document.getElementById('endpoint-name').value,
    providerId: document.getElementById('endpoint-provider').value,
    model: document.getElementById('endpoint-model').value,
    cacheStrategy: cacheStrategy
  };

  try {
    var url = form.dataset.endpointId
      ? '/api/litellm-api/endpoints/' + form.dataset.endpointId
      : '/api/litellm-api/endpoints';
    var method = form.dataset.endpointId ? 'PUT' : 'POST';

    var response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(endpointData)
    });

    if (!response.ok) throw new Error('Failed to save endpoint');

    var result = await response.json();
    showRefreshToast(t('apiSettings.endpointSaved'), 'success');

    closeEndpointModal();
    await renderApiSettings();
  } catch (err) {
    console.error('Failed to save endpoint:', err);
    showRefreshToast(t('common.error') + ': ' + err.message, 'error');
  }
}

/**
 * Delete endpoint
 */
async function deleteEndpoint(endpointId) {
  if (!confirm(t('apiSettings.confirmDeleteEndpoint'))) return;

  try {
    var response = await fetch('/api/litellm-api/endpoints/' + endpointId, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('Failed to delete endpoint');

    showRefreshToast(t('apiSettings.endpointDeleted'), 'success');
    await renderApiSettings();
  } catch (err) {
    console.error('Failed to delete endpoint:', err);
    showRefreshToast(t('common.error') + ': ' + err.message, 'error');
  }
}

/**
 * Close endpoint modal
 */
function closeEndpointModal() {
  var modal = document.getElementById('endpointModal');
  if (modal) modal.remove();
}

/**
 * Load models for selected provider
 */
async function loadModelsForProvider() {
  var providerSelect = document.getElementById('endpoint-provider');
  var modelSelect = document.getElementById('endpoint-model');

  if (!providerSelect || !modelSelect) return;

  var providerId = providerSelect.value;
  var provider = apiSettingsData.providers.find(function(p) { return p.id === providerId; });

  if (!provider) return;

  // Load models for provider type
  var models = await loadProviderModels(provider.type);

  modelSelect.innerHTML = '<option value="">' + t('apiSettings.selectModel') + '</option>' +
    models.map(function(m) {
      var desc = m.description ? ' - ' + m.description : '';
      return '<option value="' + m.id + '">' + m.name + desc + '</option>';
    }).join('');
}

/**
 * Toggle cache settings visibility
 */
function toggleCacheSettings() {
  var enabled = document.getElementById('cache-enabled').checked;
  var settings = document.getElementById('cache-settings');
  settings.style.display = enabled ? 'block' : 'none';
}

// ========== Cache Management ==========

/**
 * Clear cache
 */
async function clearCache() {
  if (!confirm(t('apiSettings.confirmClearCache'))) return;

  try {
    var response = await fetch('/api/litellm-api/cache/clear', {
      method: 'POST'
    });

    if (!response.ok) throw new Error('Failed to clear cache');

    var result = await response.json();
    showRefreshToast(t('apiSettings.cacheCleared') + ' (' + result.removed + ' entries)', 'success');

    await renderApiSettings();
  } catch (err) {
    console.error('Failed to clear cache:', err);
    showRefreshToast(t('common.error') + ': ' + err.message, 'error');
  }
}

/**
 * Toggle global cache
 */
async function toggleGlobalCache() {
  var enabled = document.getElementById('global-cache-enabled').checked;

  try {
    var response = await fetch('/api/litellm-api/config/cache', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: enabled })
    });

    if (!response.ok) throw new Error('Failed to update cache settings');

    showRefreshToast(t('apiSettings.cacheSettingsUpdated'), 'success');
  } catch (err) {
    console.error('Failed to update cache settings:', err);
    showRefreshToast(t('common.error') + ': ' + err.message, 'error');
    // Revert checkbox
    document.getElementById('global-cache-enabled').checked = !enabled;
  }
}

// ========== Rendering ==========

/**
 * Render API Settings page
 */
async function renderApiSettings() {
  var container = document.getElementById('mainContent');
  if (!container) return;

  // Hide stats grid and search
  var statsGrid = document.getElementById('statsGrid');
  var searchInput = document.getElementById('searchInput');
  if (statsGrid) statsGrid.style.display = 'none';
  if (searchInput) searchInput.parentElement.style.display = 'none';

  // Load data
  await loadApiSettings();
  var cacheStats = await loadCacheStats();

  if (!apiSettingsData) {
    container.innerHTML = '<div class="api-settings-container">' +
      '<div class="error-message">' + t('apiSettings.failedToLoad') + '</div>' +
      '</div>';
    return;
  }

  container.innerHTML = '<div class="api-settings-container">' +
    '<div class="api-settings-section">' +
    '<div class="section-header">' +
    '<h3>' + t('apiSettings.providers') + '</h3>' +
    '<button class="btn btn-primary" onclick="showAddProviderModal()">' +
    '<i data-lucide="plus"></i> ' + t('apiSettings.addProvider') +
    '</button>' +
    '</div>' +
    '<div id="providers-list" class="api-settings-list"></div>' +
    '</div>' +
    '<div class="api-settings-section">' +
    '<div class="section-header">' +
    '<h3>' + t('apiSettings.customEndpoints') + '</h3>' +
    '<button class="btn btn-primary" onclick="showAddEndpointModal()">' +
    '<i data-lucide="plus"></i> ' + t('apiSettings.addEndpoint') +
    '</button>' +
    '</div>' +
    '<div id="endpoints-list" class="api-settings-list"></div>' +
    '</div>' +
    '<div class="api-settings-section">' +
    '<div class="section-header">' +
    '<h3>' + t('apiSettings.cacheSettings') + '</h3>' +
    '</div>' +
    '<div id="cache-settings-panel" class="cache-settings-panel"></div>' +
    '</div>' +
    '</div>';

  renderProvidersList();
  renderEndpointsList();
  renderCacheSettings(cacheStats);

  if (window.lucide) lucide.createIcons();
}

/**
 * Render providers list
 */
function renderProvidersList() {
  var container = document.getElementById('providers-list');
  if (!container) return;

  var providers = apiSettingsData.providers || [];

  if (providers.length === 0) {
    container.innerHTML = '<div class="empty-state">' +
      '<i data-lucide="cloud-off" class="empty-icon"></i>' +
      '<p>' + t('apiSettings.noProviders') + '</p>' +
      '</div>';
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = providers.map(function(provider) {
    var statusClass = provider.enabled === false ? 'disabled' : 'enabled';
    var statusText = provider.enabled === false ? t('apiSettings.disabled') : t('apiSettings.enabled');

    return '<div class="api-settings-card provider-card ' + statusClass + '">' +
      '<div class="card-header">' +
      '<div class="card-info">' +
      '<h4>' + provider.name + '</h4>' +
      '<span class="provider-type-badge">' + provider.type + '</span>' +
      '</div>' +
      '<div class="card-actions">' +
      '<button class="btn-icon" onclick="showEditProviderModal(\'' + provider.id + '\')" title="' + t('common.edit') + '">' +
      '<i data-lucide="edit"></i>' +
      '</button>' +
      '<button class="btn-icon btn-danger" onclick="deleteProvider(\'' + provider.id + '\')" title="' + t('common.delete') + '">' +
      '<i data-lucide="trash-2"></i>' +
      '</button>' +
      '</div>' +
      '</div>' +
      '<div class="card-body">' +
      '<div class="card-meta">' +
      '<span><i data-lucide="key"></i> ' + maskApiKey(provider.apiKey) + '</span>' +
      (provider.apiBase ? '<span><i data-lucide="globe"></i> ' + provider.apiBase + '</span>' : '') +
      '<span class="status-badge status-' + statusClass + '">' + statusText + '</span>' +
      '</div>' +
      '</div>' +
      '</div>';
  }).join('');

  if (window.lucide) lucide.createIcons();
}

/**
 * Render endpoints list
 */
function renderEndpointsList() {
  var container = document.getElementById('endpoints-list');
  if (!container) return;

  var endpoints = apiSettingsData.endpoints || [];

  if (endpoints.length === 0) {
    container.innerHTML = '<div class="empty-state">' +
      '<i data-lucide="layers-off" class="empty-icon"></i>' +
      '<p>' + t('apiSettings.noEndpoints') + '</p>' +
      '</div>';
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = endpoints.map(function(endpoint) {
    var provider = apiSettingsData.providers.find(function(p) { return p.id === endpoint.providerId; });
    var providerName = provider ? provider.name : endpoint.providerId;

    var cacheStatus = endpoint.cacheStrategy?.enabled
      ? t('apiSettings.cacheEnabled') + ' (' + endpoint.cacheStrategy.ttlMinutes + ' min)'
      : t('apiSettings.cacheDisabled');

    return '<div class="api-settings-card endpoint-card">' +
      '<div class="card-header">' +
      '<div class="card-info">' +
      '<h4>' + endpoint.name + '</h4>' +
      '<code class="endpoint-id">' + endpoint.id + '</code>' +
      '</div>' +
      '<div class="card-actions">' +
      '<button class="btn-icon" onclick="showEditEndpointModal(\'' + endpoint.id + '\')" title="' + t('common.edit') + '">' +
      '<i data-lucide="edit"></i>' +
      '</button>' +
      '<button class="btn-icon btn-danger" onclick="deleteEndpoint(\'' + endpoint.id + '\')" title="' + t('common.delete') + '">' +
      '<i data-lucide="trash-2"></i>' +
      '</button>' +
      '</div>' +
      '</div>' +
      '<div class="card-body">' +
      '<div class="card-meta">' +
      '<span><i data-lucide="server"></i> ' + providerName + '</span>' +
      '<span><i data-lucide="cpu"></i> ' + endpoint.model + '</span>' +
      '<span><i data-lucide="database"></i> ' + cacheStatus + '</span>' +
      '</div>' +
      '<div class="usage-hint">' +
      '<i data-lucide="terminal"></i> ' +
      '<code>ccw cli -p "..." --model ' + endpoint.id + '</code>' +
      '</div>' +
      '</div>' +
      '</div>';
  }).join('');

  if (window.lucide) lucide.createIcons();
}

/**
 * Render cache settings panel
 */
function renderCacheSettings(stats) {
  var container = document.getElementById('cache-settings-panel');
  if (!container) return;

  var globalSettings = apiSettingsData.globalCache || { enabled: false };
  var usedMB = (stats.totalSize / 1024 / 1024).toFixed(2);
  var maxMB = (stats.maxSize / 1024 / 1024).toFixed(0);
  var usagePercent = stats.maxSize > 0 ? ((stats.totalSize / stats.maxSize) * 100).toFixed(1) : 0;

  container.innerHTML = '<div class="cache-settings-content">' +
    '<label class="checkbox-label">' +
    '<input type="checkbox" id="global-cache-enabled" ' + (globalSettings.enabled ? 'checked' : '') + ' onchange="toggleGlobalCache()" /> ' +
    t('apiSettings.enableGlobalCaching') +
    '</label>' +
    '<div class="cache-stats">' +
    '<div class="stat-item">' +
    '<span class="stat-label">' + t('apiSettings.cacheUsed') + '</span>' +
    '<span class="stat-value">' + usedMB + ' MB / ' + maxMB + ' MB (' + usagePercent + '%)</span>' +
    '</div>' +
    '<div class="stat-item">' +
    '<span class="stat-label">' + t('apiSettings.cacheEntries') + '</span>' +
    '<span class="stat-value">' + stats.entries + '</span>' +
    '</div>' +
    '<div class="progress-bar">' +
    '<div class="progress-fill" style="width: ' + usagePercent + '%"></div>' +
    '</div>' +
    '</div>' +
    '<button class="btn btn-secondary" onclick="clearCache()">' +
    '<i data-lucide="trash-2"></i> ' + t('apiSettings.clearCache') +
    '</button>' +
    '</div>';

  if (window.lucide) lucide.createIcons();
}

// ========== Utility Functions ==========

/**
 * Mask API key for display
 */
function maskApiKey(apiKey) {
  if (!apiKey) return '';
  if (apiKey.startsWith('${')) return apiKey; // Environment variable
  if (apiKey.length <= 8) return '***';
  return apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
}
