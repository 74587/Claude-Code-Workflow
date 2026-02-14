// ========================================
// DashboardToolbar Component
// ========================================
// Top toolbar for Terminal Dashboard V2.
// Provides toggle buttons for floating panels (Issues/Queue/Inspector)
// and layout preset controls. Sessions sidebar is always visible.

import { useCallback, useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  AlertCircle,
  ListChecks,
  Info,
  LayoutGrid,
  Columns2,
  Rows2,
  Square,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import {
  useIssueQueueIntegrationStore,
  selectAssociationChain,
} from '@/stores/issueQueueIntegrationStore';
import { useIssues, useIssueQueue } from '@/hooks/useIssues';
import { useTerminalGridStore } from '@/stores/terminalGridStore';

// ========== Types ==========

export type PanelId = 'issues' | 'queue' | 'inspector';

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

  return (
    <div className="flex items-center gap-1 px-2 h-[40px] border-b border-border bg-muted/30 shrink-0">
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
