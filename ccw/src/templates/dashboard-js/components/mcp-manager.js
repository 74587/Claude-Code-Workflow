// MCP Manager Component
// Manages MCP server configuration from .claude.json

// ========== MCP State ==========
let mcpConfig = null;
let mcpAllProjects = {};
let mcpGlobalServers = {};
let mcpCurrentProjectServers = {};
let mcpCreateMode = 'form'; // 'form' or 'json'

// ========== Initialization ==========
function initMcpManager() {
  // Initialize MCP navigation
  document.querySelectorAll('.nav-item[data-view="mcp-manager"]').forEach(item => {
    item.addEventListener('click', () => {
      setActiveNavItem(item);
      currentView = 'mcp-manager';
      currentFilter = null;
      currentLiteType = null;
      currentSessionDetailKey = null;
      updateContentTitle();
      renderMcpManager();
    });
  });
}

// ========== Data Loading ==========
async function loadMcpConfig() {
  try {
    const response = await fetch('/api/mcp-config');
    if (!response.ok) throw new Error('Failed to load MCP config');
    const data = await response.json();
    mcpConfig = data;
    mcpAllProjects = data.projects || {};
    mcpGlobalServers = data.globalServers || {};

    // Get current project servers
    const currentPath = projectPath.replace(/\//g, '\\');
    mcpCurrentProjectServers = mcpAllProjects[currentPath]?.mcpServers || {};

    // Update badge count
    updateMcpBadge();

    return data;
  } catch (err) {
    console.error('Failed to load MCP config:', err);
    return null;
  }
}

async function toggleMcpServer(serverName, enable) {
  try {
    const response = await fetch('/api/mcp-toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectPath: projectPath,
        serverName: serverName,
        enable: enable
      })
    });

    if (!response.ok) throw new Error('Failed to toggle MCP server');

    const result = await response.json();
    if (result.success) {
      // Reload config and re-render
      await loadMcpConfig();
      renderMcpManager();
      showRefreshToast(`MCP server "${serverName}" ${enable ? 'enabled' : 'disabled'}`, 'success');
    }
    return result;
  } catch (err) {
    console.error('Failed to toggle MCP server:', err);
    showRefreshToast(`Failed to toggle MCP server: ${err.message}`, 'error');
    return null;
  }
}

async function copyMcpServerToProject(serverName, serverConfig) {
  try {
    const response = await fetch('/api/mcp-copy-server', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectPath: projectPath,
        serverName: serverName,
        serverConfig: serverConfig
      })
    });

    if (!response.ok) throw new Error('Failed to copy MCP server');

    const result = await response.json();
    if (result.success) {
      await loadMcpConfig();
      renderMcpManager();
      showRefreshToast(`MCP server "${serverName}" added to project`, 'success');
    }
    return result;
  } catch (err) {
    console.error('Failed to copy MCP server:', err);
    showRefreshToast(`Failed to add MCP server: ${err.message}`, 'error');
    return null;
  }
}

async function removeMcpServerFromProject(serverName) {
  try {
    const response = await fetch('/api/mcp-remove-server', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectPath: projectPath,
        serverName: serverName
      })
    });

    if (!response.ok) throw new Error('Failed to remove MCP server');

    const result = await response.json();
    if (result.success) {
      await loadMcpConfig();
      renderMcpManager();
      showRefreshToast(`MCP server "${serverName}" removed from project`, 'success');
    }
    return result;
  } catch (err) {
    console.error('Failed to remove MCP server:', err);
    showRefreshToast(`Failed to remove MCP server: ${err.message}`, 'error');
    return null;
  }
}

