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
import { SessionTimeline } from './SessionTimeline';

// ========== Types ==========

export interface NativeSessionPanelProps {
  executionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ========== Helpers ==========

/**
 * Get badge variant for tool name
 */
function getToolVariant(tool: string): 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'info' {
  const variants: Record<string, 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'info'> = {
    gemini: 'info',
    codex: 'success',
    qwen: 'warning',
    opencode: 'secondary',
  };
  return variants[tool?.toLowerCase()] || 'secondary';
}

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
 */
export function NativeSessionPanel({
  executionId,
  open,
  onOpenChange,
}: NativeSessionPanelProps) {
  const { formatMessage } = useIntl();
  const { data: session, isLoading, error } = useNativeSession(open ? executionId : null);

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
            {session && (
              <div className="flex items-center gap-2">
                <Badge variant={getToolVariant(session.tool)}>
                  {session.tool.toUpperCase()}
                </Badge>
                {session.model && (
                  <Badge variant="secondary" className="text-xs">
                    {session.model}
                  </Badge>
                )}
                <span
                  className="text-xs text-muted-foreground font-mono"
                  title={session.sessionId}
                >
                  {truncate(session.sessionId, 16)}
                </span>
              </div>
            )}
          </div>
          {session && (
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-2">
              <span className="flex items-center gap-1" title={formatMessage({ id: 'nativeSession.meta.startTime', defaultMessage: 'Start time' })}>
                <Clock className="h-3 w-3" />
                {new Date(session.startTime).toLocaleString()}
              </span>
              {session.workingDir && (
                <span className="flex items-center gap-1" title={formatMessage({ id: 'nativeSession.meta.workingDir', defaultMessage: 'Working directory' })}>
                  <FolderOpen className="h-3 w-3" />
                  <span className="font-mono max-w-48 truncate">{session.workingDir}</span>
                </span>
              )}
              {session.projectHash && (
                <span className="flex items-center gap-1" title={formatMessage({ id: 'nativeSession.meta.projectHash', defaultMessage: 'Project hash' })}>
                  <Hash className="h-3 w-3" />
                  <span className="font-mono">{truncate(session.projectHash, 12)}</span>
                </span>
              )}
              <span>{session.turns.length} {formatMessage({ id: 'nativeSession.meta.turns', defaultMessage: 'turns' })}</span>
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
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{formatMessage({ id: 'nativeSession.error', defaultMessage: 'Failed to load session' })}</span>
            </div>
          </div>
        ) : session ? (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <SessionTimeline session={session} />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center py-16 text-muted-foreground">
            {formatMessage({ id: 'nativeSession.empty', defaultMessage: 'No session data available' })}
          </div>
        )}

        {/* Footer Actions */}
        {session && (
          <div className="flex items-center gap-2 px-6 py-4 border-t bg-muted/30 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCopy(session.sessionId, 'sessionId')}
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
                const json = JSON.stringify(session, null, 2);
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
