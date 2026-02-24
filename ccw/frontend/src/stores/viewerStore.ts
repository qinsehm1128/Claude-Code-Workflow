// ========================================
// Viewer Store
// ========================================
// Zustand store for managing CLI Viewer layout and tab state

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { devtools, persist } from 'zustand/middleware';

// ========== Types ==========

/**
 * Unique identifier for a pane in the viewer layout
 */
export type PaneId = string;

/**
 * Unique identifier for a CLI execution
 */
export type CliExecutionId = string;

/**
 * Unique identifier for a tab
 */
export type TabId = string;

/**
 * Tab state representing a single tab in a pane
 */
export interface TabState {
  id: TabId;
  executionId: CliExecutionId;
  title: string;
  isPinned: boolean;
  order: number;
}

/**
 * Pane state representing a container for tabs
 */
export interface PaneState {
  id: PaneId;
  tabs: TabState[];
  activeTabId: TabId | null;
}

/**
 * Allotment layout group for nested split layouts
 */
export interface AllotmentLayoutGroup {
  direction: 'horizontal' | 'vertical';
  sizes?: number[];
  children: (PaneId | AllotmentLayoutGroup)[];
}

/**
 * Root layout type
 */
export type AllotmentLayout = AllotmentLayoutGroup;

/**
 * Viewer state interface
 */
export interface ViewerState {
  // Layout state
  layout: AllotmentLayout;
  panes: Record<PaneId, PaneState>;
  tabs: Record<TabId, TabState>;
  focusedPaneId: PaneId | null;

  // ID counters for generating unique IDs
  nextPaneIdCounter: number;
  nextTabIdCounter: number;

  // Actions
  setLayout: (newLayout: AllotmentLayout | ((prev: AllotmentLayout) => AllotmentLayout)) => void;
  addPane: (parentPaneId?: PaneId, direction?: 'horizontal' | 'vertical') => PaneId;
  removePane: (paneId: PaneId) => void;
  addTab: (paneId: PaneId, executionId: CliExecutionId, title: string) => TabId;
  removeTab: (paneId: PaneId, tabId: TabId) => void;
  setActiveTab: (paneId: PaneId, tabId: TabId) => void;
  moveTab: (sourcePaneId: PaneId, tabId: TabId, targetPaneId: PaneId, newIndex: number) => void;
  togglePinTab: (tabId: TabId) => void;
  setFocusedPane: (paneId: PaneId) => void;
  initializeDefaultLayout: (layoutName: 'single' | 'split-h' | 'split-v' | 'grid-2x2') => void;
  reset: () => void;
}

// ========== Constants ==========

const VIEWER_STORAGE_KEY = 'cli-viewer-storage';
const VIEWER_STORAGE_VERSION = 1;

// ========== Helper Functions ==========

/**
 * Generate a unique pane ID
 */
const generatePaneId = (counter: number): PaneId => `pane-${counter}`;

/**
 * Generate a unique tab ID
 */
const generateTabId = (counter: number): TabId => `tab-${counter}`;

/**
 * Check if a value is a PaneId (string) or AllotmentLayoutGroup
 */
const isPaneId = (value: PaneId | AllotmentLayoutGroup): value is PaneId => {
  return typeof value === 'string';
};

/**
 * Find a pane ID in the layout tree
 */
const findPaneInLayout = (
  layout: AllotmentLayout,
  paneId: PaneId
): { found: boolean; parent: AllotmentLayoutGroup | null; index: number } => {
  const search = (
    group: AllotmentLayoutGroup,
    _parent: AllotmentLayoutGroup | null
  ): { found: boolean; parent: AllotmentLayoutGroup | null; index: number } => {
    for (let i = 0; i < group.children.length; i++) {
      const child = group.children[i];
      if (isPaneId(child)) {
        if (child === paneId) {
          return { found: true, parent: group, index: i };
        }
      } else {
        const result = search(child, group);
        if (result.found) {
          return result;
        }
      }
    }
    return { found: false, parent: null, index: -1 };
  };

  return search(layout, null);
};

/**
 * Remove a pane from layout and clean up empty groups
 */
