// ========================================
// CLI Mode Toggle Component
// ========================================
// Toggle between Claude and Codex CLI modes with config path display

import { useIntl } from 'react-intl';
import { Terminal, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

// ========== Types ==========

export type CliMode = 'claude' | 'codex';

export interface CliModeToggleProps {
  currentMode: CliMode;
  onModeChange: (mode: CliMode) => void;
  codexConfigPath?: string;
}

// ========== Component ==========

export function CliModeToggle({
  currentMode,
  onModeChange,
  codexConfigPath,
}: CliModeToggleProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="space-y-3">
      {/* Mode Toggle Buttons */}
      <div className="flex gap-2 p-1 bg-muted rounded-lg">
        <Button
          variant={currentMode === 'claude' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onModeChange('claude')}
          className={cn(
            'flex-1 gap-2',
            currentMode === 'claude' && 'shadow-sm'
          )}
        >
          <Terminal className="w-4 h-4" />
          <span>{formatMessage({ id: 'mcp.mode.claude' })}</span>
        </Button>
        <Button
          variant={currentMode === 'codex' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onModeChange('codex')}
          className={cn(
            'flex-1 gap-2',
            currentMode === 'codex' && 'shadow-sm'
          )}
        >
          <Cpu className="w-4 h-4" />
          <span>{formatMessage({ id: 'mcp.mode.codex' })}</span>
        </Button>
      </div>

      {/* Codex Config Path Display */}
      {currentMode === 'codex' && codexConfigPath && (
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md border border-border">
          <Badge variant="outline" className="text-xs">
            {formatMessage({ id: 'mcp.codex.configPath' })}
          </Badge>
          <code className="text-xs text-muted-foreground font-mono truncate flex-1">
            {codexConfigPath}
          </code>
        </div>
      )}
    </div>
  );
}

export default CliModeToggle;
