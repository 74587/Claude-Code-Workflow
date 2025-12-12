// Hook Manager Component
// Manages Claude Code hooks configuration from settings.json

// ========== Hook State ==========
let hookConfig = {
  global: { hooks: {} },
  project: { hooks: {} }
};

// ========== Hook Templates ==========
const HOOK_TEMPLATES = {
  'ccw-notify': {
    event: 'PostToolUse',
    matcher: 'Write',
    command: 'curl',
    args: ['-s', '-X', 'POST', '-H', 'Content-Type: application/json', '-d', '{"type":"summary_written","filePath":"$CLAUDE_FILE_PATHS"}', 'http://localhost:3456/api/hook'],
    description: 'Notify CCW dashboard when files are written',
    category: 'notification'
  },
  'log-tool': {
    event: 'PostToolUse',
    matcher: '',
    command: 'bash',
    args: ['-c', 'echo "[$(date)] Tool: $CLAUDE_TOOL_NAME, Files: $CLAUDE_FILE_PATHS" >> ~/.claude/tool-usage.log'],
    description: 'Log all tool executions to a file',
    category: 'logging'
  },
  'lint-check': {
    event: 'PostToolUse',
    matcher: 'Write',
    command: 'bash',
    args: ['-c', 'for f in $CLAUDE_FILE_PATHS; do if [[ "$f" =~ \\.(js|ts|jsx|tsx)$ ]]; then npx eslint "$f" --fix 2>/dev/null || true; fi; done'],
    description: 'Run ESLint on JavaScript/TypeScript files after write',
    category: 'quality'
  },
  'git-add': {
    event: 'PostToolUse',
    matcher: 'Write',
    command: 'bash',
    args: ['-c', 'for f in $CLAUDE_FILE_PATHS; do git add "$f" 2>/dev/null || true; done'],
    description: 'Automatically stage written files to git',
    category: 'git'
  },
  'codexlens-update': {
    event: 'PostToolUse',
    matcher: 'Write|Edit',
    command: 'bash',
    args: ['-c', 'if [ -d ".codexlens" ] && [ -n "$CLAUDE_FILE_PATHS" ]; then python -m codexlens update $CLAUDE_FILE_PATHS --json 2>/dev/null || ~/.codexlens/venv/bin/python -m codexlens update $CLAUDE_FILE_PATHS --json 2>/dev/null || true; fi'],
    description: 'Auto-update code index when files are written or edited',
    category: 'indexing'
  },
  'memory-update-related': {
    event: 'Stop',
    matcher: '',
    command: 'bash',
    args: ['-c', 'ccw tool exec update_module_claude \'{"strategy":"related","tool":"gemini"}\''],
    description: 'Update CLAUDE.md for changed modules when session ends',
    category: 'memory',
    configurable: true,
    config: {
      tool: { type: 'select', options: ['gemini', 'qwen', 'codex'], default: 'gemini', label: 'CLI Tool' },
      strategy: { type: 'select', options: ['related', 'single-layer'], default: 'related', label: 'Strategy' }
    }
  },
  'memory-update-periodic': {
    event: 'PostToolUse',
    matcher: 'Write|Edit',
    command: 'bash',
    args: ['-c', 'INTERVAL=300; LAST_FILE=~/.claude/.last_memory_update; NOW=$(date +%s); LAST=0; [ -f "$LAST_FILE" ] && LAST=$(cat "$LAST_FILE"); if [ $((NOW - LAST)) -ge $INTERVAL ]; then echo $NOW > "$LAST_FILE"; ccw tool exec update_module_claude \'{"strategy":"related","tool":"gemini"}\' & fi'],
    description: 'Periodically update CLAUDE.md (default: 5 min interval)',
    category: 'memory',
    configurable: true,
    config: {
      tool: { type: 'select', options: ['gemini', 'qwen', 'codex'], default: 'gemini', label: 'CLI Tool' },
      interval: { type: 'number', default: 300, min: 60, max: 3600, label: 'Interval (seconds)', step: 60 }
    }
  },
  // SKILL Context Loader templates
  'skill-context-keyword': {
    event: 'UserPromptSubmit',
    matcher: '',
    command: 'bash',
    args: ['-c', 'ccw tool exec skill_context_loader \'{"keywords":"$SKILL_KEYWORDS","skills":"$SKILL_NAMES","prompt":"$CLAUDE_PROMPT"}\''],
    description: 'Load SKILL context based on keyword matching in user prompt',
    category: 'skill',
    configurable: true,
    config: {
      keywords: { type: 'text', default: '', label: 'Keywords (comma-separated)', placeholder: 'react,workflow,api' },
      skills: { type: 'text', default: '', label: 'SKILL Names (comma-separated)', placeholder: 'prompt-enhancer,command-guide' }
    }
  },
  'skill-context-auto': {
    event: 'UserPromptSubmit',
    matcher: '',
    command: 'bash',
    args: ['-c', 'ccw tool exec skill_context_loader \'{"mode":"auto","prompt":"$CLAUDE_PROMPT"}\''],
    description: 'Auto-detect and load SKILL based on skill name in prompt',
    category: 'skill',
    configurable: false
  }
};

