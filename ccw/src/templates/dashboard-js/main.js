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
    }
  });
});
