// ========================================
// CliStreamMonitor Component (New Layout)
// ========================================
// Redesigned CLI streaming monitor with smart parsing and message-based layout

import { useState, useCallback, useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  Terminal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCliStreamStore, type CliOutputLine } from '@/stores/cliStreamStore';
import { useActiveCliExecutions } from '@/hooks/useActiveCliExecutions';
import { useCliStreamWebSocket } from '@/hooks/useCliStreamWebSocket';

// New layout components
import { MonitorHeader } from './MonitorHeader';
import { MonitorToolbar, type FilterType, type ViewMode } from './MonitorToolbar';
import { MonitorBody } from './MonitorBody';
import {
  SystemMessage,
  UserMessage,
  AssistantMessage,
  ErrorMessage,
} from './messages';

// ========== Types ==========
// WebSocket message types are now handled centrally in useCliStreamWebSocket hook

// ========== Message Type Detection ==========

type MessageType = 'system' | 'user' | 'assistant' | 'error';

interface ParsedMessage {
  id: string;
  type: MessageType;
  timestamp: number;
  content: string;
  metadata?: {
    toolName?: string;
    mode?: string;
    status?: string;
    duration?: number;
    tokens?: number;
    model?: string;
  };
  raw?: CliOutputLine;
}

/**
 * Detect message type from output line
 */
function detectMessageType(line: CliOutputLine): MessageType {
  const content = line.content.trim().toLowerCase();

  // Error detection
  if (line.type === 'stderr' ||
      content.includes('error') ||
      content.includes('failed') ||
      content.includes('exception')) {
    return 'error';
  }

  // System message detection
  if (line.type === 'system' ||
      content.startsWith('[system]') ||
      content.startsWith('[info]') ||
      content.includes('cli execution started')) {
    return 'system';
  }

  // User/assistant detection (based on context)
  // For now, default to assistant for stdout
  if (line.type === 'stdout') {
    return 'assistant';
  }

  // Tool call metadata
  if (line.type === 'tool_call') {
    return 'system';
  }

  // Default to assistant
  return 'assistant';
}

/**
 * Parse output lines into structured messages
 */
function parseOutputToMessages(
  executionId: string,
  output: CliOutputLine[]
): ParsedMessage[] {
  const messages: ParsedMessage[] = [];
  let currentMessage: Partial<ParsedMessage> | null = null;

  for (let i = 0; i < output.length; i++) {
    const line = output[i];
    const messageType = detectMessageType(line);

    // Start new message if type changes
    if (!currentMessage || currentMessage.type !== messageType) {
      if (currentMessage && currentMessage.content) {
        messages.push({
          id: `${executionId}-${messages.length}`,
          type: currentMessage.type!,
          timestamp: currentMessage.timestamp!,
          content: currentMessage.content,
          metadata: currentMessage.metadata,
          raw: currentMessage.raw,
        });
      }
      currentMessage = {
        type: messageType,
        timestamp: line.timestamp,
        content: '',
        raw: line,
      };
    }

    // Append content
    const separator = currentMessage.content ? '\n' : '';
    currentMessage.content = currentMessage.content + separator + line.content;
    currentMessage.timestamp = Math.max(currentMessage.timestamp || 0, line.timestamp);

    // Extract metadata from tool calls
    if (line.type === 'tool_call') {
      const toolMatch = line.content.match(/\[Tool\]\s+(\w+)/);
      if (toolMatch) {
        currentMessage.metadata = {
          ...currentMessage.metadata,
          toolName: toolMatch[1],
        };
      }
    }
  }

  // Don't forget the last message
  if (currentMessage && currentMessage.content) {
    messages.push({
      id: `${executionId}-${messages.length}`,
      type: currentMessage.type!,
      timestamp: currentMessage.timestamp!,
      content: currentMessage.content,
      metadata: currentMessage.metadata,
      raw: currentMessage.raw,
    });
  }

  return messages;
}

// ========== Component ==========

export interface CliStreamMonitorNewProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CliStreamMonitorNew({ isOpen, onClose }: CliStreamMonitorNewProps) {
  const { formatMessage } = useIntl();

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('preview');

  // Store state
  const executions = useCliStreamStore((state) => state.executions);
  const currentExecutionId = useCliStreamStore((state) => state.currentExecutionId);
  const removeExecution = useCliStreamStore((state) => state.removeExecution);

  // Active execution sync
  const { isLoading: isSyncing, refetch } = useActiveCliExecutions(isOpen);

  // CENTRALIZED WebSocket handler - processes each message only once globally
  useCliStreamWebSocket();

