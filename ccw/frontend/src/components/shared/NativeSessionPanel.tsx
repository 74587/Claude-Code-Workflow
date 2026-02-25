// ========================================
// NativeSessionPanel Component
// ========================================
// Dialog for displaying native CLI session content (Gemini/Codex/Qwen)

import * as React from 'react';
import { useIntl } from 'react-intl';
import {
  User,
  Bot,
  Brain,
  Wrench,
  Copy,
  Clock,
  Hash,
  FolderOpen,
  FileJson,
  Coins,
  ArrowDownUp,
  Archive,
  Loader2,
  AlertCircle,
} from 'lucide-react';
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
import { useNativeSession } from '@/hooks/useNativeSession';
import type {
  NativeSessionTurn,
  NativeToolCall,
  NativeTokenInfo,
} from '@/lib/api';

// ========== Types ==========

export interface NativeSessionPanelProps {
  executionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TurnCardProps {
  turn: NativeSessionTurn;
  isLatest: boolean;
}

interface TokenDisplayProps {
  tokens: NativeTokenInfo;
  className?: string;
}

interface ToolCallItemProps {
  toolCall: NativeToolCall;
  index: number;
}

// ========== Helpers ==========

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
  return variants[tool?.toLowerCase()] || 'secondary';
}

/**
 * Format token number with compact notation
 */
function formatTokenCount(count: number | undefined): string {
  if (count == null || count === 0) return '0';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString();
}

/**
 * Truncate a string to a max length with ellipsis
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ========== Sub-Components ==========

/**
 * TokenDisplay - Compact token info line
 */
function TokenDisplay({ tokens, className }: TokenDisplayProps) {
  const { formatMessage } = useIntl();

  return (
    <div className={cn('flex items-center gap-3 text-xs text-muted-foreground', className)}>
      <span className="flex items-center gap-1" title={formatMessage({ id: 'nativeSession.tokens.total', defaultMessage: 'Total tokens' })}>
        <Coins className="h-3 w-3" />
        {formatTokenCount(tokens.total)}
      </span>
      {tokens.input != null && (
        <span className="flex items-center gap-1" title={formatMessage({ id: 'nativeSession.tokens.input', defaultMessage: 'Input tokens' })}>
          <ArrowDownUp className="h-3 w-3" />
          {formatTokenCount(tokens.input)}
        </span>
      )}
      {tokens.output != null && (
        <span title={formatMessage({ id: 'nativeSession.tokens.output', defaultMessage: 'Output tokens' })}>
          out: {formatTokenCount(tokens.output)}
        </span>
      )}
      {tokens.cached != null && tokens.cached > 0 && (
        <span className="flex items-center gap-1" title={formatMessage({ id: 'nativeSession.tokens.cached', defaultMessage: 'Cached tokens' })}>
          <Archive className="h-3 w-3" />
          {formatTokenCount(tokens.cached)}
        </span>
      )}
    </div>
  );
}

/**
 * ToolCallItem - Single tool call display with collapsible details
 */
function ToolCallItem({ toolCall, index }: ToolCallItemProps) {
  const { formatMessage } = useIntl();
  return (
    <details className="group/tool border border-border/50 rounded-md overflow-hidden">
      <summary className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-muted/50 select-none">
        <Wrench className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        <span className="font-mono font-medium">{toolCall.name}</span>
        <span className="text-muted-foreground">#{index + 1}</span>
      </summary>
      <div className="border-t border-border/50 divide-y divide-border/50">
        {toolCall.arguments && (
          <div className="p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">{formatMessage({ id: 'nativeSession.toolCall.input' })}</p>
            <pre className="p-2 bg-muted/30 rounded text-xs whitespace-pre-wrap overflow-x-auto font-mono leading-relaxed max-h-60 overflow-y-auto">
              {toolCall.arguments}
            </pre>
          </div>
        )}
        {toolCall.output && (
          <div className="p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">{formatMessage({ id: 'nativeSession.toolCall.output' })}</p>
            <pre className="p-2 bg-muted/30 rounded text-xs whitespace-pre-wrap overflow-x-auto font-mono leading-relaxed max-h-60 overflow-y-auto">
              {toolCall.output}
            </pre>
          </div>
        )}
      </div>
    </details>
  );
}

