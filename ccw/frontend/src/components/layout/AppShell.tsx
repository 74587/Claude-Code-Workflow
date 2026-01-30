// ========================================
// AppShell Component
// ========================================
// Root layout component combining Header, Sidebar, and MainContent

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MainContent } from './MainContent';

export interface AppShellProps {
  /** Initial sidebar collapsed state */
  defaultCollapsed?: boolean;
  /** Current project path to display in header */
  projectPath?: string;
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
  projectPath = '',
  onRefresh,
  isRefreshing = false,
  children,
}: AppShellProps) {
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

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header - fixed at top */}
      <Header
        onMenuClick={handleMenuClick}
        projectPath={projectPath}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
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
            // Adjust padding on mobile when sidebar is hidden
            'md:ml-0'
          )}
        >
          {children}
        </MainContent>
      </div>
    </div>
  );
}

export default AppShell;
