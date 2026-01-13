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
    'exploring': 'info',
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

/**
 * Show multi-cli detail page with tabs
 */
function showMultiCliDetailPage(sessionKey) {
  const session = liteTaskDataStore[sessionKey];
  if (!session) return;

  currentView = 'multiCliDetail';
  currentSessionDetailKey = sessionKey;

  hideStatsAndCarousel();

  const container = document.getElementById('mainContent');
  const metadata = session.metadata || {};
  const discussionTopic = session.discussionTopic || {};
  const latestSynthesis = session.latestSynthesis || discussionTopic;
  const roundCount = metadata.roundId || session.roundCount || 1;
  const topicTitle = getI18nText(latestSynthesis.title) || session.topicTitle || 'Discussion Topic';
  const status = latestSynthesis.status || session.status || 'analyzing';

  container.innerHTML = `
    <div class="session-detail-page multi-cli-detail-page">
      <!-- Header -->
      <div class="detail-header">
        <button class="btn-back" onclick="goBackToLiteTasks()">
          <span class="back-icon">&larr;</span>
          <span>${t('multiCli.backToList') || 'Back to Multi-CLI Plan'}</span>
        </button>
        <div class="detail-title-row">
          <h2 class="detail-session-id"><i data-lucide="messages-square" class="w-5 h-5 inline mr-2"></i> ${escapeHtml(session.id)}</h2>
          <div class="detail-badges">
            <span class="session-type-badge multi-cli-plan">multi-cli-plan</span>
            <span class="session-status-badge ${status}">${escapeHtml(status)}</span>
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
          <span class="info-label">${t('multiCli.roundCount') || 'Rounds'}</span>
          <span class="info-value">${roundCount}</span>
        </div>
        <div class="info-item">
          <span class="info-label">${t('multiCli.topic') || 'Topic'}</span>
          <span class="info-value">${escapeHtml(topicTitle)}</span>
        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="detail-tabs">
        <button class="detail-tab active" data-tab="topic" onclick="switchMultiCliDetailTab('topic')">
          <span class="tab-icon"><i data-lucide="message-circle" class="w-4 h-4"></i></span>
          <span class="tab-text">${t('multiCli.tab.topic') || 'Discussion Topic'}</span>
        </button>
        <button class="detail-tab" data-tab="files" onclick="switchMultiCliDetailTab('files')">
          <span class="tab-icon"><i data-lucide="folder-tree" class="w-4 h-4"></i></span>
          <span class="tab-text">${t('multiCli.tab.files') || 'Related Files'}</span>
        </button>
        <button class="detail-tab" data-tab="planning" onclick="switchMultiCliDetailTab('planning')">
          <span class="tab-icon"><i data-lucide="list-checks" class="w-4 h-4"></i></span>
          <span class="tab-text">${t('multiCli.tab.planning') || 'Planning'}</span>
        </button>
        <button class="detail-tab" data-tab="decision" onclick="switchMultiCliDetailTab('decision')">
          <span class="tab-icon"><i data-lucide="check-circle" class="w-4 h-4"></i></span>
          <span class="tab-text">${t('multiCli.tab.decision') || 'Decision'}</span>
        </button>
        <button class="detail-tab" data-tab="timeline" onclick="switchMultiCliDetailTab('timeline')">
          <span class="tab-icon"><i data-lucide="git-commit" class="w-4 h-4"></i></span>
          <span class="tab-text">${t('multiCli.tab.timeline') || 'Timeline'}</span>
        </button>
        <button class="detail-tab" data-tab="rounds" onclick="switchMultiCliDetailTab('rounds')">
          <span class="tab-icon"><i data-lucide="layers" class="w-4 h-4"></i></span>
          <span class="tab-text">${t('multiCli.tab.rounds') || 'Rounds'}</span>
          <span class="tab-count">${roundCount}</span>
        </button>
      </div>

      <!-- Tab Content -->
      <div class="detail-tab-content" id="multiCliDetailTabContent">
        ${renderMultiCliTopicTab(session)}
      </div>
    </div>
  `;

  // Initialize icons and collapsible sections
  setTimeout(() => {
    if (typeof lucide !== 'undefined') lucide.createIcons();
    initCollapsibleSections(container);
  }, 50);
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
    case 'topic':
      contentArea.innerHTML = renderMultiCliTopicTab(session);
      break;
    case 'files':
      contentArea.innerHTML = renderMultiCliFilesTab(session);
      break;
    case 'planning':
      contentArea.innerHTML = renderMultiCliPlanningTab(session);
      break;
    case 'decision':
      contentArea.innerHTML = renderMultiCliDecisionTab(session);
      break;
    case 'timeline':
      contentArea.innerHTML = renderMultiCliTimelineTab(session);
      break;
    case 'rounds':
      contentArea.innerHTML = renderMultiCliRoundsTab(session);
      break;
  }

  // Re-initialize after tab switch
  setTimeout(() => {
    if (typeof lucide !== 'undefined') lucide.createIcons();
    initCollapsibleSections(contentArea);
  }, 50);
}

