// ========================================
// Flow Store
// ========================================
// Zustand store for Orchestrator flow editor state management

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  FlowStore,
  Flow,
  FlowNode,
  FlowEdge,
  NodeData,
  FlowEdgeData,
  QuickTemplate,
} from '../types/flow';
import { NODE_TYPE_CONFIGS as nodeConfigs, QUICK_TEMPLATES } from '../types/flow';

// localStorage key for custom templates
const CUSTOM_TEMPLATES_KEY = 'ccw-orchestrator-custom-templates';

// Load custom templates from localStorage
function loadCustomTemplatesFromStorage(): QuickTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Save custom templates to localStorage
function saveCustomTemplatesToStorage(templates: QuickTemplate[]): void {
  try {
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(templates));
  } catch (e) {
    console.error('Failed to save custom templates:', e);
  }
}

// Helper to generate unique IDs
const generateId = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

// API base URL
const API_BASE = '/api/orchestrator';

// Non-overlapping position calculation constants
const OVERLAP_THRESHOLD = 50; // px distance to consider as overlap
const OFFSET_X = 100;         // diagonal offset per attempt
const OFFSET_Y = 80;
const MAX_ATTEMPTS = 20;

/**
 * Calculate a position that does not overlap with existing nodes.
 * Shifts diagonally (x+100, y+80) until a free spot is found.
 */
function calculateNonOverlappingPosition(
  baseX: number,
  baseY: number,
  existingNodes: { position: { x: number; y: number } }[],
): { x: number; y: number } {
  let x = baseX;
  let y = baseY;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const hasOverlap = existingNodes.some((node) => {
      const dx = Math.abs(node.position.x - x);
      const dy = Math.abs(node.position.y - y);
      return dx < OVERLAP_THRESHOLD && dy < OVERLAP_THRESHOLD;
    });

    if (!hasOverlap) {
      return { x, y };
    }

    x += OFFSET_X;
    y += OFFSET_Y;
  }

  return { x, y };
}

// Initial state
const initialState = {
  // Current flow
  currentFlow: null as Flow | null,
  isModified: false,

  // Nodes and edges
  nodes: [] as FlowNode[],
  edges: [] as FlowEdge[],

  // Selection state
  selectedNodeId: null as string | null,
  selectedEdgeId: null as string | null,

  // Flow list
  flows: [] as Flow[],
  isLoadingFlows: false,

  // UI state
  isPaletteOpen: true,
  isPropertyPanelOpen: false,
  leftPanelTab: 'nodes' as const,

  // Custom templates (loaded from localStorage)
  customTemplates: loadCustomTemplatesFromStorage(),

  // Interaction mode
  interactionMode: 'pan' as const,
};

