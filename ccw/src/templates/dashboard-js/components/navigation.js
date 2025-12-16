// Navigation and Routing
// Manages navigation events, active state, content title updates, search, and path selector

// Path Selector
function initPathSelector() {
  const btn = document.getElementById('pathButton');
  const menu = document.getElementById('pathMenu');
  const recentContainer = document.getElementById('recentPaths');

  // Render recent paths
  if (recentPaths && recentPaths.length > 0) {
    recentPaths.forEach(path => {
      const item = document.createElement('div');
      item.className = 'path-item' + (path === projectPath ? ' active' : '');
      item.dataset.path = path;

      // Path text
      const pathText = document.createElement('span');
      pathText.className = 'path-text';
      pathText.textContent = path;
      pathText.addEventListener('click', () => selectPath(path));
      item.appendChild(pathText);

      // Delete button (only for non-current paths)
      if (path !== projectPath) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'path-delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Remove from recent';
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await removeRecentPathFromList(path);
        });
        item.appendChild(deleteBtn);
      }

      recentContainer.appendChild(item);
    });
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    menu.classList.add('hidden');
  });

  document.getElementById('browsePath').addEventListener('click', async () => {
    await browseForFolder();
  });
}

// Cleanup function for view transitions
function cleanupPreviousView() {
  // Cleanup graph explorer
  if (currentView === 'graph-explorer' && typeof window.cleanupGraphExplorer === 'function') {
    window.cleanupGraphExplorer();
  }
  // Hide storage card when leaving cli-manager
  var storageCard = document.getElementById('storageCard');
  if (storageCard) {
    storageCard.style.display = 'none';
  }
}

// Navigation
function initNavigation() {
  document.querySelectorAll('.nav-item[data-filter]').forEach(item => {
    item.addEventListener('click', () => {
      cleanupPreviousView();

      setActiveNavItem(item);
      currentFilter = item.dataset.filter;
      currentLiteType = null;
      currentView = 'sessions';
      currentSessionDetailKey = null;
      updateContentTitle();
      showStatsAndSearch();
      renderSessions();
    });
  });

  // Lite Tasks Navigation
  document.querySelectorAll('.nav-item[data-lite]').forEach(item => {
    item.addEventListener('click', () => {
      cleanupPreviousView();

      setActiveNavItem(item);
      currentLiteType = item.dataset.lite;
      currentFilter = null;
      currentView = 'liteTasks';
      currentSessionDetailKey = null;
      updateContentTitle();
      showStatsAndSearch();
      renderLiteTasks();
    });
  });

  // View Navigation (Project Overview, MCP Manager, etc.)
  document.querySelectorAll('.nav-item[data-view]').forEach(item => {
    item.addEventListener('click', () => {
      cleanupPreviousView();

      setActiveNavItem(item);
      currentView = item.dataset.view;
      currentFilter = null;
      currentLiteType = null;
      currentSessionDetailKey = null;
      updateContentTitle();

      // Route to appropriate view
      if (currentView === 'mcp-manager') {
        renderMcpManager();
      } else if (currentView === 'project-overview') {
        renderProjectOverview();
      } else if (currentView === 'explorer') {
        renderExplorer();
      } else if (currentView === 'cli-manager') {
        renderCliManager();
      } else if (currentView === 'cli-history') {
        renderCliHistoryView();
      } else if (currentView === 'hook-manager') {
        renderHookManager();
      } else if (currentView === 'memory') {
        renderMemoryView();
      } else if (currentView === 'prompt-history') {
        renderPromptHistoryView();
      } else if (currentView === 'skills-manager') {
        renderSkillsManager();
      } else if (currentView === 'rules-manager') {
        renderRulesManager();
      } else if (currentView === 'claude-manager') {
        renderClaudeManager();
      } else if (currentView === 'graph-explorer') {
        renderGraphExplorer();
      } else if (currentView === 'help') {
        renderHelpView();
      }
    });
  });
}

function setActiveNavItem(item) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  item.classList.add('active');
}

