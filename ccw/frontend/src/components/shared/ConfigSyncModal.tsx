// ========================================
// Config Sync Modal Component
// ========================================
// Modal for selecting configuration directories to sync/backup

import { useIntl } from 'react-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Folder, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

// ========== Constants ==========

const AVAILABLE_DIRS = ['.claude', '.codex', '.gemini', '.qwen'] as const;

const DIR_DESCRIPTIONS: Record<string, string> = {
  '.claude': 'CCW global configuration and workflow settings',
  '.codex': 'Codex CLI tool configuration and history',
  '.gemini': 'Gemini CLI tool configuration and history',
  '.qwen': 'Qwen CLI tool configuration and history',
};

// ========== Types ==========

export interface ConfigSyncModalProps {
  selectedDirs: string[];
  onSelectedDirsChange: (dirs: string[]) => void;
  onClose: () => void;
}

// ========== Helper Components ==========

interface DirectoryItemProps {
  dir: string;
  description: string;
  selected: boolean;
  onToggle: () => void;
}

function DirectoryItem({ dir, description, selected, onToggle }: DirectoryItemProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
        "hover:bg-accent hover:border-accent-foreground/20",
        selected && "bg-accent/50 border-accent-foreground/30"
      )}
      onClick={onToggle}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={onToggle}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {selected ? (
            <FolderOpen className="w-4 h-4 text-primary" />
          ) : (
            <Folder className="w-4 h-4 text-muted-foreground" />
          )}
          <Label htmlFor={`dir-${dir}`} className="font-medium cursor-pointer">
            {dir}
          </Label>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {description}
        </p>
      </div>
    </div>
  );
}

// ========== Main Component ==========

export function ConfigSyncModal({
  selectedDirs,
  onSelectedDirsChange,
  onClose
}: ConfigSyncModalProps) {
  const { formatMessage } = useIntl();

  const toggleDir = (dir: string) => {
    if (selectedDirs.includes(dir)) {
      onSelectedDirsChange(selectedDirs.filter((d) => d !== dir));
    } else {
      onSelectedDirsChange([...selectedDirs, dir]);
    }
  };

  const selectAll = () => {
    onSelectedDirsChange([...AVAILABLE_DIRS]);
  };

  const clearAll = () => {
    onSelectedDirsChange([]);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            {formatMessage({ id: 'configSync.modal.title' }) || 'Select Configuration Directories'}
          </DialogTitle>
          <DialogDescription>
            {formatMessage({ id: 'configSync.modal.description' }) ||
              'Choose which configuration directories to sync or backup'}
          </DialogDescription>
        </DialogHeader>

        {/* Quick Actions */}
        <div className="flex gap-2 pb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={selectAll}
            disabled={selectedDirs.length === AVAILABLE_DIRS.length}
            className="flex-1"
          >
            {formatMessage({ id: 'configSync.modal.selectAll' }) || 'Select All'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
            disabled={selectedDirs.length === 0}
            className="flex-1"
          >
            {formatMessage({ id: 'configSync.modal.clearAll' }) || 'Clear All'}
          </Button>
        </div>

        {/* Directory List */}
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {AVAILABLE_DIRS.map((dir) => (
            <DirectoryItem
              key={dir}
              dir={dir}
              description={DIR_DESCRIPTIONS[dir]}
              selected={selectedDirs.includes(dir)}
              onToggle={() => toggleDir(dir)}
            />
          ))}
        </div>

        {/* Summary */}
        {selectedDirs.length > 0 && (
          <div className="pt-2 border-t border-border">
            <p className="text-sm text-muted-foreground">
              {formatMessage(
                { id: 'configSync.modal.selectedCount' },
                { count: selectedDirs.length }
              ) || `${selectedDirs.length} director${selectedDirs.length > 1 ? 'ies' : 'y'} selected`}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {formatMessage({ id: 'common.actions.cancel' }) || 'Cancel'}
          </Button>
          <Button onClick={onClose}>
            {formatMessage({ id: 'common.actions.confirm' }) || 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConfigSyncModal;