/**
 * TurnCard - Single conversation turn
 */
function TurnCard({ turn, isLatest }: TurnCardProps) {
  const { formatMessage } = useIntl();
  const isUser = turn.role === 'user';
  const RoleIcon = isUser ? User : Bot;

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all',
        isUser
          ? 'bg-muted/30'
          : 'bg-blue-500/5 dark:bg-blue-500/10',
        isLatest && 'ring-2 ring-primary/50 shadow-md'
      )}
    >
      {/* Turn Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <RoleIcon
            className={cn(
              'h-4 w-4',
              isUser ? 'text-primary' : 'text-blue-500'
            )}
          />
          <span className="font-semibold text-sm capitalize">{turn.role}</span>
          <span className="text-xs text-muted-foreground">
            #{turn.turnNumber}
          </span>
          {isLatest && (
            <Badge variant="default" className="text-xs h-5 px-1.5">
              {formatMessage({ id: 'nativeSession.turn.latest', defaultMessage: 'Latest' })}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {turn.timestamp && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(turn.timestamp).toLocaleTimeString()}
            </span>
          )}
          {turn.tokens && (
            <TokenDisplay tokens={turn.tokens} />
          )}
        </div>
      </div>

      {/* Turn Content */}
      <div className="p-4 space-y-3">
        {turn.content && (
          <pre className="p-3 bg-background/50 rounded-lg text-sm whitespace-pre-wrap overflow-x-auto font-mono leading-relaxed max-h-96 overflow-y-auto">
            {turn.content}
          </pre>
        )}

        {/* Thoughts Section */}
        {turn.thoughts && turn.thoughts.length > 0 && (
          <details className="group/thoughts">
            <summary className="flex items-center gap-2 text-sm cursor-pointer hover:text-foreground text-muted-foreground select-none py-1">
              <Brain className="h-4 w-4" />
              <span className="font-medium">
                {formatMessage({ id: 'nativeSession.turn.thoughts', defaultMessage: 'Thoughts' })}
              </span>
              <span className="text-xs">({turn.thoughts.length})</span>
            </summary>
            <ul className="mt-2 space-y-1 pl-6 text-sm text-muted-foreground list-disc">
              {turn.thoughts.map((thought, i) => (
                <li key={i} className="leading-relaxed">{thought}</li>
              ))}
            </ul>
          </details>
        )}

        {/* Tool Calls Section */}
        {turn.toolCalls && turn.toolCalls.length > 0 && (
          <details className="group/calls">
            <summary className="flex items-center gap-2 text-sm cursor-pointer hover:text-foreground text-muted-foreground select-none py-1">
              <Wrench className="h-4 w-4" />
              <span className="font-medium">
                {formatMessage({ id: 'nativeSession.turn.toolCalls', defaultMessage: 'Tool Calls' })}
              </span>
              <span className="text-xs">({turn.toolCalls.length})</span>
            </summary>
            <div className="mt-2 space-y-2">
              {turn.toolCalls.map((tc, i) => (
                <ToolCallItem key={i} toolCall={tc} index={i} />
              ))}
            </div>
          </details>
        )}
      </div>
    </Card>
  );
}

// ========== Main Component ==========

/**
 * NativeSessionPanel - Dialog for displaying native CLI session content
 *
 * Shows session metadata, token summary, and all conversation turns
 * with thoughts and tool calls for Gemini/Codex/Qwen native sessions.
 */
