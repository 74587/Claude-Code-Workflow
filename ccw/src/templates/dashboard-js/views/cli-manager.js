// CLI Manager View
// Main view combining CLI status, CCW installations, and history panels

// ========== CLI Manager State ==========
var currentCliExecution = null;
var cliExecutionOutput = '';
var ccwInstallations = [];

// ========== Initialization ==========
function initCliManager() {
  document.querySelectorAll('.nav-item[data-view="cli-manager"]').forEach(function(item) {
    item.addEventListener('click', function() {
      setActiveNavItem(item);
      currentView = 'cli-manager';
      currentFilter = null;
      currentLiteType = null;
      currentSessionDetailKey = null;
      updateContentTitle();
      renderCliManager();
    });
  });
}

// ========== CCW Installations ==========
async function loadCcwInstallations() {
  try {
    var response = await fetch('/api/ccw/installations');
    if (!response.ok) throw new Error('Failed to load CCW installations');
    var data = await response.json();
    ccwInstallations = data.installations || [];
    return ccwInstallations;
  } catch (err) {
    console.error('Failed to load CCW installations:', err);
    ccwInstallations = [];
    return [];
  }
}

// ========== Rendering ==========
async function renderCliManager() {
  var container = document.getElementById('mainContent');
  if (!container) return;

  // Hide stats grid and search for CLI view
  var statsGrid = document.getElementById('statsGrid');
  var searchInput = document.getElementById('searchInput');
  if (statsGrid) statsGrid.style.display = 'none';
  if (searchInput) searchInput.parentElement.style.display = 'none';

  // Load data
  await Promise.all([
    loadCliToolStatus(),
    loadCliHistory(),
    loadCcwInstallations()
  ]);

  container.innerHTML = '<div class="cli-manager-container">' +
    '<div class="cli-manager-grid">' +
    '<div class="cli-panel"><div id="cli-status-panel"></div></div>' +
    '<div class="cli-panel"><div id="ccw-install-panel"></div></div>' +
    '</div>' +
    '<div class="cli-panel cli-panel-full"><div id="cli-history-panel"></div></div>' +
    '</div>';

  // Render sub-panels
  renderCliStatus();
  renderCcwInstallPanel();
  renderCliHistory();

  // Initialize Lucide icons
  if (window.lucide) lucide.createIcons();
}

// CCW Install Carousel State
var ccwCarouselIndex = 0;

function renderCcwInstallPanel() {
  var container = document.getElementById('ccw-install-panel');
  if (!container) return;

  var html = '<div class="cli-status-header"><h3>CCW Installations</h3>' +
    '<div class="ccw-header-actions">' +
    '<button class="btn-icon" onclick="showCcwInstallModal()" title="Add Installation">' +
    '<i data-lucide="plus" class="w-4 h-4"></i></button>' +
    '<button class="btn-icon" onclick="loadCcwInstallations().then(function() { renderCcwInstallPanel(); })" title="Refresh">' +
    '<i data-lucide="refresh-cw" class="w-4 h-4"></i></button>' +
    '</div></div>' +
    '<div class="ccw-install-content">';

  if (ccwInstallations.length === 0) {
    html += '<div class="ccw-empty-state">' +
      '<i data-lucide="package-x" class="w-8 h-8"></i>' +
      '<p>No installations found</p>' +
      '<button class="btn btn-sm btn-primary" onclick="showCcwInstallModal()">' +
      '<i data-lucide="download" class="w-3 h-3"></i> Install CCW</button></div>';
  } else {
    // Carousel container
    html += '<div class="ccw-carousel-wrapper">';

    // Left arrow (show only if more than 1 installation)
    if (ccwInstallations.length > 1) {
      html += '<button class="ccw-carousel-btn ccw-carousel-prev" onclick="ccwCarouselPrev()" title="Previous">' +
        '<i data-lucide="chevron-left" class="w-4 h-4"></i></button>';
    }

    html += '<div class="ccw-carousel-track" id="ccwCarouselTrack">';

    for (var i = 0; i < ccwInstallations.length; i++) {
      var inst = ccwInstallations[i];
      var isGlobal = inst.installation_mode === 'Global';
      var modeIcon = isGlobal ? 'home' : 'folder';
      var version = inst.application_version || 'unknown';
      var installDate = new Date(inst.installation_date).toLocaleDateString();
      var activeClass = i === ccwCarouselIndex ? 'active' : '';

      html += '<div class="ccw-carousel-card ' + activeClass + '" data-index="' + i + '">' +
        '<div class="ccw-card-header">' +
        '<div class="ccw-card-mode ' + (isGlobal ? 'global' : 'path') + '">' +
        '<i data-lucide="' + modeIcon + '" class="w-4 h-4"></i>' +
        '<span>' + inst.installation_mode + '</span>' +
        '</div>' +
        '<span class="ccw-version-tag">v' + version + '</span>' +
        '</div>' +
        '<div class="ccw-card-path" title="' + inst.installation_path + '">' + escapeHtml(inst.installation_path) + '</div>' +
        '<div class="ccw-card-meta">' +
        '<span><i data-lucide="calendar" class="w-3 h-3"></i> ' + installDate + '</span>' +
        '<span><i data-lucide="file" class="w-3 h-3"></i> ' + (inst.files_count || 0) + ' files</span>' +
        '</div>' +
        '<div class="ccw-card-actions">' +
        '<button class="btn-icon" onclick="runCcwUpgrade()" title="Upgrade">' +
        '<i data-lucide="arrow-up-circle" class="w-4 h-4"></i></button>' +
        '<button class="btn-icon btn-danger" onclick="confirmCcwUninstall(\'' + escapeHtml(inst.installation_path) + '\')" title="Uninstall">' +
        '<i data-lucide="trash-2" class="w-4 h-4"></i></button>' +
        '</div>' +
        '</div>';
    }

    html += '</div>';

    // Right arrow (show only if more than 1 installation)
    if (ccwInstallations.length > 1) {
      html += '<button class="ccw-carousel-btn ccw-carousel-next" onclick="ccwCarouselNext()" title="Next">' +
        '<i data-lucide="chevron-right" class="w-4 h-4"></i></button>';
    }

    html += '</div>';

    // Dots indicator (show only if more than 1 installation)
    if (ccwInstallations.length > 1) {
      html += '<div class="ccw-carousel-dots">';
      for (var j = 0; j < ccwInstallations.length; j++) {
        var dotActive = j === ccwCarouselIndex ? 'active' : '';
        html += '<button class="ccw-carousel-dot ' + dotActive + '" onclick="ccwCarouselGoTo(' + j + ')"></button>';
      }
      html += '</div>';
    }
  }

  html += '</div>';
  container.innerHTML = html;
  if (window.lucide) lucide.createIcons();

  // Update carousel position
  updateCcwCarouselPosition();
}

