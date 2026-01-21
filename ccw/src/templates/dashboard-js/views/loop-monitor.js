// ==========================================
// LOOP MONITOR VIEW
// ==========================================

// Loop state store for real-time updates
window.loopStateStore = {};
window.selectedLoopId = null;
window.loopWebSocket = null;
window.loopReconnectAttempts = 0;
window.loopMaxReconnectAttempts = 10;

// Status colors and icons
const loopStatusConfig = {
  created: { icon: '○', label: 'Created', className: 'text-gray-400 bg-gray-100', border: 'border-l-gray-400' },
  running: { icon: '●', label: 'Running', className: 'text-cyan-500 bg-cyan-100 animate-pulse', border: 'border-l-cyan-500' },
  paused: { icon: '⏸', label: 'Paused', className: 'text-amber-500 bg-amber-100', border: 'border-l-amber-500' },
  completed: { icon: '✓', label: 'Completed', className: 'text-emerald-500 bg-emerald-100', border: 'border-l-emerald-500' },
  failed: { icon: '✗', label: 'Failed', className: 'text-red-500 bg-red-100', border: 'border-l-red-500' }
};

/**
 * Render Loop Monitor view
 */
async function renderLoopMonitor() {
  try {
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
          <div class="panel-header">
            <h3>Loops</h3>
            <div class="header-actions">
              <button class="btn btn-secondary" onclick="showTasksTab()" title="View tasks with loop config">
                <i data-lucide="list" class="w-4 h-4"></i> Tasks
              </button>
              <button class="btn btn-primary" onclick="showCreateLoopModal()" title="Create new loop task">
                <i data-lucide="plus" class="w-4 h-4"></i> New Loop
              </button>
              <select id="loopFilter" class="filter-select" onchange="filterLoops()">
                <option value="all">All</option>
                <option value="running">Running</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
          <div class="loop-list" id="loopList">
            <div class="loading-spinner">Loading loops...</div>
          </div>
        </div>

        <!-- Loop Detail -->
        <div class="loop-detail-panel" id="loopDetailPanel">
          <div class="empty-detail-state">
            <i data-lucide="activity" class="w-12 h-12"></i>
            <p>Select a loop to view details</p>
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
    showError('Failed to load loops: ' + (err.message || String(err)));
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
 * Load all loops from API
 */
async function loadLoops() {
  try {
    const response = await fetch('/api/loops');
    const result = await response.json();

    if (result.success) {
      result.data.forEach(loop => {
        window.loopStateStore[loop.loop_id] = loop;
      });
      renderLoopList();
    } else {
      showError('Failed to load loops: ' + (result.error || 'Unknown error'));
    }
  } catch (err) {
    console.error('Load loops error:', err);
    showError('Failed to load loops: ' + err.message);
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
        <i data-lucide="inbox" class="w-10 h-10"></i>
        <p>No loops found</p>
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

  return `
    <div class="loop-card ${config.border} ${isSelected ? 'selected' : ''}"
         onclick="selectLoop('${loop.loop_id}')">
      <div class="loop-card-header">
        <span class="loop-status-indicator ${config.className}">${config.icon}</span>
        <span class="loop-title">${escapeHtml(loop.loop_id)}</span>
      </div>
      <div class="loop-card-body">
        <div class="loop-meta">
          <span class="loop-task-id">Task: ${escapeHtml(loop.task_id || 'N/A')}</span>
          <span class="loop-status-text">${config.label}</span>
        </div>
        <div class="loop-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
          <span class="progress-text">${loop.current_iteration}/${loop.max_iterations} (${progress}%)</span>
        </div>
        <div class="loop-step-info">
          Step: ${loop.current_cli_step + 1}/${loop.cli_sequence?.length || 0}
        </div>
        <div class="loop-time">
          Updated: ${formatRelativeTime(loop.updated_at)}
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
        <i data-lucide="alert-circle" class="w-10 h-10"></i>
        <p>Loop not found</p>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  const config = loopStatusConfig[loop.status] || loopStatusConfig.created;
  const iterProgress = loop.max_iterations > 0
    ? Math.round((loop.current_iteration / loop.max_iterations) * 100)
    : 0;
  const stepProgress = loop.cli_sequence?.length > 0
    ? Math.round(((loop.current_cli_step + 1) / loop.cli_sequence.length) * 100)
    : 0;

  container.innerHTML = `
    <div class="loop-detail">
      <!-- Header -->
      <div class="detail-header">
        <div class="detail-status ${config.className}">
          <span class="status-icon">${config.icon}</span>
          <span class="status-label">${config.label}</span>
        </div>
        <div class="detail-actions">
          ${loop.status === 'running' ? `
            <button class="btn btn-warning" onclick="pauseLoop('${loop.loop_id}')">
              <i data-lucide="pause" class="w-4 h-4"></i> Pause
            </button>
          ` : ''}
          ${loop.status === 'paused' ? `
            <button class="btn btn-success" onclick="resumeLoop('${loop.loop_id}')">
              <i data-lucide="play" class="w-4 h-4"></i> Resume
            </button>
          ` : ''}
          ${(loop.status === 'running' || loop.status === 'paused') ? `
            <button class="btn btn-danger" onclick="confirmStopLoop('${loop.loop_id}')">
              <i data-lucide="stop-circle" class="w-4 h-4"></i> Stop
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Info -->
      <div class="detail-info">
        <h3 class="detail-title">${escapeHtml(loop.loop_id)}</h3>
        <div class="detail-meta">
          <span><i data-lucide="calendar" class="w-4 h-4"></i> Created: ${formatDateTime(loop.created_at)}</span>
          <span><i data-lucide="clock" class="w-4 h-4"></i> Updated: ${formatRelativeTime(loop.updated_at)}</span>
          <span><i data-lucide="list" class="w-4 h-4"></i> Task: ${escapeHtml(loop.task_id || 'N/A')}</span>
        </div>
      </div>

      <!-- Progress -->
      <div class="detail-section">
        <h4>Progress</h4>
        <div class="progress-group">
          <div class="progress-item">
            <label>Iteration</label>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${iterProgress}%"></div>
            </div>
            <span class="progress-text">${loop.current_iteration}/${loop.max_iterations} (${iterProgress}%)</span>
          </div>
          <div class="progress-item">
            <label>Current Step</label>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${stepProgress}%"></div>
            </div>
            <span class="progress-text">${loop.current_cli_step + 1}/${loop.cli_sequence?.length || 0}</span>
          </div>
        </div>
      </div>

      <!-- CLI Sequence -->
      <div class="detail-section">
        <h4>CLI Sequence</h4>
        <div class="cli-sequence">
          ${(loop.cli_sequence || []).map((step, index) => {
            const isCurrent = index === loop.current_cli_step;
            const isPast = index < loop.current_cli_step;
            const stepStatus = isCurrent ? 'current' : (isPast ? 'completed' : 'pending');

            return `
              <div class="cli-step ${stepStatus}">
                <div class="step-marker">${isPast ? '✓' : (isCurrent ? '●' : index + 1)}</div>
                <div class="step-content">
                  <div class="step-name">${escapeHtml(step.tool || 'unknown')}</div>
                  <div class="step-prompt">${escapeHtml(step.prompt?.substring(0, 100) || '')}${step.prompt?.length > 100 ? '...' : ''}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Variables -->
      ${Object.keys(loop.state_variables || {}).length > 0 ? `
        <div class="detail-section">
          <h4>State Variables</h4>
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
          <h4>Execution History</h4>
          <div class="execution-timeline">
            ${renderExecutionTimeline(loop)}
          </div>
        </div>
      ` : ''}

      <!-- Error -->
      ${loop.failure_reason ? `
        <div class="detail-section error-section">
          <h4>Failure Reason</h4>
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
            <span class="iteration-marker">${isCurrent ? '●' : '✓'}</span>
            <span>Iteration ${iter}</span>
          </div>
          <div class="iteration-steps">
            ${records.map(record => `
              <div class="timeline-step">
                <div class="step-status ${record.success ? 'success' : 'failed'}">
                  ${record.success ? '✓' : '✗'}
                </div>
                <div class="step-info">
                  <div class="step-tool">${escapeHtml(sequence[record.step_index]?.tool || 'unknown')}</div>
                  <div class="step-time">${formatDateTime(record.started_at)}</div>
                  <div class="step-duration">${record.duration_ms}ms</div>
                  ${!record.success && record.error ? `
                    <div class="step-error">${escapeHtml(record.error)}</div>
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
 * Pause loop
 */
async function pauseLoop(loopId) {
  try {
    const response = await fetch(`/api/loops/${loopId}/pause`, { method: 'POST' });
    const result = await response.json();

    if (result.success) {
      showNotification('Loop paused', 'success');
      await loadLoops();
    } else {
      showError('Failed to pause: ' + (result.error || 'Unknown error'));
    }
  } catch (err) {
    console.error('Pause loop error:', err);
    showError('Failed to pause: ' + err.message);
  }
}

/**
 * Resume loop
 */
async function resumeLoop(loopId) {
  try {
    const response = await fetch(`/api/loops/${loopId}/resume`, { method: 'POST' });
    const result = await response.json();

    if (result.success) {
      showNotification('Loop resumed', 'success');
      await loadLoops();
    } else {
      showError('Failed to resume: ' + (result.error || 'Unknown error'));
    }
  } catch (err) {
    console.error('Resume loop error:', err);
    showError('Failed to resume: ' + err.message);
  }
}

/**
 * Confirm and stop loop
 */
function confirmStopLoop(loopId) {
  const loop = window.loopStateStore[loopId];
  if (!loop) return;

  if (confirm(`Stop loop ${loopId}?\n\nIteration: ${loop.current_iteration}/${loop.max_iterations}\nThis action cannot be undone.`)) {
    stopLoop(loopId);
  }
}

/**
 * Stop loop
 */
async function stopLoop(loopId) {
  try {
    const response = await fetch(`/api/loops/${loopId}/stop`, { method: 'POST' });
    const result = await response.json();

    if (result.success) {
      showNotification('Loop stopped', 'success');
      await loadLoops();
    } else {
      showError('Failed to stop: ' + (result.error || 'Unknown error'));
    }
  } catch (err) {
    console.error('Stop loop error:', err);
    showError('Failed to stop: ' + err.message);
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

  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
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
      showError('Failed to load tasks: ' + (result.error || 'Unknown error'));
      return;
    }

    const tasks = result.data || [];
    const loopEnabledTasks = tasks.filter(t => t.loop_control && t.loop_control.enabled);

    renderTasksList(loopEnabledTasks);
  } catch (err) {
    console.error('Load tasks error:', err);
    showError('Failed to load tasks: ' + err.message);
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
        <p>No loop-enabled tasks found</p>
        <button class="btn btn-primary mt-4" onclick="showCreateLoopModal()">
          <i data-lucide="plus" class="w-4 h-4"></i> Create Loop Task
        </button>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  listContainer.innerHTML = `
    <div class="tasks-list-header">
      <p class="text-sm text-gray-500">${tasks.length} task(s) with loop enabled</p>
      <button class="btn btn-sm btn-secondary" onclick="loadLoops()">
        <i data-lucide="arrow-left" class="w-4 h-4"></i> Back to Loops
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
    <div class="task-card">
      <div class="task-card-header">
        <span class="task-title">${escapeHtml(task.title || task.id)}</span>
        <span class="task-id">${escapeHtml(task.id)}</span>
      </div>
      <div class="task-card-body">
        <p class="task-description">${escapeHtml(config.description || 'No description')}</p>
        <div class="task-meta">
          <span><i data-lucide="repeat" class="w-4 h-4"></i> Max: ${config.max_iterations || 10}</span>
          <span><i data-lucide="list" class="w-4 h-4"></i> Steps: ${stepCount}</span>
        </div>
        <button class="btn btn-primary w-full mt-3" onclick="startLoopFromTask('${task.id}')">
          <i data-lucide="play" class="w-4 h-4"></i> Start Loop
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
      showNotification('Loop started: ' + result.data.loopId, 'success');
      await loadLoops(); // Refresh to show new loop
    } else {
      showError('Failed to start loop: ' + (result.error || 'Unknown error'));
    }
  } catch (err) {
    console.error('Start loop error:', err);
    showError('Failed to start loop: ' + err.message);
  }
}

/**
 * Show create loop modal
 */
function showCreateLoopModal() {
  const modal = document.createElement('div');
  modal.id = 'createLoopModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content modal-lg">
      <div class="modal-header">
        <h3>Create Loop Task</h3>
        <button class="modal-close" onclick="closeCreateLoopModal()">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      <div class="modal-body">
        <form id="createLoopForm" onsubmit="handleCreateLoopSubmit(event)">
          <!-- Basic Info -->
          <div class="form-section">
            <h4>Basic Information</h4>
            <div class="form-group">
              <label for="taskTitle">Task Title</label>
              <input type="text" id="taskTitle" name="title" required
                     placeholder="e.g., Auto Test Fix Loop"
                     class="form-control">
            </div>
            <div class="form-group">
              <label for="taskDescription">Description</label>
              <textarea id="taskDescription" name="description" rows="2"
                        placeholder="Describe what this loop does..."
                        class="form-control"></textarea>
            </div>
          </div>

          <!-- Loop Configuration -->
          <div class="form-section">
            <h4>Loop Configuration</h4>
            <div class="form-row">
              <div class="form-group flex-1">
                <label for="maxIterations">Max Iterations</label>
                <input type="number" id="maxIterations" name="max_iterations" value="10" min="1" max="100"
                       class="form-control">
              </div>
              <div class="form-group flex-1">
                <label for="errorPolicy">Error Policy</label>
                <select id="errorPolicy" name="error_policy" class="form-control">
                  <option value="pause">Pause on error</option>
                  <option value="retry">Retry automatically</option>
                  <option value="fail_fast">Fail immediately</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label for="maxRetries">Max Retries (for retry policy)</label>
              <input type="number" id="maxRetries" name="max_retries" value="3" min="0" max="10"
                     class="form-control">
            </div>
            <div class="form-group">
              <label for="successCondition">Success Condition (JavaScript expression)</label>
              <input type="text" id="successCondition" name="success_condition"
                     placeholder="e.g., state_variables.test_stdout.includes('passed')"
                     class="form-control">
              <small class="text-gray-500">
                Available: state_variables, current_iteration
              </small>
            </div>
          </div>

          <!-- CLI Sequence -->
          <div class="form-section">
            <div class="flex justify-between items-center mb-3">
              <h4>CLI Sequence</h4>
              <button type="button" class="btn btn-sm btn-secondary" onclick="addCliStep()">
                <i data-lucide="plus" class="w-4 h-4"></i> Add Step
              </button>
            </div>
            <div id="cliStepsContainer">
              <!-- Steps will be added here -->
            </div>
          </div>

          <!-- Form Actions -->
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeCreateLoopModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">
              <i data-lucide="check" class="w-4 h-4"></i> Create & Start Loop
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
 * Close create loop modal
 */
function closeCreateLoopModal() {
  const modal = document.getElementById('createLoopModal');
  if (modal) {
    modal.remove();
  }
}

/**
 * Add CLI step to form
 */
let stepCounter = 0;
function addCliStep() {
  const container = document.getElementById('cliStepsContainer');
  const stepIndex = stepCounter++;

  const stepHtml = `
    <div class="cli-step-card" data-step="${stepIndex}">
      <div class="cli-step-header">
        <span class="step-number">Step ${stepIndex + 1}</span>
        <button type="button" class="btn btn-sm btn-text" onclick="removeCliStep(${stepIndex})" title="Remove step">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
      <div class="form-group">
        <label>Step ID</label>
        <input type="text" name="step_${stepIndex}_id" required
               placeholder="e.g., run_tests"
               class="form-control">
      </div>
      <div class="form-row">
        <div class="form-group flex-1">
          <label>Tool</label>
          <select name="step_${stepIndex}_tool" class="form-control" onchange="updateStepFields(${stepIndex})">
            <option value="bash">Bash</option>
            <option value="gemini">Gemini</option>
            <option value="codex">Codex</option>
            <option value="qwen">Qwen</option>
          </select>
        </div>
        <div class="form-group flex-1">
          <label>Mode</label>
          <select name="step_${stepIndex}_mode" class="form-control">
            <option value="analysis">Analysis</option>
            <option value="write">Write</option>
            <option value="review">Review</option>
          </select>
        </div>
      </div>
      <div class="form-group bash-only">
        <label>Command</label>
        <input type="text" name="step_${stepIndex}_command"
               placeholder="e.g., npm test"
               class="form-control">
      </div>
      <div class="form-group">
        <label>Prompt Template (supports [variable_name] substitution)</label>
        <textarea name="step_${stepIndex}_prompt" rows="3"
                  placeholder="Enter prompt template..."
                  class="form-control"></textarea>
      </div>
      <div class="form-group">
        <label>On Error</label>
        <select name="step_${stepIndex}_on_error" class="form-control">
          <option value="continue">Continue</option>
          <option value="pause">Pause</option>
          <option value="fail_fast">Fail Fast</option>
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
    // Create task
    const createResponse = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task)
    });
    const createResult = await createResponse.json();

    if (!createResult.success) {
      showError('Failed to create task: ' + (createResult.error || 'Unknown error'));
      return;
    }

    // Start loop
    const startResponse = await fetch('/api/loops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: task.id })
    });
    const startResult = await startResponse.json();

    if (startResult.success) {
      showNotification('Loop created and started: ' + startResult.data.loopId, 'success');
      closeCreateLoopModal();
      await loadLoops(); // Refresh to show new loop
    } else {
      showError('Task created but failed to start loop: ' + (startResult.error || 'Unknown error'));
    }
  } catch (err) {
    console.error('Create loop error:', err);
    showError('Failed to create loop: ' + err.message);
  }
}
