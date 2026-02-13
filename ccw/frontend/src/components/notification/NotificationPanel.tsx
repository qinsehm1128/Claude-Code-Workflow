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
  File,
  Download,
  Loader2,
  RotateCcw,
  Code,
  Database,
  Mail,
  MailOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { A2UIRenderer } from '@/packages/a2ui-runtime/renderer';
import { useNotificationStore, selectPersistentNotifications } from '@/stores';
import type { Toast, NotificationAttachment, NotificationAction, ActionStateType, NotificationSource } from '@/types/store';

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

// ========== Main Types ==========

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

function getSourceColor(source: NotificationSource): string {
  switch (source) {
    case 'system':
      return 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800';
    case 'websocket':
      return 'bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-800';
    case 'cli':
      return 'bg-green-500/10 text-green-600 border-green-200 dark:border-green-800';
    case 'workflow':
      return 'bg-orange-500/10 text-orange-600 border-orange-200 dark:border-orange-800';
    case 'user':
      return 'bg-cyan-500/10 text-cyan-600 border-cyan-200 dark:border-cyan-800';
    case 'external':
      return 'bg-pink-500/10 text-pink-600 border-pink-200 dark:border-pink-800';
    default:
      return 'bg-gray-500/10 text-gray-600 border-gray-200 dark:border-gray-800';
  }
}

function getTypeBorder(type: Toast['type']): string {
  switch (type) {
    case 'success':
      return 'border-l-green-500';
    case 'warning':
      return 'border-l-yellow-500';
    case 'error':
      return 'border-l-red-500';
    case 'info':
    default:
      return 'border-l-blue-500';
  }
}

// ========== Sub-Components ==========

interface PanelHeaderProps {
  notificationCount: number;
  hasNotifications: boolean;
  hasUnread: boolean;
  onClose: () => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
}

