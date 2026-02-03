// ========================================
// All Projects Table Component
// ========================================
// Table component displaying all recent projects with MCP server statistics

import { useState } from 'react';
import { useIntl } from 'react-intl';
import { Folder, Clock, Database, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useProjectOperations } from '@/hooks';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

// ========== Types ==========

export interface ProjectServerStats {
  name: string;
  path: string;
  serverCount: number;
  enabledCount: number;
  lastModified?: string;
  isCurrent?: boolean;
}

export interface AllProjectsTableProps {
  /** Callback when a project is clicked */
  onProjectClick?: (projectPath: string) => void;
  /** Callback when open in new window is clicked */
  onOpenNewWindow?: (projectPath: string) => void;
  /** Additional class name */
  className?: string;
  /** Maximum number of projects to display */
  maxProjects?: number;
}

// ========== Component ==========

export function AllProjectsTable({
  onProjectClick,
  onOpenNewWindow,
  className,
  maxProjects,
}: AllProjectsTableProps) {
  const { formatMessage } = useIntl();
  const [sortField, setSortField] = useState<'name' | 'serverCount' | 'lastModified'>('lastModified');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const { projects, currentProject, isLoading } = useProjectOperations();

  // Mock server counts since backend doesn't provide per-project stats
  // In production, this would come from a dedicated API endpoint
  const projectStats: ProjectServerStats[] = projects.slice(0, maxProjects).map((path) => {
    const isCurrent = path === currentProject;
    // Extract name from path (last segment)
    const name = path.split(/[/\\]/).filter(Boolean).pop() || path;

    return {
      name,
      path,
      serverCount: Math.floor(Math.random() * 10), // Mock data
      enabledCount: Math.floor(Math.random() * 8), // Mock data
      lastModified: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      isCurrent,
    };
  });

  // Sort projects
  const sortedProjects = [...projectStats].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'serverCount':
        comparison = a.serverCount - b.serverCount;
        break;
      case 'lastModified':
        comparison = a.lastModified && b.lastModified
          ? new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime()
          : 0;
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Handle sort
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Handle project click
  const handleProjectClick = (projectPath: string) => {
    onProjectClick?.(projectPath);
  };

  // Handle open in new window
  const handleOpenNewWindow = (e: React.MouseEvent, projectPath: string) => {
    e.stopPropagation();
    onOpenNewWindow?.(projectPath);
  };

  if (isLoading) {
    return (
      <Card className={cn('p-8', className)}>
        <div className="flex items-center justify-center">
          <div className="animate-spin text-muted-foreground">-</div>
          <span className="ml-2 text-sm text-muted-foreground">
            {formatMessage({ id: 'common.actions.loading' })}
          </span>
        </div>
      </Card>
    );
  }

  if (sortedProjects.length === 0) {
    return (
      <Card className={cn('p-8', className)}>
        <div className="text-center">
          <Folder className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            {formatMessage({ id: 'mcp.allProjects.empty' })}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Table Header */}
      <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground uppercase">
        <div className="col-span-4">
          <button
            onClick={() => handleSort('name')}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            {formatMessage({ id: 'mcp.allProjects.name' })}
            {sortField === 'name' && (
              <span className="text-foreground">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            )}
          </button>
        </div>
        <div className="col-span-3">
          <button
            onClick={() => handleSort('serverCount')}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            {formatMessage({ id: 'mcp.allProjects.servers' })}
            {sortField === 'serverCount' && (
              <span className="text-foreground">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            )}
          </button>
        </div>
        <div className="col-span-3">
          <button
            onClick={() => handleSort('lastModified')}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            {formatMessage({ id: 'mcp.allProjects.lastModified' })}
            {sortField === 'lastModified' && (
              <span className="text-foreground">{sortDirection === 'asc' ? '↑' : '↓'}</span>
            )}
          </button>
        </div>
        <div className="col-span-2 text-right">
          {formatMessage({ id: 'mcp.allProjects.actions' })}
        </div>
      </div>

      {/* Table Rows */}
      <div className="divide-y divide-border">
        {sortedProjects.map((project) => (
          <div
            key={project.path}
            onClick={() => handleProjectClick(project.path)}
            className={cn(
              'grid grid-cols-12 gap-2 px-4 py-3 items-center transition-colors cursor-pointer hover:bg-muted/50',
              project.isCurrent && 'bg-primary/5 hover:bg-primary/10'
            )}
          >
            {/* Project Name */}
            <div className="col-span-4 min-w-0">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {project.name}
                    </span>
                    {project.isCurrent && (
                      <Badge variant="default" className="text-xs">
                        {formatMessage({ id: 'mcp.allProjects.current' })}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {project.path}
                  </p>
                </div>
              </div>
            </div>

            {/* Server Count */}
            <div className="col-span-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-foreground">
                  {project.serverCount} {formatMessage({ id: 'mcp.allProjects.servers' })}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    project.enabledCount > 0 ? 'text-success border-success/30' : 'text-muted-foreground'
                  )}
                >
                  {project.enabledCount} {formatMessage({ id: 'mcp.status.enabled' })}
                </Badge>
              </div>
            </div>

            {/* Last Modified */}
            <div className="col-span-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>
                  {project.lastModified
                    ? formatDistanceToNow(new Date(project.lastModified), { addSuffix: true })
                    : '-'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="col-span-2 flex justify-end gap-1">
              <button
                onClick={(e) => handleOpenNewWindow(e, project.path)}
                className="p-1.5 rounded hover:bg-muted transition-colors"
                title={formatMessage({ id: 'mcp.allProjects.openNewWindow' })}
              >
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-muted/30 border-t border-border text-xs text-muted-foreground">
        {formatMessage(
          { id: 'mcp.allProjects.summary' },
          { count: sortedProjects.length }
        )}
      </div>
    </Card>
  );
}

export default AllProjectsTable;
