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

// ========== Create Skill Modal ==========
var skillCreateState = {
  mode: 'import', // 'import' or 'cli-generate'
  location: 'project',
  sourcePath: '',
  customName: '',
  validationResult: null,
  // CLI Generate mode fields
  generationType: 'description', // 'description' or 'template'
  description: '',
  skillName: ''
};

function openSkillCreateModal() {
  // Reset state
  skillCreateState = {
    mode: 'import',
    location: 'project',
    sourcePath: '',
    customName: '',
    validationResult: null,
    generationType: 'description',
    description: '',
    skillName: ''
  };

  // Create modal HTML
  const modalHtml = `
    <div class="modal-overlay fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onclick="closeSkillCreateModal(event)">
      <div class="modal-dialog bg-card rounded-lg shadow-lg w-full max-w-2xl mx-4" onclick="event.stopPropagation()">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 class="text-lg font-semibold text-foreground">${t('skills.createSkill')}</h3>
          <button class="w-8 h-8 flex items-center justify-center text-xl text-muted-foreground hover:text-foreground hover:bg-hover rounded"
                  onclick="closeSkillCreateModal()">&times;</button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-5">
          <!-- Location Selection -->
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">${t('skills.location')}</label>
            <div class="grid grid-cols-2 gap-3">
              <button class="location-btn px-4 py-3 text-left border-2 rounded-lg transition-all ${skillCreateState.location === 'project' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}"
                      onclick="selectSkillLocation('project')">
                <div class="flex items-center gap-2">
                  <i data-lucide="folder" class="w-5 h-5"></i>
                  <div>
                    <div class="font-medium">${t('skills.projectSkills')}</div>
                    <div class="text-xs text-muted-foreground">.claude/skills/</div>
                  </div>
                </div>
              </button>
              <button class="location-btn px-4 py-3 text-left border-2 rounded-lg transition-all ${skillCreateState.location === 'user' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}"
                      onclick="selectSkillLocation('user')">
                <div class="flex items-center gap-2">
                  <i data-lucide="user" class="w-5 h-5"></i>
                  <div>
                    <div class="font-medium">${t('skills.userSkills')}</div>
                    <div class="text-xs text-muted-foreground">~/.claude/skills/</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <!-- Mode Selection -->
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">${t('skills.createMode')}</label>
            <div class="grid grid-cols-2 gap-3">
              <button class="mode-btn px-4 py-3 text-left border-2 rounded-lg transition-all ${skillCreateState.mode === 'import' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}"
                      onclick="switchSkillCreateMode('import')">
                <div class="flex items-center gap-2">
                  <i data-lucide="folder-input" class="w-5 h-5"></i>
                  <div>
                    <div class="font-medium">${t('skills.importFolder')}</div>
                    <div class="text-xs text-muted-foreground">${t('skills.importFolderHint')}</div>
                  </div>
                </div>
              </button>
              <button class="mode-btn px-4 py-3 text-left border-2 rounded-lg transition-all ${skillCreateState.mode === 'cli-generate' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}"
                      onclick="switchSkillCreateMode('cli-generate')">
                <div class="flex items-center gap-2">
                  <i data-lucide="sparkles" class="w-5 h-5"></i>
                  <div>
                    <div class="font-medium">${t('skills.cliGenerate')}</div>
                    <div class="text-xs text-muted-foreground">${t('skills.cliGenerateHint')}</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <!-- Import Mode Content -->
          <div id="skillImportMode" style="display: ${skillCreateState.mode === 'import' ? 'block' : 'none'}">
            <!-- Source Folder Path -->
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">${t('skills.sourceFolder')}</label>
              <div class="flex gap-2">
                <input type="text" id="skillSourcePath"
                       class="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                       placeholder="${t('skills.sourceFolderPlaceholder')}"
                       value="${skillCreateState.sourcePath}">
                <button class="px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors text-sm"
                        onclick="browseSkillFolder()">
                  <i data-lucide="folder-open" class="w-4 h-4"></i>
                </button>
              </div>
              <p class="text-xs text-muted-foreground mt-1">${t('skills.sourceFolderHint')}</p>
            </div>

            <!-- Custom Name -->
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">${t('skills.customName')} <span class="text-muted-foreground">${t('common.optional')}</span></label>
              <input type="text" id="skillCustomName"
                     class="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                     placeholder="${t('skills.customNamePlaceholder')}"
                     value="${skillCreateState.customName}">
              <p class="text-xs text-muted-foreground mt-1">${t('skills.customNameHint')}</p>
            </div>

            <!-- Validation Result -->
            <div id="skillValidationResult"></div>
          </div>

          <!-- CLI Generate Mode Content -->
          <div id="skillCliGenerateMode" style="display: ${skillCreateState.mode === 'cli-generate' ? 'block' : 'none'}">
            <!-- Skill Name (Required for CLI Generate) -->
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">${t('skills.skillName')} <span class="text-destructive">*</span></label>
              <input type="text" id="skillGenerateName"
                     class="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                     placeholder="${t('skills.skillNamePlaceholder')}"
                     value="${skillCreateState.skillName}">
              <p class="text-xs text-muted-foreground mt-1">${t('skills.skillNameHint')}</p>
            </div>

            <!-- Generation Type Selection -->
            <div>
              <label class="block text-sm font-medium text-foreground mb-2">${t('skills.generationType')}</label>
              <div class="flex gap-3">
                <button class="flex-1 px-4 py-3 text-left border-2 rounded-lg transition-all ${skillCreateState.generationType === 'description' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}"
                        onclick="switchSkillGenerationType('description')">
                  <div class="flex items-center gap-2">
                    <i data-lucide="file-text" class="w-5 h-5"></i>
                    <div>
                      <div class="font-medium text-sm">${t('skills.fromDescription')}</div>
                      <div class="text-xs text-muted-foreground">${t('skills.fromDescriptionHint')}</div>
                    </div>
                  </div>
                </button>
                <button class="flex-1 px-4 py-3 text-left border-2 rounded-lg transition-all opacity-50 cursor-not-allowed"
                        disabled>
                  <div class="flex items-center gap-2">
                    <i data-lucide="layout-template" class="w-5 h-5"></i>
                    <div>
                      <div class="font-medium text-sm">${t('skills.fromTemplate')}</div>
                      <div class="text-xs text-muted-foreground">${t('skills.comingSoon')}</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <!-- Description Text Area (for 'description' type) -->
            <div id="skillDescriptionArea" style="display: ${skillCreateState.generationType === 'description' ? 'block' : 'none'}">
              <label class="block text-sm font-medium text-foreground mb-2">${t('skills.descriptionLabel')} <span class="text-destructive">*</span></label>
              <textarea id="skillDescription"
                        class="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="${t('skills.descriptionPlaceholder')}"
                        rows="6">${skillCreateState.description}</textarea>
              <p class="text-xs text-muted-foreground mt-1">${t('skills.descriptionGenerateHint')}</p>
            </div>

            <!-- CLI Generate Info -->
            <div class="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div class="flex items-start gap-2">
                <i data-lucide="info" class="w-4 h-4 text-blue-600 mt-0.5"></i>
                <div class="text-sm text-blue-600">
                  <p class="font-medium">${t('skills.cliGenerateInfo')}</p>
                  <p class="text-xs mt-1">${t('skills.cliGenerateTimeHint')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button class="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onclick="closeSkillCreateModal()">
            ${t('common.cancel')}
          </button>
          ${skillCreateState.mode === 'import' ? `
            <button class="px-4 py-2 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                    onclick="validateSkillImport()">
              ${t('skills.validate')}
            </button>
            <button class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
                    onclick="createSkill()">
              ${t('skills.import')}
            </button>
          ` : `
            <button class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
                    onclick="createSkill()">
              <i data-lucide="sparkles" class="w-4 h-4"></i>
              ${t('skills.generate')}
            </button>
          `}
        </div>
      </div>
    </div>
  `;

  // Add to DOM
  const modalContainer = document.createElement('div');
  modalContainer.id = 'skillCreateModal';
  modalContainer.innerHTML = modalHtml;
  document.body.appendChild(modalContainer);

  // Initialize Lucide icons
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeSkillCreateModal(event) {
  if (event && event.target !== event.currentTarget) return;
  const modal = document.getElementById('skillCreateModal');
  if (modal) modal.remove();
}

function selectSkillLocation(location) {
  skillCreateState.location = location;
  // Re-render modal
  closeSkillCreateModal();
  openSkillCreateModal();
}

function switchSkillCreateMode(mode) {
  skillCreateState.mode = mode;
  // Re-render modal
  closeSkillCreateModal();
  openSkillCreateModal();
}

function switchSkillGenerationType(type) {
  skillCreateState.generationType = type;
  // Re-render modal
  closeSkillCreateModal();
  openSkillCreateModal();
}

function browseSkillFolder() {
  // Use browser prompt for now (Phase 3 will implement file browser)
  const path = prompt(t('skills.enterFolderPath'), skillCreateState.sourcePath);
  if (path !== null) {
    skillCreateState.sourcePath = path;
    document.getElementById('skillSourcePath').value = path;
  }
}

async function validateSkillImport() {
  const sourcePathInput = document.getElementById('skillSourcePath');
  const sourcePath = sourcePathInput ? sourcePathInput.value.trim() : skillCreateState.sourcePath;

  if (!sourcePath) {
    showValidationResult({ valid: false, errors: [t('skills.sourceFolderRequired')], skillInfo: null });
    return;
  }

  skillCreateState.sourcePath = sourcePath;

  // Show loading state
  showValidationResult({ loading: true });

  try {
    const response = await fetch('/api/skills/validate-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath })
    });

    if (!response.ok) throw new Error('Validation request failed');

    const result = await response.json();
    skillCreateState.validationResult = result;
    showValidationResult(result);
  } catch (err) {
    console.error('Failed to validate skill:', err);
    showValidationResult({ valid: false, errors: [t('skills.validationError')], skillInfo: null });
  }
}

