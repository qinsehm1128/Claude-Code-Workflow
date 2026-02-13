// ========================================
// QueueExecuteInSession
// ========================================
// Minimal “execution plane” for queue items:
// pick/create a PTY session and submit a generated prompt to it.

import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { useIssues } from '@/hooks';
import {
  createCliSession,
  executeInCliSession,
  fetchCliSessions,
  type CliSession,
  type QueueItem,
} from '@/lib/api';
import { useCliSessionStore } from '@/stores/cliSessionStore';
import { useTerminalPanelStore } from '@/stores/terminalPanelStore';

type ToolName = 'claude' | 'codex' | 'gemini';
type ResumeStrategy = 'nativeResume' | 'promptConcat';

function buildQueueItemPrompt(item: QueueItem, issue: any | undefined): string {
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

      // Best-effort: if the solution has embedded tasks, include the matched task.
      const tasks = Array.isArray(solution.tasks) ? solution.tasks : [];
      const task = item.task_id ? tasks.find((t: any) => t?.id === item.task_id) : undefined;
      if (task) {
        lines.push('');
        lines.push('Task:');
        if (task.title) lines.push(`- ${task.title}`);
        if (task.description) lines.push(String(task.description));
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

export function QueueExecuteInSession({ item, className }: { item: QueueItem; className?: string }) {
  const { formatMessage } = useIntl();
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
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastExecution, setLastExecution] = useState<{ executionId: string; command: string } | null>(null);

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

  const handleExecute = async () => {
    setIsExecuting(true);
    setError(null);
    setLastExecution(null);
    try {
      const sessionKey = await ensureSession();
      const prompt = buildQueueItemPrompt(item, issue);
      const result = await executeInCliSession(sessionKey, {
        tool,
        prompt,
        mode,
        workingDir: projectPath,
        category: 'user',
        resumeKey: item.issue_id,
        resumeStrategy,
      }, projectPath);
      setLastExecution({ executionId: result.executionId, command: result.command });
      // Auto-open terminal panel to show execution output
      useTerminalPanelStore.getState().openTerminal(sessionKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
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
          <Button variant="outline" size="sm" onClick={handleCreateSession} className="gap-2">
            <Plus className="h-4 w-4" />
            {formatMessage({ id: 'issues.terminal.session.new' })}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            {formatMessage({ id: 'issues.terminal.session.select' })}
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
            {formatMessage({ id: 'issues.terminal.exec.tool' })}
          </label>
          <Select value={tool} onValueChange={(v) => setTool(v as ToolName)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="claude">claude</SelectItem>
              <SelectItem value="codex">codex</SelectItem>
              <SelectItem value="gemini">gemini</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            {formatMessage({ id: 'issues.terminal.exec.mode' })}
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
            {formatMessage({ id: 'issues.terminal.exec.resumeStrategy' })}
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
      {lastExecution && (
        <div className="text-xs text-muted-foreground font-mono break-all">
          {lastExecution.executionId}
        </div>
      )}

      <div className="flex items-center justify-end">
        <Button onClick={handleExecute} disabled={isExecuting || !projectPath} className="gap-2">
          {formatMessage({ id: 'issues.terminal.exec.run' })}
        </Button>
      </div>
    </div>
  );
}
