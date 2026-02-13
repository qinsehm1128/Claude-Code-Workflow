// ========================================
// LiteTaskDetailPage Component
// ========================================
// Lite task detail page with multi-tab task view supporting:
// - Lite-Plan/Lite-Fix: Tasks, Plan, Diagnoses, Context, Summary tabs
// - Multi-CLI: Tasks, Discussion, Context, Summary tabs
// - Context Package parsing with collapsible sections
// - Exploration packages with multiple analysis angles
// - Flowchart visualization for implementation steps

import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useIntl } from 'react-intl';
import {
  ArrowLeft,
  FileEdit,
  Wrench,
  XCircle,
  CheckCircle,
  Code,
  Zap,
  ListTodo,
  Package,
  FileCode,
  Settings,
  BookOpen,
  Search,
  Folder,
  MessageSquare,
  FileText,
  ChevronRight,
  Ruler,
  Stethoscope,
} from 'lucide-react';
import { useLiteTaskSession } from '@/hooks/useLiteTasks';
import { Flowchart } from '@/components/shared/Flowchart';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { TabsNavigation } from '@/components/ui/TabsNavigation';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/Collapsible';

// ========================================
// Type Definitions
// ========================================

type SessionType = 'lite-plan' | 'lite-fix' | 'multi-cli-plan';

type LitePlanTab = 'tasks' | 'plan' | 'diagnoses' | 'context' | 'summary';
type MultiCliTab = 'tasks' | 'discussion' | 'context';

type TaskTabValue = 'task' | 'context';

// Exploration Structure
interface Exploration {
  name: string;
  path: string;
  content?: string;
}

// ========================================
// Main Component
// ========================================

/**
 * LiteTaskDetailPage component - Display single lite task session with multi-tab view
 * Supports:
 * - Lite-Plan/Lite-Fix: Tasks, Plan, Diagnoses, Context, Summary tabs
 * - Multi-CLI: Tasks, Discussion, Context, Summary tabs
 * - Context Package parsing with collapsible sections
 * - Exploration packages with multiple analysis angles
 * - Flowchart visualization for implementation steps
 */
