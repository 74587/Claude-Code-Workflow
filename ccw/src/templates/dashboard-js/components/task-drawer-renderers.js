// ==========================================
// TASK DRAWER RENDERERS
// ==========================================
// Detailed content renderers and helper functions for task drawer

function renderPreAnalysisSteps(preAnalysis) {
  if (!Array.isArray(preAnalysis) || preAnalysis.length === 0) {
    return '<div class="empty-section">No pre-analysis steps</div>';
  }

  return `
    <div class="lite-card">
      <div class="lite-card-header">
        <span class="lite-card-icon">🔍</span>
        <h4 class="lite-card-title">Pre-Analysis Steps</h4>
        <span class="lite-count-badge">${preAnalysis.length}</span>
      </div>
      <div class="lite-card-body">
        <div class="lite-impl-steps">
          ${preAnalysis.map((item, idx) => `
            <div class="lite-impl-step">
              <div class="lite-step-num">${idx + 1}</div>
              <div class="lite-step-content">
                <p class="lite-step-text">${escapeHtml(item.step || item.action || 'Step ' + (idx + 1))}</p>
                ${item.action && item.action !== item.step ? `
                  <div class="lite-step-meta">
                    <span class="lite-step-label">Action:</span>
                    <span class="lite-step-value">${escapeHtml(item.action)}</span>
                  </div>
                ` : ''}
                ${item.commands?.length ? `
                  <div class="lite-step-commands">
                    ${item.commands.map(c => `<code class="lite-cmd-tag">${escapeHtml(typeof c === 'string' ? c : JSON.stringify(c))}</code>`).join('')}
                  </div>
                ` : ''}
                ${item.output_to ? `
                  <div class="lite-step-meta">
                    <span class="lite-step-label">Output:</span>
                    <code class="lite-file-tag">${escapeHtml(item.output_to)}</code>
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderImplementationStepsList(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return '<div class="empty-section">No implementation steps</div>';
  }

  return `
    <div class="lite-card">
      <div class="lite-card-header">
        <span class="lite-card-icon">📋</span>
        <h4 class="lite-card-title">Implementation Approach</h4>
        <span class="lite-count-badge">${steps.length}</span>
      </div>
      <div class="lite-card-body">
        <div class="session-impl-steps">
          ${steps.map((step, idx) => {
            const hasMods = step.modification_points?.length;
            const hasFlow = step.logic_flow?.length;

            return `
            <div class="session-impl-step">
              <div class="session-step-header">
                <div class="lite-step-num">${step.step || idx + 1}</div>
                <div class="session-step-title">${escapeHtml(step.title || 'Untitled Step')}</div>
              </div>
              ${step.description ? `<div class="session-step-desc">${escapeHtml(step.description)}</div>` : ''}
              ${hasMods ? `
                <div class="session-step-section">
                  <div class="session-section-label">
                    <span class="session-section-icon">🔧</span>
                    <span>Modifications</span>
                    <span class="lite-count-badge">${step.modification_points.length}</span>
                  </div>
                  <div class="session-mods-list">
                    ${step.modification_points.map(mp => `
                      <div class="session-mod-item">
                        ${typeof mp === 'string' ? `<code class="lite-file-tag">${escapeHtml(mp)}</code>` : `
                          <code class="lite-file-tag">${escapeHtml(mp.file || mp.path || '')}</code>
                          ${mp.changes ? `<span class="session-mod-change">${escapeHtml(mp.changes)}</span>` : ''}
                        `}
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
              ${hasFlow ? `
                <div class="session-step-section">
                  <div class="session-section-label">
                    <span class="session-section-icon">⚡</span>
                    <span>Logic Flow</span>
                    <span class="lite-count-badge">${step.logic_flow.length}</span>
                  </div>
                  <div class="session-flow-list">
                    ${step.logic_flow.map((lf, lfIdx) => `
                      <div class="session-flow-item">
                        <span class="session-flow-num">${lfIdx + 1}</span>
                        <span class="session-flow-text">${escapeHtml(typeof lf === 'string' ? lf : lf.action || JSON.stringify(lf))}</span>
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
              ${step.depends_on?.length ? `
                <div class="session-step-deps">
                  <span class="session-deps-label">Dependencies:</span>
                  <div class="lite-deps-tags">
                    ${step.depends_on.map(d => `<span class="lite-dep-tag">${escapeHtml(d)}</span>`).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          `}).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderTargetFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return '<div class="empty-section">No target files</div>';
  }

  // Get current project path for building full paths
  const projectPath = window.currentProjectPath || '';

  return `
    <div class="lite-card">
      <div class="lite-card-header">
        <span class="lite-card-icon">📁</span>
        <h4 class="lite-card-title">Target Files</h4>
        <span class="lite-count-badge">${files.length}</span>
      </div>
      <div class="lite-card-body">
        <div class="session-files-list">
          ${files.map(f => {
            const filePath = typeof f === 'string' ? f : (f.path || JSON.stringify(f));
            // Build full path for vscode link
            const fullPath = filePath.startsWith('/') || filePath.includes(':')
              ? filePath
              : (projectPath ? `${projectPath}/${filePath}` : filePath);
            const vscodeUri = `vscode://file/${fullPath.replace(/\\/g, '/')}`;

            return `
              <a href="${vscodeUri}" class="session-file-item" title="Open in VS Code: ${escapeHtml(fullPath)}">
                <span class="session-file-icon">📄</span>
                <code class="session-file-path">${escapeHtml(filePath)}</code>
                <span class="session-file-action">↗</span>
              </a>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderTestCommands(testCommands) {
  if (!testCommands || typeof testCommands !== 'object') return '';

  const entries = Object.entries(testCommands);
  if (entries.length === 0) return '';

  return `
    <div class="lite-card">
      <div class="lite-card-header">
        <span class="lite-card-icon">🧪</span>
        <h4 class="lite-card-title">Test Commands</h4>
        <span class="lite-count-badge">${entries.length}</span>
      </div>
      <div class="lite-card-body">
        <div class="session-test-commands">
          ${entries.map(([key, val]) => `
            <div class="session-test-item">
              <span class="session-test-label">${escapeHtml(key)}</span>
              <code class="session-test-cmd">${escapeHtml(typeof val === 'string' ? val : JSON.stringify(val))}</code>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderTaskDetail(sessionId, task) {
  // Get raw task data for JSON view
  const rawTask = task._raw || task;
  const taskJsonId = `task-json-${sessionId}-${task.id}`.replace(/[^a-zA-Z0-9-]/g, '-');

  // Store JSON in memory instead of inline script tag
  taskJsonStore[taskJsonId] = rawTask;

  return `
    <div class="task-detail" id="task-${sessionId}-${task.id}">
      <div class="task-detail-header">
        <span class="task-id-badge">${escapeHtml(task.id)}</span>
        <span class="task-title">${escapeHtml(task.title || 'Untitled')}</span>
        <span class="task-status-badge ${task.status}">${task.status}</span>
        <div class="task-header-actions">
          <button class="btn-view-json" onclick="showJsonModal('${taskJsonId}', '${escapeHtml(task.id)}')">{ } JSON</button>
        </div>
      </div>

      <!-- Collapsible: Meta -->
      <div class="collapsible-section">
        <div class="collapsible-header">
          <span class="collapse-icon">▶</span>
          <span class="section-label">meta</span>
          <span class="section-preview">${escapeHtml((task.meta?.type || task.meta?.action || '') + (task.meta?.scope ? ' | ' + task.meta.scope : ''))}</span>
        </div>
        <div class="collapsible-content collapsed">
          ${renderDynamicFields(task.meta || rawTask, ['type', 'action', 'agent', 'scope', 'module', 'execution_group'])}
        </div>
      </div>

      <!-- Collapsible: Context -->
      <div class="collapsible-section">
        <div class="collapsible-header">
          <span class="collapse-icon">▶</span>
          <span class="section-label">context</span>
          <span class="section-preview">${escapeHtml(getContextPreview(task.context, rawTask))}</span>
        </div>
        <div class="collapsible-content collapsed">
          ${renderContextFields(task.context, rawTask)}
        </div>
      </div>

      <!-- Collapsible: Flow Control (with Flowchart) -->
      <div class="collapsible-section">
        <div class="collapsible-header">
          <span class="collapse-icon">▶</span>
          <span class="section-label">flow_control</span>
          <span class="section-preview">${escapeHtml(getFlowControlPreview(task.flow_control, rawTask))}</span>
        </div>
        <div class="collapsible-content collapsed">
          <div class="flowchart-container" id="flowchart-${sessionId}-${task.id}"></div>
          ${renderFlowControlDetails(task.flow_control, rawTask)}
        </div>
      </div>
    </div>
  `;
}

function getContextPreview(context, rawTask) {
  const items = [];
  if (context?.requirements?.length) items.push(`${context.requirements.length} reqs`);
  if (context?.acceptance?.length) items.push(`${context.acceptance.length} acceptance`);
  if (context?.focus_paths?.length) items.push(`${context.focus_paths.length} paths`);
  if (rawTask?.modification_points?.length) items.push(`${rawTask.modification_points.length} mods`);
  return items.join(' | ') || 'No context';
}

function getFlowControlPreview(flowControl, rawTask) {
  const steps = flowControl?.implementation_approach?.length || rawTask?.implementation?.length || 0;
  return steps > 0 ? `${steps} steps` : 'No steps';
}

function renderDynamicFields(obj, priorityKeys = []) {
  if (!obj || typeof obj !== 'object') return '<div class="field-value json-value-null">null</div>';

  const entries = Object.entries(obj).filter(([k, v]) => v !== null && v !== undefined && k !== '_raw');
  if (entries.length === 0) return '<div class="field-value json-value-null">Empty</div>';

  // Sort: priority keys first, then alphabetically
  entries.sort(([a], [b]) => {
    const aIdx = priorityKeys.indexOf(a);
    const bIdx = priorityKeys.indexOf(b);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.localeCompare(b);
  });

  return `<div class="field-group">${entries.map(([key, value]) => renderFieldRow(key, value)).join('')}</div>`;
}

function renderFieldRow(key, value) {
  return `
    <div class="field-row">
      <span class="field-label">${escapeHtml(key)}:</span>
      <div class="field-value">${renderFieldValue(key, value)}</div>
    </div>
  `;
}

function renderFieldValue(key, value) {
  if (value === null || value === undefined) {
    return '<span class="json-value-null">null</span>';
  }

  if (typeof value === 'boolean') {
    return `<span class="json-value-boolean">${value}</span>`;
  }

  if (typeof value === 'number') {
    return `<span class="json-value-number">${value}</span>`;
  }

  if (typeof value === 'string') {
    // Check if it's a path
    if (key.includes('path') || key.includes('file') || value.includes('/') || value.includes('\\')) {
      return `<span class="array-item path-item">${escapeHtml(value)}</span>`;
    }
    return `<span class="json-value-string">${escapeHtml(value)}</span>`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '<span class="json-value-null">[]</span>';

    // Check if array contains objects or strings
    if (typeof value[0] === 'object') {
      return `<div class="nested-array">${value.map((item, i) => `
        <div class="array-object">
          <div class="array-object-header">[${i + 1}]</div>
          ${renderDynamicFields(item)}
        </div>
      `).join('')}</div>`;
    }

    // Array of strings/primitives
    const isPathArray = key.includes('path') || key.includes('file');
    return `<div class="array-value">${value.map(v =>
      `<span class="array-item ${isPathArray ? 'path-item' : ''}">${escapeHtml(String(v))}</span>`
    ).join('')}</div>`;
  }

  if (typeof value === 'object') {
    return renderDynamicFields(value);
  }

  return escapeHtml(String(value));
}

function renderContextFields(context, rawTask) {
  const sections = [];

  // Requirements / Description
  const requirements = context?.requirements || [];
  const description = rawTask?.description;
  if (requirements.length > 0 || description) {
    sections.push(`
      <div class="context-field">
        <label>requirements:</label>
        ${description ? `<p style="margin-bottom: 8px;">${escapeHtml(description)}</p>` : ''}
        ${requirements.length > 0 ? `<ul>${requirements.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>` : ''}
      </div>
    `);
  }

  // Focus paths / Modification points
  const focusPaths = context?.focus_paths || [];
  const modPoints = rawTask?.modification_points || [];
  if (focusPaths.length > 0 || modPoints.length > 0) {
    sections.push(`
      <div class="context-field">
        <label>${modPoints.length > 0 ? 'modification_points:' : 'focus_paths:'}</label>
        ${modPoints.length > 0 ? `
          <div class="mod-points">
            ${modPoints.map(m => `
              <div class="mod-point">
                <span class="array-item path-item">${escapeHtml(m.file || m)}</span>
                ${m.target ? `<span class="mod-target">→ ${escapeHtml(m.target)}</span>` : ''}
                ${m.change ? `<p class="mod-change">${escapeHtml(m.change)}</p>` : ''}
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="path-tags">${focusPaths.map(p => `<span class="path-tag">${escapeHtml(p)}</span>`).join('')}</div>
        `}
      </div>
    `);
  }

  // Acceptance criteria
  const acceptance = context?.acceptance || rawTask?.acceptance || [];
  if (acceptance.length > 0) {
    sections.push(`
      <div class="context-field">
        <label>acceptance:</label>
        <ul>${acceptance.map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul>
      </div>
    `);
  }

  // Dependencies
  const depends = context?.depends_on || rawTask?.depends_on || [];
  if (depends.length > 0) {
    sections.push(`
      <div class="context-field">
        <label>depends_on:</label>
        <div class="path-tags">${depends.map(d => `<span class="array-item depends-badge">${escapeHtml(d)}</span>`).join('')}</div>
      </div>
    `);
  }

  // Reference
  const reference = rawTask?.reference;
  if (reference) {
    sections.push(`
      <div class="context-field">
        <label>reference:</label>
        ${renderDynamicFields(reference)}
      </div>
    `);
  }

  return sections.length > 0
    ? `<div class="context-fields">${sections.join('')}</div>`
    : '<div class="field-value json-value-null">No context data</div>';
}

function renderFlowControlDetails(flowControl, rawTask) {
  const sections = [];

  // Pre-analysis
  const preAnalysis = flowControl?.pre_analysis || rawTask?.pre_analysis || [];
  if (preAnalysis.length > 0) {
    sections.push(`
      <div class="context-field" style="margin-top: 16px;">
        <label>pre_analysis:</label>
        <ul>${preAnalysis.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
      </div>
    `);
  }

  // Target files
  const targetFiles = flowControl?.target_files || rawTask?.target_files || [];
  if (targetFiles.length > 0) {
    sections.push(`
      <div class="context-field">
        <label>target_files:</label>
        <div class="path-tags">${targetFiles.map(f => `<span class="path-tag">${escapeHtml(f)}</span>`).join('')}</div>
      </div>
    `);
  }

  return sections.join('');
}
