// ========================================
// SessionGroupTree Component
// ========================================
// Tree view for CLI sessions grouped by tag.
// Sessions are automatically grouped by their tag (e.g., "gemini-143052").

import { useState, useCallback, useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  ChevronRight,
  Terminal,
  Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSessionManagerStore, selectSessionManagerActiveTerminalId, selectTerminalMetas } from '@/stores';
import { useCliSessionStore } from '@/stores/cliSessionStore';
import { useTerminalGridStore, selectTerminalGridPanes } from '@/stores/terminalGridStore';
import { Badge } from '@/components/ui/Badge';
import type { TerminalStatus } from '@/types/terminal-dashboard';

// ========== Status Dot Styles ==========

const statusDotStyles: Record<TerminalStatus, string> = {
  active: 'bg-green-500',
  idle: 'bg-gray-400',
  error: 'bg-red-500',
  paused: 'bg-yellow-500',
  resuming: 'bg-blue-400 animate-pulse',
  locked: 'bg-purple-500',
};

// ========== SessionGroupTree Component ==========

export function SessionGroupTree() {
  const { formatMessage } = useIntl();
  const activeTerminalId = useSessionManagerStore(selectSessionManagerActiveTerminalId);
  const terminalMetas = useSessionManagerStore(selectTerminalMetas);
  const setActiveTerminal = useSessionManagerStore((s) => s.setActiveTerminal);
  const sessions = useCliSessionStore((s) => s.sessions);

  // Grid store for pane management
  const panes = useTerminalGridStore(selectTerminalGridPanes);
  const assignSession = useTerminalGridStore((s) => s.assignSession);
  const setFocused = useTerminalGridStore((s) => s.setFocused);

  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());

  const toggleTag = useCallback((tag: string) => {
    setExpandedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }, []);

  const handleSessionClick = useCallback(
    (sessionId: string) => {
      // Set active terminal in session manager
      setActiveTerminal(sessionId);

      // Find pane that already has this session, or switch focused pane
      const paneWithSession = Object.entries(panes).find(
        ([, pane]) => pane.sessionId === sessionId
      );

      if (paneWithSession) {
        // Focus the pane that has this session
        setFocused(paneWithSession[0]);
      } else {
        // Find focused pane or first pane, and assign session to it
        const focusedPaneId = useTerminalGridStore.getState().focusedPaneId;
        const targetPaneId = focusedPaneId || Object.keys(panes)[0];
        if (targetPaneId) {
          const session = sessions[sessionId];
          assignSession(targetPaneId, sessionId, session?.cliTool ?? session?.tool ?? null);
          setFocused(targetPaneId);
        }
      }
    },
    [setActiveTerminal, panes, setFocused, assignSession]
  );

  // Group sessions by tag
  const sessionsByTag = useMemo(() => {
    const groups: Record<string, { tag: string; sessionIds: string[] }> = {};
    const untagged: string[] = [];

    for (const sessionKey of Object.keys(sessions)) {
      const meta = terminalMetas[sessionKey];
      const tag = meta?.tag;
      if (tag) {
        if (!groups[tag]) {
          groups[tag] = { tag, sessionIds: [] };
        }
        groups[tag].sessionIds.push(sessionKey);
      } else {
        untagged.push(sessionKey);
      }
    }

    // Convert to array and sort by tag name (newest first by time suffix)
    const result = Object.values(groups).sort((a, b) => b.tag.localeCompare(a.tag));

    // Add untagged sessions at the end
    if (untagged.length > 0) {
      result.push({ tag: '__untagged__', sessionIds: untagged });
    }

    return result;
  }, [sessions, terminalMetas]);

  // Build a lookup for session display names
  const sessionNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [key, meta] of Object.entries(sessions)) {
      map[key] = meta.tool ?? meta.shellKind;
    }
    return map;
  }, [sessions]);

  if (Object.keys(sessions).length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex flex-col items-center justify-center gap-1.5 text-muted-foreground p-4">
          <Terminal className="w-6 h-6 opacity-30" />
          <p className="text-xs text-center">
            {formatMessage({ id: 'terminalDashboard.sessionTree.noGroups' })}
          </p>
          <p className="text-[10px] text-muted-foreground/70">
            Click "New Session" to create one
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Session list grouped by tag */}
      <div className="flex-1 overflow-y-auto">
        {sessionsByTag.map((group) => {
          const isExpanded = expandedTags.has(group.tag);
          const isUntagged = group.tag === '__untagged__';
          const displayName = isUntagged ? 'Other Sessions' : group.tag;

          return (
            <div key={group.tag} className="border-b border-border/50 last:border-b-0">
              {/* Tag header */}
              <button
                onClick={() => toggleTag(group.tag)}
                className={cn(
                  'flex items-center gap-1.5 w-full px-3 py-2 text-left',
                  'hover:bg-muted/50 transition-colors text-sm'
                )}
              >
                <ChevronRight
                  className={cn(
                    'w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0',
                    isExpanded && 'rotate-90'
                  )}
                />
                <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate font-medium text-xs">{displayName}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {group.sessionIds.length}
                </Badge>
              </button>

              {/* Expanded: session list */}
              {isExpanded && (
                <div className="pb-1">
                  {group.sessionIds.map((sessionId) => {
                    const meta = terminalMetas[sessionId];
                    const sessionStatus: TerminalStatus = meta?.status ?? 'idle';
                    return (
                      <div
                        key={sessionId}
                        className={cn(
                          'flex items-center gap-1.5 mx-1 px-2 py-1.5 rounded-sm cursor-pointer',
                          'hover:bg-muted/50 transition-colors text-sm',
                          activeTerminalId === sessionId && 'bg-primary/10 text-primary'
                        )}
                        onClick={() => handleSessionClick(sessionId)}
                      >
                        {/* Status indicator dot */}
                        <span
                          className={cn('w-2 h-2 rounded-full shrink-0', statusDotStyles[sessionStatus])}
                          title={sessionStatus}
                        />
                        <Terminal className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate text-xs">
                          {sessionNames[sessionId] ?? sessionId}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SessionGroupTree;
