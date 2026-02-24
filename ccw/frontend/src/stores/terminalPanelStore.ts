// ========================================
// Terminal Panel Store
// ========================================
// Zustand store for terminal panel UI state management.
// Manages panel visibility, active terminal, view mode, and terminal ordering.
// Separated from cliSessionStore to keep UI state independent of data state.

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ========== Types ==========

export type PanelView = 'terminal' | 'queue';

export interface TerminalPanelState {
  /** Whether the bottom terminal panel is open */
  isPanelOpen: boolean;
  /** The sessionKey of the currently active terminal */
  activeTerminalId: string | null;
  /** Current panel view mode */
  panelView: PanelView;
  /** Ordered list of terminal sessionKeys (tab order) */
  terminalOrder: string[];
}

export interface TerminalPanelActions {
  /** Open panel and activate the given terminal; adds it to order if new */
  openTerminal: (sessionKey: string) => void;
  /** Close the terminal panel (keeps terminal order intact) */
  closePanel: () => void;
  /** Toggle panel open/closed; when opening, restores last active or shows queue */
  togglePanel: () => void;
  /** Switch active terminal without opening/closing */
  setActiveTerminal: (sessionKey: string) => void;
  /** Switch panel view between 'terminal' and 'queue' */
  setPanelView: (view: PanelView) => void;
  /** Add a terminal to the order list (no-op if already present) */
  addTerminal: (sessionKey: string) => void;
  /** Remove a terminal from the order list and adjust active if needed */
  removeTerminal: (sessionKey: string) => void;
}

export type TerminalPanelStore = TerminalPanelState & TerminalPanelActions;

// ========== Initial State ==========

const initialState: TerminalPanelState = {
  isPanelOpen: false,
  activeTerminalId: null,
  panelView: 'terminal',
  terminalOrder: [],
};

// ========== Store ==========

export const useTerminalPanelStore = create<TerminalPanelStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ========== Panel Lifecycle ==========

      openTerminal: (sessionKey: string) => {
        const { terminalOrder } = get();
        const nextOrder = terminalOrder.includes(sessionKey)
          ? terminalOrder
          : [...terminalOrder, sessionKey];

        set(
          {
            isPanelOpen: true,
            activeTerminalId: sessionKey,
            panelView: 'terminal',
            terminalOrder: nextOrder,
          },
          false,
          'openTerminal'
        );
      },

      closePanel: () => {
        set({ isPanelOpen: false }, false, 'closePanel');
      },

      togglePanel: () => {
        const { isPanelOpen, activeTerminalId, terminalOrder } = get();
        if (isPanelOpen) {
          set({ isPanelOpen: false }, false, 'togglePanel/close');
        } else {
          const nextActive = activeTerminalId ?? terminalOrder[0] ?? null;
          set(
            {
              isPanelOpen: true,
              activeTerminalId: nextActive,
              panelView: nextActive ? 'terminal' : 'queue',
            },
            false,
            'togglePanel/open'
          );
        }
      },

      // ========== Terminal Selection ==========

      setActiveTerminal: (sessionKey: string) => {
        set({ activeTerminalId: sessionKey }, false, 'setActiveTerminal');
      },

      // ========== View Mode ==========

      setPanelView: (view: PanelView) => {
        set({ panelView: view }, false, 'setPanelView');
      },

      // ========== Terminal Order Management ==========

      addTerminal: (sessionKey: string) => {
        const { terminalOrder } = get();
        if (terminalOrder.includes(sessionKey)) return;

        set(
          { terminalOrder: [...terminalOrder, sessionKey] },
          false,
          'addTerminal'
        );
      },

      removeTerminal: (sessionKey: string) => {
        const { terminalOrder, activeTerminalId } = get();
        const nextOrder = terminalOrder.filter((key) => key !== sessionKey);

        // If removed terminal was active, activate the previous or next neighbor
        let nextActive = activeTerminalId;
        if (activeTerminalId === sessionKey) {
          const removedIndex = terminalOrder.indexOf(sessionKey);
          if (nextOrder.length === 0) {
            nextActive = null;
          } else if (removedIndex >= nextOrder.length) {
            nextActive = nextOrder[nextOrder.length - 1];
          } else {
            nextActive = nextOrder[removedIndex];
          }
        }

        set(
          {
            terminalOrder: nextOrder,
            activeTerminalId: nextActive,
            // Auto-close panel when no terminals remain
            isPanelOpen: nextOrder.length > 0 ? get().isPanelOpen : false,
          },
          false,
          'removeTerminal'
        );
      },
    }),
    { name: 'TerminalPanelStore' }
  )
);

// ========== Selectors ==========

export const selectIsPanelOpen = (state: TerminalPanelStore) => state.isPanelOpen;
export const selectActiveTerminalId = (state: TerminalPanelStore) => state.activeTerminalId;
export const selectPanelView = (state: TerminalPanelStore) => state.panelView;
export const selectTerminalOrder = (state: TerminalPanelStore) => state.terminalOrder;
export const selectTerminalCount = (state: TerminalPanelStore) => state.terminalOrder.length;

// ========== Convenience Hooks ==========

/** Hook that returns the openTerminal action for use in event handlers */
export function useOpenTerminalPanel() {
  const openTerminal = useTerminalPanelStore((s) => s.openTerminal);
  return openTerminal;
}
