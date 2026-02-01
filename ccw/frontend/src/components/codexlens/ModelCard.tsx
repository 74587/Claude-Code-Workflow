// ========================================
// Model Card Component
// ========================================
// Individual model display card with actions

import { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  Download,
  Trash2,
  Package,
  HardDrive,
  X,
  Loader2,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { Input } from '@/components/ui/Input';
import type { CodexLensModel } from '@/lib/api';
import { cn } from '@/lib/utils';

// ========== Types ==========

export interface ModelCardProps {
  model: CodexLensModel;
  isDownloading?: boolean;
  downloadProgress?: number;
  isDeleting?: boolean;
  onDownload: (profile: string) => void;
  onDelete: (profile: string) => void;
  onCancelDownload?: () => void;
}

// ========== Helper Functions ==========

function getModelTypeVariant(type: 'embedding' | 'reranker'): 'default' | 'secondary' {
  return type === 'embedding' ? 'default' : 'secondary';
}

function formatSize(size?: string): string {
  if (!size) return '-';
  return size;
}

// ========== Component ==========

export function ModelCard({
  model,
  isDownloading = false,
  downloadProgress = 0,
  isDeleting = false,
  onDownload,
  onDelete,
  onCancelDownload,
}: ModelCardProps) {
  const { formatMessage } = useIntl();

  const handleDownload = () => {
    onDownload(model.profile);
  };

  const handleDelete = () => {
    if (confirm(formatMessage({ id: 'codexlens.models.deleteConfirm' }, { modelName: model.name }))) {
      onDelete(model.profile);
    }
  };

  return (
    <Card className={cn('overflow-hidden', !model.installed && 'opacity-80')}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={cn(
              'p-2 rounded-lg flex-shrink-0',
              model.installed ? 'bg-success/10' : 'bg-muted'
            )}>
              {model.installed ? (
                <HardDrive className="w-4 h-4 text-success" />
              ) : (
                <Package className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground truncate">
                  {model.name}
                </span>
                <Badge
                  variant={getModelTypeVariant(model.type)}
                  className="text-xs flex-shrink-0"
                >
                  {model.type}
                </Badge>
                <Badge
                  variant={model.installed ? 'success' : 'outline'}
                  className="text-xs flex-shrink-0"
                >
                  {model.installed
                    ? formatMessage({ id: 'codexlens.models.status.downloaded' })
                    : formatMessage({ id: 'codexlens.models.status.available' })
                  }
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>Backend: {model.backend}</span>
                <span>Size: {formatSize(model.size)}</span>
              </div>
              {model.cache_path && (
                <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                  {model.cache_path}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {isDownloading ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onCancelDownload}
                title={formatMessage({ id: 'codexlens.models.actions.cancel' })}
              >
                <X className="w-4 h-4" />
              </Button>
            ) : model.installed ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
                disabled={isDeleting}
                title={formatMessage({ id: 'codexlens.models.actions.delete' })}
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={handleDownload}
                title={formatMessage({ id: 'codexlens.models.actions.download' })}
              >
                <Download className="w-4 h-4 mr-1" />
                <span className="text-xs">{formatMessage({ id: 'codexlens.models.actions.download' })}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Download Progress */}
        {isDownloading && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {formatMessage({ id: 'codexlens.models.downloading' })}
              </span>
              <span className="font-medium">{downloadProgress}%</span>
            </div>
            <Progress value={downloadProgress} className="h-2" />
          </div>
        )}
      </div>
    </Card>
  );
}

// ========== Custom Model Input ==========

export interface CustomModelInputProps {
  isDownloading: boolean;
  onDownload: (modelName: string, modelType: 'embedding' | 'reranker') => void;
}

export function CustomModelInput({ isDownloading, onDownload }: CustomModelInputProps) {
  const { formatMessage } = useIntl();
  const [modelName, setModelName] = useState('');
  const [modelType, setModelType] = useState<'embedding' | 'reranker'>('embedding');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modelName.trim()) {
      onDownload(modelName.trim(), modelType);
      setModelName('');
    }
  };

  return (
    <Card className="p-4 bg-primary/5 border-primary/20">
      <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
        <Package className="w-4 h-4 text-primary" />
        {formatMessage({ id: 'codexlens.models.custom.title' })}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder={formatMessage({ id: 'codexlens.models.custom.placeholder' })}
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            disabled={isDownloading}
            className="flex-1"
          />
          <select
            value={modelType}
            onChange={(e) => setModelType(e.target.value as 'embedding' | 'reranker')}
            disabled={isDownloading}
            className="px-3 py-2 text-sm rounded-md border border-input bg-background"
          >
            <option value="embedding">{formatMessage({ id: 'codexlens.models.types.embedding' })}</option>
            <option value="reranker">{formatMessage({ id: 'codexlens.models.types.reranker' })}</option>
          </select>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatMessage({ id: 'codexlens.models.custom.description' })}
        </p>
      </form>
    </Card>
  );
}

export default ModelCard;
