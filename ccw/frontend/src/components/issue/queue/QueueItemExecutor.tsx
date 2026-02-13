// ========================================
// QueueItemExecutor
// ========================================
// Unified execution component for queue items with Tab switching
// between Session (direct PTY) and Orchestrator (flow-based) modes.
// Replaces QueueExecuteInSession and QueueSendToOrchestrator.

import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Terminal, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { toast, useExecutionStore, useFlowStore } from '@/stores';
import { useIssues } from '@/hooks';
import {
  executeInCliSession,
  createOrchestratorFlow,
  executeOrchestratorFlow,
  type QueueItem,
} from '@/lib/api';
import { useTerminalPanelStore } from '@/stores/terminalPanelStore';
import { useCliSessionCore } from '@/hooks/useCliSessionCore';
import {
  CliExecutionSettings,
  type ToolName,
  type ExecutionMode,
  type ResumeStrategy,
} from '@/components/shared/CliExecutionSettings';
import { buildQueueItemContext } from '@/lib/queue-prompt';
import { useQueueExecutionStore, type QueueExecution } from '@/stores/queueExecutionStore';
import type { Flow } from '@/types/flow';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExecutionTab = 'session' | 'orchestrator';

export interface QueueItemExecutorProps {
  item: QueueItem;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QueueItemExecutor({ item, className }: QueueItemExecutorProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const projectPath = useWorkflowStore(selectProjectPath);

  // Resolve the parent issue for context building
  const { issues } = useIssues();
  const issue = useMemo(
    () => issues.find((i) => i.id === item.issue_id),
    [issues, item.issue_id]
  );

  // Shared session management via useCliSessionCore
  const {
    sessions,
    selectedSessionKey,
    setSelectedSessionKey,
    refreshSessions,
    ensureSession,
    handleCreateSession,
    isLoading,
    error: sessionError,
  } = useCliSessionCore({ autoSelectLast: true, resumeKey: item.issue_id });

  // Shared execution settings state
  const [tool, setTool] = useState<ToolName>('claude');
  const [mode, setMode] = useState<ExecutionMode>('write');
  const [resumeStrategy, setResumeStrategy] = useState<ResumeStrategy>('nativeResume');

  // Execution state
  const [activeTab, setActiveTab] = useState<ExecutionTab>('session');
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  // Combine errors from session core and local execution
  const displayError = error || sessionError || null;

  // Store reference for recording executions
  const addExecution = useQueueExecutionStore((s) => s.addExecution);

  // ========== Session Execution ==========

  const handleSessionExecute = async () => {
    setIsExecuting(true);
    setError(null);
    setLastResult(null);
    try {
      const sessionKey = await ensureSession();
      const prompt = buildQueueItemContext(item, issue);
      const result = await executeInCliSession(
        sessionKey,
        {
          tool,
          prompt,
          mode,
          workingDir: projectPath,
          category: 'user',
          resumeKey: item.issue_id,
          resumeStrategy,
        },
        projectPath
      );

      // Record to queueExecutionStore
      const execution: QueueExecution = {
        id: result.executionId,
        queueItemId: item.item_id,
        issueId: item.issue_id,
        solutionId: item.solution_id,
        type: 'session',
        sessionKey,
        tool,
        mode,
        status: 'running',
        startedAt: new Date().toISOString(),
      };
      addExecution(execution);

      setLastResult(result.executionId);

      // Open terminal panel to show output
      useTerminalPanelStore.getState().openTerminal(sessionKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsExecuting(false);
    }
  };

  // ========== Orchestrator Execution ==========

  const handleOrchestratorExecute = async () => {
    setIsExecuting(true);
    setError(null);
    setLastResult(null);
    try {
      const sessionKey = await ensureSession();
      const instruction = buildQueueItemContext(item, issue);

      const nodeId = generateId('node');
      const flowName = `Queue ${item.issue_id} / ${item.solution_id}${item.task_id ? ` / ${item.task_id}` : ''}`;
      const flowDescription = `Queue item ${item.item_id} -> Orchestrator`;

      const created = await createOrchestratorFlow(
        {
          name: flowName,
          description: flowDescription,
          version: '1.0.0',
          nodes: [
            {
              id: nodeId,
              type: 'prompt-template',
              position: { x: 100, y: 100 },
              data: {
                label: flowName,
                instruction,
                tool,
                mode,
                delivery: 'sendToSession',
                targetSessionKey: sessionKey,
                resumeKey: item.issue_id,
                resumeStrategy,
                tags: ['queue', item.item_id, item.issue_id, item.solution_id].filter(Boolean),
              },
            },
          ],
          edges: [],
          variables: {},
          metadata: {
            source: 'local',
            tags: ['queue', item.item_id, item.issue_id, item.solution_id].filter(Boolean),
          },
        },
        projectPath || undefined
      );

      if (!created.success) {
        throw new Error('Failed to create flow');
      }

      // Hydrate Orchestrator stores -- convert OrchestratorFlowDto to Flow
      const flowDto = created.data;
      const parsedVersion = parseInt(String(flowDto.version ?? '1'), 10);
      const flowForStore: Flow = {
        ...flowDto,
        version: Number.isFinite(parsedVersion) ? parsedVersion : 1,
      } as Flow;
      useFlowStore.getState().setCurrentFlow(flowForStore);

      // Execute the flow
      const executed = await executeOrchestratorFlow(
        created.data.id,
        {},
        projectPath || undefined
      );
      if (!executed.success) {
        throw new Error('Failed to execute flow');
      }

      const execId = executed.data.execId;
      useExecutionStore.getState().startExecution(execId, created.data.id);
      useExecutionStore.getState().setMonitorPanelOpen(true);

      // Record to queueExecutionStore
      const execution: QueueExecution = {
        id: generateId('qexec'),
        queueItemId: item.item_id,
        issueId: item.issue_id,
        solutionId: item.solution_id,
        type: 'orchestrator',
        flowId: created.data.id,
        execId,
        tool,
        mode,
        status: 'running',
        startedAt: new Date().toISOString(),
      };
      addExecution(execution);

      setLastResult(`${created.data.id} / ${execId}`);
      toast.success(
        formatMessage({ id: 'issues.queue.orchestrator.sentTitle' }),
        formatMessage(
          { id: 'issues.queue.orchestrator.sentDesc' },
          { flowId: created.data.id }
        )
      );

      navigate('/orchestrator');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      toast.error(formatMessage({ id: 'issues.queue.orchestrator.sendFailed' }), message);
    } finally {
      setIsExecuting(false);
    }
  };

  // ========== Render ==========

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header with session controls */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          {formatMessage({ id: 'issues.queue.exec.title' })}
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshSessions}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            {formatMessage({ id: 'issues.terminal.session.refresh' })}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateSession}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {formatMessage({ id: 'issues.terminal.session.new' })}
          </Button>
        </div>
      </div>

