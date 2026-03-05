// ========================================
// RecentSessionsWidget Component
// ========================================
// Widget showing recent sessions across different task types (workflow, lite, orchestrator)

import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntl } from 'react-intl';
import {
  FolderKanban,
  Workflow,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  PauseCircle,
  FileEdit,
  Wrench,
  GitBranch,
  Tag,
  Loader2,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { useSessions } from '@/hooks/useSessions';
import { useLiteTasks } from '@/hooks/useLiteTasks';
import { cn } from '@/lib/utils';

export interface RecentSessionsWidgetProps {
  className?: string;
  maxItems?: number;
}

// Task type definitions
type TaskType = 'all' | 'workflow' | 'lite';

// Unified task item for display
interface UnifiedTaskItem {
  id: string;
  name: string;
  type: TaskType;
  subType?: string;
  status: string;
  statusKey: string; // i18n key for status
  createdAt: string;
  description?: string;
  tags?: string[];
  progress?: number;
}

// Tab configuration for different task types
const TABS: { key: TaskType; label: string; icon: React.ElementType }[] = [
  { key: 'all', label: 'home.tabs.allTasks', icon: FolderKanban },
  { key: 'workflow', label: 'home.tabs.workflow', icon: Workflow },
  { key: 'lite', label: 'home.tabs.liteTasks', icon: Zap },
];

// Status icon mapping
const statusIcons: Record<string, React.ElementType> = {
  in_progress: Loader2,
  running: Loader2,
  planning: FileEdit,
  completed: CheckCircle2,
  failed: XCircle,
  paused: PauseCircle,
  pending: Clock,
  cancelled: XCircle,
  idle: Clock,
  initializing: Loader2,
  ready: CheckCircle2,
};

// Status color mapping
const statusColors: Record<string, string> = {
  in_progress: 'bg-warning/20 text-warning border-warning/30',
  running: 'bg-warning/20 text-warning border-warning/30',
  planning: 'bg-violet-500/20 text-violet-600 border-violet-500/30',
  completed: 'bg-success/20 text-success border-success/30',
  failed: 'bg-destructive/20 text-destructive border-destructive/30',
  paused: 'bg-slate-400/20 text-slate-500 border-slate-400/30',
  pending: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-destructive/20 text-destructive border-destructive/30',
  idle: 'bg-muted text-muted-foreground border-border',
  initializing: 'bg-info/20 text-info border-info/30',
  ready: 'bg-success/20 text-success border-success/30',
};

// Status to i18n key mapping
const statusI18nKeys: Record<string, string> = {
  in_progress: 'inProgress',
  running: 'running',
  planning: 'planning',
  completed: 'completed',
  failed: 'failed',
  paused: 'paused',
  pending: 'pending',
  cancelled: 'cancelled',
  idle: 'idle',
  initializing: 'initializing',
  ready: 'ready',
};

// Lite task sub-type icons
const liteTypeIcons: Record<string, React.ElementType> = {
  'lite-plan': FileEdit,
  'lite-fix': Wrench,
  'multi-cli-plan': GitBranch,
};

// Task type colors
const typeColors: Record<TaskType, string> = {
  all: 'bg-muted text-muted-foreground',
  workflow: 'bg-primary/20 text-primary',
  lite: 'bg-amber-500/20 text-amber-600',
};

function TaskItemCard({ item, onClick }: { item: UnifiedTaskItem; onClick: () => void }) {
  const { formatMessage } = useIntl();
  const StatusIcon = statusIcons[item.status] || Clock;
  const TypeIcon = item.subType ? (liteTypeIcons[item.subType] || Zap) :
    item.type === 'workflow' ? Workflow : Zap;

  const isAnimated = item.status === 'in_progress' || item.status === 'running' || item.status === 'initializing';

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg border border-border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all group"
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <div className={cn('p-1.5 rounded-md shrink-0', typeColors[item.type])}>
          <TypeIcon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          {/* Header: name + status */}
          <div className="flex items-start gap-2 mb-1 min-w-0">
            <h4 className="text-sm font-medium text-foreground truncate flex-1 min-w-0 group-hover:text-primary transition-colors">
              {item.name}
            </h4>
            <Badge className={cn('text-[10px] px-1.5 py-0 shrink-0 border', statusColors[item.status])}>
              <StatusIcon className={cn('h-2.5 w-2.5 mr-0.5', isAnimated && 'animate-spin')} />
              {formatMessage({ id: `common.status.${item.statusKey}` })}
            </Badge>
          </div>

          {/* Description */}
          {item.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">
              {item.description}
            </p>
          )}

          {/* Progress bar (if available) */}
          {typeof item.progress === 'number' && item.progress > 0 && (
            <div className="flex items-center gap-2 mb-1.5">
              <Progress value={item.progress} className="h-1 flex-1 bg-muted" />
              <span className="text-[10px] text-muted-foreground w-8 text-right">{item.progress}%</span>
            </div>
          )}

          {/* Footer: time + tags */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {item.createdAt}
            </span>
            {item.subType && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-background">
                {item.subType}
              </Badge>
            )}
            {item.tags && item.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[9px] px-1 py-0 gap-0.5 bg-background">
                <Tag className="h-2 w-2" />
                {tag}
              </Badge>
            ))}
            {item.tags && item.tags.length > 2 && (
              <span className="text-[9px] text-muted-foreground">+{item.tags.length - 2}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function TaskItemSkeleton() {
  return (
    <div className="p-3 rounded-lg border border-border bg-card animate-pulse">
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-md bg-muted" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-4 bg-muted rounded flex-1" />
            <div className="h-4 w-16 bg-muted rounded" />
          </div>
          <div className="h-3 bg-muted rounded w-3/4 mb-2" />
          <div className="flex gap-2">
            <div className="h-3 w-16 bg-muted rounded" />
            <div className="h-3 w-12 bg-muted rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

function RecentSessionsWidgetComponent({
  className,
  maxItems = 6,
}: RecentSessionsWidgetProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState<TaskType>('all');

  // Fetch workflow sessions
  const { activeSessions, isLoading: sessionsLoading } = useSessions({
    filter: { location: 'active' },
  });

  // Fetch lite tasks
  const { allSessions: liteSessions, isLoading: liteLoading } = useLiteTasks();

  // Format relative time with fallback
  const formatRelativeTime = React.useCallback((dateStr: string | undefined): string => {
    if (!dateStr) return formatMessage({ id: 'common.time.justNow' });

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return formatMessage({ id: 'common.time.justNow' });

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return formatMessage({ id: 'common.time.justNow' });
    if (diffMins < 60) return formatMessage({ id: 'common.time.minutesAgo' }, { count: diffMins });
    if (diffHours < 24) return formatMessage({ id: 'common.time.hoursAgo' }, { count: diffHours });
    return formatMessage({ id: 'common.time.daysAgo' }, { count: diffDays });
  }, [formatMessage]);

  // Convert to unified items
  const unifiedItems = React.useMemo((): UnifiedTaskItem[] => {
    const items: UnifiedTaskItem[] = [];

    // Add workflow sessions
    activeSessions.forEach((session) => {
      const status = session.status || 'pending';
      items.push({
        id: session.session_id,
        name: session.title || session.description || session.session_id,
        type: 'workflow',
        status,
        statusKey: statusI18nKeys[status] || status,
        createdAt: formatRelativeTime(session.created_at),
        description: session.description || `Session: ${session.session_id}`,
        tags: [],
        progress: undefined,
      });
    });

    // Add lite tasks
    liteSessions.forEach((session) => {
      const status = session.status || 'pending';
      const sessionId = session.session_id || session.id;
      items.push({
        id: sessionId,
        name: session.title || sessionId,
        type: 'lite',
        subType: session._type,
        status,
        statusKey: statusI18nKeys[status] || status,
        createdAt: formatRelativeTime(session.createdAt),
        description: session.description || `${session._type} task`,
        tags: [],
        progress: undefined,
      });
    });

    // Sort by most recent (use original date for sorting, not formatted string)
    return items;
  }, [activeSessions, liteSessions, formatRelativeTime]);

  // Filter items by tab
  const filteredItems = React.useMemo(() => {
    if (activeTab === 'all') return unifiedItems.slice(0, maxItems);
    return unifiedItems.filter((item) => item.type === activeTab).slice(0, maxItems);
  }, [unifiedItems, activeTab, maxItems]);

  // Handle item click
  const handleItemClick = (item: UnifiedTaskItem) => {
    switch (item.type) {
      case 'workflow':
        navigate(`/sessions/${item.id}`);
        break;
      case 'lite':
        navigate(`/lite-tasks/${item.subType}/${item.id}`);
        break;
    }
  };

  const handleViewAll = () => {
    navigate('/sessions');
  };

  const isLoading = sessionsLoading || liteLoading;

  return (
    <div className={className}>
      <Card className="h-full p-4 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">
            {formatMessage({ id: 'home.sections.recentTasks' })}
          </h3>
          <Button variant="link" size="sm" className="text-xs h-auto p-0" onClick={handleViewAll}>
            {formatMessage({ id: 'common.actions.viewAll' })}
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
          {TABS.map((tab) => {
            const TabIcon = tab.icon;
            const count = tab.key === 'all' ? unifiedItems.length :
              unifiedItems.filter((i) => i.type === tab.key).length;

            return (
              <Button
                key={tab.key}
                variant={activeTab === tab.key ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'whitespace-nowrap text-xs gap-1 h-7 px-2',
                  activeTab === tab.key && 'bg-primary text-primary-foreground'
                )}
              >
                <TabIcon className="h-3 w-3" />
                {formatMessage({ id: tab.label })}
                <span className="text-[10px] opacity-70">({count})</span>
              </Button>
            );
          })}
        </div>

        {/* Task items */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <TaskItemSkeleton key={i} />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <FolderKanban className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: 'home.emptyState.noTasks.message' })}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {filteredItems.map((item) => (
                <TaskItemCard
                  key={`${item.type}-${item.id}`}
                  item={item}
                  onClick={() => handleItemClick(item)}
                />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export const RecentSessionsWidget = React.memo(RecentSessionsWidgetComponent);

export default RecentSessionsWidget;
