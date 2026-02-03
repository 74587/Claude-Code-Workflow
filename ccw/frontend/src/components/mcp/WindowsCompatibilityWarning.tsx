// ========================================
// Windows Compatibility Warning Component
// ========================================
// Windows-specific warning banner with command detection and auto-fix functionality

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Download, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

// ========== Types ==========

export interface WindowsCompatibilityWarningProps {
  /** Optional: Project path to check commands against */
  projectPath?: string;
  /** Optional: Callback when compatibility check completes */
  onComplete?: (result: CompatibilityCheckResult) => void;
}

export interface CommandDetectionResult {
  command: string;
  available: boolean;
  installUrl?: string;
}

export interface CompatibilityCheckResult {
  isWindows: boolean;
  missingCommands: string[];
  commands: CommandDetectionResult[];
  canAutoFix: boolean;
}

// ========== Constants ==========

const COMMON_COMMANDS = [
  { name: 'npm', installUrl: 'https://docs.npmjs.com/downloading-and-installing-node-js-and-npm' },
  { name: 'node', installUrl: 'https://nodejs.org/' },
  { name: 'python', installUrl: 'https://www.python.org/downloads/' },
  { name: 'npx', installUrl: 'https://docs.npmjs.com/downloading-and-installing-node-js-and-npm' },
];

// Helper function to check if a command can be auto-fixed
function canAutoFixCommand(command: string): boolean {
  return COMMON_COMMANDS.some((cmd) => cmd.name === command);
}

// ========== API Functions ==========

async function detectWindowsCommands(projectPath?: string): Promise<CommandDetectionResult[]> {
  const response = await fetch('/api/mcp/detect-commands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectPath }),
  });
  if (!response.ok) {
    throw new Error('Failed to detect commands');
  }
  return response.json();
}

async function applyWindowsAutoFix(projectPath?: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch('/api/mcp/apply-windows-fix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectPath }),
  });
  if (!response.ok) {
    throw new Error('Failed to apply Windows fix');
  }
  return response.json();
}

// ========== Sub-Components ==========

interface CommandDetectionListProps {
  commands: CommandDetectionResult[];
}

function CommandDetectionList({ commands }: CommandDetectionListProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="space-y-2 mt-3">
      {commands.map((cmd) => (
        <div
          key={cmd.command}
          className={cn(
            'flex items-center gap-2 text-sm p-2 rounded-md',
            cmd.available ? 'bg-success/10' : 'bg-destructive/10'
          )}
        >
          {cmd.available ? (
            <CheckCircle className="w-4 h-4 text-success" />
          ) : (
            <XCircle className="w-4 h-4 text-destructive" />
          )}
          <code className="font-mono flex-1">{cmd.command}</code>
          {!cmd.available && cmd.installUrl && (
            <a
              href={cmd.installUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              {formatMessage({ id: 'mcp.windows.install' })}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

// ========== Main Component ==========

export function WindowsCompatibilityWarning({
  projectPath,
  onComplete,
}: WindowsCompatibilityWarningProps) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();

  const [checkResult, setCheckResult] = useState<CompatibilityCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Detect Windows platform
  const isWindows = typeof window !== 'undefined' && window.navigator.platform.toLowerCase().includes('win');

  // Mutation for auto-fix
  const autoFixMutation = useMutation({
    mutationFn: () => applyWindowsAutoFix(projectPath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcpServers'] });
      if (onComplete && checkResult) {
        onComplete({ ...checkResult, canAutoFix: false });
      }
    },
  });

  // Check compatibility on mount (Windows only)
  useEffect(() => {
    if (!isWindows || dismissed) return;

    const checkCompatibility = async () => {
      setIsChecking(true);
      try {
        const results = await detectWindowsCommands(projectPath);
        const missingCommands = results.filter((r) => !r.available).map((r) => r.command);
        const canAutoFix = missingCommands.length > 0 && missingCommands.every(canAutoFixCommand);

        const result: CompatibilityCheckResult = {
          isWindows: true,
          missingCommands,
          commands: results,
          canAutoFix,
        };

        setCheckResult(result);
        if (onComplete) {
          onComplete(result);
        }
      } catch (error) {
        console.error('Failed to check Windows compatibility:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkCompatibility();
  }, [isWindows, dismissed, projectPath, onComplete]);

  // Don't render if not Windows, dismissed, or still checking without errors
  if (!isWindows || dismissed || (isChecking && !checkResult)) {
    return null;
  }

  // Don't show warning if all commands are available
  if (checkResult && checkResult.missingCommands.length === 0) {
    return null;
  }

  const handleAutoFix = async () => {
    autoFixMutation.mutate();
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  return (
    <div className="border border-warning/50 bg-warning/5 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                {formatMessage({ id: 'mcp.windows.title' })}
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                {formatMessage({ id: 'mcp.windows.description' })}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleDismiss}
            >
              ×
            </Button>
          </div>

          {checkResult && (
            <>
              {checkResult.missingCommands.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="warning" className="text-xs">
                    {formatMessage({ id: 'mcp.windows.missingCount' }, { count: checkResult.missingCommands.length })}
                  </Badge>
                </div>
              )}

              <CommandDetectionList commands={checkResult.commands} />

              {checkResult.canAutoFix && (
                <div className="flex items-center gap-2 pt-2 border-t border-warning/20">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAutoFix}
                    disabled={autoFixMutation.isPending}
                    className="text-xs"
                  >
                    {autoFixMutation.isPending ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        {formatMessage({ id: 'mcp.windows.fixing' })}
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {formatMessage({ id: 'mcp.windows.autoFix' })}
                      </>
                    )}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {formatMessage({ id: 'mcp.windows.autoFixHint' })}
                  </span>
                </div>
              )}
            </>
          )}

          {isChecking && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {formatMessage({ id: 'mcp.windows.checking' })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WindowsCompatibilityWarning;