// ========== Wizard Templates (Special Category) ==========
const WIZARD_TEMPLATES = {
  'memory-update': {
    name: 'Memory Update Hook',
    description: 'Automatically update CLAUDE.md documentation based on code changes',
    icon: 'brain',
    options: [
      {
        id: 'on-stop',
        name: 'On Session End',
        description: 'Update documentation when Claude session ends',
        templateId: 'memory-update-related'
      },
      {
        id: 'periodic',
        name: 'Periodic Update',
        description: 'Update documentation at regular intervals during session',
        templateId: 'memory-update-periodic'
      }
    ],
    configFields: [
      { key: 'tool', type: 'select', label: 'CLI Tool', options: ['gemini', 'qwen', 'codex'], default: 'gemini', description: 'Tool for documentation generation' },
      { key: 'interval', type: 'number', label: 'Interval (seconds)', default: 300, min: 60, max: 3600, step: 60, showFor: ['periodic'], description: 'Time between updates' },
      { key: 'strategy', type: 'select', label: 'Update Strategy', options: ['related', 'single-layer'], default: 'related', description: 'Related: changed modules, Single-layer: current directory' }
    ]
  },
  'skill-context': {
    name: 'SKILL Context Loader',
    description: 'Automatically load SKILL packages based on keywords in user prompts',
    icon: 'sparkles',
    options: [
      {
        id: 'keyword',
        name: 'Keyword Matching',
        description: 'Load specific SKILLs when keywords are detected in prompt',
        templateId: 'skill-context-keyword'
      },
      {
        id: 'auto',
        name: 'Auto Detection',
        description: 'Automatically detect and load SKILLs by name in prompt',
        templateId: 'skill-context-auto'
      }
    ],
    configFields: [],
    requiresSkillDiscovery: true,
    customRenderer: 'renderSkillContextConfig'
  }
};

// ========== Initialization ==========
function initHookManager() {
  // Initialize Hook navigation
  document.querySelectorAll('.nav-item[data-view="hook-manager"]').forEach(item => {
    item.addEventListener('click', () => {
      setActiveNavItem(item);
      currentView = 'hook-manager';
      currentFilter = null;
      currentLiteType = null;
      currentSessionDetailKey = null;
      updateContentTitle();
      renderHookManager();
    });
  });
}

// ========== Data Loading ==========
async function loadHookConfig() {
  try {
    const response = await fetch(`/api/hooks?path=${encodeURIComponent(projectPath)}`);
    if (!response.ok) throw new Error('Failed to load hook config');
    const data = await response.json();
    hookConfig = data;
    updateHookBadge();
    return data;
  } catch (err) {
    console.error('Failed to load hook config:', err);
    return null;
  }
}

