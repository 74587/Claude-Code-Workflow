// Skills Manager View
// Manages Claude Code skills (.claude/skills/)

// ========== Skills State ==========
var skillsData = {
  projectSkills: [],
  userSkills: []
};
var selectedSkill = null;
var skillsLoading = false;

// ========== Main Render Function ==========
async function renderSkillsManager() {
  const container = document.getElementById('mainContent');
  if (!container) return;

  // Hide stats grid and search
  const statsGrid = document.getElementById('statsGrid');
  const searchInput = document.getElementById('searchInput');
  if (statsGrid) statsGrid.style.display = 'none';
  if (searchInput) searchInput.parentElement.style.display = 'none';

  // Show loading state
  container.innerHTML = '<div class="skills-manager loading">' +
    '<div class="loading-spinner"><i data-lucide="loader-2" class="w-8 h-8 animate-spin"></i></div>' +
    '<p>' + t('common.loading') + '</p>' +
    '</div>';

  // Load skills data
  await loadSkillsData();

  // Render the main view
  renderSkillsView();
}

async function loadSkillsData() {
  skillsLoading = true;
  try {
    const response = await fetch('/api/skills?path=' + encodeURIComponent(projectPath));
    if (!response.ok) throw new Error('Failed to load skills');
    const data = await response.json();
    skillsData = {
      projectSkills: data.projectSkills || [],
      userSkills: data.userSkills || []
    };
    // Update badge
    updateSkillsBadge();
  } catch (err) {
    console.error('Failed to load skills:', err);
    skillsData = { projectSkills: [], userSkills: [] };
  } finally {
    skillsLoading = false;
  }
}

function updateSkillsBadge() {
  const badge = document.getElementById('badgeSkills');
  if (badge) {
    const total = skillsData.projectSkills.length + skillsData.userSkills.length;
    badge.textContent = total;
  }
}

