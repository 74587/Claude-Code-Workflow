// ==========================================
// TASK DRAWER CORE
// ==========================================
// Core drawer functionality and main rendering functions

let currentDrawerTasks = [];

function openTaskDrawer(taskId) {
  const task = currentDrawerTasks.find(t => (t.task_id || t.id) === taskId);
  if (!task) {
    console.error('Task not found:', taskId);
    return;
  }

  document.getElementById('drawerTaskTitle').textContent = task.title || taskId;
  document.getElementById('drawerContent').innerHTML = renderTaskDrawerContent(task);
  document.getElementById('taskDetailDrawer').classList.add('open');
  document.getElementById('drawerOverlay').classList.add('active');

  // Initialize flowchart after DOM is updated
  setTimeout(() => {
    renderFullFlowchart(task.flow_control);
  }, 100);
}

function openTaskDrawerForLite(sessionId, taskId) {
  const session = liteTaskDataStore[currentSessionDetailKey];
  if (!session) return;

  const task = session.tasks?.find(t => t.id === taskId);
  if (!task) return;

  // Set current drawer tasks and session context
  currentDrawerTasks = session.tasks || [];
  window._currentDrawerSession = session;

  document.getElementById('drawerTaskTitle').textContent = task.title || taskId;
  // Use dedicated lite task drawer renderer
  document.getElementById('drawerContent').innerHTML = renderLiteTaskDrawerContent(task, session);
  document.getElementById('taskDetailDrawer').classList.add('open');
  document.getElementById('drawerOverlay').classList.add('active');
}

function closeTaskDrawer() {
  document.getElementById('taskDetailDrawer').classList.remove('open');
  document.getElementById('drawerOverlay').classList.remove('active');
}

function switchDrawerTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.drawer-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  // Update tab panels
  document.querySelectorAll('.drawer-panel').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.tab === tabName);
  });

  // Render flowchart if switching to flowchart tab
  if (tabName === 'flowchart') {
    const taskId = document.getElementById('drawerTaskTitle').textContent;
    const task = currentDrawerTasks.find(t => t.title === taskId || t.task_id === taskId);
    if (task?.flow_control) {
      setTimeout(() => renderFullFlowchart(task.flow_control), 50);
    }
  }
}

function renderTaskDrawerContent(task) {
  const fc = task.flow_control || {};

  return `
    <!-- Task Header -->
    <div class="drawer-task-header">
      <span class="task-id-badge">${escapeHtml(task.task_id || task.id || 'N/A')}</span>
      <span class="task-status-badge ${task.status || 'pending'}">${task.status || 'pending'}</span>
    </div>

    <!-- Tab Navigation -->
    <div class="drawer-tabs">
      <button class="drawer-tab active" data-tab="overview" onclick="switchDrawerTab('overview')">Overview</button>
      <button class="drawer-tab" data-tab="flowchart" onclick="switchDrawerTab('flowchart')">Flowchart</button>
      <button class="drawer-tab" data-tab="files" onclick="switchDrawerTab('files')">Files</button>
      <button class="drawer-tab" data-tab="raw" onclick="switchDrawerTab('raw')">Raw JSON</button>
    </div>

    <!-- Tab Content -->
    <div class="drawer-tab-content">
      <!-- Overview Tab (default) -->
      <div class="drawer-panel active" data-tab="overview">
        ${renderPreAnalysisSteps(fc.pre_analysis)}
        ${renderImplementationStepsList(fc.implementation_approach)}
      </div>

      <!-- Flowchart Tab -->
      <div class="drawer-panel" data-tab="flowchart">
        <div id="flowchartContainer" class="flowchart-container"></div>
      </div>

      <!-- Files Tab -->
      <div class="drawer-panel" data-tab="files">
        ${renderTargetFiles(fc.target_files)}
        ${fc.test_commands ? renderTestCommands(fc.test_commands) : ''}
      </div>

      <!-- Raw JSON Tab -->
      <div class="drawer-panel" data-tab="raw">
        <pre class="json-view">${escapeHtml(JSON.stringify(task, null, 2))}</pre>
      </div>
    </div>
  `;
}

function renderLiteTaskDrawerContent(task, session) {
  const rawTask = task._raw || task;

  return `
    <!-- Task Header -->
    <div class="drawer-task-header">
      <span class="task-id-badge">${escapeHtml(task.task_id || task.id || 'N/A')}</span>
      ${rawTask.action ? `<span class="action-badge">${escapeHtml(rawTask.action)}</span>` : ''}
    </div>

    <!-- Tab Navigation -->
    <div class="drawer-tabs">
      <button class="drawer-tab active" data-tab="overview" onclick="switchDrawerTab('overview')">Overview</button>
      <button class="drawer-tab" data-tab="implementation" onclick="switchDrawerTab('implementation')">Implementation</button>
      <button class="drawer-tab" data-tab="files" onclick="switchDrawerTab('files')">Files</button>
      <button class="drawer-tab" data-tab="raw" onclick="switchDrawerTab('raw')">Raw JSON</button>
    </div>

    <!-- Tab Content -->
    <div class="drawer-tab-content">
      <!-- Overview Tab (default) -->
      <div class="drawer-panel active" data-tab="overview">
        ${renderLiteTaskOverview(rawTask)}
      </div>

      <!-- Implementation Tab -->
      <div class="drawer-panel" data-tab="implementation">
        ${renderLiteTaskImplementation(rawTask)}
      </div>

      <!-- Files Tab -->
      <div class="drawer-panel" data-tab="files">
        ${renderLiteTaskFiles(rawTask)}
      </div>

      <!-- Raw JSON Tab -->
      <div class="drawer-panel" data-tab="raw">
        <pre class="json-view">${escapeHtml(JSON.stringify(rawTask, null, 2))}</pre>
      </div>
    </div>
  `;
}