// ============================================
// MULTI-CLI TAB RENDERERS
// ============================================

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
    <div class="multi-cli-section topic-header-section">
      <h3 class="topic-main-title">${escapeHtml(title)}</h3>
      ${description ? `<p class="topic-description">${escapeHtml(description)}</p>` : ''}
      <div class="topic-meta">
        <span class="status-badge ${status}">${escapeHtml(status)}</span>
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
  const relatedFiles = session.relatedFiles || session.latestSynthesis?.relatedFiles || {};

  if (!relatedFiles || Object.keys(relatedFiles).length === 0) {
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
 * Render Planning tab
 * Shows: functional, nonFunctional requirements, acceptanceCriteria
 */
function renderMultiCliPlanningTab(session) {
  const planning = session.planning || session.latestSynthesis?.planning || {};

  if (!planning || Object.keys(planning).length === 0) {
    return `
      <div class="tab-empty-state">
        <div class="empty-icon"><i data-lucide="list-checks" class="w-12 h-12"></i></div>
        <div class="empty-title">${t('multiCli.empty.planning') || 'No Planning Data'}</div>
        <div class="empty-text">${t('multiCli.empty.planningText') || 'No planning requirements available for this session.'}</div>
      </div>
    `;
  }

  const functional = planning.functional || [];
  const nonFunctional = planning.nonFunctional || [];
  const acceptanceCriteria = planning.acceptanceCriteria || [];

  let sections = [];

  // Functional Requirements
  if (functional.length) {
    sections.push(`
      <div class="multi-cli-section requirements-section">
        <h4 class="section-title"><i data-lucide="check-square" class="w-4 h-4 inline mr-1"></i> ${t('multiCli.functional') || 'Functional Requirements'} (${functional.length})</h4>
        <div class="requirements-list">
          ${functional.map(req => renderRequirementItem(req)).join('')}
        </div>
      </div>
    `);
  }

  // Non-Functional Requirements
  if (nonFunctional.length) {
    sections.push(`
      <div class="multi-cli-section requirements-section">
        <h4 class="section-title"><i data-lucide="settings" class="w-4 h-4 inline mr-1"></i> ${t('multiCli.nonFunctional') || 'Non-Functional Requirements'} (${nonFunctional.length})</h4>
        <div class="requirements-list">
          ${nonFunctional.map(req => renderRequirementItem(req)).join('')}
        </div>
      </div>
    `);
  }

  // Acceptance Criteria
  if (acceptanceCriteria.length) {
    sections.push(`
      <div class="multi-cli-section acceptance-section">
        <h4 class="section-title"><i data-lucide="clipboard-check" class="w-4 h-4 inline mr-1"></i> ${t('multiCli.acceptanceCriteria') || 'Acceptance Criteria'} (${acceptanceCriteria.length})</h4>
        <div class="acceptance-list">
          ${acceptanceCriteria.map(ac => `
            <div class="acceptance-item ${ac.isMet ? 'met' : 'unmet'}">
              <span class="acceptance-check">${ac.isMet ? '&#10003;' : '&#9675;'}</span>
              <span class="acceptance-id">${escapeHtml(ac.id || '')}</span>
              <span class="acceptance-desc">${escapeHtml(getI18nText(ac.description))}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `);
  }

  return sections.length ? `<div class="multi-cli-planning-tab">${sections.join('')}</div>` : `
    <div class="tab-empty-state">
      <div class="empty-icon"><i data-lucide="list-checks" class="w-12 h-12"></i></div>
      <div class="empty-title">${t('multiCli.empty.planning') || 'No Planning Data'}</div>
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
  const decision = session.decision || session.latestSynthesis?.decision || {};

  if (!decision || Object.keys(decision).length === 0) {
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
      <div class="decision-status-bar">
        <span class="decision-status ${status}">${escapeHtml(status)}</span>
        <span class="confidence-meter">
          <span class="confidence-label">${t('multiCli.confidence') || 'Confidence'}:</span>
          <span class="confidence-bar">
            <span class="confidence-fill" style="width: ${(confidenceScore * 100).toFixed(0)}%"></span>
          </span>
          <span class="confidence-value">${(confidenceScore * 100).toFixed(0)}%</span>
        </span>
      </div>
      ${summary ? `<p class="decision-summary">${escapeHtml(summary)}</p>` : ''}
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
          <div class="pros-list">
            <strong>${t('multiCli.pros') || 'Pros'}:</strong>
            <ul>${pros.map(p => `<li class="pro-item">${escapeHtml(getI18nText(p))}</li>`).join('')}</ul>
          </div>
        ` : ''}
        ${cons.length ? `
          <div class="cons-list">
            <strong>${t('multiCli.cons') || 'Cons'}:</strong>
            <ul>${cons.map(c => `<li class="con-item">${escapeHtml(getI18nText(c))}</li>`).join('')}</ul>
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
  const decisionRecords = session.decisionRecords || session.latestSynthesis?.decisionRecords || {};
  const timeline = decisionRecords.timeline || [];

  if (!timeline.length) {
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
                  <span class="event-contributor">${escapeHtml(contributor.name || 'Unknown')}</span>
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
