// Hook Manager View
// Renders the Claude Code hooks management interface

async function renderHookManager() {
  const container = document.getElementById('mainContent');
  if (!container) return;

  // Hide stats grid and search for Hook view
  const statsGrid = document.getElementById('statsGrid');
  const searchInput = document.getElementById('searchInput');
  if (statsGrid) statsGrid.style.display = 'none';
  if (searchInput) searchInput.parentElement.style.display = 'none';

  // Load hook config if not already loaded
  if (!hookConfig.global.hooks && !hookConfig.project.hooks) {
    await loadHookConfig();
  }

  const globalHooks = hookConfig.global?.hooks || {};
  const projectHooks = hookConfig.project?.hooks || {};

  // Count hooks
  const globalHookCount = countHooks(globalHooks);
  const projectHookCount = countHooks(projectHooks);

  container.innerHTML = `
    <div class="hook-manager">
      <!-- Project Hooks -->
      <div class="hook-section mb-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <h3 class="text-lg font-semibold text-foreground">Project Hooks</h3>
            <span class="badge px-2 py-0.5 text-xs font-semibold rounded-full bg-primary-light text-primary">.claude/settings.json</span>
            <button class="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1"
                    onclick="openHookCreateModal()">
              <span>+</span> New Hook
            </button>
          </div>
          <span class="text-sm text-muted-foreground">${projectHookCount} hooks configured</span>
        </div>

        ${projectHookCount === 0 ? `
          <div class="hook-empty-state bg-card border border-border rounded-lg p-6 text-center">
            <div class="text-muted-foreground mb-3"><i data-lucide="webhook" class="w-10 h-10 mx-auto"></i></div>
            <p class="text-muted-foreground">No hooks configured for this project</p>
            <p class="text-sm text-muted-foreground mt-1">Create a hook to automate actions on tool usage</p>
          </div>
        ` : `
          <div class="hook-grid grid gap-3">
            ${renderHooksByEvent(projectHooks, 'project')}
          </div>
        `}
      </div>

      <!-- Global Hooks -->
      <div class="hook-section mb-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <h3 class="text-lg font-semibold text-foreground">Global Hooks</h3>
            <span class="badge px-2 py-0.5 text-xs font-semibold rounded-full bg-muted text-muted-foreground">~/.claude/settings.json</span>
          </div>
          <span class="text-sm text-muted-foreground">${globalHookCount} hooks configured</span>
        </div>

        ${globalHookCount === 0 ? `
          <div class="hook-empty-state bg-card border border-border rounded-lg p-6 text-center">
            <p class="text-muted-foreground">No global hooks configured</p>
            <p class="text-sm text-muted-foreground mt-1">Global hooks apply to all Claude Code sessions</p>
          </div>
        ` : `
          <div class="hook-grid grid gap-3">
            ${renderHooksByEvent(globalHooks, 'global')}
          </div>
        `}
      </div>

      <!-- Hook Wizards -->
      <div class="hook-section mb-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <h3 class="text-lg font-semibold text-foreground">Hook Wizards</h3>
            <span class="badge px-2 py-0.5 text-xs font-semibold rounded-full bg-success/20 text-success">Guided Setup</span>
          </div>
          <span class="text-sm text-muted-foreground">Configure complex hooks with guided wizards</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${renderWizardCard('memory-update')}
          ${renderWizardCard('skill-context')}
        </div>
      </div>

      <!-- Quick Install Templates -->
      <div class="hook-section">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-foreground">Quick Install Templates</h3>
          <span class="text-sm text-muted-foreground">One-click hook installation</span>
        </div>

        <div class="hook-templates-grid grid grid-cols-1 md:grid-cols-2 gap-4">
          ${renderQuickInstallCard('codexlens-update', 'CodexLens Auto-Sync', 'Auto-update code index when files are written or edited', 'PostToolUse', 'Write|Edit')}
          ${renderQuickInstallCard('ccw-notify', 'CCW Dashboard Notify', 'Notify CCW dashboard when files are written', 'PostToolUse', 'Write')}
          ${renderQuickInstallCard('log-tool', 'Tool Usage Logger', 'Log all tool executions to a file', 'PostToolUse', 'All')}
          ${renderQuickInstallCard('lint-check', 'Auto Lint Check', 'Run ESLint on JavaScript/TypeScript files after write', 'PostToolUse', 'Write')}
          ${renderQuickInstallCard('git-add', 'Auto Git Stage', 'Automatically stage written files to git', 'PostToolUse', 'Write')}
        </div>
      </div>

      <!-- Hook Environment Variables Reference -->
      <div class="hook-section mt-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-foreground">Environment Variables Reference</h3>
        </div>

        <div class="bg-card border border-border rounded-lg p-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div class="space-y-2">
              <div class="flex items-start gap-2">
                <code class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">$CLAUDE_FILE_PATHS</code>
                <span class="text-muted-foreground">Space-separated file paths affected</span>
              </div>
              <div class="flex items-start gap-2">
                <code class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">$CLAUDE_TOOL_NAME</code>
                <span class="text-muted-foreground">Name of the tool being executed</span>
              </div>
              <div class="flex items-start gap-2">
                <code class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">$CLAUDE_TOOL_INPUT</code>
                <span class="text-muted-foreground">JSON input passed to the tool</span>
              </div>
            </div>
            <div class="space-y-2">
              <div class="flex items-start gap-2">
                <code class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">$CLAUDE_SESSION_ID</code>
                <span class="text-muted-foreground">Current Claude session ID</span>
              </div>
              <div class="flex items-start gap-2">
                <code class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">$CLAUDE_PROJECT_DIR</code>
                <span class="text-muted-foreground">Current project directory path</span>
              </div>
              <div class="flex items-start gap-2">
                <code class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">$CLAUDE_WORKING_DIR</code>
                <span class="text-muted-foreground">Current working directory</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  attachHookEventListeners();

  // Initialize Lucide icons
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Load available SKILLs for skill-context wizard
async function loadAvailableSkills() {
  try {
    const response = await fetch(`/api/skills?path=${encodeURIComponent(projectPath)}`);
    if (!response.ok) throw new Error('Failed to load skills');
    const data = await response.json();
    
    const container = document.getElementById('skill-discovery-skill-context');
    if (container && data.skills) {
      if (data.skills.length === 0) {
        container.innerHTML = `
          <span class="font-mono bg-muted px-1.5 py-0.5 rounded">Available SKILLs:</span>
          <span class="text-muted-foreground ml-2">No SKILLs found in .claude/skills/</span>
        `;
      } else {
        const skillBadges = data.skills.map(skill => `
          <span class="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded" title="${escapeHtml(skill.description)}">${escapeHtml(skill.name)}</span>
        `).join('');
        container.innerHTML = `
          <span class="font-mono bg-muted px-1.5 py-0.5 rounded">Available SKILLs:</span>
          <div class="flex flex-wrap gap-1 mt-1">${skillBadges}</div>
        `;
      }
    }
    
    // Store skills for wizard use
    window.availableSkills = data.skills || [];
  } catch (err) {
    console.error('Failed to load skills:', err);
    const container = document.getElementById('skill-discovery-skill-context');
    if (container) {
      container.innerHTML = `
        <span class="font-mono bg-muted px-1.5 py-0.5 rounded">Available SKILLs:</span>
        <span class="text-destructive ml-2">Error loading skills</span>
      `;
    }
  }
}

// Call loadAvailableSkills after rendering hook manager
const originalRenderHookManager = typeof renderHookManager === 'function' ? renderHookManager : null;

function renderWizardCard(wizardId) {
  const wizard = WIZARD_TEMPLATES[wizardId];
  if (!wizard) return '';

  // Determine what to show in the tools/skills section
  const toolsSection = wizard.requiresSkillDiscovery 
    ? `
      <div class="flex items-center gap-2 text-xs text-muted-foreground mb-4">
        <span class="font-mono bg-muted px-1.5 py-0.5 rounded">Event:</span>
        <span class="px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded">UserPromptSubmit</span>
      </div>
      <div id="skill-discovery-${wizardId}" class="text-xs text-muted-foreground mb-4">
        <span class="font-mono bg-muted px-1.5 py-0.5 rounded">Available SKILLs:</span>
        <span class="text-muted-foreground ml-2">Loading...</span>
      </div>
    `
    : `
      <div class="flex items-center gap-2 text-xs text-muted-foreground mb-4">
        <span class="font-mono bg-muted px-1.5 py-0.5 rounded">CLI Tools:</span>
        <span class="px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded">gemini</span>
        <span class="px-2 py-0.5 bg-purple-500/10 text-purple-500 rounded">qwen</span>
        <span class="px-2 py-0.5 bg-green-500/10 text-green-500 rounded">codex</span>
      </div>
    `;

  return `
    <div class="hook-wizard-card bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-lg p-5 hover:shadow-lg transition-all">
      <div class="flex items-start justify-between mb-4">
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-primary/10 rounded-lg">
            <i data-lucide="${wizard.icon}" class="w-6 h-6 text-primary"></i>
          </div>
          <div>
            <h4 class="font-semibold text-foreground">${escapeHtml(wizard.name)}</h4>
            <p class="text-sm text-muted-foreground">${escapeHtml(wizard.description)}</p>
          </div>
        </div>
      </div>

      <div class="space-y-2 mb-4">
        ${wizard.options.map(opt => `
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <i data-lucide="check" class="w-4 h-4 text-success"></i>
            <span>${escapeHtml(opt.name)}: ${escapeHtml(opt.description)}</span>
          </div>
        `).join('')}
      </div>

      ${toolsSection}

      <button class="w-full px-4 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              onclick="openHookWizardModal('${wizardId}')">
        <i data-lucide="wand-2" class="w-4 h-4"></i>
        Open Wizard
      </button>
    </div>
  `;
}

function countHooks(hooks) {
  let count = 0;
  for (const event of Object.keys(hooks)) {
    const hookList = hooks[event];
    count += Array.isArray(hookList) ? hookList.length : 1;
  }
  return count;
}

function renderHooksByEvent(hooks, scope) {
  const events = Object.keys(hooks);
  if (events.length === 0) return '';

  return events.map(event => {
    const hookList = Array.isArray(hooks[event]) ? hooks[event] : [hooks[event]];

    return hookList.map((hook, index) => {
      const matcher = hook.matcher || 'All tools';
      const command = hook.command || 'N/A';
      const args = hook.args || [];

      return `
        <div class="hook-card bg-card border border-border rounded-lg p-4 hover:shadow-md transition-all">
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-2">
              ${getHookEventIconLucide(event)}
              <div>
                <h4 class="font-semibold text-foreground">${event}</h4>
                <p class="text-xs text-muted-foreground">${getHookEventDescription(event)}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button class="p-1.5 text-muted-foreground hover:text-foreground hover:bg-hover rounded transition-colors"
                      data-scope="${scope}"
                      data-event="${event}"
                      data-index="${index}"
                      data-action="edit"
                      title="Edit hook">
                <i data-lucide="pencil" class="w-4 h-4"></i>
              </button>
              <button class="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                      data-scope="${scope}"
                      data-event="${event}"
                      data-index="${index}"
                      data-action="delete"
                      title="Delete hook">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </div>

          <div class="hook-details text-sm space-y-2">
            <div class="flex items-center gap-2">
              <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">matcher</span>
              <span class="text-muted-foreground">${escapeHtml(matcher)}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">command</span>
              <span class="font-mono text-xs text-foreground">${escapeHtml(command)}</span>
            </div>
            ${args.length > 0 ? `
              <div class="flex items-start gap-2">
                <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0">args</span>
                <span class="font-mono text-xs text-muted-foreground truncate" title="${escapeHtml(args.join(' '))}">${escapeHtml(args.slice(0, 3).join(' '))}${args.length > 3 ? '...' : ''}</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }).join('');
}

function renderQuickInstallCard(templateId, title, description, event, matcher) {
  const isInstalled = isHookTemplateInstalled(templateId);
  const template = HOOK_TEMPLATES[templateId];
  const category = template?.category || 'general';

  return `
    <div class="hook-template-card bg-card border border-border rounded-lg p-4 hover:shadow-md transition-all ${isInstalled ? 'border-success bg-success-light/30' : ''}">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-2">
          ${isInstalled ? '<i data-lucide="check-circle" class="w-5 h-5 text-success"></i>' : '<i data-lucide="webhook" class="w-5 h-5"></i>'}
          <div>
            <h4 class="font-semibold text-foreground">${escapeHtml(title)}</h4>
            <p class="text-xs text-muted-foreground">${escapeHtml(description)}</p>
          </div>
        </div>
        <button class="p-1.5 text-muted-foreground hover:text-foreground hover:bg-hover rounded transition-colors"
                onclick="viewTemplateDetails('${templateId}')"
                title="View template details">
          <i data-lucide="eye" class="w-4 h-4"></i>
        </button>
      </div>

      <div class="hook-template-meta text-xs text-muted-foreground mb-3 flex items-center gap-3">
        <span class="flex items-center gap-1">
          <span class="font-mono bg-muted px-1 py-0.5 rounded">${event}</span>
        </span>
        <span class="flex items-center gap-1">
          Matches: <span class="font-medium">${matcher}</span>
        </span>
        <span class="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs">${category}</span>
      </div>

      <div class="flex items-center gap-2">
        ${isInstalled ? `
          <button class="flex-1 px-3 py-1.5 text-sm bg-destructive/10 text-destructive rounded hover:bg-destructive/20 transition-colors"
                  data-template="${templateId}"
                  data-action="uninstall">
            Uninstall
          </button>
        ` : `
          <button class="flex-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
                  data-template="${templateId}"
                  data-action="install-project">
            Install (Project)
          </button>
          <button class="px-3 py-1.5 text-sm bg-muted text-foreground rounded hover:bg-hover transition-colors"
                  data-template="${templateId}"
                  data-action="install-global">
            Global
          </button>
        `}
      </div>
    </div>
  `;
}

function isHookTemplateInstalled(templateId) {
  const template = HOOK_TEMPLATES[templateId];
  if (!template) return false;

  // Check project hooks
  const projectHooks = hookConfig.project?.hooks?.[template.event];
  if (projectHooks) {
    const hookList = Array.isArray(projectHooks) ? projectHooks : [projectHooks];
    if (hookList.some(h => h.command === template.command)) return true;
  }

  // Check global hooks
  const globalHooks = hookConfig.global?.hooks?.[template.event];
  if (globalHooks) {
    const hookList = Array.isArray(globalHooks) ? globalHooks : [globalHooks];
    if (hookList.some(h => h.command === template.command)) return true;
  }

  return false;
}

async function installHookTemplate(templateId, scope) {
  const template = HOOK_TEMPLATES[templateId];
  if (!template) {
    showRefreshToast('Template not found', 'error');
    return;
  }

  const hookData = {
    command: template.command,
    args: template.args
  };

  if (template.matcher) {
    hookData.matcher = template.matcher;
  }

  await saveHook(scope, template.event, hookData);
}

async function uninstallHookTemplate(templateId) {
  const template = HOOK_TEMPLATES[templateId];
  if (!template) return;

  // Find and remove from project hooks
  const projectHooks = hookConfig.project?.hooks?.[template.event];
  if (projectHooks) {
    const hookList = Array.isArray(projectHooks) ? projectHooks : [projectHooks];
    const index = hookList.findIndex(h => h.command === template.command);
    if (index !== -1) {
      await removeHook('project', template.event, index);
      return;
    }
  }

  // Find and remove from global hooks
  const globalHooks = hookConfig.global?.hooks?.[template.event];
  if (globalHooks) {
    const hookList = Array.isArray(globalHooks) ? globalHooks : [globalHooks];
    const index = hookList.findIndex(h => h.command === template.command);
    if (index !== -1) {
      await removeHook('global', template.event, index);
      return;
    }
  }
}

function attachHookEventListeners() {
  // Edit buttons
  document.querySelectorAll('.hook-card button[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const button = e.currentTarget;
      const scope = button.dataset.scope;
      const event = button.dataset.event;
      const index = parseInt(button.dataset.index);

      const hooks = scope === 'global' ? hookConfig.global.hooks : hookConfig.project.hooks;
      const hookList = Array.isArray(hooks[event]) ? hooks[event] : [hooks[event]];
      const hook = hookList[index];

      if (hook) {
        openHookCreateModal({
          scope: scope,
          event: event,
          index: index,
          matcher: hook.matcher || '',
          command: hook.command,
          args: hook.args || []
        });
      }
    });
  });

  // Delete buttons
  document.querySelectorAll('.hook-card button[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const button = e.currentTarget;
      const scope = button.dataset.scope;
      const event = button.dataset.event;
      const index = parseInt(button.dataset.index);

      if (confirm(`Remove this ${event} hook?`)) {
        await removeHook(scope, event, index);
      }
    });
  });

  // Install project buttons
  document.querySelectorAll('button[data-action="install-project"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const templateId = e.currentTarget.dataset.template;
      await installHookTemplate(templateId, 'project');
    });
  });

  // Install global buttons
  document.querySelectorAll('button[data-action="install-global"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const templateId = e.currentTarget.dataset.template;
      await installHookTemplate(templateId, 'global');
    });
  });

  // Uninstall buttons
  document.querySelectorAll('button[data-action="uninstall"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const templateId = e.currentTarget.dataset.template;
      await uninstallHookTemplate(templateId);
    });
  });
}