function PanelHeader({
  notificationCount,
  hasNotifications,
  hasUnread,
  onClose,
  onMarkAllRead,
  onClearAll,
}: PanelHeaderProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="flex items-start justify-between px-4 py-3 border-b border-border bg-card">
      <div className="flex-1 min-w-0 mr-2">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            {formatMessage({ id: 'notifications.title' }) || 'Notifications'}
          </h2>
          {notificationCount > 0 && (
            <Badge variant="default" className="h-5 px-1.5 text-xs">
              {notificationCount}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {/* Mark All Read button */}
        {hasNotifications && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMarkAllRead}
            disabled={!hasUnread}
            className="h-8 w-8"
            aria-label={formatMessage({ id: 'notifications.markAllRead' }) || 'Mark all as read'}
            title={formatMessage({ id: 'notifications.markAllRead' }) || 'Mark all as read'}
          >
            <Check className="h-4 w-4" />
          </Button>
        )}
        {/* Clear All button */}
        {hasNotifications && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearAll}
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            aria-label={formatMessage({ id: 'notifications.clearAll' }) || 'Clear all notifications'}
            title={formatMessage({ id: 'notifications.clearAll' }) || 'Clear all notifications'}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
          aria-label={formatMessage({ id: 'notifications.close' }) || 'Close notifications'}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

// ========== Helper Components for Attachments and Actions ==========

interface NotificationAttachmentItemProps {
  attachment: NotificationAttachment;
}

function NotificationAttachmentItem({ attachment }: NotificationAttachmentItemProps) {
  const { formatMessage } = useIntl();

  // Format file size
  function formatFileSize(bytes?: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // Render different attachment types
  switch (attachment.type) {
    case 'image':
      return (
        <div className="mt-2 rounded-md overflow-hidden border border-border">
          {attachment.url ? (
            <img
              src={attachment.url}
              alt={attachment.filename || formatMessage({ id: 'notifications.attachments.image' }) || 'Image'}
              className="max-w-full max-h-48 object-contain bg-muted"
              loading="lazy"
            />
          ) : attachment.content ? (
            <img
              src={attachment.content}
              alt={attachment.filename || formatMessage({ id: 'notifications.attachments.image' }) || 'Image'}
              className="max-w-full max-h-48 object-contain bg-muted"
              loading="lazy"
            />
          ) : null}
          {attachment.filename && (
            <div className="px-2 py-1 text-xs text-muted-foreground bg-muted/50 truncate">
              {attachment.filename}
            </div>
          )}
        </div>
      );

    case 'code':
      return (
        <div className="mt-2 rounded-md border border-border overflow-hidden">
          <div className="flex items-center justify-between px-2 py-1 bg-muted/50 border-b border-border">
            <div className="flex items-center gap-1.5">
              <Code className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-mono">
                {attachment.filename || formatMessage({ id: 'notifications.attachments.code' }) || 'Code'}
              </span>
            </div>
            {attachment.mimeType && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                {attachment.mimeType.replace('text/', '').replace('application/', '')}
              </span>
            )}
          </div>
          {attachment.content && (
            <pre className="p-2 text-xs bg-background overflow-x-auto max-h-48 overflow-y-auto">
              <code className="font-mono">{attachment.content}</code>
            </pre>
          )}
        </div>
      );

    case 'file':
      return (
        <div className="mt-2 flex items-center gap-2 p-2 rounded-md border border-border bg-muted/30">
          <File className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-foreground truncate">
              {attachment.filename || formatMessage({ id: 'notifications.attachments.file' }) || 'File'}
            </div>
            {attachment.size && (
              <div className="text-[10px] text-muted-foreground">
                {formatFileSize(attachment.size)}
              </div>
            )}
          </div>
          {attachment.url && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-7 px-2 text-xs"
            >
              <a href={attachment.url} download={attachment.filename}>
                <Download className="h-3 w-3 mr-1" />
                {formatMessage({ id: 'notifications.attachments.download' }) || 'Download'}
              </a>
            </Button>
          )}
        </div>
      );

    case 'data':
      return (
        <div className="mt-2 rounded-md border border-border overflow-hidden">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/50 border-b border-border">
            <Database className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {formatMessage({ id: 'notifications.attachments.data' }) || 'Data'}
            </span>
          </div>
          {attachment.content && (
            <pre className="p-2 text-xs bg-muted/20 overflow-x-auto max-h-48 overflow-y-auto">
              <code className="font-mono text-muted-foreground">
                {JSON.stringify(JSON.parse(attachment.content), null, 2)}
              </code>
            </pre>
          )}
        </div>
      );

    default:
      return null;
  }
}

interface NotificationActionsProps {
  actions: NotificationAction[];
}

