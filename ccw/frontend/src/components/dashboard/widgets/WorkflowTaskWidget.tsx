// ========================================
// WorkflowTaskWidget Component
// ========================================
// Combined dashboard widget: project info + stats + workflow status + orchestrator + task carousel

import { memo, useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntl } from 'react-intl';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';
import { Button } from '@/components/ui/Button';
import { Sparkline } from '@/components/charts/Sparkline';
import { useWorkflowStatusCounts } from '@/hooks/useWorkflowStatusCounts';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useProjectOverview } from '@/hooks/useProjectOverview';
import { useIndexStatus } from '@/hooks/useIndex';
import { useSessions } from '@/hooks/useSessions';
import { cn } from '@/lib/utils';
import type { TaskData } from '@/types/store';
import {
  ListChecks,
  Clock,
  FolderKanban,
  CheckCircle2,
  XCircle,
  Activity,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Calendar,
  Code2,
  Server,
  Layers,
  GitBranch,
  Wrench,
  FileCode,
  Bug,
  Sparkles,
  BarChart3,
  PieChart as PieChartIcon,
  Database,
} from 'lucide-react';

export interface WorkflowTaskWidgetProps {
  className?: string;
}

// ---- Workflow Status section ----
// Unified color configuration for workflow status
const statusColors: Record<string, { bg: string; text: string; dot: string; fill: string }> = {
  completed: { bg: 'bg-success', text: 'text-success', dot: 'bg-emerald-500', fill: '#10b981' },
  in_progress: { bg: 'bg-warning', text: 'text-warning', dot: 'bg-amber-500', fill: '#f59e0b' },
  planning: { bg: 'bg-violet-500', text: 'text-violet-600', dot: 'bg-violet-500', fill: '#8b5cf6' },
  paused: { bg: 'bg-slate-400', text: 'text-slate-500', dot: 'bg-slate-400', fill: '#94a3b8' },
  archived: { bg: 'bg-slate-300', text: 'text-slate-400', dot: 'bg-slate-300', fill: '#cbd5e1' },
};

const statusLabelKeys: Record<string, string> = {
  completed: 'sessions.status.completed',
  in_progress: 'sessions.status.inProgress',
  planning: 'sessions.status.planning',
  paused: 'sessions.status.paused',
  archived: 'sessions.status.archived',
};

// ---- Task List section ----
// Task status colors for the task list display
type TaskStatusDisplay = 'pending' | 'completed' | 'in_progress' | 'blocked' | 'skipped';

const taskStatusColors: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  pending: { bg: 'bg-muted', text: 'text-muted-foreground', icon: Clock },
  completed: { bg: 'bg-success/20', text: 'text-success', icon: CheckCircle2 },
  in_progress: { bg: 'bg-warning/20', text: 'text-warning', icon: Clock },
  blocked: { bg: 'bg-destructive/20', text: 'text-destructive', icon: XCircle },
  skipped: { bg: 'bg-slate-400/20', text: 'text-slate-500', icon: Clock },
};

// ---- Empty State Component ----
interface HomeEmptyStateProps {
  className?: string;
}

