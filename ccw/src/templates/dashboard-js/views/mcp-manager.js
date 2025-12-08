// MCP Manager View
// Renders the MCP server management interface

async function renderMcpManager() {
  const container = document.getElementById('mainContent');
  if (!container) return;

  // Hide stats grid and search for MCP view
  const statsGrid = document.getElementById('statsGrid');
  const searchInput = document.getElementById('searchInput');
  if (statsGrid) statsGrid.style.display = 'none';
  if (searchInput) searchInput.parentElement.style.display = 'none';

  // Load MCP config if not already loaded
  if (!mcpConfig) {
    await loadMcpConfig();
  }

  const currentPath = projectPath.replace(/\//g, '\\');
  const projectData = mcpAllProjects[currentPath] || {};
  const projectServers = projectData.mcpServers || {};
  const disabledServers = projectData.disabledMcpServers || [];

  // Get all available servers from all projects
  const allAvailableServers = getAllAvailableMcpServers();

  // Separate current project servers and available servers
  const currentProjectServerNames = Object.keys(projectServers);

  // Separate enterprise, user, and other project servers
  const enterpriseServerEntries = Object.entries(mcpEnterpriseServers || {})
    .filter(([name]) => !currentProjectServerNames.includes(name));
  const userServerEntries = Object.entries(mcpUserServers || {})
    .filter(([name]) => !currentProjectServerNames.includes(name) && !(mcpEnterpriseServers || {})[name]);
  const otherProjectServers = Object.entries(allAvailableServers)
    .filter(([name, info]) => !currentProjectServerNames.includes(name) && !info.isGlobal);

  container.innerHTML = `
    <div class="mcp-manager">
      <!-- Current Project MCP Servers -->
      <div class="mcp-section mb-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <h3 class="text-lg font-semibold text-foreground">Current Project MCP Servers</h3>
            <button class="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1"
                    onclick="openMcpCreateModal()">
              <span>+</span> New Server
            </button>
          </div>
          <span class="text-sm text-muted-foreground">${currentProjectServerNames.length} servers configured</span>
        </div>

        ${currentProjectServerNames.length === 0 ? `
          <div class="mcp-empty-state bg-card border border-border rounded-lg p-6 text-center">
            <div class="text-3xl mb-3">🔌</div>
            <p class="text-muted-foreground">No MCP servers configured for this project</p>
            <p class="text-sm text-muted-foreground mt-1">Add servers from the available list below</p>
          </div>
        ` : `
          <div class="mcp-server-grid grid gap-3">
            ${currentProjectServerNames.map(serverName => {
              const serverConfig = projectServers[serverName];
              const isEnabled = !disabledServers.includes(serverName);
              return renderMcpServerCard(serverName, serverConfig, isEnabled, true);
            }).join('')}
          </div>
        `}
      </div>

      <!-- Enterprise MCP Servers (Managed) -->
      ${enterpriseServerEntries.length > 0 ? `
        <div class="mcp-section mb-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <span class="text-lg">🏢</span>
              <h3 class="text-lg font-semibold text-foreground">Enterprise MCP Servers</h3>
              <span class="text-xs px-2 py-0.5 bg-warning/20 text-warning rounded-full">Managed</span>
            </div>
            <span class="text-sm text-muted-foreground">${enterpriseServerEntries.length} servers (read-only)</span>
          </div>

          <div class="mcp-server-grid grid gap-3">
            ${enterpriseServerEntries.map(([serverName, serverConfig]) => {
              return renderEnterpriseServerCard(serverName, serverConfig);
            }).join('')}
          </div>
        </div>
      ` : ''}

      <!-- User MCP Servers -->
      ${userServerEntries.length > 0 ? `
        <div class="mcp-section mb-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <span class="text-lg">👤</span>
              <h3 class="text-lg font-semibold text-foreground">User MCP Servers</h3>
            </div>
            <span class="text-sm text-muted-foreground">${userServerEntries.length} servers from ~/.claude.json</span>
          </div>

          <div class="mcp-server-grid grid gap-3">
            ${userServerEntries.map(([serverName, serverConfig]) => {
              return renderGlobalServerCard(serverName, serverConfig, 'user');
            }).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Available MCP Servers from Other Projects -->
      <div class="mcp-section">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-foreground">Available from Other Projects</h3>
          <span class="text-sm text-muted-foreground">${otherProjectServers.length} servers available</span>
        </div>

        ${otherProjectServers.length === 0 ? `
          <div class="mcp-empty-state bg-card border border-border rounded-lg p-6 text-center">
            <p class="text-muted-foreground">No additional MCP servers found in other projects</p>
          </div>
        ` : `
          <div class="mcp-server-grid grid gap-3">
            ${otherProjectServers.map(([serverName, serverInfo]) => {
              return renderAvailableServerCard(serverName, serverInfo);
            }).join('')}
          </div>
        `}
      </div>

      <!-- All Projects MCP Overview Table -->
      <div class="mcp-section mt-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-foreground">All Projects MCP Overview</h3>
          <span class="text-sm text-muted-foreground">${Object.keys(mcpAllProjects).length} projects</span>
        </div>

        <div class="mcp-projects-table bg-card border border-border rounded-lg overflow-hidden">
          <table class="w-full">
            <thead class="bg-muted/50">
              <tr>
                <th class="text-left px-4 py-3 text-sm font-semibold text-foreground border-b border-border">Project</th>
                <th class="text-left px-4 py-3 text-sm font-semibold text-foreground border-b border-border">MCP Servers</th>
                <th class="text-center px-4 py-3 text-sm font-semibold text-foreground border-b border-border w-24">Status</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(mcpAllProjects).map(([path, config]) => {
                const servers = config.mcpServers || {};
                const projectDisabled = config.disabledMcpServers || [];
                const serverNames = Object.keys(servers);
                const isCurrentProject = path === currentPath;
                const enabledCount = serverNames.filter(s => !projectDisabled.includes(s)).length;

                return `
                  <tr class="border-b border-border last:border-b-0 ${isCurrentProject ? 'bg-primary/5' : 'hover:bg-hover/50'}">
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-2 min-w-0">
                        <span class="text-base shrink-0">${isCurrentProject ? '📍' : '📁'}</span>
                        <div class="min-w-0">
                          <div class="font-medium text-foreground truncate text-sm" title="${escapeHtml(path)}">
                            ${escapeHtml(path.split('\\').pop() || path)}
                            ${isCurrentProject ? '<span class="ml-2 text-xs text-primary font-medium">(Current)</span>' : ''}
                          </div>
                          <div class="text-xs text-muted-foreground truncate">${escapeHtml(path)}</div>
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex flex-wrap gap-1.5">
                        ${serverNames.length === 0
                          ? '<span class="text-xs text-muted-foreground italic">No MCP servers</span>'
                          : serverNames.map(serverName => {
                              const isEnabled = !projectDisabled.includes(serverName);
                              return `
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${isEnabled ? 'bg-success-light text-success' : 'bg-hover text-muted-foreground'}">
                                  <span class="w-1.5 h-1.5 rounded-full ${isEnabled ? 'bg-success' : 'bg-muted-foreground'}"></span>
                                  ${escapeHtml(serverName)}
                                </span>
                              `;
                            }).join('')
                        }
                      </div>
                    </td>
                    <td class="px-4 py-3 text-center">
                      <span class="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${serverNames.length > 0 ? 'bg-success-light text-success' : 'bg-hover text-muted-foreground'}">
                        ${enabledCount}/${serverNames.length}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners for toggle switches
  attachMcpEventListeners();
}

function renderMcpServerCard(serverName, serverConfig, isEnabled, isInCurrentProject) {
  const command = serverConfig.command || 'N/A';
  const args = serverConfig.args || [];
  const hasEnv = serverConfig.env && Object.keys(serverConfig.env).length > 0;

  return `
    <div class="mcp-server-card bg-card border border-border rounded-lg p-4 hover:shadow-md transition-all ${isEnabled ? '' : 'opacity-60'}">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="text-xl">${isEnabled ? '🟢' : '🔴'}</span>
          <h4 class="font-semibold text-foreground">${escapeHtml(serverName)}</h4>
        </div>
        <label class="mcp-toggle relative inline-flex items-center cursor-pointer">
          <input type="checkbox" class="sr-only peer"
                 ${isEnabled ? 'checked' : ''}
                 data-server-name="${escapeHtml(serverName)}"
                 data-action="toggle">
          <div class="w-9 h-5 bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-success"></div>
        </label>
      </div>

      <div class="mcp-server-details text-sm space-y-1">
        <div class="flex items-center gap-2 text-muted-foreground">
          <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">cmd</span>
          <span class="truncate" title="${escapeHtml(command)}">${escapeHtml(command)}</span>
        </div>
        ${args.length > 0 ? `
          <div class="flex items-start gap-2 text-muted-foreground">
            <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">args</span>
            <span class="text-xs font-mono truncate" title="${escapeHtml(args.join(' '))}">${escapeHtml(args.slice(0, 3).join(' '))}${args.length > 3 ? '...' : ''}</span>
          </div>
        ` : ''}
        ${hasEnv ? `
          <div class="flex items-center gap-2 text-muted-foreground">
            <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">env</span>
            <span class="text-xs">${Object.keys(serverConfig.env).length} variables</span>
          </div>
        ` : ''}
      </div>

      ${isInCurrentProject ? `
        <div class="mt-3 pt-3 border-t border-border">
          <button class="text-xs text-destructive hover:text-destructive/80 transition-colors"
                  data-server-name="${escapeHtml(serverName)}"
                  data-action="remove">
            Remove from project
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderAvailableServerCard(serverName, serverInfo) {
  const serverConfig = serverInfo.config;
  const usedIn = serverInfo.usedIn || [];
  const command = serverConfig.command || 'N/A';

  return `
    <div class="mcp-server-card mcp-server-available bg-card border border-border border-dashed rounded-lg p-4 hover:shadow-md hover:border-solid transition-all">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="text-xl">⚪</span>
          <h4 class="font-semibold text-foreground">${escapeHtml(serverName)}</h4>
        </div>
        <button class="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
                data-server-name="${escapeHtml(serverName)}"
                data-server-config='${JSON.stringify(serverConfig).replace(/'/g, "&#39;")}'
                data-action="add">
          Add
        </button>
      </div>

      <div class="mcp-server-details text-sm space-y-1">
        <div class="flex items-center gap-2 text-muted-foreground">
          <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">cmd</span>
          <span class="truncate" title="${escapeHtml(command)}">${escapeHtml(command)}</span>
        </div>
        <div class="flex items-center gap-2 text-muted-foreground">
          <span class="text-xs">Used in ${usedIn.length} project${usedIn.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  `;
}

function renderGlobalServerCard(serverName, serverConfig, source = 'user') {
  const command = serverConfig.command || serverConfig.url || 'N/A';
  const args = serverConfig.args || [];
  const hasEnv = serverConfig.env && Object.keys(serverConfig.env).length > 0;
  const serverType = serverConfig.type || 'stdio';

  return `
    <div class="mcp-server-card mcp-server-global bg-card border border-primary/30 rounded-lg p-4 hover:shadow-md transition-all">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="text-xl">👤</span>
          <h4 class="font-semibold text-foreground">${escapeHtml(serverName)}</h4>
          <span class="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">User</span>
        </div>
        <button class="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
                data-server-name="${escapeHtml(serverName)}"
                data-server-config='${JSON.stringify(serverConfig).replace(/'/g, "&#39;")}'
                data-action="add">
          Add to Project
        </button>
      </div>

      <div class="mcp-server-details text-sm space-y-1">
        <div class="flex items-center gap-2 text-muted-foreground">
          <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">${serverType === 'stdio' ? 'cmd' : 'url'}</span>
          <span class="truncate" title="${escapeHtml(command)}">${escapeHtml(command)}</span>
        </div>
        ${args.length > 0 ? `
          <div class="flex items-start gap-2 text-muted-foreground">
            <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">args</span>
            <span class="text-xs font-mono truncate" title="${escapeHtml(args.join(' '))}">${escapeHtml(args.slice(0, 3).join(' '))}${args.length > 3 ? '...' : ''}</span>
          </div>
        ` : ''}
        ${hasEnv ? `
          <div class="flex items-center gap-2 text-muted-foreground">
            <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">env</span>
            <span class="text-xs">${Object.keys(serverConfig.env).length} variables</span>
          </div>
        ` : ''}
        <div class="flex items-center gap-2 text-muted-foreground mt-1">
          <span class="text-xs italic">Available to all projects from ~/.claude.json</span>
        </div>
      </div>
    </div>
  `;
}

function renderEnterpriseServerCard(serverName, serverConfig) {
  const command = serverConfig.command || serverConfig.url || 'N/A';
  const args = serverConfig.args || [];
  const hasEnv = serverConfig.env && Object.keys(serverConfig.env).length > 0;
  const serverType = serverConfig.type || 'stdio';

  return `
    <div class="mcp-server-card mcp-server-enterprise bg-card border border-warning/30 rounded-lg p-4 hover:shadow-md transition-all">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="text-xl">🏢</span>
          <h4 class="font-semibold text-foreground">${escapeHtml(serverName)}</h4>
          <span class="text-xs px-2 py-0.5 bg-warning/20 text-warning rounded-full">Enterprise</span>
          <span class="text-xs text-muted-foreground">🔒</span>
        </div>
        <span class="px-3 py-1 text-xs bg-muted text-muted-foreground rounded cursor-not-allowed">
          Read-only
        </span>
      </div>

      <div class="mcp-server-details text-sm space-y-1">
        <div class="flex items-center gap-2 text-muted-foreground">
          <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">${serverType === 'stdio' ? 'cmd' : 'url'}</span>
          <span class="truncate" title="${escapeHtml(command)}">${escapeHtml(command)}</span>
        </div>
        ${args.length > 0 ? `
          <div class="flex items-start gap-2 text-muted-foreground">
            <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">args</span>
            <span class="text-xs font-mono truncate" title="${escapeHtml(args.join(' '))}">${escapeHtml(args.slice(0, 3).join(' '))}${args.length > 3 ? '...' : ''}</span>
          </div>
        ` : ''}
        ${hasEnv ? `
          <div class="flex items-center gap-2 text-muted-foreground">
            <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">env</span>
            <span class="text-xs">${Object.keys(serverConfig.env).length} variables</span>
          </div>
        ` : ''}
        <div class="flex items-center gap-2 text-muted-foreground mt-1">
          <span class="text-xs italic">Managed by organization (highest priority)</span>
        </div>
      </div>
    </div>
  `;
}

function attachMcpEventListeners() {
  // Toggle switches
  document.querySelectorAll('.mcp-server-card input[data-action="toggle"]').forEach(input => {
    input.addEventListener('change', async (e) => {
      const serverName = e.target.dataset.serverName;
      const enable = e.target.checked;
      await toggleMcpServer(serverName, enable);
    });
  });

  // Add buttons
  document.querySelectorAll('.mcp-server-card button[data-action="add"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const serverName = e.target.dataset.serverName;
      const serverConfig = JSON.parse(e.target.dataset.serverConfig);
      await copyMcpServerToProject(serverName, serverConfig);
    });
  });

  // Remove buttons
  document.querySelectorAll('.mcp-server-card button[data-action="remove"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const serverName = e.target.dataset.serverName;
      if (confirm(`Remove MCP server "${serverName}" from this project?`)) {
        await removeMcpServerFromProject(serverName);
      }
    });
  });
}
