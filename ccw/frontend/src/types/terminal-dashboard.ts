// ========================================
// Terminal Dashboard Types
// ========================================
// TypeScript interfaces for sessionManagerStore and issueQueueIntegrationStore.
// Domain types for the terminal execution management dashboard.

// ========== Session Manager Types ==========

/** Grid layout preset for terminal workbench */
export type SessionGridLayout = '1x1' | '1x2' | '2x1' | '2x2';

/** Terminal session layout configuration */
export interface SessionLayout {
  /** Grid preset */
  grid: SessionGridLayout;
  /** Split ratios for each pane (normalized 0-1) */
  splits: number[];
}

/** Terminal status indicator */
export type TerminalStatus = 'active' | 'idle' | 'error' | 'paused' | 'resuming' | 'locked';

/** Metadata for a terminal instance in the dashboard */
export interface TerminalMeta {
  /** Display title for the terminal tab */
  title: string;
  /** Current terminal status */
  status: TerminalStatus;
  /** Number of unread alerts (errors, warnings) */
  alertCount: number;
  /** Session tag for grouping (e.g., "gemini-143052") */
  tag?: string;
  /** Whether the session is locked (executing a workflow) */
  isLocked?: boolean;
  /** Reason for the lock (e.g., workflow name) */
  lockReason?: string;
  /** Execution ID that locked this session */
  lockedByExecutionId?: string;
  /** Timestamp when the session was locked */
  lockedAt?: string;
}

/** Group of terminal sessions */
export interface SessionGroup {
  /** Unique group identifier */
  id: string;
  /** Display name */
  name: string;
  /** Ordered list of session keys belonging to this group */
  sessionIds: string[];
}

/** Session Manager store state (data only) */
export interface SessionManagerState {
  /** All session groups */
  groups: SessionGroup[];
  /** Current terminal layout configuration */
  layout: SessionLayout;
  /** Currently active terminal session key */
  activeTerminalId: string | null;
  /** Per-terminal metadata keyed by session key */
  terminalMetas: Record<string, TerminalMeta>;
}

/** Alert severity from the monitor worker */
export type AlertSeverity = 'critical' | 'warning';

/** Alert message posted from the monitor worker */
export interface MonitorAlert {
  type: 'alert';
  sessionId: string;
  severity: AlertSeverity;
  message: string;
}

/** Session Manager store actions */
export interface SessionManagerActions {
  /** Create a new session group */
  createGroup: (name: string) => void;
  /** Remove a session group by ID */
  removeGroup: (groupId: string) => void;
  /** Move a session to a different group */
  moveSessionToGroup: (sessionId: string, groupId: string) => void;
  /** Set the active terminal by session key */
  setActiveTerminal: (sessionId: string | null) => void;
  /** Update metadata for a specific terminal */
  updateTerminalMeta: (sessionId: string, meta: Partial<TerminalMeta>) => void;
  /** Set the terminal grid layout */
  setGroupLayout: (layout: SessionLayout) => void;
  /** Spawn the monitor Web Worker (idempotent) */
  spawnMonitor: () => void;
  /** Terminate the monitor Web Worker */
  terminateMonitor: () => void;
  /** Forward a terminal output chunk to the monitor worker */
  feedMonitor: (sessionId: string, text: string) => void;
  /** Pause a terminal session (SIGSTOP) */
  pauseSession: (terminalId: string) => Promise<void>;
  /** Resume a paused terminal session (SIGCONT) */
  resumeSession: (terminalId: string) => Promise<void>;
  /** Restart a terminal session (close and recreate with same config) */
  restartSession: (terminalId: string) => Promise<void>;
  /** Close and terminate a terminal session permanently */
  closeSession: (terminalId: string) => Promise<void>;
  /** Lock a session to prevent user input during workflow execution */
  lockSession: (sessionId: string, reason: string, executionId?: string) => void;
  /** Unlock a session after workflow execution completes */
  unlockSession: (sessionId: string) => void;
}

export type SessionManagerStore = SessionManagerState & SessionManagerActions;

// ========== Issue Queue Integration Types ==========

/** Association chain linking an issue, queue item, and terminal session */
export interface AssociationChain {
  /** Issue identifier (e.g., 'GH-123') */
  issueId: string | null;
  /** Queue item identifier (e.g., 'Q-456') */
  queueItemId: string | null;
  /** Terminal session key (e.g., 'T-789') */
  sessionId: string | null;
}

/** Issue Queue Integration store state (data only) */
export interface IssueQueueIntegrationState {
  /** Currently selected issue ID for highlight linkage */
  selectedIssueId: string | null;
  /** Current association chain resolved from any selected entity */
  associationChain: AssociationChain | null;
}

/** Issue Queue Integration store actions */
export interface IssueQueueIntegrationActions {
  /** Set the selected issue ID and trigger association chain resolution */
  setSelectedIssue: (issueId: string | null) => void;
  /** Build a full association chain from any entity ID (issue, queue item, or session) */
  buildAssociationChain: (entityId: string, entityType: 'issue' | 'queue' | 'session') => void;
  /** Internal: update queue item status bridging to queueExecutionStore */
  _updateQueueItemStatus: (queueItemId: string, status: string, sessionId?: string) => void;
}

export type IssueQueueIntegrationStore = IssueQueueIntegrationState & IssueQueueIntegrationActions;