// ========== Badge Update ==========
function updateMcpBadge() {
  const badge = document.getElementById('badgeMcpServers');
  if (badge) {
    const currentPath = projectPath.replace(/\//g, '\\');
    const projectData = mcpAllProjects[currentPath];
    const servers = projectData?.mcpServers || {};
    const disabledServers = projectData?.disabledMcpServers || [];

    const totalServers = Object.keys(servers).length;
    const enabledServers = totalServers - disabledServers.length;

    badge.textContent = `${enabledServers}/${totalServers}`;
  }
}

// ========== Helpers ==========
function getAllAvailableMcpServers() {
  const allServers = {};

  // Collect global servers first
  for (const [name, serverConfig] of Object.entries(mcpGlobalServers)) {
    allServers[name] = {
      config: serverConfig,
      usedIn: [],
      isGlobal: true
    };
  }

  // Collect servers from all projects
  for (const [path, config] of Object.entries(mcpAllProjects)) {
    const servers = config.mcpServers || {};
    for (const [name, serverConfig] of Object.entries(servers)) {
      if (!allServers[name]) {
        allServers[name] = {
          config: serverConfig,
          usedIn: [],
          isGlobal: false
        };
      }
      allServers[name].usedIn.push(path);
    }
  }

  return allServers;
}

function isServerEnabledInCurrentProject(serverName) {
  const currentPath = projectPath.replace(/\//g, '\\');
  const projectData = mcpAllProjects[currentPath];
  if (!projectData) return false;

  const disabledServers = projectData.disabledMcpServers || [];
  return !disabledServers.includes(serverName);
}

function isServerInCurrentProject(serverName) {
  const currentPath = projectPath.replace(/\//g, '\\');
  const projectData = mcpAllProjects[currentPath];
  if (!projectData) return false;

  const servers = projectData.mcpServers || {};
  return serverName in servers;
}

// ========== MCP Create Modal ==========
function openMcpCreateModal() {
  const modal = document.getElementById('mcpCreateModal');
  if (modal) {
    modal.classList.remove('hidden');
    // Reset to form mode
    mcpCreateMode = 'form';
    switchMcpCreateTab('form');
    // Clear form
    document.getElementById('mcpServerName').value = '';
    document.getElementById('mcpServerCommand').value = '';
    document.getElementById('mcpServerArgs').value = '';
    document.getElementById('mcpServerEnv').value = '';
    // Clear JSON input
    document.getElementById('mcpServerJson').value = '';
    document.getElementById('mcpJsonPreview').classList.add('hidden');
    // Focus on name input
    document.getElementById('mcpServerName').focus();
    // Setup JSON input listener
    setupMcpJsonListener();
  }
}

function closeMcpCreateModal() {
  const modal = document.getElementById('mcpCreateModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function switchMcpCreateTab(tab) {
  mcpCreateMode = tab;
  const formMode = document.getElementById('mcpFormMode');
  const jsonMode = document.getElementById('mcpJsonMode');
  const tabForm = document.getElementById('mcpTabForm');
  const tabJson = document.getElementById('mcpTabJson');

  if (tab === 'form') {
    formMode.classList.remove('hidden');
    jsonMode.classList.add('hidden');
    tabForm.classList.add('active');
    tabJson.classList.remove('active');
  } else {
    formMode.classList.add('hidden');
    jsonMode.classList.remove('hidden');
    tabForm.classList.remove('active');
    tabJson.classList.add('active');
  }
}

function setupMcpJsonListener() {
  const jsonInput = document.getElementById('mcpServerJson');
  if (jsonInput && !jsonInput.hasAttribute('data-listener-attached')) {
    jsonInput.setAttribute('data-listener-attached', 'true');
    jsonInput.addEventListener('input', () => {
      updateMcpJsonPreview();
    });
  }
}

function parseMcpJsonConfig(jsonText) {
  if (!jsonText.trim()) {
    return { servers: {}, error: null };
  }

  try {
    const parsed = JSON.parse(jsonText);
    let servers = {};

    // Support multiple formats:
    // 1. {"servers": {...}} format (claude desktop style)
    // 2. {"mcpServers": {...}} format (claude.json style)
    // 3. {"serverName": {command, args}} format (direct server config)
    // 4. {command, args} format (single server without name)

    if (parsed.servers && typeof parsed.servers === 'object') {
      servers = parsed.servers;
    } else if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
      servers = parsed.mcpServers;
    } else if (parsed.command && typeof parsed.command === 'string') {
      // Single server without name - will prompt for name
      servers = { '__unnamed__': parsed };
    } else {
      // Check if all values are server configs (have 'command' property)
      const isDirectServerConfig = Object.values(parsed).every(
        v => v && typeof v === 'object' && v.command
      );
      if (isDirectServerConfig && Object.keys(parsed).length > 0) {
        servers = parsed;
      } else {
        return { servers: {}, error: 'Invalid MCP server JSON format' };
      }
    }

    // Validate each server config
    for (const [name, config] of Object.entries(servers)) {
      if (!config.command || typeof config.command !== 'string') {
        return { servers: {}, error: `Server "${name}" missing required "command" field` };
      }
      if (config.args && !Array.isArray(config.args)) {
        return { servers: {}, error: `Server "${name}" has invalid "args" (must be array)` };
      }
      if (config.env && typeof config.env !== 'object') {
        return { servers: {}, error: `Server "${name}" has invalid "env" (must be object)` };
      }
    }

    return { servers, error: null };
  } catch (e) {
    return { servers: {}, error: 'Invalid JSON: ' + e.message };
  }
}

function updateMcpJsonPreview() {
  const jsonInput = document.getElementById('mcpServerJson');
  const previewContainer = document.getElementById('mcpJsonPreview');
  const previewContent = document.getElementById('mcpJsonPreviewContent');

  const jsonText = jsonInput.value;
  const { servers, error } = parseMcpJsonConfig(jsonText);

  if (!jsonText.trim()) {
    previewContainer.classList.add('hidden');
    return;
  }

  previewContainer.classList.remove('hidden');

  if (error) {
    previewContent.innerHTML = `<div class="text-destructive">${escapeHtml(error)}</div>`;
    return;
  }

  const serverCount = Object.keys(servers).length;
  if (serverCount === 0) {
    previewContent.innerHTML = `<div class="text-muted-foreground">No servers found</div>`;
    return;
  }

  const previewHtml = Object.entries(servers).map(([name, config]) => {
    const displayName = name === '__unnamed__' ? '(will prompt for name)' : name;
    const argsPreview = config.args ? config.args.slice(0, 2).join(' ') + (config.args.length > 2 ? '...' : '') : '';
    return `
      <div class="flex items-center gap-2 p-2 bg-background rounded">
        <span class="text-success">+</span>
        <span class="font-medium">${escapeHtml(displayName)}</span>
        <span class="text-muted-foreground text-xs">${escapeHtml(config.command)} ${escapeHtml(argsPreview)}</span>
      </div>
    `;
  }).join('');

  previewContent.innerHTML = previewHtml;
}

async function submitMcpCreate() {
  if (mcpCreateMode === 'json') {
    await submitMcpCreateFromJson();
  } else {
    await submitMcpCreateFromForm();
  }
}

async function submitMcpCreateFromForm() {
  const name = document.getElementById('mcpServerName').value.trim();
  const command = document.getElementById('mcpServerCommand').value.trim();
  const argsText = document.getElementById('mcpServerArgs').value.trim();
  const envText = document.getElementById('mcpServerEnv').value.trim();

  // Validate required fields
  if (!name) {
    showRefreshToast('Server name is required', 'error');
    document.getElementById('mcpServerName').focus();
    return;
  }

  if (!command) {
    showRefreshToast('Command is required', 'error');
    document.getElementById('mcpServerCommand').focus();
    return;
  }

  // Parse args (one per line)
  const args = argsText ? argsText.split('\n').map(a => a.trim()).filter(a => a) : [];

  // Parse env vars (KEY=VALUE per line)
  const env = {};
  if (envText) {
    envText.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && trimmed.includes('=')) {
        const eqIndex = trimmed.indexOf('=');
        const key = trimmed.substring(0, eqIndex).trim();
        const value = trimmed.substring(eqIndex + 1).trim();
        if (key) {
          env[key] = value;
        }
      }
    });
  }

  // Build server config
  const serverConfig = {
    command: command,
    args: args
  };

  // Only add env if there are values
  if (Object.keys(env).length > 0) {
    serverConfig.env = env;
  }

  await createMcpServerWithConfig(name, serverConfig);
}

