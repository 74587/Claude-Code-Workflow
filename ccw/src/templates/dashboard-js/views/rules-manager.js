// Rules Manager View
// Manages Claude Code rules (.claude/rules/)

// ========== Rules State ==========
var rulesData = {
  projectRules: [],
  userRules: []
};
var selectedRule = null;
var rulesLoading = false;

// ========== Main Render Function ==========
async function renderRulesManager() {
  const container = document.getElementById('mainContent');
  if (!container) return;

  // Hide stats grid and search
  const statsGrid = document.getElementById('statsGrid');
  const searchInput = document.getElementById('searchInput');
  if (statsGrid) statsGrid.style.display = 'none';
  if (searchInput) searchInput.parentElement.style.display = 'none';

  // Show loading state
  container.innerHTML = '<div class="rules-manager loading">' +
    '<div class="loading-spinner"><i data-lucide="loader-2" class="w-8 h-8 animate-spin"></i></div>' +
    '<p>' + t('common.loading') + '</p>' +
    '</div>';

  // Load rules data
  await loadRulesData();

  // Render the main view
  renderRulesView();
}

async function loadRulesData() {
  rulesLoading = true;
  try {
    const response = await fetch('/api/rules?path=' + encodeURIComponent(projectPath));
    if (!response.ok) throw new Error('Failed to load rules');
    const data = await response.json();
    rulesData = {
      projectRules: data.projectRules || [],
      userRules: data.userRules || []
    };
    // Update badge
    updateRulesBadge();
  } catch (err) {
    console.error('Failed to load rules:', err);
    rulesData = { projectRules: [], userRules: [] };
  } finally {
    rulesLoading = false;
  }
}

function updateRulesBadge() {
  const badge = document.getElementById('badgeRules');
  if (badge) {
    const total = rulesData.projectRules.length + rulesData.userRules.length;
    badge.textContent = total;
  }
}

