// ========================================
// Model Pool List Component
// ========================================
// Display model pools as cards with search, filter, and actions

import { useState, useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Layers,
  Zap,
  CheckCircle2,
  XCircle,
  MoreVertical,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/Dropdown';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/AlertDialog';
import {
  useModelPools,
  useDeleteModelPool,
  useUpdateModelPool,
} from '@/hooks/useApiSettings';
import { useNotifications } from '@/hooks/useNotifications';
import type { ModelPoolConfig, ModelPoolType } from '@/lib/api';
import { cn } from '@/lib/utils';

// ========== Types ==========

export interface ModelPoolListProps {
  onAddPool: () => void;
  onEditPool: (poolId: string) => void;
}

type FilterType = 'all' | 'embedding' | 'llm' | 'reranker';

// ========== Helper Components ==========

interface PoolCardProps {
  pool: ModelPoolConfig;
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  isDeleting: boolean;
  isToggling: boolean;
}

function PoolCard({
  pool,
  onEdit,
  onDelete,
  onToggleEnabled,
  isDeleting,
  isToggling,
}: PoolCardProps) {
  const { formatMessage } = useIntl();

  // Get model type badge
  const getModelTypeBadge = () => {
    const variantMap = {
      embedding: 'success' as const,
      llm: 'default' as const,
      reranker: 'info' as const,
    };

    const labelMap = {
      embedding: 'apiSettings.modelPools.embedding',
      llm: 'apiSettings.modelPools.llm',
      reranker: 'apiSettings.modelPools.reranker',
    };

    return (
      <Badge variant={variantMap[pool.modelType]}>
        {formatMessage({ id: labelMap[pool.modelType] })}
      </Badge>
    );
  };

  // Get strategy label
  const getStrategyLabel = () => {
    const strategyMap = {
      round_robin: 'apiSettings.modelPools.roundRobin',
      latency_aware: 'apiSettings.modelPools.latencyAware',
      weighted_random: 'apiSettings.modelPools.weightedRandom',
    };
    return formatMessage({ id: strategyMap[pool.strategy] });
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        {/* Left: Pool Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-foreground truncate">
              {pool.name || pool.id}
            </h3>
            {getModelTypeBadge()}
            {pool.enabled ? (
              <Badge variant="success">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {formatMessage({ id: 'apiSettings.common.enabled' })}
              </Badge>
            ) : (
              <Badge variant="secondary">
                <XCircle className="w-3 h-3 mr-1" />
                {formatMessage({ id: 'apiSettings.common.disabled' })}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span className="capitalize">{getStrategyLabel()}</span>
            {pool.autoDiscover && (
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {formatMessage({ id: 'apiSettings.modelPools.autoDiscover' })}
              </span>
            )}
          </div>

          <div className="mt-2 text-sm">
            <p className="text-muted-foreground">
              {formatMessage({ id: 'apiSettings.modelPools.targetModel' })}: <span className="font-medium">{pool.targetModel}</span>
            </p>
          </div>

          {pool.description && (
            <p className="text-xs text-muted-foreground mt-1">{pool.description}</p>
          )}

          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span>
              {formatMessage({ id: 'apiSettings.modelPools.defaultCooldown' })}: {pool.defaultCooldown}s
            </span>
            <span>
              {formatMessage({ id: 'apiSettings.modelPools.defaultConcurrent' })}: {pool.defaultMaxConcurrentPerKey}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Switch
            checked={pool.enabled}
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
                {formatMessage({ id: 'apiSettings.modelPools.actions.edit' })}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} disabled={isDeleting} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                {formatMessage({ id: 'apiSettings.modelPools.actions.delete' })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  className?: string;
}

function StatCard({ label, value, icon, className }: StatCardProps) {
  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-md text-primary">
          {icon}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </div>
    </Card>
  );
}

// ========== Main Component ==========

export function ModelPoolList({ onAddPool, onEditPool }: ModelPoolListProps) {
  const { formatMessage } = useIntl();
  const { success, error } = useNotifications();

  // Queries and mutations
  const { pools, totalCount, enabledCount, isLoading, refetch } = useModelPools();
  const { deleteModelPool, isDeleting } = useDeleteModelPool();
  const { updateModelPool } = useUpdateModelPool();

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [deletePoolId, setDeletePoolId] = useState<string | null>(null);
  const [togglingPoolId, setTogglingPoolId] = useState<string | null>(null);

  // Filter pools
  const filteredPools = useMemo(() => {
    return pools.filter((pool) => {
      const matchesSearch =
        !searchQuery ||
        pool.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pool.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pool.targetModel.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesFilter =
        filterType === 'all' || pool.modelType === filterType;

      return matchesSearch && matchesFilter;
    });
  }, [pools, searchQuery, filterType]);

  // Count pools by type
  const typeCounts = useMemo(() => {
    return {
      embedding: pools.filter((p) => p.modelType === 'embedding').length,
      llm: pools.filter((p) => p.modelType === 'llm').length,
      reranker: pools.filter((p) => p.modelType === 'reranker').length,
    };
  }, [pools]);

  // Handle delete
  const handleDelete = async () => {
    if (!deletePoolId) return;

    try {
      await deleteModelPool(deletePoolId);
      success(
        formatMessage({ id: 'apiSettings.messages.settingsDeleted' })
      );
      setDeletePoolId(null);
      await refetch();
    } catch (err) {
      error(
        formatMessage({ id: 'common.error' }),
        err instanceof Error ? err.message : formatMessage({ id: 'common.error' })
      );
    }
  };

  // Handle toggle enabled
  const handleToggleEnabled = async (poolId: string, enabled: boolean) => {
    setTogglingPoolId(poolId);
    try {
      await updateModelPool(poolId, { enabled });
      await refetch();
    } catch (err) {
      error(
        formatMessage({ id: 'common.error' }),
        err instanceof Error ? err.message : formatMessage({ id: 'common.error' })
      );
    } finally {
      setTogglingPoolId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label={formatMessage({ id: 'apiSettings.modelPools.stats.total' })}
          value={totalCount}
          icon={<Layers className="w-5 h-5" />}
        />
        <StatCard
          label={formatMessage({ id: 'apiSettings.modelPools.stats.enabled' })}
          value={enabledCount}
          icon={<CheckCircle2 className="w-5 h-5" />}
        />
        <StatCard
          label={formatMessage({ id: 'apiSettings.modelPools.embedding' })}
          value={typeCounts.embedding}
          icon={<Zap className="w-5 h-5" />}
        />
        <StatCard
          label={formatMessage({ id: 'apiSettings.modelPools.llm' })}
          value={typeCounts.llm}
          icon={<Layers className="w-5 h-5" />}
        />
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 w-full sm:max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={formatMessage({ id: 'apiSettings.common.searchPlaceholder' })}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Buttons */}
          <div className="flex items-center bg-muted rounded-lg p-1">
            {(Object.keys({ all: null, embedding: null, llm: null, reranker: null }) as FilterType[]).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  filterType === type
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {type === 'all'
                  ? formatMessage({ id: 'apiSettings.common.showAll' })
                  : formatMessage({ id: `apiSettings.modelPools.${type as ModelPoolType}` })}
              </button>
            ))}
          </div>

          <Button onClick={onAddPool}>
            <Plus className="w-4 h-4 mr-2" />
            {formatMessage({ id: 'apiSettings.modelPools.actions.add' })}
          </Button>
        </div>
      </div>

      {/* Pool List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          {formatMessage({ id: 'common.loading' })}
        </div>
      ) : filteredPools.length === 0 ? (
        <Card className="p-12 text-center">
          <Layers className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">
            {formatMessage({ id: 'apiSettings.modelPools.emptyState.title' })}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {formatMessage({ id: 'apiSettings.modelPools.emptyState.message' })}
          </p>
          <Button onClick={onAddPool}>
            <Plus className="w-4 h-4 mr-2" />
            {formatMessage({ id: 'apiSettings.modelPools.actions.add' })}
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredPools.map((pool) => (
            <PoolCard
              key={pool.id}
              pool={pool}
              onEdit={() => onEditPool(pool.id)}
              onDelete={() => setDeletePoolId(pool.id)}
              onToggleEnabled={(enabled) => handleToggleEnabled(pool.id, enabled)}
              isDeleting={isDeleting && deletePoolId === pool.id}
              isToggling={togglingPoolId === pool.id}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletePoolId} onOpenChange={() => setDeletePoolId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {formatMessage({ id: 'apiSettings.modelPools.actions.delete' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {formatMessage(
                { id: 'apiSettings.modelPools.deleteConfirm' },
                { name: pools.find((p) => p.id === deletePoolId)?.name || deletePoolId || '' }
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {formatMessage({ id: 'common.cancel' })}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting
                ? formatMessage({ id: 'common.loading' })
                : formatMessage({ id: 'common.confirm' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
