// MCP Manager View
// Renders the MCP server management interface

// CCW Tools available for MCP
const CCW_MCP_TOOLS = [
  // Core tools (always recommended)
  { name: 'write_file', desc: 'Write/create files', core: true },
  { name: 'edit_file', desc: 'Edit/replace content', core: true },
  { name: 'codex_lens', desc: 'Code index & search', core: true },
  { name: 'smart_search', desc: 'Quick regex/NL search', core: true },
  // Optional tools
  { name: 'session_manager', desc: 'Workflow sessions', core: false },
  { name: 'generate_module_docs', desc: 'Generate docs', core: false },
  { name: 'update_module_claude', desc: 'Update CLAUDE.md', core: false },
  { name: 'cli_executor', desc: 'Gemini/Qwen/Codex CLI', core: false },
];

// Get currently enabled tools from installed config
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

  // Prepare Codex servers data
  const codexServerEntries = Object.entries(codexMcpServers || {});
  const codexConfigExists = codexMcpConfig?.exists || false;
  const codexConfigPath = codexMcpConfig?.configPath || '~/.codex/config.toml';

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
              <button class="cli-mode-btn px-4 py-2 text-sm font-medium rounded-md transition-all ${currentCliMode === 'codex' ? 'bg-orange-500 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
                      onclick="setCliMode('codex')">
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
      <!-- Codex MCP Servers Section -->
      <div class="mcp-section mb-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <i data-lucide="code-2" class="w-5 h-5 text-orange-500"></i>
              <h3 class="text-lg font-semibold text-foreground">${t('mcp.codex.globalServers')}</h3>
            </div>
            <button class="px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1"
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
        <div class="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-4">
          <div class="flex items-start gap-3">
            <i data-lucide="info" class="w-5 h-5 text-orange-500 shrink-0 mt-0.5"></i>
            <div class="text-sm">
              <p class="text-orange-800 dark:text-orange-200 font-medium mb-1">${t('mcp.codex.infoTitle')}</p>
              <p class="text-orange-700 dark:text-orange-300 text-xs">${t('mcp.codex.infoDesc')}</p>
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
                    ${alreadyInCodex ? `<span class="text-xs px-2 py-0.5 bg-success/10 text-success rounded-full">${t('mcp.codex.alreadyAdded')}</span>` : ''}
                  </div>
                  ${!alreadyInCodex ? `
                    <button class="px-3 py-1 text-xs bg-orange-500 text-white rounded hover:opacity-90 transition-opacity"
                            onclick="copyClaudeServerToCodex('${escapeHtml(serverName)}', ${JSON.stringify(serverConfig).replace(/'/g, "&#39;")})"
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
      ` : `
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
              </div>
            </div>
            <div class="shrink-0 flex gap-2">
              ${isCcwToolsInstalled ? `
                <button class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1"
                        onclick="updateCcwToolsMcp('workspace')"
                        title="${t('mcp.updateInWorkspace')}">
                  <i data-lucide="folder" class="w-4 h-4"></i>
                  ${t('mcp.updateInWorkspace')}
                </button>
                <button class="px-4 py-2 text-sm bg-success text-success-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1"
                        onclick="updateCcwToolsMcp('global')"
                        title="${t('mcp.updateInGlobal')}">
                  <i data-lucide="globe" class="w-4 h-4"></i>
                  ${t('mcp.updateInGlobal')}
                </button>
              ` : `
                <button class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1"
                        onclick="installCcwToolsMcp('workspace')"
                        title="${t('mcp.installToWorkspace')}">
                  <i data-lucide="folder" class="w-4 h-4"></i>
                  ${t('mcp.installToWorkspace')}
                </button>
                <button class="px-4 py-2 text-sm bg-success text-success-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1"
                        onclick="installCcwToolsMcp('global')"
                        title="${t('mcp.installToGlobal')}">
                  <i data-lucide="globe" class="w-4 h-4"></i>
                  ${t('mcp.installToGlobal')}
                </button>
              `}
            </div>
          </div>
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
            ${hasMcpJson ? `
              <span class="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-success/10 text-success rounded-md border border-success/20">
                <i data-lucide="file-check" class="w-3.5 h-3.5"></i>
                .mcp.json
              </span>
            ` : `
              <span class="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-muted text-muted-foreground rounded-md border border-border" title="New servers will create .mcp.json">
                <i data-lucide="file-plus" class="w-3.5 h-3.5"></i>
                Will use .mcp.json
              </span>
            `}
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

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${mcpTemplates.map(template => `
            <div class="mcp-template-card bg-card border border-border rounded-lg p-4 hover:shadow-md transition-all">
              <div class="flex items-start justify-between mb-3">
                <div class="flex-1 min-w-0">
                  <h4 class="font-semibold text-foreground truncate flex items-center gap-2">
                    <i data-lucide="layout-template" class="w-4 h-4 shrink-0"></i>
                    <span class="truncate">${escapeHtml(template.name)}</span>
                  </h4>
                  ${template.description ? `
                    <p class="text-xs text-muted-foreground mt-1 line-clamp-2">${escapeHtml(template.description)}</p>
                  ` : ''}
                </div>
              </div>

              <div class="mcp-server-details text-sm space-y-1 mb-3">
                <div class="flex items-center gap-2 text-muted-foreground">
                  <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">${t('mcp.cmd')}</span>
                  <span class="truncate text-xs" title="${escapeHtml(template.serverConfig.command)}">${escapeHtml(template.serverConfig.command)}</span>
                </div>
                ${template.serverConfig.args && template.serverConfig.args.length > 0 ? `
                  <div class="flex items-start gap-2 text-muted-foreground">
                    <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">${t('mcp.args')}</span>
                    <span class="text-xs font-mono truncate" title="${escapeHtml(template.serverConfig.args.join(' '))}">${escapeHtml(template.serverConfig.args.slice(0, 2).join(' '))}${template.serverConfig.args.length > 2 ? '...' : ''}</span>
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

  // Attach event listeners for toggle switches
  attachMcpEventListeners();
  
  // Initialize Lucide icons
  if (typeof lucide !== 'undefined') lucide.createIcons();
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
         data-server-config="${escapeHtml(JSON.stringify(config))}"
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

      <div class="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2" onclick="event.stopPropagation()">
        <div class="flex items-center gap-2">
          <button class="text-xs text-success hover:text-success/80 transition-colors flex items-center gap-1"
                  data-server-name="${escapeHtml(name)}"
                  data-server-config="${escapeHtml(JSON.stringify(config))}"
                  data-action="save-as-template"
                  title="${t('mcp.saveAsTemplate')}">
            <i data-lucide="save" class="w-3 h-3"></i>
            ${t('mcp.saveAsTemplate')}
          </button>
        </div>
        ${canRemove ? `
          <button class="text-xs text-destructive hover:text-destructive/80 transition-colors"
                  data-server-name="${escapeHtml(name)}"
                  data-action="remove">
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
    <div class="mcp-server-card mcp-server-global bg-card border border-success/30 rounded-lg p-4 hover:shadow-md transition-all">
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
                data-action="remove-global">
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
                  data-server-config='${JSON.stringify(serverConfig).replace(/'/g, "&#39;")}'
                  data-scope="project"
                  data-action="add-from-other"
                  title="${t('mcp.installToProject')}">
            <i data-lucide="folder-plus" class="w-3.5 h-3.5 inline"></i>
          </button>
          <button class="px-3 py-1 text-xs bg-success text-success-foreground rounded hover:opacity-90 transition-opacity"
                  data-server-name="${escapeHtml(originalName)}"
                  data-server-key="${escapeHtml(serverName)}"
                  data-server-config='${JSON.stringify(serverConfig).replace(/'/g, "&#39;")}'
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
                data-server-config="${escapeHtml(JSON.stringify(serverConfig))}"
                data-action="install-to-project"
                title="${t('mcp.installToProject')}">
          <i data-lucide="download" class="w-3 h-3"></i>
          ${t('mcp.installToProject')}
        </button>
        <button class="text-xs text-success hover:text-success/80 transition-colors flex items-center gap-1"
                data-server-name="${escapeHtml(originalName)}"
                data-server-config="${escapeHtml(JSON.stringify(serverConfig))}"
                data-action="install-to-global"
                title="${t('mcp.installToGlobal')}">
          <i data-lucide="globe" class="w-3 h-3"></i>
          ${t('mcp.installToGlobal')}
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
    <div class="mcp-server-card bg-card border border-orange-200 dark:border-orange-800 rounded-lg p-4 hover:shadow-md transition-all ${!isEnabled ? 'opacity-60' : ''}"
         data-server-name="${escapeHtml(serverName)}"
         data-server-config="${escapeHtml(JSON.stringify(serverConfig))}"
         data-cli-type="codex">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2">
          <span>${isEnabled ? '<i data-lucide="check-circle" class="w-5 h-5 text-orange-500"></i>' : '<i data-lucide="circle" class="w-5 h-5 text-muted-foreground"></i>'}</span>
          <h4 class="font-semibold text-foreground">${escapeHtml(serverName)}</h4>
          ${typeBadge}
        </div>
        <label class="mcp-toggle relative inline-flex items-center cursor-pointer" onclick="event.stopPropagation()">
          <input type="checkbox" class="sr-only peer"
                 ${isEnabled ? 'checked' : ''}
                 data-server-name="${escapeHtml(serverName)}"
                 data-action="toggle-codex">
          <div class="w-9 h-5 bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
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
                  onclick="copyCodexServerToClaude('${escapeHtml(serverName)}', ${JSON.stringify(serverConfig).replace(/'/g, "&#39;")})"
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
      const serverName = btn.dataset.serverName;
      const serverConfig = JSON.parse(btn.dataset.serverConfig);
      const scope = btn.dataset.scope; // 'project' or 'global'

      if (scope === 'global') {
        await addGlobalMcpServer(serverName, serverConfig);
      } else {
        await copyMcpServerToProject(serverName, serverConfig);
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
      const serverName = btn.dataset.serverName;
      const serverConfig = JSON.parse(btn.dataset.serverConfig);
      await installMcpToProject(serverName, serverConfig);
    });
  });

  // Install to global buttons
  document.querySelectorAll('.mcp-server-card button[data-action="install-to-global"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const serverName = btn.dataset.serverName;
      const serverConfig = JSON.parse(btn.dataset.serverConfig);
      await addGlobalMcpServer(serverName, serverConfig);
    });
  });

  // Save as template buttons
  document.querySelectorAll('.mcp-server-card button[data-action="save-as-template"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const serverName = btn.dataset.serverName;
      const serverConfig = JSON.parse(btn.dataset.serverConfig);
      await saveMcpAsTemplate(serverName, serverConfig);
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

  // View details - click on server card
  document.querySelectorAll('.mcp-server-card[data-action="view-details"]').forEach(card => {
    card.addEventListener('click', (e) => {
      const serverName = card.dataset.serverName;
      const serverConfig = JSON.parse(card.dataset.serverConfig);
      const serverSource = card.dataset.serverSource;
      showMcpDetails(serverName, serverConfig, serverSource);
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
// MCP Details Modal
// ========================================

function showMcpDetails(serverName, serverConfig, serverSource) {
  const modal = document.getElementById('mcpDetailsModal');
  const modalBody = document.getElementById('mcpDetailsModalBody');

  if (!modal || !modalBody) return;

  // Build source badge
  let sourceBadge = '';
  if (serverSource === 'enterprise') {
    sourceBadge = `<span class="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-warning/20 text-warning">${t('mcp.sourceEnterprise')}</span>`;
  } else if (serverSource === 'global') {
    sourceBadge = `<span class="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-success/10 text-success">${t('mcp.sourceGlobal')}</span>`;
  } else if (serverSource === 'project') {
    sourceBadge = `<span class="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary">${t('mcp.sourceProject')}</span>`;
  }

  // Build environment variables display
  let envHtml = '';
  if (serverConfig.env && Object.keys(serverConfig.env).length > 0) {
    envHtml = '<div class="mt-4"><h4 class="font-semibold text-sm text-foreground mb-2">' + t('mcp.env') + '</h4><div class="bg-muted rounded-lg p-3 space-y-1 font-mono text-xs">';
    for (const [key, value] of Object.entries(serverConfig.env)) {
      envHtml += `<div class="flex items-start gap-2"><span class="text-muted-foreground shrink-0">${escapeHtml(key)}:</span><span class="text-foreground break-all">${escapeHtml(value)}</span></div>`;
    }
    envHtml += '</div></div>';
  } else {
    envHtml = '<div class="mt-4"><h4 class="font-semibold text-sm text-foreground mb-2">' + t('mcp.env') + '</h4><p class="text-sm text-muted-foreground">' + t('mcp.detailsModal.noEnv') + '</p></div>';
  }

  modalBody.innerHTML = `
    <div class="space-y-4">
      <!-- Server Name and Source -->
      <div>
        <label class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">${t('mcp.detailsModal.serverName')}</label>
        <div class="mt-1 flex items-center gap-2">
          <h3 class="text-xl font-bold text-foreground">${escapeHtml(serverName)}</h3>
          ${sourceBadge}
        </div>
      </div>

      <!-- Configuration -->
      <div>
        <h4 class="font-semibold text-sm text-foreground mb-2">${t('mcp.detailsModal.configuration')}</h4>
        <div class="space-y-2">
          <!-- Command -->
          <div class="flex items-start gap-3">
            <span class="font-mono text-xs bg-muted px-2 py-1 rounded shrink-0">${t('mcp.cmd')}</span>
            <code class="text-sm font-mono text-foreground break-all">${escapeHtml(serverConfig.command || serverConfig.url || 'N/A')}</code>
          </div>

          <!-- Arguments -->
          ${serverConfig.args && serverConfig.args.length > 0 ? `
            <div class="flex items-start gap-3">
              <span class="font-mono text-xs bg-muted px-2 py-1 rounded shrink-0">${t('mcp.args')}</span>
              <div class="flex-1 space-y-1">
                ${serverConfig.args.map((arg, index) => `
                  <div class="text-sm font-mono text-foreground flex items-center gap-2">
                    <span class="text-muted-foreground">[${index}]</span>
                    <code class="break-all">${escapeHtml(arg)}</code>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Environment Variables -->
      ${envHtml}

      <!-- Raw JSON -->
      <div>
        <h4 class="font-semibold text-sm text-foreground mb-2">Raw JSON</h4>
        <pre class="bg-muted rounded-lg p-3 text-xs font-mono overflow-x-auto">${escapeHtml(JSON.stringify(serverConfig, null, 2))}</pre>
      </div>
    </div>
  `;

  // Show modal
  modal.classList.remove('hidden');

  // Re-initialize Lucide icons in modal
  if (typeof lucide !== 'undefined') lucide.createIcons();
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
      await installMcpToProject(serverName, template.serverConfig);
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
