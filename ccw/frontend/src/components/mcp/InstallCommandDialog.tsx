// ========================================
// Install Command Dialog Component
// ========================================
// Dialog for generating and displaying MCP server install commands

import { useState } from 'react';
import { useIntl } from 'react-intl';
import { Copy, Check, Terminal, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

// ========== Types ==========

export interface InstallCommandDialogProps {
  /** Server configuration to generate command for */
  server?: {
    name: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
  };
  /** Whether dialog is open */
  open: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Installation scope */
  scope?: 'project' | 'global';
  /** Config type (mcp for .mcp.json, claude for .claude.json) */
  configType?: 'mcp' | 'claude';
}

// ========== Component ==========

export function InstallCommandDialog({
  server,
  open,
  onClose,
  scope = 'project',
  configType = 'mcp',
}: InstallCommandDialogProps) {
  const { formatMessage } = useIntl();
  const [copied, setCopied] = useState(false);

  // Generate install command
  const generateCommand = (): string => {
    if (!server) return '';

    const envArgs = server.env
      ? Object.entries(server.env).flatMap(([key, value]) => ['--env', `${key}=${value}`])
      : [];

    const args = [
      'ccw',
      'mcp',
      'install',
      server.name,
      '--command',
      server.command,
      ...(server.args || []).flatMap((arg) => ['--args', arg]),
      ...envArgs,
      '--scope',
      scope,
    ];

    if (configType === 'claude') {
      args.push('--config-type', 'claude');
    }

    return args.join(' ');
  };

  // Generate JSON config snippet
  const generateJsonConfig = (): string => {
    if (!server) return '';

    const config = {
      mcpServers: {
        [server.name]: {
          command: server.command,
          ...(server.args && { args: server.args }),
          ...(server.env && { env: server.env }),
        },
      },
    };

    return JSON.stringify(config, null, 2);
  };

  // Handle copy to clipboard
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const command = generateCommand();
  const jsonConfig = generateJsonConfig();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            {formatMessage({ id: 'mcp.installCmd.title' })}
          </DialogTitle>
        </DialogHeader>

        {server && (
          <div className="space-y-4">
            {/* Server Info */}
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-foreground">{server.name}</span>
                <Badge variant="outline" className="text-xs">
                  {scope}
                </Badge>
                <Badge variant="secondary" className="text-xs font-mono">
                  .{configType === 'mcp' ? 'mcp.json' : 'claude.json'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {server.command} {(server.args || []).join(' ')}
              </p>
            </div>

            {/* CLI Command */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  {formatMessage({ id: 'mcp.installCmd.cliCommand' })}
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(command)}
                  className="h-7"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 mr-1" />
                      {formatMessage({ id: 'common.success.copied' })}
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-1" />
                      {formatMessage({ id: 'common.actions.copy' })}
                    </>
                  )}
                </Button>
              </div>
              <div className="relative">
                <pre
                  className={cn(
                    'bg-slate-950 text-slate-50 p-4 rounded-lg text-sm font-mono overflow-x-auto',
                    'border border-slate-800'
                  )}
                >
                  <code>{command}</code>
                </pre>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatMessage({ id: 'mcp.installCmd.cliCommandHint' })}
              </p>
            </div>

            {/* JSON Config */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  {formatMessage({ id: 'mcp.installCmd.jsonConfig' })}
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(jsonConfig)}
                  className="h-7"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 mr-1" />
                      {formatMessage({ id: 'common.success.copied' })}
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-1" />
                      {formatMessage({ id: 'common.actions.copy' })}
                    </>
                  )}
                </Button>
              </div>
              <div className="relative">
                <pre
                  className={cn(
                    'bg-slate-950 text-slate-50 p-4 rounded-lg text-sm font-mono overflow-x-auto',
                    'border border-slate-800'
                  )}
                >
                  <code>{jsonConfig}</code>
                </pre>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatMessage(
                  { id: 'mcp.installCmd.jsonConfigHint' },
                  { filename: `.${configType === 'mcp' ? 'mcp' : 'claude'}.json` }
                )}
              </p>
            </div>

            {/* Environment Variables */}
            {server.env && Object.keys(server.env).length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {formatMessage({ id: 'mcp.installCmd.envVars' })}
                </label>
                <div className="p-3 bg-muted rounded-lg space-y-1">
                  {Object.entries(server.env).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 text-sm font-mono">
                      <span className="text-foreground font-medium">{key}=</span>
                      <span className="text-muted-foreground break-all">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Installation Steps */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {formatMessage({ id: 'mcp.installCmd.steps' })}
              </label>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-primary/20 text-primary rounded-full text-xs font-medium">
                    1
                  </span>
                  <span>{formatMessage({ id: 'mcp.installCmd.step1' })}</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-primary/20 text-primary rounded-full text-xs font-medium">
                    2
                  </span>
                  <span>
                    {formatMessage({ id: 'mcp.installCmd.step2' })}
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-primary/20 text-primary rounded-full text-xs font-medium">
                    3
                  </span>
                  <span>
                    {formatMessage({ id: 'mcp.installCmd.step3' })}
                  </span>
                </li>
              </ol>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            {formatMessage({ id: 'common.actions.close' })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default InstallCommandDialog;