function renderSkillsView() {
  const container = document.getElementById('mainContent');
  if (!container) return;

  const projectSkills = skillsData.projectSkills || [];
  const userSkills = skillsData.userSkills || [];

  container.innerHTML = `
    <div class="skills-manager">
      <!-- Header -->
      <div class="skills-header mb-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <i data-lucide="sparkles" class="w-5 h-5 text-primary"></i>
            </div>
            <div>
              <h2 class="text-lg font-semibold text-foreground">${t('skills.title')}</h2>
              <p class="text-sm text-muted-foreground">${t('skills.description')}</p>
            </div>
          </div>
          <button class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
                  onclick="openSkillCreateModal()">
            <i data-lucide="plus" class="w-4 h-4"></i>
            ${t('skills.create')}
          </button>
        </div>
      </div>

      <!-- Project Skills Section -->
      <div class="skills-section mb-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <i data-lucide="folder" class="w-5 h-5 text-primary"></i>
            <h3 class="text-lg font-semibold text-foreground">${t('skills.projectSkills')}</h3>
            <span class="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">.claude/skills/</span>
          </div>
          <span class="text-sm text-muted-foreground">${projectSkills.length} ${t('skills.skillsCount')}</span>
        </div>

        ${projectSkills.length === 0 ? `
          <div class="skills-empty-state bg-card border border-border rounded-lg p-6 text-center">
            <div class="text-muted-foreground mb-3"><i data-lucide="sparkles" class="w-10 h-10 mx-auto"></i></div>
            <p class="text-muted-foreground">${t('skills.noProjectSkills')}</p>
            <p class="text-sm text-muted-foreground mt-1">${t('skills.createHint')}</p>
          </div>
        ` : `
          <div class="skills-grid grid gap-3">
            ${projectSkills.map(skill => renderSkillCard(skill, 'project')).join('')}
          </div>
        `}
      </div>

      <!-- User Skills Section -->
      <div class="skills-section mb-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <i data-lucide="user" class="w-5 h-5 text-indigo"></i>
            <h3 class="text-lg font-semibold text-foreground">${t('skills.userSkills')}</h3>
            <span class="text-xs px-2 py-0.5 bg-indigo/10 text-indigo rounded-full">~/.claude/skills/</span>
          </div>
          <span class="text-sm text-muted-foreground">${userSkills.length} ${t('skills.skillsCount')}</span>
        </div>

        ${userSkills.length === 0 ? `
          <div class="skills-empty-state bg-card border border-border rounded-lg p-6 text-center">
            <div class="text-muted-foreground mb-3"><i data-lucide="user" class="w-10 h-10 mx-auto"></i></div>
            <p class="text-muted-foreground">${t('skills.noUserSkills')}</p>
            <p class="text-sm text-muted-foreground mt-1">${t('skills.userSkillsHint')}</p>
          </div>
        ` : `
          <div class="skills-grid grid gap-3">
            ${userSkills.map(skill => renderSkillCard(skill, 'user')).join('')}
          </div>
        `}
      </div>

      <!-- Skill Detail Panel -->
      ${selectedSkill ? renderSkillDetailPanel(selectedSkill) : ''}
    </div>
  `;

  // Initialize Lucide icons
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderSkillCard(skill, location) {
  const hasAllowedTools = skill.allowedTools && skill.allowedTools.length > 0;
  const hasSupportingFiles = skill.supportingFiles && skill.supportingFiles.length > 0;
  const locationIcon = location === 'project' ? 'folder' : 'user';
  const locationClass = location === 'project' ? 'text-primary' : 'text-indigo';
  const locationBg = location === 'project' ? 'bg-primary/10' : 'bg-indigo/10';

  return `
    <div class="skill-card bg-card border border-border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer"
         onclick="showSkillDetail('${escapeHtml(skill.name)}', '${location}')">
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 ${locationBg} rounded-lg flex items-center justify-center">
            <i data-lucide="sparkles" class="w-5 h-5 ${locationClass}"></i>
          </div>
          <div>
            <h4 class="font-semibold text-foreground">${escapeHtml(skill.name)}</h4>
            ${skill.version ? `<span class="text-xs text-muted-foreground">v${escapeHtml(skill.version)}</span>` : ''}
          </div>
        </div>
        <div class="flex items-center gap-1">
          <span class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${locationBg} ${locationClass}">
            <i data-lucide="${locationIcon}" class="w-3 h-3 mr-1"></i>
            ${location}
          </span>
        </div>
      </div>

      <p class="text-sm text-muted-foreground mb-3 line-clamp-2">${escapeHtml(skill.description || t('skills.noDescription'))}</p>

      <div class="flex items-center gap-3 text-xs text-muted-foreground">
        ${hasAllowedTools ? `
          <span class="flex items-center gap-1">
            <i data-lucide="lock" class="w-3 h-3"></i>
            ${skill.allowedTools.length} ${t('skills.tools')}
          </span>
        ` : ''}
        ${hasSupportingFiles ? `
          <span class="flex items-center gap-1">
            <i data-lucide="file-text" class="w-3 h-3"></i>
            ${skill.supportingFiles.length} ${t('skills.files')}
          </span>
        ` : ''}
      </div>
    </div>
  `;
}

function renderSkillDetailPanel(skill) {
  const hasAllowedTools = skill.allowedTools && skill.allowedTools.length > 0;
  const hasSupportingFiles = skill.supportingFiles && skill.supportingFiles.length > 0;

  return `
    <div class="skill-detail-panel fixed top-0 right-0 w-1/2 max-w-xl h-full bg-card border-l border-border shadow-lg z-50 flex flex-col">
      <div class="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 class="text-lg font-semibold text-foreground">${escapeHtml(skill.name)}</h3>
        <button class="w-8 h-8 flex items-center justify-center text-xl text-muted-foreground hover:text-foreground hover:bg-hover rounded"
                onclick="closeSkillDetail()">&times;</button>
      </div>
      <div class="flex-1 overflow-y-auto p-5">
        <div class="space-y-6">
          <!-- Description -->
          <div>
            <h4 class="text-sm font-semibold text-foreground mb-2">${t('skills.descriptionLabel')}</h4>
            <p class="text-sm text-muted-foreground">${escapeHtml(skill.description || t('skills.noDescription'))}</p>
          </div>

          <!-- Metadata -->
          <div>
            <h4 class="text-sm font-semibold text-foreground mb-2">${t('skills.metadata')}</h4>
            <div class="grid grid-cols-2 gap-3">
              <div class="bg-muted/50 rounded-lg p-3">
                <span class="text-xs text-muted-foreground">${t('skills.location')}</span>
                <p class="text-sm font-medium text-foreground">${escapeHtml(skill.location)}</p>
              </div>
              ${skill.version ? `
                <div class="bg-muted/50 rounded-lg p-3">
                  <span class="text-xs text-muted-foreground">${t('skills.version')}</span>
                  <p class="text-sm font-medium text-foreground">${escapeHtml(skill.version)}</p>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Allowed Tools -->
          ${hasAllowedTools ? `
            <div>
              <h4 class="text-sm font-semibold text-foreground mb-2">${t('skills.allowedTools')}</h4>
              <div class="flex flex-wrap gap-2">
                ${skill.allowedTools.map(tool => `
                  <span class="px-2 py-1 text-xs bg-muted rounded-lg font-mono">${escapeHtml(tool)}</span>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Supporting Files -->
          ${hasSupportingFiles ? `
            <div>
              <h4 class="text-sm font-semibold text-foreground mb-2">${t('skills.supportingFiles')}</h4>
              <div class="space-y-2">
                ${skill.supportingFiles.map(file => `
                  <div class="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <i data-lucide="file-text" class="w-4 h-4 text-muted-foreground"></i>
                    <span class="text-sm font-mono text-foreground">${escapeHtml(file)}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Path -->
          <div>
            <h4 class="text-sm font-semibold text-foreground mb-2">${t('skills.path')}</h4>
            <code class="block p-3 bg-muted rounded-lg text-xs font-mono text-muted-foreground break-all">${escapeHtml(skill.path)}</code>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="px-5 py-4 border-t border-border flex justify-between">
        <button class="px-4 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors flex items-center gap-2"
                onclick="deleteSkill('${escapeHtml(skill.name)}', '${skill.location}')">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
          ${t('common.delete')}
        </button>
        <button class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
                onclick="editSkill('${escapeHtml(skill.name)}', '${skill.location}')">
          <i data-lucide="edit" class="w-4 h-4"></i>
          ${t('common.edit')}
        </button>
      </div>
    </div>
    <div class="skill-detail-overlay fixed inset-0 bg-black/50 z-40" onclick="closeSkillDetail()"></div>
  `;
}

async function showSkillDetail(skillName, location) {
  try {
    const response = await fetch('/api/skills/' + encodeURIComponent(skillName) + '?location=' + location + '&path=' + encodeURIComponent(projectPath));
    if (!response.ok) throw new Error('Failed to load skill detail');
    const data = await response.json();
    selectedSkill = data.skill;
    renderSkillsView();
  } catch (err) {
    console.error('Failed to load skill detail:', err);
    if (window.showToast) {
      showToast(t('skills.loadError'), 'error');
    }
  }
}

function closeSkillDetail() {
  selectedSkill = null;
  renderSkillsView();
}

async function deleteSkill(skillName, location) {
  if (!confirm(t('skills.deleteConfirm', { name: skillName }))) return;

  try {
    const response = await fetch('/api/skills/' + encodeURIComponent(skillName), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location, projectPath })
    });
    if (!response.ok) throw new Error('Failed to delete skill');

    selectedSkill = null;
    await loadSkillsData();
    renderSkillsView();

    if (window.showToast) {
      showToast(t('skills.deleted'), 'success');
    }
  } catch (err) {
    console.error('Failed to delete skill:', err);
    if (window.showToast) {
      showToast(t('skills.deleteError'), 'error');
    }
  }
}

function editSkill(skillName, location) {
  // Open edit modal (to be implemented with modal)
  if (window.showToast) {
    showToast(t('skills.editNotImplemented'), 'info');
  }
}

function openSkillCreateModal() {
  // Open create modal (to be implemented with modal)
  if (window.showToast) {
    showToast(t('skills.createNotImplemented'), 'info');
  }
}
