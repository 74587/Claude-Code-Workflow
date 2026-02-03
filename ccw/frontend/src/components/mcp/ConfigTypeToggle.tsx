// ========================================
// Config Type Toggle Component
// ========================================
// Toggle between .mcp.json and .claude.json config storage formats with localStorage persistence

import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/AlertDialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

// ========== Types ==========

/**
 * MCP config file type
 */
export type McpConfigType = 'mcp-json' | 'claude-json';

/**
 * Props for ConfigTypeToggle component
 */
export interface ConfigTypeToggleProps {
  /** Current config type */
  currentType: McpConfigType;
  /** Callback when config type changes */
  onTypeChange: (type: McpConfigType) => void;
  /** Whether to show warning when switching (default: true) */
  showWarning?: boolean;
  /** Number of existing servers in current config (for warning message) */
  existingServersCount?: number;
}

// ========== Constants ==========

/**
 * localStorage key for config type persistence
 */
const CONFIG_TYPE_STORAGE_KEY = 'mcp-config-type';

/**
 * Default config type
 */
const DEFAULT_CONFIG_TYPE: McpConfigType = 'mcp-json';

// ========== Helper Functions ==========

/**
 * Load config type from localStorage
 */
export function loadConfigType(): McpConfigType {
  try {
    const stored = localStorage.getItem(CONFIG_TYPE_STORAGE_KEY);
    if (stored === 'mcp-json' || stored === 'claude-json') {
      return stored;
    }
  } catch {
    // Ignore localStorage errors
  }
  return DEFAULT_CONFIG_TYPE;
}

/**
 * Save config type to localStorage
 */
export function saveConfigType(type: McpConfigType): void {
  try {
    localStorage.setItem(CONFIG_TYPE_STORAGE_KEY, type);
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Get file extension for config type
 */
export function getConfigFileExtension(type: McpConfigType): string {
  switch (type) {
    case 'mcp-json':
      return '.mcp.json';
    case 'claude-json':
      return '.claude.json';
    default:
      return '.json';
  }
}

// ========== Component ==========

/**
 * Config type toggle segmented control
 */
export function ConfigTypeToggle({
  currentType,
  onTypeChange,
  showWarning = true,
  existingServersCount = 0,
}: ConfigTypeToggleProps) {
  const { formatMessage } = useIntl();
  const [internalType, setInternalType] = useState<McpConfigType>(currentType);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [pendingType, setPendingType] = useState<McpConfigType | null>(null);

  // Sync internal state with prop changes
  useEffect(() => {
    setInternalType(currentType);
  }, [currentType]);

  // Load saved preference on mount (only if no current type is set)
  useEffect(() => {
    if (!currentType || currentType === DEFAULT_CONFIG_TYPE) {
      const savedType = loadConfigType();
      if (savedType !== currentType) {
        setInternalType(savedType);
        onTypeChange(savedType);
      }
    }
  }, []); // Run once on mount

  // Handle type toggle click
  const handleTypeClick = (type: McpConfigType) => {
    if (type === internalType) return;

    if (showWarning && existingServersCount > 0) {
      setPendingType(type);
      setShowWarningDialog(true);
    } else {
      applyTypeChange(type);
    }
  };

  // Apply the type change
  const applyTypeChange = (type: McpConfigType) => {
    setInternalType(type);
    saveConfigType(type);
    onTypeChange(type);
    setShowWarningDialog(false);
    setPendingType(null);
  };

  // Handle warning dialog confirm
  const handleWarningConfirm = () => {
    if (pendingType) {
      applyTypeChange(pendingType);
    }
  };

  // Handle warning dialog cancel
  const handleWarningCancel = () => {
    setShowWarningDialog(false);
    setPendingType(null);
  };

  return (
    <>
      <div className="space-y-3">
        {/* Label */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {formatMessage({ id: 'mcp.configType.label' })}
          </span>
          <Badge variant="outline" className="text-xs">
            {getConfigFileExtension(internalType)}
          </Badge>
        </div>

        {/* Toggle Buttons */}
        <div className="flex gap-2 p-1 bg-muted rounded-lg">
          <Button
            variant={internalType === 'mcp-json' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleTypeClick('mcp-json')}
            className={cn(
              'flex-1',
              internalType === 'mcp-json' && 'shadow-sm'
            )}
          >
            <span className="text-sm">
              {formatMessage({ id: 'mcp.configType.claudeJson' })}
            </span>
          </Button>
          <Button
            variant={internalType === 'claude-json' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleTypeClick('claude-json')}
            className={cn(
              'flex-1',
              internalType === 'claude-json' && 'shadow-sm'
            )}
          >
            <span className="text-sm">
              {formatMessage({ id: 'mcp.configType.claudeJson' })}
            </span>
          </Button>
        </div>

        {/* Current Format Display */}
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md border border-border">
          <code className="text-xs text-muted-foreground font-mono">
            {getConfigFileExtension(internalType)}
          </code>
          <span className="text-xs text-muted-foreground">
            {formatMessage({ id: 'mcp.configType.' + internalType.replace('-', '') })}
          </span>
        </div>
      </div>

      {/* Warning Dialog */}
      <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {formatMessage({ id: 'mcp.configType.switchConfirm' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {formatMessage({ id: 'mcp.configType.switchWarning' })}
              {existingServersCount > 0 && (
                <span className="block mt-2 text-amber-600 dark:text-amber-400">
                  {existingServersCount} {formatMessage({ id: 'mcp.stats.total' }).toLowerCase()}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleWarningCancel}>
              {formatMessage({ id: 'mcp.configType.switchCancel' })}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleWarningConfirm}>
              {formatMessage({ id: 'mcp.configType.switchConfirm' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default ConfigTypeToggle;
