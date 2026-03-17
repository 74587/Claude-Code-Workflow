// ========================================
// CodexLens Manager Page (v2)
// ========================================
// V2 search management interface with index status, search test, and configuration

import { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  Search,
  RefreshCw,
  Database,
  Zap,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  HardDrive,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useV2SearchManager } from '@/hooks';
import { cn } from '@/lib/utils';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

export function CodexLensManagerPage() {
  const { formatMessage } = useIntl();
  const [searchQuery, setSearchQuery] = useState('');

  const {
    status,
    isLoadingStatus,
    statusError,
    refetchStatus,
    search,
    isSearching,
    searchResult,
    reindex,
    isReindexing,
  } = useV2SearchManager();

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    await search(searchQuery.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Search className="w-6 h-6 text-primary" />
            {formatMessage({ id: 'codexlens.title' })}
          </h1>
          <p className="text-muted-foreground mt-1">
            {formatMessage({ id: 'codexlens.description' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={refetchStatus}
            disabled={isLoadingStatus}
          >
            <RefreshCw className={cn('w-4 h-4 mr-2', isLoadingStatus && 'animate-spin')} />
            {formatMessage({ id: 'common.actions.refresh' })}
          </Button>
          <Button
            onClick={() => reindex()}
            disabled={isReindexing}
          >
            <Zap className={cn('w-4 h-4 mr-2', isReindexing && 'animate-spin')} />
            {isReindexing
              ? formatMessage({ id: 'codexlens.reindexing' })
              : formatMessage({ id: 'codexlens.reindex' })
            }
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {statusError && (
        <Card className="p-4 bg-destructive/10 border-destructive/20">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <p className="text-sm text-destructive">
              {formatMessage({ id: 'codexlens.statusError' })}
            </p>
          </div>
        </Card>
      )}

      {/* Index Status Section */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          {formatMessage({ id: 'codexlens.indexStatus.title' })}
        </h2>

        {isLoadingStatus ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : status ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
              {status.indexed ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
              )}
              <div>
                <p className="text-xs text-muted-foreground">
                  {formatMessage({ id: 'codexlens.indexStatus.status' })}
                </p>
                <p className="text-sm font-medium">
                  {status.indexed
                    ? formatMessage({ id: 'codexlens.indexStatus.ready' })
                    : formatMessage({ id: 'codexlens.indexStatus.notIndexed' })
                  }
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
              <FileText className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">
                  {formatMessage({ id: 'codexlens.indexStatus.files' })}
                </p>
                <p className="text-sm font-medium">{status.totalFiles.toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
              <HardDrive className="w-5 h-5 text-purple-500 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">
                  {formatMessage({ id: 'codexlens.indexStatus.dbSize' })}
                </p>
                <p className="text-sm font-medium">{formatBytes(status.dbSizeBytes)}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
              <Clock className="w-5 h-5 text-orange-500 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">
                  {formatMessage({ id: 'codexlens.indexStatus.lastIndexed' })}
                </p>
                <p className="text-sm font-medium">{formatDate(status.lastIndexedAt)}</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {formatMessage({ id: 'codexlens.indexStatus.unavailable' })}
          </p>
        )}

        {status && (
          <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
            <span>
              {formatMessage({ id: 'codexlens.indexStatus.chunks' })}: {status.totalChunks.toLocaleString()}
            </span>
            {status.vectorDimension && (
              <span>
                {formatMessage({ id: 'codexlens.indexStatus.vectorDim' })}: {status.vectorDimension}
              </span>
            )}
            <span>
              FTS: {status.ftsEnabled
                ? formatMessage({ id: 'codexlens.indexStatus.enabled' })
                : formatMessage({ id: 'codexlens.indexStatus.disabled' })
              }
            </span>
          </div>
        )}
      </Card>

      {/* Search Test Section */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-primary" />
          {formatMessage({ id: 'codexlens.searchTest.title' })}
        </h2>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={formatMessage({ id: 'codexlens.searchTest.placeholder' })}
            className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
          >
            {isSearching ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Search className="w-4 h-4 mr-2" />
            )}
            {formatMessage({ id: 'codexlens.searchTest.button' })}
          </Button>
        </div>

        {searchResult && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">
                {searchResult.totalResults} {formatMessage({ id: 'codexlens.searchTest.results' })}
              </p>
              <p className="text-xs text-muted-foreground">
                {searchResult.timingMs.toFixed(1)}ms
              </p>
            </div>

            {searchResult.results.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {searchResult.results.map((result, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-mono text-primary truncate">
                        {result.file}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">
                        {(result.score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
                      {result.snippet}
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                {formatMessage({ id: 'codexlens.searchTest.noResults' })}
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

export default CodexLensManagerPage;