  // Get execution stats
  const executionStats = useMemo(() => {
    const all = Object.values(executions);
    return {
      total: all.length,
      active: all.filter(e => e.status === 'running').length,
      error: all.filter(e => e.status === 'error').length,
      completed: all.filter(e => e.status === 'completed').length,
    };
  }, [executions]);

  // Get current execution
  const currentExecution = currentExecutionId ? executions[currentExecutionId] : null;

  // Parse messages from current execution
  const messages = useMemo(() => {
    if (!currentExecution?.output) return [];
    return parseOutputToMessages(currentExecutionId || '', currentExecution.output);
  }, [currentExecution?.output, currentExecutionId]);

  // Filter messages
  const filteredMessages = useMemo(() => {
    let filtered = messages;

    // Apply type filter
    if (filter !== 'all') {
      filtered = filtered.filter(m => {
        if (filter === 'errors') return m.type === 'error';
        if (filter === 'content') return m.type === 'user' || m.type === 'assistant';
        if (filter === 'system') return m.type === 'system';
        return true;
      });
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        m.content.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [messages, filter, searchQuery]);

  // Copy message content
  const handleCopy = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  // Handle message actions
  const handleRetry = useCallback((executionId: string) => {
    // TODO: Implement retry logic
    console.log('Retry execution:', executionId);
  }, []);

  const handleDismiss = useCallback((executionId: string) => {
    removeExecution(executionId);
  }, [removeExecution]);

  // Don't render if not open
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

      {/* Main Panel */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-[1568px] bg-background border-l border-border shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cli-monitor-title"
      >
        {/* Header */}
        <MonitorHeader
          onClose={onClose}
          activeCount={executionStats.active}
          totalCount={executionStats.total}
          errorCount={executionStats.error}
        />

        {/* Toolbar */}
        <MonitorToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filter={filter}
          onFilterChange={setFilter}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Body */}
        <MonitorBody autoScroll={true}>
          {currentExecution ? (
            <div className="space-y-4 p-4">
              {filteredMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  {searchQuery
                    ? formatMessage({ id: 'cliMonitor.noMatch' })
                    : formatMessage({ id: 'cliMonitor.noMessages' })
                  }
                </div>
              ) : (
                filteredMessages.map((message) => {
                  switch (message.type) {
                    case 'system':
                      return (
                        <SystemMessage
                          key={message.id}
                          title={message.metadata?.toolName || 'System Message'}
                          timestamp={message.timestamp}
                          metadata={`Mode: ${message.metadata?.mode || 'N/A'}`}
                          content={message.content}
                        />
                      );

                    case 'user':
                      return (
                        <UserMessage
                          key={message.id}
                          content={message.content}
                          timestamp={message.timestamp}
                          onCopy={() => handleCopy(message.content)}
                        />
                      );

                    case 'assistant':
                      return (
                        <AssistantMessage
                          key={message.id}
                          modelName={message.metadata?.model || 'AI Assistant'}
                          status={message.metadata?.status === 'thinking' ? 'thinking' : 'completed'}
                          content={message.content}
                          timestamp={message.timestamp}
                          duration={message.metadata?.duration}
                          tokenCount={message.metadata?.tokens}
                          onCopy={() => handleCopy(message.content)}
                        />
                      );

                    case 'error':
                      return (
                        <ErrorMessage
                          key={message.id}
                          title="Error"
                          message={message.content}
                          timestamp={message.timestamp}
                          onRetry={() => handleRetry(currentExecutionId!)}
                          onDismiss={() => handleDismiss(currentExecutionId!)}
                        />
                      );

                    default:
                      return null;
                  }
                })
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Terminal className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-sm mb-1">{formatMessage({ id: 'cliMonitor.noExecutions' })}</p>
                <p className="text-xs text-muted-foreground">
                  {formatMessage({ id: 'cliMonitor.noExecutionsHint' })}
                </p>
              </div>
            </div>
          )}
        </MonitorBody>

        {/* Status Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-t border-border text-xs text-muted-foreground">
          <span>
            {formatMessage(
              { id: 'cliMonitor.statusBar' },
              {
                total: executionStats.total,
                active: executionStats.active,
                error: executionStats.error,
                lines: currentExecution?.output.length || 0
              }
            )}
          </span>
          <button
            onClick={() => refetch()}
            disabled={isSyncing}
            className="hover:text-foreground transition-colors disabled:opacity-50"
          >
            {isSyncing
              ? formatMessage({ id: 'cliMonitor.refreshing' })
              : formatMessage({ id: 'cliMonitor.refresh' })
            }
          </button>
        </div>
      </div>
    </>
  );
}

export default CliStreamMonitorNew;
