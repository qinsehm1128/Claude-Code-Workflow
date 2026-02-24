// ========================================
// AssociationHighlight Context
// ========================================
// React context provider for cross-panel association chain highlighting.
// Provides ephemeral UI state for linked-chain highlights shared across
// left/middle/right panels. The highlighted chain indicates which
// Issue, QueueItem, and Session are visually linked.
//
// Design rationale: React context chosen over Zustand store because
// highlight state is ephemeral UI state that does not need persistence
// or cross-page sharing.

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type { AssociationChain } from '@/types/terminal-dashboard';

// ========== Context Type ==========

interface AssociationHighlightContextType {
  /** Currently highlighted association chain, or null if nothing is highlighted */
  chain: AssociationChain | null;
  /** Set the highlighted chain (pass null to clear) */
  setChain: (chain: AssociationChain | null) => void;
  /** Check if a specific entity is part of the current highlighted chain */
  isHighlighted: (entityId: string, entityType: 'issue' | 'queue' | 'session') => boolean;
}

// ========== Context ==========

const AssociationHighlightContext = createContext<AssociationHighlightContextType | null>(null);

// ========== Provider ==========

export function AssociationHighlightProvider({ children }: { children: ReactNode }) {
  const [chain, setChainState] = useState<AssociationChain | null>(null);

  const setChain = useCallback((nextChain: AssociationChain | null) => {
    setChainState(nextChain);
  }, []);

  const isHighlighted = useCallback(
    (entityId: string, entityType: 'issue' | 'queue' | 'session'): boolean => {
      if (!chain) return false;
      switch (entityType) {
        case 'issue':
          return chain.issueId === entityId;
        case 'queue':
          return chain.queueItemId === entityId;
        case 'session':
          return chain.sessionId === entityId;
        default:
          return false;
      }
    },
    [chain]
  );

  const value = useMemo<AssociationHighlightContextType>(
    () => ({ chain, setChain, isHighlighted }),
    [chain, setChain, isHighlighted]
  );

  return (
    <AssociationHighlightContext.Provider value={value}>
      {children}
    </AssociationHighlightContext.Provider>
  );
}

// ========== Consumer Hook ==========

/**
 * Hook to access the association highlight context.
 * Must be used within an AssociationHighlightProvider.
 */
export function useAssociationHighlight(): AssociationHighlightContextType {
  const ctx = useContext(AssociationHighlightContext);
  if (!ctx) {
    throw new Error(
      'useAssociationHighlight must be used within an AssociationHighlightProvider'
    );
  }
  return ctx;
}