function ccwCarouselPrev() {
  if (ccwCarouselIndex > 0) {
    ccwCarouselIndex--;
    updateCcwCarouselPosition();
    updateCcwCarouselDots();
  }
}

function ccwCarouselNext() {
  if (ccwCarouselIndex < ccwInstallations.length - 1) {
    ccwCarouselIndex++;
    updateCcwCarouselPosition();
    updateCcwCarouselDots();
  }
}

function ccwCarouselGoTo(index) {
  ccwCarouselIndex = index;
  updateCcwCarouselPosition();
  updateCcwCarouselDots();
}

function updateCcwCarouselPosition() {
  var track = document.getElementById('ccwCarouselTrack');
  if (track) {
    track.style.transform = 'translateX(-' + (ccwCarouselIndex * 100) + '%)';
  }

  // Update card active states
  var cards = document.querySelectorAll('.ccw-carousel-card');
  cards.forEach(function(card, idx) {
    card.classList.toggle('active', idx === ccwCarouselIndex);
  });
}

function updateCcwCarouselDots() {
  var dots = document.querySelectorAll('.ccw-carousel-dot');
  dots.forEach(function(dot, idx) {
    dot.classList.toggle('active', idx === ccwCarouselIndex);
  });
}

// CCW Install Modal
function showCcwInstallModal() {
  var modalContent = '<div class="ccw-install-modal">' +
    '<div class="ccw-install-options">' +
    '<div class="ccw-install-option" onclick="selectCcwInstallMode(\'Global\')">' +
    '<div class="ccw-option-icon global"><i data-lucide="home" class="w-6 h-6"></i></div>' +
    '<div class="ccw-option-info">' +
    '<div class="ccw-option-title">Global Installation</div>' +
    '<div class="ccw-option-desc">Install to user home directory (~/.claude)</div>' +
    '</div>' +
    '<i data-lucide="chevron-right" class="w-4 h-4 text-muted-foreground"></i>' +
    '</div>' +
    '<div class="ccw-install-option" onclick="toggleCcwPathInput()">' +
    '<div class="ccw-option-icon path"><i data-lucide="folder" class="w-6 h-6"></i></div>' +
    '<div class="ccw-option-info">' +
    '<div class="ccw-option-title">Path Installation</div>' +
    '<div class="ccw-option-desc">Install to a specific project folder</div>' +
    '</div>' +
    '<i data-lucide="chevron-right" class="w-4 h-4 text-muted-foreground"></i>' +
    '</div>' +
    '</div>' +
    '<div class="ccw-path-input-section hidden" id="ccwPathInputSection">' +
    '<div class="ccw-path-input-group">' +
    '<label>Installation Path</label>' +
    '<input type="text" id="ccwInstallPath" class="cli-textarea" placeholder="D:/projects/my-project" value="' + (projectPath || '') + '">' +
    '</div>' +
    '<div class="ccw-install-action">' +
    '<button class="btn btn-primary" onclick="executeCcwInstall()">' +
    '<i data-lucide="download" class="w-4 h-4"></i> Install to Path</button>' +
    '</div>' +
    '</div>' +
    '</div>';

  showModal('Install CCW', modalContent);
}

