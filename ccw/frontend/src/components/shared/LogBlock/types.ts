// ========================================
// LogBlock Types
// ========================================

export interface LogBlockProps {
  block: LogBlockData;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onCopyCommand: () => void;
  onCopyOutput: () => void;
  onReRun: () => void;
  className?: string;
}

export interface LogBlockData {
  id: string;
  title: string;
  type: 'command' | 'tool' | 'output' | 'error' | 'warning' | 'info';
  status: 'running' | 'completed' | 'error' | 'pending';
  toolName?: string;
  lineCount: number;
  duration?: number;
  lines: LogLine[];
  timestamp: number;
}

export interface LogLine {
  type: 'stdout' | 'stderr' | 'thought' | 'system' | 'metadata' | 'tool_call';
  content: string;
  timestamp: number;
}
