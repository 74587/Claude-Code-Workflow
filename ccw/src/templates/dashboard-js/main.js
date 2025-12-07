// Application Entry Point
// Initializes all components and sets up global event handlers

document.addEventListener('DOMContentLoaded', async () => {
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

  // Initialize real-time features (WebSocket + auto-refresh)
  try { initWebSocket(); } catch (e) { console.log('WebSocket not available:', e.message); }
  try { initAutoRefresh(); } catch (e) { console.error('Auto-refresh init failed:', e); }

  // Server mode: load data from API
  try {
    if (window.SERVER_MODE) {
      await switchToPath(window.INITIAL_PATH || projectPath);
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
    }
  });
});
