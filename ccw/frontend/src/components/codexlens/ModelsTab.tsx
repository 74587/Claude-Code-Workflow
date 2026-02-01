// ========================================
// Models Tab Component
// ========================================
// Model management tab with list, search, and download actions

import { useState, useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  Search,
  RefreshCw,
  Package,
  Filter,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ModelCard, CustomModelInput } from './ModelCard';
import { useCodexLensModels, useCodexLensMutations } from '@/hooks';
import type { CodexLensModel } from '@/lib/api';
import { cn } from '@/lib/utils';

// ========== Types ==========

type FilterType = 'all' | 'embedding' | 'reranker' | 'downloaded' | 'available';

// ========== Helper Functions ==========

function filterModels(models: CodexLensModel[], filter: FilterType, search: string): CodexLensModel[] {
  let filtered = models;

  // Apply type/status filter
  if (filter === 'embedding') {
    filtered = filtered.filter(m => m.type === 'embedding');
  } else if (filter === 'reranker') {
    filtered = filtered.filter(m => m.type === 'reranker');
  } else if (filter === 'downloaded') {
    filtered = filtered.filter(m => m.installed);
  } else if (filter === 'available') {
    filtered = filtered.filter(m => !m.installed);
  }

  // Apply search filter
  if (search.trim()) {
    const query = search.toLowerCase();
    filtered = filtered.filter(m =>
      m.name.toLowerCase().includes(query) ||
      m.profile.toLowerCase().includes(query) ||
      m.backend.toLowerCase().includes(query)
    );
  }

  return filtered;
}

// ========== Component ==========

export interface ModelsTabProps {
  installed?: boolean;
}

export function ModelsTab({ installed = false }: ModelsTabProps) {
  const { formatMessage } = useIntl();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [downloadingProfile, setDownloadingProfile] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const {
    models,
    isLoading,
    refetch,
  } = useCodexLensModels({
    enabled: installed,
  });

  const {
    downloadModel,
    downloadCustomModel,
    deleteModel,
    isDownloading,
    isDeleting,
  } = useCodexLensMutations();

  // Filter models based on search and filter
  const filteredModels = useMemo(() => {
    if (!models) return [];
    return filterModels(models, filterType, searchQuery);
  }, [models, filterType, searchQuery]);

  // Count models by type and status
  const stats = useMemo(() => {
    if (!models) return null;
    return {
      total: models.length,
      embedding: models.filter(m => m.type === 'embedding').length,
      reranker: models.filter(m => m.type === 'reranker').length,
      downloaded: models.filter(m => m.installed).length,
      available: models.filter(m => !m.installed).length,
    };
  }, [models]);

  // Handle model download
  const handleDownload = async (profile: string) => {
    setDownloadingProfile(profile);
    setDownloadProgress(0);

    // Simulate progress for demo (in real implementation, use WebSocket or polling)
    const progressInterval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return 95;
        }
        return prev + 5;
      });
    }, 500);

    try {
      const result = await downloadModel(profile);
      if (result.success) {
        setDownloadProgress(100);
        setTimeout(() => {
          setDownloadingProfile(null);
          setDownloadProgress(0);
          refetch();
        }, 500);
      } else {
        setDownloadingProfile(null);
        setDownloadProgress(0);
      }
    } catch (error) {
      setDownloadingProfile(null);
      setDownloadProgress(0);
    } finally {
      clearInterval(progressInterval);
    }
  };

  // Handle custom model download
  const handleCustomDownload = async (modelName: string, modelType: 'embedding' | 'reranker') => {
    try {
      const result = await downloadCustomModel(modelName, modelType);
      if (result.success) {
        refetch();
      }
    } catch (error) {
      console.error('Failed to download custom model:', error);
    }
  };

  // Handle model delete
  const handleDelete = async (profile: string) => {
    const result = await deleteModel(profile);
    if (result.success) {
      refetch();
    }
  };

  // Filter buttons
  const filterButtons: Array<{ type: FilterType; label: string; count: number | undefined }> = [
    { type: 'all', label: formatMessage({ id: 'codexlens.models.filters.all' }), count: stats?.total },
    { type: 'embedding', label: formatMessage({ id: 'codexlens.models.types.embedding' }), count: stats?.embedding },
    { type: 'reranker', label: formatMessage({ id: 'codexlens.models.types.reranker' }), count: stats?.reranker },
    { type: 'downloaded', label: formatMessage({ id: 'codexlens.models.status.downloaded' }), count: stats?.downloaded },
    { type: 'available', label: formatMessage({ id: 'codexlens.models.status.available' }), count: stats?.available },
  ];

  if (!installed) {
    return (
      <Card className="p-12 text-center">
        <Package className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {formatMessage({ id: 'codexlens.models.notInstalled.title' })}
        </h3>
        <p className="text-muted-foreground">
          {formatMessage({ id: 'codexlens.models.notInstalled.description' })}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Search and Actions */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={formatMessage({ id: 'codexlens.models.searchPlaceholder' })}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={cn('w-4 h-4 mr-1', isLoading && 'animate-spin')} />
              {formatMessage({ id: 'common.actions.refresh' })}
            </Button>
          </div>
        </div>
      </Card>

      {/* Stats and Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            {formatMessage({ id: 'codexlens.models.filters.label' })}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {filterButtons.map(({ type, label, count }) => (
            <Button
              key={type}
              variant={filterType === type ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType(type)}
              className="relative"
            >
              {label}
              {count !== undefined && (
                <Badge variant={filterType === type ? 'secondary' : 'default'} className="ml-2">
                  {count}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </Card>

      {/* Custom Model Input */}
      <CustomModelInput
        isDownloading={isDownloading}
        onDownload={handleCustomDownload}
      />

      {/* Model List */}
      {isLoading ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">{formatMessage({ id: 'common.actions.loading' })}</p>
        </Card>
      ) : filteredModels.length === 0 ? (
        <Card className="p-8 text-center">
          <Package className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <h3 className="text-sm font-medium text-foreground mb-1">
            {formatMessage({ id: 'codexlens.models.empty.title' })}
          </h3>
          <p className="text-xs text-muted-foreground">
            {formatMessage({ id: 'codexlens.models.empty.description' })}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredModels.map((model) => (
            <ModelCard
              key={model.profile}
              model={model}
              isDownloading={downloadingProfile === model.profile}
              downloadProgress={downloadProgress}
              isDeleting={isDeleting && downloadingProfile !== model.profile}
              onDownload={handleDownload}
              onDelete={handleDelete}
              onCancelDownload={() => {
                setDownloadingProfile(null);
                setDownloadProgress(0);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ModelsTab;
