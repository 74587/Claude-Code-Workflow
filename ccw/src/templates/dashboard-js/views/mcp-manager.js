// MCP Manager View
// Renders the MCP server management interface

// CCW Tools available for MCP (file operations + core memory only)
const CCW_MCP_TOOLS = [
  // Core tools (always recommended)
  { name: 'write_file', desc: 'Write/create files', core: true },
  { name: 'edit_file', desc: 'Edit/replace content', core: true },
  { name: 'read_file', desc: 'Read file contents', core: true },
  { name: 'core_memory', desc: 'Core memory management', core: true },
];

// Get currently enabled tools from installed config (Claude)
function getCcwEnabledTools() {
  const currentPath = projectPath; // Keep original format (forward slash)
  const projectData = mcpAllProjects[currentPath] || {};
  const ccwConfig = projectData.mcpServers?.['ccw-tools'];
  if (ccwConfig?.env?.CCW_ENABLED_TOOLS) {
    const val = ccwConfig.env.CCW_ENABLED_TOOLS;
    if (val.toLowerCase() === 'all') return CCW_MCP_TOOLS.map(t => t.name);
    return val.split(',').map(t => t.trim());
  }
  return CCW_MCP_TOOLS.filter(t => t.core).map(t => t.name);
}

// Get currently enabled tools from Codex config
function getCcwEnabledToolsCodex() {
  const ccwConfig = codexMcpServers?.['ccw-tools'];
  if (ccwConfig?.env?.CCW_ENABLED_TOOLS) {
    const val = ccwConfig.env.CCW_ENABLED_TOOLS;
    if (val.toLowerCase() === 'all') return CCW_MCP_TOOLS.map(t => t.name);
    return val.split(',').map(t => t.trim());
  }
  // Default to core tools if not installed
  return CCW_MCP_TOOLS.filter(t => t.core).map(t => t.name);
}

// Get current CCW_PROJECT_ROOT from config
function getCcwProjectRoot() {
  // Try project config first, then global config
  const currentPath = projectPath;
  const projectData = mcpAllProjects[currentPath] || {};
  const projectCcwConfig = projectData.mcpServers?.['ccw-tools'];
  if (projectCcwConfig?.env?.CCW_PROJECT_ROOT) {
    return projectCcwConfig.env.CCW_PROJECT_ROOT;
  }
  // Fallback to global config
  const globalCcwConfig = mcpUserServers?.['ccw-tools'];
  return globalCcwConfig?.env?.CCW_PROJECT_ROOT || '';
}

// Get current CCW_ALLOWED_DIRS from config
function getCcwAllowedDirs() {
  // Try project config first, then global config
  const currentPath = projectPath;
  const projectData = mcpAllProjects[currentPath] || {};
  const projectCcwConfig = projectData.mcpServers?.['ccw-tools'];
  if (projectCcwConfig?.env?.CCW_ALLOWED_DIRS) {
    return projectCcwConfig.env.CCW_ALLOWED_DIRS;
  }
  // Fallback to global config
  const globalCcwConfig = mcpUserServers?.['ccw-tools'];
  return globalCcwConfig?.env?.CCW_ALLOWED_DIRS || '';
}

// Get current CCW_PROJECT_ROOT from Codex config
function getCcwProjectRootCodex() {
  const ccwConfig = codexMcpServers?.['ccw-tools'];
  return ccwConfig?.env?.CCW_PROJECT_ROOT || '';
}

