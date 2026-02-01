// ========================================
// AppShell Component
// ========================================
// Root layout component combining Header, Sidebar, and MainContent

import { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MainContent } from './MainContent';
import { CliStreamMonitor } from '@/components/shared/CliStreamMonitor';
import { NotificationPanel } from '@/components/notification';
import { AskQuestionDialog } from '@/components/a2ui/AskQuestionDialog';
import { useNotificationStore, selectCurrentQuestion } from '@/stores';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useWebSocketNotifications } from '@/hooks';

export interface AppShellProps {
  /** Initial sidebar collapsed state */
  defaultCollapsed?: boolean;
  /** Callback for refresh action */
  onRefresh?: () => void;
  /** Whether refresh is in progress */
  isRefreshing?: boolean;
  /** Children to render in main content area */
  children?: React.ReactNode;
}

// Local storage key for sidebar state
const SIDEBAR_COLLAPSED_KEY = 'ccw-sidebar-collapsed';

export function AppShell({
  defaultCollapsed = false,
  onRefresh,
  isRefreshing = false,
  children,
}: AppShellProps) {
  // Workspace initialization from URL query parameter
  const switchWorkspace = useWorkflowStore((state) => state.switchWorkspace);
  const projectPath = useWorkflowStore((state) => state.projectPath);
  const location = useLocation();

  // Workspace initialization logic (URL > localStorage)
  const [isWorkspaceInitialized, setWorkspaceInitialized] = useState(false);

  useEffect(() => {
    // This effect should only run once to decide the initial workspace.
    if (isWorkspaceInitialized) {
      return;
    }

    const searchParams = new URLSearchParams(location.search);
    const urlPath = searchParams.get('path');
    const persistedPath = projectPath; // Path from rehydrated store

    let pathFound = false;

    // Priority 1: URL parameter.
    if (urlPath) {
      console.log('[AppShell] Initializing workspace from URL parameter:', urlPath);
      switchWorkspace(urlPath).catch((error) => {
        console.error('[AppShell] Failed to initialize from URL:', error);
      });
      pathFound = true;
    }
    // Priority 2: Rehydrated path from localStorage.
    else if (persistedPath) {
      console.log('[AppShell] Initializing workspace from persisted state:', persistedPath);
      // The path is already in the store, but we need to trigger the data fetch.
      switchWorkspace(persistedPath).catch((error) => {
        console.error('[AppShell] Failed to re-initialize from persisted state:', error);
      });
      pathFound = true;
    }

    // Mark as initialized regardless of whether a path was found.
    setWorkspaceInitialized(true);
  }, [isWorkspaceInitialized, projectPath, location.search, switchWorkspace]);

  // Sidebar collapse state (persisted)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      return stored ? JSON.parse(stored) : defaultCollapsed;
    }
    return defaultCollapsed;
  });

  // Mobile sidebar open state
  const [mobileOpen, setMobileOpen] = useState(false);

  // CLI Monitor open state
  const [isCliMonitorOpen, setIsCliMonitorOpen] = useState(false);

  // Notification panel store integration
  const isNotificationPanelVisible = useNotificationStore((state) => state.isPanelVisible);
  const loadPersistentNotifications = useNotificationStore(
    (state) => state.loadPersistentNotifications
  );

  // Current question dialog state
  const currentQuestion = useNotificationStore(selectCurrentQuestion);
  const setCurrentQuestion = useNotificationStore((state) => state.setCurrentQuestion);

  // Initialize WebSocket notifications handler
  useWebSocketNotifications();

  // Load persistent notifications from localStorage on mount
  useEffect(() => {
    loadPersistentNotifications();
  }, [loadPersistentNotifications]);

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Close mobile sidebar on route change or resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMenuClick = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  const handleMobileClose = useCallback(() => {
    setMobileOpen(false);
  }, []);

  const handleCollapsedChange = useCallback((collapsed: boolean) => {
    setSidebarCollapsed(collapsed);
  }, []);

  const handleCliMonitorClick = useCallback(() => {
    setIsCliMonitorOpen(true);
  }, []);

  const handleCliMonitorClose = useCallback(() => {
    setIsCliMonitorOpen(false);
  }, []);

  const handleNotificationPanelClose = useCallback(() => {
    useNotificationStore.getState().setPanelVisible(false);
  }, []);

  const handleQuestionDialogClose = useCallback(() => {
    setCurrentQuestion(null);
  }, [setCurrentQuestion]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header - fixed at top */}
      <Header
        onMenuClick={handleMenuClick}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        onCliMonitorClick={handleCliMonitorClick}
      />

      {/* Main layout - sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onCollapsedChange={handleCollapsedChange}
          mobileOpen={mobileOpen}
          onMobileClose={handleMobileClose}
        />

        {/* Main content area */}
        <MainContent
          className={cn(
            'transition-all duration-300',
            // Add left margin on desktop to account for fixed sidebar
            sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'
          )}
        >
          {children}
        </MainContent>
      </div>

      {/* CLI Stream Monitor - Global Drawer */}
      <CliStreamMonitor
        isOpen={isCliMonitorOpen}
        onClose={handleCliMonitorClose}
      />

      {/* Notification Panel - Global Drawer */}
      <NotificationPanel
        isOpen={isNotificationPanelVisible}
        onClose={handleNotificationPanelClose}
      />

      {/* Ask Question Dialog - For ask_question MCP tool */}
      {currentQuestion && (
        <AskQuestionDialog
          payload={currentQuestion}
          onClose={handleQuestionDialogClose}
        />
      )}
    </div>
  );
}

export default AppShell;
