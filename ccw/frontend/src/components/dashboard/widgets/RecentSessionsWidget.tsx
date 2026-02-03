// ========================================
// RecentSessionsWidget Component
// ========================================
// Widget wrapper for recent sessions list in dashboard grid layout

import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntl } from 'react-intl';
import { FolderKanban } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { SessionCard, SessionCardSkeleton } from '@/components/shared/SessionCard';
import { useSessions } from '@/hooks/useSessions';
import { Button } from '@/components/ui/Button';

export interface RecentSessionsWidgetProps {
  /** Data grid attributes for react-grid-layout */
  'data-grid'?: {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
  };
  /** Additional CSS classes */
  className?: string;
  /** Maximum number of sessions to display */
  maxSessions?: number;
}

/**
 * RecentSessionsWidget - Dashboard widget showing recent workflow sessions
 *
 * Displays recent active sessions (max 6 by default) with navigation to session detail.
 * Wrapped with React.memo to prevent unnecessary re-renders when parent updates.
 */
function RecentSessionsWidgetComponent({
  className,
  maxSessions = 6,
  ...props
}: RecentSessionsWidgetProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();

  // Fetch recent sessions (active only)
  const { activeSessions, isLoading } = useSessions({
    filter: { location: 'active' },
  });

  // Get recent sessions (sorted by creation date)
  const recentSessions = React.useMemo(
    () =>
      [...activeSessions]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, maxSessions),
    [activeSessions, maxSessions]
  );

  const handleSessionClick = (sessionId: string) => {
    navigate(`/sessions/${sessionId}`);
  };

  const handleViewAll = () => {
    navigate('/sessions');
  };

  return (
    <div {...props} className={className}>
      <Card className="h-full p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-foreground">
            {formatMessage({ id: 'home.sections.recentSessions' })}
          </h3>
          <Button variant="link" size="sm" onClick={handleViewAll}>
            {formatMessage({ id: 'common.actions.viewAll' })}
          </Button>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <SessionCardSkeleton key={i} />
              ))}
            </div>
          ) : recentSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <FolderKanban className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'home.emptyState.noSessions.message' })}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentSessions.map((session) => (
                <SessionCard
                  key={session.session_id}
                  session={session}
                  onClick={handleSessionClick}
                  onView={handleSessionClick}
                  showActions={false}
                />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/**
 * Memoized RecentSessionsWidget - Prevents re-renders when parent updates
 * Props are compared shallowly; use useCallback for function props
 */
export const RecentSessionsWidget = React.memo(RecentSessionsWidgetComponent);

export default RecentSessionsWidget;
