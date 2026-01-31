// ========================================
// Graph Toolbar Component
// ========================================
// Toolbar with filters and actions for Graph Explorer

import { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  Filter,
  Maximize,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/Dropdown';
import { Badge } from '@/components/ui/Badge';
import type { GraphFilters, NodeType, EdgeType } from '@/types/graph-explorer';

export interface GraphToolbarProps {
  /** Current filters */
  filters: GraphFilters;
  /** On filters change callback */
  onFiltersChange: (filters: GraphFilters) => void;
  /** On fit view callback */
  onFitView: () => void;
  /** On refresh callback */
  onRefresh: () => void;
  /** On reset filters callback */
  onResetFilters: () => void;
  /** Node type counts for badges */
  nodeTypeCounts?: Partial<Record<NodeType, number>>;
  /** Edge type counts for badges */
  edgeTypeCounts?: Partial<Record<EdgeType, number>>;
}

/**
 * Graph toolbar component
 */
export function GraphToolbar({
  filters,
  onFiltersChange,
  onFitView,
  onRefresh,
  onResetFilters,
  nodeTypeCounts,
  edgeTypeCounts,
}: GraphToolbarProps) {
  const { formatMessage } = useIntl();
  const [localFilters, setLocalFilters] = useState<GraphFilters>(filters);

  const nodeTypeLabels: Record<NodeType, string> = {
    component: formatMessage({ id: 'graph.nodeTypes.component' }),
    module: formatMessage({ id: 'graph.nodeTypes.module' }),
    function: formatMessage({ id: 'graph.nodeTypes.function' }),
    class: formatMessage({ id: 'graph.nodeTypes.class' }),
    interface: formatMessage({ id: 'graph.nodeTypes.interface' }),
    variable: formatMessage({ id: 'graph.nodeTypes.variable' }),
    file: formatMessage({ id: 'graph.nodeTypes.file' }),
    folder: formatMessage({ id: 'graph.nodeTypes.folder' }),
    dependency: formatMessage({ id: 'graph.nodeTypes.dependency' }),
    api: formatMessage({ id: 'graph.nodeTypes.api' }),
    database: formatMessage({ id: 'graph.nodeTypes.database' }),
    service: formatMessage({ id: 'graph.nodeTypes.service' }),
    hook: formatMessage({ id: 'graph.nodeTypes.hook' }),
    utility: formatMessage({ id: 'graph.nodeTypes.utility' }),
    unknown: formatMessage({ id: 'graph.nodeTypes.unknown' }),
  };

  const edgeTypeLabels: Record<EdgeType, string> = {
    imports: formatMessage({ id: 'graph.edgeTypes.imports' }),
    exports: formatMessage({ id: 'graph.edgeTypes.exports' }),
    extends: formatMessage({ id: 'graph.edgeTypes.extends' }),
    implements: formatMessage({ id: 'graph.edgeTypes.implements' }),
    uses: formatMessage({ id: 'graph.edgeTypes.uses' }),
    'depends-on': formatMessage({ id: 'graph.edgeTypes.dependsOn' }),
    calls: formatMessage({ id: 'graph.edgeTypes.calls' }),
    instantiates: formatMessage({ id: 'graph.edgeTypes.instantiates' }),
    contains: formatMessage({ id: 'graph.edgeTypes.contains' }),
    'related-to': formatMessage({ id: 'graph.edgeTypes.relatedTo' }),
    'data-flow': formatMessage({ id: 'graph.edgeTypes.dataFlow' }),
    event: formatMessage({ id: 'graph.edgeTypes.event' }),
    unknown: formatMessage({ id: 'graph.edgeTypes.unknown' }),
  };

  const handleNodeTypeToggle = (nodeType: NodeType) => {
    const current = localFilters.nodeTypes || [];
    const updated = current.includes(nodeType)
      ? current.filter(t => t !== nodeType)
      : [...current, nodeType];
    const newFilters = { ...localFilters, nodeTypes: updated };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleEdgeTypeToggle = (edgeType: EdgeType) => {
    const current = localFilters.edgeTypes || [];
    const updated = current.includes(edgeType)
      ? current.filter(t => t !== edgeType)
      : [...current, edgeType];
    const newFilters = { ...localFilters, edgeTypes: updated };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const hasActiveFilters =
    (localFilters.nodeTypes && localFilters.nodeTypes.length < Object.keys(nodeTypeLabels).length) ||
    (localFilters.edgeTypes && localFilters.edgeTypes.length < Object.keys(edgeTypeLabels).length) ||
    localFilters.searchQuery ||
    localFilters.showOnlyIssues;

  return (
    <div className="flex items-center gap-2 p-3 bg-card border-b border-border">
      {/* Node types filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="w-4 h-4" />
            {formatMessage({ id: 'graph.filters.nodeTypes' })}
            <Badge variant="secondary" className="ml-1">
              {localFilters.nodeTypes?.length || 0}
            </Badge>
            <ChevronDown className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>{formatMessage({ id: 'graph.filters.selectNodeTypes' })}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {Object.entries(nodeTypeLabels).map(([type, label]) => {
            const count = nodeTypeCounts?.[type as NodeType] || 0;
            const isChecked = localFilters.nodeTypes?.includes(type as NodeType);
            return (
              <DropdownMenuCheckboxItem
                key={type}
                checked={isChecked}
                onCheckedChange={() => handleNodeTypeToggle(type as NodeType)}
                disabled={count === 0}
              >
                <span className="flex-1">{label}</span>
                {count > 0 && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    {count}
                  </Badge>
                )}
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edge types filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="w-4 h-4" />
            {formatMessage({ id: 'graph.filters.edgeTypes' })}
            <Badge variant="secondary" className="ml-1">
              {localFilters.edgeTypes?.length || 0}
            </Badge>
            <ChevronDown className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>{formatMessage({ id: 'graph.filters.selectEdgeTypes' })}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {Object.entries(edgeTypeLabels).map(([type, label]) => {
            const count = edgeTypeCounts?.[type as EdgeType] || 0;
            const isChecked = localFilters.edgeTypes?.includes(type as EdgeType);
            return (
              <DropdownMenuCheckboxItem
                key={type}
                checked={isChecked}
                onCheckedChange={() => handleEdgeTypeToggle(type as EdgeType)}
                disabled={count === 0}
              >
                <span className="flex-1">{label}</span>
                {count > 0 && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    {count}
                  </Badge>
                )}
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Separator */}
      <div className="w-px h-6 bg-border" />

      {/* Zoom and view controls */}
      <Button variant="ghost" size="sm" onClick={onFitView} title={formatMessage({ id: 'graph.actions.fitView' })}>
        <Maximize className="w-4 h-4" />
      </Button>

      {/* Separator */}
      <div className="w-px h-6 bg-border" />

      {/* Actions */}
      <Button variant="ghost" size="sm" onClick={onRefresh} title={formatMessage({ id: 'graph.actions.refresh' })}>
        <RefreshCw className="w-4 h-4" />
      </Button>

      {/* Reset filters button (only show when active filters) */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onResetFilters}
          className="text-amber-600 dark:text-amber-400"
          title={formatMessage({ id: 'graph.actions.resetFilters' })}
        >
          <Filter className="w-4 h-4 mr-2" />
          {formatMessage({ id: 'graph.actions.reset' })}
        </Button>
      )}
    </div>
  );
}
