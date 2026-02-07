// ========================================
// Workspace Selector Component
// ========================================
// Dropdown for selecting recent workspaces with folder browser and manual path input

import { useState, useCallback, useRef } from 'react';
import { ChevronDown, X, FolderOpen, Check } from 'lucide-react';
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

  // Hidden file input for folder selection
  const folderInputRef = useRef<HTMLInputElement>(null);

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
   * Handle open folder browser - trigger hidden file input click
   */
  const handleBrowseFolder = useCallback(() => {
    setIsDropdownOpen(false);
    // Trigger the hidden file input click
    folderInputRef.current?.click();
  }, []);

  /**
   * Handle folder selection from file input
   */
  const handleFolderSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        // Get the path from the first file
        const firstFile = files[0];
        // The webkitRelativePath contains the full path relative to the selected folder
        // We need to get the parent directory path
        const relativePath = firstFile.webkitRelativePath;
        const folderPath = relativePath.substring(0, relativePath.indexOf('/'));

        // In browser environment, we can't get the full absolute path
        // We need to ask the user to confirm or use the folder name
        // For now, open the manual dialog with the folder name as hint
        setManualPath(folderPath);
        setIsBrowseOpen(true);
      }
      // Reset input value to allow selecting the same folder again
      e.target.value = '';
    },
    []
  );

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
                    'flex items-center gap-2 cursor-pointer group/path-item pr-8',
                    isCurrent && 'bg-accent/50'
                  )}
                  title={path}
                >
                  <span className={cn(
                    'flex-1 truncate',
                    isCurrent && 'font-medium'
                  )}>
                    {truncatedItemPath}
                  </span>

                  {/* Delete button for non-current paths */}
                  {!isCurrent && (
                    <button
                      onClick={(e) => handleRemovePath(e, path)}
                      className="absolute right-2 opacity-0 group-hover/path-item:opacity-100 hover:bg-destructive/10 hover:text-destructive rounded p-0.5 transition-all"
                      aria-label={formatMessage({ id: 'workspace.selector.removePath' })}
                      title={formatMessage({ id: 'workspace.selector.removePath' })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* Check icon for current workspace */}
                  {isCurrent && (
                    <Check className="h-4 w-4 text-emerald-500 absolute right-2" />
                  )}
                </DropdownMenuItem>
              );
            })
          )}

          {recentPaths.length > 0 && <DropdownMenuSeparator />}

          {/* Browse button to open folder selector */}
          <DropdownMenuItem
            onClick={handleBrowseFolder}
            className="cursor-pointer gap-2"
          >
            <FolderOpen className="h-4 w-4" />
            <div className="flex-1">
              <div className="font-medium">
                {formatMessage({ id: 'workspace.selector.browse' })}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatMessage({ id: 'workspace.selector.browseHint' })}
              </div>
            </div>
          </DropdownMenuItem>

          {/* Manual path input option */}
          <DropdownMenuItem
            onClick={() => {
              setIsDropdownOpen(false);
              setIsBrowseOpen(true);
            }}
            className="cursor-pointer gap-2"
          >
            <span className="flex-1">
              {formatMessage({ id: 'workspace.selector.manualPath' })}
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Hidden file input for folder selection */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <input
        ref={folderInputRef}
        type="file"
        {...({ webkitdirectory: '', directory: '' } as any)}
        style={{ display: 'none' }}
        onChange={handleFolderSelect}
        aria-hidden="true"
        tabIndex={-1}
      />

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
