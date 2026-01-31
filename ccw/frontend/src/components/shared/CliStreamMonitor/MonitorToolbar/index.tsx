// ========================================
// MonitorToolbar Component
// ========================================
// Toolbar for CLI Stream Monitor with search, filter, and view mode controls

import { Search, Settings, ChevronDown, X } from 'lucide-react';
import { useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/Dropdown';

// ========== Types ==========

export type FilterType = 'all' | 'errors' | 'content' | 'system';
export type ViewMode = 'preview' | 'json' | 'raw';

export interface MonitorToolbarProps {
  /** Current search query */
  searchQuery: string;
  /** Callback when search query changes */
  onSearchChange: (value: string) => void;
  /** Current filter type */
  filter: FilterType;
  /** Callback when filter changes */
  onFilterChange: (filter: FilterType) => void;
  /** Current view mode */
  viewMode: ViewMode;
  /** Callback when view mode changes */
  onViewModeChange: (mode: ViewMode) => void;
  /** Optional settings click handler */
  onSettingsClick?: () => void;
  /** Optional class name for custom styling */
  className?: string;
}

// ========== Filter Button Component ==========

interface FilterButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const FilterButton = ({ active, onClick, children }: FilterButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'px-3 py-1.5 text-sm rounded-md transition-colors',
      active
        ? 'bg-primary text-primary-foreground'
        : 'hover:bg-muted text-foreground'
    )}
  >
    {children}
  </button>
);

// ========== Main Toolbar Component ==========

export const MonitorToolbar = ({
  searchQuery,
  onSearchChange,
  filter,
  onFilterChange,
  viewMode,
  onViewModeChange,
  onSettingsClick,
  className,
}: MonitorToolbarProps) => {
  const { formatMessage } = useIntl();

  const filterLabels: Record<FilterType, string> = {
    all: formatMessage({ id: 'cliMonitor.filter.all' }),
    errors: formatMessage({ id: 'cliMonitor.filter.errors' }),
    content: formatMessage({ id: 'cliMonitor.filter.content' }),
    system: formatMessage({ id: 'cliMonitor.filter.system' }),
  };

  const viewModeLabels: Record<ViewMode, string> = {
    preview: formatMessage({ id: 'cliMonitor.view.preview' }),
    json: formatMessage({ id: 'cliMonitor.view.json' }),
    raw: formatMessage({ id: 'cliMonitor.view.raw' }),
  };

  return (
    <div
      className={cn(
        'h-12 flex items-center justify-between px-4',
        'bg-muted/30 dark:bg-muted-900/30',
        'border-b border-border',
        className
      )}
    >
      {/* Left: Search and Filter */}
      <div className="flex items-center gap-3 flex-1">
        {/* Search Box */}
        <div className="relative flex items-center">
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder={formatMessage({ id: 'cliMonitor.searchPlaceholder' })}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 pl-9 pr-8 text-sm w-64 bg-background border border-border"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 p-1 rounded-sm hover:bg-muted transition-colors"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1">
          <FilterButton
            active={filter === 'all'}
            onClick={() => onFilterChange('all')}
          >
            {filterLabels.all}
          </FilterButton>
          <FilterButton
            active={filter === 'errors'}
            onClick={() => onFilterChange('errors')}
          >
            {filterLabels.errors}
          </FilterButton>
          <FilterButton
            active={filter === 'content'}
            onClick={() => onFilterChange('content')}
          >
            {filterLabels.content}
          </FilterButton>
          <FilterButton
            active={filter === 'system'}
            onClick={() => onFilterChange('system')}
          >
            {filterLabels.system}
          </FilterButton>
        </div>
      </div>

      {/* Right: View Mode and Settings */}
      <div className="flex items-center gap-2">
        {/* View Mode Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1 pr-2">
              {viewModeLabels[viewMode]}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4}>
            <DropdownMenuLabel>{formatMessage({ id: 'cliMonitor.viewMode' })}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onViewModeChange('preview')}>
              {formatMessage({ id: 'cliMonitor.view.preview' })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewModeChange('json')}>
              {formatMessage({ id: 'cliMonitor.view.json' })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewModeChange('raw')}>
              {formatMessage({ id: 'cliMonitor.view.raw' })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Settings Button */}
        {onSettingsClick && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onSettingsClick}
            className="h-8 w-8"
            title={formatMessage({ id: 'cliMonitor.settings' })}
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

MonitorToolbar.displayName = 'MonitorToolbar';
