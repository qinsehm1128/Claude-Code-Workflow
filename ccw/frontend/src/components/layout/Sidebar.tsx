// ========================================
// Sidebar Component
// ========================================
// Collapsible navigation sidebar with 5-group accordion structure

import { useCallback, useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  Home,
  FolderKanban,
  Workflow,
  AlertCircle,
  Sparkles,
  Terminal,
  Brain,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  Zap,
  GitFork,
  Shield,
  Server,
  Layers,
  Wrench,
  Cog,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Accordion } from '@/components/ui/Accordion';
import { NavGroup, type NavItem } from '@/components/shared/NavGroup';
import { useAppStore } from '@/stores/appStore';

export interface SidebarProps {
  /** Whether sidebar is collapsed */
  collapsed?: boolean;
  /** Callback when collapse state changes */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Whether sidebar is open on mobile */
  mobileOpen?: boolean;
  /** Callback to close mobile sidebar */
  onMobileClose?: () => void;
}

// Navigation group definitions
interface NavGroupDef {
  id: string;
  titleKey: string;
  icon?: React.ElementType;
  items: Array<{
    path: string;
    labelKey: string;
    icon: React.ElementType;
    badge?: number | string;
    badgeVariant?: 'default' | 'success' | 'warning' | 'info';
    end?: boolean;
  }>;
}

// Define the 5 navigation groups with their items
const navGroupDefinitions: NavGroupDef[] = [
  {
    id: 'overview',
    titleKey: 'navigation.groups.overview',
    icon: Layers,
    items: [
      { path: '/', labelKey: 'navigation.main.home', icon: Home },
      { path: '/project', labelKey: 'navigation.main.project', icon: LayoutDashboard },
    ],
  },
  {
    id: 'workflow',
    titleKey: 'navigation.groups.workflow',
    icon: Workflow,
    items: [
      { path: '/sessions', labelKey: 'navigation.main.sessions', icon: FolderKanban },
      { path: '/lite-tasks', labelKey: 'navigation.main.liteTasks', icon: Zap },
      { path: '/issues', labelKey: 'navigation.main.issues', icon: AlertCircle },
      { path: '/teams', labelKey: 'navigation.main.teams', icon: Users },
      { path: '/terminal-dashboard', labelKey: 'navigation.main.terminalDashboard', icon: Terminal },
    ],
  },
  {
    id: 'knowledge',
    titleKey: 'navigation.groups.knowledge',
    icon: Brain,
    items: [
      { path: '/memory', labelKey: 'navigation.main.memory', icon: Brain },
      { path: '/skills', labelKey: 'navigation.main.skills', icon: Sparkles },
      { path: '/commands', labelKey: 'navigation.main.commands', icon: Terminal },
      { path: '/settings/rules', labelKey: 'navigation.main.rules', icon: Shield },
    ],
  },
  {
    id: 'tools',
    titleKey: 'navigation.groups.tools',
    icon: Wrench,
    items: [
      { path: '/hooks', labelKey: 'navigation.main.hooks', icon: GitFork },
      { path: '/settings/mcp', labelKey: 'navigation.main.mcp', icon: Server },
    ],
  },
  {
    id: 'configuration',
    titleKey: 'navigation.groups.configuration',
    icon: Cog,
    items: [
      { path: '/settings/codexlens', labelKey: 'navigation.main.codexlens', icon: Sparkles },
      { path: '/api-settings', labelKey: 'navigation.main.apiSettings', icon: Server },
      { path: '/settings', labelKey: 'navigation.main.settings', icon: Settings, end: true },
    ],
  },
];

export function Sidebar({
  collapsed = false,
  onCollapsedChange,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const { formatMessage } = useIntl();
  const { sidebarCollapsed, expandedNavGroups, setExpandedNavGroups } = useAppStore();

  const isCollapsed = onCollapsedChange ? collapsed : sidebarCollapsed;

  const handleToggleCollapse = useCallback(() => {
    if (onCollapsedChange) {
      onCollapsedChange(!collapsed);
    } else {
      useAppStore.getState().setSidebarCollapsed(!sidebarCollapsed);
    }
  }, [collapsed, sidebarCollapsed, onCollapsedChange]);

  const handleNavClick = useCallback(() => {
    // Close mobile sidebar when navigating
    if (onMobileClose) {
      onMobileClose();
    }
  }, [onMobileClose]);

  const handleAccordionChange = useCallback((value: string[]) => {
    setExpandedNavGroups(value);
  }, [setExpandedNavGroups]);

  // Build nav groups with translated labels
  const navGroups = useMemo(() => {
    return navGroupDefinitions.map((group) => ({
      ...group,
      items: group.items.map((item) => ({
        ...item,
        label: formatMessage({ id: item.labelKey }),
      })) as NavItem[],
    }));
  }, [formatMessage]);

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'bg-sidebar-background border-r border-border flex flex-col transition-all duration-300',
          // Desktop styles - fixed position for floating behavior
          'hidden md:flex fixed left-0 top-14 h-[calc(100vh-56px)] z-40',
          isCollapsed ? 'w-16' : 'w-64',
          // Mobile styles
          mobileOpen && 'flex z-50 w-64 shadow-lg'
        )}
        role="navigation"
        aria-label={formatMessage({ id: 'navigation.header.brand' })}
      >
        <nav className="flex-1 py-3 overflow-y-auto">
          {isCollapsed ? (
            // Collapsed view: render flat list of icons
            <div className="space-y-4 px-2">
              {navGroups.map((group) => (
                <NavGroup
                  key={group.id}
                  groupId={group.id}
                  titleKey={group.titleKey}
                  icon={group.icon}
                  items={group.items}
                  collapsed={true}
                  onNavClick={handleNavClick}
                />
              ))}
            </div>
          ) : (
            // Expanded view: render accordion groups
            <Accordion
              type="multiple"
              value={expandedNavGroups}
              onValueChange={handleAccordionChange}
              className="space-y-1 px-2"
            >
              {navGroups.map((group) => (
                <NavGroup
                  key={group.id}
                  groupId={group.id}
                  titleKey={group.titleKey}
                  icon={group.icon}
                  items={group.items}
                  collapsed={false}
                  onNavClick={handleNavClick}
                />
              ))}
            </Accordion>
          )}
        </nav>

        {/* Sidebar footer - collapse toggle */}
        <div className="p-3 border-t border-border hidden md:block">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleCollapse}
            className={cn(
              'w-full flex items-center gap-2 text-muted-foreground hover:text-foreground',
              isCollapsed && 'justify-center'
            )}
            aria-label={isCollapsed
              ? formatMessage({ id: 'navigation.sidebar.expand' })
              : formatMessage({ id: 'navigation.sidebar.collapseAria' })
            }
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4" />
                <span>{formatMessage({ id: 'navigation.sidebar.collapse' })}</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
