// ========================================
// SessionPreviewPanel Component
// ========================================
// Preview and select sessions for Memory V2 extraction

import { useState, useMemo } from 'react';
import { useIntl } from 'react-intl';
import { formatDistanceToNow } from 'date-fns';
import { Search, Eye, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import {
  usePreviewSessions,
  useTriggerSelectiveExtraction,
} from '@/hooks/useMemoryV2';
import { cn } from '@/lib/utils';

interface SessionPreviewPanelProps {
  onClose?: () => void;
  onExtractComplete?: () => void;
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Helper function to format timestamp
function formatTimestamp(timestamp: number): string {
  try {
    const date = new Date(timestamp);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return '-';
  }
}

export function SessionPreviewPanel({ onClose, onExtractComplete }: SessionPreviewPanelProps) {
  const intl = useIntl();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [includeNative, setIncludeNative] = useState(false);

  const { data, isLoading, refetch } = usePreviewSessions(includeNative);
  const triggerExtraction = useTriggerSelectiveExtraction();

  // Filter sessions based on search query
  const filteredSessions = useMemo(() => {
    if (!data?.sessions) return [];
    if (!searchQuery.trim()) return data.sessions;

    const query = searchQuery.toLowerCase();
    return data.sessions.filter(
      (session) =>
        session.sessionId.toLowerCase().includes(query) ||
        session.tool.toLowerCase().includes(query) ||
        session.source.toLowerCase().includes(query)
    );
  }, [data?.sessions, searchQuery]);

  // Get ready sessions (eligible and not extracted)
  const readySessions = useMemo(() => {
    return filteredSessions.filter((s) => s.eligible && !s.extracted);
  }, [filteredSessions]);

  // Toggle session selection
  const toggleSelection = (sessionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  // Select all ready sessions
  const selectAll = () => {
    setSelectedIds(new Set(readySessions.map((s) => s.sessionId)));
  };

  // Clear selection
  const selectNone = () => {
    setSelectedIds(new Set());
  };

  // Trigger extraction for selected sessions
  const handleExtract = async () => {
    if (selectedIds.size === 0) return;

    triggerExtraction.mutate(
      {
        sessionIds: Array.from(selectedIds),
        includeNative,
      },
      {
        onSuccess: () => {
          setSelectedIds(new Set());
          onExtractComplete?.();
        },
      }
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Eye className="w-5 h-5" />
          {intl.formatMessage({ id: 'memory.v2.preview.title', defaultMessage: 'Extraction Queue Preview' })}
        </h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={includeNative}
              onCheckedChange={(checked) => setIncludeNative(checked === true)}
            />
            {intl.formatMessage({ id: 'memory.v2.preview.includeNative', defaultMessage: 'Include Native Sessions' })}
          </label>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Refresh'
            )}
          </Button>
        </div>
      </div>

      {/* Summary Bar */}
      {data?.summary && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="text-center p-2 bg-muted rounded">
            <div className="text-lg font-bold">{data.summary.total}</div>
            <div className="text-xs text-muted-foreground">
              {intl.formatMessage({ id: 'memory.v2.preview.total', defaultMessage: 'Total' })}
            </div>
          </div>
          <div className="text-center p-2 bg-muted rounded">
            <div className="text-lg font-bold text-blue-600">{data.summary.eligible}</div>
            <div className="text-xs text-muted-foreground">
              {intl.formatMessage({ id: 'memory.v2.preview.eligible', defaultMessage: 'Eligible' })}
            </div>
          </div>
          <div className="text-center p-2 bg-muted rounded">
            <div className="text-lg font-bold text-green-600">{data.summary.alreadyExtracted}</div>
            <div className="text-xs text-muted-foreground">
              {intl.formatMessage({ id: 'memory.v2.preview.extracted', defaultMessage: 'Already Extracted' })}
            </div>
          </div>
          <div className="text-center p-2 bg-muted rounded">
            <div className="text-lg font-bold text-amber-600">{data.summary.readyForExtraction}</div>
            <div className="text-xs text-muted-foreground">
              {intl.formatMessage({ id: 'memory.v2.preview.ready', defaultMessage: 'Ready' })}
            </div>
          </div>
        </div>
      )}

      {/* Search and Actions */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={intl.formatMessage({
              id: 'memory.v2.preview.selectSessions',
              defaultMessage: 'Search sessions...',
            })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={selectAll}>
          {intl.formatMessage({ id: 'memory.v2.preview.selectAll', defaultMessage: 'Select All' })}
        </Button>
        <Button variant="outline" size="sm" onClick={selectNone}>
          {intl.formatMessage({ id: 'memory.v2.preview.selectNone', defaultMessage: 'Select None' })}
        </Button>
      </div>

      {/* Session Table */}
      <div className="flex-1 overflow-auto border rounded-lg">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            {intl.formatMessage({ id: 'memory.v2.preview.noSessions', defaultMessage: 'No sessions found' })}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="w-10 p-2"></th>
                <th className="text-left p-2">Source</th>
                <th className="text-left p-2">Session ID</th>
                <th className="text-left p-2">Tool</th>
                <th className="text-left p-2">Timestamp</th>
                <th className="text-right p-2">Size</th>
                <th className="text-right p-2">Turns</th>
                <th className="text-center p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map((session) => {
                const isReady = session.eligible && !session.extracted;
                const isSelected = selectedIds.has(session.sessionId);
                const isDisabled = !isReady;

                return (
                  <tr
                    key={session.sessionId}
                    className={cn(
                      'border-b hover:bg-muted/50 transition-colors',
                      isDisabled && 'opacity-60',
                      isSelected && 'bg-blue-50 dark:bg-blue-950/20'
                    )}
                  >
                    <td className="p-2">
                      <Checkbox
                        checked={isSelected}
                        disabled={isDisabled}
                        onCheckedChange={() => toggleSelection(session.sessionId)}
                      />
                    </td>
                    <td className="p-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          session.source === 'ccw'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                            : 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300'
                        )}
                      >
                        {session.source === 'ccw'
                          ? intl.formatMessage({ id: 'memory.v2.preview.sourceCcw', defaultMessage: 'CCW' })
                          : intl.formatMessage({ id: 'memory.v2.preview.sourceNative', defaultMessage: 'Native' })}
                      </Badge>
                    </td>
                    <td className="p-2 font-mono text-xs truncate max-w-[150px]" title={session.sessionId}>
                      {session.sessionId}
                    </td>
                    <td className="p-2 truncate max-w-[100px]" title={session.tool}>
                      {session.tool || '-'}
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {formatTimestamp(session.timestamp)}
                    </td>
                    <td className="p-2 text-right font-mono text-xs">
                      {formatBytes(session.bytes)}
                    </td>
                    <td className="p-2 text-right">
                      {session.turns}
                    </td>
                    <td className="p-2 text-center">
                      {session.extracted ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          {intl.formatMessage({ id: 'memory.v2.preview.extracted', defaultMessage: 'Extracted' })}
                        </Badge>
                      ) : session.eligible ? (
                        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                          <Clock className="w-3 h-3 mr-1" />
                          {intl.formatMessage({ id: 'memory.v2.preview.ready', defaultMessage: 'Ready' })}
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                          <XCircle className="w-3 h-3 mr-1" />
                          {intl.formatMessage({ id: 'memory.v2.preview.ineligible', defaultMessage: 'Ineligible' })}
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t">
        <div className="text-sm text-muted-foreground">
          {selectedIds.size > 0 ? (
            intl.formatMessage(
              { id: 'memory.v2.preview.selected', defaultMessage: '{count} sessions selected' },
              { count: selectedIds.size }
            )
          ) : (
            intl.formatMessage({ id: 'memory.v2.preview.selectHint', defaultMessage: 'Select sessions to extract' })
          )}
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              {intl.formatMessage({ id: 'common.close', defaultMessage: 'Close' })}
            </Button>
          )}
          <Button
            onClick={handleExtract}
            disabled={selectedIds.size === 0 || triggerExtraction.isPending}
          >
            {triggerExtraction.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                {intl.formatMessage({ id: 'memory.v2.extraction.extracting', defaultMessage: 'Extracting...' })}
              </>
            ) : (
              intl.formatMessage(
                { id: 'memory.v2.preview.extractSelected', defaultMessage: 'Extract Selected ({count})' },
                { count: selectedIds.size }
              )
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SessionPreviewPanel;