const removePaneFromLayout = (layout: AllotmentLayout, paneId: PaneId): AllotmentLayout => {
  const removeFromGroup = (group: AllotmentLayoutGroup): AllotmentLayoutGroup | null => {
    const newChildren: (PaneId | AllotmentLayoutGroup)[] = [];

    for (const child of group.children) {
      if (isPaneId(child)) {
        if (child !== paneId) {
          newChildren.push(child);
        }
      } else {
        const cleanedChild = removeFromGroup(child);
        if (cleanedChild && cleanedChild.children.length > 0) {
          // If only one child remains, flatten it
          if (cleanedChild.children.length === 1) {
            newChildren.push(cleanedChild.children[0]);
          } else {
            newChildren.push(cleanedChild);
          }
        }
      }
    }

    if (newChildren.length === 0) {
      return null;
    }

    // Update sizes proportionally when removing a child
    const newSizes = group.sizes
      ? group.sizes.filter((_, i) => {
          const child = group.children[i];
          return !isPaneId(child) || child !== paneId;
        })
      : undefined;

    // Normalize sizes to sum to 100
    const normalizedSizes = newSizes
      ? (() => {
          const total = newSizes.reduce((sum, s) => sum + s, 0);
          return total > 0 ? newSizes.map((s) => (s / total) * 100) : undefined;
        })()
      : undefined;

    return {
      direction: group.direction,
      sizes: normalizedSizes,
      children: newChildren,
    };
  };

  const result = removeFromGroup(layout);
  return result || { direction: 'horizontal', children: [] };
};

/**
 * Add a pane to the layout at a specific position
 */
const addPaneToLayout = (
  layout: AllotmentLayout,
  newPaneId: PaneId,
  parentPaneId?: PaneId,
  direction: 'horizontal' | 'vertical' = 'horizontal'
): AllotmentLayout => {
  if (!parentPaneId) {
    // Add to root level
    if (layout.children.length === 0) {
      return {
        ...layout,
        children: [newPaneId],
        sizes: [100],
      };
    }

    // If root direction matches, add as sibling
    if (layout.direction === direction) {
      const currentSizes = layout.sizes || layout.children.map(() => 100 / layout.children.length);
      const totalSize = currentSizes.reduce((sum, s) => sum + s, 0);
      const newSize = totalSize / (layout.children.length + 1);
      const scaleFactor = (totalSize - newSize) / totalSize;

      return {
        ...layout,
        children: [...layout.children, newPaneId],
        sizes: [...currentSizes.map((s) => s * scaleFactor), newSize],
      };
    }

    // Wrap entire layout in new group
    return {
      direction,
      sizes: [50, 50],
      children: [layout, newPaneId],
    };
  }

  // Add relative to a specific pane
  const addRelativeTo = (group: AllotmentLayoutGroup): AllotmentLayoutGroup => {
    const newChildren: (PaneId | AllotmentLayoutGroup)[] = [];
    let newSizes: number[] | undefined = group.sizes ? [] : undefined;

    for (let i = 0; i < group.children.length; i++) {
      const child = group.children[i];
      const childSize = group.sizes ? group.sizes[i] : undefined;

      if (isPaneId(child)) {
        if (child === parentPaneId) {
          if (group.direction === direction) {
            // Same direction, add as sibling
            const halfSize = (childSize || 50) / 2;
            newChildren.push(child, newPaneId);
            if (newSizes) {
              newSizes.push(halfSize, halfSize);
            }
          } else {
            // Different direction, wrap in new group
            const newGroup: AllotmentLayoutGroup = {
              direction,
              sizes: [50, 50],
              children: [child, newPaneId],
            };
            newChildren.push(newGroup);
            if (newSizes && childSize !== undefined) {
              newSizes.push(childSize);
            }
          }
        } else {
          newChildren.push(child);
          if (newSizes && childSize !== undefined) {
            newSizes.push(childSize);
          }
        }
      } else {
        // Recursively check nested groups
        const result = findPaneInLayout(child, parentPaneId);
        if (result.found) {
          newChildren.push(addRelativeTo(child));
        } else {
          newChildren.push(child);
        }
        if (newSizes && childSize !== undefined) {
          newSizes.push(childSize);
        }
      }
    }

    return {
      ...group,
      children: newChildren,
      sizes: newSizes,
    };
  };

  return addRelativeTo(layout);
};

