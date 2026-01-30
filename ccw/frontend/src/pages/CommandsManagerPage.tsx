// ========================================
// Commands Manager Page
// ========================================
// Manage custom slash commands with search/filter

import { useState, useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  Terminal,
  Search,
  Plus,
  RefreshCw,
  Copy,
  ChevronDown,
  ChevronUp,
  Code,
  BookOpen,
  Tag,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select';
import { useCommands } from '@/hooks';
import type { Command } from '@/lib/api';
import { cn } from '@/lib/utils';

// ========== Command Card Component ==========

interface CommandCardProps {
  command: Command;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onCopy: (text: string) => void;
}

function CommandCard({ command, isExpanded, onToggleExpand, onCopy }: CommandCardProps) {
  const { formatMessage } = useIntl();

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Terminal className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono font-medium text-foreground">
                  /{command.name}
                </code>
                {command.source && (
                  <Badge variant={command.source === 'builtin' ? 'default' : 'secondary'} className="text-xs">
                    {command.source}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {command.description || formatMessage({ id: 'commands.card.noDescription' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onCopy(`/${command.name}`);
              }}
            >
              <Copy className="w-4 h-4" />
            </Button>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Category and Aliases */}
        <div className="flex flex-wrap gap-2 mt-3">
          {command.category && (
            <Badge variant="outline" className="text-xs">
              <Tag className="w-3 h-3 mr-1" />
              {command.category}
            </Badge>
          )}
          {command.aliases?.map((alias) => (
            <Badge key={alias} variant="secondary" className="text-xs font-mono">
              /{alias}
            </Badge>
          ))}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border p-4 space-y-4 bg-muted/30">
          {/* Usage */}
          {command.usage && (
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                <Code className="w-4 h-4" />
                {formatMessage({ id: 'commands.card.usage' })}
              </div>
              <div className="p-3 bg-background rounded-md font-mono text-sm overflow-x-auto">
                <code>{command.usage}</code>
              </div>
            </div>
          )}

          {/* Examples */}
          {command.examples && command.examples.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                <BookOpen className="w-4 h-4" />
                {formatMessage({ id: 'commands.card.examples' })}
              </div>
              <div className="space-y-2">
                {command.examples.map((example, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-background rounded-md font-mono text-sm flex items-center justify-between gap-2 group"
                  >
                    <code className="overflow-x-auto flex-1">{example}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onCopy(example)}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ========== Main Page Component ==========

export function CommandsManagerPage() {
  const { formatMessage } = useIntl();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [expandedCommands, setExpandedCommands] = useState<Set<string>>(new Set());

  const {
    commands,
    categories,
    totalCount,
    isLoading,
    isFetching,
    refetch,
  } = useCommands({
    filter: {
      search: searchQuery || undefined,
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
      source: sourceFilter !== 'all' ? sourceFilter as Command['source'] : undefined,
    },
  });

  const toggleExpand = (commandName: string) => {
    setExpandedCommands((prev) => {
      const next = new Set(prev);
      if (next.has(commandName)) {
        next.delete(commandName);
      } else {
        next.add(commandName);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedCommands(new Set(commands.map((c) => c.name)));
  };

  const collapseAll = () => {
    setExpandedCommands(new Set());
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // TODO: Show toast notification
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Count by source
  const builtinCount = useMemo(
    () => commands.filter((c) => c.source === 'builtin').length,
    [commands]
  );
  const customCount = useMemo(
    () => commands.filter((c) => c.source === 'custom').length,
    [commands]
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Terminal className="w-6 h-6 text-primary" />
            {formatMessage({ id: 'commands.title' })}
          </h1>
          <p className="text-muted-foreground mt-1">
            {formatMessage({ id: 'commands.description' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('w-4 h-4 mr-2', isFetching && 'animate-spin')} />
            {formatMessage({ id: 'common.actions.refresh' })}
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            {formatMessage({ id: 'commands.actions.create' })}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-primary" />
            <span className="text-2xl font-bold">{totalCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'common.stats.totalCommands' })}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-info" />
            <span className="text-2xl font-bold">{builtinCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'commands.source.builtin' })}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-success" />
            <span className="text-2xl font-bold">{customCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'commands.source.custom' })}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-warning" />
            <span className="text-2xl font-bold">{categories.length}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'common.stats.categories' })}</p>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={formatMessage({ id: 'commands.filters.searchPlaceholder' })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={formatMessage({ id: 'commands.filters.category' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{formatMessage({ id: 'commands.filters.allCategories' })}</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={formatMessage({ id: 'commands.filters.source' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{formatMessage({ id: 'commands.filters.allSources' })}</SelectItem>
              <SelectItem value="builtin">{formatMessage({ id: 'commands.source.builtin' })}</SelectItem>
              <SelectItem value="custom">{formatMessage({ id: 'commands.source.custom' })}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Expand/Collapse All */}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={expandAll}>
          {formatMessage({ id: 'commands.actions.expandAll' })}
        </Button>
        <Button variant="ghost" size="sm" onClick={collapseAll}>
          {formatMessage({ id: 'commands.actions.collapseAll' })}
        </Button>
      </div>

      {/* Commands List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : commands.length === 0 ? (
        <Card className="p-8 text-center">
          <Terminal className="w-12 h-12 mx-auto text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium text-foreground">{formatMessage({ id: 'commands.emptyState.title' })}</h3>
          <p className="mt-2 text-muted-foreground">
            {formatMessage({ id: 'commands.emptyState.message' })}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {commands.map((command) => (
            <CommandCard
              key={command.name}
              command={command}
              isExpanded={expandedCommands.has(command.name)}
              onToggleExpand={() => toggleExpand(command.name)}
              onCopy={copyToClipboard}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CommandsManagerPage;
