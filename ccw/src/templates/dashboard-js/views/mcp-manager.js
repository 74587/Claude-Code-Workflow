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
  const otherAvailableServers = Object.entries(allAvailableServers)
    .filter(([name]) => !currentProjectServerNames.includes(name));

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

      <!-- Available MCP Servers from Other Projects -->
      <div class="mcp-section">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-foreground">Available from Other Projects</h3>
          <span class="text-sm text-muted-foreground">${otherAvailableServers.length} servers available</span>
        </div>

        ${otherAvailableServers.length === 0 ? `
          <div class="mcp-empty-state bg-card border border-border rounded-lg p-6 text-center">
            <p class="text-muted-foreground">No additional MCP servers found in other projects</p>
          </div>
        ` : `
          <div class="mcp-server-grid grid gap-3">
            ${otherAvailableServers.map(([serverName, serverInfo]) => {
              return renderAvailableServerCard(serverName, serverInfo);
            }).join('')}
          </div>
        `}
      </div>

      <!-- All Projects Overview -->
      <div class="mcp-section mt-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-foreground">All Projects</h3>
          <span class="text-sm text-muted-foreground">${Object.keys(mcpAllProjects).length} projects</span>
        </div>

        <div class="mcp-projects-list bg-card border border-border rounded-lg overflow-hidden">
          ${Object.entries(mcpAllProjects).map(([path, config]) => {
            const servers = config.mcpServers || {};
            const serverCount = Object.keys(servers).length;
            const isCurrentProject = path === currentPath;
            return `
              <div class="mcp-project-item flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0 hover:bg-hover cursor-pointer ${isCurrentProject ? 'bg-primary-light' : ''}"
                   onclick="switchToProject('${escapeHtml(path)}')"
                   data-project-path="${escapeHtml(path)}">
                <div class="flex items-center gap-3 min-w-0">
                  <span class="text-lg">${isCurrentProject ? '📍' : '📁'}</span>
                  <div class="min-w-0">
                    <div class="font-medium text-foreground truncate" title="${escapeHtml(path)}">${escapeHtml(path.split('\\').pop() || path)}</div>
                    <div class="text-xs text-muted-foreground truncate">${escapeHtml(path)}</div>
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="badge px-2 py-0.5 text-xs font-semibold rounded-full ${serverCount > 0 ? 'bg-success-light text-success' : 'bg-hover text-muted-foreground'}">${serverCount} MCP</span>
                  ${isCurrentProject ? '<span class="text-xs text-primary font-medium">Current</span>' : ''}
                </div>
              </div>
            `;
          }).join('')}
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

function switchToProject(path) {
  // Use existing path selection mechanism
  selectPath(path.replace(/\\\\/g, '\\'));
}
