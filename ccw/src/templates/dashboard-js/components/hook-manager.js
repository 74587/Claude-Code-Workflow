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
    'Stop': 'Runs when the agent stops'
  };
  return descriptions[event] || event;
}

function getHookEventIcon(event) {
  const icons = {
    'PreToolUse': '⏳',
    'PostToolUse': '✅',
    'Notification': '🔔',
    'Stop': '🛑'
  };
  return icons[event] || '🪝';
}

function getHookEventIconLucide(event) {
  const icons = {
    'PreToolUse': '<i data-lucide="clock" class="w-5 h-5"></i>',
    'PostToolUse': '<i data-lucide="check-circle" class="w-5 h-5"></i>',
    'Notification': '<i data-lucide="bell" class="w-5 h-5"></i>',
    'Stop': '<i data-lucide="octagon-x" class="w-5 h-5"></i>'
  };
  return icons[event] || '<i data-lucide="webhook" class="w-5 h-5"></i>';
}