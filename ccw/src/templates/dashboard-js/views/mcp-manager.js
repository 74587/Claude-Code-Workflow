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
  // Check if CCW Tools is already installed
  const isCcwToolsInstalled = currentProjectServerNames.includes("ccw-tools");


  container.innerHTML = `
    <div class="mcp-manager">
      <!-- CCW Tools MCP Server Card -->
      <div class="mcp-section mb-6">
        <div class="ccw-tools-card bg-gradient-to-br from-primary/10 to-primary/5 border-2 ${isCcwToolsInstalled ? 'border-success' : 'border-primary/30'} rounded-lg p-6 hover:shadow-lg transition-all">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-start gap-4 flex-1">
              <div class="shrink-0 w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <i data-lucide="wrench" class="w-6 h-6 text-primary-foreground"></i>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-2">
                  <h3 class="text-lg font-bold text-foreground">CCW Tools MCP</h3>
                  ${isCcwToolsInstalled ? `
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-success-light text-success">
                      <i data-lucide="check" class="w-3 h-3"></i>
                      Installed
                    </span>
                  ` : `
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-primary/20 text-primary">
                      <i data-lucide="package" class="w-3 h-3"></i>
                      Available
                    </span>
                  `}
                </div>
                <p class="text-sm text-muted-foreground mb-3">
                  CCW built-in tools for file editing, code search, session management, and more
                </p>
                <div class="flex items-center gap-4 text-xs text-muted-foreground">
                  <span class="flex items-center gap-1">
                    <i data-lucide="layers" class="w-3 h-3"></i>
                    15 tools available
                  </span>
                  <span class="flex items-center gap-1">
                    <i data-lucide="zap" class="w-3 h-3"></i>
                    Native integration
                  </span>
                  <span class="flex items-center gap-1">
                    <i data-lucide="shield-check" class="w-3 h-3"></i>
                    Built-in & tested
                  </span>
                </div>
              </div>
            </div>
            <div class="shrink-0">
              ${isCcwToolsInstalled ? `
                <button class="px-4 py-2 text-sm bg-muted text-muted-foreground rounded-lg cursor-not-allowed" disabled>
                  <i data-lucide="check" class="w-4 h-4 inline mr-1"></i>
                  Installed
                </button>
              ` : `
                <button class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
                        onclick="installCcwToolsMcp()">
                  <i data-lucide="download" class="w-4 h-4"></i>
                  Install CCW Tools
                </button>
              `}
            </div>
          </div>
        </div>
      </div>

      <!-- Current Project MCP Servers -->
      <div class="mcp-section mb-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <h3 class="text-lg font-semibold text-foreground">${t('mcp.currentProject')}</h3>
            <button class="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1"
                    onclick="openMcpCreateModal()">
              <span>+</span> ${t('mcp.newServer')}
            </button>
          </div>
          <span class="text-sm text-muted-foreground">${currentProjectServerNames.length} ${t('mcp.serversConfigured')}</span>
        </div>

        ${currentProjectServerNames.length === 0 ? `
          <div class="mcp-empty-state bg-card border border-border rounded-lg p-6 text-center">
            <div class="text-muted-foreground mb-3"><i data-lucide="plug" class="w-10 h-10 mx-auto"></i></div>
            <p class="text-muted-foreground">${t('empty.noMcpServers')}</p>
            <p class="text-sm text-muted-foreground mt-1">${t('empty.addMcpServersHint')}</p>
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
              <i data-lucide="building-2" class="w-5 h-5"></i>
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
              <i data-lucide="user" class="w-5 h-5"></i>
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
          <h3 class="text-lg font-semibold text-foreground">${t('mcp.availableOther')}</h3>
          <span class="text-sm text-muted-foreground">${otherProjectServers.length} ${t('mcp.serversAvailable')}</span>
        </div>

        ${otherProjectServers.length === 0 ? `
          <div class="mcp-empty-state bg-card border border-border rounded-lg p-6 text-center">
            <p class="text-muted-foreground">${t('empty.noAdditionalMcp')}</p>
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
          <h3 class="text-lg font-semibold text-foreground">${t('mcp.allProjects')}</h3>
          <span class="text-sm text-muted-foreground">${Object.keys(mcpAllProjects).length} ${t('mcp.projects')}</span>
        </div>

        <div class="mcp-projects-table bg-card border border-border rounded-lg overflow-hidden">
          <table class="w-full">
            <thead class="bg-muted/50">
              <tr>
                <th class="text-left px-4 py-3 text-sm font-semibold text-foreground border-b border-border">${t('mcp.project')}</th>
                <th class="text-left px-4 py-3 text-sm font-semibold text-foreground border-b border-border">${t('mcp.servers')}</th>
                <th class="text-center px-4 py-3 text-sm font-semibold text-foreground border-b border-border w-24">${t('mcp.status')}</th>
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
                        <span class="shrink-0">${isCurrentProject ? '<i data-lucide="map-pin" class="w-4 h-4 text-primary"></i>' : '<i data-lucide="folder" class="w-4 h-4"></i>'}</span>
                        <div class="min-w-0">
                          <div class="font-medium text-foreground truncate text-sm" title="${escapeHtml(path)}">
                            ${escapeHtml(path.split('\\').pop() || path)}
                            ${isCurrentProject ? `<span class="ml-2 text-xs text-primary font-medium">${t('mcp.current')}</span>` : ''}
                          </div>
                          <div class="text-xs text-muted-foreground truncate">${escapeHtml(path)}</div>
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex flex-wrap gap-1.5">
                        ${serverNames.length === 0
                          ? `<span class="text-xs text-muted-foreground italic">${t('mcp.noMcpServers')}</span>`
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
  
  // Initialize Lucide icons
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderMcpServerCard(serverName, serverConfig, isEnabled, isInCurrentProject) {
  const command = serverConfig.command || 'N/A';
  const args = serverConfig.args || [];
  const hasEnv = serverConfig.env && Object.keys(serverConfig.env).length > 0;

  return `
    <div class="mcp-server-card bg-card border border-border rounded-lg p-4 hover:shadow-md transition-all ${isEnabled ? '' : 'opacity-60'}">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2">
          <span>${isEnabled ? '<i data-lucide="check-circle" class="w-5 h-5 text-success"></i>' : '<i data-lucide="x-circle" class="w-5 h-5 text-destructive"></i>'}</span>
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
            ${t('mcp.removeFromProject')}
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
  const args = serverConfig.args || [];

  // Get the actual name to use when adding (original name if different from display key)
  const originalName = serverInfo.originalName || serverName;
  const hasVariant = serverInfo.originalName && serverInfo.originalName !== serverName;

  // Get source project info
  const sourceProject = serverInfo.sourceProject;
  const sourceProjectName = sourceProject ? (sourceProject.split('\\').pop() || sourceProject.split('/').pop()) : null;

  // Generate args preview
  const argsPreview = args.length > 0 ? args.slice(0, 3).join(' ') + (args.length > 3 ? '...' : '') : '';

  return `
    <div class="mcp-server-card mcp-server-available bg-card border border-border border-dashed rounded-lg p-4 hover:shadow-md hover:border-solid transition-all">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2 flex-wrap">
          <span><i data-lucide="circle-dashed" class="w-5 h-5 text-muted-foreground"></i></span>
          <h4 class="font-semibold text-foreground">${escapeHtml(originalName)}</h4>
          ${hasVariant ? `
            <span class="text-xs px-2 py-0.5 bg-warning/20 text-warning rounded-full" title="Different config from: ${escapeHtml(sourceProject || '')}">
              ${escapeHtml(sourceProjectName || 'variant')}
            </span>
          ` : ''}
        </div>
        <button class="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
                data-server-name="${escapeHtml(originalName)}"
                data-server-key="${escapeHtml(serverName)}"
                data-server-config='${JSON.stringify(serverConfig).replace(/'/g, "&#39;")}'
                data-action="add">
          ${t('mcp.add')}
        </button>
      </div>

      <div class="mcp-server-details text-sm space-y-1">
        <div class="flex items-center gap-2 text-muted-foreground">
          <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">cmd</span>
          <span class="truncate" title="${escapeHtml(command)}">${escapeHtml(command)}</span>
        </div>
        ${argsPreview ? `
          <div class="flex items-start gap-2 text-muted-foreground">
            <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">args</span>
            <span class="text-xs font-mono truncate" title="${escapeHtml(args.join(' '))}">${escapeHtml(argsPreview)}</span>
          </div>
        ` : ''}
        <div class="flex items-center gap-2 text-muted-foreground">
          <span class="text-xs">Used in ${usedIn.length} project${usedIn.length !== 1 ? 's' : ''}</span>
          ${sourceProjectName ? `<span class="text-xs text-muted-foreground/70">• from ${escapeHtml(sourceProjectName)}</span>` : ''}
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
          <i data-lucide="user" class="w-5 h-5"></i>
          <h4 class="font-semibold text-foreground">${escapeHtml(serverName)}</h4>
          <span class="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">User</span>
        </div>
        <button class="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
                data-server-name="${escapeHtml(serverName)}"
                data-server-config='${JSON.stringify(serverConfig).replace(/'/g, "&#39;")}'
                data-action="add">
          ${t('mcp.addToProject')}
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
          <i data-lucide="building-2" class="w-5 h-5"></i>
          <h4 class="font-semibold text-foreground">${escapeHtml(serverName)}</h4>
          <span class="text-xs px-2 py-0.5 bg-warning/20 text-warning rounded-full">Enterprise</span>
          <i data-lucide="lock" class="w-3 h-3 text-muted-foreground"></i>
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

  // Add buttons - use btn.dataset instead of e.target.dataset for event bubbling safety
  document.querySelectorAll('.mcp-server-card button[data-action="add"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const serverName = btn.dataset.serverName;
      const serverConfig = JSON.parse(btn.dataset.serverConfig);
      await copyMcpServerToProject(serverName, serverConfig);
    });
  });

  // Remove buttons - use btn.dataset instead of e.target.dataset for event bubbling safety
  document.querySelectorAll('.mcp-server-card button[data-action="remove"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const serverName = btn.dataset.serverName;
      if (confirm(t('mcp.removeConfirm', { name: serverName }))) {
        await removeMcpServerFromProject(serverName);
      }
    });
  });
}
