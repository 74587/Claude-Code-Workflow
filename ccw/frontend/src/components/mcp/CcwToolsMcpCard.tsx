// ========================================
// CCW Tools MCP Card Component
// ========================================
// Special card component for CCW Tools MCP server configuration
// Displays tool checkboxes, path settings, and install/uninstall actions

import { useState } from 'react';
import { useIntl } from 'react-intl';
import { useMutation } from '@tanstack/react-query';
import {
  Settings,
  Check,
  FolderTree,
  Shield,
  Database,
  FileText,
  HardDrive,
  MessageCircleQuestion,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  installCcwMcp,
  uninstallCcwMcp,
  updateCcwConfig,
} from '@/lib/api';
import { mcpServersKeys } from '@/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

// ========== Types ==========

/**
 * CCW Tool definition with name, description, and core flag
 */
export interface CcwTool {
  name: string;
  desc: string;
  core: boolean;
}

/**
 * CCW MCP configuration interface
 */
export interface CcwConfig {
  enabledTools: string[];
  projectRoot?: string;
  allowedDirs?: string;
  disableSandbox?: boolean;
}

/**
 * Props for CcwToolsMcpCard component
 */
export interface CcwToolsMcpCardProps {
  /** Whether CCW MCP is installed */
  isInstalled: boolean;
  /** List of enabled tool names */
  enabledTools: string[];
  /** Project root path */
  projectRoot?: string;
  /** Comma-separated list of allowed directories */
  allowedDirs?: string;
  /** Whether sandbox is disabled */
  disableSandbox?: boolean;
  /** Callback when a tool is toggled */
  onToggleTool: (tool: string, enabled: boolean) => void;
  /** Callback when configuration is updated */
  onUpdateConfig: (config: Partial<CcwConfig>) => void;
  /** Callback when install/uninstall is triggered */
  onInstall: () => void;
}

// ========== Constants ==========

/**
 * CCW MCP Tools definition
 * Available tools that can be enabled/disabled in CCW MCP server
 */
export const CCW_MCP_TOOLS: CcwTool[] = [
  { name: 'write_file', desc: 'Write/create files', core: true },
  { name: 'edit_file', desc: 'Edit/replace content', core: true },
  { name: 'read_file', desc: 'Read file contents', core: true },
  { name: 'core_memory', desc: 'Core memory management', core: true },
  { name: 'ask_question', desc: 'Interactive questions (A2UI)', core: false },
];

// ========== Component ==========

