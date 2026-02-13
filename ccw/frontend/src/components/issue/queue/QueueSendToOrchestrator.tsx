// ========================================
// QueueSendToOrchestrator
// ========================================
// Create a flow from a queue item and execute it via Orchestrator (tmux-like delivery to PTY session).

import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { toast, useExecutionStore, useFlowStore } from '@/stores';
import { useIssues } from '@/hooks';
import {
  createCliSession,
  createOrchestratorFlow,
  executeOrchestratorFlow,
  fetchCliSessions,
  type CliSession,
  type QueueItem,
} from '@/lib/api';
import { useCliSessionStore } from '@/stores/cliSessionStore';

type ToolName = 'claude' | 'codex' | 'gemini' | 'qwen';
type ResumeStrategy = 'nativeResume' | 'promptConcat';

function buildQueueItemInstruction(item: QueueItem, issue: any | undefined): string {
  const lines: string[] = [];
  lines.push(`Queue Item: ${item.item_id}`);
  lines.push(`Issue: ${item.issue_id}`);
  lines.push(`Solution: ${item.solution_id}`);
  if (item.task_id) lines.push(`Task: ${item.task_id}`);
  lines.push('');

  if (issue) {
    if (issue.title) lines.push(`Title: ${issue.title}`);
    if (issue.context) {
      lines.push('');
      lines.push('Context:');
      lines.push(String(issue.context));
    }

    const solution = Array.isArray(issue.solutions)
      ? issue.solutions.find((s: any) => s?.id === item.solution_id)
      : undefined;
    if (solution) {
      lines.push('');
      lines.push('Solution Description:');
      if (solution.description) lines.push(String(solution.description));
      if (solution.approach) {
        lines.push('');
        lines.push('Approach:');
        lines.push(String(solution.approach));
      }
    }
  }

  lines.push('');
  lines.push('Instruction:');
  lines.push(
    'Implement the above queue item in this repository. Prefer small, testable changes; run relevant tests; report blockers if any.'
  );

  return lines.join('\n');
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function QueueSendToOrchestrator({ item, className }: { item: QueueItem; className?: string }) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const projectPath = useWorkflowStore(selectProjectPath);

  const { issues } = useIssues();
  const issue = useMemo(() => issues.find((i) => i.id === item.issue_id) as any, [issues, item.issue_id]);

  const sessionsByKey = useCliSessionStore((s) => s.sessions);
  const setSessions = useCliSessionStore((s) => s.setSessions);
  const upsertSession = useCliSessionStore((s) => s.upsertSession);

  const sessions = useMemo(
    () => Object.values(sessionsByKey).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [sessionsByKey]
  );

  const [selectedSessionKey, setSelectedSessionKey] = useState<string>('');
  const [tool, setTool] = useState<ToolName>('claude');
  const [mode, setMode] = useState<'analysis' | 'write'>('write');
  const [resumeStrategy, setResumeStrategy] = useState<ResumeStrategy>('nativeResume');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ flowId: string; execId: string } | null>(null);

  const refreshSessions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const r = await fetchCliSessions(projectPath || undefined);
      setSessions(r.sessions as unknown as CliSession[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath]);

  useEffect(() => {
    if (selectedSessionKey) return;
    if (sessions.length === 0) return;
    setSelectedSessionKey(sessions[sessions.length - 1]?.sessionKey ?? '');
  }, [sessions, selectedSessionKey]);

  const ensureSession = async (): Promise<string> => {
    if (selectedSessionKey) return selectedSessionKey;
    if (!projectPath) throw new Error('No project path selected');
    const created = await createCliSession({
      workingDir: projectPath,
      preferredShell: 'bash',
      resumeKey: item.issue_id,
    }, projectPath);
    upsertSession(created.session as unknown as CliSession);
    setSelectedSessionKey(created.session.sessionKey);
    return created.session.sessionKey;
  };

  const handleCreateSession = async () => {
    setError(null);
    try {
      if (!projectPath) throw new Error('No project path selected');
      const created = await createCliSession({
        workingDir: projectPath,
        preferredShell: 'bash',
        resumeKey: item.issue_id,
      }, projectPath);
      upsertSession(created.session as unknown as CliSession);
      setSelectedSessionKey(created.session.sessionKey);
      await refreshSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSend = async () => {
    setIsSending(true);
    setError(null);
    setLastResult(null);
    try {
      const sessionKey = await ensureSession();
      const instruction = buildQueueItemInstruction(item, issue);

      const nodeId = generateId('node');
      const flowName = `Queue ${item.issue_id} / ${item.solution_id}${item.task_id ? ` / ${item.task_id}` : ''}`;
      const flowDescription = `Queue item ${item.item_id} -> Orchestrator`;

      const created = await createOrchestratorFlow({
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
      }, projectPath || undefined);

      if (!created.success) {
        throw new Error('Failed to create flow');
      }

      // Best-effort: hydrate Orchestrator stores so the user lands on the created flow.
      const flowDto = created.data as any;
      const parsedVersion = parseInt(String(flowDto.version ?? '1'), 10);
      const flowForStore = {
        ...flowDto,
        version: Number.isFinite(parsedVersion) ? parsedVersion : 1,
      } as any;
      useFlowStore.getState().setCurrentFlow(flowForStore);

      // Trigger execution (backend returns execId; engine wiring may run async).
      const executed = await executeOrchestratorFlow(created.data.id, {}, projectPath || undefined);
      if (!executed.success) {
        throw new Error('Failed to execute flow');
      }

      const execId = executed.data.execId;
      useExecutionStore.getState().startExecution(execId, created.data.id);
      useExecutionStore.getState().setMonitorPanelOpen(true);

      setLastResult({ flowId: created.data.id, execId });
      toast.success(
        formatMessage({ id: 'issues.queue.orchestrator.sentTitle' }),
        formatMessage({ id: 'issues.queue.orchestrator.sentDesc' }, { flowId: created.data.id })
      );

      navigate('/orchestrator');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      toast.error(formatMessage({ id: 'issues.queue.orchestrator.sendFailed' }), message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Workflow className="h-4 w-4" />
          {formatMessage({ id: 'issues.queue.orchestrator.title' })}
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
          <Button variant="outline" size="sm" onClick={handleCreateSession} className="gap-2">
            <Plus className="h-4 w-4" />
            {formatMessage({ id: 'issues.terminal.session.new' })}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            {formatMessage({ id: 'issues.queue.orchestrator.targetSession' })}
          </label>
          <Select value={selectedSessionKey} onValueChange={(v) => setSelectedSessionKey(v)}>
            <SelectTrigger>
              <SelectValue placeholder={formatMessage({ id: 'issues.terminal.session.none' })} />
            </SelectTrigger>
            <SelectContent>
              {sessions.length === 0 ? (
                <SelectItem value="__none__" disabled>
                  {formatMessage({ id: 'issues.terminal.session.none' })}
                </SelectItem>
              ) : (
                sessions.map((s) => (
                  <SelectItem key={s.sessionKey} value={s.sessionKey}>
                    {(s.tool || 'cli') + ' · ' + s.sessionKey}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            {formatMessage({ id: 'issues.queue.orchestrator.tool' })}
          </label>
          <Select value={tool} onValueChange={(v) => setTool(v as ToolName)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="claude">claude</SelectItem>
              <SelectItem value="codex">codex</SelectItem>
              <SelectItem value="gemini">gemini</SelectItem>
              <SelectItem value="qwen">qwen</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            {formatMessage({ id: 'issues.queue.orchestrator.mode' })}
          </label>
          <Select value={mode} onValueChange={(v) => setMode(v as 'analysis' | 'write')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="analysis">analysis</SelectItem>
              <SelectItem value="write">write</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            {formatMessage({ id: 'issues.queue.orchestrator.resumeStrategy' })}
          </label>
          <Select value={resumeStrategy} onValueChange={(v) => setResumeStrategy(v as ResumeStrategy)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nativeResume">nativeResume</SelectItem>
              <SelectItem value="promptConcat">promptConcat</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
      {lastResult && (
        <div className="text-xs text-muted-foreground font-mono break-all">
          {lastResult.flowId} · {lastResult.execId}
        </div>
      )}

      <div className="flex items-center justify-end">
        <Button onClick={handleSend} disabled={isSending || !projectPath} className="gap-2">
          {isSending ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              {formatMessage({ id: 'issues.queue.orchestrator.sending' })}
            </>
          ) : (
            formatMessage({ id: 'issues.queue.orchestrator.send' })
          )}
        </Button>
      </div>
    </div>
  );
}

export default QueueSendToOrchestrator;
