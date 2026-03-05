// ========================================
// Issue Board Panel
// ========================================
// Kanban board view for issues (status-driven) with local ordering.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import type { DropResult } from '@hello-pangea/dnd';
import { AlertCircle, LayoutGrid } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { KanbanBoard, type KanbanColumn, type KanbanItem } from '@/components/shared/KanbanBoard';
import { IssueCard } from '@/components/shared/IssueCard';
import { IssueDrawer } from '@/components/issue/hub/IssueDrawer';
import { cn } from '@/lib/utils';
import { useIssues, useIssueMutations } from '@/hooks';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { createCliSession, executeInCliSession } from '@/lib/api';
import type { Issue } from '@/lib/api';
import { useTerminalPanelStore } from '@/stores/terminalPanelStore';

type IssueBoardStatus = Issue['status'];
type ToolName = 'claude' | 'codex' | 'gemini';
type ResumeStrategy = 'nativeResume' | 'promptConcat';

const BOARD_COLUMNS: Array<{ id: IssueBoardStatus; titleKey: string }> = [
  { id: 'registered', titleKey: 'issues.status.registered' },
  { id: 'planning', titleKey: 'issues.status.planning' },
  { id: 'planned', titleKey: 'issues.status.planned' },
  { id: 'executing', titleKey: 'issues.status.executing' },
  { id: 'completed', titleKey: 'issues.status.completed' },
  { id: 'failed', titleKey: 'issues.status.failed' },
];

type BoardOrder = Partial<Record<IssueBoardStatus, string[]>>;

function storageKey(projectPath: string | null | undefined): string {
  const base = projectPath ? encodeURIComponent(projectPath) : 'global';
  return `ccw.issueBoard.order:${base}`;
}

interface AutoStartConfig {
  enabled: boolean;
  tool: ToolName;
  mode: 'analysis' | 'write';
  resumeStrategy: ResumeStrategy;
}

function autoStartStorageKey(projectPath: string | null | undefined): string {
  const base = projectPath ? encodeURIComponent(projectPath) : 'global';
  return `ccw.issueBoard.autoStart:${base}`;
}

function safeParseAutoStart(value: string | null): AutoStartConfig {
  const defaults: AutoStartConfig = {
    enabled: false,
    tool: 'claude',
    mode: 'write',
    resumeStrategy: 'nativeResume',
  };
  if (!value) return defaults;
  try {
    const parsed = JSON.parse(value) as Partial<AutoStartConfig>;
    return {
      enabled: Boolean(parsed.enabled),
      tool: parsed.tool === 'codex' || parsed.tool === 'gemini' ? parsed.tool : 'claude',
      mode: parsed.mode === 'analysis' ? 'analysis' : 'write',
      resumeStrategy: parsed.resumeStrategy === 'promptConcat' ? 'promptConcat' : 'nativeResume',
    };
  } catch {
    return defaults;
  }
}

function safeParseOrder(value: string | null): BoardOrder {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as BoardOrder;
  } catch {
    return {};
  }
}

function buildColumns(
  issues: Issue[],
  order: BoardOrder,
  formatTitle: (statusId: IssueBoardStatus) => string
): KanbanColumn<Issue & KanbanItem>[] {
  const byId = new Map(issues.map((i) => [i.id, i]));
  const columns: KanbanColumn<Issue & KanbanItem>[] = [];

  for (const col of BOARD_COLUMNS) {
    const desired = (order[col.id] ?? []).map((id) => byId.get(id)).filter(Boolean) as Issue[];
    const desiredIds = new Set(desired.map((i) => i.id));

    const remaining = issues
      .filter((i) => i.status === col.id && !desiredIds.has(i.id))
      .sort((a, b) => {
        const at = a.updatedAt || a.createdAt;
        const bt = b.updatedAt || b.createdAt;
        return bt.localeCompare(at);
      });

    const items = [...desired, ...remaining].map((issue) => ({
      ...issue,
      id: issue.id,
      title: issue.title,
      status: issue.status,
    }));

    columns.push({
      id: col.id,
      title: formatTitle(col.id),
      items,
      icon: <LayoutGrid className="w-4 h-4" />,
    });
  }

  return columns;
}