// Get current CCW_ALLOWED_DIRS from Codex config
function getCcwAllowedDirsCodex() {
  const ccwConfig = codexMcpServers?.['ccw-tools'];
  return ccwConfig?.env?.CCW_ALLOWED_DIRS || '';
}

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

  // Load MCP templates
  await loadMcpTemplates();

  const currentPath = projectPath; // Keep original format (forward slash)
  const projectData = mcpAllProjects[currentPath] || {};
  const projectServers = projectData.mcpServers || {};
  const disabledServers = projectData.disabledMcpServers || [];
  const hasMcpJson = projectData.hasMcpJson || false;
  const mcpJsonPath = projectData.mcpJsonPath || null;

  // Get all available servers from all projects
  const allAvailableServers = getAllAvailableMcpServers();

  // Separate servers by category:
  // 1. Project Available = Global + Project-specific (servers available to current project)
  // 2. Global Management = Global servers that can be managed
  // 3. Other Projects = Servers from other projects (can install to project or global)

  const currentProjectServerNames = Object.keys(projectServers);
  const globalServerNames = Object.keys(mcpUserServers || {});
  const enterpriseServerNames = Object.keys(mcpEnterpriseServers || {});

  // Project Available MCP: servers available to current project
  // This includes: Enterprise (highest priority) + Global + Project-specific
  const projectAvailableEntries = [];

  // Add enterprise servers first (highest priority)
  for (const [name, config] of Object.entries(mcpEnterpriseServers || {})) {
    projectAvailableEntries.push({
      name,
      config,
      source: 'enterprise',
      canRemove: false,
      canToggle: false
    });
  }

  // Add global servers
  for (const [name, config] of Object.entries(mcpUserServers || {})) {
    if (!enterpriseServerNames.includes(name)) {
      projectAvailableEntries.push({
        name,
        config,
        source: 'global',
        canRemove: false, // Can't remove from project view, must go to global management
        canToggle: true,
        isEnabled: !disabledServers.includes(name)
      });
    }
  }

  // Add project-specific servers
  for (const [name, config] of Object.entries(projectServers)) {
    if (!enterpriseServerNames.includes(name) && !globalServerNames.includes(name)) {
      projectAvailableEntries.push({
        name,
        config,
        source: 'project',
        canRemove: true,
        canToggle: true,
        isEnabled: !disabledServers.includes(name)
      });
    }
  }

  // Global Management: user global servers (for management)
  const globalManagementEntries = Object.entries(mcpUserServers || {});

  // Enterprise servers (for display only, read-only)
  const enterpriseServerEntries = Object.entries(mcpEnterpriseServers || {});

  // Other Projects: servers from other projects (not in current project, not global)
  const otherProjectServers = Object.entries(allAvailableServers)
    .filter(([name, info]) => !currentProjectServerNames.includes(name) && !info.isGlobal);
  // Check if CCW Tools is already installed
  const isCcwToolsInstalled = currentProjectServerNames.includes("ccw-tools");
  const enabledTools = getCcwEnabledTools();
  const enabledToolsCodex = getCcwEnabledToolsCodex();

  // Prepare Codex servers data
  const codexServerEntries = Object.entries(codexMcpServers || {});
  const codexConfigExists = codexMcpConfig?.exists || false;
  const codexConfigPath = codexMcpConfig?.configPath || '~/.codex/config.toml';

  // Collect cross-CLI servers (servers from other CLI not yet in current CLI)
  const crossCliServers = [];
  if (currentCliMode === 'claude') {
    // In Claude mode, show Codex servers that aren't in Claude
    for (const [name, config] of Object.entries(codexMcpServers || {})) {
      const existsInClaude = currentProjectServerNames.includes(name) || globalServerNames.includes(name);
      if (!existsInClaude) {
        crossCliServers.push({ name, config, fromCli: 'codex' });
      }
    }
  } else {
    // In Codex mode, show Claude servers that aren't in Codex
    const allClaudeServers = { ...mcpUserServers, ...projectServers };
    for (const [name, config] of Object.entries(allClaudeServers)) {
      const existsInCodex = codexMcpServers && codexMcpServers[name];
      if (!existsInCodex) {
        crossCliServers.push({ name, config, fromCli: 'claude' });
      }
    }
  }

  container.innerHTML = `
    <div class="mcp-manager">
      <!-- CLI Mode Toggle -->
      <div class="mcp-cli-toggle mb-6">
        <div class="flex items-center justify-between bg-card border border-border rounded-lg p-4">
          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-foreground">${t('mcp.cliMode')}</span>
            <div class="flex items-center bg-muted rounded-lg p-1">
              <button class="cli-mode-btn px-4 py-2 text-sm font-medium rounded-md transition-all ${currentCliMode === 'claude' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
                      onclick="setCliMode('claude')">
                <i data-lucide="bot" class="w-4 h-4 inline mr-1.5"></i>
                Claude
              </button>
              <button class="cli-mode-btn px-4 py-2 text-sm font-medium rounded-md transition-all ${currentCliMode === 'codex' ? 'shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
                      onclick="setCliMode('codex')"
                      style="${currentCliMode === 'codex' ? 'background-color: #f97316; color: white;' : ''}">
                <i data-lucide="code-2" class="w-4 h-4 inline mr-1.5"></i>
                Codex
              </button>
            </div>
          </div>
          <div class="text-xs text-muted-foreground">
            ${currentCliMode === 'claude'
              ? `<span class="flex items-center gap-1"><i data-lucide="file-json" class="w-3 h-3"></i> ~/.claude.json</span>`
              : `<span class="flex items-center gap-1"><i data-lucide="file-code" class="w-3 h-3"></i> ${codexConfigPath}</span>`
            }
          </div>
        </div>
      </div>

      ${currentCliMode === 'codex' ? `
      <!-- CCW Tools MCP Server Card (Codex mode) -->
      <div class="mcp-section mb-6">
        <div class="ccw-tools-card bg-gradient-to-br from-primary/10 to-primary/5 border-2 ${codexMcpServers && codexMcpServers['ccw-tools'] ? 'border-success' : 'border-primary/30'} rounded-lg p-6 hover:shadow-lg transition-all">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-start gap-4 flex-1">
              <div class="shrink-0 w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <i data-lucide="wrench" class="w-6 h-6 text-white"></i>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-2">
                  <h3 class="text-lg font-bold text-foreground">CCW Tools MCP</h3>
                  <span class="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full">Codex</span>
                  ${codexMcpServers && codexMcpServers['ccw-tools'] ? `
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-success-light text-success">
                      <i data-lucide="check" class="w-3 h-3"></i>
                      ${enabledToolsCodex.length} tools
                    </span>
                  ` : `
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-primary/20 text-primary">
                      <i data-lucide="package" class="w-3 h-3"></i>
                      ${t('mcp.available')}
                    </span>
                  `}
                </div>
                <p class="text-sm text-muted-foreground mb-3">${t('mcp.ccwToolsDesc')}</p>
                <!-- Tool Selection Grid for Codex -->
                <div class="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
                  ${CCW_MCP_TOOLS.map(tool => `
                    <label class="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-muted/50 rounded px-1.5 py-1 transition-colors">
                      <input type="checkbox" class="ccw-tool-checkbox-codex w-3 h-3"
                             data-tool="${tool.name}"
                             ${enabledToolsCodex.includes(tool.name) ? 'checked' : ''}>
                      <span class="${tool.core ? 'font-medium' : 'text-muted-foreground'}">${tool.desc}</span>
                    </label>
                  `).join('')}
                </div>
                <div class="flex items-center gap-3 text-xs">
                  <button class="text-primary hover:underline" onclick="selectCcwToolsCodex('core')">Core only</button>
                  <button class="text-primary hover:underline" onclick="selectCcwToolsCodex('all')">All</button>
                  <button class="text-muted-foreground hover:underline" onclick="selectCcwToolsCodex('none')">None</button>
                </div>
                <!-- Path Settings -->
                <div class="ccw-path-settings mt-3 pt-3 border-t border-border/50">
                  <div class="flex items-center gap-2 mb-2">
                    <i data-lucide="folder-root" class="w-4 h-4 text-muted-foreground"></i>
                    <span class="text-xs font-medium text-muted-foreground">${t('mcp.pathSettings')}</span>
                  </div>
                  <div class="grid grid-cols-1 gap-2">
                    <div class="flex items-center gap-2">
                      <label class="text-xs text-muted-foreground w-36 shrink-0">CCW_PROJECT_ROOT</label>
                      <input type="text"
                             class="ccw-project-root-input flex-1 px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                             placeholder="${projectPath || t('mcp.useCurrentDir')}"
                             value="${getCcwProjectRootCodex()}">
                      <button class="p-1 text-muted-foreground hover:text-foreground"
                              onclick="setCcwProjectRootToCurrent()"
                              title="${t('mcp.useCurrentProject')}">
                        <i data-lucide="locate-fixed" class="w-4 h-4"></i>
                      </button>
                    </div>
                    <div class="flex items-center gap-2">
                      <label class="text-xs text-muted-foreground w-36 shrink-0">CCW_ALLOWED_DIRS</label>
                      <input type="text"
                             class="ccw-allowed-dirs-input flex-1 px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                             placeholder="${t('mcp.allowedDirsPlaceholder')}"
                             value="${getCcwAllowedDirsCodex()}">
                    </div>
                    <div class="flex items-center gap-2">
                      <label class="text-xs text-muted-foreground w-36 shrink-0">CCW_DISABLE_SANDBOX</label>
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" class="ccw-disable-sandbox-checkbox-codex w-3 h-3"
                               ${getCcwDisableSandboxCodex() ? 'checked' : ''}>
                        <span class="text-xs text-muted-foreground">${t('mcp.disableSandboxDesc')}</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="shrink-0">
              <button class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1"
                      data-action="install-ccw-codex">
                <i data-lucide="download" class="w-4 h-4"></i>
                ${codexMcpServers && codexMcpServers['ccw-tools'] ? t('mcp.update') : t('mcp.install')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Codex MCP Servers Section -->
      <div class="mcp-section mb-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <i data-lucide="code-2" class="w-5 h-5 text-primary"></i>
              <h3 class="text-lg font-semibold text-foreground">${t('mcp.codex.globalServers')}</h3>
            </div>
            <button class="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1"
                    onclick="openCodexMcpCreateModal()">
              <span>+</span> ${t('mcp.codex.newServer')}
            </button>
            ${codexConfigExists ? `
              <span class="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-success/10 text-success rounded-md border border-success/20">
                <i data-lucide="file-check" class="w-3.5 h-3.5"></i>
                config.toml
              </span>
            ` : `
              <span class="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-muted text-muted-foreground rounded-md border border-border" title="Will create ~/.codex/config.toml">
                <i data-lucide="file-plus" class="w-3.5 h-3.5"></i>
                Will create config.toml
              </span>
            `}
          </div>
          <span class="text-sm text-muted-foreground">${codexServerEntries.length} ${t('mcp.serversAvailable')}</span>
        </div>

        <!-- Info about Codex MCP -->
        <div class="bg-green-50 dark:bg-green-950/30 border border-primary/20 rounded-lg p-4 mb-4">
          <div class="flex items-start gap-3">
            <i data-lucide="info" class="w-5 h-5 text-green-500 shrink-0 mt-0.5"></i>
            <div class="text-sm">
              <p class="text-primary font-medium mb-1">${t('mcp.codex.infoTitle')}</p>
              <p class="text-primary/80 text-xs">${t('mcp.codex.infoDesc')}</p>
            </div>
          </div>
        </div>

        ${codexServerEntries.length === 0 ? `
          <div class="mcp-empty-state bg-card border border-border rounded-lg p-6 text-center">
            <div class="text-muted-foreground mb-3"><i data-lucide="plug" class="w-10 h-10 mx-auto"></i></div>
            <p class="text-muted-foreground">${t('mcp.codex.noServers')}</p>
            <p class="text-sm text-muted-foreground mt-1">${t('mcp.codex.noServersHint')}</p>
          </div>
        ` : `
          <div class="mcp-server-grid grid gap-3">
            ${codexServerEntries.map(([serverName, serverConfig]) => {
              return renderCodexServerCard(serverName, serverConfig);
            }).join('')}
          </div>
        `}
      </div>

      <!-- Copy Claude Servers to Codex -->
      ${Object.keys(mcpUserServers || {}).length > 0 ? `
      <div class="mcp-section mb-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-foreground flex items-center gap-2">
            <i data-lucide="copy" class="w-5 h-5"></i>
            ${t('mcp.codex.copyFromClaude')}
          </h3>
          <span class="text-sm text-muted-foreground">${Object.keys(mcpUserServers || {}).length} ${t('mcp.serversAvailable')}</span>
        </div>
        <div class="mcp-server-grid grid gap-3">
          ${Object.entries(mcpUserServers || {}).map(([serverName, serverConfig]) => {
            const alreadyInCodex = codexMcpServers && codexMcpServers[serverName];
            return `
              <div class="mcp-server-card bg-card border ${alreadyInCodex ? 'border-success/50' : 'border-border'} border-dashed rounded-lg p-4 hover:shadow-md transition-all">
                <div class="flex items-start justify-between mb-3">
                  <div class="flex items-center gap-2">
                    <i data-lucide="bot" class="w-5 h-5 text-primary"></i>
                    <h4 class="font-semibold text-foreground">${escapeHtml(serverName)}</h4>
                    <span class="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">Claude</span>
                    ${alreadyInCodex ? `<span class="text-xs px-2 py-0.5 bg-success/10 text-success rounded-full">${t('mcp.codex.alreadyAdded')}</span>` : ''}
                  </div>
                  ${!alreadyInCodex ? `
                    <button class="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
                            data-action="copy-to-codex"
                            data-server-name="${escapeHtml(serverName)}"
                            data-server-config="${encodeConfigData(serverConfig)}"
                            title="${t('mcp.codex.copyToCodex')}">
                      <i data-lucide="arrow-right" class="w-3.5 h-3.5 inline"></i> Codex
                    </button>
                  ` : ''}
                </div>
                <div class="mcp-server-details text-sm space-y-1">
                  <div class="flex items-center gap-2 text-muted-foreground">
                    <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">${t('mcp.cmd')}</span>
                    <span class="truncate" title="${escapeHtml(serverConfig.command || 'N/A')}">${escapeHtml(serverConfig.command || 'N/A')}</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      ` : ''}

      <!-- Available MCP Servers from Other Projects (Codex mode) -->
      <div class="mcp-section mb-6">
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
              return renderAvailableServerCardForCodex(serverName, serverInfo);
            }).join('')}
          </div>
        `}
      </div>

      <!-- Cross-CLI Servers: Available from Claude (Codex mode) -->
      ${crossCliServers.length > 0 ? `
      <div class="mcp-section">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-foreground flex items-center gap-2">
            <i data-lucide="circle" class="w-5 h-5 text-primary"></i>
            ${t('mcp.codex.copyFromClaude')}
          </h3>
          <span class="text-sm text-muted-foreground">${crossCliServers.length} ${t('mcp.serversAvailable')}</span>
        </div>
        <div class="mcp-server-grid grid gap-3">
          ${crossCliServers.map(server => renderCrossCliServerCard(server, false)).join('')}
        </div>
      </div>
      ` : ''}
      ` : `
      <!-- CCW Tools MCP Server Card -->
      <div class="mcp-section mb-6">
        <div class="ccw-tools-card bg-gradient-to-br from-primary/10 to-primary/5 border-2 ${isCcwToolsInstalled ? 'border-success' : 'border-primary/30'} rounded-lg p-6 hover:shadow-lg transition-all">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-start gap-4 flex-1">
              <div class="shrink-0 w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <i data-lucide="wrench" class="w-6 h-6 text-white"></i>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-2">
                  <h3 class="text-lg font-bold text-foreground">CCW Tools MCP</h3>
                  ${isCcwToolsInstalled ? `
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-success-light text-success">
                      <i data-lucide="check" class="w-3 h-3"></i>
                      ${enabledTools.length} tools
                    </span>
                  ` : `
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-primary/20 text-primary">
                      <i data-lucide="package" class="w-3 h-3"></i>
                      Available
                    </span>
                  `}
                </div>
                <!-- Tool Selection Grid -->
                <div class="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
                  ${CCW_MCP_TOOLS.map(tool => `
                    <label class="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-muted/50 rounded px-1.5 py-1 transition-colors">
                      <input type="checkbox" class="ccw-tool-checkbox w-3 h-3"
                             data-tool="${tool.name}"
                             ${enabledTools.includes(tool.name) ? 'checked' : ''}>
                      <span class="${tool.core ? 'font-medium' : 'text-muted-foreground'}">${tool.desc}</span>
                    </label>
                  `).join('')}
                </div>
                <div class="flex items-center gap-3 text-xs">
                  <button class="text-primary hover:underline" onclick="selectCcwTools('core')">Core only</button>
                  <button class="text-primary hover:underline" onclick="selectCcwTools('all')">All</button>
                  <button class="text-muted-foreground hover:underline" onclick="selectCcwTools('none')">None</button>
                </div>
                <!-- Path Settings -->
                <div class="ccw-path-settings mt-3 pt-3 border-t border-border/50">
                  <div class="flex items-center gap-2 mb-2">
                    <i data-lucide="folder-root" class="w-4 h-4 text-muted-foreground"></i>
                    <span class="text-xs font-medium text-muted-foreground">${t('mcp.pathSettings')}</span>
                  </div>
                  <div class="grid grid-cols-1 gap-2">
                    <div class="flex items-center gap-2">
                      <label class="text-xs text-muted-foreground w-36 shrink-0">CCW_PROJECT_ROOT</label>
                      <input type="text"
                             class="ccw-project-root-input flex-1 px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                             placeholder="${projectPath || t('mcp.useCurrentDir')}"
                             value="${getCcwProjectRoot()}">
                      <button class="p-1 text-muted-foreground hover:text-foreground"
                              onclick="setCcwProjectRootToCurrent()"
                              title="${t('mcp.useCurrentProject')}">
                        <i data-lucide="locate-fixed" class="w-4 h-4"></i>
                      </button>
                    </div>
                    <div class="flex items-center gap-2">
                      <label class="text-xs text-muted-foreground w-36 shrink-0">CCW_ALLOWED_DIRS</label>
                      <input type="text"
                             class="ccw-allowed-dirs-input flex-1 px-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                             placeholder="${t('mcp.allowedDirsPlaceholder')}"
                             value="${getCcwAllowedDirs()}">
                    </div>
                    <div class="flex items-center gap-2">
                      <label class="text-xs text-muted-foreground w-36 shrink-0">CCW_DISABLE_SANDBOX</label>
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" class="ccw-disable-sandbox-checkbox w-3 h-3"
                               ${getCcwDisableSandbox() ? 'checked' : ''}>
                        <span class="text-xs text-muted-foreground">${t('mcp.disableSandboxDesc')}</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="shrink-0 flex gap-2">
              ${isCcwToolsInstalled ? `
                <button class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1"
                        data-action="update-ccw-workspace"
                        title="${t('mcp.updateInWorkspace')}">
                  <i data-lucide="folder" class="w-4 h-4"></i>
                  ${t('mcp.updateInWorkspace')}
                </button>
                <button class="px-4 py-2 text-sm bg-success text-success-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1"
                        data-action="update-ccw-global"
                        title="${t('mcp.updateInGlobal')}">
                  <i data-lucide="globe" class="w-4 h-4"></i>
                  ${t('mcp.updateInGlobal')}
                </button>
              ` : `
                <button class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1"
                        data-action="install-ccw-workspace"
                        title="${t('mcp.installToWorkspace')}">
                  <i data-lucide="folder" class="w-4 h-4"></i>
                  ${t('mcp.installToWorkspace')}
                </button>
                <button class="px-4 py-2 text-sm bg-success text-success-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1"
                        data-action="install-ccw-global"
                        title="${t('mcp.installToGlobal')}">
                  <i data-lucide="globe" class="w-4 h-4"></i>
                  ${t('mcp.installToGlobal')}
                </button>
              `}
            </div>
          </div>
        </div>
      </div>

      <!-- Recommended MCP Servers -->
      <div class="mcp-section mb-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <i data-lucide="sparkles" class="w-5 h-5 text-amber-500"></i>
              <h3 class="text-lg font-semibold text-foreground">${t('mcp.recommended')}</h3>
            </div>
            <span class="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 rounded-full">
              ${t('mcp.quickSetup')}
            </span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          ${getRecommendedMcpServers().map(mcp => {
            const installStatus = isRecommendedMcpInstalled(mcp.id);
            const mcpName = t(mcp.nameKey);
            const mcpDesc = t(mcp.descKey);
            return `
              <div class="recommended-mcp-card bg-card border ${installStatus.installed ? 'border-success/50' : 'border-border'} rounded-lg p-4 hover:shadow-md transition-all">
                <div class="flex items-start justify-between mb-3">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 ${installStatus.installed ? 'bg-success/10' : 'bg-primary/10'} rounded-lg flex items-center justify-center">
                      <i data-lucide="${mcp.icon}" class="w-5 h-5 ${installStatus.installed ? 'text-success' : 'text-primary'}"></i>
                    </div>
                    <div>
                      <h4 class="font-semibold text-foreground">${escapeHtml(mcpName)}</h4>
                      <span class="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded">${mcp.category}</span>
                    </div>
                  </div>
                  ${installStatus.installed ? `
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-success/10 text-success">
                      <i data-lucide="check" class="w-3 h-3"></i>
                      ${installStatus.scope}
                    </span>
                  ` : ''}
                </div>
                <p class="text-sm text-muted-foreground mb-4 line-clamp-2">${escapeHtml(mcpDesc)}</p>
                <div class="flex items-center justify-between">
                  ${mcp.fields.length > 0 ? `
                    <span class="text-xs text-muted-foreground flex items-center gap-1">
                      <i data-lucide="key" class="w-3 h-3"></i>
                      ${mcp.fields.length} ${t('mcp.configRequired')}
                    </span>
                  ` : `
                    <span class="text-xs text-success flex items-center gap-1">
                      <i data-lucide="zap" class="w-3 h-3"></i>
                      ${t('mcp.noConfigNeeded')}
                    </span>
                  `}
                  <button class="px-3 py-1.5 text-sm ${installStatus.installed ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'} rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1"
                          onclick="openRecommendedMcpWizard('${mcp.id}')">
                    <i data-lucide="${installStatus.installed ? 'settings' : 'download'}" class="w-3.5 h-3.5"></i>
                    ${installStatus.installed ? t('mcp.reconfigure') : t('mcp.install')}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Project Available MCP Servers -->
      <div class="mcp-section mb-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <h3 class="text-lg font-semibold text-foreground">${t('mcp.projectAvailable')}</h3>
            <button class="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1"
                    onclick="openMcpCreateModal('project')">
              <span>+</span> ${t('mcp.newProjectServer')}
            </button>
            <!-- Project Config Type Toggle -->
            <button class="project-config-toggle inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border cursor-pointer transition-all hover:shadow-md"
                    onclick="toggleProjectConfigType()"
                    title="${t('mcp.clickToSwitch')}"
                    style="${getPreferredProjectConfigType() === 'mcp'
                      ? 'background: rgba(34, 197, 94, 0.1); border-color: rgba(34, 197, 94, 0.3); color: rgb(34, 197, 94);'
                      : 'background: rgba(59, 130, 246, 0.1); border-color: rgba(59, 130, 246, 0.3); color: rgb(59, 130, 246);'}">
              <i data-lucide="${getPreferredProjectConfigType() === 'mcp' ? 'file-json' : 'settings'}" class="w-3.5 h-3.5"></i>
              <span>${getPreferredProjectConfigType() === 'mcp' ? '.mcp.json' : 'claude.json'}</span>
              <i data-lucide="chevrons-up-down" class="w-3 h-3 opacity-50"></i>
            </button>
            ${hasMcpJson ? `
              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-success/10 text-success rounded border border-success/20">
                <i data-lucide="check" class="w-2.5 h-2.5"></i>
                exists
              </span>
            ` : ''}
          </div>
          <span class="text-sm text-muted-foreground">${projectAvailableEntries.length} ${t('mcp.serversAvailable')}</span>
        </div>

        ${projectAvailableEntries.length === 0 ? `
          <div class="mcp-empty-state bg-card border border-border rounded-lg p-6 text-center">
            <div class="text-muted-foreground mb-3"><i data-lucide="plug" class="w-10 h-10 mx-auto"></i></div>
            <p class="text-muted-foreground">${t('empty.noMcpServers')}</p>
            <p class="text-sm text-muted-foreground mt-1">${t('empty.addMcpServersHint')}</p>
          </div>
        ` : `
          <div class="mcp-server-grid grid gap-3">
            ${projectAvailableEntries.map(entry => {
              return renderProjectAvailableServerCard(entry);
            }).join('')}
          </div>
        `}
      </div>

      <!-- Global Available MCP Servers -->
      <div class="mcp-section mb-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <i data-lucide="globe" class="w-5 h-5 text-success"></i>
              <h3 class="text-lg font-semibold text-foreground">${t('mcp.globalAvailable')}</h3>
            </div>
            <button class="px-3 py-1.5 text-sm bg-success text-success-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1"
                    onclick="openMcpCreateModal('global')">
              <span>+</span> ${t('mcp.newGlobalServer')}
            </button>
          </div>
          <span class="text-sm text-muted-foreground">${globalManagementEntries.length} ${t('mcp.globalServersFrom')}</span>
        </div>

        ${globalManagementEntries.length === 0 ? `
          <div class="mcp-empty-state bg-card border border-border rounded-lg p-6 text-center">
            <div class="text-muted-foreground mb-3"><i data-lucide="globe" class="w-10 h-10 mx-auto"></i></div>
            <p class="text-muted-foreground">${t('empty.noGlobalMcpServers')}</p>
            <p class="text-sm text-muted-foreground mt-1">${t('empty.globalServersHint')}</p>
          </div>
        ` : `
          <div class="mcp-server-grid grid gap-3">
            ${globalManagementEntries.map(([serverName, serverConfig]) => {
              return renderGlobalManagementCard(serverName, serverConfig);
            }).join('')}
          </div>
        `}
      </div>

      <!-- Available MCP Servers from Other Projects -->
      <div class="mcp-section mb-6">
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

      <!-- Cross-CLI Servers: Available from Codex (Claude mode) -->
      ${crossCliServers.length > 0 ? `
      <div class="mcp-section mb-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-foreground flex items-center gap-2">
            <i data-lucide="circle-dashed" class="w-5 h-5 text-primary"></i>
            ${t('mcp.claude.copyFromCodex')}
          </h3>
          <span class="text-sm text-muted-foreground">${crossCliServers.length} ${t('mcp.serversAvailable')}</span>
        </div>
        <div class="mcp-server-grid grid gap-3">
          ${crossCliServers.map(server => renderCrossCliServerCard(server, true)).join('')}
        </div>
      </div>
      ` : ''}

      <!-- MCP Templates Section -->
      ${mcpTemplates.length > 0 ? `
      <div class="mcp-section mt-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-foreground flex items-center gap-2">
            <i data-lucide="layout-template" class="w-5 h-5"></i>
            ${t('mcp.templates')}
          </h3>
          <span class="text-sm text-muted-foreground">${mcpTemplates.length} ${t('mcp.savedTemplates')}</span>
        </div>

        <div class="mcp-server-grid grid gap-3">
          ${mcpTemplates.map(template => `
            <div class="mcp-template-card mcp-server-card bg-card border border-border border-dashed rounded-lg p-4 hover:shadow-md hover:border-solid transition-all">
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-2 flex-wrap">
                  <span><i data-lucide="layout-template" class="w-5 h-5 text-muted-foreground"></i></span>
                  <h4 class="font-semibold text-foreground">${escapeHtml(template.name)}</h4>
                  ${template.description ? `
                    <span class="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-full truncate max-w-32" title="${escapeHtml(template.description)}">
                      ${escapeHtml(template.description)}
                    </span>
                  ` : ''}
                </div>
                <div class="flex gap-2">
                  <button class="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
                          data-template-name="${escapeHtml(template.name)}"
                          data-scope="project"
                          data-action="install-template"
                          title="${t('mcp.installToProject')}">
                    <i data-lucide="folder-plus" class="w-3.5 h-3.5 inline"></i>
                  </button>
                  <button class="px-3 py-1 text-xs bg-success text-success-foreground rounded hover:opacity-90 transition-opacity"
                          data-template-name="${escapeHtml(template.name)}"
                          data-scope="global"
                          data-action="install-template"
                          title="${t('mcp.installToGlobal')}">
                    <i data-lucide="globe" class="w-3.5 h-3.5 inline"></i>
                  </button>
                </div>
              </div>

              <div class="mcp-server-details text-sm space-y-1">
                <div class="flex items-center gap-2 text-muted-foreground">
                  <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">${t('mcp.cmd')}</span>
                  <span class="truncate" title="${escapeHtml(template.serverConfig.command)}">${escapeHtml(template.serverConfig.command)}</span>
                </div>
                ${template.serverConfig.args && template.serverConfig.args.length > 0 ? `
                  <div class="flex items-start gap-2 text-muted-foreground">
                    <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">${t('mcp.args')}</span>
                    <span class="text-xs font-mono truncate" title="${escapeHtml(template.serverConfig.args.join(' '))}">${escapeHtml(template.serverConfig.args.slice(0, 3).join(' '))}${template.serverConfig.args.length > 3 ? '...' : ''}</span>
                  </div>
                ` : ''}
              </div>

              <div class="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <button class="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                          data-template-name="${escapeHtml(template.name)}"
                          data-scope="project"
                          data-action="install-template"
                          title="${t('mcp.installToProject')}">
                    <i data-lucide="download" class="w-3 h-3"></i>
                    ${t('mcp.toProject')}
                  </button>
                  <button class="text-xs text-success hover:text-success/80 transition-colors flex items-center gap-1"
                          data-template-name="${escapeHtml(template.name)}"
                          data-scope="global"
                          data-action="install-template"
                          title="${t('mcp.installToGlobal')}">
                    <i data-lucide="globe" class="w-3 h-3"></i>
                    ${t('mcp.toGlobal')}
                  </button>
                </div>
                <button class="text-xs text-destructive hover:text-destructive/80 transition-colors"
                        data-template-name="${escapeHtml(template.name)}"
                        data-action="delete-template"
                        title="${t('mcp.deleteTemplate')}">
                  <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      <!-- Copy Codex Servers to Claude (Claude mode only) -->
      ${currentCliMode === 'claude' && Object.keys(codexMcpServers || {}).length > 0 ? `
      <div class="mcp-section mb-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-foreground flex items-center gap-2">
            <i data-lucide="copy" class="w-5 h-5"></i>
            ${t('mcp.claude.copyFromCodex')}
          </h3>
          <span class="text-sm text-muted-foreground">${Object.keys(codexMcpServers || {}).length} ${t('mcp.serversAvailable')}</span>
        </div>
        <div class="mcp-server-grid grid gap-3">
          ${Object.entries(codexMcpServers || {}).map(([serverName, serverConfig]) => {
            const alreadyInClaude = mcpUserServers && mcpUserServers[serverName];
            const isStdio = !!serverConfig.command;
            const isHttp = !!serverConfig.url;
            return `
              <div class="mcp-server-card bg-card border ${alreadyInClaude ? 'border-success/50' : 'border-primary/20'} border-dashed rounded-lg p-4 hover:shadow-md transition-all">
                <div class="flex items-start justify-between mb-3">
                  <div class="flex items-center gap-2 flex-wrap">
                    <i data-lucide="code-2" class="w-5 h-5 text-primary"></i>
                    <h4 class="font-semibold text-foreground">${escapeHtml(serverName)}</h4>
                    <span class="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full">Codex</span>
                    ${isHttp
                      ? '<span class="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">HTTP</span>'
                      : '<span class="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full">STDIO</span>'
                    }
                    ${alreadyInClaude ? '<span class="text-xs px-2 py-0.5 bg-success/10 text-success rounded-full">' + t('mcp.claude.alreadyAdded') + '</span>' : ''}
                  </div>
                  ${!alreadyInClaude ? `
                    <button class="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
                            data-action="copy-codex-to-claude"
                            data-server-name="${escapeHtml(serverName)}"
                            data-server-config="${encodeConfigData(serverConfig)}"
                            title="${t('mcp.claude.copyToClaude')}">
                      <i data-lucide="arrow-right" class="w-3.5 h-3.5 inline"></i> Claude
                    </button>
                  ` : ''}
                </div>
                <div class="mcp-server-details text-sm space-y-1">
                  <div class="flex items-center gap-2 text-muted-foreground">
                    <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">${isHttp ? t('mcp.url') : t('mcp.cmd')}</span>
                    <span class="truncate" title="${escapeHtml(serverConfig.command || serverConfig.url || 'N/A')}">${escapeHtml(serverConfig.command || serverConfig.url || 'N/A')}</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      ` : ''}

      <!-- All Projects MCP Overview Table (Claude mode only) -->
      ${currentCliMode === 'claude' ? `
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
                const projectHasMcpJson = config.hasMcpJson || false;

                return `
                  <tr class="border-b border-border last:border-b-0 ${isCurrentProject ? 'bg-primary/5' : 'hover:bg-hover/50'}">
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-2 min-w-0">
                        <span class="shrink-0">${isCurrentProject ? '<i data-lucide="map-pin" class="w-4 h-4 text-primary"></i>' : '<i data-lucide="folder" class="w-4 h-4"></i>'}</span>
                        <div class="min-w-0">
                          <div class="font-medium text-foreground truncate text-sm flex items-center gap-2" title="${escapeHtml(path)}">
                            <span class="truncate">${escapeHtml(path.split('\\').pop() || path)}</span>
                            ${isCurrentProject ? `<span class="text-xs text-primary font-medium shrink-0">${t('mcp.current')}</span>` : ''}
                            ${projectHasMcpJson ? `<span class="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-success/10 text-success rounded" title=".mcp.json detected"><i data-lucide="file-check" class="w-3 h-3"></i></span>` : ''}
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
      ` : ''}
      `}

      <!-- MCP Server Details Modal -->
      <div id="mcpDetailsModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 hidden">
        <div class="bg-card border border-border rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
          <!-- Modal Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 class="text-lg font-semibold text-foreground">${t('mcp.detailsModal.title')}</h2>
            <button id="mcpDetailsModalClose" class="text-muted-foreground hover:text-foreground transition-colors">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>

          <!-- Modal Body -->
          <div id="mcpDetailsModalBody" class="px-6 py-4 overflow-y-auto flex-1">
            <!-- Content will be dynamically filled -->
          </div>
        </div>
      </div>
    </div>
  `;

  // Initialize Lucide icons FIRST (before attaching event listeners)
  // lucide.createIcons() may replace DOM elements, which would remove event listeners
  if (typeof lucide !== 'undefined') lucide.createIcons();
  
  // Attach event listeners AFTER icon initialization
  attachMcpEventListeners();
}

// Render card for Project Available MCP (current project can use)
function renderProjectAvailableServerCard(entry) {
  const { name, config, source, canRemove, canToggle, isEnabled } = entry;
  const command = config.command || 'N/A';
  const args = config.args || [];
  const hasEnv = config.env && Object.keys(config.env).length > 0;

  // Source badge
  let sourceBadge = '';
  if (source === 'enterprise') {
    sourceBadge = `<span class="text-xs px-2 py-0.5 bg-warning/20 text-warning rounded-full">${t('mcp.sourceEnterprise')}</span>`;
  } else if (source === 'global') {
    sourceBadge = `<span class="text-xs px-2 py-0.5 bg-success/10 text-success rounded-full">${t('mcp.sourceGlobal')}</span>`;
  } else if (source === 'project') {
    sourceBadge = `<span class="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">${t('mcp.sourceProject')}</span>`;
  }

  return `
    <div class="mcp-server-card bg-card border border-border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer ${canToggle && !isEnabled ? 'opacity-60' : ''}"
         data-server-name="${escapeHtml(name)}"
         data-server-config="${encodeConfigData(config)}"
         data-server-source="${source}"
         data-action="view-details"
         title="${t('mcp.clickToViewDetails')}">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2">
          <span>${canToggle && isEnabled ? '<i data-lucide="check-circle" class="w-5 h-5 text-success"></i>' : '<i data-lucide="circle" class="w-5 h-5 text-muted-foreground"></i>'}</span>
          <h4 class="font-semibold text-foreground">${escapeHtml(name)}</h4>
          ${sourceBadge}
        </div>
        ${canToggle ? `
          <label class="mcp-toggle relative inline-flex items-center cursor-pointer" onclick="event.stopPropagation()">
            <input type="checkbox" class="sr-only peer"
                   ${isEnabled ? 'checked' : ''}
                   data-server-name="${escapeHtml(name)}"
                   data-action="toggle">
            <div class="w-9 h-5 bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-success"></div>
          </label>
        ` : ''}
      </div>

      <div class="mcp-server-details text-sm space-y-1">
        <div class="flex items-center gap-2 text-muted-foreground">
          <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">${t('mcp.cmd')}</span>
          <span class="truncate" title="${escapeHtml(command)}">${escapeHtml(command)}</span>
        </div>
        ${args.length > 0 ? `
          <div class="flex items-start gap-2 text-muted-foreground">
            <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">${t('mcp.args')}</span>
            <span class="text-xs font-mono truncate" title="${escapeHtml(args.join(' '))}">${escapeHtml(args.slice(0, 3).join(' '))}${args.length > 3 ? '...' : ''}</span>
          </div>
        ` : ''}
        ${hasEnv ? `
          <div class="flex items-center gap-2 text-muted-foreground">
            <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">${t('mcp.env')}</span>
            <span class="text-xs">${Object.keys(config.env).length} ${t('mcp.variables')}</span>
          </div>
        ` : ''}
      </div>

      <div class="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <button class="text-xs text-success hover:text-success/80 transition-colors flex items-center gap-1"
                  data-server-name="${escapeHtml(name)}"
                  data-server-config="${encodeConfigData(config)}"
                  data-action="save-as-template"
                  onclick="event.stopPropagation()"
                  title="${t('mcp.saveAsTemplate')}">
            <i data-lucide="save" class="w-3 h-3"></i>
            ${t('mcp.saveAsTemplate')}
          </button>
        </div>
        ${canRemove ? `
          <button class="text-xs text-destructive hover:text-destructive/80 transition-colors"
                  data-server-name="${escapeHtml(name)}"
                  data-action="remove"
                  onclick="event.stopPropagation()">
            ${t('mcp.removeFromProject')}
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

// Render card for Global Management (manage global servers)
function renderGlobalManagementCard(serverName, serverConfig) {
  const command = serverConfig.command || serverConfig.url || 'N/A';
  const args = serverConfig.args || [];
  const hasEnv = serverConfig.env && Object.keys(serverConfig.env).length > 0;
  const serverType = serverConfig.type || 'stdio';

  return `
    <div class="mcp-server-card mcp-server-global bg-card border border-success/30 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
         data-server-name="${escapeHtml(serverName)}"
         data-server-config="${encodeConfigData(serverConfig)}"
         data-server-source="global"
         data-action="view-details"
         title="${t('mcp.clickToEdit')}">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2">
          <i data-lucide="globe" class="w-5 h-5 text-success"></i>
          <h4 class="font-semibold text-foreground">${escapeHtml(serverName)}</h4>
        </div>
      </div>

      <div class="mcp-server-details text-sm space-y-1">
        <div class="flex items-center gap-2 text-muted-foreground">
          <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">${serverType === 'stdio' ? t('mcp.cmd') : t('mcp.url')}</span>
          <span class="truncate" title="${escapeHtml(command)}">${escapeHtml(command)}</span>
        </div>
        ${args.length > 0 ? `
          <div class="flex items-start gap-2 text-muted-foreground">
            <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">${t('mcp.args')}</span>
            <span class="text-xs font-mono truncate" title="${escapeHtml(args.join(' '))}">${escapeHtml(args.slice(0, 3).join(' '))}${args.length > 3 ? '...' : ''}</span>
          </div>
        ` : ''}
        ${hasEnv ? `
          <div class="flex items-center gap-2 text-muted-foreground">
            <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">${t('mcp.env')}</span>
            <span class="text-xs">${Object.keys(serverConfig.env).length} ${t('mcp.variables')}</span>
          </div>
        ` : ''}
        <div class="flex items-center gap-2 text-muted-foreground mt-1">
          <span class="text-xs italic">${t('mcp.availableToAll')}</span>
        </div>
      </div>

      <div class="mt-3 pt-3 border-t border-border flex items-center justify-end">
        <button class="text-xs text-destructive hover:text-destructive/80 transition-colors"
                data-server-name="${escapeHtml(serverName)}"
                data-action="remove-global"
                onclick="event.stopPropagation()">
          ${t('mcp.removeGlobal')}
        </button>
      </div>
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
        <div class="flex gap-2">
          <button class="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
                  data-server-name="${escapeHtml(originalName)}"
                  data-server-key="${escapeHtml(serverName)}"
                  data-server-config="${encodeConfigData(serverConfig)}"
                  data-scope="project"
                  data-action="add-from-other"
                  title="${t('mcp.installToProject')}">
            <i data-lucide="folder-plus" class="w-3.5 h-3.5 inline"></i>
          </button>
          <button class="px-3 py-1 text-xs bg-success text-success-foreground rounded hover:opacity-90 transition-opacity"
                  data-server-name="${escapeHtml(originalName)}"
                  data-server-key="${escapeHtml(serverName)}"
                  data-server-config="${encodeConfigData(serverConfig)}"
                  data-scope="global"
                  data-action="add-from-other"
                  title="${t('mcp.installToGlobal')}">
            <i data-lucide="globe" class="w-3.5 h-3.5 inline"></i>
          </button>
        </div>
      </div>

      <div class="mcp-server-details text-sm space-y-1">
        <div class="flex items-center gap-2 text-muted-foreground">
          <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">${t('mcp.cmd')}</span>
          <span class="truncate" title="${escapeHtml(command)}">${escapeHtml(command)}</span>
        </div>
        ${argsPreview ? `
          <div class="flex items-start gap-2 text-muted-foreground">
            <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">${t('mcp.args')}</span>
            <span class="text-xs font-mono truncate" title="${escapeHtml(args.join(' '))}">${escapeHtml(argsPreview)}</span>
          </div>
        ` : ''}
        <div class="flex items-center gap-2 text-muted-foreground">
          <span class="text-xs">${t('mcp.usedInCount').replace('{count}', usedIn.length).replace('{s}', usedIn.length !== 1 ? 's' : '')}</span>
          ${sourceProjectName ? `<span class="text-xs text-muted-foreground/70">• ${t('mcp.from')} ${escapeHtml(sourceProjectName)}</span>` : ''}
        </div>
      </div>

      <div class="mt-3 pt-3 border-t border-border flex items-center gap-2">
        <button class="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                data-server-name="${escapeHtml(originalName)}"
                data-server-config="${encodeConfigData(serverConfig)}"
                data-action="install-to-project"
                title="${t('mcp.installToProject')}">
          <i data-lucide="download" class="w-3 h-3"></i>
          ${t('mcp.installToProject')}
        </button>
        <button class="text-xs text-success hover:text-success/80 transition-colors flex items-center gap-1"
                data-server-name="${escapeHtml(originalName)}"
                data-server-config="${encodeConfigData(serverConfig)}"
                data-action="install-to-global"
                title="${t('mcp.installToGlobal')}">
          <i data-lucide="globe" class="w-3 h-3"></i>
          ${t('mcp.installToGlobal')}
        </button>
      </div>
    </div>
  `;
}

// Render available server card for Codex mode (with Claude badge and copy to Codex button)
function renderAvailableServerCardForCodex(serverName, serverInfo) {
  const serverConfig = serverInfo.config;
  const usedIn = serverInfo.usedIn || [];
  const command = serverConfig.command || serverConfig.url || 'N/A';
  const args = serverConfig.args || [];

  // Get the actual name to use when adding
  const originalName = serverInfo.originalName || serverName;
  const hasVariant = serverInfo.originalName && serverInfo.originalName !== serverName;

  // Get source project info
  const sourceProject = serverInfo.sourceProject;
  const sourceProjectName = sourceProject ? (sourceProject.split('\\').pop() || sourceProject.split('/').pop()) : null;

  // Generate args preview
  const argsPreview = args.length > 0 ? args.slice(0, 3).join(' ') + (args.length > 3 ? '...' : '') : '';

  // Check if already in Codex
  const alreadyInCodex = codexMcpServers && codexMcpServers[originalName];

  return `
    <div class="mcp-server-card mcp-server-available bg-card border ${alreadyInCodex ? 'border-success/50' : 'border-border'} border-dashed rounded-lg p-4 hover:shadow-md hover:border-solid transition-all">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2 flex-wrap">
          <span><i data-lucide="circle-dashed" class="w-5 h-5 text-muted-foreground"></i></span>
          <h4 class="font-semibold text-foreground">${escapeHtml(originalName)}</h4>
          <span class="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">Claude</span>
          ${hasVariant ? `
            <span class="text-xs px-2 py-0.5 bg-warning/20 text-warning rounded-full" title="Different config from: ${escapeHtml(sourceProject || '')}">
              ${escapeHtml(sourceProjectName || 'variant')}
            </span>
          ` : ''}
          ${alreadyInCodex ? `<span class="text-xs px-2 py-0.5 bg-success/10 text-success rounded-full">${t('mcp.codex.alreadyAdded')}</span>` : ''}
        </div>
        ${!alreadyInCodex ? `
          <button class="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
                  data-action="copy-to-codex"
                  data-server-name="${escapeHtml(originalName)}"
                  data-server-config="${encodeConfigData(serverConfig)}"
                  title="${t('mcp.codex.copyToCodex')}">
            <i data-lucide="arrow-right" class="w-3.5 h-3.5 inline"></i> Codex
          </button>
        ` : ''}
      </div>

      <div class="mcp-server-details text-sm space-y-1">
        <div class="flex items-center gap-2 text-muted-foreground">
          <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">${t('mcp.cmd')}</span>
          <span class="truncate" title="${escapeHtml(command)}">${escapeHtml(command)}</span>
        </div>
        ${argsPreview ? `
          <div class="flex items-start gap-2 text-muted-foreground">
            <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">${t('mcp.args')}</span>
            <span class="text-xs font-mono truncate" title="${escapeHtml(args.join(' '))}">${escapeHtml(argsPreview)}</span>
          </div>
        ` : ''}
        <div class="flex items-center gap-2 text-muted-foreground">
          <span class="text-xs">${t('mcp.usedInCount').replace('{count}', usedIn.length).replace('{s}', usedIn.length !== 1 ? 's' : '')}</span>
          ${sourceProjectName ? `<span class="text-xs text-muted-foreground/70">• ${t('mcp.from')} ${escapeHtml(sourceProjectName)}</span>` : ''}
        </div>
      </div>

      <div class="mt-3 pt-3 border-t border-border flex items-center gap-2">
        <button class="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                data-action="copy-to-codex"
                data-server-name="${escapeHtml(originalName)}"
                data-server-config="${encodeConfigData(serverConfig)}"
                title="${t('mcp.codex.copyToCodex')}">
          <i data-lucide="download" class="w-3 h-3"></i>
          ${t('mcp.codex.install')}
        </button>
      </div>
    </div>
  `;
}

// ========================================
// Codex MCP Server Card Renderer
// ========================================

function renderCodexServerCard(serverName, serverConfig) {
  const isStdio = !!serverConfig.command;
  const isHttp = !!serverConfig.url;
  const isEnabled = serverConfig.enabled !== false; // Default to enabled
  const command = serverConfig.command || serverConfig.url || 'N/A';
  const args = serverConfig.args || [];
  const hasEnv = serverConfig.env && Object.keys(serverConfig.env).length > 0;

  // Server type badge
  const typeBadge = isHttp
    ? `<span class="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">HTTP</span>`
    : `<span class="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full">STDIO</span>`;

  return `
    <div class="mcp-server-card bg-card border border-primary/20 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer ${!isEnabled ? 'opacity-60' : ''}"
         data-server-name="${escapeHtml(serverName)}"
         data-server-config="${encodeConfigData(serverConfig)}"
         data-cli-type="codex"
         data-action="view-details-codex"
         title="${t('mcp.clickToEdit')}">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2 flex-wrap">
          <span>${isEnabled ? '<i data-lucide="check-circle" class="w-5 h-5 text-primary"></i>' : '<i data-lucide="circle" class="w-5 h-5 text-muted-foreground"></i>'}</span>
          <h4 class="font-semibold text-foreground">${escapeHtml(serverName)}</h4>
          <span class="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full">Codex</span>
          ${typeBadge}
        </div>
        <label class="mcp-toggle relative inline-flex items-center cursor-pointer" onclick="event.stopPropagation()">
          <input type="checkbox" class="sr-only peer"
                 ${isEnabled ? 'checked' : ''}
                 data-server-name="${escapeHtml(serverName)}"
                 data-action="toggle-codex">
          <div class="w-9 h-5 bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>

      <div class="mcp-server-details text-sm space-y-1">
        <div class="flex items-center gap-2 text-muted-foreground">
          <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">${isHttp ? t('mcp.url') : t('mcp.cmd')}</span>
          <span class="truncate" title="${escapeHtml(command)}">${escapeHtml(command)}</span>
        </div>
        ${args.length > 0 ? `
          <div class="flex items-start gap-2 text-muted-foreground">
            <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">${t('mcp.args')}</span>
            <span class="text-xs font-mono truncate" title="${escapeHtml(args.join(' '))}">${escapeHtml(args.slice(0, 3).join(' '))}${args.length > 3 ? '...' : ''}</span>
          </div>
        ` : ''}
        ${hasEnv ? `
          <div class="flex items-center gap-2 text-muted-foreground">
            <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">${t('mcp.env')}</span>
            <span class="text-xs">${Object.keys(serverConfig.env).length} ${t('mcp.variables')}</span>
          </div>
        ` : ''}
        ${serverConfig.enabled_tools ? `
          <div class="flex items-center gap-2 text-muted-foreground">
            <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">${t('mcp.codex.enabledTools')}</span>
            <span class="text-xs">${serverConfig.enabled_tools.length} ${t('mcp.codex.tools')}</span>
          </div>
        ` : ''}
      </div>

      <div class="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2" onclick="event.stopPropagation()">
        <div class="flex items-center gap-2">
          <button class="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                  data-action="copy-codex-to-claude"
                  data-server-name="${escapeHtml(serverName)}"
                  data-server-config="${encodeConfigData(serverConfig)}"
                  title="${t('mcp.codex.copyToClaude')}">
            <i data-lucide="copy" class="w-3 h-3"></i>
            ${t('mcp.codex.copyToClaude')}
          </button>
        </div>
        <button class="text-xs text-destructive hover:text-destructive/80 transition-colors"
                data-server-name="${escapeHtml(serverName)}"
                data-action="remove-codex">
          ${t('mcp.codex.remove')}
        </button>
      </div>
    </div>
  `;
}

// Render card for cross-CLI servers (servers from other CLI not in current CLI)
function renderCrossCliServerCard(server, isClaude) {
  const { name, config, fromCli } = server;
  const isStdio = !!config.command;
  const isHttp = !!config.url;
  const command = config.command || config.url || 'N/A';
  const args = config.args || [];

  // Icon and color based on source CLI
  const icon = fromCli === 'codex' ? 'circle-dashed' : 'circle';
  const sourceBadgeColor = fromCli === 'codex' ? 'green' : 'orange';
  const targetCli = isClaude ? 'project' : 'codex';
  const buttonText = isClaude ? t('mcp.codex.copyToClaude') : t('mcp.claude.copyToCodex');
  const typeBadge = isHttp
    ? `<span class="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">HTTP</span>`
    : `<span class="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-full">STDIO</span>`;

  // CLI badge with color
  const cliBadge = fromCli === 'codex'
    ? `<span class="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full">Codex</span>`
    : `<span class="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 rounded-full">Claude</span>`;

  return `
    <div class="mcp-server-card bg-card border border-dashed border-primary/20 rounded-lg p-4 hover:shadow-md hover:border-solid transition-all">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-start gap-3">
          <div class="shrink-0">
            <i data-lucide="${icon}" class="w-5 h-5 text-primary"></i>
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap mb-1">
              <h4 class="font-semibold text-foreground">${escapeHtml(name)}</h4>
              ${cliBadge}
              ${typeBadge}
            </div>
            <div class="text-sm space-y-1 text-muted-foreground">
              <div class="flex items-center gap-2">
                <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">${isHttp ? t('mcp.url') : t('mcp.cmd')}</span>
                <span class="truncate text-xs" title="${escapeHtml(command)}">${escapeHtml(command)}</span>
              </div>
              ${args.length > 0 ? `
                <div class="flex items-start gap-2">
                  <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">${t('mcp.args')}</span>
                  <span class="text-xs font-mono truncate" title="${escapeHtml(args.join(' '))}">${escapeHtml(args.slice(0, 3).join(' '))}${args.length > 3 ? '...' : ''}</span>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
      <div class="mt-3 pt-3 border-t border-border">
        <button class="w-full px-3 py-2 text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors flex items-center justify-center gap-1.5"
                data-action="copy-cross-cli"
                data-server-name="${escapeHtml(name)}"
                data-server-config="${encodeConfigData(config)}"
                data-from-cli="${fromCli}"
                data-target-cli="${targetCli}">
          <i data-lucide="copy" class="w-4 h-4"></i>
          ${buttonText}
        </button>
      </div>
    </div>
  `;
}

// Copy server from one CLI to another
async function copyCrossCliServer(name, config, fromCli, targetCli) {
  try {
    let endpoint, body;

    if (targetCli === 'codex') {
      // Copy from Claude to Codex
      endpoint = '/api/codex-mcp-add';
      body = { serverName: name, serverConfig: config };
    } else if (targetCli === 'project') {
      // Copy from Codex to Claude project
      endpoint = '/api/mcp-copy-server';
      body = { projectPath, serverName: name, serverConfig: config, configType: 'mcp' };
    } else if (targetCli === 'global') {
      // Copy to Claude global
      endpoint = '/api/mcp-add-global-server';
      body = { serverName: name, serverConfig: config };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (data.success) {
      const targetName = targetCli === 'codex' ? 'Codex' : 'Claude';
      showToast(t('mcp.success'), `${t('mcp.serverInstalled')} (${targetName})`, 'success');
      await loadMcpConfig();
      renderMcpManager();
    } else {
      showToast(t('mcp.error'), data.error, 'error');
    }
  } catch (error) {
    showToast(t('mcp.error'), error.message, 'error');
  }
}

// ========================================
// Codex MCP Create Modal
// ========================================

function openCodexMcpCreateModal() {
  // Reuse the existing modal with different settings
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
    // Set scope to codex
    const scopeSelect = document.getElementById('mcpServerScope');
    if (scopeSelect) {
      // Add codex option if not exists
      if (!scopeSelect.querySelector('option[value="codex"]')) {
        const codexOption = document.createElement('option');
        codexOption.value = 'codex';
        codexOption.textContent = t('mcp.codex.scopeCodex');
        scopeSelect.appendChild(codexOption);
      }
      scopeSelect.value = 'codex';
    }
    // Focus on name input
    document.getElementById('mcpServerName').focus();
    // Setup JSON input listener
    setupMcpJsonListener();
  }
}

function attachMcpEventListeners() {
  // Debug: Log event listener attachment
  const viewDetailsCards = document.querySelectorAll('.mcp-server-card[data-action="view-details"]');
  const codexCards = document.querySelectorAll('.mcp-server-card[data-action="view-details-codex"]');
  console.log('[MCP] Attaching event listeners - Claude cards:', viewDetailsCards.length, 'Codex cards:', codexCards.length);

  // Toggle switches
  document.querySelectorAll('.mcp-server-card input[data-action="toggle"]').forEach(input => {
    input.addEventListener('change', async (e) => {
      const serverName = e.target.dataset.serverName;
      const enable = e.target.checked;
      await toggleMcpServer(serverName, enable);
    });
  });

  // Add from other projects (with scope selection)
  document.querySelectorAll('.mcp-server-card button[data-action="add-from-other"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      try {
        const serverName = btn.dataset.serverName;
        const serverConfig = decodeConfigData(btn.dataset.serverConfig);
        const scope = btn.dataset.scope; // 'project' or 'global'

        if (scope === 'global') {
          await addGlobalMcpServer(serverName, serverConfig);
        } else {
          await copyMcpServerToProject(serverName, serverConfig);
        }
      } catch (err) {
        console.error('[MCP] Error adding server from other project:', err);
      }
    });
  });

  // Remove buttons (project-level)
  document.querySelectorAll('.mcp-server-card button[data-action="remove"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const serverName = btn.dataset.serverName;
      if (confirm(t('mcp.removeConfirm', { name: serverName }))) {
        await removeMcpServerFromProject(serverName);
      }
    });
  });

  // Remove buttons (global-level)
  document.querySelectorAll('.mcp-server-card button[data-action="remove-global"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const serverName = btn.dataset.serverName;
      if (confirm(t('mcp.removeGlobalConfirm', { name: serverName }))) {
        await removeGlobalMcpServer(serverName);
      }
    });
  });

  // Install to project buttons
  document.querySelectorAll('.mcp-server-card button[data-action="install-to-project"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      try {
        const serverName = btn.dataset.serverName;
        const serverConfig = decodeConfigData(btn.dataset.serverConfig);
        await copyMcpServerToProject(serverName, serverConfig);
      } catch (err) {
        console.error('[MCP] Error installing to project:', err);
      }
    });
  });

  // Install to global buttons
  document.querySelectorAll('.mcp-server-card button[data-action="install-to-global"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      try {
        const serverName = btn.dataset.serverName;
        const serverConfig = decodeConfigData(btn.dataset.serverConfig);
        await addGlobalMcpServer(serverName, serverConfig);
      } catch (err) {
        console.error('[MCP] Error installing to global:', err);
      }
    });
  });

  // Save as template buttons
  document.querySelectorAll('.mcp-server-card button[data-action="save-as-template"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      try {
        const serverName = btn.dataset.serverName;
        const serverConfig = decodeConfigData(btn.dataset.serverConfig);
        await saveMcpAsTemplate(serverName, serverConfig);
      } catch (err) {
        console.error('[MCP] Error saving as template:', err);
      }
    });
  });

  // Install from template buttons
  document.querySelectorAll('.mcp-template-card button[data-action="install-template"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const templateName = btn.dataset.templateName;
      const scope = btn.dataset.scope || 'project';
      await installFromTemplate(templateName, scope);
    });
  });

  // Delete template buttons
  document.querySelectorAll('.mcp-template-card button[data-action="delete-template"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const templateName = btn.dataset.templateName;
      if (confirm(t('mcp.deleteTemplateConfirm', { name: templateName }))) {
        await deleteMcpTemplate(templateName);
      }
    });
  });

  // ========================================
  // CCW Tools MCP Event Listeners
  // ========================================

  // CCW Tools action buttons (workspace/global install/update)
  const ccwActions = {
    'update-ccw-workspace': () => updateCcwToolsMcp('workspace'),
    'update-ccw-global': () => updateCcwToolsMcp('global'),
    'install-ccw-workspace': () => installCcwToolsMcp('workspace'),
    'install-ccw-global': () => installCcwToolsMcp('global'),
    'install-ccw-codex': () => installCcwToolsMcpToCodex()
  };

  // Mode-specific and conditionally rendered actions (don't warn if not found)
  const conditionalActions = new Set([
    'install-ccw-codex',      // Only in Codex mode
    'update-ccw-workspace',   // Only if ccw-tools installed
    'update-ccw-global'       // Only if ccw-tools installed
  ]);

  Object.entries(ccwActions).forEach(([action, handler]) => {
    const btns = document.querySelectorAll(`button[data-action="${action}"]`);

    if (btns.length > 0) {
      console.log(`[MCP] Attaching listener to ${action} (${btns.length} button(s) found)`);
      btns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          console.log(`[MCP] Button clicked: ${action}`);
          try {
            await handler();
          } catch (err) {
            console.error(`[MCP] Error executing handler for ${action}:`, err);
            if (typeof showRefreshToast === 'function') {
              showRefreshToast(`Action failed: ${err.message}`, 'error');
            }
          }
        });
      });
    } else if (!conditionalActions.has(action)) {
      // Only warn if button is not conditionally rendered
      console.warn(`[MCP] No buttons found for action: ${action}`);
    }
  });

  // ========================================
  // Codex MCP Event Listeners
  // ========================================

  // Toggle Codex MCP servers
  document.querySelectorAll('.mcp-server-card input[data-action="toggle-codex"]').forEach(input => {
    input.addEventListener('change', async (e) => {
      const serverName = e.target.dataset.serverName;
      const enable = e.target.checked;
      await toggleCodexMcpServer(serverName, enable);
    });
  });

  // Remove Codex MCP servers
  document.querySelectorAll('.mcp-server-card button[data-action="remove-codex"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const serverName = btn.dataset.serverName;
      if (confirm(t('mcp.codex.removeConfirm', { name: serverName }))) {
        await removeCodexMcpServer(serverName);
      }
    });
  });

  // Copy Claude servers to Codex
  document.querySelectorAll('button[data-action="copy-to-codex"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const serverName = btn.dataset.serverName;
        const serverConfig = decodeConfigData(btn.dataset.serverConfig);
        console.log('[MCP] Copying to Codex:', serverName);
        await copyClaudeServerToCodex(serverName, serverConfig);
      } catch (err) {
        console.error('[MCP] Error copying to Codex:', err);
      }
    });
  });

  // Copy Codex servers to Claude
  document.querySelectorAll('button[data-action="copy-codex-to-claude"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const serverName = btn.dataset.serverName;
      let serverConfig;
      try {
        serverConfig = decodeConfigData(btn.dataset.serverConfig);
      } catch (err) {
        console.error('[MCP] JSON Parse Error:', err);
        if (typeof showRefreshToast === 'function') {
          showRefreshToast('Failed to parse server configuration', 'error');
        }
        return;
      }
      console.log('[MCP] Copying Codex to Claude:', serverName);
      await copyCodexServerToClaude(serverName, serverConfig);
    });
  });

  // Copy servers across CLI tools
  document.querySelectorAll('button[data-action="copy-cross-cli"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const serverName = btn.dataset.serverName;
      let serverConfig;
      try {
        serverConfig = decodeConfigData(btn.dataset.serverConfig);
      } catch (err) {
        console.error('[MCP] JSON Parse Error:', err);
        if (typeof showRefreshToast === 'function') {
          showRefreshToast('Failed to parse server configuration', 'error');
        }
        return;
      }
      const fromCli = btn.dataset.fromCli;
      const targetCli = btn.dataset.targetCli;
      console.log('[MCP] Copying cross-CLI:', serverName, 'from', fromCli, 'to', targetCli);
      await copyCrossCliServer(serverName, serverConfig, fromCli, targetCli);
    });
  });

  // View details / Edit - click on Claude server card
  document.querySelectorAll('.mcp-server-card[data-action="view-details"]').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't trigger if clicking on buttons or toggle
      if (e.target.closest('button') || e.target.closest('label') || e.target.closest('input')) {
        return;
      }
      try {
        const serverName = card.dataset.serverName;
        const configData = card.dataset.serverConfig;
        if (!configData) {
          console.error('[MCP] Missing server config for:', serverName);
          return;
        }
        const serverConfig = decodeConfigData(configData);
        if (!serverConfig) {
          console.error('[MCP] Failed to decode server config for:', serverName);
          return;
        }
        const serverSource = card.dataset.serverSource;
        console.log('[MCP] Card clicked:', serverName, serverSource);
        showMcpEditModal(serverName, serverConfig, serverSource, 'claude');
      } catch (err) {
        console.error('[MCP] Error handling card click:', err);
      }
    });
  });

  // View details / Edit - click on Codex server card
  document.querySelectorAll('.mcp-server-card[data-action="view-details-codex"]').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't trigger if clicking on buttons or toggle
      if (e.target.closest('button') || e.target.closest('label') || e.target.closest('input')) {
        return;
      }
      try {
        const serverName = card.dataset.serverName;
        const configData = card.dataset.serverConfig;
        if (!configData) {
          console.error('[MCP] Missing server config for:', serverName);
          return;
        }
        const serverConfig = decodeConfigData(configData);
        if (!serverConfig) {
          console.error('[MCP] Failed to decode server config for:', serverName);
          return;
        }
        console.log('[MCP] Codex card clicked:', serverName);
        showMcpEditModal(serverName, serverConfig, 'codex', 'codex');
      } catch (err) {
        console.error('[MCP] Error handling Codex card click:', err);
      }
    });
  });

  // Modal close button
  const closeBtn = document.getElementById('mcpDetailsModalClose');
  const modal = document.getElementById('mcpDetailsModal');
  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  }
}

