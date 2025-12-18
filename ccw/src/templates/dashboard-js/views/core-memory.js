// Core Memory View
// Manages strategic context entries with knowledge graph and evolution tracking

// Notification function
function showNotification(message, type = 'info') {
  // Create notification container if it doesn't exist
  let container = document.getElementById('notificationContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notificationContainer';
    container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px;';
    document.body.appendChild(container);
  }

  // Create notification element
  const notification = document.createElement('div');
  const bgColors = {
    success: 'hsl(var(--success))',
    error: 'hsl(var(--destructive))',
    warning: 'hsl(var(--warning))',
    info: 'hsl(var(--info))'
  };

  notification.style.cssText = `
    background: ${bgColors[type] || bgColors.info};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-width: 350px;
    animation: slideInRight 0.3s ease-out;
    font-size: 14px;
    line-height: 1.5;
  `;
  notification.textContent = message;

  // Add to container
  container.appendChild(notification);

  // Auto remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease-out';
    setTimeout(() => {
      container.removeChild(notification);
      if (container.children.length === 0) {
        document.body.removeChild(container);
      }
    }, 300);
  }, 3000);
}

// State for visualization (prefixed to avoid collision with memory.js)
var coreMemGraphSvg = null;
var coreMemGraphGroup = null;
var coreMemGraphZoom = null;
var coreMemGraphSimulation = null;

async function renderCoreMemoryView() {
  const content = document.getElementById('mainContent');
  hideStatsAndCarousel();

  // Fetch core memories
  const archived = false;
  const memories = await fetchCoreMemories(archived);

  content.innerHTML = `
    <div class="core-memory-container">
      <!-- Header Actions -->
      <div class="core-memory-header">
        <div class="header-actions">
          <button class="btn btn-primary" onclick="showCreateMemoryModal()">
            <i data-lucide="plus"></i>
            ${t('coreMemory.createNew')}
          </button>
          <button class="btn btn-secondary" onclick="toggleArchivedMemories()">
            <i data-lucide="archive"></i>
            <span id="archiveToggleText">${t('coreMemory.showArchived')}</span>
          </button>
          <button class="btn btn-secondary" onclick="refreshCoreMemories()">
            <i data-lucide="refresh-cw"></i>
            ${t('common.refresh')}
          </button>
        </div>
        <div class="memory-stats">
          <div class="stat-item">
            <span class="stat-label">${t('coreMemory.totalMemories')}</span>
            <span class="stat-value" id="totalMemoriesCount">${memories.length}</span>
          </div>
        </div>
      </div>

      <!-- Memories Grid -->
      <div class="memories-grid" id="memoriesGrid">
        ${memories.length === 0
          ? `<div class="empty-state">
               <i data-lucide="brain"></i>
               <p>${t('coreMemory.noMemories')}</p>
             </div>`
          : memories.map(memory => renderMemoryCard(memory)).join('')
        }
      </div>
    </div>

    <!-- Create/Edit Memory Modal -->
    <div id="memoryModal" class="modal-overlay" style="display: none;">
      <div class="modal-content memory-modal">
        <div class="modal-header">
          <h2 id="memoryModalTitle">${t('coreMemory.createNew')}</h2>
          <button class="modal-close" onclick="closeMemoryModal()">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>${t('coreMemory.content')}</label>
            <textarea
              id="memoryContent"
              rows="10"
              placeholder="${t('coreMemory.contentPlaceholder')}"
            ></textarea>
          </div>
          <div class="form-group">
            <label>${t('coreMemory.summary')} (${t('common.optional')})</label>
            <textarea
              id="memorySummary"
              rows="3"
              placeholder="${t('coreMemory.summaryPlaceholder')}"
            ></textarea>
          </div>
          <div class="form-group">
            <label>${t('coreMemory.metadata')} (${t('common.optional')})</label>
            <input
              type="text"
              id="memoryMetadata"
              placeholder='{"tags": ["strategy", "architecture"], "priority": "high"}'
            />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeMemoryModal()">
            ${t('common.cancel')}
          </button>
          <button class="btn btn-primary" onclick="saveMemory()">
            ${t('common.save')}
          </button>
        </div>
      </div>
    </div>

    <!-- Memory Detail Modal -->
    <div id="memoryDetailModal" class="modal-overlay" style="display: none;">
      <div class="modal-content memory-detail-modal">
        <div class="modal-header">
          <h2 id="memoryDetailTitle"></h2>
          <button class="modal-close" onclick="closeMemoryDetailModal()">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body" id="memoryDetailBody">
          <!-- Content loaded dynamically -->
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeMemoryDetailModal()">
            ${t('common.close')}
          </button>
        </div>
      </div>
    </div>
  `;

  lucide.createIcons();
}

