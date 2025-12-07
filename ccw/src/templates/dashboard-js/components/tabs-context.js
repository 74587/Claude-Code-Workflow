// ==========================================
// Tab Content Renderers - Context Tab
// ==========================================
// Functions for rendering Context tab content in the dashboard
// Note: getRelevanceColor and getRoleBadgeClass are defined in utils.js

// ==========================================
// Context Tab Rendering
// ==========================================

function renderContextContent(context) {
  if (!context) {
    return `
      <div class="tab-empty-state">
        <div class="empty-icon">📦</div>
        <div class="empty-title">No Context Data</div>
        <div class="empty-text">No context-package.json found for this session.</div>
      </div>
    `;
  }

  const contextJson = JSON.stringify(context, null, 2);
  // Store in global variable for modal access
  window._currentContextJson = contextJson;

  // Parse context structure
  const metadata = context.metadata || {};
  const projectContext = context.project_context || {};
  const techStack = projectContext.tech_stack || metadata.tech_stack || {};
  const codingConventions = projectContext.coding_conventions || {};
  const architecturePatterns = projectContext.architecture_patterns || [];
  const assets = context.assets || {};
  const dependencies = context.dependencies || {};
  const testContext = context.test_context || {};
  const conflictDetection = context.conflict_detection || {};

  return `
    <div class="context-tab-content">
      <!-- Header Card -->
      <div class="ctx-header-card">
        <div class="ctx-header-content">
          <h3 class="ctx-main-title">📦 Context Package</h3>
          <button class="btn-view-modal" onclick="openMarkdownModal('context-package.json', window._currentContextJson, 'json')">
            👁️ View JSON
          </button>
        </div>
      </div>

      <!-- Metadata Card -->
      ${metadata.task_description || metadata.session_id ? `
        <div class="ctx-card">
          <div class="ctx-card-header">
            <span class="ctx-card-icon">📋</span>
            <h4 class="ctx-card-title">Task Metadata</h4>
          </div>
          <div class="ctx-card-body">
            ${metadata.task_description ? `
              <p class="ctx-description">${escapeHtml(metadata.task_description)}</p>
            ` : ''}
            <div class="ctx-meta-row">
              ${metadata.session_id ? `
                <div class="ctx-meta-chip">
                  <span class="ctx-meta-chip-label">SESSION</span>
                  <code class="ctx-meta-chip-value">${escapeHtml(metadata.session_id)}</code>
                </div>
              ` : ''}
              ${metadata.complexity ? `
                <div class="ctx-meta-chip">
                  <span class="ctx-meta-chip-label">COMPLEXITY</span>
                  <span class="ctx-complexity-badge ctx-complexity-${metadata.complexity}">${escapeHtml(metadata.complexity.toUpperCase())}</span>
                </div>
              ` : ''}
              ${metadata.timestamp ? `
                <div class="ctx-meta-chip">
                  <span class="ctx-meta-chip-label">CREATED</span>
                  <span class="ctx-meta-chip-value">${formatDate(metadata.timestamp)}</span>
                </div>
              ` : ''}
            </div>
            ${metadata.keywords && metadata.keywords.length > 0 ? `
              <div class="ctx-keywords-row">
                ${metadata.keywords.map(kw => `<span class="ctx-keyword-tag">${escapeHtml(kw)}</span>`).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}

      <!-- Architecture Patterns Card -->
      ${architecturePatterns.length > 0 ? `
        <div class="ctx-card">
          <div class="ctx-card-header">
            <span class="ctx-card-icon">🏛️</span>
            <h4 class="ctx-card-title">Architecture Patterns</h4>
            <span class="ctx-count-badge">${architecturePatterns.length}</span>
          </div>
          <div class="ctx-card-body">
            <div class="ctx-pattern-tags">
              ${architecturePatterns.map(p => `<span class="ctx-pattern-tag">${escapeHtml(p)}</span>`).join('')}
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Tech Stack Card -->
      ${Object.keys(techStack).length > 0 ? `
        <div class="ctx-card">
          <div class="ctx-card-header">
            <span class="ctx-card-icon">💻</span>
            <h4 class="ctx-card-title">Technology Stack</h4>
          </div>
          <div class="ctx-card-body">
            ${renderTechStackCards(techStack)}
          </div>
        </div>
      ` : ''}

      <!-- Coding Conventions Card -->
      ${Object.keys(codingConventions).length > 0 ? `
        <div class="ctx-card">
          <div class="ctx-card-header">
            <span class="ctx-card-icon">📝</span>
            <h4 class="ctx-card-title">Coding Conventions</h4>
          </div>
          <div class="ctx-card-body">
            ${renderCodingConventionsCards(codingConventions)}
          </div>
        </div>
      ` : ''}

      <!-- Assets Section -->
      ${Object.keys(assets).length > 0 ? `
        <div class="ctx-card">
          <div class="ctx-card-header">
            <span class="ctx-card-icon">📚</span>
            <h4 class="ctx-card-title">Assets & Resources</h4>
          </div>
          <div class="ctx-card-body">
            ${renderAssetsCards(assets)}
          </div>
        </div>
      ` : ''}

      <!-- Dependencies Section -->
      ${(dependencies.internal && dependencies.internal.length > 0) || (dependencies.external && dependencies.external.length > 0) ? `
        <div class="ctx-card">
          <div class="ctx-card-header">
            <span class="ctx-card-icon">🔗</span>
            <h4 class="ctx-card-title">Dependencies</h4>
          </div>
          <div class="ctx-card-body">
            ${renderDependenciesCards(dependencies)}
          </div>
        </div>
      ` : ''}

      <!-- Test Context Section -->
      ${Object.keys(testContext).length > 0 ? `
        <div class="ctx-card">
          <div class="ctx-card-header">
            <span class="ctx-card-icon">🧪</span>
            <h4 class="ctx-card-title">Test Context</h4>
          </div>
          <div class="ctx-card-body">
            ${renderTestContextCards(testContext)}
          </div>
        </div>
      ` : ''}

      <!-- Conflict Detection Section -->
      ${Object.keys(conflictDetection).length > 0 ? `
        <div class="ctx-card ctx-card-warning">
          <div class="ctx-card-header">
            <span class="ctx-card-icon">⚠️</span>
            <h4 class="ctx-card-title">Risk Analysis</h4>
            ${conflictDetection.risk_level ? `
              <span class="ctx-risk-badge ctx-risk-${conflictDetection.risk_level}">${escapeHtml(conflictDetection.risk_level.toUpperCase())}</span>
            ` : ''}
          </div>
          <div class="ctx-card-body">
            ${renderConflictCards(conflictDetection)}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// New card-based renderers
function renderTechStackCards(techStack) {
  const sections = [];

  if (techStack.languages) {
    const langs = Array.isArray(techStack.languages) ? techStack.languages : [techStack.languages];
    sections.push(`
      <div class="ctx-stack-section">
        <span class="ctx-stack-label">Languages</span>
        <div class="ctx-stack-tags">
          ${langs.map(l => `<span class="ctx-lang-tag">${escapeHtml(String(l))}</span>`).join('')}
        </div>
      </div>
    `);
  }

  if (techStack.frameworks) {
    const frameworks = Array.isArray(techStack.frameworks) ? techStack.frameworks : [techStack.frameworks];
    sections.push(`
      <div class="ctx-stack-section">
        <span class="ctx-stack-label">Frameworks</span>
        <div class="ctx-stack-tags">
          ${frameworks.map(f => `<span class="ctx-framework-tag">${escapeHtml(String(f))}</span>`).join('')}
        </div>
      </div>
    `);
  }

  if (techStack.frontend_frameworks) {
    const ff = Array.isArray(techStack.frontend_frameworks) ? techStack.frontend_frameworks : [techStack.frontend_frameworks];
    sections.push(`
      <div class="ctx-stack-section">
        <span class="ctx-stack-label">Frontend</span>
        <div class="ctx-stack-tags">
          ${ff.map(f => `<span class="ctx-frontend-tag">${escapeHtml(String(f))}</span>`).join('')}
        </div>
      </div>
    `);
  }

  if (techStack.backend_frameworks) {
    const bf = Array.isArray(techStack.backend_frameworks) ? techStack.backend_frameworks : [techStack.backend_frameworks];
    sections.push(`
      <div class="ctx-stack-section">
        <span class="ctx-stack-label">Backend</span>
        <div class="ctx-stack-tags">
          ${bf.map(f => `<span class="ctx-backend-tag">${escapeHtml(String(f))}</span>`).join('')}
        </div>
      </div>
    `);
  }

  if (techStack.libraries && typeof techStack.libraries === 'object') {
    Object.entries(techStack.libraries).forEach(([category, libList]) => {
      if (Array.isArray(libList) && libList.length > 0) {
        sections.push(`
          <div class="ctx-stack-section">
            <span class="ctx-stack-label">${escapeHtml(category)}</span>
            <div class="ctx-stack-tags">
              ${libList.map(lib => `<span class="ctx-lib-tag">${escapeHtml(String(lib))}</span>`).join('')}
            </div>
          </div>
        `);
      }
    });
  }

  return sections.join('');
}

function renderCodingConventionsCards(conventions) {
  const sections = [];

  // Helper to format leaf values
  const formatLeafValue = (val) => {
    if (val === null || val === undefined) return '-';
    if (Array.isArray(val)) return val.map(v => escapeHtml(String(v))).join(', ');
    return escapeHtml(String(val));
  };

  // Helper to render items (handles nested objects like {backend: ..., frontend: ...})
  const renderItems = (data) => {
    return Object.entries(data).map(([key, val]) => {
      // Check if val is a nested object (like {backend: {...}, frontend: {...}})
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        // Render sub-items for nested structure
        return Object.entries(val).map(([subKey, subVal]) => `
          <div class="ctx-conv-item">
            <span class="ctx-conv-key">${escapeHtml(key)}</span>
            <span class="ctx-conv-value">${formatLeafValue(subVal)}</span>
          </div>
        `).join('');
      }
      return `
        <div class="ctx-conv-item">
          <span class="ctx-conv-key">${escapeHtml(key)}</span>
          <span class="ctx-conv-value">${formatLeafValue(val)}</span>
        </div>
      `;
    }).join('');
  };

  // Render all convention sections
  Object.entries(conventions).forEach(([key, val]) => {
    if (val && typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length > 0) {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      sections.push(`
        <div class="ctx-conv-section">
          <span class="ctx-conv-label">${escapeHtml(label)}</span>
          <div class="ctx-conv-items">
            ${renderItems(val)}
          </div>
        </div>
      `);
    }
  });

  return sections.length > 0 ? sections.join('') : '';
}

function renderAssetsCards(assets) {
  const sections = [];

  // Documentation section - card grid layout
  if (assets.documentation && assets.documentation.length > 0) {
    sections.push(`
      <div class="ctx-assets-category">
        <div class="ctx-assets-cat-header">
          <span class="ctx-assets-cat-icon">📄</span>
          <span class="ctx-assets-cat-title">Documentation</span>
          <span class="ctx-assets-cat-count">${assets.documentation.length}</span>
        </div>
        <div class="ctx-assets-card-grid">
          ${assets.documentation.map(doc => `
            <div class="ctx-asset-card ctx-asset-doc">
              <span class="ctx-asset-card-path">${escapeHtml(doc.path)}</span>
              <span class="ctx-asset-card-badge ctx-relevance-badge">${(doc.relevance_score * 100).toFixed(0)}%</span>
            </div>
          `).join('')}
        </div>
      </div>
    `);
  }

  // Source Code section - card grid layout
  if (assets.source_code && assets.source_code.length > 0) {
    sections.push(`
      <div class="ctx-assets-category">
        <div class="ctx-assets-cat-header">
          <span class="ctx-assets-cat-icon">💻</span>
          <span class="ctx-assets-cat-title">Source Code</span>
          <span class="ctx-assets-cat-count">${assets.source_code.length}</span>
        </div>
        <div class="ctx-assets-card-grid">
          ${assets.source_code.map(src => `
            <div class="ctx-asset-card ctx-asset-src">
              <span class="ctx-asset-card-path">${escapeHtml(src.path)}</span>
              ${src.role ? `<span class="ctx-asset-card-badge ctx-role-badge">${escapeHtml(src.role.replace(/-/g, ' '))}</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `);
  }

  // Tests section - card grid layout
  if (assets.tests && assets.tests.length > 0) {
    sections.push(`
      <div class="ctx-assets-category">
        <div class="ctx-assets-cat-header">
          <span class="ctx-assets-cat-icon">🧪</span>
          <span class="ctx-assets-cat-title">Tests</span>
          <span class="ctx-assets-cat-count">${assets.tests.length}</span>
        </div>
        <div class="ctx-assets-card-grid">
          ${assets.tests.map(test => `
            <div class="ctx-asset-card ctx-asset-test">
              <span class="ctx-asset-card-path">${escapeHtml(test.path)}</span>
              ${test.test_count ? `<span class="ctx-asset-card-badge ctx-test-badge">${test.test_count} tests</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `);
  }

  return sections.join('');
}

function renderDependenciesCards(dependencies) {
  const sections = [];

  if (dependencies.internal && dependencies.internal.length > 0) {
    sections.push(`
      <div class="ctx-deps-section">
        <div class="ctx-deps-header">
          <span class="ctx-deps-label">Internal Dependencies</span>
          <span class="ctx-deps-count">${dependencies.internal.length}</span>
        </div>
        <div class="ctx-deps-table">
          <div class="ctx-deps-table-header">
            <span class="ctx-deps-col-from">From</span>
            <span class="ctx-deps-col-type">Type</span>
            <span class="ctx-deps-col-to">To</span>
          </div>
          <div class="ctx-deps-table-body">
            ${dependencies.internal.map(dep => `
              <div class="ctx-deps-row">
                <span class="ctx-deps-col-from">${escapeHtml(dep.from)}</span>
                <span class="ctx-deps-col-type">
                  <span class="ctx-deps-type-badge ctx-deps-type-${dep.type}">${escapeHtml(dep.type)}</span>
                </span>
                <span class="ctx-deps-col-to">${escapeHtml(dep.to)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `);
  }

  if (dependencies.external && dependencies.external.length > 0) {
    sections.push(`
      <div class="ctx-deps-section">
        <div class="ctx-deps-header">
          <span class="ctx-deps-label">External Packages</span>
          <span class="ctx-deps-count">${dependencies.external.length}</span>
        </div>
        <div class="ctx-deps-packages">
          ${dependencies.external.map(dep => `
            <span class="ctx-pkg-tag">${escapeHtml(dep.package)}${dep.version ? `@${escapeHtml(dep.version)}` : ''}</span>
          `).join('')}
        </div>
      </div>
    `);
  }

  return sections.join('');
}

function renderTestContextCards(testContext) {
  const sections = [];

  // Stats row
  const tests = testContext.existing_tests || {};
  let totalTests = 0;
  if (tests.backend) {
    if (tests.backend.integration) totalTests += tests.backend.integration.tests || 0;
    if (tests.backend.api_endpoints) totalTests += tests.backend.api_endpoints.tests || 0;
  }

  sections.push(`
    <div class="ctx-test-stats">
      <div class="ctx-stat-box">
        <span class="ctx-stat-value">${totalTests}</span>
        <span class="ctx-stat-label">Total Tests</span>
      </div>
      ${testContext.coverage_config?.target ? `
        <div class="ctx-stat-box">
          <span class="ctx-stat-value">${escapeHtml(testContext.coverage_config.target)}</span>
          <span class="ctx-stat-label">Coverage Target</span>
        </div>
      ` : ''}
    </div>
  `);

  if (testContext.frameworks) {
    const fw = testContext.frameworks;
    sections.push(`
      <div class="ctx-test-frameworks">
        ${fw.backend ? `
          <div class="ctx-fw-card ctx-fw-installed">
            <span class="ctx-fw-type">Backend</span>
            <span class="ctx-fw-name">${escapeHtml(fw.backend.name || 'N/A')}</span>
          </div>
        ` : ''}
        ${fw.frontend ? `
          <div class="ctx-fw-card ${fw.frontend.name?.includes('NONE') ? 'ctx-fw-missing' : 'ctx-fw-installed'}">
            <span class="ctx-fw-type">Frontend</span>
            <span class="ctx-fw-name">${escapeHtml(fw.frontend.name || 'N/A')}</span>
          </div>
        ` : ''}
      </div>
    `);
  }

  return sections.join('');
}

function renderConflictCards(conflictDetection) {
  const sections = [];

  if (conflictDetection.mitigation_strategy) {
    // Parse numbered items like "(1) ... (2) ..." into list
    const strategy = conflictDetection.mitigation_strategy;
    const items = strategy.split(/\(\d+\)/).filter(s => s.trim());

    if (items.length > 1) {
      sections.push(`
        <div class="ctx-mitigation">
          <span class="ctx-mitigation-label">Mitigation Strategy</span>
          <ol class="ctx-mitigation-list">
            ${items.map(item => `<li>${escapeHtml(item.trim())}</li>`).join('')}
          </ol>
        </div>
      `);
    } else {
      sections.push(`
        <div class="ctx-mitigation">
          <span class="ctx-mitigation-label">Mitigation Strategy</span>
          <p class="ctx-mitigation-text">${escapeHtml(strategy)}</p>
        </div>
      `);
    }
  }

  if (conflictDetection.risk_factors) {
    const factors = conflictDetection.risk_factors;
    if (factors.test_gaps?.length > 0) {
      sections.push(`
        <div class="ctx-risk-section">
          <span class="ctx-risk-label">Test Gaps</span>
          <ul class="ctx-risk-list">
            ${factors.test_gaps.map(gap => `<li>${escapeHtml(gap)}</li>`).join('')}
          </ul>
        </div>
      `);
    }
  }

  if (conflictDetection.affected_modules?.length > 0) {
    sections.push(`
      <div class="ctx-affected">
        <span class="ctx-affected-label">Affected Modules</span>
        <div class="ctx-affected-tags">
          ${conflictDetection.affected_modules.map(mod => `<span class="ctx-affected-tag">${escapeHtml(mod)}</span>`).join('')}
        </div>
      </div>
    `);
  }

  return sections.join('');
}

function renderTechStackSection(techStack) {
  const sections = [];

  if (techStack.languages) {
    const langs = Array.isArray(techStack.languages) ? techStack.languages : [techStack.languages];
    sections.push(`
      <div class="context-field">
        <span class="context-label">Languages:</span>
        <div class="flex flex-wrap gap-1 mt-1">
          ${langs.map(l => `<span class="badge badge-primary text-xs">${escapeHtml(String(l))}</span>`).join('')}
        </div>
      </div>
    `);
  }

  if (techStack.frameworks) {
    const frameworks = Array.isArray(techStack.frameworks) ? techStack.frameworks : [techStack.frameworks];
    sections.push(`
      <div class="context-field">
        <span class="context-label">Frameworks:</span>
        <div class="flex flex-wrap gap-1 mt-1">
          ${frameworks.map(f => `<span class="badge badge-secondary text-xs">${escapeHtml(String(f))}</span>`).join('')}
        </div>
      </div>
    `);
  }

  if (techStack.frontend_frameworks) {
    const ff = Array.isArray(techStack.frontend_frameworks) ? techStack.frontend_frameworks : [techStack.frontend_frameworks];
    sections.push(`
      <div class="context-field">
        <span class="context-label">Frontend:</span>
        <div class="flex flex-wrap gap-1 mt-1">
          ${ff.map(f => `<span class="badge badge-secondary text-xs">${escapeHtml(String(f))}</span>`).join('')}
        </div>
      </div>
    `);
  }

  if (techStack.backend_frameworks) {
    const bf = Array.isArray(techStack.backend_frameworks) ? techStack.backend_frameworks : [techStack.backend_frameworks];
    sections.push(`
      <div class="context-field">
        <span class="context-label">Backend:</span>
        <div class="flex flex-wrap gap-1 mt-1">
          ${bf.map(f => `<span class="badge badge-secondary text-xs">${escapeHtml(String(f))}</span>`).join('')}
        </div>
      </div>
    `);
  }

  if (techStack.libraries) {
    const libs = techStack.libraries;
    if (typeof libs === 'object' && !Array.isArray(libs)) {
      Object.entries(libs).forEach(([category, libList]) => {
        if (Array.isArray(libList) && libList.length > 0) {
          sections.push(`
            <div class="context-field">
              <span class="context-label">${escapeHtml(category)}:</span>
              <ul class="list-disc list-inside ml-4 mt-1 text-sm text-muted-foreground">
                ${libList.map(lib => `<li>${escapeHtml(String(lib))}</li>`).join('')}
              </ul>
            </div>
          `);
        }
      });
    }
  }

  return sections.join('');
}

function renderCodingConventions(conventions) {
  const sections = [];

  if (conventions.naming) {
    sections.push(`
      <div class="context-field">
        <span class="context-label">Naming:</span>
        <ul class="list-disc list-inside ml-4 mt-1 text-sm text-muted-foreground">
          ${Object.entries(conventions.naming).map(([key, val]) =>
            `<li><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(val))}</li>`
          ).join('')}
        </ul>
      </div>
    `);
  }

  if (conventions.error_handling) {
    sections.push(`
      <div class="context-field">
        <span class="context-label">Error Handling:</span>
        <ul class="list-disc list-inside ml-4 mt-1 text-sm text-muted-foreground">
          ${Object.entries(conventions.error_handling).map(([key, val]) =>
            `<li><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(val))}</li>`
          ).join('')}
        </ul>
      </div>
    `);
  }

  if (conventions.testing) {
    sections.push(`
      <div class="context-field">
        <span class="context-label">Testing:</span>
        <ul class="list-disc list-inside ml-4 mt-1 text-sm text-muted-foreground">
          ${Object.entries(conventions.testing).map(([key, val]) => {
            if (Array.isArray(val)) {
              return `<li><strong>${escapeHtml(key)}:</strong> ${val.map(v => escapeHtml(String(v))).join(', ')}</li>`;
            }
            return `<li><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(val))}</li>`;
          }).join('')}
        </ul>
      </div>
    `);
  }

  return sections.join('');
}