// ========================================
// MCP Edit Modal (replaces Details Modal)
// ========================================

// Store current editing context
let mcpEditContext = {
  serverName: null,
  serverConfig: null,
  serverSource: null,
  cliType: 'claude'
};

function showMcpDetails(serverName, serverConfig, serverSource, cliType = 'claude') {
  showMcpEditModal(serverName, serverConfig, serverSource, cliType);
}

function showMcpEditModal(serverName, serverConfig, serverSource, cliType = 'claude') {
  const modal = document.getElementById('mcpDetailsModal');
  const modalBody = document.getElementById('mcpDetailsModalBody');

  if (!modal || !modalBody) return;

  // Store editing context
  mcpEditContext = {
    serverName,
    serverConfig: JSON.parse(JSON.stringify(serverConfig)), // Deep clone
    serverSource,
    cliType
  };

  // Check if editable (enterprise is read-only)
  const isReadOnly = serverSource === 'enterprise';
  const isCodex = cliType === 'codex';

  // Build source badge
  let sourceBadge = '';
  if (serverSource === 'enterprise') {
    sourceBadge = `<span class="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-warning/20 text-warning">${t('mcp.sourceEnterprise')}</span>`;
  } else if (serverSource === 'global') {
    sourceBadge = `<span class="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-success/10 text-success">${t('mcp.sourceGlobal')}</span>`;
  } else if (serverSource === 'project') {
    sourceBadge = `<span class="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary">${t('mcp.sourceProject')}</span>`;
  } else if (isCodex) {
    sourceBadge = `<span class="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">Codex</span>`;
  }

  // Format args and env for textarea
  const argsText = (serverConfig.args || []).join('\n');
  const envText = Object.entries(serverConfig.env || {}).map(([k, v]) => `${k}=${v}`).join('\n');

  // Build edit form HTML
  modalBody.innerHTML = `
    <div class="space-y-4">
      <!-- Server Name and Source -->
      <div>
        <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">${t('mcp.detailsModal.serverName')}</label>
        <div class="mt-1 flex items-center gap-2">
          <input type="text" id="mcpEditName" value="${escapeHtml(serverName)}"
                 class="text-lg font-bold text-foreground bg-transparent border-b border-border focus:border-primary outline-none px-1 py-0.5 flex-1"
                 ${isReadOnly ? 'disabled' : ''}
                 placeholder="${t('mcp.editModal.serverNamePlaceholder')}">
          ${sourceBadge}
        </div>
      </div>

      <!-- Command/URL -->
      <div>
        <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
          ${serverConfig.url ? t('mcp.url') : t('mcp.cmd')}
        </label>
        <input type="text" id="mcpEditCommand" value="${escapeHtml(serverConfig.command || serverConfig.url || '')}"
               class="w-full px-3 py-2 text-sm font-mono bg-muted border border-border rounded-lg focus:border-primary outline-none"
               ${isReadOnly ? 'disabled' : ''}
               placeholder="${serverConfig.url ? 'https://...' : 'npx, node, python...'}">
      </div>

      <!-- Arguments -->
      <div>
        <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
          ${t('mcp.args')} <span class="font-normal">(${t('mcp.editModal.onePerLine')})</span>
        </label>
        <textarea id="mcpEditArgs" rows="3"
                  class="w-full px-3 py-2 text-sm font-mono bg-muted border border-border rounded-lg focus:border-primary outline-none resize-none"
                  ${isReadOnly ? 'disabled' : ''}
                  placeholder="-y&#10;package-name">${escapeHtml(argsText)}</textarea>
      </div>

      <!-- Environment Variables -->
      <div>
        <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
          ${t('mcp.env')} <span class="font-normal">(KEY=VALUE ${t('mcp.editModal.onePerLine')})</span>
        </label>
        <textarea id="mcpEditEnv" rows="3"
                  class="w-full px-3 py-2 text-sm font-mono bg-muted border border-border rounded-lg focus:border-primary outline-none resize-none"
                  ${isReadOnly ? 'disabled' : ''}
                  placeholder="API_KEY=your-key&#10;DEBUG=true">${escapeHtml(envText)}</textarea>
      </div>

      ${isCodex ? `
      <!-- Codex-specific: enabled_tools -->
      <div>
        <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
          ${t('mcp.codex.enabledTools')} <span class="font-normal">(${t('mcp.editModal.onePerLine')})</span>
        </label>
        <textarea id="mcpEditEnabledTools" rows="2"
                  class="w-full px-3 py-2 text-sm font-mono bg-muted border border-border rounded-lg focus:border-primary outline-none resize-none"
                  ${isReadOnly ? 'disabled' : ''}
                  placeholder="tool1&#10;tool2">${escapeHtml((serverConfig.enabled_tools || []).join('\n'))}</textarea>
      </div>
      ` : ''}

      <!-- Raw JSON Preview (collapsible) -->
      <details class="group">
        <summary class="text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer flex items-center gap-1">
          <i data-lucide="chevron-right" class="w-3 h-3 transition-transform group-open:rotate-90"></i>
          Raw JSON
        </summary>
        <pre id="mcpEditJsonPreview" class="mt-2 bg-muted rounded-lg p-3 text-xs font-mono overflow-x-auto">${escapeHtml(JSON.stringify(serverConfig, null, 2))}</pre>
      </details>

      <!-- Action Buttons -->
      ${!isReadOnly ? `
      <div class="flex items-center justify-between pt-4 border-t border-border">
        <div class="flex items-center gap-2">
          ${serverSource === 'project' || isCodex ? `
            <button onclick="deleteMcpFromEdit()" class="px-4 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors flex items-center gap-1.5">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
              ${t('mcp.editModal.delete')}
            </button>
          ` : ''}
        </div>
        <div class="flex items-center gap-2">
          <button onclick="closeMcpEditModal()" class="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg transition-colors">
            ${t('common.cancel')}
          </button>
          <button onclick="saveMcpEdit()" class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5">
            <i data-lucide="check" class="w-4 h-4"></i>
            ${t('mcp.editModal.save')}
          </button>
        </div>
      </div>
      ` : `
      <div class="flex items-center justify-end pt-4 border-t border-border">
        <button onclick="closeMcpEditModal()" class="px-4 py-2 text-sm bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors">
          ${t('common.close')}
        </button>
      </div>
      `}
    </div>
  `;

  // Update modal title
  const modalTitle = modal.querySelector('h2');
  if (modalTitle) {
    modalTitle.textContent = isReadOnly ? t('mcp.detailsModal.title') : t('mcp.editModal.title');
  }

  // Show modal
  modal.classList.remove('hidden');

  // Re-initialize Lucide icons in modal
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Add input listeners to update JSON preview
  if (!isReadOnly) {
    ['mcpEditCommand', 'mcpEditArgs', 'mcpEditEnv', 'mcpEditEnabledTools'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', updateMcpEditJsonPreview);
      }
    });
  }
}

