// ========================================
// DashboardToolbar Component
// ========================================
// Top toolbar for Terminal Dashboard V2.
// Provides toggle buttons for floating panels (Issues/Queue/Inspector)
// and layout preset controls. Sessions sidebar is always visible.

import { useCallback, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import {
  AlertCircle,
  ListChecks,
  Info,
  FolderOpen,
  LayoutGrid,
  Columns2,
  Rows2,
  Square,
  Terminal,
  ChevronDown,
  Zap,
  Settings,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/Dropdown';
import {
  useIssueQueueIntegrationStore,
  selectAssociationChain,
} from '@/stores/issueQueueIntegrationStore';
import { useIssues, useIssueQueue } from '@/hooks/useIssues';
import { useTerminalGridStore, selectTerminalGridFocusedPaneId } from '@/stores/terminalGridStore';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { sendCliSessionText } from '@/lib/api';
import { CliConfigModal, type CliSessionConfig } from './CliConfigModal';

// ========== Types ==========

export type PanelId = 'issues' | 'queue' | 'inspector' | 'files';

interface DashboardToolbarProps {
  activePanel: PanelId | null;
  onTogglePanel: (panelId: PanelId) => void;
}

// ========== Layout Presets ==========

const LAYOUT_PRESETS = [
  { id: 'single' as const, icon: Square, labelId: 'terminalDashboard.toolbar.layoutSingle' },
  { id: 'split-h' as const, icon: Columns2, labelId: 'terminalDashboard.toolbar.layoutSplitH' },
  { id: 'split-v' as const, icon: Rows2, labelId: 'terminalDashboard.toolbar.layoutSplitV' },
  { id: 'grid-2x2' as const, icon: LayoutGrid, labelId: 'terminalDashboard.toolbar.layoutGrid' },
];

type LaunchMode = 'default' | 'yolo';

const CLI_TOOLS = ['claude', 'gemini', 'qwen', 'codex', 'opencode'] as const;
type CliTool = (typeof CLI_TOOLS)[number];

const LAUNCH_COMMANDS: Record<CliTool, Record<LaunchMode, string>> = {
  claude:   { default: 'claude',   yolo: 'claude --permission-mode bypassPermissions' },
  gemini:   { default: 'gemini',   yolo: 'gemini --approval-mode yolo' },
  qwen:     { default: 'qwen',     yolo: 'qwen --approval-mode yolo' },
  codex:    { default: 'codex',    yolo: 'codex --full-auto' },
  opencode: { default: 'opencode', yolo: 'opencode' },
};

// ========== Component ==========

export function DashboardToolbar({ activePanel, onTogglePanel }: DashboardToolbarProps) {
  const { formatMessage } = useIntl();

  // Issues count
  const { openCount } = useIssues();

  // Queue count
  const queueQuery = useIssueQueue();
  const queueCount = useMemo(() => {
    if (!queueQuery.data) return 0;
    const grouped = queueQuery.data.grouped_items ?? {};
    let count = 0;
    for (const items of Object.values(grouped)) {
      count += items.length;
    }
    return count;
  }, [queueQuery.data]);

  // Inspector chain indicator
  const associationChain = useIssueQueueIntegrationStore(selectAssociationChain);
  const hasChain = associationChain !== null;

  // Layout preset handler
  const resetLayout = useTerminalGridStore((s) => s.resetLayout);
  const handlePreset = useCallback(
    (preset: 'single' | 'split-h' | 'split-v' | 'grid-2x2') => {
      resetLayout(preset);
    },
    [resetLayout]
  );

  // Launch CLI handlers
  const projectPath = useWorkflowStore(selectProjectPath);
  const focusedPaneId = useTerminalGridStore(selectTerminalGridFocusedPaneId);
  const createSessionAndAssign = useTerminalGridStore((s) => s.createSessionAndAssign);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedTool, setSelectedTool] = useState<CliTool>('gemini');
  const [launchMode, setLaunchMode] = useState<LaunchMode>('yolo');
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const handleQuickCreate = useCallback(async () => {
    if (!focusedPaneId || !projectPath) return;
    setIsCreating(true);
    try {
      const created = await createSessionAndAssign(focusedPaneId, {
        workingDir: projectPath,
        preferredShell: 'bash',
        tool: selectedTool,
      }, projectPath);

      if (created?.session?.sessionKey) {
        const command = LAUNCH_COMMANDS[selectedTool]?.[launchMode] ?? selectedTool;
        setTimeout(() => {
          sendCliSessionText(
            created.session.sessionKey,
            { text: command, appendNewline: true },
            projectPath
          ).catch((err) => console.error('[DashboardToolbar] auto-launch failed:', err));
        }, 300);
      }
    } finally {
      setIsCreating(false);
    }
  }, [focusedPaneId, projectPath, createSessionAndAssign, selectedTool, launchMode]);

  const handleConfigure = useCallback(() => {
    setIsConfigOpen(true);
  }, []);

  const handleCreateConfiguredSession = useCallback(async (config: CliSessionConfig) => {
    if (!focusedPaneId || !projectPath) throw new Error('No focused pane or project path');
    setIsCreating(true);
    try {
      const created = await createSessionAndAssign(
        focusedPaneId,
        {
          workingDir: config.workingDir || projectPath,
          preferredShell: config.preferredShell,
          tool: config.tool,
          model: config.model,
        },
        projectPath
      );

      if (!created?.session?.sessionKey) throw new Error('createSessionAndAssign failed');

      const tool = config.tool as CliTool;
      const mode = config.launchMode as LaunchMode;
      const command = LAUNCH_COMMANDS[tool]?.[mode] ?? tool;
      setTimeout(() => {
        sendCliSessionText(
          created.session.sessionKey,
          { text: command, appendNewline: true },
          projectPath
        ).catch((err) => console.error('[DashboardToolbar] auto-launch failed:', err));
      }, 300);
    } finally {
      setIsCreating(false);
    }
  }, [focusedPaneId, projectPath, createSessionAndAssign]);

  return (
    <>
      <div className="flex items-center gap-1 px-2 h-[40px] border-b border-border bg-muted/30 shrink-0">
        {/* Launch CLI dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors',
                'text-muted-foreground hover:text-foreground hover:bg-muted',
                isCreating && 'opacity-50 cursor-wait'
              )}
              disabled={isCreating || !projectPath}
            >
              {isCreating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Terminal className="w-3.5 h-3.5" />
              )}
              <span>{formatMessage({ id: 'terminalDashboard.toolbar.launchCli' })}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={4}>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2">
                <span>{formatMessage({ id: 'terminalDashboard.toolbar.tool' })}</span>
                <span className="text-xs text-muted-foreground">({selectedTool})</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={selectedTool}
                  onValueChange={(v) => setSelectedTool(v as CliTool)}
                >
                  {CLI_TOOLS.map((tool) => (
                    <DropdownMenuRadioItem key={tool} value={tool}>
                      {tool}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2">
                <span>{formatMessage({ id: 'terminalDashboard.toolbar.mode' })}</span>
                <span className="text-xs text-muted-foreground">
                  {launchMode === 'default'
                    ? formatMessage({ id: 'terminalDashboard.toolbar.modeDefault' })
                    : formatMessage({ id: 'terminalDashboard.toolbar.modeYolo' })}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={launchMode}
                  onValueChange={(v) => setLaunchMode(v as LaunchMode)}
                >
                  <DropdownMenuRadioItem value="default">
                    {formatMessage({ id: 'terminalDashboard.toolbar.modeDefault' })}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="yolo">
                    {formatMessage({ id: 'terminalDashboard.toolbar.modeYolo' })}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleQuickCreate}
              disabled={isCreating || !projectPath || !focusedPaneId}
              className="gap-2"
            >
              <Zap className="w-4 h-4" />
              <span>{formatMessage({ id: 'terminalDashboard.toolbar.quickCreate' })}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleConfigure}
              disabled={isCreating || !projectPath || !focusedPaneId}
              className="gap-2"
            >
              <Settings className="w-4 h-4" />
              <span>{formatMessage({ id: 'terminalDashboard.toolbar.configure' })}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Separator */}
        <div className="w-px h-5 bg-border mx-1" />

        {/* Panel toggle buttons */}
        <ToolbarButton
          icon={AlertCircle}
          label={formatMessage({ id: 'terminalDashboard.toolbar.issues' })}
          isActive={activePanel === 'issues'}
          onClick={() => onTogglePanel('issues')}
          badge={openCount > 0 ? openCount : undefined}
        />
        <ToolbarButton
          icon={ListChecks}
          label={formatMessage({ id: 'terminalDashboard.toolbar.queue' })}
          isActive={activePanel === 'queue'}
          onClick={() => onTogglePanel('queue')}
          badge={queueCount > 0 ? queueCount : undefined}
        />
        <ToolbarButton
          icon={Info}
          label={formatMessage({ id: 'terminalDashboard.toolbar.inspector' })}
          isActive={activePanel === 'inspector'}
          onClick={() => onTogglePanel('inspector')}
          dot={hasChain}
        />
        <ToolbarButton
          icon={FolderOpen}
          label={formatMessage({ id: 'terminalDashboard.toolbar.files', defaultMessage: 'Files' })}
          isActive={activePanel === 'files'}
          onClick={() => onTogglePanel('files')}
        />

        {/* Separator */}
        <div className="w-px h-5 bg-border mx-1" />

        {/* Layout presets */}
        {LAYOUT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => handlePreset(preset.id)}
            className={cn(
              'p-1.5 rounded transition-colors',
              'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
            title={formatMessage({ id: preset.labelId })}
          >
            <preset.icon className="w-3.5 h-3.5" />
          </button>
        ))}

        {/* Right-aligned title */}
        <span className="ml-auto text-xs text-muted-foreground font-medium">
          {formatMessage({ id: 'terminalDashboard.page.title' })}
        </span>
      </div>

      <CliConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        defaultWorkingDir={projectPath}
        onCreateSession={handleCreateConfiguredSession}
      />
    </>
  );
}

// ========== Toolbar Button ==========

function ToolbarButton({
  icon: Icon,
  label,
  isActive,
  onClick,
  badge,
  dot,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
  dot?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors',
        isActive
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-0.5">
          {badge}
        </Badge>
      )}
      {dot && (
        <span className="ml-0.5 w-2 h-2 rounded-full bg-primary shrink-0" />
      )}
    </button>
  );
}
