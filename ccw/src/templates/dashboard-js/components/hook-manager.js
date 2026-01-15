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
    command: 'bash',
    args: ['-c', 'INPUT=$(cat); FILE_PATH=$(echo "$INPUT" | jq -r ".tool_input.file_path // .tool_input.path // empty"); [ -n "$FILE_PATH" ] && curl -s -X POST -H "Content-Type: application/json" -d "{\\"type\\":\\"file_written\\",\\"filePath\\":\\"$FILE_PATH\\"}" http://localhost:3456/api/hook || true'],
    description: 'Notify CCW dashboard when files are written',
    category: 'notification'
  },
  'log-tool': {
    event: 'PostToolUse',
    matcher: '',
    command: 'bash',
    args: ['-c', 'mkdir -p "$HOME/.claude"; INPUT=$(cat); TOOL=$(echo "$INPUT" | jq -r ".tool_name // empty" 2>/dev/null); FILE=$(echo "$INPUT" | jq -r ".tool_input.file_path // .tool_input.path // empty" 2>/dev/null); echo "[$(date)] Tool: $TOOL, File: $FILE" >> "$HOME/.claude/tool-usage.log"'],
    description: 'Log all tool executions to a file',
    category: 'logging'
  },
  'lint-check': {
    event: 'PostToolUse',
    matcher: 'Write',
    command: 'bash',
    args: ['-c', 'INPUT=$(cat); FILE=$(echo "$INPUT" | jq -r ".tool_input.file_path // empty"); if [[ "$FILE" =~ \\.(js|ts|jsx|tsx)$ ]]; then npx eslint "$FILE" --fix 2>/dev/null || true; fi'],
    description: 'Run ESLint on JavaScript/TypeScript files after write',
    category: 'quality'
  },
  'git-add': {
    event: 'PostToolUse',
    matcher: 'Write',
    command: 'bash',
    args: ['-c', 'INPUT=$(cat); FILE=$(echo "$INPUT" | jq -r ".tool_input.file_path // empty"); [ -n "$FILE" ] && git add "$FILE" 2>/dev/null || true'],
    description: 'Automatically stage written files to git',
    category: 'git'
  },
  'codexlens-update': {
    event: 'PostToolUse',
    matcher: 'Write|Edit',
    command: 'bash',
    args: ['-c', 'INPUT=$(cat); FILE=$(echo "$INPUT" | jq -r ".tool_input.file_path // .tool_input.path // empty"); [ -d ".codexlens" ] && [ -n "$FILE" ] && (python -m codexlens update "$FILE" --json 2>/dev/null || ~/.codexlens/venv/bin/python -m codexlens update "$FILE" --json 2>/dev/null || true)'],
    description: 'Auto-update code index when files are written or edited',
    category: 'indexing'
  },
  'memory-update-queue': {
    event: 'Stop',
    matcher: '',
    command: 'node',
    args: ['-e', "require('child_process').spawnSync(process.platform==='win32'?'cmd':'ccw',process.platform==='win32'?['/c','ccw','tool','exec','memory_queue',JSON.stringify({action:'add',path:process.env.CLAUDE_PROJECT_DIR,tool:'gemini'})]:['tool','exec','memory_queue',JSON.stringify({action:'add',path:process.env.CLAUDE_PROJECT_DIR,tool:'gemini'})],{stdio:'inherit'})"],
    description: 'Queue CLAUDE.md update when session ends (batched by threshold/timeout)',
    category: 'memory',
    configurable: true,
    config: {
      tool: { type: 'select', default: 'gemini', options: ['gemini', 'qwen', 'codex', 'opencode'], label: 'CLI Tool' },
      threshold: { type: 'number', default: 5, min: 1, max: 20, label: 'Threshold (paths)', step: 1 },
      timeout: { type: 'number', default: 300, min: 60, max: 1800, label: 'Timeout (seconds)', step: 60 }
    }
  },
  // SKILL Context Loader templates
  'skill-context-keyword': {
    event: 'UserPromptSubmit',
    matcher: '',
    command: 'node',
    args: ['-e', "const p=JSON.parse(process.env.HOOK_INPUT||'{}');require('child_process').spawnSync('ccw',['tool','exec','skill_context_loader',JSON.stringify({prompt:p.user_prompt||''})],{stdio:'inherit'})"],
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
    command: 'node',
    args: ['-e', "const p=JSON.parse(process.env.HOOK_INPUT||'{}');require('child_process').spawnSync('ccw',['tool','exec','skill_context_loader',JSON.stringify({mode:'auto',prompt:p.user_prompt||''})],{stdio:'inherit'})"],
    description: 'Auto-detect and load SKILL based on skill name in prompt',
    category: 'skill',
    configurable: false
  },
  'memory-file-read': {
    event: 'PostToolUse',
    matcher: 'Read|mcp__ccw-tools__read_file',
    command: 'ccw',
    args: ['memory', 'track', '--type', 'file', '--action', 'read', '--stdin'],
    description: 'Track file reads to build context heatmap',
    category: 'memory',
    timeout: 5000
  },
  'memory-file-write': {
    event: 'PostToolUse',
    matcher: 'Write|Edit|mcp__ccw-tools__write_file|mcp__ccw-tools__edit_file',
    command: 'ccw',
    args: ['memory', 'track', '--type', 'file', '--action', 'write', '--stdin'],
    description: 'Track file modifications to identify core modules',
    category: 'memory',
    timeout: 5000
  },
  'memory-prompt-track': {
    event: 'UserPromptSubmit',
    matcher: '',
    command: 'ccw',
    args: ['memory', 'track', '--type', 'topic', '--action', 'mention', '--stdin'],
    description: 'Record user prompts for pattern analysis',
    category: 'memory',
    timeout: 5000
  },
  // Session Context - Progressive disclosure based on session state
  // First prompt: returns cluster overview, subsequent: intent-matched sessions
  'session-context': {
    event: 'UserPromptSubmit',
    matcher: '',
    command: 'ccw',
    args: ['hook', 'session-context', '--stdin'],
    description: 'Progressive session context (cluster overview → intent matching)',
    category: 'context',
    timeout: 5000
  },
  // ========== Danger Protection Hooks (PreToolUse with confirmation) ==========
  'danger-bash-confirm': {
    event: 'PreToolUse',
    matcher: 'Bash',
    command: 'bash',
    args: ['-c', 'INPUT=$(cat); CMD=$(echo "$INPUT" | jq -r ".tool_input.command // empty"); DANGEROUS_PATTERNS="rm -rf|rmdir|del /|format |shutdown|reboot|kill -9|pkill|mkfs|dd if=|chmod 777|chown -R|>/dev/|wget.*\\|.*sh|curl.*\\|.*bash"; if echo "$CMD" | grep -qiE "$DANGEROUS_PATTERNS"; then echo "{\\"hookSpecificOutput\\":{\\"hookEventName\\":\\"PreToolUse\\",\\"permissionDecision\\":\\"ask\\",\\"permissionDecisionReason\\":\\"Potentially dangerous command detected: requires user confirmation\\"}}" && exit 0; fi; exit 0'],
    description: 'Confirm before running potentially dangerous shell commands (rm -rf, shutdown, etc.)',
    category: 'danger',
    timeout: 5000
  },
  'danger-file-protection': {
    event: 'PreToolUse',
    matcher: 'Write|Edit',
    command: 'bash',
    args: ['-c', 'INPUT=$(cat); FILE=$(echo "$INPUT" | jq -r ".tool_input.file_path // .tool_input.path // empty"); PROTECTED=".env|.git/|package-lock.json|yarn.lock|.credentials|secrets|id_rsa|.pem$|.key$"; if echo "$FILE" | grep -qiE "$PROTECTED"; then echo "{\\"hookSpecificOutput\\":{\\"hookEventName\\":\\"PreToolUse\\",\\"permissionDecision\\":\\"deny\\",\\"permissionDecisionReason\\":\\"Protected file cannot be modified: $FILE\\"}}" && exit 0; fi; exit 0'],
    description: 'Block modifications to sensitive files (.env, .git/, secrets, keys)',
    category: 'danger',
    timeout: 5000
  },
  'danger-git-destructive': {
    event: 'PreToolUse',
    matcher: 'Bash',
    command: 'bash',
    args: ['-c', 'INPUT=$(cat); CMD=$(echo "$INPUT" | jq -r ".tool_input.command // empty"); GIT_DANGEROUS="git push.*--force|git push.*-f|git reset --hard|git clean -fd|git checkout.*--force|git branch -D|git rebase.*-f"; if echo "$CMD" | grep -qiE "$GIT_DANGEROUS"; then echo "{\\"hookSpecificOutput\\":{\\"hookEventName\\":\\"PreToolUse\\",\\"permissionDecision\\":\\"ask\\",\\"permissionDecisionReason\\":\\"Destructive git operation detected: $CMD\\"}}" && exit 0; fi; exit 0'],
    description: 'Confirm before destructive git operations (force push, hard reset, etc.)',
    category: 'danger',
    timeout: 5000
  },
  'danger-network-confirm': {
    event: 'PreToolUse',
    matcher: 'Bash|WebFetch',
    command: 'bash',
    args: ['-c', 'INPUT=$(cat); TOOL=$(echo "$INPUT" | jq -r ".tool_name // empty"); if [ "$TOOL" = "WebFetch" ]; then URL=$(echo "$INPUT" | jq -r ".tool_input.url // empty"); echo "{\\"hookSpecificOutput\\":{\\"hookEventName\\":\\"PreToolUse\\",\\"permissionDecision\\":\\"ask\\",\\"permissionDecisionReason\\":\\"Network request to: $URL\\"}}" && exit 0; fi; CMD=$(echo "$INPUT" | jq -r ".tool_input.command // empty"); NET_CMDS="curl|wget|nc |netcat|ssh |scp |rsync|ftp "; if echo "$CMD" | grep -qiE "^($NET_CMDS)"; then echo "{\\"hookSpecificOutput\\":{\\"hookEventName\\":\\"PreToolUse\\",\\"permissionDecision\\":\\"ask\\",\\"permissionDecisionReason\\":\\"Network command requires confirmation: $CMD\\"}}" && exit 0; fi; exit 0'],
    description: 'Confirm before network operations (curl, wget, ssh, WebFetch)',
    category: 'danger',
    timeout: 5000
  },
  'danger-system-paths': {
    event: 'PreToolUse',
    matcher: 'Write|Edit|Bash',
    command: 'bash',
    args: ['-c', 'INPUT=$(cat); TOOL=$(echo "$INPUT" | jq -r ".tool_name // empty"); if [ "$TOOL" = "Bash" ]; then CMD=$(echo "$INPUT" | jq -r ".tool_input.command // empty"); SYS_PATHS="/etc/|/usr/|/bin/|/sbin/|/boot/|/sys/|/proc/|C:\\\\Windows|C:\\\\Program Files"; if echo "$CMD" | grep -qiE "$SYS_PATHS"; then echo "{\\"hookSpecificOutput\\":{\\"hookEventName\\":\\"PreToolUse\\",\\"permissionDecision\\":\\"ask\\",\\"permissionDecisionReason\\":\\"System path operation requires confirmation\\"}}" && exit 0; fi; else FILE=$(echo "$INPUT" | jq -r ".tool_input.file_path // .tool_input.path // empty"); SYS_PATHS="/etc/|/usr/|/bin/|/sbin/|C:\\\\Windows|C:\\\\Program Files"; if echo "$FILE" | grep -qiE "$SYS_PATHS"; then echo "{\\"hookSpecificOutput\\":{\\"hookEventName\\":\\"PreToolUse\\",\\"permissionDecision\\":\\"deny\\",\\"permissionDecisionReason\\":\\"Cannot modify system file: $FILE\\"}}" && exit 0; fi; fi; exit 0'],
    description: 'Block/confirm operations on system directories (/etc, /usr, Windows)',
    category: 'danger',
    timeout: 5000
  },
  'danger-permission-change': {
    event: 'PreToolUse',
    matcher: 'Bash',
    command: 'bash',
    args: ['-c', 'INPUT=$(cat); CMD=$(echo "$INPUT" | jq -r ".tool_input.command // empty"); PERM_CMDS="chmod|chown|chgrp|setfacl|icacls|takeown|cacls"; if echo "$CMD" | grep -qiE "^($PERM_CMDS)"; then echo "{\\"hookSpecificOutput\\":{\\"hookEventName\\":\\"PreToolUse\\",\\"permissionDecision\\":\\"ask\\",\\"permissionDecisionReason\\":\\"Permission change requires confirmation: $CMD\\"}}" && exit 0; fi; exit 0'],
    description: 'Confirm before changing file permissions (chmod, chown, icacls)',
    category: 'danger',
    timeout: 5000
  }
};

