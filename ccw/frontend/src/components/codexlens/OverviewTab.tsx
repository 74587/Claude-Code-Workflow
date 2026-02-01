// ========================================
// CodexLens Overview Tab
// ========================================
// Overview status display and quick actions for CodexLens

import { useIntl } from 'react-intl';
import {
  Database,
  FileText,
  CheckCircle2,
  XCircle,
  RotateCw,
  Zap,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { CodexLensVenvStatus, CodexLensConfig } from '@/lib/api';

interface OverviewTabProps {
  installed: boolean;
  status?: CodexLensVenvStatus;
  config?: CodexLensConfig;
  isLoading: boolean;
}

export function OverviewTab({ installed, status, config, isLoading }: OverviewTabProps) {
  const { formatMessage } = useIntl();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4">
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded w-20 mb-2" />
                <div className="h-8 bg-muted rounded w-16" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!installed) {
    return (
      <Card className="p-8 text-center">
        <Database className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {formatMessage({ id: 'codexlens.overview.notInstalled.title' })}
        </h3>
        <p className="text-muted-foreground">
          {formatMessage({ id: 'codexlens.overview.notInstalled.message' })}
        </p>
      </Card>
    );
  }

  const isReady = status?.ready ?? false;
  const version = status?.version ?? 'Unknown';
  const indexDir = config?.index_dir ?? '~/.codexlens/indexes';
  const indexCount = config?.index_count ?? 0;

  return (
    <div className="space-y-6">
      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Installation Status */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              isReady ? 'bg-success/10' : 'bg-warning/10'
            )}>
              {isReady ? (
                <CheckCircle2 className="w-5 h-5 text-success" />
              ) : (
                <XCircle className="w-5 h-5 text-warning" />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'codexlens.overview.status.installation' })}
              </p>
              <p className="text-lg font-semibold text-foreground">
                {isReady
                  ? formatMessage({ id: 'codexlens.overview.status.ready' })
                  : formatMessage({ id: 'codexlens.overview.status.notReady' })
                }
              </p>
            </div>
          </div>
        </Card>

        {/* Version */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'codexlens.overview.status.version' })}
              </p>
              <p className="text-lg font-semibold text-foreground">{version}</p>
            </div>
          </div>
        </Card>

        {/* Index Path */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info/10">
              <FileText className="w-5 h-5 text-info" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'codexlens.overview.status.indexPath' })}
              </p>
              <p className="text-sm font-semibold text-foreground truncate" title={indexDir}>
                {indexDir}
              </p>
            </div>
          </div>
        </Card>

        {/* Index Count */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Zap className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'codexlens.overview.status.indexCount' })}
              </p>
              <p className="text-lg font-semibold text-foreground">{indexCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {formatMessage({ id: 'codexlens.overview.actions.title' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <QuickActionButton
              icon={<RotateCw className="w-4 h-4" />}
              label={formatMessage({ id: 'codexlens.overview.actions.ftsFull' })}
              description={formatMessage({ id: 'codexlens.overview.actions.ftsFullDesc' })}
              disabled={!isReady}
            />
            <QuickActionButton
              icon={<Zap className="w-4 h-4" />}
              label={formatMessage({ id: 'codexlens.overview.actions.ftsIncremental' })}
              description={formatMessage({ id: 'codexlens.overview.actions.ftsIncrementalDesc' })}
              disabled={!isReady}
            />
            <QuickActionButton
              icon={<RotateCw className="w-4 h-4" />}
              label={formatMessage({ id: 'codexlens.overview.actions.vectorFull' })}
              description={formatMessage({ id: 'codexlens.overview.actions.vectorFullDesc' })}
              disabled={!isReady}
            />
            <QuickActionButton
              icon={<Zap className="w-4 h-4" />}
              label={formatMessage({ id: 'codexlens.overview.actions.vectorIncremental' })}
              description={formatMessage({ id: 'codexlens.overview.actions.vectorIncrementalDesc' })}
              disabled={!isReady}
            />
          </div>
        </CardContent>
      </Card>

      {/* Venv Details */}
      {status && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {formatMessage({ id: 'codexlens.overview.venv.title' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {formatMessage({ id: 'codexlens.overview.venv.pythonVersion' })}
                </span>
                <span className="text-foreground font-mono">{status.pythonVersion || 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {formatMessage({ id: 'codexlens.overview.venv.venvPath' })}
                </span>
                <span className="text-foreground font-mono truncate ml-4" title={status.venvPath}>
                  {status.venvPath || 'Unknown'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface QuickActionButtonProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  disabled?: boolean;
}

function QuickActionButton({ icon, label, description, disabled }: QuickActionButtonProps) {
  const { formatMessage } = useIntl();

  const handleClick = () => {
    // TODO: Implement index operations in future tasks
    // For now, show a message that this feature is coming soon
    alert(formatMessage({ id: 'codexlens.comingSoon' }));
  };

  return (
    <Button
      variant="outline"
      className="h-auto p-4 flex flex-col items-start gap-2 text-left"
      onClick={handleClick}
      disabled={disabled}
    >
      <div className="flex items-center gap-2 w-full">
        <span className={cn('text-muted-foreground', disabled && 'opacity-50')}>
          {icon}
        </span>
        <span className="font-medium">{label}</span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </Button>
  );
}