async function saveHook(scope, event, hookData) {
  try {
    const response = await fetch('/api/hooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectPath: projectPath,
        scope: scope,
        event: event,
        hookData: hookData
      })
    });

    if (!response.ok) throw new Error('Failed to save hook');

    const result = await response.json();
    if (result.success) {
      await loadHookConfig();
      renderHookManager();
      showRefreshToast(`Hook saved successfully`, 'success');
    }
    return result;
  } catch (err) {
    console.error('Failed to save hook:', err);
    showRefreshToast(`Failed to save hook: ${err.message}`, 'error');
    return null;
  }
}

async function removeHook(scope, event, hookIndex) {
  try {
    const response = await fetch('/api/hooks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectPath: projectPath,
        scope: scope,
        event: event,
        hookIndex: hookIndex
      })
    });

    if (!response.ok) throw new Error('Failed to remove hook');

    const result = await response.json();
    if (result.success) {
      await loadHookConfig();
      renderHookManager();
      showRefreshToast(`Hook removed successfully`, 'success');
    }
    return result;
  } catch (err) {
    console.error('Failed to remove hook:', err);
    showRefreshToast(`Failed to remove hook: ${err.message}`, 'error');
    return null;
  }
}

// ========== Badge Update ==========
function updateHookBadge() {
  const badge = document.getElementById('badgeHooks');
  if (badge) {
    let totalHooks = 0;

    // Count global hooks
    if (hookConfig.global?.hooks) {
      for (const event of Object.keys(hookConfig.global.hooks)) {
        const hooks = hookConfig.global.hooks[event];
        totalHooks += Array.isArray(hooks) ? hooks.length : 1;
      }
    }

    // Count project hooks
    if (hookConfig.project?.hooks) {
      for (const event of Object.keys(hookConfig.project.hooks)) {
        const hooks = hookConfig.project.hooks[event];
        totalHooks += Array.isArray(hooks) ? hooks.length : 1;
      }
    }

    badge.textContent = totalHooks;
  }
}

// ========== Hook Modal Functions ==========
let editingHookData = null;

function openHookCreateModal(editData = null) {
  const modal = document.getElementById('hookCreateModal');
  const title = document.getElementById('hookModalTitle');

  if (modal) {
    modal.classList.remove('hidden');
    editingHookData = editData;

    // Set title based on mode
    title.textContent = editData ? 'Edit Hook' : 'Create Hook';

    // Clear or populate form
    if (editData) {
      document.getElementById('hookEvent').value = editData.event || '';
      document.getElementById('hookMatcher').value = editData.matcher || '';
      document.getElementById('hookCommand').value = editData.command || '';
      document.getElementById('hookArgs').value = (editData.args || []).join('\n');

      // Set scope radio
      const scopeRadio = document.querySelector(`input[name="hookScope"][value="${editData.scope || 'project'}"]`);
      if (scopeRadio) scopeRadio.checked = true;
    } else {
      document.getElementById('hookEvent').value = '';
      document.getElementById('hookMatcher').value = '';
      document.getElementById('hookCommand').value = '';
      document.getElementById('hookArgs').value = '';
      document.querySelector('input[name="hookScope"][value="project"]').checked = true;
    }

    // Focus on event select
    document.getElementById('hookEvent').focus();
  }
}

function closeHookCreateModal() {
  const modal = document.getElementById('hookCreateModal');
  if (modal) {
    modal.classList.add('hidden');
    editingHookData = null;
  }
}

function applyHookTemplate(templateName) {
  const template = HOOK_TEMPLATES[templateName];
  if (!template) return;

  document.getElementById('hookEvent').value = template.event;
  document.getElementById('hookMatcher').value = template.matcher;
  document.getElementById('hookCommand').value = template.command;
  document.getElementById('hookArgs').value = template.args.join('\n');
}