// ========== Wizard Templates (Special Category) ==========
const WIZARD_TEMPLATES = {
  'memory-update': {
    name: 'Memory Update Hook',
    description: 'Queue-based CLAUDE.md updates with configurable threshold and timeout',
    icon: 'brain',
    options: [
      {
        id: 'queue',
        name: 'Queue-Based Update',
        description: 'Batch updates when threshold reached or timeout expires',
        templateId: 'memory-update-queue'
      }
    ],
    configFields: [
      { key: 'tool', type: 'select', label: 'CLI Tool', default: 'gemini', options: ['gemini', 'qwen', 'codex', 'opencode'], description: 'CLI tool for CLAUDE.md generation' },
      { key: 'threshold', type: 'number', label: 'Threshold (paths)', default: 5, min: 1, max: 20, step: 1, description: 'Number of paths to trigger batch update' },
      { key: 'timeout', type: 'number', label: 'Timeout (seconds)', default: 300, min: 60, max: 1800, step: 60, description: 'Auto-flush queue after this time' }
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
  },
  'memory-setup': {
    name: 'Memory Module Setup',
    description: 'Configure automatic context tracking',
    icon: 'brain',
    options: [
      {
        id: 'file-read',
        name: 'File Read Tracker',
        description: 'Track file reads to build context heatmap',
        templateId: 'memory-file-read'
      },
      {
        id: 'file-write',
        name: 'File Write Tracker',
        description: 'Track file modifications to identify core modules',
        templateId: 'memory-file-write'
      },
      {
        id: 'prompts',
        name: 'Prompt Tracker',
        description: 'Record user prompts for pattern analysis',
        templateId: 'memory-prompt-track'
      }
    ],
    configFields: [],
    multiSelect: true
  },
  'danger-protection': {
    name: 'Danger Protection',
    description: 'Protect against dangerous operations with confirmation dialogs',
    icon: 'shield-alert',
    options: [
      {
        id: 'bash-confirm',
        name: 'Dangerous Commands',
        description: 'Confirm before rm -rf, shutdown, kill, format, etc.',
        templateId: 'danger-bash-confirm'
      },
      {
        id: 'file-protection',
        name: 'Sensitive Files',
        description: 'Block modifications to .env, .git/, secrets, keys',
        templateId: 'danger-file-protection'
      },
      {
        id: 'git-destructive',
        name: 'Git Operations',
        description: 'Confirm force push, hard reset, branch delete',
        templateId: 'danger-git-destructive'
      },
      {
        id: 'network-confirm',
        name: 'Network Access',
        description: 'Confirm curl, wget, ssh, WebFetch requests',
        templateId: 'danger-network-confirm'
      },
      {
        id: 'system-paths',
        name: 'System Paths',
        description: 'Block/confirm operations on /etc, /usr, C:\\Windows',
        templateId: 'danger-system-paths'
      },
      {
        id: 'permission-change',
        name: 'Permission Changes',
        description: 'Confirm chmod, chown, icacls operations',
        templateId: 'danger-permission-change'
      }
    ],
    configFields: [],
    multiSelect: true
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

async function loadAvailableSkills() {
  try {
    const response = await fetch('/api/skills?path=' + encodeURIComponent(projectPath));
    if (!response.ok) throw new Error('Failed to load skills');
    const data = await response.json();

    // Combine project and user skills
    const projectSkills = (data.projectSkills || []).map(s => ({
      name: s.name,
      path: s.path,
      scope: 'project'
    }));
    const userSkills = (data.userSkills || []).map(s => ({
      name: s.name,
      path: s.path,
      scope: 'user'
    }));

    // Store in window for access by wizard
    window.availableSkills = [...projectSkills, ...userSkills];

    return window.availableSkills;
  } catch (err) {
    console.error('Failed to load available skills:', err);
    window.availableSkills = [];
    return [];
  }
}

/**
 * Convert internal hook format to Claude Code format
 * Internal: { command, args, matcher, timeout }
 * Claude Code: { matcher, hooks: [{ type: "command", command: "...", timeout }] }
 *
 * IMPORTANT: For bash -c commands, use single quotes to wrap the script argument
 * to avoid complex escaping issues with jq commands inside.
 * See: https://github.com/catlog22/Claude-Code-Workflow/issues/73
 */
function convertToClaudeCodeFormat(hookData) {
  // If already in correct format, return as-is
  if (hookData.hooks && Array.isArray(hookData.hooks)) {
    return hookData;
  }

  // Build command string from command + args
  let commandStr = hookData.command || '';
  if (hookData.args && Array.isArray(hookData.args)) {
    // Special handling for bash -c commands: use single quotes for the script
    // This avoids complex escaping issues with jq and other shell commands
    if (commandStr === 'bash' && hookData.args.length >= 2 && hookData.args[0] === '-c') {
      // Use single quotes for bash -c script argument
      // Single quotes prevent shell expansion, so internal double quotes work naturally
      const script = hookData.args[1];
      // Escape single quotes within the script: ' -> '\''
      const escapedScript = script.replace(/'/g, "'\\''");
      commandStr = `bash -c '${escapedScript}'`;
      // Handle any additional args after the script
      if (hookData.args.length > 2) {
        const additionalArgs = hookData.args.slice(2).map(arg => {
          if (arg.includes(' ') && !arg.startsWith('"') && !arg.startsWith("'")) {
            return `"${arg.replace(/"/g, '\\"')}"`;
          }
          return arg;
        });
        commandStr += ' ' + additionalArgs.join(' ');
      }
    } else {
      // Default handling for other commands
      const quotedArgs = hookData.args.map(arg => {
        if (arg.includes(' ') && !arg.startsWith('"') && !arg.startsWith("'")) {
          return `"${arg.replace(/"/g, '\\"')}"`;
        }
        return arg;
      });
      commandStr = `${commandStr} ${quotedArgs.join(' ')}`.trim();
    }
  }

  const converted = {
    hooks: [{
      type: 'command',
      command: commandStr
    }]
  };

  // Add matcher if present (not needed for UserPromptSubmit, Stop, etc.)
  if (hookData.matcher) {
    converted.matcher = hookData.matcher;
  }

  // Add timeout if present (in seconds for Claude Code)
  if (hookData.timeout) {
    converted.hooks[0].timeout = Math.ceil(hookData.timeout / 1000);
  }

  // Preserve replaceIndex for updates
  if (hookData.replaceIndex !== undefined) {
    converted.replaceIndex = hookData.replaceIndex;
  }

  return converted;
}

async function saveHook(scope, event, hookData) {
  try {
    // Convert to Claude Code format before saving
    const convertedHookData = convertToClaudeCodeFormat(hookData);
    
    const response = await csrfFetch('/api/hooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectPath: projectPath,
        scope: scope,
        event: event,
        hookData: convertedHookData
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
    const response = await csrfFetch('/api/hooks', {
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

async function openHookWizardModal(wizardId) {
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

  // Initialize selectedOptions for multi-select wizards
  if (wizard.multiSelect) {
    wizardConfig.selectedOptions = [];
  }

  // Always refresh available skills when opening SKILL context wizard
  if (wizardId === 'skill-context') {
    await loadAvailableSkills();
  }

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
  const wizardId = wizard.id;
  const selectedOption = wizardConfig.triggerType || wizard.options[0].id;

  // Get translated wizard name and description
  const wizardName = wizardId === 'memory-update' ? t('hook.wizard.memoryUpdate') :
                     wizardId === 'memory-setup' ? t('hook.wizard.memorySetup') :
                     wizardId === 'skill-context' ? t('hook.wizard.skillContext') : wizard.name;
  const wizardDesc = wizardId === 'memory-update' ? t('hook.wizard.memoryUpdateDesc') :
                     wizardId === 'memory-setup' ? t('hook.wizard.memorySetupDesc') :
                     wizardId === 'skill-context' ? t('hook.wizard.skillContextDesc') : wizard.description;

  // Helper to get translated option names
  const getOptionName = (optId) => {
    if (wizardId === 'memory-update') {
      if (optId === 'queue') return t('hook.wizard.queueBasedUpdate') || 'Queue-Based Update';
    }
    if (wizardId === 'memory-setup') {
      if (optId === 'file-read') return t('hook.wizard.fileReadTracker');
      if (optId === 'file-write') return t('hook.wizard.fileWriteTracker');
      if (optId === 'prompts') return t('hook.wizard.promptTracker');
    }
    if (wizardId === 'skill-context') {
      if (optId === 'keyword') return t('hook.wizard.keywordMatching');
      if (optId === 'auto') return t('hook.wizard.autoDetection');
    }
    return wizard.options.find(o => o.id === optId)?.name || '';
  };

  const getOptionDesc = (optId) => {
    if (wizardId === 'memory-update') {
      if (optId === 'queue') return t('hook.wizard.queueBasedUpdateDesc') || 'Batch updates when threshold reached or timeout expires';
    }
    if (wizardId === 'memory-setup') {
      if (optId === 'file-read') return t('hook.wizard.fileReadTrackerDesc');
      if (optId === 'file-write') return t('hook.wizard.fileWriteTrackerDesc');
      if (optId === 'prompts') return t('hook.wizard.promptTrackerDesc');
    }
    if (wizardId === 'skill-context') {
      if (optId === 'keyword') return t('hook.wizard.keywordMatchingDesc');
      if (optId === 'auto') return t('hook.wizard.autoDetectionDesc');
    }
    return wizard.options.find(o => o.id === optId)?.description || '';
  };

  // Helper to get translated field labels
  const getFieldLabel = (fieldKey) => {
    const labels = {
      'tool': t('hook.wizard.cliTool') || 'CLI Tool',
      'threshold': t('hook.wizard.thresholdPaths') || 'Threshold (paths)',
      'timeout': t('hook.wizard.timeoutSeconds') || 'Timeout (seconds)'
    };
    return labels[fieldKey] || wizard.configFields.find(f => f.key === fieldKey)?.label || fieldKey;
  };

  const getFieldDesc = (fieldKey) => {
    const descs = {
      'tool': t('hook.wizard.cliToolDesc') || 'CLI tool for CLAUDE.md generation',
      'threshold': t('hook.wizard.thresholdPathsDesc') || 'Number of paths to trigger batch update',
      'timeout': t('hook.wizard.timeoutSecondsDesc') || 'Auto-flush queue after this time'
    };
    return descs[fieldKey] || wizard.configFields.find(f => f.key === fieldKey)?.description || '';
  };

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Wizard Header -->
      <div class="flex items-center gap-3 pb-4 border-b border-border">
        <div class="p-2 bg-primary/10 rounded-lg">
          <i data-lucide="${wizard.icon}" class="w-6 h-6 text-primary"></i>
        </div>
        <div>
          <h3 class="text-lg font-semibold text-foreground">${escapeHtml(wizardName)}</h3>
          <p class="text-sm text-muted-foreground">${escapeHtml(wizardDesc)}</p>
        </div>
      </div>

      <!-- Trigger Type Selection -->
      <div class="space-y-3">
        <label class="block text-sm font-medium text-foreground">${wizard.multiSelect ? t('hook.wizard.selectTrackers') : t('hook.wizard.whenToTrigger')}</label>
        <div class="grid grid-cols-1 gap-3">
          ${wizard.multiSelect ? wizard.options.map(opt => {
            const isSelected = wizardConfig.selectedOptions?.includes(opt.id) || false;
            return `
              <label class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'}">
                <input type="checkbox" name="wizardTrigger" value="${opt.id}"
                       ${isSelected ? 'checked' : ''}
                       onchange="toggleWizardOption('${opt.id}')"
                       class="mt-1">
                <div class="flex-1">
                  <span class="font-medium text-foreground">${escapeHtml(getOptionName(opt.id))}</span>
                  <p class="text-sm text-muted-foreground">${escapeHtml(getOptionDesc(opt.id))}</p>
                </div>
              </label>
            `;
          }).join('') : wizard.options.map(opt => `
            <label class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all ${selectedOption === opt.id ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'}">
              <input type="radio" name="wizardTrigger" value="${opt.id}"
                     ${selectedOption === opt.id ? 'checked' : ''}
                     onchange="updateWizardTrigger('${opt.id}')"
                     class="mt-1">
              <div class="flex-1">
                <span class="font-medium text-foreground">${escapeHtml(getOptionName(opt.id))}</span>
                <p class="text-sm text-muted-foreground">${escapeHtml(getOptionDesc(opt.id))}</p>
              </div>
            </label>
          `).join('')}
        </div>
      </div>

      <!-- Configuration Fields -->
      <div class="space-y-4">
        <label class="block text-sm font-medium text-foreground">${t('hook.wizard.configuration')}</label>
        ${wizard.customRenderer ? window[wizard.customRenderer]() : wizard.configFields.map(field => {
          // Check if field should be shown for current trigger type
          const shouldShow = !field.showFor || field.showFor.includes(selectedOption);
          if (!shouldShow) return '';

          const value = wizardConfig[field.key] ?? field.default;
          const fieldLabel = getFieldLabel(field.key);
          const fieldDesc = getFieldDesc(field.key);

          if (field.type === 'select') {
            return `
              <div class="space-y-1">
                <label class="block text-sm text-muted-foreground">${escapeHtml(fieldLabel)}</label>
                <select id="wizard_${field.key}"
                        onchange="updateWizardConfig('${field.key}', this.value)"
                        class="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                  ${field.options.map(opt => `
                    <option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>
                  `).join('')}
                </select>
                ${fieldDesc ? `<p class="text-xs text-muted-foreground">${escapeHtml(fieldDesc)}</p>` : ''}
              </div>
            `;
          } else if (field.type === 'number') {
            return `
              <div class="space-y-1">
                <label class="block text-sm text-muted-foreground">${escapeHtml(fieldLabel)}</label>
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
                ${fieldDesc ? `<p class="text-xs text-muted-foreground">${escapeHtml(fieldDesc)}</p>` : ''}
              </div>
            `;
          }
          return '';
        }).join('')}
      </div>

      <!-- Preview -->
      <div class="space-y-2">
        <label class="block text-sm font-medium text-foreground">${t('hook.wizard.commandPreview')}</label>
        <div class="bg-muted/50 rounded-lg p-3 font-mono text-xs overflow-x-auto">
          <pre id="wizardCommandPreview" class="whitespace-pre-wrap text-muted-foreground">${escapeHtml(generateWizardCommand())}</pre>
        </div>
      </div>

      <!-- Scope Selection -->
      <div class="space-y-3">
        <label class="block text-sm font-medium text-foreground">${t('hook.wizard.installTo')}</label>
        <div class="flex gap-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="wizardScope" value="project" checked>
            <span class="text-sm text-foreground">${t('hook.scopeProject').split('（')[0]}</span>
            <span class="text-xs text-muted-foreground">(.claude/settings.json)</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="wizardScope" value="global">
            <span class="text-sm text-foreground">${t('hook.scopeGlobal').split('（')[0]}</span>
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

function toggleWizardOption(optionId) {
  if (!wizardConfig.selectedOptions) {
    wizardConfig.selectedOptions = [];
  }

  const index = wizardConfig.selectedOptions.indexOf(optionId);
  if (index === -1) {
    wizardConfig.selectedOptions.push(optionId);
  } else {
    wizardConfig.selectedOptions.splice(index, 1);
  }

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
    let skillBadges = '';
    let isLoading = typeof window.availableSkills === 'undefined' || window.skillsLoading;
    if (isLoading) {
      // Still loading
      skillBadges = '<span class="px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-xs">' + t('common.loading') + '...</span>';
    } else if (availableSkills.length === 0) {
      // No skills found
      skillBadges = '<span class="px-1.5 py-0.5 bg-warning/10 text-warning rounded text-xs">' + t('hook.wizard.noSkillsFound') + '</span>';
    } else {
      // Skills found
      skillBadges = availableSkills.map(function(s) {
        return '<span class="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 rounded text-xs">' + escapeHtml(s.name) + '</span>';
      }).join(' ');
    }
    return '<div class="bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground">' +
      '<div class="flex items-center justify-between mb-2">' +
        '<div class="flex items-center gap-2">' +
          '<i data-lucide="info" class="w-4 h-4"></i>' +
          '<span class="font-medium">' + t('hook.wizard.autoDetectionMode') + '</span>' +
        '</div>' +
        '<button type="button" onclick="refreshAvailableSkills()" ' +
                'class="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors" ' +
                'title="' + t('common.refresh') + '">' +
          '<i data-lucide="refresh-cw" class="w-4 h-4' + (isLoading ? ' animate-spin' : '') + '"></i>' +
        '</button>' +
      '</div>' +
      '<p>' + t('hook.wizard.autoDetectionInfo') + '</p>' +
      '<div class="mt-2 flex items-center gap-2 flex-wrap">' +
        '<span>' + t('hook.wizard.availableSkills') + '</span>' +
        skillBadges +
      '</div>' +
    '</div>';
  }

  var configListHtml = '';
  if (skillConfigs.length === 0) {
    configListHtml = '<div class="text-center py-6 text-muted-foreground text-sm border border-dashed border-border rounded-lg">' +
      '<i data-lucide="package" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>' +
      '<p>' + t('hook.wizard.noSkillsConfigured') + '</p>' +
      '<p class="text-xs mt-1">' + t('hook.wizard.clickAddSkill') + '</p>' +
    '</div>';
  } else {
    configListHtml = skillConfigs.map(function(config, idx) {
      var skillOptions = '';
      if (availableSkills.length === 0) {
        skillOptions = '<option value="" disabled>' + t('hook.wizard.noSkillsFound') + '</option>';
      } else {
        skillOptions = availableSkills.map(function(s) {
          var selected = config.skill === s.name ? 'selected' : '';
          return '<option value="' + escapeHtml(s.name) + '" ' + selected + '>' + escapeHtml(s.name) + '</option>';
        }).join('');
      }
      return '<div class="border border-border rounded-lg p-3 bg-card">' +
        '<div class="flex items-center justify-between mb-2">' +
          '<select onchange="updateSkillConfig(' + idx + ', \'skill\', this.value)" ' +
                  'class="px-2 py-1 text-sm bg-background border border-border rounded text-foreground">' +
            '<option value="">' + t('hook.wizard.selectSkill') + '</option>' +
            skillOptions +
          '</select>' +
          '<button onclick="removeSkillConfig(' + idx + ')" ' +
                  'class="p-1 text-muted-foreground hover:text-destructive rounded">' +
            '<i data-lucide="trash-2" class="w-4 h-4"></i>' +
          '</button>' +
        '</div>' +
        '<div class="space-y-1">' +
          '<label class="text-xs text-muted-foreground">' + t('hook.wizard.triggerKeywords') + '</label>' +
          '<input type="text" ' +
                 'value="' + (config.keywords || '') + '" ' +
                 'onchange="updateSkillConfig(' + idx + ', \'keywords\', this.value)" ' +
                 'placeholder="e.g., react, hooks, component" ' +
                 'class="w-full px-2 py-1.5 text-sm bg-background border border-border rounded text-foreground">' +
        '</div>' +
      '</div>';
    }).join('');
  }

  var isLoading = typeof window.availableSkills === 'undefined' || window.skillsLoading;
  var skillsStatusHtml = '';
  if (isLoading) {
    skillsStatusHtml = '<span class="text-xs text-muted-foreground flex items-center gap-1">' +
      '<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i>' +
      t('common.loading') +
    '</span>';
  } else if (availableSkills.length === 0) {
    skillsStatusHtml = '<span class="text-xs text-amber-500 flex items-center gap-1">' +
      '<i data-lucide="alert-triangle" class="w-3 h-3"></i>' +
      t('hook.wizard.noSkillsFound') +
    '</span>';
  } else {
    skillsStatusHtml = '<span class="text-xs text-muted-foreground">' +
      availableSkills.length + ' ' + t('skills.skillsCount') +
    '</span>';
  }

  return '<div class="space-y-4">' +
    '<div class="flex items-center justify-between">' +
      '<div class="flex items-center gap-2">' +
        '<span class="text-sm font-medium text-foreground">' + t('hook.wizard.configureSkills') + '</span>' +
        skillsStatusHtml +
        '<button type="button" onclick="refreshAvailableSkills()" ' +
                'class="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors" ' +
                'title="' + t('common.refresh') + '">' +
          '<i data-lucide="refresh-cw" class="w-3 h-3' + (isLoading ? ' animate-spin' : '') + '"></i>' +
        '</button>' +
      '</div>' +
      '<button type="button" onclick="addSkillConfig()" ' +
              'class="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 flex items-center gap-1">' +
        '<i data-lucide="plus" class="w-3 h-3"></i> ' + t('hook.wizard.addSkill') +
      '</button>' +
    '</div>' +
    '<div id="skillConfigsList" class="space-y-3">' + configListHtml + '</div>' +
  '</div>';
}

async function refreshAvailableSkills() {
  // Set loading state
  window.skillsLoading = true;
  renderWizardModalContent();

  try {
    await loadAvailableSkills();
  } finally {
    window.skillsLoading = false;
    renderWizardModalContent();
    // Refresh Lucide icons
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
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

      // Use node + spawnSync for cross-platform JSON handling
      const paramsObj = { configs: configJson, prompt: '${p.user_prompt}' };
      return `node -e "const p=JSON.parse(process.env.HOOK_INPUT||'{}');require('child_process').spawnSync('ccw',['tool','exec','skill_context_loader',JSON.stringify(${JSON.stringify(paramsObj).replace('${p.user_prompt}', "'+p.user_prompt+'")})],{stdio:'inherit'})"`;
    } else {
      // auto mode - use node + spawnSync
      return `node -e "const p=JSON.parse(process.env.HOOK_INPUT||'{}');require('child_process').spawnSync('ccw',['tool','exec','skill_context_loader',JSON.stringify({mode:'auto',prompt:p.user_prompt||''})],{stdio:'inherit'})"`;
    }
  }

  // Handle memory-update wizard (default)
  // Use node + spawnSync for cross-platform JSON handling
  const selectedTool = wizardConfig.tool || 'gemini';
  return `node -e "require('child_process').spawnSync(process.platform==='win32'?'cmd':'ccw',process.platform==='win32'?['/c','ccw','tool','exec','memory_queue',JSON.stringify({action:'add',path:process.env.CLAUDE_PROJECT_DIR,tool:'${selectedTool}'})]:['tool','exec','memory_queue',JSON.stringify({action:'add',path:process.env.CLAUDE_PROJECT_DIR,tool:'${selectedTool}'})],{stdio:'inherit'})"`;
}

async function submitHookWizard() {
  if (!currentWizardTemplate) return;

  const wizard = currentWizardTemplate;
  const scope = document.querySelector('input[name="wizardScope"]:checked')?.value || 'project';

  // Handle multi-select wizards
  if (wizard.multiSelect) {
    const selectedOptions = wizardConfig.selectedOptions || [];
    if (selectedOptions.length === 0) {
      showRefreshToast('Please select at least one option', 'error');
      return;
    }

    // Install each selected hook (skip if already exists)
    let installedCount = 0;
    let skippedCount = 0;
    
    for (const optionId of selectedOptions) {
      const selectedOption = wizard.options.find(o => o.id === optionId);
      if (!selectedOption) continue;

      const baseTemplate = HOOK_TEMPLATES[selectedOption.templateId];
      if (!baseTemplate) continue;

      // Check if hook already exists
      const existingHooks = scope === 'global' 
        ? hookConfig.global?.hooks?.[baseTemplate.event] || []
        : hookConfig.project?.hooks?.[baseTemplate.event] || [];
      
      const hookList = Array.isArray(existingHooks) ? existingHooks : [existingHooks];
      const alreadyExists = hookList.some(h => {
        // Check by matcher and command
        const existingMatcher = h.matcher || '';
        const templateMatcher = baseTemplate.matcher || '';
        const existingCmd = h.hooks?.[0]?.command || h.command || '';
        const templateCmd = baseTemplate.command + ' ' + (baseTemplate.args || []).join(' ');
        return existingMatcher === templateMatcher && existingCmd.includes(baseTemplate.command);
      });

      if (alreadyExists) {
        skippedCount++;
        continue;
      }

      const hookData = {
        command: baseTemplate.command,
        args: baseTemplate.args
      };

      if (baseTemplate.matcher) {
        hookData.matcher = baseTemplate.matcher;
      }

      if (baseTemplate.timeout) {
        hookData.timeout = baseTemplate.timeout;
      }

      await saveHook(scope, baseTemplate.event, hookData);
      installedCount++;
    }

    closeHookWizardModal();
    
    if (skippedCount > 0 && installedCount === 0) {
      showRefreshToast(`All ${skippedCount} hook(s) already installed`, 'info');
    } else if (skippedCount > 0) {
      showRefreshToast(`Installed ${installedCount}, skipped ${skippedCount} (already exists)`, 'success');
    }
    return;
  }

  // Handle single-select wizards
  const triggerType = wizardConfig.triggerType || wizard.options[0].id;
  const selectedOption = wizard.options.find(o => o.id === triggerType);
  if (!selectedOption) return;

  const baseTemplate = HOOK_TEMPLATES[selectedOption.templateId];
  if (!baseTemplate) return;

  // Build hook data with configured values
  let hookData = {
    command: baseTemplate.command,
    args: [...baseTemplate.args]
  };

  // For memory-update wizard, use configured tool in args (cross-platform)
  if (wizard.id === 'memory-update') {
    const selectedTool = wizardConfig.tool || 'gemini';
    hookData.args = ['-e', `require('child_process').spawnSync(process.platform==='win32'?'cmd':'ccw',process.platform==='win32'?['/c','ccw','tool','exec','memory_queue',JSON.stringify({action:'add',path:process.env.CLAUDE_PROJECT_DIR,tool:'${selectedTool}'})]:['tool','exec','memory_queue',JSON.stringify({action:'add',path:process.env.CLAUDE_PROJECT_DIR,tool:'${selectedTool}'})],{stdio:'inherit'})`];
  }

  if (baseTemplate.matcher) {
    hookData.matcher = baseTemplate.matcher;
  }

  await saveHook(scope, baseTemplate.event, hookData);

  // For memory-update wizard, also configure queue settings
  if (wizard.id === 'memory-update') {
    const selectedTool = wizardConfig.tool || 'gemini';
    const threshold = wizardConfig.threshold || 5;
    const timeout = wizardConfig.timeout || 300;
    try {
      const configParams = JSON.stringify({ action: 'configure', threshold, timeout });
      const response = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'memory_queue', params: configParams })
      });
      if (response.ok) {
        showRefreshToast(`Queue configured: tool=${selectedTool}, threshold=${threshold}, timeout=${timeout}s`, 'success');
      }
    } catch (e) {
      console.warn('Failed to configure memory queue:', e);
    }
  }

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