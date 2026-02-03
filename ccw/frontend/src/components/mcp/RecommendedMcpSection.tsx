// ========================================
// Recommended MCP Section Component
// ========================================
// Display recommended MCP servers with one-click install functionality

import { useState } from 'react';
import { useIntl } from 'react-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Globe,
  Sparkles,
  Download,
  Check,
  Loader2,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import {
  createMcpServer,
  fetchMcpServers,
} from '@/lib/api';
import { mcpServersKeys } from '@/hooks';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

// ========== Types ==========

/**
 * Recommended server configuration
 */
export interface RecommendedServer {
  id: string;
  name: string;
  description: string;
  command: string;
  args: string[];
  icon: React.ComponentType<{ className?: string }>;
  category: 'search' | 'browser' | 'ai';
}

/**
 * Props for RecommendedMcpSection component
 */
export interface RecommendedMcpSectionProps {
  /** Callback when server is installed */
  onInstallComplete?: () => void;
}

interface RecommendedServerCardProps {
  server: RecommendedServer;
  isInstalled: boolean;
  isInstalling: boolean;
  onInstall: (server: RecommendedServer) => void;
}

// ========== Constants ==========

/**
 * Pre-configured recommended MCP servers
 */
const RECOMMENDED_SERVERS: RecommendedServer[] = [
  {
    id: 'ace-tool',
    name: 'ACE Tool',
    description: 'Advanced code search and context engine for intelligent code discovery',
    command: 'mcp__ace-tool__search_context',
    args: [],
    icon: Search,
    category: 'search',
  },
  {
    id: 'chrome-devtools',
    name: 'Chrome DevTools',
    description: 'Browser automation and debugging tools for web development',
    command: 'mcp__chrome-devtools',
    args: [],
    icon: Globe,
    category: 'browser',
  },
  {
    id: 'exa-search',
    name: 'Exa Search',
    description: 'AI-powered web search with real-time crawling capabilities',
    command: 'mcp__exa__search',
    args: [],
    icon: Sparkles,
    category: 'ai',
  },
];

// ========== Helper Component ==========

/**
 * Individual recommended server card
 */
function RecommendedServerCard({
  server,
  isInstalled,
  isInstalling,
  onInstall,
}: RecommendedServerCardProps) {
  const { formatMessage } = useIntl();
  const Icon = server.icon;

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn(
          'p-2.5 rounded-lg',
          isInstalled ? 'bg-primary/20' : 'bg-muted'
        )}>
          <Icon className={cn(
            'w-5 h-5',
            isInstalled ? 'text-primary' : 'text-muted-foreground'
          )} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-foreground truncate">
              {server.name}
            </h4>
            {isInstalled && (
              <Badge variant="default" className="text-xs">
                {formatMessage({ id: 'mcp.recommended.actions.installed' })}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
            {server.description}
          </p>

          {/* Install Button */}
          {!isInstalled && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onInstall(server)}
              disabled={isInstalling}
              className="w-full"
            >
              {isInstalling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  {formatMessage({ id: 'mcp.recommended.actions.installing' })}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-1" />
                  {formatMessage({ id: 'mcp.recommended.actions.install' })}
                </>
              )}
            </Button>
          )}

          {/* Installed Indicator */}
          {isInstalled && (
            <div className="flex items-center gap-1 text-xs text-primary">
              <Check className="w-4 h-4" />
              <span>{formatMessage({ id: 'mcp.recommended.actions.installed' })}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ========== Main Component ==========

/**
 * Recommended MCP servers section with one-click install
 */
export function RecommendedMcpSection({
  onInstallComplete,
}: RecommendedMcpSectionProps) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const { success, error } = useNotifications();

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedServer, setSelectedServer] = useState<RecommendedServer | null>(null);
  const [installingServerId, setInstallingServerId] = useState<string | null>(null);
  const [installedServerIds, setInstalledServerIds] = useState<Set<string>>(new Set());

  // Check which servers are already installed
  const checkInstalledServers = async () => {
    try {
      const data = await fetchMcpServers();
      const allServers = [...data.project, ...data.global];
      const installedIds = new Set(
        allServers
          .filter(s => s.command.startsWith('mcp__'))
          .map(s => s.command)
      );
      setInstalledServerIds(installedIds);
    } catch {
      // Ignore errors during check
    }
  };

  // Check on mount
  useState(() => {
    checkInstalledServers();
  });

  // Create server mutation
  const createMutation = useMutation({
    mutationFn: (server: Omit<RecommendedServer, 'id' | 'icon' | 'category'>) =>
      createMcpServer({
        command: server.command,
        args: server.args,
        scope: 'global',
        enabled: true,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: mcpServersKeys.all });
      setInstalledServerIds(prev => new Set(prev).add(variables.command));
      setInstallingServerId(null);
      setConfirmDialogOpen(false);
      setSelectedServer(null);
      success(
        formatMessage({ id: 'mcp.recommended.actions.installed' }),
        formatMessage({ id: 'mcp.recommended.servers.' + selectedServer?.id + '.name' })
      );
      onInstallComplete?.();
    },
    onError: () => {
      setInstallingServerId(null);
      error(
        formatMessage({ id: 'mcp.dialog.validation.nameRequired' }),
        formatMessage({ id: 'mcp.dialog.validation.commandRequired' })
      );
    },
  });

  // Handle install click
  const handleInstallClick = (server: RecommendedServer) => {
    setSelectedServer(server);
    setConfirmDialogOpen(true);
  };

  // Handle confirm install
  const handleConfirmInstall = () => {
    if (!selectedServer) return;
    setInstallingServerId(selectedServer.id);
    setConfirmDialogOpen(false);
    createMutation.mutate(selectedServer);
  };

  // Check if server is installed
  const isServerInstalled = (server: RecommendedServer) => {
    return installedServerIds.has(server.command);
  };

  return (
    <>
      <section className="space-y-4">
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {formatMessage({ id: 'mcp.recommended.title' })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {formatMessage({ id: 'mcp.recommended.description' })}
          </p>
        </div>

        {/* Server Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {RECOMMENDED_SERVERS.map((server) => (
            <RecommendedServerCard
              key={server.id}
              server={server}
              isInstalled={isServerInstalled(server)}
              isInstalling={installingServerId === server.id}
              onInstall={handleInstallClick}
            />
          ))}
        </div>
      </section>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {formatMessage({ id: 'mcp.recommended.actions.install' })} {selectedServer?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              {formatMessage(
                { id: 'mcp.recommended.description' },
                { server: selectedServer?.name }
              )}
            </p>
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <code className="text-xs font-mono">
                {selectedServer?.command} {selectedServer?.args.join(' ')}
              </code>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
              disabled={createMutation.isPending}
            >
              {formatMessage({ id: 'mcp.dialog.actions.cancel' })}
            </Button>
            <Button
              onClick={handleConfirmInstall}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  {formatMessage({ id: 'mcp.recommended.actions.installing' })}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-1" />
                  {formatMessage({ id: 'mcp.recommended.actions.install' })}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default RecommendedMcpSection;
