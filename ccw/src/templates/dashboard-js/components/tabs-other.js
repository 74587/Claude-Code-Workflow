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

function renderReviewContent(review) {
  if (!review || !review.dimensions) {
    return `
      <div class="tab-empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">No Review Data</div>
        <div class="empty-text">No review findings in .review/</div>
      </div>
    `;
  }

  const dimensions = Object.entries(review.dimensions);
  if (dimensions.length === 0) {
    return `
      <div class="tab-empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">No Findings</div>
        <div class="empty-text">No review findings found.</div>
      </div>
    `;
  }

  return `
    <div class="review-tab-content">
      ${dimensions.map(([dim, rawFindings]) => {
        // Normalize findings to always be an array
        let findings = [];
        if (Array.isArray(rawFindings)) {
          findings = rawFindings;
        } else if (rawFindings && typeof rawFindings === 'object') {
          // If it's an object with a findings array, use that
          if (Array.isArray(rawFindings.findings)) {
            findings = rawFindings.findings;
          } else {
            // Wrap single object in array or show raw JSON
            findings = [{ title: dim, description: JSON.stringify(rawFindings, null, 2), severity: 'info' }];
          }
        }

        return `
        <div class="review-dimension-section">
          <div class="dimension-header">
            <span class="dimension-name">${escapeHtml(dim)}</span>
            <span class="dimension-count">${findings.length} finding${findings.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="dimension-findings">
            ${findings.map(f => `
              <div class="finding-item ${f.severity || 'medium'}">
                <div class="finding-header">
                  <span class="finding-severity ${f.severity || 'medium'}">${f.severity || 'medium'}</span>
                  <span class="finding-title">${escapeHtml(f.title || 'Finding')}</span>
                </div>
                <p class="finding-description">${escapeHtml(f.description || '')}</p>
                ${f.file ? `<div class="finding-file">📄 ${escapeHtml(f.file)}${f.line ? ':' + f.line : ''}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `}).join('')}
    </div>
  `;
}

// ==========================================
// Lite Context Tab Rendering
// ==========================================

function renderLiteContextContent(context, session) {
  const plan = session.plan || {};

  // If we have context from context-package.json
  if (context) {
    return `
      <div class="context-tab-content">
        <pre class="json-content">${escapeHtml(JSON.stringify(context, null, 2))}</pre>
      </div>
    `;
  }

  // Fallback: show context from plan
  if (plan.focus_paths?.length || plan.summary) {
    return `
      <div class="context-tab-content">
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
    `;
  }

  return `
    <div class="tab-empty-state">
      <div class="empty-icon">📦</div>
      <div class="empty-title">No Context Data</div>
      <div class="empty-text">No context-package.json found for this session.</div>
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
    'architecture': 'Architecture',
    'dependencies': 'Dependencies',
    'patterns': 'Patterns',
    'integration-points': 'Integration Points'
  };

  for (const angle of explorationOrder) {
    const expData = data[angle];
    if (!expData) continue;

    sections.push(`
      <div class="exploration-section collapsible-section">
        <div class="collapsible-header" onclick="toggleSection(this)">
          <span class="collapse-icon">▶</span>
          <span class="section-label">${explorationTitles[angle] || angle}</span>
        </div>
        <div class="collapsible-content collapsed">
          ${renderExplorationAngle(angle, expData)}
        </div>
      </div>
    `);
  }

  return `<div class="exploration-context">${sections.join('')}</div>`;
}

function renderExplorationAngle(angle, data) {
  let content = [];

  // Project structure (architecture)
  if (data.project_structure) {
    content.push(`
      <div class="exp-field">
        <label>Project Structure</label>
        <p>${escapeHtml(data.project_structure)}</p>
      </div>
    `);
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
              <div class="file-relevance">Relevance: ${(f.relevance * 100).toFixed(0)}%</div>
              ${f.rationale ? `<div class="file-rationale">${escapeHtml(f.rationale.substring(0, 200))}...</div>` : ''}
            </div>
          `).join('')}
          ${data.relevant_files.length > 10 ? `<div class="more-files">... and ${data.relevant_files.length - 10} more files</div>` : ''}
        </div>
      </div>
    `);
  }

  // Patterns
  if (data.patterns) {
    content.push(`
      <div class="exp-field">
        <label>Patterns</label>
        <p class="patterns-text">${escapeHtml(data.patterns)}</p>
      </div>
    `);
  }

  // Dependencies
  if (data.dependencies) {
    content.push(`
      <div class="exp-field">
        <label>Dependencies</label>
        <p>${escapeHtml(data.dependencies)}</p>
      </div>
    `);
  }

  // Integration points
  if (data.integration_points) {
    content.push(`
      <div class="exp-field">
        <label>Integration Points</label>
        <p>${escapeHtml(data.integration_points)}</p>
      </div>
    `);
  }

  // Constraints
  if (data.constraints) {
    content.push(`
      <div class="exp-field">
        <label>Constraints</label>
        <p>${escapeHtml(data.constraints)}</p>
      </div>
    `);
  }

  // Clarification needs
  if (data.clarification_needs && data.clarification_needs.length) {
    content.push(`
      <div class="exp-field">
        <label>Clarification Needs</label>
        <div class="clarification-list">
          ${data.clarification_needs.map(c => `
            <div class="clarification-item">
              <div class="clarification-question">${escapeHtml(c.question)}</div>
              ${c.options && c.options.length ? `
                <div class="clarification-options">
                  ${c.options.map((opt, i) => `
                    <span class="option-badge ${i === c.recommended ? 'recommended' : ''}">${escapeHtml(opt)}</span>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `);
  }

  return content.join('') || '<p>No data available</p>';
}