function renderRulesView() {
  const container = document.getElementById('mainContent');
  if (!container) return;

  const projectRules = rulesData.projectRules || [];
  const userRules = rulesData.userRules || [];

  container.innerHTML = `
    <div class="rules-manager">
      <!-- Header -->
      <div class="rules-header mb-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
              <i data-lucide="book-open" class="w-5 h-5 text-success"></i>
            </div>
            <div>
              <h2 class="text-lg font-semibold text-foreground">${t('rules.title')}</h2>
              <p class="text-sm text-muted-foreground">${t('rules.description')}</p>
            </div>
          </div>
          <button class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
                  onclick="openRuleCreateModal()">
            <i data-lucide="plus" class="w-4 h-4"></i>
            ${t('rules.create')}
          </button>
        </div>
      </div>

      <!-- Project Rules Section -->
      <div class="rules-section mb-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <i data-lucide="folder" class="w-5 h-5 text-success"></i>
            <h3 class="text-lg font-semibold text-foreground">${t('rules.projectRules')}</h3>
            <span class="text-xs px-2 py-0.5 bg-success/10 text-success rounded-full">.claude/rules/</span>
          </div>
          <span class="text-sm text-muted-foreground">${projectRules.length} ${t('rules.rulesCount')}</span>
        </div>

        ${projectRules.length === 0 ? `
          <div class="rules-empty-state bg-card border border-border rounded-lg p-6 text-center">
            <div class="text-muted-foreground mb-3"><i data-lucide="book-open" class="w-10 h-10 mx-auto"></i></div>
            <p class="text-muted-foreground">${t('rules.noProjectRules')}</p>
            <p class="text-sm text-muted-foreground mt-1">${t('rules.createHint')}</p>
          </div>
        ` : `
          <div class="rules-grid grid gap-3">
            ${projectRules.map(rule => renderRuleCard(rule, 'project')).join('')}
          </div>
        `}
      </div>

      <!-- User Rules Section -->
      <div class="rules-section mb-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <i data-lucide="user" class="w-5 h-5 text-orange"></i>
            <h3 class="text-lg font-semibold text-foreground">${t('rules.userRules')}</h3>
            <span class="text-xs px-2 py-0.5 bg-orange/10 text-orange rounded-full">~/.claude/rules/</span>
          </div>
          <span class="text-sm text-muted-foreground">${userRules.length} ${t('rules.rulesCount')}</span>
        </div>

        ${userRules.length === 0 ? `
          <div class="rules-empty-state bg-card border border-border rounded-lg p-6 text-center">
            <div class="text-muted-foreground mb-3"><i data-lucide="user" class="w-10 h-10 mx-auto"></i></div>
            <p class="text-muted-foreground">${t('rules.noUserRules')}</p>
            <p class="text-sm text-muted-foreground mt-1">${t('rules.userRulesHint')}</p>
          </div>
        ` : `
          <div class="rules-grid grid gap-3">
            ${userRules.map(rule => renderRuleCard(rule, 'user')).join('')}
          </div>
        `}
      </div>

      <!-- Rule Detail Panel -->
      ${selectedRule ? renderRuleDetailPanel(selectedRule) : ''}
    </div>
  `;

  // Initialize Lucide icons
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderRuleCard(rule, location) {
  const hasPathCondition = rule.paths && rule.paths.length > 0;
  const isGlobal = !hasPathCondition;
  const locationIcon = location === 'project' ? 'folder' : 'user';
  const locationClass = location === 'project' ? 'text-success' : 'text-orange';
  const locationBg = location === 'project' ? 'bg-success/10' : 'bg-orange/10';

  // Get preview of content (first 100 chars)
  const contentPreview = rule.content ? rule.content.substring(0, 100).replace(/\n/g, ' ') + (rule.content.length > 100 ? '...' : '') : '';

  return `
    <div class="rule-card bg-card border border-border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
         onclick="showRuleDetail('${escapeHtml(rule.name)}', '${location}')">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 ${locationBg} rounded-lg flex items-center justify-center">
            <i data-lucide="file-text" class="w-5 h-5 ${locationClass}"></i>
          </div>
          <div>
            <h4 class="font-semibold text-foreground">${escapeHtml(rule.name)}</h4>
            ${rule.subdirectory ? `<span class="text-xs text-muted-foreground">${escapeHtml(rule.subdirectory)}/</span>` : ''}
          </div>
        </div>
        <div class="flex items-center gap-2">
          ${isGlobal ? `
            <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
              <i data-lucide="globe" class="w-3 h-3 mr-1"></i>
              global
            </span>
          ` : `
            <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-warning/10 text-warning">
              <i data-lucide="filter" class="w-3 h-3 mr-1"></i>
              conditional
            </span>
          `}
          <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${locationBg} ${locationClass}">
            <i data-lucide="${locationIcon}" class="w-3 h-3 mr-1"></i>
            ${location}
          </span>
        </div>
      </div>

      ${contentPreview ? `
        <p class="text-sm text-muted-foreground mb-3 line-clamp-2 font-mono">${escapeHtml(contentPreview)}</p>
      ` : ''}

      ${hasPathCondition ? `
        <div class="flex items-center gap-2 text-xs text-muted-foreground mt-2">
          <i data-lucide="filter" class="w-3 h-3"></i>
          <span class="font-mono">${escapeHtml(rule.paths.join(', '))}</span>
        </div>
      ` : ''}
    </div>
  `;
}

function renderRuleDetailPanel(rule) {
  const hasPathCondition = rule.paths && rule.paths.length > 0;

  return `
    <div class="rule-detail-panel fixed top-0 right-0 w-1/2 max-w-xl h-full bg-card border-l border-border shadow-lg z-50 flex flex-col">
      <div class="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 class="text-lg font-semibold text-foreground">${escapeHtml(rule.name)}</h3>
        <button class="w-8 h-8 flex items-center justify-center text-xl text-muted-foreground hover:text-foreground hover:bg-hover rounded"
                onclick="closeRuleDetail()">&times;</button>
      </div>
      <div class="flex-1 overflow-y-auto p-5">
        <div class="space-y-6">
          <!-- Type -->
          <div>
            <h4 class="text-sm font-semibold text-foreground mb-2">${t('rules.typeLabel')}</h4>
            <div class="flex items-center gap-2">
              ${hasPathCondition ? `
                <span class="inline-flex items-center px-3 py-1 text-sm font-medium rounded-lg bg-warning/10 text-warning">
                  <i data-lucide="filter" class="w-4 h-4 mr-2"></i>
                  ${t('rules.conditional')}
                </span>
              ` : `
                <span class="inline-flex items-center px-3 py-1 text-sm font-medium rounded-lg bg-primary/10 text-primary">
                  <i data-lucide="globe" class="w-4 h-4 mr-2"></i>
                  ${t('rules.global')}
                </span>
              `}
            </div>
          </div>

          <!-- Path Conditions -->
          ${hasPathCondition ? `
            <div>
              <h4 class="text-sm font-semibold text-foreground mb-2">${t('rules.pathConditions')}</h4>
              <div class="space-y-2">
                ${rule.paths.map(path => `
                  <div class="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <i data-lucide="file-code" class="w-4 h-4 text-muted-foreground"></i>
                    <code class="text-sm font-mono text-foreground">${escapeHtml(path)}</code>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Content -->
          <div>
            <h4 class="text-sm font-semibold text-foreground mb-2">${t('rules.content')}</h4>
            <div class="bg-muted rounded-lg p-4 max-h-96 overflow-y-auto">
              <pre class="text-sm font-mono text-foreground whitespace-pre-wrap">${escapeHtml(rule.content || '')}</pre>
            </div>
          </div>

          <!-- Path -->
          <div>
            <h4 class="text-sm font-semibold text-foreground mb-2">${t('rules.filePath')}</h4>
            <code class="block p-3 bg-muted rounded-lg text-xs font-mono text-muted-foreground break-all">${escapeHtml(rule.path)}</code>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="px-5 py-4 border-t border-border flex justify-between">
        <button class="px-4 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors flex items-center gap-2"
                onclick="deleteRule('${escapeHtml(rule.name)}', '${rule.location}')">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
          ${t('common.delete')}
        </button>
        <button class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
                onclick="editRule('${escapeHtml(rule.name)}', '${rule.location}')">
          <i data-lucide="edit" class="w-4 h-4"></i>
          ${t('common.edit')}
        </button>
      </div>
    </div>
    <div class="rule-detail-overlay fixed inset-0 bg-black/50 z-40" onclick="closeRuleDetail()"></div>
  `;
}

async function showRuleDetail(ruleName, location) {
  try {
    const response = await fetch('/api/rules/' + encodeURIComponent(ruleName) + '?location=' + location + '&path=' + encodeURIComponent(projectPath));
    if (!response.ok) throw new Error('Failed to load rule detail');
    const data = await response.json();
    selectedRule = data.rule;
    renderRulesView();
  } catch (err) {
    console.error('Failed to load rule detail:', err);
    if (window.showToast) {
      showToast(t('rules.loadError'), 'error');
    }
  }
}

function closeRuleDetail() {
  selectedRule = null;
  renderRulesView();
}

async function deleteRule(ruleName, location) {
  if (!confirm(t('rules.deleteConfirm', { name: ruleName }))) return;

  try {
    const response = await fetch('/api/rules/' + encodeURIComponent(ruleName), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location, projectPath })
    });
    if (!response.ok) throw new Error('Failed to delete rule');

    selectedRule = null;
    await loadRulesData();
    renderRulesView();

    if (window.showToast) {
      showToast(t('rules.deleted'), 'success');
    }
  } catch (err) {
    console.error('Failed to delete rule:', err);
    if (window.showToast) {
      showToast(t('rules.deleteError'), 'error');
    }
  }
}

function editRule(ruleName, location) {
  // Open edit modal (to be implemented with modal)
  if (window.showToast) {
    showToast(t('rules.editNotImplemented'), 'info');
  }
}

function openRuleCreateModal() {
  // Open create modal (to be implemented with modal)
  if (window.showToast) {
    showToast(t('rules.createNotImplemented'), 'info');
  }
}