function NotificationActions({ actions }: NotificationActionsProps) {
  const { formatMessage } = useIntl();
  const [actionStates, setActionStates] = useState<Record<string, ActionStateType>>({});
  const [retryCounts, setRetryCounts] = useState<Record<string, number>>({});

  const handleActionClick = useCallback(
    async (action: NotificationAction, index: number) => {
      const actionKey = `${index}-${action.label}`;

      // Skip if already loading
      if (actionStates[actionKey] === 'loading') {
        return;
      }

      // Handle confirmation if present
      if (action.confirm) {
        const confirmed = window.confirm(
          action.confirm.message || action.label
        );
        if (!confirmed) {
          return;
        }
      }

      // Set loading state
      setActionStates((prev) => ({ ...prev, [actionKey]: 'loading' }));

      try {
        // Call the action handler
        await action.onClick();

        // Set success state
        setActionStates((prev) => ({ ...prev, [actionKey]: 'success' }));

        // Reset after 2 seconds
        setTimeout(() => {
          setActionStates((prev) => ({ ...prev, [actionKey]: 'idle' }));
        }, 2000);
      } catch (error) {
        // Set error state
        setActionStates((prev) => ({ ...prev, [actionKey]: 'error' }));

        // Increment retry count
        setRetryCounts((prev) => ({
          ...prev,
          [actionKey]: (prev[actionKey] || 0) + 1,
        }));

        // Log error
        console.error('[NotificationActions] Action failed:', error);
      }
    },
    [actionStates]
  );

  const getActionButtonContent = (action: NotificationAction, index: number) => {
    const actionKey = `${index}-${action.label}`;
    const state = actionStates[actionKey];
    const retryCount = retryCounts[actionKey] || 0;

    switch (state) {
      case 'loading':
        return (
          <>
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            {formatMessage({ id: 'notifications.actions.loading' }) || 'Loading...'}
          </>
        );
      case 'success':
        return (
          <>
            <Check className="h-3 w-3 mr-1 text-green-500" />
            {formatMessage({ id: 'notifications.actions.success' }) || 'Done'}
          </>
        );
      case 'error':
        return (
          <>
            <RotateCcw className="h-3 w-3 mr-1" />
            {formatMessage({ id: 'notifications.actions.retry' }) || 'Retry'}
            {retryCount > 0 && (
              <span className="ml-1 text-[10px] text-muted-foreground">
                ({retryCount})
              </span>
            )}
          </>
        );
      default:
        return action.label;
    }
  };

  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {actions.map((action, index) => {
        const actionKey = `${index}-${action.label}`;
        const state = actionStates[actionKey];

        return (
          <Button
            key={actionKey}
            variant={action.primary ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleActionClick(action, index)}
            disabled={
              action.disabled ||
              action.loading ||
              state === 'loading'
            }
            className={cn(
              'h-7 text-xs',
              state === 'error' && 'text-destructive border-destructive hover:bg-destructive/10',
              state === 'success' && 'text-green-600 border-green-600 hover:bg-green-50'
            )}
          >
            {getActionButtonContent(action, index)}
          </Button>
        );
      })}
    </div>
  );
}

interface NotificationItemProps {
  notification: Toast;
  onDelete: (id: string) => void;
  onToggleRead?: (id: string) => void;
}