async function submitHookCreate() {
  const event = document.getElementById('hookEvent').value;
  const matcher = document.getElementById('hookMatcher').value.trim();
  const command = document.getElementById('hookCommand').value.trim();
  const argsText = document.getElementById('hookArgs').value.trim();
  const scope = document.querySelector('input[name="hookScope"]:checked').value;

  // Validate required fields
  if (!event) {
    showRefreshToast('Hook event is required', 'error');
    document.getElementById('hookEvent').focus();
    return;
  }

  if (!command) {
    showRefreshToast('Command is required', 'error');
    document.getElementById('hookCommand').focus();
    return;
  }

  // Parse args (one per line)
  const args = argsText ? argsText.split('\n').map(a => a.trim()).filter(a => a) : [];

  // Build hook data
  const hookData = {
    command: command
  };

  if (args.length > 0) {
    hookData.args = args;
  }

  if (matcher) {
    hookData.matcher = matcher;
  }

  // If editing, include original index for replacement
  if (editingHookData && editingHookData.index !== undefined) {
    hookData.replaceIndex = editingHookData.index;
  }

  // Submit to API
  await saveHook(scope, event, hookData);
  closeHookCreateModal();
}

// ========== Helpers ==========
function getHookEventDescription(event) {
  const descriptions = {
    'PreToolUse': 'Runs before a tool is executed',
    'PostToolUse': 'Runs after a tool completes',
    'Notification': 'Runs when a notification is triggered',
    'Stop': 'Runs when the agent stops',
    'UserPromptSubmit': 'Runs when user submits a prompt'
  };
  return descriptions[event] || event;
}

function getHookEventIcon(event) {
  const icons = {
    'PreToolUse': '⏳',
    'PostToolUse': '✅',
    'Notification': '🔔',
    'Stop': '🛑',
    'UserPromptSubmit': '💬'
  };
  return icons[event] || '🪝';
}

function getHookEventIconLucide(event) {
  const icons = {
    'PreToolUse': '<i data-lucide="clock" class="w-5 h-5"></i>',
    'PostToolUse': '<i data-lucide="check-circle" class="w-5 h-5"></i>',
    'Notification': '<i data-lucide="bell" class="w-5 h-5"></i>',
    'Stop': '<i data-lucide="octagon-x" class="w-5 h-5"></i>',
    'UserPromptSubmit': '<i data-lucide="message-square" class="w-5 h-5"></i>'
  };
  return icons[event] || '<i data-lucide="webhook" class="w-5 h-5"></i>';
}

// ========== Wizard Modal Functions ==========
let currentWizardTemplate = null;
let wizardConfig = {};

function openHookWizardModal(wizardId) {
  const wizard = WIZARD_TEMPLATES[wizardId];
  if (!wizard) {
    showRefreshToast('Wizard template not found', 'error');
    return;
  }

  currentWizardTemplate = { id: wizardId, ...wizard };
  wizardConfig = {};

  // Set defaults
  wizard.configFields.forEach(field => {
    wizardConfig[field.key] = field.default;
  });

  const modal = document.getElementById('hookWizardModal');
  if (modal) {
    renderWizardModalContent();
    modal.classList.remove('hidden');
  }
}

function closeHookWizardModal() {
  const modal = document.getElementById('hookWizardModal');
  if (modal) {
    modal.classList.add('hidden');
    currentWizardTemplate = null;
    wizardConfig = {};
  }
}

