// Session Clustering visualization for Core Memory
// Dependencies: This file requires core-memory.js to be loaded first
// - Uses: viewMemoryDetail(), fetchMemoryById(), showNotification(), t(), escapeHtml(), projectPath

// Global state
var clusterList = [];
var selectedCluster = null;
var embeddingStatus = null;

/**
 * Check embedding status for better clustering
 */
async function checkEmbeddingStatus() {
  try {
    const response = await fetch(`/api/core-memory/embed-status?path=${encodeURIComponent(projectPath)}`);
    if (response.ok) {
      embeddingStatus = await response.json();
    }
  } catch (error) {
    console.log('Embedding status check skipped:', error.message);
  }
}

/**
 * Fetch and render cluster list
 */
async function loadClusters() {
  try {
    // Check embedding status first
    await checkEmbeddingStatus();

    const response = await fetch(`/api/core-memory/clusters?path=${encodeURIComponent(projectPath)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    clusterList = result.clusters || [];
    renderClusterList();
  } catch (error) {
    console.error('Failed to load clusters:', error);
    showNotification(t('coreMemory.clusterLoadError'), 'error');
  }
}

/**
 * Render embedding status hint
 */
function renderEmbeddingHint() {
  if (!embeddingStatus) {
    return `
      <div class="embedding-hint warning">
        <i data-lucide="alert-triangle"></i>
        <span>${t('coreMemory.embeddingNotAvailable')}</span>
        <a href="#" onclick="window.open('https://github.com/anthropics/claude-code', '_blank'); return false;" class="hint-link">
          ${t('coreMemory.installGuide')}
        </a>
      </div>
    `;
  }

  if (embeddingStatus.pending_chunks > 0) {
    const pct = Math.round((embeddingStatus.embedded_chunks / embeddingStatus.total_chunks) * 100);
    return `
      <div class="embedding-hint info">
        <i data-lucide="cpu"></i>
        <span>${t('coreMemory.embeddingProgress', { pct, pending: embeddingStatus.pending_chunks })}</span>
        <button class="btn btn-xs" onclick="triggerEmbedding()">
          ${t('coreMemory.generateEmbeddings')}
        </button>
      </div>
    `;
  }

  if (embeddingStatus.total_chunks === 0) {
    return `
      <div class="embedding-hint info">
        <i data-lucide="info"></i>
        <span>${t('coreMemory.noChunksYet')}</span>
      </div>
    `;
  }

  return '';
}

/**
 * Trigger embedding generation
 */
async function triggerEmbedding() {
  try {
    showNotification(t('coreMemory.embeddingInProgress'), 'info');
    const response = await fetch(`/api/core-memory/embed?path=${encodeURIComponent(projectPath)}`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    showNotification(t('coreMemory.embeddingComplete', { count: result.chunks_processed }), 'success');
    await loadClusters();
  } catch (error) {
    console.error('Embedding failed:', error);
    showNotification(t('coreMemory.embeddingError'), 'error');
  }
}

/**
 * Render cluster list in sidebar
 */
function renderClusterList() {
  const container = document.getElementById('clusterListContainer');
  if (!container) return;

  // Add embedding status hint at top
  const embeddingHint = renderEmbeddingHint();

  if (clusterList.length === 0) {
    container.innerHTML = `
      ${embeddingHint}
      <div class="empty-state">
        <i data-lucide="folder-tree"></i>
        <p>${t('coreMemory.noClusters')}</p>
        <button class="btn btn-primary btn-sm" onclick="triggerAutoClustering()">
          <i data-lucide="sparkles"></i>
          ${t('coreMemory.autoCluster')}
        </button>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = embeddingHint + clusterList.map(cluster => `
    <div class="cluster-item ${selectedCluster?.id === cluster.id ? 'active' : ''}"
         onclick="selectCluster('${cluster.id}')">
      <div class="cluster-icon">
        <i data-lucide="${cluster.status === 'active' ? 'folder-open' : 'folder'}"></i>
      </div>
      <div class="cluster-info">
        <div class="cluster-name">${escapeHtml(cluster.name)}</div>
        <div class="cluster-meta">
          <span>${cluster.memberCount} sessions</span>
          <span>${formatDate(cluster.updated_at)}</span>
        </div>
      </div>
      <span class="badge badge-${cluster.status}">${cluster.status}</span>
    </div>
  `).join('');

  lucide.createIcons();
}

/**
 * Select and load cluster details
 */
async function selectCluster(clusterId) {
  try {
    const response = await fetch(`/api/core-memory/clusters/${clusterId}?path=${encodeURIComponent(projectPath)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    selectedCluster = result.cluster;
    renderClusterDetail(result.cluster, result.members, result.relations);

    // Update list to show selection
    renderClusterList();
  } catch (error) {
    console.error('Failed to load cluster:', error);
    showNotification(t('coreMemory.clusterDetailError'), 'error');
  }
}

/**
 * Render cluster detail view
 */
function renderClusterDetail(cluster, members, relations) {
  const container = document.getElementById('clusterDetailContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="cluster-detail">
      <div class="cluster-header">
        <h3>${escapeHtml(cluster.name)}</h3>
        <div class="cluster-actions">
          <button class="btn btn-sm" onclick="editCluster('${cluster.id}')" title="${t('common.edit')}">
            <i data-lucide="edit-2"></i>
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteCluster('${cluster.id}')" title="${t('common.delete')}">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>

      ${cluster.description ? `<p class="cluster-description">${escapeHtml(cluster.description)}</p>` : ''}
      ${cluster.intent ? `<div class="cluster-intent"><strong>${t('coreMemory.intent')}:</strong> ${escapeHtml(cluster.intent)}</div>` : ''}

      <div class="cluster-timeline">
        <h4><i data-lucide="git-branch"></i> ${t('coreMemory.sessionTimeline')}</h4>
        ${renderTimeline(members)}
      </div>

      ${relations && relations.length > 0 ? `
        <div class="cluster-relations">
          <h4><i data-lucide="link"></i> ${t('coreMemory.relatedClusters')}</h4>
          ${renderRelations(relations)}
        </div>
      ` : ''}
    </div>
  `;

  lucide.createIcons();
}

/**
 * Render session timeline
 */
function renderTimeline(members) {
  if (!members || members.length === 0) {
    return `<p class="text-muted">${t('coreMemory.noSessions')}</p>`;
  }

  // Sort by sequence order
  const sorted = [...members].sort((a, b) => a.sequence_order - b.sequence_order);

  return `
    <div class="timeline">
      ${sorted.map((member, index) => {
        const meta = member.metadata || {};
        // Get display text - prefer title, fallback to summary
        const displayTitle = meta.title || meta.summary || '';
        // Truncate for display
        const truncatedTitle = displayTitle.length > 120
          ? displayTitle.substring(0, 120) + '...'
          : displayTitle;

        return `
        <div class="timeline-item">
          <div class="timeline-marker">
            <span class="timeline-number">${index + 1}</span>
          </div>
          <div class="timeline-content clickable" onclick="previewSession('${member.session_id}', '${member.session_type}')">
            <div class="timeline-header">
              <span class="session-id">${escapeHtml(member.session_id)}</span>
              <span class="badge badge-${member.session_type}">${member.session_type}</span>
            </div>
            ${truncatedTitle ? `<div class="session-title">${escapeHtml(truncatedTitle)}</div>` : ''}
            ${meta.token_estimate ? `<div class="session-tokens">~${meta.token_estimate} tokens</div>` : ''}
            <div class="timeline-card-footer">
              <span class="preview-hint"><i data-lucide="eye"></i> ${t('coreMemory.clickToPreview')}</span>
              <button class="btn btn-xs btn-ghost btn-danger" onclick="event.stopPropagation(); removeMember('${selectedCluster.id}', '${member.session_id}')" title="${t('common.delete')}">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </div>
        </div>
      `}).join('')}
    </div>
  `;
}

/**
 * Preview session in modal based on type
 */
async function previewSession(sessionId, sessionType) {
  try {
    if (sessionType === 'cli_history') {
      // Use CLI history preview modal
      if (typeof showExecutionDetail === 'function') {
        await showExecutionDetail(sessionId);
      } else {
        console.error('showExecutionDetail is not available. Make sure cli-history.js is loaded.');
        showNotification(t('coreMemory.previewError'), 'error');
      }
    } else if (sessionType === 'core_memory') {
      // Use memory preview modal
      await viewMemoryContent(sessionId);
    } else if (sessionType === 'workflow') {
      // Navigate to workflow view for now
      window.location.hash = `#workflow/${sessionId}`;
    } else {
      showNotification(t('coreMemory.unknownSessionType'), 'warning');
    }
  } catch (error) {
    console.error('Failed to preview session:', error);
    showNotification(t('coreMemory.previewError'), 'error');
  }
}

/**
 * Render cluster relations
 */
function renderRelations(relations) {
  return `
    <div class="relations-list">
      ${relations.map(rel => `
        <div class="relation-item">
          <i data-lucide="arrow-right"></i>
          <span class="relation-type">${rel.relation_type}</span>
          <a href="#" onclick="selectCluster('${rel.target_cluster_id}'); return false;">
            ${rel.target_cluster_id}
          </a>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Trigger auto-clustering
 */
async function triggerAutoClustering(scope = 'recent') {
  try {
    showNotification(t('coreMemory.clusteringInProgress'), 'info');

    const response = await fetch(`/api/core-memory/clusters/auto?path=${encodeURIComponent(projectPath)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    showNotification(
      t('coreMemory.clusteringComplete', {
        created: result.clustersCreated,
        sessions: result.sessionsClustered
      }),
      'success'
    );

    // Reload clusters
    await loadClusters();
  } catch (error) {
    console.error('Auto-clustering failed:', error);
    showNotification(t('coreMemory.clusteringError'), 'error');
  }
}

/**
 * Create new cluster
 */
async function createCluster() {
  const name = prompt(t('coreMemory.enterClusterName'));
  if (!name) return;

  try {
    const response = await fetch(`/api/core-memory/clusters?path=${encodeURIComponent(projectPath)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    showNotification(t('coreMemory.clusterCreated'), 'success');
    await loadClusters();
  } catch (error) {
    console.error('Failed to create cluster:', error);
    showNotification(t('coreMemory.clusterCreateError'), 'error');
  }
}

/**
 * Edit cluster (placeholder)
 */
function editCluster(clusterId) {
  const cluster = selectedCluster;
  if (!cluster) return;

  const newName = prompt(t('coreMemory.enterClusterName'), cluster.name);
  if (!newName || newName === cluster.name) return;

  updateCluster(clusterId, { name: newName });
}

/**
 * Update cluster
 */
async function updateCluster(clusterId, updates) {
  try {
    const response = await fetch(`/api/core-memory/clusters/${clusterId}?path=${encodeURIComponent(projectPath)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    showNotification(t('coreMemory.clusterUpdated'), 'success');
    await loadClusters();
    if (selectedCluster?.id === clusterId) {
      await selectCluster(clusterId);
    }
  } catch (error) {
    console.error('Failed to update cluster:', error);
    showNotification(t('coreMemory.clusterUpdateError'), 'error');
  }
}

/**
 * Delete cluster
 */
async function deleteCluster(clusterId) {
  if (!confirm(t('coreMemory.confirmDeleteCluster'))) return;

  try {
    const response = await fetch(`/api/core-memory/clusters/${clusterId}?path=${encodeURIComponent(projectPath)}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    showNotification(t('coreMemory.clusterDeleted'), 'success');
    selectedCluster = null;
    await loadClusters();

    // Clear detail view
    const container = document.getElementById('clusterDetailContainer');
    if (container) container.innerHTML = '';
  } catch (error) {
    console.error('Failed to delete cluster:', error);
    showNotification(t('coreMemory.clusterDeleteError'), 'error');
  }
}

/**
 * Remove member from cluster
 */
async function removeMember(clusterId, sessionId) {
  try {
    const response = await fetch(
      `/api/core-memory/clusters/${clusterId}/members/${sessionId}?path=${encodeURIComponent(projectPath)}`,
      { method: 'DELETE' }
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    showNotification(t('coreMemory.memberRemoved'), 'success');
    await selectCluster(clusterId); // Refresh detail
  } catch (error) {
    console.error('Failed to remove member:', error);
    showNotification(t('coreMemory.memberRemoveError'), 'error');
  }
}

/**
 * View memory content in modal
 * Requires: viewMemoryDetail from core-memory.js
 */
async function viewMemoryContent(memoryId) {
  try {
    // Check if required functions exist (from core-memory.js)
    if (typeof viewMemoryDetail === 'function') {
      await viewMemoryDetail(memoryId);
    } else {
      console.error('viewMemoryDetail is not available. Make sure core-memory.js is loaded.');
      showNotification(t('coreMemory.fetchError'), 'error');
    }
  } catch (error) {
    console.error('Failed to load memory content:', error);
    showNotification(t('coreMemory.fetchError'), 'error');
  }
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString();
}