function renderMemoryCard(memory) {
  const createdDate = new Date(memory.created_at).toLocaleString();
  const updatedDate = memory.updated_at ? new Date(memory.updated_at).toLocaleString() : createdDate;
  const isArchived = memory.archived || false;

  const metadata = memory.metadata || {};
  const tags = metadata.tags || [];
  const priority = metadata.priority || 'medium';

  return `
    <div class="memory-card ${isArchived ? 'archived' : ''}" data-memory-id="${memory.id}">
      <div class="memory-card-header">
        <div class="memory-id">
          <i data-lucide="bookmark"></i>
          <span>${memory.id}</span>
          ${isArchived ? `<span class="badge badge-archived">${t('common.archived')}</span>` : ''}
          ${priority !== 'medium' ? `<span class="badge badge-priority-${priority}">${priority}</span>` : ''}
        </div>
        <div class="memory-actions">
          <button class="icon-btn" onclick="viewMemoryDetail('${memory.id}')" title="${t('common.view')}">
            <i data-lucide="eye"></i>
          </button>
          <button class="icon-btn" onclick="editMemory('${memory.id}')" title="${t('common.edit')}">
            <i data-lucide="edit"></i>
          </button>
          ${!isArchived
            ? `<button class="icon-btn" onclick="archiveMemory('${memory.id}')" title="${t('common.archive')}">
                 <i data-lucide="archive"></i>
               </button>`
            : `<button class="icon-btn" onclick="unarchiveMemory('${memory.id}')" title="${t('coreMemory.unarchive')}">
                 <i data-lucide="archive-restore"></i>
               </button>`
          }
          <button class="icon-btn danger" onclick="deleteMemory('${memory.id}')" title="${t('common.delete')}">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>

      <div class="memory-content">
        ${memory.summary
          ? `<div class="memory-summary">${escapeHtml(memory.summary)}</div>`
          : `<div class="memory-preview">${escapeHtml(memory.content.substring(0, 200))}${memory.content.length > 200 ? '...' : ''}</div>`
        }
      </div>

      ${tags.length > 0
        ? `<div class="memory-tags">
             ${tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
           </div>`
        : ''
      }

      <div class="memory-footer">
        <div class="memory-meta">
          <span title="${t('coreMemory.created')}">
            <i data-lucide="calendar"></i>
            ${createdDate}
          </span>
          ${memory.updated_at
            ? `<span title="${t('coreMemory.updated')}">
                 <i data-lucide="clock"></i>
                 ${updatedDate}
               </span>`
            : ''
          }
        </div>
        <div class="memory-features">
          <button class="feature-btn" onclick="generateMemorySummary('${memory.id}')" title="${t('coreMemory.generateSummary')}">
            <i data-lucide="sparkles"></i>
            ${t('coreMemory.summary')}
          </button>
          <button class="feature-btn" onclick="viewKnowledgeGraph('${memory.id}')" title="${t('coreMemory.knowledgeGraph')}">
            <i data-lucide="network"></i>
            ${t('coreMemory.graph')}
          </button>
          <button class="feature-btn" onclick="viewEvolutionHistory('${memory.id}')" title="${t('coreMemory.evolution')}">
            <i data-lucide="git-branch"></i>
            ${t('coreMemory.evolution')}
          </button>
        </div>
      </div>
    </div>
  `;
}

// API Functions
async function fetchCoreMemories(archived = false) {
  try {
    const response = await fetch(`/api/core-memory/memories?path=${encodeURIComponent(projectPath)}&archived=${archived}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.memories || [];
  } catch (error) {
    console.error('Failed to fetch core memories:', error);
    showNotification(t('coreMemory.fetchError'), 'error');
    return [];
  }
}

async function fetchMemoryById(memoryId) {
  try {
    const response = await fetch(`/api/core-memory/memories/${memoryId}?path=${encodeURIComponent(projectPath)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.memory || null;
  } catch (error) {
    console.error('Failed to fetch memory:', error);
    showNotification(t('coreMemory.fetchError'), 'error');
    return null;
  }
}

// Modal Functions
function showCreateMemoryModal() {
  const modal = document.getElementById('memoryModal');
  document.getElementById('memoryModalTitle').textContent = t('coreMemory.createNew');
  document.getElementById('memoryContent').value = '';
  document.getElementById('memorySummary').value = '';
  document.getElementById('memoryMetadata').value = '';
  modal.dataset.editId = '';
  modal.style.display = 'flex';
  lucide.createIcons();
}

async function editMemory(memoryId) {
  const memory = await fetchMemoryById(memoryId);
  if (!memory) return;

  const modal = document.getElementById('memoryModal');
  document.getElementById('memoryModalTitle').textContent = t('coreMemory.edit');
  document.getElementById('memoryContent').value = memory.content || '';
  document.getElementById('memorySummary').value = memory.summary || '';
  document.getElementById('memoryMetadata').value = memory.metadata ? JSON.stringify(memory.metadata, null, 2) : '';
  modal.dataset.editId = memoryId;
  modal.style.display = 'flex';
  lucide.createIcons();
}

function closeMemoryModal() {
  document.getElementById('memoryModal').style.display = 'none';
}

async function saveMemory() {
  const modal = document.getElementById('memoryModal');
  const content = document.getElementById('memoryContent').value.trim();
  const summary = document.getElementById('memorySummary').value.trim();
  const metadataStr = document.getElementById('memoryMetadata').value.trim();

  if (!content) {
    showNotification(t('coreMemory.contentRequired'), 'error');
    return;
  }

  let metadata = {};
  if (metadataStr) {
    try {
      metadata = JSON.parse(metadataStr);
    } catch (e) {
      showNotification(t('coreMemory.invalidMetadata'), 'error');
      return;
    }
  }

  const payload = {
    content,
    summary: summary || undefined,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    path: projectPath
  };

  const editId = modal.dataset.editId;
  if (editId) {
    payload.id = editId;
  }

  try {
    const response = await fetch('/api/core-memory/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    showNotification(editId ? t('coreMemory.updated') : t('coreMemory.created'), 'success');
    closeMemoryModal();
    await refreshCoreMemories();
  } catch (error) {
    console.error('Failed to save memory:', error);
    showNotification(t('coreMemory.saveError'), 'error');
  }
}

async function archiveMemory(memoryId) {
  if (!confirm(t('coreMemory.confirmArchive'))) return;

  try {
    const response = await fetch(`/api/core-memory/memories/${memoryId}/archive?path=${encodeURIComponent(projectPath)}`, {
      method: 'POST'
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    showNotification(t('coreMemory.archived'), 'success');
    await refreshCoreMemories();
  } catch (error) {
    console.error('Failed to archive memory:', error);
    showNotification(t('coreMemory.archiveError'), 'error');
  }
}

async function unarchiveMemory(memoryId) {
  try {
    const memory = await fetchMemoryById(memoryId);
    if (!memory) return;

    memory.archived = false;

    const response = await fetch('/api/core-memory/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...memory, path: projectPath })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    showNotification(t('coreMemory.unarchived'), 'success');
    await refreshCoreMemories();
  } catch (error) {
    console.error('Failed to unarchive memory:', error);
    showNotification(t('coreMemory.unarchiveError'), 'error');
  }
}

async function deleteMemory(memoryId) {
  if (!confirm(t('coreMemory.confirmDelete'))) return;

  try {
    const response = await fetch(`/api/core-memory/memories/${memoryId}?path=${encodeURIComponent(projectPath)}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    showNotification(t('coreMemory.deleted'), 'success');
    await refreshCoreMemories();
  } catch (error) {
    console.error('Failed to delete memory:', error);
    showNotification(t('coreMemory.deleteError'), 'error');
  }
}

// Feature Functions
async function generateMemorySummary(memoryId) {
  try {
    showNotification(t('coreMemory.generatingSummary'), 'info');

    const response = await fetch(`/api/core-memory/memories/${memoryId}/summary?path=${encodeURIComponent(projectPath)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'gemini' })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    showNotification(t('coreMemory.summaryGenerated'), 'success');

    // Show summary in detail modal
    await viewMemoryDetail(memoryId);
  } catch (error) {
    console.error('Failed to generate summary:', error);
    showNotification(t('coreMemory.summaryError'), 'error');
  }
}

async function viewKnowledgeGraph(memoryId) {
  try {
    const response = await fetch(`/api/core-memory/memories/${memoryId}/knowledge-graph?path=${encodeURIComponent(projectPath)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const graph = await response.json();

    const modal = document.getElementById('memoryDetailModal');
    document.getElementById('memoryDetailTitle').textContent = `${t('coreMemory.knowledgeGraph')} - ${memoryId}`;

    const body = document.getElementById('memoryDetailBody');
    body.innerHTML = `
      <div class="knowledge-graph">
        <div class="graph-section">
          <h3>${t('coreMemory.entities')}</h3>
          <div class="entities-list">
            ${graph.entities && graph.entities.length > 0
              ? graph.entities.map(entity => `
                  <div class="entity-item">
                    <span class="entity-name">${escapeHtml(entity.name)}</span>
                    <span class="entity-type">${escapeHtml(entity.type)}</span>
                  </div>
                `).join('')
              : `<p class="empty-text">${t('coreMemory.noEntities')}</p>`
            }
          </div>
        </div>

        <div class="graph-section">
          <h3>${t('coreMemory.relationships')}</h3>
          <div class="relationships-list">
            ${graph.relationships && graph.relationships.length > 0
              ? graph.relationships.map(rel => `
                  <div class="relationship-item">
                    <span class="rel-source">${escapeHtml(rel.source)}</span>
                    <span class="rel-type">${escapeHtml(rel.type)}</span>
                    <span class="rel-target">${escapeHtml(rel.target)}</span>
                  </div>
                `).join('')
              : `<p class="empty-text">${t('coreMemory.noRelationships')}</p>`
            }
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
    lucide.createIcons();
  } catch (error) {
    console.error('Failed to fetch knowledge graph:', error);
    showNotification(t('coreMemory.graphError'), 'error');
  }
}

async function viewEvolutionHistory(memoryId) {
  try {
    const response = await fetch(`/api/core-memory/memories/${memoryId}/evolution?path=${encodeURIComponent(projectPath)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const versions = await response.json();

    const modal = document.getElementById('memoryDetailModal');
    document.getElementById('memoryDetailTitle').textContent = `${t('coreMemory.evolutionHistory')} - ${memoryId}`;

    const body = document.getElementById('memoryDetailBody');
    body.innerHTML = `
      <div class="evolution-timeline">
        ${versions && versions.length > 0
          ? versions.map((version, index) => `
              <div class="evolution-version">
                <div class="version-header">
                  <span class="version-number">v${version.version}</span>
                  <span class="version-date">${new Date(version.timestamp).toLocaleString()}</span>
                </div>
                <div class="version-reason">${escapeHtml(version.reason || t('coreMemory.noReason'))}</div>
                ${index === 0 ? `<span class="badge badge-current">${t('coreMemory.current')}</span>` : ''}
              </div>
            `).join('')
          : `<p class="empty-text">${t('coreMemory.noHistory')}</p>`
        }
      </div>
    `;

    modal.style.display = 'flex';
    lucide.createIcons();
  } catch (error) {
    console.error('Failed to fetch evolution history:', error);
    showNotification(t('coreMemory.evolutionError'), 'error');
  }
}

async function viewMemoryDetail(memoryId) {
  const memory = await fetchMemoryById(memoryId);
  if (!memory) return;

  const modal = document.getElementById('memoryDetailModal');
  document.getElementById('memoryDetailTitle').textContent = memory.id;

  const body = document.getElementById('memoryDetailBody');
  body.innerHTML = `
    <div class="memory-detail-content">
      ${memory.summary
        ? `<div class="detail-section">
             <h3>${t('coreMemory.summary')}</h3>
             <div class="detail-text">${escapeHtml(memory.summary)}</div>
           </div>`
        : ''
      }

      <div class="detail-section">
        <h3>${t('coreMemory.content')}</h3>
        <pre class="detail-code">${escapeHtml(memory.content)}</pre>
      </div>

      ${memory.metadata && Object.keys(memory.metadata).length > 0
        ? `<div class="detail-section">
             <h3>${t('coreMemory.metadata')}</h3>
             <pre class="detail-code">${escapeHtml(JSON.stringify(memory.metadata, null, 2))}</pre>
           </div>`
        : ''
      }

      ${memory.raw_output
        ? `<div class="detail-section">
             <h3>${t('coreMemory.rawOutput')}</h3>
             <pre class="detail-code">${escapeHtml(memory.raw_output)}</pre>
           </div>`
        : ''
      }
    </div>
  `;

  modal.style.display = 'flex';
  lucide.createIcons();
}

function closeMemoryDetailModal() {
  document.getElementById('memoryDetailModal').style.display = 'none';
}

let showingArchivedMemories = false;

async function toggleArchivedMemories() {
  showingArchivedMemories = !showingArchivedMemories;
  const toggleText = document.getElementById('archiveToggleText');
  toggleText.textContent = showingArchivedMemories
    ? t('coreMemory.showActive')
    : t('coreMemory.showArchived');

  await refreshCoreMemories();
}

async function refreshCoreMemories() {
  const memories = await fetchCoreMemories(showingArchivedMemories);

  const grid = document.getElementById('memoriesGrid');
  const countEl = document.getElementById('totalMemoriesCount');

  if (countEl) countEl.textContent = memories.length;

  if (memories.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <i data-lucide="brain"></i>
        <p>${showingArchivedMemories ? t('coreMemory.noArchivedMemories') : t('coreMemory.noMemories')}</p>
      </div>
    `;
  } else {
    grid.innerHTML = memories.map(memory => renderMemoryCard(memory)).join('');
  }

  lucide.createIcons();
}

// Utility Functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
