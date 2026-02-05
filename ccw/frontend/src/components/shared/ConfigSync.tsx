// ========================================
// Config Sync Component
// ========================================
// UI for GitHub config sync, backup operations, and directory selection

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import {
  Github,
  RefreshCw,
  HardDrive,
  FolderOpen,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ConfigSyncModal } from './ConfigSyncModal';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ========== Types ==========

export interface ConfigSyncProps {
  className?: string;
}

export interface BackupInfo {
  id: string;
  timestamp: string;
  fileCount: number;
  sizeBytes: number;
  configDirs: string[];
}

export interface SyncResult {
  success: boolean;
  syncedFiles: string[];
  error?: string;
}

export interface BackupResult {
  success: boolean;
  fileCount: number;
  backupPath?: string;
  error?: string;
}

// ========== Constants ==========

const AVAILABLE_DIRS = ['.claude', '.codex', '.gemini', '.qwen'] as const;
const DEFAULT_REPO_URL = 'https://github.com/dyw0830/ccw';
const DEFAULT_BRANCH = 'main';

// ========== Main Component ==========

export function ConfigSync({ className }: ConfigSyncProps) {
  const { formatMessage } = useIntl();
  const [syncing, setSyncing] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [repoUrl, setRepoUrl] = useState(DEFAULT_REPO_URL);
  const [branch, setBranch] = useState(DEFAULT_BRANCH);
  const [selectedDirs, setSelectedDirs] = useState<string[]>(['.claude']);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [lastBackupTime, setLastBackupTime] = useState<Date | null>(null);
  // Backup list loaded for future display (TODO: add backup list UI)
  const [_backupList, setBackupList] = useState<BackupInfo[]>([]);

  // Load backups on mount
  useEffect(() => {
    loadBackups();
  }, []);

  // Parse owner and repo from URL
  const parseRepoInfo = (): { owner: string; repo: string } | null => {
    try {
      const url = new URL(repoUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length >= 2) {
        return { owner: pathParts[0], repo: pathParts[1] };
      }
      return null;
    } catch {
      return null;
    }
  };

  // Handle sync operation
  const handleSync = async () => {
    const repoInfo = parseRepoInfo();
    if (!repoInfo) {
      toast.error('Invalid GitHub repository URL');
      return;
    }

    if (selectedDirs.length === 0) {
      toast.error('Please select at least one configuration directory');
      return;
    }

    setSyncing(true);
    try {
      const response = await fetch('/api/config/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          branch,
          configDirs: selectedDirs
        })
      });

      const data: SyncResult = await response.json();
      if (data.success) {
        setLastSyncTime(new Date());
        toast.success(`Sync completed! ${data.syncedFiles.length} file(s) updated`, {
          description: data.syncedFiles.slice(0, 3).join(', ') + (data.syncedFiles.length > 3 ? '...' : '')
        });
      } else {
        toast.error('Sync failed', {
          description: data.error || 'Unknown error'
        });
      }
    } catch (error) {
      toast.error('Sync failed', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setSyncing(false);
    }
  };

  // Handle backup operation
  const handleBackup = async () => {
    if (selectedDirs.length === 0) {
      toast.error('Please select at least one configuration directory');
      return;
    }

    setBackingUp(true);
    try {
      const response = await fetch('/api/config/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configDirs: selectedDirs })
      });

      const data: BackupResult = await response.json();
      if (data.success) {
        setLastBackupTime(new Date());
        toast.success(`Backup completed! ${data.fileCount} file(s) backed up`, {
          description: data.backupPath || 'Backup created successfully'
        });
        loadBackups();
      } else {
        toast.error('Backup failed', {
          description: data.error || 'Unknown error'
        });
      }
    } catch (error) {
      toast.error('Backup failed', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setBackingUp(false);
    }
  };

  // Load available backups
  const loadBackups = async () => {
    try {
      const response = await fetch('/api/config/backups');
      const data = await response.json();
      if (data.success) {
        setBackupList(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load backups:', error);
    }
  };

  // Toggle directory selection
  const toggleDir = (dir: string) => {
    setSelectedDirs((prev) =>
      prev.includes(dir) ? prev.filter((d) => d !== dir) : [...prev, dir]
    );
  };

  return (
    <Card className={className}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Github className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">
              {formatMessage({ id: 'configSync.title' }) || 'Configuration Sync & Backup'}
            </h3>
          </div>
          {(lastSyncTime || lastBackupTime) && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {lastSyncTime && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Last sync: {lastSyncTime.toLocaleTimeString()}
                </span>
              )}
              {lastBackupTime && (
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  Last backup: {lastBackupTime.toLocaleTimeString()}
                </span>
              )}
            </div>
          )}
        </div>

        {/* GitHub Configuration */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">
            {formatMessage({ id: 'configSync.githubRepo' }) || 'GitHub Repository'}
          </label>
          <Input
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
          />
          <div className="flex gap-2">
            <Input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder={formatMessage({ id: 'configSync.branch' }) || 'Branch (e.g., main)'}
              className="flex-1"
            />
            <Button
              onClick={() => setShowModal(true)}
              variant="outline"
              className="shrink-0"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              {formatMessage({ id: 'configSync.selectDirs' }) || 'Select Directories'}
            </Button>
          </div>
        </div>

        {/* Selected Directories */}
        {selectedDirs.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'configSync.selectedDirs' }) || 'Selected Directories'}
            </label>
            <div className="flex flex-wrap gap-2">
              {selectedDirs.map((dir) => (
                <Badge
                  key={dir}
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  onClick={() => toggleDir(dir)}
                >
                  {dir}
                  <button className="ml-1 hover:text-white" onClick={(e) => {
                    e.stopPropagation();
                    toggleDir(dir);
                  }}>
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={handleSync}
            disabled={syncing || selectedDirs.length === 0}
            className="w-full"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
            {syncing
              ? (formatMessage({ id: 'configSync.syncing' }) || 'Syncing...')
              : (formatMessage({ id: 'configSync.syncNow' }) || 'Sync Now')
            }
          </Button>
          <Button
            onClick={handleBackup}
            disabled={backingUp || selectedDirs.length === 0}
            variant="secondary"
            className="w-full"
          >
            <HardDrive className={cn("w-4 h-4 mr-2", backingUp && "animate-pulse")} />
            {backingUp
              ? (formatMessage({ id: 'configSync.backingUp' }) || 'Backing up...')
              : (formatMessage({ id: 'configSync.backupNow' }) || 'Backup Now')
            }
          </Button>
        </div>

        {/* Available Directories Quick Select */}
        <div className="pt-4 border-t border-border">
          <label className="text-sm font-medium text-foreground mb-2 block">
            {formatMessage({ id: 'configSync.availableDirs' }) || 'Quick Select'}
          </label>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_DIRS.map((dir) => (
              <Badge
                key={dir}
                variant={selectedDirs.includes(dir) ? 'default' : 'outline'}
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => toggleDir(dir)}
              >
                {dir}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Directory Selection Modal */}
      {showModal && (
        <ConfigSyncModal
          selectedDirs={selectedDirs}
          onSelectedDirsChange={setSelectedDirs}
          onClose={() => setShowModal(false)}
        />
      )}
    </Card>
  );
}

export default ConfigSync;