// Render plan.json task details in drawer (for lite tasks)
function renderPlanTaskDetails(task, session) {
  if (!task) return '';

  // Get corresponding plan task if available
  const planTask = session?.plan?.tasks?.find(pt => pt.id === task.id);
  if (!planTask) {
    // Fallback: task itself might have plan-like structure
    return renderTaskImplementationDetails(task);
  }

  return renderTaskImplementationDetails(planTask);
}

function renderTaskImplementationDetails(task) {
  const sections = [];

  // Description
  if (task.description) {
    sections.push(`
      <div class="drawer-section">
        <h4 class="drawer-section-title">Description</h4>
        <p class="task-description">${escapeHtml(task.description)}</p>
      </div>
    `);
  }

  // Modification Points
  if (task.modification_points?.length) {
    sections.push(`
      <div class="drawer-section">
        <h4 class="drawer-section-title">Modification Points</h4>
        <div class="modification-points-list">
          ${task.modification_points.map(mp => `
            <div class="mod-point-item">
              <div class="mod-point-file">
                <span class="file-icon">📄</span>
                <code>${escapeHtml(mp.file || mp.path || '')}</code>
              </div>
              ${mp.target ? `<div class="mod-point-target">Target: <code>${escapeHtml(mp.target)}</code></div>` : ''}
              ${mp.change ? `<div class="mod-point-change">${escapeHtml(mp.change)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `);
  }

  // Implementation Steps
  if (task.implementation?.length) {
    sections.push(`
      <div class="drawer-section">
        <h4 class="drawer-section-title">Implementation Steps</h4>
        <ol class="implementation-steps-list">
          ${task.implementation.map(step => `
            <li class="impl-step-item">${escapeHtml(typeof step === 'string' ? step : step.step || JSON.stringify(step))}</li>
          `).join('')}
        </ol>
      </div>
    `);
  }

  // Reference
  if (task.reference) {
    sections.push(`
      <div class="drawer-section">
        <h4 class="drawer-section-title">Reference</h4>
        ${task.reference.pattern ? `<div class="ref-pattern"><strong>Pattern:</strong> ${escapeHtml(task.reference.pattern)}</div>` : ''}
        ${task.reference.files?.length ? `
          <div class="ref-files">
            <strong>Files:</strong>
            <ul>
              ${task.reference.files.map(f => `<li><code>${escapeHtml(f)}</code></li>`).join('')}
            </ul>
          </div>
        ` : ''}
        ${task.reference.examples ? `<div class="ref-examples"><strong>Examples:</strong> ${escapeHtml(task.reference.examples)}</div>` : ''}
      </div>
    `);
  }

  // Acceptance Criteria
  if (task.acceptance?.length) {
    sections.push(`
      <div class="drawer-section">
        <h4 class="drawer-section-title">Acceptance Criteria</h4>
        <ul class="acceptance-list">
          ${task.acceptance.map(a => `<li>${escapeHtml(a)}</li>`).join('')}
        </ul>
      </div>
    `);
  }

  // Dependencies
  if (task.depends_on?.length) {
    sections.push(`
      <div class="drawer-section">
        <h4 class="drawer-section-title">Dependencies</h4>
        <div class="dependencies-list">
          ${task.depends_on.map(dep => `<span class="dep-badge">${escapeHtml(dep)}</span>`).join(' ')}
        </div>
      </div>
    `);
  }

  return sections.join('');
}

// Render lite task overview
function renderLiteTaskOverview(task) {
  let sections = [];

  // Description Card
  if (task.description) {
    sections.push(`
      <div class="lite-card">
        <div class="lite-card-header">
          <span class="lite-card-icon">📝</span>
          <h4 class="lite-card-title">Description</h4>
        </div>
        <div class="lite-card-body">
          <p class="lite-description">${escapeHtml(task.description)}</p>
        </div>
      </div>
    `);
  }

  // Scope Card
  if (task.scope) {
    sections.push(`
      <div class="lite-card">
        <div class="lite-card-header">
          <span class="lite-card-icon">📂</span>
          <h4 class="lite-card-title">Scope</h4>
        </div>
        <div class="lite-card-body">
          <div class="lite-scope-box">
            <code>${escapeHtml(task.scope)}</code>
          </div>
        </div>
      </div>
    `);
  }

  // Acceptance Criteria Card
  if (task.acceptance && task.acceptance.length > 0) {
    sections.push(`
      <div class="lite-card">
        <div class="lite-card-header">
          <span class="lite-card-icon">✅</span>
          <h4 class="lite-card-title">Acceptance Criteria</h4>
          <span class="lite-count-badge">${task.acceptance.length}</span>
        </div>
        <div class="lite-card-body">
          <ul class="lite-checklist">
            ${task.acceptance.map(a => `
              <li class="lite-check-item">
                <span class="lite-check-icon">○</span>
                <span class="lite-check-text">${escapeHtml(a)}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      </div>
    `);
  }

  // Reference Card
  if (task.reference) {
    sections.push(`
      <div class="lite-card">
        <div class="lite-card-header">
          <span class="lite-card-icon">📚</span>
          <h4 class="lite-card-title">Reference</h4>
        </div>
        <div class="lite-card-body">
          ${task.reference.pattern ? `
            <div class="lite-ref-section">
              <span class="lite-ref-label">Pattern:</span>
              <span class="lite-ref-value">${escapeHtml(task.reference.pattern)}</span>
            </div>
          ` : ''}
          ${task.reference.files && task.reference.files.length > 0 ? `
            <div class="lite-ref-section">
              <span class="lite-ref-label">Files:</span>
              <div class="lite-ref-files">
                ${task.reference.files.map(f => `<code class="lite-file-tag">${escapeHtml(f)}</code>`).join('')}
              </div>
            </div>
          ` : ''}
          ${task.reference.examples ? `
            <div class="lite-ref-section">
              <span class="lite-ref-label">Examples:</span>
              <span class="lite-ref-value">${escapeHtml(task.reference.examples)}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `);
  }

  // Dependencies Card
  if (task.depends_on && task.depends_on.length > 0) {
    sections.push(`
      <div class="lite-card">
        <div class="lite-card-header">
          <span class="lite-card-icon">🔗</span>
          <h4 class="lite-card-title">Dependencies</h4>
        </div>
        <div class="lite-card-body">
          <div class="lite-deps-tags">
            ${task.depends_on.map(dep => `<span class="lite-dep-tag">${escapeHtml(dep)}</span>`).join('')}
          </div>
        </div>
      </div>
    `);
  }

  return sections.length > 0 ? sections.join('') : '<div class="empty-section">No overview data</div>';
}

// Render lite task implementation steps
function renderLiteTaskImplementation(task) {
  let sections = [];

  // Implementation Steps Card
  if (task.implementation && task.implementation.length > 0) {
    sections.push(`
      <div class="lite-card">
        <div class="lite-card-header">
          <span class="lite-card-icon">📋</span>
          <h4 class="lite-card-title">Implementation Steps</h4>
          <span class="lite-count-badge">${task.implementation.length}</span>
        </div>
        <div class="lite-card-body">
          <div class="lite-impl-steps">
            ${task.implementation.map((step, idx) => `
              <div class="lite-impl-step">
                <div class="lite-step-num">${idx + 1}</div>
                <div class="lite-step-content">
                  <p class="lite-step-text">${escapeHtml(typeof step === 'string' ? step : step.step || JSON.stringify(step))}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `);
  }

  // Modification Points Card
  if (task.modification_points && task.modification_points.length > 0) {
    sections.push(`
      <div class="lite-card">
        <div class="lite-card-header">
          <span class="lite-card-icon">🔧</span>
          <h4 class="lite-card-title">Modification Points</h4>
          <span class="lite-count-badge">${task.modification_points.length}</span>
        </div>
        <div class="lite-card-body">
          <div class="lite-mod-points">
            ${task.modification_points.map(mp => `
              <div class="lite-mod-card">
                <div class="lite-mod-header">
                  <code class="lite-mod-file">${escapeHtml(mp.file || '')}</code>
                </div>
                ${mp.target ? `
                  <div class="lite-mod-target">
                    <span class="lite-mod-label">Target:</span>
                    <span class="lite-mod-value">${escapeHtml(mp.target)}</span>
                  </div>
                ` : ''}
                ${mp.change ? `
                  <div class="lite-mod-change">${escapeHtml(mp.change)}</div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `);
  }

  return sections.length > 0 ? sections.join('') : '<div class="empty-section">No implementation data</div>';
}

// Render lite task files
function renderLiteTaskFiles(task) {
  const files = [];

  // Collect from modification_points
  if (task.modification_points) {
    task.modification_points.forEach(mp => {
      if (mp.file && !files.includes(mp.file)) files.push(mp.file);
    });
  }

  // Collect from scope
  if (task.scope && !files.includes(task.scope)) {
    files.push(task.scope);
  }

  if (files.length === 0) {
    return '<div class="empty-section">No files specified</div>';
  }

  return `
    <div class="drawer-section">
      <h4 class="drawer-section-title">Target Files</h4>
      <ul class="target-files-list">
        ${files.map(f => `
          <li class="file-item">
            <span class="file-icon">📄</span>
            <code>${escapeHtml(f)}</code>
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}