      {/* Session selector */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          {formatMessage({ id: 'issues.terminal.session.select' })}
        </label>
        <Select value={selectedSessionKey} onValueChange={setSelectedSessionKey}>
          <SelectTrigger>
            <SelectValue
              placeholder={formatMessage({ id: 'issues.terminal.session.none' })}
            />
          </SelectTrigger>
          <SelectContent>
            {sessions.length === 0 ? (
              <SelectItem value="__none__" disabled>
                {formatMessage({ id: 'issues.terminal.session.none' })}
              </SelectItem>
            ) : (
              sessions.map((s) => (
                <SelectItem key={s.sessionKey} value={s.sessionKey}>
                  {(s.tool || 'cli') + ' \u00B7 ' + s.sessionKey}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Shared execution settings */}
      <CliExecutionSettings
        tool={tool}
        mode={mode}
        resumeStrategy={resumeStrategy}
        onToolChange={setTool}
        onModeChange={setMode}
        onResumeStrategyChange={setResumeStrategy}
      />

      {/* Execution mode tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as ExecutionTab)}
        className="w-full"
      >
        <TabsList className="w-full">
          <TabsTrigger value="session" className="flex-1 gap-2">
            <Terminal className="h-4 w-4" />
            {formatMessage({ id: 'issues.queue.exec.sessionTab' })}
          </TabsTrigger>
          <TabsTrigger value="orchestrator" className="flex-1 gap-2">
            <Workflow className="h-4 w-4" />
            {formatMessage({ id: 'issues.queue.exec.orchestratorTab' })}
          </TabsTrigger>
        </TabsList>

        {/* Session Tab */}
        <TabsContent value="session" className="mt-3">
          <div className="flex items-center justify-end">
            <Button
              onClick={handleSessionExecute}
              disabled={isExecuting || !projectPath}
              className="gap-2"
            >
              {isExecuting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  {formatMessage({ id: 'issues.terminal.exec.run' })}
                </>
              ) : (
                formatMessage({ id: 'issues.terminal.exec.run' })
              )}
            </Button>
          </div>
        </TabsContent>

        {/* Orchestrator Tab */}
        <TabsContent value="orchestrator" className="mt-3">
          <div className="flex items-center justify-end">
            <Button
              onClick={handleOrchestratorExecute}
              disabled={isExecuting || !projectPath}
              className="gap-2"
            >
              {isExecuting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  {formatMessage({ id: 'issues.queue.orchestrator.sending' })}
                </>
              ) : (
                formatMessage({ id: 'issues.queue.orchestrator.send' })
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Error display */}
      {displayError && (
        <div className="text-sm text-destructive">{displayError}</div>
      )}

      {/* Last result */}
      {lastResult && (
        <div className="text-xs text-muted-foreground font-mono break-all">
          {lastResult}
        </div>
      )}
    </div>
  );
}

export default QueueItemExecutor;