/**
 * Get all pane IDs from layout
 */
const getAllPaneIds = (layout: AllotmentLayout): PaneId[] => {
  const paneIds: PaneId[] = [];

  const traverse = (group: AllotmentLayoutGroup) => {
    for (const child of group.children) {
      if (isPaneId(child)) {
        paneIds.push(child);
      } else {
        traverse(child);
      }
    }
  };

  traverse(layout);
  return paneIds;
};

// ========== Initial State ==========

const createDefaultLayout = (): AllotmentLayout => ({
  direction: 'horizontal',
  children: [],
});

const initialState: Omit<ViewerState, keyof ViewerStateActions> = {
  layout: createDefaultLayout(),
  panes: {},
  tabs: {},
  focusedPaneId: null,
  nextPaneIdCounter: 1,
  nextTabIdCounter: 1,
};

// Separate actions type for initial state typing
type ViewerStateActions = Pick<
  ViewerState,
  | 'setLayout'
  | 'addPane'
  | 'removePane'
  | 'addTab'
  | 'removeTab'
  | 'setActiveTab'
  | 'moveTab'
  | 'togglePinTab'
  | 'setFocusedPane'
  | 'initializeDefaultLayout'
  | 'reset'
>;

// ========== Store ==========

/**
 * Zustand store for CLI Viewer layout and tab management
 *
 * @remarks
 * Manages the split-pane layout, tabs within each pane, and tab state.
 * Uses persist middleware to save layout state to localStorage.
 *
 * @example
 * ```tsx
 * const { layout, addPane, addTab } = useViewerStore();
 * const paneId = addPane();
 * const tabId = addTab(paneId, 'exec-123', 'CLI Output');
 * ```
 */
