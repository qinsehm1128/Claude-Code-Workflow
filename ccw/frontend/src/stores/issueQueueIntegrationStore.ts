// ========================================
// Issue Queue Integration Store
// ========================================
// Zustand store bridging issue/queue data with execution tracking.
// Manages association chain state for highlight linkage across
// Issue <-> QueueItem <-> Terminal Session.
//
// Design principles:
// - Does NOT duplicate issues[]/queue[] arrays (use React Query hooks for data)
// - Bridges queueExecutionStore via getState() for execution status
// - Manages UI-specific integration state (selection, association chain)

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  AssociationChain,
  IssueQueueIntegrationState,
  IssueQueueIntegrationStore,
} from '../types/terminal-dashboard';
import { useQueueExecutionStore } from './queueExecutionStore';

// ========== Initial State ==========

const initialState: IssueQueueIntegrationState = {
  selectedIssueId: null,
  associationChain: null,
};

// ========== Store ==========

export const useIssueQueueIntegrationStore = create<IssueQueueIntegrationStore>()(
  devtools(
    (set) => ({
      ...initialState,

      // ========== Issue Selection ==========

      setSelectedIssue: (issueId: string | null) => {
        if (issueId === null) {
          set(
            { selectedIssueId: null, associationChain: null },
            false,
            'setSelectedIssue/clear'
          );
          return;
        }
        // Resolve association chain from issue ID
        const chain = resolveChainFromIssue(issueId);
        set(
          { selectedIssueId: issueId, associationChain: chain },
          false,
          'setSelectedIssue'
        );
      },

      // ========== Association Chain ==========

      buildAssociationChain: (
        entityId: string,
        entityType: 'issue' | 'queue' | 'session'
      ) => {
        let chain: AssociationChain;

        switch (entityType) {
          case 'issue':
            chain = resolveChainFromIssue(entityId);
            break;
          case 'queue':
            chain = resolveChainFromQueueItem(entityId);
            break;
          case 'session':
            chain = resolveChainFromSession(entityId);
            break;
          default:
            chain = { issueId: null, queueItemId: null, sessionId: null };
        }

        set(
          {
            associationChain: chain,
            selectedIssueId: chain.issueId,
          },
          false,
          'buildAssociationChain'
        );
      },

      // ========== Queue Status Bridge ==========

      _updateQueueItemStatus: (
        queueItemId: string,
        status: string,
        sessionId?: string
      ) => {
        // Bridge to queueExecutionStore for execution tracking
        const execStore = useQueueExecutionStore.getState();
        const executions = Object.values(execStore.executions);
        const matchedExec = executions.find(
          (e) => e.queueItemId === queueItemId
        );

        if (matchedExec) {
          // Update status in the execution store
          const validStatuses = ['pending', 'running', 'completed', 'failed'] as const;
          type ValidStatus = (typeof validStatuses)[number];
          if (validStatuses.includes(status as ValidStatus)) {
            execStore.updateStatus(matchedExec.id, status as ValidStatus);
          }
        }

        // If a sessionId is provided, update the association chain
        if (sessionId) {
          set(
            (state) => {
              if (
                state.associationChain &&
                state.associationChain.queueItemId === queueItemId
              ) {
                return {
                  associationChain: {
                    ...state.associationChain,
                    sessionId,
                  },
                };
              }
              return state;
            },
            false,
            '_updateQueueItemStatus'
          );
        }
      },
    }),
    { name: 'IssueQueueIntegrationStore' }
  )
);

// ========== Chain Resolution Helpers ==========

/**
 * Resolve association chain starting from an issue ID.
 * Looks up queueExecutionStore to find linked queue items and sessions.
 */
function resolveChainFromIssue(issueId: string): AssociationChain {
  const executions = Object.values(
    useQueueExecutionStore.getState().executions
  );
  // Find the first execution matching this issue
  const matched = executions.find((e) => e.issueId === issueId);
  if (matched) {
    return {
      issueId,
      queueItemId: matched.queueItemId,
      sessionId: matched.sessionKey ?? null,
    };
  }
  return { issueId, queueItemId: null, sessionId: null };
}

/**
 * Resolve association chain starting from a queue item ID.
 * Looks up queueExecutionStore to find linked issue and session.
 */
function resolveChainFromQueueItem(queueItemId: string): AssociationChain {
  const executions = Object.values(
    useQueueExecutionStore.getState().executions
  );
  const matched = executions.find((e) => e.queueItemId === queueItemId);
  if (matched) {
    return {
      issueId: matched.issueId,
      queueItemId,
      sessionId: matched.sessionKey ?? null,
    };
  }
  return { issueId: null, queueItemId, sessionId: null };
}

/**
 * Resolve association chain starting from a session key.
 * Looks up queueExecutionStore to find linked issue and queue item.
 */
function resolveChainFromSession(sessionId: string): AssociationChain {
  const executions = Object.values(
    useQueueExecutionStore.getState().executions
  );
  const matched = executions.find((e) => e.sessionKey === sessionId);
  if (matched) {
    return {
      issueId: matched.issueId,
      queueItemId: matched.queueItemId,
      sessionId,
    };
  }
  return { issueId: null, queueItemId: null, sessionId };
}

// ========== Selectors ==========

/** Select currently selected issue ID */
export const selectSelectedIssueId = (state: IssueQueueIntegrationStore) =>
  state.selectedIssueId;

/** Select current association chain */
export const selectAssociationChain = (state: IssueQueueIntegrationStore) =>
  state.associationChain;

/**
 * Select queue executions for a specific issue.
 * WARNING: Returns new array each call - use with useMemo in components.
 */
export const selectQueueByIssue =
  (issueId: string) =>
  (): import('./queueExecutionStore').QueueExecution[] => {
    const executions = Object.values(
      useQueueExecutionStore.getState().executions
    );
    return executions.filter((e) => e.issueId === issueId);
  };

/**
 * Select an issue's execution by issue ID (first matched).
 * Returns the execution record or undefined.
 */
export const selectIssueById =
  (issueId: string) =>
  (): import('./queueExecutionStore').QueueExecution | undefined => {
    const executions = Object.values(
      useQueueExecutionStore.getState().executions
    );
    return executions.find((e) => e.issueId === issueId);
  };
