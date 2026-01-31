// ========================================
// NotificationPanel Component
// ========================================
// Slide-over drawer notification panel with persistent notifications

import { useState, useCallback, useEffect } from 'react';
import { useIntl } from 'react-intl';
import {
  Bell,
  X,
  Check,
  Trash2,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { A2UIRenderer } from '@/packages/a2ui-runtime/renderer/A2UIRenderer';
import { useNotificationStore, selectPersistentNotifications } from '@/stores';
import type { Toast } from '@/types/store';

// ========== Helper Functions ==========

function formatTimeAgo(timestamp: string, formatMessage: (message: { id: string; values?: Record<string, unknown> }) => string): string {
  const now = Date.now();
  const time = new Date(timestamp).getTime();
  const diffMs = now - time;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return formatMessage({ id: 'notifications.justNow' });
  if (minutes < 60) {
    return formatMessage({
      id: minutes === 1 ? 'notifications.oneMinuteAgo' : 'notifications.minutesAgo',
      values: { 0: String(minutes) }
    });
  }
  if (hours < 24) {
    return formatMessage({
      id: hours === 1 ? 'notifications.oneHourAgo' : 'notifications.hoursAgo',
      values: { 0: String(hours) }
    });
  }
  if (days < 7) {
    return formatMessage({
      id: days === 1 ? 'notifications.oneDayAgo' : 'notifications.daysAgo',
      values: { 0: String(days) }
    });
  }
  return new Date(timestamp).toLocaleDateString();
}

function formatDetails(details: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  if (typeof details === 'string') return details;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  if (typeof details === 'object' && details !== null) {
    return JSON.stringify(details, null, 2);
  }
  return String(details);
}

function getNotificationIcon(type: Toast['type']) {
  const iconClassName = 'h-4 w-4 shrink-0';
  switch (type) {
    case 'success':
      return <CheckCircle className={cn(iconClassName, 'text-green-500')} />;
    case 'warning':
      return <AlertTriangle className={cn(iconClassName, 'text-yellow-500')} />;
    case 'error':
      return <XCircle className={cn(iconClassName, 'text-red-500')} />;
    case 'info':
    default:
      return <Info className={cn(iconClassName, 'text-blue-500')} />;
  }
}

// ========== Sub-Components ==========

interface PanelHeaderProps {
  notificationCount: number;
  onClose: () => void;
}

function PanelHeader({ notificationCount, onClose }: PanelHeaderProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="flex items-start justify-between px-4 py-3 border-b border-border bg-card">
      <div className="flex-1 min-w-0 mr-4">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            {formatMessage({ id: 'notificationPanel.title' }) || 'Notifications'}
          </h2>
          {notificationCount > 0 && (
            <Badge variant="default" className="h-5 px-1.5 text-xs">
              {notificationCount}
            </Badge>
          )}
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={onClose}>
        <X className="h-5 w-5" />
      </Button>
    </div>
  );
}

interface PanelActionsProps {
  hasNotifications: boolean;
  hasUnread: boolean;
  onMarkAllRead: () => void;
  onClearAll: () => void;
}

function PanelActions({ hasNotifications, hasUnread, onMarkAllRead, onClearAll }: PanelActionsProps) {
  const { formatMessage } = useIntl();

  if (!hasNotifications) return null;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-secondary/30 border-b border-border">
      <Button
        variant="ghost"
        size="sm"
        onClick={onMarkAllRead}
        disabled={!hasUnread}
        className="h-7 text-xs"
      >
        <Check className="h-3 w-3 mr-1" />
        {formatMessage({ id: 'notificationPanel.markAllRead' }) || 'Mark Read'}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        className="h-7 text-xs text-destructive hover:text-destructive"
      >
        <Trash2 className="h-3 w-3 mr-1" />
        {formatMessage({ id: 'notificationPanel.clearAll' }) || 'Clear All'}
      </Button>
    </div>
  );
}

interface NotificationItemProps {
  notification: Toast;
  onDelete: (id: string) => void;
}