function renderWizardModalContent() {
  const container = document.getElementById('wizardModalContent');
  if (!container || !currentWizardTemplate) return;

  const wizard = currentWizardTemplate;
  const selectedOption = wizardConfig.triggerType || wizard.options[0].id;

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Wizard Header -->
      <div class="flex items-center gap-3 pb-4 border-b border-border">
        <div class="p-2 bg-primary/10 rounded-lg">
          <i data-lucide="${wizard.icon}" class="w-6 h-6 text-primary"></i>
        </div>
        <div>
          <h3 class="text-lg font-semibold text-foreground">${escapeHtml(wizard.name)}</h3>
          <p class="text-sm text-muted-foreground">${escapeHtml(wizard.description)}</p>
        </div>
      </div>

      <!-- Trigger Type Selection -->
      <div class="space-y-3">
        <label class="block text-sm font-medium text-foreground">When to Trigger</label>
        <div class="grid grid-cols-1 gap-3">
          ${wizard.options.map(opt => `
            <label class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all ${selectedOption === opt.id ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'}">
              <input type="radio" name="wizardTrigger" value="${opt.id}"
                     ${selectedOption === opt.id ? 'checked' : ''}
                     onchange="updateWizardTrigger('${opt.id}')"
                     class="mt-1">
              <div class="flex-1">
                <span class="font-medium text-foreground">${escapeHtml(opt.name)}</span>
                <p class="text-sm text-muted-foreground">${escapeHtml(opt.description)}</p>
              </div>
            </label>
          `).join('')}
        </div>
      </div>

      <!-- Configuration Fields -->
      <div class="space-y-4">
        <label class="block text-sm font-medium text-foreground">Configuration</label>
        ${wizard.customRenderer ? window[wizard.customRenderer]() : wizard.configFields.map(field => {
          // Check if field should be shown for current trigger type
          const shouldShow = !field.showFor || field.showFor.includes(selectedOption);
          if (!shouldShow) return '';

          const value = wizardConfig[field.key] ?? field.default;

          if (field.type === 'select') {
            return `
              <div class="space-y-1">
                <label class="block text-sm text-muted-foreground">${escapeHtml(field.label)}</label>
                <select id="wizard_${field.key}"
                        onchange="updateWizardConfig('${field.key}', this.value)"
                        class="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                  ${field.options.map(opt => `
                    <option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>
                  `).join('')}
                </select>
                ${field.description ? `<p class="text-xs text-muted-foreground">${escapeHtml(field.description)}</p>` : ''}
              </div>
            `;
          } else if (field.type === 'number') {
            return `
              <div class="space-y-1">
                <label class="block text-sm text-muted-foreground">${escapeHtml(field.label)}</label>
                <div class="flex items-center gap-2">
                  <input type="number" id="wizard_${field.key}"
                         value="${value}"
                         min="${field.min || 0}"
                         max="${field.max || 9999}"
                         step="${field.step || 1}"
                         onchange="updateWizardConfig('${field.key}', parseInt(this.value))"
                         class="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                  <span class="text-sm text-muted-foreground">${formatIntervalDisplay(value)}</span>
                </div>
                ${field.description ? `<p class="text-xs text-muted-foreground">${escapeHtml(field.description)}</p>` : ''}
              </div>
            `;
          }
          return '';
        }).join('')}
      </div>

      <!-- Preview -->
      <div class="space-y-2">
        <label class="block text-sm font-medium text-foreground">Generated Command Preview</label>
        <div class="bg-muted/50 rounded-lg p-3 font-mono text-xs overflow-x-auto">
          <pre id="wizardCommandPreview" class="whitespace-pre-wrap text-muted-foreground">${escapeHtml(generateWizardCommand())}</pre>
        </div>
      </div>

      <!-- Scope Selection -->
      <div class="space-y-3">
        <label class="block text-sm font-medium text-foreground">Install To</label>
        <div class="flex gap-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="wizardScope" value="project" checked>
            <span class="text-sm text-foreground">Project</span>
            <span class="text-xs text-muted-foreground">(.claude/settings.json)</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="wizardScope" value="global">
            <span class="text-sm text-foreground">Global</span>
            <span class="text-xs text-muted-foreground">(~/.claude/settings.json)</span>
          </label>
        </div>
      </div>
    </div>
  `;

  // Initialize Lucide icons
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateWizardTrigger(triggerId) {
  wizardConfig.triggerType = triggerId;
  renderWizardModalContent();
}

function updateWizardConfig(key, value) {
  wizardConfig[key] = value;
  // Update command preview
  const preview = document.getElementById('wizardCommandPreview');
  if (preview) {
    preview.textContent = generateWizardCommand();
  }
  // Re-render if interval changed (to update display)
  if (key === 'interval') {
    const displaySpan = document.querySelector(`#wizard_${key}`)?.parentElement?.querySelector('.text-muted-foreground:last-child');
    if (displaySpan) {
      displaySpan.textContent = formatIntervalDisplay(value);
    }
  }
}

