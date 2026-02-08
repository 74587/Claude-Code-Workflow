// ========================================
// CodexLens File Watcher Card
// ========================================
// Displays file watcher status, stats, and toggle control

import { useIntl } from 'react-intl';
import {
  Eye,
  EyeOff,
  Activity,
  Clock,
  FolderOpen,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useCodexLensWatcher, useCodexLensWatcherMutations } from '@/hooks';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

interface FileWatcherCardProps {
  disabled?: boolean;
}

export function FileWatcherCard({ disabled = false }: FileWatcherCardProps) {
  const { formatMessage } = useIntl();
  const projectPath = useWorkflowStore(selectProjectPath);
  const { running, rootPath, eventsProcessed, uptimeSeconds, isLoading } = useCodexLensWatcher();
  const { startWatcher, stopWatcher, isStarting, isStopping } = useCodexLensWatcherMutations();

  const isMutating = isStarting || isStopping;

  const handleToggle = async () => {
    if (running) {
      await stopWatcher();
    } else {
      await startWatcher(projectPath);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            <span>{formatMessage({ id: 'codexlens.watcher.title' })}</span>
          </div>
          <Badge variant={running ? 'success' : 'secondary'}>
            {running
              ? formatMessage({ id: 'codexlens.watcher.status.running' })
              : formatMessage({ id: 'codexlens.watcher.status.stopped' })
            }
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Activity className={cn('w-4 h-4', running ? 'text-success' : 'text-muted-foreground')} />
            <div>
              <p className="text-muted-foreground text-xs">
                {formatMessage({ id: 'codexlens.watcher.eventsProcessed' })}
              </p>
              <p className="font-semibold text-foreground">{eventsProcessed}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className={cn('w-4 h-4', running ? 'text-info' : 'text-muted-foreground')} />
            <div>
              <p className="text-muted-foreground text-xs">
                {formatMessage({ id: 'codexlens.watcher.uptime' })}
              </p>
              <p className="font-semibold text-foreground">
                {running ? formatUptime(uptimeSeconds) : '--'}
              </p>
            </div>
          </div>
        </div>

        {/* Watched Path */}
        {running && rootPath && (
          <div className="flex items-center gap-2 text-sm">
            <FolderOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-muted-foreground truncate" title={rootPath}>
              {rootPath}
            </span>
          </div>
        )}

        {/* Toggle Button */}
        <Button
          variant={running ? 'outline' : 'default'}
          size="sm"
          className="w-full"
          onClick={handleToggle}
          disabled={disabled || isMutating || isLoading}
        >
          {running ? (
            <>
              <EyeOff className="w-4 h-4 mr-2" />
              {isStopping
                ? formatMessage({ id: 'codexlens.watcher.stopping' })
                : formatMessage({ id: 'codexlens.watcher.stop' })
              }
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 mr-2" />
              {isStarting
                ? formatMessage({ id: 'codexlens.watcher.starting' })
                : formatMessage({ id: 'codexlens.watcher.start' })
              }
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default FileWatcherCard;
