// ========================================
// TerminalWorkbench Component
// ========================================
// Container for the right panel of the Terminal Dashboard.
// Combines TerminalTabBar (tab switching) and TerminalInstance (xterm.js).
// When no terminal is active, shows selected issue detail preview
// or a compact empty state with action hints.

import { useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  Terminal,
  CircleDot,
  Tag,
  Clock,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import {
  useSessionManagerStore,
  selectSessionManagerActiveTerminalId,
} from '@/stores/sessionManagerStore';
import {
  useIssueQueueIntegrationStore,
  selectSelectedIssueId,
} from '@/stores/issueQueueIntegrationStore';
import { useIssues } from '@/hooks/useIssues';
import type { Issue } from '@/lib/api';
import { TerminalTabBar } from './TerminalTabBar';
import { TerminalInstance } from './TerminalInstance';

// ========== Priority Styles ==========

const PRIORITY_VARIANT: Record<Issue['priority'], 'destructive' | 'warning' | 'info' | 'secondary'> = {
  critical: 'destructive',
  high: 'warning',
  medium: 'info',
  low: 'secondary',
};

const STATUS_COLORS: Record<Issue['status'], string> = {
  open: 'text-info',
  in_progress: 'text-warning',
  resolved: 'text-success',
  closed: 'text-muted-foreground',
  completed: 'text-success',
};

// ========== Issue Detail Preview ==========

function IssueDetailPreview({ issue }: { issue: Issue }) {
  const { formatMessage } = useIntl();

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header hint */}
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {formatMessage({ id: 'terminalDashboard.workbench.issuePreview' })}
        </p>

        {/* Title + Status */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <CircleDot className={cn('w-4 h-4 shrink-0 mt-0.5', STATUS_COLORS[issue.status] ?? 'text-muted-foreground')} />
            <h3 className="text-base font-semibold text-foreground leading-snug">
              {issue.title}
            </h3>
          </div>
          <div className="flex items-center gap-2 pl-6">
            <Badge variant={PRIORITY_VARIANT[issue.priority]} className="text-[10px] px-1.5 py-0">
              {issue.priority}
            </Badge>
            <span className="text-[10px] text-muted-foreground font-mono">{issue.id}</span>
          </div>
        </div>

        {/* Context / Description */}
        {issue.context && (
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {issue.context}
            </p>
          </div>
        )}

        {/* Metadata rows */}
        <div className="space-y-1.5 text-xs text-muted-foreground">
          {issue.labels && issue.labels.length > 0 && (
            <div className="flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 shrink-0" />
              <div className="flex items-center gap-1 flex-wrap">
                {issue.labels.map((label) => (
                  <span key={label} className="px-1.5 py-0.5 rounded bg-muted text-[10px]">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}
          {issue.assignee && (
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 shrink-0" />
              <span>{issue.assignee}</span>
            </div>
          )}
          {issue.createdAt && (
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>{new Date(issue.createdAt).toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Hint */}
        <p className="text-[10px] text-muted-foreground/60 pt-2">
          {formatMessage({ id: 'terminalDashboard.workbench.issuePreviewHint' })}
        </p>
      </div>
    </div>
  );
}

// ========== Component ==========

export function TerminalWorkbench() {
  const { formatMessage } = useIntl();
  const activeTerminalId = useSessionManagerStore(selectSessionManagerActiveTerminalId);
  const selectedIssueId = useIssueQueueIntegrationStore(selectSelectedIssueId);
  const { issues } = useIssues();

  // Find selected issue for preview
  const selectedIssue = useMemo(() => {
    if (!selectedIssueId) return null;
    return issues.find((i) => i.id === selectedIssueId) ?? null;
  }, [selectedIssueId, issues]);

  return (
    <div className="flex flex-col h-full">
      {/* Tab strip (fixed height) */}
      <TerminalTabBar />

      {/* Terminal content (flex-1, takes remaining space) */}
      {activeTerminalId ? (
        <div className="flex-1 min-h-0">
          <TerminalInstance sessionId={activeTerminalId} />
        </div>
      ) : selectedIssue ? (
        /* Issue detail preview when no terminal but issue is selected */
        <IssueDetailPreview issue={selectedIssue} />
      ) : (
        /* Compact empty state */
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Terminal className="h-6 w-6 mx-auto mb-1.5 opacity-30" />
            <p className="text-sm font-medium">
              {formatMessage({ id: 'terminalDashboard.workbench.noTerminal' })}
            </p>
            <p className="text-xs mt-1 opacity-70">
              {formatMessage({ id: 'terminalDashboard.workbench.noTerminalHint' })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
