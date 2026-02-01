// ========================================
// LocationSwitcher Component
// ========================================
// Toggle between Project and User command locations

import * as React from 'react';
import { useIntl } from 'react-intl';
import { Folder, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LocationSwitcherProps {
  /** Current selected location */
  currentLocation: 'project' | 'user';
  /** Callback when location changes */
  onLocationChange: (location: 'project' | 'user') => void;
  /** Number of project commands (optional, for display) */
  projectCount?: number;
  /** Number of user commands (optional, for display) */
  userCount?: number;
  /** Disabled state */
  disabled?: boolean;
  /** Translation prefix (default: 'commands') */
  translationPrefix?: 'commands' | 'skills';
}

/**
 * LocationSwitcher component
 * Toggle switch for Project vs User command location
 */
export function LocationSwitcher({
  currentLocation,
  onLocationChange,
  projectCount,
  userCount,
  disabled = false,
  translationPrefix = 'commands',
}: LocationSwitcherProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="inline-flex bg-muted rounded-lg p-1">
      <button
        className={cn(
          'px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-1.5',
          currentLocation === 'project'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
        onClick={() => onLocationChange('project')}
        disabled={disabled}
      >
        <Folder className="w-3.5 h-3.5" />
        <span>{formatMessage({ id: `${translationPrefix}.location.project` })}</span>
        {projectCount !== undefined && (
          <span className="text-xs text-muted-foreground">({projectCount})</span>
        )}
      </button>
      <button
        className={cn(
          'px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-1.5',
          currentLocation === 'user'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
        onClick={() => onLocationChange('user')}
        disabled={disabled}
      >
        <User className="w-3.5 h-3.5" />
        <span>{formatMessage({ id: `${translationPrefix}.location.user` })}</span>
        {userCount !== undefined && (
          <span className="text-xs text-muted-foreground">({userCount})</span>
        )}
      </button>
    </div>
  );
}

export default LocationSwitcher;
