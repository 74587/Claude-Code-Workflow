// ============================================
// LITE TASKS VIEW
// ============================================
// Lite-plan and lite-fix task list and detail rendering

function renderLiteTasks() {
  const container = document.getElementById('mainContent');

  const liteTasks = workflowData.liteTasks || {};
  let sessions;

  if (currentLiteType === 'lite-plan') {
    sessions = liteTasks.litePlan || [];
  } else if (currentLiteType === 'lite-fix') {
    sessions = liteTasks.liteFix || [];
  } else if (currentLiteType === 'multi-cli-plan') {
    sessions = liteTasks.multiCliPlan || [];
  } else {
    sessions = [];
  }

  if (sessions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="zap" class="w-12 h-12"></i></div>
        <div class="empty-title">${t('empty.noLiteSessions', { type: currentLiteType })}</div>
        <div class="empty-text">${t('empty.noLiteSessionsText', { type: currentLiteType })}</div>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  // Render based on type
  if (currentLiteType === 'multi-cli-plan') {
    container.innerHTML = `<div class="sessions-grid">${sessions.map(session => renderMultiCliCard(session)).join('')}</div>`;
  } else {
    container.innerHTML = `<div class="sessions-grid">${sessions.map(session => renderLiteTaskCard(session)).join('')}</div>`;
  }
  
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
          ${session.type === 'lite-plan' ? '<i data-lucide="file-edit" class="w-3 h-3 inline"></i> ' + t('lite.plan') : '<i data-lucide="wrench" class="w-3 h-3 inline"></i> ' + t('lite.fix')}
        </span>
      </div>
      <div class="session-body">
        <div class="session-meta">
          <span class="session-meta-item"><i data-lucide="calendar" class="w-3.5 h-3.5 inline mr-1"></i>${formatDate(session.createdAt)}</span>
          <span class="session-meta-item"><i data-lucide="list-checks" class="w-3.5 h-3.5 inline mr-1"></i>${tasks.length} ${t('session.tasks')}</span>
        </div>
      </div>
    </div>
  `;
}

// ============================================
// MULTI-CLI PLAN VIEW
// ============================================

/**
 * Render a card for multi-cli-plan session
 * Shows: Session ID, round count, topic title, status, created date
 */
function renderMultiCliCard(session) {
  const sessionKey = `multi-cli-${session.id}`.replace(/[^a-zA-Z0-9-]/g, '-');
  liteTaskDataStore[sessionKey] = session;

  // Extract info from latest synthesis or metadata
  const metadata = session.metadata || {};
  const latestSynthesis = session.latestSynthesis || session.discussionTopic || {};
  const roundCount = metadata.roundId || session.roundCount || 1;
  const topicTitle = getI18nText(latestSynthesis.title) || session.topicTitle || 'Discussion Topic';
  const status = latestSynthesis.status || session.status || 'analyzing';
  const createdAt = metadata.timestamp || session.createdAt || '';

  // Status badge color mapping
  const statusColors = {
    'decided': 'success',
    'converged': 'success',
    'plan_generated': 'success',
    'completed': 'success',
    'exploring': 'info',
    'initialized': 'info',
    'analyzing': 'warning',
    'debating': 'warning',
    'blocked': 'error',
    'conflict': 'error'
  };
  const statusColor = statusColors[status] || 'default';

  return `
    <div class="session-card multi-cli-card" onclick="showMultiCliDetailPage('${sessionKey}')" style="cursor: pointer;">
      <div class="session-header">
        <div class="session-title">${escapeHtml(session.id)}</div>
        <span class="session-status multi-cli-plan">
          <i data-lucide="messages-square" class="w-3 h-3 inline"></i> ${t('lite.multiCli') || 'Multi-CLI'}
        </span>
      </div>
      <div class="session-body">
        <div class="multi-cli-topic">
          <i data-lucide="message-circle" class="w-4 h-4 inline mr-1"></i>
          <span class="topic-title">${escapeHtml(topicTitle)}</span>
        </div>
        <div class="session-meta">
          <span class="session-meta-item"><i data-lucide="calendar" class="w-3.5 h-3.5 inline mr-1"></i>${formatDate(createdAt)}</span>
          <span class="session-meta-item"><i data-lucide="repeat" class="w-3.5 h-3.5 inline mr-1"></i>${roundCount} ${t('multiCli.rounds') || 'rounds'}</span>
          <span class="session-meta-item status-badge ${statusColor}"><i data-lucide="activity" class="w-3.5 h-3.5 inline mr-1"></i>${escapeHtml(status)}</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Get text from i18n label object (supports {en, zh} format)
 */
function getI18nText(label) {
  if (!label) return '';
  if (typeof label === 'string') return label;
  // Return based on current language or default to English
  const lang = window.currentLanguage || 'en';
  return label[lang] || label.en || label.zh || '';
}

// ============================================
// SYNTHESIS DATA TRANSFORMATION HELPERS
// ============================================

/**
 * Extract files from synthesis solutions[].implementation_plan.tasks[].files
 * Returns object with fileTree and impactSummary arrays
 */
function extractFilesFromSynthesis(synthesis) {
  if (!synthesis || !synthesis.solutions) {
    return { fileTree: [], impactSummary: [], dependencyGraph: [] };
  }

  const fileSet = new Set();
  const impactMap = new Map();

  synthesis.solutions.forEach(solution => {
    const tasks = solution.implementation_plan?.tasks || [];
    tasks.forEach(task => {
      const files = task.files || [];
      files.forEach(filePath => {
        fileSet.add(filePath);
        // Build impact summary based on task context
        if (!impactMap.has(filePath)) {
          impactMap.set(filePath, {
            filePath: filePath,
            score: 'medium',
            reasoning: { en: `Part of ${solution.title?.en || solution.id} implementation`, zh: `${solution.title?.zh || solution.id} 实现的一部分` }
          });
        }
      });
    });
  });

  // Convert to fileTree format (flat list with file type)
  const fileTree = Array.from(fileSet).map(path => ({
    path: path,
    type: 'file',
    modificationStatus: 'modified',
    impactScore: 'medium'
  }));

  return {
    fileTree: fileTree,
    impactSummary: Array.from(impactMap.values()),
    dependencyGraph: []
  };
}

/**
 * Extract planning data from synthesis solutions[].implementation_plan
 * Builds planning object with functional requirements format
 */
function extractPlanningFromSynthesis(synthesis) {
  if (!synthesis || !synthesis.solutions) {
    return { functional: [], nonFunctional: [], acceptanceCriteria: [] };
  }

  const functional = [];
  const acceptanceCriteria = [];
  let reqCounter = 1;
  let acCounter = 1;

  synthesis.solutions.forEach(solution => {
    const plan = solution.implementation_plan;
    if (!plan) return;

    // Extract approach as functional requirement
    if (plan.approach) {
      functional.push({
        id: `FR-${String(reqCounter++).padStart(3, '0')}`,
        description: plan.approach,
        priority: solution.feasibility?.score >= 0.8 ? 'high' : 'medium',
        source: solution.id
      });
    }

    // Extract tasks as acceptance criteria
    const tasks = plan.tasks || [];
    tasks.forEach(task => {
      acceptanceCriteria.push({
        id: `AC-${String(acCounter++).padStart(3, '0')}`,
        description: task.title || { en: task.id, zh: task.id },
        isMet: false
      });
    });
  });

  return {
    functional: functional,
    nonFunctional: [],
    acceptanceCriteria: acceptanceCriteria
  };
}

/**
 * Extract decision data from synthesis solutions
 * Sorts by feasibility score, returns highest as selected, rest as rejected
 */
function extractDecisionFromSynthesis(synthesis) {
  if (!synthesis || !synthesis.solutions || synthesis.solutions.length === 0) {
    return {};
  }

  // Sort solutions by feasibility score (highest first)
  const sortedSolutions = [...synthesis.solutions].sort((a, b) => {
    const scoreA = a.feasibility?.score || 0;
    const scoreB = b.feasibility?.score || 0;
    return scoreB - scoreA;
  });

  const selectedSolution = sortedSolutions[0];
  const rejectedAlternatives = sortedSolutions.slice(1).map(sol => ({
    ...sol,
    rejectionReason: sol.cons?.length > 0 ? sol.cons[0] : { en: 'Lower feasibility score', zh: '可行性评分较低' }
  }));

  // Calculate confidence from convergence level
  let confidenceScore = 0.5;
  if (synthesis.convergence) {
    const level = synthesis.convergence.level;
    if (level === 'high' || level === 'converged') confidenceScore = 0.9;
    else if (level === 'medium') confidenceScore = 0.7;
    else if (level === 'low') confidenceScore = 0.4;
  }

  return {
    status: synthesis.convergence?.recommendation || 'pending',
    summary: synthesis.convergence?.summary || {},
    selectedSolution: selectedSolution,
    rejectedAlternatives: rejectedAlternatives,
    confidenceScore: confidenceScore
  };
}

/**
 * Extract timeline data from synthesis convergence and cross_verification
 * Builds timeline array with events from discussion process
 */
function extractTimelineFromSynthesis(synthesis) {
  if (!synthesis) {
    return [];
  }

  const timeline = [];
  const now = new Date().toISOString();

  // Add convergence summary as decision event
  if (synthesis.convergence?.summary) {
    timeline.push({
      type: 'decision',
      timestamp: now,
      summary: synthesis.convergence.summary,
      contributor: { name: 'Synthesis', id: 'synthesis' },
      reversibility: synthesis.convergence.recommendation === 'proceed' ? 'irreversible' : 'reversible'
    });
  }

  // Add cross-verification agreements as agreement events
  const agreements = synthesis.cross_verification?.agreements || [];
  agreements.forEach((agreement, idx) => {
    timeline.push({
      type: 'agreement',
      timestamp: now,
      summary: typeof agreement === 'string' ? { en: agreement, zh: agreement } : agreement,
      contributor: { name: 'Cross-Verification', id: 'cross-verify' },
      evidence: []
    });
  });

  // Add cross-verification disagreements as disagreement events
  const disagreements = synthesis.cross_verification?.disagreements || [];
  disagreements.forEach((disagreement, idx) => {
    timeline.push({
      type: 'disagreement',
      timestamp: now,
      summary: typeof disagreement === 'string' ? { en: disagreement, zh: disagreement } : disagreement,
      contributor: { name: 'Cross-Verification', id: 'cross-verify' },
      evidence: []
    });
  });

  // Add solutions as proposal events
  const solutions = synthesis.solutions || [];
  solutions.forEach(solution => {
    timeline.push({
      type: 'proposal',
      timestamp: now,
      summary: solution.description || solution.title || {},
      contributor: { name: solution.id, id: solution.id },
      evidence: solution.pros?.map(p => ({ type: 'pro', description: p })) || []
    });
  });

  return timeline;
}

/**
 * Show multi-cli detail page with tabs (same layout as lite-plan)
 */
function showMultiCliDetailPage(sessionKey) {
  const session = liteTaskDataStore[sessionKey];
  if (!session) return;

  currentView = 'multiCliDetail';
  currentSessionDetailKey = sessionKey;

  hideStatsAndCarousel();

  const container = document.getElementById('mainContent');
  const metadata = session.metadata || {};
  const plan = session.plan || {};
  // Use session.tasks (normalized from backend) with fallback to plan.tasks
  const tasks = session.tasks?.length > 0 ? session.tasks : (plan.tasks || []);
  const roundCount = metadata.roundId || session.roundCount || 1;
  const status = session.status || 'analyzing';

  container.innerHTML = `
    <div class="session-detail-page lite-task-detail-page">
      <!-- Header -->
      <div class="detail-header">
        <button class="btn-back" onclick="goBackToLiteTasks()">
          <span class="back-icon">←</span>
          <span>${t('multiCli.backToList') || 'Back to Multi-CLI Plan'}</span>
        </button>
        <div class="detail-title-row">
          <h2 class="detail-session-id"><i data-lucide="messages-square" class="w-5 h-5 inline mr-2"></i> ${escapeHtml(session.id)}</h2>
          <div class="detail-badges">
            <span class="session-type-badge multi-cli-plan">MULTI-CLI</span>
          </div>
        </div>
      </div>

      <!-- Session Info Bar -->
      <div class="detail-info-bar">
        <div class="info-item">
          <span class="info-label">${t('detail.created') || 'Created'}</span>
          <span class="info-value">${formatDate(metadata.timestamp || session.createdAt)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">${t('detail.tasks') || 'Tasks'}</span>
          <span class="info-value">${tasks.length} ${t('session.tasks') || 'tasks'}</span>
        </div>
      </div>

      <!-- Tab Navigation (same as lite-plan) -->
      <div class="detail-tabs">
        <button class="detail-tab active" data-tab="tasks" onclick="switchMultiCliDetailTab('tasks')">
          <span class="tab-icon"><i data-lucide="list-checks" class="w-4 h-4"></i></span>
          <span class="tab-text">${t('tab.tasks') || 'Tasks'}</span>
          <span class="tab-count">${tasks.length}</span>
        </button>
        <button class="detail-tab" data-tab="discussion" onclick="switchMultiCliDetailTab('discussion')">
          <span class="tab-icon"><i data-lucide="messages-square" class="w-4 h-4"></i></span>
          <span class="tab-text">${t('multiCli.tab.discussion') || 'Discussion'}</span>
          <span class="tab-count">${roundCount}</span>
        </button>
        <button class="detail-tab" data-tab="context" onclick="switchMultiCliDetailTab('context')">
          <span class="tab-icon"><i data-lucide="package" class="w-4 h-4"></i></span>
          <span class="tab-text">${t('tab.context') || 'Context'}</span>
        </button>
        <button class="detail-tab" data-tab="summary" onclick="switchMultiCliDetailTab('summary')">
          <span class="tab-icon"><i data-lucide="file-text" class="w-4 h-4"></i></span>
          <span class="tab-text">${t('tab.summary') || 'Summary'}</span>
        </button>
      </div>

      <!-- Tab Content -->
      <div class="detail-tab-content" id="multiCliDetailTabContent">
        ${renderMultiCliTasksTab(session)}
      </div>
    </div>
  `;

  // Initialize icons, collapsible sections, and task click handlers
  setTimeout(() => {
    if (typeof lucide !== 'undefined') lucide.createIcons();
    initCollapsibleSections(container);
    initMultiCliTaskClickHandlers();
  }, 50);
}

/**
 * Render the multi-cli toolbar content
 */
function renderMultiCliToolbar(session) {
  const plan = session.plan;
  // Use session.tasks (normalized from backend) with fallback to plan.tasks
  const tasks = session.tasks?.length > 0 ? session.tasks : (plan?.tasks || []);
  const taskCount = tasks.length;

  let toolbarHtml = `
    <div class="toolbar-header">
      <h4 class="toolbar-title">
        <i data-lucide="list-checks" class="w-4 h-4"></i>
        <span>${t('multiCli.toolbar.tasks') || 'Tasks'}</span>
        <span class="toolbar-count">${taskCount}</span>
      </h4>
    </div>
  `;

  // Quick Actions
  toolbarHtml += `
    <div class="toolbar-actions">
      <button class="toolbar-action-btn" onclick="refreshMultiCliToolbar()" title="${t('multiCli.toolbar.refresh') || 'Refresh'}">
        <i data-lucide="refresh-cw" class="w-4 h-4"></i>
      </button>
      <button class="toolbar-action-btn" onclick="exportMultiCliPlanJson()" title="${t('multiCli.toolbar.export') || 'Export JSON'}">
        <i data-lucide="download" class="w-4 h-4"></i>
      </button>
      <button class="toolbar-action-btn" onclick="viewMultiCliRawJson()" title="${t('multiCli.toolbar.viewRaw') || 'View Raw Data'}">
        <i data-lucide="code" class="w-4 h-4"></i>
      </button>
    </div>
  `;

  // Task List
  if (tasks.length > 0) {
    toolbarHtml += `
      <div class="toolbar-task-list">
        ${tasks.map((task, idx) => {
          const taskTitle = task.title || task.name || task.summary || `Task ${idx + 1}`;
          const taskScope = task.meta?.scope || task.scope || '';
          const taskIdValue = task.id || `T${idx + 1}`;

          return `
            <div class="toolbar-task-item" onclick="openToolbarTaskDrawer('${escapeHtml(session.id)}', '${escapeHtml(taskIdValue)}')" data-task-idx="${idx}">
              <span class="toolbar-task-num">#${idx + 1}</span>
              <div class="toolbar-task-info">
                <span class="toolbar-task-title" title="${escapeHtml(taskTitle)}">${escapeHtml(taskTitle)}</span>
                ${taskScope ? `<span class="toolbar-task-scope">${escapeHtml(taskScope)}</span>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } else {
    toolbarHtml += `
      <div class="toolbar-empty">
        <i data-lucide="inbox" class="w-8 h-8"></i>
        <span>${t('multiCli.toolbar.noTasks') || 'No tasks available'}</span>
      </div>
    `;
  }

  // Session Info
  toolbarHtml += `
    <div class="toolbar-session-info">
      <div class="toolbar-info-item">
        <span class="toolbar-info-label">${t('multiCli.toolbar.sessionId') || 'Session'}</span>
        <span class="toolbar-info-value" title="${escapeHtml(session.id)}">${escapeHtml(session.id)}</span>
      </div>
      ${plan?.summary ? `
        <div class="toolbar-info-item">
          <span class="toolbar-info-label">${t('multiCli.toolbar.summary') || 'Summary'}</span>
          <span class="toolbar-info-value toolbar-summary" title="${escapeHtml(plan.summary)}">${escapeHtml(plan.summary)}</span>
        </div>
      ` : ''}
    </div>
  `;

  return toolbarHtml;
}

/**
 * Scroll to a specific task in the planning tab
 */
function scrollToMultiCliTask(taskIdx) {
  // Switch to planning tab if not active
  const planningTab = document.querySelector('.detail-tab[data-tab="planning"]');
  if (planningTab && !planningTab.classList.contains('active')) {
    switchMultiCliDetailTab('planning');
    // Wait for tab content to render
    setTimeout(() => scrollToTaskElement(taskIdx), 100);
  } else {
    scrollToTaskElement(taskIdx);
  }
}

/**
 * Open task drawer from toolbar (wrapper for openTaskDrawerForMultiCli)
 */
function openToolbarTaskDrawer(sessionId, taskId) {
  openTaskDrawerForMultiCli(sessionId, taskId);
}

/**
 * Scroll to task element in the DOM
 */
function scrollToTaskElement(taskIdx) {
  const taskItems = document.querySelectorAll('.fix-task-summary-item');
  if (taskItems[taskIdx]) {
    taskItems[taskIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Highlight the task briefly
    taskItems[taskIdx].classList.add('toolbar-highlight');
    setTimeout(() => {
      taskItems[taskIdx].classList.remove('toolbar-highlight');
    }, 2000);
    // Expand the collapsible if collapsed
    const header = taskItems[taskIdx].querySelector('.collapsible-header');
    const content = taskItems[taskIdx].querySelector('.collapsible-content');
    if (header && content && content.classList.contains('collapsed')) {
      header.click();
    }
  }
}

/**
 * Refresh the toolbar content
 */
function refreshMultiCliToolbar() {
  const session = liteTaskDataStore[currentSessionDetailKey];
  if (!session) return;

  const toolbarContent = document.querySelector('.toolbar-content');
  if (toolbarContent) {
    toolbarContent.innerHTML = renderMultiCliToolbar(session);
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

/**
 * Export plan.json content
 */
function exportMultiCliPlanJson() {
  const session = liteTaskDataStore[currentSessionDetailKey];
  if (!session || !session.plan) {
    if (typeof showRefreshToast === 'function') {
      showRefreshToast(t('multiCli.toolbar.noPlan') || 'No plan data available', 'warning');
    }
    return;
  }

  const jsonStr = JSON.stringify(session.plan, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `plan-${session.id}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  if (typeof showRefreshToast === 'function') {
    showRefreshToast(t('multiCli.toolbar.exported') || 'Plan exported successfully', 'success');
  }
}

/**
 * View raw session JSON in modal
 */
function viewMultiCliRawJson() {
  const session = liteTaskDataStore[currentSessionDetailKey];
  if (!session) return;

  // Reuse existing JSON modal pattern
  const overlay = document.createElement('div');
  overlay.className = 'json-modal-overlay active';
  overlay.innerHTML = `
    <div class="json-modal">
      <div class="json-modal-header">
        <div class="json-modal-title">
          <span class="session-id-badge">${escapeHtml(session.id)}</span>
          <span>${t('multiCli.toolbar.rawData') || 'Raw Session Data'}</span>
        </div>
        <button class="json-modal-close" onclick="closeJsonModal(this)">&times;</button>
      </div>
      <div class="json-modal-body">
        <pre class="json-modal-content">${escapeHtml(JSON.stringify(session, null, 2))}</pre>
      </div>
      <div class="json-modal-footer">
        <button class="btn-copy-json" onclick="copyJsonToClipboard(this)">${t('action.copy') || 'Copy to Clipboard'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

/**
 * Switch between multi-cli detail tabs
 */
function switchMultiCliDetailTab(tabName) {
  // Update active tab
  document.querySelectorAll('.detail-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  const session = liteTaskDataStore[currentSessionDetailKey];
  if (!session) return;

  const contentArea = document.getElementById('multiCliDetailTabContent');

  switch (tabName) {
    case 'tasks':
      contentArea.innerHTML = renderMultiCliTasksTab(session);
      break;
    case 'discussion':
      contentArea.innerHTML = renderMultiCliDiscussionSection(session);
      break;
    case 'context':
      loadAndRenderMultiCliContextTab(session, contentArea);
      return; // Early return as this is async
    case 'summary':
      loadAndRenderMultiCliSummaryTab(session, contentArea);
      return; // Early return as this is async
  }

  // Re-initialize after tab switch
  setTimeout(() => {
    if (typeof lucide !== 'undefined') lucide.createIcons();
    initCollapsibleSections(contentArea);
    // Initialize task click handlers for tasks tab
    if (tabName === 'tasks') {
      initMultiCliTaskClickHandlers();
    }
  }, 50);
}

// ============================================
// MULTI-CLI TAB RENDERERS
// ============================================

/**
 * Render Tasks tab - displays plan summary + tasks (same style as lite-plan)
 * Uses session.tasks (normalized tasks) with fallback to session.plan.tasks
 */
function renderMultiCliTasksTab(session) {
  const plan = session.plan || {};
  // Use session.tasks (normalized from backend) with fallback to plan.tasks
  const tasks = session.tasks?.length > 0 ? session.tasks : (plan.tasks || []);

  // Populate drawer tasks for click-to-open functionality
  currentDrawerTasks = tasks;

  let sections = [];

  // Extract plan info from multiple sources (plan.json, synthesis, or session)
  // plan.json: task_description, solution.name, execution_flow
  // synthesis: solutions[].summary, solutions[].implementation_plan.approach
  const taskDescription = plan.task_description || session.topicTitle || '';
  const solutionName = plan.solution?.name || (plan.solutions?.[0]?.name) || '';
  const solutionSummary = plan.solutions?.[0]?.summary || '';
  const approach = plan.solutions?.[0]?.implementation_plan?.approach || plan.execution_flow || '';
  const feasibility = plan.solution?.feasibility || plan.solutions?.[0]?.feasibility;
  const effort = plan.solution?.effort || plan.solutions?.[0]?.effort || '';
  const risk = plan.solution?.risk || plan.solutions?.[0]?.risk || '';

  // Plan Summary Section (if any info available)
  const hasInfo = taskDescription || solutionName || solutionSummary || approach || plan.summary;
  if (hasInfo) {
    let planInfo = [];

    // Task description (main objective)
    if (taskDescription) {
      planInfo.push(`<p class="plan-summary-text"><strong>${t('multiCli.plan.objective')}:</strong> ${escapeHtml(taskDescription)}</p>`);
    }
    // Solution name and summary
    if (solutionName) {
      planInfo.push(`<p class="plan-solution-text"><strong>${t('multiCli.plan.solution')}:</strong> ${escapeHtml(solutionName)}</p>`);
    }
    if (solutionSummary) {
      planInfo.push(`<p class="plan-summary-text">${escapeHtml(solutionSummary)}</p>`);
    }
    // Legacy summary field
    if (plan.summary && !taskDescription && !solutionSummary) {
      planInfo.push(`<p class="plan-summary-text">${escapeHtml(plan.summary)}</p>`);
    }
    // Approach/execution flow
    if (approach) {
      planInfo.push(`<p class="plan-approach-text"><strong>${t('multiCli.plan.approach')}:</strong> ${escapeHtml(approach)}</p>`);
    }

    // Metadata badges - concise format
    let metaBadges = [];
    if (feasibility) metaBadges.push(`<span class="meta-badge feasibility">${Math.round(feasibility * 100)}%</span>`);
    if (effort) metaBadges.push(`<span class="meta-badge effort ${escapeHtml(effort)}">${escapeHtml(effort)}</span>`);
    if (risk) metaBadges.push(`<span class="meta-badge risk ${escapeHtml(risk)}">${escapeHtml(risk)} ${t('multiCli.plan.risk')}</span>`);
    // Legacy badges
    if (plan.severity) metaBadges.push(`<span class="meta-badge severity ${escapeHtml(plan.severity)}">${escapeHtml(plan.severity)}</span>`);
    if (plan.complexity) metaBadges.push(`<span class="meta-badge complexity">${escapeHtml(plan.complexity)}</span>`);
    if (plan.estimated_time) metaBadges.push(`<span class="meta-badge time">${escapeHtml(plan.estimated_time)}</span>`);

    sections.push(`
      <div class="plan-summary-section">
        ${planInfo.join('')}
        ${metaBadges.length ? `<div class="plan-meta-badges">${metaBadges.join(' ')}</div>` : ''}
      </div>
    `);
  }

  // Tasks Section
  if (tasks.length === 0) {
    sections.push(`
      <div class="tab-empty-state">
        <div class="empty-icon"><i data-lucide="clipboard-list" class="w-12 h-12"></i></div>
        <div class="empty-title">${t('empty.noTasks') || 'No Tasks'}</div>
        <div class="empty-text">${t('empty.noTasksText') || 'No tasks available for this session.'}</div>
      </div>
    `);
  } else {
    sections.push(`
      <div class="tasks-list" id="multiCliTasksListContent">
        ${tasks.map((task, idx) => renderMultiCliTaskItem(session.id, task, idx)).join('')}
      </div>
    `);
  }

  return `<div class="tasks-tab-content">${sections.join('')}</div>`;
}

/**
 * Render Plan tab - displays plan.json content (summary, approach, metadata)
 */
function renderMultiCliPlanTab(session) {
  const plan = session.plan;

  if (!plan) {
    return `
      <div class="tab-empty-state">
        <div class="empty-icon"><i data-lucide="ruler" class="w-12 h-12"></i></div>
        <div class="empty-title">${t('multiCli.empty.planning') || 'No Plan Data'}</div>
        <div class="empty-text">${t('multiCli.empty.planningText') || 'No plan.json found for this session.'}</div>
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

      <!-- User Requirements -->
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

      <!-- Raw JSON -->
      <div class="plan-section collapsible-section">
        <div class="collapsible-header">
          <span class="collapse-icon">&#9654;</span>
          <span class="section-label">{ } Raw JSON</span>
        </div>
        <div class="collapsible-content collapsed">
          <pre class="json-content">${escapeHtml(JSON.stringify(plan, null, 2))}</pre>
        </div>
      </div>
    </div>
  `;
}

/**
 * Load and render Context tab - displays context-package content
 */
async function loadAndRenderMultiCliContextTab(session, contentArea) {
  contentArea.innerHTML = `<div class="tab-loading">${t('common.loading') || 'Loading...'}</div>`;

  try {
    if (window.SERVER_MODE && session.path) {
      const response = await fetch(`/api/session-detail?path=${encodeURIComponent(session.path)}&type=context`);
      if (response.ok) {
        const data = await response.json();
        contentArea.innerHTML = renderMultiCliContextContent(data.context, session);
        initCollapsibleSections(contentArea);
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
      }
    }
    // Fallback: show session context_package if available
    contentArea.innerHTML = renderMultiCliContextContent(session.context_package, session);
    initCollapsibleSections(contentArea);
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (err) {
    contentArea.innerHTML = `<div class="tab-error">Failed to load context: ${err.message}</div>`;
  }
}

/**
 * Render context content for multi-cli
 */
function renderMultiCliContextContent(context, session) {
  // Also check for context_package in session
  const ctx = context || session.context_package || {};

  if (!ctx || Object.keys(ctx).length === 0) {
    return `
      <div class="tab-empty-state">
        <div class="empty-icon"><i data-lucide="package" class="w-12 h-12"></i></div>
        <div class="empty-title">${t('empty.noContext') || 'No Context Data'}</div>
        <div class="empty-text">${t('empty.noContextText') || 'No context package available for this session.'}</div>
      </div>
    `;
  }

  let sections = [];

  // Task Description
  if (ctx.task_description) {
    sections.push(`
      <div class="context-section">
        <h4 class="context-section-title"><i data-lucide="file-text" class="w-4 h-4 inline mr-1"></i> ${t('multiCli.context.taskDescription')}</h4>
        <p class="context-description">${escapeHtml(ctx.task_description)}</p>
      </div>
    `);
  }

  // Constraints
  if (ctx.constraints?.length) {
    sections.push(`
      <div class="context-section">
        <h4 class="context-section-title"><i data-lucide="alert-triangle" class="w-4 h-4 inline mr-1"></i> ${t('multiCli.context.constraints')}</h4>
        <ul class="constraints-list">
          ${ctx.constraints.map(c => `<li>${escapeHtml(c)}</li>`).join('')}
        </ul>
      </div>
    `);
  }

  // Focus Paths
  if (ctx.focus_paths?.length) {
    sections.push(`
      <div class="context-section">
        <h4 class="context-section-title"><i data-lucide="folder" class="w-4 h-4 inline mr-1"></i> ${t('multiCli.context.focusPaths')}</h4>
        <div class="path-tags">
          ${ctx.focus_paths.map(p => `<span class="path-tag">${escapeHtml(p)}</span>`).join('')}
        </div>
      </div>
    `);
  }

  // Relevant Files
  if (ctx.relevant_files?.length) {
    sections.push(`
      <div class="context-section collapsible-section">
        <div class="collapsible-header">
          <span class="collapse-icon">&#9654;</span>
          <span class="section-label"><i data-lucide="files" class="w-4 h-4 inline mr-1"></i> ${t('multiCli.context.relevantFiles')} (${ctx.relevant_files.length})</span>
        </div>
        <div class="collapsible-content collapsed">
          <ul class="files-list">
            ${ctx.relevant_files.map(f => `
              <li class="file-item">
                <span class="file-icon">📄</span>
                <code>${escapeHtml(typeof f === 'string' ? f : f.path || f.file || '')}</code>
                ${f.reason ? `<span class="file-reason">${escapeHtml(f.reason)}</span>` : ''}
              </li>
            `).join('')}
          </ul>
        </div>
      </div>
    `);
  }

  // Dependencies
  if (ctx.dependencies?.length) {
    sections.push(`
      <div class="context-section collapsible-section">
        <div class="collapsible-header">
          <span class="collapse-icon">&#9654;</span>
          <span class="section-label"><i data-lucide="git-branch" class="w-4 h-4 inline mr-1"></i> ${t('multiCli.context.dependencies')} (${ctx.dependencies.length})</span>
        </div>
        <div class="collapsible-content collapsed">
          <ul class="deps-list">
            ${ctx.dependencies.map(d => `<li>${escapeHtml(typeof d === 'string' ? d : d.name || JSON.stringify(d))}</li>`).join('')}
          </ul>
        </div>
      </div>
    `);
  }

  // Conflict Risks
  if (ctx.conflict_risks?.length) {
    sections.push(`
      <div class="context-section">
        <h4 class="context-section-title"><i data-lucide="alert-circle" class="w-4 h-4 inline mr-1"></i> ${t('multiCli.context.conflictRisks')}</h4>
        <ul class="risks-list">
          ${ctx.conflict_risks.map(r => `<li class="risk-item">${escapeHtml(typeof r === 'string' ? r : r.description || JSON.stringify(r))}</li>`).join('')}
        </ul>
      </div>
    `);
  }

  // Session ID
  if (ctx.session_id) {
    sections.push(`
      <div class="context-section">
        <h4 class="context-section-title"><i data-lucide="hash" class="w-4 h-4 inline mr-1"></i> ${t('multiCli.context.sessionId')}</h4>
        <code class="session-id-code">${escapeHtml(ctx.session_id)}</code>
      </div>
    `);
  }

  // Raw JSON
  sections.push(`
    <div class="context-section collapsible-section">
      <div class="collapsible-header">
        <span class="collapse-icon">&#9654;</span>
        <span class="section-label">{ } ${t('multiCli.context.rawJson')}</span>
      </div>
      <div class="collapsible-content collapsed">
        <pre class="json-content">${escapeHtml(JSON.stringify(ctx, null, 2))}</pre>
      </div>
    </div>
  `);

  return `<div class="context-tab-content">${sections.join('')}</div>`;
}

/**
 * Load and render Summary tab
 */
async function loadAndRenderMultiCliSummaryTab(session, contentArea) {
  contentArea.innerHTML = `<div class="tab-loading">${t('common.loading') || 'Loading...'}</div>`;

  try {
    if (window.SERVER_MODE && session.path) {
      const response = await fetch(`/api/session-detail?path=${encodeURIComponent(session.path)}&type=summary`);
      if (response.ok) {
        const data = await response.json();
        contentArea.innerHTML = renderMultiCliSummaryContent(data.summary, session);
        initCollapsibleSections(contentArea);
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
      }
    }
    // Fallback: show synthesis summary
    contentArea.innerHTML = renderMultiCliSummaryContent(null, session);
    initCollapsibleSections(contentArea);
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (err) {
    contentArea.innerHTML = `<div class="tab-error">Failed to load summary: ${err.message}</div>`;
  }
}

/**
 * Render summary content for multi-cli
 */
function renderMultiCliSummaryContent(summary, session) {
  const synthesis = session.latestSynthesis || session.discussionTopic || {};
  const plan = session.plan || {};

  // Use summary from file or build from synthesis
  const summaryText = summary || synthesis.convergence?.summary || plan.summary;

  if (!summaryText && !synthesis.solutions?.length) {
    return `
      <div class="tab-empty-state">
        <div class="empty-icon"><i data-lucide="file-text" class="w-12 h-12"></i></div>
        <div class="empty-title">${t('empty.noSummary') || 'No Summary'}</div>
        <div class="empty-text">${t('empty.noSummaryText') || 'No summary available for this session.'}</div>
      </div>
    `;
  }

  let sections = [];

  // Main Summary
  if (summaryText) {
    const summaryContent = typeof summaryText === 'string' ? summaryText : getI18nText(summaryText);
    sections.push(`
      <div class="summary-section">
        <h4 class="summary-section-title"><i data-lucide="file-text" class="w-4 h-4 inline mr-1"></i> ${t('multiCli.summary.title')}</h4>
        <div class="summary-content">${escapeHtml(summaryContent)}</div>
      </div>
    `);
  }

  // Convergence Status
  if (synthesis.convergence) {
    const conv = synthesis.convergence;
    sections.push(`
      <div class="summary-section">
        <h4 class="summary-section-title"><i data-lucide="git-merge" class="w-4 h-4 inline mr-1"></i> ${t('multiCli.summary.convergence')}</h4>
        <div class="convergence-info">
          <span class="convergence-level ${conv.level || ''}">${escapeHtml(conv.level || 'unknown')}</span>
          <span class="convergence-rec ${conv.recommendation || ''}">${escapeHtml(conv.recommendation || '')}</span>
        </div>
      </div>
    `);
  }

  // Solutions Summary
  if (synthesis.solutions?.length) {
    sections.push(`
      <div class="summary-section collapsible-section">
        <div class="collapsible-header">
          <span class="collapse-icon">&#9654;</span>
          <span class="section-label"><i data-lucide="lightbulb" class="w-4 h-4 inline mr-1"></i> ${t('multiCli.summary.solutions')} (${synthesis.solutions.length})</span>
        </div>
        <div class="collapsible-content collapsed">
          ${synthesis.solutions.map((sol, idx) => `
            <div class="solution-summary-item">
              <span class="solution-num">#${idx + 1}</span>
              <span class="solution-name">${escapeHtml(getI18nText(sol.title) || sol.id || `${t('multiCli.summary.solution')} ${idx + 1}`)}</span>
              ${sol.feasibility?.score ? `<span class="feasibility-badge">${Math.round(sol.feasibility.score * 100)}%</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `);
  }

  return `<div class="summary-tab-content">${sections.join('')}</div>`;
}

/**
 * Render Discussion Topic tab
 * Shows: title, description, scope, keyQuestions, status, tags
 */
function renderMultiCliTopicTab(session) {
  const topic = session.discussionTopic || session.latestSynthesis?.discussionTopic || {};

  if (!topic || Object.keys(topic).length === 0) {
    return `
      <div class="tab-empty-state">
        <div class="empty-icon"><i data-lucide="message-circle" class="w-12 h-12"></i></div>
        <div class="empty-title">${t('multiCli.empty.topic') || 'No Discussion Topic'}</div>
        <div class="empty-text">${t('multiCli.empty.topicText') || 'No discussion topic data available for this session.'}</div>
      </div>
    `;
  }

  const title = getI18nText(topic.title) || 'Untitled';
  const description = getI18nText(topic.description) || '';
  const scope = topic.scope || {};
  const keyQuestions = topic.keyQuestions || [];
  const status = topic.status || 'unknown';
  const tags = topic.tags || [];

  let sections = [];

  // Title and Description
  sections.push(`
    <div class="multi-cli-topic-section">
      <h3 class="multi-cli-topic-title">${escapeHtml(title)}</h3>
      ${description ? `<p class="multi-cli-topic-description">${escapeHtml(description)}</p>` : ''}
      <div class="topic-meta">
        <span class="multi-cli-status ${status}">${escapeHtml(status)}</span>
        ${tags.length ? tags.map(tag => `<span class="tag-badge">${escapeHtml(tag)}</span>`).join('') : ''}
      </div>
    </div>
  `);

  // Scope (included/excluded)
  if (scope.included?.length || scope.excluded?.length) {
    sections.push(`
      <div class="multi-cli-section scope-section">
        <h4 class="section-title"><i data-lucide="target" class="w-4 h-4 inline mr-1"></i> ${t('multiCli.scope') || 'Scope'}</h4>
        ${scope.included?.length ? `
          <div class="scope-included">
            <strong>${t('multiCli.scope.included') || 'Included'}:</strong>
            <ul class="scope-list">
              ${scope.included.map(item => `<li>${escapeHtml(getI18nText(item))}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        ${scope.excluded?.length ? `
          <div class="scope-excluded">
            <strong>${t('multiCli.scope.excluded') || 'Excluded'}:</strong>
            <ul class="scope-list excluded">
              ${scope.excluded.map(item => `<li>${escapeHtml(getI18nText(item))}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `);
  }

  // Key Questions
  if (keyQuestions.length) {
    sections.push(`
      <div class="multi-cli-section questions-section">
        <h4 class="section-title"><i data-lucide="help-circle" class="w-4 h-4 inline mr-1"></i> ${t('multiCli.keyQuestions') || 'Key Questions'}</h4>
        <ol class="key-questions-list">
          ${keyQuestions.map(q => `<li>${escapeHtml(getI18nText(q))}</li>`).join('')}
        </ol>
      </div>
    `);
  }

  return `<div class="multi-cli-topic-tab">${sections.join('')}</div>`;
}

/**
 * Render Related Files tab
 * Shows: fileTree, impactSummary
 */
function renderMultiCliFilesTab(session) {
  // Use helper to extract files from synthesis data structure
  const relatedFiles = extractFilesFromSynthesis(session.latestSynthesis);

  if (!relatedFiles || (!relatedFiles.fileTree?.length && !relatedFiles.impactSummary?.length)) {
    return `
      <div class="tab-empty-state">
        <div class="empty-icon"><i data-lucide="folder-tree" class="w-12 h-12"></i></div>
        <div class="empty-title">${t('multiCli.empty.files') || 'No Related Files'}</div>
        <div class="empty-text">${t('multiCli.empty.filesText') || 'No file analysis data available for this session.'}</div>
      </div>
    `;
  }

  const fileTree = relatedFiles.fileTree || [];
  const impactSummary = relatedFiles.impactSummary || [];
  const dependencyGraph = relatedFiles.dependencyGraph || [];

  let sections = [];

  // File Tree
  if (fileTree.length) {
    sections.push(`
      <div class="multi-cli-section file-tree-section collapsible-section">
        <div class="collapsible-header">
          <span class="collapse-icon">&#9658;</span>
          <span class="section-label"><i data-lucide="folder-tree" class="w-4 h-4 inline mr-1"></i> ${t('multiCli.fileTree') || 'File Tree'} (${fileTree.length})</span>
        </div>
        <div class="collapsible-content collapsed">
          <div class="file-tree-list">
            ${renderFileTreeNodes(fileTree)}
          </div>
        </div>
      </div>
    `);
  }

  // Impact Summary
  if (impactSummary.length) {
    sections.push(`
      <div class="multi-cli-section impact-section collapsible-section">
        <div class="collapsible-header">
          <span class="collapse-icon">&#9658;</span>
          <span class="section-label"><i data-lucide="alert-triangle" class="w-4 h-4 inline mr-1"></i> ${t('multiCli.impactSummary') || 'Impact Summary'} (${impactSummary.length})</span>
        </div>
        <div class="collapsible-content collapsed">
          <div class="impact-list">
            ${impactSummary.map(impact => `
              <div class="impact-item impact-${impact.score || 'medium'}">
                <div class="impact-header">
                  <code class="impact-file">${escapeHtml(impact.filePath || '')}</code>
                  ${impact.line ? `<span class="impact-line">:${impact.line}</span>` : ''}
                  <span class="impact-score ${impact.score || 'medium'}">${escapeHtml(impact.score || 'medium')}</span>
                </div>
                ${impact.reasoning ? `<div class="impact-reason">${escapeHtml(getI18nText(impact.reasoning))}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `);
  }

  // Dependency Graph
  if (dependencyGraph.length) {
    sections.push(`
      <div class="multi-cli-section deps-section collapsible-section">
        <div class="collapsible-header">
          <span class="collapse-icon">&#9658;</span>
          <span class="section-label"><i data-lucide="git-branch" class="w-4 h-4 inline mr-1"></i> ${t('multiCli.dependencies') || 'Dependencies'} (${dependencyGraph.length})</span>
        </div>
        <div class="collapsible-content collapsed">
          <div class="deps-list">
            ${dependencyGraph.map(edge => `
              <div class="dep-edge">
                <code>${escapeHtml(edge.source || '')}</code>
                <span class="dep-arrow">&rarr;</span>
                <code>${escapeHtml(edge.target || '')}</code>
                <span class="dep-relationship">(${escapeHtml(edge.relationship || 'depends')})</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `);
  }

  return sections.length ? `<div class="multi-cli-files-tab">${sections.join('')}</div>` : `
    <div class="tab-empty-state">
      <div class="empty-icon"><i data-lucide="folder-tree" class="w-12 h-12"></i></div>
      <div class="empty-title">${t('multiCli.empty.files') || 'No Related Files'}</div>
    </div>
  `;
}

/**
 * Render file tree nodes recursively
 */
function renderFileTreeNodes(nodes, depth = 0) {
  return nodes.map(node => {
    const indent = depth * 16;
    const isDir = node.type === 'directory';
    const icon = isDir ? 'folder' : 'file';
    const modStatus = node.modificationStatus || 'unchanged';
    const impactScore = node.impactScore || '';

    let html = `
      <div class="file-tree-node" style="margin-left: ${indent}px;">
        <i data-lucide="${icon}" class="w-4 h-4 inline mr-1 file-icon ${modStatus}"></i>
        <span class="file-path ${modStatus}">${escapeHtml(node.path || '')}</span>
        ${modStatus !== 'unchanged' ? `<span class="mod-status ${modStatus}">${modStatus}</span>` : ''}
        ${impactScore ? `<span class="impact-badge ${impactScore}">${impactScore}</span>` : ''}
      </div>
    `;

    if (node.children?.length) {
      html += renderFileTreeNodes(node.children, depth + 1);
    }

    return html;
  }).join('');
}

/**
 * Render Planning tab - displays session.plan (plan.json content)
 * Reuses renderLitePlanTab style with Summary, Approach, Focus Paths, Metadata, and Tasks
 */
function renderMultiCliPlanningTab(session) {
  const plan = session.plan;

  if (!plan) {
    return `
      <div class="tab-empty-state">
        <div class="empty-icon"><i data-lucide="ruler" class="w-12 h-12"></i></div>
        <div class="empty-title">${t('multiCli.empty.planning') || 'No Planning Data'}</div>
        <div class="empty-text">${t('multiCli.empty.planningText') || 'No plan.json found for this session.'}</div>
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

      <!-- User Requirements -->
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

      <!-- Tasks (Click to view details) -->
      ${plan.tasks?.length ? `
        <div class="plan-section">
          <h4 class="plan-section-title"><i data-lucide="list-checks" class="w-4 h-4 inline mr-1"></i> Tasks (${plan.tasks.length})</h4>
          <div class="tasks-list multi-cli-tasks-list">
            ${plan.tasks.map((task, idx) => renderMultiCliTaskItem(session.id, task, idx)).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Raw JSON -->
      <div class="plan-section collapsible-section">
        <div class="collapsible-header">
          <span class="collapse-icon">&#9654;</span>
          <span class="section-label">{ } Raw JSON</span>
        </div>
        <div class="collapsible-content collapsed">
          <pre class="json-content">${escapeHtml(JSON.stringify(plan, null, 2))}</pre>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render a single task item for multi-cli-plan (reuses lite-plan style)
 * Supports click to open drawer for details
 */
function renderMultiCliTaskItem(sessionId, task, idx) {
  const taskId = task.id || `T${idx + 1}`;
  const taskJsonId = `multi-cli-task-${sessionId}-${taskId}`.replace(/[^a-zA-Z0-9-]/g, '-');
  taskJsonStore[taskJsonId] = task;

  // Get preview info - handle both normalized and raw formats
  // Normalized: meta.type, meta.scope, context.focus_paths, context.acceptance, flow_control.implementation_approach
  // Raw: action, scope, file, modification_points, implementation, acceptance
  const taskType = task.meta?.type || task.action || '';
  const scope = task.meta?.scope || task.scope || task.file || '';
  const filesCount = task.context?.focus_paths?.length || task.files?.length || task.modification_points?.length || 0;
  const implCount = task.flow_control?.implementation_approach?.length || task.implementation?.length || 0;
  const acceptCount = task.context?.acceptance?.length || task.acceptance?.length || task.acceptance_criteria?.length || 0;
  const dependsCount = task.context?.depends_on?.length || task.depends_on?.length || 0;

  // Escape for data attributes
  const safeSessionId = escapeHtml(sessionId);
  const safeTaskId = escapeHtml(taskId);

  return `
    <div class="detail-task-item-full multi-cli-task-item" data-session-id="${safeSessionId}" data-task-id="${safeTaskId}" style="cursor: pointer;" title="Click to view details">
      <div class="task-item-header-lite">
        <span class="task-id-badge">${escapeHtml(taskId)}</span>
        <span class="task-title">${escapeHtml(task.title || task.name || task.summary || 'Untitled')}</span>
        <button class="btn-view-json" data-task-json-id="${taskJsonId}" data-task-display-id="${safeTaskId}">{ } JSON</button>
      </div>
      <div class="task-item-meta-lite">
        ${taskType ? `<span class="meta-badge action">${escapeHtml(taskType)}</span>` : ''}
        ${scope ? `<span class="meta-badge scope">${escapeHtml(scope)}</span>` : ''}
        ${filesCount > 0 ? `<span class="meta-badge files">${filesCount} files</span>` : ''}
        ${implCount > 0 ? `<span class="meta-badge impl">${implCount} steps</span>` : ''}
        ${acceptCount > 0 ? `<span class="meta-badge accept">${acceptCount} criteria</span>` : ''}
        ${dependsCount > 0 ? `<span class="meta-badge depends">${dependsCount} deps</span>` : ''}
      </div>
    </div>
  `;
}

/**
 * Initialize click handlers for multi-cli task items
 */
function initMultiCliTaskClickHandlers() {
  // Task item click handlers
  document.querySelectorAll('.multi-cli-task-item').forEach(item => {
    if (!item._clickBound) {
      item._clickBound = true;
      item.addEventListener('click', function(e) {
        // Don't trigger if clicking on JSON button
        if (e.target.closest('.btn-view-json')) return;

        const sessionId = this.dataset.sessionId;
        const taskId = this.dataset.taskId;
        openTaskDrawerForMultiCli(sessionId, taskId);
      });
    }
  });

  // JSON button click handlers
  document.querySelectorAll('.multi-cli-task-item .btn-view-json').forEach(btn => {
    if (!btn._clickBound) {
      btn._clickBound = true;
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const taskJsonId = this.dataset.taskJsonId;
        const displayId = this.dataset.taskDisplayId;
        showJsonModal(taskJsonId, displayId);
      });
    }
  });
}

/**
 * Open task drawer for multi-cli task
 */
function openTaskDrawerForMultiCli(sessionId, taskId) {
  const session = liteTaskDataStore[currentSessionDetailKey];
  if (!session) return;

  // Use session.tasks (normalized from backend) with fallback to plan.tasks
  const tasks = session.tasks?.length > 0 ? session.tasks : (session.plan?.tasks || []);
  const task = tasks.find(t => (t.id || `T${tasks.indexOf(t) + 1}`) === taskId);
  if (!task) return;

  // Set current drawer tasks
  currentDrawerTasks = tasks;
  window._currentDrawerSession = session;

  document.getElementById('drawerTaskTitle').textContent = task.title || task.name || task.summary || taskId;
  document.getElementById('drawerContent').innerHTML = renderMultiCliTaskDrawerContent(task, session);
  document.getElementById('taskDetailDrawer').classList.add('open');
  document.getElementById('drawerOverlay').classList.add('active');

  // Re-init lucide icons in drawer
  setTimeout(() => {
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }, 50);
}

/**
 * Render drawer content for multi-cli task
 */
function renderMultiCliTaskDrawerContent(task, session) {
  const taskId = task.id || 'Task';
  const action = task.action || '';

  return `
    <!-- Task Header -->
    <div class="drawer-task-header">
      <span class="task-id-badge">${escapeHtml(taskId)}</span>
      ${action ? `<span class="action-badge">${escapeHtml(action.toUpperCase())}</span>` : ''}
    </div>

    <!-- Tab Navigation -->
    <div class="drawer-tabs">
      <button class="drawer-tab active" data-tab="overview" onclick="switchMultiCliDrawerTab('overview')">Overview</button>
      <button class="drawer-tab" data-tab="implementation" onclick="switchMultiCliDrawerTab('implementation')">Implementation</button>
      <button class="drawer-tab" data-tab="files" onclick="switchMultiCliDrawerTab('files')">Files</button>
      <button class="drawer-tab" data-tab="raw" onclick="switchMultiCliDrawerTab('raw')">Raw JSON</button>
    </div>

    <!-- Tab Content -->
    <div class="drawer-tab-content">
      <!-- Overview Tab (default) -->
      <div class="drawer-panel active" data-tab="overview">
        ${renderMultiCliTaskOverview(task)}
      </div>

      <!-- Implementation Tab -->
      <div class="drawer-panel" data-tab="implementation">
        ${renderMultiCliTaskImplementation(task)}
      </div>

      <!-- Files Tab -->
      <div class="drawer-panel" data-tab="files">
        ${renderMultiCliTaskFiles(task)}
      </div>

      <!-- Raw JSON Tab -->
      <div class="drawer-panel" data-tab="raw">
        <pre class="json-view">${escapeHtml(JSON.stringify(task, null, 2))}</pre>
      </div>
    </div>
  `;
}

/**
 * Switch drawer tab for multi-cli task
 */
function switchMultiCliDrawerTab(tabName) {
  document.querySelectorAll('.drawer-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  document.querySelectorAll('.drawer-panel').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.tab === tabName);
  });
}

/**
 * Render multi-cli task overview section
 * Handles both normalized format (meta, context, flow_control) and raw format
 */
function renderMultiCliTaskOverview(task) {
  let sections = [];

  // Extract from both normalized and raw formats
  const description = task.description || (task.context?.requirements?.length > 0 ? task.context.requirements.join('\n') : '');
  const scope = task.meta?.scope || task.scope || task.file || '';
  const acceptance = task.context?.acceptance || task.acceptance || task.acceptance_criteria || [];
  const dependsOn = task.context?.depends_on || task.depends_on || [];
  const focusPaths = task.context?.focus_paths || task.files?.map(f => typeof f === 'string' ? f : f.file) || [];
  const keyPoint = task._raw?.task?.key_point || task.key_point || '';

  // Description/Key Point Card
  if (description || keyPoint) {
    sections.push(`
      <div class="lite-card">
        <div class="lite-card-header">
          <span class="lite-card-icon">📝</span>
          <h4 class="lite-card-title">${t('multiCli.task.description')}</h4>
        </div>
        <div class="lite-card-body">
          ${keyPoint ? `<p class="lite-key-point"><strong>${t('multiCli.task.keyPoint')}:</strong> ${escapeHtml(keyPoint)}</p>` : ''}
          ${description ? `<p class="lite-description">${escapeHtml(description)}</p>` : ''}
        </div>
      </div>
    `);
  }

  // Scope Card
  if (scope) {
    sections.push(`
      <div class="lite-card">
        <div class="lite-card-header">
          <span class="lite-card-icon">📂</span>
          <h4 class="lite-card-title">${t('multiCli.task.scope')}</h4>
        </div>
        <div class="lite-card-body">
          <div class="lite-scope-box">
            <code>${escapeHtml(scope)}</code>
          </div>
        </div>
      </div>
    `);
  }

  // Dependencies Card
  if (dependsOn.length > 0) {
    sections.push(`
      <div class="lite-card">
        <div class="lite-card-header">
          <span class="lite-card-icon">🔗</span>
          <h4 class="lite-card-title">${t('multiCli.task.dependencies')}</h4>
        </div>
        <div class="lite-card-body">
          <div class="lite-deps-list">
            ${dependsOn.map(dep => `<span class="dep-badge">${escapeHtml(dep)}</span>`).join('')}
          </div>
        </div>
      </div>
    `);
  }

  // Focus Paths / Files Card
  if (focusPaths.length > 0) {
    sections.push(`
      <div class="lite-card">
        <div class="lite-card-header">
          <span class="lite-card-icon">📁</span>
          <h4 class="lite-card-title">${t('multiCli.task.targetFiles')}</h4>
        </div>
        <div class="lite-card-body">
          <ul class="lite-file-list">
            ${focusPaths.map(f => `<li><code>${escapeHtml(f)}</code></li>`).join('')}
          </ul>
        </div>
      </div>
    `);
  }

  // Acceptance Criteria Card
  if (acceptance.length > 0) {
    sections.push(`
      <div class="lite-card">
        <div class="lite-card-header">
          <span class="lite-card-icon">✅</span>
          <h4 class="lite-card-title">${t('multiCli.task.acceptanceCriteria')}</h4>
        </div>
        <div class="lite-card-body">
          <ul class="lite-acceptance-list">
            ${acceptance.map(ac => `<li>${escapeHtml(ac)}</li>`).join('')}
          </ul>
        </div>
      </div>
    `);
  }

  // Reference Card
  if (task.reference) {
    const ref = task.reference;
    sections.push(`
      <div class="lite-card">
        <div class="lite-card-header">
          <span class="lite-card-icon">📚</span>
          <h4 class="lite-card-title">${t('multiCli.task.reference')}</h4>
        </div>
        <div class="lite-card-body">
          ${ref.pattern ? `<div class="ref-item"><strong>${t('multiCli.task.pattern')}:</strong> ${escapeHtml(ref.pattern)}</div>` : ''}
          ${ref.files?.length ? `<div class="ref-item"><strong>${t('multiCli.task.files')}:</strong><br><code class="ref-files">${ref.files.map(f => escapeHtml(f)).join('\n')}</code></div>` : ''}
          ${ref.examples ? `<div class="ref-item"><strong>${t('multiCli.task.examples')}:</strong> ${escapeHtml(ref.examples)}</div>` : ''}
        </div>
      </div>
    `);
  }

  return sections.length ? sections.join('') : `<div class="empty-section">${t('multiCli.task.noOverviewData')}</div>`;
}

/**
 * Render multi-cli task implementation section
 * Handles both normalized format (flow_control.implementation_approach) and raw format
 */
function renderMultiCliTaskImplementation(task) {
  let sections = [];

  // Get implementation steps from normalized or raw format
  const implApproach = task.flow_control?.implementation_approach || [];
  const rawImpl = task.implementation || [];
  const modPoints = task.modification_points || [];

  // Modification Points / Flow Control Implementation Approach
  if (implApproach.length > 0) {
    sections.push(`
      <div class="drawer-section">
        <h4 class="drawer-section-title">
          <i data-lucide="list-ordered" class="w-4 h-4"></i>
          ${t('multiCli.task.implementationSteps')}
        </h4>
        <ol class="impl-steps-detail-list">
          ${implApproach.map((step, idx) => `
            <li class="impl-step-item">
              <span class="step-num">${step.step || (idx + 1)}</span>
              <span class="step-text">${escapeHtml(step.action || step)}</span>
            </li>
          `).join('')}
        </ol>
      </div>
    `);
  } else if (modPoints.length > 0) {
    sections.push(`
      <div class="drawer-section">
        <h4 class="drawer-section-title">
          <i data-lucide="file-edit" class="w-4 h-4"></i>
          ${t('multiCli.task.modificationPoints')}
        </h4>
        <ul class="mod-points-detail-list">
          ${modPoints.map(mp => `
            <li class="mod-point-item">
              <code class="mod-file">${escapeHtml(mp.file || '')}</code>
              ${mp.target ? `<span class="mod-target">→ ${escapeHtml(mp.target)}</span>` : ''}
              ${mp.function_name ? `<span class="mod-func">→ ${escapeHtml(mp.function_name)}</span>` : ''}
              ${mp.change || mp.change_type ? `<span class="mod-change">(${escapeHtml(mp.change || mp.change_type)})</span>` : ''}
            </li>
          `).join('')}
        </ul>
      </div>
    `);
  }

  // Raw Implementation Steps (if not already rendered via implApproach)
  if (rawImpl.length > 0 && implApproach.length === 0) {
    sections.push(`
      <div class="drawer-section">
        <h4 class="drawer-section-title">
          <i data-lucide="list-ordered" class="w-4 h-4"></i>
          ${t('multiCli.task.implementationSteps')}
        </h4>
        <ol class="impl-steps-detail-list">
          ${rawImpl.map((step, idx) => `
            <li class="impl-step-item">
              <span class="step-num">${idx + 1}</span>
              <span class="step-text">${escapeHtml(step)}</span>
            </li>
          `).join('')}
        </ol>
      </div>
    `);
  }

  // Verification
  if (task.verification?.length) {
    sections.push(`
      <div class="drawer-section">
        <h4 class="drawer-section-title">
          <i data-lucide="check-circle" class="w-4 h-4"></i>
          ${t('multiCli.task.verification')}
        </h4>
        <ul class="verification-list">
          ${task.verification.map(v => `<li>${escapeHtml(v)}</li>`).join('')}
        </ul>
      </div>
    `);
  }

  return sections.length ? sections.join('') : `<div class="empty-section">${t('multiCli.task.noImplementationData')}</div>`;
}

/**
 * Render multi-cli task files section
 * Handles both normalized format (context.focus_paths) and raw format
 */
function renderMultiCliTaskFiles(task) {
  const files = [];

  // Collect from normalized format (context.focus_paths)
  if (task.context?.focus_paths) {
    task.context.focus_paths.forEach(f => {
      if (f && !files.includes(f)) files.push(f);
    });
  }

  // Collect from raw files array (plan.json format)
  if (task.files) {
    task.files.forEach(f => {
      const filePath = typeof f === 'string' ? f : f.file;
      if (filePath && !files.includes(filePath)) files.push(filePath);
    });
  }

  // Collect from modification_points
  if (task.modification_points) {
    task.modification_points.forEach(mp => {
      if (mp.file && !files.includes(mp.file)) files.push(mp.file);
    });
  }

  // Collect from scope/file (legacy)
  if (task.scope && !files.includes(task.scope)) files.push(task.scope);
  if (task.file && !files.includes(task.file)) files.push(task.file);

  // Collect from reference.files
  if (task.reference?.files) {
    task.reference.files.forEach(f => {
      if (f && !files.includes(f)) files.push(f);
    });
  }

  if (files.length === 0) {
    return `<div class="empty-section">${t('multiCli.task.noFilesSpecified')}</div>`;
  }

  return `
    <div class="drawer-section">
      <h4 class="drawer-section-title">${t('multiCli.task.targetFiles')}</h4>
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

/**
 * Render a single requirement item
 */
function renderRequirementItem(req) {
  const priorityColors = {
    'critical': 'error',
    'high': 'warning',
    'medium': 'info',
    'low': 'default'
  };
  const priority = req.priority || 'medium';
  const colorClass = priorityColors[priority] || 'default';

  return `
    <div class="requirement-item">
      <div class="requirement-header">
        <span class="requirement-id">${escapeHtml(req.id || '')}</span>
        <span class="priority-badge ${colorClass}">${escapeHtml(priority)}</span>
      </div>
      <div class="requirement-desc">${escapeHtml(getI18nText(req.description))}</div>
      ${req.source ? `<div class="requirement-source">${t('multiCli.source') || 'Source'}: ${escapeHtml(req.source)}</div>` : ''}
    </div>
  `;
}

/**
 * Render Decision tab
 * Shows: selectedSolution, rejectedAlternatives, confidenceScore
 */
function renderMultiCliDecisionTab(session) {
  // Use helper to extract decision from synthesis data structure
  const decision = extractDecisionFromSynthesis(session.latestSynthesis);

  if (!decision || !decision.selectedSolution) {
    return `
      <div class="tab-empty-state">
        <div class="empty-icon"><i data-lucide="check-circle" class="w-12 h-12"></i></div>
        <div class="empty-title">${t('multiCli.empty.decision') || 'No Decision Yet'}</div>
        <div class="empty-text">${t('multiCli.empty.decisionText') || 'No decision has been made for this discussion yet.'}</div>
      </div>
    `;
  }

  const status = decision.status || 'pending';
  const summary = getI18nText(decision.summary) || '';
  const selectedSolution = decision.selectedSolution || null;
  const rejectedAlternatives = decision.rejectedAlternatives || [];
  const confidenceScore = decision.confidenceScore || 0;

  let sections = [];

  // Decision Status and Summary
  sections.push(`
    <div class="multi-cli-section decision-header-section">
      <div class="decision-status-bar ${confidenceScore >= 0.7 ? 'converged' : 'divergent'}">
        <div class="decision-status-wrapper">
          <span class="decision-status ${status}">${escapeHtml(status)}</span>
        </div>
        <div class="decision-confidence">
          <span class="decision-confidence-label">${t('multiCli.confidence') || 'Confidence'}:</span>
          <div class="decision-confidence-bar">
            <div class="decision-confidence-fill" style="width: ${(confidenceScore * 100).toFixed(0)}%"></div>
          </div>
          <span class="decision-confidence-value">${(confidenceScore * 100).toFixed(0)}%</span>
        </div>
      </div>
      ${summary ? `<p class="decision-summary-text">${escapeHtml(summary)}</p>` : ''}
    </div>
  `);

  // Selected Solution
  if (selectedSolution) {
    sections.push(`
      <div class="multi-cli-section selected-solution-section">
        <h4 class="section-title"><i data-lucide="check-circle" class="w-4 h-4 inline mr-1"></i> ${t('multiCli.selectedSolution') || 'Selected Solution'}</h4>
        ${renderSolutionCard(selectedSolution, true)}
      </div>
    `);
  }

  // Rejected Alternatives
  if (rejectedAlternatives.length) {
    sections.push(`
      <div class="multi-cli-section rejected-section collapsible-section">
        <div class="collapsible-header">
          <span class="collapse-icon">&#9658;</span>
          <span class="section-label"><i data-lucide="x-circle" class="w-4 h-4 inline mr-1"></i> ${t('multiCli.rejectedAlternatives') || 'Rejected Alternatives'} (${rejectedAlternatives.length})</span>
        </div>
        <div class="collapsible-content collapsed">
          ${rejectedAlternatives.map(alt => renderSolutionCard(alt, false)).join('')}
        </div>
      </div>
    `);
  }

  return `<div class="multi-cli-decision-tab">${sections.join('')}</div>`;
}

/**
 * Render a solution card
 */
function renderSolutionCard(solution, isSelected) {
  const title = getI18nText(solution.title) || 'Untitled Solution';
  const description = getI18nText(solution.description) || '';
  const pros = solution.pros || [];
  const cons = solution.cons || [];
  const risk = solution.risk || 'medium';
  const effort = getI18nText(solution.estimatedEffort) || '';
  const rejectionReason = solution.rejectionReason ? getI18nText(solution.rejectionReason) : '';
  const sourceCLIs = solution.sourceCLIs || [];

  return `
    <div class="solution-card ${isSelected ? 'selected' : 'rejected'}">
      <div class="solution-header">
        <span class="solution-id">${escapeHtml(solution.id || '')}</span>
        <span class="solution-title">${escapeHtml(title)}</span>
        <span class="risk-badge ${risk}">${escapeHtml(risk)}</span>
      </div>
      ${description ? `<p class="solution-desc">${escapeHtml(description)}</p>` : ''}
      ${rejectionReason ? `<div class="rejection-reason"><strong>${t('multiCli.rejectionReason') || 'Reason'}:</strong> ${escapeHtml(rejectionReason)}</div>` : ''}
      <div class="solution-details">
        ${pros.length ? `
          <div class="pros-section">
            <strong>${t('multiCli.pros') || 'Pros'}:</strong>
            <ul class="pros-list">${pros.map(p => `<li class="pro-item">${escapeHtml(getI18nText(p))}</li>`).join('')}</ul>
          </div>
        ` : ''}
        ${cons.length ? `
          <div class="cons-section">
            <strong>${t('multiCli.cons') || 'Cons'}:</strong>
            <ul class="cons-list">${cons.map(c => `<li class="con-item">${escapeHtml(getI18nText(c))}</li>`).join('')}</ul>
          </div>
        ` : ''}
        ${effort ? `<div class="effort-estimate"><strong>${t('multiCli.effort') || 'Effort'}:</strong> ${escapeHtml(effort)}</div>` : ''}
        ${sourceCLIs.length ? `<div class="source-clis"><strong>${t('multiCli.sources') || 'Sources'}:</strong> ${sourceCLIs.map(s => `<span class="cli-badge">${escapeHtml(s)}</span>`).join('')}</div>` : ''}
      </div>
    </div>
  `;
}

/**
 * Render Timeline tab
 * Shows: decisionRecords.timeline
 */
function renderMultiCliTimelineTab(session) {
  // Use helper to extract timeline from synthesis data structure
  const timeline = extractTimelineFromSynthesis(session.latestSynthesis);

  if (!timeline || !timeline.length) {
    return `
      <div class="tab-empty-state">
        <div class="empty-icon"><i data-lucide="git-commit" class="w-12 h-12"></i></div>
        <div class="empty-title">${t('multiCli.empty.timeline') || 'No Timeline Events'}</div>
        <div class="empty-text">${t('multiCli.empty.timelineText') || 'No decision timeline available for this session.'}</div>
      </div>
    `;
  }

  const eventTypeIcons = {
    'proposal': 'lightbulb',
    'argument': 'message-square',
    'agreement': 'thumbs-up',
    'disagreement': 'thumbs-down',
    'decision': 'check-circle',
    'reversal': 'rotate-ccw'
  };

  return `
    <div class="multi-cli-timeline-tab">
      <div class="timeline-container">
        ${timeline.map(event => {
          const icon = eventTypeIcons[event.type] || 'circle';
          const contributor = event.contributor || {};
          const summary = getI18nText(event.summary) || '';
          const evidence = event.evidence || [];

          return `
            <div class="timeline-event event-${event.type || 'default'}">
              <div class="timeline-marker">
                <i data-lucide="${icon}" class="w-4 h-4"></i>
              </div>
              <div class="timeline-content">
                <div class="event-header">
                  <span class="event-type ${event.type || ''}">${escapeHtml(event.type || 'event')}</span>
                  <span class="event-contributor"><i data-lucide="user" class="w-3.5 h-3.5"></i>${escapeHtml(contributor.name || 'Unknown')}</span>
                  <span class="event-time">${formatDate(event.timestamp)}</span>
                </div>
                <div class="event-summary">${escapeHtml(summary)}</div>
                ${event.reversibility ? `<span class="reversibility-badge ${event.reversibility}">${escapeHtml(event.reversibility)}</span>` : ''}
                ${evidence.length ? `
                  <div class="event-evidence">
                    ${evidence.map(ev => `
                      <div class="evidence-item evidence-${ev.type || 'reference'}">
                        <span class="evidence-type">${escapeHtml(ev.type || 'reference')}</span>
                        <span class="evidence-desc">${escapeHtml(getI18nText(ev.description))}</span>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/**
 * Render Rounds tab
 * Shows: navigation between round synthesis files
 */
function renderMultiCliRoundsTab(session) {
  const rounds = session.rounds || [];
  const metadata = session.metadata || {};
  const totalRounds = metadata.roundId || rounds.length || 1;

  if (!rounds.length && totalRounds <= 1) {
    // Show current synthesis as single round
    return `
      <div class="multi-cli-rounds-tab">
        <div class="rounds-nav">
          <div class="round-item active" data-round="1">
            <span class="round-number">Round 1</span>
            <span class="round-status">${t('multiCli.currentRound') || 'Current'}</span>
          </div>
        </div>
        <div class="round-content">
          <div class="round-info">
            <p>${t('multiCli.singleRoundInfo') || 'This is a single-round discussion. View other tabs for details.'}</p>
          </div>
        </div>
      </div>
    `;
  }

  // Render round navigation and content
  return `
    <div class="multi-cli-rounds-tab">
      <div class="rounds-nav">
        ${rounds.map((round, idx) => {
          const roundNum = idx + 1;
          const isActive = roundNum === totalRounds;
          const roundStatus = round.convergence?.recommendation || 'continue';

          return `
            <div class="round-item ${isActive ? 'active' : ''}" data-round="${roundNum}" onclick="loadMultiCliRound('${currentSessionDetailKey}', ${roundNum})">
              <span class="round-number">Round ${roundNum}</span>
              <span class="round-status ${roundStatus}">${escapeHtml(roundStatus)}</span>
            </div>
          `;
        }).join('')}
      </div>
      <div class="round-content" id="multiCliRoundContent">
        ${renderRoundContent(rounds[totalRounds - 1] || rounds[0] || session)}
      </div>
    </div>
  `;
}

/**
 * Render content for a specific round
 */
function renderRoundContent(round) {
  if (!round) {
    return `<div class="round-empty">${t('multiCli.noRoundData') || 'No data for this round.'}</div>`;
  }

  const metadata = round.metadata || {};
  const agents = metadata.contributingAgents || [];
  const convergence = round._internal?.convergence || {};
  const crossVerification = round._internal?.cross_verification || {};

  let sections = [];

  // Round metadata
  sections.push(`
    <div class="round-metadata">
      <div class="meta-row">
        <span class="meta-label">${t('multiCli.roundId') || 'Round'}:</span>
        <span class="meta-value">${metadata.roundId || 1}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">${t('multiCli.timestamp') || 'Time'}:</span>
        <span class="meta-value">${formatDate(metadata.timestamp)}</span>
      </div>
      ${metadata.durationSeconds ? `
        <div class="meta-row">
          <span class="meta-label">${t('multiCli.duration') || 'Duration'}:</span>
          <span class="meta-value">${metadata.durationSeconds}s</span>
        </div>
      ` : ''}
    </div>
  `);

  // Contributing agents
  if (agents.length) {
    sections.push(`
      <div class="round-agents">
        <strong>${t('multiCli.contributors') || 'Contributors'}:</strong>
        ${agents.map(agent => `<span class="agent-badge">${escapeHtml(agent.name || agent.id)}</span>`).join('')}
      </div>
    `);
  }

  // Convergence metrics
  if (convergence.score !== undefined) {
    sections.push(`
      <div class="round-convergence">
        <strong>${t('multiCli.convergence') || 'Convergence'}:</strong>
        <span class="convergence-score">${(convergence.score * 100).toFixed(0)}%</span>
        <span class="convergence-rec ${convergence.recommendation || ''}">${escapeHtml(convergence.recommendation || '')}</span>
        ${convergence.new_insights ? `<span class="new-insights-badge">${t('multiCli.newInsights') || 'New Insights'}</span>` : ''}
      </div>
    `);
  }

  // Cross-verification
  if (crossVerification.agreements?.length || crossVerification.disagreements?.length) {
    sections.push(`
      <div class="round-verification collapsible-section">
        <div class="collapsible-header">
          <span class="collapse-icon">&#9658;</span>
          <span class="section-label">${t('multiCli.crossVerification') || 'Cross-Verification'}</span>
        </div>
        <div class="collapsible-content collapsed">
          ${crossVerification.agreements?.length ? `
            <div class="agreements">
              <strong>${t('multiCli.agreements') || 'Agreements'}:</strong>
              <ul>${crossVerification.agreements.map(a => `<li class="agreement">${escapeHtml(a)}</li>`).join('')}</ul>
            </div>
          ` : ''}
          ${crossVerification.disagreements?.length ? `
            <div class="disagreements">
              <strong>${t('multiCli.disagreements') || 'Disagreements'}:</strong>
              <ul>${crossVerification.disagreements.map(d => `<li class="disagreement">${escapeHtml(d)}</li>`).join('')}</ul>
            </div>
          ` : ''}
          ${crossVerification.resolution ? `
            <div class="resolution">
              <strong>${t('multiCli.resolution') || 'Resolution'}:</strong>
              <p>${escapeHtml(crossVerification.resolution)}</p>
            </div>
          ` : ''}
        </div>
      </div>
    `);
  }

  // Round solutions
  if (round.solutions && round.solutions.length > 0) {
    sections.push(`
      <div class="round-solutions">
        <strong>${t('multiCli.solutions') || 'Solutions'} (${round.solutions.length}):</strong>
        <div class="solutions-list">
          ${round.solutions.map((solution, idx) => `
            <div class="solution-card">
              <div class="solution-header">
                <div class="solution-title">
                  <span class="solution-number">${idx + 1}</span>
                  <span class="solution-name">${escapeHtml(solution.name || `Solution ${idx + 1}`)}</span>
                </div>
                <div class="solution-meta">
                  ${solution.source_cli?.length ? `
                    <div class="source-clis">
                      ${solution.source_cli.map(cli => `<span class="cli-badge">${escapeHtml(cli)}</span>`).join('')}
                    </div>
                  ` : ''}
                  <div class="solution-scores">
                    <span class="score-badge feasibility" title="Feasibility">
                      ${Math.round((solution.feasibility || 0) * 100)}%
                    </span>
                    <span class="score-badge effort-${solution.effort || 'medium'}" title="Effort">
                      ${escapeHtml(solution.effort || 'medium')}
                    </span>
                    <span class="score-badge risk-${solution.risk || 'medium'}" title="Risk">
                      ${escapeHtml(solution.risk || 'medium')}
                    </span>
                  </div>
                </div>
              </div>

              ${solution.summary ? `
                <div class="solution-summary">
                  ${escapeHtml(getI18nText(solution.summary))}
                </div>
              ` : ''}

              ${solution.implementation_plan?.approach ? `
                <div class="solution-approach collapsible-section">
                  <div class="collapsible-header">
                    <span class="collapse-icon">&#9658;</span>
                    <span class="section-label">${t('multiCli.implementation') || 'Implementation Approach'}</span>
                  </div>
                  <div class="collapsible-content collapsed">
                    <p>${escapeHtml(getI18nText(solution.implementation_plan.approach))}</p>

                    ${solution.implementation_plan.tasks?.length ? `
                      <div class="solution-tasks">
                        <strong>${t('multiCli.tasks') || 'Tasks'}:</strong>
                        <ul class="task-list">
                          ${solution.implementation_plan.tasks.map(task => `
                            <li class="task-item">
                              <span class="task-id">${escapeHtml(task.id || '')}</span>
                              <span class="task-name">${escapeHtml(getI18nText(task.name))}</span>
                              ${task.key_point ? `<span class="task-key-point">${escapeHtml(getI18nText(task.key_point))}</span>` : ''}
                            </li>
                          `).join('')}
                        </ul>
                      </div>
                    ` : ''}

                    ${solution.implementation_plan.execution_flow ? `
                      <div class="execution-flow">
                        <strong>${t('multiCli.executionFlow') || 'Execution Flow'}:</strong>
                        <code class="flow-code">${escapeHtml(solution.implementation_plan.execution_flow)}</code>
                      </div>
                    ` : ''}

                    ${solution.implementation_plan.milestones?.length ? `
                      <div class="solution-milestones">
                        <strong>${t('multiCli.milestones') || 'Milestones'}:</strong>
                        <ul class="milestone-list">
                          ${solution.implementation_plan.milestones.map(milestone => `
                            <li class="milestone-item">${escapeHtml(getI18nText(milestone))}</li>
                          `).join('')}
                        </ul>
                      </div>
                    ` : ''}
                  </div>
                </div>
              ` : ''}

              ${(solution.dependencies?.internal?.length || solution.dependencies?.external?.length) ? `
                <div class="solution-dependencies collapsible-section">
                  <div class="collapsible-header">
                    <span class="collapse-icon">&#9658;</span>
                    <span class="section-label">${t('multiCli.dependencies') || 'Dependencies'}</span>
                  </div>
                  <div class="collapsible-content collapsed">
                    ${solution.dependencies.internal?.length ? `
                      <div class="internal-deps">
                        <strong>${t('multiCli.internalDeps') || 'Internal'}:</strong>
                        <ul class="dep-list">
                          ${solution.dependencies.internal.map(dep => `
                            <li class="dep-item">${escapeHtml(getI18nText(dep))}</li>
                          `).join('')}
                        </ul>
                      </div>
                    ` : ''}
                    ${solution.dependencies.external?.length ? `
                      <div class="external-deps">
                        <strong>${t('multiCli.externalDeps') || 'External'}:</strong>
                        <ul class="dep-list">
                          ${solution.dependencies.external.map(dep => `
                            <li class="dep-item">${escapeHtml(getI18nText(dep))}</li>
                          `).join('')}
                        </ul>
                      </div>
                    ` : ''}
                  </div>
                </div>
              ` : ''}

              ${solution.technical_concerns?.length ? `
                <div class="solution-concerns collapsible-section">
                  <div class="collapsible-header">
                    <span class="collapse-icon">&#9658;</span>
                    <span class="section-label">${t('multiCli.technicalConcerns') || 'Technical Concerns'}</span>
                  </div>
                  <div class="collapsible-content collapsed">
                    <ul class="concern-list">
                      ${solution.technical_concerns.map(concern => `
                        <li class="concern-item">${escapeHtml(getI18nText(concern))}</li>
                      `).join('')}
                    </ul>
                  </div>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `);
  }

  return sections.join('');
}

/**
 * Load a specific round's data (async, may fetch from server)
 */
async function loadMultiCliRound(sessionKey, roundNum) {
  const session = liteTaskDataStore[sessionKey];
  if (!session) return;

  // Update active state in nav
  document.querySelectorAll('.round-item').forEach(item => {
    item.classList.toggle('active', parseInt(item.dataset.round) === roundNum);
  });

  const contentArea = document.getElementById('multiCliRoundContent');

  // If we have rounds array, use it
  if (session.rounds && session.rounds[roundNum - 1]) {
    contentArea.innerHTML = renderRoundContent(session.rounds[roundNum - 1]);
    initCollapsibleSections(contentArea);
    return;
  }

  // Otherwise try to fetch from server
  if (window.SERVER_MODE && session.path) {
    contentArea.innerHTML = `<div class="tab-loading">${t('common.loading') || 'Loading...'}</div>`;
    try {
      const response = await fetch(`/api/session-detail?path=${encodeURIComponent(session.path)}&type=round&round=${roundNum}`);
      if (response.ok) {
        const data = await response.json();
        contentArea.innerHTML = renderRoundContent(data.round || {});
        initCollapsibleSections(contentArea);
        return;
      }
    } catch (err) {
      console.error('Failed to load round:', err);
    }
  }

  // Fallback
  contentArea.innerHTML = `<div class="round-empty">${t('multiCli.noRoundData') || 'No data for this round.'}</div>`;
}

/**
 * Render Discussion Section (combines Topic, Rounds, Decision)
 * Uses accordion layout to display discussion rounds
 */
function renderMultiCliDiscussionSection(session) {
  const rounds = session.rounds || [];
  const metadata = session.metadata || {};
  const totalRounds = metadata.roundId || rounds.length || 1;
  const topic = session.discussionTopic || session.latestSynthesis?.discussionTopic || {};

  // If no rounds, show topic summary and current synthesis
  if (!rounds.length) {
    const title = getI18nText(topic.title) || t('multiCli.discussion.discussionTopic');
    const description = getI18nText(topic.description) || '';
    const status = topic.status || session.status || 'analyzing';

    return `
      <div class="multi-cli-discussion-section">
        <div class="discussion-header">
          <h3 class="discussion-title">${escapeHtml(title)}</h3>
          <span class="discussion-status ${status}">${escapeHtml(status)}</span>
        </div>
        ${description ? `<p class="discussion-description">${escapeHtml(description)}</p>` : ''}
        <div class="discussion-empty-state">
          <i data-lucide="message-circle" class="w-8 h-8"></i>
          <p>${t('multiCli.singleRoundInfo')}</p>
        </div>
      </div>
    `;
  }

  // Render accordion for multiple rounds
  const accordionItems = rounds.map((round, idx) => {
    const roundNum = idx + 1;
    const isLatest = roundNum === totalRounds;
    const roundMeta = round.metadata || {};
    const convergence = round._internal?.convergence || round.convergence || {};
    const recommendation = convergence.recommendation || 'continue';
    const score = convergence.score !== undefined ? Math.round(convergence.score * 100) : null;
    const solutions = round.solutions || [];
    const agents = roundMeta.contributingAgents || [];

    return `
      <div class="discussion-round collapsible-section ${isLatest ? 'expanded' : ''}">
        <div class="collapsible-header discussion-round-header">
          <span class="collapse-icon">${isLatest ? '&#9660;' : '&#9658;'}</span>
          <div class="round-title-group">
            <span class="round-badge">${t('multiCli.round') || 'Round'} ${roundNum}</span>
            <span class="round-timestamp">${formatDate(roundMeta.timestamp)}</span>
          </div>
          <div class="round-indicators">
            ${score !== null ? `<span class="convergence-badge" title="${t('multiCli.convergence') || 'Convergence'}">${score}%</span>` : ''}
            <span class="recommendation-badge ${recommendation}">${escapeHtml(recommendation)}</span>
          </div>
        </div>
        <div class="collapsible-content ${isLatest ? '' : 'collapsed'}">
          <!-- Discussion Topic for this round -->
          ${round.discussionTopic ? `
            <div class="round-topic">
              <h4 class="round-section-title"><i data-lucide="message-circle" class="w-4 h-4 inline"></i> ${t('multiCli.topic') || 'Topic'}</h4>
              <p>${escapeHtml(getI18nText(round.discussionTopic.title || round.discussionTopic))}</p>
            </div>
          ` : ''}

          <!-- Contributing Agents -->
          ${agents.length ? `
            <div class="round-agents">
              <h4 class="round-section-title"><i data-lucide="users" class="w-4 h-4 inline"></i> ${t('multiCli.contributors') || 'Contributors'}</h4>
              <div class="agent-badges">
                ${agents.map(agent => `<span class="agent-badge">${escapeHtml(agent.name || agent.id || agent)}</span>`).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Solutions -->
          ${solutions.length ? `
            <div class="round-solutions-summary">
              <h4 class="round-section-title"><i data-lucide="lightbulb" class="w-4 h-4 inline"></i> ${t('multiCli.solutions')} (${solutions.length})</h4>
              <div class="solution-cards-grid">
                ${solutions.map((sol, sidx) => `
                  <div class="solution-mini-card">
                    <div class="solution-mini-header">
                      <span class="solution-number">${sidx + 1}</span>
                      <span class="solution-name">${escapeHtml(sol.name || `${t('multiCli.summary.solution')} ${sidx + 1}`)}</span>
                    </div>
                    <div class="solution-mini-scores">
                      <span class="score-pill feasibility" title="${t('multiCli.feasibility')}">${Math.round((sol.feasibility || 0) * 100)}%</span>
                      <span class="score-pill effort-${sol.effort || 'medium'}">${escapeHtml(sol.effort || 'M')}</span>
                      <span class="score-pill risk-${sol.risk || 'medium'}">${escapeHtml(sol.risk || 'M')}</span>
                    </div>
                    ${sol.summary ? `<p class="solution-mini-summary">${escapeHtml(getI18nText(sol.summary).substring(0, 100))}${getI18nText(sol.summary).length > 100 ? '...' : ''}</p>` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Decision/Recommendation -->
          ${convergence.reasoning || round.decision ? `
            <div class="round-decision">
              <h4 class="round-section-title"><i data-lucide="check-circle" class="w-4 h-4 inline"></i> ${t('multiCli.decision')}</h4>
              <p class="decision-text">${escapeHtml(convergence.reasoning || round.decision || '')}</p>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="multi-cli-discussion-section">
      <div class="discussion-header">
        <h3 class="discussion-title">${escapeHtml(getI18nText(topic.title) || t('multiCli.discussion.title'))}</h3>
        <span class="rounds-count">${totalRounds} ${t('multiCli.tab.rounds')}</span>
      </div>
      <div class="discussion-accordion">
        ${accordionItems}
      </div>
    </div>
  `;
}

/**
 * Render Association Section (context-package key fields)
 * Shows solution summary, dependencies, consensus
 */
function renderMultiCliAssociationSection(session) {
  const contextPkg = session.contextPackage || session.context_package || session.latestSynthesis?.context_package || {};
  const solutions = contextPkg.solutions || session.latestSynthesis?.solutions || [];
  const dependencies = contextPkg.dependencies || {};
  const consensus = contextPkg.consensus || session.latestSynthesis?._internal?.cross_verification || {};
  const relatedFiles = extractFilesFromSynthesis(session.latestSynthesis);

  // Check if we have any content to display
  const hasSolutions = solutions.length > 0;
  const hasDependencies = dependencies.internal?.length || dependencies.external?.length;
  const hasConsensus = consensus.agreements?.length || consensus.resolved_conflicts?.length || consensus.disagreements?.length;
  const hasFiles = relatedFiles?.fileTree?.length || relatedFiles?.impactSummary?.length;

  if (!hasSolutions && !hasDependencies && !hasConsensus && !hasFiles) {
    return `
      <div class="tab-empty-state">
        <div class="empty-icon"><i data-lucide="link-2" class="w-12 h-12"></i></div>
        <div class="empty-title">${t('multiCli.empty.association') || 'No Association Data'}</div>
        <div class="empty-text">${t('multiCli.empty.associationText') || 'No context package or related files available for this session.'}</div>
      </div>
    `;
  }

  let sections = [];

  // Solution Summary Cards
  if (hasSolutions) {
    sections.push(`
      <div class="association-section solutions-section">
        <h4 class="association-section-title">
          <i data-lucide="lightbulb" class="w-4 h-4 inline"></i>
          ${t('multiCli.solutionSummary') || 'Solution Summary'}
        </h4>
        <div class="association-cards-grid">
          ${solutions.map((sol, idx) => `
            <div class="association-card solution-card">
              <div class="card-header">
                <span class="card-number">${idx + 1}</span>
                <span class="card-title">${escapeHtml(sol.name || 'Solution ' + (idx + 1))}</span>
              </div>
              <div class="card-metrics">
                <div class="metric">
                  <span class="metric-label">${t('multiCli.feasibility') || 'Feasibility'}</span>
                  <span class="metric-value">${Math.round((sol.feasibility || 0) * 100)}%</span>
                </div>
                <div class="metric">
                  <span class="metric-label">${t('multiCli.effort') || 'Effort'}</span>
                  <span class="metric-value effort-${sol.effort || 'medium'}">${escapeHtml(sol.effort || 'medium')}</span>
                </div>
                <div class="metric">
                  <span class="metric-label">${t('multiCli.risk') || 'Risk'}</span>
                  <span class="metric-value risk-${sol.risk || 'medium'}">${escapeHtml(sol.risk || 'medium')}</span>
                </div>
              </div>
              ${sol.summary ? `<p class="card-description">${escapeHtml(getI18nText(sol.summary))}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `);
  }

  // Dependencies Card
  if (hasDependencies) {
    sections.push(`
      <div class="association-section dependencies-section">
        <h4 class="association-section-title">
          <i data-lucide="git-branch" class="w-4 h-4 inline"></i>
          ${t('multiCli.dependencies') || 'Dependencies'}
        </h4>
        <div class="dependencies-grid">
          ${dependencies.internal?.length ? `
            <div class="association-card dependency-card">
              <div class="card-header">
                <i data-lucide="folder" class="w-4 h-4"></i>
                <span class="card-title">${t('multiCli.internalDeps') || 'Internal'}</span>
                <span class="card-count">${dependencies.internal.length}</span>
              </div>
              <ul class="dependency-list">
                ${dependencies.internal.map(dep => `<li>${escapeHtml(getI18nText(dep))}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${dependencies.external?.length ? `
            <div class="association-card dependency-card">
              <div class="card-header">
                <i data-lucide="package" class="w-4 h-4"></i>
                <span class="card-title">${t('multiCli.externalDeps') || 'External'}</span>
                <span class="card-count">${dependencies.external.length}</span>
              </div>
              <ul class="dependency-list">
                ${dependencies.external.map(dep => `<li>${escapeHtml(getI18nText(dep))}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </div>
    `);
  }

  // Consensus Card
  if (hasConsensus) {
    sections.push(`
      <div class="association-section consensus-section">
        <h4 class="association-section-title">
          <i data-lucide="check-check" class="w-4 h-4 inline"></i>
          ${t('multiCli.consensus') || 'Consensus'}
        </h4>
        <div class="consensus-grid">
          ${consensus.agreements?.length ? `
            <div class="association-card consensus-card agreements">
              <div class="card-header">
                <i data-lucide="thumbs-up" class="w-4 h-4"></i>
                <span class="card-title">${t('multiCli.agreements') || 'Agreements'}</span>
                <span class="card-count">${consensus.agreements.length}</span>
              </div>
              <ul class="consensus-list">
                ${consensus.agreements.map(item => `<li class="agreement-item">${escapeHtml(item)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${(consensus.resolved_conflicts?.length || consensus.disagreements?.length) ? `
            <div class="association-card consensus-card conflicts">
              <div class="card-header">
                <i data-lucide="git-merge" class="w-4 h-4"></i>
                <span class="card-title">${t('multiCli.resolvedConflicts') || 'Resolved Conflicts'}</span>
                <span class="card-count">${(consensus.resolved_conflicts || consensus.disagreements || []).length}</span>
              </div>
              <ul class="consensus-list">
                ${(consensus.resolved_conflicts || consensus.disagreements || []).map(item => `<li class="conflict-item">${escapeHtml(item)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </div>
    `);
  }

  // Related Files (from existing Files tab logic)
  if (hasFiles) {
    sections.push(`
      <div class="association-section files-section">
        <h4 class="association-section-title">
          <i data-lucide="folder-tree" class="w-4 h-4 inline"></i>
          ${t('multiCli.tab.files') || 'Related Files'}
        </h4>
        <div class="files-summary">
          ${relatedFiles.fileTree?.length ? `
            <div class="files-list">
              ${relatedFiles.fileTree.slice(0, 10).map(file => `
                <div class="file-item">
                  <i data-lucide="file" class="w-3 h-3"></i>
                  <span class="file-path">${escapeHtml(typeof file === 'string' ? file : file.path || file.name)}</span>
                </div>
              `).join('')}
              ${relatedFiles.fileTree.length > 10 ? `
                <div class="files-more">+${relatedFiles.fileTree.length - 10} ${t('common.more') || 'more'}</div>
              ` : ''}
            </div>
          ` : ''}
          ${relatedFiles.impactSummary?.length ? `
            <div class="impact-summary">
              <h5>${t('multiCli.impactSummary') || 'Impact Summary'}</h5>
              <ul>
                ${relatedFiles.impactSummary.slice(0, 5).map(item => `<li>${escapeHtml(getI18nText(item))}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </div>
    `);
  }

  return `
    <div class="multi-cli-association-section">
      ${sections.join('')}
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
          <span class="info-label">${t('detail.created')}</span>
          <span class="info-value">${formatDate(session.createdAt)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">${t('detail.tasks')}</span>
          <span class="info-value">${tasks.length} ${t('session.tasks')}</span>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="detail-tabs">
        <button class="detail-tab active" data-tab="tasks" onclick="switchLiteDetailTab('tasks')">
          <span class="tab-icon"><i data-lucide="list-checks" class="w-4 h-4"></i></span>
          <span class="tab-text">${t('tab.tasks')}</span>
          <span class="tab-count">${tasks.length}</span>
        </button>
        <button class="detail-tab" data-tab="plan" onclick="switchLiteDetailTab('plan')">
          <span class="tab-icon"><i data-lucide="ruler" class="w-4 h-4"></i></span>
          <span class="tab-text">${t('tab.plan')}</span>
        </button>
        ${session.type === 'lite-fix' ? `
        <button class="detail-tab" data-tab="diagnoses" onclick="switchLiteDetailTab('diagnoses')">
          <span class="tab-icon"><i data-lucide="stethoscope" class="w-4 h-4"></i></span>
          <span class="tab-text">${t('tab.diagnoses')}</span>
          ${session.diagnoses?.items?.length ? `<span class="tab-count">${session.diagnoses.items.length}</span>` : ''}
        </button>
        ` : ''}
        <button class="detail-tab" data-tab="context" onclick="switchLiteDetailTab('context')">
          <span class="tab-icon"><i data-lucide="package" class="w-4 h-4"></i></span>
          <span class="tab-text">${t('tab.context')}</span>
        </button>
        <button class="detail-tab" data-tab="summary" onclick="switchLiteDetailTab('summary')">
          <span class="tab-icon"><i data-lucide="file-text" class="w-4 h-4"></i></span>
          <span class="tab-text">${t('tab.summary')}</span>
        </button>
      </div>

      <!-- Tab Content -->
      <div class="detail-tab-content" id="liteDetailTabContent">
        ${renderLiteTasksTab(session, tasks, completed, inProgress, pending)}
      </div>
    </div>
  `;

  // Initialize collapsible sections and task click handlers
  setTimeout(() => {
    document.querySelectorAll('.collapsible-header').forEach(header => {
      header.addEventListener('click', () => toggleSection(header));
    });
    // Bind click events to lite task items on initial load
    initLiteTaskClickHandlers();
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
      // Re-initialize collapsible sections and task click handlers
      setTimeout(() => {
        document.querySelectorAll('.collapsible-header').forEach(header => {
          header.addEventListener('click', () => toggleSection(header));
        });
        // Bind click events to lite task items
        initLiteTaskClickHandlers();
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
        <div class="empty-title">${t('empty.noTasks')}</div>
        <div class="empty-text">${t('empty.noTasksText')}</div>
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

  // Escape for data attributes
  const safeSessionId = escapeHtml(sessionId);
  const safeTaskId = escapeHtml(task.id);

  return `
    <div class="detail-task-item-full lite-task-item" data-session-id="${safeSessionId}" data-task-id="${safeTaskId}" style="cursor: pointer;" title="Click to view details">
      <div class="task-item-header-lite">
        <span class="task-id-badge">${escapeHtml(task.id)}</span>
        <span class="task-title">${escapeHtml(task.title || 'Untitled')}</span>
        <button class="btn-view-json" data-task-json-id="${taskJsonId}" data-task-display-id="${safeTaskId}">{ } JSON</button>
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

/**
 * Initialize click handlers for lite task items
 */
function initLiteTaskClickHandlers() {
  // Task item click handlers
  document.querySelectorAll('.lite-task-item').forEach(item => {
    if (!item._clickBound) {
      item._clickBound = true;
      item.addEventListener('click', function(e) {
        // Don't trigger if clicking on JSON button
        if (e.target.closest('.btn-view-json')) return;

        const sessionId = this.dataset.sessionId;
        const taskId = this.dataset.taskId;
        openTaskDrawerForLite(sessionId, taskId);
      });
    }
  });

  // JSON button click handlers
  document.querySelectorAll('.btn-view-json').forEach(btn => {
    if (!btn._clickBound) {
      btn._clickBound = true;
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const taskJsonId = this.dataset.taskJsonId;
        const displayId = this.dataset.taskDisplayId;
        showJsonModal(taskJsonId, displayId);
      });
    }
  });
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
        contentArea.innerHTML = renderLiteContextContent(data.context, data.explorations, session, data.diagnoses);

        // Re-initialize collapsible sections for explorations and diagnoses (scoped to contentArea)
        initCollapsibleSections(contentArea);
        return;
      }
    }
    // Fallback: show plan context if available
    contentArea.innerHTML = renderLiteContextContent(null, null, session, null);
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
        <div class="empty-title">${t('empty.noDiagnoses')}</div>
        <div class="empty-text">${t('empty.noDiagnosesText')}</div>
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
    const diagnosisCards = diagnoses.items.map((diag) => {
      return renderDiagnosisCard(diag);
    }).join('');
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

  // Symptom (for detailed diagnosis structure)
  if (diag.symptom) {
    const symptom = diag.symptom;
    content.push(`
      <div class="diag-section">
        <strong>Symptom:</strong>
        ${symptom.description ? `<p>${escapeHtml(symptom.description)}</p>` : ''}
        ${symptom.user_impact ? `<div class="symptom-impact"><strong>User Impact:</strong> ${escapeHtml(symptom.user_impact)}</div>` : ''}
        ${symptom.frequency ? `<div class="symptom-freq"><strong>Frequency:</strong> <span class="badge">${escapeHtml(symptom.frequency)}</span></div>` : ''}
        ${symptom.error_message ? `<div class="symptom-error"><strong>Error:</strong> <code>${escapeHtml(symptom.error_message)}</code></div>` : ''}
      </div>
    `);
  }

  // Summary/Overview (for simple diagnosis structure)
  if (diag.summary || diag.overview) {
    content.push(`
      <div class="diag-section">
        <strong>Summary:</strong>
        <p>${escapeHtml(diag.summary || diag.overview)}</p>
      </div>
    `);
  }

  // Root Cause Analysis
  if (diag.root_cause) {
    const rootCause = diag.root_cause;
    // Handle both object and string formats
    if (typeof rootCause === 'object') {
      content.push(`
        <div class="diag-section">
          <strong>Root Cause:</strong>
          ${rootCause.file ? `<div class="rc-file"><strong>File:</strong> <code>${escapeHtml(rootCause.file)}</code></div>` : ''}
          ${rootCause.line_range ? `<div class="rc-line"><strong>Lines:</strong> ${escapeHtml(rootCause.line_range)}</div>` : ''}
          ${rootCause.function ? `<div class="rc-func"><strong>Function:</strong> <code>${escapeHtml(rootCause.function)}</code></div>` : ''}
          ${rootCause.issue ? `<p>${escapeHtml(rootCause.issue)}</p>` : ''}
          ${rootCause.confidence ? `<div class="rc-confidence"><strong>Confidence:</strong> ${(rootCause.confidence * 100).toFixed(0)}%</div>` : ''}
          ${rootCause.category ? `<div class="rc-category"><strong>Category:</strong> <span class="badge">${escapeHtml(rootCause.category)}</span></div>` : ''}
        </div>
      `);
    } else if (typeof rootCause === 'string') {
      content.push(`
        <div class="diag-section">
          <strong>Root Cause:</strong>
          <p>${escapeHtml(rootCause)}</p>
        </div>
      `);
    }
  } else if (diag.root_cause_analysis) {
    content.push(`
      <div class="diag-section">
        <strong>Root Cause:</strong>
        <p>${escapeHtml(diag.root_cause_analysis)}</p>
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

  // Reproduction Steps
  if (diag.reproduction_steps && Array.isArray(diag.reproduction_steps)) {
    content.push(`
      <div class="diag-section">
        <strong>Reproduction Steps:</strong>
        <ol class="repro-steps-list">
          ${diag.reproduction_steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}
        </ol>
      </div>
    `);
  }

  // Fix Hints
  if (diag.fix_hints && Array.isArray(diag.fix_hints)) {
    content.push(`
      <div class="diag-section">
        <strong>Fix Hints (${diag.fix_hints.length}):</strong>
        <div class="fix-hints-list">
          ${diag.fix_hints.map((hint, idx) => `
            <div class="fix-hint-item">
              <div class="hint-header"><strong>Hint ${idx + 1}:</strong> ${escapeHtml(hint.description || 'No description')}</div>
              ${hint.approach ? `<div class="hint-approach"><strong>Approach:</strong> ${escapeHtml(hint.approach)}</div>` : ''}
              ${hint.risk ? `<div class="hint-risk"><strong>Risk:</strong> <span class="badge risk-${hint.risk}">${escapeHtml(hint.risk)}</span></div>` : ''}
              ${hint.code_example ? `<div class="hint-code"><strong>Code Example:</strong><pre><code>${escapeHtml(hint.code_example)}</code></pre></div>` : ''}
            </div>
          `).join('')}
        </div>
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

  // Dependencies
  if (diag.dependencies && typeof diag.dependencies === 'string') {
    content.push(`
      <div class="diag-section">
        <strong>Dependencies:</strong>
        <p>${escapeHtml(diag.dependencies)}</p>
      </div>
    `);
  }

  // Constraints
  if (diag.constraints && typeof diag.constraints === 'string') {
    content.push(`
      <div class="diag-section">
        <strong>Constraints:</strong>
        <p>${escapeHtml(diag.constraints)}</p>
      </div>
    `);
  }

  // Clarification Needs
  if (diag.clarification_needs && Array.isArray(diag.clarification_needs)) {
    content.push(`
      <div class="diag-section">
        <strong>Clarification Needs:</strong>
        <div class="clarification-list">
          ${diag.clarification_needs.map(clar => `
            <div class="clarification-item">
              <div class="clar-question"><strong>Q:</strong> ${escapeHtml(clar.question)}</div>
              ${clar.context ? `<div class="clar-context"><strong>Context:</strong> ${escapeHtml(clar.context)}</div>` : ''}
              ${clar.options && Array.isArray(clar.options) ? `
                <div class="clar-options">
                  <strong>Options:</strong>
                  <ul>
                    ${clar.options.map(opt => `<li>${escapeHtml(opt)}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `);
  }

  // Related Issues
  if (diag.related_issues && Array.isArray(diag.related_issues)) {
    content.push(`
      <div class="diag-section">
        <strong>Related Issues:</strong>
        <ul class="related-issues-list">
          ${diag.related_issues.map(issue => `
            <li>
              ${issue.type ? `<span class="issue-type-badge">${escapeHtml(issue.type)}</span>` : ''}
              ${issue.reference ? `<strong>${escapeHtml(issue.reference)}</strong>: ` : ''}
              ${issue.description ? escapeHtml(issue.description) : ''}
            </li>
          `).join('')}
        </ul>
      </div>
    `);
  }

  // If no specific content was rendered, show raw JSON preview
  if (content.length === 0) {
    console.warn('[DEBUG] No content rendered for diagnosis:', diag);
    content.push(`
      <div class="diag-section">
        <strong>Debug: Raw JSON</strong>
        <pre class="json-content">${escapeHtml(JSON.stringify(diag, null, 2))}</pre>
      </div>
    `);
  }

  return content.join('');
}