function closeMcpEditModal() {
  const modal = document.getElementById('mcpDetailsModal');
  if (modal) {
    modal.classList.add('hidden');
  }
  mcpEditContext = { serverName: null, serverConfig: null, serverSource: null, cliType: 'claude' };
}

function updateMcpEditJsonPreview() {
  const preview = document.getElementById('mcpEditJsonPreview');
  if (!preview) return;

  const config = buildConfigFromEditForm();
  preview.textContent = JSON.stringify(config, null, 2);
}

function buildConfigFromEditForm() {
  const command = document.getElementById('mcpEditCommand')?.value.trim() || '';
  const argsText = document.getElementById('mcpEditArgs')?.value.trim() || '';
  const envText = document.getElementById('mcpEditEnv')?.value.trim() || '';
  const enabledToolsEl = document.getElementById('mcpEditEnabledTools');

  // Build config
  const config = {};

  // Command or URL
  if (mcpEditContext.serverConfig?.url) {
    config.url = command;
  } else {
    config.command = command;
  }

  // Args
  if (argsText) {
    config.args = argsText.split('\n').map(a => a.trim()).filter(a => a);
  }

  // Env
  if (envText) {
    config.env = {};
    envText.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && trimmed.includes('=')) {
        const eqIndex = trimmed.indexOf('=');
        const key = trimmed.substring(0, eqIndex).trim();
        const value = trimmed.substring(eqIndex + 1).trim();
        if (key) {
          config.env[key] = value;
        }
      }
    });
  }

  // Codex-specific: enabled_tools
  if (enabledToolsEl) {
    const toolsText = enabledToolsEl.value.trim();
    if (toolsText) {
      config.enabled_tools = toolsText.split('\n').map(t => t.trim()).filter(t => t);
    }
  }

  return config;
}

