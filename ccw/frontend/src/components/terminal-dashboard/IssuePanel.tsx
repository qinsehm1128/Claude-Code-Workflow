// ========================================
// IssuePanel Component
// ========================================
// Issue list panel for the terminal dashboard middle column.
// Consumes existing useIssues() React Query hook for data fetching.
// Integrates with issueQueueIntegrationStore for selection state
// and association chain highlighting.

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useIntl } from 'react-intl';
import {
  AlertCircle,
  Loader2,
  AlertTriangle,
  CircleDot,
  Terminal,
  Check,
  Send,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { useIssues } from '@/hooks/useIssues';
import {
  useIssueQueueIntegrationStore,
  selectSelectedIssueId,
  selectAssociationChain,
} from '@/stores/issueQueueIntegrationStore';
import { executeInCliSession } from '@/lib/api';
import type { Issue } from '@/lib/api';
import { useTerminalGridStore, selectTerminalGridFocusedPaneId, selectTerminalGridPanes } from '@/stores/terminalGridStore';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import { toast } from '@/stores/notificationStore';

// ========== Execution Method Type ==========

type ExecutionMethod = 'skill-team-issue' | 'ccw-cli' | 'direct-send';

// ========== Prompt Templates ==========

const PROMPT_TEMPLATES: Record<ExecutionMethod, (idStr: string) => string> = {
  'skill-team-issue': (idStr) => `完成 ${idStr} issue`,
  'ccw-cli': (idStr) => `完成.issue.jsonl中 ${idStr} issue`,
  'direct-send': (idStr) => `根据@.workflow/issues/issues.jsonl中的 ${idStr} 需求，进行开发`,
};

// ========== Priority Badge ==========

const PRIORITY_STYLES: Record<Issue['priority'], { variant: 'destructive' | 'warning' | 'info' | 'secondary'; label: string }> = {
  critical: { variant: 'destructive', label: 'Critical' },
  high: { variant: 'warning', label: 'High' },
  medium: { variant: 'info', label: 'Medium' },
  low: { variant: 'secondary', label: 'Low' },
};

function PriorityBadge({ priority }: { priority: Issue['priority'] }) {
  const style = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.medium;
  return (
    <Badge variant={style.variant} className="text-[10px] px-1.5 py-0 shrink-0">
      {style.label}
    </Badge>
  );
}

// ========== Status Indicator ==========

function StatusDot({ status }: { status: Issue['status'] }) {
  const colorMap: Record<Issue['status'], string> = {
    open: 'text-info',
    in_progress: 'text-warning',
    resolved: 'text-success',
    closed: 'text-muted-foreground',
    completed: 'text-success',
  };
  return <CircleDot className={cn('w-3 h-3 shrink-0', colorMap[status] ?? 'text-muted-foreground')} />;
}

// ========== Issue Item ==========

function IssueItem({
  issue,
  isSelected,
  isHighlighted,
  isChecked,
  onSelect,
  onToggleCheck,
}: {
  issue: Issue;
  isSelected: boolean;
  isHighlighted: boolean;
  isChecked: boolean;
  onSelect: () => void;
  onToggleCheck: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'w-full text-left px-2.5 py-1.5 rounded-md transition-colors',
        'hover:bg-muted/60 focus:outline-none focus:ring-1 focus:ring-primary/30',
        isSelected && 'bg-primary/10 ring-1 ring-primary/30',
        isHighlighted && !isSelected && 'bg-accent/50'
      )}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => { e.stopPropagation(); onToggleCheck(); }}
            onClick={(e) => e.stopPropagation()}
            className="w-3.5 h-3.5 rounded border-border accent-primary shrink-0"
          />
          <StatusDot status={issue.status} />
          <span className="text-sm font-medium text-foreground truncate">
            {issue.title}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <PriorityBadge priority={issue.priority} />
        </div>
      </div>
      {issue.context && (
        <p className="mt-0.5 text-xs text-muted-foreground truncate pl-7">
          {issue.context}
        </p>
      )}
      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground pl-7">
        <span className="font-mono">{issue.id}</span>
        {issue.labels && issue.labels.length > 0 && (
          <>
            <span className="text-border">|</span>
            <span className="truncate">{issue.labels.slice(0, 2).join(', ')}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ========== Empty State ==========

function IssueEmptyState() {
  const { formatMessage } = useIntl();
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground p-4">
      <div className="text-center">
        <AlertCircle className="h-6 w-6 mx-auto mb-1.5 opacity-30" />
        <p className="text-sm">{formatMessage({ id: 'terminalDashboard.issuePanel.noIssues' })}</p>
        <p className="text-xs mt-1 opacity-70">
          {formatMessage({ id: 'terminalDashboard.issuePanel.noIssuesDesc' })}
        </p>
      </div>
    </div>
  );
}

// ========== Error State ==========

function IssueErrorState({ error }: { error: Error }) {
  const { formatMessage } = useIntl();
  return (
    <div className="flex-1 flex items-center justify-center text-destructive p-4">
      <div className="text-center">
        <AlertTriangle className="h-6 w-6 mx-auto mb-1.5 opacity-30" />
        <p className="text-sm">{formatMessage({ id: 'terminalDashboard.issuePanel.error' })}</p>
        <p className="text-xs mt-1 opacity-70">{error.message}</p>
      </div>
    </div>
  );
}

// ========== Main Component ==========

export function IssuePanel() {
  const { formatMessage } = useIntl();
  const { issues, isLoading, error, openCount } = useIssues();

  const selectedIssueId = useIssueQueueIntegrationStore(selectSelectedIssueId);
  const associationChain = useIssueQueueIntegrationStore(selectAssociationChain);
  const setSelectedIssue = useIssueQueueIntegrationStore((s) => s.setSelectedIssue);
  const buildAssociationChain = useIssueQueueIntegrationStore((s) => s.buildAssociationChain);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [executionMethod, setExecutionMethod] = useState<ExecutionMethod>('skill-team-issue');
  const [isSendConfigOpen, setIsSendConfigOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const sentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Terminal refs
  const focusedPaneId = useTerminalGridStore(selectTerminalGridFocusedPaneId);
  const panes = useTerminalGridStore(selectTerminalGridPanes);
  const projectPath = useWorkflowStore(selectProjectPath);
  const focusedPane = focusedPaneId ? panes[focusedPaneId] : null;
  const sessionKey = focusedPane?.sessionId ?? null;
  const sessionCliTool = focusedPane?.cliTool ?? null;

  // Compute available methods based on the focused session's CLI tool
  const availableMethods = useMemo(() => {
    // Only offer skill methods when the session is claude (supports / slash commands)
    if (sessionCliTool === 'claude') {
      return [
        { value: 'skill-team-issue' as const, label: 'team-issue' },
        { value: 'ccw-cli' as const, label: 'ccw' },
        { value: 'direct-send' as const, label: 'Direct send' },
      ];
    }
    // For unknown/null cliTool or non-claude tools, only offer direct send
    return [
      { value: 'direct-send' as const, label: 'Direct send' },
    ];
  }, [sessionCliTool]);

  // Auto-switch method when the current selection is unavailable for this tool
  useEffect(() => {
    if (!availableMethods.find(m => m.value === executionMethod)) {
      setExecutionMethod(availableMethods[0].value);
    }
  }, [availableMethods, executionMethod]);

  // Cleanup sent feedback timer on unmount
  useEffect(() => {
    return () => {
      if (sentTimerRef.current) clearTimeout(sentTimerRef.current);
    };
  }, []);

  // Sort: open/in_progress first, then by priority (critical > high > medium > low)
  const sortedIssues = useMemo(() => {
    const priorityOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    const statusOrder: Record<string, number> = {
      in_progress: 0,
      open: 1,
      resolved: 2,
      completed: 3,
      closed: 4,
    };
    return [...issues].sort((a, b) => {
      const sa = statusOrder[a.status] ?? 5;
      const sb = statusOrder[b.status] ?? 5;
      if (sa !== sb) return sa - sb;
      const pa = priorityOrder[a.priority] ?? 3;
      const pb = priorityOrder[b.priority] ?? 3;
      return pa - pb;
    });
  }, [issues]);

  const handleSelect = useCallback(
    (issueId: string) => {
      if (selectedIssueId === issueId) {
        setSelectedIssue(null);
      } else {
        buildAssociationChain(issueId, 'issue');
      }
    },
    [selectedIssueId, setSelectedIssue, buildAssociationChain]
  );

  const handleToggleSelect = useCallback((issueId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(issueId)) next.delete(issueId);
      else next.add(issueId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(sortedIssues.map(i => i.id)));
  }, [sortedIssues]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleOpenSendConfig = useCallback(() => {
    const idStr = Array.from(selectedIds).join(' ');
    setCustomPrompt(PROMPT_TEMPLATES[executionMethod](idStr));
    setIsSendConfigOpen(true);
  }, [selectedIds, executionMethod]);

  const handleSendToTerminal = useCallback(async () => {
    if (!sessionKey || selectedIds.size === 0) return;
    const effectiveTool = sessionCliTool || 'claude';
    setIsSending(true);
    try {
      const prompt = customPrompt.trim();

      let executeInput: Parameters<typeof executeInCliSession>[1];

      switch (executionMethod) {
        case 'skill-team-issue':
          executeInput = {
            tool: effectiveTool,
            prompt,
            instructionType: 'skill',
            skillName: 'team-issue',
          };
          break;
        case 'ccw-cli':
          executeInput = {
            tool: effectiveTool,
            prompt,
            instructionType: 'skill',
            skillName: 'ccw',
          };
          break;
        case 'direct-send':
          executeInput = {
            tool: effectiveTool,
            prompt,
            instructionType: 'prompt',
          };
          break;
      }

      await executeInCliSession(sessionKey, executeInput, projectPath || undefined);

      toast.success('Sent to terminal', prompt.length > 60 ? prompt.slice(0, 60) + '...' : prompt);
      setJustSent(true);
      setIsSendConfigOpen(false);
      if (sentTimerRef.current) clearTimeout(sentTimerRef.current);
      sentTimerRef.current = setTimeout(() => setJustSent(false), 2000);
    } catch (err) {
      toast.error('Failed to send', err instanceof Error ? err.message : String(err));
    } finally {
      setIsSending(false);
    }
  }, [sessionKey, selectedIds, projectPath, executionMethod, sessionCliTool, customPrompt]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {formatMessage({ id: 'terminalDashboard.issuePanel.title' })}
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-border shrink-0">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {formatMessage({ id: 'terminalDashboard.issuePanel.title' })}
          </h3>
        </div>
        <IssueErrorState error={error} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border shrink-0 flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {formatMessage({ id: 'terminalDashboard.issuePanel.title' })}
        </h3>
        <div className="flex items-center gap-1.5">
          {sortedIssues.length > 0 && (
            <button
              type="button"
              className="text-[10px] text-muted-foreground hover:text-foreground px-1"
              onClick={selectedIds.size === sortedIssues.length ? handleDeselectAll : handleSelectAll}
            >
              {selectedIds.size === sortedIssues.length ? 'Deselect all' : 'Select all'}
            </button>
          )}
          {openCount > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {openCount}
            </Badge>
          )}
        </div>
      </div>

      {/* Issue List */}
      {sortedIssues.length === 0 ? (
        <IssueEmptyState />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-0.5">
          {sortedIssues.map((issue) => (
            <IssueItem
              key={issue.id}
              issue={issue}
              isSelected={selectedIssueId === issue.id}
              isHighlighted={associationChain?.issueId === issue.id}
              isChecked={selectedIds.has(issue.id)}
              onSelect={() => handleSelect(issue.id)}
              onToggleCheck={() => handleToggleSelect(issue.id)}
            />
          ))}
        </div>
      )}

      {/* Send to Terminal bar */}
      {selectedIds.size > 0 && (
        <div className="border-t border-border shrink-0">
          {/* Send Config Panel (expandable) */}
          {isSendConfigOpen && (
            <div className="px-3 py-2 space-y-2 border-b border-border bg-muted/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Send Configuration</span>
                <button
                  type="button"
                  className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  onClick={() => setIsSendConfigOpen(false)}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* Method selector */}
              {availableMethods.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground shrink-0">Method</span>
                  <Select
                    value={executionMethod}
                    onValueChange={(v) => {
                      const method = v as ExecutionMethod;
                      setExecutionMethod(method);
                      const idStr = Array.from(selectedIds).join(' ');
                      setCustomPrompt(PROMPT_TEMPLATES[method](idStr));
                    }}
                  >
                    <SelectTrigger className="h-6 w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMethods.map((m) => (
                        <SelectItem key={m.value} value={m.value} className="text-xs">
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {/* Prompt preview label */}
              {executionMethod !== 'direct-send' && (
                <div className="text-[10px] text-muted-foreground">
                  Prefix: <span className="font-mono text-foreground">/{executionMethod === 'skill-team-issue' ? 'team-issue' : 'ccw'}</span>
                </div>
              )}
              {/* Editable prompt */}
              <textarea
                className="w-full text-xs bg-background border border-border rounded-md px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary/40 text-foreground"
                rows={3}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Enter prompt..."
              />
              {/* Send button */}
              <button
                type="button"
                className={cn(
                  'w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  'bg-primary text-primary-foreground hover:bg-primary/90',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
                disabled={!sessionKey || isSending || !customPrompt.trim()}
                onClick={handleSendToTerminal}
              >
                {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Confirm Send
              </button>
            </div>
          )}
          {/* Bottom bar */}
          <div className="px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {selectedIds.size} selected
              </span>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={handleDeselectAll}
              >
                Clear
              </button>
            </div>
            <button
              type="button"
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                justSent
                  ? 'bg-green-600 text-white'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              disabled={!sessionKey || isSending}
              onClick={isSendConfigOpen ? handleSendToTerminal : handleOpenSendConfig}
              title={!sessionKey ? 'No terminal session focused' : `Send via ${executionMethod}`}
            >
              {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : justSent ? <Check className="w-3.5 h-3.5" /> : <Terminal className="w-3.5 h-3.5" />}
              {justSent ? 'Sent!' : `Send (${selectedIds.size})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
