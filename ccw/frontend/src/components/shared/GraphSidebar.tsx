// ========================================
// Graph Sidebar Component
// ========================================
// Sidebar with legend and node details for Graph Explorer

import { useIntl } from 'react-intl';
import { X, Info, Network, FileText, GitBranch, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { GraphNode, NodeType, EdgeType } from '@/types/graph-explorer';

export interface GraphSidebarProps {
  /** Selected node */
  selectedNode: GraphNode | null;
  /** Legend visibility */
  showLegend?: boolean;
  /** On close callback */
  onClose: () => void;
}

/**
 * Node type legend item
 */
interface LegendItem {
  type: NodeType;
  label: string;
  color: string;
  icon: React.ElementType;
}

/**
 * Graph sidebar component
 */
export function GraphSidebar({ selectedNode, showLegend = true, onClose }: GraphSidebarProps) {
  const { formatMessage } = useIntl();

  const legendItems: LegendItem[] = [
    {
      type: 'component',
      label: formatMessage({ id: 'graph.legend.component' }),
      color: 'bg-blue-500',
      icon: Network,
    },
    {
      type: 'module',
      label: formatMessage({ id: 'graph.legend.module' }),
      color: 'bg-blue-500',
      icon: FileText,
    },
    {
      type: 'class',
      label: formatMessage({ id: 'graph.legend.class' }),
      color: 'bg-green-500',
      icon: GitBranch,
    },
    {
      type: 'function',
      label: formatMessage({ id: 'graph.legend.function' }),
      color: 'bg-orange-500',
      icon: Zap,
    },
    {
      type: 'variable',
      label: formatMessage({ id: 'graph.legend.variable' }),
      color: 'bg-cyan-500',
      icon: Info,
    },
  ];

  const edgeLegendItems = [
    {
      type: 'imports' as EdgeType,
      label: formatMessage({ id: 'graph.legend.imports' }),
      color: 'stroke-gray-500',
      dashArray: '',
    },
    {
      type: 'calls' as EdgeType,
      label: formatMessage({ id: 'graph.legend.calls' }),
      color: 'stroke-green-500',
      dashArray: '',
    },
    {
      type: 'extends' as EdgeType,
      label: formatMessage({ id: 'graph.legend.extends' }),
      color: 'stroke-purple-500',
      dashArray: 'stroke-dasharray',
    },
  ];

  return (
    <div className="w-80 bg-card border-l border-border flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-semibold text-sm">
          {selectedNode
            ? formatMessage({ id: 'graph.sidebar.nodeDetails' })
            : formatMessage({ id: 'graph.sidebar.title' })}
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Node details */}
        {selectedNode ? (
          <div className="p-4 space-y-4">
            {/* Node header */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">{selectedNode.type}</Badge>
                {selectedNode.data.hasIssues && (
                  <Badge variant="destructive">
                    {formatMessage({ id: 'graph.sidebar.hasIssues' })}
                  </Badge>
                )}
              </div>
              <h3 className="text-lg font-semibold">{selectedNode.data.label}</h3>
            </div>

            {/* File path */}
            {selectedNode.data.filePath && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {formatMessage({ id: 'graph.sidebar.filePath' })}
                </label>
                <p className="text-sm font-mono mt-1 break-all">{selectedNode.data.filePath}</p>
              </div>
            )}

            {/* Line number */}
            {selectedNode.data.lineNumber && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {formatMessage({ id: 'graph.sidebar.lineNumber' })}
                </label>
                <p className="text-sm mt-1">{selectedNode.data.lineNumber}</p>
              </div>
            )}

            {/* Category */}
            {selectedNode.data.category && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {formatMessage({ id: 'graph.sidebar.category' })}
                </label>
                <p className="text-sm mt-1 capitalize">{selectedNode.data.category}</p>
              </div>
            )}

            {/* Line count */}
            {selectedNode.data.lineCount && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {formatMessage({ id: 'graph.sidebar.lineCount' })}
                </label>
                <p className="text-sm mt-1">{selectedNode.data.lineCount} lines</p>
              </div>
            )}

            {/* Documentation */}
            {selectedNode.data.documentation && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {formatMessage({ id: 'graph.sidebar.documentation' })}
                </label>
                <p className="text-sm mt-1 text-muted-foreground">{selectedNode.data.documentation}</p>
              </div>
            )}

            {/* Tags */}
            {selectedNode.data.tags && selectedNode.data.tags.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {formatMessage({ id: 'graph.sidebar.tags' })}
                </label>
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedNode.data.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Issues */}
            {selectedNode.data.issues && selectedNode.data.issues.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  {formatMessage({ id: 'graph.sidebar.issues' })}
                </label>
                <ul className="mt-2 space-y-1">
                  {selectedNode.data.issues.map((issue, idx) => (
                    <li key={idx} className="text-sm text-red-600 dark:text-red-400">
                      • {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 space-y-6">
            {/* Node types legend */}
            {showLegend && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">
                  {formatMessage({ id: 'graph.legend.nodeTypes' })}
                </h3>
                <div className="space-y-2">
                  {legendItems.map(item => {
                    const Icon = item.icon;
                    return (
                      <div key={item.type} className="flex items-center gap-2">
                        <div className={cn('w-4 h-4 rounded', item.color)} />
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Edge types legend */}
            {showLegend && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">
                  {formatMessage({ id: 'graph.legend.edgeTypes' })}
                </h3>
                <div className="space-y-2">
                  {edgeLegendItems.map(item => (
                    <div key={item.type} className="flex items-center gap-2">
                      <div className={cn('w-8 h-0.5', item.color, item.dashArray)} />
                      <span className="text-sm">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">
                {formatMessage({ id: 'graph.sidebar.instructions' })}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
