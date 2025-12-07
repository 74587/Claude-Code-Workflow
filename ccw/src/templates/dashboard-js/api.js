// ========================================
// API and Data Loading
// ========================================
// Server communication and data loading functions
// Note: Some functions are only available in server mode

// ========== Data Loading ==========

/**
 * Load dashboard data from API (server mode only)
 * @param {string} path - Project path to load data for
 * @returns {Promise<Object|null>} Dashboard data object or null if failed
 */
async function loadDashboardData(path) {
  if (!window.SERVER_MODE) {
    console.warn('loadDashboardData called in static mode');
    return null;
  }

  try {
    const response = await fetch(`/api/data?path=${encodeURIComponent(path)}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (err) {
    console.error('Failed to load dashboard data:', err);
    return null;
  }
}

// ========== Path Management ==========

/**
 * Switch to a new project path (server mode only)
 * Loads dashboard data and updates UI
 * @param {string} path - Project path to switch to
 */
async function switchToPath(path) {
  // Show loading state
  const container = document.getElementById('mainContent');
  container.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const data = await loadDashboardData(path);
    if (data) {
      // Update global data
      workflowData = data;
      projectPath = data.projectPath;
      recentPaths = data.recentPaths || [];

      // Update UI
      document.getElementById('currentPath').textContent = projectPath;
      renderDashboard();
      refreshRecentPaths();
    }
  } catch (err) {
    console.error('Failed to switch path:', err);
    container.innerHTML = '<div class="error">Failed to load project data</div>';
  }
}

/**
 * Select a path from recent paths list
 * @param {string} path - Path to select
 */
async function selectPath(path) {
  localStorage.setItem('selectedPath', path);

  // Server mode: load data dynamically
  if (window.SERVER_MODE) {
    await switchToPath(path);
    return;
  }

  // Static mode: show command to run
  const modal = document.createElement('div');
  modal.className = 'path-modal-overlay';
  modal.innerHTML = `
    <div class="path-modal">
      <div class="path-modal-header">
        <span class="path-modal-icon">${icons.terminal}</span>
        <h3>Run Command</h3>
      </div>
      <div class="path-modal-body">
        <p>To view the dashboard for this project, run:</p>
        <div class="path-modal-command">
          <code>ccw view -p "${path}"</code>
          <button class="copy-btn" id="copyCommandBtn">${icons.copy} <span>Copy</span></button>
        </div>
        <p class="path-modal-note" style="margin-top: 12px;">
          Or use <code>ccw serve</code> for live path switching.
        </p>
      </div>
      <div class="path-modal-footer">
        <button class="path-modal-close" onclick="this.closest('.path-modal-overlay').remove()">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Add copy handler
  document.getElementById('copyCommandBtn').addEventListener('click', function() {
    navigator.clipboard.writeText('ccw view -p "' + path + '"').then(() => {
      this.innerHTML = icons.check + ' <span>Copied!</span>';
      setTimeout(() => { this.innerHTML = icons.copy + ' <span>Copy</span>'; }, 2000);
    });
  });
}

/**
 * Refresh recent paths dropdown UI
 */
function refreshRecentPaths() {
  const recentContainer = document.getElementById('recentPaths');
  recentContainer.innerHTML = '';

  recentPaths.forEach(path => {
    const item = document.createElement('div');
    item.className = 'path-item' + (path === projectPath ? ' active' : '');
    item.textContent = path;
    item.dataset.path = path;
    item.addEventListener('click', () => selectPath(path));
    recentContainer.appendChild(item);
  });
}

// ========== File System Access ==========

/**
 * Browse for folder using File System Access API or fallback to input dialog
 */
async function browseForFolder() {
  // Try modern File System Access API first
  if ('showDirectoryPicker' in window) {
    try {
      const dirHandle = await window.showDirectoryPicker({
        mode: 'read',
        startIn: 'documents'
      });
      // Get the directory name (we can't get full path for security reasons)
      const dirName = dirHandle.name;
      showPathSelectedModal(dirName, dirHandle);
      return;
    } catch (err) {
      if (err.name === 'AbortError') {
        // User cancelled
        return;
      }
      console.warn('Directory picker failed:', err);
    }
  }

  // Fallback: show input dialog
  showPathInputModal();
}