export function NativeSessionPanel({
  executionId,
  open,
  onOpenChange,
}: NativeSessionPanelProps) {
  const { formatMessage } = useIntl();
  const { data: session, isLoading, error } = useNativeSession(open ? executionId : null);

  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  const handleCopy = React.useCallback(async (text: string, field: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5" />
              {formatMessage({ id: 'nativeSession.title', defaultMessage: 'Native Session' })}
            </DialogTitle>
            {session && (
              <div className="flex items-center gap-2">
                <Badge variant={getToolVariant(session.tool)}>
                  {session.tool.toUpperCase()}
                </Badge>
                {session.model && (
                  <Badge variant="secondary" className="text-xs">
                    {session.model}
                  </Badge>
                )}
                <span
                  className="text-xs text-muted-foreground font-mono"
                  title={session.sessionId}
                >
                  {truncate(session.sessionId, 16)}
                </span>
              </div>
            )}
          </div>
          {session && (
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-2">
              <span className="flex items-center gap-1" title={formatMessage({ id: 'nativeSession.meta.startTime', defaultMessage: 'Start time' })}>
                <Clock className="h-3 w-3" />
                {new Date(session.startTime).toLocaleString()}
              </span>
              {session.workingDir && (
                <span className="flex items-center gap-1" title={formatMessage({ id: 'nativeSession.meta.workingDir', defaultMessage: 'Working directory' })}>
                  <FolderOpen className="h-3 w-3" />
                  <span className="font-mono max-w-48 truncate">{session.workingDir}</span>
                </span>
              )}
              {session.projectHash && (
                <span className="flex items-center gap-1" title={formatMessage({ id: 'nativeSession.meta.projectHash', defaultMessage: 'Project hash' })}>
                  <Hash className="h-3 w-3" />
                  <span className="font-mono">{truncate(session.projectHash, 12)}</span>
                </span>
              )}
              <span>{session.turns.length} {formatMessage({ id: 'nativeSession.meta.turns', defaultMessage: 'turns' })}</span>
            </div>
          )}
        </DialogHeader>

        {/* Token Summary Bar */}
        {session?.totalTokens && (
          <div className="flex items-center gap-4 px-6 py-2.5 border-b bg-muted/30 shrink-0">
            <span className="text-xs font-medium text-foreground">
              {formatMessage({ id: 'nativeSession.tokenSummary', defaultMessage: 'Total Tokens' })}
            </span>
            <TokenDisplay tokens={session.totalTokens} />
          </div>
        )}

        {/* Content Area */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{formatMessage({ id: 'nativeSession.loading', defaultMessage: 'Loading session...' })}</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{formatMessage({ id: 'nativeSession.error', defaultMessage: 'Failed to load session' })}</span>
            </div>
          </div>
        ) : session && session.turns.length > 0 ? (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-4">
              {session.turns.map((turn, idx) => (
                <React.Fragment key={turn.turnNumber}>
                  <TurnCard
                    turn={turn}
                    isLatest={idx === session.turns.length - 1}
                  />
                  {/* Connector line between turns */}
                  {idx < session.turns.length - 1 && (
                    <div className="flex justify-center" aria-hidden="true">
                      <div className="w-px h-4 bg-border" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center py-16 text-muted-foreground">
            {formatMessage({ id: 'nativeSession.empty', defaultMessage: 'No session data available' })}
          </div>
        )}

        {/* Footer Actions */}
        {session && (
          <div className="flex items-center gap-2 px-6 py-4 border-t bg-muted/30 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCopy(session.sessionId, 'sessionId')}
              className="h-8"
            >
              <Copy className="h-4 w-4 mr-2" />
              {copiedField === 'sessionId'
                ? formatMessage({ id: 'nativeSession.footer.copied', defaultMessage: 'Copied!' })
                : formatMessage({ id: 'nativeSession.footer.copySessionId', defaultMessage: 'Copy Session ID' })}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const json = JSON.stringify(session, null, 2);
                handleCopy(json, 'json');
              }}
              className="h-8"
            >
              <FileJson className="h-4 w-4 mr-2" />
              {copiedField === 'json'
                ? formatMessage({ id: 'nativeSession.footer.copied', defaultMessage: 'Copied!' })
                : formatMessage({ id: 'nativeSession.footer.exportJson', defaultMessage: 'Export JSON' })}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