function formatIntervalDisplay(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (secs === 0) return `${mins}min`;
  return `${mins}min ${secs}s`;
}

// ========== SKILL Context Wizard Custom Functions ==========
function renderSkillContextConfig() {
  const selectedOption = wizardConfig.triggerType || 'keyword';
  const skillConfigs = wizardConfig.skillConfigs || [];
  const availableSkills = window.availableSkills || [];

  if (selectedOption === 'auto') {
    const skillBadges = availableSkills.map(function(s) {
      return '<span class="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 rounded text-xs">' + escapeHtml(s.name) + '</span>';
    }).join(' ');
    return '<div class="bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground">' +
      '<div class="flex items-center gap-2 mb-2">' +
        '<i data-lucide="info" class="w-4 h-4"></i>' +
        '<span class="font-medium">Auto Detection Mode</span>' +
      '</div>' +
      '<p>SKILLs will be automatically loaded when their name appears in your prompt.</p>' +
      '<p class="mt-2">Available SKILLs: ' + skillBadges + '</p>' +
    '</div>';
  }

  var configListHtml = '';
  if (skillConfigs.length === 0) {
    configListHtml = '<div class="text-center py-6 text-muted-foreground text-sm border border-dashed border-border rounded-lg">' +
      '<i data-lucide="package" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>' +
      '<p>No SKILLs configured yet</p>' +
      '<p class="text-xs mt-1">Click "Add SKILL" to configure keyword triggers</p>' +
    '</div>';
  } else {
    configListHtml = skillConfigs.map(function(config, idx) {
      var skillOptions = availableSkills.map(function(s) {
        var selected = config.skill === s.id ? 'selected' : '';
        return '<option value="' + s.id + '" ' + selected + '>' + escapeHtml(s.name) + '</option>';
      }).join('');
      return '<div class="border border-border rounded-lg p-3 bg-card">' +
        '<div class="flex items-center justify-between mb-2">' +
          '<select onchange="updateSkillConfig(' + idx + ', \'skill\', this.value)" ' +
                  'class="px-2 py-1 text-sm bg-background border border-border rounded text-foreground">' +
            '<option value="">Select SKILL...</option>' +
            skillOptions +
          '</select>' +
          '<button onclick="removeSkillConfig(' + idx + ')" ' +
                  'class="p-1 text-muted-foreground hover:text-destructive rounded">' +
            '<i data-lucide="trash-2" class="w-4 h-4"></i>' +
          '</button>' +
        '</div>' +
        '<div class="space-y-1">' +
          '<label class="text-xs text-muted-foreground">Trigger Keywords (comma-separated)</label>' +
          '<input type="text" ' +
                 'value="' + (config.keywords || '') + '" ' +
                 'onchange="updateSkillConfig(' + idx + ', \'keywords\', this.value)" ' +
                 'placeholder="e.g., react, hooks, component" ' +
                 'class="w-full px-2 py-1.5 text-sm bg-background border border-border rounded text-foreground">' +
        '</div>' +
      '</div>';
    }).join('');
  }

  var noSkillsWarning = '';
  if (availableSkills.length === 0) {
    noSkillsWarning = '<div class="text-xs text-amber-500 flex items-center gap-1">' +
      '<i data-lucide="alert-triangle" class="w-3 h-3"></i>' +
      'No SKILLs found. Create SKILL packages in .claude/skills/' +
    '</div>';
  }

  return '<div class="space-y-4">' +
    '<div class="flex items-center justify-between">' +
      '<span class="text-sm font-medium text-foreground">Configure SKILLs</span>' +
      '<button type="button" onclick="addSkillConfig()" ' +
              'class="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 flex items-center gap-1">' +
        '<i data-lucide="plus" class="w-3 h-3"></i> Add SKILL' +
      '</button>' +
    '</div>' +
    '<div id="skillConfigsList" class="space-y-3">' + configListHtml + '</div>' +
    noSkillsWarning +
  '</div>';
}

