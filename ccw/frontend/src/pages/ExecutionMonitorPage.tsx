// ========================================
// Execution Monitor Page
// ========================================
// Dashboard for execution monitoring with real-time status, statistics, and history

import { useState, useMemo } from 'react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  BarChart3,
  Calendar,
  ListTree,
  History,
  List,
  Monitor,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { TabsNavigation } from '@/components/ui/TabsNavigation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ExecutionMonitor } from './orchestrator/ExecutionMonitor';
import { useExecutionStore } from '@/stores/executionStore';
import type { ExecutionStatus } from '@/types/execution';

// Mock data - will be replaced with real API calls
const mockExecutionHistory = [
  {
    execId: 'exec-001',
    flowId: 'flow-1',
    flowName: 'Data Processing Pipeline',
    status: 'completed' as ExecutionStatus,
    startedAt: '2026-01-31T10:00:00Z',
    completedAt: '2026-01-31T10:05:30Z',
    duration: 330000,
    nodesTotal: 5,
    nodesCompleted: 5,
  },
  {
    execId: 'exec-002',
    flowId: 'flow-2',
    flowName: 'Email Notification Flow',
    status: 'failed' as ExecutionStatus,
    startedAt: '2026-01-31T09:30:00Z',
    completedAt: '2026-01-31T09:32:15Z',
    duration: 135000,
    nodesTotal: 3,
    nodesCompleted: 2,
  },
  {
    execId: 'exec-003',
    flowId: 'flow-1',
    flowName: 'Data Processing Pipeline',
    status: 'completed' as ExecutionStatus,
    startedAt: '2026-01-31T08:00:00Z',
    completedAt: '2026-01-31T08:04:45Z',
    duration: 285000,
    nodesTotal: 5,
    nodesCompleted: 5,
  },
];

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ExecutionMonitorPage() {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const currentExecution = useExecutionStore((state) => state.currentExecution);
  const [selectedView, setSelectedView] = useState<'workflow' | 'timeline' | 'list'>('workflow');

  const handleOpenCliViewer = () => {
    navigate('/cli-viewer');
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const total = mockExecutionHistory.length;
    const completed = mockExecutionHistory.filter((e) => e.status === 'completed').length;
    const failed = mockExecutionHistory.filter((e) => e.status === 'failed').length;
    const successRate = total > 0 ? (completed / total) * 100 : 0;
    const avgDuration =
      total > 0
        ? mockExecutionHistory.reduce((sum, e) => sum + e.duration, 0) / total
        : 0;

    return {
      total,
      completed,
      failed,
      successRate,
      avgDuration,
    };
  }, []);

  // Group by workflow
  const workflowGroups = useMemo(() => {
    const groups = new Map<string, typeof mockExecutionHistory>();
    mockExecutionHistory.forEach((exec) => {
      const existing = groups.get(exec.flowId) || [];
      groups.set(exec.flowId, [...existing, exec]);
    });
    return Array.from(groups.entries()).map(([flowId, executions]) => ({
      flowId,
      flowName: executions[0].flowName,
      executions,
    }));
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Activity className="w-6 h-6" />
            {formatMessage({ id: 'executionMonitor.page.title' })}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'executionMonitor.page.subtitle' })}
          </p>
        </div>
        <Button onClick={handleOpenCliViewer} className="gap-2">
          <Monitor className="w-4 h-4" />
          {formatMessage({ id: 'executionMonitor.actions.openCliViewer' })}
        </Button>
      </div>

      {/* Current Execution Area */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {formatMessage({ id: 'executionMonitor.currentExecution.title' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentExecution ? (
            <ExecutionMonitor />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {formatMessage({ id: 'executionMonitor.currentExecution.noExecution' })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistics Overview */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          {formatMessage({ id: 'executionMonitor.stats.title' })}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {formatMessage({ id: 'executionMonitor.stats.totalExecutions' })}
                  </p>
                  <p className="text-3xl font-bold text-foreground mt-1">{stats.total}</p>
                </div>
                <BarChart3 className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {formatMessage({ id: 'executionMonitor.stats.successRate' })}
                  </p>
                  <p className="text-3xl font-bold text-green-600 mt-1">
                    {stats.successRate.toFixed(1)}%
                  </p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {formatMessage({ id: 'executionMonitor.stats.avgDuration' })}
                  </p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {formatDuration(stats.avgDuration)}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {formatMessage({ id: 'executionMonitor.execution.status.failed' })}
                  </p>
                  <p className="text-3xl font-bold text-red-600 mt-1">{stats.failed}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Execution History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {formatMessage({ id: 'executionMonitor.history.title' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TabsNavigation
            value={selectedView}
            onValueChange={(v) => setSelectedView(v as typeof selectedView)}
            tabs={[
              {
                value: 'workflow',
                label: formatMessage({ id: 'executionMonitor.history.tabs.byWorkflow' }),
                icon: <ListTree className="w-4 h-4" />,
              },
              {
                value: 'timeline',
                label: formatMessage({ id: 'executionMonitor.history.tabs.timeline' }),
                icon: <History className="w-4 h-4" />,
              },
              {
                value: 'list',
                label: formatMessage({ id: 'executionMonitor.history.tabs.list' }),
                icon: <List className="w-4 h-4" />,
              },
            ]}
          />

          {/* By Workflow View */}
          {selectedView === 'workflow' && (
            <div className="mt-4">
              {workflowGroups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {formatMessage({ id: 'executionMonitor.history.empty' })}
                </div>
              ) : (
                <div className="space-y-4">
                  {workflowGroups.map((group) => (
                    <Card key={group.flowId}>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">{group.flowName}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {group.executions.map((exec) => (
                            <div
                              key={exec.execId}
                              className="flex items-center justify-between p-3 bg-background rounded-lg border border-border hover:border-primary/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <Badge
                                  variant={
                                    exec.status === 'completed'
                                      ? 'success'
                                      : exec.status === 'failed'
                                        ? 'destructive'
                                        : 'default'
                                  }
                                >
                                  {formatMessage({ id: `executionMonitor.execution.status.${exec.status}` })}
                                </Badge>
                                <div className="text-sm">
                                  <div className="font-medium text-foreground">{exec.execId}</div>
                                  <div className="text-muted-foreground">
                                    {formatDateTime(exec.startedAt)}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  {formatDuration(exec.duration)}
                                </span>
                                <span>
                                  {exec.nodesCompleted}/{exec.nodesTotal} nodes
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Timeline View */}
          {selectedView === 'timeline' && (
              <div className="space-y-3">
                {mockExecutionHistory.map((exec, index) => (
                  <div key={exec.execId} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          exec.status === 'completed'
                            ? 'bg-green-600'
                            : exec.status === 'failed'
                              ? 'bg-red-600'
                              : 'bg-blue-600'
                        }`}
                      />
                      {index < mockExecutionHistory.length - 1 && (
                        <div className="w-0.5 flex-1 bg-border mt-2" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="font-medium text-foreground">{exec.flowName}</div>
                              <div className="text-sm text-muted-foreground">{exec.execId}</div>
                            </div>
                            <Badge
                              variant={
                                exec.status === 'completed'
                                  ? 'success'
                                  : exec.status === 'failed'
                                    ? 'destructive'
                                    : 'default'
                              }
                            >
                              {formatMessage({ id: `executionMonitor.execution.status.${exec.status}` })}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {formatDateTime(exec.startedAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {formatDuration(exec.duration)}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ))}
              </div>
          )}

          {/* List View */}
          {selectedView === 'list' && (
            <div className="space-y-2">
                {mockExecutionHistory.map((exec) => (
                  <Card key={exec.execId} className="hover:border-primary/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <Badge
                            variant={
                              exec.status === 'completed'
                                ? 'success'
                                : exec.status === 'failed'
                                  ? 'destructive'
                                  : 'default'
                            }
                          >
                            {formatMessage({ id: `executionMonitor.execution.status.${exec.status}` })}
                          </Badge>
                          <div>
                            <div className="font-medium text-foreground">{exec.flowName}</div>
                            <div className="text-sm text-muted-foreground">{exec.execId}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDateTime(exec.startedAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatDuration(exec.duration)}
                          </span>
                          <span>
                            {exec.nodesCompleted}/{exec.nodesTotal} nodes
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ExecutionMonitorPage;