export function LiteTaskDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { formatMessage } = useIntl();

  // Session type state
  const [sessionType, setSessionType] = React.useState<SessionType>('lite-plan');

  // Fetch session data
  const { session, isLoading, error, refetch } = useLiteTaskSession(sessionId, sessionType);

  // Tab states
  const [litePlanActiveTab, setLitePlanActiveTab] = React.useState<LitePlanTab>('tasks');
  const [multiCliActiveTab, setMultiCliActiveTab] = React.useState<MultiCliTab>('tasks');
  const [activeTaskTabs, setActiveTaskTabs] = React.useState<Record<string, TaskTabValue>>({});

  // Detect session type from data
  React.useEffect(() => {
    if (session?.type) {
      setSessionType(session.type);
    }
  }, [session]);

  const handleBack = () => {
    navigate('/lite-tasks');
  };

  const handleTaskTabChange = (taskId: string, tab: TaskTabValue) => {
    setActiveTaskTabs(prev => ({ ...prev, [taskId]: tab }));
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" disabled>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'common.actions.back' })}
          </Button>
          <div className="h-8 w-64 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
        <XCircle className="h-5 w-5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">{formatMessage({ id: 'common.errors.loadFailed' })}</p>
          <p className="text-xs mt-0.5">{error.message}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          {formatMessage({ id: 'common.actions.retry' })}
        </Button>
      </div>
    );
  }

  // Not found state
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <Zap className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {formatMessage({ id: 'liteTasksDetail.notFound.title' })}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {formatMessage({ id: 'liteTasksDetail.notFound.message' })}
        </p>
        <Button onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {formatMessage({ id: 'common.actions.back' })}
        </Button>
      </div>
    );
  }

  const isLitePlan = session.type === 'lite-plan';
  const isLiteFix = session.type === 'lite-fix';
  const isMultiCli = session.type === 'multi-cli-plan';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'common.actions.back' })}
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {session.title || session.id || session.session_id}
            </h1>
            {(session.title || (session.session_id && session.session_id !== session.id)) && (
              <p className="text-sm text-muted-foreground mt-0.5">{session.id || session.session_id}</p>
            )}
          </div>
        </div>
        <Badge variant={isLitePlan ? 'info' : isLiteFix ? 'warning' : 'default'} className="gap-1">
          {isLitePlan ? <FileEdit className="h-3 w-3" /> : isLiteFix ? <Wrench className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
          {formatMessage({ id: isLitePlan ? 'liteTasks.type.plan' : isLiteFix ? 'liteTasks.type.fix' : 'liteTasks.type.multiCli' }) as React.ReactNode}
        </Badge>
      </div>

      {/* Session Type-Specific Tabs */}
      {isMultiCli ? (
        <TabsNavigation
          value={multiCliActiveTab}
          onValueChange={(v) => setMultiCliActiveTab(v as MultiCliTab)}
          tabs={[
            {
              value: 'tasks',
              label: formatMessage({ id: 'liteTasksDetail.tabs.tasks' }),
              icon: <ListTodo className="h-4 w-4" />,
            },
            {
              value: 'discussion',
              label: formatMessage({ id: 'liteTasksDetail.tabs.discussion' }),
              icon: <MessageSquare className="h-4 w-4" />,
            },
            {
              value: 'context',
              label: formatMessage({ id: 'liteTasksDetail.tabs.context' }),
              icon: <Package className="h-4 w-4" />,
            },
            {
              value: 'summary',
              label: formatMessage({ id: 'liteTasksDetail.tabs.summary' }),
              icon: <FileText className="h-4 w-4" />,
            },
          ]}
        />
      ) : (
        <TabsNavigation
          value={litePlanActiveTab}
          onValueChange={(v) => setLitePlanActiveTab(v as LitePlanTab)}
          tabs={[
            {
              value: 'tasks',
              label: formatMessage({ id: 'liteTasksDetail.tabs.tasks' }),
              icon: <ListTodo className="h-4 w-4" />,
            },
            {
              value: 'plan',
              label: formatMessage({ id: 'liteTasksDetail.tabs.plan' }),
              icon: <Ruler className="h-4 w-4" />,
            },
            ...(isLiteFix
              ? [
                  {
                    value: 'diagnoses' as const,
                    label: formatMessage({ id: 'liteTasksDetail.tabs.diagnoses' }),
                    icon: <Stethoscope className="h-4 w-4" />,
                  },
                ]
              : []),
            {
              value: 'context',
              label: formatMessage({ id: 'liteTasksDetail.tabs.context' }),
              icon: <Package className="h-4 w-4" />,
            },
            {
              value: 'summary',
              label: formatMessage({ id: 'liteTasksDetail.tabs.summary' }),
              icon: <FileText className="h-4 w-4" />,
            },
          ]}
        />
      )}

      {/* Task List with Multi-Tab Content */}
      <div className="space-y-4">
        {session.tasks?.map((task, index) => {
          const taskId = task.task_id || task.id || `T${index + 1}`;
          const activeTaskTab = activeTaskTabs[taskId] || 'task';
          const hasFlowchart = task.flow_control?.implementation_approach && task.flow_control.implementation_approach.length > 0;

          return (
            <Card key={taskId} className="overflow-hidden">
              {/* Task Header */}
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Task ID, Title, Description */}
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base font-medium flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-primary/10 text-primary border border-primary/20">{taskId}</span>
                      {task.priority && (
                        <Badge variant="outline" className="text-xs">{task.priority}</Badge>
                      )}
                      {hasFlowchart && (
                        <Badge variant="info" className="gap-1 text-xs">
                          <Code className="h-3 w-3" />
                          Flowchart
                        </Badge>
                      )}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{task.title || 'Untitled Task'}</p>
                    {task.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                    )}
                  </div>

                  {/* Right: Meta Information */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Dependencies - show task IDs */}
                    {task.context?.depends_on && task.context.depends_on.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">→</span>
                        {task.context.depends_on.map((depId, idx) => (
                          <Badge key={idx} variant="outline" className="h-6 px-2 py-0.5 text-xs font-mono border-primary/30 text-primary">
                            {depId}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Target Files Count */}
                    {task.flow_control?.target_files && task.flow_control.target_files.length > 0 && (
                      <Badge variant="secondary" className="h-5 px-1.5 py-0 text-[10px] gap-0.5">
                        <span className="font-semibold">{task.flow_control.target_files.length}</span>
                        <span>file{task.flow_control.target_files.length > 1 ? 's' : ''}</span>
                      </Badge>
                    )}

                    {/* Implementation Steps Count */}
                    {task.flow_control?.implementation_approach && task.flow_control.implementation_approach.length > 0 && (
                      <Badge variant="secondary" className="h-5 px-1.5 py-0 text-[10px] gap-0.5">
                        <span className="font-semibold">{task.flow_control.implementation_approach.length}</span>
                        <span>step{task.flow_control.implementation_approach.length > 1 ? 's' : ''}</span>
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>

              {/* Multi-Tab Content */}
              <div className="w-full">
                <TabsNavigation
                  value={activeTaskTab}
                  onValueChange={(v) => handleTaskTabChange(taskId, v as TaskTabValue)}
                  tabs={[
                    {
                      value: 'task',
                      label: 'Task',
                      icon: <ListTodo className="h-4 w-4" />,
                    },
                    {
                      value: 'context',
                      label: 'Context',
                      icon: <Package className="h-4 w-4" />,
                    },
                  ]}
                />

                {/* Task Tab - Implementation Details */}
                {activeTaskTab === 'task' && (
                  <div className="p-4 space-y-4">
                  {/* Flowchart */}
                  {hasFlowchart && task.flow_control && (
                    <div>
                      <h5 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Code className="h-4 w-4" />
                        Implementation Flow
                      </h5>
                      <Flowchart flowControl={task.flow_control} className="border border-border rounded-lg" />
                    </div>
                  )}

                  {/* Target Files */}
                  {task.flow_control?.target_files && task.flow_control.target_files.length > 0 && (
                    <div>
                      <h5 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                        <FileCode className="h-4 w-4" />
                        Target Files
                      </h5>
                      <div className="space-y-1">
                        {task.flow_control.target_files.map((file, idx) => {
                          const displayPath = typeof file === 'string' ? file : (file.path || file.name || 'Unknown');
                          return (
                            <code key={idx} className="block text-xs bg-muted px-2 py-1 rounded font-mono">
                              {displayPath}
                            </code>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Dependencies */}
                  {task.context?.depends_on && task.context.depends_on.length > 0 && (
                    <div>
                      <h5 className="text-sm font-semibold text-foreground mb-2">Dependencies</h5>
                      <div className="flex flex-wrap gap-1">
                        {task.context.depends_on.map((dep, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">{dep}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  </div>
                )}

                {/* Context Tab - Planning Context */}
                {activeTaskTab === 'context' && (
                  <div className="p-4 space-y-4">
                  {/* Focus Paths */}
                  {task.context?.focus_paths && task.context.focus_paths.length > 0 && (
                    <div>
                      <h5 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                        <Search className="h-4 w-4" />
                        Focus Paths
                      </h5>
                      <div className="flex flex-wrap gap-1">
                        {task.context.focus_paths.map((path, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs font-mono">{path}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Acceptance Criteria */}
                  {task.context?.acceptance && task.context.acceptance.length > 0 && (
                    <div>
                      <h5 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Acceptance Criteria
                      </h5>
                      <ul className="space-y-1">
                        {task.context.acceptance.map((criteria, idx) => (
                          <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                            <span className="text-primary font-bold">{idx + 1}.</span>
                            <span>{criteria}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Tech Stack from Session Metadata */}
                  {!!session.metadata?.tech_stack && (
                    <div>
                      <h5 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Tech Stack
                      </h5>
                      <div className="flex flex-wrap gap-1">
                        {(session.metadata.tech_stack as string[]).map((tech, idx) => (
                          <Badge key={idx} variant="success" className="text-xs">{tech}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Conventions from Session Metadata */}
                  {!!session.metadata?.conventions && (
                    <div>
                      <h5 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        Conventions
                      </h5>
                      <ul className="space-y-1">
                        {(session.metadata.conventions as string[]).map((conv, idx) => (
                          <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                            <span className="text-primary">•</span>
                            <span>{conv}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Session-Level Explorations (if available) */}
      {!!session.metadata?.explorations && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="w-5 h-5" />
              Explorations
              <Badge variant="secondary">{(session.metadata.explorations as Exploration[]).length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(session.metadata.explorations as Exploration[]).map((exp, idx) => (
                <Collapsible key={idx}>
                  <CollapsibleTrigger className="w-full flex items-center gap-2 p-3 bg-background rounded-lg border hover:bg-muted/50 transition-colors">
                    <Folder className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-sm font-medium text-foreground flex-1 text-left truncate">
                      {exp.name}
                    </span>
                    {exp.content && (
                      <Badge variant="outline" className="text-xs flex-shrink-0">
                        Has Content
                      </Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 ml-4">
                    {exp.content ? (
                      <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground whitespace-pre-wrap">
                        {exp.content}
                      </div>
                    ) : (
                      <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                        No content available for this exploration.
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default LiteTaskDetailPage;