async function saveMcpEdit() {
  const newName = document.getElementById('mcpEditName')?.value.trim();
  if (!newName) {
    showRefreshToast(t('mcp.editModal.nameRequired'), 'error');
    return;
  }

  const newConfig = buildConfigFromEditForm();

  if (!newConfig.command && !newConfig.url) {
    showRefreshToast(t('mcp.editModal.commandRequired'), 'error');
    return;
  }

  const { serverName, serverSource, cliType } = mcpEditContext;
  const nameChanged = newName !== serverName;

  try {
    if (cliType === 'codex') {
      // Codex MCP update
      // If name changed, remove old and add new
      if (nameChanged) {
        await removeCodexMcpServer(serverName);
      }
      await addCodexMcpServer(newName, newConfig);
    } else if (serverSource === 'global') {
      // Global MCP update
      if (nameChanged) {
        await removeGlobalMcpServer(serverName);
      }
      await addGlobalMcpServer(newName, newConfig);
    } else if (serverSource === 'project') {
      // Project MCP update
      if (nameChanged) {
        await removeMcpServerFromProject(serverName);
      }
      await copyMcpServerToProject(newName, newConfig, 'mcp');
    }

    closeMcpEditModal();
    showRefreshToast(t('mcp.editModal.saved', { name: newName }), 'success');
  } catch (err) {
    console.error('Failed to save MCP edit:', err);
    showRefreshToast(t('mcp.editModal.saveFailed') + ': ' + err.message, 'error');
  }
}

