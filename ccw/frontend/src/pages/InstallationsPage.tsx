// ========================================
// CLI Installations Page
// ========================================
// Manage CCW CLI tool installations (install, upgrade, uninstall)

import { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  Download,
  Upload,
  Trash2,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Package,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select';
import {
  useCliInstallations,
  useInstallCliTool,
  useUninstallCliTool,
  useUpgradeCliTool,
} from '@/hooks';
import type { CliInstallation } from '@/lib/api';
import { cn } from '@/lib/utils';

// ========== Installation Card Component ==========

interface InstallationCardProps {
  installation: CliInstallation;
  onInstall: (toolName: string) => void;
  onUninstall: (toolName: string) => void;
  onUpgrade: (toolName: string) => void;
  isInstalling: boolean;
  isUninstalling: boolean;
  isUpgrading: boolean;
}

function InstallationCard({
  installation,
  onInstall,
  onUninstall,
  onUpgrade,
  isInstalling,
  isUninstalling,
  isUpgrading,
}: InstallationCardProps) {
  const { formatMessage } = useIntl();

  const statusConfig = {
    active: { icon: CheckCircle, color: 'text-green-600', label: 'cliInstallations.status.active' },
    inactive: { icon: XCircle, color: 'text-muted-foreground', label: 'cliInstallations.status.inactive' },
    error: { icon: AlertCircle, color: 'text-destructive', label: 'cliInstallations.status.error' },
  };

  const config = statusConfig[installation.status];
  const StatusIcon = config.icon;

  const isLoading = isInstalling || isUninstalling || isUpgrading;

  return (
    <Card className={cn('p-4', !installation.installed && 'opacity-60')}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            'p-2 rounded-lg',
            installation.installed ? 'bg-primary/10' : 'bg-muted'
          )}>
            <Package className={cn(
              'w-5 h-5',
              installation.installed ? 'text-primary' : 'text-muted-foreground'
            )} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {installation.name}
              </span>
              {installation.version && (
                <Badge variant="outline" className="text-xs">
                  v{installation.version}
                </Badge>
              )}
              <Badge variant="outline" className={cn('text-xs', config.color)}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {formatMessage({ id: config.label })}
              </Badge>
              {installation.installed && (
                <Badge variant="outline" className="text-xs text-green-600">
                  {formatMessage({ id: 'cliInstallations.installed' })}
                </Badge>
              )}
            </div>
            {installation.path && (
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                {installation.path}
              </p>
            )}
            {installation.lastChecked && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatMessage({ id: 'cliInstallations.lastChecked' })}: {new Date(installation.lastChecked).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {installation.installed ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onUpgrade(installation.name)}
                disabled={isLoading}
              >
                <Upload className="w-4 h-4 mr-1" />
                {formatMessage({ id: 'cliInstallations.actions.upgrade' })}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onUninstall(installation.name)}
                disabled={isLoading}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                {formatMessage({ id: 'cliInstallations.actions.uninstall' })}
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => onInstall(installation.name)}
              disabled={isLoading}
            >
              <Download className="w-4 h-4 mr-1" />
              {formatMessage({ id: 'cliInstallations.actions.install' })}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ========== Main Page Component ==========

export function InstallationsPage() {
  const { formatMessage } = useIntl();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'installed' | 'not-installed'>('all');

  const {
    installations,
    totalCount,
    installedCount,
    isLoading,
    isFetching,
    refetch,
  } = useCliInstallations();

  const { installTool, isInstalling } = useInstallCliTool();
  const { uninstallTool, isUninstalling } = useUninstallCliTool();
  const { upgradeTool, isUpgrading } = useUpgradeCliTool();

  const handleInstall = (toolName: string) => {
    installTool(toolName);
  };

  const handleUninstall = (toolName: string) => {
    if (confirm(formatMessage({ id: 'cliInstallations.uninstallConfirm' }, { name: toolName }))) {
      uninstallTool(toolName);
    }
  };

  const handleUpgrade = (toolName: string) => {
    upgradeTool(toolName);
  };

  // Filter installations by search query and status
  const filteredInstallations = (() => {
    let filtered = installations;

    if (statusFilter === 'installed') {
      filtered = filtered.filter((i) => i.installed);
    } else if (statusFilter === 'not-installed') {
      filtered = filtered.filter((i) => !i.installed);
    }

    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter((i) =>
        i.name.toLowerCase().includes(searchLower) ||
        (i.version && i.version.toLowerCase().includes(searchLower))
      );
    }

    return filtered;
  })();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            {formatMessage({ id: 'cliInstallations.title' })}
          </h1>
          <p className="text-muted-foreground mt-1">
            {formatMessage({ id: 'cliInstallations.description' })}
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn('w-4 h-4 mr-2', isFetching && 'animate-spin')} />
          {formatMessage({ id: 'common.actions.refresh' })}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            <span className="text-2xl font-bold">{totalCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'cliInstallations.stats.total' })}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-2xl font-bold">{installedCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'cliInstallations.stats.installed' })}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-muted-foreground" />
            <span className="text-2xl font-bold">{totalCount - installedCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'cliInstallations.stats.available' })}</p>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={formatMessage({ id: 'cliInstallations.filters.searchPlaceholder' })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v: typeof statusFilter) => setStatusFilter(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={formatMessage({ id: 'cliInstallations.filters.status' })} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{formatMessage({ id: 'cliInstallations.filters.all' })}</SelectItem>
            <SelectItem value="installed">{formatMessage({ id: 'cliInstallations.filters.installed' })}</SelectItem>
            <SelectItem value="not-installed">{formatMessage({ id: 'cliInstallations.filters.notInstalled' })}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Installations List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : filteredInstallations.length === 0 ? (
        <Card className="p-8 text-center">
          <Package className="w-12 h-12 mx-auto text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium text-foreground">{formatMessage({ id: 'cliInstallations.emptyState.title' })}</h3>
          <p className="mt-2 text-muted-foreground">
            {formatMessage({ id: 'cliInstallations.emptyState.message' })}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredInstallations.map((installation) => (
            <InstallationCard
              key={installation.name}
              installation={installation}
              onInstall={handleInstall}
              onUninstall={handleUninstall}
              onUpgrade={handleUpgrade}
              isInstalling={isInstalling}
              isUninstalling={isUninstalling}
              isUpgrading={isUpgrading}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default InstallationsPage;
