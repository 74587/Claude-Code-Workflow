// Commands Manager View
// Manages Claude Code commands (.claude/commands/)

// ========== Commands State ==========
var commandsData = {
  groups: {}, // Organized by group name: { cli: [...], workflow: [...], memory: [...], task: [...], issue: [...] }
  allCommands: [],
  projectGroupsConfig: { groups: {}, assignments: {} },
  userGroupsConfig: { groups: {}, assignments: {} }
};
var expandedGroups = {
  cli: true,
  workflow: true,
  memory: true,
  task: true,
  issue: true
};
var showDisabledCommands = false;
var commandsLoading = false;
var currentLocation = 'project'; // 'project' or 'user'

// ========== Main Render Function ==========
async function renderCommandsManager() {
  const container = document.getElementById('mainContent');
  if (!container) return;

  // Hide stats grid and search
  const statsGrid = document.getElementById('statsGrid');
  const searchInput = document.getElementById('searchInput');
  if (statsGrid) statsGrid.style.display = 'none';
  if (searchInput) searchInput.parentElement.style.display = 'none';

  // Show loading state
  container.innerHTML = '<div class="commands-manager loading">' +
    '<div class="loading-spinner"><i data-lucide="loader-2" class="w-8 h-8 animate-spin"></i></div>' +
    '<p>' + t('common.loading') + '</p>' +
    '</div>';

  // Load commands data
  await loadCommandsData();

  // Render the main view
  renderCommandsView();
}

async function loadCommandsData() {
  commandsLoading = true;
  try {
    const response = await fetch('/api/commands?path=' + encodeURIComponent(projectPath));
    if (!response.ok) throw new Error('Failed to load commands');
    const data = await response.json();

    // Store groups config
    commandsData.projectGroupsConfig = data.projectGroupsConfig || { groups: {}, assignments: {} };
    commandsData.userGroupsConfig = data.userGroupsConfig || { groups: {}, assignments: {} };

    // Filter commands based on currentLocation
    const allCommands = currentLocation === 'project'
      ? (data.projectCommands || [])
      : (data.userCommands || []);

    // Organize commands by group
    commandsData.groups = {};
    commandsData.allCommands = allCommands;

    allCommands.forEach(cmd => {
      const group = cmd.group || 'other';
      if (!commandsData.groups[group]) {
        commandsData.groups[group] = [];
      }
      commandsData.groups[group].push(cmd);
    });

    // Update badge
    updateCommandsBadge();
  } catch (err) {
    console.error('Failed to load commands:', err);
    commandsData = {
      groups: {},
      allCommands: [],
      projectGroupsConfig: { groups: {}, assignments: {} },
      userGroupsConfig: { groups: {}, assignments: {} }
    };
  } finally {
    commandsLoading = false;
  }
}

function updateCommandsBadge() {
  const badge = document.getElementById('badgeCommands');
  if (badge) {
    const enabledCount = commandsData.allCommands.filter(cmd => cmd.enabled).length;
    badge.textContent = enabledCount;
  }
}

async function switchLocation(location) {
  if (location === currentLocation) return;
  currentLocation = location;
  await loadCommandsData();
  renderCommandsView();
}

