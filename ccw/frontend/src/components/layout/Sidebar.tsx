// ========================================
// Sidebar Component
// ========================================
// Collapsible navigation sidebar with route links

import { useState, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  FolderKanban,
  Workflow,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Terminal,
  Brain,
  Settings,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export interface SidebarProps {
  /** Whether sidebar is collapsed */
  collapsed?: boolean;
  /** Callback when collapse state changes */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Whether sidebar is open on mobile */
  mobileOpen?: boolean;
  /** Callback to close mobile sidebar */
  onMobileClose?: () => void;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  badge?: number | string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'info';
}

const navItems: NavItem[] = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/sessions', label: 'Sessions', icon: FolderKanban },
  { path: '/orchestrator', label: 'Orchestrator', icon: Workflow },
  { path: '/loops', label: 'Loop Monitor', icon: RefreshCw },
  { path: '/issues', label: 'Issues', icon: AlertCircle },
  { path: '/skills', label: 'Skills', icon: Sparkles },
  { path: '/commands', label: 'Commands', icon: Terminal },
  { path: '/memory', label: 'Memory', icon: Brain },
  { path: '/settings', label: 'Settings', icon: Settings },
  { path: '/help', label: 'Help', icon: HelpCircle },
];

export function Sidebar({
  collapsed = false,
  onCollapsedChange,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const location = useLocation();
  const [internalCollapsed, setInternalCollapsed] = useState(collapsed);

  const isCollapsed = onCollapsedChange ? collapsed : internalCollapsed;

  const handleToggleCollapse = useCallback(() => {
    if (onCollapsedChange) {
      onCollapsedChange(!collapsed);
    } else {
      setInternalCollapsed(!internalCollapsed);
    }
  }, [collapsed, internalCollapsed, onCollapsedChange]);

  const handleNavClick = useCallback(() => {
    // Close mobile sidebar when navigating
    if (onMobileClose) {
      onMobileClose();
    }
  }, [onMobileClose]);

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'bg-sidebar-background border-r border-border flex flex-col transition-all duration-300',
          // Desktop styles
          'hidden md:flex sticky top-14 h-[calc(100vh-56px)]',
          isCollapsed ? 'w-16' : 'w-64',
          // Mobile styles
          'md:translate-x-0',
          mobileOpen && 'fixed left-0 top-14 flex translate-x-0 z-50 h-[calc(100vh-56px)] w-64 shadow-lg'
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        <nav className="flex-1 py-3 overflow-y-auto">
          <ul className="space-y-1 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path));

              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    onClick={handleNavClick}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                      'hover:bg-hover hover:text-foreground',
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground',
                      isCollapsed && 'justify-center px-2'
                    )}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!isCollapsed && (
                      <>
                        <span className="flex-1">{item.label}</span>
                        {item.badge !== undefined && (
                          <span
                            className={cn(
                              'px-2 py-0.5 text-xs font-semibold rounded-full',
                              item.badgeVariant === 'success' && 'bg-success-light text-success',
                              item.badgeVariant === 'warning' && 'bg-warning-light text-warning',
                              item.badgeVariant === 'info' && 'bg-info-light text-info',
                              (!item.badgeVariant || item.badgeVariant === 'default') &&
                                'bg-muted text-muted-foreground'
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sidebar footer - collapse toggle */}
        <div className="p-3 border-t border-border hidden md:block">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleCollapse}
            className={cn(
              'w-full flex items-center gap-2 text-muted-foreground hover:text-foreground',
              isCollapsed && 'justify-center'
            )}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
