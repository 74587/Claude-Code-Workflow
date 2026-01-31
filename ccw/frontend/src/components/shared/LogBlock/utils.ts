// ========================================
// LogBlock Utility Functions
// ========================================
// Shared helper functions for LogBlock components

import type { CliOutputLine } from '@/stores/cliStreamStore';

/**
 * Get the CSS class name for a given output line type
 *
 * @param type - The output line type
 * @returns The CSS class name for styling the line
 */
export function getOutputLineClass(type: CliOutputLine['type']): string {
  switch (type) {
    case 'thought':
      return 'text-purple-400';
    case 'system':
      return 'text-blue-400';
    case 'stderr':
      return 'text-red-400';
    case 'metadata':
      return 'text-yellow-400';
    case 'tool_call':
      return 'text-green-400';
    case 'stdout':
    default:
      return 'text-foreground';
  }
}