function selectCcwInstallMode(mode) {
  if (mode === 'Global') {
    closeModal();
    runCcwInstall('Global');
  }
}

function toggleCcwPathInput() {
  var section = document.getElementById('ccwPathInputSection');
  if (section) {
    section.classList.toggle('hidden');
    if (!section.classList.contains('hidden')) {
      var input = document.getElementById('ccwInstallPath');
      if (input) input.focus();
    }
  }
}

function executeCcwInstall() {
  var input = document.getElementById('ccwInstallPath');
  var path = input ? input.value.trim() : '';

  if (!path) {
    showRefreshToast('Please enter a path', 'error');
    return;
  }

  closeModal();
  runCcwInstall('Path', path);
}

function truncatePath(path) {
  if (!path) return '';
  var maxLen = 35;
  if (path.length <= maxLen) return path;
  return '...' + path.slice(-maxLen + 3);
}

function renderCliExecutePanel() {
  var container = document.getElementById('cli-execute-panel');
  if (!container) return;

  var tools = ['gemini', 'qwen', 'codex'];
  var modes = ['analysis', 'write', 'auto'];

  var html = '<div class="cli-execute-header"><h3>Quick Execute</h3></div>' +
    '<div class="cli-execute-form"><div class="cli-execute-row">' +
    '<div class="cli-form-group"><label for="cli-exec-tool">Tool</label>' +
    '<select id="cli-exec-tool" class="cli-select">';
  for (var i = 0; i < tools.length; i++) {
    var tool = tools[i];
    var selected = tool === defaultCliTool ? 'selected' : '';
    html += '<option value="' + tool + '" ' + selected + '>' + tool.charAt(0).toUpperCase() + tool.slice(1) + '</option>';
  }
  html += '</select></div>' +
    '<div class="cli-form-group"><label for="cli-exec-mode">Mode</label>' +
    '<select id="cli-exec-mode" class="cli-select">';
  for (var j = 0; j < modes.length; j++) {
    var mode = modes[j];
    var sel = mode === 'analysis' ? 'selected' : '';
    html += '<option value="' + mode + '" ' + sel + '>' + mode.charAt(0).toUpperCase() + mode.slice(1) + '</option>';
  }
  html += '</select></div></div>' +
    '<div class="cli-form-group"><label for="cli-exec-prompt">Prompt</label>' +
    '<textarea id="cli-exec-prompt" class="cli-textarea" placeholder="Enter your prompt..."></textarea></div>' +
    '<div class="cli-execute-actions">' +
    '<button class="btn btn-primary" onclick="executeCliFromDashboard()" ' + (currentCliExecution ? 'disabled' : '') + '>' +
    '<i data-lucide="play" class="w-4 h-4"></i> Execute</button></div></div>';
  container.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

// ========== CCW Actions ==========
function runCcwInstall(mode, customPath) {
  var command;
  if (mode === 'Global') {
    command = 'ccw install --mode Global';
  } else {
    var installPath = customPath || projectPath;
    command = 'ccw install --mode Path --path "' + installPath + '"';
  }

  // Copy command to clipboard
  if (navigator.clipboard) {
    navigator.clipboard.writeText(command).then(function() {
      showRefreshToast('Command copied: ' + command, 'success');
    }).catch(function() {
      showRefreshToast('Run: ' + command, 'info');
    });
  } else {
    showRefreshToast('Run: ' + command, 'info');
  }
}

function runCcwUpgrade() {
  var command = 'ccw upgrade';
  if (navigator.clipboard) {
    navigator.clipboard.writeText(command).then(function() {
      showRefreshToast('Command copied: ' + command, 'success');
    }).catch(function() {
      showRefreshToast('Run: ' + command, 'info');
    });
  } else {
    showRefreshToast('Run: ' + command, 'info');
  }
}

function confirmCcwUninstall(installPath) {
  if (confirm('Uninstall CCW from this location?\n' + (installPath || 'Current installation'))) {
    var command = installPath
      ? 'ccw uninstall --path "' + installPath + '"'
      : 'ccw uninstall';

    if (navigator.clipboard) {
      navigator.clipboard.writeText(command).then(function() {
        showRefreshToast('Command copied: ' + command, 'success');
      }).catch(function() {
        showRefreshToast('Run: ' + command, 'info');
      });
    } else {
      showRefreshToast('Run: ' + command, 'info');
    }
  }
}

// ========== Execution ==========
async function executeCliFromDashboard() {
  var toolEl = document.getElementById('cli-exec-tool');
  var modeEl = document.getElementById('cli-exec-mode');
  var promptEl = document.getElementById('cli-exec-prompt');

  var tool = toolEl ? toolEl.value : 'gemini';
  var mode = modeEl ? modeEl.value : 'analysis';
  var prompt = promptEl ? promptEl.value.trim() : '';

  if (!prompt) {
    showRefreshToast('Please enter a prompt', 'error');
    return;
  }

  currentCliExecution = { tool: tool, mode: mode, prompt: prompt, startTime: Date.now() };
  cliExecutionOutput = '';

  var outputPanel = document.getElementById('cli-output-panel');
  var outputContent = document.getElementById('cli-output-content');
  var statusIndicator = document.getElementById('cli-output-status-indicator');
  var statusText = document.getElementById('cli-output-status-text');

  if (outputPanel) outputPanel.classList.remove('hidden');
  if (outputContent) outputContent.textContent = '';
  if (statusIndicator) statusIndicator.className = 'status-indicator running';
  if (statusText) statusText.textContent = 'Running...';

  var execBtn = document.querySelector('.cli-execute-actions .btn-primary');
  if (execBtn) execBtn.disabled = true;

  try {
    var response = await fetch('/api/cli/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: tool, mode: mode, prompt: prompt, dir: projectPath })
    });
    var result = await response.json();

    if (statusIndicator) statusIndicator.className = 'status-indicator ' + (result.success ? 'success' : 'error');
    if (statusText) {
      var duration = formatDuration(result.execution ? result.execution.duration_ms : (Date.now() - currentCliExecution.startTime));
      statusText.textContent = result.success ? 'Completed in ' + duration : 'Failed: ' + (result.error || 'Unknown');
    }

    await loadCliHistory();
    renderCliHistory();
    showRefreshToast(result.success ? 'Completed' : (result.error || 'Failed'), result.success ? 'success' : 'error');
  } catch (error) {
    if (statusIndicator) statusIndicator.className = 'status-indicator error';
    if (statusText) statusText.textContent = 'Error: ' + error.message;
    showRefreshToast('Error: ' + error.message, 'error');
  }

  currentCliExecution = null;
  if (execBtn) execBtn.disabled = false;
}