function NotificationItem({ notification, onDelete }: NotificationItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasDetails = notification.message && notification.message.length > 100;
  const { formatMessage } = useIntl();

  // Check if this is an A2UI notification
  const isA2UI = notification.type === 'a2ui' && notification.a2uiSurface;

  return (
    <div
      className={cn(
        'p-3 border-b border-border hover:bg-muted/50 transition-colors',
        // Read opacity will be handled in T5 when read field is added
        'opacity-100'
      )}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div className="mt-0.5">{getNotificationIcon(notification.type)}</div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-medium text-foreground truncate">
              {notification.title}
            </h4>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatTimeAgo(notification.timestamp, formatMessage)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 p-0 hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => onDelete(notification.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* A2UI Surface Content */}
          {isA2UI && notification.a2uiSurface ? (
            <div className="mt-2">
              <A2UIRenderer surface={notification.a2uiSurface} />
            </div>
          ) : (
            <>
              {/* Regular message content */}
              {notification.message && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {isExpanded || !hasDetails
                    ? notification.message
                    : notification.message.slice(0, 100) + '...'}
                </p>
              )}

              {/* Expand toggle */}
              {hasDetails && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center gap-1 mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-3 w-3" />
                      {formatMessage({ id: 'notificationPanel.showLess' }) || 'Show less'}
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3" />
                      {formatMessage({ id: 'notificationPanel.showMore' }) || 'Show more'}
                    </>
                  )}
                </button>
              )}

              {/* Action button */}
              {notification.action && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={notification.action.onClick}
                  className="mt-2 h-7 text-xs"
                >
                  {notification.action.label}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface NotificationListProps {
  notifications: Toast[];
  onDelete: (id: string) => void;
}

function NotificationList({ notifications, onDelete }: NotificationListProps) {
  if (notifications.length === 0) return null;

  return (
    <div className="flex-1 overflow-y-auto">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

interface EmptyStateProps {
  message?: string;
}

function EmptyState({ message }: EmptyStateProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">
      <div className="text-center">
        <Bell className="h-16 w-16 mx-auto mb-4 opacity-30" />
        <p className="text-sm">
          {message ||
            formatMessage({ id: 'notificationPanel.empty' }) ||
            'No notifications'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatMessage({ id: 'notificationPanel.emptyHint' }) ||
            'Notifications will appear here'}
        </p>
      </div>
    </div>
  );
}

// ========== Main Component ==========

export interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
  const { formatMessage } = useIntl();

  // Store state
  const persistentNotifications = useNotificationStore(selectPersistentNotifications);
  const removePersistentNotification = useNotificationStore(
    (state) => state.removePersistentNotification
  );
  const clearPersistentNotifications = useNotificationStore(
    (state) => state.clearPersistentNotifications
  );

  // Check if markAllAsRead exists (will be added in T5)
  const store = useNotificationStore.getState();
  const markAllAsRead = 'markAllAsRead' in store ? (store.markAllAsRead as () => void) : undefined;

  // Reverse chronological order (newest first)
  const sortedNotifications = [...persistentNotifications].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Delete handler
  const handleDelete = useCallback(
    (id: string) => {
      // Find the notification being deleted
      const notification = persistentNotifications.find((n) => n.id === id);

      // If it's an A2UI notification, also remove from a2uiSurfaces Map
      if (notification?.type === 'a2ui' && notification.a2uiSurface) {
        const store = useNotificationStore.getState();
        const newSurfaces = new Map(store.a2uiSurfaces);
        newSurfaces.delete(notification.a2uiSurface.surfaceId);
        // Update the store's a2uiSurfaces directly
        useNotificationStore.setState({ a2uiSurfaces: newSurfaces });
      }

      removePersistentNotification(id);
    },
    [removePersistentNotification, persistentNotifications]
  );

  // Mark all read handler
  const handleMarkAllRead = useCallback(() => {
    if (markAllAsRead) {
      markAllAsRead();
    } else {
      // Placeholder for T5
      console.log('[NotificationPanel] markAllAsRead will be implemented in T5');
    }
  }, [markAllAsRead]);

  // Clear all handler
  const handleClearAll = useCallback(() => {
    clearPersistentNotifications();
  }, [clearPersistentNotifications]);

  // ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Check for unread notifications (will be enhanced in T5 with read field)
  // For now, all notifications are considered "unread" for UI purposes
  const hasUnread = sortedNotifications.length > 0;

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 bg-black/40 transition-opacity z-40',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-full md:w-[480px] bg-background border-l border-border shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-panel-title"
      >
        {/* Header */}
        <PanelHeader notificationCount={sortedNotifications.length} onClose={onClose} />

        {/* Action Bar */}
        <PanelActions
          hasNotifications={sortedNotifications.length > 0}
          hasUnread={hasUnread}
          onMarkAllRead={handleMarkAllRead}
          onClearAll={handleClearAll}
        />

        {/* Content */}
        {sortedNotifications.length > 0 ? (
          <NotificationList
            notifications={sortedNotifications}
            onDelete={handleDelete}
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </>
  );
}

export default NotificationPanel;
