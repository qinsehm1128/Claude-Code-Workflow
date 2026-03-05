// ========================================
// Header Component
// ========================================
// Top navigation bar with theme toggle and user menu

import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useIntl } from 'react-intl';
import {
  Moon,
  Sun,
  RefreshCw,
  Settings,
  User,
  LogOut,
  Terminal,
  Bell,
  Monitor,
  SquareTerminal,
} from 'lucide-react';
import { CCWLogo } from '@/components/icons/CCWLogo';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useTheme } from '@/hooks';
import { WorkspaceSelector } from '@/components/workspace/WorkspaceSelector';
import { A2UIButton } from '@/components/layout/A2UIButton';
import { useCliStreamStore, selectActiveExecutionCount } from '@/stores/cliStreamStore';
import { useNotificationStore } from '@/stores';
import { useTerminalPanelStore, selectTerminalCount } from '@/stores/terminalPanelStore';

export interface HeaderProps {
  /** Callback for refresh action */
  onRefresh?: () => void;
  /** Whether refresh is in progress */
  isRefreshing?: boolean;
  /** Callback to open CLI monitor */
  onCliMonitorClick?: () => void;
}

export function Header({
  onRefresh,
  isRefreshing = false,
  onCliMonitorClick,
}: HeaderProps) {
  const { formatMessage } = useIntl();
  const { isDark, toggleTheme } = useTheme();
  const activeCliCount = useCliStreamStore(selectActiveExecutionCount);
  const terminalCount = useTerminalPanelStore(selectTerminalCount);
  const toggleTerminalPanel = useTerminalPanelStore((s) => s.togglePanel);

  // Notification state for badge
  const persistentNotifications = useNotificationStore((state) => state.persistentNotifications);
  const togglePanel = useNotificationStore((state) => state.togglePanel);

  // Calculate unread count
  const unreadCount = persistentNotifications.filter((n) => !n.read).length;

  const handleRefresh = useCallback(() => {
    if (onRefresh && !isRefreshing) {
      onRefresh();
    }
  }, [onRefresh, isRefreshing]);

  return (
    <header
      className="relative flex items-center justify-between px-4 md:px-5 h-14 bg-card border-b border-border sticky top-0 z-50 shadow-sm"
      role="banner"
    >
      {/* Left side - Logo */}
      <div className="flex items-center gap-3">
        {/* Logo / Brand */}
        <Link
          to="/"
          className="flex items-center gap-2 text-lg font-semibold hover:opacity-80 transition-opacity"
        >
          <CCWLogo size={24} />
          <span className="hidden sm:inline text-primary">{formatMessage({ id: 'navigation.header.brand' })}</span>
          <span className="sm:hidden text-primary">{formatMessage({ id: 'navigation.header.brandShort' })}</span>
        </Link>

        {/* A2UI Quick Action Button */}
        <A2UIButton />
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-2">
        {/* CLI Monitor button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onCliMonitorClick}
          className="gap-2"
        >
          <Terminal className="h-4 w-4" />
          <span className="hidden sm:inline">CLI Monitor</span>
          {activeCliCount > 0 && (
            <Badge variant="default" className="h-5 px-1.5 text-xs">
              {activeCliCount}
            </Badge>
          )}
        </Button>

        {/* Terminal Panel toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTerminalPanel}
          className="gap-2"
        >
          <SquareTerminal className="h-4 w-4" />
          <span className="hidden sm:inline">{formatMessage({ id: 'home.terminalPanel.title' })}</span>
          {terminalCount > 0 && (
            <Badge variant="default" className="h-5 px-1.5 text-xs">
              {terminalCount}
            </Badge>
          )}
        </Button>

        {/* CLI Viewer page link */}
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="gap-2"
        >
          <Link to="/cli-viewer" className="inline-flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            <span className="hidden sm:inline">{formatMessage({ id: 'navigation.main.cliViewer' })}</span>
          </Link>
        </Button>

        {/* Workspace selector */}
        <WorkspaceSelector />

        {/* Notification badge */}
        <Button
          variant="ghost"
          size="icon"
          onClick={togglePanel}
          aria-label={formatMessage({ id: 'common.aria.notifications' }) || 'Notifications'}
          title={formatMessage({ id: 'common.aria.notifications' }) || 'Notifications'}
          className="relative"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-h-4 min-w-4 px-1 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>

        {/* Refresh button */}
        {onRefresh && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label={formatMessage({ id: 'common.aria.refreshWorkspace' })}
            title={formatMessage({ id: 'common.aria.refreshWorkspace' })}
          >
            <RefreshCw
              className={cn('w-5 h-5', isRefreshing && 'animate-spin')}
            />
          </Button>
        )}

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={isDark
            ? formatMessage({ id: 'common.aria.switchToLightMode' })
            : formatMessage({ id: 'common.aria.switchToDarkMode' })
          }
          title={isDark
            ? formatMessage({ id: 'common.aria.switchToLightMode' })
            : formatMessage({ id: 'common.aria.switchToDarkMode' })
          }
        >
          {isDark ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </Button>

        {/* User menu dropdown - simplified version */}
        <div className="relative group">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label={formatMessage({ id: 'common.aria.userMenu' })}
            title={formatMessage({ id: 'common.aria.userMenu' })}
          >
            <User className="w-5 h-5" />
          </Button>

          {/* Dropdown menu */}
          <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
            <div className="py-1">
              <Link
                to="/settings"
                className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-hover transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span>{formatMessage({ id: 'navigation.header.settings' })}</span>
              </Link>
              <hr className="my-1 border-border" />
              <button
                className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-hover hover:text-foreground transition-colors w-full text-left"
                onClick={() => {
                  // Placeholder for logout action
                  console.log('Logout clicked');
                }}
              >
                <LogOut className="w-4 h-4" />
                <span>{formatMessage({ id: 'navigation.header.logout' })}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-accent" aria-hidden="true" />
    </header>
  );
}

export default Header;
