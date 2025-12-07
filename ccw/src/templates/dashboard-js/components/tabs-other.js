// ==========================================
// Tab Content Renderers - Other Tabs
// ==========================================
// Functions for rendering Summary, IMPL Plan, Review, and Lite Context tabs

// ==========================================
// Summary Tab Rendering
// ==========================================

function renderSummaryContent(summaries) {
  if (!summaries || summaries.length === 0) {
    return `
      <div class="tab-empty-state">
        <div class="empty-icon">📝</div>
        <div class="empty-title">No Summaries</div>
        <div class="empty-text">No summaries found in .summaries/</div>
      </div>
    `;
  }

  // Store summaries in global variable for modal access
  window._currentSummaries = summaries;

  return `
    <div class="summary-tab-content space-y-4">
      ${summaries.map((s, idx) => {
        const normalizedContent = normalizeLineEndings(s.content || '');
        // Extract first 3 lines for preview
        const previewLines = normalizedContent.split('\n').slice(0, 3).join('\n');
        const hasMore = normalizedContent.split('\n').length > 3;
        return `
          <div class="summary-item-card">
            <div class="summary-item-header">
              <h4 class="summary-item-title">📄 ${escapeHtml(s.name || 'Summary')}</h4>
              <button class="btn-view-modal" onclick="openMarkdownModal('${escapeHtml(s.name || 'Summary')}', window._currentSummaries[${idx}].content, 'markdown');">
                👁️ View
              </button>
            </div>
            <div class="summary-item-preview">
              <pre class="summary-preview-text">${escapeHtml(previewLines)}${hasMore ? '\n...' : ''}</pre>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ==========================================
// IMPL Plan Tab Rendering
// ==========================================

function renderImplPlanContent(implPlan) {
  if (!implPlan) {
    return `
      <div class="tab-empty-state">
        <div class="empty-icon">📐</div>
        <div class="empty-title">No IMPL Plan</div>
        <div class="empty-text">No IMPL_PLAN.md found for this session.</div>
      </div>
    `;
  }

  // Normalize and store in global variable for modal access
  const normalizedContent = normalizeLineEndings(implPlan);
  window._currentImplPlan = normalizedContent;

  // Extract first 5 lines for preview
  const previewLines = normalizedContent.split('\n').slice(0, 5).join('\n');
  const hasMore = normalizedContent.split('\n').length > 5;

  return `
    <div class="impl-plan-tab-content">
      <div class="impl-plan-card">
        <div class="impl-plan-header">
          <h3 class="impl-plan-title">📐 Implementation Plan</h3>
          <button class="btn-view-modal" onclick="openMarkdownModal('IMPL_PLAN.md', window._currentImplPlan, 'markdown')">
            👁️ View
          </button>
        </div>
        <div class="impl-plan-preview">
          <pre class="impl-plan-preview-text">${escapeHtml(previewLines)}${hasMore ? '\n...' : ''}</pre>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// Review Tab Rendering
// ==========================================
// NOTE: Enhanced review tab with multi-select, filtering, and preview panel
// is now in _review_tab.js - renderReviewContent() function defined there

// ==========================================
// Lite Context Tab Rendering
// ==========================================

function renderLiteContextContent(context, explorations, session) {
  const plan = session.plan || {};
  let sections = [];

  // Render explorations if available (from exploration-*.json files)
  if (explorations && explorations.manifest) {
    sections.push(renderExplorationContext(explorations));
  }

  // If we have context from context-package.json
  if (context) {
    sections.push(`
      <div class="context-package-section">
        <div class="collapsible-section">
          <div class="collapsible-header">
            <span class="collapse-icon">▶</span>
            <span class="section-label">Context Package</span>
          </div>
          <div class="collapsible-content collapsed">
            <pre class="json-content">${escapeHtml(JSON.stringify(context, null, 2))}</pre>
          </div>
        </div>
      </div>
    `);
  }

  // Fallback: show context from plan
  if (plan.focus_paths?.length || plan.summary) {
    sections.push(`
      <div class="plan-context-section">
        ${plan.summary ? `
          <div class="context-section">
            <h4>Summary</h4>
            <p>${escapeHtml(plan.summary)}</p>
          </div>
        ` : ''}
        ${plan.focus_paths?.length ? `
          <div class="context-section">
            <h4>Focus Paths</h4>
            <div class="path-tags">
              ${plan.focus_paths.map(p => `<span class="path-tag">${escapeHtml(p)}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `);
  }

  // If we have any sections, wrap them
  if (sections.length > 0) {
    return `<div class="context-tab-content">${sections.join('')}</div>`;
  }

  return `
    <div class="tab-empty-state">
      <div class="empty-icon">📦</div>
      <div class="empty-title">No Context Data</div>
      <div class="empty-text">No context-package.json or exploration files found for this session.</div>
    </div>
  `;
}


// ==========================================
// Exploration Context Rendering
// ==========================================

function renderExplorationContext(explorations) {
  if (!explorations || !explorations.manifest) {
    return '';
  }

  const manifest = explorations.manifest;
  const data = explorations.data || {};

  let sections = [];

  // Header with manifest info
  sections.push(`
    <div class="exploration-header">
      <h4>${escapeHtml(manifest.task_description || 'Exploration Context')}</h4>
      <div class="exploration-meta">
        <span class="meta-item">Complexity: <strong>${escapeHtml(manifest.complexity || 'N/A')}</strong></span>
        <span class="meta-item">Explorations: <strong>${manifest.exploration_count || 0}</strong></span>
      </div>
    </div>
  `);

  // Render each exploration angle as collapsible section
  const explorationOrder = ['architecture', 'dependencies', 'patterns', 'integration-points'];
  const explorationTitles = {
    'architecture': '🏗️ Architecture',
    'dependencies': '📦 Dependencies',
    'patterns': '🔄 Patterns',
    'integration-points': '🔌 Integration Points'
  };

  for (const angle of explorationOrder) {
    const expData = data[angle];
    if (!expData) {
      continue;
    }

    const angleContent = renderExplorationAngle(angle, expData);

    sections.push(`
      <div class="exploration-section collapsible-section">
        <div class="collapsible-header">
          <span class="collapse-icon">▶</span>
          <span class="section-label">${explorationTitles[angle] || angle}</span>
        </div>
        <div class="collapsible-content collapsed">
          ${angleContent}
        </div>
      </div>
    `);
  }

  return `<div class="exploration-context">${sections.join('')}</div>`;
}

function renderExplorationAngle(angle, data) {
  let content = [];

  // Project structure - handle string or object
  if (data.project_structure) {
    content.push(renderExpField('Project Structure', data.project_structure));
  }

  // Relevant files
  if (data.relevant_files && data.relevant_files.length) {
    content.push(`
      <div class="exp-field">
        <label>Relevant Files (${data.relevant_files.length})</label>
        <div class="relevant-files-list">
          ${data.relevant_files.slice(0, 10).map(f => `
            <div class="file-item-exp">
              <div class="file-path"><code>${escapeHtml(f.path || '')}</code></div>
              <div class="file-relevance">Relevance: ${f.relevance ? (f.relevance * 100).toFixed(0) : 0}%</div>
              ${f.rationale ? `<div class="file-rationale">${escapeHtml((f.rationale || "").substring(0, 200))}...</div>` : ''}
            </div>
          `).join('')}
          ${data.relevant_files.length > 10 ? `<div class="more-files">... and ${data.relevant_files.length - 10} more files</div>` : ''}
        </div>
      </div>
    `);
  }

  // Patterns - handle string or object
  if (data.patterns) {
    content.push(renderExpField('Patterns', data.patterns));
  }

  // Dependencies - handle string or object
  if (data.dependencies) {
    content.push(renderExpField('Dependencies', data.dependencies));
  }

  // Integration points - handle string or object
  if (data.integration_points) {
    content.push(renderExpField('Integration Points', data.integration_points));
  }

  // Constraints - handle string or object
  if (data.constraints) {
    content.push(renderExpField('Constraints', data.constraints));
  }

  // Clarification needs - handle array or object
  if (data.clarification_needs) {
    content.push(renderExpField('Clarification Needs', data.clarification_needs));
  }

  return content.join('') || '<p>No data available</p>';
}
