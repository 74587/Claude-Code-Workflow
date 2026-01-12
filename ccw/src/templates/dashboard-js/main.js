// Application Entry Point
// Initializes all components and sets up global event handlers

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Lucide icons (must be first to render SVG icons)
  try { lucide.createIcons(); } catch (e) { console.error('Lucide icons init failed:', e); }

  // Initialize preload services (must be early to start data fetching)
  try { initPreloadServices(); } catch (e) { console.error('Preload services init failed:', e); }

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

      // Update all navigation badges after initial load
      if (typeof updateAllNavigationBadges === 'function') {
        updateAllNavigationBadges();
      }

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

/**
 * 初始化预加载服务
 * 创建缓存管理器、事件管理器和预加载服务，并注册数据源
 */
function initPreloadServices() {
  // 初始化服务实例
  window.cacheManager = new CacheManager('ccw.cache.');
  window.eventManager = new EventManager();
  window.preloadService = new PreloadService(window.cacheManager, window.eventManager);

  // 注册高优先级数据源（页面进入时立即预加载）
  window.preloadService.register('dashboard-init',
    () => fetch('/api/codexlens/dashboard-init').then(r => r.ok ? r.json() : Promise.reject(r)),
    { isHighPriority: true, ttl: 300000 } // 5分钟
  );

  window.preloadService.register('workspace-status',
    () => {
      const path = encodeURIComponent(projectPath || '');
      return fetch('/api/codexlens/workspace-status?path=' + path).then(r => r.ok ? r.json() : Promise.reject(r));
    },
    { isHighPriority: true, ttl: 120000 } // 2分钟
  );

  // CLI 状态 - 高优先级
  window.preloadService.register('cli-status',
    () => fetch('/api/cli/status').then(r => r.ok ? r.json() : Promise.reject(r)),
    { isHighPriority: true, ttl: 300000 } // 5分钟
  );

  // CLI 工具配置 - /api/cli/config（cli-manager.js 使用）
  window.preloadService.register('cli-config',
    () => fetch('/api/cli/config').then(r => r.ok ? r.json() : Promise.reject(r)),
    { isHighPriority: true, ttl: 300000 } // 5分钟
  );

  // CLI 工具列表配置 - /api/cli/tools-config（cli-status.js 使用）
  window.preloadService.register('cli-tools-config',
    () => fetch('/api/cli/tools-config').then(r => r.ok ? r.json() : Promise.reject(r)),
    { isHighPriority: true, ttl: 300000 } // 5分钟
  );

  // 注册中优先级数据源
  window.preloadService.register('codexlens-models',
    () => fetch('/api/codexlens/models').then(r => r.ok ? r.json() : Promise.reject(r)),
    { isHighPriority: false, ttl: 600000 } // 10分钟
  );

  // 立即触发高优先级预加载（静默后台执行）
  window.preloadService.runInitialPreload();

  console.log('[Preload] Services initialized, high-priority preload started');
}
