// ============================================
// LITE TASKS VIEW
// ============================================
// Lite-plan and lite-fix task list and detail rendering

function renderLiteTasks() {
  const container = document.getElementById('mainContent');

  const liteTasks = workflowData.liteTasks || {};
  const sessions = currentLiteType === 'lite-plan'
    ? liteTasks.litePlan || []
    : liteTasks.liteFix || [];

  if (sessions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="zap" class="w-12 h-12"></i></div>
        <div class="empty-title">No ${currentLiteType} Sessions</div>
        <div class="empty-text">No sessions found in .workflow/.${currentLiteType}/</div>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  container.innerHTML = `<div class="sessions-grid">${sessions.map(session => renderLiteTaskCard(session)).join('')}</div>`;
  
  // Initialize Lucide icons
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Initialize collapsible sections
  document.querySelectorAll('.collapsible-header').forEach(header => {
    header.addEventListener('click', () => toggleSection(header));
  });

  // Render flowcharts for expanded tasks
  sessions.forEach(session => {
    session.tasks?.forEach(task => {
      if (task.flow_control?.implementation_approach) {
        renderFlowchartForTask(session.id, task);
      }
    });
  });
}

function renderLiteTaskCard(session) {
  const tasks = session.tasks || [];

  // Store session data for detail page
  const sessionKey = `lite-${session.type}-${session.id}`.replace(/[^a-zA-Z0-9-]/g, '-');
  liteTaskDataStore[sessionKey] = session;

  return `
    <div class="session-card lite-task-card" onclick="showLiteTaskDetailPage('${sessionKey}')" style="cursor: pointer;">
      <div class="session-header">
        <div class="session-title">${escapeHtml(session.id)}</div>
        <span class="session-status ${session.type}">
          ${session.type === 'lite-plan' ? '<i data-lucide="file-edit" class="w-3 h-3 inline"></i> PLAN' : '<i data-lucide="wrench" class="w-3 h-3 inline"></i> FIX'}
        </span>
      </div>
      <div class="session-body">
        <div class="session-meta">
          <span class="session-meta-item"><i data-lucide="calendar" class="w-3.5 h-3.5 inline mr-1"></i>${formatDate(session.createdAt)}</span>
          <span class="session-meta-item"><i data-lucide="list-checks" class="w-3.5 h-3.5 inline mr-1"></i>${tasks.length} tasks</span>
        </div>
      </div>
    </div>
  `;
}

// Lite Task Detail Page
function showLiteTaskDetailPage(sessionKey) {
  const session = liteTaskDataStore[sessionKey];
  if (!session) return;

  currentView = 'liteTaskDetail';
  currentSessionDetailKey = sessionKey;

  // Hide stats grid and carousel on detail pages
  hideStatsAndCarousel();

  // Also store in sessionDataStore for tab switching compatibility
  sessionDataStore[sessionKey] = {
    ...session,
    session_id: session.id,
    created_at: session.createdAt,
    path: session.path,
    type: session.type
  };

  const container = document.getElementById('mainContent');
  const tasks = session.tasks || [];
  const plan = session.plan || {};
  const progress = session.progress || { total: 0, completed: 0, percentage: 0 };

  const completed = tasks.filter(t => t.status === 'completed').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const pending = tasks.filter(t => t.status === 'pending').length;

  container.innerHTML = `
    <div class="session-detail-page lite-task-detail-page">
      <!-- Header -->
      <div class="detail-header">
        <button class="btn-back" onclick="goBackToLiteTasks()">
          <span class="back-icon">←</span>
          <span>Back to ${session.type === 'lite-plan' ? 'Lite Plan' : 'Lite Fix'}</span>
        </button>
        <div class="detail-title-row">
          <h2 class="detail-session-id">${session.type === 'lite-plan' ? '<i data-lucide="file-edit" class="w-5 h-5 inline mr-2"></i>' : '<i data-lucide="wrench" class="w-5 h-5 inline mr-2"></i>'} ${escapeHtml(session.id)}</h2>
          <div class="detail-badges">
            <span class="session-type-badge ${session.type}">${session.type}</span>
          </div>
        </div>
      </div>

      <!-- Session Info Bar -->
      <div class="detail-info-bar">
        <div class="info-item">
          <span class="info-label">Created:</span>
          <span class="info-value">${formatDate(session.createdAt)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Tasks:</span>
          <span class="info-value">${tasks.length} tasks</span>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="detail-tabs">
        <button class="detail-tab active" data-tab="tasks" onclick="switchLiteDetailTab('tasks')">
          <span class="tab-icon"><i data-lucide="list-checks" class="w-4 h-4"></i></span>
          <span class="tab-text">Tasks</span>
          <span class="tab-count">${tasks.length}</span>
        </button>
        <button class="detail-tab" data-tab="plan" onclick="switchLiteDetailTab('plan')">
          <span class="tab-icon"><i data-lucide="ruler" class="w-4 h-4"></i></span>
          <span class="tab-text">Plan</span>
        </button>
        ${session.type === 'lite-fix' ? `
        <button class="detail-tab" data-tab="diagnoses" onclick="switchLiteDetailTab('diagnoses')">
          <span class="tab-icon"><i data-lucide="stethoscope" class="w-4 h-4"></i></span>
          <span class="tab-text">Diagnoses</span>
          ${session.diagnoses?.items?.length ? `<span class="tab-count">${session.diagnoses.items.length}</span>` : ''}
        </button>
        ` : ''}
        <button class="detail-tab" data-tab="context" onclick="switchLiteDetailTab('context')">
          <span class="tab-icon"><i data-lucide="package" class="w-4 h-4"></i></span>
          <span class="tab-text">Context</span>
        </button>
        <button class="detail-tab" data-tab="summary" onclick="switchLiteDetailTab('summary')">
          <span class="tab-icon"><i data-lucide="file-text" class="w-4 h-4"></i></span>
          <span class="tab-text">Summary</span>
        </button>
      </div>

      <!-- Tab Content -->
      <div class="detail-tab-content" id="liteDetailTabContent">
        ${renderLiteTasksTab(session, tasks, completed, inProgress, pending)}
      </div>
    </div>
  `;

  // Initialize collapsible sections
  setTimeout(() => {
    document.querySelectorAll('.collapsible-header').forEach(header => {
      header.addEventListener('click', () => toggleSection(header));
    });
  }, 50);
}

function goBackToLiteTasks() {
  currentView = 'liteTasks';
  currentSessionDetailKey = null;
  updateContentTitle();
  showStatsAndSearch();
  renderLiteTasks();
}

function switchLiteDetailTab(tabName) {
  // Update active tab
  document.querySelectorAll('.detail-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  const session = liteTaskDataStore[currentSessionDetailKey];
  if (!session) return;

  const contentArea = document.getElementById('liteDetailTabContent');
  const tasks = session.tasks || [];
  const completed = tasks.filter(t => t.status === 'completed').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const pending = tasks.filter(t => t.status === 'pending').length;

  switch (tabName) {
    case 'tasks':
      contentArea.innerHTML = renderLiteTasksTab(session, tasks, completed, inProgress, pending);
      // Re-initialize collapsible sections
      setTimeout(() => {
        document.querySelectorAll('.collapsible-header').forEach(header => {
          header.addEventListener('click', () => toggleSection(header));
        });
      }, 50);
      break;
    case 'plan':
      contentArea.innerHTML = renderLitePlanTab(session);
      // Re-initialize collapsible sections for plan tab
      setTimeout(() => {
        initCollapsibleSections(contentArea);
      }, 50);
      break;
    case 'diagnoses':
      contentArea.innerHTML = renderDiagnosesTab(session);
      // Re-initialize collapsible sections for diagnoses tab
      setTimeout(() => {
        initCollapsibleSections(contentArea);
      }, 50);
      break;
    case 'context':
      loadAndRenderLiteContextTab(session, contentArea);
      break;
    case 'summary':
      loadAndRenderLiteSummaryTab(session, contentArea);
      break;
  }
}

function renderLiteTasksTab(session, tasks, completed, inProgress, pending) {
  // Populate drawer tasks for click-to-open functionality
  currentDrawerTasks = tasks;

  if (tasks.length === 0) {
    return `
      <div class="tab-empty-state">
        <div class="empty-icon"><i data-lucide="clipboard-list" class="w-12 h-12"></i></div>
        <div class="empty-title">No Tasks</div>
        <div class="empty-text">This session has no tasks defined.</div>
      </div>
    `;
  }

  return `
    <div class="tasks-tab-content">
      <div class="tasks-list" id="liteTasksListContent">
        ${tasks.map(task => renderLiteTaskDetailItem(session.id, task)).join('')}
      </div>
    </div>
  `;
}

function renderLiteTaskDetailItem(sessionId, task) {
  const rawTask = task._raw || task;
  const taskJsonId = `task-json-${sessionId}-${task.id}`.replace(/[^a-zA-Z0-9-]/g, '-');
  taskJsonStore[taskJsonId] = rawTask;

  // Get preview info for lite tasks
  const action = rawTask.action || '';
  const scope = rawTask.scope || '';
  const modCount = rawTask.modification_points?.length || 0;
  const implCount = rawTask.implementation?.length || 0;
  const acceptCount = rawTask.acceptance?.length || 0;

  return `
    <div class="detail-task-item-full lite-task-item" onclick="openTaskDrawerForLite('${sessionId}', '${escapeHtml(task.id)}')" style="cursor: pointer;" title="Click to view details">
      <div class="task-item-header-lite">
        <span class="task-id-badge">${escapeHtml(task.id)}</span>
        <span class="task-title">${escapeHtml(task.title || 'Untitled')}</span>
        <button class="btn-view-json" onclick="event.stopPropagation(); showJsonModal('${taskJsonId}', '${escapeHtml(task.id)}')">{ } JSON</button>
      </div>
      <div class="task-item-meta-lite">
        ${action ? `<span class="meta-badge action">${escapeHtml(action)}</span>` : ''}
        ${scope ? `<span class="meta-badge scope">${escapeHtml(scope)}</span>` : ''}
        ${modCount > 0 ? `<span class="meta-badge mods">${modCount} mods</span>` : ''}
        ${implCount > 0 ? `<span class="meta-badge impl">${implCount} steps</span>` : ''}
        ${acceptCount > 0 ? `<span class="meta-badge accept">${acceptCount} acceptance</span>` : ''}
      </div>
    </div>
  `;
}

function getMetaPreviewForLite(task, rawTask) {
  const meta = task.meta || {};
  const parts = [];
  if (meta.type || rawTask.action) parts.push(meta.type || rawTask.action);
  if (meta.scope || rawTask.scope) parts.push(meta.scope || rawTask.scope);
  return parts.join(' | ') || 'No meta';
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

function renderLitePlanTab(session) {
  const plan = session.plan;
  const isFixPlan = session.type === 'lite-fix';

  if (!plan) {
    return `
      <div class="tab-empty-state">
        <div class="empty-icon"><i data-lucide="ruler" class="w-12 h-12"></i></div>
        <div class="empty-title">No Plan Data</div>
        <div class="empty-text">No ${isFixPlan ? 'fix-plan.json' : 'plan.json'} found for this session.</div>
      </div>
    `;
  }

  return `
    <div class="plan-tab-content">
      <!-- Summary -->
      ${plan.summary ? `
        <div class="plan-section">
          <h4 class="plan-section-title"><i data-lucide="clipboard-list" class="w-4 h-4 inline mr-1"></i> Summary</h4>
          <p class="plan-summary-text">${escapeHtml(plan.summary)}</p>
        </div>
      ` : ''}

      <!-- Root Cause (fix-plan specific) -->
      ${plan.root_cause ? `
        <div class="plan-section">
          <h4 class="plan-section-title"><i data-lucide="search" class="w-4 h-4 inline mr-1"></i> Root Cause</h4>
          <p class="plan-root-cause-text">${escapeHtml(plan.root_cause)}</p>
        </div>
      ` : ''}

      <!-- Strategy (fix-plan specific) -->
      ${plan.strategy ? `
        <div class="plan-section">
          <h4 class="plan-section-title"><i data-lucide="route" class="w-4 h-4 inline mr-1"></i> Fix Strategy</h4>
          <p class="plan-strategy-text">${escapeHtml(plan.strategy)}</p>
        </div>
      ` : ''}

      <!-- Approach -->
      ${plan.approach ? `
        <div class="plan-section">
          <h4 class="plan-section-title"><i data-lucide="target" class="w-4 h-4 inline mr-1"></i> Approach</h4>
          <p class="plan-approach-text">${escapeHtml(plan.approach)}</p>
        </div>
      ` : ''}

      <!-- User Requirements (fix-plan specific) -->
      ${plan.user_requirements ? `
        <div class="plan-section">
          <h4 class="plan-section-title"><i data-lucide="user" class="w-4 h-4 inline mr-1"></i> User Requirements</h4>
          <p class="plan-requirements-text">${escapeHtml(plan.user_requirements)}</p>
        </div>
      ` : ''}

      <!-- Focus Paths -->
      ${plan.focus_paths?.length ? `
        <div class="plan-section">
          <h4 class="plan-section-title"><i data-lucide="folder" class="w-4 h-4 inline mr-1"></i> Focus Paths</h4>
          <div class="path-tags">
            ${plan.focus_paths.map(p => `<span class="path-tag">${escapeHtml(p)}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Metadata -->
      <div class="plan-section">
        <h4 class="plan-section-title"><i data-lucide="info" class="w-4 h-4 inline mr-1"></i> Metadata</h4>
        <div class="plan-meta-grid">
          ${plan.severity ? `<div class="meta-item"><span class="meta-label">Severity:</span> <span class="severity-badge ${escapeHtml(plan.severity)}">${escapeHtml(plan.severity)}</span></div>` : ''}
          ${plan.risk_level ? `<div class="meta-item"><span class="meta-label">Risk Level:</span> <span class="risk-badge ${escapeHtml(plan.risk_level)}">${escapeHtml(plan.risk_level)}</span></div>` : ''}
          ${plan.estimated_time ? `<div class="meta-item"><span class="meta-label">Estimated Time:</span> ${escapeHtml(plan.estimated_time)}</div>` : ''}
          ${plan.complexity ? `<div class="meta-item"><span class="meta-label">Complexity:</span> ${escapeHtml(plan.complexity)}</div>` : ''}
          ${plan.recommended_execution ? `<div class="meta-item"><span class="meta-label">Execution:</span> ${escapeHtml(plan.recommended_execution)}</div>` : ''}
        </div>
      </div>

      <!-- Fix Tasks Summary (fix-plan specific) -->
      ${plan.tasks?.length ? `
        <div class="plan-section">
          <h4 class="plan-section-title"><i data-lucide="list-checks" class="w-4 h-4 inline mr-1"></i> Fix Tasks (${plan.tasks.length})</h4>
          <div class="fix-tasks-summary">
            ${plan.tasks.map((task, idx) => `
              <div class="fix-task-summary-item collapsible-section">
                <div class="collapsible-header">
                  <span class="collapse-icon">▶</span>
                  <span class="task-num">#${idx + 1}</span>
                  <span class="task-title-brief">${escapeHtml(task.title || task.summary || 'Untitled')}</span>
                  ${task.scope ? `<span class="task-scope-badge">${escapeHtml(task.scope)}</span>` : ''}
                </div>
                <div class="collapsible-content collapsed">
                  ${task.modification_points?.length ? `
                    <div class="task-detail-section">
                      <strong>Modification Points:</strong>
                      <ul class="mod-points-list">
                        ${task.modification_points.map(mp => `
                          <li>
                            <code>${escapeHtml(mp.file || '')}</code>
                            ${mp.function_name ? `<span class="func-name">→ ${escapeHtml(mp.function_name)}</span>` : ''}
                            ${mp.change_type ? `<span class="change-type">(${escapeHtml(mp.change_type)})</span>` : ''}
                          </li>
                        `).join('')}
                      </ul>
                    </div>
                  ` : ''}
                  ${task.implementation?.length ? `
                    <div class="task-detail-section">
                      <strong>Implementation Steps:</strong>
                      <ol class="impl-steps-list">
                        ${task.implementation.map(step => `<li>${escapeHtml(step)}</li>`).join('')}
                      </ol>
                    </div>
                  ` : ''}
                  ${task.verification?.length ? `
                    <div class="task-detail-section">
                      <strong>Verification:</strong>
                      <ul class="verify-list">
                        ${task.verification.map(v => `<li>${escapeHtml(v)}</li>`).join('')}
                      </ul>
                    </div>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Raw JSON -->
      <div class="plan-section collapsible-section">
        <div class="collapsible-header">
          <span class="collapse-icon">▶</span>
          <span class="section-label">{ } Raw JSON</span>
        </div>
        <div class="collapsible-content collapsed">
          <pre class="json-content">${escapeHtml(JSON.stringify(plan, null, 2))}</pre>
        </div>
      </div>
    </div>
  `;
}

async function loadAndRenderLiteContextTab(session, contentArea) {
  contentArea.innerHTML = '<div class="tab-loading">Loading context data...</div>';

  try {
    if (window.SERVER_MODE && session.path) {
      const response = await fetch(`/api/session-detail?path=${encodeURIComponent(session.path)}&type=context`);
      if (response.ok) {
        const data = await response.json();
        contentArea.innerHTML = renderLiteContextContent(data.context, data.explorations, session);
        
        // Re-initialize collapsible sections for explorations (scoped to contentArea)
        initCollapsibleSections(contentArea);
        return;
      }
    }
    // Fallback: show plan context if available
    contentArea.innerHTML = renderLiteContextContent(null, null, session);
    initCollapsibleSections(contentArea);
  } catch (err) {
    contentArea.innerHTML = `<div class="tab-error">Failed to load context: ${err.message}</div>`;
  }
}

async function loadAndRenderLiteSummaryTab(session, contentArea) {
  contentArea.innerHTML = '<div class="tab-loading">Loading summaries...</div>';

  try {
    if (window.SERVER_MODE && session.path) {
      const response = await fetch(`/api/session-detail?path=${encodeURIComponent(session.path)}&type=summary`);
      if (response.ok) {
        const data = await response.json();
        contentArea.innerHTML = renderSummaryContent(data.summaries);
        return;
      }
    }
    // Fallback
    contentArea.innerHTML = `
      <div class="tab-empty-state">
        <div class="empty-icon"><i data-lucide="file-text" class="w-12 h-12"></i></div>
        <div class="empty-title">No Summaries</div>
        <div class="empty-text">No summaries found in .summaries/</div>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (err) {
    contentArea.innerHTML = `<div class="tab-error">Failed to load summaries: ${err.message}</div>`;
  }
}

// ============================================
// DIAGNOSES TAB RENDERING (lite-fix specific)
// ============================================

function renderDiagnosesTab(session) {
  const diagnoses = session.diagnoses;

  if (!diagnoses || (!diagnoses.manifest && diagnoses.items?.length === 0)) {
    return `
      <div class="tab-empty-state">
        <div class="empty-icon"><i data-lucide="stethoscope" class="w-12 h-12"></i></div>
        <div class="empty-title">No Diagnoses</div>
        <div class="empty-text">No diagnosis-*.json files found for this session.</div>
      </div>
    `;
  }

  let sections = [];

  // Manifest summary (if available)
  if (diagnoses.manifest) {
    sections.push(`
      <div class="diagnoses-manifest-section">
        <h4 class="diagnoses-section-title"><i data-lucide="clipboard-check" class="w-4 h-4 inline mr-1"></i> Diagnosis Summary</h4>
        <div class="manifest-meta-grid">
          ${diagnoses.manifest.total_diagnoses ? `<div class="meta-item"><span class="meta-label">Total Diagnoses:</span> ${diagnoses.manifest.total_diagnoses}</div>` : ''}
          ${diagnoses.manifest.diagnosis_angles ? `<div class="meta-item"><span class="meta-label">Angles:</span> ${diagnoses.manifest.diagnosis_angles.join(', ')}</div>` : ''}
          ${diagnoses.manifest.created_at ? `<div class="meta-item"><span class="meta-label">Created:</span> ${formatDate(diagnoses.manifest.created_at)}</div>` : ''}
        </div>
      </div>
    `);
  }

  // Individual diagnosis items
  if (diagnoses.items && diagnoses.items.length > 0) {
    const diagnosisCards = diagnoses.items.map(diag => renderDiagnosisCard(diag)).join('');
    sections.push(`
      <div class="diagnoses-items-section">
        <h4 class="diagnoses-section-title"><i data-lucide="search" class="w-4 h-4 inline mr-1"></i> Diagnosis Details (${diagnoses.items.length})</h4>
        <div class="diagnoses-grid">
          ${diagnosisCards}
        </div>
      </div>
    `);
  }

  return `<div class="diagnoses-tab-content">${sections.join('')}</div>`;
}

function renderDiagnosisCard(diag) {
  const diagJsonId = `diag-json-${diag.id}`.replace(/[^a-zA-Z0-9-]/g, '-');
  taskJsonStore[diagJsonId] = diag;

  return `
    <div class="diagnosis-card collapsible-section">
      <div class="collapsible-header diagnosis-header">
        <span class="collapse-icon">▶</span>
        <span class="diagnosis-id"><i data-lucide="file-search" class="w-4 h-4 inline mr-1"></i>${escapeHtml(diag.id)}</span>
        <button class="btn-view-json" onclick="event.stopPropagation(); showJsonModal('${diagJsonId}', '${escapeHtml(diag.id)}')">{ } JSON</button>
      </div>
      <div class="collapsible-content collapsed">
        ${renderDiagnosisContent(diag)}
      </div>
    </div>
  `;
}

function renderDiagnosisContent(diag) {
  let content = [];

  // Summary/Overview
  if (diag.summary || diag.overview) {
    content.push(`
      <div class="diag-section">
        <strong>Summary:</strong>
        <p>${escapeHtml(diag.summary || diag.overview)}</p>
      </div>
    `);
  }

  // Root Cause Analysis
  if (diag.root_cause || diag.root_cause_analysis) {
    content.push(`
      <div class="diag-section">
        <strong>Root Cause:</strong>
        <p>${escapeHtml(diag.root_cause || diag.root_cause_analysis)}</p>
      </div>
    `);
  }

  // Issues/Findings
  if (diag.issues && Array.isArray(diag.issues)) {
    content.push(`
      <div class="diag-section">
        <strong>Issues Found (${diag.issues.length}):</strong>
        <ul class="issues-list">
          ${diag.issues.map(issue => `
            <li class="issue-item">
              ${typeof issue === 'string' ? escapeHtml(issue) : `
                <div class="issue-title">${escapeHtml(issue.title || issue.description || 'Unknown')}</div>
                ${issue.location ? `<div class="issue-location"><code>${escapeHtml(issue.location)}</code></div>` : ''}
                ${issue.severity ? `<span class="severity-badge ${issue.severity}">${escapeHtml(issue.severity)}</span>` : ''}
              `}
            </li>
          `).join('')}
        </ul>
      </div>
    `);
  }

  // Affected Files
  if (diag.affected_files && Array.isArray(diag.affected_files)) {
    content.push(`
      <div class="diag-section">
        <strong>Affected Files:</strong>
        <div class="path-tags">
          ${diag.affected_files.map(f => `<span class="path-tag">${escapeHtml(typeof f === 'string' ? f : f.path || f.file)}</span>`).join('')}
        </div>
      </div>
    `);
  }

  // API Contracts (for api-contracts diagnosis)
  if (diag.contracts && Array.isArray(diag.contracts)) {
    content.push(`
      <div class="diag-section">
        <strong>API Contracts (${diag.contracts.length}):</strong>
        <div class="contracts-list">
          ${diag.contracts.map(contract => `
            <div class="contract-item">
              <div class="contract-header">
                <span class="contract-endpoint">${escapeHtml(contract.endpoint || contract.name || 'Unknown')}</span>
                ${contract.method ? `<span class="contract-method">${escapeHtml(contract.method)}</span>` : ''}
              </div>
              ${contract.description ? `<div class="contract-desc">${escapeHtml(contract.description)}</div>` : ''}
              ${contract.issues?.length ? `<div class="contract-issues">${contract.issues.length} issue(s)</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `);
  }

  // Dataflow Analysis (for dataflow diagnosis)
  if (diag.dataflow || diag.data_flow) {
    const df = diag.dataflow || diag.data_flow;
    content.push(`
      <div class="diag-section">
        <strong>Data Flow Analysis:</strong>
        ${typeof df === 'string' ? `<p>${escapeHtml(df)}</p>` : `
          <div class="dataflow-details">
            ${df.source ? `<div class="df-item"><span class="df-label">Source:</span> ${escapeHtml(df.source)}</div>` : ''}
            ${df.sink ? `<div class="df-item"><span class="df-label">Sink:</span> ${escapeHtml(df.sink)}</div>` : ''}
            ${df.transformations?.length ? `
              <div class="df-item">
                <span class="df-label">Transformations:</span>
                <ol class="df-transforms">${df.transformations.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ol>
              </div>
            ` : ''}
          </div>
        `}
      </div>
    `);
  }

  // Recommendations
  if (diag.recommendations && Array.isArray(diag.recommendations)) {
    content.push(`
      <div class="diag-section">
        <strong>Recommendations:</strong>
        <ol class="recommendations-list">
          ${diag.recommendations.map(rec => `<li>${escapeHtml(typeof rec === 'string' ? rec : rec.description || rec.action)}</li>`).join('')}
        </ol>
      </div>
    `);
  }

  // If no specific content was rendered, show raw JSON preview
  if (content.length === 0) {
    content.push(`
      <div class="diag-section">
        <pre class="json-content">${escapeHtml(JSON.stringify(diag, null, 2))}</pre>
      </div>
    `);
  }

  return content.join('');
}
