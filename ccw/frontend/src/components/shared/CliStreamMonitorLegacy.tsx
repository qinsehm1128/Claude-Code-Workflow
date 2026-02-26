// ========================================
// CliStreamMonitor Component
// ========================================
// Global CLI streaming monitor with multi-execution support

import { useEffect, useRef, useCallback, useState, useMemo, memo } from 'react';
import { useIntl } from 'react-intl';
import {
  X,
  Terminal,
  Loader2,
  Clock,
  RefreshCw,
  Search,
  ArrowDownToLine,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { LogBlockList } from '@/components/shared/LogBlock';
import { useCliStreamStore, type CliOutputLine } from '@/stores/cliStreamStore';
import { useActiveCliExecutions } from '@/hooks/useActiveCliExecutions';
import { useCliStreamWebSocket } from '@/hooks/useCliStreamWebSocket';

// New components for Tab + JSON Cards
import { ExecutionTab } from './CliStreamMonitor/components/ExecutionTab';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ========== Types ==========
// WebSocket message types are now handled centrally in useCliStreamWebSocket hook

// ========== Helper Functions ==========

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

// ========== Output Line Card Renderer ==========

/**
 * Get border color class for line type
 */
function getBorderColorForType(type: CliOutputLine['type']): string {
  const borderColors = {
    tool_call: 'border-l-indigo-500',
    metadata: 'border-l-slate-400',
    system: 'border-l-slate-400',
    stdout: 'border-l-teal-500',
    stderr: 'border-l-rose-500',
    thought: 'border-l-violet-500',
  };
  return borderColors[type] || 'border-l-slate-400';
}

/**
 * Extract content from a line (handle JSON with 'content' field)
 */
function extractContentFromLine(line: CliOutputLine): { content: string; isMarkdown: boolean } {
  const trimmed = line.content.trim();

  try {
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const parsed = JSON.parse(trimmed);
      if ('content' in parsed && typeof parsed.content === 'string') {
        const content = parsed.content;
        const isMarkdown = !!content.match(/^#{1,6}\s|^\*{3,}$|^\s*[-*+]\s+|^\s*\d+\.\s+|\*\*.*?\*\*|`{3,}/m);
        return { content, isMarkdown };
      }
    }
  } catch {
    // Not valid JSON, use original content
  }

  // Check if original content looks like markdown
  const isMarkdown = !!trimmed.match(/^#{1,6}\s|^\*{3,}$|^\s*[-*+]\s+|^\s*\d+\.\s+|\*\*.*?\*\*|`{3,}/m);
  return { content: trimmed, isMarkdown };
}

/**
 * Group consecutive output lines by type
 */
interface OutputLineGroup {
  type: CliOutputLine['type'];
  lines: CliOutputLine[];
}

function groupConsecutiveLinesByType(lines: CliOutputLine[]): OutputLineGroup[] {
  const groups: OutputLineGroup[] = [];

  for (const line of lines) {
    // Start new group if type changes
    if (groups.length === 0 || groups[groups.length - 1].type !== line.type) {
      groups.push({
        type: line.type,
        lines: [line],
      });
    } else {
      // Append to existing group
      groups[groups.length - 1].lines.push(line);
    }
  }

  return groups;
}

/**
 * Render a group of output lines as a merged card
 */
interface OutputLineCardProps {
  group: OutputLineGroup;
  onCopy?: (content: string) => void;
}

function OutputLineCard({ group }: OutputLineCardProps) {
  const borderColor = getBorderColorForType(group.type);

  // Extract content from all lines in the group
  const lineContents = group.lines.map(line => extractContentFromLine(line));

  // Check if any line has markdown
  const hasMarkdown = lineContents.some(c => c.isMarkdown);

  return (
    <div className={`border-l-2 rounded-r my-1 py-1 px-2 group relative bg-background contain-content ${borderColor}`}>
      <div className="pr-6 space-y-1">
        {lineContents.map((item, index) => (
          <div key={index} className="contain-layout">
            {item.isMarkdown || hasMarkdown ? (
              <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed contain-layout">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {item.content}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="text-xs whitespace-pre-wrap break-words leading-relaxed contain-layout">
                {item.content}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Memoize the OutputLineCard component to prevent unnecessary re-renders
const MemoizedOutputLineCard = memo(OutputLineCard);

// ========== Component ==========

export interface CliStreamMonitorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CliStreamMonitor({ isOpen, onClose }: CliStreamMonitorProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'blocks'>('list');

  // Track last output length to detect new output
  const lastOutputLengthRef = useRef<Record<string, number>>({});

  // Store state
  const executions = useCliStreamStore((state) => state.executions);
  const currentExecutionId = useCliStreamStore((state) => state.currentExecutionId);
  const setCurrentExecution = useCliStreamStore((state) => state.setCurrentExecution);
  const removeExecution = useCliStreamStore((state) => state.removeExecution);
  const markExecutionClosedByUser = useCliStreamStore((state) => state.markExecutionClosedByUser);

  // Active execution sync
  const { isLoading: isSyncing, refetch } = useActiveCliExecutions(isOpen);

  // CENTRALIZED WebSocket handler - processes each message only once globally
  useCliStreamWebSocket();

  // Auto-scroll to bottom when new output arrives (optimized - only scroll when output length changes)
  useEffect(() => {
    if (!currentExecutionId || !autoScroll || isUserScrolling) return;

    const currentExecution = executions[currentExecutionId];
    if (!currentExecution) return;

    const currentLength = currentExecution.output.length;
    const lastLength = lastOutputLengthRef.current[currentExecutionId] || 0;

    // Only scroll if new output was added
    if (currentLength > lastLength) {
      lastOutputLengthRef.current[currentExecutionId] = currentLength;
      requestAnimationFrame(() => {
        if (logsEndRef.current) {
          logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }
  }, [executions, currentExecutionId, autoScroll, isUserScrolling]);

  // Handle scroll to detect user scrolling (with debounce for performance)
  const handleScrollRef = useRef<NodeJS.Timeout | null>(null);
  const handleScroll = useCallback(() => {
    if (handleScrollRef.current) {
      clearTimeout(handleScrollRef.current);
    }

    handleScrollRef.current = setTimeout(() => {
      if (!logsContainerRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsUserScrolling(!isAtBottom);
    }, 50); // 50ms debounce
  }, []);

  // Handle closing an execution tab
  const handleCloseExecution = useCallback((executionId: string) => {
    // Mark as closed by user so it won't be re-added by server sync
    markExecutionClosedByUser(executionId);
    // Remove from local state
    removeExecution(executionId);
    // If this was the current execution, clear current selection
    if (currentExecutionId === executionId) {
      const remainingIds = Object.keys(executions).filter(id => id !== executionId);
      setCurrentExecution(remainingIds.length > 0 ? remainingIds[0] : null);
    }
  }, [markExecutionClosedByUser, removeExecution, currentExecutionId, executions, setCurrentExecution]);

  // Close all executions
  const handleCloseAll = useCallback(() => {
    for (const id of Object.keys(executions)) {
      markExecutionClosedByUser(id);
      removeExecution(id);
    }
    setCurrentExecution(null);
  }, [markExecutionClosedByUser, removeExecution, executions, setCurrentExecution]);

  // Open in full page viewer
  const handlePopOut = useCallback(() => {
    const url = currentExecutionId
      ? `/cli-viewer?executionId=${currentExecutionId}`
      : '/cli-viewer';
    navigate(url);
    onClose();
  }, [currentExecutionId, navigate, onClose]);

  // ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (searchQuery) {
          setSearchQuery('');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose, searchQuery]);

  // Cleanup scroll handler timeout on unmount
  useEffect(() => {
    return () => {
      if (handleScrollRef.current) {
        clearTimeout(handleScrollRef.current);
      }
    };
  }, []);

  // Get sorted execution IDs (memoized to avoid unnecessary recalculations)
  const sortedExecutionIds = useMemo(() => {
    return Object.keys(executions).sort((a, b) => {
      const execA = executions[a];
      const execB = executions[b];
      if (execA.status === 'running' && execB.status !== 'running') return -1;
      if (execA.status !== 'running' && execB.status === 'running') return 1;
      return execB.startTime - execA.startTime;
    });
  }, [executions]);

  // Active execution count for badge (memoized)
  const activeCount = useMemo(() => {
    return Object.values(executions).filter(e => e.status === 'running').length;
  }, [executions]);

  // Current execution (memoized)
  const currentExecution = useMemo(() => {
    return currentExecutionId ? executions[currentExecutionId] : null;
  }, [currentExecutionId, executions]);

  // Maximum lines to display (for performance)
  const MAX_DISPLAY_LINES = 1000;

  // Filter output lines based on search (memoized with limit)
  const filteredOutput = useMemo(() => {
    if (!currentExecution) return [];

    let output = currentExecution.output;

    // Apply search filter
    if (searchQuery) {
      output = output.filter(line =>
        line.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Limit display for performance
    if (output.length > MAX_DISPLAY_LINES) {
      return output.slice(-MAX_DISPLAY_LINES);
    }

    return output;
  }, [currentExecution, searchQuery]);

  // Check if output was truncated
  const isOutputTruncated = currentExecution && currentExecution.output.length > MAX_DISPLAY_LINES;

  // Group output lines by type (memoized for performance)
  const groupedOutput = useMemo(() => {
    return groupConsecutiveLinesByType(filteredOutput);
  }, [filteredOutput]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 bg-black/40 transition-opacity z-40',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-[600px] bg-background border-l border-border shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cli-monitor-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex-1 min-w-0 mr-4">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <h2 id="cli-monitor-title" className="text-sm font-semibold text-foreground">
                CLI Stream Monitor
              </h2>
              {activeCount > 0 && (
                <Badge variant="default" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {activeCount} active
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {sortedExecutionIds.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCloseAll}
                title="Close all executions"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePopOut}
              title="Open in full page viewer"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isSyncing}
              title="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Execution Tabs */}
        {sortedExecutionIds.length > 0 && (
          <div className="px-4 pt-3 bg-card border-b border-border">
            <Tabs
              value={currentExecutionId || ''}
              onValueChange={(v) => setCurrentExecution(v || null)}
              className="w-full"
            >
              <TabsList className="w-full h-auto gap-1 bg-secondary/50 p-1 overflow-x-auto overflow-y-hidden no-scrollbar">
                {sortedExecutionIds.map((id) => (
                  <ExecutionTab
                    key={id}
                    execution={{ ...executions[id], id }}
                    isActive={currentExecutionId === id}
                    onClick={() => setCurrentExecution(id)}
                    onClose={(e) => {
                      e.stopPropagation();
                      handleCloseExecution(id);
                    }}
                  />
                ))}
              </TabsList>

              {/* Output Panel */}
              <div className="flex flex-col h-[calc(100vh-180px)]">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-2 py-2 bg-secondary/30 border-b border-border">
                  <div className="flex items-center gap-2 flex-1">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={formatMessage({ id: 'cliMonitor.searchPlaceholder' }) || 'Search output...'}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-7 text-xs"
                    />
                    {searchQuery && (
                      <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')} className="h-7 px-2">
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* View Mode Toggle */}
                    <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'list' | 'blocks')}>
                      <TabsList className="h-7 bg-secondary/50">
                        <TabsTrigger value="list" className="h-6 px-2 text-xs">
                          List
                        </TabsTrigger>
                        <TabsTrigger value="blocks" className="h-6 px-2 text-xs">
                          Blocks
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                    {currentExecution && (
                      <>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(
                            currentExecution.endTime
                              ? currentExecution.endTime - currentExecution.startTime
                              : Date.now() - currentExecution.startTime
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {filteredOutput.length} / {currentExecution.output.length} lines
                        </span>
                      </>
                    )}
                    <Button
                      variant={autoScroll ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setAutoScroll(!autoScroll)}
                      className="h-7 px-2"
                      title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
                    >
                      <ArrowDownToLine className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Output Content - Based on viewMode */}
                {currentExecution ? (
                  <div className="flex-1 overflow-hidden">
                    {viewMode === 'blocks' ? (
                      <div className="h-full overflow-y-auto bg-background">
                        <LogBlockList executionId={currentExecutionId} />
                      </div>
                    ) : (
                      <div
                        ref={logsContainerRef}
                        className="h-full overflow-y-auto p-3 font-mono text-xs bg-background contain-strict"
                        onScroll={handleScroll}
                      >
                        {isOutputTruncated && (
                          <div className="mb-2 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded text-amber-800 dark:text-amber-200 text-xs">
                            Showing last {MAX_DISPLAY_LINES} lines of {currentExecution?.output.length} total lines. Use search to find specific content.
                          </div>
                        )}
                        {filteredOutput.length === 0 ? (
                          <div className="flex items-center justify-center h-full text-muted-foreground">
                            {searchQuery ? 'No matching output found' : 'Waiting for output...'}
                          </div>
                        ) : (
                          <div>
                            {groupedOutput.map((group, groupIndex) => (
                              <MemoizedOutputLineCard
                                key={`group-${group.type}-${groupIndex}`}
                                group={group}
                                onCopy={(content) => navigator.clipboard.writeText(content)}
                              />
                            ))}
                            <div ref={logsEndRef} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-sm">
                        {sortedExecutionIds.length === 0
                          ? (formatMessage({ id: 'cliMonitor.noExecutions' }) || 'No active CLI executions')
                          : (formatMessage({ id: 'cliMonitor.selectExecution' }) || 'Select an execution to view output')
                        }
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Tabs>
          </div>
        )}

        {/* Empty State */}
        {sortedExecutionIds.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Terminal className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-sm mb-1">
                {formatMessage({ id: 'cliMonitor.noExecutions' }) || 'No active CLI executions'}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatMessage({ id: 'cliMonitor.noExecutionsHint' }) || 'Start a CLI command to see streaming output'}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default CliStreamMonitor;
