// ========================================
// Codex MCP Editable Card Component
// ========================================
// Editable Codex MCP server card with remove and toggle actions
// Extends CodexMcpCard with additional action buttons when editing is enabled

import { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  Server,
  Power,
  PowerOff,
  ChevronDown,
  ChevronUp,
  Edit3,
  Trash2,
  Lock,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/AlertDialog';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { McpServer } from '@/lib/api';

// ========== Types ==========

export interface CodexMcpEditableCardProps {
  server: McpServer;
  enabled: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  /** When enabled, shows remove/toggle buttons instead of read-only badge */
  isEditable?: boolean;
  /** Callback when server is removed (after confirmation) */
  onRemove?: (serverName: string) => void | Promise<void>;
  /** Callback when server is toggled */
  onToggle?: (serverName: string, enabled: boolean) => void | Promise<void>;
  /** Whether remove operation is in progress */
  isRemoving?: boolean;
  /** Whether toggle operation is in progress */
  isToggling?: boolean;
}

// ========== Component ==========

export function CodexMcpEditableCard({
  server,
  enabled,
  isExpanded,
  onToggleExpand,
  isEditable = false,
  onRemove,
  onToggle,
  isRemoving = false,
  isToggling = false,
}: CodexMcpEditableCardProps) {
  const { formatMessage } = useIntl();
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // Handle toggle with optimistic update
  const handleToggle = async () => {
    if (onToggle) {
      await onToggle(server.name, !enabled);
    }
  };

  // Handle remove with confirmation
  const handleRemove = async () => {
    if (onRemove) {
      await onRemove(server.name);
      setIsConfirmDeleteOpen(false);
    }
  };

  // Prevent click propagation when clicking action buttons
  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <Card className={cn('overflow-hidden', !enabled && 'opacity-60')}>
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              enabled ? 'bg-primary/10' : 'bg-muted'
            )}>
              <Server className={cn(
                'w-5 h-5',
                enabled ? 'text-primary' : 'text-muted-foreground'
              )} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {server.name}
                </span>
                {isEditable ? (
                  <>
                    {/* Editable badge with actions */}
                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                      <Edit3 className="w-3 h-3" />
                      {formatMessage({ id: 'mcp.codex.editable' })}
                    </Badge>
                    {enabled && (
                      <Badge variant="outline" className="text-xs text-green-600">
                        <Power className="w-3 h-3 mr-1" />
                        {formatMessage({ id: 'mcp.status.enabled' })}
                      </Badge>
                    )}
                  </>
                ) : (
                  <>
                    {/* Read-only badge */}
                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      {formatMessage({ id: 'mcp.codex.readOnly' })}
                    </Badge>
                    {enabled && (
                      <Badge variant="outline" className="text-xs text-green-600">
                        <Power className="w-3 h-3 mr-1" />
                        {formatMessage({ id: 'mcp.status.enabled' })}
                      </Badge>
                    )}
                  </>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 font-mono">
                {server.command} {server.args?.join(' ') || ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditable ? (
              <>
                {/* Toggle button (active in editable mode) */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={(e) => {
                    stopPropagation(e);
                    handleToggle();
                  }}
                  disabled={isToggling}
                >
                  {enabled ? (
                    <Power className="w-4 h-4 text-green-600" />
                  ) : (
                    <PowerOff className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>

                {/* Remove button with confirmation */}
                <AlertDialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={stopPropagation}
                      disabled={isRemoving}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {formatMessage({ id: 'mcp.codex.deleteConfirm.title' }, { name: server.name })}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {formatMessage({ id: 'mcp.codex.deleteConfirm.description' }, { name: server.name })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isRemoving}>
                        {formatMessage({ id: 'mcp.codex.deleteConfirm.cancel' })}
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleRemove}
                        disabled={isRemoving}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isRemoving ? (
                          <>
                            <span className="animate-spin mr-2">◌</span>
                            {formatMessage({ id: 'mcp.codex.deleteConfirm.deleting' })}
                          </>
                        ) : (
                          formatMessage({ id: 'mcp.codex.deleteConfirm.confirm' })
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <>
                {/* Disabled toggle button (visual only, no edit capability) */}
                <div className={cn(
                  'w-8 h-8 rounded-md flex items-center justify-center',
                  enabled ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'
                )}>
                  {enabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                </div>
              </>
            )}
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

          {/* Notice based on editable state */}
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-md border',
            isEditable
              ? 'bg-info/10 border-info/20'
              : 'bg-muted/50 border-border'
          )}>
            {isEditable ? (
              <>
                <Edit3 className="w-4 h-4 text-info" />
                <p className="text-xs text-muted-foreground">
                  {formatMessage({ id: 'mcp.codex.editableNotice' })}
                </p>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  {formatMessage({ id: 'mcp.codex.readOnlyNotice' })}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

export default CodexMcpEditableCard;