function renderAssetsSection(assets) {
  const sections = [];

  // Documentation
  if (assets.documentation && assets.documentation.length > 0) {
    sections.push(`
      <div class="asset-category">
        <h5 class="asset-category-title">📄 Documentation</h5>
        <div class="asset-grid">
          ${assets.documentation.map(doc => `
            <div class="asset-card">
              <div class="asset-card-header">
                <span class="asset-path">${escapeHtml(doc.path)}</span>
                <span class="relevance-score" style="background: ${getRelevanceColor(doc.relevance_score)}">${(doc.relevance_score * 100).toFixed(0)}%</span>
              </div>
              <div class="asset-card-body">
                <div class="asset-scope">${escapeHtml(doc.scope || '')}</div>
                ${doc.contains && doc.contains.length > 0 ? `
                  <div class="asset-tags">
                    ${doc.contains.map(tag => `<span class="asset-tag">${escapeHtml(tag)}</span>`).join('')}
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `);
  }

  // Source Code
  if (assets.source_code && assets.source_code.length > 0) {
    sections.push(`
      <div class="asset-category">
        <h5 class="asset-category-title">💻 Source Code</h5>
        <div class="asset-grid">
          ${assets.source_code.map(src => `
            <div class="asset-card">
              <div class="asset-card-header">
                <span class="asset-path">${escapeHtml(src.path)}</span>
                <span class="relevance-score" style="background: ${getRelevanceColor(src.relevance_score)}">${(src.relevance_score * 100).toFixed(0)}%</span>
              </div>
              <div class="asset-card-body">
                <div class="asset-role-badge badge-${getRoleBadgeClass(src.role)}">${escapeHtml(src.role || '')}</div>
                ${src.exports && src.exports.length > 0 ? `
                  <div class="asset-meta"><strong>Exports:</strong> ${src.exports.map(e => `<code class="inline-code">${escapeHtml(e)}</code>`).join(', ')}</div>
                ` : ''}
                ${src.features && src.features.length > 0 ? `
                  <div class="asset-features">${src.features.map(f => `<span class="feature-tag">${escapeHtml(f)}</span>`).join('')}</div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `);
  }

  // Tests
  if (assets.tests && assets.tests.length > 0) {
    sections.push(`
      <div class="asset-category">
        <h5 class="asset-category-title">🧪 Tests</h5>
        <div class="asset-grid">
          ${assets.tests.map(test => `
            <div class="asset-card">
              <div class="asset-card-header">
                <span class="asset-path">${escapeHtml(test.path)}</span>
                ${test.test_count ? `<span class="test-count-badge">${test.test_count} tests</span>` : ''}
              </div>
              <div class="asset-card-body">
                <div class="asset-type">${escapeHtml(test.type || '')}</div>
                ${test.test_classes ? `<div class="asset-meta"><strong>Classes:</strong> ${escapeHtml(test.test_classes.join(', '))}</div>` : ''}
                ${test.coverage ? `<div class="asset-meta"><strong>Coverage:</strong> ${escapeHtml(test.coverage)}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `);
  }

  return sections.join('');
}

function renderDependenciesSection(dependencies) {
  const sections = [];

  // Internal Dependencies
  if (dependencies.internal && dependencies.internal.length > 0) {
    sections.push(`
      <div class="dep-category">
        <h5 class="dep-category-title">🔄 Internal Dependencies</h5>
        <div class="dep-graph">
          ${dependencies.internal.slice(0, 10).map(dep => `
            <div class="dep-item">
              <div class="dep-from">${escapeHtml(dep.from)}</div>
              <div class="dep-arrow">
                <span class="dep-type-badge badge-${dep.type}">${escapeHtml(dep.type)}</span>
                →
              </div>
              <div class="dep-to">${escapeHtml(dep.to)}</div>
            </div>
          `).join('')}
          ${dependencies.internal.length > 10 ? `<div class="dep-more">... and ${dependencies.internal.length - 10} more</div>` : ''}
        </div>
      </div>
    `);
  }

  // External Dependencies
  if (dependencies.external && dependencies.external.length > 0) {
    sections.push(`
      <div class="dep-category">
        <h5 class="dep-category-title">📦 External Dependencies</h5>
        <div class="dep-grid">
          ${dependencies.external.map(dep => `
            <div class="dep-external-card">
              <div class="dep-package-name">${escapeHtml(dep.package)}</div>
              <div class="dep-version">${escapeHtml(dep.version || '')}</div>
              <div class="dep-usage">${escapeHtml(dep.usage || '')}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `);
  }

  return sections.join('');
}

function renderTestContextSection(testContext) {
  const sections = [];

  // Test Frameworks
  if (testContext.frameworks) {
    const frameworks = testContext.frameworks;
    sections.push(`
      <div class="test-category">
        <h5 class="test-category-title">🛠️ Test Frameworks</h5>
        <div class="test-frameworks-grid">
          ${frameworks.backend ? `
            <div class="framework-card framework-installed">
              <div class="framework-header">
                <span class="framework-label">Backend</span>
                <span class="framework-name">${escapeHtml(frameworks.backend.name || 'N/A')}</span>
              </div>
              ${frameworks.backend.plugins ? `
                <div class="framework-plugins">${frameworks.backend.plugins.map(p => `<span class="plugin-tag">${escapeHtml(p)}</span>`).join('')}</div>
              ` : ''}
            </div>
          ` : ''}
          ${frameworks.frontend ? `
            <div class="framework-card ${frameworks.frontend.name && frameworks.frontend.name.includes('NONE') ? 'framework-missing' : 'framework-installed'}">
              <div class="framework-header">
                <span class="framework-label">Frontend</span>
                <span class="framework-name">${escapeHtml(frameworks.frontend.name || 'N/A')}</span>
              </div>
              ${frameworks.frontend.recommended ? `<div class="framework-recommended">Recommended: ${escapeHtml(frameworks.frontend.recommended)}</div>` : ''}
              ${frameworks.frontend.gap ? `<div class="framework-gap">⚠️ ${escapeHtml(frameworks.frontend.gap)}</div>` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    `);
  }

  // Existing Tests Statistics
  if (testContext.existing_tests) {
    const tests = testContext.existing_tests;
    let totalTests = 0;
    let totalClasses = 0;

    if (tests.backend) {
      if (tests.backend.integration) {
        totalTests += tests.backend.integration.tests || 0;
        totalClasses += tests.backend.integration.classes || 0;
      }
      if (tests.backend.api_endpoints) {
        totalTests += tests.backend.api_endpoints.tests || 0;
        totalClasses += tests.backend.api_endpoints.classes || 0;
      }
    }

    sections.push(`
      <div class="test-category">
        <h5 class="test-category-title">📊 Test Statistics</h5>
        <div class="test-stats-grid">
          <div class="stat-card">
            <div class="stat-value">${totalTests}</div>
            <div class="stat-label">Total Tests</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${totalClasses}</div>
            <div class="stat-label">Test Classes</div>
          </div>
          ${testContext.coverage_config && testContext.coverage_config.target ? `
            <div class="stat-card">
              <div class="stat-value">${escapeHtml(testContext.coverage_config.target)}</div>
              <div class="stat-label">Coverage Target</div>
            </div>
          ` : ''}
        </div>
      </div>
    `);
  }

  // Test Markers
  if (testContext.test_markers) {
    sections.push(`
      <div class="test-category">
        <h5 class="test-category-title">🏷️ Test Markers</h5>
        <div class="test-markers-grid">
          ${Object.entries(testContext.test_markers).map(([marker, desc]) => `
            <div class="marker-card">
              <span class="marker-name">@${escapeHtml(marker)}</span>
              <span class="marker-desc">${escapeHtml(desc)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `);
  }

  return sections.join('');
}

function renderConflictDetectionSection(conflictDetection) {
  const sections = [];

  // Risk Level Indicator
  if (conflictDetection.risk_level) {
    const riskLevel = conflictDetection.risk_level;
    const riskColor = riskLevel === 'high' ? '#ef4444' : riskLevel === 'medium' ? '#f59e0b' : '#10b981';
    sections.push(`
      <div class="risk-indicator" style="border-color: ${riskColor}">
        <div class="risk-level" style="background: ${riskColor}">
          ${escapeHtml(riskLevel.toUpperCase())} RISK
        </div>
        ${conflictDetection.mitigation_strategy ? `
          <div class="risk-mitigation">
            <strong>Mitigation Strategy:</strong> ${escapeHtml(conflictDetection.mitigation_strategy)}
          </div>
        ` : ''}
      </div>
    `);
  }

  // Risk Factors
  if (conflictDetection.risk_factors) {
    const factors = conflictDetection.risk_factors;
    sections.push(`
      <div class="conflict-category">
        <h5 class="conflict-category-title">⚠️ Risk Factors</h5>
        <div class="risk-factors-list">
          ${factors.test_gaps && factors.test_gaps.length > 0 ? `
            <div class="risk-factor">
              <strong class="risk-factor-title">Test Gaps:</strong>
              <ul class="risk-factor-items">
                ${factors.test_gaps.map(gap => `<li>${escapeHtml(gap)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${factors.existing_implementations && factors.existing_implementations.length > 0 ? `
            <div class="risk-factor">
              <strong class="risk-factor-title">Existing Implementations:</strong>
              <ul class="risk-factor-items">
                ${factors.existing_implementations.map(impl => `<li>${escapeHtml(impl)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </div>
    `);
  }

  // Affected Modules
  if (conflictDetection.affected_modules && conflictDetection.affected_modules.length > 0) {
    sections.push(`
      <div class="conflict-category">
        <h5 class="conflict-category-title">📦 Affected Modules</h5>
        <div class="affected-modules-grid">
          ${conflictDetection.affected_modules.map(mod => `
            <span class="affected-module-tag">${escapeHtml(mod)}</span>
          `).join('')}
        </div>
      </div>
    `);
  }

  // Historical Conflicts
  if (conflictDetection.historical_conflicts && conflictDetection.historical_conflicts.length > 0) {
    sections.push(`
      <div class="conflict-category">
        <h5 class="conflict-category-title">📜 Historical Lessons</h5>
        <div class="historical-conflicts-list">
          ${conflictDetection.historical_conflicts.map(conflict => `
            <div class="historical-conflict-card">
              <div class="conflict-source">Source: ${escapeHtml(conflict.source || 'Unknown')}</div>
              ${conflict.lesson ? `<div class="conflict-lesson"><strong>Lesson:</strong> ${escapeHtml(conflict.lesson)}</div>` : ''}
              ${conflict.recommendation ? `<div class="conflict-recommendation"><strong>Recommendation:</strong> ${escapeHtml(conflict.recommendation)}</div>` : ''}
              ${conflict.challenge ? `<div class="conflict-challenge"><strong>Challenge:</strong> ${escapeHtml(conflict.challenge)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `);
  }

  return sections.join('');
}