function NotificationItem({ notification, onDelete, onToggleRead }: NotificationItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasDetails = notification.message && notification.message.length > 100;
  const { formatMessage } = useIntl();
  const isRead = notification.read ?? false;
  const hasActions = notification.actions && notification.actions.length > 0;
  const hasLegacyAction = notification.action && !hasActions;
  const hasAttachments = notification.attachments && notification.attachments.length > 0;
  const sendA2UIAction = useNotificationStore((state) => state.sendA2UIAction);

  // Check if this is an A2UI notification
  const isA2UI = notification.type === 'a2ui' && notification.a2uiSurface;

  // Format absolute timestamp
  const absoluteTime = new Date(notification.timestamp).toLocaleString();

  return (
    <div
      className={cn(
        'p-3 border-b border-border hover:bg-muted/50 transition-colors',
        'border-l-4 relative',
        getTypeBorder(notification.type),
        isRead && 'opacity-70'
      )}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div className="mt-0.5">{getNotificationIcon(notification.type)}</div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header row: title + actions */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* Title with source badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-medium text-foreground truncate">
                  {notification.title}
                </h4>
                {/* Source badge */}
                {notification.source && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'h-5 px-1.5 text-[10px] font-medium border shrink-0',
                      getSourceColor(notification.source)
                    )}
                  >
                    {notification.source}
                  </Badge>
                )}
                {/* Read/Unread status badge */}
                {!isRead && (
                  <Badge
                    variant="default"
                    className="h-5 px-1.5 text-[10px] font-medium shrink-0"
                  >
                    {formatMessage({ id: 'notifications.unread' }) || '未读'}
                  </Badge>
                )}
                {isRead && (
                  <Badge
                    variant="outline"
                    className="h-5 px-1.5 text-[10px] font-medium shrink-0 opacity-60"
                  >
                    {formatMessage({ id: 'notifications.read' }) || '已读'}
                  </Badge>
                )}
              </div>

              {/* Timestamp row: absolute + relative */}
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-muted-foreground">
                  {absoluteTime}
                </span>
                <span className="text-[10px] text-muted-foreground/70">
                  ({formatTimeAgo(notification.timestamp, formatMessage)})
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Read/unread toggle */}
              {onToggleRead && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 p-0 hover:bg-muted"
                  onClick={() => onToggleRead(notification.id)}
                  aria-label={isRead
                    ? formatMessage({ id: 'notifications.markAsUnread' }) || 'Mark as unread'
                    : formatMessage({ id: 'notifications.markAsRead' }) || 'Mark as read'}
                  title={isRead
                    ? formatMessage({ id: 'notifications.markAsUnread' }) || 'Mark as unread'
                    : formatMessage({ id: 'notifications.markAsRead' }) || 'Mark as read'}
                >
                  {isRead ? <MailOpen className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                </Button>
              )}
              {/* Delete button */}
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
              <A2UIRenderer
                surface={notification.a2uiSurface}
                onAction={(actionId, params) => {
                  // Send A2UI action back to backend via WebSocket
                  sendA2UIAction(actionId, notification.a2uiSurface!.surfaceId, params);

                  // ask_question surfaces should disappear after the user answers
                  const maybeQuestionId = (notification.a2uiSurface?.initialState as Record<string, unknown> | undefined)
                    ?.questionId;
                  const isAskQuestionSurface = typeof maybeQuestionId === 'string';
                  const resolvesQuestion = actionId === 'confirm' || actionId === 'cancel' || actionId === 'submit' || actionId === 'answer';

                  if (isAskQuestionSurface && resolvesQuestion) {
                    onDelete(notification.id);
                  }
                }}
              />
            </div>
          ) : (
            <>
              {/* Regular message content */}
              {notification.message && (
                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
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
                      {formatMessage({ id: 'notifications.showLess' }) || 'Show less'}
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3" />
                      {formatMessage({ id: 'notifications.showMore' }) || 'Show more'}
                    </>
                  )}
                </button>
              )}

              {/* Attachments */}
              {hasAttachments && notification.attachments && (
                <div className="mt-2">
                  {notification.attachments.map((attachment, index) => (
                    <NotificationAttachmentItem
                      key={`${attachment.type}-${index}`}
                      attachment={attachment}
                    />
                  ))}
                </div>
              )}

              {/* Action buttons (new actions array) */}
              {hasActions && notification.actions && (
                <NotificationActions actions={notification.actions} />
              )}

              {/* Legacy single action button */}
              {hasLegacyAction && notification.action && (
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
  onToggleRead?: (id: string) => void;
}

function NotificationList({ notifications, onDelete, onToggleRead }: NotificationListProps) {
  if (notifications.length === 0) return null;

  return (
    <div className="flex-1 overflow-y-auto">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onDelete={onDelete}
          onToggleRead={onToggleRead}
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
            formatMessage({ id: 'notifications.empty' }) ||
            'No notifications'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatMessage({ id: 'notifications.emptyHint' }) ||
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

  // Store state
  const persistentNotifications = useNotificationStore(selectPersistentNotifications);
  const removePersistentNotification = useNotificationStore(
    (state) => state.removePersistentNotification
  );
  const clearPersistentNotifications = useNotificationStore(
    (state) => state.clearPersistentNotifications
  );
  const toggleNotificationRead = useNotificationStore(
    (state) => state.toggleNotificationRead
  );

  // Check if markAllAsRead exists
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

  // Toggle read handler
  const handleToggleRead = useCallback(
    (id: string) => {
      toggleNotificationRead(id);
    },
    [toggleNotificationRead]
  );

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

  // Check for unread notifications based on read field
  const hasUnread = sortedNotifications.some((n) => !n.read);

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
        {/* Header with integrated actions */}
        <PanelHeader
          notificationCount={sortedNotifications.length}
          hasNotifications={sortedNotifications.length > 0}
          hasUnread={hasUnread}
          onClose={onClose}
          onMarkAllRead={handleMarkAllRead}
          onClearAll={handleClearAll}
        />

        {/* Content */}
        {sortedNotifications.length > 0 ? (
          <NotificationList
            notifications={sortedNotifications}
            onDelete={handleDelete}
            onToggleRead={handleToggleRead}
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </>
  );
}

export default NotificationPanel;
