// ========================================
// CLI Mode Toggle Component
// ========================================
// Compact badge-style toggle between Claude and Codex CLI modes

import { useIntl } from 'react-intl';
import { Terminal, Cpu } from 'lucide-react';
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
}: CliModeToggleProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="inline-flex items-center rounded-full border border-border bg-muted/50 p-0.5">
      <button
        onClick={() => onModeChange('claude')}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all',
          currentMode === 'claude'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Terminal className="w-3.5 h-3.5" />
        {formatMessage({ id: 'mcp.mode.claude' })}
      </button>
      <button
        onClick={() => onModeChange('codex')}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all',
          currentMode === 'codex'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Cpu className="w-3.5 h-3.5" />
        {formatMessage({ id: 'mcp.mode.codex' })}
      </button>
    </div>
  );
}

export default CliModeToggle;
