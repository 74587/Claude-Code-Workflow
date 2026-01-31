// ========================================
// CliStreamPanel Component
// ========================================
// Turn-based CLI execution detail view

import * as React from 'react';
import { useIntl } from 'react-intl';
import { User, Bot, AlertTriangle, Info, Layers, Clock, Copy, Terminal, Hash, Calendar, CheckCircle2, XCircle, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { useCliExecutionDetail } from '@/hooks/useCliExecution';
import type { ConversationRecord, ConversationTurn } from '@/lib/api';

type ViewMode = 'per-turn' | 'concatenated';
type ConcatFormat = 'plain' | 'yaml' | 'json';

export interface CliStreamPanelProps {
  executionId: string;
  sourceDir?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ========== Types ==========

interface TurnSectionProps {
  turn: ConversationTurn;
  isLatest: boolean;
}

interface ConcatenatedViewProps {
  prompt: string;
  format: ConcatFormat;
  onFormatChange: (fmt: ConcatFormat) => void;
}

// ========== Helpers ==========

/**
 * Format duration to human readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

/**
 * Get status icon and color for a turn
 */
function getStatusInfo(status: string) {
  const statusMap = {
    success: { icon: CheckCircle2, color: 'text-green-600 dark:text-green-400' },
    error: { icon: XCircle, color: 'text-destructive' },
    timeout: { icon: Timer, color: 'text-warning' },
  };
  return statusMap[status as keyof typeof statusMap] || statusMap.error;
}

/**
 * Get badge variant for tool name
 */
function getToolVariant(tool: string): 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'info' {
  const variants: Record<string, 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'info'> = {
    gemini: 'info',
    codex: 'success',
    qwen: 'warning',
    opencode: 'secondary',
  };
  return variants[tool] || 'secondary';
}

/**
 * Build concatenated prompt in specified format
 */
function buildConcatenatedPrompt(execution: ConversationRecord, format: ConcatFormat, formatMessage: (message: { id: string }) => string): string {
  const turns = execution.turns;

  if (format === 'plain') {
    const parts: string[] = [];
    parts.push(`=== ${formatMessage({ id: 'cli-manager.streamPanel.conversationHistory' })} ===`);
    parts.push('');

    for (const turn of turns) {
      parts.push(`--- Turn ${turn.turn} ---`);
      parts.push('USER:');
      parts.push(turn.prompt);
      parts.push('');
      parts.push('ASSISTANT:');
      parts.push(turn.output.stdout || formatMessage({ id: 'cli-manager.streamPanel.noOutput' }));
      parts.push('');
    }

    parts.push(`=== ${formatMessage({ id: 'cli-manager.streamPanel.newRequest' })} ===`);
    parts.push('');
    parts.push(formatMessage({ id: 'cli-manager.streamPanel.yourNextPrompt' }));

    return parts.join('\n');
  }

  if (format === 'yaml') {
    const yaml: string[] = [];
    yaml.push('conversation:');
    yaml.push('  turns:');

    for (const turn of turns) {
      yaml.push(`    - turn: ${turn.turn}`);
      yaml.push(`      timestamp: ${turn.timestamp}`);
      yaml.push(`      prompt: |`);
      turn.prompt.split('\n').forEach(line => {
        yaml.push(`        ${line}`);
      });
      yaml.push(`      response: |`);
      const output = turn.output.stdout || '';
      if (output) {
        output.split('\n').forEach(line => {
          yaml.push(`        ${line}`);
        });
      } else {
        yaml.push(`        ${formatMessage({ id: 'cli-manager.streamPanel.noOutput' })}`);
      }
    }

    return yaml.join('\n');
  }

  // JSON format
  return JSON.stringify(
    turns.map((t) => ({
      turn: t.turn,
      timestamp: t.timestamp,
      prompt: t.prompt,
      response: t.output.stdout || '',
    })),
    null,
    2
  );
}

// ========== Sub-Components ==========

/**
 * TurnSection - Single turn display with header and content
 */
function TurnSection({ turn, isLatest }: TurnSectionProps) {
  const { formatMessage } = useIntl();
  const StatusIcon = getStatusInfo(turn.status as string).icon;
  const statusColor = getStatusInfo(turn.status as string).color;

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all',
        isLatest && 'ring-2 ring-primary/50 shadow-md'
      )}
    >
      {/* Turn Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b">
        <div className="flex items-center gap-2">
          <span className="text-lg font-medium" aria-hidden="true">
            {turn.turn === 1 ? '\u25B6' : '\u21B3'} {/* ▶ or ↳ */}
          </span>
          <span className="font-semibold text-sm">{formatMessage({ id: 'cli.details.turn' })} {turn.turn}</span>
          {isLatest && (
            <Badge variant="default" className="text-xs h-5 px-1.5">
              {formatMessage({ id: 'cli-manager.streamPanel.latest' })}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1" title={formatMessage({ id: 'cli.details.timestamp' })}>
            <Clock className="h-3 w-3" />
            {new Date(turn.timestamp).toLocaleTimeString()}
          </span>
          <span className={cn('flex items-center gap-1 font-medium', statusColor)} title={formatMessage({ id: 'cli.details.status' })}>
            <StatusIcon className="h-3.5 w-3.5" />
            {turn.status}
          </span>
          <span className="font-mono text-xs" title={formatMessage({ id: 'cli.details.duration' })}>
            {formatDuration(turn.duration_ms)}
          </span>
        </div>
      </div>

      {/* Turn Body */}
      <div className="p-4 space-y-4">
        {/* User Prompt */}
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold mb-2 text-foreground">
            <User className="h-4 w-4 text-primary" aria-hidden="true" />
            {formatMessage({ id: 'cli-manager.streamPanel.userPrompt' })}
          </h4>
          <pre className="p-3 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap overflow-x-auto font-mono leading-relaxed">
            {turn.prompt}
          </pre>
        </div>

        {/* Assistant Response */}
        {turn.output.stdout && (
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold mb-2 text-foreground">
              <Bot className="h-4 w-4 text-blue-500" aria-hidden="true" />
              {formatMessage({ id: 'cli-manager.streamPanel.assistantResponse' })}
            </h4>
            <pre className="p-3 bg-blue-500/5 dark:bg-blue-500/10 rounded-lg text-sm whitespace-pre-wrap overflow-x-auto font-mono leading-relaxed">
              {turn.output.stdout}
            </pre>
          </div>
        )}

        {/* Errors */}
        {turn.output.stderr && (
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold mb-2 text-destructive">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              {formatMessage({ id: 'cli-manager.streamPanel.errors' })}
            </h4>
            <pre className="p-3 bg-destructive/10 rounded-lg text-sm whitespace-pre-wrap overflow-x-auto font-mono leading-relaxed text-destructive">
              {turn.output.stderr}
            </pre>
          </div>
        )}

        {/* Truncated Notice */}
        {turn.output.truncated && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg border border-border/50">
            <Info className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span>{formatMessage({ id: 'cli-manager.streamPanel.truncatedNotice' })}</span>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * PerTurnView - Display all turns as separate sections with connectors
 */
function PerTurnView({ turns }: { turns: ConversationTurn[] }) {
  return (
    <div className="space-y-4">
      {turns.map((turn, idx) => (
        <React.Fragment key={turn.turn}>
          <TurnSection turn={turn} isLatest={idx === turns.length - 1} />
          {/* Connector line between turns */}
          {idx < turns.length - 1 && (
            <div className="flex justify-center" aria-hidden="true">
              <div className="w-px h-6 bg-border" />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/**
 * ConcatenatedView - Display all turns merged into a single prompt
 */
function ConcatenatedView({ prompt, format, onFormatChange }: ConcatenatedViewProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <Layers className="h-4 w-4" aria-hidden="true" />
          {formatMessage({ id: 'cli-manager.streamPanel.concatenatedPrompt' })}
        </h4>
        <div className="flex gap-2">
          {(['plain', 'yaml', 'json'] as const).map((fmt) => (
            <Button
              key={fmt}
              size="sm"
              variant={format === fmt ? 'default' : 'outline'}
              onClick={() => onFormatChange(fmt)}
              className="h-7 px-2 text-xs"
            >
              {fmt.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>
      <pre className="p-4 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap overflow-x-auto font-mono leading-relaxed max-h-[60vh] overflow-y-auto">
        {prompt}
      </pre>
    </div>
  );
}

// ========== Main Component ==========

/**
 * CliStreamPanel component - Elegant turn-based conversation view
 *
 * Displays CLI execution details with:
 * - Per-turn view with timeline layout
 * - Concatenated view for resume context
 * - Format selection (Plain/YAML/JSON)
 */
export function CliStreamPanel({
  executionId,
  sourceDir: _sourceDir,
  open,
  onOpenChange,
}: CliStreamPanelProps) {
  const { formatMessage } = useIntl();
  const [viewMode, setViewMode] = React.useState<ViewMode>('per-turn');
  const [concatFormat, setConcatFormat] = React.useState<ConcatFormat>('plain');

  const { data: execution, isLoading } = useCliExecutionDetail(open ? executionId : null);

  // Build concatenated prompt
  const concatenatedPrompt = React.useMemo(() => {
    if (!execution?.turns) return '';
    return buildConcatenatedPrompt(execution, concatFormat, formatMessage);
  }, [execution, concatFormat, formatMessage]);

  // Copy to clipboard
  const copyToClipboard = React.useCallback(
    async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text);
        // Optional: add toast notification here
        console.log(`Copied ${label} to clipboard`);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    },
    []
  );

  // Calculate total duration
  const totalDuration = React.useMemo(() => {
    if (!execution?.turns) return 0;
    return execution.turns.reduce((sum, t) => sum + t.duration_ms, 0);
  }, [execution]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              {formatMessage({ id: 'cli-manager.executionDetails' })}
            </DialogTitle>
            {execution && (
              <div className="flex items-center gap-2">
                <Badge variant={getToolVariant(execution.tool)} title={formatMessage({ id: 'cli.details.tool' })}>
                  {execution.tool.toUpperCase()}
                </Badge>
                {execution.mode && <Badge variant="secondary" title={formatMessage({ id: 'cli.details.mode' })}>{execution.mode}</Badge>}
                <span className="text-sm text-muted-foreground font-mono" title={formatMessage({ id: 'cli.details.duration' })}>
                  {formatDuration(totalDuration)}
                </span>
              </div>
            )}
          </div>
          {execution && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
              <span className="flex items-center gap-1" title={formatMessage({ id: 'cli.details.created' })}>
                <Calendar className="h-3 w-3" />
                {new Date(execution.created_at).toLocaleString()}
              </span>
              <span className="flex items-center gap-1" title={formatMessage({ id: 'cli.details.id' })}>
                <Hash className="h-3 w-3" />
                {execution.id.slice(0, 8)}
              </span>
              <span>{execution.turn_count} {formatMessage({ id: 'cli-manager.streamPanel.turns' })}</span>
            </div>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-muted-foreground">{formatMessage({ id: 'cli-manager.streamPanel.loading' })}</div>
          </div>
        ) : execution?.turns && execution.turns.length > 0 ? (
          <>
            {/* View Toggle - Only show for multi-turn conversations */}
            {execution.turns.length > 1 && (
              <div className="flex items-center gap-2 px-6 py-3 border-b shrink-0">
                <Button
                  size="sm"
                  variant={viewMode === 'per-turn' ? 'default' : 'outline'}
                  onClick={() => setViewMode('per-turn')}
                  className="h-8"
                >
                  <Layers className="h-4 w-4 mr-2" />
                  {formatMessage({ id: 'cli-manager.streamPanel.perTurnView' })}
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'concatenated' ? 'default' : 'outline'}
                  onClick={() => setViewMode('concatenated')}
                  className="h-8"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {formatMessage({ id: 'cli-manager.streamPanel.concatenatedView' })}
                </Button>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {viewMode === 'per-turn' ? (
                <PerTurnView turns={execution.turns} />
              ) : (
                <ConcatenatedView
                  prompt={concatenatedPrompt}
                  format={concatFormat}
                  onFormatChange={setConcatFormat}
                />
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center gap-2 px-6 py-4 border-t bg-muted/30 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(execution.id, 'ID')}
                className="h-8"
              >
                <Copy className="h-4 w-4 mr-2" />
                {formatMessage({ id: 'cli-manager.streamPanel.copyId' })}
              </Button>
              {execution.turns.length > 1 && viewMode === 'concatenated' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(concatenatedPrompt, 'prompt')}
                  className="h-8"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {formatMessage({ id: 'cli-manager.streamPanel.copyPrompt' })}
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            {formatMessage({ id: 'cli-manager.streamPanel.noDetails' })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
