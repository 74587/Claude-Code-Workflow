// ==========================================
// INDEX MANAGER COMPONENT
// ==========================================
// Manages CodexLens code indexes (vector and normal)

// State
let indexData = null;
let indexLoading = false;

/**
 * Initialize index manager
 */
async function initIndexManager() {
  await loadIndexStats();
}

/**
 * Load index statistics from API
 */
async function loadIndexStats() {
  if (indexLoading) return;
  indexLoading = true;

  try {
    const res = await fetch('/api/codexlens/indexes');
    if (!res.ok) throw new Error('Failed to load index stats');
    indexData = await res.json();
    renderIndexCard();
  } catch (err) {
    console.error('Failed to load index stats:', err);
    renderIndexCardError(err.message);
  } finally {
    indexLoading = false;
  }
}

/**
 * Render index card in the dashboard
 */
function renderIndexCard() {
  const container = document.getElementById('indexCard');
  if (!container || !indexData) return;

  const { indexDir, indexes, summary } = indexData;

  // Format relative time
  const formatTimeAgo = (isoString) => {
    if (!isoString) return t('common.never') || 'Never';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return t('common.justNow') || 'Just now';
    if (diffMins < 60) return diffMins + 'm ' + (t('common.ago') || 'ago');
    if (diffHours < 24) return diffHours + 'h ' + (t('common.ago') || 'ago');
    if (diffDays < 30) return diffDays + 'd ' + (t('common.ago') || 'ago');
    return date.toLocaleDateString();
  };

  // Build index rows
  let indexRows = '';
  if (indexes && indexes.length > 0) {
    indexes.forEach(function(idx) {
      const vectorBadge = idx.hasVectorIndex
        ? '<span class="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded">' + (t('index.vector') || 'Vector') + '</span>'
        : '';
      const normalBadge = idx.hasNormalIndex
        ? '<span class="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded">' + (t('index.fts') || 'FTS') + '</span>'
        : '';

      indexRows += '\
        <tr class="border-t border-border hover:bg-muted/30 transition-colors">\
          <td class="py-2 px-2 text-foreground">\
            <div class="flex items-center gap-2">\
              <span class="font-mono text-xs truncate max-w-[250px]" title="' + escapeHtml(idx.id) + '">' + escapeHtml(idx.id) + '</span>\
            </div>\
          </td>\
          <td class="py-2 px-2 text-right text-muted-foreground">' + idx.sizeFormatted + '</td>\
          <td class="py-2 px-2 text-center">\
            <div class="flex items-center justify-center gap-1">' + vectorBadge + normalBadge + '</div>\
          </td>\
          <td class="py-2 px-2 text-right text-muted-foreground">' + formatTimeAgo(idx.lastModified) + '</td>\
          <td class="py-2 px-1 text-center">\
            <button onclick="cleanIndexProject(\'' + escapeHtml(idx.id) + '\')" \
                    class="text-destructive/70 hover:text-destructive p-1 rounded hover:bg-destructive/10 transition-colors" \
                    title="' + (t('index.cleanProject') || 'Clean Index') + '">\
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>\
            </button>\
          </td>\
        </tr>\
      ';
    });
  } else {
    indexRows = '\
      <tr>\
        <td colspan="5" class="py-4 text-center text-muted-foreground text-sm">' + (t('index.noIndexes') || 'No indexes yet') + '</td>\
      </tr>\
    ';
  }

  container.innerHTML = '\
    <div class="bg-card border border-border rounded-lg overflow-hidden">\
      <div class="bg-muted/30 border-b border-border px-4 py-3 flex items-center justify-between">\
        <div class="flex items-center gap-2">\
          <i data-lucide="database" class="w-4 h-4 text-primary"></i>\
          <span class="font-medium text-foreground">' + (t('index.manager') || 'Index Manager') + '</span>\
          <span class="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">' + (summary?.totalSizeFormatted || '0 B') + '</span>\
        </div>\
        <div class="flex items-center gap-2">\
          <button onclick="loadIndexStats()" class="text-xs px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors" title="' + (t('common.refresh') || 'Refresh') + '">\
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>\
          </button>\
          <button onclick="showCodexLensConfigModal()" class="text-xs px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors" title="' + (t('common.settings') || 'Settings') + '">\
            <i data-lucide="settings" class="w-3.5 h-3.5"></i>\
          </button>\
        </div>\
      </div>\
      <div class="p-4">\
        <div class="flex items-center gap-2 mb-3 text-xs text-muted-foreground">\
          <i data-lucide="folder" class="w-3.5 h-3.5"></i>\
          <span class="font-mono truncate" title="' + escapeHtml(indexDir || '') + '">' + escapeHtml(indexDir || t('index.notConfigured') || 'Not configured') + '</span>\
        </div>\
        <div class="grid grid-cols-4 gap-3 mb-4">\
          <div class="bg-muted/30 rounded-lg p-3 text-center">\
            <div class="text-lg font-semibold text-foreground">' + (summary?.totalProjects || 0) + '</div>\
            <div class="text-xs text-muted-foreground">' + (t('index.projects') || 'Projects') + '</div>\
          </div>\
          <div class="bg-muted/30 rounded-lg p-3 text-center">\
            <div class="text-lg font-semibold text-foreground">' + (summary?.totalSizeFormatted || '0 B') + '</div>\
            <div class="text-xs text-muted-foreground">' + (t('index.totalSize') || 'Total Size') + '</div>\
          </div>\
          <div class="bg-muted/30 rounded-lg p-3 text-center">\
            <div class="text-lg font-semibold text-foreground">' + (summary?.vectorIndexCount || 0) + '</div>\
            <div class="text-xs text-muted-foreground">' + (t('index.vectorIndexes') || 'Vector') + '</div>\
          </div>\
          <div class="bg-muted/30 rounded-lg p-3 text-center">\
            <div class="text-lg font-semibold text-foreground">' + (summary?.normalIndexCount || 0) + '</div>\
            <div class="text-xs text-muted-foreground">' + (t('index.ftsIndexes') || 'FTS') + '</div>\
          </div>\
        </div>\
        <div class="border border-border rounded-lg overflow-hidden">\
          <table class="w-full text-sm">\
            <thead class="bg-muted/50">\
              <tr class="text-xs text-muted-foreground">\
                <th class="py-2 px-2 text-left font-medium">' + (t('index.projectId') || 'Project ID') + '</th>\
                <th class="py-2 px-2 text-right font-medium">' + (t('index.size') || 'Size') + '</th>\
                <th class="py-2 px-2 text-center font-medium">' + (t('index.type') || 'Type') + '</th>\
                <th class="py-2 px-2 text-right font-medium">' + (t('index.lastModified') || 'Modified') + '</th>\
                <th class="py-2 px-1 w-8"></th>\
              </tr>\
            </thead>\
            <tbody>\
              ' + indexRows + '\
            </tbody>\
          </table>\
        </div>\
        <div class="mt-4 flex justify-between items-center gap-2">\
          <button onclick="initCodexLensIndex()" \
                  class="text-xs px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded transition-colors flex items-center gap-1.5">\
            <i data-lucide="database" class="w-3.5 h-3.5"></i>\
            ' + (t('index.initCurrent') || 'Init Current Project') + '\
          </button>\
          <button onclick="cleanAllIndexesConfirm()" \
                  class="text-xs px-3 py-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded transition-colors flex items-center gap-1.5">\
            <i data-lucide="trash" class="w-3.5 h-3.5"></i>\
            ' + (t('index.cleanAll') || 'Clean All') + '\
          </button>\
        </div>\
      </div>\
    </div>\
  ';

  // Reinitialize Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/**
 * Render error state for index card
 */
function renderIndexCardError(errorMessage) {
  const container = document.getElementById('indexCard');
  if (!container) return;

  container.innerHTML = '\
    <div class="bg-card border border-border rounded-lg overflow-hidden">\
      <div class="bg-muted/30 border-b border-border px-4 py-3 flex items-center gap-2">\
        <i data-lucide="database" class="w-4 h-4 text-primary"></i>\
        <span class="font-medium text-foreground">' + (t('index.manager') || 'Index Manager') + '</span>\
      </div>\
      <div class="p-4 text-center">\
        <div class="text-destructive mb-2">\
          <i data-lucide="alert-circle" class="w-8 h-8 mx-auto"></i>\
        </div>\
        <p class="text-sm text-muted-foreground mb-3">' + escapeHtml(errorMessage) + '</p>\
        <button onclick="loadIndexStats()" \
                class="text-xs px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded transition-colors">\
          ' + (t('common.retry') || 'Retry') + '\
        </button>\
      </div>\
    </div>\
  ';

  // Reinitialize Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/**
 * Clean a specific project's index
 */
async function cleanIndexProject(projectId) {
  if (!confirm((t('index.cleanProjectConfirm') || 'Clean index for') + ' ' + projectId + '?')) {
    return;
  }

  try {
    showRefreshToast(t('index.cleaning') || 'Cleaning index...', 'info');

    // The project ID is the directory name in the index folder
    // We need to construct the full path or use a clean API
    const response = await fetch('/api/codexlens/clean', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: projectId })
    });

    const result = await response.json();

    if (result.success) {
      showRefreshToast(t('index.cleanSuccess') || 'Index cleaned successfully', 'success');
      await loadIndexStats();
    } else {
      showRefreshToast((t('index.cleanFailed') || 'Clean failed') + ': ' + result.error, 'error');
    }
  } catch (err) {
    showRefreshToast((t('common.error') || 'Error') + ': ' + err.message, 'error');
  }
}

/**
 * Confirm and clean all indexes
 */
async function cleanAllIndexesConfirm() {
  if (!confirm(t('index.cleanAllConfirm') || 'Are you sure you want to clean ALL indexes? This cannot be undone.')) {
    return;
  }

  try {
    showRefreshToast(t('index.cleaning') || 'Cleaning indexes...', 'info');

    const response = await fetch('/api/codexlens/clean', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true })
    });

    const result = await response.json();

    if (result.success) {
      showRefreshToast(t('index.cleanAllSuccess') || 'All indexes cleaned', 'success');
      await loadIndexStats();
    } else {
      showRefreshToast((t('index.cleanFailed') || 'Clean failed') + ': ' + result.error, 'error');
    }
  } catch (err) {
    showRefreshToast((t('common.error') || 'Error') + ': ' + err.message, 'error');
  }
}
