// ========================================
// Endpoint List Component
// ========================================
// Display endpoints as cards with search, filter, and actions

import { useState, useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Zap,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Database,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/Dropdown';
import {
  useEndpoints,
  useDeleteEndpoint,
  useUpdateEndpoint,
} from '@/hooks/useApiSettings';
import { useNotifications } from '@/hooks/useNotifications';
import type { CustomEndpoint } from '@/lib/api';
import { cn } from '@/lib/utils';

// ========== Types ==========

export interface EndpointListProps {
  onAddEndpoint: () => void;
  onEditEndpoint: (endpointId: string) => void;
}

// ========== Helper Components ==========

interface EndpointCardProps {
  endpoint: CustomEndpoint;
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  isDeleting: boolean;
  isToggling: boolean;
}

function EndpointCard({
  endpoint,
  onEdit,
  onDelete,
  onToggleEnabled,
  isDeleting,
  isToggling,
}: EndpointCardProps) {
  const { formatMessage } = useIntl();

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        {/* Left: Endpoint Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-foreground font-mono">{endpoint.id}</h3>
            {endpoint.enabled ? (
              <Badge variant="success">{formatMessage({ id: 'apiSettings.common.enabled' })}</Badge>
            ) : (
              <Badge variant="secondary">{formatMessage({ id: 'apiSettings.common.disabled' })}</Badge>
            )}
            {endpoint.cacheStrategy.enabled && (
              <Badge variant="info" className="flex items-center gap-1">
                <Database className="w-3 h-3" />
                {formatMessage({ id: 'apiSettings.endpoints.cacheStrategy' })}
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium text-foreground mt-1">{endpoint.name}</p>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span>
              {formatMessage({ id: 'apiSettings.endpoints.provider' })}: {endpoint.providerId}
            </span>
            <span>
              {formatMessage({ id: 'apiSettings.endpoints.model' })}: {endpoint.model}
            </span>
          </div>
          {endpoint.description && (
            <p className="text-xs text-muted-foreground mt-1">{endpoint.description}</p>
          )}
          {endpoint.cacheStrategy.enabled && (
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span>TTL: {endpoint.cacheStrategy.ttlMinutes}m</span>
              <span>Max: {endpoint.cacheStrategy.maxSizeKB}KB</span>
              {endpoint.cacheStrategy.filePatterns.length > 0 && (
                <span>Patterns: {endpoint.cacheStrategy.filePatterns.length}</span>
              )}
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Switch
            checked={endpoint.enabled}
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
                {formatMessage({ id: 'apiSettings.endpoints.actions.edit' })}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} disabled={isDeleting} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                {formatMessage({ id: 'apiSettings.endpoints.actions.delete' })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}

// ========== Main Component ==========

export function EndpointList({
  onAddEndpoint,
  onEditEndpoint,
}: EndpointListProps) {
  const { formatMessage } = useIntl();
  const { showNotification } = useNotifications();
  const [searchQuery, setSearchQuery] = useState('');
  const [showDisabledOnly, setShowDisabledOnly] = useState(false);
  const [showCachedOnly, setShowCachedOnly] = useState(false);

  const {
    endpoints,
    cachedCount,
    isLoading,
    refetch,
  } = useEndpoints();

  const { deleteEndpoint, isDeleting } = useDeleteEndpoint();
  const { updateEndpoint, isUpdating } = useUpdateEndpoint();

  // Filter endpoints based on search and filter
  const filteredEndpoints = useMemo(() => {
    return endpoints.filter((endpoint) => {
      const matchesSearch =
        endpoint.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        endpoint.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        endpoint.model.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDisabledFilter = !showDisabledOnly || !endpoint.enabled;
      const matchesCacheFilter = !showCachedOnly || endpoint.cacheStrategy.enabled;
      return matchesSearch && matchesDisabledFilter && matchesCacheFilter;
    });
  }, [endpoints, searchQuery, showDisabledOnly, showCachedOnly]);

  // Actions
  const handleDeleteEndpoint = async (endpointId: string, endpointName: string) => {
    const confirmMessage = formatMessage(
      { id: 'apiSettings.endpoints.deleteConfirm' },
      { id: endpointName }
    );
    if (window.confirm(confirmMessage)) {
      try {
        await deleteEndpoint(endpointId);
      } catch (error) {
        showNotification('error', formatMessage({ id: 'apiSettings.endpoints.deleteError' }));
      }
    }
  };

  const handleToggleEnabled = async (endpointId: string, enabled: boolean) => {
    try {
      await updateEndpoint(endpointId, { enabled });
    } catch (error) {
      showNotification('error', formatMessage({ id: 'apiSettings.endpoints.toggleError' }));
    }
  };

  // Stats
  const totalCount = endpoints.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {formatMessage({ id: 'apiSettings.endpoints.title' })}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'apiSettings.endpoints.description' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <Zap className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
            {formatMessage({ id: 'common.actions.refresh' })}
          </Button>
          <Button onClick={onAddEndpoint}>
            <Plus className="w-4 h-4 mr-2" />
            {formatMessage({ id: 'apiSettings.endpoints.actions.add' })}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <span className="text-2xl font-bold">{totalCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'apiSettings.endpoints.stats.totalEndpoints' })}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-info" />
            <span className="text-2xl font-bold">{cachedCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'apiSettings.endpoints.stats.cachedEndpoints' })}
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
              ? formatMessage({ id: 'apiSettings.endpoints.actions.showAll' })
              : formatMessage({ id: 'apiSettings.endpoints.actions.showDisabled' })}
          </Button>
          <Button
            variant={showCachedOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowCachedOnly((prev) => !prev)}
          >
            <Database className="w-4 h-4 mr-2" />
            {showCachedOnly
              ? formatMessage({ id: 'apiSettings.endpoints.actions.showAll' })
              : formatMessage({ id: 'apiSettings.endpoints.cacheStrategy' })}
          </Button>
        </div>
      </div>

      {/* Endpoint List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : filteredEndpoints.length === 0 ? (
        <Card className="p-8 text-center">
          <Database className="w-12 h-12 mx-auto text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium text-foreground">
            {formatMessage({ id: 'apiSettings.endpoints.emptyState.title' })}
          </h3>
          <p className="mt-2 text-muted-foreground">
            {formatMessage({ id: 'apiSettings.endpoints.emptyState.message' })}
          </p>
          <Button className="mt-4" onClick={onAddEndpoint}>
            <Plus className="w-4 h-4 mr-2" />
            {formatMessage({ id: 'apiSettings.endpoints.actions.add' })}
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredEndpoints.map((endpoint) => (
            <EndpointCard
              key={endpoint.id}
              endpoint={endpoint}
              onEdit={() => onEditEndpoint(endpoint.id)}
              onDelete={() => handleDeleteEndpoint(endpoint.id, endpoint.name)}
              onToggleEnabled={(enabled) => handleToggleEnabled(endpoint.id, enabled)}
              isDeleting={isDeleting}
              isToggling={isUpdating}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default EndpointList;
