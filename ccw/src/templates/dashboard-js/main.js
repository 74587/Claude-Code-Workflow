// Application Entry Point
// Initializes all components and sets up global event handlers

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Lucide icons (must be first to render SVG icons)
  try { lucide.createIcons(); } catch (e) { console.error('Lucide icons init failed:', e); }

  // Initialize i18n (must be early to translate static content)
  try { initI18n(); } catch (e) { console.error('I18n init failed:', e); }

  // Initialize components with error handling to prevent cascading failures
  try { initTheme(); } catch (e) { console.error('Theme init failed:', e); }
  try { initSidebar(); } catch (e) { console.error('Sidebar init failed:', e); }
  try { initPathSelector(); } catch (e) { console.error('Path selector init failed:', e); }
  try { initNavigation(); } catch (e) { console.error('Navigation init failed:', e); }
  try { initSearch(); } catch (e) { console.error('Search init failed:', e); }
  try { initRefreshButton(); } catch (e) { console.error('Refresh button init failed:', e); }
  try { initCarousel(); } catch (e) { console.error('Carousel init failed:', e); }
  try { initMcpManager(); } catch (e) { console.error('MCP Manager init failed:', e); }
  try { initHookManager(); } catch (e) { console.error('Hook Manager init failed:', e); }
  try { initCliStatus(); } catch (e) { console.error('CLI Status init failed:', e); }
  try { initGlobalNotifications(); } catch (e) { console.error('Global notifications init failed:', e); }
  try { initTaskQueueSidebar(); } catch (e) { console.error('Task queue sidebar init failed:', e); }
  try { initVersionCheck(); } catch (e) { console.error('Version check init failed:', e); }

  // Initialize real-time features (WebSocket + auto-refresh)
  try { initWebSocket(); } catch (e) { console.log('WebSocket not available:', e.message); }
  try { initAutoRefresh(); } catch (e) { console.error('Auto-refresh init failed:', e); }

  // Server mode: load data from API
  try {
    if (window.SERVER_MODE) {
      // Check URL for path parameter (from ccw view command)
      const urlParams = new URLSearchParams(window.location.search);
      const urlPath = urlParams.get('path');
      const initialPath = urlPath || window.INITIAL_PATH || projectPath;

      await switchToPath(initialPath);

      // Clean up URL after loading (remove query param)
      if (urlPath && window.history.replaceState) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    } else {
      renderDashboard();
    }
  } catch (e) {
    console.error('Dashboard render failed:', e);
  }

  // Global Escape key handler for modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMarkdownModal();

      // Close JSON modal if exists
      const jsonModal = document.querySelector('.json-modal-overlay');
      if (jsonModal) {
        const closeBtn = jsonModal.querySelector('.json-modal-close');
        if (closeBtn) closeJsonModal(closeBtn);
      }

      // Close path modal if exists
      closePathModal();

      // Close MCP create modal if exists
      if (typeof closeMcpCreateModal === 'function') {
        closeMcpCreateModal();
      }

      // Close Hook create modal if exists
      if (typeof closeHookCreateModal === 'function') {
        closeHookCreateModal();
      }

      // Close notification sidebar if open
      if (isNotificationPanelVisible && typeof toggleNotifSidebar === 'function') {
        toggleNotifSidebar();
      }

      // Close task queue sidebar if open
      if (isTaskQueueSidebarVisible && typeof toggleTaskQueueSidebar === 'function') {
        toggleTaskQueueSidebar();
      }
    }
  });
});
