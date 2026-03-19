// ========================================
// ModelManagerTab Component
// ========================================
// Model list with download/delete actions and embed mode banner

import { useIntl } from 'react-intl';
import { Download, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  useCodexLensModels,
  useDownloadModel,
  useDeleteModel,
  useCodexLensEnv,
  type ModelEntry,
} from '@/hooks/useCodexLens';

export function ModelManagerTab() {
  const { formatMessage } = useIntl();
  const { data: modelsData, isLoading, isError } = useCodexLensModels();
  const { data: envData } = useCodexLensEnv();
  const { downloadModel, isDownloading } = useDownloadModel();
  const { deleteModel, isDeleting } = useDeleteModel();

  const hasApiUrl = !!(envData?.values.CODEXLENS_EMBED_API_URL);
  const embedMode = hasApiUrl ? 'API' : 'Local fastembed';

  const models: ModelEntry[] = modelsData ?? [];

  return (
    <div className="space-y-4">
      {/* Embed mode banner */}
      <div className="flex items-center gap-2 p-3 rounded-md bg-muted text-sm">
        <span className="text-muted-foreground">{formatMessage({ id: 'codexlens.models.embedMode' })}:</span>
        <Badge variant={hasApiUrl ? 'success' : 'secondary'}>{embedMode}</Badge>
      </div>

      {/* Loading / Error states */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          {formatMessage({ id: 'codexlens.models.loading' })}
        </div>
      )}

      {isError && (
        <p className="text-sm text-destructive p-4">{formatMessage({ id: 'codexlens.models.error' })}</p>
      )}

      {/* Model list */}
      {!isLoading && !isError && models.length === 0 && (
        <p className="text-sm text-muted-foreground p-4">{formatMessage({ id: 'codexlens.models.noModels' })}</p>
      )}

      {!isLoading && !isError && models.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {models.map((model) => (
                <div
                  key={model.name}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{model.name}</span>
                    <Badge variant={model.installed ? 'success' : 'secondary'}>
                      {model.installed
                        ? formatMessage({ id: 'codexlens.models.installed' })
                        : formatMessage({ id: 'codexlens.models.notInstalled' })}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadModel(model.name)}
                      disabled={isDownloading}
                    >
                      {isDownloading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      <span className="ml-1">{formatMessage({ id: 'codexlens.models.download' })}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteModel(model.name)}
                      disabled={!model.installed || isDeleting}
                    >
                      {isDeleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      <span className="ml-1">{formatMessage({ id: 'codexlens.models.delete' })}</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