function syncOrderWithIssues(prev: BoardOrder, issues: Issue[]): BoardOrder {
  const statusById = new Map(issues.map((i) => [i.id, i.status]));
  const next: BoardOrder = {};

  for (const { id: status } of BOARD_COLUMNS) {
    const existing = prev[status] ?? [];
    const filtered = existing.filter((id) => statusById.get(id) === status);
    const present = new Set(filtered);

    const missing = issues
      .filter((i) => i.status === status && !present.has(i.id))
      .map((i) => i.id);

    next[status] = [...filtered, ...missing];
  }

  return next;
}

function reorderIds(list: string[], from: number, to: number): string[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return list;
  next.splice(to, 0, moved);
  return next;
}

function buildIssueAutoPrompt(issue: Issue): string {
  const lines: string[] = [];
  lines.push(`Issue: ${issue.id}`);
  lines.push(`Status: ${issue.status}`);
  lines.push(`Priority: ${issue.priority}`);
  lines.push('');
  lines.push(`Title: ${issue.title}`);
  if (issue.context) {
    lines.push('');
    lines.push('Context:');
    lines.push(String(issue.context));
  }

  if (Array.isArray(issue.solutions) && issue.solutions.length > 0) {
    lines.push('');
    lines.push('Solutions:');
    for (const s of issue.solutions) {
      lines.push(`- [${s.status}] ${s.description}`);
      if (s.approach) lines.push(`  Approach: ${s.approach}`);
    }
  }

  lines.push('');
  lines.push('Instruction:');
  lines.push(
    'Start working on this issue in this repository. Prefer small, testable changes; run relevant tests; report blockers if any.'
  );
  return lines.join('\n');
}

