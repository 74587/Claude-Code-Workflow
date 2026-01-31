// ========================================
// MCP Manager Page
// ========================================
// Manage MCP servers (Model Context Protocol) with project/global scope switching
// Supports both Claude and Codex CLI modes

import { useState } from 'react';
import { useIntl } from 'react-intl';
import { useQuery } from '@tanstack/react-query';
import {
  Server,
  Plus,
  Search,
  RefreshCw,
  Globe,
  Folder,
  Power,
  PowerOff,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { McpServerDialog } from '@/components/mcp/McpServerDialog';
import { CliModeToggle, type CliMode } from '@/components/mcp/CliModeToggle';
import { CodexMcpCard } from '@/components/mcp/CodexMcpCard';
import { CcwToolsMcpCard } from '@/components/mcp/CcwToolsMcpCard';
import { useMcpServers, useMcpServerMutations } from '@/hooks';
import {
  fetchCodexMcpServers,
  fetchCcwMcpConfig,
  updateCcwConfig,
  type McpServer,
  type CodexMcpServer,
  type CcwMcpConfig,
} from '@/lib/api';
import { cn } from '@/lib/utils';

// ========== MCP Server Card Component ==========

interface McpServerCardProps {
  server: McpServer;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggle: (serverName: string, enabled: boolean) => void;
  onEdit: (server: McpServer) => void;
  onDelete: (serverName: string) => void;
}

function McpServerCard({ server, isExpanded, onToggleExpand, onToggle, onEdit, onDelete }: McpServerCardProps) {
  const { formatMessage } = useIntl();

  return (
    <Card className={cn('overflow-hidden', !server.enabled && 'opacity-60')}>
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              server.enabled ? 'bg-primary/10' : 'bg-muted'
            )}>
              <Server className={cn(
                'w-5 h-5',
                server.enabled ? 'text-primary' : 'text-muted-foreground'
              )} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {server.name}
                </span>
                <Badge variant={server.scope === 'global' ? 'default' : 'secondary'} className="text-xs">
                  {server.scope === 'global' ? (
                    <><Globe className="w-3 h-3 mr-1" />{formatMessage({ id: 'mcp.scope.global' })}</>
                  ) : (
                    <><Folder className="w-3 h-3 mr-1" />{formatMessage({ id: 'mcp.scope.project' })}</>
                  )}
                </Badge>
                {server.enabled && (
                  <Badge variant="outline" className="text-xs text-green-600">
                    {formatMessage({ id: 'mcp.status.enabled' })}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 font-mono">
                {server.command} {server.args?.join(' ') || ''}
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
                onToggle(server.name, !server.enabled);
              }}
            >
              {server.enabled ? <Power className="w-4 h-4 text-green-600" /> : <PowerOff className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(server);
              }}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(server.name);
              }}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border p-4 space-y-3 bg-muted/30">
          {/* Command details */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">{formatMessage({ id: 'mcp.command' })}</p>
            <code className="text-sm bg-background px-2 py-1 rounded block overflow-x-auto">
              {server.command}
            </code>
          </div>

          {/* Args */}
          {server.args && server.args.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">{formatMessage({ id: 'mcp.args' })}</p>
              <div className="flex flex-wrap gap-1">
                {server.args.map((arg, idx) => (
                  <Badge key={idx} variant="outline" className="font-mono text-xs">
                    {arg}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Environment variables */}
          {server.env && Object.keys(server.env).length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">{formatMessage({ id: 'mcp.env' })}</p>
              <div className="space-y-1">
                {Object.entries(server.env).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    <Badge variant="secondary" className="font-mono">{key}</Badge>
                    <span className="text-muted-foreground">=</span>
                    <code className="text-xs bg-background px-2 py-1 rounded flex-1 overflow-x-auto">
                      {value as string}
                    </code>
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

export function McpManagerPage() {
  const { formatMessage } = useIntl();
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'project' | 'global'>('all');
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<McpServer | undefined>(undefined);
  const [cliMode, setCliMode] = useState<CliMode>('claude');
  const [codexExpandedServers, setCodexExpandedServers] = useState<Set<string>>(new Set());

  const {
    servers,
    projectServers,
    globalServers,
    totalCount,
    enabledCount,
    isLoading,
    isFetching,
    refetch,
  } = useMcpServers({
    scope: scopeFilter === 'all' ? undefined : scopeFilter,
  });

  // Fetch Codex MCP servers when in codex mode
  const codexQuery = useQuery({
    queryKey: ['codexMcpServers'],
    queryFn: fetchCodexMcpServers,
    enabled: cliMode === 'codex',
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch CCW Tools MCP configuration (Claude mode only)
  const ccwMcpQuery = useQuery({
    queryKey: ['ccwMcpConfig'],
    queryFn: fetchCcwMcpConfig,
    enabled: cliMode === 'claude',
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const {
    toggleServer,
    deleteServer,
  } = useMcpServerMutations();

  const toggleExpand = (serverName: string) => {
    setExpandedServers((prev) => {
      const next = new Set(prev);
      if (next.has(serverName)) {
        next.delete(serverName);
      } else {
        next.add(serverName);
      }
      return next;
    });
  };

  const toggleCodexExpand = (serverName: string) => {
    setCodexExpandedServers((prev) => {
      const next = new Set(prev);
      if (next.has(serverName)) {
        next.delete(serverName);
      } else {
        next.add(serverName);
      }
      return next;
    });
  };

  const handleToggle = (serverName: string, enabled: boolean) => {
    toggleServer(serverName, enabled);
  };

  const handleDelete = (serverName: string) => {
    if (confirm(formatMessage({ id: 'mcp.deleteConfirm' }, { name: serverName }))) {
      deleteServer(serverName);
    }
  };

  const handleEdit = (server: McpServer) => {
    setEditingServer(server);
    setDialogOpen(true);
  };

  const handleAddClick = () => {
    setEditingServer(undefined);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingServer(undefined);
  };

  const handleDialogSave = () => {
    setDialogOpen(false);
    setEditingServer(undefined);
    refetch();
  };

  const handleModeChange = (mode: CliMode) => {
    setCliMode(mode);
  };

  // CCW MCP handlers
  const ccwConfig = ccwMcpQuery.data ?? {
    isInstalled: false,
    enabledTools: [],
    projectRoot: undefined,
    allowedDirs: undefined,
    disableSandbox: undefined,
  };

  const handleToggleCcwTool = async (tool: string, enabled: boolean) => {
    const updatedTools = enabled
      ? [...ccwConfig.enabledTools, tool]
      : ccwConfig.enabledTools.filter((t) => t !== tool);
    await updateCcwConfig({ enabledTools: updatedTools });
    ccwMcpQuery.refetch();
  };

  const handleUpdateCcwConfig = async (config: Partial<CcwMcpConfig>) => {
    await updateCcwConfig(config);
    ccwMcpQuery.refetch();
  };

  const handleCcwInstall = () => {
    ccwMcpQuery.refetch();
  };

  // Filter servers by search query
  const filteredServers = servers.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.command.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter Codex servers by search query
  const codexServers = codexQuery.data?.servers ?? [];
  const codexConfigPath = codexQuery.data?.configPath ?? '';
  const filteredCodexServers = codexServers.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.command.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentServers = cliMode === 'codex' ? filteredCodexServers : filteredServers;
  const currentExpanded = cliMode === 'codex' ? codexExpandedServers : expandedServers;
  const currentToggleExpand = cliMode === 'codex' ? toggleCodexExpand : toggleExpand;
  const currentIsLoading = cliMode === 'codex' ? codexQuery.isLoading : isLoading;
  const currentIsFetching = cliMode === 'codex' ? codexQuery.isFetching : isFetching;
  const currentRefetch = cliMode === 'codex' ? (() => codexQuery.refetch()) : refetch;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Server className="w-6 h-6 text-primary" />
            {formatMessage({ id: 'mcp.title' })}
          </h1>
          <p className="text-muted-foreground mt-1">
            {formatMessage({ id: 'mcp.description' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => currentRefetch()} disabled={currentIsFetching}>
            <RefreshCw className={cn('w-4 h-4 mr-2', currentIsFetching && 'animate-spin')} />
            {formatMessage({ id: 'common.actions.refresh' })}
          </Button>
          {cliMode === 'claude' && (
            <Button onClick={handleAddClick}>
              <Plus className="w-4 h-4 mr-2" />
              {formatMessage({ id: 'mcp.actions.add' })}
            </Button>
          )}
        </div>
      </div>

      {/* CLI Mode Toggle */}
      <CliModeToggle
        currentMode={cliMode}
        onModeChange={handleModeChange}
        codexConfigPath={codexConfigPath}
      />

      {/* Stats Cards - Claude mode only */}
      {cliMode === 'claude' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" />
              <span className="text-2xl font-bold">{totalCount}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'mcp.stats.total' })}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Power className="w-5 h-5 text-green-600" />
              <span className="text-2xl font-bold">{enabledCount}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'mcp.stats.enabled' })}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-info" />
              <span className="text-2xl font-bold">{globalServers.length}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'mcp.stats.global' })}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Folder className="w-5 h-5 text-warning" />
              <span className="text-2xl font-bold">{projectServers.length}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'mcp.stats.project' })}</p>
          </Card>
        </div>
      )}

      {/* Filters and Search - Claude mode only */}
      {cliMode === 'claude' && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={formatMessage({ id: 'mcp.filters.searchPlaceholder' })}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={scopeFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setScopeFilter('all')}
            >
              {formatMessage({ id: 'mcp.filters.all' })}
            </Button>
            <Button
              variant={scopeFilter === 'global' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setScopeFilter('global')}
            >
              <Globe className="w-4 h-4 mr-1" />
              {formatMessage({ id: 'mcp.scope.global' })}
            </Button>
            <Button
              variant={scopeFilter === 'project' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setScopeFilter('project')}
            >
              <Folder className="w-4 h-4 mr-1" />
              {formatMessage({ id: 'mcp.scope.project' })}
            </Button>
          </div>
        </div>
      )}

      {/* Codex mode search only */}
      {cliMode === 'codex' && (
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={formatMessage({ id: 'mcp.filters.searchPlaceholder' })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* CCW Tools MCP Card - Claude mode only */}
      {cliMode === 'claude' && (
        <CcwToolsMcpCard
          isInstalled={ccwConfig.isInstalled}
          enabledTools={ccwConfig.enabledTools}
          projectRoot={ccwConfig.projectRoot}
          allowedDirs={ccwConfig.allowedDirs}
          disableSandbox={ccwConfig.disableSandbox}
          onToggleTool={handleToggleCcwTool}
          onUpdateConfig={handleUpdateCcwConfig}
          onInstall={handleCcwInstall}
        />
      )}

      {/* Servers List */}
      {currentIsLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : currentServers.length === 0 ? (
        <Card className="p-8 text-center">
          <Server className="w-12 h-12 mx-auto text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium text-foreground">{formatMessage({ id: 'mcp.emptyState.title' })}</h3>
          <p className="mt-2 text-muted-foreground">
            {formatMessage({ id: 'mcp.emptyState.message' })}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {currentServers.map((server) => (
            cliMode === 'codex' ? (
              <CodexMcpCard
                key={server.name}
                server={server as CodexMcpServer}
                enabled={server.enabled}
                isExpanded={currentExpanded.has(server.name)}
                onToggleExpand={() => currentToggleExpand(server.name)}
              />
            ) : (
              <McpServerCard
                key={server.name}
                server={server}
                isExpanded={currentExpanded.has(server.name)}
                onToggleExpand={() => currentToggleExpand(server.name)}
                onToggle={handleToggle}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            )
          ))}
        </div>
      )}

      {/* Add/Edit Dialog - Claude mode only */}
      {cliMode === 'claude' && (
        <McpServerDialog
          mode={editingServer ? 'edit' : 'add'}
          server={editingServer}
          open={dialogOpen}
          onClose={handleDialogClose}
          onSave={handleDialogSave}
        />
      )}
    </div>
  );
}

export default McpManagerPage;