async function deleteMcpFromEdit() {
  const { serverName, serverSource, cliType } = mcpEditContext;

  if (!confirm(t('mcp.editModal.deleteConfirm', { name: serverName }))) {
    return;
  }

  try {
    if (cliType === 'codex') {
      await removeCodexMcpServer(serverName);
    } else if (serverSource === 'global') {
      await removeGlobalMcpServer(serverName);
    } else if (serverSource === 'project') {
      await removeMcpServerFromProject(serverName);
    }

    closeMcpEditModal();
    showRefreshToast(t('mcp.editModal.deleted', { name: serverName }), 'success');
  } catch (err) {
    console.error('Failed to delete MCP:', err);
    showRefreshToast(t('mcp.editModal.deleteFailed') + ': ' + err.message, 'error');
  }
}

// ========================================
// MCP Template Management Functions
// ========================================

let mcpTemplates = [];

/**
 * Load all MCP templates from API
 */
async function loadMcpTemplates() {
  try {
    const response = await fetch('/api/mcp-templates');
    const data = await response.json();

    if (data.success) {
      mcpTemplates = data.templates || [];
      console.log('[MCP Templates] Loaded', mcpTemplates.length, 'templates');
    } else {
      console.error('[MCP Templates] Failed to load:', data.error);
      mcpTemplates = [];
    }

    return mcpTemplates;
  } catch (error) {
    console.error('[MCP Templates] Error loading templates:', error);
    mcpTemplates = [];
    return [];
  }
}

