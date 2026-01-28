// Commands Manager View
// Manages Claude Code commands (.claude/commands/)

// ========== Commands State ==========
var commandsData = {
  groups: {}, // Organized by group name: { cli: [...], workflow: [...], memory: [...], task: [...], issue: [...] }
  allCommands: []
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

    // Organize commands by group
    commandsData.groups = {};
    commandsData.allCommands = data.commands || [];

    data.commands.forEach(cmd => {
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
    commandsData = { groups: {}, allCommands: [] };
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

function renderCommandsView() {
  const container = document.getElementById('mainContent');
  if (!container) return;

  const groups = commandsData.groups || {};
  const groupNames = ['cli', 'workflow', 'memory', 'task', 'issue', 'other'];
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
          <button class="px-4 py-2 text-sm ${showDisabledCommands ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'} rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
                  onclick="toggleShowDisabledCommands()">
            <i data-lucide="${showDisabledCommands ? 'eye' : 'eye-off'}" class="w-4 h-4"></i>
            ${showDisabledCommands ? (t('commands.hideDisabled') || 'Hide Disabled') : (t('commands.showDisabled') || 'Show Disabled')} (${totalDisabled})
          </button>
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
        ${groupNames.map(groupName => {
          const commands = groups[groupName] || [];
          if (commands.length === 0) return '';
          return renderAccordionGroup(groupName, commands);
        }).join('')}
      </div>
    </div>
  `;

  // Initialize Lucide icons
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderAccordionGroup(groupName, commands) {
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
      <div class="accordion-header flex items-center justify-between px-4 py-3 bg-card border border-border rounded-lg cursor-pointer hover:bg-hover transition-colors"
           onclick="toggleAccordionGroup('${groupName}')">
        <div class="flex items-center gap-3">
          <i data-lucide="${isExpanded ? 'chevron-down' : 'chevron-right'}" class="w-5 h-5 text-muted-foreground transition-transform"></i>
          <div class="w-8 h-8 ${colorClass} rounded-lg flex items-center justify-center">
            <i data-lucide="${icon}" class="w-4 h-4"></i>
          </div>
          <div>
            <h3 class="text-base font-semibold text-foreground capitalize">${groupName}</h3>
            <p class="text-xs text-muted-foreground">${enabledCommands.length}/${commands.length} enabled</p>
          </div>
        </div>
        <span class="text-xs px-2 py-1 bg-muted rounded-full text-muted-foreground">${commands.length}</span>
      </div>

      <!-- Group Content (Cards Grid) -->
      ${isExpanded ? `
        <div class="accordion-content mt-3">
          <div class="commands-grid grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));">
            ${visibleCommands.map(cmd => renderCommandCard(cmd)).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderCommandCard(command) {
  const isDisabled = !command.enabled;
  const cardOpacity = isDisabled ? 'opacity-60' : '';

  return `
    <div class="command-card bg-card border border-border rounded-lg p-4 hover:shadow-md transition-all ${cardOpacity}">
      <div class="flex items-start justify-between mb-3">
        <div class="flex-1 min-w-0">
          <h4 class="font-semibold text-foreground truncate">${escapeHtml(command.name)}</h4>
          <span class="text-xs px-2 py-0.5 rounded-full ${getGroupBadgeClass(command.group)} inline-block mt-1">
            ${command.group || 'other'}
          </span>
        </div>
        <div class="ml-2 flex-shrink-0">
          <label class="command-toggle-switch relative inline-block w-11 h-6 cursor-pointer">
            <input type="checkbox"
                   class="sr-only"
                   ${command.enabled ? 'checked' : ''}
                   onchange="toggleCommandEnabled('${escapeHtml(command.name)}', ${command.enabled})"
                   data-command-toggle="${escapeHtml(command.name)}">
            <span class="command-toggle-slider absolute inset-0 rounded-full transition-all duration-200 ${command.enabled ? 'bg-success' : 'bg-muted'}"></span>
          </label>
        </div>
      </div>

      <p class="text-sm text-muted-foreground mb-3 line-clamp-2">${escapeHtml(command.description || t('commands.noDescription') || 'No description available')}</p>

      <div class="flex items-center justify-between text-xs text-muted-foreground">
        <div class="flex items-center gap-2">
          <span class="flex items-center gap-1">
            <i data-lucide="folder" class="w-3 h-3"></i>
            ${command.scope || 'project'}
          </span>
          ${command.triggers && command.triggers.length > 0 ? `
            <span class="flex items-center gap-1">
              <i data-lucide="zap" class="w-3 h-3"></i>
              ${command.triggers.length} trigger${command.triggers.length > 1 ? 's' : ''}
            </span>
          ` : ''}
        </div>
        ${isDisabled && command.disabledAt ? `
          <span class="text-xs text-muted-foreground/70">
            ${t('commands.disabledAt') || 'Disabled'}: ${formatDisabledDate(command.disabledAt)}
          </span>
        ` : ''}
      </div>
    </div>
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

  var action = currentlyEnabled ? 'disable' : 'enable';
  var confirmMessage = currentlyEnabled
    ? t('commands.disableConfirm', { name: commandName }) || `Disable command "${commandName}"?`
    : t('commands.enableConfirm', { name: commandName }) || `Enable command "${commandName}"?`;

  if (!confirm(confirmMessage)) {
    // Reset toggle state if user cancels
    const toggleInput = document.querySelector(`[data-command-toggle="${commandName}"]`);
    if (toggleInput) {
      toggleInput.checked = currentlyEnabled;
    }
    return;
  }

  // Set loading state
  toggleLoadingCommands[loadingKey] = true;
  var toggleInput = document.querySelector('[data-command-toggle="' + commandName + '"]');
  if (toggleInput) {
    toggleInput.disabled = true;
  }

  try {
    var response = await fetch('/api/commands/' + encodeURIComponent(commandName) + '/' + action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: projectPath })
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

function formatDisabledDate(isoString) {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoString;
  }
}
