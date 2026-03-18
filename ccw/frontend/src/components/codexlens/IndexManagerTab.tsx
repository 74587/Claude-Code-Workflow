// ========================================
// IndexManagerTab Component
// ========================================
// Project path input, index status display, and sync/rebuild actions

import { useState } from 'react';
import { useIntl } from 'react-intl';
import { Plus, Trash2, RefreshCw, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useIndexStatus, useSyncIndex, useRebuildIndex, codexLensKeys, type IndexStatusData } from '@/hooks/useCodexLens';

interface ProjectStatusCardProps {
  projectPath: string;
}

function ProjectStatusCard({ projectPath }: ProjectStatusCardProps) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const { data: statusData, isLoading, isError } = useIndexStatus(projectPath);
  const { syncIndex, isSyncing } = useSyncIndex();
  const { rebuildIndex, isRebuilding } = useRebuildIndex();

  const status: IndexStatusData | undefined = statusData;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: codexLensKeys.indexStatus(projectPath) });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium truncate">{projectPath}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status stats */}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            {formatMessage({ id: 'codexlens.index.loading' })}
          </div>
        )}
        {isError && (
          <p className="text-sm text-destructive">{formatMessage({ id: 'codexlens.index.error' })}</p>
        )}
        {!isLoading && !isError && status && (
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-lg font-semibold">{status.files_tracked ?? 0}</p>
              <p className="text-xs text-muted-foreground">{formatMessage({ id: 'codexlens.index.filesTracked' })}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">{status.total_chunks ?? 0}</p>
              <p className="text-xs text-muted-foreground">{formatMessage({ id: 'codexlens.index.totalChunks' })}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">{status.deleted_chunks ?? 0}</p>
              <p className="text-xs text-muted-foreground">{formatMessage({ id: 'codexlens.index.deletedChunks' })}</p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncIndex(projectPath)}
            disabled={isSyncing}
          >
            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {formatMessage({ id: 'codexlens.index.sync' })}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => rebuildIndex(projectPath)}
            disabled={isRebuilding}
          >
            {isRebuilding ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {formatMessage({ id: 'codexlens.index.rebuild' })}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            {formatMessage({ id: 'codexlens.index.refresh' })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function IndexManagerTab() {
  const { formatMessage } = useIntl();
  const [paths, setPaths] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !paths.includes(trimmed)) {
      setPaths((prev) => [...prev, trimmed]);
    }
    setInputValue('');
  };

  const handleRemove = (path: string) => {
    setPaths((prev) => prev.filter((p) => p !== path));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  return (
    <div className="space-y-4">
      {/* Add project path */}
      <div className="flex gap-2">
        <Input
          placeholder={formatMessage({ id: 'codexlens.index.pathPlaceholder' })}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Button onClick={handleAdd} disabled={!inputValue.trim()}>
          <Plus className="w-4 h-4 mr-1" />
          {formatMessage({ id: 'codexlens.index.add' })}
        </Button>
      </div>

      {paths.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {formatMessage({ id: 'codexlens.index.empty' })}
        </p>
      )}

      {/* Project status cards */}
      {paths.map((path) => (
        <div key={path} className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 z-10 h-7 w-7 p-0"
            onClick={() => handleRemove(path)}
            title={formatMessage({ id: 'codexlens.index.removeProject' })}
          >
            <Trash2 className="w-4 h-4 text-muted-foreground" />
          </Button>
          <ProjectStatusCard projectPath={path} />
        </div>
      ))}
    </div>
  );
}
