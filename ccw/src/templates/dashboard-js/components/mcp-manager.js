// MCP Manager Component
// Manages MCP server configuration from .claude.json

// ========== MCP State ==========
let mcpConfig = null;
let mcpAllProjects = {};
let mcpCurrentProjectServers = {};

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

  // Collect servers from all projects
  for (const [path, config] of Object.entries(mcpAllProjects)) {
    const servers = config.mcpServers || {};
    for (const [name, serverConfig] of Object.entries(servers)) {
      if (!allServers[name]) {
        allServers[name] = {
          config: serverConfig,
          usedIn: []
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
    // Clear form
    document.getElementById('mcpServerName').value = '';
    document.getElementById('mcpServerCommand').value = '';
    document.getElementById('mcpServerArgs').value = '';
    document.getElementById('mcpServerEnv').value = '';
    // Focus on name input
    document.getElementById('mcpServerName').focus();
  }
}

function closeMcpCreateModal() {
  const modal = document.getElementById('mcpCreateModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

async function submitMcpCreate() {
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