function showValidationResult(result) {
  const container = document.getElementById('skillValidationResult');
  if (!container) return;

  if (result.loading) {
    container.innerHTML = `
      <div class="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
        <i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>
        <span class="text-sm text-muted-foreground">${t('skills.validating')}</span>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  if (result.valid) {
    container.innerHTML = `
      <div class="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
        <div class="flex items-center gap-2 text-green-600 mb-2">
          <i data-lucide="check-circle" class="w-5 h-5"></i>
          <span class="font-medium">${t('skills.validSkill')}</span>
        </div>
        <div class="space-y-1 text-sm">
          <div><span class="text-muted-foreground">${t('skills.name')}:</span> <span class="font-medium">${escapeHtml(result.skillInfo.name)}</span></div>
          <div><span class="text-muted-foreground">${t('skills.description')}:</span> <span>${escapeHtml(result.skillInfo.description)}</span></div>
          ${result.skillInfo.version ? `<div><span class="text-muted-foreground">${t('skills.version')}:</span> <span>${escapeHtml(result.skillInfo.version)}</span></div>` : ''}
          ${result.skillInfo.supportingFiles && result.skillInfo.supportingFiles.length > 0 ? `<div><span class="text-muted-foreground">${t('skills.supportingFiles')}:</span> <span>${result.skillInfo.supportingFiles.length} ${t('skills.files')}</span></div>` : ''}
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
        <div class="flex items-center gap-2 text-destructive mb-2">
          <i data-lucide="x-circle" class="w-5 h-5"></i>
          <span class="font-medium">${t('skills.invalidSkill')}</span>
        </div>
        <ul class="space-y-1 text-sm">
          ${result.errors.map(error => `<li class="text-destructive">• ${escapeHtml(error)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function createSkill() {
  if (skillCreateState.mode === 'import') {
    // Import Mode Logic
    const sourcePathInput = document.getElementById('skillSourcePath');
    const customNameInput = document.getElementById('skillCustomName');

    const sourcePath = sourcePathInput ? sourcePathInput.value.trim() : skillCreateState.sourcePath;
    const customName = customNameInput ? customNameInput.value.trim() : skillCreateState.customName;

    if (!sourcePath) {
      if (window.showToast) {
        showToast(t('skills.sourceFolderRequired'), 'error');
      }
      return;
    }

    // Validate first if not already validated
    if (!skillCreateState.validationResult || !skillCreateState.validationResult.valid) {
      if (window.showToast) {
        showToast(t('skills.validateFirst'), 'error');
      }
      return;
    }

    try {
      const response = await fetch('/api/skills/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'import',
          location: skillCreateState.location,
          sourcePath,
          skillName: customName || undefined,
          projectPath
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create skill');
      }

      const result = await response.json();

      // Close modal
      closeSkillCreateModal();

      // Reload skills data
      await loadSkillsData();
      renderSkillsView();

      // Show success message
      if (window.showToast) {
        showToast(t('skills.created', { name: result.skillName }), 'success');
      }
    } catch (err) {
      console.error('Failed to create skill:', err);
      if (window.showToast) {
        showToast(err.message || t('skills.createError'), 'error');
      }
    }
  } else if (skillCreateState.mode === 'cli-generate') {
    // CLI Generate Mode Logic
    const skillNameInput = document.getElementById('skillGenerateName');
    const descriptionInput = document.getElementById('skillDescription');

    const skillName = skillNameInput ? skillNameInput.value.trim() : skillCreateState.skillName;
    const description = descriptionInput ? descriptionInput.value.trim() : skillCreateState.description;

    // Validation
    if (!skillName) {
      if (window.showToast) {
        showToast(t('skills.skillNameRequired'), 'error');
      }
      return;
    }

    if (skillCreateState.generationType === 'description' && !description) {
      if (window.showToast) {
        showToast(t('skills.descriptionRequired'), 'error');
      }
      return;
    }

    try {
      // Show generating progress toast
      if (window.showToast) {
        showToast(t('skills.generating'), 'info');
      }

      const response = await fetch('/api/skills/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'cli-generate',
          location: skillCreateState.location,
          generationType: skillCreateState.generationType,
          skillName,
          description: skillCreateState.generationType === 'description' ? description : undefined,
          projectPath
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate skill');
      }

      const result = await response.json();

      // Close modal
      closeSkillCreateModal();

      // Reload skills data
      await loadSkillsData();
      renderSkillsView();

      // Show success message
      if (window.showToast) {
        showToast(t('skills.generated', { name: result.skillName }), 'success');
      }
    } catch (err) {
      console.error('Failed to generate skill:', err);
      if (window.showToast) {
        showToast(err.message || t('skills.generateError'), 'error');
      }
    }
  }
}
