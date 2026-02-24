// ========================================
// useCliSessionCore Hook
// ========================================
// Shared CLI session lifecycle management extracted from
// QueueExecuteInSession, QueueSendToOrchestrator, and IssueTerminalTab.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createCliSession,
  fetchCliSessions,
  type CliSession,
} from '@/lib/api';
import { useCliSessionStore } from '@/stores/cliSessionStore';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseCliSessionCoreOptions {
  /** When true, auto-select the most recent session on load. Defaults to true. */
  autoSelectLast?: boolean;
  /** Default resumeKey used when creating sessions via ensureSession/handleCreateSession. */
  resumeKey?: string;
  /** Shell to use when creating new sessions. Defaults to 'bash'. */
  preferredShell?: 'bash' | 'pwsh';
  /** Additional createCliSession fields (cols, rows, tool, model). */
  createSessionDefaults?: {
    cols?: number;
    rows?: number;
    tool?: string;
    model?: string;
  };
}

export interface UseCliSessionCoreReturn {
  /** Sorted list of CLI sessions (oldest first). */
  sessions: CliSession[];
  /** Currently selected session key. */
  selectedSessionKey: string;
  /** Setter for selected session key. */
  setSelectedSessionKey: (key: string) => void;
  /** Refresh sessions from the backend. */
  refreshSessions: () => Promise<void>;
  /** Return the current session key, creating one if none is selected. */
  ensureSession: () => Promise<string>;
  /** Explicitly create a new session and select it. */
  handleCreateSession: () => Promise<void>;
  /** True while sessions are being fetched. */
  isLoading: boolean;
  /** Last error message, or null. */
  error: string | null;
  /** Clear the current error. */
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCliSessionCore(options: UseCliSessionCoreOptions = {}): UseCliSessionCoreReturn {
  const {
    autoSelectLast = true,
    resumeKey,
    preferredShell = 'bash',
    createSessionDefaults,
  } = options;

  const projectPath = useWorkflowStore(selectProjectPath);

  // Store selectors
  const sessionsByKey = useCliSessionStore((s) => s.sessions);
  const setSessions = useCliSessionStore((s) => s.setSessions);
  const upsertSession = useCliSessionStore((s) => s.upsertSession);

  // Derived sorted list (oldest first)
  const sessions = useMemo(
    () =>
      Object.values(sessionsByKey).sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt)
      ),
    [sessionsByKey]
  );

  // Local state
  const [selectedSessionKey, setSelectedSessionKey] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // ------- refreshSessions -------
  const refreshSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const r = await fetchCliSessions(projectPath || undefined);
      setSessions(r.sessions);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }, [projectPath, setSessions]);

  // Fetch on mount / when projectPath changes
  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  // Auto-select the last (most recent) session
  useEffect(() => {
    if (!autoSelectLast) return;
    if (selectedSessionKey) return;
    if (sessions.length === 0) return;
    setSelectedSessionKey(sessions[sessions.length - 1]?.sessionKey ?? '');
  }, [sessions, selectedSessionKey, autoSelectLast]);

  // ------- ensureSession -------
  const ensureSession = useCallback(async (): Promise<string> => {
    if (selectedSessionKey) return selectedSessionKey;
    if (!projectPath) throw new Error('No project path selected');
    const created = await createCliSession(
      {
        workingDir: projectPath,
        preferredShell,
        resumeKey,
        ...createSessionDefaults,
      },
      projectPath
    );
    upsertSession(created.session);
    setSelectedSessionKey(created.session.sessionKey);
    return created.session.sessionKey;
  }, [selectedSessionKey, projectPath, resumeKey, preferredShell, createSessionDefaults, upsertSession]);

  // ------- handleCreateSession -------
  const handleCreateSession = useCallback(async () => {
    setError(null);
    try {
      if (!projectPath) throw new Error('No project path selected');
      const created = await createCliSession(
        {
          workingDir: projectPath,
          preferredShell,
          resumeKey,
          ...createSessionDefaults,
        },
        projectPath
      );
      upsertSession(created.session);
      setSelectedSessionKey(created.session.sessionKey);
      // Refresh full list so store stays consistent
      const r = await fetchCliSessions(projectPath || undefined);
      setSessions(r.sessions);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [projectPath, resumeKey, preferredShell, createSessionDefaults, upsertSession, setSessions]);

  return {
    sessions,
    selectedSessionKey,
    setSelectedSessionKey,
    refreshSessions,
    ensureSession,
    handleCreateSession,
    isLoading,
    error,
    clearError,
  };
}
