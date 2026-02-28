// ========================================
// CCW Logo Component
// ========================================
// Line-style logo for Claude Code Workflow

import { cn } from '@/lib/utils';

interface CCWLogoProps {
  /** Size of the icon */
  size?: number;
  /** Additional class names */
  className?: string;
  /** Whether to show the status dot */
  showDot?: boolean;
}

/**
 * Line-style CCW logo component
 * Features three horizontal lines with a status dot that follows theme color
 */
export function CCWLogo({ size = 24, className, showDot = true }: CCWLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('ccw-logo', className)}
      style={{ color: 'hsl(var(--accent))' }}
      aria-label="Claude Code Workflow"
    >
      {/* Three horizontal lines - line style */}
      <line
        x1="3"
        y1="6"
        x2="18"
        y2="6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="3"
        y1="12"
        x2="15"
        y2="12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="3"
        y1="18"
        x2="12"
        y2="18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Status dot - follows theme color via currentColor */}
      {showDot && (
        <circle
          cx="19"
          cy="17"
          r="3"
          fill="currentColor"
        />
      )}
    </svg>
  );
}

export default CCWLogo;
