// ==========================================
// STORAGE MANAGER COMPONENT
// ==========================================
// Manages CCW centralized storage (~/.ccw/)

// State
let storageData = null;
let storageLoading = false;

/**
 * Initialize storage manager
 */
async function initStorageManager() {
  await loadStorageStats();
}

/**
 * Load storage statistics from API
 */
async function loadStorageStats() {
  if (storageLoading) return;
  storageLoading = true;

  try {
    const res = await fetch('/api/storage/stats');
    if (!res.ok) throw new Error('Failed to load storage stats');
    storageData = await res.json();
    renderStorageCard();
  } catch (err) {
    console.error('Failed to load storage stats:', err);
    renderStorageCardError(err.message);
  } finally {
    storageLoading = false;
  }
}

/**
 * Render storage card in the dashboard
 */
function renderStorageCard() {
  const container = document.getElementById('storageCard');
  if (!container || !storageData) return;

  const { location, totalSizeFormatted, projectCount, projects } = storageData;

  // Format relative time
  const formatTimeAgo = (isoString) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return diffMins + 'm ago';
    if (diffHours < 24) return diffHours + 'h ago';
    if (diffDays < 30) return diffDays + 'd ago';
    return date.toLocaleDateString();
  };

  // Build project rows
  let projectRows = '';
  if (projects && projects.length > 0) {
    projects.slice(0, 5).forEach(p => {
      const historyBadge = p.historyRecords > 0
        ? '<span class="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded">' + p.historyRecords + '</span>'
        : '<span class="text-xs text-muted-foreground">-</span>';

      projectRows += '\
        <tr class="border-b border-border/50 hover:bg-muted/30">\
          <td class="py-2 px-2 font-mono text-xs text-muted-foreground">' + escapeHtml(p.id.substring(0, 8)) + '...</td>\
          <td class="py-2 px-2 text-sm text-right">' + escapeHtml(p.totalSizeFormatted) + '</td>\
          <td class="py-2 px-2 text-center">' + historyBadge + '</td>\
          <td class="py-2 px-2 text-xs text-muted-foreground text-right">' + formatTimeAgo(p.lastModified) + '</td>\
          <td class="py-2 px-1 text-right">\
            <button onclick="cleanProjectStorage(\'' + escapeHtml(p.id) + '\')" \
                    class="text-xs px-2 py-1 text-destructive hover:bg-destructive/10 rounded transition-colors" \
                    title="Clean this project storage">\
              <i data-lucide="trash-2" class="w-3 h-3"></i>\
            </button>\
          </td>\
        </tr>\
      ';
    });

    if (projects.length > 5) {
      projectRows += '\
        <tr>\
          <td colspan="5" class="py-2 px-2 text-xs text-muted-foreground text-center">\
            ... and ' + (projects.length - 5) + ' more projects\
          </td>\
        </tr>\
      ';
    }
  } else {
    projectRows = '\
      <tr>\
        <td colspan="5" class="py-4 text-center text-muted-foreground text-sm">No storage data yet</td>\
      </tr>\
    ';
  }

  container.innerHTML = '\
    <div class="bg-card border border-border rounded-lg overflow-hidden">\
      <div class="bg-muted/30 border-b border-border px-4 py-3 flex items-center justify-between">\
        <div class="flex items-center gap-2">\
          <i data-lucide="hard-drive" class="w-4 h-4 text-primary"></i>\
          <span class="font-medium text-foreground">Storage Manager</span>\
          <span class="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">' + totalSizeFormatted + '</span>\
        </div>\
        <div class="flex items-center gap-2">\
          <button onclick="loadStorageStats()" class="text-xs px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors" title="Refresh">\
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>\
          </button>\
          <button onclick="showStorageConfig()" class="text-xs px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors" title="Settings">\
            <i data-lucide="settings" class="w-3.5 h-3.5"></i>\
          </button>\
        </div>\
      </div>\
      <div class="p-4">\
        <div class="flex items-center gap-2 mb-3 text-xs text-muted-foreground">\
          <i data-lucide="folder" class="w-3.5 h-3.5"></i>\
          <span class="font-mono truncate" title="' + escapeHtml(location) + '">' + escapeHtml(location) + '</span>\
        </div>\
        <div class="grid grid-cols-3 gap-3 mb-4">\
          <div class="bg-muted/30 rounded-lg p-3 text-center">\
            <div class="text-lg font-semibold text-foreground">' + projectCount + '</div>\
            <div class="text-xs text-muted-foreground">Projects</div>\
          </div>\
          <div class="bg-muted/30 rounded-lg p-3 text-center">\
            <div class="text-lg font-semibold text-foreground">' + totalSizeFormatted + '</div>\
            <div class="text-xs text-muted-foreground">Total Size</div>\
          </div>\
          <div class="bg-muted/30 rounded-lg p-3 text-center">\
            <div class="text-lg font-semibold text-foreground">' + getTotalRecords() + '</div>\
            <div class="text-xs text-muted-foreground">Records</div>\
          </div>\
        </div>\
        <div class="border border-border rounded-lg overflow-hidden">\
          <table class="w-full text-sm">\
            <thead class="bg-muted/50">\
              <tr class="text-xs text-muted-foreground">\
                <th class="py-2 px-2 text-left font-medium">Project ID</th>\
                <th class="py-2 px-2 text-right font-medium">Size</th>\
                <th class="py-2 px-2 text-center font-medium">History</th>\
                <th class="py-2 px-2 text-right font-medium">Last Used</th>\
                <th class="py-2 px-1 w-8"></th>\
              </tr>\
            </thead>\
            <tbody>\
              ' + projectRows + '\
            </tbody>\
          </table>\
        </div>\
        <div class="mt-4 flex justify-end gap-2">\
          <button onclick="cleanAllStorageConfirm()" \
                  class="text-xs px-3 py-1.5 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded transition-colors flex items-center gap-1.5">\
            <i data-lucide="trash" class="w-3.5 h-3.5"></i>\
            Clean All\
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
 * Get total records across all projects
 */