export const useViewerStore = create<ViewerState>()(
  persist(
    devtools(
      (set, get) => ({
        ...initialState,

        // ========== Layout Actions ==========

        setLayout: (newLayout: AllotmentLayout | ((prev: AllotmentLayout) => AllotmentLayout)) => {
          if (typeof newLayout === 'function') {
            const currentLayout = get().layout;
            const result = newLayout(currentLayout);
            set({ layout: result }, false, 'viewer/setLayout');
          } else {
            set({ layout: newLayout }, false, 'viewer/setLayout');
          }
        },

        addPane: (parentPaneId?: PaneId, direction: 'horizontal' | 'vertical' = 'horizontal') => {
          const state = get();
          const newPaneId = generatePaneId(state.nextPaneIdCounter);

          const newPane: PaneState = {
            id: newPaneId,
            tabs: [],
            activeTabId: null,
          };

          const newLayout = addPaneToLayout(state.layout, newPaneId, parentPaneId, direction);

          set(
            {
              layout: newLayout,
              panes: {
                ...state.panes,
                [newPaneId]: newPane,
              },
              focusedPaneId: newPaneId,
              nextPaneIdCounter: state.nextPaneIdCounter + 1,
            },
            false,
            'viewer/addPane'
          );

          return newPaneId;
        },

        removePane: (paneId: PaneId) => {
          const state = get();
          const pane = state.panes[paneId];

          if (!pane) {
            console.warn(`[ViewerStore] Pane not found: ${paneId}`);
            return;
          }

          // Get all remaining panes
          const allPaneIds = getAllPaneIds(state.layout);
          if (allPaneIds.length <= 1) {
            console.warn('[ViewerStore] Cannot remove the last pane');
            return;
          }

          // Remove pane from layout
          const newLayout = removePaneFromLayout(state.layout, paneId);

          // Remove pane and its tabs
          const newPanes = { ...state.panes };
          delete newPanes[paneId];

          const newTabs = { ...state.tabs };
          for (const tab of pane.tabs) {
            delete newTabs[tab.id];
          }

          // Update focused pane if needed
          let newFocusedPaneId = state.focusedPaneId;
          if (newFocusedPaneId === paneId) {
            const remainingPaneIds = getAllPaneIds(newLayout);
            newFocusedPaneId = remainingPaneIds.length > 0 ? remainingPaneIds[0] : null;
          }

          set(
            {
              layout: newLayout,
              panes: newPanes,
              tabs: newTabs,
              focusedPaneId: newFocusedPaneId,
            },
            false,
            'viewer/removePane'
          );
        },

        // ========== Tab Actions ==========

        addTab: (paneId: PaneId, executionId: CliExecutionId, title: string) => {
          const state = get();
          const pane = state.panes[paneId];

          if (!pane) {
            console.warn(`[ViewerStore] Pane not found: ${paneId}`);
            return '';
          }

          // Check if tab for this execution already exists in this pane
          const existingTab = pane.tabs.find((t) => t.executionId === executionId);
          if (existingTab) {
            // Just activate the existing tab
            set(
              {
                panes: {
                  ...state.panes,
                  [paneId]: {
                    ...pane,
                    activeTabId: existingTab.id,
                  },
                },
                focusedPaneId: paneId,
              },
              false,
              'viewer/addTab-existing'
            );
            return existingTab.id;
          }

          // FIX-004: Global executionId deduplication (VSCode parity)
          // Check all panes for existing tab with same executionId
          for (const [pid, p] of Object.entries(state.panes)) {
            if (pid === paneId) continue; // Already checked above
            const existingInOtherPane = p.tabs.find((t) => t.executionId === executionId);
            if (existingInOtherPane) {
              // Activate the existing tab in its pane and focus that pane
              set(
                {
                  panes: {
                    ...state.panes,
                    [pid]: {
                      ...p,
                      activeTabId: existingInOtherPane.id,
                    },
                  },
                  focusedPaneId: pid,
                },
                false,
                'viewer/addTab-existing-global'
              );
              return existingInOtherPane.id;
            }
          }

          const newTabId = generateTabId(state.nextTabIdCounter);
          const maxOrder = pane.tabs.reduce((max, t) => Math.max(max, t.order), 0);

          const newTab: TabState = {
            id: newTabId,
            executionId,
            title,
            isPinned: false,
            order: maxOrder + 1,
          };

          const updatedPane: PaneState = {
            ...pane,
            tabs: [...pane.tabs, newTab],
            activeTabId: newTabId,
          };

          set(
            {
              panes: {
                ...state.panes,
                [paneId]: updatedPane,
              },
              tabs: {
                ...state.tabs,
                [newTabId]: newTab,
              },
              focusedPaneId: paneId,
              nextTabIdCounter: state.nextTabIdCounter + 1,
            },
            false,
            'viewer/addTab'
          );

          return newTabId;
        },

        removeTab: (paneId: PaneId, tabId: TabId) => {
          const state = get();
          const pane = state.panes[paneId];

          if (!pane) {
            console.warn(`[ViewerStore] Pane not found: ${paneId}`);
            return;
          }

          const tabIndex = pane.tabs.findIndex((t) => t.id === tabId);
          if (tabIndex === -1) {
            console.warn(`[ViewerStore] Tab not found: ${tabId}`);
            return;
          }

          const newTabs = pane.tabs.filter((t) => t.id !== tabId);

          // Determine new active tab
          let newActiveTabId: TabId | null = null;
          if (pane.activeTabId === tabId && newTabs.length > 0) {
            // Select the tab at the same index, or the last one
            const newActiveIndex = Math.min(tabIndex, newTabs.length - 1);
            newActiveTabId = newTabs[newActiveIndex].id;
          } else if (pane.activeTabId !== tabId) {
            newActiveTabId = pane.activeTabId;
          }

          const updatedPane: PaneState = {
            ...pane,
            tabs: newTabs,
            activeTabId: newActiveTabId,
          };

          const globalTabs = { ...state.tabs };
          delete globalTabs[tabId];

          set(
            {
              panes: {
                ...state.panes,
                [paneId]: updatedPane,
              },
              tabs: globalTabs,
            },
            false,
            'viewer/removeTab'
          );

          // FIX-003: Auto-cleanup empty panes after tab removal (VSCode parity)
          if (newTabs.length === 0) {
            const allPaneIds = getAllPaneIds(get().layout);
            // Don't remove if it's the last pane
            if (allPaneIds.length > 1) {
              // Use queueMicrotask to avoid state mutation during current transaction
              queueMicrotask(() => {
                const currentState = get();
                if (currentState.panes[paneId]?.tabs.length === 0) {
                  currentState.removePane(paneId);
                }
              });
            }
          }
        },

        setActiveTab: (paneId: PaneId, tabId: TabId) => {
          const state = get();
          const pane = state.panes[paneId];

          if (!pane) {
            console.warn(`[ViewerStore] Pane not found: ${paneId}`);
            return;
          }

          const tab = pane.tabs.find((t) => t.id === tabId);
          if (!tab) {
            console.warn(`[ViewerStore] Tab not found in pane: ${tabId}`);
            return;
          }

          set(
            {
              panes: {
                ...state.panes,
                [paneId]: {
                  ...pane,
                  activeTabId: tabId,
                },
              },
              focusedPaneId: paneId,
            },
            false,
            'viewer/setActiveTab'
          );
        },

        moveTab: (
          sourcePaneId: PaneId,
          tabId: TabId,
          targetPaneId: PaneId,
          newIndex: number
        ) => {
          const state = get();
          const sourcePane = state.panes[sourcePaneId];
          const targetPane = state.panes[targetPaneId];

          if (!sourcePane || !targetPane) {
            console.warn('[ViewerStore] Source or target pane not found');
            return;
          }

          const tabIndex = sourcePane.tabs.findIndex((t) => t.id === tabId);
          if (tabIndex === -1) {
            console.warn(`[ViewerStore] Tab not found: ${tabId}`);
            return;
          }

          const tab = sourcePane.tabs[tabIndex];

          // Remove from source
          const newSourceTabs = sourcePane.tabs.filter((t) => t.id !== tabId);

          // Determine new active tab for source pane
          let newSourceActiveTabId: TabId | null = sourcePane.activeTabId;
          if (sourcePane.activeTabId === tabId && newSourceTabs.length > 0) {
            const newActiveIndex = Math.min(tabIndex, newSourceTabs.length - 1);
            newSourceActiveTabId = newSourceTabs[newActiveIndex].id;
          } else if (sourcePane.activeTabId === tabId) {
            newSourceActiveTabId = null;
          }

          // Calculate new order based on target position
          let newOrder: number;
          if (sourcePaneId === targetPaneId) {
            // Moving within the same pane
            const sortedTabs = [...newSourceTabs].sort((a, b) => a.order - b.order);
            if (newIndex === 0) {
              newOrder = sortedTabs.length > 0 ? sortedTabs[0].order - 1 : 1;
            } else if (newIndex >= sortedTabs.length) {
              newOrder = sortedTabs.length > 0 ? sortedTabs[sortedTabs.length - 1].order + 1 : 1;
            } else {
              const prevOrder = sortedTabs[newIndex - 1].order;
              const nextOrder = sortedTabs[newIndex].order;
              newOrder = (prevOrder + nextOrder) / 2;
            }
          } else {
            // Moving to different pane
            const sortedTargetTabs = [...targetPane.tabs].sort((a, b) => a.order - b.order);
            if (newIndex === 0) {
              newOrder = sortedTargetTabs.length > 0 ? sortedTargetTabs[0].order - 1 : 1;
            } else if (newIndex >= sortedTargetTabs.length) {
              newOrder = sortedTargetTabs.length > 0 ? sortedTargetTabs[sortedTargetTabs.length - 1].order + 1 : 1;
            } else {
              const prevOrder = sortedTargetTabs[newIndex - 1].order;
              const nextOrder = sortedTargetTabs[newIndex].order;
              newOrder = (prevOrder + nextOrder) / 2;
            }
          }

          const movedTab: TabState = {
            ...tab,
            order: newOrder,
          };

          // Add to target
          let newTargetTabs: TabState[];
          if (sourcePaneId === targetPaneId) {
            newTargetTabs = [...newSourceTabs, movedTab];
          } else {
            newTargetTabs = [...targetPane.tabs, movedTab];
          }

          const updatedSourcePane: PaneState = {
            ...sourcePane,
            tabs: sourcePaneId === targetPaneId ? newTargetTabs : newSourceTabs,
            activeTabId: sourcePaneId === targetPaneId ? tabId : newSourceActiveTabId,
          };

          const updatedTargetPane: PaneState =
            sourcePaneId === targetPaneId
              ? updatedSourcePane
              : {
                  ...targetPane,
                  tabs: newTargetTabs,
                  activeTabId: tabId,
                };

          const newPanes = {
            ...state.panes,
            [sourcePaneId]: updatedSourcePane,
          };

          if (sourcePaneId !== targetPaneId) {
            newPanes[targetPaneId] = updatedTargetPane;
          }

          set(
            {
              panes: newPanes,
              tabs: {
                ...state.tabs,
                [tabId]: movedTab,
              },
              focusedPaneId: targetPaneId,
            },
            false,
            'viewer/moveTab'
          );

          // FIX-003: Auto-cleanup empty panes after tab movement (VSCode parity)
          // Only cleanup when moving to a different pane and source becomes empty
          if (sourcePaneId !== targetPaneId && newSourceTabs.length === 0) {
            const allPaneIds = getAllPaneIds(get().layout);
            // Don't remove if it's the last pane
            if (allPaneIds.length > 1) {
              // Use queueMicrotask to avoid state mutation during current transaction
              queueMicrotask(() => {
                const currentState = get();
                if (currentState.panes[sourcePaneId]?.tabs.length === 0) {
                  currentState.removePane(sourcePaneId);
                }
              });
            }
          }
        },

        togglePinTab: (tabId: TabId) => {
          const state = get();
          const tab = state.tabs[tabId];

          if (!tab) {
            console.warn(`[ViewerStore] Tab not found: ${tabId}`);
            return;
          }

          const updatedTab: TabState = {
            ...tab,
            isPinned: !tab.isPinned,
          };

          // Also update in the pane's tabs array
          const newPanes = { ...state.panes };
          for (const paneId of Object.keys(newPanes)) {
            const pane = newPanes[paneId];
            const tabIndex = pane.tabs.findIndex((t) => t.id === tabId);
            if (tabIndex !== -1) {
              newPanes[paneId] = {
                ...pane,
                tabs: pane.tabs.map((t) => (t.id === tabId ? updatedTab : t)),
              };
              break;
            }
          }

          set(
            {
              tabs: {
                ...state.tabs,
                [tabId]: updatedTab,
              },
              panes: newPanes,
            },
            false,
            'viewer/togglePinTab'
          );
        },

        // ========== Focus Actions ==========

        setFocusedPane: (paneId: PaneId) => {
          const state = get();
          if (!state.panes[paneId]) {
            console.warn(`[ViewerStore] Pane not found: ${paneId}`);
            return;
          }

          set({ focusedPaneId: paneId }, false, 'viewer/setFocusedPane');
        },

        // ========== Layout Initialization ==========

        initializeDefaultLayout: (layoutName: 'single' | 'split-h' | 'split-v' | 'grid-2x2') => {
          const state = get();
          let counter = state.nextPaneIdCounter;

          const createPane = (): PaneState => {
            const paneId = generatePaneId(counter++);
            return {
              id: paneId,
              tabs: [],
              activeTabId: null,
            };
          };

          let layout: AllotmentLayout;
          const panes: Record<PaneId, PaneState> = {};

          switch (layoutName) {
            case 'single': {
              const pane = createPane();
              panes[pane.id] = pane;
              layout = {
                direction: 'horizontal',
                sizes: [100],
                children: [pane.id],
              };
              break;
            }

            case 'split-h': {
              const pane1 = createPane();
              const pane2 = createPane();
              panes[pane1.id] = pane1;
              panes[pane2.id] = pane2;
              layout = {
                direction: 'horizontal',
                sizes: [50, 50],
                children: [pane1.id, pane2.id],
              };
              break;
            }

            case 'split-v': {
              const pane1 = createPane();
              const pane2 = createPane();
              panes[pane1.id] = pane1;
              panes[pane2.id] = pane2;
              layout = {
                direction: 'vertical',
                sizes: [50, 50],
                children: [pane1.id, pane2.id],
              };
              break;
            }

            case 'grid-2x2': {
              const pane1 = createPane();
              const pane2 = createPane();
              const pane3 = createPane();
              const pane4 = createPane();
              panes[pane1.id] = pane1;
              panes[pane2.id] = pane2;
              panes[pane3.id] = pane3;
              panes[pane4.id] = pane4;
              layout = {
                direction: 'vertical',
                sizes: [50, 50],
                children: [
                  {
                    direction: 'horizontal',
                    sizes: [50, 50],
                    children: [pane1.id, pane2.id],
                  },
                  {
                    direction: 'horizontal',
                    sizes: [50, 50],
                    children: [pane3.id, pane4.id],
                  },
                ],
              };
              break;
            }

            default:
              return;
          }

          const firstPaneId = Object.keys(panes)[0] || null;

          set(
            {
              layout,
              panes,
              tabs: {},
              focusedPaneId: firstPaneId,
              nextPaneIdCounter: counter,
              nextTabIdCounter: 1,
            },
            false,
            'viewer/initializeDefaultLayout'
          );
        },

        // ========== Reset ==========

        reset: () => {
          set(
            {
              layout: createDefaultLayout(),
              panes: {},
              tabs: {},
              focusedPaneId: null,
              nextPaneIdCounter: 1,
              nextTabIdCounter: 1,
            },
            false,
            'viewer/reset'
          );
        },
      }),
      { name: 'ViewerStore' }
    ),
    {
      name: VIEWER_STORAGE_KEY,
      version: VIEWER_STORAGE_VERSION,
      // Persist all layout state
      partialize: (state) => ({
        layout: state.layout,
        panes: state.panes,
        tabs: state.tabs,
        focusedPaneId: state.focusedPaneId,
        nextPaneIdCounter: state.nextPaneIdCounter,
        nextTabIdCounter: state.nextTabIdCounter,
      }),
    }
  )
);

