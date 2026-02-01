// ========================================
// Provider List Component
// ========================================
// Display providers as cards with search, filter, and actions

import { useState, useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Zap,
  Settings,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MoreVertical,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/Dropdown';
import {
  useProviders,
  useDeleteProvider,
  useUpdateProvider,
  useTestProvider,
  useTriggerProviderHealthCheck,
} from '@/hooks/useApiSettings';
import { useNotifications } from '@/hooks/useNotifications';
import type { ProviderCredential } from '@/lib/api';
import { cn } from '@/lib/utils';

// ========== Types ==========

export interface ProviderListProps {
  onAddProvider: () => void;
  onEditProvider: (providerId: string) => void;
  onMultiKeySettings: (providerId: string) => void;
  onSyncToCodexLens: (providerId: string) => void;
  onManageModels: (providerId: string) => void;
}

// ========== Helper Components ==========

interface ProviderCardProps {
  provider: ProviderCredential;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
  onMultiKeySettings: () => void;
  onSyncToCodexLens: () => void;
  onManageModels: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  isDeleting: boolean;
  isTesting: boolean;
  isToggling: boolean;
}

function ProviderCard({
  provider,
  onEdit,
  onDelete,
  onTest,
  onMultiKeySettings,
  onSyncToCodexLens,
  onManageModels,
  onToggleEnabled,
  isDeleting,
  isTesting,
  isToggling,
}: ProviderCardProps) {
  const { formatMessage } = useIntl();

  // Count enabled multi-keys
  const multiKeyCount = provider.apiKeys?.filter((k) => k.enabled).length || 0;
  const hasMultiKeys = (provider.apiKeys?.length || 0) > 0;

  // Health status badge
  const getHealthBadge = () => {
    if (!provider.enabled) {
      return <Badge variant="secondary">{formatMessage({ id: 'apiSettings.common.disabled' })}</Badge>;
    }
    if (!provider.healthCheck?.enabled) {
      return <Badge variant="outline">{formatMessage({ id: 'apiSettings.providers.unknown' })}</Badge>;
    }
    // Check key health statuses
    const keys = provider.apiKeys || [];
    if (keys.length === 0) {
      return <Badge variant="info">{formatMessage({ id: 'apiSettings.providers.unknown' })}</Badge>;
    }
    const healthyCount = keys.filter((k) => k.healthStatus === 'healthy').length;
    const unhealthyCount = keys.filter((k) => k.healthStatus === 'unhealthy').length;

    if (unhealthyCount > 0) {
      return <Badge variant="destructive">{formatMessage({ id: 'apiSettings.providers.unhealthy' })}</Badge>;
    }
    if (healthyCount === keys.length) {
      return <Badge variant="success">{formatMessage({ id: 'apiSettings.providers.healthy' })}</Badge>;
    }
    return <Badge variant="warning">{formatMessage({ id: 'apiSettings.providers.unknown' })}</Badge>;
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        {/* Left: Provider Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-foreground truncate">{provider.name}</h3>
            {getHealthBadge()}
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span className="capitalize">{provider.type}</span>
            {hasMultiKeys && (
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {multiKeyCount} {formatMessage({ id: 'apiSettings.providers.apiKey' })}
              </span>
            )}
            {provider.routingStrategy && (
              <span className="capitalize">{provider.routingStrategy.replace('-', ' ')}</span>
            )}
          </div>
          {provider.apiBase && (
            <p className="text-xs text-muted-foreground mt-1 truncate">{provider.apiBase}</p>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Switch
            checked={provider.enabled}
            onCheckedChange={onToggleEnabled}
            disabled={isToggling}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="w-4 h-4 mr-2" />
                {formatMessage({ id: 'apiSettings.providers.actions.edit' })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onTest} disabled={isTesting}>
                <Zap className="w-4 h-4 mr-2" />
                {formatMessage({ id: 'apiSettings.providers.actions.test' })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onManageModels}>
                <Settings className="w-4 h-4 mr-2" />
                {formatMessage({ id: 'apiSettings.providers.actions.manageModels' })}
              </DropdownMenuItem>
              {hasMultiKeys && (
                <DropdownMenuItem onClick={onMultiKeySettings}>
                  <Zap className="w-4 h-4 mr-2" />
                  {formatMessage({ id: 'apiSettings.providers.actions.multiKeySettings' })}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onSyncToCodexLens}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {formatMessage({ id: 'apiSettings.providers.actions.syncToCodexLens' })}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} disabled={isDeleting} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                {formatMessage({ id: 'apiSettings.providers.actions.delete' })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}

// ========== Main Component ==========

export function ProviderList({
  onAddProvider,
  onEditProvider,
  onMultiKeySettings,
  onSyncToCodexLens,
  onManageModels,
}: ProviderListProps) {
  const { formatMessage } = useIntl();
  const { showNotification } = useNotifications();
  const [searchQuery, setSearchQuery] = useState('');
  const [showDisabledOnly, setShowDisabledOnly] = useState(false);

  const {
    providers,
    isLoading,
    refetch,
  } = useProviders();

  const { deleteProvider, isDeleting } = useDeleteProvider();
  const { updateProvider, isUpdating } = useUpdateProvider();
  const { testProvider, isTesting } = useTestProvider();
  const { triggerHealthCheck } = useTriggerProviderHealthCheck();

  // Filter providers based on search and filter
  const filteredProviders = useMemo(() => {
    return providers.filter((provider) => {
      const matchesSearch =
        provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        provider.type.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = !showDisabledOnly || !provider.enabled;
      return matchesSearch && matchesFilter;
    });
  }, [providers, searchQuery, showDisabledOnly]);

  // Actions
  const handleDeleteProvider = async (providerId: string, providerName: string) => {
    const confirmMessage = formatMessage(
      { id: 'apiSettings.providers.deleteConfirm' },
      { name: providerName }
    );
    if (window.confirm(confirmMessage)) {
      try {
        await deleteProvider(providerId);
      } catch (error) {
        showNotification('error', formatMessage({ id: 'apiSettings.providers.deleteError' }));
      }
    }
  };

  const handleToggleEnabled = async (providerId: string, enabled: boolean) => {
    try {
      await updateProvider(providerId, { enabled });
    } catch (error) {
      showNotification('error', formatMessage({ id: 'apiSettings.providers.toggleError' }));
    }
  };

  const handleTestProvider = async (providerId: string) => {
    try {
      const result = await testProvider(providerId);
      if (result.success) {
        // Trigger health check refresh
        await triggerHealthCheck(providerId);
      }
    } catch (error) {
      showNotification('error', formatMessage({ id: 'apiSettings.providers.testError' }));
    }
  };

  // Stats
  const enabledCount = providers.filter((p) => p.enabled).length;
  const totalCount = providers.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {formatMessage({ id: 'apiSettings.providers.title' })}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'apiSettings.providers.description' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <Zap className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
            {formatMessage({ id: 'common.actions.refresh' })}
          </Button>
          <Button onClick={onAddProvider}>
            <Plus className="w-4 h-4 mr-2" />
            {formatMessage({ id: 'apiSettings.providers.actions.add' })}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-primary" />
            <span className="text-2xl font-bold">{totalCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'apiSettings.providers.stats.total' })}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <span className="text-2xl font-bold">{enabledCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'apiSettings.providers.stats.enabled' })}
          </p>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={formatMessage({ id: 'apiSettings.common.searchPlaceholder' })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showDisabledOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowDisabledOnly((prev) => !prev)}
          >
            {showDisabledOnly ? (
              <XCircle className="w-4 h-4 mr-2" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-2" />
            )}
            {showDisabledOnly
              ? formatMessage({ id: 'apiSettings.providers.actions.hideDisabled' })
              : formatMessage({ id: 'apiSettings.providers.actions.showDisabled' })}
          </Button>
        </div>
      </div>

      {/* Provider List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : filteredProviders.length === 0 ? (
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium text-foreground">
            {formatMessage({ id: 'apiSettings.providers.emptyState.title' })}
          </h3>
          <p className="mt-2 text-muted-foreground">
            {formatMessage({ id: 'apiSettings.providers.emptyState.message' })}
          </p>
          <Button className="mt-4" onClick={onAddProvider}>
            <Plus className="w-4 h-4 mr-2" />
            {formatMessage({ id: 'apiSettings.providers.actions.add' })}
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredProviders.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              onEdit={() => onEditProvider(provider.id)}
              onDelete={() => handleDeleteProvider(provider.id, provider.name)}
              onTest={() => handleTestProvider(provider.id)}
              onMultiKeySettings={() => onMultiKeySettings(provider.id)}
              onSyncToCodexLens={() => onSyncToCodexLens(provider.id)}
              onManageModels={() => onManageModels(provider.id)}
              onToggleEnabled={(enabled) => handleToggleEnabled(provider.id, enabled)}
              isDeleting={isDeleting}
              isTesting={isTesting}
              isToggling={isUpdating}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ProviderList;