async function submitMcpCreateFromJson() {
  const jsonText = document.getElementById('mcpServerJson').value.trim();

  if (!jsonText) {
    showRefreshToast('Please enter JSON configuration', 'error');
    document.getElementById('mcpServerJson').focus();
    return;
  }

  const { servers, error } = parseMcpJsonConfig(jsonText);

  if (error) {
    showRefreshToast(error, 'error');
    return;
  }

  if (Object.keys(servers).length === 0) {
    showRefreshToast('No valid servers found in JSON', 'error');
    return;
  }

  // Handle unnamed server case
  if (servers['__unnamed__']) {
    const serverName = prompt('Enter a name for this MCP server:');
    if (!serverName || !serverName.trim()) {
      showRefreshToast('Server name is required', 'error');
      return;
    }
    servers[serverName.trim()] = servers['__unnamed__'];
    delete servers['__unnamed__'];
  }

  // Add all servers
  let successCount = 0;
  let failCount = 0;
  const serverNames = Object.keys(servers);

  for (const [name, config] of Object.entries(servers)) {
    try {
      const response = await fetch('/api/mcp-copy-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectPath: projectPath,
          serverName: name,
          serverConfig: config
        })
      });

      if (!response.ok) throw new Error('Failed to create MCP server');

      const result = await response.json();
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (err) {
      console.error(`Failed to create MCP server "${name}":`, err);
      failCount++;
    }
  }

  closeMcpCreateModal();
  await loadMcpConfig();
  renderMcpManager();

  if (failCount === 0) {
    showRefreshToast(`${successCount} MCP server${successCount > 1 ? 's' : ''} created successfully`, 'success');
  } else if (successCount > 0) {
    showRefreshToast(`${successCount} created, ${failCount} failed`, 'warning');
  } else {
    showRefreshToast('Failed to create MCP servers', 'error');
  }
}

async function createMcpServerWithConfig(name, serverConfig) {
  // Submit to API
  try {
    const response = await fetch('/api/mcp-copy-server', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectPath: projectPath,
        serverName: name,
        serverConfig: serverConfig
      })
    });

    if (!response.ok) throw new Error('Failed to create MCP server');

    const result = await response.json();
    if (result.success) {
      closeMcpCreateModal();
      await loadMcpConfig();
      renderMcpManager();
      showRefreshToast(`MCP server "${name}" created successfully`, 'success');
    } else {
      showRefreshToast(result.error || 'Failed to create MCP server', 'error');
    }
  } catch (err) {
    console.error('Failed to create MCP server:', err);
    showRefreshToast(`Failed to create MCP server: ${err.message}`, 'error');
  }
}
