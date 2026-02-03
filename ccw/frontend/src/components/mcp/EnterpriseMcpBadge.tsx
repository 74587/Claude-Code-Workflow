// ========================================
// Enterprise MCP Badge Component
// ========================================
// Badge component for enterprise MCP server identification

import { useIntl } from 'react-intl';
import { Building2, Crown } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

// ========== Types ==========

export interface EnterpriseMcpBadgeProps {
  /** Server configuration to check for enterprise status */
  server?: {
    name: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
  };
  /** Additional class name */
  className?: string;
  /** Badge variant */
  variant?: 'default' | 'subtle' | 'icon-only';
  /** Enterprise server patterns for detection */
  enterprisePatterns?: string[];
}

// ========== Constants ==========

// Default patterns that indicate enterprise MCP servers
const DEFAULT_ENTERPRISE_PATTERNS = [
  // Command patterns
  '^enterprise-',
  '-enterprise$',
  '^ent-',
  'claude-.*enterprise',
  'anthropic-.*',
  // Server name patterns
  '^claude.*enterprise',
  '^anthropic',
  '^enterprise',
  // Env var patterns (API keys, endpoints)
  'ANTHROPIC.*',
  'ENTERPRISE.*',
  '.*_ENTERPRISE_ENDPOINT',
];

// ========== Helper Functions ==========

/**
 * Check if a server matches enterprise patterns
 */
function isEnterpriseServer(
  server: EnterpriseMcpBadgeProps['server'],
  patterns: string[]
): boolean {
  if (!server) return false;

  const allPatterns = [...patterns, ...DEFAULT_ENTERPRISE_PATTERNS];
  const searchText = [
    server.name,
    server.command || '',
    ...(server.args || []),
    ...Object.keys(server.env || {}),
    ...Object.values(server.env || {}),
  ]
    .join(' ')
    .toLowerCase();

  return allPatterns.some((pattern) => {
    try {
      const regex = new RegExp(pattern, 'i');
      return regex.test(searchText);
    } catch {
      // Fallback to simple string match if regex is invalid
      return searchText.includes(pattern.toLowerCase());
    }
  });
}

// ========== Component ==========

export function EnterpriseMcpBadge({
  server,
  className,
  variant = 'default',
  enterprisePatterns = [],
}: EnterpriseMcpBadgeProps) {
  const { formatMessage } = useIntl();

  const isEnterprise = isEnterpriseServer(server, enterprisePatterns);

  if (!isEnterprise || !server) {
    return null;
  }

  // Icon-only variant
  if (variant === 'icon-only') {
    return (
      <div
        className={cn(
          'inline-flex items-center justify-center w-5 h-5 rounded-full',
          'bg-gradient-to-br from-amber-500 to-orange-600',
          'text-white shadow-sm',
          className
        )}
        title={formatMessage({ id: 'mcp.enterprise.tooltip' })}
      >
        <Crown className="w-3 h-3" />
      </div>
    );
  }

  // Subtle variant (smaller, less prominent)
  if (variant === 'subtle') {
    return (
      <Badge
        variant="outline"
        className={cn(
          'text-xs border-amber-500/30 text-amber-600 dark:text-amber-400',
          'bg-amber-500/10',
          className
        )}
      >
        <Building2 className="w-3 h-3 mr-1" />
        {formatMessage({ id: 'mcp.enterprise.label' })}
      </Badge>
    );
  }

  // Default variant (prominent)
  return (
    <Badge
      className={cn(
        'bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0',
        'shadow-sm',
        className
      )}
    >
      <Crown className="w-3 h-3 mr-1" />
      {formatMessage({ id: 'mcp.enterprise.label' })}
    </Badge>
  );
}

// ========== Hook for Enterprise Detection ==========

/**
 * Hook to check if a server is an enterprise server
 */
export function useEnterpriseServer(
  server: EnterpriseMcpBadgeProps['server'] | undefined,
  customPatterns: string[] = []
): boolean {
  return isEnterpriseServer(server, customPatterns);
}

export default EnterpriseMcpBadge;