export function CcwToolsMcpCard({
  isInstalled,
  enabledTools,
  projectRoot,
  allowedDirs,
  disableSandbox,
  onToggleTool,
  onUpdateConfig,
  onInstall,
}: CcwToolsMcpCardProps) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();

  // Local state for config inputs
  const [projectRootInput, setProjectRootInput] = useState(projectRoot || '');
  const [allowedDirsInput, setAllowedDirsInput] = useState(allowedDirs || '');
  const [disableSandboxInput, setDisableSandboxInput] = useState(disableSandbox || false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Mutations for install/uninstall
  const installMutation = useMutation({
    mutationFn: installCcwMcp,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mcpServersKeys.all });
      queryClient.invalidateQueries({ queryKey: ['ccwMcpConfig'] });
      onInstall();
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: uninstallCcwMcp,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mcpServersKeys.all });
      queryClient.invalidateQueries({ queryKey: ['ccwMcpConfig'] });
      onInstall();
    },
    onError: (error) => {
      console.error('Failed to uninstall CCW MCP:', error);
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: updateCcwConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mcpServersKeys.all });
    },
  });

  // Handlers
  const handleToggleTool = (toolName: string, enabled: boolean) => {
    onToggleTool(toolName, enabled);
  };

  const handleEnableAll = () => {
    CCW_MCP_TOOLS.forEach((tool) => {
      if (!enabledTools.includes(tool.name)) {
        onToggleTool(tool.name, true);
      }
    });
  };

  const handleDisableAll = () => {
    enabledTools.forEach((toolName) => {
      onToggleTool(toolName, false);
    });
  };

  const handleConfigSave = () => {
    updateConfigMutation.mutate({
      projectRoot: projectRootInput || undefined,
      allowedDirs: allowedDirsInput || undefined,
      disableSandbox: disableSandboxInput,
    });
  };

  const handleInstallClick = () => {
    installMutation.mutate();
  };

  const handleUninstallClick = () => {
    if (confirm(formatMessage({ id: 'mcp.ccw.actions.uninstallConfirm' }))) {
      uninstallMutation.mutate();
    }
  };

  const isPending = installMutation.isPending || uninstallMutation.isPending || updateConfigMutation.isPending;

  return (
    <Card className={cn(
      'overflow-hidden border-2',
      isInstalled ? 'border-primary/50 bg-primary/5' : 'border-dashed'
    )}>
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              isInstalled ? 'bg-primary/20' : 'bg-muted'
            )}>
              <Settings className={cn(
                'w-5 h-5',
                isInstalled ? 'text-primary' : 'text-muted-foreground'
              )} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {formatMessage({ id: 'mcp.ccw.title' })}
                </span>
                <Badge variant={isInstalled ? 'default' : 'secondary'} className="text-xs">
                  {isInstalled ? formatMessage({ id: 'mcp.ccw.status.installed' }) : formatMessage({ id: 'mcp.ccw.status.notInstalled' })}
                </Badge>
                {isInstalled && (
                  <Badge variant="outline" className="text-xs text-info">
                    {formatMessage({ id: 'mcp.ccw.status.special' })}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {formatMessage({ id: 'mcp.ccw.description' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border p-4 space-y-4 bg-muted/30">
          {/* Quick Select Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEnableAll}
              disabled={!isInstalled}
            >
              <Check className="w-4 h-4 mr-1" />
              {formatMessage({ id: 'mcp.ccw.actions.enableAll' })}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisableAll}
              disabled={!isInstalled}
            >
              {formatMessage({ id: 'mcp.ccw.actions.disableAll' })}
            </Button>
          </div>

          {/* Tool Checkboxes */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">
              {formatMessage({ id: 'mcp.ccw.tools.label' })}
            </p>
            <div className="space-y-2">
              {CCW_MCP_TOOLS.map((tool) => {
                const isEnabled = enabledTools.includes(tool.name);
                const icon = getToolIcon(tool.name);

                return (
                  <div
                    key={tool.name}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-lg transition-colors',
                      isEnabled ? 'bg-background' : 'bg-muted/50'
                    )}
                  >
                    <input
                      type="checkbox"
                      id={`ccw-tool-${tool.name}`}
                      checked={isEnabled}
                      onChange={(e) => handleToggleTool(tool.name, e.target.checked)}
                      disabled={!isInstalled}
                      className="w-4 h-4"
                    />
                    <label
                      htmlFor={`ccw-tool-${tool.name}`}
                      className="flex items-center gap-2 flex-1 cursor-pointer"
                    >
                      {icon}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {formatMessage({ id: `mcp.ccw.tools.${tool.name}.name` })}
                          </span>
                          {tool.core && (
                            <Badge variant="secondary" className="text-xs">
                              {formatMessage({ id: 'mcp.ccw.tools.core' })}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatMessage({ id: `mcp.ccw.tools.${tool.name}.desc` })}
                        </p>
                      </div>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Path Configuration */}
          <div className="space-y-3 pt-3 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase">
              {formatMessage({ id: 'mcp.ccw.paths.label' })}
            </p>

            {/* Project Root */}
            <div className="space-y-1">
              <label className="text-sm text-foreground flex items-center gap-1">
                <FolderTree className="w-4 h-4" />
                {formatMessage({ id: 'mcp.ccw.paths.projectRoot' })}
              </label>
              <Input
                value={projectRootInput}
                onChange={(e) => setProjectRootInput(e.target.value)}
                placeholder={formatMessage({ id: 'mcp.ccw.paths.projectRootPlaceholder' })}
                disabled={!isInstalled}
                className="font-mono text-sm"
              />
            </div>

            {/* Allowed Dirs */}
            <div className="space-y-1">
              <label className="text-sm text-foreground flex items-center gap-1">
                <HardDrive className="w-4 h-4" />
                {formatMessage({ id: 'mcp.ccw.paths.allowedDirs' })}
              </label>
              <Input
                value={allowedDirsInput}
                onChange={(e) => setAllowedDirsInput(e.target.value)}
                placeholder={formatMessage({ id: 'mcp.ccw.paths.allowedDirsPlaceholder' })}
                disabled={!isInstalled}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {formatMessage({ id: 'mcp.ccw.paths.allowedDirsHint' })}
              </p>
            </div>

            {/* Disable Sandbox */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ccw-disable-sandbox"
                checked={disableSandboxInput}
                onChange={(e) => setDisableSandboxInput(e.target.checked)}
                disabled={!isInstalled}
                className="w-4 h-4"
              />
              <label
                htmlFor="ccw-disable-sandbox"
                className="text-sm text-foreground flex items-center gap-1 cursor-pointer"
              >
                <Shield className="w-4 h-4" />
                {formatMessage({ id: 'mcp.ccw.paths.disableSandbox' })}
              </label>
            </div>

            {/* Save Config Button */}
            {isInstalled && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleConfigSave}
                disabled={isPending}
                className="w-full"
              >
                {isPending
                  ? formatMessage({ id: 'mcp.ccw.actions.saving' })
                  : formatMessage({ id: 'mcp.ccw.actions.saveConfig' })
                }
              </Button>
            )}
          </div>

          {/* Install/Uninstall Button */}
          <div className="pt-3 border-t border-border">
            {!isInstalled ? (
              <Button
                onClick={handleInstallClick}
                disabled={isPending}
                className="w-full"
              >
                {isPending
                  ? formatMessage({ id: 'mcp.ccw.actions.installing' })
                  : formatMessage({ id: 'mcp.ccw.actions.install' })
                }
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={handleUninstallClick}
                disabled={isPending}
                className="w-full"
              >
                {isPending
                  ? formatMessage({ id: 'mcp.ccw.actions.uninstalling' })
                  : formatMessage({ id: 'mcp.ccw.actions.uninstall' })
                }
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ========== Helper Functions ==========

/**
 * Get icon component for a tool name
 */
function getToolIcon(toolName: string): React.ReactElement {
  const iconProps = { className: 'w-4 h-4 text-muted-foreground' };

  switch (toolName) {
    case 'write_file':
      return <FileText {...iconProps} />;
    case 'edit_file':
      return <Check {...iconProps} />;
    case 'read_file':
      return <Database {...iconProps} />;
    case 'core_memory':
      return <Settings {...iconProps} />;
    case 'ask_question':
      return <MessageCircleQuestion {...iconProps} />;
    default:
      return <Settings {...iconProps} />;
  }
}

export default CcwToolsMcpCard;
