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
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useCommands, useCommandMutations } from '@/hooks';
import { CommandGroupAccordion } from '@/components/commands/CommandGroupAccordion';
import { LocationSwitcher } from '@/components/commands/LocationSwitcher';
import { cn } from '@/lib/utils';

// ========== Main Page Component ==========

export function CommandsManagerPage() {
  const { formatMessage } = useIntl();

  // Location filter state
  const [locationFilter, setLocationFilter] = useState<'project' | 'user'>('project');
  // Show disabled commands state
  const [showDisabledCommands, setShowDisabledCommands] = useState(false);
  // Expanded groups state (default cli and workflow expanded)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['cli', 'workflow']));
  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  const {
    commands,
    groupedCommands,
    groups,
    enabledCount,
    disabledCount,
    isLoading,
    isFetching,
    refetch,
  } = useCommands({
    filter: {
      location: locationFilter,
      showDisabled: showDisabledCommands,
      search: searchQuery || undefined,
    },
  });

  const { toggleCommand, toggleGroup, isToggling } = useCommandMutations();

  // Toggle group expand/collapse
  const toggleGroupExpand = (groupName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  // Expand all groups
  const expandAll = () => {
    setExpandedGroups(new Set(groups));
  };

  // Collapse all groups
  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

  // Toggle individual command
  const handleToggleCommand = async (name: string, enabled: boolean) => {
    try {
      await toggleCommand(name, enabled, locationFilter);
    } catch (error) {
      console.error('Failed to toggle command:', error);
    }
  };

  // Toggle all commands in a group
  const handleToggleGroup = async (groupName: string, enable: boolean) => {
    try {
      await toggleGroup(groupName, enable, locationFilter);
    } catch (error) {
      console.error('Failed to toggle group:', error);
    }
  };

  // Calculate command counts per location
  const projectCount = useMemo(
    () => commands.filter((c) => c.location === 'project').length,
    [commands]
  );
  const userCount = useMemo(
    () => commands.filter((c) => c.location === 'user').length,
    [commands]
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4">
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

        {/* Location and Show Disabled Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <LocationSwitcher
            currentLocation={locationFilter}
            onLocationChange={setLocationFilter}
            projectCount={projectCount}
            userCount={userCount}
            disabled={isToggling}
          />
          <div className="flex items-center gap-2">
            <Button
              variant={showDisabledCommands ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowDisabledCommands((prev) => !prev)}
              disabled={isToggling}
            >
              {showDisabledCommands ? (
                <Eye className="w-4 h-4 mr-2" />
              ) : (
                <EyeOff className="w-4 h-4 mr-2" />
              )}
              {showDisabledCommands
                ? formatMessage({ id: 'commands.actions.hideDisabled' })
                : formatMessage({ id: 'commands.actions.showDisabled' })}
              <span className="ml-1 text-xs opacity-70">({disabledCount})</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-primary" />
            <span className="text-2xl font-bold">{commands.length}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'commands.stats.total' })}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <span className="text-2xl font-bold">{enabledCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'commands.stats.enabled' })}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-muted-foreground" />
            <span className="text-2xl font-bold">{disabledCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'commands.stats.disabled' })}
          </p>
        </Card>
      </div>

      {/* Search and Expand/Collapse Controls */}
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={expandAll} disabled={groups.length === 0}>
            {formatMessage({ id: 'commands.actions.expandAll' })}
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll} disabled={groups.length === 0}>
            {formatMessage({ id: 'commands.actions.collapseAll' })}
          </Button>
        </div>
      </div>

      {/* Command Groups Accordion */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card className="p-8 text-center">
          <Terminal className="w-12 h-12 mx-auto text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium text-foreground">
            {formatMessage({ id: 'commands.emptyState.title' })}
          </h3>
          <p className="mt-2 text-muted-foreground">
            {formatMessage({ id: 'commands.emptyState.message' })}
          </p>
        </Card>
      ) : (
        <div className="commands-accordion">
          {groups.map((groupName) => {
            const groupCommands = groupedCommands[groupName] || [];
            return (
              <CommandGroupAccordion
                key={groupName}
                groupName={groupName}
                commands={groupCommands}
                isExpanded={expandedGroups.has(groupName)}
                onToggleExpand={toggleGroupExpand}
                onToggleCommand={handleToggleCommand}
                onToggleGroup={handleToggleGroup}
                isToggling={isToggling}
                showDisabled={showDisabledCommands}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CommandsManagerPage;
