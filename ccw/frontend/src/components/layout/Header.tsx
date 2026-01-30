// ========================================
// Header Component
// ========================================
// Top navigation bar with theme toggle and user menu

import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Workflow,
  Menu,
  Moon,
  Sun,
  RefreshCw,
  Settings,
  User,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks';

export interface HeaderProps {
  /** Callback to toggle mobile sidebar */
  onMenuClick?: () => void;
  /** Current project path */
  projectPath?: string;
  /** Callback for refresh action */
  onRefresh?: () => void;
  /** Whether refresh is in progress */
  isRefreshing?: boolean;
}

export function Header({
  onMenuClick,
  projectPath = '',
  onRefresh,
  isRefreshing = false,
}: HeaderProps) {
  const { isDark, toggleTheme } = useTheme();

  const handleRefresh = useCallback(() => {
    if (onRefresh && !isRefreshing) {
      onRefresh();
    }
  }, [onRefresh, isRefreshing]);

  // Get display path (truncate if too long)
  const displayPath = projectPath.length > 40
    ? '...' + projectPath.slice(-37)
    : projectPath || 'No project selected';

  return (
    <header
      className="flex items-center justify-between px-4 md:px-5 h-14 bg-card border-b border-border sticky top-0 z-50 shadow-sm"
      role="banner"
    >
      {/* Left side - Menu button (mobile) and Logo */}
      <div className="flex items-center gap-3">
        {/* Mobile menu toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuClick}
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </Button>

        {/* Logo / Brand */}
        <Link
          to="/"
          className="flex items-center gap-2 text-lg font-semibold text-primary hover:opacity-80 transition-opacity"
        >
          <Workflow className="w-6 h-6" />
          <span className="hidden sm:inline">Claude Code Workflow</span>
          <span className="sm:hidden">CCW</span>
        </Link>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-2">
        {/* Project path indicator */}
        {projectPath && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md text-sm text-muted-foreground max-w-[300px]">
            <span className="truncate" title={projectPath}>
              {displayPath}
            </span>
          </div>
        )}

        {/* Refresh button */}
        {onRefresh && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Refresh workspace"
            title="Refresh workspace"
          >
            <RefreshCw
              className={cn('w-5 h-5', isRefreshing && 'animate-spin')}
            />
          </Button>
        )}

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </Button>

        {/* User menu dropdown - simplified version */}
        <div className="relative group">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="User menu"
            title="User menu"
          >
            <User className="w-5 h-5" />
          </Button>

          {/* Dropdown menu */}
          <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
            <div className="py-1">
              <Link
                to="/settings"
                className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-hover transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </Link>
              <hr className="my-1 border-border" />
              <button
                className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-hover hover:text-foreground transition-colors w-full text-left"
                onClick={() => {
                  // Placeholder for logout action
                  console.log('Logout clicked');
                }}
              >
                <LogOut className="w-4 h-4" />
                <span>Exit Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