function renderCommandsView() {
  const container = document.getElementById('mainContent');
  if (!container) return;

  const groups = commandsData.groups || {};

  // Dynamic groups: known groups first, then custom groups hierarchically sorted, 'other' last
  const knownOrder = ['cli', 'workflow', 'memory', 'task', 'issue'];
  const allGroupNames = Object.keys(groups);

  // Separate top-level known groups and nested groups
  const topLevelKnown = allGroupNames.filter(g => knownOrder.includes(g));
  const nestedAndCustom = allGroupNames.filter(g => g !== 'other' && !knownOrder.includes(g));

  // Sort nested/custom groups hierarchically
  nestedAndCustom.sort((a, b) => {
    // Split by path separator
    const aParts = a.split('/');
    const bParts = b.split('/');

    // Compare level by level
    for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
      if (aParts[i] !== bParts[i]) {
        return aParts[i].localeCompare(bParts[i]);
      }
    }

    // If all parts are equal, shorter path comes first
    return aParts.length - bParts.length;
  });

  const groupNames = [...topLevelKnown.filter(g => groups[g] && groups[g].length > 0),
                      ...nestedAndCustom.filter(g => groups[g] && groups[g].length > 0),
                      'other'].filter(g => groups[g] && groups[g].length > 0);
  const totalEnabled = commandsData.allCommands.filter(cmd => cmd.enabled).length;
  const totalDisabled = commandsData.allCommands.filter(cmd => !cmd.enabled).length;

  container.innerHTML = `
    <div class="commands-manager">
      <!-- Header -->
      <div class="commands-header mb-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <i data-lucide="terminal" class="w-5 h-5 text-primary"></i>
            </div>
            <div>
              <h2 class="text-lg font-semibold text-foreground">${t('commands.title') || 'Commands Manager'}</h2>
              <p class="text-sm text-muted-foreground">${t('commands.description') || 'Enable/disable CCW commands'}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <!-- Location Switcher -->
            <div class="inline-flex bg-muted rounded-lg p-1">
              <button class="px-3 py-1.5 text-sm rounded-md transition-all ${currentLocation === 'project' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
                      onclick="switchLocation('project')">
                <i data-lucide="folder" class="w-3.5 h-3.5 inline mr-1"></i>
                ${t('commands.locationProject') || 'Project'}
              </button>
              <button class="px-3 py-1.5 text-sm rounded-md transition-all ${currentLocation === 'user' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
                      onclick="switchLocation('user')">
                <i data-lucide="user" class="w-3.5 h-3.5 inline mr-1"></i>
                ${t('commands.locationUser') || 'Global'}
              </button>
            </div>
            <!-- Show Disabled Toggle -->
            <button class="px-4 py-2 text-sm ${showDisabledCommands ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'} rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
                    onclick="toggleShowDisabledCommands()">
              <i data-lucide="${showDisabledCommands ? 'eye' : 'eye-off'}" class="w-4 h-4"></i>
              ${showDisabledCommands ? (t('commands.hideDisabled') || 'Hide Disabled') : (t('commands.showDisabled') || 'Show Disabled')} (${totalDisabled})
            </button>
          </div>
        </div>
      </div>

      <!-- Summary Stats -->
      <div class="commands-stats mb-6">
        <div class="grid grid-cols-3 gap-4">
          <div class="bg-card border border-border rounded-lg p-4">
            <div class="text-2xl font-bold text-foreground">${commandsData.allCommands.length}</div>
            <div class="text-sm text-muted-foreground">${t('commands.totalCommands') || 'Total Commands'}</div>
          </div>
          <div class="bg-card border border-border rounded-lg p-4">
            <div class="text-2xl font-bold text-success">${totalEnabled}</div>
            <div class="text-sm text-muted-foreground">${t('commands.enabledCommands') || 'Enabled'}</div>
          </div>
          <div class="bg-card border border-border rounded-lg p-4">
            <div class="text-2xl font-bold text-muted-foreground">${totalDisabled}</div>
            <div class="text-sm text-muted-foreground">${t('commands.disabledCommands') || 'Disabled'}</div>
          </div>
        </div>
      </div>

      <!-- Accordion Groups -->
      <div class="commands-accordion">
        ${groupNames.map(groupName => renderAccordionGroup(groupName, groups[groupName])).join('')}
      </div>
    </div>
  `;

  // Initialize Lucide icons
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderAccordionGroup(groupName, commands) {
  // Default to expanded for new/custom groups
  if (expandedGroups[groupName] === undefined) expandedGroups[groupName] = true;
  const isExpanded = expandedGroups[groupName];
  const enabledCommands = commands.filter(cmd => cmd.enabled);
  const disabledCommands = commands.filter(cmd => !cmd.enabled);

  // Filter commands based on showDisabledCommands
  const visibleCommands = showDisabledCommands
    ? commands
    : enabledCommands;

  // Group icons
  const groupIcons = {
    cli: 'terminal',
    workflow: 'workflow',
    memory: 'brain',
    task: 'clipboard-list',
    issue: 'alert-circle',
    other: 'folder'
  };

  // Group colors
  const groupColors = {
    cli: 'text-primary bg-primary/10',
    workflow: 'text-success bg-success/10',
    memory: 'text-indigo bg-indigo/10',
    task: 'text-warning bg-warning/10',
    issue: 'text-destructive bg-destructive/10',
    other: 'text-muted-foreground bg-muted'
  };

  const icon = groupIcons[groupName] || 'folder';
  const colorClass = groupColors[groupName] || 'text-muted-foreground bg-muted';

  return `
    <div class="accordion-group mb-4">
      <!-- Group Header -->
      <div class="accordion-header flex items-center justify-between px-4 py-3 bg-card border border-border rounded-lg hover:bg-hover transition-colors">
        <div class="flex items-center gap-3 flex-1 cursor-pointer" onclick="toggleAccordionGroup('${groupName}')">
          <i data-lucide="${isExpanded ? 'chevron-down' : 'chevron-right'}" class="w-5 h-5 text-muted-foreground transition-transform"></i>
          <div class="w-8 h-8 ${colorClass} rounded-lg flex items-center justify-center">
            <i data-lucide="${icon}" class="w-4 h-4"></i>
          </div>
          <div>
            <h3 class="text-base font-semibold text-foreground capitalize">${t('commands.group.' + groupName) || groupName}</h3>
            <p class="text-xs text-muted-foreground">${enabledCommands.length}/${commands.length} ${t('commands.enabled') || 'enabled'}</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <!-- Group Toggle Switch -->
          <label class="group-toggle-switch relative inline-flex items-center cursor-pointer" title="${enabledCommands.length === commands.length ? (t('commands.clickToDisableAll') || 'Click to disable all') : (t('commands.clickToEnableAll') || 'Click to enable all')}">
            <input type="checkbox"
                   class="sr-only peer"
                   ${enabledCommands.length === commands.length ? 'checked' : ''}
                   onchange="toggleGroupEnabled('${groupName}', ${enabledCommands.length === commands.length})">
            <div class="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-success"></div>
          </label>
          <span class="text-xs px-2 py-1 bg-muted rounded-full text-muted-foreground">${commands.length}</span>
        </div>
      </div>

      <!-- Group Content (Compact Table) -->
      ${isExpanded ? `
        <div class="accordion-content mt-3">
          <div class="bg-card border border-border rounded-lg overflow-hidden">
            <table class="w-full commands-table" style="table-layout: fixed;">
              <colgroup>
                <col style="width: 200px;">
                <col style="width: auto;">
                <col style="width: 100px;">
                <col style="width: 80px;">
              </colgroup>
              <thead class="bg-muted/30 border-b border-border">
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">${t('commands.name') || 'Name'}</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">${t('commands.description') || 'Description'}</th>
                  <th class="px-4 py-2 text-center text-xs font-medium text-muted-foreground uppercase">${t('commands.scope') || 'Scope'}</th>
                  <th class="px-4 py-2 text-center text-xs font-medium text-muted-foreground uppercase">${t('commands.status') || 'Status'}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                ${visibleCommands.map(cmd => renderCommandRow(cmd)).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderCommandRow(command) {
  const isDisabled = !command.enabled;

  return `
    <tr class="hover:bg-muted/20 transition-colors ${isDisabled ? 'opacity-60' : ''}">
      <td class="px-4 py-3 text-sm font-medium text-foreground">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="break-words">${escapeHtml(command.name)}</span>
          ${command.triggers && command.triggers.length > 0 ? `
            <span class="text-xs px-1.5 py-0.5 bg-warning/10 text-warning rounded flex-shrink-0" title="${command.triggers.length} trigger(s)">
              <i data-lucide="zap" class="w-3 h-3 inline mr-0.5"></i>${command.triggers.length}
            </span>
          ` : ''}
        </div>
      </td>
      <td class="px-4 py-3 text-sm text-muted-foreground">
        <div class="line-clamp-3 break-words">${escapeHtml(command.description || t('commands.noDescription') || '-')}</div>
      </td>
      <td class="px-4 py-3 text-center text-xs text-muted-foreground">
        <span class="whitespace-nowrap">${command.scope || 'project'}</span>
      </td>
      <td class="px-4 py-3">
        <div class="flex justify-center">
          <label class="command-toggle-switch relative inline-flex items-center cursor-pointer">
            <input type="checkbox"
                   class="sr-only peer"
                   ${command.enabled ? 'checked' : ''}
                   onchange="toggleCommandEnabled('${escapeHtml(command.name)}', ${command.enabled})"
                   data-command-toggle="${escapeHtml(command.name)}">
            <div class="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
      </td>
    </tr>
  `;
}

function getGroupBadgeClass(group) {
  const classes = {
    cli: 'bg-primary/10 text-primary',
    workflow: 'bg-success/10 text-success',
    memory: 'bg-indigo/10 text-indigo',
    task: 'bg-warning/10 text-warning',
    issue: 'bg-destructive/10 text-destructive',
    other: 'bg-muted text-muted-foreground'
  };
  return classes[group] || classes.other;
}

function toggleAccordionGroup(groupName) {
  expandedGroups[groupName] = !expandedGroups[groupName];
  renderCommandsView();
}

function toggleShowDisabledCommands() {
  showDisabledCommands = !showDisabledCommands;
  renderCommandsView();
}

// Track loading state for command toggle operations
var toggleLoadingCommands = {};

async function toggleCommandEnabled(commandName, currentlyEnabled) {
  // Prevent double-click
  var loadingKey = commandName;
  if (toggleLoadingCommands[loadingKey]) return;

  // Set loading state
  toggleLoadingCommands[loadingKey] = true;
  var toggleInput = document.querySelector('[data-command-toggle="' + commandName + '"]');
  if (toggleInput) {
    toggleInput.disabled = true;
  }

  try {
    var response = await fetch('/api/commands/' + encodeURIComponent(commandName) + '/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectPath: projectPath,
        location: currentLocation,
        enable: !currentlyEnabled
      })
    });

    if (!response.ok) {
      // Robust JSON parsing with fallback
      var errorMessage = 'Operation failed';
      try {
        var error = await response.json();
        errorMessage = error.message || errorMessage;
      } catch (jsonErr) {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    // Reload commands data
    await loadCommandsData();
    renderCommandsView();

    if (window.showToast) {
      var message = currentlyEnabled
        ? t('commands.disableSuccess', { name: commandName }) || `Command "${commandName}" disabled`
        : t('commands.enableSuccess', { name: commandName }) || `Command "${commandName}" enabled`;
      showToast(message, 'success');
    }
  } catch (err) {
    console.error('Failed to toggle command:', err);
    if (window.showToast) {
      showToast(err.message || t('commands.toggleError') || 'Failed to toggle command', 'error');
    }
    // Reset toggle state on error
    if (toggleInput) {
      toggleInput.checked = currentlyEnabled;
    }
  } finally {
    // Clear loading state
    delete toggleLoadingCommands[loadingKey];
    if (toggleInput) {
      toggleInput.disabled = false;
    }
  }
}

async function toggleGroupEnabled(groupName, currentlyAllEnabled) {
  const enable = !currentlyAllEnabled;

  try {
    const response = await fetch('/api/commands/group/' + encodeURIComponent(groupName) + '/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectPath: projectPath,
        location: currentLocation,
        enable: enable
      })
    });

    if (!response.ok) {
      var errorMessage = 'Operation failed';
      try {
        var error = await response.json();
        errorMessage = error.message || errorMessage;
      } catch (jsonErr) {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    // Reload commands data
    await loadCommandsData();
    renderCommandsView();

    if (window.showToast) {
      const groupLabel = t('commands.group.' + groupName) || groupName;
      const message = enable
        ? (t('commands.enableGroupSuccess', { group: groupLabel }) || `Group "${groupLabel}" enabled`)
        : (t('commands.disableGroupSuccess', { group: groupLabel }) || `Group "${groupLabel}" disabled`);
      showToast(message, 'success');
    }
  } catch (err) {
    console.error('Failed to toggle group:', err);
    if (window.showToast) {
      showToast(err.message || t('commands.toggleError') || 'Failed to toggle group', 'error');
    }
  }
}

function formatDisabledDate(isoString) {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoString;
  }
}