export const useFlowStore = create<FlowStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ========== Flow CRUD ==========

      setCurrentFlow: (flow: Flow | null) => {
        set(
          {
            currentFlow: flow,
            nodes: flow?.nodes ?? [],
            edges: flow?.edges ?? [],
            isModified: false,
            selectedNodeId: null,
            selectedEdgeId: null,
          },
          false,
          'setCurrentFlow'
        );
      },

      createFlow: (name: string, description?: string): Flow => {
        const flow: Flow = {
          id: generateId('flow'),
          name,
          description,
          version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          nodes: [],
          edges: [],
          variables: {},
          metadata: { source: 'custom' },
        };

        set(
          {
            currentFlow: flow,
            nodes: [],
            edges: [],
            isModified: true,
            selectedNodeId: null,
            selectedEdgeId: null,
          },
          false,
          'createFlow'
        );

        return flow;
      },

      saveFlow: async (): Promise<boolean> => {
        const { currentFlow, nodes, edges } = get();
        if (!currentFlow) return false;

        try {
          const flowToSave: Flow = {
            ...currentFlow,
            nodes,
            edges,
            updated_at: new Date().toISOString(),
          };

          const isNew = !get().flows.some((f) => f.id === currentFlow.id);
          const method = isNew ? 'POST' : 'PUT';
          const url = isNew
            ? `${API_BASE}/flows`
            : `${API_BASE}/flows/${currentFlow.id}`;

          const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(flowToSave),
            credentials: 'same-origin',
          });

          if (!response.ok) {
            throw new Error(`Failed to save flow: ${response.statusText}`);
          }

          const payload = await response.json();
          const savedFlow = (payload && typeof payload === 'object' && 'data' in payload)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? (payload as any).data
            : payload;

          set(
            (state) => ({
              currentFlow: savedFlow,
              isModified: false,
              flows: isNew
                ? [...state.flows, savedFlow]
                : state.flows.map((f) => (f.id === savedFlow.id ? savedFlow : f)),
            }),
            false,
            'saveFlow'
          );

          return true;
        } catch (error) {
          console.error('Error saving flow:', error);
          return false;
        }
      },

      loadFlow: async (id: string): Promise<boolean> => {
        try {
          const response = await fetch(`${API_BASE}/flows/${id}`, { credentials: 'same-origin' });
          if (!response.ok) {
            throw new Error(`Failed to load flow: ${response.statusText}`);
          }

          const payload = await response.json();
          const flow: Flow = (payload && typeof payload === 'object' && 'data' in payload)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? (payload as any).data
            : payload;

          set(
            {
              currentFlow: flow,
              nodes: flow.nodes,
              edges: flow.edges,
              isModified: false,
              selectedNodeId: null,
              selectedEdgeId: null,
            },
            false,
            'loadFlow'
          );

          return true;
        } catch (error) {
          console.error('Error loading flow:', error);
          return false;
        }
      },

      deleteFlow: async (id: string): Promise<boolean> => {
        try {
          const response = await fetch(`${API_BASE}/flows/${id}`, {
            method: 'DELETE',
            credentials: 'same-origin',
          });

          if (!response.ok) {
            throw new Error(`Failed to delete flow: ${response.statusText}`);
          }

          set(
            (state) => ({
              flows: state.flows.filter((f) => f.id !== id),
              currentFlow: state.currentFlow?.id === id ? null : state.currentFlow,
              nodes: state.currentFlow?.id === id ? [] : state.nodes,
              edges: state.currentFlow?.id === id ? [] : state.edges,
            }),
            false,
            'deleteFlow'
          );

          return true;
        } catch (error) {
          console.error('Error deleting flow:', error);
          return false;
        }
      },

      duplicateFlow: async (id: string): Promise<Flow | null> => {
        try {
          const response = await fetch(`${API_BASE}/flows/${id}/duplicate`, {
            method: 'POST',
            credentials: 'same-origin',
          });

          if (!response.ok) {
            throw new Error(`Failed to duplicate flow: ${response.statusText}`);
          }

          const payload = await response.json();
          const duplicatedFlow: Flow = (payload && typeof payload === 'object' && 'data' in payload)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? (payload as any).data
            : payload;

          set(
            (state) => ({
              flows: [...state.flows, duplicatedFlow],
            }),
            false,
            'duplicateFlow'
          );

          return duplicatedFlow;
        } catch (error) {
          console.error('Error duplicating flow:', error);
          return null;
        }
      },

      // ========== Node Operations ==========

      addNode: (position: { x: number; y: number }): string => {
        const config = nodeConfigs['prompt-template'];
        const id = generateId('node');
        const safePosition = calculateNonOverlappingPosition(
          position.x, position.y, get().nodes,
        );

        const newNode: FlowNode = {
          id,
          type: 'prompt-template',
          position: safePosition,
          data: { ...config.defaultData },
        };

        set(
          (state) => ({
            nodes: [...state.nodes, newNode],
            isModified: true,
            selectedNodeId: id,
          }),
          false,
          'addNode'
        );

        return id;
      },

      addNodeFromTemplate: (templateId: string, position: { x: number; y: number }): string => {
        // Look up in built-in templates first, then custom templates
        const template = QUICK_TEMPLATES.find((t) => t.id === templateId)
          || get().customTemplates.find((t) => t.id === templateId);
        if (!template) {
          console.error(`Template not found: ${templateId}`);
          return get().addNode(position);
        }

        const id = generateId('node');
        const config = nodeConfigs['prompt-template'];
        const safePosition = calculateNonOverlappingPosition(
          position.x, position.y, get().nodes,
        );

        // Merge template data with default data
        const nodeData: NodeData = {
          ...config.defaultData,
          ...template.data,
          label: template.data.label || template.label,
          contextRefs: template.data.contextRefs || [],
        };

        const newNode: FlowNode = {
          id,
          type: 'prompt-template',
          position: safePosition,
          data: nodeData,
        };

        set(
          (state) => ({
            nodes: [...state.nodes, newNode],
            isModified: true,
            selectedNodeId: id,
          }),
          false,
          'addNodeFromTemplate'
        );

        return id;
      },

      updateNode: (id: string, data: Partial<NodeData>) => {
        set(
          (state) => ({
            nodes: state.nodes.map((node) =>
              node.id === id
                ? { ...node, data: { ...node.data, ...data } as NodeData }
                : node
            ),
            isModified: true,
          }),
          false,
          'updateNode'
        );
      },

      removeNode: (id: string) => {
        set(
          (state) => ({
            nodes: state.nodes.filter((node) => node.id !== id),
            edges: state.edges.filter(
              (edge) => edge.source !== id && edge.target !== id
            ),
            isModified: true,
            selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
          }),
          false,
          'removeNode'
        );
      },

      setNodes: (nodes: FlowNode[]) => {
        set({ nodes, isModified: true }, false, 'setNodes');
      },

      // ========== Edge Operations ==========

      addEdge: (
        source: string,
        target: string,
        sourceHandle?: string,
        targetHandle?: string
      ): string => {
        const id = generateId('edge');

        const newEdge: FlowEdge = {
          id,
          source,
          target,
          sourceHandle,
          targetHandle,
        };

        set(
          (state) => ({
            edges: [...state.edges, newEdge],
            isModified: true,
          }),
          false,
          'addEdge'
        );

        return id;
      },

      updateEdge: (id: string, data: Partial<FlowEdgeData>) => {
        set(
          (state) => ({
            edges: state.edges.map((edge) =>
              edge.id === id ? { ...edge, data: { ...edge.data, ...data } } : edge
            ),
            isModified: true,
          }),
          false,
          'updateEdge'
        );
      },

      removeEdge: (id: string) => {
        set(
          (state) => ({
            edges: state.edges.filter((edge) => edge.id !== id),
            isModified: true,
            selectedEdgeId: state.selectedEdgeId === id ? null : state.selectedEdgeId,
          }),
          false,
          'removeEdge'
        );
      },

      setEdges: (edges: FlowEdge[]) => {
        set({ edges, isModified: true }, false, 'setEdges');
      },

      // ========== Selection ==========

      setSelectedNodeId: (id: string | null) => {
        set({ selectedNodeId: id, selectedEdgeId: null, isPropertyPanelOpen: id !== null }, false, 'setSelectedNodeId');
      },

      setSelectedEdgeId: (id: string | null) => {
        set({ selectedEdgeId: id, selectedNodeId: null }, false, 'setSelectedEdgeId');
      },

      // ========== Flow List ==========

      fetchFlows: async (): Promise<void> => {
        set({ isLoadingFlows: true }, false, 'fetchFlows/start');

        try {
          const response = await fetch(`${API_BASE}/flows`, { credentials: 'same-origin' });
          if (!response.ok) {
            throw new Error(`Failed to fetch flows: ${response.statusText}`);
          }

          const data = await response.json();
          const flows: Flow[] = Array.isArray(data?.data) ? data.data : (data?.flows || []);

          set({ flows, isLoadingFlows: false }, false, 'fetchFlows/success');
        } catch (error) {
          console.error('Error fetching flows:', error);
          set({ isLoadingFlows: false }, false, 'fetchFlows/error');
        }
      },

      // ========== UI State ==========

      setIsPaletteOpen: (open: boolean) => {
        set({ isPaletteOpen: open }, false, 'setIsPaletteOpen');
      },

      setIsPropertyPanelOpen: (open: boolean) => {
        set({ isPropertyPanelOpen: open }, false, 'setIsPropertyPanelOpen');
      },

      setLeftPanelTab: (tab) => {
        set({ leftPanelTab: tab }, false, 'setLeftPanelTab');
      },

      // ========== Interaction Mode ==========

      toggleInteractionMode: () => {
        set(
          (state) => ({
            interactionMode: state.interactionMode === 'pan' ? 'selection' : 'pan',
          }),
          false,
          'toggleInteractionMode'
        );
      },

      setInteractionMode: (mode: 'pan' | 'selection') => {
        set({ interactionMode: mode }, false, 'setInteractionMode');
      },

      // ========== Custom Templates ==========

      addCustomTemplate: (template: QuickTemplate) => {
        set(
          (state) => {
            const updated = [...state.customTemplates, template];
            saveCustomTemplatesToStorage(updated);
            return { customTemplates: updated };
          },
          false,
          'addCustomTemplate'
        );
      },

      removeCustomTemplate: (id: string) => {
        set(
          (state) => {
            const updated = state.customTemplates.filter((t) => t.id !== id);
            saveCustomTemplatesToStorage(updated);
            return { customTemplates: updated };
          },
          false,
          'removeCustomTemplate'
        );
      },

      saveNodeAsTemplate: (nodeId: string, label: string, description: string): QuickTemplate | null => {
        const node = get().nodes.find((n) => n.id === nodeId);
        if (!node) return null;

        const { executionStatus, executionError, executionResult, ...templateData } = node.data;
        const template: QuickTemplate = {
          id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          label,
          description,
          icon: 'MessageSquare',
          color: 'bg-blue-500',
          category: 'command',
          data: { ...templateData, label },
        };

        get().addCustomTemplate(template);
        return template;
      },

      loadCustomTemplates: () => {
        set({ customTemplates: loadCustomTemplatesFromStorage() }, false, 'loadCustomTemplates');
      },

      // ========== Utility ==========

      resetFlow: () => {
        set(
          {
            currentFlow: null,
            nodes: [],
            edges: [],
            isModified: false,
            selectedNodeId: null,
            selectedEdgeId: null,
          },
          false,
          'resetFlow'
        );
      },

      getSelectedNode: (): FlowNode | undefined => {
        const { nodes, selectedNodeId } = get();
        return nodes.find((node) => node.id === selectedNodeId);
      },

      markModified: () => {
        set({ isModified: true }, false, 'markModified');
      },
    }),
    { name: 'FlowStore' }
  )
);

// Selectors for common access patterns
export const selectCurrentFlow = (state: FlowStore) => state.currentFlow;
export const selectNodes = (state: FlowStore) => state.nodes;
export const selectEdges = (state: FlowStore) => state.edges;
export const selectSelectedNodeId = (state: FlowStore) => state.selectedNodeId;
export const selectSelectedEdgeId = (state: FlowStore) => state.selectedEdgeId;
export const selectFlows = (state: FlowStore) => state.flows;
export const selectIsModified = (state: FlowStore) => state.isModified;
export const selectIsLoadingFlows = (state: FlowStore) => state.isLoadingFlows;
export const selectIsPaletteOpen = (state: FlowStore) => state.isPaletteOpen;
export const selectIsPropertyPanelOpen = (state: FlowStore) => state.isPropertyPanelOpen;
