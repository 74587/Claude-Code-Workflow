// ============================================
// EXPLORER VIEW
// ============================================
// File tree browser with .gitignore filtering and CLAUDE.md update support
// Split-panel layout: file tree (left) + preview (right)

// Explorer state
let explorerCurrentPath = null;
let explorerSelectedFile = null;
let explorerExpandedDirs = new Set();

// Task queue for CLAUDE.md updates
let updateTaskQueue = [];
let isTaskQueueVisible = false;
let isTaskRunning = false;
// Note: defaultCliTool is defined in components/cli-status.js


/**
 * Safe base64 encode that handles Unicode characters
 * Returns alphanumeric-only string suitable for HTML IDs
 */
function safeBase64Encode(str) {
  try {
    // Encode Unicode string to UTF-8 bytes, then to base64
    const encoded = btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))));
    return encoded.replace(/[^a-zA-Z0-9]/g, '');
  } catch (e) {
    // Fallback: use simple hash if encoding fails
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'path' + Math.abs(hash).toString(36);
  }
}

/**
 * Render the Explorer view
 */
async function renderExplorer() {
  const container = document.getElementById('mainContent');
  if (!container) return;

  // Hide stats grid and search
  const statsGrid = document.getElementById('statsGrid');
  const searchInput = document.getElementById('searchInput');
  if (statsGrid) statsGrid.style.display = 'none';
  if (searchInput) searchInput.parentElement.style.display = 'none';

  // Initialize explorer path to project path
  explorerCurrentPath = projectPath;

  container.innerHTML = `
    <div class="explorer-container">
      <!-- Left Panel: File Tree -->
      <div class="explorer-tree-panel">
        <div class="explorer-tree-header">
          <div class="explorer-tree-title">
            <i data-lucide="folder-tree" class="explorer-icon"></i>
            <span class="explorer-title-text">${t('explorer.title')}</span>
          </div>
          <button class="explorer-refresh-btn" onclick="refreshExplorerTree()" title="${t('explorer.refresh')}">
            <i data-lucide="refresh-cw" class="w-4 h-4"></i>
          </button>
        </div>
        <div class="explorer-tree-content" id="explorerTreeContent">
          <div class="explorer-loading">${t('explorer.loading')}</div>
        </div>
      </div>

      <!-- Right Panel: Preview -->
      <div class="explorer-preview-panel">
        <div class="explorer-preview-header" id="explorerPreviewHeader">
          <span class="preview-filename">${t('explorer.selectFile')}</span>
        </div>
        <div class="explorer-preview-content" id="explorerPreviewContent">
          <div class="explorer-preview-empty">
            <div class="preview-empty-icon"><i data-lucide="file-text" class="w-12 h-12"></i></div>
            <div class="preview-empty-text">${t('explorer.selectFileHint')}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Floating Action Button -->
    <div class="explorer-fab" onclick="toggleTaskQueue()" title="${t('taskQueue.title')}">
      <span class="fab-icon"><i data-lucide="list-todo" class="w-5 h-5"></i></span>
      <span class="fab-badge" id="fabBadge">0</span>
    </div>

    <!-- Task Queue Panel -->
    <div class="task-queue-panel" id="taskQueuePanel">
      <div class="task-queue-header">
        <span class="task-queue-title"><i data-lucide="clipboard-list" class="w-4 h-4 inline-block mr-1"></i> ${t('taskQueue.title')}</span>
        <button class="task-queue-close" onclick="toggleTaskQueue()">×</button>
      </div>
      <div class="task-queue-toolbar">
        <div class="queue-cli-selector">
          <label>${t('taskQueue.cli')}</label>
          <select id="queueCliTool" onchange="updateDefaultCliTool(this.value)">
            <option value="gemini">Gemini</option>
            <option value="qwen">Qwen</option>
            <option value="codex">Codex</option>
            <option value="claude">Claude</option>
          </select>
        </div>
        <div class="task-queue-actions">
          <button class="queue-action-btn" onclick="openAddTaskModal()" title="${t('taskQueue.addTask')}">
            <i data-lucide="plus" class="w-4 h-4"></i>
          </button>
          <button class="queue-action-btn queue-start-btn" onclick="startTaskQueue()" id="startQueueBtn" disabled title="${t('taskQueue.startAll')}">
            <i data-lucide="play" class="w-4 h-4"></i>
          </button>
          <button class="queue-action-btn queue-clear-btn" onclick="clearCompletedTasks()" title="${t('taskQueue.clearCompleted')}">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
      <div class="task-queue-list" id="taskQueueList">
        <div class="task-queue-empty">
          <span>${t('taskQueue.noTasks')}</span>
          <p>${t('taskQueue.noTasksHint')}</p>
        </div>
      </div>
    </div>
  `;

  // Load initial file tree
  await loadExplorerTree(explorerCurrentPath);
  
  // Initialize Lucide icons for dynamically rendered content
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Load and render file tree for a directory
 */
async function loadExplorerTree(dirPath) {
  const treeContent = document.getElementById('explorerTreeContent');
  if (!treeContent) return;

  try {
    const response = await fetch(`/api/files?path=${encodeURIComponent(dirPath)}`);
    const data = await response.json();

    if (data.error) {
      treeContent.innerHTML = `<div class="explorer-error">${escapeHtml(data.error)}</div>`;
      return;
    }

    // Render root level
    treeContent.innerHTML = renderTreeLevel(data.files, dirPath, 0);
    attachTreeEventListeners();
    
    // Initialize Lucide icons for tree items
    if (typeof lucide !== 'undefined') lucide.createIcons();

  } catch (error) {
    treeContent.innerHTML = `<div class="explorer-error">Failed to load: ${escapeHtml(error.message)}</div>`;
  }
}

/**
 * Render a level of the file tree
 */
function renderTreeLevel(files, parentPath, depth) {
  if (!files || files.length === 0) {
    return `<div class="tree-empty" style="padding-left: ${depth * 16 + 8}px">${t('explorer.emptyDir')}</div>`;
  }

  return files.map(file => {
    const isExpanded = explorerExpandedDirs.has(file.path);
    const isSelected = explorerSelectedFile === file.path;

    if (file.type === 'directory') {
      const folderIcon = getFolderIcon(file.name, isExpanded, file.hasClaudeMd);
      const chevronIcon = isExpanded ? '<i data-lucide="chevron-down" class="w-3 h-3"></i>' : '<i data-lucide="chevron-right" class="w-3 h-3"></i>';
      return `
        <div class="tree-item tree-folder ${isExpanded ? 'expanded' : ''} ${file.hasClaudeMd ? 'has-claude-md' : ''}" data-path="${escapeHtml(file.path)}" data-type="directory">
          <div class="tree-item-row ${isSelected ? 'selected' : ''}" style="padding-left: ${depth * 16}px">
            <span class="tree-chevron">${chevronIcon}</span>
            <span class="tree-icon">${folderIcon}</span>
            <span class="tree-name">${escapeHtml(file.name)}</span>
            ${file.hasClaudeMd ? `
              <span class="claude-md-badge" title="Contains CLAUDE.md documentation">
                <span class="badge-icon"><i data-lucide="file-check" class="w-3 h-3"></i></span>
                <span class="badge-text">DOC</span>
              </span>
            ` : ''}
            <div class="tree-folder-actions">
              <button class="tree-update-btn" onclick="event.stopPropagation(); addFolderToQueue('${escapeHtml(file.path)}', 'single-layer')" title="${t('explorer.currentFolderOnly')}">
                <span class="update-icon"><i data-lucide="file" class="w-3.5 h-3.5"></i></span>
              </button>
              <button class="tree-update-btn tree-update-multi" onclick="event.stopPropagation(); addFolderToQueue('${escapeHtml(file.path)}', 'multi-layer')" title="${t('explorer.withSubdirs')}">
                <span class="update-icon"><i data-lucide="folder-tree" class="w-3.5 h-3.5"></i></span>
              </button>
            </div>
          </div>
          <div class="tree-children ${isExpanded ? 'show' : ''}" id="children-${safeBase64Encode(file.path)}">
            ${isExpanded ? '' : ''}
          </div>
        </div>
      `;
    } else {
      const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
      const fileIcon = getFileIcon(ext);
      // Special highlight for CLAUDE.md files
      const isClaudeMd = file.name === 'CLAUDE.md';
      return `
        <div class="tree-item tree-file ${isSelected ? 'selected' : ''} ${isClaudeMd ? 'is-claude-md' : ''}" data-path="${escapeHtml(file.path)}" data-type="file">
          <div class="tree-item-row" style="padding-left: ${depth * 16}px">
            <span class="tree-chevron-spacer"></span>
            <span class="tree-icon">${isClaudeMd ? '<span class="file-icon file-icon-claude"><i data-lucide="bot" class="w-3 h-3"></i></span>' : fileIcon}</span>
            <span class="tree-name">${escapeHtml(file.name)}</span>
          </div>
        </div>
      `;
    }
  }).join('');
}

/**
 * Get file icon based on extension - using colored SVG icons for better distinction
 */
function getFileIcon(ext) {
  const iconMap = {
    // JavaScript/TypeScript - distinct colors
    'js': '<span class="file-icon file-icon-js">JS</span>',
    'mjs': '<span class="file-icon file-icon-js">JS</span>',
    'cjs': '<span class="file-icon file-icon-js">JS</span>',
    'jsx': '<span class="file-icon file-icon-jsx">JSX</span>',
    'ts': '<span class="file-icon file-icon-ts">TS</span>',
    'tsx': '<span class="file-icon file-icon-tsx">TSX</span>',
    
    // Python
    'py': '<span class="file-icon file-icon-py">PY</span>',
    'pyw': '<span class="file-icon file-icon-py">PY</span>',
    
    // Other languages
    'go': '<span class="file-icon file-icon-go">GO</span>',
    'rs': '<span class="file-icon file-icon-rs">RS</span>',
    'java': '<span class="file-icon file-icon-java">JV</span>',
    'rb': '<span class="file-icon file-icon-rb">RB</span>',
    'php': '<span class="file-icon file-icon-php">PHP</span>',
    'c': '<span class="file-icon file-icon-c">C</span>',
    'cpp': '<span class="file-icon file-icon-cpp">C++</span>',
    'h': '<span class="file-icon file-icon-h">H</span>',
    'cs': '<span class="file-icon file-icon-cs">C#</span>',
    'swift': '<span class="file-icon file-icon-swift">SW</span>',
    'kt': '<span class="file-icon file-icon-kt">KT</span>',
    
    // Web
    'html': '<span class="file-icon file-icon-html">HTML</span>',
    'htm': '<span class="file-icon file-icon-html">HTML</span>',
    'css': '<span class="file-icon file-icon-css">CSS</span>',
    'scss': '<span class="file-icon file-icon-scss">SCSS</span>',
    'sass': '<span class="file-icon file-icon-scss">SASS</span>',
    'less': '<span class="file-icon file-icon-less">LESS</span>',
    'vue': '<span class="file-icon file-icon-vue">VUE</span>',
    'svelte': '<span class="file-icon file-icon-svelte">SV</span>',
    
    // Config/Data
    'json': '<span class="file-icon file-icon-json">{}</span>',
    'yaml': '<span class="file-icon file-icon-yaml">YML</span>',
    'yml': '<span class="file-icon file-icon-yaml">YML</span>',
    'xml': '<span class="file-icon file-icon-xml">XML</span>',
    'toml': '<span class="file-icon file-icon-toml">TML</span>',
    'ini': '<span class="file-icon file-icon-ini">INI</span>',
    'env': '<span class="file-icon file-icon-env">ENV</span>',
    
    // Documentation
    'md': '<span class="file-icon file-icon-md">MD</span>',
    'markdown': '<span class="file-icon file-icon-md">MD</span>',
    'txt': '<span class="file-icon file-icon-txt">TXT</span>',
    'log': '<span class="file-icon file-icon-log">LOG</span>',
    
    // Shell/Scripts
    'sh': '<span class="file-icon file-icon-sh">SH</span>',
    'bash': '<span class="file-icon file-icon-sh">SH</span>',
    'zsh': '<span class="file-icon file-icon-sh">ZSH</span>',
    'ps1': '<span class="file-icon file-icon-ps1">PS1</span>',
    'bat': '<span class="file-icon file-icon-bat">BAT</span>',
    'cmd': '<span class="file-icon file-icon-bat">CMD</span>',
    
    // Database
    'sql': '<span class="file-icon file-icon-sql">SQL</span>',
    'db': '<span class="file-icon file-icon-db">DB</span>',
    
    // Docker/Container
    'dockerfile': '<span class="file-icon file-icon-docker"><i data-lucide="container" class="w-3 h-3"></i></span>',
    
    // Images
    'png': '<span class="file-icon file-icon-img">IMG</span>',
    'jpg': '<span class="file-icon file-icon-img">IMG</span>',
    'jpeg': '<span class="file-icon file-icon-img">IMG</span>',
    'gif': '<span class="file-icon file-icon-img">GIF</span>',
    'svg': '<span class="file-icon file-icon-svg">SVG</span>',
    'ico': '<span class="file-icon file-icon-img">ICO</span>',
    
    // Package
    'lock': '<span class="file-icon file-icon-lock"><i data-lucide="lock" class="w-3 h-3"></i></span>'
  };
  
  return iconMap[ext] || '<span class="file-icon file-icon-default"><i data-lucide="file" class="w-3 h-3"></i></span>';
}

/**
 * Get folder icon based on folder name and state
 */
function getFolderIcon(name, isExpanded, hasClaudeMd) {
  // Only special icon for .workflow folder
  if (name === '.workflow') {
    return '<i data-lucide="zap" class="w-4 h-4 text-warning"></i>';
  }
  return isExpanded 
    ? '<i data-lucide="folder-open" class="w-4 h-4 text-warning"></i>' 
    : '<i data-lucide="folder" class="w-4 h-4 text-warning"></i>';
}

// Flag to track if event delegation is already set up
let explorerEventsDelegated = false;

/**
 * Attach event listeners using event delegation (only once on container)
 */
function attachTreeEventListeners() {
  const treeContent = document.getElementById('explorerTreeContent');
  if (!treeContent || explorerEventsDelegated) return;

  explorerEventsDelegated = true;

  // Use event delegation - single listener on container handles all clicks
  treeContent.addEventListener('click', async (e) => {
    // Check if clicked on folder row (but not on action buttons)
    const folderRow = e.target.closest('.tree-folder > .tree-item-row');
    if (folderRow && !e.target.closest('.tree-folder-actions')) {
      const folder = folderRow.closest('.tree-folder');
      const path = folder.dataset.path;
      await toggleFolderExpand(path, folder);
      return;
    }

    // Check if clicked on file
    const fileItem = e.target.closest('.tree-file');
    if (fileItem) {
      const path = fileItem.dataset.path;
      await previewFile(path);

      // Update selection
      document.querySelectorAll('.tree-item-row.selected, .tree-file.selected').forEach(el => {
        el.classList.remove('selected');
      });
      fileItem.classList.add('selected');
      explorerSelectedFile = path;
    }
  });
}
/**
 * Toggle folder expand/collapse
 */
async function toggleFolderExpand(path, folderElement) {
  const isExpanded = explorerExpandedDirs.has(path);
  const childrenContainer = folderElement.querySelector('.tree-children');
  const chevron = folderElement.querySelector('.tree-chevron');
  const folderIcon = folderElement.querySelector('.tree-icon');

  if (isExpanded) {
    // Collapse
    explorerExpandedDirs.delete(path);
    folderElement.classList.remove('expanded');
    childrenContainer.classList.remove('show');
    // Update chevron and folder icon
    if (chevron) chevron.innerHTML = '<i data-lucide="chevron-right" class="w-3 h-3"></i>';
    if (folderIcon && !folderElement.querySelector('[data-lucide="zap"]')) {
      folderIcon.innerHTML = '<i data-lucide="folder" class="w-4 h-4 text-warning"></i>';
    }
  } else {
    // Expand - load children if not loaded
    explorerExpandedDirs.add(path);
    folderElement.classList.add('expanded');
    childrenContainer.classList.add('show');
    // Update chevron and folder icon
    if (chevron) chevron.innerHTML = '<i data-lucide="chevron-down" class="w-3 h-3"></i>';
    if (folderIcon && !folderElement.querySelector('[data-lucide="zap"]')) {
      folderIcon.innerHTML = '<i data-lucide="folder-open" class="w-4 h-4 text-warning"></i>';
    }

    if (!childrenContainer.innerHTML.trim()) {
      childrenContainer.innerHTML = '<div class="tree-loading">Loading...</div>';
      
      try {
        const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
        const data = await response.json();
        
        const depth = (path.match(/\//g) || []).length - (explorerCurrentPath.match(/\//g) || []).length + 1;
        childrenContainer.innerHTML = renderTreeLevel(data.files, path, depth);
      } catch (error) {
        childrenContainer.innerHTML = `<div class="tree-error">Failed to load</div>`;
      }
    }
  }
  
  // Reinitialize Lucide icons after DOM changes
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Preview a file in the right panel
 */
async function previewFile(filePath) {
  const previewHeader = document.getElementById('explorerPreviewHeader');
  const previewContent = document.getElementById('explorerPreviewContent');
  
  const fileName = filePath.split('/').pop();
  const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
  const isMarkdown = ext === 'md' || ext === 'markdown';
  
  // Build header with tabs for markdown files
  previewHeader.innerHTML = `
    <div class="preview-header-left">
      <span class="preview-filename">${escapeHtml(fileName)}</span>
      <span class="preview-path" title="${escapeHtml(filePath)}">${escapeHtml(filePath)}</span>
    </div>
    ${isMarkdown ? `
      <div class="preview-header-tabs" id="previewHeaderTabs">
        <button class="preview-tab active" data-tab="rendered" onclick="switchPreviewTab(this, 'rendered')">${t('explorer.preview')}</button>
        <button class="preview-tab" data-tab="source" onclick="switchPreviewTab(this, 'source')">${t('explorer.source')}</button>
      </div>
    ` : ''}
  `;
  
  previewContent.innerHTML = '<div class="explorer-loading">Loading file...</div>';

  try {
    const response = await fetch(`/api/file-content?path=${encodeURIComponent(filePath)}`);
    const data = await response.json();

    if (data.error) {
      previewContent.innerHTML = `<div class="explorer-error">${escapeHtml(data.error)}</div>`;
      return;
    }

    if (data.isMarkdown) {
      // Render markdown with tabs content (tabs are in header)
      const rendered = marked.parse(data.content);
      previewContent.innerHTML = `
        <div class="preview-tab-content rendered show" data-tab="rendered">
          <div class="markdown-preview prose">${rendered}</div>
        </div>
        <div class="preview-tab-content source" data-tab="source">
          <pre><code class="language-markdown">${escapeHtml(data.content)}</code></pre>
        </div>
      `;
    } else {
      // Render code with syntax highlighting
      previewContent.innerHTML = `
        <div class="preview-info">
          <span class="preview-lang">${data.language}</span>
          <span class="preview-lines">${data.lines} ${t('explorer.lines')}</span>
          <span class="preview-size">${formatFileSize(data.size)}</span>
        </div>
        <pre class="preview-code"><code class="language-${data.language}">${escapeHtml(data.content)}</code></pre>
      `;
    }

    // Apply syntax highlighting if hljs is available
    if (typeof hljs !== 'undefined') {
      previewContent.querySelectorAll('pre code').forEach(block => {
        hljs.highlightElement(block);
      });
    }

  } catch (error) {
    previewContent.innerHTML = `<div class="explorer-error">Failed to load: ${escapeHtml(error.message)}</div>`;
  }
}

/**
 * Switch preview tab (for markdown files)
 */
function switchPreviewTab(btn, tabName) {
  const previewPanel = btn.closest('.explorer-preview-panel');
  const contentArea = previewPanel.querySelector('.explorer-preview-content');
  
  // Update tab buttons in header
  previewPanel.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  
  // Update tab content
  contentArea.querySelectorAll('.preview-tab-content').forEach(c => c.classList.remove('show'));
  contentArea.querySelector(`[data-tab="${tabName}"]`).classList.add('show');
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Refresh the explorer tree
 */
async function refreshExplorerTree() {
  const btn = document.querySelector('.explorer-refresh-btn');
  if (btn) {
    btn.classList.add('refreshing');
  }
  
  explorerExpandedDirs.clear();
  explorerEventsDelegated = false;
  await loadExplorerTree(explorerCurrentPath);
  
  if (btn) {
    btn.classList.remove('refreshing');
  }
}

/**
 * Open Update CLAUDE.md modal
 */
function openUpdateClaudeMdModal(folderPath) {
  const modal = document.getElementById('updateClaudeMdModal');
  if (!modal) return;

  // Set folder path
  document.getElementById('claudeMdTargetPath').textContent = folderPath;
  document.getElementById('claudeMdTargetPath').dataset.path = folderPath;
  
  // Reset form
  document.getElementById('claudeMdTool').value = 'gemini';
  document.getElementById('claudeMdStrategy').value = 'single-layer';
  
  // Show modal
  modal.classList.remove('hidden');
}

/**
 * Close Update CLAUDE.md modal
 */
function closeUpdateClaudeMdModal() {
  const modal = document.getElementById('updateClaudeMdModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

/**
 * Execute Update CLAUDE.md
 */
async function executeUpdateClaudeMd() {
  const pathEl = document.getElementById('claudeMdTargetPath');
  const toolSelect = document.getElementById('claudeMdTool');
  const strategySelect = document.getElementById('claudeMdStrategy');
  const executeBtn = document.getElementById('claudeMdExecuteBtn');
  const statusEl = document.getElementById('claudeMdStatus');

  const path = pathEl.dataset.path;
  const tool = toolSelect.value;
  const strategy = strategySelect.value;

  // Update UI
  executeBtn.disabled = true;
  executeBtn.textContent = 'Updating...';
  statusEl.innerHTML = '<div class="status-running">⏳ Running update...</div>';

  try {
    const response = await csrfFetch('/api/update-claude-md', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, tool, strategy })
    });

    const result = await response.json();

    if (result.success) {
      statusEl.innerHTML = `<div class="status-success"><i data-lucide="check-circle" class="w-4 h-4 inline text-success"></i> ${escapeHtml(result.message)}</div>`;
      // Refresh tree to update CLAUDE.md indicators
      await refreshExplorerTree();
      if (typeof lucide !== 'undefined') lucide.createIcons();
    } else {
      statusEl.innerHTML = `<div class="status-error"><i data-lucide="x-circle" class="w-4 h-4 inline text-destructive"></i> ${escapeHtml(result.error || 'Update failed')}</div>`;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

  } catch (error) {
    statusEl.innerHTML = `<div class="status-error"><i data-lucide="x-circle" class="w-4 h-4 inline text-destructive"></i> ${escapeHtml(error.message)}</div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } finally {
    executeBtn.disabled = false;
    executeBtn.textContent = 'Execute';
  }
}

// ============================================
// TASK QUEUE FUNCTIONS
// ============================================

/**
 * Toggle task queue panel visibility
 */
function toggleTaskQueue() {
  isTaskQueueVisible = !isTaskQueueVisible;
  const panel = document.getElementById('taskQueuePanel');
  const fab = document.querySelector('.explorer-fab');
  
  if (isTaskQueueVisible) {
    panel.classList.add('show');
    fab.classList.add('active');
  } else {
    panel.classList.remove('show');
    fab.classList.remove('active');
  }
}

/**
 * Update default CLI tool
 */
function updateDefaultCliTool(tool) {
  defaultCliTool = tool;
}

/**
 * Update the FAB badge count
 */
function updateFabBadge() {
  const badge = document.getElementById('fabBadge');
  if (badge) {
    const pendingCount = updateTaskQueue.filter(t => t.status === 'pending' || t.status === 'running').length;
    badge.textContent = pendingCount || '';
    badge.style.display = pendingCount > 0 ? 'flex' : 'none';
  }
}

/**
 * Open add task modal
 */
function openAddTaskModal() {
  const modal = document.getElementById('updateClaudeMdModal');
  if (!modal) return;

  // Set default path to current project
  document.getElementById('claudeMdTargetPath').textContent = explorerCurrentPath;
  document.getElementById('claudeMdTargetPath').dataset.path = explorerCurrentPath;
  
  // Reset form
  document.getElementById('claudeMdTool').value = 'gemini';
  document.getElementById('claudeMdStrategy').value = 'single-layer';
  document.getElementById('claudeMdStatus').innerHTML = '';
  
  // Change button to "Add to Queue"
  const executeBtn = document.getElementById('claudeMdExecuteBtn');
  executeBtn.textContent = 'Add to Queue';
  executeBtn.onclick = addTaskToQueue;
  
  modal.classList.remove('hidden');
}

/**
 * Add task to queue from modal
 */
function addTaskToQueue() {
  const pathEl = document.getElementById('claudeMdTargetPath');
  const toolSelect = document.getElementById('claudeMdTool');
  const strategySelect = document.getElementById('claudeMdStrategy');

  const path = pathEl.dataset.path;
  const tool = toolSelect.value;
  const strategy = strategySelect.value;
  
  addUpdateTask(path, tool, strategy);
  closeUpdateClaudeMdModal();
  
  // Show task queue
  if (!isTaskQueueVisible) {
    toggleTaskQueue();
  }
}

/**
 * Add a task to the update queue
 */
function addUpdateTask(path, tool = 'gemini', strategy = 'single-layer') {
  const task = {
    id: Date.now(),
    path,
    tool,
    strategy,
    status: 'pending', // pending, running, completed, failed
    message: '',
    addedAt: new Date().toISOString()
  };
  
  updateTaskQueue.push(task);
  renderTaskQueue();
  updateFabBadge();
  
  // Enable start button
  document.getElementById('startQueueBtn').disabled = false;
}

/**
 * Add task from folder context (right-click or button)
 */
function addFolderToQueue(folderPath, strategy = 'single-layer') {
  // Use the sidebar queue instead of floating panel
  if (typeof addUpdateTaskToSidebar === 'function') {
    addUpdateTaskToSidebar(folderPath, defaultCliTool, strategy);
  } else {
    // Fallback to local queue
    addUpdateTask(folderPath, defaultCliTool, strategy);

    // Show task queue if not visible
    if (!isTaskQueueVisible) {
      toggleTaskQueue();
    }
  }
}

/**
 * Render the task queue list
 */
function renderTaskQueue() {
  const listEl = document.getElementById('taskQueueList');
  
  if (updateTaskQueue.length === 0) {
    listEl.innerHTML = `
      <div class="task-queue-empty">
        <span>${t('taskQueue.noTasks')}</span>
        <p>${t('taskQueue.noTasksHint')}</p>
      </div>
    `;
    return;
  }
  
  listEl.innerHTML = updateTaskQueue.map(task => {
    const folderName = task.path.split('/').pop() || task.path;
    const strategyLabel = task.strategy === 'multi-layer' 
      ? '<i data-lucide="folder-tree" class="w-3 h-3 inline"></i> ' + t('taskQueue.withSubdirs')
      : '<i data-lucide="file" class="w-3 h-3 inline"></i> ' + t('taskQueue.currentOnly');
    const statusIcon = {
      'pending': '<i data-lucide="clock" class="w-4 h-4"></i>',
      'running': '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>',
      'completed': '<i data-lucide="check-circle" class="w-4 h-4 text-success"></i>',
      'failed': '<i data-lucide="x-circle" class="w-4 h-4 text-destructive"></i>'
    }[task.status];
    
    return `
      <div class="task-queue-item status-${task.status}" data-task-id="${task.id}">
        <div class="task-item-header">
          <span class="task-status-icon">${statusIcon}</span>
          <span class="task-folder-name" title="${escapeHtml(task.path)}">${escapeHtml(folderName)}</span>
          ${task.status === 'pending' ? `
            <button class="task-remove-btn" onclick="removeTask(${task.id})" title="Remove">×</button>
          ` : ''}
        </div>
        <div class="task-item-meta">
          <span class="task-strategy">${strategyLabel}</span>
          <span class="task-tool">${task.tool}</span>
        </div>
        ${task.message ? `<div class="task-item-message">${escapeHtml(task.message)}</div>` : ''}
      </div>
    `;
  }).join('');
  
  // Reinitialize Lucide icons
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/**
 * Remove a task from queue
 */
function removeTask(taskId) {
  updateTaskQueue = updateTaskQueue.filter(t => t.id !== taskId);
  renderTaskQueue();
  updateFabBadge();
  
  // Disable start button if no pending tasks
  const hasPending = updateTaskQueue.some(t => t.status === 'pending');
  document.getElementById('startQueueBtn').disabled = !hasPending;
}

/**
 * Clear completed/failed tasks
 */
function clearCompletedTasks() {
  updateTaskQueue = updateTaskQueue.filter(t => t.status === 'pending' || t.status === 'running');
  renderTaskQueue();
  updateFabBadge();
}

/**
 * Execute a single task asynchronously
 */
async function executeTask(task) {
  const folderName = task.path.split('/').pop() || task.path;
  
  // Update status to running
  task.status = 'running';
  task.message = t('taskQueue.processing');
  renderTaskQueue();
  
  addGlobalNotification('info', `Processing: ${folderName}`, `Strategy: ${task.strategy}, Tool: ${task.tool}`, 'Explorer');
  
  try {
    const response = await csrfFetch('/api/update-claude-md', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: task.path,
        tool: task.tool,
        strategy: task.strategy
      })
    });

    const result = await response.json();

    if (result.success) {
      task.status = 'completed';
      task.message = t('taskQueue.updated');
      addGlobalNotification('success', `Completed: ${folderName}`, result.message, 'Explorer');
      return { success: true };
    } else {
      task.status = 'failed';
      task.message = result.error || t('taskQueue.failed');
      addGlobalNotification('error', `Failed: ${folderName}`, result.error || 'Unknown error', 'Explorer');
      return { success: false };
    }
  } catch (error) {
    task.status = 'failed';
    task.message = error.message;
    addGlobalNotification('error', `Error: ${folderName}`, error.message, 'Explorer');
    return { success: false };
  } finally {
    renderTaskQueue();
    updateFabBadge();
  }
}

/**
 * Start processing task queue - executes tasks asynchronously in parallel
 */
async function startTaskQueue() {
  if (isTaskRunning) return;
  
  const pendingTasks = updateTaskQueue.filter(t => t.status === 'pending');
  if (pendingTasks.length === 0) return;
  
  isTaskRunning = true;
  document.getElementById('startQueueBtn').disabled = true;
  
  addGlobalNotification('info', t('taskQueue.startingTasks', { count: pendingTasks.length }), null, 'Explorer');
  
  // Execute all tasks in parallel
  const results = await Promise.all(pendingTasks.map(task => executeTask(task)));
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  isTaskRunning = false;
  
  // Summary notification
  addGlobalNotification(
    failCount === 0 ? 'success' : 'warning',
    t('taskQueue.queueCompleted', { success: successCount, failed: failCount }),
    null,
    'Explorer'
  );
  
  // Force refresh notification list to ensure all notifications are displayed
  if (typeof renderGlobalNotifications === 'function') {
    renderGlobalNotifications();
    updateGlobalNotifBadge();
  }
  
  // Re-enable start button if there are pending tasks
  const hasPending = updateTaskQueue.some(t => t.status === 'pending');
  document.getElementById('startQueueBtn').disabled = !hasPending;
  
  // Refresh tree to show updated CLAUDE.md files
  await refreshExplorerTree();
}
