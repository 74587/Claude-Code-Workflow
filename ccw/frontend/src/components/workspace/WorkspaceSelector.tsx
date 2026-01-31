// ========================================
// Workspace Selector Component
// ========================================
// Dropdown for selecting recent workspaces with manual path input dialog

import { useState, useCallback } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/Dropdown';
import { useWorkflowStore } from '@/stores/workflowStore';

export interface WorkspaceSelectorProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Truncate path to maximum length with ellipsis prefix
 * Shows ".../last/folder" for paths longer than maxChars
 */
function truncatePath(path: string, maxChars: number = 40): string {
  if (path.length <= maxChars) {
    return path;
  }

  // For Windows paths: C:\Users\...\folder
  // For Unix paths: /home/user/.../folder
  const separator = path.includes('\\') ? '\\' : '/';
  const parts = path.split(separator);

  // Start from the end and build up until we hit the limit
  const result: string[] = [];
  let currentLength = 3; // Start with '...' length

  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (!part) continue;

    const newLength = currentLength + part.length + 1;
    if (newLength > maxChars && result.length > 0) {
      break;
    }

    result.unshift(part);
    currentLength = newLength;
  }

  return '...' + separator + result.join(separator);
}

/**
 * Workspace selector component
 *
 * Provides a dropdown menu for selecting from recent workspace paths,
 * a manual path input dialog for entering custom paths, and delete buttons
 * for removing paths from recent history.
 *
 * @example
 * ```tsx
 * <WorkspaceSelector />
 * ```
 */
export function WorkspaceSelector({ className }: WorkspaceSelectorProps) {
  const { formatMessage } = useIntl();
  const projectPath = useWorkflowStore((state) => state.projectPath);
  const recentPaths = useWorkflowStore((state) => state.recentPaths);
  const switchWorkspace = useWorkflowStore((state) => state.switchWorkspace);
  const removeRecentPath = useWorkflowStore((state) => state.removeRecentPath);

  // UI state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isBrowseOpen, setIsBrowseOpen] = useState(false);
  const [manualPath, setManualPath] = useState('');

  /**
   * Handle path selection from dropdown
   */
  const handleSelectPath = useCallback(
    async (path: string) => {
      await switchWorkspace(path);
      setIsDropdownOpen(false);
    },
    [switchWorkspace]
  );

  /**
   * Handle remove path from recent history
   */
  const handleRemovePath = useCallback(
    async (e: React.MouseEvent, path: string) => {
      e.stopPropagation(); // Prevent triggering selection
      await removeRecentPath(path);
    },
    [removeRecentPath]
  );

  /**
   * Handle open browse dialog - tries file dialog first, falls back to manual input
   */
  const handleBrowseFolder = useCallback(async () => {
    setIsDropdownOpen(false);

    // Try to use Electron/Electron-Tauri file dialog API if available
    if ((window as any).electronAPI?.showOpenDialog) {
      try {
        const result = await (window as any).electronAPI.showOpenDialog({
          properties: ['openDirectory'],
        });

        if (result && result.filePaths && result.filePaths.length > 0) {
          const selectedPath = result.filePaths[0];
          await switchWorkspace(selectedPath);
          return;
        }
      } catch (error) {
        console.error('Failed to open folder dialog:', error);
        // Fall through to manual input dialog
      }
    }

    // Fallback: open manual path input dialog
    setIsBrowseOpen(true);
  }, []);

  /**
   * Handle manual path submission
   */
  const handleManualPathSubmit = useCallback(async () => {
    const trimmedPath = manualPath.trim();
    if (!trimmedPath) {
      return; // TODO: Show validation error
    }

    await switchWorkspace(trimmedPath);
    setIsBrowseOpen(false);
    setManualPath('');
  }, [manualPath, switchWorkspace]);

  /**
   * Handle dialog cancel
   */
  const handleDialogCancel = useCallback(() => {
    setIsBrowseOpen(false);
    setManualPath('');
  }, []);

  /**
   * Handle keyboard events in dialog input
   */
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleManualPathSubmit();
      }
    },
    [handleManualPathSubmit]
  );

  const displayPath = projectPath || formatMessage({ id: 'workspace.selector.noWorkspace' });
  const truncatedPath = truncatePath(displayPath, 40);

  return (
    <>
      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn('gap-2 max-w-[300px]', className)}
            aria-label={formatMessage({ id: 'workspace.selector.ariaLabel' })}
          >
            <span className="truncate" title={displayPath}>
              {truncatedPath}
            </span>
            <ChevronDown className="h-4 w-4 flex-shrink-0" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-80">
          <DropdownMenuLabel>
            {formatMessage({ id: 'workspace.selector.recentPaths' })}
          </DropdownMenuLabel>

          {recentPaths.length > 0 && <DropdownMenuSeparator />}

          {recentPaths.length === 0 ? (
            <div className="px-2 py-4 text-sm text-muted-foreground text-center">
              {formatMessage({ id: 'workspace.selector.noRecentPaths' })}
            </div>
          ) : (
            recentPaths.map((path) => {
              const isCurrent = path === projectPath;
              const truncatedItemPath = truncatePath(path, 50);

              return (
                <DropdownMenuItem
                  key={path}
                  onClick={() => handleSelectPath(path)}
                  className={cn(
                    'flex items-center gap-2 cursor-pointer group',
                    isCurrent && 'bg-accent'
                  )}
                  title={path}
                >
                  <span className="flex-1 truncate">{truncatedItemPath}</span>

                  {/* Delete button for non-current paths */}
                  {!isCurrent && (
                    <button
                      onClick={(e) => handleRemovePath(e, path)}
                      className="opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground rounded p-0.5 transition-opacity"
                      aria-label={formatMessage({ id: 'workspace.selector.removePath' })}
                      title={formatMessage({ id: 'workspace.selector.removePath' })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {isCurrent && (
                    <span className="text-xs text-primary">
                      {formatMessage({ id: 'workspace.selector.current' })}
                    </span>
                  )}
                </DropdownMenuItem>
              );
            })
          )}

          {recentPaths.length > 0 && <DropdownMenuSeparator />}

          {/* Browse button to open manual path dialog */}
          <DropdownMenuItem
            onClick={handleBrowseFolder}
            className="cursor-pointer"
          >
            {formatMessage({ id: 'workspace.selector.browse' })}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Manual path input dialog */}
      <Dialog open={isBrowseOpen} onOpenChange={setIsBrowseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {formatMessage({ id: 'workspace.selector.dialog.title' })}
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <Input
              value={manualPath}
              onChange={(e) => setManualPath(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={formatMessage({ id: 'workspace.selector.dialog.placeholder' })}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleDialogCancel}
            >
              {formatMessage({ id: 'common.actions.cancel' })}
            </Button>
            <Button
              onClick={handleManualPathSubmit}
              disabled={!manualPath.trim()}
            >
              {formatMessage({ id: 'common.actions.submit' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default WorkspaceSelector;
