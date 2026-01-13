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

  // Build project tree (hierarchical view)
  let projectRows = '';
  if (projects && projects.length > 0) {
    const tree = buildProjectTree(projects);
    projectRows = renderProjectTree(tree, 0, formatTimeAgo);

    // Initially hide all child rows (level > 0)
    setTimeout(() => {
      const allRows = document.querySelectorAll('.project-row');
      allRows.forEach(row => {
        const level = parseInt(row.getAttribute('data-level'));
        if (level > 0) {
          row.style.display = 'none';
        }
      });
    }, 0);
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
 * Build project tree from flat list
 * Converts flat project list to hierarchical tree structure
 */
function buildProjectTree(projects) {
  const tree = [];
  const map = new Map();

  // Sort by path depth (shallowest first)
  const sorted = projects.slice().sort((a, b) => {
    const depthA = (a.id.match(/\//g) || []).length;
    const depthB = (b.id.match(/\//g) || []).length;
    return depthA - depthB;
  });

  for (const project of sorted) {
    const segments = project.id.split('/');

    if (segments.length === 1) {
      // Root level project
      const node = {
        ...project,
        children: [],
        isExpanded: false
      };
      tree.push(node);
      map.set(project.id, node);
    } else {
      // Sub-project
      const parentId = segments.slice(0, -1).join('/');
      const parent = map.get(parentId);

      if (parent) {
        const node = {
          ...project,
          children: [],
          isExpanded: false
        };
        parent.children.push(node);
        map.set(project.id, node);
      } else {
        // Orphaned project (parent not found) - add to root
        const node = {
          ...project,
          children: [],
          isExpanded: false
        };
        tree.push(node);
        map.set(project.id, node);
      }
    }
  }

  return tree;
}

/**
 * Render project tree recursively
 */
function renderProjectTree(tree, level = 0, formatTimeAgo) {
  if (!tree || tree.length === 0) return '';

  let html = '';

  for (const node of tree) {
    const hasChildren = node.children && node.children.length > 0;
    const indent = level * 20;
    const projectName = node.id.split('/').pop();

    const historyBadge = node.historyRecords > 0
      ? '<span class="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded">' + node.historyRecords + '</span>'
      : '<span class="text-xs text-muted-foreground">-</span>';

    const toggleIcon = hasChildren
      ? '<i data-lucide="chevron-right" class="w-3 h-3 transition-transform duration-200 toggle-icon"></i>'
      : '<span class="w-3 h-3 inline-block"></span>';

    html += '\
      <tr class="border-b border-border/50 hover:bg-muted/30 project-row" data-project-id="' + escapeHtml(node.id) + '" data-level="' + level + '">\
        <td class="py-2 px-2 font-mono text-xs text-muted-foreground">\
          <div class="flex items-center gap-1" style="padding-left: ' + indent + 'px">\
            ' + (hasChildren ? '<button class="toggle-btn hover:bg-muted/50 rounded p-0.5" onclick="toggleProjectNode(\'' + escapeHtml(node.id) + '\')">' + toggleIcon + '</button>' : '<span class="w-3 h-3 inline-block"></span>') + '\
            <span class="truncate max-w-[150px]" title="' + escapeHtml(node.id) + '">' + escapeHtml(projectName) + '</span>\
          </div>\
        </td>\
        <td class="py-2 px-2 text-sm text-right">' + escapeHtml(node.totalSizeFormatted) + '</td>\
        <td class="py-2 px-2 text-center">' + historyBadge + '</td>\
        <td class="py-2 px-2 text-xs text-muted-foreground text-right">' + formatTimeAgo(node.lastModified) + '</td>\
        <td class="py-2 px-1 text-right">\
          <button onclick="cleanProjectStorage(\'' + escapeHtml(node.id) + '\')" \
                  class="text-xs px-2 py-1 text-destructive hover:bg-destructive/10 rounded transition-colors" \
                  title="Clean this project storage">\
            <i data-lucide="trash-2" class="w-3 h-3"></i>\
          </button>\
        </td>\
      </tr>\
    ';

    // Render children (initially hidden)
    if (hasChildren) {
      html += renderProjectTree(node.children, level + 1, formatTimeAgo);
    }
  }

  return html;
}

/**
 * Toggle project node expansion
 */
function toggleProjectNode(projectId) {
  const row = document.querySelector('[data-project-id="' + projectId + '"]');
  if (!row) return;

  const icon = row.querySelector('.toggle-icon');
  const level = parseInt(row.getAttribute('data-level'));

  // Find all child rows
  let nextRow = row.nextElementSibling;
  const childRows = [];

  while (nextRow && nextRow.classList.contains('project-row')) {
    const nextLevel = parseInt(nextRow.getAttribute('data-level'));
    if (nextLevel <= level) break;
    childRows.push(nextRow);
    nextRow = nextRow.nextElementSibling;
  }

  // Toggle visibility
  const isExpanded = row.classList.contains('expanded');

  if (isExpanded) {
    // Collapse
    row.classList.remove('expanded');
    if (icon) icon.style.transform = 'rotate(0deg)';
    childRows.forEach(child => {
      child.style.display = 'none';
    });
  } else {
    // Expand (only immediate children)
    row.classList.add('expanded');
    if (icon) icon.style.transform = 'rotate(90deg)';
    childRows.forEach(child => {
      const childLevel = parseInt(child.getAttribute('data-level'));
      if (childLevel === level + 1) {
        child.style.display = '';
      }
    });
  }

  // Reinitialize Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
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
    const res = await csrfFetch('/api/storage/clean', {
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
    const res = await csrfFetch('/api/storage/clean', {
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