function addSkillConfig() {
  if (!wizardConfig.skillConfigs) {
    wizardConfig.skillConfigs = [];
  }
  wizardConfig.skillConfigs.push({ skill: '', keywords: '' });
  renderWizardModalContent();
}

function removeSkillConfig(index) {
  if (wizardConfig.skillConfigs) {
    wizardConfig.skillConfigs.splice(index, 1);
    renderWizardModalContent();
  }
}

function updateSkillConfig(index, key, value) {
  if (wizardConfig.skillConfigs && wizardConfig.skillConfigs[index]) {
    wizardConfig.skillConfigs[index][key] = value;
    const preview = document.getElementById('wizardCommandPreview');
    if (preview) {
      preview.textContent = generateWizardCommand();
    }
  }
}



function generateWizardCommand() {
  if (!currentWizardTemplate) return '';

  const wizard = currentWizardTemplate;
  const wizardId = wizard.id;
  const triggerType = wizardConfig.triggerType || wizard.options[0].id;
  const selectedOption = wizard.options.find(o => o.id === triggerType);
  if (!selectedOption) return '';

  const baseTemplate = HOOK_TEMPLATES[selectedOption.templateId];
  if (!baseTemplate) return '';

  // Handle skill-context wizard
  if (wizardId === 'skill-context') {
    if (triggerType === 'keyword') {
      const skillConfigs = wizardConfig.skillConfigs || [];
      const validConfigs = skillConfigs.filter(c => c.skill && c.keywords);

      if (validConfigs.length === 0) {
        return '# No SKILL configurations yet';
      }

      const configJson = validConfigs.map(c => ({
        skill: c.skill,
        keywords: c.keywords.split(',').map(k => k.trim()).filter(k => k)
      }));

      const params = JSON.stringify({ configs: configJson, prompt: '$CLAUDE_PROMPT' });
      return `ccw tool exec skill_context_loader '${params}'`;
    } else {
      // auto mode
      const params = JSON.stringify({ mode: 'auto', prompt: '$CLAUDE_PROMPT' });
      return `ccw tool exec skill_context_loader '${params}'`;
    }
  }

  // Handle memory-update wizard (default)
  const tool = wizardConfig.tool || 'gemini';
  const strategy = wizardConfig.strategy || 'related';
  const interval = wizardConfig.interval || 300;

  // Build the ccw tool command based on configuration
  const params = JSON.stringify({ strategy, tool });

  if (triggerType === 'periodic') {
    return `INTERVAL=${interval}; LAST_FILE=~/.claude/.last_memory_update; NOW=$(date +%s); LAST=0; [ -f "$LAST_FILE" ] && LAST=$(cat "$LAST_FILE"); if [ $((NOW - LAST)) -ge $INTERVAL ]; then echo $NOW > "$LAST_FILE"; ccw tool exec update_module_claude '${params}' & fi`;
  } else {
    return `ccw tool exec update_module_claude '${params}'`;
  }
}