export function IssueBoardPanel() {
  const { formatMessage } = useIntl();
  const projectPath = useWorkflowStore(selectProjectPath);

  const { issues, isLoading, error } = useIssues();
  const { updateIssue } = useIssueMutations();

  const [order, setOrder] = useState<BoardOrder>({});
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [drawerInitialTab, setDrawerInitialTab] = useState<'overview' | 'terminal'>('overview');
  const [optimisticError, setOptimisticError] = useState<string | null>(null);
  const [autoStart, setAutoStart] = useState<AutoStartConfig>(() => safeParseAutoStart(null));

  // Load order when project changes
  useEffect(() => {
    const key = storageKey(projectPath);
    const loaded = safeParseOrder(localStorage.getItem(key));
    setOrder(loaded);
  }, [projectPath]);

  // Load auto-start config when project changes
  useEffect(() => {
    const key = autoStartStorageKey(projectPath);
    setAutoStart(safeParseAutoStart(localStorage.getItem(key)));
  }, [projectPath]);

  // Keep order consistent with current issues (status moves, deletions, new issues)
  useEffect(() => {
    setOrder((prev) => syncOrderWithIssues(prev, issues));
  }, [issues]);

  // Persist order
  useEffect(() => {
    const key = storageKey(projectPath);
    try {
      localStorage.setItem(key, JSON.stringify(order));
    } catch {
      // ignore quota errors
    }
  }, [order, projectPath]);

  // Persist auto-start config
  useEffect(() => {
    const key = autoStartStorageKey(projectPath);
    try {
      localStorage.setItem(key, JSON.stringify(autoStart));
    } catch {
      // ignore quota errors
    }
  }, [autoStart, projectPath]);

  const columns = useMemo(
    () =>
      buildColumns(issues, order, (statusId) => {
        const col = BOARD_COLUMNS.find((c) => c.id === statusId);
        if (!col) return statusId;
        return formatMessage({ id: col.titleKey });
      }),
    [issues, order, formatMessage]
  );

  const idsByStatus = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const col of columns) {
      map[col.id] = col.items.map((i) => i.id);
    }
    return map;
  }, [columns]);

  const handleItemClick = useCallback((issue: Issue) => {
    setDrawerInitialTab('overview');
    setSelectedIssue(issue);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedIssue(null);
    setOptimisticError(null);
  }, []);

  const handleDragEnd = useCallback(
    async (result: DropResult, sourceColumn: string, destColumn: string) => {
      const issueId = result.draggableId;
      const issue = issues.find((i) => i.id === issueId);
      if (!issue) return;

      setOptimisticError(null);

      const sourceStatus = sourceColumn as IssueBoardStatus;
      const destStatus = destColumn as IssueBoardStatus;
      const sourceIds = idsByStatus[sourceStatus] ?? [];
      const destIds = idsByStatus[destStatus] ?? [];

      // Update local order first (optimistic)
      setOrder((prev) => {
        const next = { ...prev };
        if (sourceStatus === destStatus) {
          next[sourceStatus] = reorderIds(sourceIds, result.source.index, result.destination!.index);
          return next;
        }

        const nextSource = [...sourceIds];
        nextSource.splice(result.source.index, 1);

        const nextDest = [...destIds];
        nextDest.splice(result.destination!.index, 0, issueId);

        next[sourceStatus] = nextSource;
        next[destStatus] = nextDest;
        return next;
      });

      // Status update
      if (sourceStatus !== destStatus) {
        try {
          await updateIssue(issueId, { status: destStatus });

          // Auto action: drag to executing opens the drawer on terminal tab.
          if (destStatus === 'executing' && sourceStatus !== 'executing') {
            setDrawerInitialTab('terminal');
            setSelectedIssue({ ...issue, status: destStatus });

            if (autoStart.enabled) {
              if (!projectPath) {
                setOptimisticError('Auto-start failed: no project path selected');
                return;
              }

              try {
                const created = await createCliSession({
                  workingDir: projectPath,
                  preferredShell: 'bash',
                  tool: autoStart.tool,
                  resumeKey: issueId,
                }, projectPath);
                await executeInCliSession(created.session.sessionKey, {
                  tool: autoStart.tool,
                  prompt: buildIssueAutoPrompt({ ...issue, status: destStatus }),
                  mode: autoStart.mode,
                  resumeKey: issueId,
                  resumeStrategy: autoStart.resumeStrategy,
                }, projectPath);
                // Auto-open terminal panel to show execution output
                useTerminalPanelStore.getState().openTerminal(created.session.sessionKey);
              } catch (e) {
                setOptimisticError(`Auto-start failed: ${e instanceof Error ? e.message : String(e)}`);
              }
            }
          }
        } catch (e) {
          setOptimisticError(e instanceof Error ? e.message : String(e));
        }
      }
    },
    [autoStart, issues, idsByStatus, projectPath, updateIssue]
  );

  if (error) {
    return (
      <Card className="p-12 text-center">
        <AlertCircle className="w-16 h-16 mx-auto text-destructive/50" />
        <h3 className="mt-4 text-lg font-medium text-foreground">
          {formatMessage({ id: 'issues.queue.error.title' })}
        </h3>
        <p className="mt-2 text-muted-foreground">{error.message}</p>
      </Card>
    );
  }

  return (
    <>
      <div className="mb-3 flex flex-col gap-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={autoStart.enabled}
              onCheckedChange={(checked) => setAutoStart((prev) => ({ ...prev, enabled: checked }))}
            />
            <div className="text-sm text-foreground">
              {formatMessage({ id: 'issues.board.autoStart.label' })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={autoStart.tool}
              onValueChange={(v) => setAutoStart((prev) => ({ ...prev, tool: v as ToolName }))}
              disabled={!autoStart.enabled}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude">claude</SelectItem>
                <SelectItem value="codex">codex</SelectItem>
                <SelectItem value="gemini">gemini</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={autoStart.mode}
              onValueChange={(v) => setAutoStart((prev) => ({ ...prev, mode: v as 'analysis' | 'write' }))}
              disabled={!autoStart.enabled}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="analysis">analysis</SelectItem>
                <SelectItem value="write">write</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={autoStart.resumeStrategy}
              onValueChange={(v) => setAutoStart((prev) => ({ ...prev, resumeStrategy: v as ResumeStrategy }))}
              disabled={!autoStart.enabled}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nativeResume">nativeResume</SelectItem>
                <SelectItem value="promptConcat">promptConcat</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {optimisticError && (
        <div className="text-sm text-destructive">
          {optimisticError}
        </div>
      )}

      <KanbanBoard<Issue & KanbanItem>
        columns={columns}
        onDragEnd={handleDragEnd}
        onItemClick={(item) => handleItemClick(item as unknown as Issue)}
        isLoading={isLoading}
        emptyColumnMessage={formatMessage({ id: 'issues.emptyState.message' })}
        className={cn('gap-4', 'grid')}
        renderItem={(item, provided) => (
          <IssueCard
            issue={item as unknown as Issue}
            compact
            showActions={false}
            onClick={(i) => handleItemClick(i)}
            innerRef={provided.innerRef}
            draggableProps={provided.draggableProps}
            dragHandleProps={provided.dragHandleProps}
            className="w-full"
          />
        )}
      />

      <IssueDrawer
        issue={selectedIssue}
        isOpen={Boolean(selectedIssue)}
        onClose={handleCloseDrawer}
        initialTab={drawerInitialTab}
      />
    </>
  );
}

export default IssueBoardPanel;