function HomeEmptyState({ className }: HomeEmptyStateProps) {
  const { formatMessage } = useIntl();

  return (
    <div className={cn('flex items-center justify-center h-full', className)}>
      <Card className="max-w-sm w-full border-dashed">
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <ListChecks className="w-7 h-7 text-muted-foreground" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-base font-semibold">
              {formatMessage({ id: 'home.emptyState.noSessions.title' })}
            </h3>
            <p className="text-sm text-muted-foreground">
              {formatMessage({ id: 'home.emptyState.noSessions.message' })}
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full">
            <code className="px-3 py-2 bg-muted rounded text-xs font-mono text-center">
              /workflow:plan
            </code>
            <p className="text-xs text-muted-foreground text-center">
              {formatMessage({ id: 'home.emptyState.noSessions.hint' })}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const sessionStatusColors: Record<string, { bg: string; text: string }> = {
  planning: { bg: 'bg-violet-500/20', text: 'text-violet-600' },
  in_progress: { bg: 'bg-warning/20', text: 'text-warning' },
  completed: { bg: 'bg-success/20', text: 'text-success' },
  paused: { bg: 'bg-slate-400/20', text: 'text-slate-500' },
};

// ---- Mini Stat Card with Sparkline ----
interface MiniStatCardProps {
  icon: React.ElementType;
  title: string;
  value: number;
  variant: 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'default';
  sparklineData?: number[];
}

const variantStyles: Record<string, { card: string; icon: string }> = {
  primary: { card: 'border-primary/30 bg-primary/5', icon: 'bg-primary/10 text-primary' },
  info: { card: 'border-info/30 bg-info/5', icon: 'bg-info/10 text-info' },
  success: { card: 'border-success/30 bg-success/5', icon: 'bg-success/10 text-success' },
  warning: { card: 'border-warning/30 bg-warning/5', icon: 'bg-warning/10 text-warning' },
  danger: { card: 'border-destructive/30 bg-destructive/5', icon: 'bg-destructive/10 text-destructive' },
  default: { card: 'border-border', icon: 'bg-muted text-muted-foreground' },
};

function MiniStatCard({ icon: Icon, title, value, variant, sparklineData }: MiniStatCardProps) {
  const styles = variantStyles[variant] || variantStyles.default;

  return (
    <div className={cn('rounded-lg border p-3 transition-all hover:shadow-sm h-full flex flex-col', styles.card)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground truncate">{title}</p>
          <p className="text-xl font-bold text-card-foreground mt-1">{value.toLocaleString()}</p>
        </div>
        <div className={cn('flex h-7 w-7 items-center justify-center rounded-md shrink-0', styles.icon)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {sparklineData && sparklineData.length > 0 && (
        <div className="mt-auto pt-2 -mx-1">
          <Sparkline data={sparklineData} height={28} strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}

// Generate sparkline data
function generateSparklineData(currentValue: number, variance = 0.3): number[] {
  const days = 7;
  const data: number[] = [];
  let value = Math.max(0, currentValue * (1 - variance));

  for (let i = 0; i < days - 1; i++) {
    data.push(Math.round(value));
    const change = (Math.random() - 0.5) * 2 * variance * currentValue;
    value = Math.max(0, value + change);
  }
  data.push(currentValue);
  return data;
}

function WorkflowTaskWidgetComponent({ className }: WorkflowTaskWidgetProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const { data, isLoading } = useWorkflowStatusCounts();
  const { stats, isLoading: statsLoading } = useDashboardStats({ refetchInterval: 60000 });
  const { projectOverview, isLoading: projectLoading } = useProjectOverview();
  const { status: indexStatus } = useIndexStatus({ refetchInterval: 30000 });

  // Fetch real sessions data
  const { activeSessions, isLoading: sessionsLoading } = useSessions({
    filter: { location: 'active' },
  });

  const chartData = data || [];
  const total = chartData.reduce((sum, item) => sum + item.count, 0);
  const hasChartData = chartData.length > 0;

  // Generate sparkline data for each stat
  const sparklines = useMemo(() => ({
    activeSessions: generateSparklineData(stats?.activeSessions ?? 0, 0.4),
    totalTasks: generateSparklineData(stats?.totalTasks ?? 0, 0.3),
    completedTasks: generateSparklineData(stats?.completedTasks ?? 0, 0.25),
    pendingTasks: generateSparklineData(stats?.pendingTasks ?? 0, 0.35),
    failedTasks: generateSparklineData(stats?.failedTasks ?? 0, 0.5),
    todayActivity: generateSparklineData(stats?.todayActivity ?? 0, 0.6),
  }), [stats]);

  // Project info expanded state
  const [projectExpanded, setProjectExpanded] = useState(false);

  // Session carousel state - use real sessions
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0);
  const sessionsCount = activeSessions.length;
  const currentSession = activeSessions[currentSessionIndex];

  // Format relative time
  const formatRelativeTime = useCallback((dateStr: string | undefined): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString();
  }, []);

  // Auto-rotate carousel every 5 seconds (only if more than one session)
  useEffect(() => {
    if (sessionsCount <= 1) return;
    const timer = setInterval(() => {
      setCurrentSessionIndex((prev) => (prev + 1) % sessionsCount);
    }, 5000);
    return () => clearInterval(timer);
  }, [sessionsCount]);

  // Manual navigation
  const handlePrevSession = () => {
    setCurrentSessionIndex((prev) => (prev === 0 ? sessionsCount - 1 : prev - 1));
  };
  const handleNextSession = () => {
    setCurrentSessionIndex((prev) => (prev + 1) % sessionsCount);
  };

  // Navigate to session detail
  const handleSessionClick = (sessionId: string) => {
    navigate(`/sessions/${sessionId}`);
  };

  // Map task status to display status
  const mapTaskStatus = (status: TaskData['status']): TaskStatusDisplay => {
    if (status === 'in_progress') return 'in_progress';
    if (status === 'blocked') return 'blocked';
    if (status === 'skipped') return 'skipped';
    return status;
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Project Info Banner - Separate Card */}
      <Card className="shrink-0 border-gradient-brand">
        {projectLoading ? (
          <div className="px-4 py-3 flex items-center gap-4">
            <div className="h-5 w-32 bg-muted rounded animate-pulse" />
            <div className="h-4 w-48 bg-muted rounded animate-pulse" />
          </div>
        ) : (
          <>
            {/* Collapsed Header */}
            <div className="px-5 py-4 flex items-center gap-6 flex-wrap">
              {/* Project Name & Icon */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-md bg-primary/10">
                  <Code2 className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-foreground truncate">
                    {projectOverview?.projectName || 'Claude Code Workflow'}
                  </h2>
                  <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                    {projectOverview?.description || 'AI-powered workflow management system'}
                  </p>
                </div>
              </div>

              {/* Divider */}
              <div className="h-10 w-px bg-border hidden md:block" />

              {/* Tech Stack Badges */}
              <div className="flex items-center gap-2.5 text-xs">
                <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-blue-500/10 text-blue-600 font-medium">
                  <Code2 className="h-3.5 w-3.5" />
                  {projectOverview?.technologyStack?.languages?.[0]?.name || 'TypeScript'}
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-green-500/10 text-green-600 font-medium">
                  <Server className="h-3.5 w-3.5" />
                  {projectOverview?.technologyStack?.frameworks?.[0] || 'Node.js'}
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-violet-500/10 text-violet-600 font-medium">
                  <Layers className="h-3.5 w-3.5" />
                  {projectOverview?.architecture?.style || 'Modular Monolith'}
                </span>
                {projectOverview?.technologyStack?.build_tools?.[0] && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-orange-500/10 text-orange-600 font-medium">
                    <Wrench className="h-3.5 w-3.5" />
                    {projectOverview.technologyStack.build_tools[0]}
                  </span>
                )}
              </div>

              {/* Divider */}
              <div className="h-10 w-px bg-border hidden lg:block" />

              {/* Quick Stats */}
              <div className="flex items-center gap-5 text-xs">
                <div className="flex items-center gap-2 text-emerald-600">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="font-semibold">{projectOverview?.developmentIndex?.feature?.length || 0}</span>
                  <span className="text-muted-foreground">{formatMessage({ id: 'projectOverview.devIndex.category.features' })}</span>
                </div>
                <div className="flex items-center gap-2 text-amber-600">
                  <Bug className="h-3.5 w-3.5" />
                  <span className="font-semibold">{projectOverview?.developmentIndex?.bugfix?.length || 0}</span>
                  <span className="text-muted-foreground">{formatMessage({ id: 'projectOverview.devIndex.category.bugfixes' })}</span>
                </div>
                <div className="flex items-center gap-2 text-blue-600">
                  <FileCode className="h-3.5 w-3.5" />
                  <span className="font-semibold">{projectOverview?.developmentIndex?.enhancement?.length || 0}</span>
                  <span className="text-muted-foreground">{formatMessage({ id: 'projectOverview.devIndex.category.enhancements' })}</span>
                </div>

                {/* Index Status Indicator */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Database className={cn(
                      "h-3.5 w-3.5",
                      indexStatus?.status === 'building' && "text-blue-600 animate-pulse",
                      indexStatus?.status === 'completed' && "text-emerald-600",
                      indexStatus?.status === 'idle' && "text-slate-500",
                      indexStatus?.status === 'failed' && "text-red-600"
                    )} />
                    {indexStatus?.status === 'building' && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                      </span>
                    )}
                  </div>
                  <span className={cn(
                    "font-semibold",
                    indexStatus?.status === 'building' && "text-blue-600",
                    indexStatus?.status === 'completed' && "text-emerald-600",
                    indexStatus?.status === 'idle' && "text-slate-500",
                    indexStatus?.status === 'failed' && "text-red-600"
                  )}>
                    {indexStatus?.totalFiles || 0}
                  </span>
                  <span className="text-muted-foreground">{formatMessage({ id: 'home.indexStatus.label' })}</span>
                </div>
              </div>

              {/* Date + Expand Button */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground ml-auto">
                <span className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/50">
                  <Calendar className="h-3.5 w-3.5" />
                  {projectOverview?.initializedAt ? new Date(projectOverview.initializedAt).toLocaleDateString() : new Date().toLocaleDateString()}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 hover:bg-muted"
                  onClick={() => setProjectExpanded(!projectExpanded)}
                >
                  {projectExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Expanded Details */}
            {projectExpanded && (
              <div className="px-5 pb-4 grid grid-cols-4 gap-6 border-t border-border/50 pt-4">
                {/* Architecture */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-primary" />
                    {formatMessage({ id: 'projectOverview.architecture.title' })}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{projectOverview?.architecture?.style || 'Modular Monolith'}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatMessage({ id: 'projectOverview.architecture.layers' })}:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {(projectOverview?.architecture?.layers || ['CLI Tools', 'Core Services', 'Dashboard UI', 'Data Layer']).slice(0, 5).map((layer, i) => (
                        <span key={i} className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground font-medium">{layer}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Key Components */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Wrench className="h-4 w-4 text-orange-500" />
                    {formatMessage({ id: 'projectOverview.components.title' })}
                  </h4>
                  <div className="space-y-1.5">
                    {(projectOverview?.keyComponents || [
                      { name: 'Session Manager', description: 'Workflow session lifecycle' },
                      { name: 'Dashboard Generator', description: 'Dynamic widget rendering' },
                      { name: 'Data Aggregator', description: 'Stats and metrics collection' },
                      { name: 'Task Scheduler', description: 'Async task orchestration' },
                    ]).slice(0, 4).map((comp, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{comp.name}</p>
                          {comp.description && (
                            <p className="text-[11px] text-muted-foreground truncate">{comp.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Development History */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <FileCode className="h-4 w-4 text-blue-500" />
                    {formatMessage({ id: 'projectOverview.devIndex.title' })}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-emerald-500/10">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-600">{projectOverview?.developmentIndex?.feature?.length || 10}</p>
                        <p className="text-[10px] text-emerald-600/80">{formatMessage({ id: 'projectOverview.devIndex.category.features' })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-blue-500/10">
                      <FileCode className="h-3.5 w-3.5 text-blue-600" />
                      <div>
                        <p className="text-sm font-semibold text-blue-600">{projectOverview?.developmentIndex?.enhancement?.length || 5}</p>
                        <p className="text-[10px] text-blue-600/80">{formatMessage({ id: 'projectOverview.devIndex.category.enhancements' })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-amber-500/10">
                      <Bug className="h-3.5 w-3.5 text-amber-600" />
                      <div>
                        <p className="text-sm font-semibold text-amber-600">{projectOverview?.developmentIndex?.bugfix?.length || 3}</p>
                        <p className="text-[10px] text-amber-600/80">{formatMessage({ id: 'projectOverview.devIndex.category.bugfixes' })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-violet-500/10">
                      <Wrench className="h-3.5 w-3.5 text-violet-600" />
                      <div>
                        <p className="text-sm font-semibold text-violet-600">{projectOverview?.developmentIndex?.refactor?.length || 2}</p>
                        <p className="text-[10px] text-violet-600/80">{formatMessage({ id: 'projectOverview.devIndex.category.refactorings' })}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Design Patterns */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <GitBranch className="h-4 w-4 text-violet-500" />
                    {formatMessage({ id: 'projectOverview.architecture.patterns' })}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(projectOverview?.architecture?.patterns || ['Factory', 'Strategy', 'Observer', 'Singleton', 'Decorator']).slice(0, 6).map((pattern, i) => (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-md bg-primary/10 text-primary font-medium">{pattern}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Main content Card: Stats | Workflow+Orchestrator | Task Details */}
      <Card className="h-[400px] flex shrink-0 overflow-hidden">
        {/* Compact Stats Section with Sparklines */}
        <div className="w-[28%] p-3 flex flex-col border-r border-border">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" />
            {formatMessage({ id: 'home.sections.statistics' })}
          </h3>

          {statsLoading ? (
            <div className="grid grid-cols-2 grid-rows-3 gap-2.5 flex-1">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 grid-rows-3 gap-2.5 flex-1">
              <MiniStatCard
                icon={FolderKanban}
                title={formatMessage({ id: 'home.stats.activeSessions' })}
                value={stats?.activeSessions ?? 0}
                variant="primary"
                sparklineData={sparklines.activeSessions}
              />
              <MiniStatCard
                icon={ListChecks}
                title={formatMessage({ id: 'home.stats.totalTasks' })}
                value={stats?.totalTasks ?? 0}
                variant="info"
                sparklineData={sparklines.totalTasks}
              />
              <MiniStatCard
                icon={CheckCircle2}
                title={formatMessage({ id: 'home.stats.completedTasks' })}
                value={stats?.completedTasks ?? 0}
                variant="success"
                sparklineData={sparklines.completedTasks}
              />
              <MiniStatCard
                icon={Clock}
                title={formatMessage({ id: 'home.stats.pendingTasks' })}
                value={stats?.pendingTasks ?? 0}
                variant="warning"
                sparklineData={sparklines.pendingTasks}
              />
              <MiniStatCard
                icon={XCircle}
                title={formatMessage({ id: 'common.status.failed' })}
                value={stats?.failedTasks ?? 0}
                variant="danger"
                sparklineData={sparklines.failedTasks}
              />
              <MiniStatCard
                icon={Activity}
                title={formatMessage({ id: 'common.stats.todayActivity' })}
                value={stats?.todayActivity ?? 0}
                variant="default"
                sparklineData={sparklines.todayActivity}
              />
            </div>
          )}
        </div>

        {/* Workflow Status Section - Pie Chart */}
        <div className="w-[22%] p-3 flex flex-col border-r border-border">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <PieChartIcon className="h-4 w-4" />
            {formatMessage({ id: 'home.widgets.workflowStatus' })}
          </h3>

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-muted animate-pulse" />
            </div>
          ) : !hasChartData ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <PieChartIcon className="w-12 h-12 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">
                  {formatMessage({ id: 'home.emptyState.noSessions.message' })}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              {/* Mini Donut Chart */}
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius="55%"
                      outerRadius="85%"
                      paddingAngle={2}
                      dataKey="count"
                    >
                      {chartData.map((item) => {
                        const colors = statusColors[item.status] || statusColors.completed;
                        return (
                          <Cell key={item.status} fill={colors.fill} />
                        );
                      })}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Compact Legend */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-3">
                {chartData.map((item) => {
                  const colors = statusColors[item.status] || statusColors.completed;
                  const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
                  return (
                    <div key={item.status} className="flex items-center gap-1.5 min-w-0">
                      <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', colors.dot)} />
                      <span className="text-xs text-muted-foreground truncate">
                        {formatMessage({ id: statusLabelKeys[item.status] ?? 'sessions.status.inProgress' })}
                      </span>
                      <span className="text-xs font-medium text-foreground ml-auto">
                        {percentage}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Task Details Section: Session Carousel with Task List */}
        <div className="flex-1 p-4 flex flex-col">
          {/* Header with navigation */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ListChecks className="h-4 w-4" />
              {formatMessage({ id: 'home.sections.taskDetails' })}
            </h3>
            {sessionsCount > 0 && (
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handlePrevSession} disabled={sessionsCount <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground min-w-[45px] text-center">
                  {currentSessionIndex + 1} / {sessionsCount}
                </span>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleNextSession} disabled={sessionsCount <= 1}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Loading State */}
          {sessionsLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full max-w-sm space-y-3">
                <div className="h-8 bg-muted rounded animate-pulse" />
                <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                <div className="h-20 bg-muted rounded animate-pulse" />
              </div>
            </div>
          ) : sessionsCount === 0 ? (
            /* Empty State */
            <HomeEmptyState />
          ) : currentSession ? (
            /* Session Card (Carousel Item) */
            <div
              className="flex-1 flex flex-col min-h-0 rounded-lg border border-border bg-accent/20 p-3 overflow-hidden cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => handleSessionClick(currentSession.session_id)}
            >
              {/* Session Header */}
              <div className="mb-2 pb-2 border-b border-border shrink-0">
                <div className="flex items-start gap-2">
                  <div className={cn('px-2 py-1 rounded text-xs font-medium shrink-0', sessionStatusColors[currentSession.status]?.bg || 'bg-muted', sessionStatusColors[currentSession.status]?.text || 'text-muted-foreground')}>
                    {formatMessage({ id: `common.status.${currentSession.status === 'in_progress' ? 'inProgress' : currentSession.status}` })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{currentSession.title || currentSession.session_id}</p>
                    <p className="text-xs text-muted-foreground">{currentSession.session_id}</p>
                  </div>
                </div>
                {/* Description */}
                {currentSession.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {currentSession.description}
                  </p>
                )}
                {/* Progress bar */}
                {currentSession.tasks && currentSession.tasks.length > 0 && (
                  <div className="mt-2.5 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {formatMessage({ id: 'common.labels.progress' })}
                      </span>
                      <span className="font-medium text-foreground">
                        {currentSession.tasks.filter(t => t.status === 'completed').length}/{currentSession.tasks.length}
                      </span>
                    </div>
                    <Progress
                      value={currentSession.tasks.length > 0 ? (currentSession.tasks.filter(t => t.status === 'completed').length / currentSession.tasks.length) * 100 : 0}
                      className="h-1.5 bg-muted"
                      indicatorClassName="bg-success"
                    />
                  </div>
                )}
                {/* Date */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
                    <Calendar className="h-3 w-3" />
                    {formatRelativeTime(currentSession.updated_at || currentSession.created_at)}
                  </span>
                </div>
              </div>

              {/* Task List for this Session - Two columns */}
              {currentSession.tasks && currentSession.tasks.length > 0 ? (
                <div className="flex-1 overflow-auto min-h-0">
                  <div className="grid grid-cols-2 gap-2 w-full">
                    {currentSession.tasks.map((task, index) => {
                      const displayStatus = mapTaskStatus(task.status);
                      const config = taskStatusColors[displayStatus] || taskStatusColors.pending;
                      const StatusIcon = config.icon;
                      const isLastOdd = currentSession.tasks!.length % 2 === 1 && index === currentSession.tasks!.length - 1;
                      return (
                        <div
                          key={task.task_id}
                          className={cn(
                            'flex items-center gap-2 p-2 rounded hover:bg-background/50 transition-colors',
                            isLastOdd && 'col-span-2'
                          )}
                        >
                          <div className={cn('p-1 rounded shrink-0', config.bg)}>
                            <StatusIcon className={cn('h-3 w-3', config.text)} />
                          </div>
                          <p className={cn('flex-1 text-xs font-medium truncate', task.status === 'completed' ? 'text-muted-foreground line-through' : 'text-foreground')}>
                            {task.title || task.task_id}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">
                    {formatMessage({ id: 'home.emptyState.noTasks.message' })}
                  </p>
                </div>
              )}
            </div>
          ) : null}

          {/* Carousel dots - only show if more than one session */}
          {sessionsCount > 1 && (
            <div className="flex items-center justify-center gap-1 mt-2">
              {activeSessions.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSessionIndex(idx)}
                  className={cn(
                    'w-1.5 h-1.5 rounded-full transition-colors',
                    idx === currentSessionIndex ? 'bg-primary' : 'bg-muted hover:bg-muted-foreground/50'
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export const WorkflowTaskWidget = memo(WorkflowTaskWidgetComponent);

export default WorkflowTaskWidget;