async function submitHookWizard() {
  if (!currentWizardTemplate) return;

  const wizard = currentWizardTemplate;
  const triggerType = wizardConfig.triggerType || wizard.options[0].id;
  const selectedOption = wizard.options.find(o => o.id === triggerType);
  if (!selectedOption) return;

  const baseTemplate = HOOK_TEMPLATES[selectedOption.templateId];
  if (!baseTemplate) return;

  const scope = document.querySelector('input[name="wizardScope"]:checked')?.value || 'project';
  const command = generateWizardCommand();

  const hookData = {
    command: 'bash',
    args: ['-c', command]
  };

  if (baseTemplate.matcher) {
    hookData.matcher = baseTemplate.matcher;
  }

  await saveHook(scope, baseTemplate.event, hookData);
  closeHookWizardModal();
}

// ========== Template View/Copy Functions ==========
function viewTemplateDetails(templateId) {
  const template = HOOK_TEMPLATES[templateId];
  if (!template) return;

  const modal = document.getElementById('templateViewModal');
  const content = document.getElementById('templateViewContent');

  if (modal && content) {
    const args = template.args || [];
    content.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center gap-3 pb-3 border-b border-border">
          <i data-lucide="webhook" class="w-5 h-5 text-primary"></i>
          <div>
            <h4 class="font-semibold text-foreground">${escapeHtml(templateId)}</h4>
            <p class="text-sm text-muted-foreground">${escapeHtml(template.description || 'No description')}</p>
          </div>
        </div>

        <div class="space-y-3 text-sm">
          <div class="flex items-start gap-2">
            <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0 w-16">Event</span>
            <span class="font-medium text-foreground">${escapeHtml(template.event)}</span>
          </div>
          <div class="flex items-start gap-2">
            <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0 w-16">Matcher</span>
            <span class="text-muted-foreground">${escapeHtml(template.matcher || 'All tools')}</span>
          </div>
          <div class="flex items-start gap-2">
            <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0 w-16">Command</span>
            <code class="font-mono text-xs text-foreground">${escapeHtml(template.command)}</code>
          </div>
          ${args.length > 0 ? `
            <div class="flex items-start gap-2">
              <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0 w-16">Args</span>
              <div class="flex-1">
                <pre class="font-mono text-xs text-muted-foreground bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap">${escapeHtml(args.join('\n'))}</pre>
              </div>
            </div>
          ` : ''}
          ${template.category ? `
            <div class="flex items-start gap-2">
              <span class="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0 w-16">Category</span>
              <span class="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">${escapeHtml(template.category)}</span>
            </div>
          ` : ''}
        </div>

        <div class="flex gap-2 pt-3 border-t border-border">
          <button class="flex-1 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
                  onclick="copyTemplateToClipboard('${templateId}')">
            <i data-lucide="copy" class="w-4 h-4 inline mr-1"></i> Copy JSON
          </button>
          <button class="flex-1 px-3 py-2 text-sm bg-muted text-foreground rounded-lg hover:bg-hover transition-colors"
                  onclick="editTemplateAsNew('${templateId}')">
            <i data-lucide="pencil" class="w-4 h-4 inline mr-1"></i> Edit as New
          </button>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

function closeTemplateViewModal() {
  const modal = document.getElementById('templateViewModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function copyTemplateToClipboard(templateId) {
  const template = HOOK_TEMPLATES[templateId];
  if (!template) return;

  const hookJson = {
    matcher: template.matcher || undefined,
    command: template.command,
    args: template.args
  };

  // Clean up undefined values
  Object.keys(hookJson).forEach(key => {
    if (hookJson[key] === undefined || hookJson[key] === '') {
      delete hookJson[key];
    }
  });

  navigator.clipboard.writeText(JSON.stringify(hookJson, null, 2))
    .then(() => showRefreshToast('Template copied to clipboard', 'success'))
    .catch(() => showRefreshToast('Failed to copy', 'error'));
}

function editTemplateAsNew(templateId) {
  const template = HOOK_TEMPLATES[templateId];
  if (!template) return;

  closeTemplateViewModal();

  // Open create modal with template data
  openHookCreateModal({
    event: template.event,
    matcher: template.matcher || '',
    command: template.command,
    args: template.args || []
  });
}