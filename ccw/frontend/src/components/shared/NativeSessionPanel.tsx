// ========================================
// NativeSessionPanel Component
// ========================================
// Dialog for displaying native CLI session content (Gemini/Codex/Qwen)

import * as React from 'react';
import { useIntl } from 'react-intl';
import {
  Copy,
  Clock,
  Hash,
  FolderOpen,
  FileJson,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { useNativeSession } from '@/hooks/useNativeSession';
import { useNativeSessionByPath } from '@/hooks/useNativeSessionByPath';
import { SessionTimeline } from './SessionTimeline';
import { getToolVariant } from '@/lib/cli-tool-theme';
import type { NativeSessionListItem } from '@/lib/api';

// ========== Types ==========

export interface NativeSessionPanelProps {
  /** Legacy: CCW execution ID for lookup */
  executionId?: string;
  /** New: Session metadata with path for direct file loading */
  session?: NativeSessionListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ========== Helpers ==========

/**
 * Truncate a string to a max length with ellipsis
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ========== Main Component ==========

/**
 * NativeSessionPanel - Dialog for displaying native CLI session content
 *
 * Shows session metadata, token summary, and all conversation turns
 * with thoughts and tool calls for Gemini/Codex/Qwen native sessions.
 *
 * Supports two modes:
 * - executionId: Look up session via CCW database
 * - session: Load session directly from file path
 */
export function NativeSessionPanel({
  executionId,
  session,
  open,
  onOpenChange,
}: NativeSessionPanelProps) {
  const { formatMessage } = useIntl();

  // Use appropriate hook based on what's provided
  // Priority: session (path-based) > executionId (lookup-based)
  const pathBasedResult = useNativeSessionByPath(
    open && session ? session.filePath : null,
    session?.tool
  );

  const idBasedResult = useNativeSession(
    open && !session && executionId ? executionId : null
  );

  // Determine which result to use
  const { data, isLoading, error } = session
    ? pathBasedResult
    : idBasedResult;

  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  const handleCopy = React.useCallback(async (text: string, field: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5" />
              {formatMessage({ id: 'nativeSession.title', defaultMessage: 'Native Session' })}
            </DialogTitle>
            {(data || session) && (
              <div className="flex items-center gap-2">
                <Badge variant={getToolVariant(data?.tool || session?.tool || 'claude')}>
                  {(data?.tool || session?.tool || 'unknown').toUpperCase()}
                </Badge>
                {data?.model && (
                  <Badge variant="secondary" className="text-xs">
                    {data.model}
                  </Badge>
                )}
                {(data?.sessionId || session?.sessionId) && (
                  <span
                    className="text-xs text-muted-foreground font-mono"
                    title={data?.sessionId || session?.sessionId}
                  >
                    {truncate(data?.sessionId || session?.sessionId || '', 16)}
                  </span>
                )}
              </div>
            )}
          </div>
          {(data || session) && (
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-2">
              <span className="flex items-center gap-1" title={formatMessage({ id: 'nativeSession.meta.startTime', defaultMessage: 'Start time' })}>
                <Clock className="h-3 w-3" />
                {new Date(data?.startTime || session?.createdAt || '').toLocaleString()}
              </span>
              {(data?.workingDir || session?.projectHash) && (
                <span className="flex items-center gap-1" title={formatMessage({ id: 'nativeSession.meta.workingDir', defaultMessage: 'Working directory' })}>
                  <FolderOpen className="h-3 w-3" />
                  <span className="font-mono max-w-48 truncate">{data?.workingDir || session?.projectHash}</span>
                </span>
              )}
              {data?.projectHash && (
                <span className="flex items-center gap-1" title={formatMessage({ id: 'nativeSession.meta.projectHash', defaultMessage: 'Project hash' })}>
                  <Hash className="h-3 w-3" />
                  <span className="font-mono">{truncate(data.projectHash, 12)}</span>
                </span>
              )}
              {data && <span>{data.turns.length} {formatMessage({ id: 'nativeSession.meta.turns', defaultMessage: 'turns' })}</span>}
            </div>
          )}
        </DialogHeader>

        {/* Content Area with SessionTimeline */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{formatMessage({ id: 'nativeSession.loading', defaultMessage: 'Loading session...' })}</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 gap-3">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{formatMessage({ id: 'nativeSession.error', defaultMessage: 'Failed to load session' })}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'nativeSession.errorHint', defaultMessage: 'The session file may have been moved or deleted.' })}
            </p>
          </div>
        ) : data ? (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <SessionTimeline session={data} />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center py-16 text-muted-foreground">
            {formatMessage({ id: 'nativeSession.empty', defaultMessage: 'No session data available' })}
          </div>
        )}

        {/* Footer Actions */}
        {data && (
          <div className="flex items-center gap-2 px-6 py-4 border-t bg-muted/30 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCopy(data.sessionId, 'sessionId')}
              className="h-8"
            >
              <Copy className="h-4 w-4 mr-2" />
              {copiedField === 'sessionId'
                ? formatMessage({ id: 'nativeSession.footer.copied', defaultMessage: 'Copied!' })
                : formatMessage({ id: 'nativeSession.footer.copySessionId', defaultMessage: 'Copy Session ID' })}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const json = JSON.stringify(data, null, 2);
                handleCopy(json, 'json');
              }}
              className="h-8"
            >
              <FileJson className="h-4 w-4 mr-2" />
              {copiedField === 'json'
                ? formatMessage({ id: 'nativeSession.footer.copied', defaultMessage: 'Copied!' })
                : formatMessage({ id: 'nativeSession.footer.exportJson', defaultMessage: 'Export JSON' })}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