/**
 * Save MCP server configuration as a template
 */
async function saveMcpAsTemplate(serverName, serverConfig) {
  try {
    // Prompt for template name and description
    const templateName = prompt(t('mcp.enterTemplateName'), serverName);
    if (!templateName) return;

    const description = prompt(t('mcp.enterTemplateDesc'), `Template for ${serverName}`);

    const payload = {
      name: templateName,
      description: description || '',
      serverConfig: serverConfig,
      category: 'user'
    };

    const response = await fetch('/api/mcp-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.success) {
      showRefreshToast(t('mcp.templateSaved', { name: templateName }), 'success');
      await loadMcpTemplates();
      await renderMcpManager(); // Refresh view
    } else {
      showRefreshToast(t('mcp.templateSaveFailed', { error: data.error }), 'error');
    }
  } catch (error) {
    console.error('[MCP] Save template error:', error);
    showRefreshToast(t('mcp.templateSaveFailed', { error: error.message }), 'error');
  }
}

/**
 * Install MCP server from template
 */
async function installFromTemplate(templateName, scope = 'project') {
  try {
    // Find template
    const template = mcpTemplates.find(t => t.name === templateName);
    if (!template) {
      showRefreshToast(t('mcp.templateNotFound', { name: templateName }), 'error');
      return;
    }

    // Prompt for server name (default to template name)
    const serverName = prompt(t('mcp.enterServerName'), templateName);
    if (!serverName) return;

    // Install based on scope
    if (scope === 'project') {
      await copyMcpServerToProject(serverName, template.serverConfig);
    } else if (scope === 'global') {
      await addGlobalMcpServer(serverName, template.serverConfig);
    }

    showRefreshToast(t('mcp.templateInstalled', { name: serverName }), 'success');
    await renderMcpManager();
  } catch (error) {
    console.error('[MCP] Install from template error:', error);
    showRefreshToast(t('mcp.templateInstallFailed', { error: error.message }), 'error');
  }
}

/**
 * Delete MCP template
 */
async function deleteMcpTemplate(templateName) {
  try {
    const response = await fetch(`/api/mcp-templates/${encodeURIComponent(templateName)}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (data.success) {
      showRefreshToast(t('mcp.templateDeleted', { name: templateName }), 'success');
      await loadMcpTemplates();
      await renderMcpManager();
    } else {
      showRefreshToast(t('mcp.templateDeleteFailed', { error: data.error }), 'error');
    }
  } catch (error) {
    console.error('[MCP] Delete template error:', error);
    showRefreshToast(t('mcp.templateDeleteFailed', { error: error.message }), 'error');
  }
}

// ========== Global Exports for onclick handlers ==========
// Expose functions to global scope to support inline onclick handlers
window.openCodexMcpCreateModal = openCodexMcpCreateModal;
window.closeMcpEditModal = closeMcpEditModal;
window.saveMcpEdit = saveMcpEdit;
window.deleteMcpFromEdit = deleteMcpFromEdit;
window.saveMcpAsTemplate = saveMcpAsTemplate;
