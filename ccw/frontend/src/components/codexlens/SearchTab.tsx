// ========================================
// CodexLens Search Tab
// ========================================
// Semantic code search interface with multiple search types

import { useState } from 'react';
import { useIntl } from 'react-intl';
import { Search, FileCode, Code } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import {
  useCodexLensSearch,
  useCodexLensFilesSearch,
  useCodexLensSymbolSearch,
} from '@/hooks/useCodexLens';
import type { CodexLensSearchParams } from '@/lib/api';
import { cn } from '@/lib/utils';

type SearchType = 'search' | 'search_files' | 'symbol';
type SearchMode = 'dense_rerank' | 'fts' | 'fuzzy';

interface SearchTabProps {
  enabled: boolean;
}

export function SearchTab({ enabled }: SearchTabProps) {
  const { formatMessage } = useIntl();
  const [searchType, setSearchType] = useState<SearchType>('search');
  const [searchMode, setSearchMode] = useState<SearchMode>('dense_rerank');
  const [query, setQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // Build search params based on search type
  const searchParams: CodexLensSearchParams = {
    query,
    limit: 20,
    mode: searchType !== 'symbol' ? searchMode : undefined,
    max_content_length: 200,
    extra_files_count: 10,
  };

  // Search hooks - only enable when hasSearched is true and query is not empty
  const contentSearch = useCodexLensSearch(
    searchParams,
    { enabled: enabled && hasSearched && searchType === 'search' && query.trim().length > 0 }
  );

  const fileSearch = useCodexLensFilesSearch(
    searchParams,
    { enabled: enabled && hasSearched && searchType === 'search_files' && query.trim().length > 0 }
  );

  const symbolSearch = useCodexLensSymbolSearch(
    { query, limit: 20 },
    { enabled: enabled && hasSearched && searchType === 'symbol' && query.trim().length > 0 }
  );

  // Get loading state based on search type
  const isLoading = searchType === 'search'
    ? contentSearch.isLoading
    : searchType === 'search_files'
      ? fileSearch.isLoading
      : symbolSearch.isLoading;

  const handleSearch = () => {
    if (query.trim()) {
      setHasSearched(true);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSearchTypeChange = (value: SearchType) => {
    setSearchType(value);
    setHasSearched(false); // Reset search state when changing type
  };

  const handleSearchModeChange = (value: SearchMode) => {
    setSearchMode(value);
    setHasSearched(false); // Reset search state when changing mode
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setHasSearched(false); // Reset search state when query changes
  };

  if (!enabled) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <Search className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            {formatMessage({ id: 'codexlens.search.notInstalled.title' })}
          </h3>
          <p className="text-muted-foreground">
            {formatMessage({ id: 'codexlens.search.notInstalled.description' })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Search Type */}
        <div className="space-y-2">
          <Label>{formatMessage({ id: 'codexlens.search.type' })}</Label>
          <Select value={searchType} onValueChange={handleSearchTypeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="search">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  {formatMessage({ id: 'codexlens.search.content' })}
                </div>
              </SelectItem>
              <SelectItem value="search_files">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4" />
                  {formatMessage({ id: 'codexlens.search.files' })}
                </div>
              </SelectItem>
              <SelectItem value="symbol">
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4" />
                  {formatMessage({ id: 'codexlens.search.symbol' })}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Search Mode - only for content and file search */}
        {searchType !== 'symbol' && (
          <div className="space-y-2">
            <Label>{formatMessage({ id: 'codexlens.search.mode' })}</Label>
            <Select value={searchMode} onValueChange={handleSearchModeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dense_rerank">
                  {formatMessage({ id: 'codexlens.search.mode.semantic' })}
                </SelectItem>
                <SelectItem value="fts">
                  {formatMessage({ id: 'codexlens.search.mode.exact' })}
                </SelectItem>
                <SelectItem value="fuzzy">
                  {formatMessage({ id: 'codexlens.search.mode.fuzzy' })}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Query Input */}
      <div className="space-y-2">
        <Label htmlFor="search-query">{formatMessage({ id: 'codexlens.search.query' })}</Label>
        <Input
          id="search-query"
          placeholder={formatMessage({ id: 'codexlens.search.queryPlaceholder' })}
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isLoading}
        />
      </div>

      {/* Search Button */}
      <Button
        onClick={handleSearch}
        disabled={!query.trim() || isLoading}
        className="w-full"
      >
        <Search className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
        {isLoading
          ? formatMessage({ id: 'codexlens.search.searching' })
          : formatMessage({ id: 'codexlens.search.button' })
        }
      </Button>

      {/* Results */}
      {hasSearched && !isLoading && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              {formatMessage({ id: 'codexlens.search.results' })}
            </h3>
            <span className="text-xs text-muted-foreground">
              {searchType === 'symbol'
                ? (symbolSearch.data?.success
                    ? `${symbolSearch.data.symbols?.length ?? 0} ${formatMessage({ id: 'codexlens.search.resultsCount' })}`
                    : ''
                  )
                : searchType === 'search'
                  ? (contentSearch.data?.success
                      ? `${contentSearch.data.results?.length ?? 0} ${formatMessage({ id: 'codexlens.search.resultsCount' })}`
                      : ''
                    )
                  : (fileSearch.data?.success
                      ? `${fileSearch.data.results?.length ?? 0} ${formatMessage({ id: 'codexlens.search.resultsCount' })}`
                      : ''
                    )
              }
            </span>
          </div>

          {searchType === 'symbol' && symbolSearch.data && (
            symbolSearch.data.success ? (
              <div className="rounded-lg border bg-muted/50 p-4">
                <pre className="text-xs overflow-auto max-h-96">
                  {JSON.stringify(symbolSearch.data.symbols, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="text-sm text-destructive">
                {symbolSearch.data.error || formatMessage({ id: 'common.error' })}
              </div>
            )
          )}

          {searchType === 'search' && contentSearch.data && (
            contentSearch.data.success ? (
              <div className="rounded-lg border bg-muted/50 p-4">
                <pre className="text-xs overflow-auto max-h-96">
                  {JSON.stringify(contentSearch.data.results, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="text-sm text-destructive">
                {contentSearch.data.error || formatMessage({ id: 'common.error' })}
              </div>
            )
          )}

          {searchType === 'search_files' && fileSearch.data && (
            fileSearch.data.success ? (
              <div className="rounded-lg border bg-muted/50 p-4">
                <pre className="text-xs overflow-auto max-h-96">
                  {JSON.stringify(fileSearch.data.results, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="text-sm text-destructive">
                {fileSearch.data.error || formatMessage({ id: 'common.error' })}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default SearchTab;
