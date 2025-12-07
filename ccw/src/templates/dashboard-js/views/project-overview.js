// ==========================================
// PROJECT OVERVIEW VIEW
// ==========================================

function renderProjectOverview() {
  const container = document.getElementById('mainContent');
  const project = workflowData.projectOverview;

  if (!project) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-16 text-center">
        <div class="text-6xl mb-4">📋</div>
        <h3 class="text-xl font-semibold text-foreground mb-2">No Project Overview</h3>
        <p class="text-muted-foreground mb-4">
          Run <code class="px-2 py-1 bg-muted rounded text-sm font-mono">/workflow:init</code> to initialize project analysis
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <!-- Project Header -->
    <div class="bg-card border border-border rounded-lg p-6 mb-6">
      <div class="flex items-start justify-between mb-4">
        <div>
          <h2 class="text-2xl font-bold text-foreground mb-2">${escapeHtml(project.projectName)}</h2>
          <p class="text-muted-foreground">${escapeHtml(project.description || 'No description available')}</p>
        </div>
        <div class="text-sm text-muted-foreground text-right">
          <div>Initialized: ${formatDate(project.initializedAt)}</div>
          <div class="mt-1">Mode: <span class="font-mono text-xs px-2 py-0.5 bg-muted rounded">${escapeHtml(project.metadata?.analysis_mode || 'unknown')}</span></div>
        </div>
      </div>
    </div>

    <!-- Technology Stack -->
    <div class="bg-card border border-border rounded-lg p-6 mb-6">
      <h3 class="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <span>💻</span> Technology Stack
      </h3>

      <!-- Languages -->
      <div class="mb-5">
        <h4 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Languages</h4>
        <div class="flex flex-wrap gap-3">
          ${project.technologyStack.languages.map(lang => `
            <div class="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-lg ${lang.primary ? 'ring-2 ring-primary' : ''}">
              <span class="font-semibold text-foreground">${escapeHtml(lang.name)}</span>
              <span class="text-xs text-muted-foreground">${lang.file_count} files</span>
              ${lang.primary ? '<span class="text-xs px-1.5 py-0.5 bg-primary text-primary-foreground rounded">Primary</span>' : ''}
            </div>
          `).join('') || '<span class="text-muted-foreground text-sm">No languages detected</span>'}
        </div>
      </div>

      <!-- Frameworks -->
      <div class="mb-5">
        <h4 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Frameworks</h4>
        <div class="flex flex-wrap gap-2">
          ${project.technologyStack.frameworks.map(fw => `
            <span class="px-3 py-1.5 bg-success-light text-success rounded-lg text-sm font-medium">${escapeHtml(fw)}</span>
          `).join('') || '<span class="text-muted-foreground text-sm">No frameworks detected</span>'}
        </div>
      </div>

      <!-- Build Tools -->
      <div class="mb-5">
        <h4 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Build Tools</h4>
        <div class="flex flex-wrap gap-2">
          ${project.technologyStack.build_tools.map(tool => `
            <span class="px-3 py-1.5 bg-warning-light text-warning rounded-lg text-sm font-medium">${escapeHtml(tool)}</span>
          `).join('') || '<span class="text-muted-foreground text-sm">No build tools detected</span>'}
        </div>
      </div>

      <!-- Test Frameworks -->
      <div>
        <h4 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Test Frameworks</h4>
        <div class="flex flex-wrap gap-2">
          ${project.technologyStack.test_frameworks.map(fw => `
            <span class="px-3 py-1.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium">${escapeHtml(fw)}</span>
          `).join('') || '<span class="text-muted-foreground text-sm">No test frameworks detected</span>'}
        </div>
      </div>
    </div>

    <!-- Architecture -->
    <div class="bg-card border border-border rounded-lg p-6 mb-6">
      <h3 class="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <span>🏗️</span> Architecture
      </h3>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
        <!-- Style -->
        <div>
          <h4 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Style</h4>
          <div class="px-3 py-2 bg-background border border-border rounded-lg">
            <span class="text-foreground font-medium">${escapeHtml(project.architecture.style)}</span>
          </div>
        </div>

        <!-- Layers -->
        <div>
          <h4 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Layers</h4>
          <div class="flex flex-wrap gap-2">
            ${project.architecture.layers.map(layer => `
              <span class="px-2 py-1 bg-muted text-foreground rounded text-sm">${escapeHtml(layer)}</span>
            `).join('') || '<span class="text-muted-foreground text-sm">None</span>'}
          </div>
        </div>

        <!-- Patterns -->
        <div>
          <h4 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Patterns</h4>
          <div class="flex flex-wrap gap-2">
            ${project.architecture.patterns.map(pattern => `
              <span class="px-2 py-1 bg-muted text-foreground rounded text-sm">${escapeHtml(pattern)}</span>
            `).join('') || '<span class="text-muted-foreground text-sm">None</span>'}
          </div>
        </div>
      </div>
    </div>

    <!-- Key Components -->
    <div class="bg-card border border-border rounded-lg p-6 mb-6">
      <h3 class="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <span>⚙️</span> Key Components
      </h3>

      ${project.keyComponents.length > 0 ? `
        <div class="space-y-3">
          ${project.keyComponents.map(comp => {
            const importanceColors = {
              high: 'border-l-4 border-l-destructive bg-destructive/5',
              medium: 'border-l-4 border-l-warning bg-warning/5',
              low: 'border-l-4 border-l-muted-foreground bg-muted'
            };
            const importanceBadges = {
              high: '<span class="px-2 py-0.5 text-xs font-semibold bg-destructive text-destructive-foreground rounded">High</span>',
              medium: '<span class="px-2 py-0.5 text-xs font-semibold bg-warning text-foreground rounded">Medium</span>',
              low: '<span class="px-2 py-0.5 text-xs font-semibold bg-muted text-muted-foreground rounded">Low</span>'
            };
            return `
              <div class="p-4 ${importanceColors[comp.importance] || importanceColors.low} rounded-lg">
                <div class="flex items-start justify-between mb-2">
                  <h4 class="font-semibold text-foreground">${escapeHtml(comp.name)}</h4>
                  ${importanceBadges[comp.importance] || ''}
                </div>
                <p class="text-sm text-muted-foreground mb-2">${escapeHtml(comp.description)}</p>
                <code class="text-xs font-mono text-primary">${escapeHtml(comp.path)}</code>
              </div>
            `;
          }).join('')}
        </div>
      ` : '<p class="text-muted-foreground text-sm">No key components identified</p>'}
    </div>

    <!-- Development Index -->
    <div class="bg-card border border-border rounded-lg p-6 mb-6">
      <h3 class="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <span>📝</span> Development History
      </h3>

      ${renderDevelopmentIndex(project.developmentIndex)}
    </div>

    <!-- Statistics -->
    <div class="bg-card border border-border rounded-lg p-6">
      <h3 class="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <span>📊</span> Statistics
      </h3>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="text-center p-4 bg-background rounded-lg">
          <div class="text-3xl font-bold text-primary mb-1">${project.statistics.total_features || 0}</div>
          <div class="text-sm text-muted-foreground">Total Features</div>
        </div>
        <div class="text-center p-4 bg-background rounded-lg">
          <div class="text-3xl font-bold text-success mb-1">${project.statistics.total_sessions || 0}</div>
          <div class="text-sm text-muted-foreground">Total Sessions</div>
        </div>
        <div class="text-center p-4 bg-background rounded-lg">
          <div class="text-sm text-muted-foreground mb-1">Last Updated</div>
          <div class="text-sm font-medium text-foreground">${formatDate(project.statistics.last_updated)}</div>
        </div>
      </div>
    </div>
  `;
}

function renderDevelopmentIndex(devIndex) {
  if (!devIndex) return '<p class="text-muted-foreground text-sm">No development history available</p>';

  const categories = [
    { key: 'feature', label: 'Features', icon: '✨', badgeClass: 'bg-primary-light text-primary' },
    { key: 'enhancement', label: 'Enhancements', icon: '⚡', badgeClass: 'bg-success-light text-success' },
    { key: 'bugfix', label: 'Bug Fixes', icon: '🐛', badgeClass: 'bg-destructive/10 text-destructive' },
    { key: 'refactor', label: 'Refactorings', icon: '🔧', badgeClass: 'bg-warning-light text-warning' },
    { key: 'docs', label: 'Documentation', icon: '📚', badgeClass: 'bg-muted text-muted-foreground' }
  ];

  const totalEntries = categories.reduce((sum, cat) => sum + (devIndex[cat.key]?.length || 0), 0);

  if (totalEntries === 0) {
    return '<p class="text-muted-foreground text-sm">No development history entries</p>';
  }

  return `
    <div class="space-y-4">
      ${categories.map(cat => {
        const entries = devIndex[cat.key] || [];
        if (entries.length === 0) return '';

        return `
          <div>
            <h4 class="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <span>${cat.icon}</span>
              <span>${cat.label}</span>
              <span class="text-xs px-2 py-0.5 ${cat.badgeClass} rounded-full">${entries.length}</span>
            </h4>
            <div class="space-y-2">
              ${entries.slice(0, 5).map(entry => `
                <div class="p-3 bg-background border border-border rounded-lg hover:shadow-sm transition-shadow">
                  <div class="flex items-start justify-between mb-1">
                    <h5 class="font-medium text-foreground text-sm">${escapeHtml(entry.title)}</h5>
                    <span class="text-xs text-muted-foreground">${formatDate(entry.date)}</span>
                  </div>
                  ${entry.description ? `<p class="text-sm text-muted-foreground mb-1">${escapeHtml(entry.description)}</p>` : ''}
                  <div class="flex items-center gap-2 text-xs">
                    ${entry.sub_feature ? `<span class="px-2 py-0.5 bg-muted rounded">${escapeHtml(entry.sub_feature)}</span>` : ''}
                    ${entry.status ? `<span class="px-2 py-0.5 ${entry.status === 'completed' ? 'bg-success-light text-success' : 'bg-warning-light text-warning'} rounded">${escapeHtml(entry.status)}</span>` : ''}
                  </div>
                </div>
              `).join('')}
              ${entries.length > 5 ? `<div class="text-sm text-muted-foreground text-center py-2">... and ${entries.length - 5} more</div>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}
