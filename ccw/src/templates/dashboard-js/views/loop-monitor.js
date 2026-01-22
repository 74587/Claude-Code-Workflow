// ==========================================
// LOOP MONITOR VIEW
// ==========================================

// Loop state store for real-time updates
window.loopStateStore = {};
window.selectedLoopId = null;
window.loopWebSocket = null;
window.loopReconnectAttempts = 0;
window.loopMaxReconnectAttempts = 10;

// Status icons and keys (will be updated with i18n labels dynamically)
// Colors are now handled by CSS via semantic class names (.loop-status-indicator.{status})
const loopStatusConfig = {
  created: { icon: '○', key: 'created' },
  running: { icon: '●', key: 'running' },
  paused: { icon: '⏸', key: 'paused' },
  completed: { icon: '✓', key: 'completed' },
  failed: { icon: '✗', key: 'failed' }
};

// Get localized status label
function getLoopStatusLabel(status) {
  return t('loop.' + status) || status;
}

// Update status config with localized labels
function updateLoopStatusLabels() {
  for (const status in loopStatusConfig) {
    loopStatusConfig[status].label = getLoopStatusLabel(status);
  }
}

/**
 * Render Loop Monitor view
 */
async function renderLoopMonitor() {
  try {
    // Update status labels with current language
    updateLoopStatusLabels();

    // Hide stats and carousel if function exists
    if (typeof hideStatsAndCarousel === 'function') {
      hideStatsAndCarousel();
    }

    const container = document.getElementById('mainContent');
    if (!container) {
      console.error('Main content container not found');
      return;
    }
  container.innerHTML = `
    <div class="loop-monitor-container">
      <div class="loop-monitor-layout">
        <!-- Loop List -->
        <div class="loop-list-panel">
          <!-- Row 1: Tabs + New Button -->
          <div class="panel-header-row">
            <div class="view-tabs">
              <button class="tab-button active" data-tab="loops" onclick="switchView('loops')">
                <i data-lucide="activity" class="w-4 h-4"></i> ${t('loop.loops')}
              </button>
              <button class="tab-button" data-tab="tasks" onclick="switchView('tasks')">
                <i data-lucide="list" class="w-4 h-4"></i> ${t('loop.tasks')}
              </button>
            </div>
            <button class="btn btn-primary btn-sm" onclick="showCreateLoopModal()" title="Create new loop task">
              <i data-lucide="plus" class="w-4 h-4"></i> ${t('loop.newLoop')}
            </button>
          </div>

          <!-- Row 2: Filter -->
          <div class="panel-filter-row">
            <select id="loopFilter" class="filter-select" onchange="filterLoops()">
              <option value="all">${t('loop.all')}</option>
              <option value="running">${t('loop.running')}</option>
              <option value="paused">${t('loop.paused')}</option>
              <option value="completed">${t('loop.completed')}</option>
              <option value="failed">${t('loop.failed')}</option>
            </select>
          </div>

          <!-- Row 3: Loop List -->
          <div class="loop-list" id="loopList">
            <div class="loading-spinner">${t('loop.loading')}</div>
          </div>
        </div>

        <!-- Loop Detail -->
        <div class="loop-detail-panel" id="loopDetailPanel">
          <div class="empty-detail-state">
            <div class="empty-icon-large">
              <i data-lucide="activity" class="w-10 h-10"></i>
            </div>
            <p class="empty-state-title">${t('loop.selectLoop')}</p>
            <p class="empty-state-hint">${t('loop.selectLoopHint')}</p>
          </div>
        </div>
      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Initialize WebSocket connection (with error handling)
  try {
    initLoopWebSocket();
  } catch (err) {
    console.error('Failed to initialize WebSocket:', err);
  }

  // Load loops (with error handling)
  try {
    await loadLoops();
  } catch (err) {
    console.error('Failed to load loops:', err);
    showError(t('loop.failedToLoad') + ': ' + (err.message || String(err)));
  }
  } catch (err) {
    console.error('Failed to render Loop Monitor:', err);
    showError('Failed to render Loop Monitor: ' + (err.message || String(err)));
  }
}

/**
 * Initialize WebSocket for real-time updates
 */
function initLoopWebSocket() {
  // Check max reconnect attempts
  if (window.loopReconnectAttempts >= window.loopMaxReconnectAttempts) {
    console.warn('Loop WebSocket max reconnection attempts reached, giving up');
    return;
  }

  if (window.loopWebSocket) {
    window.loopWebSocket.close();
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  try {
    window.loopWebSocket = new WebSocket(wsUrl);

    window.loopWebSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'LOOP_STATE_UPDATE' ||
            data.type === 'LOOP_STEP_COMPLETED' ||
            data.type === 'LOOP_COMPLETED') {
          handleLoopUpdate(data);
        }
      } catch (err) {
        console.error('WebSocket message parse error:', err);
      }
    };

    window.loopWebSocket.onopen = () => {
      console.log('Loop WebSocket connected');
      window.loopReconnectAttempts = 0; // Reset on successful connection
    };

    window.loopWebSocket.onerror = (err) => {
      console.error('Loop WebSocket error:', err);
    };

    window.loopWebSocket.onclose = () => {
      window.loopReconnectAttempts++;
      console.log('Loop WebSocket closed, reconnecting in 5s... (attempt ' + window.loopReconnectAttempts + '/' + window.loopMaxReconnectAttempts + ')');
      setTimeout(initLoopWebSocket, 5000);
    };
  } catch (err) {
    console.error('Failed to create WebSocket:', err);
  }
}

/**
 * Handle real-time loop update
 */
function handleLoopUpdate(data) {
  const loop = data.data;
  if (!loop || !loop.loop_id) return;

  // Update store
  window.loopStateStore[loop.loop_id] = loop;

  // Re-render
  renderLoopList();
  if (window.selectedLoopId === loop.loop_id) {
    renderLoopDetail(loop.loop_id);
  }
}

/**
 * Load all loops from API (both v1 and v2)
 */
async function loadLoops() {
  try {
    // Fetch v2 loops (new simplified format)
    const v2Response = await fetch('/api/loops/v2');
    const v2Result = await v2Response.json();

    if (v2Result.success && v2Result.data) {
      v2Result.data.forEach(loop => {
        window.loopStateStore[loop.loop_id] = loop;
      });
    }

    // Fetch v1 loops (legacy format with task_id)
    const v1Response = await fetch('/api/loops');
    const v1Result = await v1Response.json();

    if (v1Result.success && v1Result.data) {
      v1Result.data.forEach(loop => {
        window.loopStateStore[loop.loop_id] = loop;
      });
    }

    const loopCount = Object.keys(window.loopStateStore).length;

    // If no active loops, check for tasks and show tasks tab instead
    if (loopCount === 0) {
      await showTasksTabIfAny();
    } else {
      renderLoopList();
    }
  } catch (err) {
    console.error('Load loops error:', err);
    showError(t('loop.failedToLoad') + ': ' + err.message);
  }
}

/**
 * Show tasks tab if there are any loop-enabled tasks
 */
async function showTasksTabIfAny() {
  try {
    const response = await fetch('/api/tasks');
    const result = await response.json();

    if (result.success) {
      const tasks = result.data || [];
      const loopEnabledTasks = tasks.filter(t => t.loop_control && t.loop_control.enabled);

      // Only show tasks tab if there are loop-enabled tasks
      if (loopEnabledTasks.length > 0) {
        await showTasksTab();
      } else {
        // No loops and no tasks, show empty state
        renderLoopList();
      }
    } else {
      renderLoopList();
    }
  } catch (err) {
    console.error('Check tasks error:', err);
    renderLoopList();
  }
}

/**
 * Render loop list
 */
function renderLoopList() {
  const container = document.getElementById('loopList');
  if (!container) return;

  const filter = document.getElementById('loopFilter')?.value || 'all';
  const loops = Object.values(window.loopStateStore);

  const filteredLoops = loops.filter(loop => {
    if (filter === 'all') return true;
    return loop.status === filter;
  });

  if (filteredLoops.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i data-lucide="inbox" class="w-6 h-6"></i>
        </div>
        <p class="empty-state-title">${t('loop.noLoops')}</p>
        <p class="empty-state-hint">${t('loop.noLoopsHint')}</p>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  container.innerHTML = filteredLoops.map(loop => renderLoopCard(loop)).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Render single loop card
 */
function renderLoopCard(loop) {
  const config = loopStatusConfig[loop.status] || loopStatusConfig.created;
  const isSelected = window.selectedLoopId === loop.loop_id;

  const progress = loop.max_iterations > 0
    ? Math.round((loop.current_iteration / loop.max_iterations) * 100)
    : 0;

  // Lucide icons for each status
  const statusIcons = {
    created: 'inbox',
    running: 'zap',
    paused: 'pause',
    completed: 'check',
    failed: 'alert-triangle'
  };

  // Check if this is a v2 loop (has title field) or v1 loop (has task_id field)
  const isV2 = loop.hasOwnProperty('title');
  const displayTitle = isV2 ? (loop.title || loop.loop_id) : loop.loop_id;
  const displaySubtitle = isV2 ? (loop.description || '') : (loop.task_id || 'N/A');

  // v1 loops have current_cli_step and cli_sequence, v2 loops don't
  const hasStepInfo = loop.hasOwnProperty('current_cli_step') && loop.cli_sequence;
  const stepInfo = hasStepInfo
    ? `<div class="loop-step-info">
        <i data-lucide="git-commit" class="w-3 h-3"></i> ${loop.current_cli_step + 1}/${loop.cli_sequence?.length || 0}
       </div>`
    : '';

  return `
    <div class="loop-card status-${loop.status} ${isSelected ? 'selected' : ''}"
         onclick="selectLoop('${loop.loop_id}')">
      <div class="loop-card-header">
        <span class="loop-status-indicator ${loop.status}">
          <i data-lucide="${statusIcons[loop.status] || 'circle'}" class="w-4 h-4"></i>
        </span>
        <span class="loop-title">${escapeHtml(displayTitle)}</span>
      </div>
      <div class="loop-card-body">
        ${displaySubtitle ? `<div class="loop-description">${escapeHtml(displaySubtitle).substring(0, 60)}${displaySubtitle.length > 60 ? '...' : ''}</div>` : ''}
        <div class="loop-meta">
          <span class="loop-status-text">${config.label}</span>
        </div>
        <div class="loop-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
          <span class="progress-text">${loop.current_iteration}/${loop.max_iterations} (${progress}%)</span>
        </div>
        ${stepInfo}
        <div class="loop-time">
          <i data-lucide="clock" class="w-3 h-3"></i> ${formatRelativeTime(loop.updated_at)}
        </div>
      </div>
    </div>
  `;
}

/**
 * Select and show loop detail
 */
function selectLoop(loopId) {
  window.selectedLoopId = loopId;
  renderLoopList(); // Re-render to update selection
  renderLoopDetail(loopId);
}

/**
 * Render loop detail panel
 */
function renderLoopDetail(loopId) {
  const container = document.getElementById('loopDetailPanel');
  const loop = window.loopStateStore[loopId];

  if (!loop) {
    container.innerHTML = `
      <div class="empty-detail-state">
        <div class="empty-icon-large">
          <i data-lucide="alert-circle" class="w-10 h-10"></i>
        </div>
        <p class="empty-state-title">${t('loop.loopNotFound')}</p>
        <p class="empty-state-hint">${t('loop.selectAnotherLoop')}</p>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  const config = loopStatusConfig[loop.status] || loopStatusConfig.created;
  const iterProgress = loop.max_iterations > 0
    ? Math.round((loop.current_iteration / loop.max_iterations) * 100)
    : 0;

  // Check if this is a v2 loop (has title field) or v1 loop (has task_id field)
  const isV2 = loop.hasOwnProperty('title');
  const displayTitle = isV2 ? (loop.title || loop.loop_id) : loop.loop_id;
  const hasStepInfo = loop.hasOwnProperty('current_cli_step') && loop.cli_sequence;
  const stepProgress = hasStepInfo && loop.cli_sequence.length > 0
    ? Math.round(((loop.current_cli_step + 1) / loop.cli_sequence.length) * 100)
    : 0;

  container.innerHTML = `
    <div class="loop-detail">
      <!-- Header -->
      <div class="detail-header">
        <div class="detail-status ${loop.status}">
          <i data-lucide="${getStatusIcon(loop.status)}" class="w-4 h-4"></i>
          <span class="status-label">${config.label}</span>
          ${isV2 ? '<span class="version-badge">v2</span>' : '<span class="version-badge">v1</span>'}
        </div>
        <div class="detail-actions">
          ${loop.status === 'running' ? `
            <button class="btn btn-warning" onclick="pauseLoop('${loop.loop_id}')">
              <i data-lucide="pause" class="w-4 h-4"></i> ${t('loop.pause')}
            </button>
          ` : ''}
          ${loop.status === 'paused' ? `
            <button class="btn btn-success" onclick="resumeLoop('${loop.loop_id}')">
              <i data-lucide="play" class="w-4 h-4"></i> ${t('loop.resume')}
            </button>
          ` : ''}
          ${loop.status === 'created' ? `
            <button class="btn btn-success" onclick="startLoopV2('${loop.loop_id}')">
              <i data-lucide="play" class="w-4 h-4"></i> ${t('loop.start')}
            </button>
          ` : ''}
          ${(loop.status === 'running' || loop.status === 'paused' || loop.status === 'created') ? `
            <button class="btn btn-danger" onclick="confirmStopLoop('${loop.loop_id}')">
              <i data-lucide="stop-circle" class="w-4 h-4"></i> ${t('loop.stop')}
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Info -->
      <div class="detail-info">
        <h3 class="detail-title">${escapeHtml(displayTitle)}</h3>
        ${loop.description ? `<p class="detail-description">${escapeHtml(loop.description)}</p>` : ''}
        <div class="detail-meta">
          <span><i data-lucide="calendar" class="w-4 h-4"></i> ${t('loop.created')}: ${formatDateTime(loop.created_at)}</span>
          <span><i data-lucide="clock" class="w-4 h-4"></i> ${t('loop.updated')}: ${formatRelativeTime(loop.updated_at)}</span>
          ${loop.task_id ? `<span><i data-lucide="list-tree" class="w-4 h-4"></i> ${escapeHtml(loop.task_id)}</span>` : ''}
          <span><i data-lucide="hash" class="w-4 h-4"></i> ${escapeHtml(loop.loop_id)}</span>
        </div>
      </div>

      <!-- Progress -->
      <div class="detail-section">
        <h4><i data-lucide="trending-up" class="w-4 h-4"></i> ${t('loop.progress')}</h4>
        <div class="progress-group">
          <div class="progress-item">
            <label><i data-lucide="repeat" class="w-3 h-3"></i> ${t('loop.iteration')}</label>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${iterProgress}%"></div>
            </div>
            <span class="progress-text">${loop.current_iteration}/${loop.max_iterations} (${iterProgress}%)</span>
          </div>
          ${hasStepInfo ? `
            <div class="progress-item">
              <label><i data-lucide="git-commit" class="w-3 h-3"></i> ${t('loop.currentStep')}</label>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${stepProgress}%"></div>
              </div>
              <span class="progress-text">${loop.current_cli_step + 1}/${loop.cli_sequence?.length || 0}</span>
            </div>
          ` : ''}
        </div>
      </div>

      ${hasStepInfo ? `
        <!-- CLI Sequence (v1 only) -->
        <div class="detail-section">
          <h4><i data-lucide="list-ordered" class="w-4 h-4"></i> ${t('loop.cliSequence')}</h4>
          <div class="cli-sequence">
            ${(loop.cli_sequence || []).map((step, index) => {
              const isCurrent = index === loop.current_cli_step;
              const isPast = index < loop.current_cli_step;
              const stepStatus = isCurrent ? 'current' : (isPast ? 'completed' : 'pending');

              return `
                <div class="cli-step ${stepStatus}">
                  <div class="step-marker">${isPast ? '<i data-lucide="check" class="w-3 h-3"></i>' : (isCurrent ? '<i data-lucide="circle-dot" class="w-3 h-3"></i>' : index + 1)}</div>
                  <div class="step-content">
                    <div class="step-name">${escapeHtml(step.tool || 'unknown')}</div>
                    <div class="step-prompt">${escapeHtml(step.prompt?.substring(0, 100) || '')}${step.prompt?.length > 100 ? '...' : ''}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : `
        <!-- V2 Loop Info -->
        <div class="detail-section">
          <h4><i data-lucide="info" class="w-4 h-4"></i> ${t('loop.loopInfo') || 'Loop Info'}</h4>
          <div class="info-box">
            <p>${t('loop.v2LoopInfo') || 'This is a simplified loop. Tasks are managed independently in the detail view.'}</p>
            <button class="btn btn-primary mt-2" onclick="showLoopTasks('${loop.loop_id}')">
              <i data-lucide="list" class="w-4 h-4"></i> ${t('loop.manageTasks') || 'Manage Tasks'}
            </button>
          </div>
        </div>
      `}

      <!-- Variables -->
      ${Object.keys(loop.state_variables || {}).length > 0 ? `
        <div class="detail-section">
          <h4><i data-lucide="database" class="w-4 h-4"></i> ${t('loop.stateVariables')}</h4>
          <div class="variables-grid">
            ${Object.entries(loop.state_variables || {}).map(([key, value]) => `
              <div class="variable-item">
                <span class="variable-key">${escapeHtml(key)}</span>
                <span class="variable-value">${escapeHtml(value)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Execution History -->
      ${(loop.execution_history?.length || 0) > 0 ? `
        <div class="detail-section">
          <h4><i data-lucide="history" class="w-4 h-4"></i> ${t('loop.executionHistory')}</h4>
          <div class="execution-timeline">
            ${renderExecutionTimeline(loop)}
          </div>
        </div>
      ` : ''}

      <!-- Error -->
      ${loop.failure_reason ? `
        <div class="detail-section error-section">
          <h4><i data-lucide="alert-triangle" class="w-4 h-4"></i> ${t('loop.failureReason')}</h4>
          <div class="error-message">${escapeHtml(loop.failure_reason)}</div>
        </div>
      ` : ''}
    </div>
  `;

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Render execution timeline
 */
function renderExecutionTimeline(loop) {
  const history = loop.execution_history || [];
  const sequence = loop.cli_sequence || [];

  // Group by iteration
  const iterations = {};
  history.forEach(record => {
    if (!iterations[record.iteration]) {
      iterations[record.iteration] = [];
    }
    iterations[record.iteration].push(record);
  });

  return Object.entries(iterations)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([iter, records]) => {
      const isCurrent = parseInt(iter) === loop.current_iteration;
      return `
        <div class="timeline-iteration ${isCurrent ? 'current' : 'completed'}">
          <div class="iteration-header">
            <span class="iteration-marker">${isCurrent ? '<i data-lucide="circle-dot" class="w-4 h-4"></i>' : '<i data-lucide="check-circle-2" class="w-4 h-4"></i>'}</span>
            <span>${t('loop.iteration')} ${iter}</span>
          </div>
          <div class="iteration-steps">
            ${records.map(record => `
              <div class="timeline-step">
                <div class="step-status ${record.success ? 'success' : 'failed'}">
                  ${record.success ? '<i data-lucide="check" class="w-3 h-3"></i>' : '<i data-lucide="x" class="w-3 h-3"></i>'}
                </div>
                <div class="step-info">
                  <div class="step-tool">${escapeHtml(sequence[record.step_index]?.tool || 'unknown')}</div>
                  <div class="step-time"><i data-lucide="clock" class="w-3 h-3"></i> ${formatDateTime(record.started_at)}</div>
                  <div class="step-duration"><i data-lucide="timer" class="w-3 h-3"></i> ${record.duration_ms}ms</div>
                  ${!record.success && record.error ? `
                    <div class="step-error"><i data-lucide="alert-circle" class="w-3 h-3"></i> ${escapeHtml(record.error)}</div>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
}

/**
 * Filter loops by status
 */
function filterLoops() {
  renderLoopList();
}

/**
 * Pause loop (v1 or v2)
 */
async function pauseLoop(loopId) {
  const loop = window.loopStateStore[loopId];
  const isV2 = loop && loop.hasOwnProperty('title');
  const endpoint = isV2 ? `/api/loops/v2/${loopId}/pause` : `/api/loops/${loopId}/pause`;

  try {
    const response = await fetch(endpoint, { method: 'POST' });
    const result = await response.json();

    if (result.success) {
      showNotification(t('loop.loopPaused'), 'success');
      await loadLoops();
    } else {
      showError(t('loop.failedToPause') + ': ' + (result.error || t('common.error')));
    }
  } catch (err) {
    console.error('Pause loop error:', err);
    showError(t('loop.failedToPause') + ': ' + err.message);
  }
}

/**
 * Resume loop (v1 or v2)
 */
async function resumeLoop(loopId) {
  const loop = window.loopStateStore[loopId];
  const isV2 = loop && loop.hasOwnProperty('title');
  const endpoint = isV2 ? `/api/loops/v2/${loopId}/resume` : `/api/loops/${loopId}/resume`;

  try {
    const response = await fetch(endpoint, { method: 'POST' });
    const result = await response.json();

    if (result.success) {
      showNotification(t('loop.loopResumed'), 'success');
      await loadLoops();
    } else {
      showError(t('loop.failedToResume') + ': ' + (result.error || t('common.error')));
    }
  } catch (err) {
    console.error('Resume loop error:', err);
    showError(t('loop.failedToResume') + ': ' + err.message);
  }
}

/**
 * Confirm and stop loop
 */
function confirmStopLoop(loopId) {
  const loop = window.loopStateStore[loopId];
  if (!loop) return;

  const message = t('loop.confirmStop', {
    loopId: loopId,
    currentIteration: loop.current_iteration,
    maxIterations: loop.max_iterations
  });

  if (confirm(message)) {
    stopLoop(loopId);
  }
}

/**
 * Stop loop (v1 or v2)
 */
async function stopLoop(loopId) {
  const loop = window.loopStateStore[loopId];
  const isV2 = loop && loop.hasOwnProperty('title');
  const endpoint = isV2 ? `/api/loops/v2/${loopId}/stop` : `/api/loops/${loopId}/stop`;

  try {
    const response = await fetch(endpoint, { method: 'POST' });
    const result = await response.json();

    if (result.success) {
      showNotification(t('loop.loopStopped'), 'success');
      await loadLoops();
    } else {
      showError(t('loop.failedToStop') + ': ' + (result.error || t('common.error')));
    }
  } catch (err) {
    console.error('Stop loop error:', err);
    showError(t('loop.failedToStop') + ': ' + err.message);
  }
}

/**
 * Start loop (v2 only)
 */
async function startLoopV2(loopId) {
  try {
    const response = await fetch(`/api/loops/v2/${loopId}/start`, { method: 'POST' });
    const result = await response.json();

    if (result.success) {
      showNotification(t('loop.loopStarted') || 'Loop started', 'success');
      await loadLoops();
    } else {
      showError(t('loop.failedToStart') + ': ' + (result.error || t('common.error')));
    }
  } catch (err) {
    console.error('Start loop error:', err);
    showError(t('loop.failedToStart') + ': ' + err.message);
  }
}

// ==========================================
// TASK MANAGEMENT FOR V2 LOOPS
// ==========================================

// Task drag state
const taskDragState = {
  dragging: null,
  loopId: null
};

/**
 * Show loop tasks (v2 task management)
 * Displays the task list for a v2 loop with add/edit/delete/reorder functionality
 */
async function showLoopTasks(loopId) {
  const container = document.getElementById('loopDetailPanel');
  const loop = window.loopStateStore[loopId];

  if (!loop) return;

  // Set current loop ID for task operations
  window.currentLoopId = loopId;

  container.innerHTML = `
    <div class="loop-detail">
      <div class="detail-header">
        <div class="detail-status active">
          <i data-lucide="list" class="w-4 h-4"></i>
          <span class="status-label">${t('loop.tasks') || 'Tasks'}</span>
        </div>
        <div class="detail-actions">
          <button class="btn btn-success" onclick="showAddTaskModal('${loopId}')" title="${t('loop.addTask') || 'Add Task'}">
            <i data-lucide="plus" class="w-4 h-4"></i> ${t('loop.addTask') || 'Add Task'}
          </button>
          <button class="btn btn-secondary" onclick="selectLoop('${loopId}')">
            <i data-lucide="arrow-left" class="w-4 h-4"></i> ${t('loop.back') || 'Back'}
          </button>
        </div>
      </div>
      <div class="detail-section">
        <div class="tasks-list-header">
          <h4><i data-lucide="layers" class="w-4 h-4"></i> ${t('loop.taskList') || 'Task List'}</h4>
          <span class="text-sm text-gray-500" id="taskCount">${t('loop.loading') || 'Loading...'}</span>
        </div>
        <div id="loopTasksList" class="task-list">
          <div class="loading-spinner">${t('loop.loading') || 'Loading...'}</div>
        </div>
      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Load tasks
  await loadLoopTasks(loopId);
}

/**
 * Load tasks for a loop from the v2 API
 */
async function loadLoopTasks(loopId) {
  const container = document.getElementById('loopTasksList');
  const countEl = document.getElementById('taskCount');

  if (!container) return;

  try {
    const response = await fetch(`/api/loops/v2/${encodeURIComponent(loopId)}/tasks`);
    const result = await response.json();

    if (!result.success) {
      container.innerHTML = `
        <div class="task-list-empty">
          <i data-lucide="alert-circle" class="w-8 h-8"></i>
          <p>${t('loop.loadTasksFailed') || 'Failed to load tasks'}</p>
          <p class="text-sm text-gray-500">${result.error || ''}</p>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    const tasks = result.data || [];

    // Update count
    if (countEl) {
      countEl.textContent = `${tasks.length} ${t('loop.tasks') || 'tasks'}`;
    }

    if (tasks.length === 0) {
      container.innerHTML = `
        <div class="task-list-empty">
          <i data-lucide="layers" class="w-8 h-8"></i>
          <p class="empty-state-title">${t('loop.noTasksYet') || 'No tasks yet'}</p>
          <p class="empty-state-hint">${t('loop.noTasksHint') || 'Add your first task to get started'}</p>
          <button class="btn btn-primary mt-3" onclick="showAddTaskModal('${loopId}')">
            <i data-lucide="plus" class="w-4 h-4"></i> ${t('loop.addTask') || 'Add Task'}
          </button>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    // Render tasks
    container.innerHTML = tasks.map(task => renderTaskItem(task)).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Initialize drag-drop
    initTaskDragDrop();

  } catch (err) {
    console.error('Load loop tasks error:', err);
    container.innerHTML = `
      <div class="task-list-empty">
        <i data-lucide="alert-circle" class="w-8 h-8"></i>
        <p>${t('loop.loadTasksError') || 'Error loading tasks'}</p>
        <p class="text-sm text-gray-500">${err.message}</p>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

/**
 * Render a single task item in the list
 */
function renderTaskItem(task) {
  const statusBadges = {
    analysis: '<span class="task-status-badge status-analysis">analysis</span>',
    write: '<span class="task-status-badge status-write">write</span>',
    review: '<span class="task-status-badge status-review">review</span>'
  };

  const modeBadge = statusBadges[task.mode] || `<span class="task-status-badge">${task.mode || 'unknown'}</span>`;
  const toolBadge = `<span class="task-tool-badge">${task.tool || 'gemini'}</span>`;

  return `
    <div class="task-item" draggable="true" data-task-id="${task.task_id || task.id}">
      <div class="task-item-drag">
        <i data-lucide="grip-vertical" class="w-4 h-4"></i>
      </div>
      <div class="task-item-content">
        <div class="task-item-header">
          <span class="task-item-description">${escapeHtml(task.description || t('loop.noDescription') || 'No description')}</span>
        </div>
        <div class="task-item-meta">
          ${toolBadge}
          ${modeBadge}
        </div>
      </div>
      <div class="task-item-actions">
        <button class="btn btn-sm btn-secondary" onclick="editTask('${task.task_id || task.id}')" title="${t('loop.edit') || 'Edit'}">
          <i data-lucide="edit-2" class="w-3 h-3"></i>
        </button>
        <button class="btn btn-sm btn-danger" onclick="confirmDeleteTask('${task.task_id || task.id}')" title="${t('loop.delete') || 'Delete'}">
          <i data-lucide="trash-2" class="w-3 h-3"></i>
        </button>
      </div>
    </div>
  `;
}

/**
 * Initialize drag-drop for task list
 */
function initTaskDragDrop() {
  const items = document.querySelectorAll('.task-item[draggable="true"]');

  items.forEach(item => {
    item.addEventListener('dragstart', handleTaskDragStart);
    item.addEventListener('dragend', handleTaskDragEnd);
    item.addEventListener('dragover', handleTaskDragOver);
    item.addEventListener('drop', handleTaskDrop);
  });
}

function handleTaskDragStart(e) {
  const item = e.target.closest('.task-item');
  if (!item) return;

  taskDragState.dragging = item.dataset.taskId;
  taskDragState.loopId = window.currentLoopId;

  item.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', item.dataset.taskId);
}

function handleTaskDragEnd(e) {
  const item = e.target.closest('.task-item');
  if (item) {
    item.classList.remove('dragging');
  }
  taskDragState.dragging = null;
  taskDragState.loopId = null;
}

function handleTaskDragOver(e) {
  e.preventDefault();

  const target = e.target.closest('.task-item');
  if (!target || target.dataset.taskId === taskDragState.dragging) return;

  e.dataTransfer.dropEffect = 'move';
}

function handleTaskDrop(e) {
  e.preventDefault();

  const target = e.target.closest('.task-item');
  if (!target || !taskDragState.dragging) return;

  const container = target.closest('.task-list');
  if (!container) return;

  // Get new order
  const items = Array.from(container.querySelectorAll('.task-item'));
  const draggedItem = items.find(i => i.dataset.taskId === taskDragState.dragging);
  const targetIndex = items.indexOf(target);
  const draggedIndex = items.indexOf(draggedItem);

  if (draggedIndex === targetIndex) return;

  // Reorder in DOM
  if (draggedIndex < targetIndex) {
    target.after(draggedItem);
  } else {
    target.before(draggedItem);
  }

  // Get new order and save
  const newOrder = Array.from(container.querySelectorAll('.task-item')).map(i => i.dataset.taskId);
  saveTaskOrder(taskDragState.loopId, newOrder);
}

/**
 * Save new task order to the API
 */
async function saveTaskOrder(loopId, newOrder) {
  try {
    const response = await fetch(`/api/loops/v2/${encodeURIComponent(loopId)}/tasks/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ordered_task_ids: newOrder })
    });

    if (!response.ok) {
      throw new Error('Failed to save task order');
    }

    const result = await response.json();
    if (result.error) {
      showNotification(result.error, 'error');
    } else {
      showNotification(t('loop.tasksReordered') || 'Tasks reordered', 'success');
      // Reload to reflect changes
      await loadLoopTasks(loopId);
    }
  } catch (err) {
    console.error('Failed to save task order:', err);
    showNotification(t('loop.saveOrderFailed') || 'Failed to save order', 'error');
    // Reload to restore original order
    await loadLoopTasks(loopId);
  }
}

/**
 * Show add task modal
 */
async function showAddTaskModal(loopId) {
  const modal = document.createElement('div');
  modal.id = 'addTaskModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3><i data-lucide="plus-circle" class="w-5 h-5"></i> ${t('loop.addTask') || 'Add Task'}</h3>
        <button class="modal-close" onclick="closeTaskModal()">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      <div class="modal-body">
        <form id="addTaskForm" onsubmit="handleAddTask(event, '${loopId}')">
          <div id="addTaskError" class="alert alert-error" style="display: none;"></div>

          <!-- Description -->
          <div class="form-group">
            <label for="taskDescription">${t('loop.taskDescription') || 'Task Description'} <span class="required">*</span></label>
            <textarea id="taskDescription" name="description" rows="3" required
                      placeholder="${t('loop.taskDescriptionPlaceholder') || 'Describe what this task should do...'}"
                      class="form-control"></textarea>
          </div>

          <!-- Tool -->
          <div class="form-group">
            <label for="taskTool">${t('loop.tool') || 'Tool'}</label>
            <select id="taskTool" name="tool" class="form-control">
              <option value="gemini">Gemini</option>
              <option value="qwen">Qwen</option>
              <option value="codex">Codex</option>
              <option value="claude">Claude</option>
            </select>
          </div>

          <!-- Mode -->
          <div class="form-group">
            <label for="taskMode">${t('loop.mode') || 'Mode'}</label>
            <select id="taskMode" name="mode" class="form-control">
              <option value="analysis">${t('loop.modeAnalysis') || 'Analysis'}</option>
              <option value="write">${t('loop.modeWrite') || 'Write'}</option>
              <option value="review">${t('loop.modeReview') || 'Review'}</option>
            </select>
          </div>

          <!-- Form Actions -->
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeTaskModal()">${t('loop.cancel') || 'Cancel'}</button>
            <button type="submit" class="btn btn-primary">
              <i data-lucide="plus" class="w-4 h-4"></i> ${t('loop.add') || 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Focus on description field
  setTimeout(() => document.getElementById('taskDescription').focus(), 100);
}

/**
 * Close task modal
 */
function closeTaskModal() {
  const modal = document.getElementById('addTaskModal') || document.getElementById('editTaskModal');
  if (modal) {
    modal.remove();
  }
}

/**
 * Handle add task form submission
 */
async function handleAddTask(event, loopId) {
  event.preventDefault();

  const form = event.target;
  const errorDiv = document.getElementById('addTaskError');

  // Clear previous errors
  if (errorDiv) {
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';
  }

  // Get form values
  const description = form.description.value.trim();
  const tool = form.tool.value;
  const mode = form.mode.value;

  // Client-side validation
  if (!description) {
    if (errorDiv) {
      errorDiv.textContent = t('loop.descriptionRequired') || 'Description is required';
      errorDiv.style.display = 'block';
    }
    return;
  }

  try {
    // Call POST /api/loops/v2/:loopId/tasks
    const response = await fetch(`/api/loops/v2/${encodeURIComponent(loopId)}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: description,
        tool: tool,
        mode: mode
      })
    });

    const result = await response.json();

    if (result.success) {
      showNotification(t('loop.taskAdded') || 'Task added successfully', 'success');
      closeTaskModal();
      // Reload tasks
      await loadLoopTasks(loopId);
    } else {
      if (errorDiv) {
        errorDiv.textContent = result.error || (t('loop.addTaskFailed') || 'Failed to add task');
        errorDiv.style.display = 'block';
      }
    }
  } catch (err) {
    console.error('Add task error:', err);
    if (errorDiv) {
      errorDiv.textContent = err.message || (t('loop.addTaskFailed') || 'Failed to add task');
      errorDiv.style.display = 'block';
    }
  }
}

/**
 * Edit existing task
 */
async function editTask(taskId) {
  const loopId = window.currentLoopId;
  if (!loopId) return;

  // Fetch task details
  try {
    const response = await fetch(`/api/loops/v2/tasks/${encodeURIComponent(taskId)}`);
    const result = await response.json();

    if (!result.success || !result.data) {
      showNotification(t('loop.loadTaskFailed') || 'Failed to load task', 'error');
      return;
    }

    const task = result.data;
    showEditTaskModal(loopId, task);
  } catch (err) {
    console.error('Load task error:', err);
    showNotification(t('loop.loadTaskError') || 'Error loading task', 'error');
  }
}

/**
 * Show edit task modal
 */
function showEditTaskModal(loopId, task) {
  const modal = document.createElement('div');
  modal.id = 'editTaskModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3><i data-lucide="edit-2" class="w-5 h-5"></i> ${t('loop.editTask') || 'Edit Task'}</h3>
        <button class="modal-close" onclick="closeTaskModal()">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      <div class="modal-body">
        <form id="editTaskForm" onsubmit="handleEditTask(event, '${loopId}', '${task.task_id || task.id}')">
          <div id="editTaskError" class="alert alert-error" style="display: none;"></div>

          <!-- Description -->
          <div class="form-group">
            <label for="editTaskDescription">${t('loop.taskDescription') || 'Task Description'} <span class="required">*</span></label>
            <textarea id="editTaskDescription" name="description" rows="3" required
                      class="form-control">${escapeHtml(task.description || '')}</textarea>
          </div>

          <!-- Tool -->
          <div class="form-group">
            <label for="editTaskTool">${t('loop.tool') || 'Tool'}</label>
            <select id="editTaskTool" name="tool" class="form-control">
              <option value="gemini" ${task.tool === 'gemini' ? 'selected' : ''}>Gemini</option>
              <option value="qwen" ${task.tool === 'qwen' ? 'selected' : ''}>Qwen</option>
              <option value="codex" ${task.tool === 'codex' ? 'selected' : ''}>Codex</option>
              <option value="claude" ${task.tool === 'claude' ? 'selected' : ''}>Claude</option>
            </select>
          </div>

          <!-- Mode -->
          <div class="form-group">
            <label for="editTaskMode">${t('loop.mode') || 'Mode'}</label>
            <select id="editTaskMode" name="mode" class="form-control">
              <option value="analysis" ${task.mode === 'analysis' ? 'selected' : ''}>${t('loop.modeAnalysis') || 'Analysis'}</option>
              <option value="write" ${task.mode === 'write' ? 'selected' : ''}>${t('loop.modeWrite') || 'Write'}</option>
              <option value="review" ${task.mode === 'review' ? 'selected' : ''}>${t('loop.modeReview') || 'Review'}</option>
            </select>
          </div>

          <!-- Form Actions -->
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeTaskModal()">${t('loop.cancel') || 'Cancel'}</button>
            <button type="submit" class="btn btn-primary">
              <i data-lucide="save" class="w-4 h-4"></i> ${t('loop.save') || 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Focus on description field
  setTimeout(() => document.getElementById('editTaskDescription').focus(), 100);
}

/**
 * Handle edit task form submission
 */
async function handleEditTask(event, loopId, taskId) {
  event.preventDefault();

  const form = event.target;
  const errorDiv = document.getElementById('editTaskError');

  // Clear previous errors
  if (errorDiv) {
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';
  }

  // Get form values
  const description = form.description.value.trim();
  const tool = form.tool.value;
  const mode = form.mode.value;

  // Client-side validation
  if (!description) {
    if (errorDiv) {
      errorDiv.textContent = t('loop.descriptionRequired') || 'Description is required';
      errorDiv.style.display = 'block';
    }
    return;
  }

  try {
    // Call PUT /api/loops/v2/:loopId/tasks/:taskId
    const response = await fetch(`/api/loops/v2/${encodeURIComponent(loopId)}/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: description,
        tool: tool,
        mode: mode
      })
    });

    const result = await response.json();

    if (result.success) {
      showNotification(t('loop.taskUpdated') || 'Task updated successfully', 'success');
      closeTaskModal();
      // Reload tasks
      await loadLoopTasks(loopId);
    } else {
      if (errorDiv) {
        errorDiv.textContent = result.error || (t('loop.updateTaskFailed') || 'Failed to update task');
        errorDiv.style.display = 'block';
      }
    }
  } catch (err) {
    console.error('Update task error:', err);
    if (errorDiv) {
      errorDiv.textContent = err.message || (t('loop.updateTaskFailed') || 'Failed to update task');
      errorDiv.style.display = 'block';
    }
  }
}

/**
 * Confirm delete task
 */
function confirmDeleteTask(taskId) {
  const message = t('loop.confirmDeleteTask') || 'Are you sure you want to delete this task? This action cannot be undone.';

  if (confirm(message)) {
    deleteTask(taskId);
  }
}

/**
 * Delete task
 */
async function deleteTask(taskId) {
  const loopId = window.currentLoopId;
  if (!loopId) return;

  try {
    // Call DELETE /api/loops/v2/:loopId/tasks/:taskId
    const response = await fetch(`/api/loops/v2/${encodeURIComponent(loopId)}/tasks/${encodeURIComponent(taskId)}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (result.success) {
      showNotification(t('loop.taskDeleted') || 'Task deleted successfully', 'success');
      // Reload tasks
      await loadLoopTasks(loopId);
    } else {
      showNotification(t('loop.deleteTaskFailed') || 'Failed to delete task: ' + (result.error || ''), 'error');
    }
  } catch (err) {
    console.error('Delete task error:', err);
    showNotification(t('loop.deleteTaskError') || 'Error deleting task: ' + err.message, 'error');
  }
}

/**
 * Cleanup function for view transition
 */
window.destroyLoopMonitor = function() {
  if (window.loopWebSocket) {
    window.loopWebSocket.close();
    window.loopWebSocket = null;
  }
  window.selectedLoopId = null;
  window.loopReconnectAttempts = 0; // Reset reconnect counter
};

// Helper functions
function getStatusIcon(status) {
  const icons = {
    created: 'inbox',
    running: 'zap',
    paused: 'pause',
    completed: 'check',
    failed: 'alert-triangle'
  };
  return icons[status] || 'inbox';
}

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function formatDateTime(isoString) {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  return date.toLocaleString();
}

function formatRelativeTime(isoString) {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return t('loop.justNow');
  if (diff < 3600) return t('loop.minutesAgo', { m: Math.floor(diff / 60) });
  if (diff < 86400) return t('loop.hoursAgo', { h: Math.floor(diff / 3600) });
  return t('loop.daysAgo', { d: Math.floor(diff / 86400) });
}

function showNotification(message, type) {
  const toast = document.createElement('div');
  toast.className = `notification ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function showError(message) {
  showNotification(message, 'error');
}

// ==========================================
// VIEW SWITCHING AND KANBAN BOARD
// ==========================================

// Current view state
window.currentLoopView = 'loops'; // 'loops' | 'kanban'

/**
 * Switch between loops list view and kanban board view
 * @param {string} view - 'loops' or 'kanban'
 */
function switchView(view) {
  window.currentLoopView = view;

  // Update tab buttons
  const tabs = document.querySelectorAll('.view-tabs .tab-button');
  tabs.forEach(tab => {
    const tabView = tab.dataset.tab;
    const isActive = tabView === view;
    tab.classList.toggle('active', isActive);
    // Add ARIA attributes for accessibility
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tab.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });

  // Announce view change for screen readers
  const viewLabel = view === 'loops' ? 'Loops list view' : 'Tasks kanban board view';
  announceToScreenReader(viewLabel);

  // Render appropriate view
  if (view === 'loops') {
    renderLoopList();
    // Show loop detail if one is selected
    if (window.selectedLoopId) {
      renderLoopDetail(window.selectedLoopId);
    }
  } else if (view === 'tasks' || view === 'kanban') {
    if (window.selectedLoopId) {
      renderKanbanBoard(window.selectedLoopId);
    } else {
      // No loop selected, show instruction
      const detailPanel = document.getElementById('loopDetailPanel');
      if (detailPanel) {
        detailPanel.innerHTML = `
          <div class="empty-detail-state" role="status" aria-label="No loop selected">
            <div class="empty-icon-large">
              <i data-lucide="layout-grid" class="w-10 h-10"></i>
            </div>
            <p class="empty-state-title">${t('loop.selectLoopForKanban') || 'Select a Loop'}</p>
            <p class="empty-state-hint">${t('loop.selectLoopForKanbanHint') || 'Select a loop from the list to view its task board'}</p>
          </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }
    }
  }
}

/**
 * Render kanban board for a loop's tasks
 * Displays tasks grouped by status in columns
 */
async function renderKanbanBoard(loopId) {
  const container = document.getElementById('loopDetailPanel');
  const loop = window.loopStateStore[loopId];

  if (!container) return;

  if (!loop) {
    container.innerHTML = `
      <div class="empty-detail-state">
        <div class="empty-icon-large">
          <i data-lucide="alert-circle" class="w-10 h-10"></i>
        </div>
        <p class="empty-state-title">${t('loop.loopNotFound')}</p>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  // Show loading state
  container.innerHTML = `
    <div class="loop-detail">
      <div class="detail-header">
        <div class="detail-status ${loop.status}">
          <i data-lucide="layout-grid" class="w-4 h-4"></i>
          <span class="status-label">${t('loop.kanban.title') || 'Tasks Board'}</span>
        </div>
        <div class="detail-actions">
          <button class="btn btn-success" onclick="showAddTaskModal('${loopId}')" title="${t('loop.addTask') || 'Add Task'}">
            <i data-lucide="plus" class="w-4 h-4"></i> ${t('loop.addTask') || 'Add Task'}
          </button>
          <button class="btn btn-secondary" onclick="selectLoop('${loopId}')">
            <i data-lucide="list" class="w-4 h-4"></i> ${t('loop.listView') || 'List View'}
          </button>
        </div>
      </div>
      <div class="kanban-loading">
        <div class="loading-spinner">${t('loop.loading') || 'Loading...'}</div>
      </div>
    </div>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Fetch tasks
  try {
    const response = await fetch(`/api/loops/v2/${encodeURIComponent(loopId)}/tasks`);
    const result = await response.json();

    if (!result.success) {
      container.innerHTML = `
        <div class="empty-detail-state">
          <div class="empty-icon-large">
            <i data-lucide="alert-circle" class="w-10 h-10"></i>
          </div>
          <p class="empty-state-title">${t('loop.loadTasksFailed') || 'Failed to load tasks'}</p>
          <p class="empty-state-hint">${result.error || ''}</p>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    const tasks = result.data || [];

    // Group tasks by status
    const tasksByStatus = groupTasksByStatus(tasks);

    // Render kanban board
    renderKanbanBoardContent(container, loop, loopId, tasksByStatus);

  } catch (err) {
    console.error('Load tasks for kanban error:', err);
    container.innerHTML = `
      <div class="empty-detail-state">
        <div class="empty-icon-large">
          <i data-lucide="alert-circle" class="w-10 h-10"></i>
        </div>
        <p class="empty-state-title">${t('loop.loadTasksError') || 'Error loading tasks'}</p>
        <p class="empty-state-hint">${err.message}</p>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

/**
 * Group tasks by their status
 */
function groupTasksByStatus(tasks) {
  const statuses = ['pending', 'in_progress', 'blocked', 'done'];
  const grouped = {};

  statuses.forEach(status => {
    grouped[status] = [];
  });

  tasks.forEach(task => {
    const status = task.status || 'pending';
    if (!grouped[status]) {
      grouped[status] = [];
    }
    grouped[status].push(task);
  });

  return grouped;
}

/**
 * Render the actual kanban board content
 */
function renderKanbanBoardContent(container, loop, loopId, tasksByStatus) {
  const statusConfig = {
    pending: {
      label: t('loop.taskStatus.pending') || 'Pending',
      icon: 'circle',
      color: 'muted'
    },
    in_progress: {
      label: t('loop.taskStatus.inProgress') || 'In Progress',
      icon: 'loader',
      color: 'info'
    },
    blocked: {
      label: t('loop.taskStatus.blocked') || 'Blocked',
      icon: 'octagon',
      color: 'warning'
    },
    done: {
      label: t('loop.taskStatus.done') || 'Done',
      icon: 'check-circle-2',
      color: 'success'
    }
  };

  const columns = Object.entries(statusConfig).map(([status, config]) => {
    const tasks = tasksByStatus[status] || [];
    return `
      <div class="loop-kanban-column" data-status="${status}" role="region" aria-label="${config.label} column with ${tasks.length} tasks">
        <div class="loop-kanban-column-header">
          <div class="column-title">
            <i data-lucide="${config.icon}" class="w-4 h-4" aria-hidden="true"></i>
            <span>${config.label}</span>
          </div>
          <span class="column-count" aria-label="${tasks.length} tasks">${tasks.length}</span>
        </div>
        <div class="loop-kanban-column-body" data-status="${status}"
             role="list"
             aria-label="${config.label} tasks"
             ondragover="handleKanbanDragOver(event)" ondrop="handleKanbanDrop(event, '${loopId}', '${status}')">
          ${tasks.length > 0 ? tasks.map(task => renderKanbanTaskCard(task, loopId)).join('') : `
            <div class="kanban-empty-column" role="status" aria-label="No ${config.label} tasks">
              <p>${t('loop.kanban.noBoardData') || 'No tasks'}</p>
            </div>
          `}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="loop-detail">
      <div class="detail-header">
        <div class="kanban-header-left">
          <div class="detail-status ${loop.status}">
            <i data-lucide="layout-grid" class="w-4 h-4"></i>
            <span class="status-label">${t('loop.kanban.title') || 'Tasks Board'}</span>
          </div>
          <span class="kanban-loop-title">${escapeHtml(loop.title || loop.loop_id)}</span>
        </div>
        <div class="detail-actions">
          <button class="btn btn-success" onclick="showAddTaskModal('${loopId}')" title="${t('loop.addTask') || 'Add Task'}">
            <i data-lucide="plus" class="w-4 h-4"></i> ${t('loop.addTask') || 'Add Task'}
          </button>
          <button class="btn btn-secondary" onclick="selectLoop('${loopId}')">
            <i data-lucide="list" class="w-4 h-4"></i> ${t('loop.listView') || 'List View'}
          </button>
        </div>
      </div>
      <div class="loop-kanban-wrapper">
        <div class="loop-kanban-board">
          ${columns}
        </div>
      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Initialize drag and drop for kanban cards
  initKanbanDragDrop();

  // Initialize keyboard navigation for accessibility
  initializeKeyboardNavigation();

  // Announce to screen reader
  const totalTasks = Object.values(tasksByStatus).reduce((sum, tasks) => sum + tasks.length, 0);
  announceToScreenReader(`Kanban board loaded with ${totalTasks} tasks across 4 columns`);
}

/**
 * Render a single task card for the kanban board
 */
function renderKanbanTaskCard(task, loopId) {
  const priorityClass = task.priority || 'medium';
  const priorityLabel = t(`loop.priority.${priorityClass}`) || priorityClass;
  const taskDescription = escapeHtml(task.description || t('loop.noDescription') || 'No description');
  const taskTool = task.tool || 'gemini';
  const taskMode = task.mode || 'analysis';

  return `
    <div class="loop-task-card"
         draggable="true"
         data-task-id="${task.task_id || task.id}"
         data-loop-id="${loopId}"
         role="listitem"
         aria-label="Task: ${taskDescription}, Tool: ${taskTool}, Mode: ${taskMode}, Priority: ${priorityLabel}"
         ondragstart="handleKanbanDragStart(event)">
      <div class="loop-task-card-header">
        <span class="task-card-title">${taskDescription}</span>
        <button class="task-card-menu" onclick="showTaskContextMenu(event, '${task.task_id || task.id}', '${loopId}')" aria-label="Task options menu" title="Task options">
          <i data-lucide="more-vertical" class="w-3 h-3" aria-hidden="true"></i>
        </button>
      </div>
      <div class="loop-task-card-body">
        <div class="loop-task-card-meta">
          <span class="task-tool-badge">${task.tool || 'gemini'}</span>
          <span class="task-mode-badge mode-${task.mode || 'analysis'}">${task.mode || 'analysis'}</span>
        </div>
        ${task.priority ? `
          <div class="loop-task-card-priority">
            <span class="priority-badge ${priorityClass}">${priorityLabel}</span>
          </div>
        ` : ''}
      </div>
      <div class="loop-task-card-footer">
        <div class="task-card-actions">
          <button class="btn btn-xs btn-ghost" onclick="editTask('${task.task_id || task.id}')" title="${t('loop.edit') || 'Edit'}">
            <i data-lucide="edit-2" class="w-3 h-3"></i>
          </button>
          <button class="btn btn-xs btn-ghost" onclick="showTaskStatusUpdate('${task.task_id || task.id}', '${loopId}')" title="${t('loop.updateStatus') || 'Update Status'}">
            <i data-lucide="arrow-right-circle" class="w-3 h-3"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Initialize drag and drop for kanban board
 */
function initKanbanDragDrop() {
  const cards = document.querySelectorAll('.loop-task-card[draggable="true"]');
  cards.forEach(card => {
    card.addEventListener('dragend', handleKanbanDragEnd);
  });
}

/**
 * Handle drag start for kanban card
 */
function handleKanbanDragStart(event) {
  const card = event.target.closest('.loop-task-card');
  if (!card) return;

  card.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', JSON.stringify({
    taskId: card.dataset.taskId,
    loopId: card.dataset.loopId
  }));
}

/**
 * Handle drag end for kanban card
 */
function handleKanbanDragEnd(event) {
  const card = event.target.closest('.loop-task-card');
  if (card) {
    card.classList.remove('dragging');
  }
}

/**
 * Handle drag over for kanban column
 */
function handleKanbanDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';

  const column = event.target.closest('.loop-kanban-column-body');
  if (column) {
    column.classList.add('drag-over');
  }
}

/**
 * Handle drop for kanban column
 */
async function handleKanbanDrop(event, loopId, newStatus) {
  event.preventDefault();

  // Remove drag-over style
  document.querySelectorAll('.loop-kanban-column-body').forEach(col => {
    col.classList.remove('drag-over');
  });

  try {
    const data = JSON.parse(event.dataTransfer.getData('text/plain'));
    const taskId = data.taskId;

    if (!taskId) return;

    // Update task status
    await updateTaskStatus(loopId, taskId, newStatus);

    // Refresh kanban board
    await renderKanbanBoard(loopId);

  } catch (err) {
    console.error('Kanban drop error:', err);
  }
}

// ==========================================
// STATUS UPDATE FUNCTIONS
// ==========================================

/**
 * Update loop status via PATCH endpoint
 * @param {string} loopId - The loop ID
 * @param {string} status - New status (created, running, paused, completed, failed)
 */
async function updateLoopStatus(loopId, status) {
  try {
    const response = await fetch(`/api/loops/v2/${encodeURIComponent(loopId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });

    const result = await response.json();

    if (result.success) {
      showNotification(t('loop.updateSuccess') || 'Status updated successfully', 'success');

      // Update local store
      if (window.loopStateStore[loopId]) {
        window.loopStateStore[loopId] = result.data;
      }

      // Refresh UI
      renderLoopList();
      if (window.selectedLoopId === loopId) {
        renderLoopDetail(loopId);
      }

      return result.data;
    } else {
      showNotification(t('loop.updateError') || 'Failed to update status: ' + (result.error || ''), 'error');
      return null;
    }
  } catch (err) {
    console.error('Update loop status error:', err);
    showNotification(t('loop.updateError') || 'Failed to update status: ' + err.message, 'error');
    return null;
  }
}

/**
 * Update loop metadata via PUT endpoint
 * @param {string} loopId - The loop ID
 * @param {object} metadata - Metadata to update (title, description, tags, priority, notes, etc.)
 */
async function updateLoopMetadata(loopId, metadata) {
  try {
    const response = await fetch(`/api/loops/v2/${encodeURIComponent(loopId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata)
    });

    const result = await response.json();

    if (result.success) {
      showNotification(t('loop.updateSuccess') || 'Loop updated successfully', 'success');

      // Update local store
      if (window.loopStateStore[loopId]) {
        window.loopStateStore[loopId] = result.data;
      }

      // Refresh UI
      renderLoopList();
      if (window.selectedLoopId === loopId) {
        renderLoopDetail(loopId);
      }

      return result.data;
    } else {
      showNotification(t('loop.updateError') || 'Failed to update loop: ' + (result.error || ''), 'error');
      return null;
    }
  } catch (err) {
    console.error('Update loop metadata error:', err);
    showNotification(t('loop.updateError') || 'Failed to update loop: ' + err.message, 'error');
    return null;
  }
}

/**
 * Update task status within a loop
 * @param {string} loopId - The loop ID
 * @param {string} taskId - The task ID
 * @param {string} newStatus - New status (pending, in_progress, blocked, done)
 */
async function updateTaskStatus(loopId, taskId, newStatus) {
  try {
    const response = await fetch(`/api/loops/v2/${encodeURIComponent(loopId)}/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    const result = await response.json();

    if (result.success) {
      showNotification(t('loop.updateSuccess') || 'Task status updated', 'success');
      return result.data;
    } else {
      showNotification(t('loop.updateError') || 'Failed to update task: ' + (result.error || ''), 'error');
      return null;
    }
  } catch (err) {
    console.error('Update task status error:', err);
    showNotification(t('loop.updateError') || 'Failed to update task: ' + err.message, 'error');
    return null;
  }
}

/**
 * Show status update panel for a task
 */
function showTaskStatusUpdate(taskId, loopId) {
  const statuses = [
    { value: 'pending', label: t('loop.taskStatus.pending') || 'Pending', icon: 'circle' },
    { value: 'in_progress', label: t('loop.taskStatus.inProgress') || 'In Progress', icon: 'loader' },
    { value: 'blocked', label: t('loop.taskStatus.blocked') || 'Blocked', icon: 'octagon' },
    { value: 'done', label: t('loop.taskStatus.done') || 'Done', icon: 'check-circle-2' }
  ];

  const modal = document.createElement('div');
  modal.id = 'statusUpdateModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content modal-sm">
      <div class="modal-header">
        <h3><i data-lucide="arrow-right-circle" class="w-5 h-5"></i> ${t('loop.updateStatus') || 'Update Status'}</h3>
        <button class="modal-close" onclick="closeStatusUpdateModal()">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      <div class="modal-body">
        <div class="status-update-panel">
          ${statuses.map(status => `
            <button class="status-option" onclick="applyTaskStatus('${taskId}', '${loopId}', '${status.value}')">
              <i data-lucide="${status.icon}" class="w-4 h-4"></i>
              <span>${status.label}</span>
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Close status update modal
 */
function closeStatusUpdateModal() {
  const modal = document.getElementById('statusUpdateModal');
  if (modal) modal.remove();
}

/**
 * Apply task status and close modal
 */
async function applyTaskStatus(taskId, loopId, newStatus) {
  closeStatusUpdateModal();
  await updateTaskStatus(loopId, taskId, newStatus);

  // Refresh the appropriate view
  if (window.currentLoopView === 'kanban' || window.currentLoopView === 'tasks') {
    await renderKanbanBoard(loopId);
  } else {
    await loadLoopTasks(loopId);
  }
}

/**
 * Show task context menu
 */
function showTaskContextMenu(event, taskId, loopId) {
  event.stopPropagation();

  // Remove existing menu if any
  const existing = document.getElementById('taskContextMenu');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.id = 'taskContextMenu';
  menu.className = 'context-menu';
  menu.style.cssText = `
    position: fixed;
    left: ${event.clientX}px;
    top: ${event.clientY}px;
    z-index: 10000;
    background: hsl(var(--card));
    border: 1px solid hsl(var(--border));
    border-radius: 0.5rem;
    padding: 0.25rem;
    box-shadow: 0 4px 12px hsl(var(--foreground) / 0.15);
    min-width: 150px;
  `;

  menu.innerHTML = `
    <button class="context-menu-item" onclick="editTask('${taskId}'); closeTaskContextMenu();">
      <i data-lucide="edit-2" class="w-4 h-4"></i>
      <span>${t('loop.edit') || 'Edit'}</span>
    </button>
    <button class="context-menu-item" onclick="showTaskStatusUpdate('${taskId}', '${loopId}'); closeTaskContextMenu();">
      <i data-lucide="arrow-right-circle" class="w-4 h-4"></i>
      <span>${t('loop.updateStatus') || 'Update Status'}</span>
    </button>
    <hr class="context-menu-divider">
    <button class="context-menu-item danger" onclick="confirmDeleteTask('${taskId}'); closeTaskContextMenu();">
      <i data-lucide="trash-2" class="w-4 h-4"></i>
      <span>${t('loop.delete') || 'Delete'}</span>
    </button>
  `;

  document.body.appendChild(menu);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Close on click outside
  setTimeout(() => {
    document.addEventListener('click', closeTaskContextMenu, { once: true });
  }, 10);
}

/**
 * Close task context menu
 */
function closeTaskContextMenu() {
  const menu = document.getElementById('taskContextMenu');
  if (menu) menu.remove();
}

// ==========================================
// ACCESSIBILITY UTILITIES
// ==========================================

/**
 * Announce message to screen readers using ARIA live region
 * @param {string} message - Message to announce
 * @param {string} priority - 'polite' or 'assertive' (default: 'polite')
 */
function announceToScreenReader(message, priority = 'polite') {
  // Create or get existing live region
  let liveRegion = document.getElementById('screen-reader-announcements');
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'screen-reader-announcements';
    liveRegion.className = 'sr-only';
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.cssText = 'position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;';
    document.body.appendChild(liveRegion);
  }

  // Update aria-live if priority changes
  if (liveRegion.getAttribute('aria-live') !== priority) {
    liveRegion.setAttribute('aria-live', priority);
  }

  // Clear and set message
  liveRegion.textContent = '';
  setTimeout(() => {
    liveRegion.textContent = message;
  }, 100);
}

/**
 * Add keyboard navigation for task cards
 * @param {HTMLElement} card - Task card element
 */
function addTaskCardKeyboardSupport(card) {
  if (!card) return;

  // Make card focusable
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Task: ${card.querySelector('.task-card-title')?.textContent || 'Unnamed task'}`);

  // Add keyboard event listener
  card.addEventListener('keydown', (event) => {
    const taskId = card.dataset.taskId;
    const loopId = card.dataset.loopId;

    if (!taskId || !loopId) return;

    // Enter or Space to open task context menu or edit
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      showTaskContextMenu(event, taskId, loopId);
    }

    // Arrow keys for navigation between cards
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextCard = card.nextElementSibling;
      if (nextCard && nextCard.classList.contains('loop-task-card')) {
        nextCard.focus();
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prevCard = card.previousElementSibling;
      if (prevCard && prevCard.classList.contains('loop-task-card')) {
        prevCard.focus();
      }
    }

    // Arrow Left/Right to move between columns (in kanban view)
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const currentColumn = card.closest('.loop-kanban-column-body');
      if (!currentColumn) return;

      const parentColumn = currentColumn.closest('.loop-kanban-column');
      const siblingColumn = event.key === 'ArrowLeft'
        ? parentColumn.previousElementSibling
        : parentColumn.nextElementSibling;

      if (siblingColumn) {
        const siblingBody = siblingColumn.querySelector('.loop-kanban-column-body');
        const firstCard = siblingBody?.querySelector('.loop-task-card');
        if (firstCard) {
          firstCard.focus();
        }
      }
    }
  });
}

/**
 * Initialize keyboard navigation for all task cards
 */
function initializeKeyboardNavigation() {
  const cards = document.querySelectorAll('.loop-task-card');
  cards.forEach(card => addTaskCardKeyboardSupport(card));

  // Add keyboard shortcut hints
  document.addEventListener('keydown', (event) => {
    // Ctrl+K or Cmd+K to focus search/filter
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      const filterSelect = document.getElementById('loopFilter');
      if (filterSelect) {
        filterSelect.focus();
      }
    }

    // ? to show keyboard shortcuts help
    if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const activeElement = document.activeElement;
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
      );

      if (!isTyping) {
        event.preventDefault();
        showKeyboardShortcutsHelp();
      }
    }
  });
}

/**
 * Show keyboard shortcuts help dialog
 */
function showKeyboardShortcutsHelp() {
  const modal = document.createElement('div');
  modal.id = 'keyboardShortcutsModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content modal-sm" role="dialog" aria-labelledby="shortcuts-title" aria-modal="true">
      <div class="modal-header">
        <h3 id="shortcuts-title"><i data-lucide="keyboard" class="w-5 h-5"></i> ${t('common.keyboardShortcuts') || 'Keyboard Shortcuts'}</h3>
        <button class="modal-close" onclick="closeKeyboardShortcutsHelp()" aria-label="Close">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      <div class="modal-body">
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <div style="display: flex; justify-content: space-between; padding: 0.5rem; border-bottom: 1px solid hsl(var(--border));">
            <span><kbd>?</kbd></span>
            <span style="color: hsl(var(--muted-foreground));">Show shortcuts</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 0.5rem; border-bottom: 1px solid hsl(var(--border));">
            <span><kbd>Ctrl</kbd> + <kbd>K</kbd></span>
            <span style="color: hsl(var(--muted-foreground));">Focus filter</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 0.5rem; border-bottom: 1px solid hsl(var(--border));">
            <span><kbd>Enter</kbd> / <kbd>Space</kbd></span>
            <span style="color: hsl(var(--muted-foreground));">Open task menu</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 0.5rem; border-bottom: 1px solid hsl(var(--border));">
            <span><kbd>↑</kbd> / <kbd>↓</kbd></span>
            <span style="color: hsl(var(--muted-foreground));">Navigate tasks</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 0.5rem; border-bottom: 1px solid hsl(var(--border));">
            <span><kbd>←</kbd> / <kbd>→</kbd></span>
            <span style="color: hsl(var(--muted-foreground));">Switch columns</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 0.5rem;">
            <span><kbd>Esc</kbd></span>
            <span style="color: hsl(var(--muted-foreground));">Close dialog</span>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Focus on close button
  setTimeout(() => {
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.focus();
  }, 100);

  // Close on Escape
  const handleEscape = (event) => {
    if (event.key === 'Escape') {
      closeKeyboardShortcutsHelp();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

/**
 * Close keyboard shortcuts help
 */
function closeKeyboardShortcutsHelp() {
  const modal = document.getElementById('keyboardShortcutsModal');
  if (modal) modal.remove();
}

// ==========================================
// PERFORMANCE OPTIMIZATIONS
// ==========================================

/**
 * Debounce function to limit how often a function is called
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function to limit execution frequency
 * @param {Function} func - Function to throttle
 * @param {number} limit - Minimum time between executions in ms
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Debounced versions of frequently called functions
const debouncedRenderLoopList = debounce(renderLoopList, 300);
const debouncedRenderKanbanBoard = debounce(renderKanbanBoard, 300);

// ==========================================
// NAVIGATION GROUPING
// ==========================================

/**
 * Group loops by their status for navigation display
 * @returns {object} Loops grouped by status with counts
 */
function groupLoopsByStatus() {
  const loops = Object.values(window.loopStateStore);
  const groups = {
    all: { loops: loops, count: loops.length },
    running: { loops: [], count: 0 },
    paused: { loops: [], count: 0 },
    completed: { loops: [], count: 0 },
    failed: { loops: [], count: 0 },
    created: { loops: [], count: 0 }
  };

  loops.forEach(loop => {
    const status = loop.status || 'created';
    if (groups[status]) {
      groups[status].loops.push(loop);
      groups[status].count++;
    }
  });

  return groups;
}

/**
 * Render loop list with status grouping
 */
function renderGroupedLoopList() {
  const container = document.getElementById('loopList');
  if (!container) return;

  const groups = groupLoopsByStatus();
  const filter = document.getElementById('loopFilter')?.value || 'all';

  // Get loops based on filter
  let loops;
  if (filter === 'all') {
    loops = groups.all.loops;
  } else {
    loops = groups[filter]?.loops || [];
  }

  // Sort by updated_at descending
  loops.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  if (loops.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i data-lucide="inbox" class="w-6 h-6"></i>
        </div>
        <p class="empty-state-title">${t('loop.noLoops')}</p>
        <p class="empty-state-hint">${t('loop.noLoopsHint')}</p>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  // Render grouped navigation
  const statusGroups = ['running', 'paused', 'created', 'completed', 'failed'];
  const groupHeaders = [];

  statusGroups.forEach(status => {
    const group = groups[status];
    if (group.count > 0 && (filter === 'all' || filter === status)) {
      const statusLabel = t(`loop.${status}`) || status;
      const groupLoops = group.loops.map(loop => renderLoopCard(loop)).join('');
      groupHeaders.push(`
        <div class="loop-group">
          <div class="loop-group-header">
            <span class="group-label">${statusLabel}</span>
            <span class="group-count">${group.count}</span>
          </div>
          <div class="loop-group-items">
            ${groupLoops}
          </div>
        </div>
      `);
    }
  });

  // If filter is not 'all', just show filtered list without group headers
  if (filter !== 'all') {
    container.innerHTML = loops.map(loop => renderLoopCard(loop)).join('');
  } else {
    container.innerHTML = groupHeaders.join('');
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// LOOP TASK CREATION
// ==========================================

/**
 * Show tasks tab with loop-enabled tasks
 */
async function showTasksTab() {
  try {
    const response = await fetch('/api/tasks');
    const result = await response.json();

    if (!result.success) {
      showError(t('loop.failedToLoad') + ': ' + (result.error || t('common.error')));
      return;
    }

    const tasks = result.data || [];
    const loopEnabledTasks = tasks.filter(t => t.loop_control && t.loop_control.enabled);

    renderTasksList(loopEnabledTasks);
  } catch (err) {
    console.error('Load tasks error:', err);
    showError(t('loop.failedToLoad') + ': ' + err.message);
  }
}

/**
 * Render tasks list with start button
 */
function renderTasksList(tasks) {
  const listContainer = document.getElementById('loopList');

  if (tasks.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <i data-lucide="folder-open" class="w-10 h-10"></i>
        <p>${t('loop.noLoopTasks')}</p>
        <button class="btn btn-primary mt-4" onclick="showCreateLoopModal()">
          <i data-lucide="plus" class="w-4 h-4"></i> ${t('loop.createLoopTask')}
        </button>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  listContainer.innerHTML = `
    <div class="tasks-list-header">
      <p class="text-sm text-gray-500">${t('loop.tasksCount', { count: tasks.length })}</p>
      <button class="btn btn-sm btn-secondary" onclick="loadLoops()">
        <i data-lucide="arrow-left" class="w-4 h-4"></i> ${t('loop.backToLoops')}
      </button>
    </div>
    <div class="tasks-list">
      ${tasks.map(task => renderTaskCard(task)).join('')}
    </div>
  `;

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Render single task card
 */
function renderTaskCard(task) {
  const config = task.loop_control || {};
  const stepCount = config.cli_sequence ? config.cli_sequence.length : 0;

  return `
    <div class="task-card" onclick="showTaskDetail('${task.id}')" style="cursor: pointer;">
      <div class="task-card-header">
        <span class="task-title">${escapeHtml(task.title || task.id)}</span>
        <span class="task-id">${escapeHtml(task.id)}</span>
      </div>
      <div class="task-card-body">
        <p class="task-description">${escapeHtml(config.description || t('common.na'))}</p>
        <div class="task-meta">
          <span><i data-lucide="repeat" class="w-4 h-4"></i> Max: ${config.max_iterations || 10}</span>
          <span><i data-lucide="list" class="w-4 h-4"></i> Steps: ${stepCount}</span>
        </div>
        <button class="btn btn-primary w-full mt-3" onclick="event.stopPropagation(); startLoopFromTask('${task.id}')">
          <i data-lucide="play" class="w-4 h-4"></i> ${t('loop.startLoop')}
        </button>
      </div>
    </div>
  `;
}

/**
 * Start loop from task
 */
async function startLoopFromTask(taskId) {
  try {
    const response = await fetch('/api/loops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId })
    });
    const result = await response.json();

    if (result.success) {
      showNotification(t('loop.loopStarted') + ': ' + result.data.loopId, 'success');
      await loadLoops(); // Refresh to show new loop
    } else {
      showError(t('loop.failedToStart') + ': ' + (result.error || t('common.error')));
    }
  } catch (err) {
    console.error('Start loop error:', err);
    showError(t('loop.failedToStart') + ': ' + err.message);
  }
}

/**
 * Show task detail in detail panel
 */
async function showTaskDetail(taskId) {
  try {
    const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`);
    const result = await response.json();

    if (!result.success) {
      showError('Failed to load task: ' + (result.error || 'Unknown error'));
      return;
    }

    const task = result.data?.task || result.data;
    renderTaskDetail(task);
  } catch (err) {
    console.error('Load task error:', err);
    showError('Failed to load task: ' + err.message);
  }
}

/**
 * Render task detail panel
 */
function renderTaskDetail(task) {
  const container = document.getElementById('loopDetailPanel');
  if (!container) return;

  const config = task.loop_control || {};
  const cliSequence = config.cli_sequence || [];
  const stepCount = cliSequence.length;

  container.innerHTML = `
    <div class="loop-detail">
      <!-- Header -->
      <div class="detail-header">
        <div class="detail-status active">
          <i data-lucide="file-text" class="w-4 h-4"></i>
          <span class="status-label">${t('loop.task')}</span>
        </div>
        <div class="detail-actions">
          <button class="btn btn-primary" onclick="startLoopFromTask('${task.id}')">
            <i data-lucide="play" class="w-4 h-4"></i> ${t('loop.startLoop')}
          </button>
          <button class="btn btn-secondary" onclick="showCreateLoopModal('${task.id}')">
            <i data-lucide="edit" class="w-4 h-4"></i> ${t('loop.edit')}
          </button>
        </div>
      </div>

      <!-- Title & Description -->
      <div class="detail-section">
        <h3 class="detail-title">${escapeHtml(task.title || task.id)}</h3>
        <p class="detail-description">${escapeHtml(config.description || task.description || '')}</p>
      </div>

      <!-- Configuration -->
      <div class="detail-section">
        <h4><i data-lucide="settings" class="w-4 h-4"></i> ${t('loop.loopConfig')}</h4>
        <div class="config-grid">
          <div class="config-item">
            <span class="config-label">${t('loop.maxIterations')}</span>
            <span class="config-value">${config.max_iterations || 10}</span>
          </div>
          <div class="config-item">
            <span class="config-label">${t('loop.errorPolicy')}</span>
            <span class="config-value">${config.error_policy?.on_failure || 'pause'}</span>
          </div>
          <div class="config-item">
            <span class="config-label">${t('loop.maxRetries')}</span>
            <span class="config-value">${config.error_policy?.max_retries || 3}</span>
          </div>
          <div class="config-item">
            <span class="config-label">${t('loop.cliSequence')}</span>
            <span class="config-value">${stepCount} ${t('loop.steps')}</span>
          </div>
        </div>
        ${config.success_condition ? `
          <div class="config-item-full">
            <span class="config-label">${t('loop.successCondition')}</span>
            <code class="config-code">${escapeHtml(config.success_condition)}</code>
          </div>
        ` : ''}
      </div>

      <!-- CLI Sequence -->
      <div class="detail-section">
        <h4><i data-lucide="terminal" class="w-4 h-4"></i> ${t('loop.cliSequence')}</h4>
        <div class="steps-list">
          ${cliSequence.map((step, index) => `
            <div class="step-item">
              <div class="step-number">${index + 1}</div>
              <div class="step-content">
                <div class="step-header">
                  <span class="step-id">${escapeHtml(step.step_id || `Step ${index + 1}`)}</span>
                  <span class="step-tool">${step.tool}</span>
                </div>
                <div class="step-details">
                  <span class="step-mode">${step.mode}</span>
                  ${step.on_error ? `<span class="step-error">On error: ${step.on_error}</span>` : ''}
                </div>
                ${step.prompt_template ? `
                  <div class="step-prompt">
                    <small>${t('loop.promptTemplate')}:</small>
                    <p>${escapeHtml(step.prompt_template.substring(0, 100))}${step.prompt_template.length > 100 ? '...' : ''}</p>
                  </div>
                ` : ''}
                ${step.command ? `
                  <div class="step-command">
                    <small>${t('loop.command')}:</small>
                    <code>${escapeHtml(step.command)}</code>
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Task Info -->
      <div class="detail-section">
        <h4><i data-lucide="info" class="w-4 h-4"></i> ${t('loop.taskInfo')}</h4>
        <div class="config-grid">
          <div class="config-item">
            <span class="config-label">${t('loop.taskId')}</span>
            <span class="config-value">${escapeHtml(task.id)}</span>
          </div>
          <div class="config-item">
            <span class="config-label">${t('loop.status')}</span>
            <span class="config-value">${task.status || 'active'}</span>
          </div>
          ${task.meta?.created_by ? `
            <div class="config-item">
              <span class="config-label">${t('loop.createdBy')}</span>
              <span class="config-value">${task.meta.created_by}</span>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Global store for available CLI tools
window.availableCliTools = [];

/**
 * Fetch available CLI tools from API
 */
async function fetchAvailableCliTools() {
  try {
    const response = await fetch('/api/cli/status');
    const data = await response.json();
    // Return only available tools (where available: true)
    return Object.entries(data)
      .filter(([_, status]) => status.available)
      .map(([name, _]) => name);
  } catch (err) {
    console.error('Failed to fetch CLI tools:', err);
    // Fallback to default tools
    return ['gemini', 'qwen', 'codex', 'claude'];
  }
}

/**
 * Show create loop modal (backup - complex version with CLI sequence)
 * @deprecated Use showSimpleCreateLoopModal instead
 */
async function showCreateLoopModal_backup() {
  // Fetch available CLI tools first
  window.availableCliTools = await fetchAvailableCliTools();

  const modal = document.createElement('div');
  modal.id = 'createLoopModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content modal-lg">
      <div class="modal-header">
        <h3>${t('loop.createLoopModal')}</h3>
        <button class="modal-close" onclick="closeCreateLoopModal()">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      <div class="modal-body">
        <form id="createLoopForm" onsubmit="handleCreateLoopSubmit(event)">
          <!-- Basic Info -->
          <div class="form-section section-basic">
            <div class="section-header-with-action">
              <h4><i data-lucide="info" class="w-4 h-4"></i> ${t('loop.basicInfo')}</h4>
              <button type="button" class="btn btn-sm btn-outline" onclick="importFromIssue()" title="${t('loop.importFromIssue')}">
                <i data-lucide="download" class="w-3 h-3"></i> ${t('loop.importFromIssue')}
              </button>
            </div>
            <div class="form-group">
              <label for="taskTitle">${t('loop.taskTitle')}</label>
              <input type="text" id="taskTitle" name="title" required
                     placeholder="${t('loop.taskTitlePlaceholder')}"
                     class="form-control">
            </div>
            <div class="form-group">
              <label for="taskDescription">${t('loop.description')}</label>
              <textarea id="taskDescription" name="description" rows="2"
                        placeholder="${t('loop.descriptionPlaceholder')}"
                        class="form-control"></textarea>
            </div>
          </div>

          <!-- Loop Configuration -->
          <div class="form-section section-config">
            <h4><i data-lucide="settings" class="w-4 h-4"></i> ${t('loop.loopConfig')}</h4>
            <div class="form-row">
              <div class="form-group flex-1">
                <label for="maxIterations">${t('loop.maxIterations')}</label>
                <input type="number" id="maxIterations" name="max_iterations" value="10" min="1" max="100"
                       class="form-control">
              </div>
              <div class="form-group flex-1">
                <label for="errorPolicy">${t('loop.errorPolicy')}</label>
                <select id="errorPolicy" name="error_policy" class="form-control">
                  <option value="pause">${t('loop.pauseOnError')}</option>
                  <option value="retry">${t('loop.retryAutomatically')}</option>
                  <option value="fail_fast">${t('loop.failImmediately')}</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label for="maxRetries">${t('loop.maxRetries')}</label>
              <input type="number" id="maxRetries" name="max_retries" value="3" min="0" max="10"
                     class="form-control">
            </div>
            <div class="form-group">
              <label for="successCondition">${t('loop.successCondition')}</label>
              <input type="text" id="successCondition" name="success_condition"
                     placeholder="${t('loop.successConditionPlaceholder')}"
                     class="form-control">
              <small class="text-gray-500">
                ${t('loop.availableVars')}
              </small>
            </div>
          </div>

          <!-- CLI Sequence -->
          <div class="form-section section-cli">
            <div class="flex justify-between items-center mb-3">
              <h4><i data-lucide="list-ordered" class="w-4 h-4"></i> ${t('loop.cliSequence')}</h4>
              <button type="button" class="btn btn-sm btn-info-light" onclick="addCliStep()">
                <i data-lucide="plus" class="w-4 h-4"></i> ${t('loop.addStep')}
              </button>
            </div>
            <div id="cliStepsContainer">
              <!-- Steps will be added here -->
            </div>
          </div>

          <!-- Form Actions -->
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeCreateLoopModal()">${t('loop.cancel')}</button>
            <button type="submit" class="btn btn-primary">
              <i data-lucide="check" class="w-4 h-4"></i> ${t('loop.createAndStart')}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Add first step by default
  addCliStep();

  // Focus on title
  setTimeout(() => document.getElementById('taskTitle').focus(), 100);
}

/**
 * Show simplified create loop modal (v2)
 * Only 3 fields: title, description, max_iterations
 */
async function showSimpleCreateLoopModal() {
  const modal = document.createElement('div');
  modal.id = 'createLoopModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3><i data-lucide="plus-circle" class="w-5 h-5"></i> ${t('loop.newLoop')}</h3>
        <button class="modal-close" onclick="closeSimpleCreateLoopModal()">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      <div class="modal-body">
        <form id="simpleCreateLoopForm" onsubmit="handleSimpleCreateLoop(event)">
          <div id="simpleCreateError" class="alert alert-error" style="display: none;"></div>

          <!-- Title -->
          <div class="form-group">
            <label for="simpleLoopTitle">${t('loop.taskTitle')} <span class="required">*</span></label>
            <input type="text" id="simpleLoopTitle" name="title" required
                   placeholder="${t('loop.taskTitlePlaceholder')}"
                   class="form-control"
                   minlength="1" maxlength="100">
            <small class="text-gray-500">${t('loop.taskTitleHint') || 'Enter a descriptive title for your loop'}</small>
          </div>

          <!-- Description -->
          <div class="form-group">
            <label for="simpleLoopDescription">${t('loop.description')}</label>
            <textarea id="simpleLoopDescription" name="description" rows="3"
                      placeholder="${t('loop.descriptionPlaceholder')}"
                      class="form-control"
                      maxlength="500"></textarea>
            <small class="text-gray-500">${t('loop.descriptionHint') || 'Optional context about what this loop does'}</small>
          </div>

          <!-- Max Iterations -->
          <div class="form-group">
            <label for="simpleLoopMaxIter">${t('loop.maxIterations')} <span class="required">*</span></label>
            <input type="number" id="simpleLoopMaxIter" name="max_iterations" value="10" min="1" max="100"
                   class="form-control">
            <small class="text-gray-500">${t('loop.maxIterationsHint') || 'Maximum number of iterations to run (1-100)'}</small>
          </div>

          <!-- Form Actions -->
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeSimpleCreateLoopModal()">${t('loop.cancel')}</button>
            <button type="submit" class="btn btn-primary">
              <i data-lucide="plus" class="w-4 h-4"></i> ${t('loop.create') || 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Focus on title field
  setTimeout(() => document.getElementById('simpleLoopTitle').focus(), 100);
}

/**
 * Close simplified create loop modal
 */
function closeSimpleCreateLoopModal() {
  const modal = document.getElementById('createLoopModal');
  if (modal) {
    modal.remove();
  }
}

/**
 * Handle simplified create loop form submission
 * Calls POST /api/loops/v2
 */
async function handleSimpleCreateLoop(event) {
  event.preventDefault();

  const form = event.target;
  const errorDiv = document.getElementById('simpleCreateError');

  // Clear previous errors
  if (errorDiv) {
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';
  }

  // Get form values
  const title = form.title.value.trim();
  const description = form.description.value.trim();
  const maxIterations = parseInt(form.max_iterations.value, 10);

  // Client-side validation
  if (!title) {
    if (errorDiv) {
      errorDiv.textContent = t('loop.titleRequired') || 'Title is required';
      errorDiv.style.display = 'block';
    }
    return;
  }

  if (maxIterations < 1 || maxIterations > 100) {
    if (errorDiv) {
      errorDiv.textContent = t('loop.invalidMaxIterations') || 'Max iterations must be between 1 and 100';
      errorDiv.style.display = 'block';
    }
    return;
  }

  try {
    // Call POST /api/loops/v2
    const response = await fetch('/api/loops/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title,
        description: description,
        max_iterations: maxIterations
      })
    });

    const result = await response.json();

    if (result.success) {
      showNotification(t('loop.loopCreated') || 'Loop created successfully', 'success');
      closeSimpleCreateLoopModal();
      // Reload loops to show the new loop
      await loadLoops();
    } else {
      if (errorDiv) {
        errorDiv.textContent = result.error || (t('loop.createFailed') || 'Failed to create loop');
        errorDiv.style.display = 'block';
      }
    }
  } catch (err) {
    console.error('Create loop error:', err);
    if (errorDiv) {
      errorDiv.textContent = err.message || (t('loop.createFailed') || 'Failed to create loop');
      errorDiv.style.display = 'block';
    }
  }
}

/**
 * Show create loop modal (simplified v2)
 */
async function showCreateLoopModal() {
  await showSimpleCreateLoopModal();
}

/**
 * Close create loop modal
 */
function closeCreateLoopModal() {
  const modal = document.getElementById('createLoopModal');
  if (modal) {
    modal.remove();
  }
}

/**
 * Import task data from issue
 */
async function importFromIssue() {
  try {
    const response = await fetch('/api/issues');
    const data = await response.json();

    if (!data.issues || data.issues.length === 0) {
      showNotification(t('loop.noIssuesFound'), 'warning');
      return;
    }

    // Show issue selection modal
    showIssueSelector(data.issues);
  } catch (err) {
    console.error('Failed to fetch issues:', err);
    showError(t('loop.fetchIssuesFailed') + ': ' + err.message);
  }
}

/**
 * Show issue selector modal
 */
function showIssueSelector(issues) {
  // Remove existing selector if any
  const existing = document.getElementById('issueSelectorModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'issueSelectorModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 600px;">
      <div class="modal-header">
        <h3><i data-lucide="download" class="w-4 h-4"></i> ${t('loop.selectIssue')}</h3>
        <button class="btn-close" onclick="closeIssueSelector()">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
      <div class="modal-body" style="max-height: 400px; overflow-y: auto;">
        <div class="issue-list">
          ${issues.map(issue => `
            <div class="issue-item" onclick="selectIssue('${issue.id}')" style="cursor: pointer; padding: 0.75rem; border: 1px solid hsl(var(--border)); border-radius: 0.5rem; margin-bottom: 0.5rem; transition: all 0.2s;">
              <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                  <div style="font-weight: 600; color: hsl(var(--foreground)); margin-bottom: 0.25rem;">
                    ${issue.id}: ${escapeHtml(issue.title)}
                  </div>
                  <div style="font-size: 0.875rem; color: hsl(var(--muted-foreground));">
                    ${escapeHtml(issue.context || '').substring(0, 100)}${issue.context?.length > 100 ? '...' : ''}
                  </div>
                </div>
                <span class="status-badge status-${issue.status}" style="font-size: 0.75rem;">
                  ${t('issue.status.' + issue.status, issue.status)}
                </span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Add hover effect
  modal.querySelectorAll('.issue-item').forEach(item => {
    item.addEventListener('mouseenter', () => {
      item.style.background = 'hsl(var(--accent) / 0.1)';
      item.style.borderColor = 'hsl(var(--primary))';
    });
    item.addEventListener('mouseleave', () => {
      item.style.background = '';
      item.style.borderColor = '';
    });
  });
}

/**
 * Close issue selector
 */
function closeIssueSelector() {
  const modal = document.getElementById('issueSelectorModal');
  if (modal) modal.remove();
}

/**
 * Select issue and populate form
 */
async function selectIssue(issueId) {
  try {
    const response = await fetch(`/api/issues/${encodeURIComponent(issueId)}`);
    const data = await response.json();

    if (data.error) {
      showError(t('loop.fetchIssueFailed') + ': ' + data.error);
      return;
    }

    const issue = data;

    // Populate form fields
    const titleInput = document.getElementById('taskTitle');
    const descInput = document.getElementById('taskDescription');

    if (titleInput) titleInput.value = issue.title || '';
    if (descInput) descInput.value = issue.context || '';

    closeIssueSelector();
    showNotification(t('loop.issueImported') + ': ' + issueId, 'success');
  } catch (err) {
    console.error('Failed to fetch issue:', err);
    showError(t('loop.fetchIssueFailed') + ': ' + err.message);
  }
}

/**
 * Add CLI step to form
 */
let stepCounter = 0;
function addCliStep() {
  const container = document.getElementById('cliStepsContainer');
  const stepIndex = stepCounter++;

  // Generate tool options dynamically
  const toolOptions = window.availableCliTools.map(tool => {
    const displayName = tool.charAt(0).toUpperCase() + tool.slice(1);
    return `<option value="${tool}">${displayName}</option>`;
  }).join('');

  const stepHtml = `
    <div class="cli-step-card" data-step="${stepIndex}">
      <div class="cli-step-header">
        <span class="step-number">
          <i data-lucide="hash" class="w-4 h-4"></i>
          <span class="step-text">${t('loop.stepLabel')} ${stepIndex + 1}</span>
        </span>
        <button type="button" class="btn btn-sm btn-text" onclick="removeCliStep(${stepIndex})" title="${t('loop.removeStep')}">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
      <div class="form-group">
        <label><i data-lucide="tag" class="w-3 h-3"></i> ${t('loop.stepId')}</label>
        <input type="text" name="step_${stepIndex}_id" required
               placeholder="${t('loop.stepIdPlaceholder')}"
               class="form-control">
      </div>
      <div class="form-row">
        <div class="form-group flex-1">
          <label><i data-lucide="wrench" class="w-3 h-3"></i> ${t('loop.tool')}</label>
          <select name="step_${stepIndex}_tool" class="form-control" onchange="updateStepFields(${stepIndex})">
            ${toolOptions}
          </select>
        </div>
        <div class="form-group flex-1">
          <label><i data-lucide="sliders-horizontal" class="w-3 h-3"></i> ${t('loop.mode')}</label>
          <select name="step_${stepIndex}_mode" class="form-control">
            <option value="analysis">Analysis</option>
            <option value="write">Write</option>
            <option value="review">Review</option>
          </select>
        </div>
      </div>
      <div class="form-group bash-only">
        <label><i data-lucide="terminal" class="w-3 h-3"></i> ${t('loop.command')}</label>
        <input type="text" name="step_${stepIndex}_command"
               placeholder="${t('loop.commandPlaceholder')}"
               class="form-control">
      </div>
      <div class="form-group">
        <label><i data-lucide="message-square" class="w-3 h-3"></i> ${t('loop.promptTemplate')}</label>
        <textarea name="step_${stepIndex}_prompt" rows="3"
                  placeholder="${t('loop.promptPlaceholder')}"
                  class="form-control"></textarea>
      </div>
      <div class="form-group">
        <label><i data-lucide="alert-triangle" class="w-3 h-3"></i> ${t('loop.onError')}</label>
        <select name="step_${stepIndex}_on_error" class="form-control">
          <option value="continue">${t('loop.continue')}</option>
          <option value="pause">${t('loop.pause')}</option>
          <option value="fail_fast">${t('loop.failFast')}</option>
        </select>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', stepHtml);
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Remove CLI step
 */
function removeCliStep(stepIndex) {
  const step = document.querySelector(`.cli-step-card[data-step="${stepIndex}"]`);
  if (step) {
    step.remove();
  }
}

/**
 * Update step fields based on tool selection
 */
function updateStepFields(stepIndex) {
  const toolSelect = document.querySelector(`select[name="step_${stepIndex}_tool"]`);
  const bashField = document.querySelector(`.cli-step-card[data-step="${stepIndex}"] .bash-only`);

  if (toolSelect && bashField) {
    if (toolSelect.value === 'bash') {
      bashField.style.display = 'block';
    } else {
      bashField.style.display = 'none';
    }
  }
}

/**
 * Handle create loop form submission
 */
async function handleCreateLoopSubmit(event) {
  event.preventDefault();

  const form = event.target;
  const formData = new FormData(form);

  // Collect CLI steps
  const cliSequence = [];
  const stepCards = document.querySelectorAll('.cli-step-card');

  stepCards.forEach(card => {
    const stepIndex = card.dataset.step;
    const tool = formData.get(`step_${stepIndex}_tool`);

    const step = {
      step_id: formData.get(`step_${stepIndex}_id`),
      tool: tool,
      mode: formData.get(`step_${stepIndex}_mode`),
      on_error: formData.get(`step_${stepIndex}_on_error`)
    };

    if (tool === 'bash') {
      step.command = formData.get(`step_${stepIndex}_command`);
    }
    if (formData.get(`step_${stepIndex}_prompt`)) {
      step.prompt_template = formData.get(`step_${stepIndex}_prompt`);
    }

    cliSequence.push(step);
  });

  // Build task object
  const task = {
    id: 'LOOP-' + Date.now(),
    title: formData.get('title'),
    status: 'active',
    meta: {
      type: 'loop',
      created_by: 'dashboard'
    },
    context: {
      requirements: [formData.get('description')],
      acceptance: []
    },
    loop_control: {
      enabled: true,
      description: formData.get('description'),
      max_iterations: parseInt(formData.get('max_iterations')),
      success_condition: formData.get('success_condition'),
      error_policy: {
        on_failure: formData.get('error_policy'),
        max_retries: parseInt(formData.get('max_retries'))
      },
      cli_sequence: cliSequence
    }
  };

  try {
    // Create task only (don't auto-start)
    const createResponse = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task)
    });
    const createResult = await createResponse.json();

    if (!createResult.success) {
      showError(t('loop.createTaskFailed') + ': ' + (createResult.error || t('common.error')));
      return;
    }

    // Task created successfully
    showNotification(t('loop.taskCreated') + ': ' + task.id, 'success');
    closeCreateLoopModal();
    // Refresh tasks list to show the new task
    await showTasksTab();
  } catch (err) {
    console.error('Create loop error:', err);
    showError(t('loop.createFailed') + ': ' + err.message);
  }
}