function updateContentTitle() {
  const titleEl = document.getElementById('contentTitle');
  if (currentView === 'project-overview') {
    titleEl.textContent = t('title.projectOverview');
  } else if (currentView === 'mcp-manager') {
    titleEl.textContent = t('title.mcpManagement');
  } else if (currentView === 'explorer') {
    titleEl.textContent = t('title.fileExplorer');
  } else if (currentView === 'cli-manager') {
    titleEl.textContent = t('title.cliTools');
  } else if (currentView === 'cli-history') {
    titleEl.textContent = t('title.cliHistory');
  } else if (currentView === 'hook-manager') {
    titleEl.textContent = t('title.hookManager');
  } else if (currentView === 'memory') {
    titleEl.textContent = t('title.memoryModule');
  } else if (currentView === 'prompt-history') {
    titleEl.textContent = t('title.promptHistory');
  } else if (currentView === 'skills-manager') {
    titleEl.textContent = t('title.skillsManager');
  } else if (currentView === 'rules-manager') {
    titleEl.textContent = t('title.rulesManager');
  } else if (currentView === 'claude-manager') {
    titleEl.textContent = t('title.claudeManager');
  } else if (currentView === 'graph-explorer') {
    titleEl.textContent = t('title.graphExplorer');
  } else if (currentView === 'help') {
    titleEl.textContent = t('title.helpGuide');
  } else if (currentView === 'liteTasks') {
    const names = { 'lite-plan': t('title.litePlanSessions'), 'lite-fix': t('title.liteFixSessions') };
    titleEl.textContent = names[currentLiteType] || t('title.liteTasks');
  } else if (currentView === 'sessionDetail') {
    titleEl.textContent = t('title.sessionDetail');
  } else if (currentView === 'liteTaskDetail') {
    titleEl.textContent = t('title.liteTaskDetail');
  } else {
    const names = { 'all': t('title.allSessions'), 'active': t('title.activeSessions'), 'archived': t('title.archivedSessions') };
    titleEl.textContent = names[currentFilter] || t('title.sessions');
  }
}

// Search
function initSearch() {
  const input = document.getElementById('searchInput');
  input.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    document.querySelectorAll('.session-card').forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(query) ? '' : 'none';
    });
  });
}

// Refresh Workspace
function initRefreshButton() {
  const btn = document.getElementById('refreshWorkspace');
  if (btn) {
    btn.addEventListener('click', refreshWorkspace);
  }
}

async function refreshWorkspace() {
  const btn = document.getElementById('refreshWorkspace');

  // Add spinning animation
  btn.classList.add('refreshing');
  btn.disabled = true;

  try {
    if (window.SERVER_MODE) {
      // Reload data from server
      const data = await loadDashboardData(projectPath);
      if (data) {
        // Clear and repopulate stores
        Object.keys(sessionDataStore).forEach(k => delete sessionDataStore[k]);
        Object.keys(liteTaskDataStore).forEach(k => delete liteTaskDataStore[k]);

        // Populate stores
        [...(data.activeSessions || []), ...(data.archivedSessions || [])].forEach(s => {
          const sessionKey = `session-${s.session_id}`.replace(/[^a-zA-Z0-9-]/g, '-');
          sessionDataStore[sessionKey] = s;
        });

        [...(data.liteTasks?.litePlan || []), ...(data.liteTasks?.liteFix || [])].forEach(s => {
          const sessionKey = `lite-${s.session_id}`.replace(/[^a-zA-Z0-9-]/g, '-');
          liteTaskDataStore[sessionKey] = s;
        });

        // Update global data
        window.workflowData = data;

        // Update sidebar counts
        updateSidebarCounts(data);

        // Re-render current view
        if (currentView === 'sessions') {
          renderSessions();
        } else if (currentView === 'liteTasks') {
          renderLiteTasks();
        } else if (currentView === 'sessionDetail' && currentSessionDetailKey) {
          showSessionDetailPage(currentSessionDetailKey);
        } else if (currentView === 'liteTaskDetail' && currentSessionDetailKey) {
          showLiteTaskDetailPage(currentSessionDetailKey);
        } else if (currentView === 'project-overview') {
          renderProjectOverview();
        }

        showRefreshToast(t('toast.workspaceRefreshed'), 'success');
      }
    } else {
      // Non-server mode: just reload page
      window.location.reload();
    }
  } catch (error) {
    console.error('Refresh failed:', error);
    showRefreshToast(t('toast.refreshFailed', { error: error.message }), 'error');
  } finally {
    btn.classList.remove('refreshing');
    btn.disabled = false;
  }
}

function updateSidebarCounts(data) {
  // Update session counts
  const activeCount = document.querySelector('.nav-item[data-filter="active"] .nav-count');
  const archivedCount = document.querySelector('.nav-item[data-filter="archived"] .nav-count');
  const allCount = document.querySelector('.nav-item[data-filter="all"] .nav-count');

  if (activeCount) activeCount.textContent = data.activeSessions?.length || 0;
  if (archivedCount) archivedCount.textContent = data.archivedSessions?.length || 0;
  if (allCount) allCount.textContent = (data.activeSessions?.length || 0) + (data.archivedSessions?.length || 0);

  // Update lite task counts
  const litePlanCount = document.querySelector('.nav-item[data-lite="lite-plan"] .nav-count');
  const liteFixCount = document.querySelector('.nav-item[data-lite="lite-fix"] .nav-count');

  if (litePlanCount) litePlanCount.textContent = data.liteTasks?.litePlan?.length || 0;
  if (liteFixCount) liteFixCount.textContent = data.liteTasks?.liteFix?.length || 0;
}

function showRefreshToast(message, type) {
  // Remove existing toast
  const existing = document.querySelector('.status-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `status-toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Increase display time to 3.5 seconds for better visibility
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
