// ========================================
// CLI Endpoints Page
// ========================================
// Manage LiteLLM endpoints, custom CLI endpoints, and CLI wrapper endpoints

import { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  Plug,
  Plus,
  Search,
  RefreshCw,
  Power,
  PowerOff,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
  Zap,
  Code,
  Layers,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select';
import { useCliEndpoints, useCreateCliEndpoint, useDeleteCliEndpoint, useToggleCliEndpoint, useUpdateCliEndpoint } from '@/hooks';
import { useNotifications } from '@/hooks/useNotifications';
import type { CliEndpoint } from '@/lib/api';
import { cn } from '@/lib/utils';
import { CliEndpointFormDialog, type CliEndpointFormMode, type CliEndpointSavePayload } from '@/components/cli-endpoints/CliEndpointFormDialog';

// ========== Endpoint Card Component ==========

interface EndpointCardProps {
  endpoint: CliEndpoint;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggle: (endpointId: string, enabled: boolean) => void;
  onEdit: (endpoint: CliEndpoint) => void;
  onDelete: (endpointId: string) => void | Promise<void>;
}

function EndpointCard({ endpoint, isExpanded, onToggleExpand, onToggle, onEdit, onDelete }: EndpointCardProps) {
  const { formatMessage } = useIntl();

  const typeConfig = {
    litellm: { icon: Zap, color: 'text-blue-600', label: 'cliEndpoints.type.litellm' },
    custom: { icon: Code, color: 'text-purple-600', label: 'cliEndpoints.type.custom' },
    wrapper: { icon: Layers, color: 'text-orange-600', label: 'cliEndpoints.type.wrapper' },
  };

  const config = typeConfig[endpoint.type];
  const Icon = config.icon;

  return (
    <Card className={cn('overflow-hidden', !endpoint.enabled && 'opacity-60')}>
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              endpoint.enabled ? 'bg-primary/10' : 'bg-muted'
            )}>
              <Icon className={cn(
                'w-5 h-5',
                endpoint.enabled ? config.color : 'text-muted-foreground'
              )} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {endpoint.name}
                </span>
                <Badge variant="outline" className="text-xs">
                  {formatMessage({ id: config.label })}
                </Badge>
                {endpoint.enabled && (
                  <Badge variant="outline" className="text-xs text-green-600">
                    {formatMessage({ id: 'cliEndpoints.status.enabled' })}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {formatMessage({ id: 'cliEndpoints.id' })}: {endpoint.id}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label={formatMessage({ id: 'cliEndpoints.actions.toggle' })}
              onClick={(e) => {
                e.stopPropagation();
                onToggle(endpoint.id, !endpoint.enabled);
              }}
            >
              {endpoint.enabled ? <Power className="w-4 h-4 text-green-600" /> : <PowerOff className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label={formatMessage({ id: 'cliEndpoints.actions.edit' })}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(endpoint);
              }}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label={formatMessage({ id: 'cliEndpoints.actions.delete' })}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(endpoint.id);
              }}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border p-4 space-y-3 bg-muted/30">
          {/* Config display */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">{formatMessage({ id: 'cliEndpoints.config' })}</p>
            <div className="bg-background p-3 rounded-md font-mono text-sm overflow-x-auto">
              <pre>{JSON.stringify(endpoint.config, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ========== Main Page Component ==========

export function EndpointsPage() {
  const { formatMessage } = useIntl();
  const { success, error: showError } = useNotifications();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'litellm' | 'custom' | 'wrapper'>('all');
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<CliEndpointFormMode>('create');
  const [editingEndpoint, setEditingEndpoint] = useState<CliEndpoint | undefined>(undefined);

  const {
    endpoints,
    litellmEndpoints,
    customEndpoints,
    totalCount,
    enabledCount,
    isLoading,
    isFetching,
    refetch,
  } = useCliEndpoints();

  const { toggleEndpoint } = useToggleCliEndpoint();
  const { createEndpoint, isCreating } = useCreateCliEndpoint();
  const { updateEndpoint, isUpdating } = useUpdateCliEndpoint();
  const { deleteEndpoint, isDeleting } = useDeleteCliEndpoint();

  const toggleExpand = (endpointId: string) => {
    setExpandedEndpoints((prev) => {
      const next = new Set(prev);
      if (next.has(endpointId)) {
        next.delete(endpointId);
      } else {
        next.add(endpointId);
      }
      return next;
    });
  };

  const handleToggle = (endpointId: string, enabled: boolean) => {
    toggleEndpoint(endpointId, enabled);
  };

  const handleAdd = () => {
    setDialogMode('create');
    setEditingEndpoint(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (endpoint: CliEndpoint) => {
    setDialogMode('edit');
    setEditingEndpoint(endpoint);
    setDialogOpen(true);
  };

  const handleDelete = async (endpointId: string) => {
    if (!confirm(formatMessage({ id: 'cliEndpoints.deleteConfirm' }, { id: endpointId }))) return;

    try {
      await deleteEndpoint(endpointId);
      success(formatMessage({ id: 'cliEndpoints.messages.deleted' }));
    } catch (err) {
      console.error('Failed to delete CLI endpoint:', err);
      showError(formatMessage({ id: 'cliEndpoints.messages.deleteFailed' }));
    }
  };

  const handleDialogSave = async (payload: CliEndpointSavePayload) => {
    try {
      if (dialogMode === 'edit' && editingEndpoint) {
        await updateEndpoint(editingEndpoint.id, payload);
        success(formatMessage({ id: 'cliEndpoints.messages.updated' }));
        return;
      }

      await createEndpoint(payload);
      success(formatMessage({ id: 'cliEndpoints.messages.created' }));
    } catch (err) {
      console.error('Failed to save CLI endpoint:', err);
      showError(formatMessage({ id: 'cliEndpoints.messages.saveFailed' }));
      throw err;
    }
  };

  // Filter endpoints by search query and type
  const filteredEndpoints = (() => {
    let filtered = endpoints;

    if (typeFilter !== 'all') {
      filtered = filtered.filter((e) => e.type === typeFilter);
    }

    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter((e) =>
        e.name.toLowerCase().includes(searchLower) ||
        e.id.toLowerCase().includes(searchLower)
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
            <Plug className="w-6 h-6 text-primary" />
            {formatMessage({ id: 'cliEndpoints.title' })}
          </h1>
          <p className="text-muted-foreground mt-1">
            {formatMessage({ id: 'cliEndpoints.description' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('w-4 h-4 mr-2', isFetching && 'animate-spin')} />
            {formatMessage({ id: 'common.actions.refresh' })}
          </Button>
          <Button onClick={handleAdd} disabled={isCreating || isUpdating || isDeleting}>
            <Plus className="w-4 h-4 mr-2" />
            {formatMessage({ id: 'cliEndpoints.actions.add' })}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Plug className="w-5 h-5 text-primary" />
            <span className="text-2xl font-bold">{totalCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'cliEndpoints.stats.total' })}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Power className="w-5 h-5 text-green-600" />
            <span className="text-2xl font-bold">{enabledCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'cliEndpoints.stats.enabled' })}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-600" />
            <span className="text-2xl font-bold">{litellmEndpoints.length}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'cliEndpoints.type.litellm' })}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-purple-600" />
            <span className="text-2xl font-bold">{customEndpoints.length}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'cliEndpoints.type.custom' })}</p>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={formatMessage({ id: 'cliEndpoints.filters.searchPlaceholder' })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v: typeof typeFilter) => setTypeFilter(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={formatMessage({ id: 'cliEndpoints.filters.type' })} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{formatMessage({ id: 'cliEndpoints.filters.allTypes' })}</SelectItem>
            <SelectItem value="litellm">{formatMessage({ id: 'cliEndpoints.type.litellm' })}</SelectItem>
            <SelectItem value="custom">{formatMessage({ id: 'cliEndpoints.type.custom' })}</SelectItem>
            <SelectItem value="wrapper">{formatMessage({ id: 'cliEndpoints.type.wrapper' })}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Endpoints List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : filteredEndpoints.length === 0 ? (
        <Card className="p-8 text-center">
          <Plug className="w-12 h-12 mx-auto text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium text-foreground">{formatMessage({ id: 'cliEndpoints.emptyState.title' })}</h3>
          <p className="mt-2 text-muted-foreground">
            {formatMessage({ id: 'cliEndpoints.emptyState.message' })}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredEndpoints.map((endpoint) => (
            <EndpointCard
              key={endpoint.id}
              endpoint={endpoint}
              isExpanded={expandedEndpoints.has(endpoint.id)}
              onToggleExpand={() => toggleExpand(endpoint.id)}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <CliEndpointFormDialog
        mode={dialogMode}
        endpoint={editingEndpoint}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleDialogSave}
      />
    </div>
  );
}

export default EndpointsPage;