function getTotalRecords() {
  if (!storageData || !storageData.projects) return 0;
  return storageData.projects.reduce((sum, p) => sum + (p.historyRecords || 0), 0);
}

/**
 * Render error state for storage card
 */
function renderStorageCardError(message) {
  const container = document.getElementById('storageCard');
  if (!container) return;

  container.innerHTML = '\
    <div class="bg-card border border-border rounded-lg overflow-hidden">\
      <div class="bg-muted/30 border-b border-border px-4 py-3 flex items-center gap-2">\
        <i data-lucide="hard-drive" class="w-4 h-4 text-primary"></i>\
        <span class="font-medium text-foreground">Storage Manager</span>\
      </div>\
      <div class="p-4 text-center">\
        <div class="text-destructive mb-2">\
          <i data-lucide="alert-circle" class="w-8 h-8 mx-auto"></i>\
        </div>\
        <p class="text-sm text-muted-foreground mb-3">' + escapeHtml(message) + '</p>\
        <button onclick="loadStorageStats()" class="text-xs px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded transition-colors">\
          Retry\
        </button>\
      </div>\
    </div>\
  ';

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/**
 * Show storage configuration modal
 */
function showStorageConfig() {
  const content = '\
# Storage Configuration\n\
\n\
## Current Location\n\
\n\
```\n\
' + (storageData?.location || '~/.ccw') + '\n\
```\n\
\n\
## Change Storage Location\n\
\n\
Set the `CCW_DATA_DIR` environment variable to change the storage location:\n\
\n\
### Windows (PowerShell)\n\
```powershell\n\
$env:CCW_DATA_DIR = "D:\\custom\\ccw-data"\n\
```\n\
\n\
### Windows (Command Prompt)\n\
```cmd\n\
set CCW_DATA_DIR=D:\\custom\\ccw-data\n\
```\n\
\n\
### Linux/macOS\n\
```bash\n\
export CCW_DATA_DIR="/custom/ccw-data"\n\
```\n\
\n\
### Permanent (add to shell profile)\n\
```bash\n\
echo \'export CCW_DATA_DIR="/custom/ccw-data"\' >> ~/.bashrc\n\
```\n\
\n\
> **Note:** Existing data will NOT be migrated automatically.\n\
> Manually copy the contents of the old directory to the new location.\n\
\n\
## CLI Commands\n\
\n\
```bash\n\
# Show storage info\n\
ccw cli storage\n\
\n\
# Clean all storage\n\
ccw cli storage clean --force\n\
\n\
# Clean specific project\n\
ccw cli storage clean --project . --force\n\
```\n\
';

  openMarkdownModal('Storage Configuration', content, 'markdown');
}

/**
 * Clean storage for a specific project
 */
async function cleanProjectStorage(projectId) {
  const project = storageData?.projects?.find(p => p.id === projectId);
  const sizeInfo = project ? ' (' + project.totalSizeFormatted + ')' : '';

  if (!confirm('Delete storage for project ' + projectId.substring(0, 8) + '...' + sizeInfo + '?\n\nThis will remove CLI history, memory, and cache for this project.')) {
    return;
  }

  try {
    const res = await fetch('/api/storage/clean', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId })
    });

    const result = await res.json();

    if (result.success) {
      addGlobalNotification('success', 'Storage Cleaned', 'Freed ' + result.freedFormatted, 'storage');
      await loadStorageStats();
    } else {
      throw new Error(result.error || 'Failed to clean storage');
    }
  } catch (err) {
    addGlobalNotification('error', 'Clean Failed', err.message, 'storage');
  }
}

/**
 * Confirm and clean all storage
 */
async function cleanAllStorageConfirm() {
  const totalSize = storageData?.totalSizeFormatted || 'unknown';
  const projectCount = storageData?.projectCount || 0;

  if (!confirm('Delete ALL CCW storage?\n\nThis will remove:\n- ' + projectCount + ' projects\n- ' + totalSize + ' of data\n\nThis action cannot be undone!')) {
    return;
  }

  // Double confirm for safety
  if (!confirm('Are you SURE? This will delete all CLI history, memory stores, and caches.')) {
    return;
  }

  try {
    const res = await fetch('/api/storage/clean', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true })
    });

    const result = await res.json();

    if (result.success) {
      addGlobalNotification('success', 'All Storage Cleaned', 'Cleaned ' + result.projectsCleaned + ' projects, freed ' + result.freedFormatted, 'storage');
      await loadStorageStats();
    } else {
      throw new Error(result.error || 'Failed to clean storage');
    }
  } catch (err) {
    addGlobalNotification('error', 'Clean Failed', err.message, 'storage');
  }
}

/**
 * Get storage data (for external use)
 */
function getStorageData() {
  return storageData;
}