// ========== Selectors ==========

/** Stable empty array to avoid new references */
const EMPTY_TABS: TabState[] = [];

/**
 * Select the current layout
 */
export const useViewerLayout = () => useViewerStore((state) => state.layout);

/**
 * Select all panes
 */
export const useViewerPanes = () => useViewerStore((state) => state.panes);

/**
 * Select all tabs
 */
export const useViewerTabs = () => useViewerStore((state) => state.tabs);

/**
 * Select the focused pane ID
 */
export const useFocusedPaneId = () => useViewerStore((state) => state.focusedPaneId);

/**
 * Select a specific pane by ID
 */
export const selectPane = (state: ViewerState, paneId: PaneId) => state.panes[paneId];

/**
 * Select a specific tab by ID
 */
export const selectTab = (state: ViewerState, tabId: TabId) => state.tabs[tabId];

/**
 * Select tabs for a specific pane, sorted by order.
 * WARNING: Returns new array each call — use with useMemo or useShallow in components.
 */
export const selectPaneTabs = (state: ViewerState, paneId: PaneId): TabState[] => {
  const pane = state.panes[paneId];
  if (!pane) return EMPTY_TABS;
  return [...pane.tabs].sort((a, b) => a.order - b.order);
};

/**
 * Select the active tab for a pane
 */
export const selectActiveTab = (state: ViewerState, paneId: PaneId): TabState | null => {
  const pane = state.panes[paneId];
  if (!pane || !pane.activeTabId) return null;
  return pane.tabs.find((t) => t.id === pane.activeTabId) || null;
};

// ========== Helper Hooks ==========

/**
 * Hook to get viewer actions
 * Useful for components that only need actions, not the full state
 */
export const useViewerActions = () => {
  return useViewerStore(useShallow((state) => ({
    setLayout: state.setLayout,
    addPane: state.addPane,
    removePane: state.removePane,
    addTab: state.addTab,
    removeTab: state.removeTab,
    setActiveTab: state.setActiveTab,
    moveTab: state.moveTab,
    togglePinTab: state.togglePinTab,
    setFocusedPane: state.setFocusedPane,
    initializeDefaultLayout: state.initializeDefaultLayout,
    reset: state.reset,
  })));
};
