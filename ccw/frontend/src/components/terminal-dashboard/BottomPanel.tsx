// ========================================
// BottomPanel Component
// ========================================
// Full-width collapsible bottom panel with Queue + Inspector tabs.
// Replaces the separate BottomInspector + middle-column QueuePanel layout.
// Queue tab shows inline count badge; Inspector tab shows chain indicator.

import { useState, useCallback, useMemo } from 'react';
import { useIntl } from 'react-intl';
import { ListChecks, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { QueuePanel } from './QueuePanel';
import { InspectorContent } from './BottomInspector';
import { useIssueQueue } from '@/hooks/useIssues';
import {
  useIssueQueueIntegrationStore,
  selectAssociationChain,
} from '@/stores/issueQueueIntegrationStore';

// ========== Types ==========

type TabId = 'queue' | 'inspector';

// ========== Component ==========

export function BottomPanel() {
  const { formatMessage } = useIntl();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('queue');

  const queueQuery = useIssueQueue();
  const associationChain = useIssueQueueIntegrationStore(selectAssociationChain);

  // Count queue items for badge
  const queueCount = useMemo(() => {
    if (!queueQuery.data) return 0;
    const grouped = queueQuery.data.grouped_items ?? {};
    let count = 0;
    for (const items of Object.values(grouped)) {
      count += items.length;
    }
    return count;
  }, [queueQuery.data]);

  const hasChain = associationChain !== null;

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleTabClick = useCallback((tab: TabId) => {
    setActiveTab(tab);
    setIsOpen(true);
  }, []);

  return (
    <div
      className={cn(
        'border-t border-border bg-muted/30 shrink-0 transition-all duration-200',
      )}
    >
      {/* Tab bar (always visible, ~36px) */}
      <div className="flex items-center gap-0 shrink-0">
        {/* Queue tab */}
        <button
          onClick={() => handleTabClick('queue')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors border-b-2',
            activeTab === 'queue' && isOpen
              ? 'border-b-primary text-foreground font-medium'
              : 'border-b-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <ListChecks className="w-3.5 h-3.5" />
          {formatMessage({ id: 'terminalDashboard.bottomPanel.queueTab' })}
          {queueCount > 0 && (
            <Badge variant="info" className="text-[10px] px-1.5 py-0 ml-0.5">
              {queueCount}
            </Badge>
          )}
        </button>

        {/* Inspector tab */}
        <button
          onClick={() => handleTabClick('inspector')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors border-b-2',
            activeTab === 'inspector' && isOpen
              ? 'border-b-primary text-foreground font-medium'
              : 'border-b-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <Info className="w-3.5 h-3.5" />
          {formatMessage({ id: 'terminalDashboard.bottomPanel.inspectorTab' })}
          {hasChain && (
            <span className="ml-1 w-2 h-2 rounded-full bg-primary shrink-0" />
          )}
        </button>

        {/* Collapse/expand toggle at right */}
        <button
          onClick={toggle}
          className="ml-auto px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
          title={formatMessage({
            id: isOpen
              ? 'terminalDashboard.bottomPanel.collapse'
              : 'terminalDashboard.bottomPanel.expand',
          })}
        >
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Collapsible content area */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isOpen ? 'max-h-[280px] opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="h-[280px] border-t border-border/50">
          {activeTab === 'queue' ? (
            <QueuePanel embedded />
          ) : (
            <InspectorContent />
          )}
        </div>
      </div>
    </div>
  );
}