// ========== WebSocket Event Handlers ==========
function handleCliExecutionStarted(payload) {
  currentCliExecution = {
    executionId: payload.executionId,
    tool: payload.tool,
    mode: payload.mode,
    startTime: new Date(payload.timestamp).getTime()
  };
  cliExecutionOutput = '';

  if (currentView === 'cli-manager') {
    var outputPanel = document.getElementById('cli-output-panel');
    var outputContent = document.getElementById('cli-output-content');
    var statusIndicator = document.getElementById('cli-output-status-indicator');
    var statusText = document.getElementById('cli-output-status-text');

    if (outputPanel) outputPanel.classList.remove('hidden');
    if (outputContent) outputContent.textContent = '';
    if (statusIndicator) statusIndicator.className = 'status-indicator running';
    if (statusText) statusText.textContent = 'Running ' + payload.tool + ' (' + payload.mode + ')...';
  }
}

function handleCliOutput(payload) {
  cliExecutionOutput += payload.data;
  var outputContent = document.getElementById('cli-output-content');
  if (outputContent) {
    outputContent.textContent = cliExecutionOutput;
    outputContent.scrollTop = outputContent.scrollHeight;
  }
}

function handleCliExecutionCompleted(payload) {
  var statusIndicator = document.getElementById('cli-output-status-indicator');
  var statusText = document.getElementById('cli-output-status-text');

  if (statusIndicator) statusIndicator.className = 'status-indicator ' + (payload.success ? 'success' : 'error');
  if (statusText) statusText.textContent = payload.success ? 'Completed in ' + formatDuration(payload.duration_ms) : 'Failed: ' + payload.status;

  currentCliExecution = null;
  if (currentView === 'cli-manager') {
    loadCliHistory().then(function() { renderCliHistory(); });
  }
}

function handleCliExecutionError(payload) {
  var statusIndicator = document.getElementById('cli-output-status-indicator');
  var statusText = document.getElementById('cli-output-status-text');

  if (statusIndicator) statusIndicator.className = 'status-indicator error';
  if (statusText) statusText.textContent = 'Error: ' + payload.error;

  currentCliExecution = null;
}
